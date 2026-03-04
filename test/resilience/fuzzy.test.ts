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

import {
    jaroWinkler,
    scoreCandidates,
} from '../../src/resilience/fuzzy';
import type { CandidateFeatures } from '../../src/resilience/fuzzy';

describe('jaroWinkler', () => {
    it('should return 1.0 for identical strings', () => {
        expect(jaroWinkler('Sign In', 'Sign In')).toBe(1.0);
    });

    it('should return a high score (> 0.8) for similar strings', () => {
        const score = jaroWinkler('Sign In', 'SignIn');
        expect(score).toBeGreaterThan(0.8);
    });

    it('should return a low score (< 0.6) for dissimilar strings', () => {
        const score = jaroWinkler('Sign In', 'Logout');
        expect(score).toBeLessThan(0.6);
    });

    it('should return 0.0 when either string is empty', () => {
        expect(jaroWinkler('', 'hello')).toBe(0.0);
        expect(jaroWinkler('hello', '')).toBe(0.0);
        expect(jaroWinkler('', '')).toBe(1.0); // both empty = identical
    });
});

describe('scoreCandidates', () => {
    it('should rank button+matching text > div+matching text > span+different text', () => {
        const candidates: CandidateFeatures[] = [
            { tag: 'span', text: 'Logout', attributes: {} },
            { tag: 'div', text: 'Sign In', attributes: {} },
            { tag: 'button', text: 'Sign In', attributes: {} },
        ];

        const result = scoreCandidates(candidates, {
            tag: 'button',
            visibleText: 'Sign In',
        });

        // button+matching text should be first
        expect(result[0].index).toBe(2);
        // div+matching text should be second (text matches but tag does not)
        expect(result[1].index).toBe(1);
        // span+different text should be last
        expect(result[2].index).toBe(0);
    });

    it('should account for attribute matching in scoring', () => {
        const candidates: CandidateFeatures[] = [
            { tag: 'button', text: 'Submit', attributes: { id: 'btn-submit', class: 'primary' } },
            { tag: 'button', text: 'Submit', attributes: { id: 'btn-cancel', class: 'secondary' } },
        ];

        const result = scoreCandidates(candidates, {
            tag: 'button',
            visibleText: 'Submit',
            attributes: { id: 'btn-submit', class: 'primary' },
        });

        // First candidate should score higher due to attribute match
        expect(result[0].index).toBe(0);
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('should return empty array for empty candidates', () => {
        const result = scoreCandidates([], { tag: 'button' });
        expect(result).toEqual([]);
    });
});
