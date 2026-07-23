const RANGE_MS = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000, '7d': 604_800_000 };
const compactCjkSpaces = (value) => value.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;

export function normalizePublishedAt(rawDate, now = Date.now()) {
  let timestamp = Date.parse(rawDate);
  if (Number.isNaN(timestamp)) return null;
  if (timestamp > now + FUTURE_TOLERANCE_MS) {
    const corrected = timestamp - TAIWAN_OFFSET_MS;
    if (corrected <= now + FUTURE_TOLERANCE_MS) timestamp = corrected;
  }
  if (timestamp > now + FUTURE_TOLERANCE_MS) return null;
  return new Date(timestamp).toISOString();
}

const decodeXml = (value = '') =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const extract = (block, tag) => {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return decodeXml(match?.[1] || '');
};

const tagAttribute = (block, tag, attribute) => {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return decodeXml(match?.[1] || '');
};

const canonicalUrl = (raw) => {
  try {
    const url = new URL(raw);
    [...url.searchParams.keys()].forEach((key) => {
      if (key.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid', 'ref', 'source'].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    });
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return '';
  }
};

const entryBlocks = (xml) => [
  ...(xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []),
  ...(xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || []),
];

const linkOf = (block) => {
  const text = extract(block, 'link');
  if (text) return text;
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return decodeXml(href || '');
};

export function validateQuery(rawQuery, rawRange = '24h') {
  const query = String(rawQuery || '').trim();
  const range = String(rawRange || '24h');
  if (query.length < 2 || query.length > 50) throw new Error('INVALID_QUERY');
  if (!(range in RANGE_MS)) throw new Error('INVALID_RANGE');
  return { query, range };
}

export function matchesQuery(text, rawQuery) {
  const haystack = String(text || '').toLocaleLowerCase('zh-TW');
  const groups = String(rawQuery || '').split(/\s+OR\s+/i);
  return groups.some((group) => {
    const positives = [];
    const negatives = [];
    let negateNext = false;
    for (const match of group.matchAll(/"([^"]+)"|(\S+)/g)) {
      let token = (match[1] || match[2] || '').trim();
      if (!token || /^AND$/i.test(token)) continue;
      if (/^NOT$/i.test(token)) {
        negateNext = true;
        continue;
      }
      let negative = negateNext;
      negateNext = false;
      if (token.startsWith('-')) {
        negative = true;
        token = token.slice(1);
      }
      if (!token) continue;
      (negative ? negatives : positives).push(token.toLocaleLowerCase('zh-TW'));
    }
    return positives.every((term) => haystack.includes(term)) && negatives.every((term) => !haystack.includes(term));
  });
}

export function parseRss(xml, source) {
  return entryBlocks(xml)
    .slice(0, 20)
    .map((block, index) => {
      const title = extract(block, 'title');
      const url = canonicalUrl(linkOf(block));
      const rawDate = extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated');
      const publishedAt = normalizePublishedAt(rawDate);
      if (!title || !url || !publishedAt) return null;
      return {
        id: `${source}-${extract(block, 'guid') || extract(block, 'id') || index}`,
        source,
        title: title.slice(0, 200),
        excerpt: (extract(block, 'description') || extract(block, 'summary')).slice(0, 140),
        publishedAt,
        url,
        sentiment: null,
      };
    })
    .filter(Boolean);
}

export function googleNewsSiteUrl(domain) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', `site:${domain} when:1d`);
  url.searchParams.set('hl', 'zh-TW');
  url.searchParams.set('gl', 'TW');
  url.searchParams.set('ceid', 'TW:zh-Hant');
  return url.toString();
}

/** 解析單一媒體的 Google News `site:網域` feed；移除「 - 媒體名」尾綴，全部歸屬該來源。 */
export function parseGoogleNewsForSource(xml, source, now = Date.now()) {
  const names = new Set([source.displayName, ...(source.aliases || [])].map((value) => value.replace(/\s+/g, '')));
  return entryBlocks(xml)
    .slice(0, 40)
    .map((block, index) => {
      let title = extract(block, 'title');
      const cut = title.lastIndexOf(' - ');
      if (cut > 0 && names.has(title.slice(cut + 3).replace(/\s+/g, ''))) title = title.slice(0, cut);
      const url = canonicalUrl(linkOf(block));
      const rawDate = extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated');
      const publishedAt = normalizePublishedAt(rawDate, now);
      if (!title || !url || !publishedAt) return null;
      return {
        id: `gnews-${source.id}-${extract(block, 'guid') || extract(block, 'id') || index}`,
        source: source.id,
        title: title.slice(0, 200),
        excerpt: '',
        publishedAt,
        url,
        sentiment: null,
      };
    })
    .filter(Boolean);
}

/** 兩層去重：canonical URL，再依（來源, 壓空白標題）；標題層偏好非 Google News 轉址的原文。 */
export function dedupeSnapshot(items) {
  const byUrl = new Map();
  for (const item of [...items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const key = canonicalUrl(item.url);
    if (key && !byUrl.has(key)) byUrl.set(key, item);
  }
  const isOriginal = (item) => !item.url.includes('news.google.com');
  const byTitle = new Map();
  for (const item of byUrl.values()) {
    const key = `${item.source}:${item.title.replace(/\s+/g, '').toLocaleLowerCase('zh-TW')}`;
    const kept = byTitle.get(key);
    if (!kept || (isOriginal(item) && !isOriginal(kept))) byTitle.set(key, item);
  }
  return [...byTitle.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function parseGoogleNewsRss(xml, sources) {
  return entryBlocks(xml)
    .slice(0, 100)
    .map((block, index) => {
      const sourceName = extract(block, 'source');
      const sourceUrl = tagAttribute(block, 'source', 'url');
      const normalizedName = sourceName.replace(/\s+/g, '').toLocaleLowerCase('zh-TW');
      let hostname = '';
      try {
        hostname = new URL(sourceUrl).hostname.toLowerCase();
      } catch {
        hostname = '';
      }
      const source = sources.find((candidate) =>
        candidate.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
          || candidate.aliases.some((alias) => alias.replace(/\s+/g, '').toLocaleLowerCase('zh-TW') === normalizedName),
      );
      const title = extract(block, 'title');
      const url = canonicalUrl(linkOf(block));
      const rawDate = extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated');
      const publishedAt = normalizePublishedAt(rawDate);
      if (!source || !title || !url || !publishedAt) return null;
      return {
        id: `google-news-${source.id}-${extract(block, 'guid') || index}`,
        source: source.id,
        title: title.slice(0, 200),
        excerpt: extract(block, 'description').slice(0, 140),
        publishedAt,
        url,
        sentiment: null,
      };
    })
    .filter(Boolean);
}

export function parseTrendsRss(xml) {
  return entryBlocks(xml)
    .slice(0, 20)
    .map((block) => {
      const news = (block.match(/<ht:news_item(?:\s[^>]*)?>[\s\S]*?<\/ht:news_item>/gi) || [])
        .map((newsBlock) => ({
          title: extract(newsBlock, 'ht:news_item_title'),
          source: extract(newsBlock, 'ht:news_item_source'),
          url: canonicalUrl(extract(newsBlock, 'ht:news_item_url')),
        }))
        .filter((item) => {
          if (!item.title || !item.url) return false;
          return true;
        });
      const timestamp = Date.parse(extract(block, 'pubDate'));
      return {
        title: compactCjkSpaces(extract(block, 'title')),
        approximateTraffic: extract(block, 'ht:approx_traffic'),
        publishedAt: Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString(),
        news,
      };
    })
    .filter((item) => item.title);
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function calculateMetrics(items, range, now = Date.now(), enabledSourceCount = 6) {
  if (items.length === 0) {
    return { heat: 0, mentions: 0, sourceCount: 0, volume: 0, acceleration: 0, diversity: 0 };
  }
  const windowMs = RANGE_MS[range];
  const midpoint = now - windowMs / 2;
  const recent = items.filter((item) => Date.parse(item.publishedAt) >= midpoint).length;
  const previous = Math.max(0, items.length - recent);
  const acceleration = clamp01(0.5 + (recent - previous) / (2 * Math.max(1, recent, previous)));
  const volume = clamp01(items.length / Math.max(1, enabledSourceCount));
  const sourceCount = new Set(items.map((item) => item.source)).size;
  const diversity = clamp01(sourceCount / Math.max(1, enabledSourceCount));
  const heat = Math.round(100 * (0.5 * volume + 0.33 * acceleration + 0.17 * diversity));
  return { heat, mentions: items.length, sourceCount, volume, acceleration, diversity };
}

export function filterAndDedupe(items, query, range, now = Date.now()) {
  const cutoff = now - RANGE_MS[range];
  const selected = items
    .map((item) => {
      const publishedAt = normalizePublishedAt(item.publishedAt, now);
      return publishedAt ? { ...item, publishedAt } : null;
    })
    .filter(Boolean)
    .filter((item) => Date.parse(item.publishedAt) >= cutoff)
    .filter((item) => matchesQuery(`${item.title} ${item.excerpt || ''}`, query))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const seen = new Set();
  return selected.filter((item) => {
    const key = canonicalUrl(item.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function timelineFor(items, range, now = Date.now()) {
  const bucketCount = range === '1h' ? 6 : range === '6h' ? 12 : range === '24h' ? 24 : 28;
  const bucketMs = RANGE_MS[range] / bucketCount;
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = now - RANGE_MS[range] + index * bucketMs;
    const end = start + bucketMs;
    const mentions = items.filter((item) => {
      const timestamp = Date.parse(item.publishedAt);
      return timestamp >= start && timestamp < end;
    }).length;
    return { t: new Date(start).toISOString(), mentions, heat: Math.min(100, mentions * 20) };
  });
}
