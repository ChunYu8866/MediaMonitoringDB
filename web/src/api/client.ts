/**
 * 讀取 GitHub Pages 上的靜態公開 JSON。
 * 前端不直接呼叫任何需要憑證的 API；一切資料皆來自建置時寫入的 data/*.json。
 */
import { SUPPORTED_SCHEMA_MAJOR, type Envelope } from '../types/contracts';

export class SchemaVersionError extends Error {
  constructor(
    public readonly file: string,
    public readonly got: string,
  ) {
    super(`不支援的資料版本：${file} 為 ${got}，前端支援主版本 ${SUPPORTED_SCHEMA_MAJOR}`);
    this.name = 'SchemaVersionError';
  }
}

export class DataFetchError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(message);
    this.name = 'DataFetchError';
  }
}

function majorOf(version: string): number {
  const n = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isNaN(n) ? -1 : n;
}

/** 以 Vite base 為基準組出 Pages 靜態資料檔的完整路徑（備援用）。 */
function pagesUrl(name: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const sep = base.endsWith('/') ? '' : '/';
  return `${base}${sep}data/${name}.json`;
}

/** Worker /api/data 端點（由 Cron 每 5 分鐘更新的即時快照）。未設定 API base 時為空。 */
function workerDataUrl(name: string): string | null {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return apiBase ? `${apiBase}/api/data?name=${encodeURIComponent(name)}` : null;
}

/** 由 Worker KV 提供的即時快照檔名；news-archive（7 天）與 trends 仍走 Pages/各自端點。 */
const WORKER_FILES = new Set(['meta', 'keywords', 'sources', 'recent', 'entities', 'topics']);

function validateEnvelope<T>(name: string, json: unknown): Envelope<T> {
  const env = json as Partial<Envelope<T>>;
  if (
    !env ||
    typeof env.schemaVersion !== 'string' ||
    typeof env.generatedAt !== 'string' ||
    env.data === undefined
  ) {
    throw new DataFetchError(name, `${name} 資料缺少必要外層欄位`);
  }
  if (majorOf(env.schemaVersion) !== SUPPORTED_SCHEMA_MAJOR) {
    throw new SchemaVersionError(name, env.schemaVersion);
  }
  return env as Envelope<T>;
}

async function fetchEnvelope<T>(name: string, url: string, cache: RequestCache): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache });
  } catch (err) {
    throw new DataFetchError(name, `無法連線取得 ${name}：${(err as Error).message}`);
  }
  if (!res.ok) throw new DataFetchError(name, `讀取 ${name} 失敗（HTTP ${res.status}）`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new DataFetchError(name, `${name} 內容不是有效 JSON`);
  }
  return validateEnvelope<T>(name, json);
}

/**
 * 抓取單一資料檔並驗證外殼與 schema 主版本。
 * 若設定了 Worker API base，優先讀 Worker 的即時快照（每 5 分鐘更新）；
 * Worker 尚未產生快照或連線失敗時，改讀 GitHub Pages 靜態檔（last-good）。
 */
export async function fetchData<T>(name: string): Promise<Envelope<T>> {
  const workerUrl = WORKER_FILES.has(name) ? workerDataUrl(name) : null;
  if (workerUrl) {
    try {
      return await fetchEnvelope<T>(name, workerUrl, 'no-store');
    } catch (err) {
      if (err instanceof SchemaVersionError) throw err;
      // Worker 無快照或離線 → 退回 Pages 靜態檔。
    }
  }
  return fetchEnvelope<T>(name, pagesUrl(name), 'no-cache');
}
