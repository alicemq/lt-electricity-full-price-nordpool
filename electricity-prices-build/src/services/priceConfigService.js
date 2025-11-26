import axios from 'axios';
import moment from 'moment-timezone';

const CONFIG_CACHE_KEY_PREFIX = 'priceConfigCache_';
const CONFIG_CACHE_VERSION = 2; // Incremented for country support
const CACHE_EXPIRY_DAYS = 7; // Refresh config weekly

/**
 * Get cache key for a specific country
 */
function getCacheKey(country = 'lt') {
  return `${CONFIG_CACHE_KEY_PREFIX}${country.toLowerCase()}`;
}

/**
 * Get cached price configuration for a country
 */
function getCachedConfig(country = 'lt') {
  try {
    const key = getCacheKey(country);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    if (parsed.version !== CONFIG_CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    
    // Check if cache is expired
    if (parsed.cachedAt) {
      const cacheDate = moment(parsed.cachedAt);
      const expiryDate = cacheDate.clone().add(CACHE_EXPIRY_DAYS, 'days');
      if (moment().isAfter(expiryDate)) {
        localStorage.removeItem(key);
        return null;
      }
    }
    
    return parsed.data;
  } catch (error) {
    console.error('Error reading price config cache:', error);
    return null;
  }
}

/**
 * Save price configuration to cache for a country
 */
function saveConfigCache(data, country = 'lt') {
  try {
    const key = getCacheKey(country);
    const cache = {
      version: CONFIG_CACHE_VERSION,
      cachedAt: new Date().toISOString(),
      data
    };
    localStorage.setItem(key, JSON.stringify(cache));
    
    // Trigger a custom event so priceCalculationService can update its cache
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('priceConfigUpdated', { 
        detail: { data, country } 
      }));
    }
  } catch (error) {
    console.error('Error saving price config cache:', error);
    // If quota exceeded, try to clear old cache
    if (error.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem(key);
        localStorage.setItem(key, JSON.stringify({
          version: CONFIG_CACHE_VERSION,
          cachedAt: new Date().toISOString(),
          data
        }));
      } catch (e) {
        console.error('Failed to save config cache after cleanup:', e);
      }
    }
  }
}

/**
 * Fetch price configuration from API for a specific country
 */
export async function fetchPriceConfig(country = 'lt') {
  try {
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/configurations?country=${encodeURIComponent(country)}`;
    const response = await axios.get(apiUrl);
    
    if (response.data.success && response.data.data) {
      // API returns data grouped by country: { tariffs: { "lt": { "2023-01-01": {...} } } }
      // Extract the specific country's data
      const tariffs = response.data.data.tariffs || {};
      const systemCharges = response.data.data.systemCharges || {};
      
      // If country is specified, extract that country's data
      // If not specified, data is already grouped by country
      const countryData = {
        tariffs: tariffs[country] || tariffs, // Fallback to full structure if country key not found
        systemCharges: systemCharges[country] || systemCharges
      };
      
      saveConfigCache(countryData, country);
      return countryData;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error(`Error fetching price config for ${country}:`, error);
    throw error;
  }
}

/**
 * Get price configuration (from cache or API) for a specific country
 */
export async function getPriceConfig(country = 'lt') {
  // Try cache first
  const cached = getCachedConfig(country);
  if (cached) {
    return cached;
  }
  
  // Fetch from API
  try {
    return await fetchPriceConfig(country);
  } catch (error) {
    console.error(`Failed to fetch price config from API for ${country}:`, error);
    // Return empty structure as fallback
    return {
      tariffs: {},
      systemCharges: {}
    };
  }
}

/**
 * Initialize price configuration on app startup for a country
 */
export async function initializePriceConfig(country = 'lt') {
  try {
    await getPriceConfig(country);
    console.log(`Price configuration initialized for ${country}`);
  } catch (error) {
    console.error(`Failed to initialize price config for ${country}:`, error);
    // Don't throw - allow app to continue with empty config
  }
}

