# 台灣輿情分析與即時關鍵字熱度儀表板

一套聚焦台灣繁體中文的個人／研究型輿情分析 MVP。整合新聞 RSS、Bluesky 公開資料與網站 SEO 成效，計算關鍵字熱度、情緒、主題與人物／組織共現關係，並以純靜態網站部署到 GitHub Pages。

> **目前進度：Phase 3（前端優先）已完成。**
> 網站與 6 個分析頁面已可運行，資料為符合「公開資料契約」的**範例資料**。
> 之後將由 Python 快／深／SEO 管線產生真實資料取代（見下方 Roadmap）。

## 功能頁面

| 頁面 | 內容 |
|------|------|
| 總覽 | 熱門關鍵字、聲量、來源分布、資料新鮮度、近期內容 |
| 關鍵字熱度 | 人工監測詞與自動熱詞排行、時間趨勢、**熱度公式分解（可重算）** |
| 事件與主題 | 主題聚類、抽取式摘要（可追溯來源）、情緒分布 |
| 人物關係 | PERSON／ORG 共現網絡（明示「共現不代表關係」） |
| 網站 SEO | 本站 Search Console 曝光／點擊／CTR／排名（與即時熱度明確區隔） |
| 方法與狀態 | 來源健康、熱度方法、資料保留、研究限制與授權邊界 |

特色：色盲安全調色盤、淺／深色主題、支援 360px 手機寬度、載入中／空資料／過期（stale）／錯誤狀態、單一來源失敗不影響其他來源。

## 技術棧

前端 React 18 + TypeScript + Vite + ECharts；純靜態輸出，不需 API server（前端不直接呼叫任何需要憑證的 API）。

## 目錄結構

```text
.
├─ AI_HANDOFF.md                    # 交接文件（需求與已確認決策，勿自行變更）
├─ README.md
├─ .github/workflows/deploy-web.yml # GitHub Pages 部署
├─ docs/superpowers/specs/          # 完整設計規格
└─ web/                             # 前端
   ├─ src/
   │  ├─ api/         # 靜態 JSON 讀取與 schema 版本檢查
   │  ├─ components/  # 版面、圖表、UI 元件
   │  ├─ lib/         # 主題、格式化、來源、圖表設定
   │  ├─ pages/       # 6 個頁面
   │  └─ types/       # 公開資料契約型別
   ├─ public/data/    # 公開 JSON（meta/sources/keywords/topics/entities/seo/recent）
   └─ scripts/generate_sample_data.mjs  # 範例資料產生器（未來由 Python 管線取代）
```

## 本機開發

需要 Node.js 18+（開發時使用 20）。

```bash
cd web
npm install          # 安裝相依套件
npm run gen:data     # 產生範例資料到 public/data/
npm run dev          # 啟動開發伺服器 http://localhost:5173
```

其他指令：

```bash
npm run typecheck    # TypeScript 型別檢查
npm run build        # 型別檢查 + 建置到 web/dist
npm run preview      # 預覽建置結果
```

## 部署到 GitHub Pages

1. 將專案推送到 GitHub（公開 repository）。
2. 在 repo 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 推送到 `main`（或到 Actions 手動執行 **Deploy web to GitHub Pages**）即會建置並部署。
4. 站台網址為 `https://<你的帳號>.github.io/<repo>/`（Vite `base` 已設為相對路徑，專案站台可直接運作）。

> **排程提醒：** 公開 repo 若連續 60 天沒有活動，GitHub 會自動停用 scheduled workflow。請定期確認 Actions 排程仍啟用；「方法與狀態」頁也會顯示提醒。

## Google Search Console 設定

網站網址：`https://chunyu8866.github.io/MediaMonitoringDB/`

已內建：`web/public/robots.txt`、`web/public/sitemap.xml`（部署後可於 `/robots.txt`、`/sitemap.xml` 取得）。

### 步驟 A — 驗證網站並讓 Google 收錄（現在就能做，只有你能做）

