# 台灣輿情分析與關鍵字熱度 MVP 設計規格

**日期：** 2026-07-21  
**狀態：** 已核准  
**定位：** 個人／研究型、零付費核心、公開 GitHub Pages

## 1. 目標

建立一套聚焦台灣繁體中文的公開研究型系統，整合新聞 RSS、公開社群資料及網站 SEO 成效，提供：

- 使用者自訂監測詞與系統自動熱門詞。
- 五分鐘一次的輕量更新嘗試；不承諾五分鐘內完成公開部署。
- 聲量、熱度、情緒、來源占比、主題聚類、事件摘要。
- 人物／組織辨識及共現關係。
- GitHub Pages 本站的 Google 搜尋曝光、點擊、CTR 與平均排名。
- 每項分析均可回到來源連結、更新時間與方法說明。

## 2. 硬性限制

- 核心系統不得依賴付費服務或永久免費性無法確認的 AI API。
- GitHub Pages 僅作靜態展示；所有蒐集、分析與建置在 GitHub Actions 執行。
- GitHub Actions 排程與 Pages 發布均採 best effort，不宣稱即時 SLA。
- 公開 repository、Pages artifact 與 workflow log 不得包含 token、cookie、OAuth 憑證或私人原始資料。
- 只處理各來源允許取得及呈現的欄位，不重製新聞全文或大量社群原文。
- 分析結果是研究指標，不代表台灣整體民意，也不得將相關性描述成因果。

## 3. 已核准範圍

### 3.1 第一版包含

1. 中央社 RSS。
2. ETtoday 官方 RSS：即時、政治、財經、社會等分類可設定啟用。
3. Bluesky 公開 AppView API 關鍵字搜尋。
4. 手動監測詞與自動熱門詞。
5. 五分鐘快速管線、三十分鐘深度管線、每日 SEO 管線。
6. GitHub Pages 響應式儀表板。
7. Google Search Console Search Analytics。

### 3.2 第一版不包含

- 未經授權的 PTT 或 Dcard 自動蒐集。
- 付費新聞資料庫、付費 AI API、商業 SaaS、多租戶、計費與帳號系統。
- 秒級串流、嚴格五分鐘 SLA、跨平台完整傳播路徑。
- 立場判定、敵友關係、因果推論或自動事實判定。
- 生成式摘要作為預設功能；第一版使用可追溯的抽取式摘要。

PTT 僅預留 `SourceConnector` 介面。取得站方書面授權或可供研究使用的官方 API 前，實作必須保持停用。

## 4. 資料來源與使用邊界

### 4.1 中央社

- 以官方 RSS 為唯一入口。
- 僅保存及呈現官方規範允許的標題、前言、文章 URL、首圖 URL、發稿時間與來源標示。
- 保留「中央通訊社」及原始連結，不抓取正文頁全文。

### 4.2 ETtoday

- 使用官方 RSS 訂閱頁所列 FeedBurner feeds。
- 公開畫面只呈現 RSS 提供的標題、必要短前言、來源、發布時間及原始連結。
- 不抓取正文頁、不快取全文、不重新散布圖片；使用範圍以當期著作權聲明及個人非商業合理使用條件為準。

### 4.3 Bluesky

- 使用 `app.bsky.feed.searchPosts` 公開讀取端點；第一版不需要 API key。
- 依查詢詞、時間與語言取得貼文，並在本地補做繁體字及台灣相關性篩選。
- 不把 `lang` 當作可靠地理位置；Bluesky 樣本不得宣稱代表台灣人口。
- 公開站只呈現分析必要短文、作者 handle、互動彙總、貼文 URI 與原始連結。

### 4.4 Google Search Console

- 只分析本專案部署後的 GitHub Pages property。
- 它是本站 SEO 回饋來源，不是全網熱搜或輿情資料來源。
- 部署後以 HTML 驗證檔完成 URL-prefix property 驗證；`sitemap.xml` 透過 Search Console UI 提交。
- API 僅使用 `webmasters.readonly` OAuth scope。

## 5. 系統架構

