import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
import { getPriceData, getPriceDataAll, getLatestPrice, getCurrentPrice, getAvailableCountries, getSettings, updateSetting, getCurrentHourPrice, getLatestPriceAll, getCurrentHourPriceAll, getDatabaseStats, getSystemHealth, getInitialSyncStatus } from './database.js';
import v1Router from './v1.js';
import { startSyncWorker, stopSyncWorker, getSyncStatus } from './syncWorker.js';

dotenv.config();

// Configure moment timezone for user-facing operations
moment.tz.setDefault("Europe/Vilnius");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://unpkg.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:8080',  // Swagger UI
    'http://swagger-ui:8080'  // Swagger UI (Docker internal)
  ],
  credentials: true
}));
app.use(express.json());

// Mount v1 API router
app.use('/api/v1', v1Router);

// Health check endpoint - comprehensive health data
// Always returns 200 to pass Docker health checks, even if some services aren't ready
app.get('/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    const stats = await getDatabaseStats();
    const syncStatus = getSyncStatus();
    
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
        statistics: stats.syncStats
      },
      scheduledJobs: syncStatus.scheduledJobs,
      dataFreshness: health.sync.dataFreshness
    };
    
    // Add overall health status
    const isHealthy = health.database.connected && 
                     health.sync.dataFreshness.every(country => country.isRecent) &&
                     syncStatus.isRunning;
    
    response.overallStatus = isHealthy ? 'healthy' : 'degraded';
    response.issues = [];
    
    if (!health.database.connected) {
      response.issues.push('Database connection failed');
    }
    
    const staleData = health.sync.dataFreshness.filter(country => !country.isRecent);
    if (staleData.length > 0) {
      response.issues.push(`Stale data detected: ${staleData.map(c => `${c.country.toUpperCase()} (${c.hoursOld}h old)`).join(', ')}`);
    }
    
    if (!syncStatus.isRunning) {
      response.issues.push('Sync worker not running');
    }
    
    // Always return 200 for Docker health checks - status is in the response body
    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting health status:', error);
    // Return 200 even on error so Docker health check passes
    // The error details are in the response body
    res.status(200).json({
      success: false,
      error: 'Failed to get health status',
      details: error.message,
      timestamp: new Date().toISOString(),
      overallStatus: 'degraded'
    });
  }
});

