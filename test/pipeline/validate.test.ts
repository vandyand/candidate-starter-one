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

import {
    validateRowCount,
    crossReferenceValidation,
    deduplicateRows,
} from '../../src/pipeline/validate.js';

describe('validateRowCount', () => {
    it('passes when row count is at or above minimum', () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const result = validateRowCount(rows, 3);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('fails when row count is below minimum', () => {
        const rows = [{ id: 1 }];
        const result = validateRowCount(rows, 5);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('below minimum');
    });
});

describe('crossReferenceValidation', () => {
    it('warns on missing keys in target', () => {
        const source = [
            { 'Claim ID': 'CLM-001' },
            { 'Claim ID': 'CLM-002' },
            { 'Claim ID': 'CLM-003' },
        ];
        const target = [{ 'Claim ID': 'CLM-001' }];

        const result = crossReferenceValidation(source, target, 'Claim ID');

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('CLM-002');
        expect(result.warnings[0]).toContain('CLM-003');
    });
});

describe('deduplicateRows', () => {
    it('removes duplicates by key column', () => {
        const rows = [
            { 'Claim ID': 'CLM-001', Amount: 100 },
            { 'Claim ID': 'CLM-001', Amount: 200 },
            { 'Claim ID': 'CLM-002', Amount: 300 },
        ];

        const result = deduplicateRows(rows, 'Claim ID');

        expect(result.rows).toHaveLength(2);
        expect(result.removed).toBe(1);
        // Keeps the first occurrence.
        expect(result.rows[0]).toEqual({ 'Claim ID': 'CLM-001', Amount: 100 });
        expect(result.rows[1]).toEqual({ 'Claim ID': 'CLM-002', Amount: 300 });
    });
});
