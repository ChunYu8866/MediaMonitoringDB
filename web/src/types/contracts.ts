/**
 * 公開資料契約型別（對應設計規格第 8/10 節）。
 *
 * 所有 web/public/data/*.json 頂層結構固定為：
 *   { schemaVersion, generatedAt, data }
 * 前端遇到不支援的 schemaVersion 時顯示明確錯誤，不靜默猜測欄位。
 */

/** 目前前端支援的主版本；major 不同即視為不相容。 */
export const SUPPORTED_SCHEMA_MAJOR = 2;

/** 所有公開 JSON 的共同外殼。 */
export interface Envelope<T> {
  /** 語意化版本，例如 "1.0.0"。 */
  schemaVersion: string;
  /** 該檔案產生時間（ISO 8601、UTC）。 */
  generatedAt: string;
  data: T;
}

/**
 * 來源代碼。
 * 新聞：使用者指定的 22 家台灣新聞媒體。
 * SEO：Google Search Console，僅供獨立 SEO 頁使用。
 */
export type SourceId =
  | 'tvbs'
  | 'ebc'
  | 'setn'
  | 'ftv'
  | 'cti'
  | 'era'
  | 'nexttv'
  | 'pts'
  | 'udn'
  | 'ltn'
  | 'cna'
  | 'moneyudn'
  | 'ctee'
  | 'anue'
  | 'wealth'
  | 'businessweekly'
  | 'thenewslens'
  | 'reporter'
  | 'newtalk'
  | 'nownews'
  | 'nextapple'
  | 'ettoday'
  | 'gsc';

export type SourceStatus = 'ok' | 'stale' | 'degraded' | 'disabled' | 'error';

/** 全域資料新鮮度狀態。 */
export type GlobalStatus = 'ok' | 'partial' | 'stale' | 'error';

// ── meta.json ───────────────────────────────────────────────────────────────

export interface Meta {
  /** 系統整體狀態。 */
  status: GlobalStatus;
  /** 快管線最後一次成功完成時間（UTC ISO）。 */
  lastFastAt: string | null;
  /** 深度 NLP 管線最後成功時間。 */
  lastDeepAt: string | null;
  /** SEO 管線最後成功時間。 */
  lastSeoAt: string | null;
  /** 方法版本，用於前端顯示「方法說明」。 */
  methodVersion: string;
  /**
   * 排程健康提醒：公開 repo 若連續 60 天無活動，GitHub 會停用排程。
   * 這裡標示距離自動停用的估計剩餘天數（僅供提醒，非保證）。
   */
  scheduleDaysUntilPause: number | null;
  /** 資料涵蓋範圍說明。 */
  coverage: {
    /** 5 分鐘 bucket 保留時數。 */
    fastBucketHours: number;
    /** 小時彙總保留天數。 */
    hourlyDays: number;
    /** 每日彙總保留天數。 */
    dailyDays: number;
  };
  /** 若無法還原上一版快照為 true，代表歷史資料可能不完整。 */
  stateRestoreFailed: boolean;
}

// ── sources.json ──────────────────────────────────────────────────────────────

export interface SourceHealth {
  id: SourceId;
  /** 顯示名稱，例如「中央通訊社」。 */
  displayName: string;
  status: SourceStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  /** 官網低頻擷取最後執行時間。 */
  lastCrawlAt?: string | null;
  /** 此快照實際使用的取得方式。 */
  accessMode?: 'official-rss' | 'google-news' | 'site-listing';
  /** 標準化錯誤代碼，例如 "HTTP_429"、"TIMEOUT"；正常時為 null。 */
  errorCode: string | null;
  /** 是否已超過新鮮度門檻。 */
  stale: boolean;
  /** 最近一次成功取得的項目數。 */
  itemCount: number;
  /** 使用邊界說明（授權、可呈現欄位）。 */
  usageNote: string;
}

export interface SourcesData {
  sources: SourceHealth[];
}

// ── keywords.json ─────────────────────────────────────────────────────────────

/** 單一時間點的熱度取樣。 */
export interface HeatPoint {
  /** bucket 起始時間（UTC ISO）。 */
  t: string;
  /** 該 bucket 熱度 0–100。 */
  heat: number;
  /** 該 bucket 提及數。 */
  mentions: number;
}

/** 新聞熱度三個分量（0–1）。 */
export interface HeatComponents {
  /** V 聲量百分位。 */
  volume: number;
  /** A 加速度。 */
  acceleration: number;
  /** D 來源多樣性。 */
  diversity: number;
  /** 固定新聞熱度權重。 */
  weights: { volume: number; acceleration: number; diversity: number };
}

export type KeywordKind = 'manual' | 'auto';

