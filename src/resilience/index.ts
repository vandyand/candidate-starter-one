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
import { ExecutionTracer } from './tracer.js';
import { resolveTier1 } from './tier1.js';
import { resolveTier2 } from './tier2.js';
import { resolveTier3 } from './tier3.js';
import { resolveTier4 } from './tier4.js';

const logger = createLogger('ResilientLocator');

export class ResilientLocator {
    private readonly page: Page;
    private readonly tracer: ExecutionTracer;
    private readonly confidenceThreshold: number;
    private readonly stats: Record<string, number>;

    constructor(page: Page, outputDir: string, confidenceThreshold?: number) {
        this.page = page;
        this.tracer = new ExecutionTracer(outputDir);
        this.confidenceThreshold = confidenceThreshold ?? 0.7;
        this.stats = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, failed: 0 };
    }

    async resolve(spec: LocatorSpec): Promise<LocatorResult | null> {
        const start = performance.now();

        // Tier 1
        const t1 = await resolveTier1(this.page, spec);
        if (t1 !== null) {
            this.recordResolution(spec, t1, start);
            return t1;
        }

        // Tier 2
        const t2 = await resolveTier2(this.page, spec);
        if (t2 !== null) {
            this.recordResolution(spec, t2, start);
            return t2;
        }

        // Tier 3
        const t3 = await resolveTier3(this.page, spec, this.confidenceThreshold);
        if (t3 !== null) {
            this.recordResolution(spec, t3, start);
            return t3;
        }

        // Tier 4
        const t4 = await resolveTier4(this.page, spec);
        if (t4 !== null) {
            this.recordResolution(spec, t4, start);
            return t4;
        }

        // All tiers failed
        this.stats.failed += 1;
        const latencyMs = performance.now() - start;

        logger.error(`All tiers failed for "${spec.description}"`, { latencyMs });

        this.tracer.recordEvent({
            timestamp: new Date().toISOString(),
            action: `resolve:${spec.description}`,
            latencyMs,
            status: 'failure',
            details: { reason: 'all tiers exhausted' },
        });

        return null;
    }

    getResolutionStats(): Record<string, number> {
        return { ...this.stats };
    }

    getTracer(): ExecutionTracer {
        return this.tracer;
    }

    flush(): void {
        this.tracer.flush();
    }

    private recordResolution(
        spec: LocatorSpec,
        result: LocatorResult,
        start: number,
    ): void {
        const tierKey = `tier${result.tier}`;
        this.stats[tierKey] += 1;

        const latencyMs = performance.now() - start;
        const status = result.tier === 1 ? 'success' : 'degraded';

        this.tracer.recordEvent({
            timestamp: new Date().toISOString(),
            action: `resolve:${spec.description}`,
            tier: result.tier,
            confidence: result.confidence,
            strategy: result.strategy,
            latencyMs,
            status,
        });

        this.tracer.recordLocatorResolution(
            spec.description,
            result.tier,
            result.confidence,
            true,
        );

        if (result.tier > 1) {
            logger.warn(
                `Degraded resolution for "${spec.description}" — resolved at tier ${result.tier}`,
                {
                    tier: result.tier,
                    confidence: result.confidence,
                    strategy: result.strategy,
                },
            );
        }
    }
}

export { ExecutionTracer } from './tracer.js';
export { resolveTier1 } from './tier1.js';
export { resolveTier2 } from './tier2.js';
export { resolveTier3 } from './tier3.js';
export { resolveTier4 } from './tier4.js';
