#!/usr/bin/env node
/**
 * Generate or verify swagger-ui/openapi.json from openapi.yaml (source of truth).
 * Usage: node bin/openapi-json-from-yaml.js [--check|--write]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(pathToFileURL(path.join(repoRoot, 'backend/package.json')));
const yaml = require('js-yaml');
const yamlPath = path.join(repoRoot, 'swagger-ui/openapi.yaml');
const jsonPath = path.join(repoRoot, 'swagger-ui/openapi.json');

/** Normalize CRLF/CR to LF so --check is stable on Windows (core.autocrlf). */
function normalizeEol(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const mode = process.argv.includes('--write') ? '--write' : '--check';
const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
const generated = `${JSON.stringify(doc, null, 2)}\n`;

if (mode === '--write') {
  fs.writeFileSync(jsonPath, generated);
  console.log(`Wrote ${path.relative(repoRoot, jsonPath)} from openapi.yaml`);
} else {
  const existing = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : '';
  if (normalizeEol(existing) !== generated) {
    console.error('openapi.json is out of sync with openapi.yaml (source of truth).');
    console.error('Run: node bin/openapi-json-from-yaml.js --write');
    process.exit(1);
  }
  console.log('openapi.json is in sync with openapi.yaml');
}
