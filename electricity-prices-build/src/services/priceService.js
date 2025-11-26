import axios from 'axios';
import moment from 'moment-timezone';
import { logApiCall } from './logService';
import { 
  getCachedPrices, 
  getCachedUpcomingPrices, 
  storePrices,
  needsInitialization,
  detectFutureGaps
} from './priceCacheService';

function getPriceSettings() {
    const defaultSettings = {
        margin: 0.0,
        vat: 21
    };
    const settings = localStorage.getItem('priceCalculationSettings');
    return settings ? JSON.parse(settings) : defaultSettings;
}

/**
 * Fetch prices for a specific date, checking cache first
 */
export async function fetchPrices(date, country = 'lt') {
    getPriceSettings(); // Just to ensure settings are loaded
    
    const formattedDate = moment(date).format('YYYY-MM-DD');
    const startDate = moment(date).startOf('day');
    const endDate = moment(date).endOf('day');
    
    // Check cache first
    const cached = getCachedPrices(startDate.toDate(), endDate.toDate(), country);
    if (cached && cached.length > 0) {
        // Check if we have complete data for this date
        // For historical dates, we might have partial data - that's OK, return what we have
        // For future dates, we should have complete data
        const now = moment().tz('Europe/Vilnius');
        const isHistorical = moment(date).isBefore(now, 'day');
        
        if (isHistorical || cached.length >= 20) { // Historical or seems complete
            return {
                success: true,
                data: { [country.toLowerCase()]: cached },
                meta: {
                    date: formattedDate,
                    country: country.toLowerCase(),
                    count: cached.length,
                    timezone: 'Europe/Vilnius',
                    cached: true
                }
            };
        }
        // For future dates with incomplete data, fetch from API
    }
    
    // Not in cache or incomplete, fetch from API (on-demand for historical gaps)
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices?date=${formattedDate}&country=${country}`;
    logApiCall(apiUrl);
    
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;
        
        // Store in cache
        if (data.success && data.data && data.data[country.toLowerCase()]) {
            storePrices(data.data[country.toLowerCase()], country);
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching prices:', error);
        // If API fails, return cached data if available (offline mode)
        if (cached && cached.length > 0) {
            console.log('[Cache] Using cached data as fallback for historical date');
            return {
                success: true,
                data: { [country.toLowerCase()]: cached },
                meta: {
                    date: formattedDate,
                    country: country.toLowerCase(),
                    count: cached.length,
                    timezone: 'Europe/Vilnius',
                    cached: true,
                    offline: true
                }
            };
        }
        throw error;
    }
}

/**
 * Fetch upcoming prices, checking cache first
 */
export async function fetchUpcomingPrices(country = 'lt', forceRefresh = false) {
    getPriceSettings();
    
    // Check for FUTURE gaps only (historical gaps are fetched on-demand)
    const gaps = detectFutureGaps(country);
    
    // If we have cached data and no future gaps, return cached (unless forced)
    if (!forceRefresh && !gaps.hasGaps) {
        const cached = getCachedUpcomingPrices(country);
        if (cached && cached.length > 0) {
            return {
                success: true,
                data: { [country.toLowerCase()]: cached },
                meta: {
                    country: country.toLowerCase(),
                    count: cached.length,
                    timezone: 'Europe/Vilnius',
                    cached: true
                }
            };
        }
    }
    
    // If we have future gaps or no cache, fetch from upcoming endpoint
    if (gaps.hasGaps) {
        console.log(`[Future Gap] Detected future gaps for ${country}:`, gaps.missingRanges.map(r => 
            `${moment(r.start).format('YYYY-MM-DD HH:mm')} to ${moment(r.end).format('YYYY-MM-DD HH:mm')}`
        ));
    }
    
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices/upcoming?country=${encodeURIComponent(country)}`;
    logApiCall(apiUrl);
    
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;
        
        // Store in cache
        if (data.success && data.data && data.data[country.toLowerCase()]) {
            storePrices(data.data[country.toLowerCase()], country);
            console.log(`[Cache] Stored ${data.data[country.toLowerCase()].length} upcoming prices for ${country}`);
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching upcoming prices:', error);
        // If API fails, try to return cached data as fallback
        const cached = getCachedUpcomingPrices(country);
        if (cached && cached.length > 0) {
            console.log('[Cache] Using cached data as fallback');
            return {
                success: true,
                data: { [country.toLowerCase()]: cached },
                meta: {
                    country: country.toLowerCase(),
                    count: cached.length,
                    timezone: 'Europe/Vilnius',
                    cached: true,
                    offline: true
                }
            };
        }
        throw error;
    }
}

/**
 * Fetch prices for a date range
 */
