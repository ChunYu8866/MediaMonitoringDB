import type { SourceId, SourceStatus, GlobalStatus } from '../types/contracts';
import type { ChartTokens } from './theme';

export interface SourceMeta {
  id: SourceId;
  name: string;
  short: string;
  /** 分類色 slot（0–7）；null 代表使用 muted 灰。 */
  series: number | null;
  /** 是否為新聞來源（用於聚合與說明）。 */
  news: boolean;
}

// 顏色依「來源身分」固定指定（非依排名），維持全站一致。
export const SOURCE_META: Record<SourceId, SourceMeta> = {
  cna: { id: 'cna', name: '中央通訊社', short: '中央社', series: 0, news: true },
  ltn: { id: 'ltn', name: '自由時報', short: '自由時報', series: 1, news: true },
  mirror: { id: 'mirror', name: '鏡新聞', short: '鏡新聞', series: 2, news: true },
  tvbs: { id: 'tvbs', name: 'TVBS 新聞網', short: 'TVBS', series: 3, news: true },
  ettoday: { id: 'ettoday', name: 'ETtoday 新聞雲', short: 'ETtoday', series: 5, news: true },
  currents: { id: 'currents', name: 'Currents API（選配）', short: 'Currents', series: 4, news: true },
  gsc: { id: 'gsc', name: 'Google Search Console', short: 'Search Console', series: 6, news: false },
  set: { id: 'set', name: '三立新聞網', short: '三立', series: 7, news: true },
};

/** 依顯示順序排列的新聞來源。 */
export const NEWS_SOURCE_IDS: SourceId[] = (Object.values(SOURCE_META) as SourceMeta[])
  .filter((m) => m.news)
  .map((m) => m.id);

export function sourceName(id: SourceId): string {
  return SOURCE_META[id]?.name ?? id;
}

export function sourceShort(id: SourceId): string {
  return SOURCE_META[id]?.short ?? id;
}

/** 回傳 CSS 變數字串（供一般 UI 使用）。 */
export function sourceColor(id: SourceId): string {
  const s = SOURCE_META[id]?.series;
  return s == null ? 'var(--text-muted)' : `var(--series-${s + 1})`;
}

/** 回傳已解析的實際色值（供 ECharts canvas 使用）。 */
export function sourceColorValue(id: SourceId, tokens: ChartTokens): string {
  const s = SOURCE_META[id]?.series;
  if (s == null) return tokens.muted;
  return tokens.series[s] ?? tokens.muted;
}

/** 狀態 → 徽章樣式與中文標籤。 */
export const STATUS_LABEL: Record<SourceStatus, { label: string; variant: string }> = {
  ok: { label: '正常', variant: 'good' },
  stale: { label: '資料過期', variant: 'warning' },
  degraded: { label: '降級', variant: 'serious' },
  error: { label: '錯誤', variant: 'critical' },
  disabled: { label: '停用', variant: 'muted' },
};

export const GLOBAL_STATUS_LABEL: Record<GlobalStatus, { label: string; variant: string }> = {
  ok: { label: '運作正常', variant: 'good' },
  partial: { label: '部分來源異常', variant: 'warning' },
  stale: { label: '資料延遲', variant: 'serious' },
  error: { label: '系統異常', variant: 'critical' },
};