採一個排程協調器、三條邏輯管線及一次原子部署，避免不同 workflow 同時改寫 Pages。

```text
中央社 RSS ─┐
ETtoday RSS ├─> Connector -> 正規化 -> 去重 -> 快速分析 ─┐
Bluesky API ┘                                             │
                                                         ├─> 公開安全快照 -> Vite build -> GitHub Pages
快速分析輸出 ─> 深度 NLP（到期或熱度暴增時）──────────────┤
Search Console（每日）─────────────────────────────────────┘
```

### 5.1 排程協調器

- GitHub Actions cron 設為每五分鐘嘗試一次，另支援 `workflow_dispatch`。
- 同一 concurrency group 設 `cancel-in-progress: false`，最多保留一個執行中及最新的一個等待中 run，避免部署互相覆寫。
- 每次 run 先讀取目前 Pages 上的公開安全快照；不存在時由空狀態啟動。
- 快速管線每次執行。
- `lastDeepAt` 超過三十分鐘，或關鍵字在十五分鐘內增加至少 25 個熱度點且涉及至少五筆獨立內容時，執行深度管線。
- `lastSeoAt` 超過二十四小時且 OAuth secrets 完整時，執行 SEO 管線。
- 所有成功結果合併後只部署一次。任何管線失敗時保留上一版可用資料。

### 5.2 公開狀態保存

- runner 中的來源原文只存在於該次工作目錄，工作完成即捨棄。
- Pages 保存最近四十八小時的五分鐘 bucket、最近三十天的小時聚合、最近一年的每日聚合，以及最近七十二小時的去重識別碼。
- 去重識別碼使用來源 item ID、canonical URL 或內容雜湊，不保存新聞全文。
- 快照以部署 artifact 覆寫，不用機器人 commit 每次資料更新，避免污染 Git 歷史。

## 6. 快速管線

### 6.1 處理順序

1. 並行抓取已啟用 connector。
2. 驗證 HTTP 狀態、內容類型與必要欄位。
3. 統一時區為 UTC 儲存，介面顯示 Asia/Taipei。
4. 保留原文，另產生搜尋用的 OpenCC `s2twp` 正規化文字。
5. 以來源 ID、canonical URL、標題與時間雜湊去重。
6. 套用手動監測規則並抽取自動候選詞。
7. 更新五分鐘 bucket、熱度分數、來源健康狀態及公開快照。

### 6.2 手動監測詞

每個 watch term 包含：

- 顯示名稱。
- 別名與常見縮寫。
- 必須包含、任一包含及排除詞。
- 啟用來源。
- 生效日期與設定版本。

手動詞即使沒有聲量仍顯示零值，確保研究時間序列完整。

### 6.3 自動熱門詞

- 從斷詞、人物、組織及名詞片語產生候選。
- 移除停用詞、網址、純數字、廣告詞及重複字形變體。
- 候選至少出現在兩筆獨立內容；跨兩個來源時提高來源多樣性分量。
- 同義詞只在可人工核對的 alias 表中合併，不使用不可解釋的自動改名。

## 7. 熱度公式

每個關鍵字每五分鐘計算一次 0–100 分：

```text
Heat = 100 × (0.45V + 0.30A + 0.15D + 0.10E)
```

- `V` 聲量：最近六十分鐘提及數取 `log1p`，再對同批關鍵字做百分位正規化。
- `A` 加速度：`max(0, (最近15分鐘+1)/(前15分鐘+1)-1)`，以五倍成長作上限後正規化至 0–1。
- `D` 來源多樣性：來源分布熵除以可用來源數的最大熵；只有一個來源時為 0。
- `E` 互動：只使用來源確實提供的互動數，先在各來源內正規化再合併。

若某來源沒有互動欄位，`E` 不得當成零分；其權重按比例分配回 `V`、`A`、`D`。所有中間分量與權重均寫入快照，確保分數可重算及可解釋。

## 8. 深度分析管線

### 8.1 情緒分析

- 分為正向、中立、負向三類並保留置信度。
- 初始基線使用可離線執行、允許公開研究專案使用的多語 DistilBERT 情緒模型。
- 未通過台灣繁中人工標註集門檻前，介面標示「實驗性模型」，不得描述成客觀真值。

