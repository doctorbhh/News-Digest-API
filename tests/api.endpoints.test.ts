import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import Article from "../models/article.model.js";
import Cluster from "../models/cluster.model.js";

function makeChain(data: unknown) {
    const chain: any = {
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        select: () => chain,
        lean: async () => data,
        exec: async () => data
    };
    return chain;
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
    const app = createApp();
    const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });

    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
        await run(baseUrl);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((err: Error | undefined) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

test("GET /api/v1/articles returns paginated articles", async () => {
    const articleModel: any = Article;

    articleModel.find = () => makeChain([
        { _id: "a1", title: "AI breakthrough", sentiment: "positive" }
    ]);
    articleModel.countDocuments = async () => 1;

    await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/articles?page=1&limit=10&topic=ai`);
        assert.equal(res.status, 200);
        const body: any = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.total, 1);
        assert.equal(Array.isArray(body.data), true);
        assert.equal(body.data.length, 1);
    });
});

test("GET /api/v1/clusters/:id returns cluster metadata and related articles", async () => {
    const clusterModel: any = Cluster;
    const articleModel: any = Article;

    clusterModel.findById = () => ({
        lean: async () => ({ _id: "507f191e810c19729de860ea", topic: "Technology", headline: "Story" })
    });

    articleModel.find = () => makeChain([
        { _id: "a1", title: "Story detail", clusterId: "507f191e810c19729de860ea" }
    ]);

    await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/clusters/507f191e810c19729de860ea`);
        assert.equal(res.status, 200);
        const body: any = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.cluster.topic, "Technology");
        assert.equal(Array.isArray(body.data.articles), true);
    });
});

test("GET /api/v1/topics and GET /api/v1/topics/:topic/clusters", async () => {
    const clusterModel: any = Cluster;

    clusterModel.distinct = async () => ["AI", "Technology", "Sports"];
    clusterModel.find = () => makeChain([
        { _id: "c1", topic: "Artificial Intelligence", normalizedTopic: "artificial intelligence" }
    ]);
    clusterModel.countDocuments = async () => 1;

    await withServer(async (baseUrl) => {
        const topicsRes = await fetch(`${baseUrl}/api/v1/topics`);
        assert.equal(topicsRes.status, 200);
        const topics: any = await topicsRes.json();
        assert.equal(Array.isArray(topics), true);
        assert.equal(topics.includes("Technology"), true);

        const clustersRes = await fetch(`${baseUrl}/api/v1/topics/artificial-intelligence/clusters`);
        assert.equal(clustersRes.status, 200);
        const body: any = await clustersRes.json();
        assert.equal(body.success, true);
        assert.equal(body.total, 1);
        assert.equal(Array.isArray(body.data), true);
    });
});
