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

import type { Page, Locator } from 'playwright';
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { findTextInScreenshot } from './ocr-client.js';

const logger = createLogger('Tier4');

/**
 * Tier 4 resolution: captures a screenshot and uses GLM-OCR vision to locate
 * text on the page when all semantic/DOM-based tiers have failed.
 */
export async function resolveTier4(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (spec.tier4 === undefined) {
        return null;
    }

    const start = performance.now();
    const tier4 = spec.tier4;

    try {
        const screenshotOptions: {
            type: 'png';
            clip?: { x: number; y: number; width: number; height: number };
        } = {
            type: 'png',
        };

        if (tier4.region) {
            screenshotOptions.clip = tier4.region;
        }

        const screenshot = await page.screenshot(screenshotOptions);
        const ocrResult = await findTextInScreenshot(screenshot, tier4.searchText);
        const latencyMs = performance.now() - start;

        if (!ocrResult.found || ocrResult.confidence <= 0.5) {
            logger.debug(
                `No Tier 4 match for "${spec.description}" — OCR confidence too low or not found`,
            );
            return null;
        }

        // Calculate click coordinates, accounting for region offset
        const regionX = tier4.region?.x ?? 0;
        const regionY = tier4.region?.y ?? 0;
        const clickX = regionX + ocrResult.x + ocrResult.width / 2;
        const clickY = regionY + ocrResult.y + ocrResult.height / 2;

        // Create a pseudo-locator backed by mouse/keyboard actions
        const pseudoLocator = {
            async click(): Promise<void> {
                await page.mouse.click(clickX, clickY);
            },
            async fill(value: string): Promise<void> {
                await page.mouse.click(clickX, clickY);
                await page.keyboard.type(value);
            },
        } as unknown as Locator;

        logger.debug(
            `Resolved "${spec.description}" via OCR (confidence=${ocrResult.confidence.toFixed(3)})`,
            {
                tier: 4,
                confidence: ocrResult.confidence,
                latencyMs,
                clickX,
                clickY,
            },
        );

        return {
            element: pseudoLocator,
            tier: 4,
            confidence: ocrResult.confidence,
            strategy: 'glm-ocr',
            latencyMs,
            alternatives: [],
        };
    } catch (error) {
        logger.error('Tier 4 resolution failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
