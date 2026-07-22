import { describe, expect, it } from 'vitest';
import { buildStaticSearchData, calculateNewsHeat, parseSearchResponse, parseTrendsResponse } from './search';

describe('calculateNewsHeat', () => {
  it('uses only volume, acceleration, and source diversity', () => {
    expect(calculateNewsHeat({ volume: 1, acceleration: 0.5, diversity: 0 })).toBe(67);
  });

  it('clamps every component to zero through one hundred', () => {
    expect(calculateNewsHeat({ volume: 2, acceleration: -1, diversity: 1 })).toBe(67);
  });
});

describe('static snapshot fallback', () => {
  it('filters the last-good archive without claiming it is live', () => {
    const data = buildStaticSearchData(
      [
        {
          id: '1',
          source: 'cna',
          title: '台積電公布法說會資訊',
          excerpt: '摘要',
          publishedAt: '2026-07-22T11:30:00Z',
          url: 'https://example.com/1',
          sentiment: null,
        },
        {
          id: '2',
          source: 'ltn',
          title: '天氣快訊',
          excerpt: '摘要',
          publishedAt: '2026-07-22T11:20:00Z',
          url: 'https://example.com/2',
          sentiment: null,
        },
      ],
      '台積電',
      '24h',
      Date.parse('2026-07-22T12:00:00Z'),
    );

    expect(data.status).toBe('stale');
    expect(data.stale).toBe(true);
    expect(data.items).toHaveLength(1);
  });

  it('returns zero heat when no article matches', () => {
    const data = buildStaticSearchData([], '不存在詞', '24h', Date.parse('2026-07-22T12:00:00Z'));
    expect(data.metrics.mentions).toBe(0);
    expect(data.metrics.heat).toBe(0);
  });

  it('validates the Taiwan trends source identity', () => {
    expect(() =>
      parseTrendsResponse({
        schemaVersion: '2.0.0',
        generatedAt: '2026-07-22T00:00:00Z',
        data: { geo: 'US', source: 'other', items: [] },
      }),
    ).toThrow('趨勢資料格式不相容');
  });
});

describe('parseSearchResponse', () => {
  it('accepts a partial response and preserves failed source details', () => {
    const parsed = parseSearchResponse({
        schemaVersion: '2.0.0',
      generatedAt: '2026-07-22T00:00:00Z',
      data: {
        query: '台積電',
        range: '24h',
        status: 'partial',
        stale: false,
        metrics: {
          heat: 72,
          mentions: 4,
          sourceCount: 2,
          volume: 0.8,
          acceleration: 0.6,
          diversity: 0.4,
        },
        timeline: [],
        sourceCounts: { cna: 2, ltn: 2 },
        sources: [
          { id: 'cna', displayName: '中央社', status: 'ok', itemCount: 2, errorCode: null },
          { id: 'tvbs', displayName: 'TVBS', status: 'error', itemCount: 0, errorCode: 'HTTP_403' },
        ],
        items: [],
      },
    });

    expect(parsed.data.status).toBe('partial');
    expect(parsed.data.sources[1].errorCode).toBe('HTTP_403');
  });

  it('rejects malformed payloads instead of guessing fields', () => {
    expect(() => parseSearchResponse({ data: { query: '台積電' } })).toThrow('搜尋資料格式不相容');
  });

  it('rejects a different schema major version', () => {
    expect(() =>
      parseSearchResponse({
        schemaVersion: '1.9.0',
        generatedAt: '2026-07-22T00:00:00Z',
        data: {
          query: '台積電', range: '24h', status: 'ok', stale: false, metrics: {},
          timeline: [], sources: [], items: [],
        },
      }),
    ).toThrow('搜尋資料格式不相容');
  });
});
