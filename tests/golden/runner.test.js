#!/usr/bin/env node
/**
 * Golden scenario runner for Nordpool API acceptance tests.
 *
 *   INTEGRATION_TESTS=1 API_URL=http://127.0.0.1:3001 node tests/golden/runner.test.js
 *
 * Exits 0 when INTEGRATION_TESTS is not 1 (CI unit job safe).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTEGRATION = process.env.INTEGRATION_TESTS === '1';
const API_URL = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const SCENARIOS_PATH = process.env.GOLDEN_SCENARIOS
  || path.join(__dirname, 'scenarios.json');

function loadScenarios() {
  const raw = fs.readFileSync(SCENARIOS_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('scenarios.json must be an array');
  return data;
}

function statusOk(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

async function runScenario(scenario) {
  const url = `${API_URL}${scenario.path}`;
  const res = await fetch(url, {
    method: scenario.method || 'GET',
    headers: scenario.headers || {},
  });
  const body = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text();

  if (!statusOk(res.status, scenario.expectStatus)) {
    throw new Error(
      `[${scenario.id}] expected status ${JSON.stringify(scenario.expectStatus)}, got ${res.status}`,
    );
  }

  if (scenario.expectBody && typeof body === 'object') {
    for (const [key, value] of Object.entries(scenario.expectBody)) {
      if (body[key] !== value) {
        throw new Error(
          `[${scenario.id}] expected body.${key}=${JSON.stringify(value)}, got ${JSON.stringify(body[key])}`,
        );
      }
    }
  }

  if (scenario.expectBodyKeys && typeof body === 'object') {
    for (const key of scenario.expectBodyKeys) {
      if (!(key in body)) {
        throw new Error(`[${scenario.id}] missing body key: ${key}`);
      }
    }
  }

  if (scenario.expectMeta && typeof body === 'object' && body.meta) {
    for (const [key, value] of Object.entries(scenario.expectMeta)) {
      if (body.meta[key] !== value) {
        throw new Error(
          `[${scenario.id}] expected meta.${key}=${JSON.stringify(value)}, got ${JSON.stringify(body.meta[key])}`,
        );
      }
    }
  }

  if (scenario.expectDataFirstPrice != null && typeof body === 'object' && body.data?.lt?.length) {
    const firstPrice = body.data.lt[0].price;
    if (firstPrice !== scenario.expectDataFirstPrice) {
      throw new Error(
        `[${scenario.id}] expected first lt price ${scenario.expectDataFirstPrice}, got ${firstPrice}`,
      );
    }
  }

  console.log(`PASS ${scenario.id}: ${scenario.description || scenario.path}`);
}

async function main() {
  if (!INTEGRATION) {
    console.log('golden-runner: SKIP (set INTEGRATION_TESTS=1 to run)');
    process.exit(0);
  }

  const scenarios = loadScenarios();
  let failed = 0;
  for (const scenario of scenarios) {
    try {
      await runScenario(scenario);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${scenario.id}: ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