### 8.2 主題與事件

- 使用多語句向量、時間窗及 BERTopic 類聚類方法。
- 事件必須同時考慮語意距離與發布時間，避免把長期同主題內容錯合成單一事件。
- 摘要採群中心句加 MMR 去重；每一句必須是來源內容的直接抽取並附來源連結。

### 8.3 人物／組織關係

- 透過繁中 NER adapter 擷取 `PERSON` 與 `ORG` 精確 span。
- 同一句或同一短段共同出現才建立 edge，權重為獨立文件數。
- 圖表明示「共現不代表支持、敵對或因果」。
- 模型權重不納入 repository；CI 依上游授權下載及快取。公開發布前必須保留第三方授權清單。

## 9. Search Console SEO 管線

### 9.1 指標

- Clicks、Impressions、CTR、Average position。
- 維度：query、page、date；country 與 device 使用個別彙總查詢，避免高負載組合查詢。
- 公開頁只顯示至少十次曝光的前二十個 query，其餘合併為「其他」。

### 9.2 頻率與配額

- 每日執行一次，只查上一個尚未同步的日期；預估每日 5–8 個 API calls。
- 不在每五分鐘管線呼叫 Search Console，也不重抓數月歷史。
- 429 或 quota exceeded 時停止本輪並保留舊資料，下次日排程再試。
- Google 未公布 load quota 的確切數字，因此 dashboard 必須呈現最後成功同步時間。
- 最新的 incomplete 資料必須標示 preliminary；SEO 指標不得加入即時熱度公式。

### 9.3 憑證

以下值只存於 GitHub Actions Secrets：

- `GSC_CLIENT_ID`
- `GSC_CLIENT_SECRET`
- `GSC_REFRESH_TOKEN`
- `GSC_SITE_URL`

OAuth 未設定或 401 時，只停用 SEO 模組；新聞與社群管線照常執行。

## 10. 公開資料契約

Pages 至少提供以下 JSON：

```text
data/meta.json        版本、產生時間、資料範圍、方法版本
data/sources.json     各來源最後成功時間、延遲、錯誤與 stale 狀態
data/keywords.json    手動詞、自動詞、bucket、熱度與各分量
data/topics.json      主題、抽取式摘要、情緒分布、來源連結
data/entities.json    人物、組織及共現 edge
data/seo.json         本站 SEO 日資料與前二十個搜尋詞
data/recent.json      允許公開的近期標題、短前言與來源 URL
```

每個檔案包含 `schemaVersion`。前端遇到不支援的版本時顯示明確錯誤，不靜默猜測欄位。

## 11. 儀表板

採 React、TypeScript、Vite 與 ECharts，輸出純靜態檔案。頁面包含：

1. **總覽：** 熱門關鍵字、聲量、情緒、資料新鮮度。
2. **關鍵字：** 手動監測清單、自動熱門排行、時間趨勢與公式分解。
3. **事件：** 主題群、抽取式摘要、熱門內容及原文追溯。
4. **關係：** 人物／組織共現網絡與來源文件。
5. **SEO：** 本站曝光、點擊、CTR、排名及其與外部熱度的延遲相關圖。
6. **方法與狀態：** 資料來源、授權邊界、模型版本、最後更新、錯誤與樣本限制。

所有主要畫面需支援 360px 手機寬度及桌面瀏覽器。前端不得直接呼叫需要憑證的 API。

## 12. 錯誤處理

- timeout、5xx 與可重試錯誤最多重試三次，採 2、8、32 秒指數退避加 jitter。
- 429 優先遵守 `Retry-After`；若超過該次 workflow 時間預算則停止該來源。
- schema 變更只隔離對應 connector，其他來源仍產出結果。
- NLP 失敗時發布基本聲量與熱度，並標示深度分析 stale。
- SEO 失敗只影響 SEO 頁籤。
- Pages build 或 deploy 失敗時保留上次成功站點；GitHub Actions run 顯示失敗。
- 每筆來源狀態包含 `lastAttemptAt`、`lastSuccessAt`、`status`、`errorCode`，不得公開敏感錯誤本文。

