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

import type { Page } from 'playwright';
import type { ResilientLocator } from '../resilience/index.js';
import type {
    ReportConfig,
    FilterConfig,
    ExtractionMetadata,
    DateRangeFilter,
} from '../types/index.js';
import { navigateToReport } from '../steps/navigate.js';
import { applyFilters } from '../steps/filter.js';
import { downloadReport } from '../steps/download.js';
import { parseXlsx } from '../pipeline/parse-xlsx.js';
import { validateRowCount } from '../pipeline/validate.js';
import { writeOutput } from '../pipeline/output.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ReportExtractor');

/**
 * Build a period label from filters by finding the dateRange filter
 * and formatting as "YYYY-MM-DD_YYYY-MM-DD".
 */
function buildPeriodLabel(filters: FilterConfig[]): string {
    const dateFilter = filters.find((f): f is DateRangeFilter => f.type === 'dateRange');
    if (dateFilter) {
        return `${dateFilter.from}_${dateFilter.to}`;
    }
    return 'no-date-range';
}

/**
 * Extract a single report: navigate, filter, download, parse, validate,
 * and write output files.
 */
export async function extractReport(
    page: Page,
    locator: ResilientLocator,
    report: ReportConfig,
    baseUrl: string,
    outputDir: string,
    overrideFilters?: FilterConfig[],
): Promise<{ rows: Record<string, unknown>[]; metadata: ExtractionMetadata }> {
    const startTime = Date.now();

    // Determine which filters to apply
    const filters = overrideFilters ?? report.filters;

    logger.info('Extracting report', { name: report.name, slug: report.slug });

    // Step 1: Navigate to report page
    await navigateToReport(page, locator, report.name, report.path, baseUrl);

    // Step 2: Apply filters
    await applyFilters(page, locator, filters);

    // Step 3: Build period label from dateRange filter
    const periodLabel = buildPeriodLabel(filters);

    // Step 4: Download XLSX to outputDir
    const filename = `${report.slug}_${periodLabel}.xlsx`;
    const filePath = await downloadReport(page, locator, outputDir, filename);

    // Step 5: Parse XLSX with column exclusions
    const parseResult = await parseXlsx(filePath, {
        excludeColumns: report.columns.exclude,
    });

    // Step 6: Validate row count
    const validation = validateRowCount(parseResult.rows, report.validation.minRows);
    if (!validation.valid) {
        logger.warn('Row count validation failed', {
            report: report.slug,
            errors: validation.errors,
        });
    }

    // Step 7: Build ExtractionMetadata
    const durationMs = Date.now() - startTime;
    const stats = locator.getResolutionStats();

    // Map resolution stats to the expected locatorResolution format.
    // The stats are tier counts; we record them as a summary entry.
    const locatorResolution: ExtractionMetadata['locatorResolution'] = {};
    for (const [key, count] of Object.entries(stats)) {
        if (count > 0 && key.startsWith('tier')) {
            const tier = parseInt(key.replace('tier', ''), 10) as 1 | 2 | 3 | 4;
            locatorResolution[key] = { tier, confidence: 1.0 };
        }
    }

    const metadata: ExtractionMetadata = {
        reportType: report.slug,
        extractedAt: new Date().toISOString(),
        filters,
        rowCount: parseResult.rows.length,
        columns: parseResult.columns,
        locatorResolution,
        durationMs,
    };

    // Step 8: Write output (data.json + metadata.json)
    writeOutput(outputDir, report.slug, periodLabel, parseResult.rows, metadata);

    logger.info('Report extraction complete', {
        slug: report.slug,
        rowCount: parseResult.rows.length,
        durationMs,
    });

    return { rows: parseResult.rows, metadata };
}
