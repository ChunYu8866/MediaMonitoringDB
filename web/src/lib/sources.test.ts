import { describe, expect, it } from 'vitest';

import { NEWS_SOURCE_IDS, SOURCE_META, sourceModeLabel } from './sources';

const EXPECTED_SOURCE_IDS = [
  'tvbs', 'ebc', 'setn', 'ftv', 'cti', 'era', 'nexttv', 'pts', 'ttv', 'cts', 'udn',
  'ltn', 'cna', 'moneyudn', 'ctee', 'anue', 'wealth', 'businessweekly', 'thenewslens',
  'reporter', 'newtalk', 'nownews', 'nextapple', 'ettoday',
];

describe('news source registry', () => {
  it('contains exactly the requested 24 publishers', () => {
    expect(NEWS_SOURCE_IDS).toEqual(EXPECTED_SOURCE_IDS);
    expect(Object.keys(SOURCE_META)).not.toContain('mirror');
    expect(Object.keys(SOURCE_META)).not.toContain('currents');
  });

  it('shows the actual acquisition mode in Traditional Chinese', () => {
    expect(sourceModeLabel('official-rss')).toBe('官方 RSS');
    expect(sourceModeLabel('google-news')).toBe('Google News 補充');
    expect(sourceModeLabel('site-listing')).toBe('官網低頻');
  });
});
