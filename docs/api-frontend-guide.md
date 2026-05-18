# Frontend API Guide

This document explains how the frontend can use the News Digest API to build the main feeds, topic pages, and article detail pages.

Base URL used in examples: `http://localhost:4000/api/v1`

For a machine-readable version of the same API surface, see [docs/openapi.yaml](docs/openapi.yaml).

## Data Model at a Glance

The frontend works with two main resources:

- `Article`: one saved news item with full content, summary, topic, source, sentiment, and optional `clusterId`.
- `Cluster`: a grouped story containing multiple related articles that belong to the same event or topic.

The UI should treat clusters as the main digest experience and articles as the detail source for each story.

## Recommended Frontend Pages

- Home / Digest page: show clustered stories from `GET /api/v1/clusters`.
- Topic page: show clusters for one topic using `GET /api/v1/topics/:topic/clusters`.
- Cluster detail page: show the cluster summary and all related articles using `GET /api/v1/clusters/:id`.
- Article detail page: show the full article using `GET /api/v1/articles/:id`.
- Topic navigation: populate sidebar or filter chips using `GET /api/v1/topics`.

## Response Patterns

Most list endpoints return this shape:

```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5,
  "data": []
}
```

`GET /api/v1/topics` returns a simple array instead of the list wrapper:

```json
["AI", "Technology", "Sports"]
```

## 1. Articles Endpoints

### `GET /api/v1/articles`

Returns paginated articles.

#### Use it for

- article search results
- admin/debug views
- a fallback feed when clusters are unavailable
- pulling a flat list of raw stories for internal tooling

#### Query parameters

- `page`: page number, default `1`
- `limit`: items per page, default `10`, max `100`
- `topic`: filter by topic name, example `ai`
- `source`: filter by source name, example `bbc`
- `sentiment`: filter by `positive`, `neutral`, or `negative`
- `sort`: sort field, default `-publishedAt`

#### Example frontend usage

```ts
const params = new URLSearchParams({
  page: "1",
  limit: "10",
  topic: "ai",
  source: "bbc",
  sentiment: "positive",
  sort: "-publishedAt"
});

const response = await fetch(`/api/v1/articles?${params.toString()}`);
const payload = await response.json();
```

#### UI behavior suggestions

- Use it for a searchable or filterable article table.
- Keep pagination state in the URL so users can share the current view.
- Use the `total` and `totalPages` values to render a pager.
- Use the `sort` parameter to switch between newest, oldest, or relevance-like ordering.

---

### `GET /api/v1/articles/:id`

Returns a single article document.

#### Use it for

- article detail pages
- deep links from a cluster page
- a drawer or modal when the user clicks a story

#### Example frontend usage

```ts
const response = await fetch(`/api/v1/articles/${articleId}`);
if (!response.ok) {
  throw new Error("Failed to load article");
}
const payload = await response.json();
```

#### UI behavior suggestions

- Show the article title, source, publish time, content, summary, and sentiment.
- If `clusterId` exists, render a link back to the related cluster page.
- If the article is missing, show a 404 or not-found state.

## 2. Clusters Endpoints

### `GET /api/v1/clusters`

Returns grouped stories and is the main frontend digest endpoint.

This is the endpoint the frontend should use for the primary feed instead of showing raw articles first.

#### Use it for

- home page digest feed
- story cards with a headline and summary
- trending / latest story lists
- topic filtering for clustered news

#### Query parameters

- `page`: page number, default `1`
- `limit`: items per page, default `10`, max `100`
- `topic`: filter by topic name, example `technology`
- `sentiment`: filter clusters that have at least one article with that sentiment

#### Example frontend usage

```ts
const params = new URLSearchParams({
  page: "1",
  limit: "10",
  topic: "technology",
  sentiment: "negative"
});

const response = await fetch(`/api/v1/clusters?${params.toString()}`);
const payload = await response.json();
```

#### UI behavior suggestions

- Render each cluster as a story card.
- Show `headline`, `summary`, `articleCount`, `sources`, and `lastArticlePublishedAt`.
- Use `articleCount` as a signal for story depth.
- Use `sources` to show how many publishers are covering the same story.
- Use `sentimentDistribution` to add small chips or indicators if needed.

#### What the frontend should expect

Each cluster item typically contains:

- `topic`
- `normalizedTopic`
- `headline`
- `summary`
- `keywords`
- `articleIds`
- `articleCount`
- `sentimentDistribution`
- `sources`
- `lastArticlePublishedAt`

