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

import type { WorkflowConfig } from '../../src/types/index';

// --- Mock setup ---

const mockTracing = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
};

const mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    waitForLoadState: jest.fn().mockResolvedValue(undefined),
};

const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    tracing: mockTracing,
};

const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn().mockResolvedValue(mockBrowser),
    },
}));

const mockConfig: WorkflowConfig = {
    target: {
        url: 'https://example.com',
        credentials: { username: 'user', password: 'pass' },
    },
    reports: [
        {
            name: 'Claim Status',
            slug: 'claim-status',
            path: '/reports/claims',
            filters: [{ type: 'dateRange', from: '2024-01-01', to: '2024-06-01' }],
            columns: { exclude: [] },
            validation: { minRows: 1 },
        },
    ],
    periods: [{ from: '2024-01-01', to: '2024-06-01' }],
    settings: {
        confidenceThreshold: 0.7,
        screenshotOnDegradation: true,
        maxRetries: 3,
        downloadTimeoutMs: 30000,
    },
};

jest.mock('../../src/config/loader', () => ({
    loadConfig: jest.fn().mockReturnValue(mockConfig),
}));

const mockResolve = jest.fn().mockResolvedValue(null);
const mockGetResolutionStats = jest
    .fn()
    .mockReturnValue({ tier1: 0, tier2: 0, tier3: 0, tier4: 0, failed: 0 });
const mockFlush = jest.fn();

jest.mock('../../src/resilience/index', () => ({
    ResilientLocator: jest.fn().mockImplementation(() => ({
        resolve: mockResolve,
        getResolutionStats: mockGetResolutionStats,
        getTracer: jest.fn().mockReturnValue({ flush: jest.fn() }),
        flush: mockFlush,
    })),
}));

jest.mock('../../src/steps/login', () => ({
    login: jest.fn().mockResolvedValue(undefined),
}));

const mockExtractReport = jest.fn().mockResolvedValue({
    rows: [{ 'Claim ID': '001', Amount: 100 }],
    metadata: {
        reportType: 'claim-status',
        extractedAt: '2024-01-01T00:00:00.000Z',
        filters: [],
        rowCount: 1,
        columns: ['Claim ID', 'Amount'],
        locatorResolution: {},
        durationMs: 500,
    },
});

jest.mock('../../src/automation/report-extractor', () => ({
    extractReport: (...args: unknown[]) => mockExtractReport(...args),
}));

jest.mock('../../src/pipeline/validate', () => ({
    deduplicateRows: jest
        .fn()
        .mockReturnValue({ rows: [{ 'Claim ID': '001', Amount: 100 }], removed: 0 }),
    crossReferenceValidation: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    validateRowCount: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
}));

// --- Tests ---

import { chromium } from 'playwright';
import { login } from '../../src/steps/login';
import { run } from '../../src/automation/orchestrator';

describe('Orchestrator – run()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Re-apply mock return values after clearAllMocks
        (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
        mockBrowser.newContext.mockResolvedValue(mockContext);
        mockContext.newPage.mockResolvedValue(mockPage);
        mockExtractReport.mockResolvedValue({
            rows: [{ 'Claim ID': '001', Amount: 100 }],
            metadata: {
                reportType: 'claim-status',
                extractedAt: '2024-01-01T00:00:00.000Z',
                filters: [],
                rowCount: 1,
                columns: ['Claim ID', 'Amount'],
                locatorResolution: {},
                durationMs: 500,
            },
        });
    });

    it('launches browser, logs in, and closes browser', async () => {
        await run();

        expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
        expect(login).toHaveBeenCalledWith(
            mockPage,
            expect.anything(),
            'https://example.com',
            'user',
            'pass',
        );
        expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('starts and stops Playwright tracing', async () => {
        await run();

        expect(mockTracing.start).toHaveBeenCalledWith({
            screenshots: true,
            snapshots: true,
        });
        expect(mockTracing.stop).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('playwright-trace.zip') }),
        );
    });

    it('calls extractReport for each report-period combination', async () => {
        await run();

        // 1 report x 1 period = 1 extraction
        expect(mockExtractReport).toHaveBeenCalledTimes(1);
        expect(mockExtractReport).toHaveBeenCalledWith(
            mockPage,
            expect.anything(),
            mockConfig.reports[0],
            'https://example.com',
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'dateRange',
                    from: '2024-01-01',
                    to: '2024-06-01',
                }),
            ]),
        );
    });

    it('flushes locator health after extraction', async () => {
        await run();

        expect(mockFlush).toHaveBeenCalled();
    });

    it('closes browser even when an error occurs', async () => {
        mockExtractReport.mockRejectedValueOnce(new Error('extraction failed'));

        await expect(run()).rejects.toThrow('extraction failed');
        expect(mockBrowser.close).toHaveBeenCalled();
    });
});
