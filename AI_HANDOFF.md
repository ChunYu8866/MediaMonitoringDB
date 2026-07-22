# 台灣新聞搜尋與 Google Trends Demo：AI 交接文件

> 更新日期：2026-07-22
> 狀態：核心 Demo 使用固定 22 家台灣新聞來源，並透過 GitHub Pages 與 Cloudflare Worker 提供服務
> 正式規格：`docs/superpowers/specs/2026-07-22-taiwan-22-news-sources-design.md`

## 1. 交接目標

把目前的輿情儀表板改為免費、公開的新聞搜尋 demo。使用者輸入任意關鍵字後，系統經免費後端即時取得近期新聞，呈現新聞量、媒體分布、趨勢、實驗性情緒、相關詞與人物／組織共現。

首頁同時顯示 Google Trends 台灣熱門搜尋。點選熱搜詞後，直接帶入新聞搜尋。

## 2. 最新需求優先級

本文件與新版正式規格優先於 2026-07-21 的舊設計。不可繼續實作以下舊需求：

- 任何社群或論壇 connector。
- 社群貼文、互動數或社群擴散指標。

產品程式與公開內容中的舊社群來源參照都必須移除，包括 README、型別、範例資料、產生器、UI、測試與來源設定。

## 3. 已核准架構

```text
GitHub Pages（React + TypeScript + Vite）
   │
   ├─ GET /api/search?q=...&range=24h
   ├─ GET /api/trends
   └─ GET /api/health
   │
Cloudflare Worker Free
   ├─ 官方新聞 RSS
   ├─ Google News RSS（只接受 22 家白名單媒體）
   └─ Google Trends TW RSS
   │
GitHub Actions
   ├─ 每 15 分鐘以 best effort 更新 7 天新聞 metadata archive
   ├─ 官網公開列表每個來源最多每 6 小時擷取一次
   ├─ search／trends last-good 靜態 JSON
   ├─ 較重的離線 NLP
   └─ GitHub Pages build/deploy
```

前端仍部署於 GitHub Pages。Worker 只做抓取、XML／JSON 解析、正規化、去重、快取及輕量統計；模型推論不得放進 Worker。

## 4. 資料來源

### 固定白名單

TVBS、東森、三立、民視、中天、年代、壹電視、公視新聞、UDN、自由時報、中央社、經濟日報、工商時報、鉅亨網、財訊、商業週刊、關鍵評論網、報導者、新頭殼、NOWNEWS、壹蘋新聞網與 ETtoday，共 22 家。

### 取得順序

1. 官方 RSS 優先。
2. Google News RSS 只保留上述媒體的官方網域或正式名稱。
3. 無 RSS 或 RSS 失敗時，可對允許的官網公開列表進行每 6 小時一次的 metadata 擷取。

UDN 與經濟日報不得直接擷取官網；所有來源都不得繞過 robots.txt、登入、403、CAPTCHA 或付費牆。所有社群、論壇與不在白名單內的新聞來源不得部署。

所有新聞只公開來源、標題、短摘要、時間與原文連結，不保存或重製全文與圖片。

## 5. Google Trends

固定使用：

`https://trends.google.com/trending/rss?geo=TW&hl=zh-TW`

規則：

- Worker 最多快取 60 秒，前端每 2 分鐘檢查；不宣稱即時 SLA。
- 顯示熱門詞、約略搜尋量與開始時間。
- 標示「資料來源：Google Trends」並連回原始頁。
- 點選熱搜詞後直接執行新聞搜尋。
- RSS 未附新聞時，重用同一次 `/api/search` 的 22 家媒體結果，避免額外上游請求與逾時。
- 任意 query 若未出現在目前 RSS，不顯示或推估 Google 搜尋量。
- Google Trends 與新聞熱度是不同資料，不得混成單一指標。
- 失敗時顯示 last-good 靜態資料並標示 stale。

## 6. Worker API

### `GET /api/search`

- `q`：必要，2–50 字元。
- `range`：`1h`、`6h`、`24h`、`7d`，預設 `24h`。

回傳固定 envelope：`schemaVersion`、`generatedAt`、`data`。`data` 內含 `query`、`range`、`status`、`stale`、`metrics`、`timeline`、`sourceCounts`、`sources` 與 `items`。

Worker 會合併即時 RSS／API 結果與 Pages 固定位置的 `news-archive.json`。`7d` 只代表已啟用來源所收集到的七天 metadata，不是全網完整新聞庫。

每筆 item 至少包含：

- `id`
- `source`
- `title`
- `excerpt`
- `publishedAt`
- `url`
- `sentiment`（未執行實驗性判讀時為 `null`）

### `GET /api/trends`

回傳固定 envelope；`data` 內含 `geo`、`status`、`sourceUrl`、`stale` 與趨勢 items；不公開第三方新聞圖片。

### `GET /api/health`

只回傳版本、部署時間與來源狀態摘要，不回傳 secret 或完整內部錯誤。

## 7. 安全與免費限制

- CORS 只允許正式 GitHub Pages origin 與本機開發 origin。
- 只允許 `GET`、`HEAD`、`OPTIONS`。
- 上游 URL 固定寫在白名單，使用者不得提供 URL。
- 單一上游逾時 5 秒；每來源最多 20 筆，總數最多 100 筆。
- 搜尋 query 不做共用快取；前端每 30 秒刷新。Trends 最多快取 60 秒。
- timeout、5xx 最多重試 2 次；429 優先遵守 `Retry-After`。
- Worker 超過免費額度時不得自動付費，前端改用 Pages last-good 快照。
- API key、OAuth token、cookie、模型權重與完整新聞本文不得進入 Git、Pages 或 log。

