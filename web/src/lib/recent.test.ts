import { describe, expect, it } from 'vitest';
import type { RecentItem } from '../types/contracts';
import { getRecentItems } from './recent';

const item = (id: string, publishedAt: string, title = id): RecentItem => ({
  id,
  source: 'ltn',
  title,
  excerpt: '摘要',
  publishedAt,
  url: `https://example.com/${id}`,
});

describe('getRecentItems', () => {
  it('sorts newest articles first and limits the page size', () => {
    const items = [
      item('old', '2026-07-23T08:00:00.000Z'),
      item('new', '2026-07-23T10:00:00.000Z'),
      item('middle', '2026-07-23T09:00:00.000Z'),
    ];

    expect(getRecentItems(items, 2).map((article) => article.id)).toEqual(['new', 'middle']);
  });

  it('does not let an invalid date move ahead of valid news', () => {
    const items = [item('invalid', 'not-a-date'), item('valid', '2026-07-23T10:00:00.000Z')];

    expect(getRecentItems(items).map((article) => article.id)).toEqual(['valid', 'invalid']);
  });
});
