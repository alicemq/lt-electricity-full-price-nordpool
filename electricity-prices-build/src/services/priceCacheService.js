import moment from 'moment-timezone';
import {
  DISPLAY_TIMEZONE,
  getReleasePhase,
  getTargetReleaseDay,
  RELEASE_PHASE,
} from '../utils/releaseWindow';
import {
  markDaySynced,
  isDaySynced,
  clearDaySync,
} from '../utils/deviceSyncState';
import { filterUpcomingSlots, isCurrentOrFutureSlot } from './timeService';

const CACHE_KEY = 'priceDataCache';
const CACHE_VERSION = 1;
const DAYS_TO_KEEP = 7; // Keep 7 days of historical data

/**
 * Get all cached price data
 */
function getCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return { version: CACHE_VERSION, data: {}, lastUpdated: null };
    
    const parsed = JSON.parse(cached);
    if (parsed.version !== CACHE_VERSION) {
      // Clear old cache format
      clearCache();
      return { version: CACHE_VERSION, data: {}, lastUpdated: null };
    }
    return parsed;
  } catch (error) {
    console.error('Error reading price cache:', error);
    return { version: CACHE_VERSION, data: {}, lastUpdated: null };
  }
}

/**
 * Save price data to cache
 */
function saveCache(cache) {
  try {
    cache.lastUpdated = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving price cache:', error);
    // If quota exceeded, try to clean old data
    if (error.name === 'QuotaExceededError') {
      cleanOldData();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        console.error('Failed to save cache after cleanup:', e);
      }
    }
  }
}

/**
 * Get price data for a specific date range from cache
 */
export function getCachedPrices(startDate, endDate, country = 'lt') {
  const cache = getCache();
  const countryKey = country.toLowerCase();
  const countryData = cache.data[countryKey] || [];
  
  if (countryData.length === 0) return null;
  
  const startTs = moment(startDate).startOf('day').unix();
  const endTs = moment(endDate).endOf('day').unix();
  
  const filtered = countryData.filter(price => {
    return price.timestamp >= startTs && price.timestamp <= endTs;
  });
  
  return filtered.length > 0 ? filtered : null;
}

/**
 * Get upcoming prices from cache (from now onwards)
 */
export function getCachedUpcomingPrices(country = 'lt') {
  const cache = getCache();
  const countryKey = country.toLowerCase();
  const countryData = cache.data[countryKey] || [];
  
  if (countryData.length === 0) return null;
  
  const intervalSeconds = inferMtuIntervalSeconds(countryData);
  const filtered = filterUpcomingSlots(countryData, intervalSeconds);

  return filtered.length > 0 ? filtered : null;
}

/**
 * Store price data in cache
 */
export function storePrices(prices, country = 'lt') {
  if (!prices || prices.length === 0) return;
  
  const cache = getCache();
  const countryKey = country.toLowerCase();
  
  // Merge new prices with existing cache
  const existing = cache.data[countryKey] || [];
  const priceMap = new Map();
  
  // Add existing prices to map
  existing.forEach(price => {
    priceMap.set(price.timestamp, price);
  });
  
  // Add/update with new prices
  prices.forEach(price => {
    priceMap.set(price.timestamp, price);
  });
  
  // Convert back to array and sort
  cache.data[countryKey] = Array.from(priceMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  
  // Clean old data
  cleanOldData();
  
  saveCache(cache);
  updateSyncMarkersForStoredPrices(prices, country);
}

/**
 * Infer MTU interval from cached price records (seconds).
 */
export function inferMtuIntervalSeconds(prices) {
  if (!prices || prices.length < 2) {
    return 3600;
  }
  for (let i = 1; i < Math.min(prices.length, 10); i += 1) {
    const diff = prices[i].timestamp - prices[i - 1].timestamp;
    if (diff > 0) {
      return diff;
    }
  }
  return 3600;
}

/**
 * Expected record count range for a Vilnius calendar day (DST-aware).
 * Aligns with backend isDateComplete semantics.
 */
export function getExpectedRecordRange(intervalSeconds, recordCountHint = 0) {
  const isFifteenMin =
    intervalSeconds === 900 || (recordCountHint >= 90 && intervalSeconds !== 3600);
  if (isFifteenMin) {
    return { min: 92, max: 100, intervalSeconds: 900 };
  }
  return { min: 23, max: 25, intervalSeconds: 3600 };
}

/**
 * Cached prices for one Vilnius calendar day.
 */
export function getCachedPricesForDay(dateStr, country = 'lt') {
  const start = moment.tz(dateStr, DISPLAY_TIMEZONE).startOf('day');
  const end = start.clone().endOf('day');
  return getCachedPrices(start.toDate(), end.toDate(), country) || [];
}

/**
 * Validate whether cached data for a day meets expected MTU count.
 */
export function validateDayCompleteness(dateStr, country = 'lt') {
  const prices = getCachedPricesForDay(dateStr, country);
  const recordCount = prices.length;
  if (recordCount === 0) {
    return {
      isComplete: false,
      recordCount: 0,
      intervalSeconds: 3600,
      expectedMin: 23,
      expectedMax: 25,
    };
  }

  const intervalSeconds = inferMtuIntervalSeconds(prices);
  const expected = getExpectedRecordRange(intervalSeconds, recordCount);
  const isComplete = recordCount >= expected.min && recordCount <= expected.max;

  return {
    isComplete,
    recordCount,
    intervalSeconds: expected.intervalSeconds,
    expectedMin: expected.min,
    expectedMax: expected.max,
  };
}

function updateSyncMarkersForStoredPrices(prices, country) {
  if (!prices || prices.length === 0) {
    return;
  }

  const byDay = new Map();
  prices.forEach((price) => {
    const dayKey = moment.unix(price.timestamp).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, []);
    }
    byDay.get(dayKey).push(price);
  });

  byDay.forEach((dayPrices, dateStr) => {
    const validation = validateDayCompleteness(dateStr, country);
    if (validation.isComplete) {
      markDaySynced(country, dateStr, validation);
    } else if (isDaySynced(country, dateStr)) {
      clearDaySync(country, dateStr);
    }
  });
}

