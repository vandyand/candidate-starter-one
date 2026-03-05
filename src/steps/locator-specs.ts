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

import type { LocatorSpec } from '../types/index.js';

// ---------------------------------------------------------------------------
// Login page locator specs
// ---------------------------------------------------------------------------

export const loginSpecs = {
    usernameField: {
        description: 'Username input field',
        tier1: { role: 'textbox', text: 'Username', label: 'Username' },
        tier3: { tag: 'input' },
        tier4: { searchText: 'Username' },
    } satisfies LocatorSpec,

    passwordField: {
        description: 'Password input field',
        tier1: { label: 'Password', css: 'input[type="password"]' },
        tier3: { tag: 'input', attributes: { type: 'password' } },
        tier4: { searchText: 'Password' },
    } satisfies LocatorSpec,

    signInButton: {
        description: 'Sign In button',
        tier1: { role: 'button', text: 'Sign In' },
        tier3: { tag: 'button', visibleText: 'Sign In' },
        tier4: { searchText: 'Sign In' },
    } satisfies LocatorSpec,
};

// ---------------------------------------------------------------------------
// Navigation locator specs
// ---------------------------------------------------------------------------

export const navSpecs = {
    reportsTab: {
        description: 'Reports tab',
        tier1: { role: 'tab', text: 'Reports' },
    } satisfies LocatorSpec,

    backToReports: {
        description: 'Back to Reports button',
        tier1: { role: 'button', text: 'Back to Reports' },
    } satisfies LocatorSpec,

    downloadXlsx: {
        description: 'Download XLSX button',
        tier1: { role: 'button', text: 'Download XLSX' },
    } satisfies LocatorSpec,

    clearFilters: {
        description: 'Clear Filters button',
        tier1: { role: 'button', text: 'Clear Filters' },
    } satisfies LocatorSpec,
};

// ---------------------------------------------------------------------------
// Dynamic locator spec factories
// ---------------------------------------------------------------------------

/**
 * Creates a locator spec for a report card identified by its display name.
 */
export function reportCardSpec(reportName: string): LocatorSpec {
    return {
        description: `Report card: ${reportName}`,
        tier1: { role: 'link', text: reportName },
        tier3: { visibleText: reportName },
        tier4: { searchText: reportName },
    };
}

/**
 * Creates a locator spec for a date-filter combobox ("From" or "To").
 */
export function dateFilterSpec(label: string): LocatorSpec {
    return {
        description: `Date filter: ${label}`,
        tier1: { role: 'combobox', text: label },
        tier3: { tag: 'input', attributes: { placeholder: label } },
        tier4: { searchText: label },
    };
}

/**
 * Creates a locator spec for a PrimeNG dropdown filter identified by placeholder text.
 */
export function dropdownFilterSpec(label: string, placeholder: string): LocatorSpec {
    return {
        description: `Dropdown filter: ${label}`,
        tier1: { role: 'combobox', text: placeholder },
        tier3: { tag: 'p-dropdown', attributes: { placeholder } },
        tier4: { searchText: placeholder },
    };
}
