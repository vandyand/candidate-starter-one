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

import { chromium, type Browser, type Page } from 'playwright';
import { findTextInScreenshot } from '../../src/resilience/ocr-client.js';

const RUN_OCR = process.env.RUN_OCR_INTEGRATION === 'true';
const TARGET_URL = 'https://automation-target-one.engineering.lockboxai.com';
const OCR_ENDPOINT = process.env.OCR_ENDPOINT ?? 'http://127.0.0.1:7899/ocr';

const describeOrSkip = RUN_OCR ? describe : describe.skip;

describeOrSkip('OCR Integration (Tier 4)', () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        page = await context.newPage();
    });

    afterAll(async () => {
        await browser?.close();
    });

    it('should find "Sign In" text on the login page', async () => {
        await page.goto(`${TARGET_URL}/login`);
        await page.waitForLoadState('networkidle');

        const screenshot = await page.screenshot();
        const result = await findTextInScreenshot(screenshot, 'Sign In', OCR_ENDPOINT);

        expect(result.found).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.x).toBeGreaterThan(0);
        expect(result.y).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    it('should find "Username" label on the login page', async () => {
        const screenshot = await page.screenshot();
        const result = await findTextInScreenshot(screenshot, 'Username', OCR_ENDPOINT);

        expect(result.found).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should find "Password" label on the login page', async () => {
        const screenshot = await page.screenshot();
        const result = await findTextInScreenshot(screenshot, 'Password', OCR_ENDPOINT);

        expect(result.found).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return not-found for text that does not exist', async () => {
        const screenshot = await page.screenshot();
        const result = await findTextInScreenshot(screenshot, 'xyznonexistent123', OCR_ENDPOINT);

        expect(result.found).toBe(false);
    });

    it('should find elements on a report page after login', async () => {
        // Login first
        await page.goto(`${TARGET_URL}/login`);
        await page.waitForLoadState('networkidle');
        await page.locator('input[formcontrolname="username"]').fill('admin');
        await page.locator('input[type="password"]').fill('nxqz7bkm2wvj4rt9yphe6csa5ufd1lg3');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL(url => !url.pathname.includes('/login'), {
            timeout: 10000,
        });

        // Navigate via the Reports link in the app (not a full page reload)
        await page.getByText('Reports').first().click();
        await page.waitForTimeout(1000);
        // Click the Claim Status report card
        await page.getByText('Claim Status').first().click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Allow Angular table to render

        const screenshot = await page.screenshot();

        // Should find report-related text
        const statusResult = await findTextInScreenshot(screenshot, 'Status', OCR_ENDPOINT);
        expect(statusResult.found).toBe(true);
    }, 45000);
});
