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
const PRICES_PATH = process.env.GOLDEN_PRICES
  || path.join(__dirname, 'prices.json');

function loadJsonArray(filePath, label) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`${label} must be an array`);
  return data;
}

function loadScenarios() {
  return loadJsonArray(SCENARIOS_PATH, 'scenarios.json');
}

function loadPriceCases() {
  if (!fs.existsSync(PRICES_PATH)) return [];
  return loadJsonArray(PRICES_PATH, 'prices.json');
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

async function runPriceCase(priceCase) {
  const country = priceCase.country || 'lt';
  const pathSuffix = `/api/v1/nps/prices?date=${encodeURIComponent(priceCase.date)}&country=${encodeURIComponent(country)}`;
  const url = `${API_URL}${pathSuffix}`;
  const res = await fetch(url);
  const body = await res.json();

  if (res.status !== 200) {
    throw new Error(`[${priceCase.id}] expected status 200, got ${res.status}`);
  }
  if (body.success !== true) {
    throw new Error(`[${priceCase.id}] expected success true, got ${JSON.stringify(body.success)}`);
  }

  const metaChecks = {
    count: priceCase.expectCount,
    timezone: priceCase.expectTimezone,
    intervalSeconds: priceCase.expectIntervalSeconds,
  };
  for (const [key, value] of Object.entries(metaChecks)) {
    if (value == null) continue;
    if (body.meta?.[key] !== value) {
      throw new Error(
        `[${priceCase.id}] expected meta.${key}=${JSON.stringify(value)}, got ${JSON.stringify(body.meta?.[key])}`,
      );
    }
  }

  if (priceCase.expectFirstPrice != null) {
    const firstPrice = body.data?.[country]?.[0]?.price;
    if (firstPrice !== priceCase.expectFirstPrice) {
      throw new Error(
        `[${priceCase.id}] expected first ${country} price ${priceCase.expectFirstPrice}, got ${firstPrice}`,
      );
    }
  }

  console.log(`PASS ${priceCase.id}: ${priceCase.description || priceCase.date}`);
}

async function main() {
  if (!INTEGRATION) {
    console.log('golden-runner: SKIP (set INTEGRATION_TESTS=1 to run)');
    process.exit(0);
  }

  const scenarios = loadScenarios();
  const priceCases = loadPriceCases();
  let failed = 0;

  for (const scenario of scenarios) {
    try {
      await runScenario(scenario);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${scenario.id}: ${err.message}`);
    }
  }

  for (const priceCase of priceCases) {
    try {
      await runPriceCase(priceCase);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${priceCase.id}: ${err.message}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
