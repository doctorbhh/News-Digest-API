import axios from "axios";

type GeminiGenerateContentResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    promptFeedback?: {
        blockReason?: string;
        blockReasonMessage?: string;
    };
};

function cleanSummary(text: string): string {
    const compact = text.replace(/\s+/g, " ").trim();

    if (compact.length <= 500) {
        return compact;
    }

    const truncated = compact.slice(0, 500);
    const lastFullStop = truncated.lastIndexOf(".");

    if (lastFullStop > 0) {
        return truncated.slice(0, lastFullStop + 1).trim();
    }

    return truncated;
}

/**
 * Boilerplate patterns that should never be part of a summary.
 */
const BOILERPLATE_PATTERNS = [
    /^(subscribe|follow us|click here|read more|advertisement|sponsored)/i,
    /^(share this|tweet this|facebook|twitter|whatsapp|email)/i,
    /^(by\s+\w+|staff\s+writer|correspondent|reporter)/i,
    /^(updated|published|last\s+modified)/i,
    /^(get\s+the|download\s+the|install\s+the)/i,
    /^(for\s+more|to\s+read|to\s+watch|to\s+listen)/i,
    /^(also\s+read|also\s+watch|read\s+also)/i,
    /^(copyright|all\s+rights\s+reserved)/i,
    /^(comments?|post\s+your|join\s+the)/i,
];

function isBoilerplate(sentence: string): boolean {
    return BOILERPLATE_PATTERNS.some(p => p.test(sentence.trim()));
}

/**
 * Scored extractive fallback used when the Gemini API is
 * unavailable (rate-limited, empty response, network error, etc.).
 *
 * Pipeline:
 *   1. Split content into paragraphs, then sentences
 *   2. Filter out boilerplate (subscribe prompts, bylines, ads)
 *   3. Score each sentence by position, keyword density, title overlap,
 *      entity density, quote presence, and length
 *   4. Return top-2 sentences in original document order
 */
function extractiveFallback(content: string, title: string): string {
    const rawSentences = content.match(/[^.!?]+[.!?]+/g) || [];
    if (rawSentences.length === 0) return content.slice(0, 300);

    // Filter boilerplate
    const sentences = rawSentences.filter(s => !isBoilerplate(s));
    if (sentences.length === 0) return content.slice(0, 300);

    // Build keyword frequency map from full content (stop-word filtered)
    const STOP_WORDS = new Set([
        "the","a","an","is","are","was","were","be","been","being","have","has","had",
        "do","does","did","will","would","could","should","may","might","shall","can",
        "need","dare","ought","used","to","of","in","for","on","with","at","by","from",
        "as","into","through","during","before","after","above","below","between","out",
        "off","over","under","again","further","then","once","here","there","when","where",
        "why","how","all","both","each","few","more","most","other","some","such","no",
        "nor","not","only","own","same","so","than","too","very","just","because","but",
        "and","or","if","while","about","that","this","these","those","it","its","he","she",
        "they","them","his","her","their","we","our","you","your","i","me","my","what",
        "which","who","whom","said","also","new","one","two","many","much","any","every",
    ]);

    const wordFreq = new Map<string, number>();
    const allWords = content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    for (const w of allWords) {
        if (!STOP_WORDS.has(w)) {
            wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
        }
    }

    // Title words for overlap scoring
    const titleWords = new Set(
        title.toLowerCase().match(/\b[a-z]{3,}\b/g) || []
    );

    const scored = sentences.map((sentence, i) => {
        let score = 0;
        const words = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];

        // Early sentences carry the most information (inverted pyramid)
        if (i === 0) score += 5;
        else if (i === 1) score += 4;
        else if (i === 2) score += 3;
        else if (i < 5) score += 2;

        // ── Keyword density (words that appear frequently in the article) ──
        let keywordScore = 0;
        for (const w of words) {
            keywordScore += wordFreq.get(w) || 0;
        }
        score += keywordScore / Math.max(words.length, 1) * 2;

        // ── Title overlap ──
        const overlap = words.filter(w => titleWords.has(w)).length;
        score += overlap * 3;

        // ── Entity density (capitalized words = names, places, orgs) ──
        const entities = sentence.match(/\b[A-Z][a-z]{2,}\b/g) || [];
        score += entities.length * 1.5;

        // ── Quote bonus ──
        if (sentence.includes('"') || sentence.includes('\u201c') || sentence.includes('\u201d')) {
            score += 2;
        }

        // ── Length preference (8-35 words is ideal) ──
        if (words.length >= 8 && words.length <= 35) score += 1;
        if (words.length < 4) score -= 2; // penalize tiny fragments

        return { sentence: sentence.trim(), score, index: i };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .sort((a, b) => a.index - b.index)
        .map(s => s.sentence)
        .join(" ");
}

function buildSummaryPrompt(title: string, content: string): string {
    return [
        "You are summarizing a news article for a digest feed.",
        "Return only the summary text. No headings, no bullet points, no markdown, no quotes.",
        "Summary requirements:",
        "1) Write a concise 2-3 sentence summary.",
        "2) Mention the central event, key actors, and the most important outcome or implication.",
        "3) Keep a neutral journalistic tone.",
        "4) Avoid speculation and avoid adding facts not present in the article.",
        "5) Maximum 500 characters total.",
        "",
        "Article title:",
        title,
        "",
        "Article content:",
        content,
    ].join("\n");
}

const MAX_PROMPT_CONTENT_LENGTH = 8000;
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

function getPromptContent(content: string): string {
    const trimmed = content.trim();

    if (trimmed.length <= MAX_PROMPT_CONTENT_LENGTH) {
        return trimmed;
    }

    return trimmed.slice(0, MAX_PROMPT_CONTENT_LENGTH);
}

export async function generateSummary(
    title: string,
    content: string,
    fallbackSummary: string
): Promise<string> {
    const baseUrl = process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!baseUrl || !apiKey || !content.trim()) {
        const fallbackText = content.trim() || fallbackSummary || title;
        return cleanSummary(extractiveFallback(fallbackText, title));
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const promptContent = getPromptContent(content);

    try {
        const response = await axios.post<GeminiGenerateContentResponse>(
            `${baseUrl.replace(/\/$/, "")}/models/${model}:generateContent`,
            {
                systemInstruction: {
                    parts: [
                        {
                            text: "You create concise, factual, and reliable summaries for news articles.",
                        },
                    ],
                },
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: buildSummaryPrompt(title, promptContent),
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.9,
                    maxOutputTokens: 150,
                },
            },
            {
                headers: {
                    "X-goog-api-key": apiKey,
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            }
        );

        const aiText = response.data.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("") || "";

        if (!aiText.trim()) {
            console.warn("AI summary returned empty content", {
                title,
                contentLength: promptContent.length,
                blockReason: response.data.promptFeedback?.blockReason,
                blockReasonMessage: response.data.promptFeedback?.blockReasonMessage,
            });

            const fallbackText = content.trim() || fallbackSummary || title;
            return cleanSummary(extractiveFallback(fallbackText, title));
        }

        return cleanSummary(aiText);
    } catch (error) {
        const responseError = error as {
            message?: string;
            response?: {
                status?: number;
                data?: unknown;
            };
        };

        console.warn("AI summary request failed, using fallback", {
            title,
            contentLength: promptContent.length,
            message: responseError.message,
            status: responseError.response?.status,
            data: responseError.response?.data,
        });

        const fallbackText = content.trim() || fallbackSummary || title;
        return cleanSummary(extractiveFallback(fallbackText, title));
    }
}