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

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import ExcelJS from 'exceljs';
import { parseXlsx } from '../../src/pipeline/parse-xlsx.js';

describe('parseXlsx', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-xlsx-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    async function createTestXlsx(headers: string[], rows: unknown[][]): Promise<string> {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        sheet.addRow(headers);
        for (const row of rows) {
            sheet.addRow(row);
        }
        const filePath = path.join(tmpDir, 'test.xlsx');
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }

    it('parses XLSX into structured rows', async () => {
        const filePath = await createTestXlsx(
            ['Claim ID', 'Amount', 'Status'],
            [
                ['CLM-001', 150.0, 'Denied'],
                ['CLM-002', 275.5, 'Approved'],
                ['CLM-003', 99.99, 'Pending'],
            ],
        );

        const result = await parseXlsx(filePath);

        expect(result.columns).toEqual(['Claim ID', 'Amount', 'Status']);
        expect(result.rows).toHaveLength(3);
        expect(result.rawRowCount).toBe(3);
        expect(result.rows[0]).toEqual({
            'Claim ID': 'CLM-001',
            Amount: 150.0,
            Status: 'Denied',
        });
    });

    it('excludes specified columns', async () => {
        const filePath = await createTestXlsx(
            ['Claim ID', 'Amount', 'Internal Code'],
            [
                ['CLM-001', 150.0, 'X123'],
                ['CLM-002', 275.5, 'X456'],
            ],
        );

        const result = await parseXlsx(filePath, {
            excludeColumns: ['Internal Code'],
        });

        expect(result.columns).toEqual(['Claim ID', 'Amount']);
        expect(result.rows[0]).toEqual({
            'Claim ID': 'CLM-001',
            Amount: 150.0,
        });
        expect(result.rows[0]).not.toHaveProperty('Internal Code');
    });

    it('handles empty XLSX gracefully', async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Empty');
        const filePath = path.join(tmpDir, 'empty.xlsx');
        await workbook.xlsx.writeFile(filePath);

        const result = await parseXlsx(filePath);

        expect(result.columns).toEqual([]);
        expect(result.rows).toEqual([]);
        expect(result.rawRowCount).toBe(0);
    });
});
