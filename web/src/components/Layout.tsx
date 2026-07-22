import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../api/useData';
import type { Meta } from '../types/contracts';
import { GLOBAL_STATUS_LABEL } from '../lib/sources';
import { fmtRelative } from '../lib/format';
import { useTheme } from '../lib/theme';
import { Badge } from './ui';

export const BRAND = '媒體輿情監測';
export const BRAND_FULL = '台灣媒體輿情監測';
export const REPO_URL = 'https://github.com/ChunYu8866/MediaMonitoringDB';
export const SITE_URL = 'https://chunyu8866.github.io/MediaMonitoringDB/';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: '新聞搜尋', icon: '🔎', end: true },
  { to: '/overview', label: '資料總覽', icon: '📊' },
  { to: '/keywords', label: '關鍵字熱度', icon: '🔥' },
  { to: '/topics', label: '事件與主題', icon: '🗂️' },
  { to: '/entities', label: '人物關係', icon: '🕸️' },
  { to: '/seo', label: '網站 SEO', icon: '🔍' },
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

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__row">
        <div>
          <div className="footer__brand">
            <span className="appbar__logo" style={{ width: 24, height: 24, fontSize: 13 }}>
              監
            </span>
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
          <Footer />
        </main>
      </div>
    </div>
  );
}