export async function fetchPricesRange(startDate, endDate, country = 'lt') {
    getPriceSettings();
    
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');
    
    // Check cache first
    const cached = getCachedPrices(start.toDate(), end.toDate(), country);
    if (cached && cached.length > 0) {
        // Check if we have all data or need to fetch missing dates
        const cachedTimestamps = new Set(cached.map(p => p.timestamp));
        const startTs = start.unix();
        const endTs = end.unix();
        
        // Simple check: if we have data spanning the range, use cache
        const hasStart = cached.some(p => p.timestamp >= startTs);
        const hasEnd = cached.some(p => p.timestamp <= endTs);
        
        if (hasStart && hasEnd) {
            return {
                success: true,
                data: { [country.toLowerCase()]: cached },
                meta: {
                    date: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
                    country: country.toLowerCase(),
                    count: cached.length,
                    timezone: 'Europe/Vilnius',
                    cached: true
                }
            };
        }
    }
    
    // Not fully in cache, fetch from API
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/nps/prices?start=${start.format('YYYY-MM-DD')}&end=${end.format('YYYY-MM-DD')}&country=${country}`;
    logApiCall(apiUrl);
    
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;
        
        // Store in cache
        if (data.success && data.data && data.data[country.toLowerCase()]) {
            storePrices(data.data[country.toLowerCase()], country);
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching price range:', error);
        throw error;
    }
}

/**
 * Check if next day data should be available (after 15:00 CET)
 * and fetch upcoming prices if needed
 */
export async function checkAndFetchNextDayData(country = 'lt') {
    // Only check for FUTURE gaps (not historical)
    const gaps = detectFutureGaps(country);
    
    // If we have future gaps (especially if after 15:00 and missing tomorrow), fetch using upcoming endpoint
    if (gaps.hasGaps) {
        console.log('[Next Day Data] Detected future gaps, fetching missing future data...');
        try {
            await fetchUpcomingPrices(country, true); // Force refresh to fill future gaps
            console.log('[Next Day Data] Missing future data fetched successfully');
        } catch (error) {
            console.error('[Next Day Data] Error fetching missing future data:', error);
        }
    } else {
        const now = moment().tz('Europe/Vilnius');
        const hour = now.hour();
        
        // After 15:00 CET, proactively check for next day data even if no gaps detected
        if (hour >= 15) {
            console.log('[Next Day Data] After 15:00 CET, checking for next day data...');
            try {
                await fetchUpcomingPrices(country, false); // Don't force, but will check future gaps
                console.log('[Next Day Data] Upcoming prices checked');
            } catch (error) {
                console.error('[Next Day Data] Error checking upcoming prices:', error);
            }
        }
    }
}

/**
 * Schedule periodic checks for next day data (especially after 15:00 CET)
 */
let nextDayCheckInterval = null;

export function startNextDayDataChecker(country = 'lt', intervalMinutes = 30) {
    // Clear existing interval if any
    if (nextDayCheckInterval) {
        clearInterval(nextDayCheckInterval);
    }
    
    // Check immediately
    checkAndFetchNextDayData(country);
    
    // Then check every intervalMinutes
    nextDayCheckInterval = setInterval(() => {
        checkAndFetchNextDayData(country);
    }, intervalMinutes * 60 * 1000);
    
    console.log(`[Next Day Data] Started checker, will check every ${intervalMinutes} minutes`);
}

export function stopNextDayDataChecker() {
    if (nextDayCheckInterval) {
        clearInterval(nextDayCheckInterval);
        nextDayCheckInterval = null;
        console.log('[Next Day Data] Stopped checker');
    }
}

/**
 * Initialize cache by fetching -7 days to now + all upcoming data
 */
export async function initializeCache(country = 'lt') {
    if (!needsInitialization()) {
        console.log('Cache already initialized, checking for future gaps...');
        // Only check for FUTURE gaps (historical gaps fetched on-demand)
        // Check for next day data if after 15:00 CET
        await checkAndFetchNextDayData(country);
        return;
    }
    
    console.log('Initializing price cache...');
    const now = moment().tz('Europe/Vilnius');
    const startDate = now.clone().subtract(7, 'days').startOf('day');
    // Extend to tomorrow + some hours of day after (realistic maximum)
    const endDate = now.clone().add(2, 'days').add(18, 'hours');
    
    try {
        // Fetch data (-7 days to +8 days) using date range to get both historical and future data
        const priceData = await fetchPricesRange(startDate.toDate(), endDate.toDate(), country);
        
        if (priceData.success && priceData.data) {
            const countryData = priceData.data[country.toLowerCase()] || [];
            if (countryData.length > 0) {
                storePrices(countryData, country);
                console.log(`Cache initialized with ${countryData.length} records for ${country}`);
            }
        }
        
        // Also fetch upcoming data to ensure we have the latest (this will merge with existing cache)
        await fetchUpcomingPrices(country);
        
        // If after 15:00 CET, also check for next day data
        await checkAndFetchNextDayData(country);
        
        console.log('Cache initialized successfully');
    } catch (error) {
        console.error('Error initializing cache:', error);
        // Don't throw - allow app to continue with empty cache
    }
}