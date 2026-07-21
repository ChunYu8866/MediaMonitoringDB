# 台灣輿情分析與即時關鍵字熱度系統：AI 交接文件

> 更新日期：2026-07-21  
> 專案狀態：設計完成、尚未開始實作  
> 工作目錄：`C:\Users\LIN CHUN YU\Documents\程式碼\08_輿論分析系統`

## 1. 交接目標

建立一套可免費公開部署於 GitHub Pages 的台灣繁體中文輿情分析 MVP。系統以 GitHub Actions 定期擷取公開資料、計算關鍵字熱度並產生靜態 JSON，再由 React 儀表板呈現。

本文件是下一個 AI 的主要入口。完整產品設計另見：

- `docs/superpowers/specs/2026-07-21-taiwan-public-opinion-mvp-design.md`

## 2. 已確認、不得自行變更的決策

- 使用情境：個人／研究型 MVP。
- 語言與市場：台灣繁體中文。
- 成本：只採免費方案；不得加入必須付費的 API 或常駐主機。
- 原始碼：預計公開上傳 GitHub。
- 前端：GitHub Pages 靜態網站。
- 更新：GitHub Actions 每 5 分鐘觸發一次，但只能標示為 **best effort**，不可宣稱 5 分鐘 SLA。
- 維運：公開 repository 若連續 60 天沒有活動，GitHub 會自動停用 scheduled workflow；README 與狀態頁必須提醒使用者定期確認排程是否仍啟用。
- 關鍵字：同時支援人工監測詞與系統自動熱詞。
- 分析：情緒、主題、摘要，以及人物／組織共現關係圖。
- AI：免費、離線優先的混合式 NLP；不得依賴不保證長期免費的雲端推論服務。
- SEO：串接本 GitHub Pages 網站的 Google Search Console；SEO 資料每日更新，不納入 5 分鐘輿情熱度。
- PTT：目前停用。未取得書面授權或正式 API 前，不得爬取。

## 3. 資料來源與使用邊界

### 啟用來源

1. 中央社官方 RSS：只保存及公開必要欄位，保留來源與原文連結。
2. ETtoday 官方 RSS：公開頁面只顯示來源、標題、短摘要、時間與原文連結；不得重製全文或圖片。
3. Bluesky 公開 AppView API：使用 `app.bsky.feed.searchPosts`，需處理 429、逾時與回傳不完整。
4. Google Search Console Search Analytics API：只查詢使用者已驗證、自己控制的 GitHub Pages property。

### 停用來源

- PTT、Dcard：未確認可用的正式研究 API 或授權。
- YouTube 全站關鍵字搜尋：免費預設配額不適合每 5 分鐘輪詢。
- 任何需要付費、信用卡或不保證持續免費的新聞／社群 API。

### 重要事實

- Search Console 不是全網即時熱門關鍵字 API，只能分析自有網站的搜尋成效。
- Search Console 資料通常具有延遲；不得與即時輿情曲線混在同一指標中。
- Search Analytics 已公開 QPM／QPD 限制：每個網站與每位使用者皆為每分鐘 1,200 次查詢；每個專案為每日 30,000,000 次、每分鐘 40,000 次查詢。另有未公開固定數值的 load quota，因此無法把所有限制換算成單一固定呼叫次數：`【資料不足,無法確認】`。

## 4. 目標架構

```text
CNA RSS ───────┐
ETtoday RSS ───┼─> connectors -> normalize -> dedupe -> keyword/heat -> public JSON
Bluesky API ───┘                                      │
                                                      ├─> deep NLP
Search Console API ───────────────────────────────────┤   (較低頻率)
                                                      v
                                            Vite build + Pages deploy
```

採單一 GitHub Actions orchestrator、三條邏輯管線，最後只做一次原子部署：

