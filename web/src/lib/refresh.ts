export const REFRESH_INTERVALS = {
  search: 30_000,
  trends: 120_000,
} as const;

export function nextRefreshSeconds(lastUpdatedAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((lastUpdatedAt + REFRESH_INTERVALS.search - now) / 1_000));
}
