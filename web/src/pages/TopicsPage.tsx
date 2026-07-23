import type { Topic, TopicsData } from '../types/contracts';
import { useData } from '../api/useData';
import { Banner, Card, EmptyState, ErrorState, Freshness, LoadingState, SourceTag } from '../components/ui';
import { fmtRelative } from '../lib/format';
import { sourceShort } from '../lib/sources';

function SentimentBar({ s }: { s: Topic['sentiment'] }) {
  const seg = [
    { v: s.positive, c: 'var(--sent-positive)', label: '正向' },
    { v: s.neutral, c: 'var(--sent-neutral)', label: '中立' },
    { v: s.negative, c: 'var(--sent-negative)', label: '負向' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {seg.map((x) => (
          <div key={x.label} style={{ width: `${x.v * 100}%`, background: x.c }} title={`${x.label} ${(x.v * 100).toFixed(0)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        {seg.map((x) => (
          <span key={x.label} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className="dot" style={{ background: x.c }} />
            <span className="muted">{x.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>{(x.v * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 16 }}>{topic.label}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {topic.terms.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <span className="badge badge--muted num" style={{ flex: 'none' }}>{topic.size} 篇</span>
      </div>

      <div style={{ margin: '14px 0' }}>
        <SentimentBar s={topic.sentiment} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="card__hint" style={{ marginBottom: 6 }}>來源標題或 RSS 短摘要片段（可點擊追溯）</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {topic.summarySentences.map((s, i) => (
            <li key={i} style={{ fontSize: 13.5 }}>
              {s.text}{' '}
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="small">
                （{sourceShort(s.source)}）
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div className="card__hint" style={{ marginBottom: 6 }}>代表內容</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topic.articles.map((a, i) => (
            <a
              className="topic-article"
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <SourceTag id={a.source} />
              <span className="topic-article__title">
                {a.title}
              </span>
              <span className="small muted topic-article__time">{fmtRelative(a.publishedAt)}</span>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function TopicsPage() {
  const t = useData<TopicsData>('topics');

  if (t.error) return <ErrorState error={t.error} onRetry={t.reload} />;

  const topics = t.data?.topics ?? [];

  return (
    <>
      <div className="page-head">
        <h1>事件與主題</h1>
        <p>
          以可檢查的關鍵詞規則將真實新聞快照分組。文字只取自來源標題或 RSS 短摘要，
          連結直接對應該筆新聞。
        </p>
      </div>

      {t.data?.experimental && (
        <Banner variant="warning" icon="🧪">
          <strong>實驗性分組：</strong>主題為關鍵詞規則結果；尚未執行可驗證的情緒分類，因此情緒欄統一保守標示為中立。
        </Banner>
      )}
      {t.data?.stale && (
        <Banner variant="serious">深度分析為過期資料，沿用上次成功結果；即時聲量與熱度仍持續更新。</Banner>
      )}

      {t.loading ? (
        <LoadingState label="載入主題分析中…" />
      ) : topics.length === 0 ? (
        <EmptyState title="尚無主題" desc="累積足夠內容後，深度管線會產生主題聚類與摘要。" icon="🗂️" />
      ) : (
        <>
          <div style={{ textAlign: 'right', marginBottom: 10 }}>
            <Freshness at={t.envelope?.generatedAt ?? null} label="深度分析更新於" />
          </div>
          <div className="grid cols-2">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
