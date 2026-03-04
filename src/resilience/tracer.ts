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

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TraceEvent, LocatorHealth, ResilienceTier } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExecutionTracer');

export class ExecutionTracer {
    private readonly tracesDir: string;
    private readonly healthFilePath: string;
    private events: TraceEvent[] = [];
    private health: Record<string, LocatorHealth> = {};

    constructor(outputDir: string) {
        this.tracesDir = path.join(outputDir, 'traces');
        this.healthFilePath = path.join(outputDir, 'locator-health.json');

        fs.mkdirSync(this.tracesDir, { recursive: true });

        this.loadHealth();
    }

    private loadHealth(): void {
        try {
            if (fs.existsSync(this.healthFilePath)) {
                const raw = fs.readFileSync(this.healthFilePath, 'utf-8');
                this.health = JSON.parse(raw) as Record<string, LocatorHealth>;
                logger.debug('Loaded existing locator health data', {
                    locators: Object.keys(this.health).length,
                });
            }
        } catch (err) {
            logger.warn('Failed to load locator health file, starting fresh', {
                error: String(err),
            });
            this.health = {};
        }
    }

    recordEvent(event: TraceEvent): void {
        this.events.push(event);
    }

    recordLocatorResolution(
        description: string,
        tier: ResilienceTier,
        confidence: number,
        success: boolean,
    ): void {
        const now = new Date().toISOString();

        if (this.health[description] === undefined) {
            this.health[description] = {
                description,
                totalAttempts: 0,
                tierSuccesses: { 1: 0, 2: 0, 3: 0, 4: 0 },
                tierFailures: { 1: 0, 2: 0, 3: 0, 4: 0 },
                averageConfidence: 0,
                lastUsed: now,
            };
        }

        const entry = this.health[description];
        entry.totalAttempts += 1;

        if (success) {
            entry.tierSuccesses[tier] += 1;
        } else {
            entry.tierFailures[tier] += 1;
        }

        // Running average: newAvg = oldAvg + (value - oldAvg) / n
        entry.averageConfidence =
            entry.averageConfidence +
            (confidence - entry.averageConfidence) / entry.totalAttempts;

        entry.lastUsed = now;
    }

    flush(): void {
        // Write events to JSONL
        if (this.events.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const traceFile = path.join(this.tracesDir, `execution-${timestamp}.jsonl`);
            const lines = this.events.map((e) => JSON.stringify(e)).join('\n');
            fs.writeFileSync(traceFile, lines + '\n', 'utf-8');
            logger.debug(`Flushed ${this.events.length} trace events`, { traceFile });
        }

        // Write health data
        fs.writeFileSync(this.healthFilePath, JSON.stringify(this.health, null, 2), 'utf-8');
        logger.debug('Wrote locator health data');

        // Clear in-memory events after flush
        this.events = [];
    }

    getEvents(): TraceEvent[] {
        return [...this.events];
    }

    getHealth(): Record<string, LocatorHealth> {
        return JSON.parse(JSON.stringify(this.health)) as Record<string, LocatorHealth>;
    }
}
