const RANGE_MS = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000, '7d': 604_800_000 };

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

export function parseRss(xml, source) {
  return entryBlocks(xml)
    .slice(0, 20)
    .map((block, index) => {
      const title = extract(block, 'title');
      const url = canonicalUrl(linkOf(block));
      const rawDate = extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated');
      const timestamp = Date.parse(rawDate);
      if (!title || !url) return null;
      return {
        id: `${source}-${extract(block, 'guid') || extract(block, 'id') || index}`,
        source,
        title: title.slice(0, 200),
        excerpt: (extract(block, 'description') || extract(block, 'summary')).slice(0, 140),
        publishedAt: Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString(),
        url,
        sentiment: null,
      };
    })
    .filter(Boolean);
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
      const timestamp = Date.parse(rawDate);
      if (!source || !title || !url) return null;
      return {
        id: `google-news-${source.id}-${extract(block, 'guid') || index}`,
        source: source.id,
        title: title.slice(0, 200),
        excerpt: extract(block, 'description').slice(0, 140),
        publishedAt: Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString(),
        url,
        sentiment: null,
      };
    })
    .filter(Boolean);
}

export function parseTrendsRss(xml, sources = []) {
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
          if (sources.length === 0) return true;
          try {
            const hostname = new URL(item.url).hostname.toLowerCase();
            return sources.some((source) => source.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
          } catch {
            return false;
          }
        });
      const timestamp = Date.parse(extract(block, 'pubDate'));
      return {
        title: extract(block, 'title'),
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
  const needle = query.toLocaleLowerCase('zh-TW');
  const selected = items
    .filter((item) => Date.parse(item.publishedAt) >= cutoff)
    .filter((item) => `${item.title} ${item.excerpt || ''}`.toLocaleLowerCase('zh-TW').includes(needle))
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
