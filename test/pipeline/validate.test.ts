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
