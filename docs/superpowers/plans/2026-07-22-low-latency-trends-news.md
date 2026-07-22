# Low-Latency Trends News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visible refresh delay and ensure every selected Google Trends term can show current related news when Google Trends RSS omits its own news entries.

**Architecture:** Cloudflare Worker remains the live data boundary. Search responses become non-cacheable, Trends receives a 60-second edge cache, and a dedicated trend-news endpoint returns RSS news metadata without changing the 22-source analysis contract. React owns visibility-aware polling and displays refresh state.

**Tech Stack:** Cloudflare Workers JavaScript, React 19, TypeScript, Vitest, Node test runner.

## Global Constraints

- Do not merge arbitrary Google Trends related-news publishers into the 22-source heat calculation.
- Do not claim the Google Trends RSS is the complete Google Trends web product.
- Stop automatic polling while the document is hidden.
- Preserve GitHub Pages snapshots as failure fallback.

---

### Task 1: Worker cache and Trends news fallback

**Files:**
- Modify: `worker/src/core.js`
- Modify: `worker/src/index.js`
- Test: `worker/test/core.test.js`
- Test: `worker/test/routes.test.js`

**Interfaces:**
- Produces: `GET /api/trend-news?q=<term>` returning `{ query, items }`.
- Produces: search `Cache-Control: no-store`; Trends `Cache-Control: public, max-age=60`.

- [ ] Write failing route and parser tests for unrestricted Google News metadata, input validation, response shape, and cache headers.
- [ ] Run `npm test` in `worker`; confirm the new assertions fail for missing behavior.
- [ ] Add an unrestricted metadata parser and `/api/trend-news` handler; make search non-cacheable and Trends cache 60 seconds.
- [ ] Run `npm test` in `worker`; confirm every test passes.

### Task 2: Visibility-aware live refresh UI

**Files:**
- Create: `web/src/lib/refresh.ts`
- Create: `web/src/lib/refresh.test.ts`
- Modify: `web/src/api/search.ts`
- Modify: `web/src/pages/SearchPage.tsx`
- Modify: `web/src/index.css`

**Interfaces:**
- Produces: `fetchTrendNews(term)` and deterministic `nextRefreshSeconds()` helpers.
- Consumes: `/api/search`, `/api/trends`, `/api/trend-news`.

- [ ] Write failing tests for 30-second search and 120-second Trends refresh schedules.
- [ ] Run `npm test -- --run` in `web`; confirm failure because refresh helpers are absent.
- [ ] Add refresh helpers, manual refresh button, last-success time, countdown, visibility pause/resume, and selected-trend news fallback.
- [ ] Show each trend chip's RSS news count and label Google News fallback separately.
- [ ] Run tests, typecheck, and build; confirm all pass.

### Task 3: Documentation, deployment, and live proof

**Files:**
- Modify: `README.md`
- Modify: `AI_HANDOFF.md`

- [ ] Document exact refresh intervals and the Google Trends RSS versus Google News fallback boundary.
- [ ] Run Python, Worker, and web test suites plus `git diff --check`.
- [ ] Commit and push `main`, deploy the Worker, and wait for GitHub Pages deployment.
- [ ] Verify production cache headers, a Trends term with fallback news, live UI text, and a clean worktree.