- 快速管線：每次 workflow 執行；擷取、正規化、去重、關鍵字統計、熱度計算。
- 深度管線：`lastDeepAt` 超過 30 分鐘，或任一關鍵字在 15 分鐘內增加至少 25 個熱度點且涉及至少 5 筆獨立內容時執行；產出情緒、主題、摘要、實體與關係圖。
- SEO 管線：依 `lastSeoAt` 每日執行；失敗不得阻塞輿情資料發布。

Actions concurrency 使用同一 group，`cancel-in-progress: false`，避免執行中的資料遭取消；同時只允許一個執行中與最新一個等待中的工作。

### 跨次執行的狀態保存

- 每次 workflow 開始時，先從目前 GitHub Pages 的 `data/*.json` 讀取上一版公開安全快照；網站尚未建立或快照不存在時，才從空狀態啟動。
- 快照保存最近 48 小時的 5 分鐘 bucket、30 天的小時彙總、1 年的每日彙總，以及 72 小時的去重識別碼。
- 去重識別碼只能使用來源 item ID、canonical URL 或內容雜湊；不得把新聞全文、社群貼文全文或秘密寫入公開快照。
- 每次成功執行以單一 Pages artifact 原子覆寫快照，不為每次資料更新建立機器人 commit。
- 若無法取得上一版快照，來源狀態必須標示 `stateRestoreFailed`，不得把空白歷史資料誤報成正常更新。

## 5. 熱度定義

每個關鍵字的熱度範圍固定為 0–100：

```text
Heat = 100 × (0.45V + 0.30A + 0.15D + 0.10E)
```

- `V`：最近 60 分鐘數量經 `log1p` 後，在當期關鍵字中的百分位。
- `A`：最近 15 分鐘相對前 15 分鐘的正向成長率，最高以 5 倍成長封頂。
- `D`：來源分布熵正規化；跨來源出現的詞分數較高。
- `E`：各來源可取得的互動數正規化。
- 若來源沒有互動數，移除 `E` 並按比例重分配 `V/A/D` 權重，不得把缺值當成 0。

資料保留：

- 5 分鐘 bucket：48 小時。
- 小時彙總：30 天。
- 每日彙總：1 年。
- 去重識別碼：72 小時。

## 6. 建議技術棧

- 前端：React、TypeScript、Vite、ECharts。
- 擷取與分析：Python 3.11+。
- Python 測試：pytest、Hypothesis。
- 前端測試：Vitest、Testing Library、Playwright。
- 文字正規化：OpenCC `s2twp`，並保留原文。
- 情緒基線：免費多語 DistilBERT；台灣語料準確度必須以標註集驗證。
- 主題：multilingual MiniLM embeddings + BERTopic。
- 摘要：抽取式 MMR，避免生成式幻覺。
- 關係圖：NER 後以同篇共現建立 NetworkX 邊；只能稱「共現」，不可推論支持、反對或因果。

模型權重不得提交到 repository。CKIP 相關套件／模型若採用，必須先再次確認 GPL-3.0 與模型授權是否符合公開專案需求。

## 7. 預定檔案結構

```text
.
├─ AI_HANDOFF.md
├─ pyproject.toml
├─ .github/workflows/update-and-deploy.yml
├─ config/
│  ├─ sources.yml
│  └─ watch_terms.yml
├─ src/opinion_pipeline/
│  ├─ models.py
│  ├─ connectors/{base,cna,ettoday,bluesky,gsc}.py
│  ├─ pipeline/{normalize,dedupe,keywords,heat,retention}.py
│  ├─ nlp/{sentiment,topics,summary,entities}.py
│  ├─ storage/{state,public_json}.py
│  └─ cli.py
├─ tests/{connectors,pipeline,nlp,integration,fixtures}/
├─ web/
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ src/{api,components,pages,types}/
│  ├─ tests/
│  └─ public/data/
│     ├─ meta.json
│     ├─ sources.json
│     ├─ keywords.json
│     ├─ topics.json
│     ├─ entities.json
│     ├─ seo.json
│     └─ recent.json
└─ docs/superpowers/
   ├─ specs/
   └─ plans/
```

