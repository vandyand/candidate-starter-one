// Copyright 2025-2026 Lockbox AI, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { loadConfig } from '../config/loader.js';
import { ResilientLocator } from '../resilience/index.js';
import { login } from '../steps/login.js';
import { extractReport } from './report-extractor.js';
import { deduplicateRows, crossReferenceValidation } from '../pipeline/validate.js';
import type { FilterConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Orchestrator');

/** Map report slugs to their primary key column for deduplication. */
const PRIMARY_KEY_MAP: Record<string, string> = {
    'claim-status': 'Claim ID',
    denials: 'Claim ID',
    encounters: 'Encounter ID',
    'current-ar': 'Patient',
    'remittance-payments': 'Check / EFT #',
    'prior-authorizations': 'Auth #',
};

/** Per-report extraction result used for the run summary. */
interface ReportSummary {
    name: string;
    slug: string;
    rowCount: number;
    durationMs: number;
}

/**
 * Generate a Markdown run summary and write it to disk.
 */
function generateRunSummary(
    outputDir: string,
    locatorStats: Record<string, number>,
    reportSummaries: ReportSummary[],
): void {
    const reportsDir = path.join(outputDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const timestamp = new Date().toISOString();

    const lines: string[] = [
        '# Run Summary',
        '',
        `**Timestamp:** ${timestamp}`,
        '',
        '## Locator Resolution Stats',
        '',
        '| Tier | Count |',
        '|------|-------|',
    ];

    for (const [tier, count] of Object.entries(locatorStats)) {
        lines.push(`| ${tier} | ${count} |`);
    }

    lines.push('');
    lines.push('## Per-Report Extraction Summary');
    lines.push('');
    lines.push('| Report | Rows | Duration (ms) |');
    lines.push('|--------|------|---------------|');

    for (const summary of reportSummaries) {
        lines.push(`| ${summary.name} | ${summary.rowCount} | ${summary.durationMs} |`);
    }

    lines.push('');

    const summaryPath = path.join(reportsDir, 'run-summary.md');
    fs.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');

    logger.info('Run summary written', { path: summaryPath });
}

/**
 * Main orchestrator that drives the full automation pipeline:
 * load config, launch browser, login, extract reports across periods,
 * deduplicate, cross-validate, and generate a run summary.
 */
export async function run(): Promise<void> {
    // Step 1: Load config
    const config = loadConfig();

    // Step 2: Create output dirs
    const outputDir = path.resolve(process.cwd(), 'output');
    const downloadsDir = path.join(outputDir, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });

    // Step 3: Launch browser
    const browser = await chromium.launch({ headless: true });

    try {
        const context = await browser.newContext({ acceptDownloads: true });

        // Step 4: Start Playwright tracing
        await context.tracing.start({ screenshots: true, snapshots: true });

        const page = await context.newPage();
        const locator = new ResilientLocator(page, outputDir, config.settings.confidenceThreshold);

        // Step 5: Login
        const { url: baseUrl, credentials } = config.target;
        await login(page, locator, baseUrl, credentials.username, credentials.password);

        // Step 6: For each report, extract across periods
        const extractedData: Map<string, Record<string, unknown>[]> = new Map();
        const reportSummaries: ReportSummary[] = [];

        for (const report of config.reports) {
            const allRows: Record<string, unknown>[] = [];
            let totalDuration = 0;

            for (const period of config.periods) {
                // Build override filters: replace dateRange filter with this period
                const overrideFilters: FilterConfig[] = report.filters.map(f => {
                    if (f.type === 'dateRange') {
                        return { type: 'dateRange' as const, from: period.from, to: period.to };
                    }
                    return f;
                });

                // If there was no dateRange filter, add one from the period
                const hasDateRange = report.filters.some(f => f.type === 'dateRange');
                if (!hasDateRange) {
                    overrideFilters.unshift({
                        type: 'dateRange',
                        from: period.from,
                        to: period.to,
                    });
                }

                const result = await extractReport(
                    page,
                    locator,
                    report,
                    baseUrl,
                    outputDir,
                    overrideFilters,
                );

                allRows.push(...result.rows);
                totalDuration += result.metadata.durationMs;
            }

            // Deduplicate across periods by primary key
            const primaryKey =
                PRIMARY_KEY_MAP[report.slug] ?? Object.keys(allRows[0] ?? {})[0] ?? 'id';
            const { rows: dedupedRows, removed } = deduplicateRows(allRows, primaryKey);

            if (removed > 0) {
                logger.info('Deduplicated rows', {
                    report: report.slug,
                    keyColumn: primaryKey,
                    removed,
                    remaining: dedupedRows.length,
                });
            } else if (allRows.length > 0) {
                logger.info('No duplicates found', {
                    report: report.slug,
                    keyColumn: primaryKey,
                    totalRows: allRows.length,
                });
            }

            extractedData.set(report.slug, dedupedRows);

            reportSummaries.push({
                name: report.name,
                slug: report.slug,
                rowCount: dedupedRows.length,
                durationMs: totalDuration,
            });
        }

        // Step 7: Run cross-report validation where configured
        for (const report of config.reports) {
            if (report.validation.crossRef) {
                const { target, key } = report.validation.crossRef;
                const sourceRows = extractedData.get(report.slug) ?? [];
                const targetRows = extractedData.get(target) ?? [];

                const result = crossReferenceValidation(sourceRows, targetRows, key);

                if (result.warnings.length > 0) {
                    logger.warn('Cross-reference validation warnings', {
                        source: report.slug,
                        target,
                        warnings: result.warnings,
                    });
                }
            }
        }

        // Step 8: Generate Markdown run summary
        const locatorStats = locator.getResolutionStats();
        generateRunSummary(outputDir, locatorStats, reportSummaries);

        // Step 9: Stop tracing, save trace file
        const tracePath = path.join(outputDir, 'traces', 'playwright-trace.zip');
        fs.mkdirSync(path.dirname(tracePath), { recursive: true });
        await context.tracing.stop({ path: tracePath });

        // Step 10: Flush locator health
        locator.flush();

        logger.info('Orchestrator run complete');
    } finally {
        // Step 11: Close browser
        await browser.close();
    }
}
