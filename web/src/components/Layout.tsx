import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { DATA_REFRESH_EVENT, useData } from '../api/useData';
import { requestManualRefresh } from '../api/client';
import type { Meta } from '../types/contracts';
import { GLOBAL_STATUS_LABEL } from '../lib/sources';
import { fmtRelative } from '../lib/format';
import { useTheme } from '../lib/theme';
import { Badge } from './ui';

export const BRAND = '媒體輿情監測';
export const REPO_URL = 'https://github.com/ChunYu8866/MediaMonitoringDB';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: '新聞搜尋', icon: '🔎', end: true },
  { to: '/analysis', label: '進階分析', icon: '⚖️' },
  { to: '/recent', label: '近期新聞', icon: '📰' },
  { to: '/overview', label: '資料總覽', icon: '📊' },
  { to: '/keywords', label: '關鍵字熱度', icon: '🔥' },
  { to: '/topics', label: '事件與主題', icon: '🗂️' },
  { to: '/entities', label: '組織共現', icon: '🕸️' },
  { to: '/method', label: '方法與狀態', icon: '🧭' },
];

function ThemeToggle() {
  const { pref, cycle } = useTheme();
  const icon = pref === 'system' ? '🌗' : pref === 'light' ? '☀️' : '🌙';
  const label = pref === 'system' ? '跟隨系統' : pref === 'light' ? '淺色' : '深色';
  return (
    <button className="iconbtn" onClick={cycle} title={`主題：${label}（點擊切換）`} aria-label="切換主題">
      {icon}
    </button>
  );
}

function GlobalStatus() {
  const { data } = useData<Meta>('meta');
  if (!data) return null;
  const s = GLOBAL_STATUS_LABEL[data.status];
  return (
    <div className="appbar__status">
      <Badge variant={s.variant as never} dot>
        {s.label}
      </Badge>
      <span className="hide-sm">更新 {fmtRelative(data.lastFastAt)}</span>
    </div>
  );
}

function ManualRefreshButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await requestManualRefresh();
      setMessage('已送出更新，資料會在背景同步');
      window.setTimeout(() => window.dispatchEvent(new Event(DATA_REFRESH_EVENT)), 5_000);
    } catch (error) {
      setMessage((error as Error).message || '更新失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="appbar__refresh">
      <button
        className="refresh-btn"
        type="button"
        onClick={refresh}
        disabled={busy}
        aria-label="手動更新 Cloudflare 快照與 GitHub Pages"
        title="手動更新 Cloudflare 快照與 GitHub Pages"
      >
        <span aria-hidden="true">↻</span>
        {busy ? '更新中…' : '立即更新'}
      </button>
      {message && <span className="refresh-status" role="status">{message}</span>}
    </div>
  );
}

export function Layout() {
  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar__brand">
          <span className="appbar__logo">監</span>
          <span>{BRAND}</span>
        </div>
        <div className="appbar__spacer" />
        <GlobalStatus />
        <ManualRefreshButton />
        <a
          className="iconbtn appbar__repo"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          title="在 GitHub 開啟原始碼"
          aria-label="GitHub 原始碼"
        >
          {'\u{1F4C1}'}
        </a>
        <ThemeToggle />
      </header>

      {/* 手機版：可橫向捲動的分頁列 */}
      <nav className="mobile-nav" aria-label="主導覽（行動版）">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `mobile-nav__link${isActive ? ' active' : ''}`}
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="layout">
        <aside className="sidebar">
          <nav className="nav" aria-label="主導覽">
            <div className="nav__group-label">分析面板</div>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}
              >
                <span className="nav__ico">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
