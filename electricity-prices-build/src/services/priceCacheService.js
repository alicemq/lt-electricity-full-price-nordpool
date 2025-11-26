import moment from 'moment-timezone';

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
  
  const now = moment().tz('Europe/Vilnius').unix();
  const filtered = countryData.filter(price => price.timestamp >= now);
  
  return filtered.length > 0 ? filtered.sort((a, b) => a.timestamp - b.timestamp) : null;
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
}

/**
 * Clean data older than DAYS_TO_KEEP days
 */
function cleanOldData() {
  const cache = getCache();
  const cutoff = moment().tz('Europe/Vilnius').subtract(DAYS_TO_KEEP, 'days').startOf('day').unix();
  const now = moment().tz('Europe/Vilnius').unix();
  
  Object.keys(cache.data).forEach(countryKey => {
    cache.data[countryKey] = cache.data[countryKey].filter(price => {
      // Keep if it's within the last 7 days OR it's in the future
      return price.timestamp >= cutoff || price.timestamp >= now;
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
export function detectFutureGaps(country = 'lt') {
  const cache = getCache();
  const countryKey = country.toLowerCase();
  const countryData = cache.data[countryKey] || [];
  
  const now = moment().tz('Europe/Vilnius');
  const nowTs = now.unix();
  const hour = now.hour();
  
  // Only check future data (from now onwards)
  const futureData = countryData.filter(p => p.timestamp >= nowTs);
  
  if (futureData.length === 0) {
    return { hasGaps: true, missingRanges: [] };
  }
  
  // Determine what FUTURE data should be available
  const shouldHaveTomorrow = hour >= 15; // After 15:00 CET, tomorrow's data should be available
  
  // Get date ranges we should have (future only)
  const today = now.clone().startOf('day');
  const tomorrow = now.clone().add(1, 'day').startOf('day');
  // Day after tomorrow - only expect some hours (typically up to 12-18 hours ahead)
  const maxExpectedTime = now.clone().add(2, 'days').add(18, 'hours'); // Max: day after tomorrow + 18 hours
  
  // Check what we have (future data only)
  const todayStart = today.unix();
  const todayEnd = today.clone().endOf('day').unix();
  const tomorrowStart = tomorrow.unix();
  const tomorrowEnd = tomorrow.clone().endOf('day').unix();
  const maxExpectedTs = maxExpectedTime.unix();
  
  const hasToday = futureData.some(p => p.timestamp >= todayStart && p.timestamp <= todayEnd);
  const hasTomorrow = futureData.some(p => p.timestamp >= tomorrowStart && p.timestamp <= tomorrowEnd);
  
  // Check if we have data up to the expected maximum (tomorrow + some hours of day after)
  const latestCached = futureData.length > 0 ? Math.max(...futureData.map(p => p.timestamp)) : 0;
  const hasEnoughFutureData = latestCached >= maxExpectedTs;
  
  const missingRanges = [];
  
  // Check if we're missing today's future data (from now to end of day)
  if (!hasToday || (hasToday && latestCached < todayEnd && latestCached < nowTs + 3600)) {
    // Missing current/future part of today
    missingRanges.push({ start: now.toDate(), end: today.clone().endOf('day').toDate() });
  }
  
  // Check if we're missing tomorrow's data (if it should be available)
  if (shouldHaveTomorrow && !hasTomorrow) {
    missingRanges.push({ start: tomorrow.toDate(), end: tomorrow.clone().endOf('day').toDate() });
  }
  
  // Check if we're missing future data (but only up to the realistic maximum)
  // If we have tomorrow but not enough hours of day after, we might be missing some
  if (hasTomorrow && !hasEnoughFutureData && latestCached < maxExpectedTs) {
    // We have tomorrow but missing some hours of day after tomorrow
    const missingStart = latestCached > 0 ? moment.unix(latestCached).add(1, 'hour') : tomorrow.clone().add(1, 'day');
    missingRanges.push({ 
      start: missingStart.toDate(), 
      end: maxExpectedTime.toDate() 
    });
  } else if (!hasTomorrow && shouldHaveTomorrow) {
    // Missing tomorrow entirely
    missingRanges.push({ 
      start: tomorrow.toDate(), 
      end: maxExpectedTime.toDate() 
    });
  }
  
  return {
    hasGaps: missingRanges.length > 0,
    missingRanges,
    hasToday,
    hasTomorrow,
    shouldHaveTomorrow,
    latestCached: latestCached > 0 ? moment.unix(latestCached).format('YYYY-MM-DD HH:mm') : null,
    maxExpected: maxExpectedTime.format('YYYY-MM-DD HH:mm')
  };
}

/**
 * Check if cache needs initialization (empty or stale)
 */
export function needsInitialization() {
  const cache = getCache();
  const hasData = Object.keys(cache.data).length > 0 && 
                  Object.values(cache.data).some(arr => arr.length > 0);
  
  if (!hasData) return true;
  
  // Check if we have recent data (within last hour)
  const oneHourAgo = moment().tz('Europe/Vilnius').subtract(1, 'hour').unix();
  const hasRecentData = Object.values(cache.data).some(arr => 
    arr.some(price => price.timestamp >= oneHourAgo)
  );
  
  return !hasRecentData;
}

