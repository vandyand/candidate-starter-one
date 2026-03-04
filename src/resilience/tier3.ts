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
import type { LocatorSpec, LocatorResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { scoreCandidates } from './fuzzy.js';
import type { CandidateFeatures } from './fuzzy.js';

const logger = createLogger('Tier3');

const DEFAULT_THRESHOLD = 0.7;
const MAX_CANDIDATES = 100;

/**
 * Tier 3 resolution: scans the DOM for candidate elements, builds feature
 * vectors, and scores them using fuzzy string matching algorithms.
 */
export async function resolveTier3(
    page: Page,
    spec: LocatorSpec,
    confidenceThreshold?: number,
): Promise<LocatorResult | null> {
    if (spec.tier3 === undefined) {
        return null;
    }

    const threshold = confidenceThreshold ?? DEFAULT_THRESHOLD;
    const tier3 = spec.tier3;
    const start = performance.now();

    const selector = tier3.tag ?? '*';
    const elements = page.locator(selector);
    const totalCount = await elements.count();
    const scanCount = Math.min(totalCount, MAX_CANDIDATES);

    const candidates: CandidateFeatures[] = [];

    for (let i = 0; i < scanCount; i++) {
        const el = elements.nth(i);

        const tag: string = await el.evaluate(e => e.tagName.toLowerCase());
        const text: string = await el.evaluate(
            e => (e as unknown as { innerText?: string }).innerText?.trim() ?? '',
        );

        const attrs: Record<string, string> = {};
        if (tier3.attributes !== undefined) {
            for (const attrName of Object.keys(tier3.attributes)) {
                const val = await el.getAttribute(attrName);
                if (val !== null) {
                    attrs[attrName] = val;
                }
            }
        }

        candidates.push({ tag, text, attributes: attrs });
    }

    const scored = scoreCandidates(candidates, {
        tag: tier3.tag,
        visibleText: tier3.visibleText,
        attributes: tier3.attributes,
    });

    const latencyMs = performance.now() - start;

    if (scored.length > 0 && scored[0].score >= threshold) {
        const best = scored[0];

        logger.debug(
            `Resolved "${spec.description}" via fuzzy match (score=${best.score.toFixed(3)})`,
            {
                tier: 3,
                confidence: best.score,
                latencyMs,
                breakdown: best.breakdown,
            },
        );

        return {
            element: elements.nth(best.index),
            tier: 3,
            confidence: best.score,
            strategy: 'fuzzy',
            latencyMs,
            alternatives: [],
        };
    }

    logger.debug(`No Tier 3 match for "${spec.description}" above threshold ${threshold}`);
    return null;
}
