const STORAGE_KEY = 'deviceSyncState';
const STATE_VERSION = 1;

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: STATE_VERSION, countries: {} };
    }
    const parsed = JSON.parse(raw);
    if (parsed.version !== STATE_VERSION) {
      return { version: STATE_VERSION, countries: {} };
    }
    return parsed;
  } catch (error) {
    console.error('[DeviceSync] Failed to read sync state:', error);
    return { version: STATE_VERSION, countries: {} };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[DeviceSync] Failed to write sync state:', error);
  }
}

function countryBucket(state, country) {
  const key = country.toLowerCase();
  if (!state.countries[key]) {
    state.countries[key] = {};
  }
  return state.countries[key];
}

/**
 * @param {string} country
 * @param {string} dateStr YYYY-MM-DD (Europe/Vilnius calendar day)
 * @param {{ recordCount: number, intervalSeconds: number, expectedMin: number, expectedMax: number }} metadata
 */
export function markDaySynced(country, dateStr, metadata) {
  const state = readState();
  const bucket = countryBucket(state, country);
  bucket[dateStr] = {
    syncedAt: Date.now(),
    recordCount: metadata.recordCount,
    intervalSeconds: metadata.intervalSeconds,
    expectedMin: metadata.expectedMin,
    expectedMax: metadata.expectedMax,
  };
  writeState(state);
}

/**
 * @param {string} country
 * @param {string} dateStr
 */
export function clearDaySync(country, dateStr) {
  const state = readState();
  const bucket = countryBucket(state, country);
  delete bucket[dateStr];
  writeState(state);
}

/**
 * @param {string} country
 * @param {string} dateStr
 */
export function isDaySynced(country, dateStr) {
  const state = readState();
  const bucket = state.countries[country.toLowerCase()] || {};
  return Boolean(bucket[dateStr]);
}

/**
 * @param {string} country
 * @param {string} dateStr
 */
export function getDaySyncMarker(country, dateStr) {
  const state = readState();
  const bucket = state.countries[country.toLowerCase()] || {};
  return bucket[dateStr] || null;
}

/**
 * @param {string} country
 */
export function getCountrySyncMarkers(country) {
  const state = readState();
  return { ...(state.countries[country.toLowerCase()] || {}) };
}

/**
 * @param {string} country
 */
export function clearCountrySyncState(country) {
  const state = readState();
  delete state.countries[country.toLowerCase()];
  writeState(state);
}