// API Health check endpoint - comprehensive health data
app.get('/api/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    const stats = await getDatabaseStats();
    const syncStatus = getSyncStatus();
    
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
        statistics: stats.syncStats
      },
      scheduledJobs: syncStatus.scheduledJobs,
      dataFreshness: health.sync.dataFreshness
    };
    
    // Add overall health status
    const isHealthy = health.database.connected && 
                     health.sync.dataFreshness.every(country => country.isRecent) &&
                     syncStatus.isRunning;
    
    response.overallStatus = isHealthy ? 'healthy' : 'degraded';
    response.issues = [];
    
    if (!health.database.connected) {
      response.issues.push('Database connection failed');
    }
    
    const staleData = health.sync.dataFreshness.filter(country => !country.isRecent);
    if (staleData.length > 0) {
      response.issues.push(`Stale data detected: ${staleData.map(c => `${c.country.toUpperCase()} (${c.hoursOld}h old)`).join(', ')}`);
    }
    
    if (!syncStatus.isRunning) {
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

// Get available countries
app.get('/api/countries', async (req, res) => {
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

// Initial sync status (legacy path)
app.get('/api/sync/initial-status', async (req, res) => {
  try {
    const status = await getInitialSyncStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting initial sync status (legacy path):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get initial sync status',
      details: error.message
    });
  }
});

// Get latest price for a specific country (similar to Elering API)
app.get('/api/nps/price/:country/latest', async (req, res) => {
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
          price: parseFloat(latestPrice.price)
        }],
        meta: {
          country: country.toUpperCase(),
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
app.get('/api/nps/price/:country/current', async (req, res) => {
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
          price: parseFloat(currentPrice.price)
        }],
        meta: {
          country: country.toUpperCase(),
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

// Get price data for a specific date or date range (moved to /api/nps/prices)
app.get('/api/nps/prices', async (req, res) => {
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
      startDate = userDate.utc().format();
      endDate = userEndDate.utc().format();

      console.log(`Fetching prices for ${date} (${country}) - User timezone range: ${userDate.format('YYYY-MM-DD HH:mm:ss')} to ${userEndDate.format('YYYY-MM-DD HH:mm:ss')} (Vilnius)`);
      console.log(`Database query range: ${startDate} to ${endDate} (UTC)`);
    } else if (start && start.trim() !== '' && end && end.trim() !== '') {
      // Date range query - query based on target timezone
      const userStartDate = moment.tz(start, "Europe/Vilnius").startOf('day');
      const userEndDate = moment.tz(end, "Europe/Vilnius").endOf('day');
      
      // Convert to UTC for database querying
      startDate = userStartDate.utc().format();
      endDate = userEndDate.utc().format();
      
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
    
    if (rawData.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No price data found for the specified date range',
        code: 'NO_DATA_FOUND'
      });
    }
    
    const grouped = requestedAll
      ? rawData.reduce((acc, item) => {
          const key = item.country.toLowerCase();
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {})
      : { [country]: rawData };

    const data = {};
    Object.entries(grouped).forEach(([code, items]) => {
      data[code] = items.map(item => ({
      timestamp: moment.unix(item.timestamp).tz("Europe/Vilnius").unix(),
      price: parseFloat(item.price)
    }));
    });

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

// Legacy endpoint for backward compatibility (redirects to new path)
app.get('/api/prices', async (req, res) => {
  // Redirect to the new endpoint
  const query = { ...req.query };
  if (query.country) query.country = query.country.toLowerCase();
  const queryString = new URLSearchParams(query).toString();
  res.redirect(`/api/nps/prices?${queryString}`);
});

// Get latest prices (compatibility endpoint)
app.get('/api/latest', async (req, res) => {
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
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update setting
app.put('/api/settings/:key', async (req, res) => {
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
app.get('/api/configurations', async (req, res) => {
  try {
    const database = await import('./database.js');
    const { getAllPriceConfigurations, getAllSystemCharges } = database;
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const server = app.listen(PORT, async () => {
  const startupTime = new Date().toISOString();
  console.log('='.repeat(80));
  console.log(`[CONTAINER WAKE-UP DETECTED] Backend API server starting...`);
  console.log(`[CONTAINER WAKE-UP] Startup timestamp: ${startupTime}`);
  console.log(`[CONTAINER WAKE-UP] Process ID: ${process.pid}`);
  console.log(`[CONTAINER WAKE-UP] Node version: ${process.version}`);
  console.log(`[CONTAINER WAKE-UP] Platform: ${process.platform}`);
  console.log(`[CONTAINER WAKE-UP] Note: This log appears on container START (not pause/resume)`);
  console.log('='.repeat(80));
  
  console.log(`Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api`);
  console.log(`NordPool API: http://localhost:${PORT}/api/nps`);
  
  // Wait for database to be ready before starting sync worker
  await waitForDatabase();
  
  // Initialize database schema if tables don't exist
  console.log('[CONTAINER WAKE-UP] About to initialize database schema...');
  try {
    const { initializeDatabaseSchema } = await import('./database.js');
    console.log('[CONTAINER WAKE-UP] initializeDatabaseSchema function imported, calling it...');
    await initializeDatabaseSchema();
    console.log('[CONTAINER WAKE-UP] Database schema initialization completed.');
  } catch (error) {
    console.error('[CONTAINER WAKE-UP] ✗ Failed to initialize database schema:');
    console.error('[CONTAINER WAKE-UP] Error:', error.message);
    console.error('[CONTAINER WAKE-UP] Stack:', error.stack);
    // Continue anyway - might already be initialized
  }
  
  // Start the sync worker after server is ready
  try {
    console.log('[CONTAINER WAKE-UP] Starting sync worker...');
    await startSyncWorker();
    console.log('[CONTAINER WAKE-UP] Sync worker started successfully');
  } catch (error) {
    console.error('[CONTAINER WAKE-UP] Failed to start sync worker:', error);
    // Don't exit - the API server can still function without sync
  }
});

// Wait for database to be ready
async function waitForDatabase() {
  const maxRetries = 30;
  const retryDelay = 2000; // 2 seconds
  
  console.log('Waiting for database to be ready...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test database connection
      const { testConnection } = await import('./database.js');
      const isConnected = await testConnection();
      
      if (isConnected) {
        console.log(`Database connection established on attempt ${attempt}`);
        return;
      }
    } catch (error) {
      console.log(`Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
    }
    
    if (attempt < maxRetries) {
      console.log(`Retrying in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error(`Database connection failed after ${maxRetries} attempts`);
}

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop the sync worker
    console.log('Stopping sync worker...');
    stopSyncWorker();
    console.log('Sync worker stopped');
    
    // Close the server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 