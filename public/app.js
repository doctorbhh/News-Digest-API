/**
 * News Digest — Frontend SPA
 *
 * Vanilla JS client that consumes the /api/v1 endpoints.
 * Uses hash-based routing for navigation:
 *   #              → Digest home (clusters)
 *   #topic/:slug   → Topic-filtered clusters
 *   #cluster/:id   → Cluster detail + related articles
 *   #article/:id   → Article detail
 */

(function () {
    "use strict";

    const API = "/api/v1";
    const $main = document.getElementById("main-content");
    const $sidebarNav = document.getElementById("sidebar-nav");
    const $logoLink = document.getElementById("logo-link");

    // ── Topic Icon Map ────────────────────────────────────

    const topicIcons = {
        "all":            "newspaper",
        "ai":             "psychology",
        "technology":     "biotech",
        "tech":           "biotech",
        "sports":         "sports_basketball",
        "politics":       "gavel",
        "business":       "trending_up",
        "entertainment":  "movie",
        "health":         "health_and_safety",
        "science":        "science",
        "world":          "public",
        "education":      "school",
        "environment":    "eco",
        "lifestyle":      "self_improvement",
        "finance":        "account_balance",
    };

    function getTopicIcon(slug) {
        return topicIcons[slug] || "article";
    }

    // ── Auth state (localStorage) ──────────────────────────

    function getApiKey() { return localStorage.getItem("nd_api_key") || ""; }
    function setApiKey(k) { localStorage.setItem("nd_api_key", k); }
    function clearApiKey() { localStorage.removeItem("nd_api_key"); }

    // ── Helpers ────────────────────────────────────────────

    async function apiFetch(path) {
        const headers = {};
        const key = getApiKey();
        if (key) headers["x-api-key"] = key;
        const res = await fetch(`${API}${path}`, { headers });
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        return res.json();
    }

    function timeAgo(dateStr) {
        if (!dateStr) return "";
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric"
        });
    }

    function sentimentIcon(label) {
        if (label === "positive") return "▲";
        if (label === "negative") return "▼";
        return "●";
    }

    function esc(str) {
        const d = document.createElement("div");
        d.textContent = str || "";
        return d.innerHTML;
    }

    /** Strip non-article junk lines from scraped content */
    function cleanArticleContent(raw) {
        if (!raw) return "";
        const junkPatterns = [
            /^you are logged in/i,
            /^loading\.{0,3}$/i,
            /don.t have any active subscription/i,
            /subscribed with another email/i,
            /your active subscription/i,
            /account subscription benefits/i,
            /additional subscription benefits/i,
            /unlock these with subscription/i,
            /products you.ve access to/i,
            /account settings/i,
            /need help with your subscription/i,
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
            /^logout and login/i,
            /^back to top$/i,
            /terms & conditions/i,
            /^copyright/i,
            /thg publishing/i,
            /community guidelines/i,
            /comments have to be in english/i,
            /we have migrated to a new commenting/i,
            /users can access their older comments/i,
            /^published\s*-\s*\w+\s+\d/i,
            /^updated\s*-\s*\w+\s+\d/i,
            /^advertisement$/i,
            /^promoted$/i,
            /^also read/i,
            /^share this$/i,
            /^featured video of the day/i,
            /^download app$/i,
        ];

        const lines = raw.split(/\n+/);
        const clean = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            if (trimmed.length < 3) return false;
            return !junkPatterns.some(p => p.test(trimmed));
        });

        let result = clean.join("\n\n");
        if (result.length > 3000) {
            result = result.slice(0, 3000).replace(/\s+\S*$/, "") + "…";
        }
        return result;
    }

    function setContent(html) {
        $main.innerHTML = html;
    }

    function showLoading(msg) {
        setContent(`
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">${esc(msg || "Loading…")}</div>
            </div>
        `);
    }

    function showError(message) {
        setContent(`
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p>${esc(message)}</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `);
    }

    function showEmpty(msg) {
        setContent(`
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>No stories yet</h3>
                <p>${esc(msg || "Check back soon — the digest updates every 15 minutes.")}</p>
            </div>
        `);
    }

    // ── Sentiment bar for cluster ──────────────────────────

    function sentimentBarHTML(dist) {
        if (!dist) return "";
        const total = (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0);
        if (total === 0) return "";
        const pct = (v) => ((v / total) * 100).toFixed(1);
        return `
            <div class="sentiment-bar">
                ${dist.positive ? `<div class="seg-positive" style="width:${pct(dist.positive)}%" title="Positive: ${dist.positive}"></div>` : ""}
                ${dist.neutral  ? `<div class="seg-neutral"  style="width:${pct(dist.neutral)}%"  title="Neutral: ${dist.neutral}"></div>` : ""}
                ${dist.negative ? `<div class="seg-negative" style="width:${pct(dist.negative)}%" title="Negative: ${dist.negative}"></div>` : ""}
            </div>
        `;
    }

    // ── Dominant sentiment for a cluster ───────────────────

    function dominantSentiment(dist) {
        if (!dist) return "neutral";
        const entries = [
            ["positive", dist.positive || 0],
            ["neutral", dist.neutral || 0],
            ["negative", dist.negative || 0]
        ];
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0];
    }

    // ── Sidebar Topic Rendering ───────────────────────────

    function renderSidebarTopics(topics, activeTopic) {
        if (!topics || topics.length === 0 || !$sidebarNav) return;

        let html = "";
        html += `<li>
            <span class="topic-link ${!activeTopic ? "active" : ""}" data-topic="">
                <span class="material-symbols-outlined">newspaper</span>
                All News
            </span>
        </li>`;

        for (const t of topics) {
            const slug = t.toLowerCase().replace(/\s+/g, "-");
            const active = activeTopic === slug ? "active" : "";
            const icon = getTopicIcon(slug);
            html += `<li>
                <span class="topic-link ${active}" data-topic="${esc(slug)}">
                    <span class="material-symbols-outlined">${icon}</span>
                    ${esc(t)}
                </span>
            </li>`;
        }

        $sidebarNav.innerHTML = html;
        bindTopicChips();
    }

    // ── Cluster Card (Featured AI vs Standard) ────────────

    function clusterCardHTML(cluster, featured) {
        const sources = (cluster.sources || []).slice(0, 4);
        const count = cluster.articleCount || 1;
        const time = timeAgo(cluster.lastArticlePublishedAt);

        if (featured) {
            return `
            <article class="card card--ai fade-in" data-cluster-id="${esc(cluster._id)}" data-article-count="${count}" data-first-article-id="${esc((cluster.articleIds || [])[0] || '')}">
                <div class="card-ai-label">
                    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">auto_awesome</span>
                    <span>AI Executive Summary</span>
                </div>
                <h3 class="card-headline">${esc(cluster.headline)}</h3>
                <p class="card-summary">${esc(cluster.summary)}</p>
                <div class="card-footer">
                    <div class="source-list">
                        ${sources.map(s => `<span class="source-tag">${esc(s)}</span>`).join("")}
                        <span class="source-tag source-tag--verified">Verified Source</span>
                    </div>
                    <div class="card-meta-info">
                        <span>${count} article${count !== 1 ? "s" : ""}</span>
                        <span class="dot"></span>
                        <span>${time}</span>
                    </div>
                </div>
            </article>`;
        }

        return `
        <article class="card fade-in" data-cluster-id="${esc(cluster._id)}" data-article-count="${count}" data-first-article-id="${esc((cluster.articleIds || [])[0] || '')}">
            <h3 class="card-headline">${esc(cluster.headline)}</h3>
            <p class="card-summary">${esc(cluster.summary)}</p>
            <div class="card-footer">
                <div class="source-list">
                    ${sources.map(s => `<span class="source-tag">${esc(s)}</span>`).join("")}
                </div>
                <div class="card-meta-info">
                    <span>${count} article${count !== 1 ? "s" : ""}</span>
                    <span class="dot"></span>
                    <span>${time}</span>
                </div>
            </div>
            ${sentimentBarHTML(cluster.sentimentDistribution)}
        </article>`;
    }

    // ── Pagination ────────────────────────────────────────

    function paginationHTML(page, totalPages, handler) {
        if (totalPages <= 1) return "";
        return `
            <div class="pagination">
                <button ${page <= 1 ? "disabled" : ""} data-page="${page - 1}" data-handler="${handler}">← Prev</button>
                <span class="page-info">Page ${page} of ${totalPages}</span>
                <button ${page >= totalPages ? "disabled" : ""} data-page="${page + 1}" data-handler="${handler}">Next →</button>
            </div>
        `;
    }

    // ── Pages ─────────────────────────────────────────────

    let cachedTopics = null;

    async function loadTopics() {
        if (cachedTopics) return cachedTopics;
        try {
            cachedTopics = await apiFetch("/topics");
        } catch {
            cachedTopics = [];
        }
        return cachedTopics;
    }

    /** Digest Home / Topic page */
    async function renderDigest(topicSlug, page) {
        page = Math.max(1, parseInt(page) || 1);
        showLoading("Fetching digest…");

        try {
            const topics = await loadTopics();
            let data;

            if (topicSlug) {
                data = await apiFetch(`/topics/${encodeURIComponent(topicSlug)}/clusters?page=${page}&limit=12`);
            } else {
                data = await apiFetch(`/clusters?page=${page}&limit=12`);
            }

            if (!data.data || data.data.length === 0) {
                renderSidebarTopics(topics, topicSlug);
                setContent(`<div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No stories found</h3>
                    <p>${topicSlug ? "No stories for this topic yet." : "The digest is warming up — check back in a few minutes."}</p>
                </div>`);
                return;
            }

            renderSidebarTopics(topics, topicSlug);

            const titleText = topicSlug ? esc(topicSlug.replace(/-/g, " ")) : "Top Stories";
            const subtitleText = `Updated ${timeAgo(data.data[0]?.lastArticlePublishedAt) || "recently"}`;

            let html = "";
            html += `<div class="page-header">
                <h2 class="page-title">${titleText}</h2>
                <span class="page-subtitle">${subtitleText}</span>
            </div>`;

            html += `<div class="card-feed">`;
            data.data.forEach((cluster, i) => {
                html += clusterCardHTML(cluster, i === 0 && !topicSlug);
            });
            html += `</div>`;
            html += paginationHTML(data.page, data.totalPages, "digest");

            setContent(html);
            bindClusterCards();
            bindPagination(topicSlug);

        } catch (err) {
            showError(err.message);
        }
    }

    /** Cluster detail page */
    async function renderCluster(clusterId) {
        showLoading("Loading story…");

        try {
            const data = await apiFetch(`/clusters/${clusterId}`);
            const cluster = data.data.cluster;
            const articles = data.data.articles || [];
            const dom = dominantSentiment(cluster.sentimentDistribution);

            let html = `<div class="detail-page fade-in">`;
            html += `<div class="breadcrumb"><a href="#">Digest</a> <span class="sep">›</span> <span>Story</span></div>`;
            html += `<h1 class="detail-headline">${esc(cluster.headline)}</h1>`;
            html += `<div class="detail-meta">`;
            html += `<span class="sentiment-chip ${dom}">${sentimentIcon(dom)} ${dom}</span>`;
            html += `<span>📰 ${cluster.articleCount || articles.length} article${(cluster.articleCount || articles.length) !== 1 ? "s" : ""}</span>`;
            if (cluster.sources && cluster.sources.length) {
                html += `<span>${cluster.sources.join(", ")}</span>`;
            }
            html += `<span>🕒 ${timeAgo(cluster.lastArticlePublishedAt)}</span>`;
            html += `</div>`;

            html += `<div class="detail-summary">${esc(cluster.summary)}</div>`;

            if (cluster.keywords && cluster.keywords.length > 0) {
                html += `<div class="detail-keywords">`;
                for (const kw of cluster.keywords.slice(0, 12)) {
                    html += `<span class="keyword-tag">${esc(kw)}</span>`;
                }
                html += `</div>`;
            }

            html += sentimentBarHTML(cluster.sentimentDistribution);

            if (articles.length > 0) {
                html += `<div class="related-articles-section"><h3>Coverage from ${cluster.sources ? cluster.sources.length : ""} source${cluster.sources && cluster.sources.length !== 1 ? "s" : ""}</h3>`;
                for (const art of articles) {
                    html += `
                        <div class="related-article-card" data-article-id="${esc(art._id)}">
                            <div class="related-article-title">${esc(art.title)}</div>
                            <div class="related-article-meta">
                                <span>${esc(art.source?.name || "Unknown")}</span>
                                <span class="sentiment-chip ${art.sentiment || "neutral"}">${sentimentIcon(art.sentiment)} ${art.sentiment || "neutral"}</span>
                                <span>${timeAgo(art.publishedAt)}</span>
                            </div>
                        </div>
                    `;
                }
                html += `</div>`;
            }

            html += `</div>`;
            setContent(html);

            document.querySelectorAll("[data-article-id]").forEach(el => {
                el.addEventListener("click", () => {
                    window.location.hash = `#article/${el.dataset.articleId}`;
                });
            });

        } catch (err) {
            showError(err.message);
        }
    }

    /** Article detail page */
    async function renderArticle(articleId) {
        showLoading("Loading article…");

        try {
            const data = await apiFetch(`/articles/${articleId}`);
            const art = data.data;

            let html = `<div class="detail-page fade-in">`;
            html += `<div class="breadcrumb"><a href="#">Digest</a>`;
            if (art.clusterId) {
                html += ` <span class="sep">›</span> <a href="#cluster/${art.clusterId}">Story</a>`;
            }
            html += ` <span class="sep">›</span> <span>Article</span></div>`;

            html += `<h1 class="detail-headline">${esc(art.title)}</h1>`;
            html += `<div class="detail-meta">`;
            html += `<span class="sentiment-chip ${art.sentiment || "neutral"}">${sentimentIcon(art.sentiment)} ${art.sentiment || "neutral"}</span>`;
            html += `<span>📰 ${esc(art.source?.name || "Unknown")}</span>`;
            html += `<span>🕒 ${timeAgo(art.publishedAt)}</span>`;
            if (art.url) {
                html += `<a href="${esc(art.url)}" target="_blank" rel="noopener" class="ext-link">Read original ↗</a>`;
            }
            html += `</div>`;

            if (art.summary) {
                html += `<div class="detail-summary">${esc(art.summary)}</div>`;
            }

            if (art.keywords && art.keywords.length > 0) {
                html += `<div class="detail-keywords">`;
                for (const kw of art.keywords) {
                    html += `<span class="keyword-tag">${esc(kw)}</span>`;
                }
                html += `</div>`;
            }




            html += `</div>`;
            setContent(html);

        } catch (err) {
            showError(err.message);
        }
    }

    // ── Event Binding ─────────────────────────────────────

    function bindTopicChips() {
        document.querySelectorAll(".topic-link").forEach(chip => {
            chip.addEventListener("click", () => {
                const topic = chip.dataset.topic;
                if (topic) {
                    window.location.hash = `#topic/${topic}`;
                } else {
                    window.location.hash = "#";
                }
            });
        });
    }

    function bindClusterCards() {
        document.querySelectorAll(".card[data-cluster-id]").forEach(card => {
            card.addEventListener("click", () => {
                const count = parseInt(card.dataset.articleCount || "0", 10);
                const firstId = card.dataset.firstArticleId;
                if (count === 1 && firstId) {
                    // Skip Story view for single-article clusters
                    window.location.hash = `#article/${firstId}`;
                } else {
                    window.location.hash = `#cluster/${card.dataset.clusterId}`;
                }
            });
        });
    }

    function bindPagination(topicSlug) {
        document.querySelectorAll(".pagination button").forEach(btn => {
            btn.addEventListener("click", () => {
                const page = btn.dataset.page;
                if (topicSlug) {
                    window.location.hash = `#topic/${topicSlug}?page=${page}`;
                } else {
                    window.location.hash = `#?page=${page}`;
                }
            });
        });
    }

    // ── Router ────────────────────────────────────────────

    function parseHash() {
        const raw = window.location.hash.replace(/^#\/?/, "");
        const [path, qs] = raw.split("?");
        const params = new URLSearchParams(qs || "");
        const segments = path.split("/").filter(Boolean);
        return { segments, params };
    }

    function route() {
        const { segments, params } = parseHash();
        const page = params.get("page") || 1;

        if (segments[0] === "cluster" && segments[1]) {
            renderCluster(segments[1]);
        } else if (segments[0] === "article" && segments[1]) {
            renderArticle(segments[1]);
        } else if (segments[0] === "topic" && segments[1]) {
            renderDigest(segments[1], page);
        } else {
            renderDigest(null, page);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // ── Theme Toggle ──────────────────────────────────────

    const $themeToggle = document.getElementById("theme-toggle");
    const currentTheme = localStorage.getItem("theme") || "light";

    if (currentTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    }

    if ($themeToggle) {
        $themeToggle.addEventListener("click", () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            if (isDark) {
                document.documentElement.removeAttribute("data-theme");
                localStorage.setItem("theme", "light");
            } else {
                document.documentElement.setAttribute("data-theme", "dark");
                localStorage.setItem("theme", "dark");
            }
        });
    }

    // ── Account Panel ─────────────────────────────────────

    const $panel = document.getElementById("account-panel");
    const $overlay = document.getElementById("account-overlay");
    const $panelBody = document.getElementById("account-panel-body");
    const $btnProfile = document.getElementById("btn-profile");
    const $btnClose = document.getElementById("btn-close-panel");

    function openPanel() {
        $panel.classList.add("open");
        $overlay.classList.add("open");
        renderAccountPanel();
    }
    function closePanel() {
        $panel.classList.remove("open");
        $overlay.classList.remove("open");
    }

    $btnProfile.addEventListener("click", openPanel);
    $btnClose.addEventListener("click", closePanel);
    $overlay.addEventListener("click", closePanel);

    // Hook up Settings link too
    document.querySelectorAll(".sidebar-footer-link").forEach(link => {
        if (link.textContent.trim().includes("Settings")) {
            link.addEventListener("click", (e) => { e.preventDefault(); openPanel(); });
        }
    });

    async function renderAccountPanel() {
        const key = getApiKey();
        if (!key) {
            renderGuestPanel();
        } else {
            await renderUserPanel(key);
        }
    }

    function renderGuestPanel() {
        $panelBody.innerHTML = `
            <div class="acct-section">
                <div class="acct-section-title">Login with API Key</div>
                <p class="acct-info">Already have an API key? Paste it below to log in.</p>
                <div class="acct-key-display" style="margin-bottom:8px;">
                    <input type="text" id="login-key-input" placeholder="Paste your API key…"
                        style="flex:1;background:transparent;border:none;outline:none;font-family:monospace;font-size:13px;color:var(--text-primary);" />
                </div>
                <button class="acct-btn" id="btn-login">
                    <span class="material-symbols-outlined">login</span>
                    Login
                </button>
                <div id="login-status"></div>
            </div>
            <div class="acct-divider"></div>
            <div class="acct-section">
                <div class="acct-section-title">New User</div>
                <p class="acct-info">Don't have an account? Register to get a personal API key.</p>
                <button class="acct-btn acct-btn--outline" id="btn-register">
                    <span class="material-symbols-outlined">person_add</span>
                    Get My API Key
                </button>
                <div id="register-status"></div>
            </div>
        `;
        document.getElementById("btn-login").addEventListener("click", handleLogin);
        document.getElementById("btn-register").addEventListener("click", handleRegister);
        document.getElementById("login-key-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleLogin();
        });
    }

    async function handleLogin() {
        const input = document.getElementById("login-key-input");
        const status = document.getElementById("login-status");
        const key = input.value.trim();
        if (!key) {
            status.className = "acct-status error";
            status.textContent = "Please enter your API key";
            return;
        }
        try {
            const res = await fetch(`${API}/users/me`, { headers: { "x-api-key": key } });
            const data = await res.json();
            if (data.success) {
                setApiKey(key);
                status.className = "acct-status success";
                status.textContent = "Welcome back!";
                setTimeout(() => renderAccountPanel(), 600);
            } else {
                status.className = "acct-status error";
                status.textContent = data.message || "Invalid API key";
            }
        } catch (e) {
            status.className = "acct-status error";
            status.textContent = e.message;
        }
    }

    async function handleRegister() {
        const btn = document.getElementById("btn-register");
        const status = document.getElementById("register-status");
        btn.disabled = true;
        btn.textContent = "Registering…";
        try {
            const res = await fetch(`${API}/users/register`, { method: "POST" });
            const data = await res.json();
            if (data.success && data.apiKey) {
                setApiKey(data.apiKey);
                status.className = "acct-status success";
                status.textContent = "Registered! Your key is saved.";
                setTimeout(() => renderAccountPanel(), 800);
            } else {
                status.className = "acct-status error";
                status.textContent = data.message || "Registration failed";
                btn.disabled = false;
                btn.textContent = "Get My API Key";
            }
        } catch (e) {
            status.className = "acct-status error";
            status.textContent = e.message;
            btn.disabled = false;
            btn.textContent = "Get My API Key";
        }
    }

    async function renderUserPanel(key) {
        let userData = { subscribedTopics: [] };
        try {
            const me = await fetch(`${API}/users/me`, { headers: { "x-api-key": key } });
            const j = await me.json();
            if (!j.success) { clearApiKey(); renderGuestPanel(); return; }
            userData = j.data;
        } catch { clearApiKey(); renderGuestPanel(); return; }

        let allTopics = [];
        try { allTopics = await apiFetch("/topics"); } catch {}

        const subscribed = new Set((userData.subscribedTopics || []).map(t => t.toLowerCase()));
        const shortKey = key.slice(0, 8) + "…" + key.slice(-4);

        let html = `
            <div class="acct-section">
                <div class="acct-section-title">API Key</div>
                <div class="acct-key-display">
                    <span id="key-text">${esc(shortKey)}</span>
                    <button id="btn-copy-key" title="Copy full key">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                </div>
            </div>
            <div class="acct-divider"></div>
            <div class="acct-section">
                <div class="acct-section-title">Subscribed Topics</div>
                <p class="acct-info">Toggle topics to personalize your digest. When subscribed, the home feed shows only your chosen topics.</p>
                <div class="acct-topic-grid" id="topic-toggles">`;

        for (const t of allTopics) {
            const slug = t.toLowerCase();
            const sel = subscribed.has(slug) ? "selected" : "";
            const icon = getTopicIcon(slug);
            html += `<span class="acct-topic-chip ${sel}" data-topic="${esc(slug)}">
                <span class="material-symbols-outlined">${icon}</span>${esc(t)}</span>`;
        }

        html += `</div>
                <button class="acct-btn" id="btn-save-subs">
                    <span class="material-symbols-outlined">save</span>
                    Save Subscriptions
                </button>
                <div id="subs-status"></div>
            </div>
            <div class="acct-divider"></div>
            <div class="acct-section">
                <button class="acct-btn acct-btn--danger" id="btn-logout">
                    <span class="material-symbols-outlined">logout</span>
                    Logout
                </button>
            </div>`;

        $panelBody.innerHTML = html;

        // Copy key
        document.getElementById("btn-copy-key").addEventListener("click", () => {
            navigator.clipboard.writeText(key);
            document.getElementById("key-text").textContent = "Copied!";
            setTimeout(() => { document.getElementById("key-text").textContent = shortKey; }, 1500);
        });

        // Toggle chips
        document.querySelectorAll("#topic-toggles .acct-topic-chip").forEach(chip => {
            chip.addEventListener("click", () => chip.classList.toggle("selected"));
        });

        // Save
        document.getElementById("btn-save-subs").addEventListener("click", async () => {
            const selected = [...document.querySelectorAll("#topic-toggles .acct-topic-chip.selected")]
                .map(c => c.dataset.topic);
            const btn = document.getElementById("btn-save-subs");
            const status = document.getElementById("subs-status");
            btn.disabled = true;
            try {
                const res = await fetch(`${API}/users/subscriptions`, {
                    method: "PUT",
                    headers: { "x-api-key": key, "Content-Type": "application/json" },
                    body: JSON.stringify({ topics: selected })
                });
                const data = await res.json();
                status.className = "acct-status success";
                status.textContent = selected.length
                    ? `Subscribed to ${selected.join(", ")}`
                    : "Cleared — showing all topics";
                cachedTopics = null;
                setTimeout(() => { closePanel(); route(); }, 1200);
            } catch (e) {
                status.className = "acct-status error";
                status.textContent = e.message;
            }
            btn.disabled = false;
        });

        // Logout
        document.getElementById("btn-logout").addEventListener("click", () => {
            clearApiKey();
            cachedTopics = null;
            closePanel();
            route();
        });
    }

    // ── Init ──────────────────────────────────────────────

    $logoLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = "#";
    });

    window.addEventListener("hashchange", route);
    route();

})();
