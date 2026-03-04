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

/**
 * Computes the Jaro-Winkler similarity between two strings.
 * Returns a value between 0.0 (no similarity) and 1.0 (identical).
 */
export function jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const maxLen = Math.max(s1.length, s2.length);
    const matchWindow = Math.max(Math.floor(maxLen / 2) - 1, 0);

    const s1Matches = new Array<boolean>(s1.length).fill(false);
    const s2Matches = new Array<boolean>(s2.length).fill(false);

    let matches = 0;

    // Count matching characters within the match window
    for (let i = 0; i < s1.length; i++) {
        const lo = Math.max(0, i - matchWindow);
        const hi = Math.min(i + matchWindow + 1, s2.length);
        for (let j = lo; j < hi; j++) {
            if (!s2Matches[j] && s1[i] === s2[j]) {
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }
    }

    if (matches === 0) return 0.0;

    // Count transpositions
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    const jaro =
        (matches / s1.length +
            matches / s2.length +
            (matches - transpositions / 2) / matches) /
        3;

    // Winkler boost for shared prefix (up to 4 characters)
    let prefixLen = 0;
    const prefixLimit = Math.min(4, Math.min(s1.length, s2.length));
    for (let i = 0; i < prefixLimit; i++) {
        if (s1[i] === s2[i]) {
            prefixLen++;
        } else {
            break;
        }
    }

    return jaro + prefixLen * 0.1 * (1 - jaro);
}

/** Feature vector for a candidate DOM element. */
export interface CandidateFeatures {
    tag: string;
    text: string;
    attributes: Record<string, string>;
}

/** A scored candidate with breakdown of individual dimension scores. */
export interface ScoredCandidate {
    index: number;
    score: number;
    breakdown: Record<string, number>;
}

/**
 * Scores an array of candidate elements against a target specification.
 *
 * Weights: tag=0.2, text=0.5, attributes=0.3
 * Returns candidates sorted descending by total weighted score.
 */
export function scoreCandidates(
    candidates: CandidateFeatures[],
    target: {
        tag?: string;
        visibleText?: string;
        attributes?: Record<string, string>;
    },
): ScoredCandidate[] {
    const WEIGHT_TAG = 0.2;
    const WEIGHT_TEXT = 0.5;
    const WEIGHT_ATTR = 0.3;

    const scored: ScoredCandidate[] = candidates.map((candidate, index) => {
        // Tag score: 1.0 if exact match, 0.0 otherwise
        const tagScore =
            target.tag !== undefined && candidate.tag === target.tag ? 1.0 : 0.0;

        // Text score: jaroWinkler similarity, 0.0 if either is missing
        let textScore = 0.0;
        if (
            target.visibleText !== undefined &&
            target.visibleText.length > 0 &&
            candidate.text.length > 0
        ) {
            textScore = jaroWinkler(target.visibleText, candidate.text);
        }

        // Attribute score: fraction of target attributes present with matching values
        let attrScore = 0.0;
        if (target.attributes !== undefined) {
            const targetKeys = Object.keys(target.attributes);
            if (targetKeys.length > 0) {
                let matchCount = 0;
                for (const key of targetKeys) {
                    if (candidate.attributes[key] === target.attributes[key]) {
                        matchCount++;
                    }
                }
                attrScore = matchCount / targetKeys.length;
            }
        }

        const score =
            WEIGHT_TAG * tagScore +
            WEIGHT_TEXT * textScore +
            WEIGHT_ATTR * attrScore;

        return {
            index,
            score,
            breakdown: { tag: tagScore, text: textScore, attributes: attrScore },
        };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored;
}
