# 台灣新聞輿情搜尋與關鍵字熱度 Demo

免費優先的新聞輿情 Demo：輸入關鍵字後，合併官方 RSS、指定媒體的 Google News RSS 與每 6 小時官網 metadata 快照，顯示新聞熱度、聲量趨勢、來源分布與原文連結；首頁另顯示台灣 Google Trends「熱門搜尋」官方 RSS 摘要。

## 目前可用功能

- 新聞關鍵字搜尋：`1h`、`6h`、`24h`、`7d`。
- 新聞熱度：`100 × (0.50V + 0.33A + 0.17D)`。
- 台灣 Google Trends RSS：熱門字、約略搜尋量、發布時間與相關新聞。
- 個別來源失敗時顯示 `partial`；Worker 離線時改讀 GitHub Pages 最後快照並標示 `stale`。
- 搜尋結果不使用共用快取，搜尋後每 30 秒自動刷新；Google Trends 每 2 分鐘檢查，Worker 最多快取 60 秒。
- Trends RSS 未附新聞時，點選熱門詞會由 Google News RSS 即時補充；補充來源不納入 22 家媒體熱度。

來源固定為 22 家指定媒體。官方 RSS 可用時優先使用；沒有可用 RSS 時由 Google News RSS 補充，TVBS、東森、三立、年代、商業週刊、新頭殼與 NOWNEWS 另有遵守 robots.txt 的低頻官網 metadata 擷取。來源狀態會隨每次更新顯示，不會把失敗來源偽裝成成功。

## 架構

```text
瀏覽器（GitHub Pages）
  ├─ Cloudflare Worker：/api/search、/api/trends、/api/trend-news、/api/health
  └─ public/data：Worker 失敗時的最後成功快照

GitHub Actions（每 15 分鐘 best effort）
  ├─ Python RSS 管線 → news-archive.json / trends.json / sources.json
  └─ 官網 metadata 管線 → 每個來源最多每 6 小時一次
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

部署後將 Worker 網址填入 `web/.env.local`。公開部署可在 GitHub Actions 建置步驟透過 repository variable 注入。系統不需要付費新聞 API Secret；免費服務都有額度與 CPU／請求限制，程式不會自動升級付費方案。

## GitHub Pages

1. Repository `Settings → Pages → Source` 選擇 **GitHub Actions**。
2. 推送至 `main`，或手動執行 `Update news snapshot and deploy Pages`。
3. 排程每 15 分鐘嘗試更新一次；GitHub 不保證準點執行，故 UI 會顯示實際資料時間。

正式站點：<https://chunyu8866.github.io/MediaMonitoringDB/>

## 資料來源

| 來源 | 狀態與用途 |
|---|---|
| TVBS、東森、三立、民視、中天、年代、壹電視、公視新聞 | 官方 RSS優先；Google News 補充；允許者每 6 小時低頻擷取 metadata |
| UDN、自由時報、中央社、經濟日報 | RSS 或 Google News；UDN 與經濟日報不直接擷取官網 |
| 工商時報、鉅亨網、財訊、商業週刊 | 官方 RSS優先；Google News 補充；允許者低頻擷取 metadata |
| 關鍵評論網、報導者、新頭殼、NOWNEWS、壹蘋新聞網、ETtoday | 官方 RSS優先；Google News 補充；允許者低頻擷取 metadata |
| Google Trends TW | 官方 Trending Now RSS；僅作熱門搜尋摘要 |

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

完整決策與限制見 [AI_HANDOFF.md](AI_HANDOFF.md) 及 [22 家來源設計規格](docs/superpowers/specs/2026-07-22-taiwan-22-news-sources-design.md)。
