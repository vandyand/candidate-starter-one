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

jest.mock('../../src/resilience/tier1.js', () => ({
    resolveTier1: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveTier1 } = require('../../src/resilience/tier1.js') as {
    resolveTier1: jest.Mock;
};

import { resolveTier2 } from '../../src/resilience/tier2';

function createMockLocator(count: number): Locator {
    const locator = {
        count: jest.fn().mockResolvedValue(count),
        first: jest.fn().mockReturnValue({ _isFirst: true } as unknown as Locator),
        getByRole: jest.fn(),
        getByText: jest.fn(),
        getByLabel: jest.fn(),
        getByTestId: jest.fn(),
        locator: jest.fn(),
    } as unknown as Locator;
    return locator;
}

function createMockPage(): Page {
    const noMatch = createMockLocator(0);
    return {
        getByRole: jest.fn().mockReturnValue(noMatch),
        getByText: jest.fn().mockReturnValue(noMatch),
        getByLabel: jest.fn().mockReturnValue(noMatch),
        getByTestId: jest.fn().mockReturnValue(noMatch),
        locator: jest.fn().mockReturnValue(noMatch),
    } as unknown as Page;
}

describe('resolveTier2', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        resolveTier1.mockReset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return null when spec.tier2 is undefined', async () => {
        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'no tier2',
        };

        const result = await resolveTier2(page, spec);

        expect(result).toBeNull();
        expect(resolveTier1).not.toHaveBeenCalled();
    });

    it('should return null when anchor cannot be resolved', async () => {
        resolveTier1.mockResolvedValue(null);

        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'missing anchor',
            tier2: {
                anchor: {
                    description: 'some heading',
                    tier1: { role: 'heading', text: 'Settings' },
                },
                relationship: 'below',
                target: { role: 'button' },
            },
        };

        const result = await resolveTier2(page, spec);

        expect(result).toBeNull();
        expect(resolveTier1).toHaveBeenCalledWith(page, spec.tier2!.anchor);
    });

    it('should resolve target relative to anchor using "below"', async () => {
        const targetLocator = createMockLocator(1);

        // The page.getByRole returns a locator with a .below() method
        const roleLocator = {
            count: jest.fn(),
            below: jest.fn().mockReturnValue(targetLocator),
        } as unknown as Locator;

        const page = createMockPage();
        (page.getByRole as jest.Mock).mockReturnValue(roleLocator);

        const anchorElement = createMockLocator(1);
        const anchorResult: LocatorResult = {
            element: anchorElement,
            tier: 1,
            confidence: 0.95,
            strategy: 'role(heading, "Settings")',
            latencyMs: 5,
            alternatives: [],
        };
        resolveTier1.mockResolvedValue(anchorResult);

        const spec: LocatorSpec = {
            description: 'save button below Settings',
            tier2: {
                anchor: {
                    description: 'Settings heading',
                    tier1: { role: 'heading', text: 'Settings' },
                },
                relationship: 'below',
                target: { role: 'button', text: 'Save' },
            },
        };

        const result = await resolveTier2(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(2);
        expect(result!.confidence).toBe(0.85);
        expect(result!.strategy).toBe('anchor(below)');
        expect(result!.element).toBe(targetLocator);
        expect(roleLocator.below).toHaveBeenCalledWith(anchorElement);
    });

    it('should resolve target "within" anchor using anchorElement.getByRole', async () => {
        const targetLocator = createMockLocator(1);

        const anchorElement = createMockLocator(1);
        (anchorElement.getByRole as jest.Mock).mockReturnValue(targetLocator);

        const anchorResult: LocatorResult = {
            element: anchorElement,
            tier: 1,
            confidence: 0.95,
            strategy: 'role(region)',
            latencyMs: 3,
            alternatives: [],
        };
        resolveTier1.mockResolvedValue(anchorResult);

        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'input within form',
            tier2: {
                anchor: {
                    description: 'form region',
                    tier1: { role: 'region' },
                },
                relationship: 'within',
                target: { role: 'textbox', text: 'Email' },
            },
        };

        const result = await resolveTier2(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(2);
        expect(result!.confidence).toBe(0.85);
        expect(result!.strategy).toBe('anchor(within)');
        expect(result!.element).toBe(targetLocator);
        expect(anchorElement.getByRole).toHaveBeenCalledWith('textbox', { name: 'Email' });
    });

    it('should return null when target count is zero', async () => {
        const targetLocator = createMockLocator(0);

        const roleLocator = {
            count: jest.fn(),
            near: jest.fn().mockReturnValue(targetLocator),
        } as unknown as Locator;

        const page = createMockPage();
        (page.getByRole as jest.Mock).mockReturnValue(roleLocator);

        const anchorElement = createMockLocator(1);
        const anchorResult: LocatorResult = {
            element: anchorElement,
            tier: 1,
            confidence: 0.95,
            strategy: 'role(heading)',
            latencyMs: 2,
            alternatives: [],
        };
        resolveTier1.mockResolvedValue(anchorResult);

        const spec: LocatorSpec = {
            description: 'button near heading',
            tier2: {
                anchor: {
                    description: 'heading',
                    tier1: { role: 'heading' },
                },
                relationship: 'near',
                target: { role: 'button' },
            },
        };

        const result = await resolveTier2(page, spec);

        expect(result).toBeNull();
    });
});
