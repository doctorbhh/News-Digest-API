# 📰 News Digest API

A multi-source news aggregator that fetches articles from RSS feeds, scrapes full content, generates AI-powered summaries using Google Gemini, clusters related stories, performs sentiment analysis, and serves everything through a RESTful API with a built-in web frontend.

## ✨ Features

| Feature | Description |
|---|---|
| **Multi-Source Ingestion** | Fetches from 4 RSS feeds (India Today, Times of India, NDTV, The Hindu) with deduplication |
| **Content Scraping** | Extracts full article text using Cheerio with site-specific presets and JSON-LD fallback |
| **LLM Summarization** | Generates concise summaries via the Google Gemini API (`gemini-2.5-flash-lite`), with extractive fallback when the API is unavailable |
| **Article Clustering** | Groups related articles using token-based Jaccard similarity (threshold-tuned for news headlines) |
| **Sentiment Analysis** | Lexicon-based sentiment scoring using an AFINN-165-inspired word list with negation and intensifier handling |
| **Keyword Extraction** | TF-based keyword extraction with title boosting and stop-word filtering |
| **Scheduled Updates** | Cron-based periodic fetching (default: every 15 minutes) |
| **Web Frontend** | Dark-mode glassmorphism SPA with digest feed, topic filtering, cluster detail, and article views |
| **RESTful API** | 6 paginated, filterable endpoints under `/api/v1` |

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  RSS Feeds   │────▶│  Fetch +     │────▶│   MongoDB    │
│  (4 sources) │     │  Scrape +    │     │  (articles,  │
└──────────────┘     │  Summarize + │     │   clusters)  │
                     │  Sentiment + │     └──────┬───────┘
                     │  Keywords +  │            │
                     │  Cluster     │            ▼
                     └──────────────┘     ┌──────────────┐
                                          │  Express API │
                                          │  /api/v1/*   │
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   Frontend   │
                                          │  (static SPA)│
                                          └──────────────┘
```

## 📋 Tech Stack

- **Runtime**: Node.js with TypeScript (ESM)
- **Framework**: Express 5
- **Database**: MongoDB (via Mongoose)
- **Scraping**: Cheerio + Axios
- **RSS Parsing**: rss-parser
- **LLM**: Google Gemini API (direct REST, no SDK)
- **Sentiment**: Custom lexicon-based analyzer (AFINN-165 inspired)
- **Scheduling**: node-cron
- **Frontend**: Vanilla HTML/CSS/JS (no build step)

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- MongoDB instance (local or Atlas)
- Google Gemini API key ([get one free](https://aistudio.google.com/apikey))

### 1. Clone and install

```bash
git clone https://github.com/doctorbhh/News-Digest-API.git
cd News-Digest-API
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `PORT` | ❌ | `3000` | Server port |
| `CRON_SCHEDULE` | ❌ | `*/15 * * * *` | Cron expression for fetch interval |
| `GEMINI_BASE_URL` | ❌ | `https://generativelanguage.googleapis.com/v1beta` | Gemini API base URL |
| `GEMINI_MODEL` | ❌ | `gemini-2.5-flash-lite` | Gemini model name |

### 3. Run

```bash
# Development (TypeScript directly)
npm run dev

# Production
npm run build
npm start
```

### 4. Open the frontend

Navigate to `http://localhost:3000` in your browser.

## 📡 API Reference

Base URL: `http://localhost:3000/api/v1`

### Articles

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/articles` | List articles (paginated, filterable) |
| `GET` | `/articles/:id` | Get single article |

**Query parameters** for `GET /articles`:

- `page` — page number (default: 1)
- `limit` — items per page (default: 10, max: 100)
- `topic` — filter by topic
- `source` — filter by source name
- `sentiment` — filter by `positive`, `neutral`, or `negative`
- `sort` — sort field (default: `-publishedAt`)

### Clusters (Digest)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/clusters` | List clustered stories (main digest) |
| `GET` | `/clusters/:id` | Get cluster + related articles |

**Query parameters** for `GET /clusters`:

