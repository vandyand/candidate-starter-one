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
import { createLogger } from '../utils/logger.js';
import { navSpecs, reportCardSpec } from './locator-specs.js';

const logger = createLogger('NavigateStep');

/**
 * Clicks the Reports tab in the toolbar and waits for the /reports URL.
 */
export async function navigateToReports(
    page: Page,
    locator: ResilientLocator,
): Promise<void> {
    logger.info('Navigating to Reports page');

    const reportsTabResult = await locator.resolve(navSpecs.reportsTab);
    if (reportsTabResult === null) {
        throw new Error('Failed to resolve Reports tab');
    }
    await reportsTabResult.element.click();

    await page.waitForURL((url) => url.pathname.includes('/reports'), {
        timeout: 10_000,
    });

    logger.info('Arrived at Reports page');
}

/**
 * Navigates to a specific report page. First attempts direct URL navigation,
 * then falls back to clicking the report card from the Reports listing page.
 */
export async function navigateToReport(
    page: Page,
    locator: ResilientLocator,
    reportName: string,
    reportPath: string,
    baseUrl: string,
): Promise<void> {
    logger.info('Navigating to report', { reportName, reportPath });

    // Attempt direct navigation
    await page.goto(`${baseUrl}${reportPath}`);
    await page.waitForLoadState('networkidle');

    // Verify the heading matches the expected report name
    const heading = page.getByRole('heading', { name: reportName });
    const headingVisible = await heading.isVisible().catch(() => false);

    if (headingVisible) {
        logger.info('Navigated to report via direct URL', { reportName });
        return;
    }

    // Fallback: navigate through Reports page and click the card
    logger.warn('Direct navigation did not reveal expected heading; falling back to card click', {
        reportName,
    });

    await navigateToReports(page, locator);

    const cardResult = await locator.resolve(reportCardSpec(reportName));
    if (cardResult === null) {
        throw new Error(`Failed to resolve report card for "${reportName}"`);
    }
    await cardResult.element.click();

    await page.waitForLoadState('networkidle');
    logger.info('Navigated to report via card click', { reportName });
}
