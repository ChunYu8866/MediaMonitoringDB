# 台灣新聞輿情搜尋與關鍵字熱度 Demo

免費優先的新聞輿情 Demo：輸入關鍵字後，查詢已啟用的新聞 RSS，顯示新聞熱度、聲量趨勢、來源分布與原文連結；首頁另顯示台灣 Google Trends「熱門搜尋」官方 RSS 摘要。

## 目前可用功能

- 新聞關鍵字搜尋：`1h`、`6h`、`24h`、`7d`。
- 新聞熱度：`100 × (0.50V + 0.33A + 0.17D)`。
- 台灣 Google Trends RSS：熱門字、約略搜尋量、發布時間與相關新聞。
- 個別來源失敗時顯示 `partial`；Worker 離線時改讀 GitHub Pages 最後快照並標示 `stale`。
- Google Search Console 保留為獨立 SEO 頁，不併入新聞熱度或全網熱門搜尋。

本機已驗證可取得中央社、自由時報、ETtoday 與鏡傳媒 RSS；TVBS 目前對自動請求回傳 `HTTP_403`，三立因未確認可用官方 RSS 而停用。來源狀態會隨每次更新顯示，不會把失敗來源偽裝成成功。

## 架構

```text
瀏覽器（GitHub Pages）
  ├─ Cloudflare Worker：/api/search、/api/trends、/api/health
  └─ public/data：Worker 失敗時的最後成功快照

GitHub Actions（每 15 分鐘 best effort）
  └─ Python RSS 管線 → news-archive.json / trends.json / sources.json
```

新聞僅保存來源、標題、最多 140 字短摘要、發布時間與原文 URL；不保存或重製全文與圖片。7 天搜尋僅涵蓋已啟用來源的快照，不代表完整全網新聞。

## 本機執行

需要 Python 3.11+ 與 Node.js 22+。

```powershell
python -m pip install -r requirements.txt
$env:PYTHONPATH = 'src'
python -m pytest -q
python -m opinion_pipeline.cli

Set-Location web
npm install
npm test
npm run dev
```

若尚未部署 Worker，前端仍可用 `web/public/data/news-archive.json` 搜尋最後快照。要使用即時 Worker，複製 `web/.env.example` 為 `web/.env.local` 並設定：

```text
VITE_API_BASE_URL=https://your-worker.workers.dev
```

## Cloudflare Worker

```powershell
Set-Location worker
npm install
npm test
npx wrangler login
npm run deploy
```

部署後將 Worker 網址填入 `web/.env.local`。公開部署可在 GitHub Actions 建置步驟透過 repository variable 注入。選配 Currents API 時，Secret 只能放在 Worker：

```powershell
npx wrangler secret put CURRENTS_API_KEY
```

未設定 Currents Secret 時，系統維持 RSS-only，不會中止。免費服務都有額度與 CPU／請求限制；程式不會自動升級付費方案。

## GitHub Pages

1. Repository `Settings → Pages → Source` 選擇 **GitHub Actions**。
2. 推送至 `main`，或手動執行 `Update news snapshot and deploy Pages`。
3. 排程每 15 分鐘嘗試更新一次；GitHub 不保證準點執行，故 UI 會顯示實際資料時間。

正式站點：<https://chunyu8866.github.io/MediaMonitoringDB/>

## Google Search Console

Search Console API 只反映這個 GitHub Pages 網站的曝光、點擊、CTR 與排名，不是全網新聞或 Google Trends。驗證方式與 API 額度請以 Google 官方文件為準：

- <https://developers.google.com/webmaster-tools?hl=zh-tw>
- <https://developers.google.com/webmaster-tools/limits?hl=zh-tw>

## 資料來源

| 來源 | 狀態與用途 |
|---|---|
| 中央通訊社 | 官方 RSS；啟用 |
| 自由時報 | 官方 RSS；啟用 |
| ETtoday 新聞雲 | 官方 RSS；啟用 |
| 鏡傳媒 | 官方 RSS；啟用 |
| TVBS 新聞網 | RSS 已設定；若被拒絕則標示來源錯誤 |
| 三立新聞網 | 未確認可用官方 RSS，預設停用 |
| Currents API | 選配；只有 Worker Secret 存在時才可啟用 |
| Google Trends TW | 官方 Trending Now RSS；僅作熱門搜尋摘要 |
| Google Search Console | 獨立 SEO 模組 |

## 驗證指令

```powershell
$env:PYTHONPATH = 'src'
python -m pytest -q

Set-Location worker
npm test

Set-Location ../web
npm test
npm run typecheck
npm run build
```

完整決策與限制見 [AI_HANDOFF.md](AI_HANDOFF.md) 及 [新版設計規格](docs/superpowers/specs/2026-07-22-news-search-demo-design.md)。
