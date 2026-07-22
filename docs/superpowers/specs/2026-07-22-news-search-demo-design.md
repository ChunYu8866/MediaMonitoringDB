# 台灣新聞搜尋與 Google Trends Demo 設計規格

**日期：** 2026-07-22
**狀態：** 使用者已核准
**定位：** 免費、公開、台灣繁體中文的新聞監測展示系統

## 1. 產品目標

建立一個接近媒體監測產品操作方式的研究型 demo。使用者輸入關鍵字後，系統即時查詢已核准的新聞來源，回傳近期文章，並呈現新聞聲量、媒體分布、時間趨勢、實驗性情緒、相關詞與人物／組織共現。

首頁另提供 Google Trends 台灣熱門搜尋。使用者點選熱搜詞後，可直接帶入新聞搜尋，觀察搜尋熱度與新聞報導之間的時間差。

本規格取代 2026-07-21 的舊設計。舊規格中的社群資料與社群互動指標全部取消。

## 2. 已核准決策

- 只分析新聞文章，不收集社群或論壇內容。
- 前端維持 GitHub Pages。
- 即時請求由 Cloudflare Workers Free 處理。
- 新聞主來源為已確認可使用的官方 RSS；可選的免費新聞 API 必須經 Worker 保護金鑰。
- Google Trends 使用 `Trending now` 的台灣 RSS 匯出，不依賴未公開的內部 API。
- 整個 demo 不收費，接受免費服務的配額、延遲與停用風險。
- 不重製新聞全文或圖片，只顯示標題、短摘要、媒體、時間與原文連結。
- Google Search Console 保留為本站 SEO 模組，不屬於新聞搜尋或 Google Trends 指標。

## 3. 不在本次範圍

- 商用媒體資料授權、付費新聞資料庫或完整文章封存。
- 任意網站爬蟲、登入後內容、付費牆內容或繞過 robots／反機器人措施。
- 精準代表全體台灣民意的推論。
- Google Trends 任意關鍵字的即時搜尋量。正式 Trends API 仍為限量 Alpha，且公開 RSS 只提供目前熱門趨勢。
- 自動產生公關策略、商業建議或不可追溯的生成式摘要。

## 4. 系統架構

```text
GitHub Pages（React）
  ├─ 搜尋關鍵字
  ├─ 新聞分析儀表板
  ├─ Google Trends 台灣熱搜
  └─ 靜態 last-good 快照
          │
          ▼
Cloudflare Worker
  ├─ GET /api/search?q=...&range=24h
  ├─ GET /api/trends
  ├─ GET /api/health
  ├─ CORS、輸入驗證、逾時、快取、去重
  ├─ 官方新聞 RSS adapters
  ├─ Currents API adapter（有 secret 時）
  └─ Google Trends RSS adapter
          │
          ▼
GitHub Actions
  ├─ 每 15 分鐘以 best effort 更新 7 天新聞 metadata archive
  ├─ 產生 search／trends last-good JSON
  ├─ 執行較重的離線 NLP／品質評估
  └─ 建置並部署 GitHub Pages
```

Worker 只負責網路請求、XML／JSON 解析、正規化、過濾、去重與輕量統計。免費層每次 CPU 時間有限，模型推論與長時間分析不得放入 Worker。

## 5. 新聞資料來源

### 5.1 預設啟用

- 中央通訊社官方 RSS。
- 自由時報官方 RSS。
- ETtoday 官方 RSS／FeedBurner 入口；公開資料仍只使用標題、短前言、時間與連結。
- 鏡傳媒官方 RSS。
- TVBS RSS；若回傳 403，只標示來源失敗，不影響其他結果。

三立目前維持停用，直到確認可直接使用的官方 feed。

### 5.2 選用來源

- Currents API：僅在 Worker Secret `CURRENTS_API_KEY` 已設定時啟用。免費層用於補足關鍵字搜尋廣度，只公開 metadata 與原文連結。
- GDELT：預設停用，只保留實驗 adapter。實測曾回傳 429，且繁中原詞搜尋能力有限，不得成為唯一來源。

### 5.3 不部署的來源

- Google News 關鍵字 RSS：雖可取得資料，但 feed 內的用途聲明限制較嚴格，不作為公開 demo 的預設資料庫。
- NewsAPI、GNews、NewsData.io 等免費方案：因 production、CORS、延遲或授權限制，不列入第一版必要依賴。
- 舊社群來源：從使用者文件、程式、型別、範例資料及 UI 完全移除。

## 6. Worker API 契約

### 6.1 `GET /api/search`

參數：

- `q`：必要，正規化後 2–50 個字元。
- `range`：`1h`、`6h`、`24h` 或 `7d`，預設 `24h`。

回應：