## 13. 測試與驗收

### 13.1 自動測試

- Connector fixture tests：正常、空 feed、缺欄位、重複、壞 XML／JSON、timeout、429、5xx。
- Schema contract tests：所有公開 JSON 通過固定 schema。
- Heat property tests：分數位於 0–100、相同輸入同分、缺少互動時正確重加權。
- Pipeline integration tests：任一來源或 NLP／SEO 失敗時仍產出有效基本快照。
- Frontend unit tests：載入、空狀態、stale、錯誤狀態及圖表資料轉換。
- Playwright E2E：桌面與 360px 手機寬度，檢查導覽、篩選、原文連結與最後更新時間。
- Security tests：repository、Pages artifact 與 workflow log 不含測試 token、cookie 或 OAuth secret 樣式。

### 13.2 品質基準

- 建立至少 150 筆分層人工標註資料：中央社、ETtoday、Bluesky 各 50 筆。
- 情緒 macro-F1 達 0.70 才可移除「實驗性」標示。
- PERSON／ORG exact-span F1 達 0.70 才預設顯示關係圖。
- 抽取式摘要每一句均須是來源文字的精確子字串，支持率要求 100%。
- 固定 fixture 資料集的快速管線應在四分鐘內完成。
- 相同固定輸入重跑兩次，聚合 JSON 在排除產生時間後必須完全一致。

## 14. 分階段交付

1. **基礎：** repository、資料 schema、設定、測試框架及單一部署 workflow。
2. **快速分析：** 中央社、ETtoday、Bluesky connectors、去重、手動詞、自動詞、熱度公式。
3. **公開儀表板：** 總覽、關鍵字、來源狀態、方法頁及 GitHub Pages 部署。
4. **深度分析：** 情緒、主題、抽取式摘要、人物／組織共現與品質評估。
5. **SEO：** Pages 驗證、Search Console OAuth、每日同步與 SEO 頁籤。
6. **最終驗收：** 故障注入、手機／桌面 E2E、安全掃描、七日排程觀察與研究限制揭露。

## 15. 成功條件

- 公開 GitHub Pages 可開啟，桌面與手機皆可使用。
- 至少兩個新聞 RSS 與一個社群來源能產出統一資料。
- 手動與自動關鍵字均有可重算的熱度時間序列。
- 任一來源失敗不會造成全站無資料。
- 所有圖表顯示資料時間與來源狀態。
- 情緒、主題、摘要與共現關係均能追溯到來源。
- Search Console 設定完成後能每日產出本站 SEO 指標；新站尚無資料時呈現正常空狀態。
- repository 與 Pages 不包含任何 secret 或未授權全文。

## 16. 已確認的外部依據

- GitHub Pages：<https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
- GitHub Actions schedule：<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- 中央社 RSS：<https://www.cna.com.tw/about/rss.aspx>
- ETtoday RSS：<https://www.ettoday.net/events/news-express/epaper.php>
- ETtoday 著作權聲明：<https://member.ettoday.net/clause_copyright.php7>
- Bluesky API directory：<https://docs.bsky.app/docs/advanced-guides/api-directory>
- Bluesky rate limits：<https://docs.bsky.app/docs/advanced-guides/rate-limits>
- PTT AntiBot 公告：<https://www.ptt.cc/bbs/PttAntiBot/M.1308411811.A.567.html>
- Search Console API：<https://developers.google.com/webmaster-tools?hl=zh-tw>
- Search Analytics query：<https://developers.google.com/webmaster-tools/v1/searchanalytics/query>
- Search Console 授權：<https://developers.google.com/webmaster-tools/v1/how-tos/authorizing?hl=zh-tw>
- Search Console 定價：<https://developers.google.com/webmaster-tools/pricing?hl=zh-tw>
- Search Console 限制：<https://developers.google.com/webmaster-tools/limits?hl=zh-tw>
- Search Console 資料說明：<https://support.google.com/webmasters/answer/96568?hl=zh-tw>
