# 新聞搜尋與台灣即時趨勢 Demo 實作計畫

> **執行方式：** 依 `executing-plans` 與 TDD 流程，在 `feature/news-search-demo` 分支直接修改現有專案。

**目標：** 將既有靜態輿情儀表板改造成可輸入關鍵字、查詢主流新聞、計算新聞熱度並顯示台灣 Google Trends RSS 的免費 Demo；完全移除 Bluesky／社群來源。

**架構：** GitHub Pages 提供 React 前端與最後成功快照；Cloudflare Worker 提供 `/api/search`、`/api/trends`、`/api/health`。GitHub Actions 每 15 分鐘以 best effort 擷取官方 RSS 並更新靜態快照。Worker 或來源失敗時，前端明確標示降級與資料時間，不捏造即時資料。

**技術：** React 18、TypeScript、Vite、ECharts、Python 3、feedparser、Cloudflare Workers、Node test runner、GitHub Actions。

---

## Task 1：建立基準與新聞限定資料契約

**檔案：**
- 修改：`web/src/types/contracts.ts`
- 修改：`web/src/lib/sources.ts`
- 新增：`web/src/api/search.test.ts`
- 修改：`web/package.json`

1. 先執行既有 `npm run typecheck`、`npm run build` 與 `python -m compileall src`，記錄基準。
2. 先寫失敗測試，涵蓋搜尋回應、Google Trends 回應、partial/stale 狀態與固定三分量熱度權重。
3. 移除 `bluesky`、`ptt` 等非新聞 SourceId，新增 `currents` 與 Trends/search contract。
4. 執行測試確認通過，且既有頁面仍可型別檢查。

## Task 2：以 TDD 完成 RSS 快照資料管線

**檔案：**
- 新增：`tests/test_archive.py`
- 新增：`tests/fixtures/*.xml`
- 修改：`src/opinion_pipeline/connectors/rss.py`
- 新增：`src/opinion_pipeline/archive.py`
- 新增：`src/opinion_pipeline/cli.py`
- 修改：`requirements.txt`
- 修改：`config/sources.yml`

1. 先寫 RSS/Atom 解析、去重、關鍵字比對、7 日保留與 Trends RSS 解析失敗測試。
2. 實作只儲存標題、短摘要、來源、時間與原文 URL 的新聞快照。
3. 實作 CLI，輸出 `news-archive.json`、`trends.json`、`sources.json` 與 `meta.json`。
4. 單一來源失敗不得中止全部輸出；保留上一份成功資料並標示 stale/partial。
5. 執行 `pytest` 與 fixture 驗證。

## Task 3：以 TDD 完成 Cloudflare Worker API

**檔案：**
- 新增：`worker/package.json`
- 新增：`worker/wrangler.toml`
- 新增：`worker/src/*.js`
- 新增：`worker/test/*.test.js`
- 新增：`worker/.dev.vars.example`

1. 先寫失敗測試：查詢字 2–50 字、時間範圍、RSS 正規化、去重、熱度公式、CORS、timeout、partial 與 stale fallback。
2. 實作 `GET /api/search?q=&range=`、`GET /api/trends`、`GET /api/health`。
3. 固定上游白名單；每來源最多 20 筆、總計 100 筆；搜尋快取 120 秒、Trends 快取 10 分鐘。
4. Currents 僅在 Secret 存在時啟用；沒有 Secret 時 RSS-only 正常運作。
5. 執行 Worker tests；不得將 Secret 或完整新聞內容寫入輸出。

## Task 4：以 TDD 完成前端搜尋與趨勢頁

**檔案：**
- 新增：`web/src/api/search.ts`
- 新增：`web/src/api/useSearch.ts`
- 新增：`web/src/pages/SearchPage.tsx`
- 修改：`web/src/main.tsx`
- 修改：`web/src/components/Layout.tsx`
- 修改：`web/src/index.css`
- 修改：`web/src/vite-env.d.ts`
- 新增：`web/.env.example`

1. 先寫 API client 單元測試：Worker 成功、HTTP 錯誤、靜態快照 fallback、schema 錯誤。
2. 首頁改為搜尋頁；輸入關鍵字後顯示新聞聲量、加速度、來源多樣性、熱度、時間趨勢、來源分布與文章清單。
3. 顯示台灣 Google Trends RSS 熱門字、約略搜尋量、發布時間與新聞連結；清楚標示 RSS 摘要而非完整 Trends UI。
4. 顯示 loading、empty、partial、stale、error；來源個別失敗不能讓整頁消失。
5. 使用 `VITE_API_BASE_URL`；未設定或 Worker 離線時讀取 Pages 快照並顯示降級。

## Task 5：移除社群殘留並更新自動部署

**檔案：**
- 修改：`web/scripts/generate_sample_data.mjs`
- 修改：`web/src/pages/MethodPage.tsx`
- 修改：`web/src/components/Layout.tsx`
- 修改：`.github/workflows/deploy-web.yml`
- 修改：`README.md`
- 修改：`AI_HANDOFF.md`（僅在實作結果與交接狀態需同步時）

1. 將範例與說明全面改為新聞限定；不得殘留 Bluesky 或社群連結。
2. Workflow 新增 Python 測試與資料擷取、Node/Worker 測試、前端測試、型別檢查與建置。
3. 啟用每 15 分鐘 best-effort schedule；失敗時使用部署站上一版公開安全快照。
4. README 寫清楚本機執行、Worker 部署、環境變數、免費額度限制與資料邊界。

## Task 6：整體驗證與交付

1. 執行 Python tests、Worker tests、前端 tests、TypeScript typecheck、Vite build。
2. 執行殘留掃描：產品程式與資料不得含 `Bluesky`、`bsky` 或社群來源。
3. 啟動本機網站，實際檢查桌面與 360px：搜尋、趨勢、文章連結、錯誤降級。
4. 檢查 `git diff --check`、`git status`，確認只納入本次功能與原有未追蹤後端草稿。
5. 更新交接文件的完成狀態；不宣稱 Cloudflare/GitHub 已上線，除非實際部署與 HTTP 驗證成功。

