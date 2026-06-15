const COOLDOWN_MS = 60_000;

/** @type {Map<string, Promise<unknown>>} */
const inFlight = new Map();

/** @type {Map<string, number>} */
const lastCompleted = new Map();

export function buildBackupFetchKey({ country, date, start, end }) {
  const dateKey = date || `${start}:${end}`;
  const countryKey = country || 'all';
  return `${countryKey}:${dateKey}`;
}

/**
 * Serialize backup vendor fetches per country/date and enforce a cooldown.
 * @returns {Promise<{ status: 'fetched' | 'waited' | 'rate_limited', result?: unknown, cooldownMs?: number }>}
 */
export async function withBackupFetchGuard(key, fetchFn) {
  const existing = inFlight.get(key);
  if (existing) {
    return { status: 'waited', result: await existing };
  }

  const last = lastCompleted.get(key);
  if (last != null && Date.now() - last < COOLDOWN_MS) {
    return { status: 'rate_limited', cooldownMs: COOLDOWN_MS - (Date.now() - last) };
  }

  const promise = (async () => {
    try {
      return await fetchFn();
    } finally {
      inFlight.delete(key);
      lastCompleted.set(key, Date.now());
    }
  })();

  inFlight.set(key, promise);
  const result = await promise;
  return { status: 'fetched', result };
}

/** Test helper — clears in-memory guard state. */
export function resetBackupFetchGuard() {
  inFlight.clear();
  lastCompleted.clear();
}
