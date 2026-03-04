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

import type { Page } from 'playwright';
import type { LocatorSpec } from '../../src/types/index';
import { resolveTier4 } from '../../src/resilience/tier4';

jest.mock('../../src/resilience/ocr-client.js', () => ({
    findTextInScreenshot: jest.fn(),
}));

import { findTextInScreenshot } from '../../src/resilience/ocr-client';

const mockedFindText = findTextInScreenshot as jest.MockedFunction<typeof findTextInScreenshot>;

function createMockPage(): Page {
    return {
        screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
        mouse: {
            click: jest.fn().mockResolvedValue(undefined),
        },
        keyboard: {
            type: jest.fn().mockResolvedValue(undefined),
        },
    } as unknown as Page;
}

describe('resolveTier4', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should find text via OCR and return tier=4 result', async () => {
        mockedFindText.mockResolvedValue({
            found: true,
            x: 100,
            y: 200,
            width: 60,
            height: 20,
            confidence: 0.85,
        });

        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'Submit button',
            tier4: {
                searchText: 'Submit',
            },
        };

        const result = await resolveTier4(page, spec);

        expect(result).not.toBeNull();
        expect(result!.tier).toBe(4);
        expect(result!.confidence).toBe(0.85);
        expect(result!.strategy).toBe('glm-ocr');
        expect(result!.alternatives).toEqual([]);

        // Verify the pseudo-locator click method works
        await result!.element.click();
        expect((page.mouse as { click: jest.Mock }).click).toHaveBeenCalledWith(130, 210);
    });

    it('should return null when spec.tier4 is undefined', async () => {
        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'no tier4',
        };

        const result = await resolveTier4(page, spec);
        expect(result).toBeNull();
        expect(page.screenshot).not.toHaveBeenCalled();
    });

    it("should return null when OCR doesn't find text", async () => {
        mockedFindText.mockResolvedValue({
            found: false,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            confidence: 0,
        });

        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'Missing element',
            tier4: {
                searchText: 'NonExistent',
            },
        };

        const result = await resolveTier4(page, spec);
        expect(result).toBeNull();
    });

    it('should handle OCR errors gracefully', async () => {
        mockedFindText.mockRejectedValue(new Error('Network failure'));

        const page = createMockPage();
        const spec: LocatorSpec = {
            description: 'Error case',
            tier4: {
                searchText: 'Something',
            },
        };

        const result = await resolveTier4(page, spec);
        expect(result).toBeNull();
    });
});
