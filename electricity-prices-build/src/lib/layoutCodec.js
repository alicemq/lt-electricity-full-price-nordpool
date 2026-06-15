/**
 * Layout schema v1 (MVP) — inline spec
 *
 * Fields:
 * - v: 1 (required)
 * - panel: "chart" | "table" (required) — single panel for MVP
 * - source: "today" | "upcoming" (default "upcoming")
 * - theme: "dark" | "light" (default "dark" for kiosk)
 * - tz: IANA timezone string (default "Europe/Vilnius")
 *
 * URL encoding: JSON → UTF-8 → base64url (no padding).
 * Example: /display?layout=eyJ2IjoxLCJwYW5lbCI6InRhYmxlIn0
 */

const SCHEMA_VERSION = 1;
const PANELS = new Set(['chart', 'table']);
const SOURCES = new Set(['today', 'upcoming']);
const THEMES = new Set(['dark', 'light']);
const DEFAULT_TZ = 'Europe/Vilnius';

/**
 * @typedef {Object} LayoutConfigV1
 * @property {1} v
 * @property {'chart'|'table'} panel
 * @property {'today'|'upcoming'} [source]
 * @property {'dark'|'light'} [theme]
 * @property {string} [tz]
 */

/**
 * @param {unknown} value
 * @returns {LayoutConfigV1|null}
 */
export function normalizeLayoutConfig(value) {
  if (!value || typeof value !== 'object') return null;

  const raw = /** @type {Record<string, unknown>} */ (value);
  if (raw.v !== SCHEMA_VERSION) return null;
  if (typeof raw.panel !== 'string' || !PANELS.has(raw.panel)) return null;

  const source = typeof raw.source === 'string' && SOURCES.has(raw.source)
    ? raw.source
    : 'upcoming';
  const theme = typeof raw.theme === 'string' && THEMES.has(raw.theme)
    ? raw.theme
    : 'dark';
  const tz = typeof raw.tz === 'string' && raw.tz.length > 0 ? raw.tz : DEFAULT_TZ;

  return {
    v: SCHEMA_VERSION,
    panel: /** @type {'chart'|'table'} */ (raw.panel),
    source: /** @type {'today'|'upcoming'} */ (source),
    theme: /** @type {'dark'|'light'} */ (theme),
    tz,
  };
}

/**
 * @param {LayoutConfigV1} config
 * @returns {string}
 */
export function encodeLayout(config) {
  const normalized = normalizeLayoutConfig(config);
  if (!normalized) {
    throw new Error('Invalid layout config');
  }
  const json = JSON.stringify(normalized);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

/**
 * @param {string} encoded
 * @returns {{ ok: true, config: LayoutConfigV1 } | { ok: false, error: string }}
 */
export function decodeLayout(encoded) {
  if (typeof encoded !== 'string' || encoded.trim().length === 0) {
    return { ok: false, error: 'missing' };
  }

  try {
    const padded = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    const config = normalizeLayoutConfig(parsed);
    if (!config) {
      return { ok: false, error: 'invalid' };
    }
    return { ok: true, config };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

/**
 * @param {LayoutConfigV1} config
 * @param {string} [basePath='/display']
 * @returns {string}
 */
export function buildDisplayUrl(config, basePath = '/display') {
  const encoded = encodeLayout(config);
  return `${basePath}?layout=${encoded}`;
}

/**
 * @returns {LayoutConfigV1}
 */
export function defaultLayoutConfig() {
  return {
    v: SCHEMA_VERSION,
    panel: 'table',
    source: 'upcoming',
    theme: 'dark',
    tz: DEFAULT_TZ,
  };
}
