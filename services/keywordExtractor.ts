/**
 * Simple TF-based keyword extractor.
 *
 * Approach:
 *   1. Tokenize the title + content into lowercase words.
 *   2. Remove stop words and very short tokens.
 *   3. Count term frequency of remaining tokens.
 *   4. Return the top N tokens sorted by frequency.
 *
 * The title is weighted 3x so its terms rank higher.
 */

import { STOP_WORDS } from "../utils/stopWords.js";

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

export function extractKeywords(
    title: string,
    content: string,
    maxKeywords: number = 8
): string[] {
    const titleTokens = tokenize(title);
    const contentTokens = tokenize(content);

    const freq = new Map<string, number>();

    for (const token of titleTokens) {
        freq.set(token, (freq.get(token) || 0) + 3);
    }

    for (const token of contentTokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
    }

    const sorted = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1]);

    return sorted
        .slice(0, maxKeywords)
        .map(([word]) => word);
}
