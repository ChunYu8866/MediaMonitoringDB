import type {
  Envelope,
  NewsArchiveData,
  SearchArticle,
  SearchData,
  SearchMetrics,
  SearchRange,
  TrendsData,
} from '../types/contracts';
import { SUPPORTED_SCHEMA_MAJOR } from '../types/contracts';
import { fetchData } from './client';

export interface HeatInput {
  volume: number;
  acceleration: number;
  diversity: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 新聞熱度：聲量 50%、加速度 33%、來源多樣性 17%。 */
export function calculateNewsHeat(input: HeatInput): number {
  return Math.round(
    100 *
      (0.5 * clamp01(input.volume) +
        0.33 * clamp01(input.acceleration) +
        0.17 * clamp01(input.diversity)),
  );
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schemaVersion === 'string' &&
    typeof candidate.generatedAt === 'string' &&
    candidate.data !== null &&
    typeof candidate.data === 'object'
  );
}

export function parseSearchResponse(value: unknown): Envelope<SearchData> {
  if (!isEnvelope(value)) throw new Error('搜尋資料格式不相容');
  if (Number.parseInt(value.schemaVersion.split('.')[0] ?? '', 10) !== SUPPORTED_SCHEMA_MAJOR) {
    throw new Error('搜尋資料格式不相容');
  }
  const data = value.data as Partial<SearchData>;
  if (
    typeof data.query !== 'string' ||
    typeof data.range !== 'string' ||
    !['ok', 'partial', 'stale', 'error'].includes(String(data.status)) ||
    typeof data.stale !== 'boolean' ||
    !data.metrics ||
    !Array.isArray(data.timeline) ||
    !Array.isArray(data.sources) ||
    !Array.isArray(data.items)
  ) {
    throw new Error('搜尋資料格式不相容');
  }
  return value as Envelope<SearchData>;
}

export function parseTrendsResponse(value: unknown): Envelope<TrendsData> {
  if (!isEnvelope(value)) throw new Error('趨勢資料格式不相容');
  if (Number.parseInt(value.schemaVersion.split('.')[0] ?? '', 10) !== SUPPORTED_SCHEMA_MAJOR) {
    throw new Error('趨勢資料格式不相容');
  }
  const data = value.data as Partial<TrendsData>;
  if (data.geo !== 'TW' || data.source !== 'google-trends-rss' || !Array.isArray(data.items)) {
    throw new Error('趨勢資料格式不相容');
  }
  return value as Envelope<TrendsData>;
}

const RANGE_MS: Record<SearchRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const SOURCE_NAMES: Record<string, string> = {
  tvbs: 'TVBS',
  ebc: '東森新聞',
  setn: '三立新聞',
  ftv: '民視新聞',
  cti: '中天新聞',
  era: '年代新聞',
  nexttv: '壹電視',
  pts: '公視新聞',
  udn: 'UDN',
  ltn: '自由時報',
  cna: '中央社',
  moneyudn: '經濟日報',
  ctee: '工商時報',
  anue: '鉅亨網',
  wealth: '財訊',
  businessweekly: '商業週刊',
  thenewslens: '關鍵評論網',
  reporter: '報導者',
  newtalk: '新頭殼',
  nownews: 'NOWNEWS',
  nextapple: '壹蘋新聞網',
  ettoday: 'ETtoday',
};

export function buildStaticSearchData(
  allItems: SearchArticle[],
  query: string,
  range: SearchRange,
  now = Date.now(),
): SearchData {
  const needle = query.trim().toLocaleLowerCase('zh-TW');
  const cutoff = now - RANGE_MS[range];
  const items = allItems
    .filter((item) => Date.parse(item.publishedAt) >= cutoff)
    .filter((item) => `${item.title} ${item.excerpt}`.toLocaleLowerCase('zh-TW').includes(needle))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 100);
  const sourceCounts = Object.fromEntries(
    [...new Set(items.map((item) => item.source))].map((source) => [
      source,
      items.filter((item) => item.source === source).length,
    ]),
  );
  const sourceCount = Object.keys(sourceCounts).length;
  const midpoint = now - RANGE_MS[range] / 2;
  const recent = items.filter((item) => Date.parse(item.publishedAt) >= midpoint).length;
  const previous = items.length - recent;
  const input = {
    volume: clamp01(items.length / 22),
    acceleration: items.length === 0
      ? 0
      : clamp01(0.5 + (recent - previous) / (2 * Math.max(1, recent, previous))),
    diversity: clamp01(sourceCount / 22),
  };
  const bucketCount = range === '1h' ? 6 : range === '6h' ? 12 : range === '24h' ? 24 : 28;
  const bucketMs = RANGE_MS[range] / bucketCount;
  const timeline = Array.from({ length: bucketCount }, (_, index) => {
    const start = now - RANGE_MS[range] + index * bucketMs;
    const end = start + bucketMs;
    const mentions = items.filter((item) => {
      const timestamp = Date.parse(item.publishedAt);
      return timestamp >= start && timestamp < end;
    }).length;
    return { t: new Date(start).toISOString(), mentions, heat: Math.min(100, mentions * 20) };
  });
  return {
    query: query.trim(),
    range,
    status: 'stale',
    stale: true,
    metrics: { ...input, heat: calculateNewsHeat(input), mentions: items.length, sourceCount },
    timeline,
    sourceCounts,
    sources: Object.entries(SOURCE_NAMES).map(([id, displayName]) => ({
      id: id as Exclude<SearchArticle['source'], 'gsc'>,
      displayName,
      status: 'stale',
      itemCount: sourceCounts[id as keyof typeof sourceCounts] ?? 0,
      errorCode: 'STATIC_SNAPSHOT',
    })),
    items,
  };
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

export async function searchNews(query: string, range: SearchRange): Promise<Envelope<SearchData>> {
  const q = query.trim();
  if (q.length < 2 || q.length > 50) throw new Error('關鍵字需為 2 至 50 個字元');
  const base = apiBase();
  if (base) {
    try {
      const response = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}&range=${range}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseSearchResponse(await response.json());
    } catch {
      // Worker 無法使用時，改讀 GitHub Pages 上一次成功快照。
    }
  }
  const snapshot = await fetchData<NewsArchiveData>('news-archive');
  return {
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    data: buildStaticSearchData(snapshot.data.items, q, range),
  };
}

export async function fetchTrends(): Promise<Envelope<TrendsData>> {
  const base = apiBase();
  if (base) {
    try {
      const response = await fetch(`${base}/api/trends`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseTrendsResponse(await response.json());
    } catch {
      // 改用 Pages 的最後成功趨勢快照。
    }
  }
  const snapshot = await fetchData<TrendsData>('trends');
  const parsed = parseTrendsResponse(snapshot);
  return { ...parsed, data: { ...parsed.data, status: 'stale', stale: true } };
}

export type { SearchMetrics };
