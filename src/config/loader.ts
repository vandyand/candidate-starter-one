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

import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { WorkflowConfig } from '../types/index.js';

/**
 * Load workflow configuration from a YAML file.
 *
 * Reads the file at `configPath` (defaulting to `config/reports.yaml`
 * relative to the project root), parses it, and applies environment
 * variable overrides for common fields:
 *
 * - `TARGET_URL`            -> `target.url`
 * - `USERNAME`              -> `target.credentials.username`
 * - `PASSWORD`              -> `target.credentials.password`
 * - `CONFIDENCE_THRESHOLD`  -> `settings.confidenceThreshold`
 */
export function loadConfig(configPath?: string): WorkflowConfig {
    const resolvedPath =
        configPath ?? path.resolve(process.cwd(), 'config', 'reports.yaml');

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const config = yaml.load(raw) as WorkflowConfig;

    // Apply environment variable overrides.
    if (process.env.TARGET_URL) {
        config.target.url = process.env.TARGET_URL;
    }
    if (process.env.USERNAME) {
        config.target.credentials.username = process.env.USERNAME;
    }
    if (process.env.PASSWORD) {
        config.target.credentials.password = process.env.PASSWORD;
    }
    if (process.env.CONFIDENCE_THRESHOLD) {
        const parsed = parseFloat(process.env.CONFIDENCE_THRESHOLD);
        if (!isNaN(parsed)) {
            config.settings.confidenceThreshold = parsed;
        }
    }

    return config;
}
