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
import type { LocatorSpec, LocatorResult, Tier2Spec } from '../types/index.js';
import { resolveTier1 } from './tier1.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Tier2');

/**
 * Build a page-level locator for the target element based on the tier2 target spec.
 * If a role is specified, uses getByRole; if text is specified, uses getByText;
 * otherwise falls back to getByLabel or getByTestId.
 */
function buildTargetLocator(page: Page, target: NonNullable<Tier2Spec['target']>): Locator {
    if (target.role !== undefined) {
        if (target.text !== undefined) {
            return page.getByRole(target.role as Parameters<Page['getByRole']>[0], {
                name: target.text,
            });
        }
        return page.getByRole(target.role as Parameters<Page['getByRole']>[0]);
    }
    if (target.text !== undefined) {
        return page.getByText(target.text);
    }
    if (target.label !== undefined) {
        return page.getByLabel(target.label);
    }
    if (target.testId !== undefined) {
        return page.getByTestId(target.testId);
    }
    // Fallback: match any element — caller should ensure target has at least one field
    return page.locator('*');
}

/**
 * Resolve the target element relative to the anchor using the specified relationship.
 */
function resolveRelative(
    page: Page,
    anchorElement: Locator,
    relationship: Tier2Spec['relationship'],
    target: NonNullable<Tier2Spec['target']>,
): Locator {
    const targetLocator = buildTargetLocator(page, target);

    switch (relationship) {
        case 'near':
            return (targetLocator as unknown as { near: (anchor: Locator) => Locator }).near(
                anchorElement,
            );
        case 'below':
            return (targetLocator as unknown as { below: (anchor: Locator) => Locator }).below(
                anchorElement,
            );
        case 'above':
            return (targetLocator as unknown as { above: (anchor: Locator) => Locator }).above(
                anchorElement,
            );
        case 'leftOf':
            return (targetLocator as unknown as { leftOf: (anchor: Locator) => Locator }).leftOf(
                anchorElement,
            );
        case 'rightOf':
            return (targetLocator as unknown as { rightOf: (anchor: Locator) => Locator }).rightOf(
                anchorElement,
            );
        case 'within':
            if (target.role !== undefined) {
                if (target.text !== undefined) {
                    return anchorElement.getByRole(
                        target.role as Parameters<Locator['getByRole']>[0],
                        { name: target.text },
                    );
                }
                return anchorElement.getByRole(target.role as Parameters<Locator['getByRole']>[0]);
            }
            if (target.text !== undefined) {
                return anchorElement.getByText(target.text);
            }
            if (target.label !== undefined) {
                return anchorElement.getByLabel(target.label);
            }
            if (target.testId !== undefined) {
                return anchorElement.getByTestId(target.testId);
            }
            return anchorElement.locator('xpath=following-sibling::*').first();
        default:
            throw new Error(`Unknown relationship: ${relationship as string}`);
    }
}

export async function resolveTier2(page: Page, spec: LocatorSpec): Promise<LocatorResult | null> {
    if (spec.tier2 === undefined) {
        return null;
    }

    try {
        const start = performance.now();

        // Resolve the anchor element via Tier 1
        const anchorResult = await resolveTier1(page, spec.tier2.anchor);
        if (anchorResult === null) {
            logger.debug(`Anchor not found for "${spec.description}"`);
            return null;
        }

        const target = spec.tier2.target ?? {};
        const locator = resolveRelative(
            page,
            anchorResult.element,
            spec.tier2.relationship,
            target,
        );

        const count = await locator.count();
        const latencyMs = performance.now() - start;

        if (count === 0) {
            logger.debug(`No Tier 2 match for "${spec.description}" (${spec.tier2.relationship})`);
            return null;
        }

        const element = count === 1 ? locator : locator.first();
        const strategy = `anchor(${spec.tier2.relationship})`;

        if (count > 1) {
            logger.debug(
                `Multiple matches (${count}) for "${spec.description}" via ${strategy}, using first`,
                { count },
            );
        } else {
            logger.debug(`Resolved "${spec.description}" via ${strategy}`, {
                tier: 2,
                confidence: 0.85,
                latencyMs,
            });
        }

        return {
            element,
            tier: 2,
            confidence: 0.85,
            strategy,
            latencyMs,
            alternatives: [],
        };
    } catch (error) {
        logger.debug(`Tier 2 error for "${spec.description}": ${String(error)}`);
        return null;
    }
}
