import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.join(__dirname, '../../electricity-prices-build/vite-plugin-sitemap.js');
const pluginSource = readFileSync(pluginPath, 'utf8');

const EXPECTED_ROUTES = [
  '/',
  '/upcoming',
  '/today',
  '/settings',
  '/about',
  '/status',
];

describe('sitemap route snapshot', () => {
  for (const route of EXPECTED_ROUTES) {
    it(`includes route ${route}`, () => {
      const escaped = route.replace(/\//g, '\\/');
      assert.match(pluginSource, new RegExp(`${escaped}`));
    });
  }

  it('uses urlset sitemap schema', () => {
    assert.match(pluginSource, /urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  });
});