1. 到 [Google Search Console](https://search.google.com/search-console) → 新增資源 → 選 **網址前置字元（URL prefix）**，輸入
   `https://chunyu8866.github.io/MediaMonitoringDB/`。
2. 驗證方式選 **HTML 檔案**：下載 Google 給的 `google<一串碼>.html`，放到 `web/public/`，commit 後 push（GitHub Actions 會自動部署），確認 `https://chunyu8866.github.io/MediaMonitoringDB/google<一串碼>.html` 打得開，再回 Search Console 按「驗證」。
   （或用 **HTML 標記** 方式：把 Google 給的 `<meta name="google-site-verification" ...>` 貼進 `web/index.html` 的 `<head>`。）
3. 驗證通過後，在 Search Console 的 **Sitemap** 提交：`sitemap.xml`。
4. 收錄與數據需要數天，之後就能在 Search Console 網站上直接看到本站的曝光、點擊、CTR 與排名。

> 到這一步，你已能在 **Search Console 官網**看到本站 SEO 成效。若還想把這些數字**拉進本儀表板的 SEO 頁**，才需要下面的 API 串接（屬 Phase 5，需先有 Python 資料管線）。

### 步驟 B — 把 SEO 數據拉進本儀表板（Phase 5，需後端管線，尚未實作）

1. 在 Google Cloud Console 建立 OAuth 用戶端，授權範圍只用 `webmasters.readonly`，取得 refresh token。
2. 在 **repo Settings → Secrets and variables → Actions** 設定：
   `GSC_CLIENT_ID`、`GSC_CLIENT_SECRET`、`GSC_REFRESH_TOKEN`、`GSC_SITE_URL`。
3. 之後由每日 SEO 管線查詢並寫入 `web/public/data/seo.json`；每日一次、遇 429／401 只停用 SEO 區塊，不影響其他資料與部署。

> Search Console 是**本站自己的**搜尋成效，不是全網熱搜或輿情來源；資料有延遲，不併入即時熱度公式。憑證只存在 Actions Secrets，**絕不**寫入 repo、log 或 Pages。目前 SEO 頁顯示的是範例資料。

## 資料來源與使用邊界

主流新聞（皆以官方 RSS／feed 為入口，只呈現標題、短前言、時間與原文連結，不重製全文或圖片）：

| 新聞來源 | Feed 入口（上線前需再確認網址與著作權條款） |
|------|------|
| 中央通訊社 | `cna.com.tw` 官方 RSS |
| ETtoday 新聞雲 | 官方 RSS（FeedBurner） |
| 三立新聞網 | `setn.com` 官方 RSS |
| 鏡新聞 | `mnews.tw` feed |
| TVBS 新聞網 | `news.tvbs.com.tw` 官方 RSS |
| 自由時報 | `news.ltn.com.tw` 官方 RSS |

其他來源：

| 來源 | 邊界 |
|------|------|
| Bluesky 公開 AppView | `app.bsky.feed.searchPosts`；`lang` 不等於地理位置，樣本不代表台灣人口 |
| Google Search Console | 只分析自有、已驗證的 GitHub Pages property |
| PTT／Dcard | **停用**：未取得書面授權或正式研究 API 前不爬取 |

> 目前為 Phase 3 範例資料；六家新聞的實際擷取會在 Phase 2 資料管線完成，且每家上線前都需確認官方 RSS 網址與著作權／合理使用條款。

分析結果為研究指標，不代表台灣整體民意，也不得將相關性描述成因果。「共現」不代表支持、反對或因果。

## 公開資料契約

`web/public/data/*.json` 頂層固定為 `{ schemaVersion, generatedAt, data }`；前端遇到不支援的主版本會顯示明確錯誤，不靜默猜測欄位。詳見 [型別定義](web/src/types/contracts.ts) 與 [完整設計規格](docs/superpowers/specs/2026-07-21-taiwan-public-opinion-mvp-design.md)。

## Roadmap（依 AI_HANDOFF.md）

- [x] **Phase 3（本次）**：前端 6 頁儀表板、資料契約型別、範例資料、Pages 部署工作流程、RWD 與狀態處理。
- [ ] **Phase 1**：Python／Vite 專案骨架、JSON Schema、fixture 與 contract tests。
- [ ] **Phase 2**：CNA／ETtoday／Bluesky connectors、正規化、去重、retention、熱度公式。
- [ ] **Phase 4**：深度 NLP（情緒、BERTopic 主題、MMR 抽取摘要、NER 共現）。
- [ ] **Phase 5**：Search Console 驗證與每日同步。
- [ ] **Phase 6**：整合、故障注入、E2E、安全掃描與排程觀察。

> 實作真實資料管線時採 TDD、逐階段驗收，且**不得**提交模型權重、來源全文或任何 secret。
