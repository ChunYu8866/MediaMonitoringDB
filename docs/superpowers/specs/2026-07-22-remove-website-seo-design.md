# 移除「網站 SEO」與補齊 Google Trends 內容設計

## 目標

從台灣新聞輿情 Demo 完整移除「網站 SEO」與 Google Search Console 相關界面；同時讓 Google Trends 熱門字點入後有搜尋量資訊與可點擊的相關新聞，不再只顯示 22 家媒體的空結果。

## 修改範圍

1. 移除側邊欄與手機導覽的「網站 SEO」項目。
2. 移除 `/seo` React 路由與 `SeoPage` 元件。
3. 移除 SEO 專用 TypeScript 資料型別與組件依賴。
4. 刪除 `web/public/data/seo.json`，不再將 SEO 範例資料發布到 GitHub Pages。
5. 移除 README、AI 交接文件與 UI 中的 Search Console／SEO 功能說明。
6. `meta.json` 不再公開 `lastSeoAt`；Python 快照管線與 TypeScript 契約同步移除該欄位。

## Google Trends 整合

1. 首頁繼續顯示台灣 Google Trends 熱門字。
2. 點擊熱門字後，分析區顯示該詞的約略搜尋量、熱門發布時間與 Google Trends 資料來源。
3. 同區顯示 Google Trends RSS 提供的相關新聞，保留出版者名稱、標題與原文 URL。
4. Trends 相關新聞可來自 22 家白名單以外的媒體，但必須標示為「Google Trends 相關新聞」。
5. Trends 相關新聞不併入 22 家媒體的新聞熱度、來源數與加速度，避免混淆「Google 搜尋熱度」與「媒體新聞聲量」。
6. RSS 沒有提供歷史搜尋曲線，網站不伪造曲線；只顯示 Google 實際提供的欄位。
7. Trends 資料暫時失敗時沿用 last-good 快照並標示 `stale`，不產生假搜尋量或假新聞。

## 保留範圍

- 保留現有側邊欄、手機導覽與其他頁面。
- 保留並擴充 Google Trends TW；它屬於 Google 搜尋熱度，不是網站 SEO。
- 不改動 Cloudflare Worker 新聞搜尋 API。

## 驗收標準

- 桌面與手機導覽均不存在「網站 SEO」。
- `/#/seo` 不再顯示 SEO 頁面。
- 公開建置不包含 `data/seo.json`。
- 生產碼、README 與 AI 交接文件不再宣稱 Search Console 功能。
- 每個可見的 Trends 熱門字都能在點入後看到該筆 Trends 資訊；若 RSS 有相關新聞，同時顯示可開啟的新聞連結。
- Trends 相關新聞清楚標示出版者，且不併入 22 家新聞指標。
- 沒有 Trends 相關新聞時顯示真實空狀態，不伪造內容。
- Python、Worker、前端測試、型別檢查與正式建置通過。
- GitHub Pages 部署後實際檢查導覽與公開檔案。
