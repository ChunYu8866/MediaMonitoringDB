// 從 config/*.yml 產生 Worker 用的 JS 設定，讓 YAML 維持單一真相來源。
// 由 npm run gen-config（deploy/test 前自動執行）呼叫；輸出檔會提交進 git。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const watch = yaml.load(readFileSync(resolve(repoRoot, 'config/watch_terms.yml'), 'utf8')) || {};
const entities = yaml.load(readFileSync(resolve(repoRoot, 'config/entities.yml'), 'utf8')) || {};

const watchTerms = (watch.watch_terms || []).map((entry) => ({
  id: entry.id ?? entry.display,
  display: entry.display,
  anyOf: entry.any_of || [entry.display],
  exclude: entry.exclude || [],
}));

const autoRaw = watch.auto_terms || {};
const autoTerms = {
  maxTerms: autoRaw.max_terms ?? 10,
  minDocs: autoRaw.min_docs ?? 5,
  minSources: autoRaw.min_sources ?? 3,
  minLength: autoRaw.min_length ?? 2,
  stopwords: autoRaw.stopwords || [],
};

const orgs = (entities.orgs || []).map((entry) =>
  typeof entry === 'string' ? { name: entry, aliases: [] } : { name: entry.name, aliases: entry.aliases || [] },
);

const banner = '// 自動產生檔，請勿手改。來源：config/watch_terms.yml 與 config/entities.yml；重跑 `npm run gen-config`。\n';
const body =
  banner +
  `export const WATCH_TERMS = ${JSON.stringify(watchTerms, null, 2)};\n\n` +
  `export const AUTO_TERMS = ${JSON.stringify(autoTerms, null, 2)};\n\n` +
  `export const ORG_LEXICON = ${JSON.stringify(orgs, null, 2)};\n`;

writeFileSync(resolve(here, '..', 'src', 'generated-config.js'), body);
console.log(`gen-config: ${watchTerms.length} watch terms, ${autoTerms.maxTerms} auto max, ${orgs.length} orgs`);
