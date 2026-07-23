// 關鍵字熱度與 ORG 共現的 Worker 端計算，與 src/opinion_pipeline/analysis.py 對齊。
// 全部為可重算的字面統計（計數、log、熵），符合「Worker 只做輕量統計」的邊界。
import { AUTO_TERMS, ORG_LEXICON, WATCH_TERMS } from './generated-config.js';

export const HEAT_WEIGHTS = { volume: 0.5, acceleration: 0.33, diversity: 0.17 };
const KEYWORD_WINDOW_MS = 24 * 60 * 60 * 1000;
const TREND_BUCKETS = 24;
const CJK_RUN = /[㐀-鿿]+/g;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
// 中文不受大小寫影響，只需折疊 ASCII；用 toLowerCase 取代 locale-aware 版本以大幅降低 CPU。
const casefold = (value) => String(value || '').toLowerCase();
const searchTextOf = (item) => `${item.title || ''} ${item.excerpt || ''}`;
// 每筆項目的折疊後文字只計算一次（WeakMap 快取，不污染項目本體）。
const _foldCache = new WeakMap();
function foldOf(item) {
  let value = _foldCache.get(item);
  if (value === undefined) {
    value = casefold(searchTextOf(item));
    _foldCache.set(item, value);
  }
  return value;
}

function matchesFolded(haystack, anyOfFolded, excludeFolded) {
  if (excludeFolded.some((term) => term && haystack.includes(term))) return false;
  return anyOfFolded.some((term) => term && haystack.includes(term));
}

function entropyDiversity(shareValues, enabledSourceCount) {
  if (shareValues.length <= 1 || enabledSourceCount <= 1) return 0;
  const entropy = -shareValues.reduce((acc, p) => (p > 0 ? acc + p * Math.log(p) : acc), 0);
  return clamp01(entropy / Math.log(enabledSourceCount));
}

export function extractAutoTerms(items, cfg = AUTO_TERMS, watchTerms = WATCH_TERMS) {
  const minDocs = Math.max(2, cfg.minDocs);
  const minSources = Math.max(1, cfg.minSources);
  const minLength = cfg.minLength;
  const stopwords = cfg.stopwords || [];
  const watchVocab = watchTerms.flatMap((entry) => [entry.display, ...(entry.anyOf || [])]).filter(Boolean);

  const docCount = new Map();
  const gramDocs = new Map();
  const gramSources = new Map();
  items.forEach((item, docId) => {
    const grams = new Set();
    for (const run of item.title.match(CJK_RUN) || []) {
      for (let size = minLength; size <= 6; size += 1) {
        for (let start = 0; start + size <= run.length; start += 1) grams.add(run.slice(start, start + size));
      }
    }
    for (const gram of grams) {
      docCount.set(gram, (docCount.get(gram) || 0) + 1);
      if (!gramDocs.has(gram)) gramDocs.set(gram, new Set());
      gramDocs.get(gram).add(docId);
      if (!gramSources.has(gram)) gramSources.set(gram, new Set());
      gramSources.get(gram).add(item.source);
    }
  });

  const blocked = (gram) =>
    stopwords.some((stop) => gram.includes(stop)) || watchVocab.some((vocab) => gram.includes(vocab) || vocab.includes(gram));
  // 若某個「更長且被封鎖」的詞涵蓋本詞 ≥80% 的文件，本詞只是它的碎片（如「目標」←「目標價」）。
  const dominatedByBlocked = (gram) => {
    const threshold = 0.8 * docCount.get(gram);
    for (const [cand, count] of docCount) {
      if (cand.length > gram.length && cand.includes(gram) && count >= threshold && blocked(cand)) return true;
    }
    return false;
  };
  const eligible = (gram) =>
    (docCount.get(gram) || 0) >= minDocs &&
    (gramSources.get(gram)?.size || 0) >= minSources &&
    !blocked(gram) &&
    !dominatedByBlocked(gram);

  const promote = (gram) => {
    const threshold = 0.8 * docCount.get(gram);
    let best = gram;
    for (const [cand, count] of docCount) {
      if (cand.length === gram.length + 1 && cand.includes(gram) && count >= threshold && eligible(cand)) {
        if (best === gram || count > docCount.get(best)) best = cand;
      }
    }
    return best;
  };

  const redundant = (gram, chosen) =>
    chosen.some((kept) => {
      if (gram.includes(kept) || kept.includes(gram)) return true;
      const a = gramDocs.get(gram);
      const b = gramDocs.get(kept);
      let overlap = 0;
      for (const doc of a) if (b.has(doc)) overlap += 1;
      return overlap >= 0.6 * Math.min(a.size, b.size);
    });

  const ranked = [...docCount.keys()]
    .filter(eligible)
    .sort((a, b) => docCount.get(b) - docCount.get(a) || b.length - a.length || (a < b ? -1 : 1));

  const chosen = [];
  for (const gram of ranked) {
    if (chosen.length >= cfg.maxTerms) break;
    const term = promote(gram);
    if (!redundant(term, chosen)) chosen.push(term);
  }
  return chosen;
}

