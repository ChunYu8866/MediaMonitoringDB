export const NEWS_SOURCES = [
  { id: 'tvbs', displayName: 'TVBS', domains: ['news.tvbs.com.tw', 'tvbs.com.tw'], aliases: ['TVBS新聞網', 'TVBS'] },
  { id: 'ebc', displayName: '東森新聞', domains: ['news.ebc.net.tw', 'ebc.net.tw'], aliases: ['東森新聞', 'EBC東森新聞'] },
  { id: 'setn', displayName: '三立新聞', domains: ['setn.com', 'www.setn.com'], aliases: ['三立新聞網', '三立新聞網SETN.com', 'SETN'] },
  { id: 'ftv', displayName: '民視新聞', domains: ['ftvnews.com.tw', 'www.ftvnews.com.tw'], aliases: ['民視新聞網', '民視新聞'] },
  { id: 'cti', displayName: '中天新聞', domains: ['ctinews.com'], aliases: ['中天新聞網', '中天新聞'], rssUrl: 'https://ctinews.com/rss/google-news.xml' },
  { id: 'era', displayName: '年代新聞', domains: ['eracom.com.tw', 'www.eracom.com.tw'], aliases: ['年代新聞', '年代電視'] },
  { id: 'nexttv', displayName: '壹電視', domains: ['nexttv.com.tw', 'www.nexttv.com.tw'], aliases: ['壹電視', '壹新聞'], rssUrl: 'https://www.nexttv.com.tw/nRSS.xml' },
  { id: 'pts', displayName: '公視新聞', domains: ['news.pts.org.tw', 'pts.org.tw'], aliases: ['公視新聞網', '公視新聞網PNN', '公視新聞'], rssUrl: 'https://news.pts.org.tw/xml/newsfeed.xml' },
  { id: 'udn', displayName: 'UDN', domains: ['udn.com', 'www.udn.com'], aliases: ['聯合新聞網', 'UDN'] },
  { id: 'ltn', displayName: '自由時報', domains: ['news.ltn.com.tw', 'ltn.com.tw'], aliases: ['自由時報', '自由電子報'], rssUrl: 'https://news.ltn.com.tw/rss/all.xml' },
  { id: 'cna', displayName: '中央社', domains: ['cna.com.tw', 'www.cna.com.tw'], aliases: ['中央社', '中央通訊社', '中央社 CNA'] },
  { id: 'moneyudn', displayName: '經濟日報', domains: ['money.udn.com'], aliases: ['經濟日報'], rssUrl: 'https://money.udn.com/rssfeed/news/1001/5590?ch=money' },
  { id: 'ctee', displayName: '工商時報', domains: ['ctee.com.tw', 'www.ctee.com.tw'], aliases: ['工商時報'] },
  { id: 'anue', displayName: '鉅亨網', domains: ['news.cnyes.com', 'cnyes.com'], aliases: ['鉅亨網', 'Anue鉅亨'], rssUrl: 'https://news.cnyes.com/rss/v1/news/category/headline' },
  { id: 'wealth', displayName: '財訊', domains: ['wealth.com.tw', 'www.wealth.com.tw'], aliases: ['財訊', '財訊雙週刊'] },
  { id: 'businessweekly', displayName: '商業週刊', domains: ['businessweekly.com.tw', 'www.businessweekly.com.tw'], aliases: ['商業周刊', '商周'] },
  { id: 'thenewslens', displayName: '關鍵評論網', domains: ['thenewslens.com', 'www.thenewslens.com'], aliases: ['關鍵評論網', 'The News Lens'], rssUrl: 'https://www.thenewslens.com/feed/feedly' },
  { id: 'reporter', displayName: '報導者', domains: ['twreporter.org', 'www.twreporter.org', 'public.twreporter.org'], aliases: ['報導者', 'The Reporter'], rssUrl: 'https://www.twreporter.org/a/rss2.xml' },
  { id: 'newtalk', displayName: '新頭殼', domains: ['newtalk.tw'], aliases: ['新頭殼', 'Newtalk新聞'] },
  { id: 'nownews', displayName: 'NOWNEWS', domains: ['nownews.com', 'www.nownews.com'], aliases: ['NOWnews今日新聞', 'NOWNEWS今日新聞', 'NOWNEWS'] },
  { id: 'nextapple', displayName: '壹蘋新聞網', domains: ['tw.nextapple.com', 'news.nextapple.com', 'nextapple.com'], aliases: ['壹蘋新聞網', '壹蘋'], rssUrl: 'https://news.nextapple.com/api/rss/category/latest' },
  { id: 'ettoday', displayName: 'ETtoday', domains: ['ettoday.net', 'www.ettoday.net'], aliases: ['ETtoday新聞雲', 'ETtoday'], rssUrl: 'https://feeds.feedburner.com/ettoday/realtime' },
];

const normalized = (value) => String(value || '').replace(/\s+/g, '').toLocaleLowerCase('zh-TW');

export function sourceForGoogleNews(name, sourceUrl, sources = NEWS_SOURCES) {
  let hostname = '';
  try {
    hostname = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    hostname = '';
  }
  const normalizedName = normalized(name);
  return sources.find((source) =>
    source.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
      || source.aliases.some((alias) => normalized(alias) === normalizedName),
  ) || null;
}
