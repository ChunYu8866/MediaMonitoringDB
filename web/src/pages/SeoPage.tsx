import type { EChartsOption } from 'echarts';
import { useData } from '../api/useData';
import type { SeoData } from '../types/contracts';
import { Chart } from '../components/Chart';
import { Banner, Card, EmptyState, ErrorState, LoadingState, StatTile } from '../components/ui';
import { useChartTokens } from '../lib/theme';
import { GRID, catAxis, tooltip, valAxis } from '../lib/charts';
import { fmtDate, fmtFixed, fmtNum, fmtPct, fmtRelative } from '../lib/format';

export function SeoPage() {
  const seo = useData<SeoData>('seo');
  const tokens = useChartTokens();

  if (seo.error) return <ErrorState error={seo.error} onRetry={seo.reload} />;
  if (seo.loading) return <LoadingState label="載入 SEO 資料中…" />;

  const d = seo.data;
  if (!d || !d.connected) {
    return (
      <>
        <Head />
        <EmptyState
          title="尚未串接 Search Console"
          desc="完成 GitHub Pages URL-prefix property 驗證並在 Actions Secrets 設定 OAuth 憑證後，這裡會每日顯示本站 SEO 成效。新站在累積資料前顯示空狀態屬正常。"
          icon="🔍"
        />
      </>
    );
  }

  const dates = d.daily.map((x) => fmtDate(x.date + 'T00:00:00Z'));

  const impressionsOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'axis' }),
    grid: { ...GRID, top: 16 },
    xAxis: { type: 'category', data: dates, ...catAxis(tokens), axisLabel: { color: tokens.muted, fontSize: 10, interval: 5 } },
    yAxis: { type: 'value', ...valAxis(tokens) },
    series: [
      {
        name: '曝光',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: d.daily.map((x) => x.impressions),
        lineStyle: { width: 2, color: tokens.series[0] },
        areaStyle: { color: tokens.series[0], opacity: 0.14 },
      },
    ],
  };

  const clicksOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'axis' }),
    grid: { ...GRID, top: 16 },
    xAxis: { type: 'category', data: dates, ...catAxis(tokens), axisLabel: { color: tokens.muted, fontSize: 10, interval: 5 } },
    yAxis: { type: 'value', ...valAxis(tokens) },
    series: [
      {
        name: '點擊',
        type: 'bar',
        data: d.daily.map((x) => x.clicks),
        itemStyle: { color: tokens.series[4], borderRadius: [3, 3, 0, 0] },
        barWidth: '55%',
      },
    ],
  };

  const positionOption: EChartsOption = {
    tooltip: tooltip(tokens, { trigger: 'axis', valueFormatter: (v: number | string) => fmtFixed(Number(v), 1) }),
    grid: { ...GRID, top: 16 },
    xAxis: { type: 'category', data: dates, ...catAxis(tokens), axisLabel: { color: tokens.muted, fontSize: 10, interval: 5 } },
    // 平均排名越小越好 → 反轉 Y 軸
    yAxis: { type: 'value', inverse: true, ...valAxis(tokens) },
    series: [
      {
        name: '平均排名',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: d.daily.map((x) => x.position),
        lineStyle: { width: 2, color: tokens.series[6] },
      },
    ],
  };

  return (
    <>
      <Head />

      <Banner variant="info" icon="🔎">
        這是<strong>本站自己的 Google 搜尋成效</strong>（Search Console），<strong>不是全網熱搜或輿情資料</strong>。
        資料通常有 1–2 天延遲，最新一日為初步值，<strong>不會併入即時熱度公式</strong>。
      </Banner>
      {d.preliminary && (
        <Banner variant="warning">最新資料為 preliminary（初步、尚未定案），可能隨 Google 回填而變動。</Banner>
      )}

      <div className="grid cols-4">
        <StatTile label="總點擊（近 28 日）" value={fmtNum(d.totals.clicks)} icon="👆" />
        <StatTile label="總曝光（近 28 日）" value={fmtNum(d.totals.impressions)} icon="👁️" />
        <StatTile label="平均 CTR" value={fmtPct(d.totals.ctr)} icon="🎯" />
        <StatTile label="平均排名" value={fmtFixed(d.totals.position, 1)} sub="越小越好" icon="📍" />
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="每日曝光 Impressions"><Chart option={impressionsOption} height={220} /></Card>
        <Card title="每日點擊 Clicks"><Chart option={clicksOption} height={220} /></Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="平均排名趨勢" hint="Y 軸已反轉；線往上代表排名進步（數值變小）">
          <Chart option={positionOption} height={200} />
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card
          title="熱門搜尋詞（前 20）"
          hint="僅顯示曝光 ≥ 10 的查詢；其餘合併為「其他」。country 與 device 分開彙總以降低配額負載。"
        >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>搜尋詞</th>
                  <th className="num">點擊</th>
                  <th className="num">曝光</th>
                  <th className="num">CTR</th>
                  <th className="num">平均排名</th>
                </tr>
              </thead>
              <tbody>
                {d.topQueries.map((q) => (
                  <tr key={q.query}>
                    <td style={{ fontWeight: 600 }}>{q.query}</td>
                    <td className="num">{fmtNum(q.clicks)}</td>
                    <td className="num">{fmtNum(q.impressions)}</td>
                    <td className="num">{fmtPct(q.ctr)}</td>
                    <td className="num">{fmtFixed(q.position, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="small muted" style={{ marginTop: 16 }}>
        最後成功同步：{fmtRelative(d.lastSyncAt)}（{d.siteUrl}）。SEO 每日同步一次，不在 5 分鐘輿情管線中呼叫。
      </p>
    </>
  );
}

function Head() {
  return (
    <div className="page-head">
      <h1>網站 SEO 成效</h1>
      <p>
        來自 Google Search Console 的本站搜尋曝光、點擊、CTR 與平均排名。用於觀察 SEO 表現，與即時輿情熱度是不同資料，時間軸與更新頻率也不同。
      </p>
    </div>
  );
}
