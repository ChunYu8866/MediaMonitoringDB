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

/** 以 Vite base 為基準組出資料檔的完整路徑。 */
function dataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const sep = base.endsWith('/') ? '' : '/';
  return `${base}${sep}data/${name}.json`;
}

/**
 * 抓取單一資料檔並驗證外殼與 schema 主版本。
 * 失敗時丟出可辨識的錯誤，交由頁面呈現對應狀態。
 */
export async function fetchData<T>(name: string): Promise<Envelope<T>> {
  const url = dataUrl(name);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (err) {
    throw new DataFetchError(name, `無法連線取得 ${name}.json：${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new DataFetchError(name, `讀取 ${name}.json 失敗（HTTP ${res.status}）`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new DataFetchError(name, `${name}.json 內容不是有效 JSON`);
  }

  const env = json as Partial<Envelope<T>>;
  if (
    !env ||
    typeof env.schemaVersion !== 'string' ||
    typeof env.generatedAt !== 'string' ||
    env.data === undefined
  ) {
    throw new DataFetchError(name, `${name}.json 缺少必要外層欄位`);
  }
  if (majorOf(env.schemaVersion) !== SUPPORTED_SCHEMA_MAJOR) {
    throw new SchemaVersionError(name, env.schemaVersion);
  }
  return env as Envelope<T>;
}
