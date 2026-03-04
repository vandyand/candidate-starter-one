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

import { createLogger } from '../../src/utils/logger';
import type { Logger } from '../../src/utils/logger';

describe('createLogger', () => {
    let originalLogLevel: string | undefined;

    beforeEach(() => {
        originalLogLevel = process.env.LOG_LEVEL;
        process.env.LOG_LEVEL = 'debug';
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        if (originalLogLevel === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = originalLogLevel;
        }
        jest.restoreAllMocks();
    });

    it('returns a logger with debug, info, warn, and error methods', () => {
        const logger: Logger = createLogger('test');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
    });

    it('formats messages with ISO timestamp, level, and context', () => {
        const logger = createLogger('MyContext');
        logger.info('hello world');

        expect(console.log).toHaveBeenCalledTimes(1);
        const output = (console.log as jest.Mock).mock.calls[0][0] as string;

        // ISO 8601 timestamp at the start
        expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        // Level tag
        expect(output).toContain('[INFO]');
        // Context tag
        expect(output).toContain('[MyContext]');
        // Message text
        expect(output).toContain('hello world');
    });

    it('appends JSON data when provided', () => {
        const logger = createLogger('ctx');
        logger.info('with data', { key: 'value', num: 42 });

        const output = (console.log as jest.Mock).mock.calls[0][0] as string;
        expect(output).toContain('{"key":"value","num":42}');
    });

    it('does not append data object when data is omitted', () => {
        const logger = createLogger('ctx');
        logger.info('no data');

        const output = (console.log as jest.Mock).mock.calls[0][0] as string;
        // Should end with the message, no trailing JSON
        expect(output).toMatch(/no data$/);
    });

    it('routes warn to console.warn', () => {
        const logger = createLogger('ctx');
        logger.warn('caution');

        expect(console.warn).toHaveBeenCalledTimes(1);
        const output = (console.warn as jest.Mock).mock.calls[0][0] as string;
        expect(output).toContain('[WARN]');
    });

    it('routes error to console.error', () => {
        const logger = createLogger('ctx');
        logger.error('failure');

        expect(console.error).toHaveBeenCalledTimes(1);
        const output = (console.error as jest.Mock).mock.calls[0][0] as string;
        expect(output).toContain('[ERROR]');
    });

    it('respects LOG_LEVEL filtering', () => {
        process.env.LOG_LEVEL = 'warn';
        const logger = createLogger('ctx');

        logger.debug('hidden');
        logger.info('hidden');
        logger.warn('visible');
        logger.error('visible');

        expect(console.log).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('defaults to info level when LOG_LEVEL is unset', () => {
        delete process.env.LOG_LEVEL;
        const logger = createLogger('ctx');

        logger.debug('hidden');
        logger.info('visible');

        expect(console.log).toHaveBeenCalledTimes(1);
        const output = (console.log as jest.Mock).mock.calls[0][0] as string;
        expect(output).toContain('[INFO]');
    });

    it('defaults to info level for invalid LOG_LEVEL values', () => {
        process.env.LOG_LEVEL = 'bogus';
        const logger = createLogger('ctx');

        logger.debug('hidden');
        logger.info('visible');

        expect(console.log).toHaveBeenCalledTimes(1);
    });
});
