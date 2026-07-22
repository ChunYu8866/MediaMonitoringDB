# 移除「網站 SEO」功能設計

## 目標

從台灣新聞輿情 Demo 完整移除「網站 SEO」欄位與 Google Search Console 相關界面，讓產品只保留新聞搜尋、關鍵字熱度、主題、人物關係與方法狀態。

## 修改範圍

1. 移除側邊欄與手機導覽的「網站 SEO」項目。
2. 移除 `/seo` React 路由與 `SeoPage` 元件。
3. 移除 SEO 專用 TypeScript 資料型別與組件依賴。
4. 刪除 `web/public/data/seo.json`，不再將 SEO 範例資料發布到 GitHub Pages。
5. 移除 README、AI 交接文件與 UI 中的 Search Console／SEO 功能說明。
6. `meta.json` 不再公開 `lastSeoAt`；Python 快照管線與 TypeScript 契約同步移除該欄位。

## 保留範圍

- 保留現有側邊欄、手機導覽與其他頁面。
- 保留 Google Trends TW；它屬於新聞熱門搜尋，不是網站 SEO。
- 不改動 Cloudflare Worker 新聞搜尋 API。

## 驗收標準

- 桌面與手機導覽均不存在「網站 SEO」。
- `/#/seo` 不再顯示 SEO 頁面。
- 公開建置不包含 `data/seo.json`。
- 生產碼、README 與 AI 交接文件不再宣稱 Search Console 功能。
- Python、Worker、前端測試、型別檢查與正式建置通過。
- GitHub Pages 部署後實際檢查導覽與公開檔案。
