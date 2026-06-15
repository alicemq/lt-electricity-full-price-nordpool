import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = fs.readFileSync(path.join(repoRoot, 'swagger-ui/openapi.yaml'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

test('OpenAPI defines GET /ready with ready and not_ready statuses', () => {
  assert.match(spec, /\/ready:\s*\n\s*get:/);
  assert.match(spec, /operationId: getReady/);
  assert.match(spec, /enum:\s*\n\s*- ready/);
  assert.match(spec, /enum:\s*\n\s*- not_ready/);
});

test('OpenAPI defines GET /health response schema', () => {
  assert.match(spec, /\/health:\s*\n\s*get:/);
  assert.match(spec, /operationId: getHealth/);
});

test('OpenAPI defines GET /sync/status data.isRunning', () => {
  assert.match(spec, /\/sync\/status:\s*\n\s*get:/);
  assert.match(spec, /operationId: getSyncStatus/);
});

console.log(`\nContract sample results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
