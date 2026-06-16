import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_E2E = path.join(ROOT, 'bin', 'run-e2e.sh');

function printConfig(args = []) {
  return spawnSync('bash', [RUN_E2E, '--print-config', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      FRONTEND_URL: 'http://127.0.0.1:5999',
      API_URL: 'http://127.0.0.1:3999',
      SKIP_WEB_SERVER: 'legacy-should-be-overridden',
    },
  });
}

function parseConfig(stdout) {
  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      }),
  );
}

test('run-e2e.sh passes bash -n', () => {
  const result = spawnSync('bash', ['-n', RUN_E2E], { cwd: ROOT });
  assert.equal(result.status, 0, result.stderr);
});

test('--frontend-only clears SKIP_WEB_SERVER', () => {
  const result = printConfig(['--frontend-only']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cfg = parseConfig(result.stdout);
  assert.equal(cfg.E2E_MODE, 'frontend-only');
  assert.equal(cfg.SKIP_WEB_SERVER, '');
  assert.equal(cfg.FRONTEND_URL, 'http://127.0.0.1:5999');
});

test('--with-stack sets SKIP_WEB_SERVER=1', () => {
  const result = printConfig(['--with-stack']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cfg = parseConfig(result.stdout);
  assert.equal(cfg.E2E_MODE, 'with-stack');
  assert.equal(cfg.SKIP_WEB_SERVER, '1');
});

test('default mode is with-stack', () => {
  const result = printConfig();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cfg = parseConfig(result.stdout);
  assert.equal(cfg.E2E_MODE, 'with-stack');
  assert.equal(cfg.SKIP_WEB_SERVER, '1');
});

test('--help exits 0', () => {
  const result = spawnSync('bash', [RUN_E2E, '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--frontend-only/);
});
