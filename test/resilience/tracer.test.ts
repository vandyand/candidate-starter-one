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
import * as os from 'node:os';
import type { TraceEvent } from '../../src/types/index';
import { ExecutionTracer } from '../../src/resilience/tracer';

describe('ExecutionTracer', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-test-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should create traces directory', () => {
        new ExecutionTracer(tmpDir);
        expect(fs.existsSync(path.join(tmpDir, 'traces'))).toBe(true);
    });

    it('should record and flush trace events to JSONL', () => {
        const tracer = new ExecutionTracer(tmpDir);

        const event: TraceEvent = {
            timestamp: new Date().toISOString(),
            action: 'click',
            tier: 1,
            confidence: 0.95,
            strategy: 'role(button)',
            latencyMs: 42,
            status: 'success',
        };

        tracer.recordEvent(event);
        tracer.recordEvent({ ...event, action: 'fill', latencyMs: 15 });

        expect(tracer.getEvents()).toHaveLength(2);

        tracer.flush();

        // Events should be cleared after flush
        expect(tracer.getEvents()).toHaveLength(0);

        // JSONL file should exist
        const traceFiles = fs.readdirSync(path.join(tmpDir, 'traces'));
        expect(traceFiles).toHaveLength(1);
        expect(traceFiles[0]).toMatch(/^execution-.*\.jsonl$/);

        // Verify JSONL content
        const content = fs.readFileSync(path.join(tmpDir, 'traces', traceFiles[0]), 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0]).action).toBe('click');
        expect(JSON.parse(lines[1]).action).toBe('fill');
    });

    it('should track locator health across resolutions', () => {
        const tracer = new ExecutionTracer(tmpDir);

        tracer.recordLocatorResolution('Sign In button', 1, 0.95, true);
        tracer.recordLocatorResolution('Sign In button', 1, 0.9, true);
        tracer.recordLocatorResolution('Sign In button', 2, 0.8, true);

        const health = tracer.getHealth();
        const entry = health['Sign In button'];

        expect(entry).toBeDefined();
        expect(entry.totalAttempts).toBe(3);
        expect(entry.tierSuccesses[1]).toBe(2);
        expect(entry.tierSuccesses[2]).toBe(1);
        expect(entry.tierFailures[1]).toBe(0);
        // Running average of 0.95, 0.90, 0.80
        expect(entry.averageConfidence).toBeCloseTo((0.95 + 0.9 + 0.8) / 3, 5);
    });

    it('should load existing health file on creation', () => {
        // Write a health file before creating the tracer
        const existingHealth = {
            'Login button': {
                description: 'Login button',
                totalAttempts: 5,
                tierSuccesses: { 1: 4, 2: 1, 3: 0, 4: 0 },
                tierFailures: { 1: 0, 2: 0, 3: 0, 4: 0 },
                averageConfidence: 0.92,
                lastUsed: '2026-01-01T00:00:00.000Z',
            },
        };
        fs.writeFileSync(
            path.join(tmpDir, 'locator-health.json'),
            JSON.stringify(existingHealth),
            'utf-8',
        );

        // Need to create traces dir since constructor will try
        const tracer = new ExecutionTracer(tmpDir);
        const health = tracer.getHealth();

        expect(health['Login button']).toBeDefined();
        expect(health['Login button'].totalAttempts).toBe(5);
        expect(health['Login button'].averageConfidence).toBe(0.92);
    });

    it('should handle missing health file gracefully', () => {
        // No health file exists — should not throw
        const tracer = new ExecutionTracer(tmpDir);
        const health = tracer.getHealth();

        expect(Object.keys(health)).toHaveLength(0);
    });
});