## 8. 分析與畫面

搜尋後顯示：

- 新聞總量。
- 有效媒體數與媒體占比。
- 24／48 小時或 7 天聲量趨勢。
- 新聞熱度與公式分解。
- 標題／RSS 短摘要的實驗性情緒。
- 相關詞、PERSON／ORG 共現。
- 新聞列表與原文連結。
- partial、stale、快取時間與來源錯誤。

新聞熱度移除社群 engagement：

```text
NewsHeat = 100 × (0.50V + 0.33A + 0.17D)
```

- `V`：聲量。
- `A`：加速度。
- `D`：新聞來源多樣性。

情緒第一版可使用可檢查的詞典規則，但 UI 必須固定標示「實驗性情緒」。較重的模型、BERTopic、NER 與抽取式摘要留在 GitHub Actions。

主要畫面：

1. 首頁搜尋與 Google Trends chips。
2. 分析總覽與趨勢圖表。
3. 媒體／情緒分布、相關詞與共現。
4. 新聞列表。
5. Google 熱搜排行。
6. 方法與狀態。

## 9. 錯誤與降級

- 單一來源失敗：其他來源照常回傳，`partial: true`。
- 個別官方 RSS 不可用：改用 22 家白名單內的 Google News RSS 結果；符合設定者每 6 小時補一次官網 metadata。
- Trends 失敗：使用 last-good 並標 stale。
- Worker 無法使用：前端讀取 Pages 靜態快照。
- 全部失敗：顯示錯誤與最後成功時間，不生成假資料。
- 搜尋結果為零：顯示目前來源與時間範圍內沒有結果，不補不相關文章。
- schema 主版本不支援：顯示明確錯誤，不猜欄位。

## 10. 目前程式狀態

- `main` 已有 React 搜尋首頁、Worker 三個 endpoints、Python RSS／官網 metadata 快照管線與 Google Trends TW adapter。
- 公開資料契約已升至 schema `2.0.0`；前端只接受主版本 2。
- 來源白名單固定 22 家；官方 RSS 優先、Google News RSS 補足，低頻官網擷取只取標題、短摘要、時間與原文連結。
- `topics.json` 每次由真實新聞快照依可檢查關鍵詞規則重建；摘要片段與代表內容保留該筆新聞 URL，不使用範例連結。
- 前端在未設定 Worker URL 時會讀取 `news-archive.json`／`trends.json` 並標示 stale。
- GitHub Actions 已改為每 15 分鐘 best-effort 更新、測試、建置與部署。
- Cloudflare Worker 與 GitHub Pages 已部署；後續修改必須同時驗證 Worker API、Pages 建置與公開 JSON。

## 11. 實作順序

1. 執行所有測試、build、residue/secret 掃描。
2. 推送至 `main`，等待 Pages workflow 完成。
3. 在 `worker/` 執行 `npm run deploy`。
4. 對公開 `/api/health`、`/api/search`、`/api/trends`、Pages 首頁與 22 家來源 JSON 做實際驗證。

## 12. 完成定義

- `README.md`、`web/`、`src/`、`config/` 與公開 JSON 不存在舊社群來源的名稱、網域或 API method。
- 使用者可輸入關鍵字並取得真實新聞結果。
- 至少 3 個啟用來源能回傳可開啟的原文連結。
- Google Trends TW RSS 可顯示，點擊詞可執行新聞搜尋。
- Worker／個別來源／Trends 故障均有明確降級。
- 任意 query 沒有 Trends 資料時不虛構搜尋量。
- UI 清楚顯示資料時間、來源、partial、stale 與實驗性情緒。
- 桌面與 360px 手機 E2E 通過。
- Git、Pages artifact 與 log 不含秘密、完整新聞本文或模型權重。
- README 包含本機開發、Worker 部署、Secrets、Pages、免費限制與來源邊界。

## 13. 下一個 AI 的第一個回合

1. 讀完本文件與新版正式規格。
2. 執行 `git status --short --branch`，辨認並保留既有未提交工作。
3. 以 [22 家來源規格](docs/superpowers/specs/2026-07-22-taiwan-22-news-sources-design.md) 為現行準則；舊新聞搜尋規格僅供歷史參考。
4. 修改必須採 TDD，完成前要做本機與公開站雙重驗證。

可直接貼給下一個 AI：

```text
請先閱讀根目錄 AI_HANDOFF.md 與 docs/superpowers/specs/2026-07-22-taiwan-22-news-sources-design.md。先檢查 git status 並保留所有既有未提交內容。系統的新聞來源固定為 22 家，不得還原鏡傳媒、Bluesky 或 Currents；實作採 TDD，完成前執行測試、build、secret/residue 掃描、Worker 與 Pages 公開站驗證。
```

## 14. 官方參考

- [22 家來源正式規格](docs/superpowers/specs/2026-07-22-taiwan-22-news-sources-design.md)
- [OpView 指標參考](https://www.opview.com.tw/2024-mpr-rporting)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Google Trends 熱搜說明](https://support.google.com/trends/answer/3076011?hl=zh-TW)
- [Google Trends API Alpha](https://developers.google.com/search/apis/trends)
- [中央社 RSS](https://www.cna.com.tw/about/rss.aspx)
- [自由時報 RSS](https://service.ltn.com.tw/RSS)
- [ETtoday RSS](https://www.ettoday.net/events/news-express/epaper.php)
