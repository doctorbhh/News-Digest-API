import Article from "../models/article.model.js";
import Cluster from "../models/cluster.model.js";
import { normalizeText } from "../utils/normalizeText.js";
import mongoose from "mongoose";

// Simple clustering service
// Approach: token-based Jaccard similarity between article (title+summary)
// and existing cluster (headline+summary). If best match >= threshold,
// attach article to that cluster; otherwise create a new cluster.

const MIN_SIMILARITY = 0.18; // tuned for short summaries/titles

const STOP_WORDS = new Set([
    "the","is","at","which","on","and","a","an","of","in","for","to","with","by","from","that","this","it","as","are","was","be","has","have","but","or","its","their"
]);

function tokensFromText(text: string): string[] {
    const norm = normalizeText(text || "");
    if (!norm) return [];
    const parts = norm.split(" ").filter(Boolean);
    return parts.filter(p => !STOP_WORDS.has(p) && p.length > 2);
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const uni = new Set([...a, ...b]).size;
    return inter / uni;
}

async function upsertClusterWithArticle(cluster: any, article: any) {
    // update cluster fields conservatively
    if (!cluster) return null;

    // push article id if not present
    const idStr = article._id.toString();
    const existingIds = (cluster.articleIds || []).map((d: any) => d.toString());
    if (!existingIds.includes(idStr)) {
        cluster.articleIds.push(article._id);
        cluster.articleCount = (cluster.articleCount || 0) + 1;
    }

    // update headline/summary: pick the most recent article's title/summary
    if (!cluster.lastArticlePublishedAt || article.publishedAt > cluster.lastArticlePublishedAt) {
        cluster.headline = article.title;
        cluster.normalizedHeadline = article.normalizedTitle;
        cluster.summary = article.summary || cluster.summary;
        cluster.lastArticlePublishedAt = article.publishedAt;
    }

    // keywords union (simple)
    const artKeys = (article.keywords || []).map((k: string) => k.toLowerCase());
    const keysSet = new Set([...(cluster.keywords || []), ...artKeys]);
    cluster.keywords = Array.from(keysSet).slice(0, 30);

    // sentiment distribution
    const s = article.sentiment || "neutral";
    cluster.sentimentDistribution = cluster.sentimentDistribution || { positive:0, neutral:0, negative:0 };
    cluster.sentimentDistribution[s] = (cluster.sentimentDistribution[s] || 0) + 1;

    // sources
    const sources = new Set(cluster.sources || []);
    if (article.source && article.source.name) sources.add(article.source.name);
    cluster.sources = Array.from(sources).slice(0, 10);

    await cluster.save();
    return cluster;
}

export async function clusterArticles(options?: { sinceHours?: number }) {
    const sinceHours = options?.sinceHours ?? 48;
    const sinceDate = new Date(Date.now() - sinceHours * 3600 * 1000);

    // Fetch recent articles that are not yet clustered, and recent clusters
    const articles = await Article.find({ publishedAt: { $gte: sinceDate } }).sort({ publishedAt: -1 }).exec();
    if (!articles || articles.length === 0) return { clustered: 0, created: 0 };

    const clusters = await Cluster.find({}).sort({ lastArticlePublishedAt: -1 }).exec();

    // Build cluster token index
    const clusterTokens = new Map<string, Set<string>>();
    for (const c of clusters) {
        const text = `${c.headline || ""} ${c.summary || ""}`;
        clusterTokens.set(c._id.toString(), new Set(tokensFromText(text)));
    }

    let created = 0;
    let assigned = 0;

    for (const art of articles) {
        // create article tokens
        const artText = `${art.title || ""} ${art.summary || ""} ${art.content || ""}`;
        const artTokens = new Set(tokensFromText(artText));

        // ignore very short token sets
        if (artTokens.size === 0) continue;

        // if article already has a cluster, try to update that cluster
        if (art.clusterId) {
            const cl = await Cluster.findById(art.clusterId).exec();
            if (cl) {
                await upsertClusterWithArticle(cl, art);
                assigned++;
                continue;
            }
        }

        // find best matching cluster
        let bestScore = 0;
        let bestClusterId: string | null = null;
        for (const [cid, tokens] of clusterTokens.entries()) {
            const score = jaccard(artTokens, tokens);
            if (score > bestScore) {
                bestScore = score;
                bestClusterId = cid;
            }
        }

        if (bestScore >= MIN_SIMILARITY && bestClusterId) {
            const cl = await Cluster.findById(bestClusterId).exec();
            if (cl) {
                await upsertClusterWithArticle(cl, art);
                art.clusterId = cl._id;
                await art.save();
                assigned++;
                continue;
            }
        }

        // create new cluster
        const headline = art.title || (art.summary ? art.summary.split("\n")[0] : "Untitled");
        const normalizedHeadline = art.normalizedTitle || normalizeText(headline);
        const topic = art.topic || "general";
        const normalizedTopic = art.normalizedTopic || normalizeText(topic);

        const keywords = Array.from(art.keywords || []);

        const newCluster = new Cluster({
            topic,
            normalizedTopic,
            headline,
            normalizedHeadline,
            summary: art.summary || art.content || headline,
            keywords,
            articleIds: [art._id],
            articleCount: 1,
            sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
            sources: art.source && art.source.name ? [art.source.name] : [],
            lastArticlePublishedAt: art.publishedAt
        });

        const s = art.sentiment || "neutral";
        newCluster.sentimentDistribution = newCluster.sentimentDistribution || { positive: 0, neutral: 0, negative: 0 };
        newCluster.sentimentDistribution[s] = 1;

        await newCluster.save();
        art.clusterId = newCluster._id;
        await art.save();

        // add to in-memory index
        clusterTokens.set(newCluster._id.toString(), new Set(tokensFromText(`${headline} ${newCluster.summary}`)));

        created++;
    }

    return { clustered: assigned, created };
}