export interface Keyword {
  id: string;
  /** 顯示詞。 */
  term: string;
  kind: KeywordKind;
  /** 目前熱度 0–100。 */
  heat: number;
  /** 最近 60 分鐘提及數。 */
  mentions60m: number;
  /** 熱度公式分解。 */
  components: HeatComponents;
  /** 各來源提及占比（0–1，加總約為 1）。 */
  sourceShare: Partial<Record<SourceId, number>>;
  /** 最近一段時間的熱度趨勢（5 分鐘 bucket）。 */
  trend: HeatPoint[];
  /** 手動詞的別名（僅 manual）。 */
  aliases?: string[];
}

export interface KeywordsData {
  keywords: Keyword[];
}

// ── topics.json ───────────────────────────────────────────────────────────────

export interface TopicArticle {
  title: string;
  source: SourceId;
  url: string;
  publishedAt: string;
}

export interface Topic {
  id: string;
  label: string;
  /** 代表詞。 */
  terms: string[];
  /** 涉及內容數。 */
  size: number;
  /** 抽取式摘要句（每句均為來源原文子字串）。 */
  summarySentences: { text: string; source: SourceId; url: string }[];
  /** 情緒分布（正/中/負，加總為 1）。 */
  sentiment: { positive: number; neutral: number; negative: number };
  /** 代表文章。 */
  articles: TopicArticle[];
}

export interface TopicsData {
  /** 深度分析是否為過期資料。 */
  stale: boolean;
  /** 模型是否仍為實驗性（未達 F1 門檻）。 */
  experimental: boolean;
  topics: Topic[];
}

// ── entities.json ─────────────────────────────────────────────────────────────

export type EntityType = 'PERSON' | 'ORG';

export interface EntityNode {
  id: string;
  name: string;
  type: EntityType;
  /** 出現的獨立文件數。 */
  mentions: number;
}

export interface EntityEdge {
  source: string;
  target: string;
  /** 共現的獨立文件數（邊權重）。 */
  weight: number;
}

export interface EntitiesData {
  stale: boolean;
  experimental: boolean;
  nodes: EntityNode[];
  edges: EntityEdge[];
}

// ── seo.json ──────────────────────────────────────────────────────────────────

export interface SeoDailyPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoData {
  /** 是否已完成 Search Console 驗證與串接。 */
  connected: boolean;
  /** 最近一次成功同步時間。 */
  lastSyncAt: string | null;
  /** 最新資料是否為初步（尚未定案）。 */
  preliminary: boolean;
  /** 站台 URL。 */
  siteUrl: string | null;
  daily: SeoDailyPoint[];
  topQueries: SeoQueryRow[];
  totals: { clicks: number; impressions: number; ctr: number; position: number };
}

// ── recent.json ───────────────────────────────────────────────────────────────

export interface RecentItem {
  id: string;
  source: SourceId;
  title: string;
  /** 短前言／摘要；不得為受保護全文。 */
  excerpt: string;
  publishedAt: string;
  url: string;
}

export interface RecentData {
  items: RecentItem[];
}

// ── Worker 即時新聞搜尋 ─────────────────────────────────────────────────────

export type SearchRange = '1h' | '6h' | '24h' | '7d';

export interface SearchArticle extends RecentItem {
  /** 標題與短摘要的實驗性字典判讀；未判讀時為 null。 */
  sentiment: 'positive' | 'neutral' | 'negative' | null;
}

export interface SearchSourceStatus {
  id: Exclude<SourceId, 'gsc'>;
  displayName: string;
  status: Extract<SourceStatus, 'ok' | 'stale' | 'degraded' | 'error' | 'disabled'>;
  itemCount: number;
  errorCode: string | null;
}

export interface SearchMetrics {
  heat: number;
  mentions: number;
  sourceCount: number;
  volume: number;
  acceleration: number;
  diversity: number;
}

export interface SearchTimelinePoint {
  t: string;
  mentions: number;
  heat: number;
}

export interface SearchData {
  query: string;
  range: SearchRange;
  status: GlobalStatus;
  stale: boolean;
  metrics: SearchMetrics;
  timeline: SearchTimelinePoint[];
  sourceCounts: Partial<Record<Exclude<SourceId, 'gsc'>, number>>;
  sources: SearchSourceStatus[];
  items: SearchArticle[];
}

export interface NewsArchiveData {
  status: GlobalStatus;
  stale: boolean;
  items: SearchArticle[];
}

export interface TrendNewsItem {
  title: string;
  source: string;
  url: string;
}

export interface TrendItem {
  title: string;
  approximateTraffic: string;
  publishedAt: string;
  news: TrendNewsItem[];
}

export interface TrendsData {
  geo: 'TW';
  status: GlobalStatus;
  stale: boolean;
  source: 'google-trends-rss';
  sourceUrl: string;
  items: TrendItem[];
}
