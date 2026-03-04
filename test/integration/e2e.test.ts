import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { ResilientLocator } from '../../src/resilience/index.js';
import { loadConfig } from '../../src/config/loader.js';
import { login } from '../../src/steps/login.js';
import { extractReport } from '../../src/automation/report-extractor.js';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('E2E Integration', () => {
    let browser: Browser;
    let page: Page;
    let context: BrowserContext;
    let locator: ResilientLocator;
    const outputDir = path.join(process.cwd(), 'output', 'test-run');

    beforeAll(async () => {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ acceptDownloads: true });
        page = await context.newPage();
        locator = new ResilientLocator(page, outputDir);

        const config = loadConfig();
        await login(
            page,
            locator,
            config.target.url,
            config.target.credentials.username,
            config.target.credentials.password,
        );
    }, 30000);

    afterAll(async () => {
        locator.flush();
        await browser?.close();
        // Clean up test output
        fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('should extract Claim Status report with filters', async () => {
        const config = loadConfig();
        const report = config.reports.find((r) => r.slug === 'claim-status')!;
        const result = await extractReport(
            page,
            locator,
            report,
            config.target.url,
            path.join(outputDir, 'downloads'),
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.metadata.reportType).toBe('claim-status');
        expect(result.metadata.columns).toContain('Claim ID');
    }, 60000);

    it('should extract Denials report', async () => {
        const config = loadConfig();
        const report = config.reports.find((r) => r.slug === 'denials')!;
        const result = await extractReport(
            page,
            locator,
            report,
            config.target.url,
            path.join(outputDir, 'downloads'),
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.metadata.columns).toContain('Denial Code');
    }, 60000);

    it('should have high Tier 1 resolution rate', () => {
        const stats = locator.getResolutionStats();
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        if (total > 0) {
            const tier1Ratio = (stats.tier1 || 0) / total;
            expect(tier1Ratio).toBeGreaterThan(0.7);
        }
    });
});
