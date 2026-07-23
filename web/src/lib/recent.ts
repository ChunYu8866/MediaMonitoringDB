import type { RecentItem } from '../types/contracts';

/** Returns recent content in display order while keeping malformed dates at the end. */
export function getRecentItems(items: RecentItem[], limit = 24): RecentItem[] {
  return [...items]
    .sort((a, b) => {
      const aTime = Date.parse(a.publishedAt);
      const bTime = Date.parse(b.publishedAt);
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
      if (!Number.isFinite(bTime)) return -1;
      return bTime - aTime;
    })
    .slice(0, limit);
}
