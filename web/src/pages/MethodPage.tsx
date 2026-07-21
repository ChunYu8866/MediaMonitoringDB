import { useData } from '../api/useData';
import type { Meta, SourcesData } from '../types/contracts';
import { Banner, Card, ErrorState, LoadingState, StatusBadge } from '../components/ui';
import { fmtDateTime, fmtRelative } from '../lib/format';

export function MethodPage() {
  const meta = useData<Meta>('meta');
  const sources = useData<SourcesData>('sources');

  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />;

  const m = meta.data;
  const srcs = sources.data?.sources ?? [];

  return (
    <>
      <div className="page-head">
        <h1>方法與狀態</h1>
        <p>資料來源、使用邊界、更新時間、模型版本與研究限制。所有指標都能回到來源與方法，維持可追溯與可重算。</p>
      </div>

      {m && m.scheduleDaysUntilPause !== null && m.scheduleDaysUntilPause < 60 && (
        <Banner variant="warning" icon="⏰">
          <strong>排程健康提醒：</strong>公開 repository 若連續 60 天沒有活動，GitHub 會自動停用排程工作。
          估計約 <strong className="num">{m.scheduleDaysUntilPause}</strong> 天後可能停用，請定期確認 Actions 排程仍啟用。
        </Banner>
      )}
      {m?.stateRestoreFailed && (
        <Banner variant="serious">無法還原上一版公開快照，歷史資料可能不完整（stateRestoreFailed）。</Banner>
      )}

      {/* 更新狀態 */}
      <Card title="更新狀態">
        {meta.loading ? (
          <LoadingState />
        ) : (
          <div className="grid cols-3" style={{ gap: 14 }}>
            <TimeStat label="快管線（聲量／熱度）" at={m?.lastFastAt ?? null} />
            <TimeStat label="深度分析（情緒／主題／關係）" at={m?.lastDeepAt ?? null} />
            <TimeStat label="SEO（每日）" at={m?.lastSeoAt ?? null} />
          </div>
        )}
        {m && (
          <div className="small muted" style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <span>方法版本：<strong>{m.methodVersion}</strong></span>
            <span>資料保留：5 分鐘 bucket {m.coverage.fastBucketHours} 小時 · 小時彙總 {m.coverage.hourlyDays} 天 · 每日彙總 {m.coverage.dailyDays} 天</span>
          </div>
        )}
      </Card>

      {/* 來源健康 */}
      <div style={{ marginTop: 16 }}>
        <Card title="資料來源狀態" hint="任一來源失敗不會阻擋其他來源發布；失敗者標示過期並沿用上次成功資料">
          {sources.loading ? (
            <LoadingState />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>來源</th>
                    <th>狀態</th>
                    <th>最後嘗試</th>
                    <th>最後成功</th>
                    <th className="num">項目數</th>
                    <th>錯誤碼</th>
                  </tr>
                </thead>
                <tbody>
                  {srcs.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.displayName}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{s.lastAttemptAt ? fmtRelative(s.lastAttemptAt) : '—'}</td>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{s.lastSuccessAt ? fmtRelative(s.lastSuccessAt) : '—'}</td>
                      <td className="num">{s.itemCount}</td>
                      <td className="small">{s.errorCode ? <code>{s.errorCode}</code> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {srcs.map((s) => (
              <div key={s.id} className="small" style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontWeight: 600, flex: 'none', minWidth: 90 }}>{s.displayName}</span>
                <span className="muted">{s.usageNote}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 熱度公式 */}
      <div style={{ marginTop: 16 }}>
        <Card title="熱度計算方法">
          <p className="small" style={{ marginTop: 0 }}>每個關鍵字每 5 分鐘計算一次，固定落在 0–100：</p>
          <div
            style={{
              background: 'var(--page)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13.5,
              margin: '4px 0 12px',
            }}
          >
            Heat = 100 × (0.45·V + 0.30·A + 0.15·D + 0.10·E)
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li><strong>V 聲量</strong>：近 60 分鐘提及數取 log1p 後，於同批關鍵字做百分位正規化。</li>
            <li><strong>A 加速度</strong>：近 15 分鐘相對前 15 分鐘的正向成長率，以 5 倍成長封頂。</li>
            <li><strong>D 來源多樣性</strong>：來源分布熵除以最大熵；只有單一來源時為 0。</li>
            <li><strong>E 互動</strong>：僅使用來源確實提供的互動數，先在各來源內正規化再合併。</li>
            <li>若來源無互動欄位，<strong>E 不當成 0</strong>，其權重按比例重分配回 V／A／D。</li>
          </ul>
        </Card>
      </div>

      {/* 研究限制 */}
      <div style={{ marginTop: 16 }}>
        <Card title="研究限制與資料邊界">
          <div className="grid cols-2" style={{ gap: 12 }}>
            {LIMITS.map((l) => (
              <div key={l.title} style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 18, flex: 'none' }}>{l.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{l.title}</div>
                  <div className="small muted">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="small muted" style={{ marginTop: 20, textAlign: 'center' }}>
        本快照產生時間：{fmtDateTime(meta.envelope?.generatedAt ?? null)} · 更新採 best effort，不宣稱固定間隔 SLA。
      </p>
    </>
  );
}

function TimeStat({ label, at }: { label: string; at: string | null }) {
  return (
    <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12 }}>
      <div className="small muted">{label}</div>
      <div style={{ fontWeight: 650, fontSize: 15 }}>{fmtRelative(at)}</div>
      <div className="small muted num">{fmtDateTime(at)}</div>
    </div>
  );
}

const LIMITS = [
  { icon: '🗳️', title: '不代表整體民意', desc: '樣本來自特定公開來源，僅為研究指標，不能推論台灣整體民意。' },
  { icon: '🕸️', title: '共現不代表關係', desc: '人物／組織共現只表示一起被提到，不代表支持、敵對或因果。' },
  { icon: '🦋', title: 'Bluesky 樣本偏誤', desc: 'lang 不等於地理位置，Bluesky 樣本不代表台灣人口結構。' },
  { icon: '🔍', title: 'SEO 有延遲且獨立', desc: 'Search Console 是本站搜尋成效，非全網熱搜，資料延遲且不併入即時熱度。' },
  { icon: '⏱️', title: '排程為 best effort', desc: 'GitHub Actions 排程與 Pages 部署盡力而為，不保證 5 分鐘內完成。' },
  { icon: '🚫', title: 'PTT／Dcard 停用', desc: '未取得正式授權或研究 API 前不爬取，僅保留連接器介面。' },
  { icon: '🧪', title: '模型為實驗性', desc: '情緒與 NER 未達 F1 0.70 前標示實驗性，摘要採可追溯的抽取式。' },
  { icon: '🔒', title: '不公開敏感內容', desc: '不重製新聞全文或大量社群原文；快照與 log 不含任何 token 或憑證。' },
];
