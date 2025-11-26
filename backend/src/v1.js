import express from 'express';
import moment from 'moment-timezone';
import syncWorker from './syncWorker.js';
import { getPriceData, getPriceDataAll, getLatestPrice, getCurrentPrice, getAvailableCountries, getSettings, updateSetting, getCurrentHourPrice, getLatestPriceAll, getCurrentHourPriceAll, getLatestTimestamp, logSync, getAllEarliestTimestamps, getInitialSyncStatus, getDatabaseStats, getSystemHealth, getAllCountrySyncStatus } from './database.js';
import pool from './database.js';

const router = express.Router();

// Get available countries
router.get('/countries', async (req, res) => {
  try {
    const countries = await getAvailableCountries();
    const countryData = countries.map(code => ({
      code,
      name: {
        'lt': 'Lithuania',
        'ee': 'Estonia',
        'lv': 'Latvia',
        'fi': 'Finland'
      }[code] || code.toUpperCase()
    }));
    
    res.json({
      success: true,
      data: countryData
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get latest price for a specific country (similar to Elering API)
router.get('/nps/price/:country/latest', async (req, res) => {
  try {
    const country = req.params.country.toLowerCase();
    
    if (country === 'all') {
      // Handle "all" pseudo country
      const latestPrices = await getLatestPriceAll();
      
      if (latestPrices.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'No price data found for any country',
          code: 'NO_DATA_FOUND'
        });
      }
      
      const data = latestPrices.map(price => ({
        timestamp: price.timestamp,
        price: parseFloat(price.price),
        country: price.country.toUpperCase()
      }));
      
      // Get the most recent timestamp for metadata
      const mostRecent = latestPrices.reduce((prev, current) => 
        (prev.timestamp > current.timestamp) ? prev : current
      );
      const priceDate = moment.unix(mostRecent.timestamp).tz("Europe/Vilnius");
      
      res.json({
        data,
        meta: {
          countries: latestPrices.map(p => p.country.toUpperCase()),
          date: priceDate.format('YYYY-MM-DD'),
          hour: priceDate.format('HH:00'),
          timezone: 'Europe/Vilnius',
          timestamp_local: priceDate.unix(),
          price_unit: 'EUR/MWh',
          data_type: 'latest_published_all',
          count: latestPrices.length
        }
      });
    } else {
      // Handle individual country
      const latestPrice = await getLatestPrice(country);
      
      if (!latestPrice) {
        return res.status(404).json({ 
          success: false,
          error: 'No price data found for the specified country',
          code: 'NO_DATA_FOUND'
        });
      }
      
      // Convert timestamp to Vilnius timezone for metadata
      const priceDate = moment.unix(latestPrice.timestamp).tz("Europe/Vilnius");
      
      res.json({
        data: [{
          timestamp: latestPrice.timestamp,
          price: parseFloat(latestPrice.price),
          country: country.toUpperCase()
        }],
        meta: {
          countries: [country.toUpperCase()],
          date: priceDate.format('YYYY-MM-DD'),
          hour: priceDate.format('HH:00'),
          timezone: 'Europe/Vilnius',
          timestamp_local: priceDate.unix(),
          price_unit: 'EUR/MWh',
          data_type: 'latest_published'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching latest price:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get current price for a specific country (current hour in Europe/Vilnius)
router.get('/nps/price/:country/current', async (req, res) => {
  try {
    const country = req.params.country.toLowerCase();
    
    if (country === 'all') {
      // Handle "all" pseudo country
      const currentPrices = await getCurrentHourPriceAll();
      
      if (currentPrices.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'No price data found for the current hour',
          code: 'NO_DATA_FOUND'
        });
      }
      
      const data = currentPrices.map(price => ({
        timestamp: price.timestamp,
        price: parseFloat(price.price),
        country: price.country.toUpperCase()
      }));
      
      // Convert timestamp to Vilnius timezone for metadata
      const priceDate = moment.unix(currentPrices[0].timestamp).tz("Europe/Vilnius");
      const nowVilnius = moment().tz("Europe/Vilnius");
      
      res.json({
        data,
        meta: {
          countries: currentPrices.map(p => p.country.toUpperCase()),
          date: priceDate.format('YYYY-MM-DD'),
          hour: priceDate.format('HH:00'),
          timezone: 'Europe/Vilnius',
          timestamp_local: priceDate.unix(),
          price_unit: 'EUR/MWh',
          data_type: 'current_hour_all',
          current_time_local: nowVilnius.format('YYYY-MM-DD HH:mm:ss'),
          is_current_hour: nowVilnius.format('HH') === priceDate.format('HH'),
          count: currentPrices.length
        }
      });
    } else {
      // Handle individual country
      const currentPrice = await getCurrentHourPrice(country);
      
      if (!currentPrice) {
        return res.status(404).json({ 
          success: false,
          error: 'No price data found for the current hour',
          code: 'NO_DATA_FOUND'
        });
      }
      
      // Convert timestamp to Vilnius timezone for metadata
      const priceDate = moment.unix(currentPrice.timestamp).tz("Europe/Vilnius");
      const nowVilnius = moment().tz("Europe/Vilnius");
      
      res.json({
        data: [{
          timestamp: currentPrice.timestamp,
          price: parseFloat(currentPrice.price),
          country: country.toUpperCase()
        }],
        meta: {
          countries: [country.toUpperCase()],
          date: priceDate.format('YYYY-MM-DD'),
          hour: priceDate.format('HH:00'),
          timezone: 'Europe/Vilnius',
          timestamp_local: priceDate.unix(),
          price_unit: 'EUR/MWh',
          data_type: 'current_hour',
          current_time_local: nowVilnius.format('YYYY-MM-DD HH:mm:ss'),
          is_current_hour: nowVilnius.format('HH') === priceDate.format('HH')
        }
      });
    }
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get price data for a specific date or date range
router.get('/nps/prices', async (req, res) => {
  try {
    let { date, start, end, country } = req.query;
    const requestedAll = !country;
    country = (country || '').toLowerCase();
    
    let startDate, endDate;

    if (date && date.trim() !== '') {
      // Single date query - query based on target timezone
      const userDate = moment.tz(date, "Europe/Vilnius").startOf('day');
      const userEndDate = moment.tz(date, "Europe/Vilnius").endOf('day');
      
      // Convert to UTC for database querying
      // Extend the range to ensure we capture all timestamps for this date
      // The end timestamp needs to include the last hour of the day in Vilnius time
      startDate = userDate.utc().format();
      // Add 1 hour to endDate to ensure we capture timestamps up to 23:59:59 Vilnius time
      // (which might be 22:59:59 or 21:59:59 UTC depending on DST)
      endDate = userEndDate.utc().add(1, 'hour').format();

      console.log(`Fetching prices for ${date} (${country}) - User timezone range: ${userDate.format('YYYY-MM-DD HH:mm:ss')} to ${userEndDate.format('YYYY-MM-DD HH:mm:ss')} (Vilnius)`);
      console.log(`Database query range: ${startDate} to ${endDate} (UTC)`);
    } else if (start && start.trim() !== '' && end && end.trim() !== '') {
      // Date range query - query based on target timezone
      const userStartDate = moment.tz(start, "Europe/Vilnius").startOf('day');
      const userEndDate = moment.tz(end, "Europe/Vilnius").endOf('day');
      
      // Convert to UTC for database querying
      // Extend the end range to ensure we capture all timestamps for the last date
      startDate = userStartDate.utc().format();
      endDate = userEndDate.utc().add(1, 'hour').format();

      console.log(`Fetching prices for range ${start} to ${end} (${country}) - User timezone range: ${userStartDate.format('YYYY-MM-DD HH:mm:ss')} to ${userEndDate.format('YYYY-MM-DD HH:mm:ss')} (Vilnius)`);
      console.log(`Database query range: ${startDate} to ${endDate} (UTC)`);
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Either date parameter or start/end parameters are required',
        code: 'INVALID_PARAMETERS'
      });
    }

    let rawData;
    if (requestedAll) {
      rawData = await getPriceDataAll(startDate, endDate);
    } else {
      rawData = await getPriceData(startDate, endDate, country);
    }
    
    // Filter results to only include timestamps within the requested date(s) in Vilnius timezone
    // This ensures we don't include data from adjacent days due to UTC timezone differences
    if (date) {
      // Single date query - filter to only this date in Vilnius timezone
      const dateStart = moment.tz(date, "Europe/Vilnius").startOf('day').unix();
      const dateEnd = moment.tz(date, "Europe/Vilnius").endOf('day').unix();
      
      rawData = rawData.filter(item => 
        item.timestamp >= dateStart && item.timestamp <= dateEnd
      );
    } else if (start && end) {
      // Date range query - filter to only dates within the range in Vilnius timezone
      const rangeStart = moment.tz(start, "Europe/Vilnius").startOf('day').unix();
      const rangeEnd = moment.tz(end, "Europe/Vilnius").endOf('day').unix();
      
      rawData = rawData.filter(item => 
        item.timestamp >= rangeStart && item.timestamp <= rangeEnd
      );
    }
    
    // Check if we have sufficient data for the requested date(s)
    // For single date queries, check if we have sufficient data for that date
    // For date range queries, check if we're missing significant portions
    let needsLiveFetch = false;
    if (rawData.length === 0) {
      needsLiveFetch = true;
    } else if (date) {
      // For single date, check if we have sufficient records
      // Expected: 23-25 for 60-min MTU (accounting for DST), 92-100 for 15-min MTU (accounting for DST)
      // Use the same logic as isDateComplete: check if count is within expected range
      const recordCount = rawData.length;
      let isComplete = false;
      
      if (recordCount >= 90) {
        // 15-minute MTU: expect 92-100 records (accounting for DST)
        isComplete = recordCount >= 92 && recordCount <= 100;
      } else if (recordCount > 0) {
        // 60-minute MTU: expect 23-25 records (accounting for DST)
        isComplete = recordCount >= 23 && recordCount <= 25;
      }
      
      if (!isComplete) {
        needsLiveFetch = true;
        console.log(`[On-Demand Fetch] Insufficient data for ${date}: found ${recordCount} records, expected 23-25 (60-min) or 92-100 (15-min)`);
      }
    }
    
    // If no data found or insufficient data, try on-demand fetch from Elering API
    if (needsLiveFetch) {
      console.log(`[On-Demand Fetch] No or insufficient data in DB for ${date || `${start} to ${end}`} (${country || 'all'}), attempting live fetch...`);
      
      try {
        // Determine date range for fetch
        let fetchStartDate, fetchEndDate;
        if (date) {
          fetchStartDate = moment.tz(date, "Europe/Vilnius").format('YYYY-MM-DD');
          fetchEndDate = fetchStartDate;
        } else if (start && end) {
          fetchStartDate = moment.tz(start, "Europe/Vilnius").format('YYYY-MM-DD');
          fetchEndDate = moment.tz(end, "Europe/Vilnius").format('YYYY-MM-DD');
        } else {
          return res.status(404).json({ 
            success: false,
            error: 'No price data found for the specified date range',
            code: 'NO_DATA_FOUND'
          });
        }
        
        // Fetch data from Elering API
        const eleringApi = syncWorker.api;
        if (requestedAll) {
          // Fetch all countries
          const allCountriesData = await eleringApi.fetchAllCountriesData(fetchStartDate, fetchEndDate);
          
          // Store in database
          for (const [countryCode, countryData] of Object.entries(allCountriesData)) {
            if (countryData && countryData.length > 0) {
              await syncWorker.insertPriceData(countryData, countryCode);
            }
          }
          
          // Re-query database
          rawData = await getPriceDataAll(startDate, endDate);
        } else {
          // Fetch single country
          const countryData = await eleringApi.fetchPricesForRange(fetchStartDate, fetchEndDate, country);
          
          if (countryData && countryData.length > 0) {
            // Store in database
            await syncWorker.insertPriceData(countryData, country);
            
            // Re-query database
            rawData = await getPriceData(startDate, endDate, country);
          }
        }
        
        // Filter re-queried data to only include requested date(s) in Vilnius timezone
        if (date) {
          const dateStart = moment.tz(date, "Europe/Vilnius").startOf('day').unix();
          const dateEnd = moment.tz(date, "Europe/Vilnius").endOf('day').unix();
          rawData = rawData.filter(item => 
            item.timestamp >= dateStart && item.timestamp <= dateEnd
          );
        } else if (start && end) {
          const rangeStart = moment.tz(start, "Europe/Vilnius").startOf('day').unix();
          const rangeEnd = moment.tz(end, "Europe/Vilnius").endOf('day').unix();
          rawData = rawData.filter(item => 
            item.timestamp >= rangeStart && item.timestamp <= rangeEnd
          );
        }
        
        if (rawData.length === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'No price data available from Elering API for the specified date range',
            code: 'NO_DATA_FOUND'
          });
        }
        
        console.log(`[On-Demand Fetch] Successfully fetched and stored ${rawData.length} records`);
      } catch (error) {
        console.error(`[On-Demand Fetch] Error fetching data from Elering API:`, error.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch data from Elering API',
          code: 'FETCH_ERROR',
          details: error.message
        });
      }
    }
    
    // Group by country when requesting all
    const grouped = requestedAll
      ? rawData.reduce((acc, item) => {
          const key = item.country.toLowerCase();
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {})
      : { [country]: rawData };

    // Transform data per country and convert to local timezone
    const data = {};
    Object.entries(grouped).forEach(([code, items]) => {
      data[code] = items.map(item => ({
        timestamp: moment.unix(item.timestamp).tz("Europe/Vilnius").unix(),
        price: parseFloat(item.price)
      }));
    });

    // Infer MTU length from raw data (first country with at least 2 points)
    let intervalSeconds = null;
    const anyItems = Object.values(grouped).find(arr => arr.length >= 2);
    if (anyItems) {
      const diff = anyItems[1].timestamp - anyItems[0].timestamp;
      if (diff > 0) intervalSeconds = diff;
    }

    res.json({
      success: true,
      data,
      meta: {
        date: date || `${start} to ${end}`,
        country: requestedAll ? 'all' : country,
        count: rawData.length,
        timezone: 'Europe/Vilnius',
        intervalSeconds
      }
    });
  } catch (error) {
    console.error('Error fetching price data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Upcoming prices from current MTU to end of today and tomorrow (Vilnius time)
router.get('/nps/prices/upcoming', async (req, res) => {
  try {
    let { country = 'lt' } = req.query;
    country = country.toLowerCase();

    const nowVilnius = moment().tz("Europe/Vilnius");
    const windowStart = nowVilnius.clone().startOf('day');
    // Extend window to include full next day to avoid cutoff at midnight
    const windowEnd = nowVilnius.clone().add(8, 'days').endOf('day');

    const startDate = windowStart.utc().format();
    const endDate = windowEnd.utc().format();

    const rawData = await getPriceData(startDate, endDate, country);

    if (rawData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No upcoming price data available',
        code: 'NO_DATA_FOUND'
      });
    }

    // Infer interval length so we can include the current slot (start <= now < end)
    let intervalSeconds = null;
    if (rawData.length >= 2) {
      const diff = rawData[1].timestamp - rawData[0].timestamp;
      if (diff > 0) intervalSeconds = diff;
    }
    if (!intervalSeconds) {
      intervalSeconds = 3600;
    }

    const upcomingRaw = rawData
      .filter(item => {
        const startLocal = moment.unix(item.timestamp).tz("Europe/Vilnius");
        const endLocal = startLocal.clone().add(intervalSeconds, 'seconds');
        // Include current slot (start <= now < end) and all future slots (start > now)
        // Explicitly check: slot contains "now" OR slot starts in the future
        const isCurrentSlot = startLocal.isSameOrBefore(nowVilnius) && endLocal.isAfter(nowVilnius);
        const isFutureSlot = startLocal.isAfter(nowVilnius);
        return isCurrentSlot || isFutureSlot;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    if (upcomingRaw.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No upcoming price data available',
        code: 'NO_DATA_FOUND'
      });
    }

    const transformedData = upcomingRaw.map(item => ({
      timestamp: moment.unix(item.timestamp).tz("Europe/Vilnius").unix(),
      price: parseFloat(item.price)
    }));

    const lastTs = upcomingRaw[upcomingRaw.length - 1].timestamp;
    const lastDateVilnius = moment.unix(lastTs).tz("Europe/Vilnius");

    res.json({
      success: true,
      data: {
        [country]: transformedData
      },
      meta: {
        country,
        count: transformedData.length,
        timezone: 'Europe/Vilnius',
        intervalSeconds,
        current_time_local: nowVilnius.format('YYYY-MM-DD HH:mm:ss'),
        date_range: {
          start: windowStart.format('YYYY-MM-DD'),
          end: lastDateVilnius.format('YYYY-MM-DD')
        }
      }
    });
  } catch (error) {
    console.error('Error fetching upcoming price data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Legacy endpoint for backward compatibility (redirects to new path)
router.get('/prices', async (req, res) => {
  // Redirect to the new endpoint
  const query = { ...req.query };
  if (query.country) query.country = query.country.toLowerCase();
  const queryString = new URLSearchParams(query).toString();
  res.redirect(`/nps/prices?${queryString}`);
});

// Get latest prices (compatibility endpoint)
router.get('/latest', async (req, res) => {
  try {
    const { country = 'lt' } = req.query;
    const latestPrice = await getLatestPrice(country);
    
    if (!latestPrice) {
      return res.status(404).json({ 
        success: false,
        error: 'No price data found for the specified country',
        code: 'NO_DATA_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: [{
        timestamp: moment.unix(latestPrice.timestamp).tz("Europe/Vilnius").unix(),
        price: parseFloat(latestPrice.price),
        country: latestPrice.country
      }],
      meta: {
        country,
        count: 1,
        timezone: 'Europe/Vilnius',
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching latest price:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    await updateSetting(key, value);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all price configurations (for frontend to cache)
// Optional country parameter: if provided, returns only that country's tariffs
// If omitted, returns all countries
router.get('/configurations', async (req, res) => {
  try {
    const { getAllPriceConfigurations, getAllSystemCharges } = await import('./database.js');
    const { country } = req.query;
    
    const tariffs = await getAllPriceConfigurations(country || null);
    const systemCharges = await getAllSystemCharges(country || null);
    
    res.json({
      success: true,
      data: {
        tariffs,
        systemCharges
      },
      meta: {
        country: country || 'all',
        count: Object.keys(tariffs).length
      }
    });
  } catch (error) {
    console.error('Error fetching configurations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Enhanced sync endpoints
router.post('/api/v1/sync/historical', async (req, res) => {
  try {
    const { startDate, endDate, country = 'lt' } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }
    
    console.log(`[API] Historical sync requested: ${country} from ${startDate} to ${endDate}`);
    const records = await syncWorker.syncHistoricalData(startDate, endDate, country);
    
    res.json({ 
      success: true, 
      message: `Historical sync completed for ${country.toUpperCase()}`,
      records,
      dateRange: { startDate, endDate, country }
    });
  } catch (error) {
    console.error('[API] Historical sync error:', error);
    res.status(500).json({ 
      error: 'Historical sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/year', async (req, res) => {
  try {
    const { year, country = 'lt' } = req.body;
    
    if (!year) {
      return res.status(400).json({ 
        error: 'year is required' 
      });
    }
    
    console.log(`[API] Year sync requested: ${country} for year ${year}`);
    const records = await syncWorker.syncYearData(year, country);
    
    res.json({ 
      success: true, 
      message: `Year sync completed for ${country.toUpperCase()} ${year}`,
      records,
      year,
      country
    });
  } catch (error) {
    console.error('[API] Year sync error:', error);
    res.status(500).json({ 
      error: 'Year sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/years', async (req, res) => {
  try {
    const { startYear, endYear, country = 'lt' } = req.body;
    
    if (!startYear || !endYear) {
      return res.status(400).json({ 
        error: 'startYear and endYear are required' 
      });
    }
    
    console.log(`[API] Year range sync requested: ${country} from ${startYear} to ${endYear}`);
    const records = await syncWorker.syncYearRange(startYear, endYear, country);
    
    res.json({ 
      success: true, 
      message: `Year range sync completed for ${country.toUpperCase()}`,
      records,
      yearRange: { startYear, endYear, country }
    });
  } catch (error) {
    console.error('[API] Year range sync error:', error);
    res.status(500).json({ 
      error: 'Year range sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/all-historical', async (req, res) => {
  try {
    const { country = 'lt' } = req.body;
    
    console.log(`[API] All historical sync requested: ${country}`);
    const records = await syncWorker.syncAllHistoricalData(country);
    
    res.json({ 
      success: true, 
      message: `All historical sync completed for ${country.toUpperCase()}`,
      records,
      country,
      note: 'This syncs all data from 2012-07-01 to today'
    });
  } catch (error) {
    console.error('[API] All historical sync error:', error);
    res.status(500).json({ 
      error: 'All historical sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/efficient', async (req, res) => {
  try {
    console.log('[API] Efficient sync requested for all countries');
    const records = await syncWorker.syncAllCountriesEfficient();
    
    res.json({ 
      success: true, 
      message: 'Efficient sync completed for all countries',
      records,
      countries: ['lt', 'ee', 'lv', 'fi']
    });
  } catch (error) {
    console.error('[API] Efficient sync error:', error);
    res.status(500).json({ 
      error: 'Efficient sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/all-countries-historical', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }
    
    console.log(`[API] All countries historical sync requested: ${startDate} to ${endDate}`);
    const records = await syncWorker.syncAllCountriesHistorical(startDate, endDate);
    
    res.json({ 
      success: true, 
      message: `All countries historical sync completed`,
      records,
      dateRange: { startDate, endDate },
      countries: ['lt', 'ee', 'lv', 'fi'],
      note: 'This syncs data for all countries in parallel using efficient API calls'
    });
  } catch (error) {
    console.error('[API] All countries historical sync error:', error);
    res.status(500).json({ 
      error: 'All countries historical sync failed', 
      details: error.message 
    });
  }
});

router.post('/api/v1/sync/all-countries-all-historical', async (req, res) => {
  try {
    console.log(`[API] All countries all historical sync requested (2012-07-01 to today)`);
    const records = await syncWorker.syncAllCountriesHistorical('2012-07-01', moment().format('YYYY-MM-DD'));
    
    res.json({ 
      success: true, 
      message: `All countries all historical sync completed`,
      records,
      dateRange: { startDate: '2012-07-01', endDate: moment().format('YYYY-MM-DD') },
      countries: ['lt', 'ee', 'lv', 'fi'],
      note: 'This syncs all historical data for all countries from 2012-07-01 to today'
    });
  } catch (error) {
    console.error('[API] All countries all historical sync error:', error);
    res.status(500).json({ 
      error: 'All countries all historical sync failed', 
      details: error.message 
    });
  }
});

// Get initial sync status
router.get('/sync/initial-status', async (req, res) => {
  try {
    const status = await getInitialSyncStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting initial sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get initial sync status',
      details: error.message
    });
  }
});

// Check date completeness
router.get('/sync/date-complete/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const completeness = await syncWorker.isDateComplete(date);
    res.json({
      success: true,
      data: completeness
    });
  } catch (error) {
    console.error('Error checking date completeness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check date completeness',
      details: error.message
    });
  }
});

// Check recent data completeness (today and yesterday)
router.get('/sync/recent-completeness', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
    
    const todayStatus = await syncWorker.isDateComplete(today);
    const yesterdayStatus = await syncWorker.isDateComplete(yesterday);
    
    res.json({
      success: true,
      data: {
        today: todayStatus,
        yesterday: yesterdayStatus,
        needsSync: !yesterdayStatus.isComplete
      }
    });
  } catch (error) {
    console.error('Error checking recent completeness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check recent completeness',
      details: error.message
    });
  }
});

// Comprehensive health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    const stats = await getDatabaseStats();
    const syncStatus = syncWorker.getStatus();
    const countrySyncStatus = await getAllCountrySyncStatus();
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        ...health.system,
        uptime: Math.floor(health.system.uptime / 3600) + ' hours'
      },
      database: {
        ...health.database,
        stats: {
          totalRecords: stats.totalRecords,
          countries: stats.countries,
          databaseSize: stats.databaseSize,
          tableSizes: stats.tableSizes
        }
      },
      sync: {
        ...health.sync,
        worker: syncStatus,
        recentActivity: stats.recentSyncs,
        statistics: stats.syncStats,
        countrySyncStatus: countrySyncStatus
      },
      scheduledJobs: syncStatus.scheduledJobs,
      dataFreshness: health.sync.dataFreshness
    };
    
    // Check if we're in the active period for daily sync
    const now = moment().tz('UTC');
    const activeStart = moment().tz('UTC').set({ hour: 12, minute: 45, second: 0, millisecond: 0 });
    const activeEnd = moment().tz('UTC').set({ hour: 15, minute: 55, second: 0, millisecond: 0 });
    const isInActivePeriod = now.isBetween(activeStart, activeEnd, null, '[]'); // inclusive
    
    // Add overall health status
    const isHealthy = health.database.connected && 
                     health.sync.dataFreshness.every(country => country.isRecent);
    
    response.overallStatus = isHealthy ? 'healthy' : 'degraded';
    response.issues = [];
    
    if (!health.database.connected) {
      response.issues.push('Database connection failed');
    }
    
    const staleData = health.sync.dataFreshness.filter(country => !country.isRecent);
    if (staleData.length > 0) {
      response.issues.push(`Stale data detected: ${staleData.map(c => `${c.country.toUpperCase()} (${c.hoursOld}h old)`).join(', ')}`);
    }
    
    // Only report sync worker issues during active period
    if (!syncStatus.isRunning && isInActivePeriod) {
      response.issues.push('Sync worker not running');
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset initial sync status (for testing)
router.post('/sync/reset-initial', async (req, res) => {
  try {
    // Clear both initial sync completion and last chunk completion
    await pool.query(`
      DELETE FROM user_settings 
      WHERE setting_key IN ('initial_sync_completed', 'initial_sync_last_chunk')
    `);
    
    res.json({
      success: true,
      message: 'Initial sync status reset successfully. Restart the backend to trigger initial sync.'
    });
  } catch (error) {
    console.error('Error resetting initial sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset initial sync status',
      details: error.message
    });
  }
});

export default router; 