```json
{
  "schemaVersion": "2.0.0",
  "generatedAt": "2026-07-22T11:00:00Z",
  "data": {
    "query": "台積電",
    "range": "24h",
    "status": "partial",
    "stale": false,
    "metrics": {},
    "timeline": [],
    "sourceCounts": {},
    "sources": [],
    "items": []
  }
}
```

每個 item 包含 `id`、`source`、`title`、`excerpt`、`publishedAt`、`url` 與 `sentiment`。不得包含完整文章內容。

搜尋會合併即時取得的 RSS／API 結果與 GitHub Pages 固定位置的 7 天 `news-archive.json`。`range=7d` 只代表目前 archive 所涵蓋的可用 metadata，不得宣稱為全網完整七日新聞庫。

### 6.2 `GET /api/trends`

資料源固定為：

`https://trends.google.com/trending/rss?geo=TW&hl=zh-TW`

回應使用相同 envelope；`data` 包含 `geo`、`status`、`sourceUrl`、`stale` 及趨勢 items。每個 item 只保存 `title`、`approximateTraffic`、`publishedAt` 與必要來源連結；第一版不公開第三方新聞圖片。

### 6.3 `GET /api/health`

只回傳服務版本、部署時間及來源狀態摘要，不回傳 secret、完整上游錯誤本文或內部識別碼。

## 7. Worker 安全與配額

- CORS 只允許正式 GitHub Pages origin 與本機開發 origin。
- 只接受 `GET`、`HEAD`、`OPTIONS`。
- 上游 URL 全部寫死在來源白名單；使用者不得傳入 URL，避免成為 open proxy。
- 單一上游請求逾時 5 秒；每來源最多 20 筆，總回傳最多 100 筆。
- 相同正規化 query 快取 120 秒；Google Trends 快取 10 分鐘。
- timeout、5xx 與可重試錯誤最多重試 2 次；429 優先遵守 `Retry-After`，但不得超過整體請求時間預算。
- 前端永遠不得取得 Currents API key 或任何上游憑證。
- Worker 超過免費額度時不得自動升級付費；前端改讀靜態 last-good 快照。

## 8. 搜尋與正規化流程

1. 驗證並正規化 query，保留使用者原始輸入。
2. 並行取得已啟用的官方 RSS；有 Currents secret 時同步查詢 API。
3. 從固定 Pages URL 取得 7 天 `news-archive.json`，失敗時只使用即時來源並標示 partial。
4. 驗證內容類型、HTTP 狀態與必要欄位。
5. 時間統一儲存為 UTC，介面顯示 Asia/Taipei。
6. 以 OpenCC `s2twp` 產生比對文字，但保留來源原文。
7. 以來源 ID、canonical URL、標題與發布時間雜湊去重。
8. 只保留符合 query／alias 規則及指定時間範圍的項目。
9. 回傳來源健康狀態；任一來源失敗時以 `partial: true` 表示。

## 9. 新聞分析指標

### 9.1 即時計算

- 新聞總量。
- 有效媒體數與各媒體占比。
- 依小時／日期彙總的聲量趨勢。
- 標題與短摘要的相關詞。
- PERSON／ORG 共現；圖表必須標示「共現不代表支持、反對或因果」。

### 9.2 新聞熱度

新聞來源通常沒有一致的互動數，因此移除舊公式的 engagement 分量：

```text
NewsHeat = 100 × (0.50V + 0.33A + 0.17D)
```

- `V`：最近 60 分鐘文章數經 `log1p` 後的百分位。
- `A`：最近 15 分鐘相對前 15 分鐘的正向成長，最高以 5 倍成長封頂。
- `D`：來源分布熵正規化。

所有分量必須一併回傳，讓使用者可以解釋及重算分數。

### 9.3 情緒與主題

- 即時 demo 先以標題和 RSS 短摘要的可檢查詞典規則產生正向、中立、負向結果。
- UI 固定標示「實驗性情緒」，不得描述成客觀真值。
- 較重的模型、BERTopic、NER 與抽取式摘要留在 GitHub Actions 離線管線。
- 摘要每一句必須是可追溯的來源文字片段並附原文連結。

## 10. Google Trends 規則

- Google 官方說明 `Trending now` 平均約每 10 分鐘更新，系統以 10 分鐘為快取時間，不宣稱即時 SLA。
- 熱搜詞顯示名稱、約略搜尋量與開始時間，並標示「資料來源：Google Trends」。
- 點選趨勢詞會填入新聞搜尋框並執行新聞查詢。
- Trends RSS 與網頁完整列表的筆數、排序及篩選可能不同；UI 稱為「Google Trends RSS 熱搜摘要」。
- 任意 query 若沒有出現在目前 RSS，不顯示或推估 Google 搜尋量。
- Google Trends 數值不得加入 `NewsHeat`；兩者在資料契約及畫面中分開呈現。
- 抓取失敗時改用 last-good JSON 並標示 stale。

## 11. 前端資訊架構

### 11.1 首頁搜尋

