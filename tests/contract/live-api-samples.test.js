import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const API_URL = (process.env.API_URL || process.env.LOCAL_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const LIVE = process.env.CONTRACT_LIVE === '1';
/** CI integration uses historical ci_seed.sql — /ready is not_ready until live sync data exists. */
const FIXTURE = process.env.CONTRACT_FIXTURE === '1';

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

  it('GET /ready returns structured checks', async () => {
    const ready = await fetchReady();
    assert.ok(ready, 'No /ready endpoint on API');
    const body = await ready.res.json();
    assert.ok(body.checks);
    assert.equal(typeof body.checks.postgres, 'boolean');
    assert.equal(typeof body.checks.price_data_fresh, 'boolean');

    if (FIXTURE) {
      assert.equal(ready.res.status, 503, `${ready.path} expected 503 on CI fixture`);
      assert.equal(body.status, 'not_ready');
      assert.equal(body.checks.postgres, true);
      assert.equal(body.checks.price_data_fresh, false);
      return;
    }

    if (body.checks.price_data_fresh) {
      assert.equal(ready.res.status, 200, `${ready.path} expected 200 when fresh`);
      assert.equal(body.status, 'ready');
    } else {
      assert.equal(ready.res.status, 503, `${ready.path} expected 503 when stale`);
      assert.equal(body.status, 'not_ready');
    }
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