export function buildKeywords(items, now = Date.now(), enabledSourceCount = 24, watchTerms = WATCH_TERMS) {
  const windowStart = now - KEYWORD_WINDOW_MS;
  const recent = items.filter((item) => Date.parse(item.publishedAt) >= windowStart);
  const autoTerms = extractAutoTerms(recent);

  const definitions = [];
  for (const entry of watchTerms) {
    const display = String(entry.display || '').trim();
    if (!display) continue;
    const anyOf = (entry.anyOf && entry.anyOf.length ? entry.anyOf : [display]).map(String);
    definitions.push({
      id: `watch-${entry.id || display}`,
      term: display,
      kind: 'manual',
      anyOf,
      exclude: (entry.exclude || []).map(String),
      aliases: anyOf.filter((term) => term !== display),
    });
  }
  autoTerms.forEach((term, index) =>
    definitions.push({ id: `auto-${index + 1}`, term, kind: 'auto', anyOf: [term], exclude: [], aliases: [] }),
  );

  const bucketMs = KEYWORD_WINDOW_MS / TREND_BUCKETS;
  const computed = definitions.map((definition) => {
    const anyOf = definition.anyOf.map(casefold);
    const exclude = definition.exclude.map(casefold);
    const matched = recent.filter((item) => matchesFolded(foldOf(item), anyOf, exclude));
    const sourceCounts = {};
    for (const item of matched) sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    const total = matched.length;
    const share = {};
    if (total) for (const [src, count] of Object.entries(sourceCounts)) share[src] = Math.round((count / total) * 1000) / 1000;
    const buckets = new Array(TREND_BUCKETS).fill(0);
    for (const item of matched) {
      const index = Math.min(TREND_BUCKETS - 1, Math.floor((Date.parse(item.publishedAt) - windowStart) / bucketMs));
      buckets[index] += 1;
    }
    const recent6 = buckets.slice(-6).reduce((a, b) => a + b, 0);
    const previous6 = buckets.slice(-12, -6).reduce((a, b) => a + b, 0);
    let acceleration = 0;
    if (total) {
      const raw = clamp01(0.5 + (recent6 - previous6) / (2 * Math.max(1, recent6, previous6)));
      acceleration = 0.5 + (raw - 0.5) * Math.min(1, total / 10);
    }
    return { definition, matched: total, share, buckets, acceleration };
  });

  const maxMentions = Math.max(0, ...computed.map((entry) => entry.matched));
  const maxBucket = Math.max(0, ...computed.flatMap((entry) => entry.buckets));
  const keywords = computed.map((entry) => {
    const { definition } = entry;
    const total = entry.matched;
    const volume = maxMentions && total ? clamp01(Math.log1p(total) / Math.log1p(maxMentions)) : 0;
    const diversity = entropyDiversity(Object.values(entry.share), enabledSourceCount);
    const heat =
      Math.round(
        100 *
          (HEAT_WEIGHTS.volume * volume + HEAT_WEIGHTS.acceleration * entry.acceleration + HEAT_WEIGHTS.diversity * diversity) *
          10,
      ) / 10;
    const keyword = {
      id: definition.id,
      term: definition.term,
      kind: definition.kind,
      heat,
      mentions24h: total,
      components: {
        volume: Math.round(volume * 1000) / 1000,
        acceleration: Math.round(entry.acceleration * 1000) / 1000,
        diversity: Math.round(diversity * 1000) / 1000,
        weights: { ...HEAT_WEIGHTS },
      },
      sourceShare: entry.share,
      trend: entry.buckets.map((count, index) => ({
        t: new Date(windowStart + index * bucketMs).toISOString(),
        mentions: count,
        heat: maxBucket ? Math.round((100 * count) / maxBucket * 10) / 10 : 0,
      })),
    };
    if (definition.aliases.length) keyword.aliases = definition.aliases;
    return keyword;
  });

  keywords.sort((a, b) => b.heat - a.heat || b.mentions24h - a.mentions24h || (a.term < b.term ? -1 : 1));
  return keywords;
}

