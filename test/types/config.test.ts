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

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { WorkflowConfig, ReportConfig, FilterConfig } from '../../src/types/index';

const CONFIG_PATH = path.resolve(__dirname, '../../config/reports.yaml');

describe('config/reports.yaml', () => {
    let config: WorkflowConfig;

    beforeAll(() => {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        config = yaml.load(raw) as WorkflowConfig;
    });

    it('parses without error', () => {
        expect(config).toBeDefined();
    });

    it('has a target with url and credentials', () => {
        expect(config.target).toBeDefined();
        expect(typeof config.target.url).toBe('string');
        expect(config.target.url).toMatch(/^https?:\/\//);
        expect(typeof config.target.credentials.username).toBe('string');
        expect(typeof config.target.credentials.password).toBe('string');
    });

    it('contains exactly 6 reports', () => {
        expect(config.reports).toHaveLength(6);
    });

    it('each report has required fields', () => {
        for (const report of config.reports) {
            const r: ReportConfig = report;
            expect(typeof r.name).toBe('string');
            expect(typeof r.slug).toBe('string');
            expect(typeof r.path).toBe('string');
            expect(r.path).toMatch(/^\//);
            expect(Array.isArray(r.filters)).toBe(true);
            expect(r.columns).toBeDefined();
            expect(Array.isArray(r.columns.exclude)).toBe(true);
            expect(r.validation).toBeDefined();
            expect(typeof r.validation.minRows).toBe('number');
        }
    });

    it('every report has at least one dateRange filter', () => {
        for (const report of config.reports) {
            const dateFilters = report.filters.filter(
                (f: FilterConfig) => f.type === 'dateRange',
            );
            expect(dateFilters.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('has periods array with from/to strings', () => {
        expect(Array.isArray(config.periods)).toBe(true);
        expect(config.periods.length).toBeGreaterThan(0);
        for (const period of config.periods) {
            expect(typeof period.from).toBe('string');
            expect(typeof period.to).toBe('string');
        }
    });

    it('has settings with expected keys', () => {
        expect(typeof config.settings.confidenceThreshold).toBe('number');
        expect(typeof config.settings.screenshotOnDegradation).toBe('boolean');
        expect(typeof config.settings.maxRetries).toBe('number');
        expect(typeof config.settings.downloadTimeoutMs).toBe('number');
    });
});