/**
 * Days that should be complete locally but are not yet sync-marked.
 */
export function getDaysNeedingSync(country = 'lt', now = moment()) {
  const phase = getReleasePhase(now);
  const nowVilnius = now.clone().tz(DISPLAY_TIMEZONE);
  const today = nowVilnius.format('YYYY-MM-DD');
  const tomorrow = getTargetReleaseDay(now);
  const candidates = [today];

  if (phase === RELEASE_PHASE.AFTER || phase === RELEASE_PHASE.DURING) {
    candidates.push(tomorrow);
  }

  return candidates.filter((dateStr) => {
    const validation = validateDayCompleteness(dateStr, country);
    return !validation.isComplete;
  });
}

/**
 * Clean data older than DAYS_TO_KEEP days
 */
function cleanOldData() {
  const cache = getCache();
  const now = moment().tz(DISPLAY_TIMEZONE);
  const cutoff = now.clone().subtract(DAYS_TO_KEEP, 'days').startOf('day').unix();

  Object.keys(cache.data).forEach((countryKey) => {
    const countryData = cache.data[countryKey];
    const intervalSeconds = inferMtuIntervalSeconds(countryData);
    cache.data[countryKey] = countryData.filter((price) => {
      // Keep if it's within the last 7 days OR it's the active/future MTU
      return price.timestamp >= cutoff
        || isCurrentOrFutureSlot(price.timestamp, intervalSeconds, now);
    });
  });

  saveCache(cache);
}

/**
 * Clear all cached price data
 */
export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const cache = getCache();
  const stats = {
    lastUpdated: cache.lastUpdated ? new Date(cache.lastUpdated) : null,
    countries: Object.keys(cache.data),
    totalRecords: 0,
    oldestTimestamp: null,
    newestTimestamp: null
  };
  
  Object.values(cache.data).forEach(countryData => {
    stats.totalRecords += countryData.length;
    if (countryData.length > 0) {
      const oldest = countryData[0].timestamp;
      const newest = countryData[countryData.length - 1].timestamp;
      
      if (!stats.oldestTimestamp || oldest < stats.oldestTimestamp) {
        stats.oldestTimestamp = oldest;
      }
      if (!stats.newestTimestamp || newest > stats.newestTimestamp) {
        stats.newestTimestamp = newest;
      }
    }
  });
  
  return stats;
}

/**
 * Detect gaps in FUTURE cached data only (from now onwards)
 * Historical gaps are not checked here - they're fetched on-demand when user requests them
 * Data typically extends only to tomorrow + some hours of day after tomorrow
 */
export function detectFutureGaps(country = 'lt', now = moment()) {
  const nowVilnius = now.clone().tz(DISPLAY_TIMEZONE);
  const phase = getReleasePhase(now);
  const tomorrowStr = getTargetReleaseDay(now);
  const todayStr = nowVilnius.format('YYYY-MM-DD');

  const countryData = getCache().data[country.toLowerCase()] || [];
  const intervalSeconds = inferMtuIntervalSeconds(countryData);
  const futureData = filterUpcomingSlots(countryData, intervalSeconds, now);

  const todayValidation = validateDayCompleteness(todayStr, country);
  const tomorrowValidation = validateDayCompleteness(tomorrowStr, country);
  const shouldHaveTomorrow =
    phase === RELEASE_PHASE.DURING || phase === RELEASE_PHASE.AFTER;

  const missingRanges = [];
  const missingDays = getDaysNeedingSync(country, now);

  if (!todayValidation.isComplete) {
    missingRanges.push({
      start: nowVilnius.toDate(),
      end: nowVilnius.clone().endOf('day').toDate(),
      date: todayStr,
    });
  }

  if (shouldHaveTomorrow && !tomorrowValidation.isComplete) {
    const tomorrowStart = moment.tz(tomorrowStr, DISPLAY_TIMEZONE).startOf('day');
    missingRanges.push({
      start: tomorrowStart.toDate(),
      end: tomorrowStart.clone().endOf('day').toDate(),
      date: tomorrowStr,
    });
  }

  const latestCached =
    futureData.length > 0 ? Math.max(...futureData.map((p) => p.timestamp)) : 0;

  return {
    hasGaps: missingRanges.length > 0 || missingDays.length > 0,
    missingRanges,
    missingDays,
    phase,
    hasToday: todayValidation.isComplete,
    hasTomorrow: tomorrowValidation.isComplete,
    shouldHaveTomorrow,
    todaySynced: isDaySynced(country, todayStr),
    tomorrowSynced: isDaySynced(country, tomorrowStr),
    latestCached:
      latestCached > 0 ? moment.unix(latestCached).format('YYYY-MM-DD HH:mm') : null,
  };
}

/**
 * Check if cache needs initialization (empty or stale)
 */
export function needsInitialization(country = 'lt', now = moment()) {
  const cache = getCache();
  const countryData = cache.data[country.toLowerCase()] || [];
  if (countryData.length === 0) {
    return true;
  }

  const phase = getReleasePhase(now);
  if (phase === RELEASE_PHASE.BEFORE) {
    const today = now.clone().tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
    return !validateDayCompleteness(today, country).isComplete;
  }

  return getDaysNeedingSync(country, now).length > 0;
}

export { isDaySynced, getDaySyncMarker, getCountrySyncMarkers } from '../utils/deviceSyncState';

