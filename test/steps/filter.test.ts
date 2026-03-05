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
import type { DateRangeFilter, DropdownFilter, FilterConfig } from '../../src/types/index';
import { applyFilters } from '../../src/steps/filter';

function makeLocatorResult(overrides?: Partial<LocatorResult>): LocatorResult {
    return {
        element: {
            fill: jest.fn().mockResolvedValue(undefined),
            click: jest.fn().mockResolvedValue(undefined),
        } as unknown as LocatorResult['element'],
        tier: 1,
        confidence: 0.95,
        strategy: 'role',
        latencyMs: 10,
        alternatives: [],
        ...overrides,
    };
}

function makePage(): Page {
    return {
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
        keyboard: {
            press: jest.fn().mockResolvedValue(undefined),
        },
        getByText: jest.fn().mockReturnValue({
            click: jest.fn().mockResolvedValue(undefined),
        }),
        getByRole: jest.fn().mockReturnValue({
            waitFor: jest.fn().mockResolvedValue(undefined),
            click: jest.fn().mockResolvedValue(undefined),
        }),
    } as unknown as Page;
}

describe('applyFilters', () => {
    let page: Page;

    beforeEach(() => {
        page = makePage();
    });

    it('should apply date range filter', async () => {
        // Create separate results for clear-filters, from-field, and to-field
        const clearResult = makeLocatorResult();
        const fromResult = makeLocatorResult();
        const toResult = makeLocatorResult();

        const mockLocator = {
            resolve: jest
                .fn()
                .mockResolvedValueOnce(clearResult) // Clear Filters button
                .mockResolvedValueOnce(fromResult) // From date picker
                .mockResolvedValueOnce(toResult), // To date picker
        } as unknown as ResilientLocator;

        const filters: FilterConfig[] = [
            { type: 'dateRange', from: '2025-01-01', to: '2025-12-31' },
        ];

        await applyFilters(page, mockLocator, filters);

        expect(mockLocator.resolve).toHaveBeenCalledTimes(3);
        // From field filled with MM/DD/YYYY format
        expect(fromResult.element.fill).toHaveBeenCalledWith('01/01/2025');
        // To field filled with MM/DD/YYYY format
        expect(toResult.element.fill).toHaveBeenCalledWith('12/31/2025');
        // Tab pressed to trigger filter
        expect(page.keyboard.press).toHaveBeenCalledWith('Tab');
    });

    it('should apply dropdown filter', async () => {
        const dropdownResult = makeLocatorResult();
        const optionClick = jest.fn().mockResolvedValue(undefined);

        const mockLocator = {
            resolve: jest.fn().mockResolvedValue(dropdownResult),
        } as unknown as ResilientLocator;

        (page.getByRole as jest.Mock).mockReturnValue({
            waitFor: jest.fn().mockResolvedValue(undefined),
            click: optionClick,
        });

        const filters: FilterConfig[] = [{ type: 'dropdown', label: 'Status', value: 'Pending' }];

        await applyFilters(page, mockLocator, filters);

        // Dropdown was resolved and clicked
        expect(mockLocator.resolve).toHaveBeenCalledTimes(1);
        expect(dropdownResult.element.click).toHaveBeenCalled();

        // Option selected by role
        expect(page.getByRole).toHaveBeenCalledWith('option', { name: 'Pending' });
    });

    it('should apply mixed filters in sequence', async () => {
        const clearResult = makeLocatorResult();
        const fromResult = makeLocatorResult();
        const toResult = makeLocatorResult();
        const dropdownResult = makeLocatorResult();
        const optionClick = jest.fn().mockResolvedValue(undefined);

        const mockLocator = {
            resolve: jest
                .fn()
                .mockResolvedValueOnce(clearResult) // Clear Filters
                .mockResolvedValueOnce(fromResult) // From date
                .mockResolvedValueOnce(toResult) // To date
                .mockResolvedValueOnce(dropdownResult), // Dropdown
        } as unknown as ResilientLocator;

        (page.getByRole as jest.Mock).mockReturnValue({
            waitFor: jest.fn().mockResolvedValue(undefined),
            click: optionClick,
        });

        const filters: FilterConfig[] = [
            { type: 'dateRange', from: '2025-06-01', to: '2025-06-30' } as DateRangeFilter,
            { type: 'dropdown', label: 'Payer', value: 'Medicare' } as DropdownFilter,
        ];

        await applyFilters(page, mockLocator, filters);

        // 3 resolves for date range (clear + from + to) + 1 for dropdown = 4
        expect(mockLocator.resolve).toHaveBeenCalledTimes(4);

        // Date range applied
        expect(fromResult.element.fill).toHaveBeenCalledWith('06/01/2025');
        expect(toResult.element.fill).toHaveBeenCalledWith('06/30/2025');
        expect(page.keyboard.press).toHaveBeenCalledWith('Tab');

        // Dropdown applied
        expect(dropdownResult.element.click).toHaveBeenCalled();
        expect(page.getByRole).toHaveBeenCalledWith('option', { name: 'Medicare' });
    });
});
