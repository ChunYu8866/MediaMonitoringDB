# Advanced News Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-topic advanced news analysis workspace and prevent incorrect “just now” publication times.

**Architecture:** Shared query-analysis utilities define Boolean matching, sentiment, and keyword statistics. The Worker applies identical query semantics to live RSS and corrects malformed Taiwan timestamps at ingestion. A React page orchestrates up to three existing search requests and renders comparative charts and filterable source-linked articles.

**Tech Stack:** React 19, TypeScript, ECharts, Cloudflare Worker JavaScript, Python 3.12, Vitest, Node test runner, pytest.

## Global Constraints

- Use only the existing 22 news publishers for analysis.
- Support at most three topics and 2–50 characters per query.
- Never substitute fetch time for an invalid publication time.
- Keep all article titles linked to their source URL.
- Mark sentiment and rising-term results as experimental dictionary statistics.

---

### Task 1: Publication-time integrity

**Files:**
- Modify: `worker/src/core.js`
- Modify: `worker/test/core.test.js`
- Modify: `src/opinion_pipeline/connectors/rss.py`
- Modify: `tests/test_archive.py`

**Interfaces:**
- Produces: valid UTC `publishedAt`, or excludes an item whose date is invalid.

- [ ] Add failing tests showing a future Taiwan-local-as-GMT date is shifted back eight hours and an invalid date is discarded.
- [ ] Run Worker and Python targeted tests and confirm the assertions fail for the current behavior.
- [ ] Add date normalization at both ingestion paths without changing valid UTC dates.
- [ ] Run targeted and complete test suites and confirm all pass.

### Task 2: Shared advanced-analysis semantics

**Files:**
- Create: `web/src/lib/analysis.ts`
- Create: `web/src/lib/analysis.test.ts`
- Modify: `worker/src/core.js`
- Modify: `worker/test/core.test.js`
- Modify: `web/src/api/search.ts`

**Interfaces:**
- Produces: Boolean query matcher supporting AND, OR, NOT, minus exclusions, and quoted phrases.
- Produces: `classifySentiment(text)` and `extractRelatedTerms(items, midpoint)`.

- [ ] Add failing Worker and web tests for Boolean matching, sentiment labels, top terms, and rising terms.
- [ ] Run tests and confirm failures come from missing semantics.
- [ ] Implement matching in Worker live/archive filtering and mirrored TypeScript static fallback.
- [ ] Implement transparent dictionary sentiment and token-frequency statistics.
- [ ] Run Worker and web tests and confirm all pass.

### Task 3: Advanced analysis page

**Files:**
- Create: `web/src/pages/AdvancedAnalysisPage.tsx`
- Modify: `web/src/components/Layout.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/index.css`
- Modify: `README.md`
- Modify: `AI_HANDOFF.md`

**Interfaces:**
- Consumes: `searchNews(query, range)` for one to three topics.
- Produces: route `/analysis` with comparison, timeline, source, sentiment, terms, and filtered article sections.

- [ ] Add the route and page using existing Card, Chart, Badge, Banner, LoadingState, and SourceTag components.
- [ ] Run up to three topic searches with partial failure isolation and 30-second live refresh.
- [ ] Render topic volume, timeline, source distribution, experimental sentiment, related/rising terms, and source-linked articles.
- [ ] Add responsive styles and document query semantics and limitations.
- [ ] Run web tests, typecheck, and production build.

### Task 4: Deployment proof

**Files:**
- Verify all modified files and public endpoints.

- [ ] Run all Python, Worker, and web tests plus `git diff --check`.
- [ ] Commit, push `main`, deploy Worker, and wait for GitHub Pages Action success.
- [ ] Verify the known SETN article resolves to `2026-07-22T13:43:00Z`, `/analysis` text exists in the live bundle, and the worktree is clean.
