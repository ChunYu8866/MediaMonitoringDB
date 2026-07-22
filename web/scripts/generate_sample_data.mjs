/**
 * 產生符合「公開資料契約」的範例 JSON 到 public/data/。
 *
 * 這是 Phase 3（前端優先）用的示範資料，之後會由 Python 快/深/SEO 管線取代。
 * 一切時間以 UTC 儲存。執行：  npm run gen:data
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data');
mkdirSync(OUT, { recursive: true });

const SCHEMA = '2.0.0';
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// 可重現亂數（mulberry32）
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260721);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round = (n, d = 3) => Number(n.toFixed(d));

function envelope(data, ageMs = 2 * MIN) {
  return { schemaVersion: SCHEMA, generatedAt: iso(NOW - ageMs), data };
}
function write(name, data, ageMs) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(envelope(data, ageMs), null, 2), 'utf8');
  console.log(`  ✓ ${name}.json`);
}

// ── 新聞熱度公式 ──────────────────────────────────────────────────────────
const BASE_W = { volume: 0.5, acceleration: 0.33, diversity: 0.17 };
function computeHeat({ volume, acceleration, diversity }) {
  const heat = 100 * (BASE_W.volume * volume + BASE_W.acceleration * acceleration + BASE_W.diversity * diversity);
  return { heat: Math.max(0, Math.min(100, heat)), weights: BASE_W };
}

// ── 關鍵字 ───────────────────────────────────────────────────────────────
// 新聞來源：中央社、ETtoday、三立、鏡新聞、TVBS、自由時報
const NEWS_SOURCES = ['cna', 'ettoday', 'set', 'mirror', 'tvbs', 'ltn'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const KW_DEFS = [
  { term: '台積電', kind: 'manual', aliases: ['TSMC', '台積', '護國神山'], momentum: 'up' },
  { term: '立法院', kind: 'manual', aliases: ['立院'], momentum: 'flat' },
  { term: '颱風', kind: 'manual', aliases: ['熱帶低壓', '颱風假'], momentum: 'spike' },
  { term: '電價', kind: 'manual', aliases: ['電費', '調漲電價'], momentum: 'up' },
  { term: '高鐵', kind: 'manual', aliases: ['台灣高鐵'], momentum: 'flat' },
  { term: '流感疫苗', kind: 'auto', momentum: 'up' },
  { term: '台幣匯率', kind: 'auto', momentum: 'down' },
  { term: '大谷翔平', kind: 'auto', momentum: 'spike' },
  { term: '國道壅塞', kind: 'auto', momentum: 'flat' },
  { term: '觀光補助', kind: 'auto', momentum: 'up' },
  { term: '停電', kind: 'auto', momentum: 'down' },
  { term: '房價', kind: 'auto', momentum: 'up' },
  { term: '缺蛋', kind: 'auto', momentum: 'down' },
  { term: '生成式 AI', kind: 'auto', momentum: 'up' },
];

function makeTrend(momentum, baseHeat, baseMentions) {
  // 48 個 5 分鐘 bucket（近 4 小時）
  const N = 48;
  const points = [];
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1); // 0..1，越接近 1 越新
    let factor;
    switch (momentum) {
      case 'up':
        factor = 0.45 + 0.75 * p;
        break;
      case 'down':
        factor = 1.15 - 0.6 * p;
        break;
      case 'spike':
        factor = 0.4 + 0.9 * Math.exp(-Math.pow((p - 0.82) / 0.14, 2));
        break;
      default:
        factor = 0.85 + 0.15 * Math.sin(p * 6);
    }
    const noise = 0.85 + rand() * 0.3;
    const heat = Math.max(1, Math.min(100, baseHeat * factor * noise));
    const mentions = Math.max(0, Math.round(baseMentions * factor * noise));
    points.push({
      t: iso(NOW - (N - 1 - i) * 5 * MIN),
      heat: round(heat, 1),
      mentions,
    });
  }
  return points;
}

function makeSourceShare() {
  // 每個關鍵字出現在 2–5 個新聞來源的隨機子集，較貼近真實分布
  const k = 2 + Math.floor(rand() * 4); // 2..5
  const srcs = shuffle(NEWS_SOURCES).slice(0, k);
  const raw = srcs.map(() => 0.2 + rand());
  const sum = raw.reduce((a, b) => a + b, 0);
  const share = {};
  srcs.forEach((s, i) => (share[s] = round(raw[i] / sum, 3)));
  return share;
}

const keywords = KW_DEFS.map((def, idx) => {
  const baseHeat = def.momentum === 'spike' ? 62 : def.kind === 'manual' ? 45 + rand() * 30 : 25 + rand() * 45;
  const baseMentions = Math.round(8 + rand() * (def.kind === 'manual' ? 60 : 40));
  const trend = makeTrend(def.momentum, baseHeat, baseMentions);
  const last = trend[trend.length - 1];
  const prev15 = trend.slice(-3).reduce((a, p) => a + p.mentions, 0);
  const before15 = trend.slice(-6, -3).reduce((a, p) => a + p.mentions, 0);
  const mentions60m = trend.slice(-12).reduce((a, p) => a + p.mentions, 0);

  const share = makeSourceShare();
  const nSrc = Object.keys(share).length;
  const volume = round(Math.min(1, Math.log1p(mentions60m) / Math.log1p(120)), 3);
  const accelRaw = Math.max(0, (prev15 + 1) / (before15 + 1) - 1);
  const acceleration = round(Math.min(1, accelRaw / 5), 3);
  // 來源多樣性：熵 / 最大熵
  const entropy = -Object.values(share).reduce((a, p) => a + (p > 0 ? p * Math.log(p) : 0), 0);
  const diversity = nSrc > 1 ? round(entropy / Math.log(nSrc), 3) : 0;
  const { heat, weights } = computeHeat({ volume, acceleration, diversity });

  return {
    id: `kw-${idx + 1}`,
    term: def.term,
    kind: def.kind,
    heat: round(heat, 1),
    mentions60m,
    components: {
      volume,
      acceleration,
      diversity,
      weights: {
        volume: round(weights.volume, 3),
        acceleration: round(weights.acceleration, 3),
        diversity: round(weights.diversity, 3),
      },
    },
    sourceShare: share,
    trend,
    ...(def.kind === 'manual' ? { aliases: def.aliases ?? [] } : {}),
  };
}).sort((a, b) => b.heat - a.heat);

write('keywords', { keywords });

// ── 來源健康（示範：ETtoday 因 429 標為 stale，展示韌性）────────────────────
const sources = [
  {
    id: 'cna',
    displayName: '中央通訊社',
    status: 'ok',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 2 * MIN),
    errorCode: null,
    stale: false,
    itemCount: 42,
    usageNote: '僅取官方 RSS 的標題、前言、發稿時間與原文連結；保留「中央通訊社」來源標示，不抓取正文全文。',
  },
  {
    id: 'ettoday',
    displayName: 'ETtoday 新聞雲',
    status: 'stale',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 41 * MIN),
    errorCode: 'HTTP_429',
    stale: true,
    itemCount: 0,
    usageNote: '使用官方 RSS；公開畫面只顯示標題、短前言、時間與原文連結，不重製全文或圖片。目前遭速率限制（429），沿用上次成功資料並標示過期。',
  },
  {
    id: 'set',
    displayName: '三立新聞網',
    status: 'ok',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 2 * MIN),
    errorCode: null,
    stale: false,
    itemCount: 38,
    usageNote: '使用官方 RSS；公開畫面只顯示標題、短前言、時間與原文連結，不重製全文或圖片。實際上線前需再確認 setn.com RSS 網址與著作權條款。',
  },
  {
    id: 'mirror',
    displayName: '鏡新聞',
    status: 'ok',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 2 * MIN),
    errorCode: null,
    stale: false,
    itemCount: 24,
    usageNote: '使用官方 RSS／feed；只呈現標題、短前言、時間與原文連結。實際上線前需確認 mnews.tw feed 與授權範圍。',
  },
  {
    id: 'tvbs',
    displayName: 'TVBS 新聞網',
    status: 'ok',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 3 * MIN),
    errorCode: null,
    stale: false,
    itemCount: 31,
    usageNote: '使用官方 RSS；只呈現標題、短前言、時間與原文連結，不重製全文。實際上線前需確認 news.tvbs.com.tw RSS 與著作權條款。',
  },
  {
    id: 'ltn',
    displayName: '自由時報',
    status: 'ok',
    lastAttemptAt: iso(NOW - 2 * MIN),
    lastSuccessAt: iso(NOW - 2 * MIN),
    errorCode: null,
    stale: false,
    itemCount: 45,
    usageNote: '使用官方 RSS（news.ltn.com.tw）；只呈現標題、短前言、時間與原文連結，不抓正文全文或圖片。實際上線前需確認各分類 feed 與合理使用條件。',
  },
  {
    id: 'currents',
    displayName: 'Currents API（選配）',
    status: 'disabled',
    lastAttemptAt: null,
    lastSuccessAt: null,
    errorCode: null,
    stale: false,
    itemCount: 0,
    usageNote: '未設定 API secret 時停用；不影響官方 RSS 搜尋。',
  },
  {
    id: 'gsc',
    displayName: 'Google Search Console',
    status: 'ok',
    lastAttemptAt: iso(NOW - 8 * HOUR),
    lastSuccessAt: iso(NOW - 8 * HOUR),
    errorCode: null,
    stale: false,
    itemCount: 20,
    usageNote: '只分析本站已驗證的 GitHub Pages property，每日同步一次。這是本站 SEO 成效，非全網熱搜；資料有延遲，不併入即時熱度。',
  },
];
write('sources', { sources });

// ── meta（因 ETtoday stale → 全域 partial）──────────────────────────────────
write('meta', {
  status: 'partial',
  lastFastAt: iso(NOW - 2 * MIN),
  lastDeepAt: iso(NOW - 12 * MIN),
  lastSeoAt: iso(NOW - 8 * HOUR),
  methodVersion: '2026.07-mvp',
  scheduleDaysUntilPause: 58,
  coverage: { fastBucketHours: 48, hourlyDays: 30, dailyDays: 365 },
  stateRestoreFailed: false,
});

// ── 事件與主題 ───────────────────────────────────────────────────────────
const topics = [
  {
    id: 't1',
    label: '半導體與台積電動向',
    terms: ['台積電', '半導體', '晶圓', '海外設廠', '護國神山'],
    size: 28,
    sentiment: { positive: 0.52, neutral: 0.33, negative: 0.15 },
    summarySentences: [
      { text: '台積電法說會釋出對先進製程需求的最新展望。', source: 'cna', url: 'https://www.cna.com.tw/news/afe/2026072100001.aspx' },
      { text: '分析師關注海外設廠進度與資本支出規劃。', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-1.htm' },
    ],
    articles: [
      { title: '台積電釋出先進製程需求展望', source: 'cna', url: 'https://www.cna.com.tw/news/afe/2026072100001.aspx', publishedAt: iso(NOW - 35 * MIN) },
      { title: '半導體族群帶動盤面焦點', source: 'tvbs', url: 'https://news.tvbs.com.tw/money/2400010', publishedAt: iso(NOW - 40 * MIN) },
      { title: '半導體供應鏈聚焦資本支出', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-1.htm', publishedAt: iso(NOW - 52 * MIN) },
      { title: '海外布局成為產業報導焦點', source: 'mirror', url: 'https://www.mnews.tw/story/20260721tech002', publishedAt: iso(NOW - 18 * MIN) },
    ],
  },
  {
    id: 't2',
    label: '颱風動態與防災準備',
    terms: ['颱風', '氣象署', '海警', '停班停課', '豪雨'],
    size: 34,
    sentiment: { positive: 0.12, neutral: 0.51, negative: 0.37 },
    summarySentences: [
      { text: '中央氣象署針對外海熱帶系統發布最新路徑預報。', source: 'cna', url: 'https://www.cna.com.tw/news/aloc/2026072100010.aspx' },
      { text: '地方政府評估是否宣布停班停課並提醒民眾防範豪雨。', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-2.htm' },
    ],
    articles: [
      { title: '氣象署更新颱風路徑預報', source: 'cna', url: 'https://www.cna.com.tw/news/aloc/2026072100010.aspx', publishedAt: iso(NOW - 12 * MIN) },
      { title: '停班停課標準懶人包', source: 'set', url: 'https://www.setn.com/News.aspx?NewsID=1500010', publishedAt: iso(NOW - 20 * MIN) },
      { title: '颱風動向牽動連假交通', source: 'ltn', url: 'https://news.ltn.com.tw/news/life/breakingnews/4700010', publishedAt: iso(NOW - 24 * MIN) },
      { title: '各縣市討論停班停課標準', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-2.htm', publishedAt: iso(NOW - 26 * MIN) },
      { title: '防颱準備與停班停課資訊整理', source: 'mirror', url: 'https://www.mnews.tw/story/20260721life002', publishedAt: iso(NOW - 8 * MIN) },
    ],
  },
  {
    id: 't3',
    label: '電價調整與能源討論',
    terms: ['電價', '台電', '能源', '調漲', '民生'],
    size: 21,
    sentiment: { positive: 0.14, neutral: 0.34, negative: 0.52 },
    summarySentences: [
      { text: '電價審議相關討論聚焦民生與產業用電負擔。', source: 'cna', url: 'https://www.cna.com.tw/news/afe/2026072100020.aspx' },
      { text: '外界關注調整幅度與台電財務狀況。', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-3.htm' },
    ],
    articles: [
      { title: '電價審議聚焦民生用電負擔', source: 'cna', url: 'https://www.cna.com.tw/news/afe/2026072100020.aspx', publishedAt: iso(NOW - 68 * MIN) },
      { title: '電價調整方向引發討論', source: 'ltn', url: 'https://news.ltn.com.tw/news/politics/breakingnews/4700020', publishedAt: iso(NOW - 80 * MIN) },
      { title: '能源政策專題報導', source: 'mirror', url: 'https://www.mnews.tw/story/20260721eco001', publishedAt: iso(NOW - 88 * MIN) },
      { title: '產業界關注電價調整幅度', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-3.htm', publishedAt: iso(NOW - 95 * MIN) },
    ],
  },
  {
    id: 't4',
    label: '立法院議程與預算審查',
    terms: ['立法院', '預算', '朝野', '委員會', '議程'],
    size: 19,
    sentiment: { positive: 0.2, neutral: 0.55, negative: 0.25 },
    summarySentences: [
      { text: '立法院委員會排定本會期重點預算審查議程。', source: 'cna', url: 'https://www.cna.com.tw/news/aipl/2026072100030.aspx' },
    ],
    articles: [
      { title: '委員會排定重點預算審查', source: 'cna', url: 'https://www.cna.com.tw/news/aipl/2026072100030.aspx', publishedAt: iso(NOW - 120 * MIN) },
      { title: '朝野協商聚焦議事效率', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-4.htm', publishedAt: iso(NOW - 140 * MIN) },
    ],
  },
  {
    id: 't5',
    label: '運動賽事話題',
    terms: ['大谷翔平', '棒球', '賽事', '球迷'],
    size: 24,
    sentiment: { positive: 0.71, neutral: 0.22, negative: 0.07 },
    summarySentences: [
      { text: '體育新聞整理本週重點賽事表現。', source: 'tvbs', url: 'https://news.tvbs.com.tw/sports/2400020' },
    ],
    articles: [
      { title: '本週賽事焦點整理', source: 'tvbs', url: 'https://news.tvbs.com.tw/sports/2400020', publishedAt: iso(NOW - 15 * MIN) },
      { title: '運動焦點：本週賽事回顧', source: 'ettoday', url: 'https://www.ettoday.net/news/20260721/sample-5.htm', publishedAt: iso(NOW - 44 * MIN) },
    ],
  },
];
write('topics', { stale: false, experimental: true, topics }, 12 * MIN);

// ── 人物／組織共現（範例名稱，非指涉真實個人）────────────────────────────
const nodes = [
  { id: 'n1', name: '台積電', type: 'ORG', mentions: 28 },
  { id: 'n2', name: '行政院', type: 'ORG', mentions: 22 },
  { id: 'n3', name: '立法院', type: 'ORG', mentions: 19 },
  { id: 'n4', name: '中央氣象署', type: 'ORG', mentions: 25 },
  { id: 'n5', name: '台灣電力公司', type: 'ORG', mentions: 17 },
  { id: 'n6', name: '交通部', type: 'ORG', mentions: 12 },
  { id: 'n7', name: '中央銀行', type: 'ORG', mentions: 10 },
  { id: 'n8', name: '衛福部', type: 'ORG', mentions: 14 },
  { id: 'n9', name: '（範例）產業分析師', type: 'PERSON', mentions: 9 },
  { id: 'n10', name: '（範例）氣象主播', type: 'PERSON', mentions: 7 },
  { id: 'n11', name: '（範例）某立法委員', type: 'PERSON', mentions: 11 },
  { id: 'n12', name: '（範例）能源學者', type: 'PERSON', mentions: 6 },
  { id: 'n13', name: '經濟部', type: 'ORG', mentions: 15 },
  { id: 'n14', name: '（範例）財經記者', type: 'PERSON', mentions: 8 },
];
const edges = [
  { source: 'n1', target: 'n9', weight: 7 },
  { source: 'n1', target: 'n13', weight: 9 },
  { source: 'n1', target: 'n14', weight: 5 },
  { source: 'n13', target: 'n2', weight: 6 },
  { source: 'n4', target: 'n10', weight: 6 },
  { source: 'n4', target: 'n6', weight: 5 },
  { source: 'n5', target: 'n13', weight: 8 },
  { source: 'n5', target: 'n12', weight: 5 },
  { source: 'n3', target: 'n11', weight: 8 },
  { source: 'n3', target: 'n2', weight: 7 },
  { source: 'n2', target: 'n8', weight: 4 },
  { source: 'n8', target: 'n11', weight: 3 },
  { source: 'n7', target: 'n13', weight: 4 },
  { source: 'n6', target: 'n11', weight: 3 },
  { source: 'n1', target: 'n7', weight: 3 },
  { source: 'n5', target: 'n11', weight: 4 },
];
write('entities', { stale: false, experimental: true, nodes, edges }, 12 * MIN);

// ── SEO（本站 Search Console，最新一日為 preliminary）──────────────────────
const daily = [];
for (let i = 27; i >= 0; i--) {
  const date = new Date(NOW - i * DAY).toISOString().slice(0, 10);
  const base = 60 + Math.round(rand() * 40) + (27 - i) * 2; // 緩升趨勢
  const impressions = base + Math.round(rand() * 30);
  const clicks = Math.round(impressions * (0.03 + rand() * 0.04));
  daily.push({
    date,
    clicks,
    impressions,
    ctr: round(clicks / impressions, 4),
    position: round(9 + rand() * 6, 1),
  });
}
const queries = [
  '台灣輿情分析', '關鍵字熱度', '即時新聞熱詞', '颱風 即時', '電價 查詢',
  '台積電 新聞', 'Google Trends 台灣', '輿情 儀表板', '新聞 情緒分析', '熱門主題 追蹤',
  '開源 輿情', 'GitHub Pages 資料', '中央社 RSS', '新聞 熱度', 'SEO 成效',
  '共現 網絡', '台灣 新聞 API',
];
const topQueries = queries
  .map((q) => {
    const impressions = 12 + Math.round(rand() * 240);
    const clicks = Math.round(impressions * (0.02 + rand() * 0.09));
    return {
      query: q,
      clicks,
      impressions,
      ctr: round(clicks / impressions, 4),
      position: round(3 + rand() * 22, 1),
    };
  })
  .filter((r) => r.impressions >= 10)
  .sort((a, b) => b.clicks - a.clicks)
  .slice(0, 20);

const totClicks = daily.reduce((a, d) => a + d.clicks, 0);
const totImpr = daily.reduce((a, d) => a + d.impressions, 0);
write(
  'seo',
  {
    connected: true,
    lastSyncAt: iso(NOW - 8 * HOUR),
    preliminary: true,
    siteUrl: 'https://chunyu8866.github.io/MediaMonitoringDB/',
    daily,
    topQueries,
    totals: {
      clicks: totClicks,
      impressions: totImpr,
      ctr: round(totClicks / totImpr, 4),
      position: round(daily.reduce((a, d) => a + d.position, 0) / daily.length, 1),
    },
  },
  8 * HOUR,
);

// ── 近期內容（僅短前言與原文連結）──────────────────────────────────────────
function srcUrl(source, path) {
  switch (source) {
    case 'cna':
      return `https://www.cna.com.tw/${path}`;
    case 'ettoday':
      return `https://www.ettoday.net/${path}`;
    case 'set':
      return `https://www.setn.com/${path}`;
    case 'mirror':
      return `https://www.mnews.tw/${path}`;
    case 'tvbs':
      return `https://news.tvbs.com.tw/${path}`;
    case 'ltn':
      return `https://news.ltn.com.tw/${path}`;
    default:
      throw new Error(`未知新聞來源：${source}`);
  }
}

const recentTemplates = [
  { source: 'cna', title: '氣象署更新颱風路徑與降雨預報', excerpt: '中央氣象署針對外海熱帶系統發布最新路徑，提醒沿海與山區注意豪雨。', path: 'news/aloc/2026072100010.aspx' },
  { source: 'ltn', title: '颱風動向牽動連假交通', excerpt: '報導整理各交通運輸單位的因應與班次調整資訊。', path: 'news/life/breakingnews/4700010' },
  { source: 'cna', title: '台積電釋出先進製程需求展望', excerpt: '公司於法說會說明先進製程接單與資本支出方向，市場關注海外布局。', path: 'news/afe/2026072100001.aspx' },
  { source: 'tvbs', title: '半導體族群帶動盤面焦點', excerpt: '節目與報導聚焦先進製程需求與供應鏈動態。', path: 'money/2400010' },
  { source: 'ettoday', title: '各縣市研議停班停課標準', excerpt: '地方政府依風雨預測評估是否放颱風假，呼籲民眾提前準備。', path: 'news/20260721/sample-2.htm' },
  { source: 'set', title: '停班停課標準懶人包', excerpt: '整理各地放假認定原則與查詢管道，方便民眾對照。', path: 'News.aspx?NewsID=1500010' },
  { source: 'mirror', title: '颱風假與防颱準備資訊', excerpt: '新聞整理本週天氣、交通影響與防颱準備清單。', path: 'story/20260721life002' },
  { source: 'cna', title: '電價審議聚焦民生用電', excerpt: '相關討論關注調整幅度對家庭與中小企業的影響。', path: 'news/afe/2026072100020.aspx' },
  { source: 'ltn', title: '電價調整方向引發討論', excerpt: '報導彙整各界對民生與產業用電負擔的看法。', path: 'news/politics/breakingnews/4700020' },
  { source: 'mirror', title: '能源政策專題報導', excerpt: '深度整理供電結構與電價機制的背景脈絡。', path: 'story/20260721eco001' },
  { source: 'ettoday', title: '產業界關注電價調整方向', excerpt: '製造業者評估用電成本變化，呼籲兼顧產業競爭力。', path: 'news/20260721/sample-3.htm' },
  { source: 'tvbs', title: '運動賽事焦點回顧', excerpt: '整理本週熱門賽事與球員表現。', path: 'sports/2400020' },
  { source: 'ettoday', title: '本週賽事精彩片段整理', excerpt: '運動新聞整理賽事表現與球員狀態。', path: 'news/20260721/sample-5.htm' },
  { source: 'cna', title: '立法院委員會排定預算審查議程', excerpt: '本會期重點預算進入委員會審查，朝野聚焦議事效率。', path: 'news/aipl/2026072100030.aspx' },
  { source: 'set', title: '國道連假交通疏導上路', excerpt: '整理高乘載與匝道管制時段，提醒用路人提早規劃。', path: 'News.aspx?NewsID=1500020' },
  { source: 'cna', title: '流感疫苗接種時程公布', excerpt: '報導整理疫苗接種時程與院所資訊。', path: 'news/ahel/2026072100051.aspx' },
  { source: 'ltn', title: '央行關注匯率與資金動向', excerpt: '報導聚焦匯率波動與國際資金流向。', path: 'news/business/breakingnews/4700030' },
  { source: 'tvbs', title: '觀光補助方案細節公布', excerpt: '說明適用範圍與申請方式，業者反應不一。', path: 'life/2400030' },
  { source: 'mirror', title: '生成式 AI 應用觀察', excerpt: '整理 AI 工具在工作與學習場景的實際案例。', path: 'story/20260721tech001' },
  { source: 'mirror', title: '生成式 AI 應用案例整理', excerpt: '新聞整理 AI 工具在工作與學習上的實際案例。', path: 'story/20260721tech002' },
  { source: 'cna', title: '衛福部提醒季節性流感防護', excerpt: '呼籲高風險族群留意症狀並儘早就醫。', path: 'news/ahel/2026072100050.aspx' },
  { source: 'set', title: '房市交易量最新統計', excerpt: '整理近期成交概況並分析區域差異。', path: 'News.aspx?NewsID=1500030' },
];
const items = recentTemplates.map((t, i) => {
  const url = srcUrl(t.source, t.path);
  return {
    id: `r-${i + 1}`,
    source: t.source,
    title: t.title,
    excerpt: t.excerpt,
    publishedAt: iso(NOW - (6 + i * 11 + Math.round(rand() * 9)) * MIN),
    url,
  };
});
write('recent', { items });

console.log('\n完成：已產生 7 個資料檔到 web/public/data/');
