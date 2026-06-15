import axios from 'axios';
import moment from 'moment-timezone';
import { logApiCall } from './logService';
import {
  getCachedPrices,
  getCachedUpcomingPrices,
  storePrices,
  needsInitialization,
  detectFutureGaps,
  getDaysNeedingSync,
  validateDayCompleteness,
  getCachedPricesForDay,
} from './priceCacheService';
import {
  DISPLAY_TIMEZONE,
  getReleasePhase,
  getTargetReleaseDay,
  getMsUntilNextWindowStart,
  isHistoricalDate,
  shouldFetchFutureData,
  RELEASE_PHASE,
} from '../utils/releaseWindow';
import { isDaySynced } from '../utils/deviceSyncState';

const priceUpdateListeners = new Set();

function getPriceSettings() {
  const defaultSettings = {
    margin: 0.0,
    vat: 21,
  };
  const settings = localStorage.getItem('priceCalculationSettings');
  return settings ? JSON.parse(settings) : defaultSettings;
}

function buildCachedResponse(prices, country, meta = {}) {
  return {
    success: true,
    data: { [country.toLowerCase()]: prices },
    meta: {
      country: country.toLowerCase(),
      count: prices.length,
      timezone: DISPLAY_TIMEZONE,
      cached: true,
      ...meta,
    },
  };
}

export function onPricesUpdated(listener) {
  priceUpdateListeners.add(listener);
  return () => priceUpdateListeners.delete(listener);
}

export function notifyPricesUpdated(country = 'lt') {
  priceUpdateListeners.forEach((listener) => {
    try {
      listener(country);
    } catch (error) {
      console.error('[SmartSync] Price update listener failed:', error);
    }
  });
}

function storeAndNotify(prices, country) {
  if (!prices || prices.length === 0) {
    return false;
  }
  storePrices(prices, country);
  notifyPricesUpdated(country);
  return true;
}

function canFetchFromNetwork(date, { force = false } = {}) {
  if (force) {
    return true;
  }
  if (isHistoricalDate(date)) {
    return true;
  }
  return shouldFetchFutureData(date);
}

/**
 * Fetch prices for a specific date, checking cache first.
 */
export async function fetchPrices(date, country = 'lt', options = {}) {
  getPriceSettings();

  const formattedDate = moment(date).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
  const startDate = moment(date).tz(DISPLAY_TIMEZONE).startOf('day');
  const endDate = moment(date).tz(DISPLAY_TIMEZONE).endOf('day');
  const cached = getCachedPrices(startDate.toDate(), endDate.toDate(), country);

  if (cached && cached.length > 0) {
    const validation = validateDayCompleteness(formattedDate, country);
    const isHistorical = isHistoricalDate(date);

    if (isHistorical || validation.isComplete || !canFetchFromNetwork(date, options)) {
      return buildCachedResponse(cached, country, { date: formattedDate });
    }
  } else if (!canFetchFromNetwork(date, options)) {
    return buildCachedResponse(cached || [], country, {
      date: formattedDate,
      offline: true,
      skippedNetwork: true,
    });
  }

  const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices?date=${formattedDate}&country=${country}`;
  logApiCall(apiUrl);

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.success && data.data && data.data[country.toLowerCase()]) {
      storeAndNotify(data.data[country.toLowerCase()], country);
    }

    return data;
  } catch (error) {
    console.error('Error fetching prices:', error);
    if (cached && cached.length > 0) {
      console.log('[Cache] Using cached data as fallback for date', formattedDate);
      return buildCachedResponse(cached, country, {
        date: formattedDate,
        offline: true,
      });
    }
    throw error;
  }
}

/**
 * Fetch upcoming prices with release-window-aware network policy.
 */
export async function fetchUpcomingPrices(country = 'lt', forceRefresh = false) {
  getPriceSettings();

  const phase = getReleasePhase();
  const gaps = detectFutureGaps(country);
  const cached = getCachedUpcomingPrices(country);
  const allowNetwork =
    forceRefresh ||
    phase === RELEASE_PHASE.DURING ||
    (phase === RELEASE_PHASE.AFTER && gaps.hasGaps);

  if (!allowNetwork) {
    if (cached && cached.length > 0) {
      return buildCachedResponse(cached, country, { phase, skippedNetwork: true });
    }
    return buildCachedResponse([], country, { phase, skippedNetwork: true });
  }

  if (!forceRefresh && !gaps.hasGaps && cached && cached.length > 0) {
    return buildCachedResponse(cached, country, { phase });
  }

  if (gaps.hasGaps) {
    console.log(
      `[SmartSync] Future gaps (${phase}) for ${country}:`,
      gaps.missingDays,
    );
  }

  const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices/upcoming?country=${encodeURIComponent(country)}`;
  logApiCall(apiUrl);

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.success && data.data && data.data[country.toLowerCase()]) {
      const stored = storeAndNotify(data.data[country.toLowerCase()], country);
      if (stored) {
        console.log(
          `[SmartSync] Stored ${data.data[country.toLowerCase()].length} upcoming prices for ${country}`,
        );
      }
    }

    return data;
  } catch (error) {
    console.error('Error fetching upcoming prices:', error);
    if (cached && cached.length > 0) {
      console.log('[Cache] Using cached upcoming data as fallback');
      return buildCachedResponse(cached, country, { phase, offline: true });
    }

    const noDataInDb =
      error.response?.status === 404 &&
      error.response?.data?.code === 'NO_DATA_FOUND';

    if (noDataInDb) {
      console.log('[SmartSync] Upcoming empty in DB; bootstrapping today and tomorrow');
      try {
        const today = moment().tz(DISPLAY_TIMEZONE);
        await fetchPrices(today.toDate(), country, { force: true });
        await fetchPrices(today.clone().add(1, 'day').toDate(), country, { force: true });

        const bootstrapped = getCachedUpcomingPrices(country);
        if (bootstrapped && bootstrapped.length > 0) {
          return buildCachedResponse(bootstrapped, country, { phase, bootstrapped: true });
        }

        const retry = await axios.get(apiUrl);
        const retryData = retry.data;
        if (retryData.success && retryData.data?.[country.toLowerCase()]) {
          storeAndNotify(retryData.data[country.toLowerCase()], country);
        }
        return retryData;
      } catch (bootstrapError) {
        console.error('[SmartSync] Upcoming bootstrap failed:', bootstrapError);
        const bootstrapped = getCachedUpcomingPrices(country);
        if (bootstrapped && bootstrapped.length > 0) {
          return buildCachedResponse(bootstrapped, country, { phase, bootstrapped: true, offline: true });
        }
        return buildCachedResponse([], country, { phase, noData: true });
      }
    }

    throw error;
  }
}

