import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const API_URL = (process.env.API_URL || process.env.LOCAL_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const LIVE = process.env.CONTRACT_LIVE === '1';

async function apiReachable() {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    try {
      const res = await fetch(`${API_URL}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

async function fetchReady() {
  for (const path of ['/ready', '/api/v1/ready']) {
    const res = await fetch(`${API_URL}${path}`);
    if (res.status !== 404) {
      return { res, path };
    }
  }
  return null;
}

describe('live API contract samples', { skip: !LIVE }, () => {
  it('GET /api/v1/health returns success', async () => {
    assert.equal(await apiReachable(), true, `API not reachable at ${API_URL}`);
    const res = await fetch(`${API_URL}/api/v1/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok('overallStatus' in body);
  });

  it('GET /ready returns 200 when price data is fresh', async () => {
    const ready = await fetchReady();
    assert.ok(ready, 'No /ready endpoint on API');
    assert.equal(ready.res.status, 200, `${ready.path} expected 200`);
    const body = await ready.res.json();
    assert.equal(body.status, 'ready');
    assert.equal(body.checks.postgres, true);
    assert.equal(body.checks.price_data_fresh, true);
  });

  it('GET /api/v1/nps/prices returns today fixture or live data', async () => {
    const res = await fetch(`${API_URL}/api/v1/nps/prices?date=2024-06-15&country=lt`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.meta.count >= 24);
    assert.equal(body.meta.timezone, 'Europe/Vilnius');
    assert.ok(body.data.lt[0].price > 0);
  });
});

if (!LIVE) {
  const reachable = await apiReachable();
  if (reachable) {
    console.log('live API reachable; set CONTRACT_LIVE=1 to run live contract samples');
  }
}
