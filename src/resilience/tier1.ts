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
import type { LocatorSpec, LocatorResult, Tier1Spec } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Tier1');

interface Strategy {
    name: string;
    locator: Locator;
}

function buildStrategies(page: Page, tier1: Tier1Spec): Strategy[] {
    const strategies: Strategy[] = [];

    if (tier1.role !== undefined) {
        const name =
            tier1.text !== undefined
                ? `role(${tier1.role}, "${tier1.text}")`
                : `role(${tier1.role})`;
        const locator =
            tier1.text !== undefined
                ? page.getByRole(tier1.role as Parameters<Page['getByRole']>[0], {
                      name: tier1.text,
                  })
                : page.getByRole(tier1.role as Parameters<Page['getByRole']>[0]);
        strategies.push({ name, locator });
    }

    if (tier1.text !== undefined) {
        strategies.push({
            name: `text("${tier1.text}")`,
            locator: page.getByText(tier1.text),
        });
    }

    if (tier1.label !== undefined) {
        strategies.push({
            name: `label("${tier1.label}")`,
            locator: page.getByLabel(tier1.label),
        });
    }

    if (tier1.testId !== undefined) {
        strategies.push({
            name: `testId("${tier1.testId}")`,
            locator: page.getByTestId(tier1.testId),
        });
    }

    if (tier1.css !== undefined) {
        strategies.push({
            name: `css("${tier1.css}")`,
            locator: page.locator(tier1.css),
        });
    }

    return strategies;
}

export async function resolveTier1(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (spec.tier1 === undefined) {
        return null;
    }

    const strategies = buildStrategies(page, spec.tier1);

    if (strategies.length === 0) {
        return null;
    }

    const alternatives: Locator[] = [];

    for (const strategy of strategies) {
        const start = performance.now();
        const count = await strategy.locator.count();
        const latencyMs = performance.now() - start;

        if (count === 1) {
            logger.debug(`Resolved "${spec.description}" via ${strategy.name}`, {
                tier: 1,
                confidence: 0.95,
                latencyMs,
            });

            return {
                element: strategy.locator,
                tier: 1,
                confidence: 0.95,
                strategy: strategy.name,
                latencyMs,
                alternatives,
            };
        }

        if (count > 1) {
            logger.debug(
                `Multiple matches (${count}) for "${spec.description}" via ${strategy.name}, using first`,
                { count },
            );

            return {
                element: strategy.locator.first(),
                tier: 1,
                confidence: 0.95,
                strategy: strategy.name,
                latencyMs,
                alternatives,
            };
        }

        // count === 0 — try next strategy
        alternatives.push(strategy.locator);
    }

    logger.debug(`No Tier 1 match for "${spec.description}"`);
    return null;
}
