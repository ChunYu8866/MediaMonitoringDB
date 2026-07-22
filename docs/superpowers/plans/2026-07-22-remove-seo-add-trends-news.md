# Remove Website SEO and Add Google Trends News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Website SEO surface completely and make every visible Google Trends term open a detail block containing its real RSS traffic metadata and related news.

**Architecture:** Keep the 22-publisher news analysis unchanged. Preserve every Google Trends RSS related-news entry as a separate `TrendNewsItem` and render it in a dedicated Trends detail card, so external publishers never affect the news heat formula.

**Tech Stack:** React 18, TypeScript, Vite, Cloudflare Workers JavaScript, Python 3.12, pytest, Vitest, Node test runner.

## Global Constraints

- Google Trends related news may include publishers outside the 22-source allowlist.
- Trends news must be clearly separated from and excluded from 22-source metrics.
- Do not invent traffic, curves, publishers, article text, or links.
- Remove the SEO navigation, route, page, public JSON, contracts, metadata fields, and active documentation.

---

### Task 1: Preserve Google Trends Related News

**Files:**
- Modify: `tests/test_archive.py`
- Modify: `src/opinion_pipeline/cli.py`
- Modify: `worker/test/core.test.js`
- Modify: `worker/src/core.js`
- Modify: `worker/src/index.js`

**Interfaces:**
- Consumes: Google Trends RSS `ht:news_item` fields.
- Produces: `TrendsItem.news: { title: string; source: string; url: string }[]` without the 22-publisher filter.

- [ ] **Step 1: Change the Python regression test** to assert that an external Trends related-news URL is preserved rather than filtered.
- [ ] **Step 2: Run** `$env:PYTHONPATH='src'; python -m pytest tests/test_archive.py -q` and confirm the old allowlist behavior fails.
- [ ] **Step 3: Remove `filter_trends_news` from the Python snapshot path** and pass `parse_trends_feed(...)[:20]` directly into `trends.json`.
- [ ] **Step 4: Change the Worker regression test** to expect both the allowlisted and external related-news entries.
- [ ] **Step 5: Run** `npm test` in `worker/` and confirm the old filter fails.
- [ ] **Step 6: Make `parseTrendsRss(xml)` retain all valid HTTP(S) news items** and call it without `NEWS_SOURCES`.
- [ ] **Step 7: Run Python and Worker tests and confirm both pass.**

### Task 2: Render Trends Detail Without Polluting News Metrics

**Files:**
- Modify: `web/src/types/contracts.ts`
- Modify: `web/src/api/search.test.ts`
- Modify: `web/src/api/search.ts`
- Modify: `web/src/pages/SearchPage.tsx`
- Modify: `web/src/index.css`

**Interfaces:**
- Consumes: existing `Envelope<TrendsData>` loaded by `fetchTrends()`.
- Produces: selected `TrendItem` state with traffic, published time, source link, and related-news cards.

- [ ] **Step 1: Add a failing parser test** requiring each Trends item to expose `news` entries with `title`, `source`, and `url`.
- [ ] **Step 2: Run** `npm test -- --run` in `web/` and confirm malformed or missing news metadata is rejected.
- [ ] **Step 3: Define `TrendNewsItem` and `TrendItem` contracts** and strengthen `parseTrendsResponse` validation.
- [ ] **Step 4: Add `selectedTrend` state**; clicking a chip sets it and runs the existing 22-source search.
- [ ] **Step 5: Render a dedicated Google Trends card** showing `approximateTraffic`, `publishedAt`, source URL, and every related-news link with publisher label.
- [ ] **Step 6: Keep the existing `SearchData` object untouched** so Trends news never enters metrics, charts, source counts, or the 22-source article list.
- [ ] **Step 7: Add responsive CSS** for the detail summary and related-news grid.
- [ ] **Step 8: Run web tests, typecheck, and production build.**

### Task 3: Remove Website SEO Completely

**Files:**
- Delete: `web/src/pages/SeoPage.tsx`
- Delete: `web/public/data/seo.json`
- Modify: `web/src/components/Layout.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/types/contracts.ts`
- Modify: `web/src/lib/sources.ts`
- Modify: `web/src/pages/MethodPage.tsx`
- Modify: `src/opinion_pipeline/cli.py`
- Modify: `README.md`
- Modify: `AI_HANDOFF.md`

**Interfaces:**
- Removes: `/seo`, `SeoData`, `gsc`, and `Meta.lastSeoAt`.

- [ ] **Step 1: Add or update tests** so source metadata excludes `gsc`, Meta no longer expects `lastSeoAt`, and active frontend modules contain no SEO route.
- [ ] **Step 2: Run tests and confirm they fail against the current SEO implementation.**
- [ ] **Step 3: Remove the SEO navigation, route, page, types, source metadata, Method page tile/limitation, pipeline field, public file, and active docs.**
- [ ] **Step 4: Run residue scans** for `SeoPage`, `/seo`, `網站 SEO`, `Search Console`, `lastSeoAt`, `seo.json`, and `gsc` outside historical specs.
- [ ] **Step 5: Run all Python, Worker, and web tests plus typecheck and build.**
- [ ] **Step 6: Rebuild real snapshots and verify Trends external links use HTTP(S) and no SEO artifact exists.**
- [ ] **Step 7: Commit, push `main`, wait for Pages deployment, and verify the live Trends detail data and absence of SEO navigation/artifacts.**