const TOPIC_DEFINITIONS = [
  ['finance', '財經與產業', ['台積電', '半導體', '股市', '經濟', '產業']],
  ['weather', '天氣與防災', ['颱風', '豪雨', '氣象', '地震', '防災']],
  ['politics', '政治與公共政策', ['立法院', '立委', '行政院', '總統', '預算', '政黨']],
  ['society', '社會與生活', ['社會', '交通', '醫療', '健康', '教育', '食安']],
  ['world', '國際與兩岸', ['美國', '中國', '國際', '兩岸', '日本', '歐洲']],
];

const TICKER_NOISE = ['盤中速報', '盤後速報', '近5分K', '三大法人買賣超', '融資融券增減'];
const isTickerNoise = (item) => TICKER_NOISE.some((marker) => searchTextOf(item).includes(marker));

export function buildTopics(items) {
  const topics = [];
  for (const [id, label, terms] of TOPIC_DEFINITIONS) {
    const folded = terms.map(casefold);
    const matched = items.filter((item) => {
      const haystack = foldOf(item);
      return folded.some((term) => haystack.includes(term));
    });
    if (!matched.length) continue;
    const clean = matched.filter((item) => !isTickerNoise(item));
    const preferred = clean.length ? clean : matched;
    const summaries = [];
    for (const item of preferred) {
      const text = (item.excerpt || '').trim() || (item.title || '').trim();
      if (text) summaries.push({ text, source: item.source, url: item.url });
      if (summaries.length === 2) break;
    }
    topics.push({
      id,
      label,
      terms: [...terms],
      size: matched.length,
      sentiment: { positive: 0, neutral: 1, negative: 0 },
      summarySentences: summaries,
      articles: preferred.slice(0, 5).map((item) => ({
        title: item.title,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
      })),
    });
  }
  return topics;
}

const MIN_NODE_MENTIONS = 2;
const MIN_EDGE_WEIGHT = 2;
const MAX_NODES = 30;

export function buildEntities(items, lexicon = ORG_LEXICON) {
  const folded = lexicon.map((entry) => ({ name: entry.name, terms: [entry.name, ...entry.aliases].map(casefold) }));
  const mentions = new Map();
  const pairDocs = new Map();
  for (const item of items) {
    const haystack = foldOf(item);
    const present = folded.filter((entry) => entry.terms.some((term) => haystack.includes(term))).map((entry) => entry.name);
    present.sort();
    for (const name of present) mentions.set(name, (mentions.get(name) || 0) + 1);
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const key = `${present[i]} ${present[j]}`;
        pairDocs.set(key, (pairDocs.get(key) || 0) + 1);
      }
    }
  }

  const kept = [...mentions.entries()]
    .filter(([, count]) => count >= MIN_NODE_MENTIONS)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_NODES)
    .map(([name]) => name);
  const nodeIds = new Map(kept.map((name, index) => [name, `org-${index + 1}`]));
  const nodes = kept.map((name) => ({ id: nodeIds.get(name), name, type: 'ORG', mentions: mentions.get(name) }));
  const edges = [...pairDocs.entries()]
    .map(([key, weight]) => {
      const [left, right] = key.split(' ');
      return { left, right, weight };
    })
    .filter((edge) => edge.weight >= MIN_EDGE_WEIGHT && nodeIds.has(edge.left) && nodeIds.has(edge.right))
    .sort((a, b) => b.weight - a.weight)
    .map((edge) => ({ source: nodeIds.get(edge.left), target: nodeIds.get(edge.right), weight: edge.weight }));
  return { nodes, edges };
}
