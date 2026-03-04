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
import type { ResilientLocator } from '../resilience/index.js';
import type { FilterConfig, DateRangeFilter, DropdownFilter } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { dateFilterSpec, dropdownFilterSpec, navSpecs } from './locator-specs.js';

const logger = createLogger('FilterStep');

/** Map of dropdown label to its default placeholder text. */
const PLACEHOLDER_MAP: Record<string, string> = {
    Status: 'All Statuses',
    Payer: 'All Payers',
    'Denial Code': 'All Codes',
    'Encounter Type': 'All Types',
    'Diagnosis (ICD-10)': 'All Codes',
};

/**
 * Converts a date from YYYY-MM-DD config format to MM/DD/YYYY display format.
 */
function toDisplayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${month}/${day}/${year}`;
}

/**
 * Applies a date-range filter by filling the From and To date picker inputs.
 */
async function applyDateRangeFilter(
    page: Page,
    locator: ResilientLocator,
    filter: DateRangeFilter,
): Promise<void> {
    logger.info('Applying date range filter', { from: filter.from, to: filter.to });

    // Optionally clear existing filters first
    const clearResult = await locator.resolve(navSpecs.clearFilters);
    if (clearResult !== null) {
        await clearResult.element.click();
        await page.waitForTimeout(500);
    }

    // Fill "From" date
    const fromResult = await locator.resolve(dateFilterSpec('From'));
    if (fromResult === null) {
        throw new Error('Failed to resolve "From" date picker');
    }
    await fromResult.element.fill(toDisplayDate(filter.from));

    // Fill "To" date
    const toResult = await locator.resolve(dateFilterSpec('To'));
    if (toResult === null) {
        throw new Error('Failed to resolve "To" date picker');
    }
    await toResult.element.fill(toDisplayDate(filter.to));

    // Press Tab to trigger filter application
    await page.keyboard.press('Tab');

    // Wait briefly for table to reload
    await page.waitForTimeout(1000);

    logger.info('Date range filter applied');
}

/**
 * Applies a dropdown filter by selecting the specified value from a PrimeNG dropdown.
 */
async function applyDropdownFilter(
    page: Page,
    locator: ResilientLocator,
    filter: DropdownFilter,
): Promise<void> {
    const placeholder = PLACEHOLDER_MAP[filter.label] ?? `All ${filter.label}s`;
    logger.info('Applying dropdown filter', { label: filter.label, value: filter.value, placeholder });

    // Resolve and click the dropdown to open it
    const dropdownResult = await locator.resolve(dropdownFilterSpec(filter.label, placeholder));
    if (dropdownResult === null) {
        throw new Error(`Failed to resolve dropdown filter: ${filter.label}`);
    }
    await dropdownResult.element.click();

    // Select the option from the overlay
    const option = page.getByText(filter.value, { exact: true });
    await option.click();

    // Wait for table to reload
    await page.waitForTimeout(1000);

    logger.info('Dropdown filter applied', { label: filter.label, value: filter.value });
}

/**
 * Applies an array of filters (date-range and/or dropdown) to the current report page.
 */
export async function applyFilters(
    page: Page,
    locator: ResilientLocator,
    filters: FilterConfig[],
): Promise<void> {
    logger.info('Applying filters', { count: filters.length });

    for (const filter of filters) {
        if (filter.type === 'dateRange') {
            await applyDateRangeFilter(page, locator, filter);
        } else {
            await applyDropdownFilter(page, locator, filter);
        }
    }

    logger.info('All filters applied');
}
