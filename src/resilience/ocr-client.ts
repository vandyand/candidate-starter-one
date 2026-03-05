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

import { createLogger } from '../utils/logger.js';

const logger = createLogger('OCRClient');

const NOT_FOUND: OCRResult = {
    found: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    confidence: 0,
};

export interface OCRResult {
    found: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
}

const DEFAULT_OCR_ENDPOINT = 'http://127.0.0.1:7899/ocr';

/**
 * Sends a screenshot to the OCR proxy and searches for the given text.
 * Defaults to the local Tesseract-based proxy at localhost:7899.
 * Returns coordinates and confidence if found, or a not-found result on any
 * failure or missing configuration.
 */
export async function findTextInScreenshot(
    screenshotBuffer: Buffer,
    searchText: string,
    endpoint?: string,
): Promise<OCRResult> {
    const resolvedEndpoint = endpoint ?? process.env.OCR_ENDPOINT ?? process.env.GLM_OCR_ENDPOINT;

    if (!resolvedEndpoint) {
        logger.debug(
            'No OCR endpoint configured — trying default local proxy at ' + DEFAULT_OCR_ENDPOINT,
        );
    }

    const targetEndpoint = resolvedEndpoint || DEFAULT_OCR_ENDPOINT;

    try {
        const base64Image = screenshotBuffer.toString('base64');

        const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: base64Image,
                query: searchText,
            }),
        });

        if (!response.ok) {
            logger.warn(`OCR endpoint returned HTTP ${response.status}`);
            return NOT_FOUND;
        }

        let data: unknown = await response.json();

        // Handle string responses by attempting JSON.parse
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        const obj = data as Record<string, unknown>;

        return {
            found: Boolean(obj.found),
            x: Number(obj.x) || 0,
            y: Number(obj.y) || 0,
            width: Number(obj.width) || 0,
            height: Number(obj.height) || 0,
            confidence: Number(obj.confidence) || 0,
        };
    } catch (error) {
        logger.error('OCR request failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NOT_FOUND;
    }
}
