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
import type { LocatorResult } from '../../src/types/index';
import type { ResilientLocator } from '../../src/resilience/index';
import { login } from '../../src/steps/login';

function makeLocatorResult(): LocatorResult {
    return {
        element: { fill: jest.fn(), click: jest.fn() } as unknown as LocatorResult['element'],
        tier: 1,
        confidence: 0.95,
        strategy: 'role',
        latencyMs: 10,
        alternatives: [],
    };
}

function makePage(): Page {
    return {
        goto: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        waitForURL: jest.fn().mockResolvedValue(undefined),
    } as unknown as Page;
}

describe('login step', () => {
    let page: Page;

    beforeEach(() => {
        page = makePage();
    });

    it('should navigate to login URL and fill credentials', async () => {
        const result = makeLocatorResult();
        const mockLocator = {
            resolve: jest.fn().mockResolvedValue(result),
        } as unknown as ResilientLocator;

        await login(page, mockLocator, 'https://example.com', 'user1', 'pass1');

        expect(page.goto).toHaveBeenCalledWith('https://example.com/login');
        expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle');
        expect(mockLocator.resolve).toHaveBeenCalledTimes(3);

        // Username filled
        expect(result.element.fill).toHaveBeenCalledWith('user1');
        // Password filled
        expect(result.element.fill).toHaveBeenCalledWith('pass1');
        // Sign In clicked
        expect(result.element.click).toHaveBeenCalled();

        expect(page.waitForURL).toHaveBeenCalledWith(expect.any(Function), { timeout: 10_000 });
    });

    it('should throw when username field cannot be resolved', async () => {
        const mockLocator = {
            resolve: jest.fn().mockResolvedValue(null),
        } as unknown as ResilientLocator;

        await expect(
            login(page, mockLocator, 'https://example.com', 'user1', 'pass1'),
        ).rejects.toThrow('Failed to resolve username field');
    });
});