- `page`, `limit` — pagination
- `topic` — filter by topic
- `sentiment` — filter by sentiment presence

### Topics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/topics` | List available topics |
| `GET` | `/topics/:topic/clusters` | Get clusters for a topic |

### Response Format

```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5,
  "data": [...]
}
```

Full OpenAPI spec: [`docs/openapi.yaml`](docs/openapi.yaml)

Postman collection: [`docs/NewsDigest.postman_collection.json`](docs/NewsDigest.postman_collection.json)

## 🧠 How It Works

### LLM Summarization

Each article's full content is sent to Google Gemini (`gemini-2.5-flash-lite`) with a structured prompt requesting a neutral, factual summary of up to 500 characters. If the API is unavailable (no key, rate limit, error), the system falls back to extractive summarization by taking the first 2 sentences of the content.

**Implementation**: [`services/summarizeContent.ts`](services/summarizeContent.ts)

### Article Clustering

Articles are grouped into stories using token-based Jaccard similarity:

1. Each article's title + summary + content is tokenized and stop-words are removed.
2. The token set is compared against existing cluster token sets using Jaccard index.
3. If similarity ≥ 0.18, the article joins that cluster; otherwise, a new cluster is created.
4. Clusters track aggregate metadata: headline, summary, keywords, sentiment distribution, source list.

**Implementation**: [`services/cluster.service.ts`](services/cluster.service.ts)

### Sentiment Analysis

Articles are scored using a lexicon-based approach inspired by AFINN-165:

1. Title and content are tokenized into lowercase words.
2. Each token is looked up in a curated 200+ word sentiment lexicon (scores from -5 to +5).
3. Negation words (not, never, etc.) flip the score of the next token.
4. Intensifiers (very, extremely, etc.) amplify the score.
5. The aggregate score is normalized by token count and mapped to positive/neutral/negative.

**Implementation**: [`services/sentimentAnalyzer.ts`](services/sentimentAnalyzer.ts)

### Keyword Extraction

Keywords are extracted using term-frequency scoring:

1. Title and content are tokenized with stop-word removal.
2. Title tokens are weighted 3× to boost topical terms.
3. Top 8 terms by frequency are returned as keywords.

**Implementation**: [`services/keywordExtractor.ts`](services/keywordExtractor.ts)

## 📁 Project Structure

```
├── app.ts                      # Express app + server entry point
├── config/
│   ├── database.ts             # MongoDB connection
│   └── newsSources.ts          # RSS feed configuration
├── controllers/
│   ├── articles.controller.ts  # Article CRUD handlers
│   └── clusters.controller.ts  # Cluster + topic handlers
├── models/
│   ├── article.model.ts        # Mongoose article schema
│   └── cluster.model.ts        # Mongoose cluster schema
├── routes/v1/
│   ├── index.ts                # API router
│   ├── articles.routes.ts
│   ├── clusters.routes.ts
│   └── topics.routes.ts
├── services/
│   ├── fetchNews.service.ts    # RSS fetch + processing pipeline
│   ├── scrapeContent.ts        # Cheerio-based content scraper
│   ├── summarizeContent.ts     # Gemini AI summarization
│   ├── sentimentAnalyzer.ts    # Lexicon-based sentiment analysis
│   ├── keywordExtractor.ts     # TF-based keyword extraction
│   └── cluster.service.ts      # Jaccard clustering logic
├── utils/
│   └── normalizeText.ts        # Text normalization utility
├── public/
│   ├── index.html              # Frontend SPA shell
│   ├── style.css               # Dark-mode glassmorphism design
│   └── app.js                  # Client-side router + rendering
├── tests/
│   └── api.endpoints.test.ts   # API endpoint tests
├── docs/
│   ├── openapi.yaml            # OpenAPI 3.1 specification
│   ├── api-frontend-guide.md   # Frontend integration guide
│   └── NewsDigest.postman_collection.json
├── .env.example                # Environment variable template
├── package.json
└── tsconfig.json
```

## 🧪 Running Tests

```bash
npm run test:api
```

## 📄 License

ISC