export async function clusterArticlesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return { clustered: 0, created: 0 };

    const articles = await Article.find({ _id: { $in: ids } }).exec();
    if (!articles || articles.length === 0) return { clustered: 0, created: 0 };

    const clusters = await Cluster.find({}).sort({ lastArticlePublishedAt: -1 }).exec();

    const clusterTokens = new Map<string, Set<string>>();
    for (const c of clusters) {
        const text = `${c.headline || ""} ${c.summary || ""}`;
        clusterTokens.set(c._id.toString(), new Set(tokensFromText(text)));
    }

    let created = 0;
    let assigned = 0;

    for (const art of articles) {
        const artText = `${art.title || ""} ${art.summary || ""} ${art.content || ""}`;
        const artTokens = new Set(tokensFromText(artText));
        if (artTokens.size === 0) continue;

        if (art.clusterId) {
            const cl = await Cluster.findById(art.clusterId).exec();
            if (cl) {
                await upsertClusterWithArticle(cl, art);
                assigned++;
                continue;
            }
        }

        let bestScore = 0;
        let bestClusterId: string | null = null;
        for (const [cid, tokens] of clusterTokens.entries()) {
            const score = jaccard(artTokens, tokens);
            if (score > bestScore) {
                bestScore = score;
                bestClusterId = cid;
            }
        }

        if (bestScore >= MIN_SIMILARITY && bestClusterId) {
            const cl = await Cluster.findById(bestClusterId).exec();
            if (cl) {
                await upsertClusterWithArticle(cl, art);
                art.clusterId = cl._id;
                await art.save();
                assigned++;
                continue;
            }
        }

        const headline = art.title || (art.summary ? art.summary.split("\n")[0] : "Untitled");
        const normalizedHeadline = art.normalizedTitle || normalizeText(headline);
        const topic = art.topic || "general";
        const normalizedTopic = art.normalizedTopic || normalizeText(topic);

        const keywords = Array.from(art.keywords || []);

        const newCluster = new Cluster({
            topic,
            normalizedTopic,
            headline,
            normalizedHeadline,
            summary: art.summary || art.content || headline,
            keywords,
            articleIds: [art._id],
            articleCount: 1,
            sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
            sources: art.source && art.source.name ? [art.source.name] : [],
            lastArticlePublishedAt: art.publishedAt
        });

        const s = art.sentiment || "neutral";
        newCluster.sentimentDistribution = newCluster.sentimentDistribution || { positive: 0, neutral: 0, negative: 0 };
        newCluster.sentimentDistribution[s] = 1;

        await newCluster.save();
        art.clusterId = newCluster._id;
        await art.save();

        clusterTokens.set(newCluster._id.toString(), new Set(tokensFromText(`${headline} ${newCluster.summary}`)));

        created++;
    }

    return { clustered: assigned, created };
}

export default {
    clusterArticles,
    clusterArticlesByIds
};