每個模組只負責一件事。Connector 統一輸出 `NormalizedItem`，後續演算法不得直接依賴來源原始格式。

## 8. 公開資料契約

所有 `web/public/data/*.json` 頂層必須包含：

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-07-21T00:00:00Z",
  "data": {}
}
```

必要檔案：

- `meta.json`：整體更新時間、版本、全域狀態。
- `sources.json`：各來源 `lastAttemptAt`、`lastSuccessAt`、`status`、`errorCode`、stale 狀態。
- `keywords.json`：人工詞、自動熱詞、heat、各時間 bucket 與來源分布。
- `topics.json`：主題、代表詞、代表文章及摘要。
- `entities.json`：PERSON／ORG 節點及共現邊。
- `seo.json`：clicks、impressions、CTR、average position 與 query/page/date 維度結果。
- `recent.json`：來源、標題、短摘要、時間、canonical URL；不得包含受保護全文。

## 9. 實作順序

執行前先閱讀 `brainstorming`、`writing-plans`、`test-driven-development`；實作時選擇 `subagent-driven-development` 或 `executing-plans`，不得跳過測試。

### Phase 1：專案骨架與契約

- 初始化 Git repository、Python 與 Vite 專案。
- 定義 `NormalizedItem`、狀態模型與 JSON Schema。
- 建立 fixture 和 contract tests，再寫最小實作。
- 建立不含真實 secrets 的 `.env.example` 與 GitHub Actions workflow 骨架。

驗收：測試可在乾淨環境執行，所有公開 JSON 通過 schema 驗證。

### Phase 2：資料擷取與快管線

- 依序實作 CNA RSS、ETtoday RSS、Bluesky connector。
- 完成 UTC 時間正規化、OpenCC 正規化、canonical URL、去重與 retention。
- 完成人工監測詞、自動候選詞與熱度公式。
- 每個 connector 使用 fixture 覆蓋正常、空資料、格式錯誤、逾時、429、5xx。

驗收：單一來源失敗仍會發布其他來源資料，失敗來源標示 stale。

### Phase 3：儀表板與 Pages

- 實作總覽、即時熱詞、主題、關係圖、SEO、資料狀態六個頁面。
- 支援 360px 手機寬度、載入中、空資料、stale 與錯誤狀態。
- workflow 將 JSON 寫入 `web/public/data/`、建置 Vite，並以單一 artifact 部署 Pages。

驗收：Playwright 桌面與 360px 測試通過；公開頁面不需要 API server。

### Phase 4：深度 NLP

- 加入三分類情緒、BERTopic、MMR 抽取摘要、PERSON／ORG 共現圖。
- 模型不可下載進 git；workflow 需使用快取並具備失敗降級。
- 深度管線失敗時保留上次成功結果並標示 stale，快管線繼續發布。

驗收：在至少 150 筆人工標註台灣繁中資料上，情緒 macro-F1 與 PERSON／ORG exact-span F1 目標皆為 0.70；未達標時只能標示 baseline，不可宣稱準確。

### Phase 5：Search Console

- 驗證 GitHub Pages URL-prefix property，提交 `sitemap.xml`。
- 以 GitHub Actions Secrets 設定 `GSC_CLIENT_ID`、`GSC_CLIENT_SECRET`、`GSC_REFRESH_TOKEN`、`GSC_SITE_URL`。
- 每日增量查詢約 5–8 次；429 時停止當次 SEO 管線並保留舊資料。
- 公開頁只顯示至少 10 次曝光的前 20 個 query，其餘合併為「其他」；country 與 device 必須分開彙總，避免組合成高負載查詢。
- 401 時只停用 SEO 區塊，不得影響輿情管線與部署。

驗收：`seo.json` 可顯示新鮮度與 preliminary 狀態；前端明確區隔 SEO 與即時熱度。

### Phase 6：整合與安全檢查

- 跑完整 unit、contract、property、integration 與 E2E 測試。
- 掃描 repository、workflow log 與 Pages artifact，確認沒有 token、cookie、OAuth secret 或完整來源內文。
- 實際觀察多次 Actions 排程與失敗恢復；文件明確說明排程延遲風險。

驗收：乾淨 clone 可重現測試與 build；手動 `workflow_dispatch` 可發布 Pages。

## 10. 錯誤處理規則

- HTTP timeout、5xx 與其他可重試錯誤：最多重試 3 次，依序等待 2、8、32 秒並加入 jitter；429 優先遵守 `Retry-After`，若等待時間超過該次 workflow 的時間預算則停止該來源。
- XML／JSON schema 錯誤：隔離該 connector，不得使整批資料失敗。
- NLP 失敗：沿用上次成功的深度分析並標 stale。
- SEO 失敗：沿用舊 SEO 資料；不得阻塞 Pages deploy。
- 部署失敗：保留上一版 Pages，不把半成品覆蓋上線。
- 不得把秘密、完整 OAuth 回應或完整識別碼寫入 log。

## 11. 完成定義

- GitHub Pages 可公開開啟，桌面與手機版均可使用。
- CNA、ETtoday、Bluesky 各取 50 筆人工抽樣，共 150 筆；欄位映射與原文連結必須 150/150 全部通過。
- 熱度永遠落在 0–100，來源缺少 engagement 時權重重分配正確。
- 個別來源、NLP 或 SEO 故障不會阻止其餘新鮮資料發布。
- UI 清楚顯示資料更新時間、stale、來源限制與「共現不代表關係」。
- SEO 與即時輿情使用不同資料卡與時間說明。
- repository、Actions log、Pages artifact 不含任何 secret。
- README 包含本機開發、測試、部署、Search Console 設定及來源使用限制。

## 12. 下一個 AI 的第一個回合

1. 讀完本文件與完整設計規格。
2. 檢查工作目錄與 Git 狀態；目前尚未建立 Git repository。
3. 先產生正式的逐步實作計畫至 `docs/superpowers/plans/2026-07-21-opinion-analysis-mvp.md`。
4. 向使用者確認採用「subagent-driven」或「inline execution」後才開始實作。
5. 實作必須從 Phase 1 開始，以 TDD、短提交及每階段驗收方式進行。

可直接貼給下一個 AI 的提示詞：

```text
請先完整閱讀工作區根目錄 AI_HANDOFF.md，以及其中連結的設計規格。不要重新發散需求，也不要更改已確認決策。先依 writing-plans 產生可逐項執行的實作計畫，檢查規格覆蓋、型別一致性與無 placeholder，再向我提出執行方式選擇。實作時採 TDD，逐階段驗證，不得提交模型權重、來源全文或任何 secret。
```

## 13. 官方參考來源

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Actions 排程事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [中央社 RSS](https://www.cna.com.tw/about/rss.aspx)
- [ETtoday RSS](https://www.ettoday.net/events/news-express/epaper.php)
- [ETtoday 著作權聲明](https://member.ettoday.net/clause_copyright.php7)
- [Bluesky API Directory](https://docs.bsky.app/docs/advanced-guides/api-directory)
- [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits)
- [PTT AntiBot 規範](https://www.ptt.cc/bbs/PttAntiBot/M.1308411811.A.567.html)
- [Search Console API](https://developers.google.com/webmaster-tools?hl=zh-tw)
- [Search Analytics Query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Console OAuth](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing?hl=zh-tw)
- [Search Console 定價](https://developers.google.com/webmaster-tools/pricing?hl=zh-tw)
- [Search Console 使用限制](https://developers.google.com/webmaster-tools/limits?hl=zh-tw)
- [Search Console 資料延遲](https://support.google.com/webmasters/answer/96568?hl=zh-tw)
