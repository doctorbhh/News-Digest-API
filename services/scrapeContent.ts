import axios from "axios";
import { load, type CheerioAPI } from "cheerio";
import { NormalizedArticle } from "./fetchNews.service.js";

type ExtractionPreset = {
    containerSelectors: string[];
    paragraphSelector: string;
    blockedParagraphPatterns: RegExp[];
    useContainerTextWhenNoParagraphs?: boolean;
};

const defaultPreset: ExtractionPreset = {
    containerSelectors: [
        "article",
        "main",
        "[role='main']",
        ".article-content",
        ".post-content",
        ".entry-content",
        ".story-body",
    ],
    paragraphSelector: "p",
    blockedParagraphPatterns: [
        /^advertisement$/i,
        /^read more$/i,
    ],
};

const presetsByHost: Record<string, ExtractionPreset> = {
    "timesofindia.indiatimes.com": {
        containerSelectors: [
            "[data-articlebody='1'] .z_eq3 .ihgno",
            "[data-articlebody='1'] .z_eq3",
            "[data-articlebody='1']",
            "article",
            "main",
        ],
        paragraphSelector: "p",
        useContainerTextWhenNoParagraphs: true,
        blockedParagraphPatterns: [
            /^advertisement$/i,
            /^read more$/i,
            /^track latest news live/i,
            /the toi news desk comprises/i,
        ],
    },
    "www.indiatoday.in": {
        containerSelectors: [
            "article",
            ".story__content",
            ".description",
            "main",
        ],
        paragraphSelector: "p",
        blockedParagraphPatterns: [
            /^advertisement$/i,
            /^read full story$/i,
            /^download app$/i,
        ],
    },
    "www.thehindu.com": {
        containerSelectors: [
            ".articlebodycontent",
            ".article-body-content",
            ".articlePage .article-section",
            ".storyline",
            "article .paywall",
            "article",
        ],
        paragraphSelector: "p",
        blockedParagraphPatterns: [
            /^advertisement$/i,
            /^published\s*-/i,
            /^updated\s*-/i,
            /^copyright/i,
            /^comments have to be in english/i,
            /^we have migrated/i,
            /^users can access/i,
            /back to top/i,
            /terms & conditions/i,
            /you are logged in/i,
            /you don.t have any active subscription/i,
            /your active subscription/i,
            /subscribed with another email/i,
            /need help with your subscription/i,
            /unlock these with subscription/i,
            /account subscription benefits/i,
            /additional subscription benefits/i,
            /account settings/i,
            /^e-paper$/i,
            /the view from india/i,
            /first day first show/i,
            /today.s cache/i,
            /science for all/i,
            /^data point$/i,
            /^thedge$/i,
            /^health matters$/i,
            /^gender agenda$/i,
            /the hindu on books/i,
            /your download of the top/i,
            /the weekly newsletter/i,
            /ramya kannan writes/i,
            /stories from beyond the binary/i,
            /books of the week/i,
            /news and reviews from the world/i,
            /looking at world affairs/i,
            /at the cutting edge of education/i,
            /decoding the headlines/i,
            /premium stories, editorials/i,
            /products you.ve access to/i,
            /^loading/i,
            /^logout and login/i,
            /community guidelines/i,
            /thg publishing/i,
        ],
    },
    "www.ndtv.com": {
        containerSelectors: [
            ".sp-cn",
            ".story__content",
            "#pcl_fullContent",
            ".Art_cbody_txt",
            "article .content_text",
            "article",
        ],
        paragraphSelector: "p",
        blockedParagraphPatterns: [
            /^advertisement$/i,
            /^promoted$/i,
            /^also read/i,
            /^read more on/i,
            /^waiting for response to load/i,
            /^track latest news/i,
            /^disclaimer/i,
            /^featured video of the day/i,
            /comments\s*$/i,
            /^share this/i,
        ],
    },
};

function cleanText(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .trim();
}

