import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

test('health endpoint returns schema v2 and localhost CORS', async () => {
  const request = new Request('https://worker.example/api/health', {
    headers: { Origin: 'http://localhost:5173' },
  });
  const response = await worker.fetch(request, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  assert.equal(body.schemaVersion, '2.0.0');
  assert.equal(body.data.status, 'ok');
});

test('search endpoint rejects an invalid query before upstream requests', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/search?q=台&range=24h'), {});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_QUERY' });
});

test('non-read methods are rejected', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health', { method: 'POST' }), {});
  assert.equal(response.status, 405);
});
