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

/** Result of a validation check. */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate that the number of rows meets a minimum threshold.
 */
export function validateRowCount(
    rows: Record<string, unknown>[],
    minRows: number,
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (rows.length < minRows) {
        errors.push(`Row count ${rows.length} is below minimum of ${minRows}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Cross-reference validation: check what percentage of source key values
 * exist in the target dataset, reporting missing values as warnings.
 */
export function crossReferenceValidation(
    sourceRows: Record<string, unknown>[],
    targetRows: Record<string, unknown>[],
    key: string,
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const targetKeys = new Set(targetRows.map(row => String(row[key] ?? '')));

    const missingKeys: string[] = [];
    for (const row of sourceRows) {
        const value = String(row[key] ?? '');
        if (value && !targetKeys.has(value)) {
            missingKeys.push(value);
        }
    }

    if (missingKeys.length > 0) {
        const pct =
            sourceRows.length > 0
                ? ((missingKeys.length / sourceRows.length) * 100).toFixed(1)
                : '0.0';
        warnings.push(
            `${missingKeys.length} source key(s) not found in target (${pct}%): ${missingKeys.join(', ')}`,
        );
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Find the actual column name in a row, matching case-insensitively.
 * Returns the exact key as it exists in the row, or null if not found.
 */
function findColumn(row: Record<string, unknown>, keyColumn: string): string | null {
    if (keyColumn in row) return keyColumn;
    const lower = keyColumn.toLowerCase();
    for (const k of Object.keys(row)) {
        if (k.toLowerCase() === lower) return k;
    }
    return null;
}

/**
 * Deduplicate rows by a key column, keeping the first occurrence.
 * If the key column is not found in the data, returns rows unchanged.
 */
export function deduplicateRows(
    rows: Record<string, unknown>[],
    keyColumn: string,
): { rows: Record<string, unknown>[]; removed: number } {
    if (rows.length === 0) return { rows: [], removed: 0 };

    // Resolve actual column name (case-insensitive)
    const actualKey = findColumn(rows[0], keyColumn);
    if (actualKey === null) {
        return { rows, removed: 0 };
    }

    const seen = new Set<string>();
    const deduped: Record<string, unknown>[] = [];
    let removed = 0;

    for (const row of rows) {
        const key = String(row[actualKey] ?? '');
        if (seen.has(key)) {
            removed++;
        } else {
            seen.add(key);
            deduped.push(row);
        }
    }

    return { rows: deduped, removed };
}
