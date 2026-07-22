# Remove Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完整移除所有頁面最下方的頁尾區塊並重新部署 GitHub Pages。

**Architecture:** `Layout` 是所有路由共用外框，因此刪除 `Footer` 元件及 `<Footer />` 呼叫即可一次影響所有頁面。同步刪除專用 CSS，避免留下不可到達程式碼；不修改主導覽、資料來源或 API。

**Tech Stack:** React 18、TypeScript、Vite 8、GitHub Actions、GitHub Pages

## Global Constraints

- 完整刪除頁尾，不以 CSS 隱藏。
- 不修改頂部 GitHub 按鈕、側邊導覽、行動版導覽或資料契約。
- 完成後必須通過前端測試、型別檢查、正式建置與公開 Pages HTTP 驗證。

---

### Task 1: 移除 Footer 元件與樣式

**Files:**
- Modify: `web/src/components/Layout.tsx:56-82,142`
- Modify: `web/src/index.css:663-699`
- Test: `web/src/components/Layout.tsx` residue scan

**Interfaces:**
- Consumes: `Layout` 內既有 `<Outlet />` 路由內容。
- Produces: 不再渲染頁尾的共用頁面外框。

- [x] **Step 1: 建立失敗的殘留檢查**

Run:

```powershell
rg -n "function Footer|<Footer|footer__" web/src/components/Layout.tsx web/src/index.css
```

Expected: FAIL condition；目前會列出 `Footer` 元件、呼叫與 `.footer__*` 樣式。

- [x] **Step 2: 刪除 Footer 實作**

從 `web/src/components/Layout.tsx` 完整刪除：

```tsx
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__row">
        <div>
          <div className="footer__brand">
            <span className="appbar__logo" style={{ width: 24, height: 24, fontSize: 13 }}>監</span>
            {BRAND_FULL}
          </div>
          <p className="footer__desc">
            個人／研究型 MVP。整合中央社、ETtoday、鏡傳媒、TVBS、自由時報等新聞 RSS，
            提供關鍵字搜尋、新聞熱度與台灣 Google Trends RSS 摘要。
          </p>
        </div>
        <nav className="footer__links" aria-label="外部連結">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener">GitHub 原始碼 ↗</a>
          <a href={SITE_URL} target="_blank" rel="noreferrer noopener">網站首頁 ↗</a>
        </nav>
      </div>
      <p className="footer__note">
        指標僅供研究參考，不代表台灣整體民意；「共現」不代表支持、反對或因果。更新採 best effort，不宣稱固定間隔 SLA。
        請以頁面標示的資料時間、來源狀態與 stale 提示判讀。
      </p>
    </footer>
  );
}
```

並將：

```tsx
<main className="content">
  <Outlet />
  <Footer />
</main>
```

改成：

```tsx
<main className="content">
  <Outlet />
</main>
```

- [x] **Step 3: 刪除專用 CSS**

從 `web/src/index.css` 刪除 `.footer`、`.footer__row`、`.footer__brand`、`.footer__desc`、`.footer__links`、`.footer__note` 的完整規則區塊。

- [x] **Step 4: 驗證殘留已清除**

Run:

```powershell
$matches = rg -n "function Footer|<Footer|footer__" web/src/components/Layout.tsx web/src/index.css
if ($matches) { Write-Output $matches; exit 1 }
```

Expected: PASS，沒有輸出。

- [x] **Step 5: 執行前端驗證**

Run:

```powershell
Set-Location web
npm test
npm run typecheck
npm run build
```

Expected: 8 個前端測試通過、TypeScript 無錯誤、Vite build 成功。

- [ ] **Step 6: 提交並部署**

Run:

```powershell
git add web/src/components/Layout.tsx web/src/index.css docs/superpowers/plans/2026-07-22-remove-footer.md
git commit -m "fix: remove site footer"
git push origin main
```

Expected: push 成功並觸發 `Update news snapshot and deploy Pages`。

- [ ] **Step 7: 驗證公開部署**

Run:

```powershell
gh run watch --exit-status
Invoke-WebRequest -Uri "https://chunyu8866.github.io/MediaMonitoringDB/" -UseBasicParsing
```

Expected: Actions conclusion 為 `success`、首頁 HTTP 200。
