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

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import type { ResilientLocator } from '../resilience/index.js';
import { createLogger } from '../utils/logger.js';
import { navSpecs } from './locator-specs.js';

const logger = createLogger('DownloadStep');

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Clicks the Download XLSX button, waits for the browser download event,
 * and saves the file to `outputDir/filename`.
 *
 * @returns The absolute path to the saved file, or `null` if the download
 *          did not trigger (e.g. empty result set).
 */
export async function downloadReport(
    page: Page,
    locator: ResilientLocator,
    outputDir: string,
    filename: string,
    timeoutMs?: number,
): Promise<string | null> {
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    logger.info('Starting XLSX download', { outputDir, filename, timeout });

    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Set up download event listener BEFORE clicking the button
    const downloadPromise = page.waitForEvent('download', { timeout });

    // Resolve and click the Download XLSX button
    const buttonResult = await locator.resolve(navSpecs.downloadXlsx);
    if (buttonResult === null) {
        throw new Error('Failed to resolve Download XLSX button');
    }
    await buttonResult.element.click();

    // Wait for the download event — may not fire for empty result sets
    try {
        const download = await downloadPromise;
        const filePath = join(outputDir, filename);
        await download.saveAs(filePath);
        logger.info('Download complete', { filePath });
        return filePath;
    } catch {
        logger.warn('Download did not trigger (empty result set?)', { filename });
        return null;
    }
}
