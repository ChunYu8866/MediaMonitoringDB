import { describe, expect, it } from 'vitest';
import { REFRESH_INTERVALS, nextRefreshSeconds } from './refresh';

describe('live refresh schedule', () => {
  it('refreshes active searches every 30 seconds and Trends every 120 seconds', () => {
    expect(REFRESH_INTERVALS.search).toBe(30_000);
    expect(REFRESH_INTERVALS.trends).toBe(120_000);
  });

  it('returns a non-negative whole-second countdown', () => {
    expect(nextRefreshSeconds(10_000, 10_001)).toBe(30);
    expect(nextRefreshSeconds(10_000, 39_999)).toBe(1);
    expect(nextRefreshSeconds(10_000, 40_001)).toBe(0);
  });
});
