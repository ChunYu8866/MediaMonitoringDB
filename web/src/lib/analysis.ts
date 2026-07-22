import type { SearchArticle } from '../types/contracts';

export type AnalysisSentiment = 'positive' | 'neutral' | 'negative';
export interface TermStat { term: string; count: number; change: number }

const POSITIVE = ['成長', '上漲', '獲利', '創高', '增加', '樂觀', '成功', '勝', '改善', '突破'];
const NEGATIVE = ['下跌', '虧損', '失敗', '死亡', '死傷', '危機', '裁員', '下降', '爭議', '事故', '震災'];
const STOPWORDS = new Set(['新聞', '表示', '指出', '今天', '目前', '相關', '最新', '台灣', '報導', '消息']);

function queryGroups(rawQuery: string): { positives: string[]; negatives: string[] }[] {
  return rawQuery.split(/\s+OR\s+/i).map((group) => {
    const positives: string[] = [];
    const negatives: string[] = [];
    let negateNext = false;
    for (const match of group.matchAll(/"([^"]+)"|(\S+)/g)) {
      let token = (match[1] || match[2] || '').trim();
      if (!token || /^AND$/i.test(token)) continue;
      if (/^NOT$/i.test(token)) { negateNext = true; continue; }
      let negative = negateNext;
      negateNext = false;
      if (token.startsWith('-')) { negative = true; token = token.slice(1); }
      if (token) (negative ? negatives : positives).push(token.toLocaleLowerCase('zh-TW'));
    }
    return { positives, negatives };
  });
}

export function matchesAdvancedQuery(text: string, query: string): boolean {
  const haystack = text.toLocaleLowerCase('zh-TW');
  return queryGroups(query).some(({ positives, negatives }) =>
    positives.every((term) => haystack.includes(term)) && negatives.every((term) => !haystack.includes(term)),
  );
}

export function classifySentiment(text: string): AnalysisSentiment {
  const positive = POSITIVE.filter((term) => text.includes(term)).length;
  const negative = NEGATIVE.filter((term) => text.includes(term)).length;
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

function words(text: string): string[] {
  const Segmenter = (Intl as unknown as {
    Segmenter: new (locale: string, options: { granularity: 'word' }) => {
      segment: (value: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
    };
  }).Segmenter;
  const segmenter = new Segmenter('zh-TW', { granularity: 'word' });
  const base = [...segmenter.segment(text)]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.trim())
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
  const compounds = base.slice(0, -1)
    .map((word, index) => `${word}${base[index + 1]}`)
    .filter((word) => /^[\u3400-\u9fff]{4,8}$/.test(word));
  return [...base, ...compounds];
}

export function extractTermStats(items: SearchArticle[], midpoint: number, excluded: string[] = []): { top: TermStat[]; rising: TermStat[] } {
  const excludedSet = new Set(excluded.map((term) => term.toLocaleLowerCase('zh-TW')));
  const counts = new Map<string, { recent: number; previous: number }>();
  for (const item of items) {
    const period = Date.parse(item.publishedAt) >= midpoint ? 'recent' : 'previous';
    for (const term of new Set(words(`${item.title} ${item.excerpt}`))) {
      if (excludedSet.has(term.toLocaleLowerCase('zh-TW'))) continue;
      const value = counts.get(term) ?? { recent: 0, previous: 0 };
      value[period] += 1;
      counts.set(term, value);
    }
  }
  const values = [...counts.entries()].map(([term, value]) => ({
    term,
    count: value.recent + value.previous,
    change: value.recent - value.previous,
  }));
  return {
    top: [...values].sort((a, b) => b.count - a.count || b.change - a.change).slice(0, 10),
    rising: values.filter((item) => item.change > 0).sort((a, b) => b.change - a.change || b.count - a.count).slice(0, 10),
  };
}
