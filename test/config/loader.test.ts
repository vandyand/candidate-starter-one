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
import { loadConfig } from '../../src/config/loader.js';

const CONFIG_PATH = path.resolve(__dirname, '../../config/reports.yaml');

describe('loadConfig', () => {
    // Preserve original env.
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('loads and parses config/reports.yaml correctly', () => {
        const config = loadConfig(CONFIG_PATH);

        expect(config.target.url).toBe('https://automation-target-one.engineering.lockboxai.com');
        expect(config.reports).toHaveLength(6);
        expect(config.reports[0].slug).toBe('claim-status');
        expect(config.periods).toHaveLength(2);
        expect(config.settings.confidenceThreshold).toBe(0.7);
        expect(config.settings.maxRetries).toBe(3);
    });

    it('applies environment variable overrides', () => {
        process.env.TARGET_URL = 'https://override.example.com';
        process.env.USERNAME = 'env-user';
        process.env.PASSWORD = 'env-pass';
        process.env.CONFIDENCE_THRESHOLD = '0.95';

        const config = loadConfig(CONFIG_PATH);

        expect(config.target.url).toBe('https://override.example.com');
        expect(config.target.credentials.username).toBe('env-user');
        expect(config.target.credentials.password).toBe('env-pass');
        expect(config.settings.confidenceThreshold).toBe(0.95);
    });
});
