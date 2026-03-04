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
import type { LocatorSpec } from '../../src/types/index';
import { resolveTier1 } from '../../src/resilience/tier1';

function createMockLocator(count: number): Locator {
    const locator = {
        count: jest.fn().mockResolvedValue(count),
        first: jest.fn().mockReturnValue({ _isFirst: true } as unknown as Locator),
    } as unknown as Locator;
    return locator;
}

function createMockPage(
    overrides: {
        getByRole?: Locator;
        getByText?: Locator;
        getByLabel?: Locator;
        getByTestId?: Locator;
    } = {},
): Page {
    const noMatch = createMockLocator(0);
    return {
        getByRole: jest.fn().mockReturnValue(overrides.getByRole ?? noMatch),
        getByText: jest.fn().mockReturnValue(overrides.getByText ?? noMatch),
        getByLabel: jest.fn().mockReturnValue(overrides.getByLabel ?? noMatch),
        getByTestId: jest.fn().mockReturnValue(overrides.getByTestId ?? noMatch),
    } as unknown as Page;
}

describe('resolveTier1', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should resolve by role when available', async () => {
        const roleLocator = createMockLocator(1);
        const page = createMockPage({ getByRole: roleLocator });
        const spec: LocatorSpec = {
            description: 'Sign In button',
            tier1: { role: 'button', text: 'Sign In' },
        };

        const result = await resolveTier1(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(1);
        expect(result!.confidence).toBe(0.95);
        expect(result!.strategy).toBe('role(button, "Sign In")');
        expect(result!.element).toBe(roleLocator);
        expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Sign In' });
    });

    it('should fall through to text when role fails', async () => {
        const textLocator = createMockLocator(1);
        const page = createMockPage({ getByText: textLocator });
        const spec: LocatorSpec = {
            description: 'Sign In link',
            tier1: { role: 'link', text: 'Sign In' },
        };

        const result = await resolveTier1(page, spec);

        expect(result).not.toBeNull();
        expect(result!.strategy).toBe('text("Sign In")');
        expect(result!.element).toBe(textLocator);
    });

    it('should return null when no tier1 spec provided', async () => {
        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'no tier1',
        };

        const result = await resolveTier1(page, spec);

        expect(result).toBeNull();
    });

    it('should return null when all strategies fail', async () => {
        const page = createMockPage(); // all return count=0
        const spec: LocatorSpec = {
            description: 'missing element',
            tier1: { role: 'button', text: 'Nonexistent', label: 'Nope', testId: 'nada' },
        };

        const result = await resolveTier1(page, spec);

        expect(result).toBeNull();
    });

    it('should handle multiple matches (count > 1) by using first', async () => {
        const multiLocator = createMockLocator(3);
        const page = createMockPage({ getByRole: multiLocator });
        const spec: LocatorSpec = {
            description: 'ambiguous button',
            tier1: { role: 'button' },
        };

        const result = await resolveTier1(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(1);
        expect(result!.confidence).toBe(0.95);
        expect(multiLocator.first).toHaveBeenCalled();
    });
});
