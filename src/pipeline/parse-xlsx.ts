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

import ExcelJS from 'exceljs';

/** Options controlling which columns to include/exclude during parsing. */
export interface ParseOptions {
    excludeColumns?: string[];
}

/** The structured result of parsing an XLSX file. */
export interface ParseResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rawRowCount: number;
}

/**
 * Parse an XLSX file into structured rows.
 *
 * Reads the first worksheet, extracts column headers from row 1,
 * optionally filters out excluded columns, and builds one
 * Record<string, unknown> per data row (row 2+).
 */
export async function parseXlsx(
    filePath: string,
    options?: ParseOptions,
): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return { columns: [], rows: [], rawRowCount: 0 };
    }

    // Read header row (row 1).
    const headerRow = worksheet.getRow(1);
    const allColumns: { index: number; name: string }[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const name = String(cell.value ?? '').trim();
        if (name) {
            allColumns.push({ index: colNumber, name });
        }
    });

    // Apply column exclusions.
    const excluded = new Set(options?.excludeColumns ?? []);
    const columns = allColumns.filter((c) => !excluded.has(c.name));

    // Read data rows (row 2+).
    const rawRowCount = Math.max(0, worksheet.rowCount - 1);
    const rows: Record<string, unknown>[] = [];

    for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        // Skip completely empty rows.
        let hasValue = false;
        const record: Record<string, unknown> = {};
        for (const col of columns) {
            const cell = row.getCell(col.index);
            const value = cell.value;
            record[col.name] = value ?? null;
            if (value !== null && value !== undefined) {
                hasValue = true;
            }
        }
        if (hasValue) {
            rows.push(record);
        }
    }

    return {
        columns: columns.map((c) => c.name),
        rows,
        rawRowCount,
    };
}
