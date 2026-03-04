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
import { resolveTier3 } from '../../src/resilience/tier3';

function createMockElement(
    tag: string,
    text: string,
    attrs: Record<string, string> = {},
): {
    evaluate: jest.Mock;
    getAttribute: jest.Mock;
} {
    return {
        evaluate: jest.fn().mockImplementation((fn: (e: HTMLElement) => unknown) => {
            // Simulate the two evaluate calls: tagName and innerText
            const fnStr = fn.toString();
            if (fnStr.includes('tagName')) {
                return Promise.resolve(tag);
            }
            return Promise.resolve(text);
        }),
        getAttribute: jest.fn().mockImplementation((attrName: string) => {
            return Promise.resolve(attrs[attrName] ?? null);
        }),
    };
}

function createMockPage(elements: ReturnType<typeof createMockElement>[]): Page {
    const nthMock = jest.fn().mockImplementation((i: number) => elements[i]);
    const locatorMock = {
        count: jest.fn().mockResolvedValue(elements.length),
        nth: nthMock,
    } as unknown as Locator;

    return {
        locator: jest.fn().mockReturnValue(locatorMock),
    } as unknown as Page;
}

describe('resolveTier3', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return null when spec.tier3 is undefined', async () => {
        const page = createMockPage([]);
        const spec: LocatorSpec = {
            description: 'no tier3',
        };

        const result = await resolveTier3(page, spec);
        expect(result).toBeNull();
    });

    it('should resolve best matching candidate above threshold', async () => {
        const elements = [
            createMockElement('div', 'Something else'),
            createMockElement('button', 'Sign In'),
            createMockElement('span', 'Footer text'),
        ];

        const page = createMockPage(elements);

        const spec: LocatorSpec = {
            description: 'Sign In button',
            tier3: {
                tag: 'button',
                visibleText: 'Sign In',
            },
        };

        const result = await resolveTier3(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(3);
        expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result!.strategy).toBe('fuzzy');
        // The locator should point to the button element (index 1)
        expect(page.locator).toHaveBeenCalledWith('button');
    });

    it('should return null when no candidate meets the threshold', async () => {
        const elements = [
            createMockElement('div', 'Completely unrelated'),
            createMockElement('span', 'Also unrelated'),
        ];

        const page = createMockPage(elements);

        const spec: LocatorSpec = {
            description: 'Sign In button',
            tier3: {
                tag: 'button',
                visibleText: 'Sign In',
            },
        };

        const result = await resolveTier3(page, spec);
        expect(result).toBeNull();
    });
});
