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

const STOP_WORDS = new Set([
    "the", "is", "at", "which", "on", "and", "a", "an", "of", "in",
    "for", "to", "with", "by", "from", "that", "this", "it", "as",
    "are", "was", "be", "has", "have", "but", "or", "its", "their",
    "he", "she", "they", "we", "you", "i", "me", "my", "your",
    "his", "her", "our", "them", "been", "being", "had", "did",
    "do", "does", "will", "would", "could", "should", "shall",
    "may", "might", "can", "if", "when", "where", "how", "what",
    "who", "whom", "whose", "why", "not", "no", "nor", "so",
    "than", "too", "very", "just", "about", "above", "after",
    "again", "all", "also", "am", "any", "because", "before",
    "below", "between", "both", "each", "few", "further", "get",
    "got", "here", "into", "more", "most", "new", "now", "only",
    "other", "out", "over", "own", "same", "some", "such", "then",
    "there", "these", "those", "through", "under", "until", "up",
    "us", "well", "were", "while", "yet", "said", "says", "say",
    "one", "two", "three", "four", "five", "first", "last",
    "many", "much", "even", "still", "every", "going", "make",
    "made", "like", "back", "way", "around", "since", "come",
    "came", "per", "set", "let", "put", "take", "took", "keep",
    "know", "knew", "think", "part", "use", "used", "using",
    "year", "years", "time", "times", "day", "days", "people",
    "according", "report", "reports", "reported", "news", "told",
    "also", "however", "during", "another", "against", "several",
    "including", "among", "without", "within", "along"
]);

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
