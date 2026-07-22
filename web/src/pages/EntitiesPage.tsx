import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { useData } from '../api/useData';
import type { EntitiesData } from '../types/contracts';
import { Chart } from '../components/Chart';
import { Banner, Card, EmptyState, ErrorState, Freshness, LoadingState } from '../components/ui';
import { useChartTokens } from '../lib/theme';
import { tooltip } from '../lib/charts';

export function EntitiesPage() {
  const e = useData<EntitiesData>('entities');
  const tokens = useChartTokens();

  const graphOption = useMemo<EChartsOption>(() => {
    const nodes = e.data?.nodes ?? [];
    const edges = e.data?.edges ?? [];
    const orgColor = tokens.series[0];
    const personColor = tokens.series[5];
    const maxM = Math.max(1, ...nodes.map((n) => n.mentions));

    return {
      tooltip: tooltip(tokens, {
        formatter: (p: { dataType: string; data: { name?: string; value?: number; type?: string; w?: number; source?: string; target?: string } }) => {
          if (p.dataType === 'edge') {
            return `${p.data.source} — ${p.data.target}<br/>共現文件：${p.data.w}`;
          }
          return `${p.data.name}<br/>${p.data.type === 'PERSON' ? '人物' : '組織'} · 出現 ${p.data.value} 篇`;
        },
      }),
      legend: {
        data: ['組織 ORG', '人物 PERSON'],
        top: 0,
        textStyle: { color: tokens.secondary },
        icon: 'circle',
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 320, edgeLength: [60, 140], gravity: 0.08 },
          label: {
            show: true,
            color: tokens.text,
            fontSize: 12,
            position: 'right',
          },
          lineStyle: { color: tokens.baseline, opacity: 0.6, curveness: 0.05 },
          emphasis: { focus: 'adjacency', lineStyle: { width: 3, color: tokens.accent } },
          categories: [
            { name: '組織 ORG', itemStyle: { color: orgColor } },
            { name: '人物 PERSON', itemStyle: { color: personColor } },
          ],
          data: nodes.map((n) => ({
            id: n.id,
            name: n.name,
            value: n.mentions,
            type: n.type,
            category: n.type === 'PERSON' ? 1 : 0,
            symbolSize: 14 + (n.mentions / maxM) * 34,
          })),
          links: edges.map((l) => ({
            source: l.source,
            target: l.target,
            w: l.weight,
            lineStyle: { width: 1 + l.weight * 0.6 },
          })),
        },
      ],
    };
  }, [e.data, tokens]);

  if (e.error) return <ErrorState error={e.error} onRetry={e.reload} />;

  const nodes = e.data?.nodes ?? [];
  const edges = e.data?.edges ?? [];
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const topEdges = [...edges].sort((a, b) => b.weight - a.weight).slice(0, 10);

  return (
    <>
      <div className="page-head">
        <h1>組織共現網絡</h1>
        <p>
          以公開的組織詞典比對新聞標題與短摘要（近 24 小時），兩個組織出現在同一篇即建立連線，權重為獨立文件數。
          全程為可重算的字面統計，不使用模型推論。
        </p>
      </div>

      <Banner variant="warning" icon="⚠️">
        <strong>「共現」不代表支持、反對或因果關係</strong>，只表示兩者在同一篇內容中一起被提到。此為研究性統計，請勿據此推論立場。
      </Banner>
      {e.data?.experimental && (
        <Banner variant="serious" icon="🧪">
          涵蓋範圍限詞典內的組織名稱；詞典外的實體不會出現在圖中。人物（PERSON）辨識尚未啟用。
        </Banner>
      )}

      {e.loading ? (
        <LoadingState label="載入關係圖中…" />
      ) : nodes.length === 0 ? (
        <EmptyState title="尚無實體資料" desc="近 24 小時的新聞中，詞典組織的共現次數還不足以建圖。" icon="🕸️" />
      ) : (
        <div className="grid wide-left">
          <Card
            title="共現網絡"
            hint="節點大小＝出現篇數 · 連線粗細＝共現文件數 · 可拖曳/縮放"
            right={<Freshness at={e.envelope?.generatedAt ?? null} label="更新於" />}
          >
            <Chart option={graphOption} height={440} />
          </Card>

          <Card title="最強共現配對" hint="依共現文件數排序">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>配對</th>
                    <th className="num">共現文件</th>
                  </tr>
                </thead>
                <tbody>
                  {topEdges.map((ed, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{nameOf(ed.source)}</span>
                        <span className="muted"> — </span>
                        <span style={{ fontWeight: 600 }}>{nameOf(ed.target)}</span>
                      </td>
                      <td className="num">{ed.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