---

### `GET /api/v1/clusters/:id`

Returns cluster metadata plus the list of related articles.

#### Use it for

- cluster detail pages
- "read the full coverage" views
- story timelines or article lists inside one cluster

#### Example frontend usage

```ts
const response = await fetch(`/api/v1/clusters/${clusterId}`);
if (!response.ok) {
  throw new Error("Failed to load cluster");
}
const payload = await response.json();
```

#### Response shape

```json
{
  "success": true,
  "data": {
    "cluster": {},
    "articles": []
  }
}
```

#### UI behavior suggestions

- Use `cluster` for the main header and metadata.
- Use `articles` for the related articles list or tabs.
- Show a comparison layout if the user wants to read how different outlets covered the same story.
- Order the articles by publish time and make the newest one the default highlight.

## 3. Topics Endpoints

### `GET /api/v1/topics`

Returns all available topics as a simple array.

#### Use it for

- top navigation tabs
- filter chips
- sidebar topic lists
- topic picker dropdowns

#### Example frontend usage

```ts
const response = await fetch(`/api/v1/topics`);
const topics = await response.json();
```

#### UI behavior suggestions

- Treat the returned array as the source of truth for topic navigation.
- Use it to build a dynamic topic menu instead of hardcoding topic labels in the frontend.
- If you need display formatting, apply it on the client side.

---

### `GET /api/v1/topics/:topic/clusters`

Returns clusters for a topic slug.

Example:

`/api/v1/topics/artificial-intelligence/clusters`

#### Use it for

- topic landing pages
- filtered digest views
- SEO-friendly topic URLs

#### Important note

The backend normalizes the topic slug by replacing hyphens with spaces and then lowercasing and stripping punctuation for matching. That means the frontend should use slug-style URLs, not raw labels.

#### Example frontend usage

```ts
const topicSlug = "artificial-intelligence";
const response = await fetch(`/api/v1/topics/${topicSlug}/clusters?page=1&limit=10`);
const payload = await response.json();
```

#### UI behavior suggestions

- Show a page heading based on the topic slug or a prettified label.
- Reuse the same cluster card component used on the home digest page.
- Keep pagination behavior identical to the main clusters page.

## Suggested Component Mapping

- `DigestPage` -> `GET /api/v1/clusters`
- `TopicPage` -> `GET /api/v1/topics/:topic/clusters`
- `ClusterCard` -> one item from `GET /api/v1/clusters`
- `ClusterDetailPage` -> `GET /api/v1/clusters/:id`
- `ArticleDetailPage` -> `GET /api/v1/articles/:id`
- `TopicNav` -> `GET /api/v1/topics`
- `ArticlesAdminList` -> `GET /api/v1/articles`

## Common Frontend Flow Examples

### Home feed flow

1. Load topics once from `GET /api/v1/topics`.
2. Load digest stories from `GET /api/v1/clusters`.
3. Render story cards.
4. When the user clicks a card, open `GET /api/v1/clusters/:id` for the full story view.

### Topic page flow

1. Read the topic slug from the route.
2. Call `GET /api/v1/topics/:topic/clusters`.
3. Render the returned clusters.
4. Use the same cluster card component as the home page.

### Story detail flow

1. Open the cluster page using `GET /api/v1/clusters/:id`.
2. Show the cluster summary.
3. List all related articles.
4. Let the user click one article to open `GET /api/v1/articles/:id`.

## Error Handling Recommendations

- `400` means the provided `:id` is not a valid MongoDB ObjectId.
- `404` means the article or cluster does not exist.
- `500` means the API failed unexpectedly.

Frontend recommendation:

- show a friendly empty state for `404`
- show a retry button for `500`
- avoid breaking the whole page if one request fails

## Practical Notes

- The frontend should prefer clusters for user-facing feeds because clusters represent the same story grouped across publishers.
- Articles are still useful for deep detail views and internal admin screens.
- Keep pagination state in the URL so users can share filtered pages.
- If you use React Query, SWR, or a similar data layer, cache `topics` separately because it changes less often than digest data.

## Endpoint Summary

- `GET /api/v1/articles` - list articles with filters and pagination
- `GET /api/v1/articles/:id` - fetch one article
- `GET /api/v1/clusters` - main digest feed of grouped stories
- `GET /api/v1/clusters/:id` - story detail plus related articles
- `GET /api/v1/topics` - list available topics
- `GET /api/v1/topics/:topic/clusters` - clusters for one topic

