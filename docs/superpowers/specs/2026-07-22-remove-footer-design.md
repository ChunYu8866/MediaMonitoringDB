# 移除網站頁尾設計規格

> 日期：2026-07-22  
> 狀態：使用者已選擇方案 A

## 目標

完整移除每個頁面最下方的網站頁尾，包括品牌說明、GitHub／網站連結與免責文字。主導覽、頁面內容、資料狀態與搜尋功能維持不變。

## 實作範圍

- 刪除 `web/src/components/Layout.tsx` 的 `Footer` 元件。
- 刪除 `Layout` 內的 `<Footer />` 呼叫。
- 刪除 `web/src/index.css` 中只供頁尾使用的 `.footer*` 樣式。
- 不以 CSS 隱藏，不保留不可到達的頁尾程式碼。

## 驗收條件

- 所有路由最下方不再顯示截圖中的頁尾區塊。
- `rg "Footer|footer__" web/src` 無殘留。
- 前端測試、型別檢查與正式建置通過。
- GitHub Pages 重新部署成功且公開首頁 HTTP 200。

## 非本次範圍

- 不修改頂部 GitHub 按鈕、側邊導覽或行動版導覽。
- 不變更新聞、Google Trends、SEO 或 Cloudflare Worker 資料契約。

