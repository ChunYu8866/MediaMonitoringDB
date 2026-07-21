import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { useData } from '../api/useData';
import type { Keyword, KeywordsData, KeywordKind } from '../types/contracts';
import { Chart } from '../components/Chart';
import { Card, ErrorState, HeatBar, LoadingState } from '../components/ui';
import { useChartTokens } from '../lib/theme';
import { GRID, catAxis, tooltip, valAxis } from '../lib/charts';
import { fmtNum, fmtPct, fmtTime } from '../lib/format';
import { sourceShort } from '../lib/sources';

type Filter = 'all' | KeywordKind;

const COMPONENT_META = [
  { key: 'volume', label: 'V 聲量', desc: '近 60 分鐘提及數（log1p）在當期關鍵字中的百分位' },
  { key: 'acceleration', label: 'A 加速度', desc: '近 15 分鐘相對前 15 分鐘的正向成長率，5 倍封頂' },
  { key: 'diversity', label: 'D 來源多樣性', desc: '來源分布熵正規化；跨來源者較高' },
  { key: 'engagement', label: 'E 互動', desc: '各來源可取得的互動數正規化；無互動數時不計為 0' },
] as const;

export function KeywordsPage() {
  const kw = useData<KeywordsData>('keywords');
  const tokens = useChartTokens();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const keywords = kw.data?.keywords ?? [];
  const filtered = useMemo(
    () => keywords.filter((k) => filter === 'all' || k.kind === filter),
    [keywords, filter],
  );
  const selected: Keyword | null =
    filtered.find((k) => k.id === selectedId) ?? filtered[0] ?? null;

  if (kw.error) return <ErrorState error={kw.error} onRetry={kw.reload} />;

  // 排行長條圖
  const top = filtered.slice(0, 12);
  const barOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
    grid: { ...GRID, left: 8 },
    xAxis: { type: 'value', min: 0, max: 100, ...valAxis(tokens) },
    yAxis: {
      type: 'category',
      inverse: true,
      data: top.map((k) => k.term),
      ...catAxis(tokens),
      axisLabel: { color: tokens.secondary, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: top.map((k) => ({
          value: k.heat,
          itemStyle: {
            color: k.heat >= 70 ? tokens.negative : k.heat >= 40 ? '#ec835a' : tokens.accent,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: '58%',
        label: { show: true, position: 'right', color: tokens.secondary, fontSize: 11, formatter: '{c}' },
      },
    ],
  };

  return (
    <>
      <div className="page-head">
        <h1>關鍵字熱度</h1>
        <p>
          同時追蹤人工監測詞與系統自動熱詞。熱度為 0–100，由聲量、加速度、來源多樣性與互動四個分量加權，
          所有分量與權重皆公開可重算。
        </p>
      </div>

      {/* 篩選 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['all', '全部'],
          ['manual', '人工監測詞'],
          ['auto', '自動熱詞'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            className={`mobile-nav__link${filter === f ? ' active' : ''}`}
            style={{ display: 'inline-block' }}
            onClick={() => setFilter(f)}
          >
            {label}
            {f !== 'all' && (
              <span className="num" style={{ opacity: 0.7 }}>
                {' '}
                {keywords.filter((k) => k.kind === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {kw.loading ? (
        <LoadingState />
      ) : (
        <div className="grid cols-2">
          <Card title="熱度排行" hint={`共 ${filtered.length} 個關鍵字`}>
            <Chart option={barOption} height={Math.max(280, top.length * 30)} />
          </Card>

          {selected && (
            <Card
              title={
                (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className={`kind-tag kind-tag--${selected.kind}`}>
                      {selected.kind === 'manual' ? '監測' : '自動'}
                    </span>
                    {selected.term}
                  </span>
                ) as never
              }
              hint={selected.aliases?.length ? `別名：${selected.aliases.join('、')}` : '公式分解'}
            >
              <KeywordDetail keyword={selected} />
            </Card>
          )}
        </div>
      )}

      {/* 完整表格 */}
      {!kw.loading && (
        <Card title="關鍵字明細" hint="點選任一列查看公式分解" >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>關鍵字</th>
                  <th>類型</th>
                  <th className="num">熱度</th>
                  <th style={{ width: 140 }}>熱度條</th>
                  <th className="num">60 分聲量</th>
                  <th>主要來源</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <tr
                    key={k.id}
                    onClick={() => setSelectedId(k.id)}
                    style={{
                      cursor: 'pointer',
                      background: selected?.id === k.id ? 'var(--accent-weak)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>{k.term}</td>
                    <td>
                      <span className={`kind-tag kind-tag--${k.kind}`}>
                        {k.kind === 'manual' ? '監測' : '自動'}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 650 }}>{k.heat.toFixed(0)}</td>
                    <td><HeatBar heat={k.heat} /></td>
                    <td className="num">{fmtNum(k.mentions60m)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(k.sourceShare)
                          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                          .slice(0, 2)
                          .map(([s, share]) => (
                            <span key={s} className="small muted">
                              {sourceShort(s as never)} {fmtPct(share ?? 0, 0)}
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function KeywordDetail({ keyword }: { keyword: Keyword }) {
  const tokens = useChartTokens();
  const c = keyword.components;

  const trendOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'axis' }),
    grid: { ...GRID, top: 16 },
    xAxis: {
      type: 'category',
      data: keyword.trend.map((p) => fmtTime(p.t)),
      ...catAxis(tokens),
      axisLabel: { color: tokens.muted, fontSize: 10, interval: 9 },
    },
    yAxis: { type: 'value', min: 0, max: 100, ...valAxis(tokens) },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: keyword.trend.map((p) => p.heat),
        lineStyle: { width: 2, color: tokens.accent },
        areaStyle: { color: tokens.accent, opacity: 0.14 },
      },
    ],
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <span className="stat__value num" style={{ fontSize: 30 }}>{keyword.heat.toFixed(0)}</span>
        <span className="muted small">目前熱度 / 100</span>
      </div>
      <Chart option={trendOption} height={140} />

      <div style={{ marginTop: 14 }}>
        <div className="card__hint" style={{ marginBottom: 8 }}>
          Heat = 100 × (0.45·V + 0.30·A + 0.15·D + 0.10·E)
          {c.engagement === null && '（此詞無互動數，E 權重已按比例重分配回 V/A/D）'}
        </div>
        {COMPONENT_META.map((m) => {
          const val = c[m.key as keyof typeof c] as number | null;
          const weight = c.weights[m.key as keyof typeof c.weights];
          const disabled = val === null;
          return (
            <div key={m.key} style={{ marginBottom: 10 }} title={m.desc}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                <span style={{ color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {m.label} {disabled && '（不適用）'}
                </span>
                <span className="num muted">
                  {disabled ? '—' : val!.toFixed(2)} × 權重 {weight.toFixed(2)}
                </span>
              </div>
              <div className="heatbar">
                <div
                  className="heatbar__fill"
                  style={{
                    width: `${disabled ? 0 : (val ?? 0) * 100}%`,
                    background: disabled ? 'var(--grid)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
