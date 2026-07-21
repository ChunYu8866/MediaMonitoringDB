import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EChartsOption } from 'echarts';
import { useData } from '../api/useData';
import type { KeywordsData, Meta, RecentData, SourcesData } from '../types/contracts';
import { Chart } from '../components/Chart';
import {
  Banner,
  Card,
  ErrorState,
  Freshness,
  HeatBar,
  LoadingState,
  SkeletonCards,
  SourceTag,
  StatTile,
} from '../components/ui';
import { useChartTokens } from '../lib/theme';
import { GRID, catAxis, sparkline, tooltip, valAxis } from '../lib/charts';
import { fmtCompact, fmtNum, fmtRelative, fmtTime } from '../lib/format';
import { sourceShort, sourceColorValue } from '../lib/sources';
import type { SourceId } from '../types/contracts';

export function OverviewPage() {
  const meta = useData<Meta>('meta');
  const kw = useData<KeywordsData>('keywords');
  const sources = useData<SourcesData>('sources');
  const recent = useData<RecentData>('recent');
  const tokens = useChartTokens();
  // 趨勢時間範圍（點數；每點 5 分鐘）：12=1h、24=2h、48=4h
  const [rangePoints, setRangePoints] = useState(48);

  const err = kw.error || meta.error;
  if (err) return <ErrorState error={err} onRetry={() => { kw.reload(); meta.reload(); }} />;

  const keywords = kw.data?.keywords ?? [];
  const staleSources = (sources.data?.sources ?? []).filter((s) => s.stale);
  const topN = keywords.slice(0, 5);

  const totalMentions = keywords.reduce((a, k) => a + k.mentions60m, 0);
  const hottest = keywords[0];

  // 熱度趨勢（前 5 詞多線）；依所選時間範圍取尾段
  const sliceTail = <T,>(arr: T[]) => arr.slice(-rangePoints);
  const labelInterval = rangePoints <= 12 ? 1 : rangePoints <= 24 ? 3 : 7;
  const trendOption: EChartsOption = {
    color: tokens.series,
    tooltip: tooltip(tokens, { trigger: 'axis' }),
    legend: {
      top: 0,
      textStyle: { color: tokens.secondary, fontSize: 12 },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
    },
    grid: { ...GRID, top: 40 },
    xAxis: {
      type: 'category',
      data: sliceTail(topN[0]?.trend ?? []).map((p) => fmtTime(p.t)),
      ...catAxis(tokens),
      axisLabel: { color: tokens.muted, fontSize: 11, interval: labelInterval },
    },
    yAxis: { type: 'value', min: 0, max: 100, ...valAxis(tokens) },
    series: topN.map((k) => ({
      name: k.term,
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      data: sliceTail(k.trend).map((p) => p.heat),
    })),
  };

  const RANGES: [number, string][] = [
    [12, '1 小時'],
    [24, '2 小時'],
    [48, '4 小時'],
  ];

  // 來源聲量占比（近 60 分鐘，跨所有關鍵字加總）
  const srcAgg: Record<string, number> = {};
  keywords.forEach((k) =>
    Object.entries(k.sourceShare).forEach(([s, share]) => {
      srcAgg[s] = (srcAgg[s] ?? 0) + (share ?? 0) * k.mentions60m;
    }),
  );
  const srcData = Object.entries(srcAgg)
    .map(([s, v]) => ({
      name: sourceShort(s as SourceId),
      value: Math.round(v),
      itemStyle: { color: sourceColorValue(s as SourceId, tokens) },
    }))
    .sort((a, b) => b.value - a.value);
  const donutOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'item', formatter: '{b}：{c}（{d}%）' }),
    legend: { bottom: 0, textStyle: { color: tokens.secondary, fontSize: 12 }, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
        label: { show: false },
        data: srcData,
      },
    ],
  };

  return (
    <>
      <div className="page-head">
        <h1>總覽</h1>
        <p>
          即時關鍵字熱度、聲量與來源分布的整體視圖。資料由 GitHub Actions 定期擷取公開來源後產生靜態快照，
          更新採 best effort，不保證固定間隔。
        </p>
      </div>

      <Banner variant="info" icon="🧪">
        目前顯示的是 <strong>示範資料</strong>（Phase 3 前端）。之後會由 Python 快／深／SEO 管線產生真實資料取代。
      </Banner>

      {staleSources.length > 0 && (
        <Banner variant="warning">
          有 {staleSources.length} 個來源資料過期（{staleSources.map((s) => sourceShort(s.id)).join('、')}）。
          系統沿用上次成功資料並標示，其他來源不受影響。詳見{' '}
          <Link to="/method">方法與狀態</Link>。
        </Banner>
      )}

      {/* Stat tiles */}
      {kw.loading || meta.loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid cols-4">
          <StatTile
            label="追蹤關鍵字"
            value={fmtNum(keywords.length)}
            sub={`${keywords.filter((k) => k.kind === 'manual').length} 監測詞 · ${keywords.filter((k) => k.kind === 'auto').length} 自動熱詞`}
            icon="🔥"
          />
          <StatTile
            label="最高熱度"
            value={hottest ? hottest.heat.toFixed(0) : '—'}
            sub={hottest ? hottest.term : undefined}
            icon="📈"
          />
          <StatTile
            label="60 分鐘總聲量"
            value={fmtCompact(totalMentions)}
            sub="所有關鍵字提及數合計"
            icon="💬"
          />
          <StatTile
            label="快管線更新"
            value={fmtRelative(meta.data?.lastFastAt ?? null)}
            sub={`深度分析 ${fmtRelative(meta.data?.lastDeepAt ?? null)}`}
            icon="⏱️"
          />
        </div>
      )}

      {/* Trend + sources */}
      <div className="grid wide-left" style={{ marginTop: 16 }}>
        <Card
          title="熱度趨勢（前 5 名）"
          hint="每 5 分鐘一點 · 0–100"
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(([pts, label]) => (
                <button
                  key={pts}
                  className={`segbtn${rangePoints === pts ? ' active' : ''}`}
                  style={{ padding: '3px 10px', fontSize: 12.5 }}
                  onClick={() => setRangePoints(pts)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {kw.loading ? <LoadingState /> : <Chart option={trendOption} height={300} />}
        </Card>
        <Card title="來源聲量占比" hint="近 60 分鐘估計">
          {kw.loading ? <LoadingState /> : <Chart option={donutOption} height={300} />}
        </Card>
      </div>

      {/* Hot list + recent */}
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="即時熱詞排行"
          right={<Link to="/keywords" className="small">查看全部 →</Link>}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {keywords.slice(0, 8).map((k, i) => (
              <div
                key={k.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 64px 120px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 0',
                  borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className="num muted" style={{ fontSize: 13 }}>{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    className={`kind-tag kind-tag--${k.kind}`}
                  >
                    {k.kind === 'manual' ? '監測' : '自動'}
                  </span>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.term}
                  </span>
                </span>
                <span style={{ height: 26 }}>
                  <Chart
                    option={sparkline(k.trend.map((p) => p.heat), tokens.series[i % tokens.series.length])}
                    height={26}
                  />
                </span>
                <HeatBar heat={k.heat} />
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="近期內容"
          hint="僅短前言與原文連結"
          right={<Freshness at={recent.envelope?.generatedAt ?? null} />}
        >
          {recent.loading ? (
            <LoadingState />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(recent.data?.items ?? []).slice(0, 7).map((it) => (
                <a
                  key={it.id}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    display: 'block',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--border)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <SourceTag id={it.source} />
                    <span className="small muted">· {fmtRelative(it.publishedAt)}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{it.title}</div>
                  <div className="small muted" style={{ marginTop: 2 }}>{it.excerpt}</div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>

    </>
  );
}
