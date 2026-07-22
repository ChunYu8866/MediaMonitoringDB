import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { fetchTrends, searchNews } from '../api/search';
import { Chart } from '../components/Chart';
import { Badge, Banner, Card, EmptyState, LoadingState, SourceTag, StatTile } from '../components/ui';
import { GRID, catAxis, tooltip, valAxis } from '../lib/charts';
import { fmtDateTime, fmtNum, fmtTime } from '../lib/format';
import { useChartTokens } from '../lib/theme';
import type { Envelope, SearchData, SearchRange, TrendsData } from '../types/contracts';

const RANGES: { value: SearchRange; label: string }[] = [
  { value: '1h', label: '1 小時' },
  { value: '6h', label: '6 小時' },
  { value: '24h', label: '24 小時' },
  { value: '7d', label: '7 天' },
];

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<SearchRange>('24h');
  const [result, setResult] = useState<Envelope<SearchData> | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [trends, setTrends] = useState<Envelope<TrendsData> | null>(null);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const tokens = useChartTokens();

  useEffect(() => {
    fetchTrends().then(setTrends).catch((error: Error) => setTrendsError(error.message));
  }, []);

  async function runSearch(term = query) {
    const normalized = term.trim();
    if (normalized.length < 2 || normalized.length > 50) {
      setSearchError('請輸入 2 至 50 個字元的關鍵字。');
      return;
    }
    setQuery(normalized);
    setSearching(true);
    setSearchError(null);
    try {
      setResult(await searchNews(normalized, range));
    } catch (error) {
      setResult(null);
      setSearchError((error as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  const timelineOption = useMemo<EChartsOption>(() => ({
    color: [tokens.accent],
    tooltip: tooltip(tokens, { trigger: 'axis' }),
    grid: GRID,
    xAxis: {
      type: 'category',
      data: result?.data.timeline.map((point) => fmtTime(point.t)) ?? [],
      ...catAxis(tokens),
    },
    yAxis: { type: 'value', minInterval: 1, ...valAxis(tokens) },
    series: [{
      name: '新聞篇數',
      type: 'line',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.14 },
      data: result?.data.timeline.map((point) => point.mentions) ?? [],
    }],
  }), [result, tokens]);

  const sourceOption = useMemo<EChartsOption>(() => {
    const entries = Object.entries(result?.data.sourceCounts ?? {}).sort((a, b) => b[1] - a[1]);
    return {
      color: [tokens.accent],
      tooltip: tooltip(tokens, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
      grid: GRID,
      xAxis: { type: 'value', minInterval: 1, ...valAxis(tokens) },
      yAxis: { type: 'category', data: entries.map(([source]) => source), ...catAxis(tokens) },
      series: [{ type: 'bar', data: entries.map(([, count]) => count), barMaxWidth: 26 }],
    };
  }, [result, tokens]);

  return (
    <div>
      <section className="search-hero">
        <Badge variant="accent">新聞限定 Demo</Badge>
        <h1>搜尋關鍵字，查看新聞聲量與熱度</h1>
        <p>即時查詢啟用的官方新聞 RSS；Worker 不可用時會改讀 GitHub Pages 最後快照並清楚標示。</p>
        <form className="search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="news-query">新聞關鍵字</label>
          <input
            id="news-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：台積電、颱風、立法院"
            minLength={2}
            maxLength={50}
          />
          <select value={range} onChange={(event) => setRange(event.target.value as SearchRange)} aria-label="搜尋時間範圍">
            {RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="btn search-submit" type="submit" disabled={searching}>
            {searching ? '搜尋中…' : '搜尋新聞'}
          </button>
        </form>
        {searchError && <p className="form-error" role="alert">{searchError}</p>}
      </section>

      <section className="trends-section" aria-labelledby="trends-title">
        <div className="section-row">
          <div>
            <h2 id="trends-title">台灣 Google 熱門搜尋</h2>
            <p>
              官方 Trending Now RSS 摘要，非完整 Google Trends 圖表；Google 約平均每 10 分鐘更新。
              {trends && <> <a href={trends.data.sourceUrl} target="_blank" rel="noreferrer noopener">查看資料源 ↗</a></>}
            </p>
          </div>
          {trends && <Badge variant={trends.data.stale ? 'warning' : 'good'} dot>{trends.data.stale ? '快照' : 'RSS 更新'}</Badge>}
        </div>
        {trendsError ? (
          <Banner variant="warning">Google Trends 目前無法載入：{trendsError}</Banner>
        ) : !trends ? (
          <LoadingState label="讀取台灣熱門搜尋…" />
        ) : (
          <div className="trend-chips">
            {trends.data.items.slice(0, 12).map((item) => (
              <button key={`${item.title}-${item.publishedAt}`} type="button" onClick={() => void runSearch(item.title)}>
                <strong>{item.title}</strong>
                <span>{item.approximateTraffic || '未提供搜尋量'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {searching && <LoadingState label="正在比對新聞來源…" />}
      {result && !searching && (
        <section className="search-results" aria-live="polite">
          <div className="section-row">
            <div>
              <h2>「{result.data.query}」分析結果</h2>
              <p>資料產生時間：{fmtDateTime(result.generatedAt)}</p>
            </div>
            <Badge variant={result.data.stale ? 'warning' : result.data.status === 'partial' ? 'serious' : 'good'} dot>
              {result.data.stale ? '最後快照' : result.data.status === 'partial' ? '部分來源異常' : '即時來源'}
            </Badge>
          </div>
          {result.data.stale && (
            <Banner variant="warning">目前顯示最後成功快照，不代表此刻完整新聞結果。</Banner>
          )}
          <div className="grid cols-4">
            <StatTile label="新聞熱度" value={result.data.metrics.heat} sub="0–100（新聞限定）" />
            <StatTile label="相關新聞" value={fmtNum(result.data.metrics.mentions)} sub={`範圍：${range}`} />
            <StatTile label="來源數" value={result.data.metrics.sourceCount} sub="去重後獨立來源" />
            <StatTile label="加速度" value={`${Math.round(result.data.metrics.acceleration * 100)}%`} sub="前後半區間比較" />
          </div>
          {result.data.items.length === 0 ? (
            <EmptyState title="這個範圍沒有相符新聞" desc="可換關鍵字、放寬時間，或稍後再試。" />
          ) : (
            <>
              <div className="grid cols-2">
                <Card title="新聞聲量趨勢" hint="依所選時間範圍分桶"><Chart option={timelineOption} height={280} /></Card>
                <Card title="來源分布" hint="相符新聞篇數"><Chart option={sourceOption} height={280} /></Card>
              </div>
              <Card title="相關新聞" hint="僅顯示標題、短摘要、時間與原文連結">
                <div className="news-list">
                  {result.data.items.map((item) => (
                    <article key={item.id} className="news-item">
                      <div className="news-item__meta">
                        <SourceTag id={item.source} />
                        <span>{fmtDateTime(item.publishedAt)}</span>
                      </div>
                      <h3><a href={item.url} target="_blank" rel="noreferrer noopener">{item.title}</a></h3>
                      {item.excerpt && <p>{item.excerpt}</p>}
                    </article>
                  ))}
                </div>
              </Card>
            </>
          )}
        </section>
      )}
    </div>
  );
}
