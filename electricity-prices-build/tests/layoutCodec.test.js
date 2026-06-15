import { describe, it, expect } from 'vitest';
import {
  encodeLayout,
  decodeLayout,
  buildDisplayUrl,
  defaultLayoutConfig,
  normalizeLayoutConfig,
} from '../src/lib/layoutCodec.js';

describe('layoutCodec', () => {
  it('round-trips a table layout config', () => {
    const config = {
      v: 1,
      panel: 'table',
      source: 'upcoming',
      theme: 'dark',
      tz: 'Europe/Vilnius',
    };
    const encoded = encodeLayout(config);
    const decoded = decodeLayout(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.config).toEqual(config);
    }
  });

  it('round-trips a chart layout config', () => {
    const config = {
      v: 1,
      panel: 'chart',
      source: 'today',
      theme: 'light',
    };
    const encoded = encodeLayout(config);
    const decoded = decodeLayout(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.config.panel).toBe('chart');
      expect(decoded.config.source).toBe('today');
      expect(decoded.config.theme).toBe('light');
      expect(decoded.config.tz).toBe('Europe/Vilnius');
    }
  });

  it('rejects missing layout param', () => {
    expect(decodeLayout('')).toEqual({ ok: false, error: 'missing' });
  });

  it('rejects invalid base64 payload', () => {
    expect(decodeLayout('not-valid!!!')).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects unsupported schema version', () => {
    const badJson = JSON.stringify({ v: 2, panel: 'table' });
    const encoded = btoa(badJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
    expect(decodeLayout(encoded)).toEqual({ ok: false, error: 'invalid' });
  });

  it('builds a display URL with encoded layout', () => {
    const url = buildDisplayUrl(defaultLayoutConfig());
    expect(url.startsWith('/display?layout=')).toBe(true);
  });

  it('normalizes defaults for partial config', () => {
    const normalized = normalizeLayoutConfig({ v: 1, panel: 'chart' });
    expect(normalized).toEqual({
      v: 1,
      panel: 'chart',
      source: 'upcoming',
      theme: 'dark',
      tz: 'Europe/Vilnius',
    });
  });
});
