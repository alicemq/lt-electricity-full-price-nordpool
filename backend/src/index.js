import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
import { getDatabaseStats, getSystemHealth } from './database.js';
import v1Router from './v1.js';
import { legacyApiShim } from './legacyApi.js';
import { startSyncWorker, stopSyncWorker, getSyncStatus } from './syncWorker.js';

dotenv.config();

moment.tz.setDefault('Europe/Vilnius');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://unpkg.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:8080',
    'http://swagger-ui:8080',
  ],
  credentials: true,
}));
app.use(express.json());

app.use('/api/v1', v1Router);
app.use('/api', legacyApiShim);

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
        uptime: `${Math.floor(health.system.uptime / 3600)} hours`,
      },
      database: {
        ...health.database,
        stats: {
          totalRecords: stats.totalRecords,
          countries: stats.countries,
          databaseSize: stats.databaseSize,
          tableSizes: stats.tableSizes,
        },
      },
      sync: {
        ...health.sync,
        worker: syncStatus,
        recentActivity: stats.recentSyncs,
        statistics: stats.syncStats,
      },
      scheduledJobs: syncStatus.scheduledJobs,
      dataFreshness: health.sync.dataFreshness,
    };

    const isHealthy = health.database.connected
      && health.sync.dataFreshness.every((country) => country.isRecent)
      && syncStatus.isRunning;

    response.overallStatus = isHealthy ? 'healthy' : 'degraded';
    response.issues = [];

    if (!health.database.connected) {
      response.issues.push('Database connection failed');
    }

    const staleData = health.sync.dataFreshness.filter((country) => !country.isRecent);
    if (staleData.length > 0) {
      response.issues.push(
        `Stale data detected: ${staleData.map((c) => `${c.country.toUpperCase()} (${c.hoursOld}h old)`).join(', ')}`,
      );
    }

    if (!syncStatus.isRunning) {
      response.issues.push('Sync worker not running');
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(200).json({
      success: false,
      error: 'Failed to get health status',
      details: error.message,
      timestamp: new Date().toISOString(),
      overallStatus: 'degraded',
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, async () => {
  const startupTime = new Date().toISOString();
  console.log('='.repeat(80));
  console.log('[CONTAINER WAKE-UP DETECTED] Backend API server starting...');
  console.log(`[CONTAINER WAKE-UP] Startup timestamp: ${startupTime}`);
  console.log(`[CONTAINER WAKE-UP] Process ID: ${process.pid}`);
  console.log(`[CONTAINER WAKE-UP] Node version: ${process.version}`);
  console.log(`[CONTAINER WAKE-UP] Platform: ${process.platform}`);
  console.log('[CONTAINER WAKE-UP] Note: This log appears on container START (not pause/resume)');
  console.log('='.repeat(80));

  console.log(`Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
  console.log(`Legacy API shim: http://localhost:${PORT}/api/* -> /api/v1/*`);

  await waitForDatabase();

  console.log('[CONTAINER WAKE-UP] About to initialize database schema...');
  try {
    const { initializeDatabaseSchema } = await import('./database.js');
    console.log('[CONTAINER WAKE-UP] initializeDatabaseSchema function imported, calling it...');
    await initializeDatabaseSchema();
    console.log('[CONTAINER WAKE-UP] Database schema initialization completed.');
  } catch (error) {
    console.error('[CONTAINER WAKE-UP] Failed to initialize database schema:');
    console.error('[CONTAINER WAKE-UP] Error:', error.message);
    console.error('[CONTAINER WAKE-UP] Stack:', error.stack);
  }

  try {
    console.log('[CONTAINER WAKE-UP] Starting sync worker...');
    await startSyncWorker();
    console.log('[CONTAINER WAKE-UP] Sync worker started successfully');
  } catch (error) {
    console.error('[CONTAINER WAKE-UP] Failed to start sync worker:', error);
  }
});

async function waitForDatabase() {
  const maxRetries = 30;
  const retryDelay = 2000;

  console.log('Waiting for database to be ready...');

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
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
      console.log(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Database connection failed after ${maxRetries} attempts`);
}

const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  try {
    console.log('Stopping sync worker...');
    stopSyncWorker();
    console.log('Sync worker stopped');

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
