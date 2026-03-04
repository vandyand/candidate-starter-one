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
import type { LocatorSpec, LocatorResult } from '../../src/types/index';

jest.mock('../../src/resilience/tier1.js', () => ({ resolveTier1: jest.fn() }));
jest.mock('../../src/resilience/tier2.js', () => ({ resolveTier2: jest.fn() }));
jest.mock('../../src/resilience/tier3.js', () => ({ resolveTier3: jest.fn() }));
jest.mock('../../src/resilience/tier4.js', () => ({ resolveTier4: jest.fn() }));

jest.mock('../../src/resilience/tracer.js', () => ({
    ExecutionTracer: jest.fn().mockImplementation(() => ({
        recordEvent: jest.fn(),
        recordLocatorResolution: jest.fn(),
        flush: jest.fn(),
        getEvents: jest.fn().mockReturnValue([]),
        getHealth: jest.fn().mockReturnValue({}),
    })),
}));

import { ResilientLocator } from '../../src/resilience/index';
import { resolveTier1 } from '../../src/resilience/tier1';
import { resolveTier2 } from '../../src/resilience/tier2';
import { resolveTier3 } from '../../src/resilience/tier3';
import { resolveTier4 } from '../../src/resilience/tier4';

const mockTier1 = resolveTier1 as jest.MockedFunction<typeof resolveTier1>;
const mockTier2 = resolveTier2 as jest.MockedFunction<typeof resolveTier2>;
const mockTier3 = resolveTier3 as jest.MockedFunction<typeof resolveTier3>;
const mockTier4 = resolveTier4 as jest.MockedFunction<typeof resolveTier4>;

function makePage(): Page {
    return {} as unknown as Page;
}

function makeResult(tier: 1 | 2 | 3 | 4): LocatorResult {
    return {
        element: {} as unknown as Locator,
        tier,
        confidence: tier === 1 ? 0.95 : tier === 2 ? 0.85 : tier === 3 ? 0.75 : 0.6,
        strategy: `tier${tier}-strategy`,
        latencyMs: 10,
        alternatives: [],
    };
}

const spec: LocatorSpec = {
    description: 'test-element',
    tier1: { role: 'button', text: 'Submit' },
};

describe('ResilientLocator', () => {
    let locator: ResilientLocator;
    let page: Page;

    beforeEach(() => {
        jest.clearAllMocks();
        page = makePage();
        locator = new ResilientLocator(page, '/tmp/test-output');

        // Default: all tiers return null
        mockTier1.mockResolvedValue(null);
        mockTier2.mockResolvedValue(null);
        mockTier3.mockResolvedValue(null);
        mockTier4.mockResolvedValue(null);
    });

    it('resolves via Tier 1 when available', async () => {
        const result = makeResult(1);
        mockTier1.mockResolvedValue(result);

        const resolved = await locator.resolve(spec);

        expect(resolved).toBe(result);
        expect(mockTier1).toHaveBeenCalledWith(page, spec);
        expect(mockTier2).not.toHaveBeenCalled();
        expect(locator.getResolutionStats().tier1).toBe(1);
    });

    it('cascades to Tier 2 when Tier 1 fails', async () => {
        const result = makeResult(2);
        mockTier2.mockResolvedValue(result);

        const resolved = await locator.resolve(spec);

        expect(resolved).toBe(result);
        expect(mockTier1).toHaveBeenCalled();
        expect(mockTier2).toHaveBeenCalledWith(page, spec);
        expect(mockTier3).not.toHaveBeenCalled();
        expect(locator.getResolutionStats().tier2).toBe(1);
    });

    it('cascades to Tier 3 when Tiers 1-2 fail', async () => {
        const result = makeResult(3);
        mockTier3.mockResolvedValue(result);

        const resolved = await locator.resolve(spec);

        expect(resolved).toBe(result);
        expect(mockTier1).toHaveBeenCalled();
        expect(mockTier2).toHaveBeenCalled();
        expect(mockTier3).toHaveBeenCalledWith(page, spec, 0.7);
        expect(mockTier4).not.toHaveBeenCalled();
        expect(locator.getResolutionStats().tier3).toBe(1);
    });

    it('cascades to Tier 4 when Tiers 1-3 fail', async () => {
        const result = makeResult(4);
        mockTier4.mockResolvedValue(result);

        const resolved = await locator.resolve(spec);

        expect(resolved).toBe(result);
        expect(mockTier1).toHaveBeenCalled();
        expect(mockTier2).toHaveBeenCalled();
        expect(mockTier3).toHaveBeenCalled();
        expect(mockTier4).toHaveBeenCalledWith(page, spec);
        expect(locator.getResolutionStats().tier4).toBe(1);
    });

    it('returns null when all tiers fail', async () => {
        const resolved = await locator.resolve(spec);

        expect(resolved).toBeNull();
        expect(locator.getResolutionStats().failed).toBe(1);
    });

    it('tracks resolution stats across multiple calls', async () => {
        mockTier1.mockResolvedValueOnce(makeResult(1));
        mockTier1.mockResolvedValueOnce(null);
        mockTier2.mockResolvedValueOnce(makeResult(2));
        mockTier1.mockResolvedValueOnce(null);
        mockTier2.mockResolvedValueOnce(null);
        mockTier3.mockResolvedValueOnce(null);
        mockTier4.mockResolvedValueOnce(null);

        await locator.resolve(spec); // tier1
        await locator.resolve(spec); // tier2
        await locator.resolve(spec); // all fail

        const stats = locator.getResolutionStats();
        expect(stats.tier1).toBe(1);
        expect(stats.tier2).toBe(1);
        expect(stats.failed).toBe(1);
    });

    it('flush() delegates to tracer', () => {
        locator.flush();

        const tracer = locator.getTracer();
        expect(tracer.flush).toHaveBeenCalled();
    });
});