/**
 * Targeted refetch for days that should be complete but are not sync-marked.
 */
export async function fetchMissingDays(country = 'lt') {
  const missingDays = getDaysNeedingSync(country);
  if (missingDays.length === 0) {
    return { fetched: [], skipped: true };
  }

  const fetched = [];
  for (const dateStr of missingDays) {
    try {
      await fetchPrices(dateStr, country, { force: true });
      fetched.push(dateStr);
    } catch (error) {
      console.error(`[SmartSync] Failed to fetch missing day ${dateStr}:`, error);
    }
  }

  if (fetched.length === 0) {
    try {
      await fetchUpcomingPrices(country, true);
    } catch (error) {
      console.error('[SmartSync] Upcoming fallback fetch failed:', error);
    }
  }

  return { fetched, skipped: false };
}

/**
 * Fetch prices for a date range (historical bootstrap).
 */
export async function fetchPricesRange(startDate, endDate, country = 'lt') {
  getPriceSettings();

  const start = moment(startDate).tz(DISPLAY_TIMEZONE).startOf('day');
  const end = moment(endDate).tz(DISPLAY_TIMEZONE).endOf('day');
  const phase = getReleasePhase();

  if (phase === RELEASE_PHASE.BEFORE) {
    const cached = getCachedPrices(start.toDate(), end.toDate(), country);
    if (cached && cached.length > 0) {
      return buildCachedResponse(cached, country, {
        date: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
        skippedNetwork: true,
      });
    }
  }

  const cached = getCachedPrices(start.toDate(), end.toDate(), country);
  if (cached && cached.length > 0) {
    const startTs = start.unix();
    const endTs = end.unix();
    const hasStart = cached.some((p) => p.timestamp >= startTs);
    const hasEnd = cached.some((p) => p.timestamp <= endTs);

    if (hasStart && hasEnd && phase === RELEASE_PHASE.BEFORE) {
      return buildCachedResponse(cached, country, {
        date: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
      });
    }
  }

  const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices?start=${start.format('YYYY-MM-DD')}&end=${end.format('YYYY-MM-DD')}&country=${country}`;
  logApiCall(apiUrl);

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.success && data.data && data.data[country.toLowerCase()]) {
      storeAndNotify(data.data[country.toLowerCase()], country);
    }

    return data;
  } catch (error) {
    console.error('Error fetching price range:', error);
    throw error;
  }
}

/**
 * One smart-sync tick driven by release-window phase.
 */
export async function runSmartSync(country = 'lt') {
  const phase = getReleasePhase();
  console.log(`[SmartSync] Tick (${phase})`);

  switch (phase) {
    case RELEASE_PHASE.BEFORE:
      return { phase, action: 'idle' };
    case RELEASE_PHASE.DURING:
      await fetchUpcomingPrices(country, true);
      await fetchMissingDays(country);
      return { phase, action: 'polled' };
    case RELEASE_PHASE.AFTER: {
      const targetDay = getTargetReleaseDay();
      if (!isDaySynced(country, targetDay)) {
        await fetchMissingDays(country);
        return { phase, action: 'post-window-fetch' };
      }
      return { phase, action: 'already-synced' };
    }
    default: {
      const _exhaustive = phase;
      return { phase: _exhaustive, action: 'idle' };
    }
  }
}

let smartSyncTimeout = null;
let smartSyncCountry = 'lt';

function getNextSyncDelayMs() {
  const phase = getReleasePhase();
  if (phase === RELEASE_PHASE.DURING) {
    return 60 * 1000;
  }
  if (phase === RELEASE_PHASE.AFTER) {
    const targetDay = getTargetReleaseDay();
    if (isDaySynced(smartSyncCountry, targetDay)) {
      return getMsUntilNextWindowStart();
    }
    return 5 * 60 * 1000;
  }
  return getMsUntilNextWindowStart();
}

function scheduleSmartSync(delayMs) {
  if (smartSyncTimeout) {
    clearTimeout(smartSyncTimeout);
  }

  const safeDelay = Math.max(delayMs, 1000);
  smartSyncTimeout = setTimeout(async () => {
    try {
      await runSmartSync(smartSyncCountry);
    } catch (error) {
      console.error('[SmartSync] Tick failed:', error);
    }
    scheduleSmartSync(getNextSyncDelayMs());
  }, safeDelay);
}

export function startSmartSync(country = 'lt') {
  smartSyncCountry = country;

  if (smartSyncTimeout) {
    clearTimeout(smartSyncTimeout);
    smartSyncTimeout = null;
  }

  runSmartSync(country).catch((error) => {
    console.error('[SmartSync] Initial tick failed:', error);
  });

  const delayMs = getNextSyncDelayMs();
  scheduleSmartSync(delayMs);

  const phase = getReleasePhase();
  console.log(
    `[SmartSync] Scheduled next tick in ${Math.round(delayMs / 1000)}s (${phase})`,
  );
}

export function stopSmartSync() {
  if (smartSyncTimeout) {
    clearTimeout(smartSyncTimeout);
    smartSyncTimeout = null;
    console.log('[SmartSync] Stopped');
  }
}

/** @deprecated Use startSmartSync */
export function startNextDayDataChecker(country = 'lt', intervalMinutes = 30) {
  console.warn('[SmartSync] startNextDayDataChecker is deprecated; using startSmartSync');
  startSmartSync(country);
}

/** @deprecated Use stopSmartSync */
export function stopNextDayDataChecker() {
  stopSmartSync();
}

/** @deprecated Use runSmartSync */
export async function checkAndFetchNextDayData(country = 'lt') {
  return runSmartSync(country);
}

/**
 * Initialize cache respecting release-window phase.
 */
export async function initializeCache(country = 'lt') {
  const phase = getReleasePhase();
  const needsInit = needsInitialization(country);

  if (!needsInit) {
    console.log(`[SmartSync] Cache warm (${phase}), skipping bootstrap fetch`);
    return;
  }

  if (phase === RELEASE_PHASE.BEFORE) {
    console.log('[SmartSync] Before release window — cache-only bootstrap');
    return;
  }

  console.log(`[SmartSync] Initializing cache (${phase})...`);
  const now = moment().tz(DISPLAY_TIMEZONE);
  const startDate = now.clone().subtract(7, 'days').startOf('day');
  const endDate = now.clone().add(1, 'day').endOf('day');

  try {
    if (phase === RELEASE_PHASE.AFTER) {
      await fetchMissingDays(country);
    } else {
      const priceData = await fetchPricesRange(startDate.toDate(), endDate.toDate(), country);
      if (priceData.success && priceData.data) {
        const countryData = priceData.data[country.toLowerCase()] || [];
        if (countryData.length > 0) {
          console.log(`[SmartSync] Bootstrap stored ${countryData.length} records`);
        }
      }
      await fetchUpcomingPrices(country, true);
    }

    console.log('[SmartSync] Cache initialization complete');
  } catch (error) {
    console.error('[SmartSync] Cache initialization failed:', error);
  }
}

export function getSyncDebugInfo(country = 'lt') {
  const now = moment();
  const phase = getReleasePhase(now);
  const gaps = detectFutureGaps(country, now);
  const targetDay = getTargetReleaseDay(now);
  const today = now.clone().tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');

  return {
    phase,
    releaseTimezone: 'Europe/Paris',
    displayTimezone: DISPLAY_TIMEZONE,
    nextWindowInMs: getMsUntilNextWindowStart(now),
    pollIntervalMs: getNextSyncDelayMs(),
    targetReleaseDay: targetDay,
    todayValidation: validateDayCompleteness(today, country),
    tomorrowValidation: validateDayCompleteness(targetDay, country),
    gaps,
    todayCachedCount: getCachedPricesForDay(today, country).length,
    tomorrowCachedCount: getCachedPricesForDay(targetDay, country).length,
  };
}