- 大型搜尋框。
- `1h`、`6h`、`24h`、`7d` 時間範圍。
- 新聞來源篩選。
- Google Trends 台灣熱搜 chips；點擊後直接搜尋。

### 11.2 搜尋結果

- 新聞量、有效媒體數、NewsHeat、實驗性情緒摘要卡。
- 聲量趨勢折線圖。
- 媒體分布與情緒分布。
- 相關詞、人物與組織共現。
- 新聞列表：媒體、標題、短摘要、時間、原文連結。
- partial、stale、快取時間與來源錯誤狀態。

### 11.3 其他頁面

- Google 熱搜：台灣熱門排行與更新狀態。
- 方法與狀態：來源、公式、授權邊界、模型限制與服務健康。
- Search Console SEO：保留既有頁面，但與新聞搜尋、NewsHeat、Google Trends 完全分離。

所有主要流程支援 360px 手機寬度與桌面瀏覽器。

## 12. 降級與錯誤處理

- 單一新聞來源失敗：回傳其他來源，標示 partial。
- Currents 未設定或失敗：只用官方 RSS。
- Google Trends 失敗：使用靜態 last-good 快照並標示 stale。
- Worker 無法使用：前端讀取 GitHub Pages 上次成功快照。
- 所有資料皆不可用：顯示錯誤與最後成功時間，不產生假資料。
- schema 主版本不支援：前端顯示明確錯誤，不猜測欄位。
- 搜尋結果為零：顯示「目前來源與時間範圍內沒有結果」，不得改以不相關內容填充。
- UI 明示資料範圍只涵蓋已啟用來源及 7 天 metadata archive，不代表全網完整新聞量。

## 13. 測試與驗收

### 13.1 自動測試

- Worker：query 驗證、CORS、來源白名單、快取、timeout、429、5xx、partial 與 secret 洩漏。
- Connector fixtures：正常、空 feed、壞 XML、缺欄位、重複、不同時區。
- Contract tests：Search、Trends、health 及既有公開 JSON。
- Heat property tests：0–100、決定性、缺來源時正確計算。
- 前端 unit tests：搜尋、零結果、partial、stale、Worker fallback、Trends 點擊帶入。
- Playwright：桌面與 360px，完成「點熱搜詞 → 搜尋 → 開啟原文」流程。
- Residue scan：`README.md`、`web/`、`src/`、`config/` 與公開 JSON 不得殘留已取消社群來源的名稱、網域、API method、真實 API key 或完整新聞本文。

### 13.2 Demo 驗收

- 以 5 個常見台灣關鍵字實測，每個 query 都能完成搜尋且不造成整頁失敗。
- 至少 3 個啟用來源能回傳有效且可開啟的原文連結。
- Google Trends TW RSS 可顯示；失敗注入後能改用 last-good 快照。
- Currents adapter 在未設定 key 時正常停用，不影響 RSS 搜尋。
- 所有新聞文章只顯示允許的 metadata、短摘要與原文連結。
- GitHub Pages 與 Worker 的正式 URL、部署方式及免費限制寫入 README。

## 14. 實作順序

1. 更新規格、交接文件與 README，移除所有舊社群需求。
2. 清理前端型別、來源登錄、範例 JSON 與 UI 文字中的舊社群來源。
3. 建立 Worker 專案、API 契約、CORS 與 health endpoint。
4. 以 fixture TDD 實作 RSS 聚合、搜尋、正規化、去重與錯誤隔離。
5. 實作 Google Trends RSS adapter 與 10 分鐘快取。
6. 實作搜尋頁、Trends 元件、動態分析與靜態 fallback。
7. 加入可選 Currents adapter；GDELT 僅做 feature-flag 實驗。
8. 執行完整測試、安全掃描、桌面／手機 E2E 與公開 demo 驗收。

## 15. 官方參考

- OpView 報告指標參考：<https://www.opview.com.tw/2024-mpr-rporting>
- GitHub Pages：<https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
- Cloudflare Workers pricing：<https://developers.cloudflare.com/workers/platform/pricing/>
- Cloudflare Workers limits：<https://developers.cloudflare.com/workers/platform/limits/>
- Cloudflare Cron Triggers：<https://developers.cloudflare.com/workers/configuration/cron-triggers/>
- Google Trends 熱搜說明：<https://support.google.com/trends/answer/3076011?hl=zh-TW>
- Google Trends 引用方式：<https://support.google.com/trends/answer/4365538?hl=zh-TW>
- Google Trends API Alpha：<https://developers.google.com/search/apis/trends>
- 中央社 RSS：<https://www.cna.com.tw/about/rss.aspx>
- 自由時報 RSS：<https://service.ltn.com.tw/RSS>
- ETtoday RSS：<https://www.ettoday.net/events/news-express/epaper.php>
- Currents API pricing：<https://currentsapi.services/en/product/price>
- GDELT DOC 2.0：<https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/>