function pickPreset(articleUrl: string): ExtractionPreset {
    try {
        const hostname = new URL(articleUrl).hostname.toLowerCase();

        return presetsByHost[hostname] || defaultPreset;
    } catch {
        return defaultPreset;
    }
}

function shouldKeepParagraph(text: string, patterns: RegExp[]): boolean {
    if (!text) {
        return false;
    }

    return patterns.every((pattern) => !pattern.test(text));
}

function extractArticleBodyFromJsonLd($: CheerioAPI): string {
    const jsonLdScripts = $("script[type='application/ld+json']").toArray();

    for (const node of jsonLdScripts) {
        const raw = cleanText($(node).html() || "");

        if (!raw) {
            continue;
        }

        try {
            const parsed = JSON.parse(raw);
            const entries = Array.isArray(parsed) ? parsed : [parsed];

            for (const entry of entries) {
                const type = Array.isArray(entry?.["@type"])
                    ? entry["@type"].join(" ")
                    : String(entry?.["@type"] || "");
                const body = cleanText(String(entry?.articleBody || ""));

                if (
                    body.length > 200 &&
                    (type.includes("NewsArticle") || type.includes("Article"))
                ) {
                    return body;
                }
            }
        } catch {
            continue;
        }
    }

    return "";
}

function shouldUseJsonLdFallback(content: string): boolean {
    if (content.length < 600) {
        return true;
    }

    return /the toi news desk comprises/i.test(content);
}

function extractArticleText(
    $: CheerioAPI,
    preset: ExtractionPreset
): string {

    const pieces: string[] = [];

    for (const selector of preset.containerSelectors) {
        const container = $(selector).first();
        const nodes = container.find(preset.paragraphSelector).toArray();

        for (const node of nodes) {
            const text = cleanText($(node).text());

            if (shouldKeepParagraph(text, preset.blockedParagraphPatterns)) {
                pieces.push(text);
            }
        }

        if (pieces.length === 0 && preset.useContainerTextWhenNoParagraphs) {
            const containerText = cleanText(container.text());

            if (shouldKeepParagraph(containerText, preset.blockedParagraphPatterns)) {
                pieces.push(containerText);
            }
        }

        if (pieces.length > 0) {
            break;
        }
    }

    if (pieces.length === 0) {
        const nodes = $(preset.paragraphSelector).toArray();

        for (const node of nodes) {
            const text = cleanText($(node).text());

            if (shouldKeepParagraph(text, preset.blockedParagraphPatterns)) {
                pieces.push(text);
            }
        }
    }

    return cleanText(pieces.join("\n\n"));
}

export async function scrapeContent(
    article: NormalizedArticle
): Promise<NormalizedArticle> {
    if (!article.url) {
        return article;
    }

    try {
        const response = await axios.get(article.url, {
            timeout: 15000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });

        const $ = load(response.data);

        $("script, style, noscript, iframe, svg, canvas").remove();
        // Strip non-content structural elements that leak junk text
        $("nav, header, footer, aside").remove();
        $("[class*='subscription'], [class*='newsletter'], [class*='social-share']").remove();
        $("[class*='comment'], [id*='comment']").remove();
        $("[class*='related'], [class*='also-read'], [class*='recommended']").remove();
        $("[class*='signup'], [class*='login'], [class*='paywall-banner']").remove();

        const preset = pickPreset(article.url);

        const title = cleanText($("article h1, main h1, h1").first().text());
        const metaDescription = cleanText(
            $("meta[name='description']").attr("content") || ""
        );
        const extractedContent = extractArticleText($, preset);
        const jsonLdContent = extractArticleBodyFromJsonLd($);
        const content = shouldUseJsonLdFallback(extractedContent)
            ? jsonLdContent || extractedContent
            : extractedContent;

        return {
            ...article,
            title: title || article.title,
            content: content || metaDescription || article.content,
        };
    } catch {
        return article;
    }
}