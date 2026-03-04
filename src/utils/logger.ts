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

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}

function getConfiguredLevel(): LogLevel {
    const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
    if (env in LOG_LEVELS) {
        return env as LogLevel;
    }
    return 'info';
}

function formatMessage(
    level: LogLevel,
    context: string,
    message: string,
    data?: Record<string, unknown>,
): string {
    const timestamp = new Date().toISOString();
    const base = `${timestamp} [${level.toUpperCase()}] [${context}] ${message}`;
    if (data !== undefined && Object.keys(data).length > 0) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}

export function createLogger(context: string): Logger {
    const configuredLevel = getConfiguredLevel();

    function shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
    }

    return {
        debug(message: string, data?: Record<string, unknown>): void {
            if (shouldLog('debug')) {
                // eslint-disable-next-line no-console
                console.log(formatMessage('debug', context, message, data));
            }
        },
        info(message: string, data?: Record<string, unknown>): void {
            if (shouldLog('info')) {
                // eslint-disable-next-line no-console
                console.log(formatMessage('info', context, message, data));
            }
        },
        warn(message: string, data?: Record<string, unknown>): void {
            if (shouldLog('warn')) {
                // eslint-disable-next-line no-console
                console.warn(formatMessage('warn', context, message, data));
            }
        },
        error(message: string, data?: Record<string, unknown>): void {
            if (shouldLog('error')) {
                // eslint-disable-next-line no-console
                console.error(formatMessage('error', context, message, data));
            }
        },
    };
}
