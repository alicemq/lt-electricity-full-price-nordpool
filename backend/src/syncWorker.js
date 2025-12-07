import cron from 'node-cron';
import moment from 'moment-timezone';
import EleringAPI from './elering-api.js';
import { 
  testConnection, 
  getLatestTimestamp, 
  logSync,
  logScheduledJob,
  setInitialSyncComplete,
  isInitialSyncComplete,
  getInitialSyncStatus,
  getAllEarliestTimestamps,
  updateChunkCompletion,
  getLastCompletedChunk,
  markInitialSyncComplete,
  getCountrySyncStatus,
  getAllCountrySyncStatus,
  updateCountrySyncStatus,
  initializeCountrySyncStatus
} from './database.js';
import pool from './database.js';

// Configure moment timezone
moment.tz.setDefault("Europe/Vilnius");

class SyncWorker {
  constructor() {
    this.api = new EleringAPI();
    this.isRunning = false;
    this.jobs = new Map();
    this.startTime = moment();
    this.lastHealthCheck = null;
    this.lastProcessUptime = 0;
    this.healthCheckInterval = null;
    this.nordPoolJobs = {};
    this.weeklySyncJob = null;
    this.nextDaySyncJob = null;
    this.dailySyncJobs = [];
    this.dailySyncTimeout = null; // Track the current setTimeout for daily sync
    this.dailySyncNextRun = null; // Track when the next daily sync will run
    this.dailySyncLastCheck = null; // Track when the last sync check ran
    this.dailySyncSuppressedDate = null; // Track which date has suppressed daily sync
    this.dailySyncWatchdogInterval = null; // Watchdog to ensure sync is scheduled
    this.dailySyncFallbackCron = null; // Fallback cron job as safety net
  }

  // Start the worker
  async start() {
    const wakeUpTime = moment();
    console.log('='.repeat(80));
    console.log('[SYNC WORKER WAKE-UP] Starting Electricity Prices Sync Worker...');
    console.log('[SYNC WORKER WAKE-UP] Wake-up timestamp:', wakeUpTime.toISOString());
    console.log('[SYNC WORKER WAKE-UP] Current timezone:', moment.tz().zoneName());
    console.log('[SYNC WORKER WAKE-UP] Current time:', wakeUpTime.format('YYYY-MM-DD HH:mm:ss'));
    console.log('='.repeat(80));
    
    this.startTime = moment();

    // Check if we need to run a startup sync
    await this.checkStartupSync();

    // Schedule daily sync that runs every 15 minutes from 12:45 to 16:00 UTC
    this.scheduleDailySync();
    
    // Schedule weekly full sync (every Sunday at 2 AM)
    this.scheduleWeeklySync('0 2 * * 0', 'Weekly Full Sync');

    // Schedule next day sync (every day at 13:30 UTC - after NordPool publishes next day data)
    this.scheduleNextDaySync('30 13 * * *', 'Next Day Sync');

    // Start health monitoring
    this.startHealthMonitoring();

    // Historical data check is now optional and won't trigger additional syncs
    // await this.checkHistoricalDataPresence();

    console.log('Sync worker started successfully');
    console.log('Scheduled jobs:');
    const jobs = this.getScheduledJobs();
    jobs.forEach(job => {
      console.log(`- ${job.name}: ${job.description}`);
    });
  }

  // Start health monitoring (check every hour)
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60 * 60 * 1000); // Every hour

    // Perform initial health check
    this.performHealthCheck();
    
    console.log('Health monitoring started (every hour)');
  }

  // Perform comprehensive health check
  async performHealthCheck() {
    try {
      const now = moment();
      const processUptimeSeconds = process.uptime();
      const realElapsedSeconds = now.diff(this.startTime, 'seconds');
      const timeDifference = realElapsedSeconds - processUptimeSeconds;
      
      // Detect pause/resume using two methods:
      // 1. Compare consecutive health checks (if lastHealthCheck exists)
      // 2. Compare process uptime vs real elapsed time (always works)
      
      let pauseDetected = false;
      let pauseDuration = 0;
      
      if (this.lastHealthCheck) {
        const timeSinceLastCheck = now.diff(this.lastHealthCheck, 'seconds');
        const expectedProcessUptime = processUptimeSeconds - (this.lastProcessUptime || 0);
        
        // Method 1: If more than 5 minutes of real time passed but process only advanced a few seconds, we were paused
        if (timeSinceLastCheck > 300 && expectedProcessUptime < 60) {
          pauseDetected = true;
          pauseDuration = timeSinceLastCheck - expectedProcessUptime;
        }
      }
      
      // Method 2: If process uptime is significantly less than real elapsed time, we were paused at some point
      // This catches pauses even if lastHealthCheck wasn't set (e.g., first check after long pause)
      if (timeDifference > 300 && !pauseDetected) {
        pauseDetected = true;
        pauseDuration = timeDifference;
      }
      
      if (pauseDetected) {
        console.log('='.repeat(80));
        console.log(`[PAUSE/RESUME DETECTED] Container was paused and resumed!`);
        if (this.lastHealthCheck) {
          const timeSinceLastCheck = now.diff(this.lastHealthCheck, 'seconds');
          console.log(`[PAUSE/RESUME] Time since last health check: ${Math.floor(timeSinceLastCheck / 60)} minutes`);
        }
        console.log(`[PAUSE/RESUME] Process uptime: ${Math.floor(processUptimeSeconds / 60)} minutes`);
        console.log(`[PAUSE/RESUME] Real elapsed time: ${Math.floor(realElapsedSeconds / 60)} minutes`);
        console.log(`[PAUSE/RESUME] Estimated pause duration: ${Math.floor(pauseDuration / 60)} minutes`);
        console.log(`[PAUSE/RESUME] Triggering wake-up recovery sync...`);
        console.log('='.repeat(80));
        
        // Trigger wake-up recovery
        await this.checkAndSyncFromLastSyncOk();
      }
      
      this.lastHealthCheck = now;
      this.lastProcessUptime = processUptimeSeconds;
      
      console.log(`[Health Check] ${this.lastHealthCheck.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`[Health Check] Process uptime: ${Math.floor(processUptimeSeconds / 3600)}h ${Math.floor((processUptimeSeconds % 3600) / 60)}m`);
      console.log(`[Health Check] Real elapsed time: ${Math.floor(realElapsedSeconds / 3600)}h ${Math.floor((realElapsedSeconds % 3600) / 60)}m`);
      if (timeDifference > 60) {
        console.log(`[Health Check] Time difference (pause/resume indicator): ${Math.floor(timeDifference / 60)} minutes`);
      }
      
      const health = {
        timestamp: this.lastHealthCheck.toISOString(),
        uptime: moment.duration(moment().diff(this.startTime)).asHours(),
        processUptime: processUptimeSeconds,
        realElapsedTime: realElapsedSeconds,
        timeDifference: timeDifference,
        database: await this.checkDatabaseHealth(),
        cronJobs: this.checkCronJobsHealth(),
        dataCompleteness: await this.checkDataCompleteness(),
        nextSync: await this.getNextSyncInfo()
      };

      // Log health status
      await this.logHealthStatus(health);

      // Check if any issues need attention
      const issues = this.analyzeHealthIssues(health);
      if (issues.length > 0) {
        console.log(`[Health Check] Issues detected: ${issues.join(', ')}`);
        await this.handleHealthIssues(issues, health);
      } else {
        console.log('[Health Check] All systems healthy');
      }

      return health;
    } catch (error) {
      console.error('[Health Check] Error during health check:', error);
      return { error: error.message };
    }
  }

  // Check database health
  async checkDatabaseHealth() {
    try {
      const result = await pool.query('SELECT 1 as health_check');
      const latestSync = await this.getLastSyncTime();
      
      return {
        connected: true,
        lastSync: latestSync,
        lastSyncAge: latestSync ? moment.duration(moment().diff(moment(latestSync))).asHours() : null
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // Check cron jobs health
  checkCronJobsHealth() {
    const jobs = {};
    
    // Check daily sync job
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      const hasNextRun = this.dailySyncJobs.some(job => job.nextDate && job.nextDate());
      jobs['Daily Sync'] = {
        scheduled: hasNextRun,
        nextRun: this.dailySyncJobs.map(job => job.nextDate ? job.nextDate().toISOString() : null).filter(Boolean).sort()[0] || null
      };
    }
    
    // Check weekly sync job
    if (this.weeklySyncJob) {
      const hasNextRun = this.weeklySyncJob.nextDate && this.weeklySyncJob.nextDate();
      jobs['Weekly Sync'] = {
        scheduled: hasNextRun,
        nextRun: this.weeklySyncJob.nextDate ? this.weeklySyncJob.nextDate().toISOString() : null
      };
    }
    
    // Check next day sync job
    if (this.nextDaySyncJob) {
      const hasNextRun = this.nextDaySyncJob.nextDate && this.nextDaySyncJob.nextDate();
      jobs['Next Day Sync'] = {
        scheduled: hasNextRun,
        nextRun: this.nextDaySyncJob.nextDate ? this.nextDaySyncJob.nextDate().toISOString() : null
      };
    }
    
    return jobs;
  }

  // Check data completeness
  async checkDataCompleteness() {
    try {
      const countries = ['lt', 'ee', 'lv', 'fi'];
      const completeness = {};
      
      for (const country of countries) {
        const latestTimestamp = await this.getLatestPriceTimestamp(country);
        if (!latestTimestamp) {
          completeness[country] = { hasData: false, latestHour: null, missingHours: null };
          continue;
        }

        const latestDate = moment.unix(latestTimestamp).tz('Europe/Vilnius');
        const now = moment().tz('Europe/Vilnius');
        const expectedLatest = now.clone().add(1, 'day').endOf('day'); // Should have tomorrow's data
        
        const missingHours = expectedLatest.diff(latestDate, 'hours');
        
        completeness[country] = {
          hasData: true,
          latestHour: latestDate.format('YYYY-MM-DD HH:mm'),
          missingHours: Math.max(0, missingHours),
          isUpToDate: missingHours <= 0
        };
      }
      
      return completeness;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get next sync information
  async getNextSyncInfo() {
    const now = moment().tz('Europe/Vilnius');
    const nextNordPool = this.getNextNordPoolSyncTime();
    const nextWeekly = this.getNextWeeklySyncTime();
    const nextNextDay = this.getNextNextDaySyncTime();
    
    return {
      nordPool: nextNordPool,
      weekly: nextWeekly,
      nextDay: nextNextDay,
      nextSync: this.getEarliestTime([nextNordPool, nextWeekly, nextNextDay])
    };
  }

  // Analyze health issues
  analyzeHealthIssues(health) {
    const issues = [];
    
    // Database issues
    if (!health.database.connected) {
      issues.push('Database disconnected');
    }
    
    // Data completeness issues
    if (health.dataCompleteness) {
      Object.entries(health.dataCompleteness).forEach(([country, data]) => {
        if (data.error) {
          issues.push(`${country.toUpperCase()} data check failed`);
        } else if (!data.hasData) {
          issues.push(`${country.toUpperCase()} has no data`);
        } else if (data.missingHours > 24) {
          issues.push(`${country.toUpperCase()} missing ${data.missingHours} hours`);
        }
      });
    }
    
    // Check if we're in the active period for daily sync
    const now = moment().tz('UTC');
    const activeStart = moment().tz('UTC').set({ hour: 12, minute: 45, second: 0, millisecond: 0 });
    const activeEnd = moment().tz('UTC').set({ hour: 15, minute: 55, second: 0, millisecond: 0 });
    const isInActivePeriod = now.isBetween(activeStart, activeEnd, null, '[]'); // inclusive
    
    // Cron job issues - only report daily sync issues during active period
    Object.entries(health.cronJobs).forEach(([jobName, job]) => {
      if (!job.scheduled) {
        // Only report daily sync issues during active period
        if (jobName === 'Daily Sync' && !isInActivePeriod) {
          // Outside active period - daily sync not running is expected
          return;
        }
        // Report other job issues or daily sync issues during active period
        issues.push(`${jobName} cron job not running`);
      }
    });
    
    return issues;
  }

  // Handle health issues
  async handleHealthIssues(issues, health) {
    // If database is disconnected, try to reconnect
    if (issues.includes('Database disconnected')) {
      console.log('[Health Check] Attempting database reconnection...');
      // The database connection will be retried on next operation
    }
    
    // If data is missing, trigger a catch-up sync
    const missingDataIssues = issues.filter(issue => issue.includes('missing') || issue.includes('has no data'));
    if (missingDataIssues.length > 0) {
      console.log('[Health Check] Triggering catch-up sync due to missing data...');
      await this.triggerCatchUpSync();
    }
  }

  // Log health status
  async logHealthStatus(health) {
    try {
      await pool.query(
        `INSERT INTO sync_log (sync_type, status, records_processed, error_message, started_at, completed_at, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'health_check',
          'success',
          0,
          JSON.stringify(health),
          this.lastHealthCheck.toDate(),
          moment().toDate(),
          moment().diff(this.lastHealthCheck)
        ]
      );
    } catch (error) {
      console.error('[Health Check] Failed to log health status:', error);
    }
  }

  // Check startup sync need
  async checkStartupSync() {
    console.log('[Startup Sync] Checking initial sync status...');
    
    // First sanity check: If DB doesn't say initial sync is complete, run initial sync
    const initialSyncStatus = await getInitialSyncStatus();
    if (initialSyncStatus.isComplete) {
      console.log(`[Startup Sync] Initial sync already completed to ${initialSyncStatus.completedDate} (${initialSyncStatus.recordsCount} records)`);
      
      // Check country sync status and sync from last_sync_ok_date
      console.log('[Startup Sync] Checking country sync status for wake-up recovery...');
      await this.checkAndSyncFromLastSyncOk();
      
      return;
    }
    
    // Initial sync not complete - run full initial sync with chunk tracking
    console.log('[Startup Sync] Initial sync not complete, running full initial sync with chunk tracking...');
    
    try {
      const totalRecords = await this.runInitialSyncWithChunks();
      console.log(`[Startup Sync] Initial sync completed successfully: ${totalRecords} records`);
      
      // After initial sync, initialize country sync status
      await this.initializeCountrySyncStatuses();
    } catch (error) {
      console.error('[Startup Sync] Error during initial sync:', error.message);
    }
  }

  // Update sync status for all countries based on latest complete date
  async updateAllCountriesSyncStatus(targetDate) {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    
    // Find the latest timestamp across all countries
    let globalMaxTimestamp = null;
    for (const country of countries) {
      const latestTimestamp = await this.getLatestPriceTimestamp(country);
      if (latestTimestamp && (!globalMaxTimestamp || latestTimestamp > globalMaxTimestamp)) {
        globalMaxTimestamp = latestTimestamp;
      }
    }
    
    if (!globalMaxTimestamp) {
      console.log('[Sync Status] No data found for any country, cannot update sync status');
      return;
    }
    
    const maxDate = moment.unix(globalMaxTimestamp).tz('Europe/Vilnius');
    const now = moment().tz('Europe/Vilnius');
    const targetMoment = targetDate || now.clone().add(2, 'days');
    
    // Find the last fully complete date (check backwards from maxDate)
    let lastCompleteDate = null;
    let lastCompleteTimestamp = null;
    let checkDate = maxDate.clone().startOf('day');
    const minCheckDate = moment('2012-07-01').tz('Europe/Vilnius');
    
    // Check up to 7 days back to find the last complete date
    for (let i = 0; i < 7 && checkDate.isSameOrAfter(minCheckDate, 'day'); i++) {
      const dateStr = checkDate.format('YYYY-MM-DD');
      const dateStatus = await this.isDateComplete(dateStr);
      
      if (dateStatus.isComplete) {
        lastCompleteDate = checkDate.clone();
        lastCompleteTimestamp = checkDate.clone().startOf('day').unix();
        console.log(`[Sync Status] Found last complete date: ${dateStr} (maxTimestamp was ${maxDate.format('YYYY-MM-DD HH:mm:ss')})`);
        break;
      }
      
      checkDate.subtract(1, 'day');
    }
    
    // Update all countries with the same last complete date
    if (lastCompleteDate) {
      const cappedDate = lastCompleteDate.isAfter(targetMoment) ? targetMoment : lastCompleteDate;
      const cappedTimestamp = lastCompleteDate.isAfter(targetMoment) 
        ? targetMoment.clone().startOf('day').unix() 
        : lastCompleteDate.clone().startOf('day').unix();
      
      for (const country of countries) {
        await updateCountrySyncStatus(country, cappedDate.format('YYYY-MM-DD'), cappedTimestamp, true);
      }
      console.log(`[Sync Status] Updated all countries: sync_ok=true, last_sync_ok_date=${cappedDate.format('YYYY-MM-DD')} (fully complete)`);
    } else {
      // No complete dates found - update each country with its current status but mark sync_ok=false
      for (const country of countries) {
        const currentStatus = await getCountrySyncStatus(country);
        if (currentStatus) {
          await updateCountrySyncStatus(country, currentStatus.last_sync_ok_date, currentStatus.last_sync_ok_timestamp, false);
        }
      }
      console.log(`[Sync Status] No complete dates found, all countries marked sync_ok=false`);
    }
  }

  // Check country sync status and sync from last_sync_ok_date (wake-up recovery)
  async checkAndSyncFromLastSyncOk() {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    const now = moment().tz('Europe/Vilnius');
    
    console.log('[Wake-up Recovery] Checking country sync status from DB...');
    
    // First, initialize any missing sync statuses
    for (const country of countries) {
      try {
        const syncStatus = await getCountrySyncStatus(country);
        
        if (!syncStatus) {
          // No sync status exists - initialize from latest data in DB
          console.log(`[Wake-up Recovery] ${country.toUpperCase()}: No sync status found, initializing from database...`);
          const latestTimestamp = await this.getLatestPriceTimestamp(country);
          
          if (latestTimestamp) {
            const latestDate = moment.unix(latestTimestamp).tz('Europe/Vilnius');
            const targetDate = now.clone().add(2, 'days');
            const cappedDate = latestDate.isAfter(targetDate) ? targetDate : latestDate;
            const cappedTimestamp = latestDate.isAfter(targetDate) ? targetDate.unix() : latestTimestamp;
            
            await initializeCountrySyncStatus(country, cappedDate.format('YYYY-MM-DD'), cappedTimestamp, false);
            console.log(`[Wake-up Recovery] ${country.toUpperCase()}: Initialized from DB - last_sync_ok_date=${cappedDate.format('YYYY-MM-DD')} (sync_ok=false)`);
          } else {
            // No data at all - start from beginning
            console.log(`[Wake-up Recovery] ${country.toUpperCase()}: No data found, will sync from beginning`);
            await initializeCountrySyncStatus(country, '2012-07-01', null, false);
          }
        }
      } catch (error) {
        console.error(`[Wake-up Recovery] ${country.toUpperCase()}: Error initializing sync status:`, error.message);
      }
    }
    
    // Get the latest available date from Elering API (only if we need to sync)
    // First check if any country needs syncing based on DB flags
    let needsAnySync = false;
    const countriesToSync = [];
    
    for (const country of countries) {
      try {
        const currentStatus = await getCountrySyncStatus(country);
        if (!currentStatus) {
          console.warn(`[Wake-up Recovery] ${country.toUpperCase()}: Failed to get sync status, will sync`);
          needsAnySync = true;
          // We'll determine the date range after getting API latest date
          continue;
        }
        
        // Use the DB flag: if sync_ok=true, last_sync_ok_date is the last fully complete date
        // We need to sync from last_sync_ok_date + 1 day forward
        const lastSyncOkDate = moment(currentStatus.last_sync_ok_date);
        const targetDate = now.clone().add(2, 'days');
        
        // Sync if:
        // 1. sync_ok is false (incomplete data), OR
        // 2. last_sync_ok_date is before target date (need to catch up)
        const needsSync = !currentStatus.sync_ok || lastSyncOkDate.isBefore(targetDate, 'day');
        
        if (needsSync) {
          needsAnySync = true;
          // Determine sync start date:
          // - If sync_ok=true: start from last_sync_ok_date + 1 day (next day after complete date)
          // - If sync_ok=false: start from last_sync_ok_date - 1 day (to catch up on incomplete data)
          let syncStartDate;
          if (currentStatus.sync_ok) {
            // Last complete date is known, start from the next day
            syncStartDate = lastSyncOkDate.clone().add(1, 'day').startOf('day');
          } else {
            // Data is incomplete, start from 1 day before to ensure we don't miss anything
            syncStartDate = lastSyncOkDate.clone().subtract(1, 'day').startOf('day');
          }
          
          countriesToSync.push({ 
            country, 
            syncStartDate: syncStartDate.format('YYYY-MM-DD'),
            lastSyncOkDate: currentStatus.last_sync_ok_date,
            syncOk: currentStatus.sync_ok
          });
          console.log(`[Wake-up Recovery] ${country.toUpperCase()}: Needs sync from ${syncStartDate.format('YYYY-MM-DD')} (last_sync_ok_date=${currentStatus.last_sync_ok_date}, sync_ok=${currentStatus.sync_ok})`);
        } else {
          console.log(`[Wake-up Recovery] ${country.toUpperCase()}: Sync status is OK, data is up to date (last_sync_ok_date=${currentStatus.last_sync_ok_date}, sync_ok=${currentStatus.sync_ok})`);
        }
      } catch (error) {
        console.error(`[Wake-up Recovery] ${country.toUpperCase()}: Error checking sync status:`, error.message);
      }
    }
    
    // Only get latest available date from API if we need to sync
    // Determine the start date (day after the latest successful sync across all countries)
    let startDateForCheck = null;
    for (const country of countries) {
      const currentStatus = await getCountrySyncStatus(country);
      if (currentStatus && currentStatus.sync_ok && currentStatus.last_sync_ok_date) {
        const lastSyncOkDate = moment(currentStatus.last_sync_ok_date);
        const nextDay = lastSyncOkDate.clone().add(1, 'day');
        if (!startDateForCheck || nextDay.isAfter(startDateForCheck)) {
          startDateForCheck = nextDay;
        }
      }
    }
    
    // If no successful sync found, default to now + 2 days
    if (!startDateForCheck) {
      startDateForCheck = now.clone().add(2, 'days');
    }
    
    // Get our latest timestamps from database for comparison
    const ourLatestTimestamps = {};
    for (const country of countries) {
      const latestTimestamp = await this.getLatestPriceTimestamp(country);
      if (latestTimestamp) {
        ourLatestTimestamps[country] = latestTimestamp;
      }
    }
    
    let targetEndDate = now.clone().add(2, 'days'); // Default fallback
    if (needsAnySync) {
      console.log(`[Wake-up Recovery] Determining latest available date from Elering API (checking from ${startDateForCheck.format('YYYY-MM-DD')})...`);
      try {
        const apiLatestDate = await this.api.getLatestAvailableDateAll(startDateForCheck.format('YYYY-MM-DD'), 7, ourLatestTimestamps);
        if (apiLatestDate) {
          targetEndDate = apiLatestDate;
          console.log(`[Wake-up Recovery] Latest available date from API: ${targetEndDate.format('YYYY-MM-DD')}`);
        } else {
          // No data available from API or we're already up to date
          console.log(`[Wake-up Recovery] No new data available from API (we're up to date or no data found), using default (now + 2 days): ${targetEndDate.format('YYYY-MM-DD')}`);
        }
      } catch (error) {
        console.warn(`[Wake-up Recovery] Could not determine latest available date, using default (now + 2 days):`, error.message);
      }
      
      // Update sync end dates for countries that need syncing
      for (const syncInfo of countriesToSync) {
        syncInfo.syncEndDate = targetEndDate.format('YYYY-MM-DD');
      }
      
      // Also handle countries without sync status
      for (const country of countries) {
        const currentStatus = await getCountrySyncStatus(country);
        if (!currentStatus) {
          countriesToSync.push({ country, syncStartDate: '2012-07-01', syncEndDate: targetEndDate.format('YYYY-MM-DD') });
        }
      }
    }
    
    // Sync all countries that need it
    if (countriesToSync.length > 0) {
      console.log(`[Wake-up Recovery] Syncing ${countriesToSync.length} countries...`);
      
      // Find the union of all date ranges (earliest start, latest end)
      const startDates = countriesToSync.map(c => moment(c.syncStartDate));
      const endDates = countriesToSync.map(c => moment(c.syncEndDate));
      const globalStartDate = moment.min(startDates);
      const globalEndDate = moment.max(endDates);
      
      // Before fetching, check if we have incomplete days and if more data is available
      // If today is complete and we only have partial data for tomorrow, check if more is available
      const today = now.format('YYYY-MM-DD');
      const todayStatus = await this.isDateComplete(today);
      const tomorrow = now.clone().add(1, 'day').format('YYYY-MM-DD');
      const tomorrowStatus = await this.isDateComplete(tomorrow);
      
      // If today is complete and tomorrow is incomplete, check if more data is available
      let shouldFetch = true;
      if (todayStatus.isComplete && !tomorrowStatus.isComplete) {
        console.log(`[Wake-up Recovery] Today (${today}) is complete, tomorrow (${tomorrow}) is incomplete. Checking if more data is available...`);
        try {
          // Check from tomorrow (the day after today, which is complete)
          const tomorrowMoment = moment(tomorrow);
          const apiLatestDate = await this.api.getLatestAvailableDateAll(tomorrow, 7);
          if (apiLatestDate) {
            const apiLatestMoment = moment(apiLatestDate);
            
            // If API latest date is not after tomorrow, no more data is available
            if (!apiLatestMoment.isAfter(tomorrowMoment, 'day')) {
              console.log(`[Wake-up Recovery] No more data available for ${tomorrow} (API latest: ${apiLatestDate.format('YYYY-MM-DD')}). Skipping ingestion.`);
              shouldFetch = false;
            } else {
              console.log(`[Wake-up Recovery] More data available (API latest: ${apiLatestDate.format('YYYY-MM-DD')}). Proceeding with fetch.`);
            }
          } else {
            console.log(`[Wake-up Recovery] Could not determine API latest date, proceeding with fetch.`);
          }
        } catch (error) {
          console.warn(`[Wake-up Recovery] Error checking API latest date: ${error.message}. Proceeding with fetch.`);
        }
      }
      
      if (shouldFetch) {
        console.log(`[Wake-up Recovery] Fetching data for all countries from ${globalStartDate.format('YYYY-MM-DD')} to ${globalEndDate.format('YYYY-MM-DD')}`);
        
        // Fetch data once for all countries
        try {
          const allCountriesData = await this.api.fetchAllCountriesData(
            globalStartDate.toDate(), 
            globalEndDate.toDate()
          );
          
          if (!allCountriesData || Object.keys(allCountriesData).length === 0) {
            console.log('[Wake-up Recovery] No data received from API');
          } else {
            // Ingest data for all countries that need syncing
            const countriesToIngest = new Set(countriesToSync.map(c => c.country));
            let totalRecords = 0;
            
            for (const country of Object.keys(allCountriesData)) {
              if (countriesToIngest.has(country)) {
                const countryData = allCountriesData[country];
                if (countryData && countryData.length > 0) {
                  console.log(`[Wake-up Recovery] Ingesting ${country.toUpperCase()}: ${countryData.length} records`);
                  const result = await this.insertPriceData(countryData, country);
                  totalRecords += result.insertedCount;
                  console.log(`[Wake-up Recovery] Ingested ${result.insertedCount} records for ${country.toUpperCase()}`);
                }
              }
            }
            
            console.log(`[Wake-up Recovery] Total records ingested: ${totalRecords}`);
          }
        } catch (error) {
          console.error(`[Wake-up Recovery] Error fetching/ingesting data:`, error.message);
        }
      }
      
      // After all countries are synced, check completeness once and update all countries
      console.log('[Wake-up Recovery] All countries synced, checking completeness...');
      await this.updateAllCountriesSyncStatus(targetEndDate);
    } else {
      // No sync needed, but still check completeness in case status is stale
      console.log('[Wake-up Recovery] No countries need syncing, checking completeness...');
      await this.updateAllCountriesSyncStatus(targetEndDate);
    }
  }

  // Initialize country sync statuses from database after initial sync
  async initializeCountrySyncStatuses() {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    
    console.log('[Country Sync Status] Initializing country sync statuses from database...');
    
    for (const country of countries) {
      try {
        const latestTimestamp = await this.getLatestPriceTimestamp(country);
        if (latestTimestamp) {
          const latestDate = moment.unix(latestTimestamp).tz('Europe/Vilnius');
          const now = moment().tz('Europe/Vilnius');
          const targetDate = now.clone().add(2, 'days');
          
          // Find the last fully complete date (not just latest date with data)
          let lastCompleteDate = null;
          let lastCompleteTimestamp = null;
          let checkDate = latestDate.clone().startOf('day');
          const minCheckDate = moment('2012-07-01');
          
          // Check up to 7 days back to find the last complete date
          for (let i = 0; i < 7 && checkDate.isSameOrAfter(minCheckDate, 'day'); i++) {
            const dateStr = checkDate.format('YYYY-MM-DD');
            const dateStatus = await this.isDateComplete(dateStr);
            
            if (dateStatus.isComplete) {
              lastCompleteDate = checkDate.clone();
              lastCompleteTimestamp = checkDate.clone().endOf('day').unix();
              console.log(`[Country Sync Status] ${country.toUpperCase()}: Found last complete date: ${dateStr}`);
              break;
            }
            
            checkDate.subtract(1, 'day');
          }
          
          if (lastCompleteDate) {
            // Cap at target date
            const cappedDate = lastCompleteDate.isAfter(targetDate) ? targetDate : lastCompleteDate;
            const cappedTimestamp = lastCompleteDate.isAfter(targetDate) ? targetDate.unix() : lastCompleteTimestamp;
            
            await initializeCountrySyncStatus(country, cappedDate.format('YYYY-MM-DD'), cappedTimestamp);
            console.log(`[Country Sync Status] ${country.toUpperCase()}: Initialized - last_sync_ok_date=${cappedDate.format('YYYY-MM-DD')} (fully complete)`);
          } else {
            // No complete dates found - initialize with latest date but sync_ok=false
            const cappedDate = latestDate.isAfter(targetDate) ? targetDate : latestDate;
            const cappedTimestamp = latestDate.isAfter(targetDate) ? targetDate.unix() : latestTimestamp;
            
            await initializeCountrySyncStatus(country, cappedDate.format('YYYY-MM-DD'), cappedTimestamp);
            console.log(`[Country Sync Status] ${country.toUpperCase()}: Initialized - last_sync_ok_date=${cappedDate.format('YYYY-MM-DD')} (incomplete, sync_ok=false)`);
          }
        } else {
          console.warn(`[Country Sync Status] ${country.toUpperCase()}: No data found, cannot initialize`);
        }
      } catch (error) {
        console.error(`[Country Sync Status] ${country.toUpperCase()}: Error initializing:`, error.message);
      }
    }
  }

  // Run initial sync with chunk tracking
  async runInitialSyncWithChunks() {
    console.log('[Initial Sync] Starting chunked initial sync...');
    
    // Get last completed chunk to resume from there
    const lastChunk = await getLastCompletedChunk();
    let startDate = '2012-07-01';
    if (lastChunk && moment(lastChunk, 'YYYY-MM-DD', true).isValid()) {
      startDate = moment(lastChunk).add(1, 'day').format('YYYY-MM-DD');
    }
    const endDate = moment().add(2, 'days').format('YYYY-MM-DD');
    
    // Validate startDate and endDate
    if (!moment(startDate, 'YYYY-MM-DD', true).isValid() || !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
      console.error(`[Initial Sync] Invalid start or end date for chunking: startDate=${startDate}, endDate=${endDate}`);
      throw new Error('Invalid start or end date for chunked sync');
    }
    
    const chunks = this.splitToHalfYearChunks(startDate, endDate);
    
    console.log(`[Initial Sync] Processing ${chunks.length} chunks from ${startDate} to ${endDate}`);
    
    let totalRecords = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Validate chunk dates
      if (!chunk.start || !chunk.end || !moment(chunk.start, 'YYYY-MM-DD', true).isValid() || !moment(chunk.end, 'YYYY-MM-DD', true).isValid()) {
        console.error(`[Initial Sync] Invalid chunk dates: chunk ${i + 1}: start=${chunk.start}, end=${chunk.end}`);
        throw new Error('Invalid chunk date range');
      }
      console.log(`[Initial Sync] Processing chunk ${i + 1}/${chunks.length}: ${chunk.start} to ${chunk.end}`);
      
      try {
        const records = await this.syncAllCountriesHistorical(chunk.start, chunk.end);
        totalRecords += records;
        
        // Update chunk completion after each successful chunk
        await updateChunkCompletion(chunk.end, records);
        
        console.log(`[Initial Sync] Chunk ${i + 1} completed: ${records} records`);
        
        // Wait between chunks to avoid overwhelming the API
        if (i < chunks.length - 1) {
          console.log('[Initial Sync] Waiting 1 second before next chunk...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[Initial Sync] Error in chunk ${i + 1}:`, error.message);
        throw error; // Stop the process if a chunk fails
      }
    }
    
    // Get the actual latest date from the database after all chunks are processed
    const actualLatestDate = await this.getActualLatestDataDate();
    const completionDate = actualLatestDate || (chunks.length > 0 ? chunks[chunks.length - 1].end : endDate);
    
    // Mark initial sync as complete with the actual latest date that has data
    await markInitialSyncComplete(completionDate, totalRecords);
    console.log(`[Initial Sync] All chunks completed. Total records: ${totalRecords}, completed to: ${completionDate}`);
    
    return totalRecords;
  }

  // Get the actual latest date with data from the database
  async getActualLatestDataDate() {
    try {
      const result = await pool.query(`
        SELECT MAX(timestamp) as latest_timestamp 
        FROM price_data
      `);
      
      if (result.rows[0] && result.rows[0].latest_timestamp) {
        const latestDate = moment.unix(result.rows[0].latest_timestamp).format('YYYY-MM-DD');
        console.log(`[Initial Sync] Actual latest data date from database: ${latestDate}`);
        return latestDate;
      }
      
      return null;
    } catch (error) {
      console.error('[Initial Sync] Error getting actual latest data date:', error.message);
      return null;
    }
  }

  // Check if a specific date is complete (has at least 22 records for all countries)
  async isDateComplete(date) {
    try {
      const startOfDay = moment(date).tz('Europe/Vilnius').startOf('day').unix();
      const endOfDay = moment(date).tz('Europe/Vilnius').endOf('day').unix();
      
      // First, get record count to help determine interval
      const countResult = await pool.query(`
        SELECT COUNT(*) as total_count
        FROM price_data 
        WHERE timestamp BETWEEN $1 AND $2
        LIMIT 1
      `, [startOfDay, endOfDay]);
      
      const totalCount = countResult.rows[0] ? parseInt(countResult.rows[0].total_count, 10) : 0;
      
      // Determine the interval (MTU) for this date
      // Use record count as primary indicator: 90+ records = 15-min MTU, <30 = 60-min MTU
      let expectedRecordsMin = 24; // Default to 60-minute MTU (24 hours)
      let expectedRecordsMax = 24;
      
      // If we have a high record count (>= 90), it's definitely 15-minute MTU
      if (totalCount >= 90) {
        // 15-minute MTU
        // Standard day: 96 records (24 hours * 4)
        // DST spring forward (lose 1 hour): 92 records (23 hours * 4)
        // DST fall back (gain 1 hour): 100 records (25 hours * 4)
        expectedRecordsMin = 92; // Minimum for DST spring forward
        expectedRecordsMax = 100; // Maximum for DST fall back
      } else if (totalCount > 0) {
        // For lower counts, check the actual interval between timestamps
        const intervalResult = await pool.query(`
          SELECT timestamp
          FROM price_data 
          WHERE timestamp BETWEEN $1 AND $2
          ORDER BY timestamp
          LIMIT 10
        `, [startOfDay, endOfDay]);
        
        if (intervalResult.rows.length >= 2) {
          // Check multiple intervals to find the most common one
          const intervals = [];
          for (let i = 1; i < intervalResult.rows.length; i++) {
            const diff = intervalResult.rows[i].timestamp - intervalResult.rows[i-1].timestamp;
            if (diff > 0) {
              intervals.push(diff);
            }
          }
          
          // Find the most common interval
          const mostCommonInterval = intervals.length > 0 ? intervals[0] : null;
          
          if (mostCommonInterval === 900) {
            // 15-minute MTU
            expectedRecordsMin = 92;
            expectedRecordsMax = 100;
          } else if (mostCommonInterval === 3600) {
            // 60-minute MTU
            expectedRecordsMin = 23;
            expectedRecordsMax = 25;
          }
          // If interval is neither 900 nor 3600, keep default (24-24 for 60-min)
        }
      }
      
      const result = await pool.query(`
        SELECT country, COUNT(*) as record_count
        FROM price_data 
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY country
        ORDER BY country
      `, [startOfDay, endOfDay]);
      
      const countries = ['lt', 'ee', 'lv', 'fi'];
      const countryCounts = {};
      
      // Initialize counts for all countries
      countries.forEach(country => {
        countryCounts[country] = 0;
      });
      
      // Update with actual counts from database
      result.rows.forEach(row => {
        countryCounts[row.country] = parseInt(row.record_count, 10);
      });
      
      // Check if all countries have records within the expected range (accounting for DST)
      // A day is complete if all countries have at least the minimum expected records
      // and no country has significantly more than the maximum (indicating data from next day)
      const isComplete = countries.every(country => {
        const count = countryCounts[country];
        return count >= expectedRecordsMin && count <= expectedRecordsMax;
      });
      
      console.log(`[Date Complete Check] ${date}: ${JSON.stringify(countryCounts)} (expected: ${expectedRecordsMin}-${expectedRecordsMax}) - Complete: ${isComplete}`);
      
      return {
        isComplete,
        countryCounts,
        date,
        expectedRecordsMin,
        expectedRecordsMax
      };
    } catch (error) {
      console.error(`[Date Complete Check] Error checking completeness for ${date}:`, error.message);
      return {
        isComplete: false,
        countryCounts: {},
        date,
        error: error.message
      };
    }
  }

  // Check if we should suppress daily sync for today
  async shouldSuppressDailySyncForToday() {
    const now = moment().tz('Europe/Vilnius');
    const today = now.format('YYYY-MM-DD');
    
    // If we already suppressed for today, check if it's still valid
    if (this.dailySyncSuppressedDate === today) {
      // Verify today is still complete
      const todayStatus = await this.isDateComplete(today);
      if (todayStatus.isComplete) {
        return true; // Still complete, keep suppressed
      } else {
        // No longer complete, clear suppression
        console.log(`[Daily Sync] Date ${today} is no longer complete, clearing suppression`);
        this.dailySyncSuppressedDate = null;
        return false;
      }
    }
    
    // Check if today is complete
    const todayStatus = await this.isDateComplete(today);
    if (todayStatus.isComplete) {
      console.log(`[Daily Sync] Today (${today}) is complete, stopping dynamic sync checks`);
      this.dailySyncSuppressedDate = today;
      // Stop scheduling if sync is complete
      if (this.dailySyncTimeout) {
        clearTimeout(this.dailySyncTimeout);
        this.dailySyncTimeout = null;
        this.dailySyncNextRun = null;
      }
      return true;
    }
    
    return false;
  }

  // Check if recent data needs syncing based on per-day completion (daily sync logic)
  async checkRecentDataSyncByCompleteness() {
    console.log('[Daily Sync] Checking per-day completion for recent dates...');
    
    const now = moment().tz('Europe/Vilnius');
    const today = now.format('YYYY-MM-DD');
    
    // Check if we should suppress daily sync for today
    if (await this.shouldSuppressDailySyncForToday()) {
      console.log(`[Daily Sync] Today (${today}) is complete, sync checks stopped`);
      return; // Exit early, no sync needed
    }
    
    // If suppressed date is from a previous day, clear it and resume scheduling
    if (this.dailySyncSuppressedDate && this.dailySyncSuppressedDate !== today) {
      console.log(`[Daily Sync] Clearing suppression for previous day: ${this.dailySyncSuppressedDate}`);
      this.dailySyncSuppressedDate = null;
      // Resume scheduling if we're in active period
      const nowUTC = moment().tz('UTC');
      const activeStart = nowUTC.clone().hour(12).minute(45).second(0).millisecond(0);
      const activeEnd = nowUTC.clone().hour(15).minute(55).second(0).millisecond(0);
      if (nowUTC.isBetween(activeStart, activeEnd, null, '[]')) {
        this.scheduleNextCheckIn5Minutes();
      }
    }
    
    const tomorrow = now.clone().add(1, 'day').format('YYYY-MM-DD');
    
    // Get the latest available date from Elering API
    // Determine the start date (day after the latest successful sync across all countries)
    let startDateForCheck = null;
    const countries = ['lt', 'ee', 'lv', 'fi'];
    for (const country of countries) {
      const currentStatus = await getCountrySyncStatus(country);
      if (currentStatus && currentStatus.sync_ok && currentStatus.last_sync_ok_date) {
        const lastSyncOkDate = moment(currentStatus.last_sync_ok_date);
        const nextDay = lastSyncOkDate.clone().add(1, 'day');
        if (!startDateForCheck || nextDay.isAfter(startDateForCheck)) {
          startDateForCheck = nextDay;
        }
      }
    }
    
    // If no successful sync found, default to today
    if (!startDateForCheck) {
      startDateForCheck = now.clone();
    }
    
    // Get our latest timestamps from database for comparison
    const ourLatestTimestamps = {};
    for (const country of countries) {
      const latestTimestamp = await this.getLatestPriceTimestamp(country);
      if (latestTimestamp) {
        ourLatestTimestamps[country] = latestTimestamp;
      }
    }
    
    let targetDate;
    try {
      targetDate = await this.api.getLatestAvailableDateAll(startDateForCheck.format('YYYY-MM-DD'), 7, ourLatestTimestamps);
      if (targetDate) {
        console.log(`[Daily Sync] Latest available date from API: ${targetDate.format('YYYY-MM-DD')} (checked from ${startDateForCheck.format('YYYY-MM-DD')})`);
      } else {
        console.log(`[Daily Sync] No new data available from API (we're up to date or no data found), using default (now + 2 days)`);
        targetDate = now.clone().add(2, 'days');
      }
    } catch (error) {
      console.warn(`[Daily Sync] Could not determine latest available date, using default (now + 2 days):`, error.message);
      targetDate = now.clone().add(2, 'days');
    }
    
    // Check dates from today to target date
    const datesToCheck = [];
    let currentDate = moment(today);
    const targetMoment = moment(targetDate);
    
    while (currentDate.isSameOrBefore(targetMoment, 'day')) {
      datesToCheck.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }
    
    let needsSync = false;
    const datesToSync = [];
    
    // Check each date for completeness
    for (const dateStr of datesToCheck) {
      const dateStatus = await this.isDateComplete(dateStr);
      
      if (!dateStatus.isComplete) {
        console.log(`[Daily Sync] Date ${dateStr} is not complete: ${JSON.stringify(dateStatus.countryCounts)}`);
        datesToSync.push(dateStr);
        needsSync = true;
      } else {
        console.log(`[Daily Sync] Date ${dateStr} is complete, skipping`);
      }
    }
    
    if (needsSync && datesToSync.length > 0) {
      console.log(`[Daily Sync] Need to sync dates: ${datesToSync.join(', ')}`);
      try {
        // Sync from first missing date - 1 day to target date
        const syncStartDate = moment(datesToSync[0]).subtract(1, 'day').format('YYYY-MM-DD');
        const syncEndDate = targetDate.format('YYYY-MM-DD');
        
        console.log(`[Daily Sync] Syncing from ${syncStartDate} to ${syncEndDate}...`);
        await this.checkAndSyncFromLastSyncOk();
        console.log('[Daily Sync] Sync completed');
        
        // After successful sync, check if today is now complete and suppress if so
        const todayStatusAfterSync = await this.isDateComplete(today);
        if (todayStatusAfterSync.isComplete) {
          console.log(`[Daily Sync] Today (${today}) is now complete after sync, suppressing remaining cron jobs for today`);
          this.dailySyncSuppressedDate = today;
          this.suppressDailySyncJobs();
        }
      } catch (error) {
        console.error('[Daily Sync] Error during sync:', error.message);
      }
    } else {
      console.log(`[Daily Sync] All dates are complete, no sync needed.`);
      
      // If today is complete, suppress remaining cron jobs
      const todayStatus = await this.isDateComplete(today);
      if (todayStatus.isComplete) {
        console.log(`[Daily Sync] Today (${today}) is complete, suppressing remaining cron jobs for today`);
        this.dailySyncSuppressedDate = today;
        this.suppressDailySyncJobs();
      }
    }
  }
  
  // Suppress daily sync jobs for the current day
  suppressDailySyncJobs() {
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach(job => {
        if (job && job.stop) {
          job.stop();
        }
      });
      console.log(`[Daily Sync] Suppressed ${this.dailySyncJobs.length} daily sync cron jobs`);
    }
  }
  
  // Resume daily sync jobs (for next day)
  resumeDailySyncJobs() {
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach(job => {
        if (job && job.start) {
          job.start();
        }
      });
      console.log(`[Daily Sync] Resumed ${this.dailySyncJobs.length} daily sync cron jobs`);
    }
  }

  // Simple sync from last available -1 day to today +2 days
  async syncFromLastAvailable() {
    // Use efficient sync for all countries
    return await this.syncAllCountriesEfficient();
  }

  // Sync price data for a specific date range with chunking for large ranges
  async syncPriceDataForRange(country, startDate, endDate) {
    try {
      const start = moment(startDate);
      const end = moment(endDate);
      const diffDays = end.diff(start, 'days');
      
      console.log(`Syncing ${country.toUpperCase()} data from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')} (${diffDays} days)`);
      
      // For large date ranges, use chunking strategy
      if (diffDays > 180) {
        console.log(`Large date range detected (${diffDays} days). Using half-year chunking...`);
        const chunks = this.splitToHalfYearChunks(startDate, endDate);
        let totalRecords = 0;
        
        for (const chunk of chunks) {
          console.log(`Processing chunk: ${chunk.start} to ${chunk.end}`);
          const records = await this.syncPriceDataChunk(country, chunk.start, chunk.end);
          totalRecords += records;
          
          // Add delay between chunks to avoid rate limits
          if (chunks.indexOf(chunk) < chunks.length - 1) {
            console.log('Waiting 1 second before next chunk...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`Chunked sync completed: ${totalRecords} total records for ${country.toUpperCase()}`);
        return totalRecords;
      } else {
        // For smaller ranges, sync directly
        return await this.syncPriceDataChunk(country, startDate, endDate);
      }
    } catch (error) {
      console.error(`Error syncing ${country.toUpperCase()}:`, error.message);
      throw error;
    }
  }

  // Sync a single chunk of price data
  async syncPriceDataChunk(country, startDate, endDate) {
    try {
      console.log(`Fetching ${country.toUpperCase()} data from ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`);
      
      // Use fetchAllCountriesData to get data for all countries in one API call
      const allCountriesData = await this.api.fetchAllCountriesData(startDate, endDate);
      
      if (!allCountriesData || Object.keys(allCountriesData).length === 0) {
        console.log(`No data available for ${country.toUpperCase()} in this range`);
        return 0;
      }
      
      // Process data for the specific country
      const countryData = allCountriesData[country] || [];
      if (countryData.length === 0) {
        console.log(`No data available for ${country.toUpperCase()} in this range`);
        return 0;
      }
      
      const result = await this.insertPriceData(countryData, country);
      console.log(`Synced ${result.insertedCount} records for ${country.toUpperCase()}`);
      
      return result.insertedCount;
    } catch (error) {
      console.error(`Error syncing chunk for ${country.toUpperCase()}:`, error.message);
      throw error;
    }
  }

  // Trigger catch-up sync for health issues
  async triggerCatchUpSync() {
    if (this.isRunning) {
      console.log('[Catch-up Sync] Skipped - another sync is already running');
      return;
    }

    try {
      await this.logSync('catchup_sync', 'started', 0, 0, 0, 'Triggered by health check');
      await this.syncFromLastAvailable(); // Use simple sync logic
      await this.logSync('catchup_sync', 'completed', 0, 0, 0, 'Catch-up sync completed');
    } catch (error) {
      console.error('[Catch-up Sync] Failed:', error);
      await this.logSync('catchup_sync', 'error', 0, 0, 0, error.message);
    }
  }

  // Retry sync with exponential backoff
  async retrySync(daysBack, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Retry] Attempt ${attempt}/${maxRetries} for sync`);
        await this.syncFromLastAvailable(); // Use simple sync logic
        console.log(`[Retry] Sync completed successfully on attempt ${attempt}`);
        return;
      } catch (error) {
        console.error(`[Retry] Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          console.error(`[Retry] All ${maxRetries} attempts failed, giving up`);
          throw error;
        }
        
        // Exponential backoff: 2^attempt seconds
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Retry] Waiting ${delay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Get latest price timestamp for a country
  async getLatestPriceTimestamp(country) {
    return await getLatestTimestamp(country);
  }

  // Get last sync time from database
  async getLastSyncTime() {
    try {
      const result = await pool.query(
        'SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = $1',
        ['success']
      );
      return result.rows[0]?.last_sync || null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  // Schedule daily sync using dynamic setTimeout (every 5 minutes from 12:45 to 15:55 CET)
  // Nord Pool publishes prices at 12:45 CET
  scheduleDailySync() {
    // Clear any existing timeout
    if (this.dailySyncTimeout) {
      clearTimeout(this.dailySyncTimeout);
      this.dailySyncTimeout = null;
    }

    // Start the recursive scheduling
    this.scheduleNextDailySyncCheck();
    
    // Start watchdog to ensure sync is scheduled
    this.startDailySyncWatchdog();
    
    // Start fallback cron job as safety net (runs every 15 minutes during active period)
    this.startDailySyncFallback();
    
    // Check for missed jobs on startup and run if needed
    this.checkForMissedDailySync();
  }

  // Watchdog: Check every 10 minutes if daily sync should be running but isn't scheduled
  startDailySyncWatchdog() {
    if (this.dailySyncWatchdogInterval) {
      clearInterval(this.dailySyncWatchdogInterval);
    }

    this.dailySyncWatchdogInterval = setInterval(() => {
      this.checkDailySyncWatchdog();
    }, 10 * 60 * 1000); // Every 10 minutes

    console.log('[Daily Sync] Watchdog started (checks every 10 minutes)');
  }

  // Watchdog check: Verify sync is scheduled when it should be
  async checkDailySyncWatchdog() {
    const startTime = Date.now();
    try {
      const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
      const activeStart = nowCET.clone().hour(12).minute(45).second(0).millisecond(0);
      const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);
      const isInActivePeriod = nowCET.isBetween(activeStart, activeEnd, null, '[]');
      let actionTaken = null;

      // If we're in active period but no timeout is scheduled, reschedule
      if (isInActivePeriod && !this.dailySyncTimeout) {
        console.warn('[Daily Sync Watchdog] ⚠️  In active period but no sync scheduled! Rescheduling...');
        this.scheduleNextDailySyncCheck();
        actionTaken = 'Rescheduled - no sync was scheduled';
        const duration = Date.now() - startTime;
        await logScheduledJob('Watchdog', 'success', actionTaken, duration);
        return;
      }

      // If we're in active period and timeout exists, verify it's still valid
      if (isInActivePeriod && this.dailySyncTimeout && this.dailySyncNextRun) {
        const nextRun = moment(this.dailySyncNextRun);
        const timeUntilNext = nextRun.diff(nowCET, 'minutes');
        
        // If next run is more than 10 minutes away, something might be wrong
        if (timeUntilNext > 10) {
          console.warn(`[Daily Sync Watchdog] ⚠️  Next run is ${timeUntilNext} minutes away, might be stuck. Rescheduling...`);
          if (this.dailySyncTimeout) {
            clearTimeout(this.dailySyncTimeout);
            this.dailySyncTimeout = null;
          }
          this.scheduleNextCheckIn5Minutes();
          actionTaken = `Rescheduled - next run was ${timeUntilNext} minutes away`;
          const duration = Date.now() - startTime;
          await logScheduledJob('Watchdog', 'success', actionTaken, duration);
          return;
        }

        // If next run is in the past, reschedule
        const nowUTC = moment().tz('UTC');
        if (nextRun.isBefore(nowUTC)) {
          console.warn('[Daily Sync Watchdog] ⚠️  Next run time is in the past! Rescheduling...');
          if (this.dailySyncTimeout) {
            clearTimeout(this.dailySyncTimeout);
            this.dailySyncTimeout = null;
          }
          this.scheduleNextCheckIn5Minutes();
          actionTaken = 'Rescheduled - next run was in the past';
          const duration = Date.now() - startTime;
          await logScheduledJob('Watchdog', 'success', actionTaken, duration);
          return;
        }
      }

      // Check if last sync check was too long ago (more than 15 minutes during active period)
      if (isInActivePeriod && this.dailySyncLastCheck) {
        const lastCheck = moment(this.dailySyncLastCheck);
        const nowVilnius = moment().tz('Europe/Vilnius');
        const minutesSinceLastCheck = nowVilnius.diff(lastCheck, 'minutes');
        
        if (minutesSinceLastCheck > 15) {
          console.warn(`[Daily Sync Watchdog] ⚠️  Last check was ${minutesSinceLastCheck} minutes ago! Forcing check...`);
          // Force a check now
          await this.runDailySyncCheck();
          actionTaken = `Forced check - last check was ${minutesSinceLastCheck} minutes ago`;
          const duration = Date.now() - startTime;
          await logScheduledJob('Watchdog', 'success', actionTaken, duration);
          return;
        }
      }

      // If we're in active period but suppressed, verify suppression is still valid
      if (isInActivePeriod && this.dailySyncSuppressedDate) {
        const today = moment().tz('Europe/Vilnius').format('YYYY-MM-DD');
        if (this.dailySyncSuppressedDate !== today) {
          console.log('[Daily Sync Watchdog] Suppression date changed, clearing suppression');
          this.dailySyncSuppressedDate = null;
          this.scheduleNextCheckIn5Minutes();
          actionTaken = 'Cleared suppression - date changed';
          const duration = Date.now() - startTime;
          await logScheduledJob('Watchdog', 'success', actionTaken, duration);
          return;
        }
      }

      // No action needed - everything is OK
      if (!actionTaken) {
        const duration = Date.now() - startTime;
        await logScheduledJob('Watchdog', 'success', 'No action needed - sync is healthy', duration);
      }
    } catch (error) {
      console.error('[Daily Sync Watchdog] Error in watchdog check:', error);
      const duration = Date.now() - startTime;
      await logScheduledJob('Watchdog', 'error', error.message, duration);
    }
  }

  // Fallback cron job: Runs every 15 minutes during active period as safety net
  startDailySyncFallback() {
    if (this.dailySyncFallbackCron) {
      this.dailySyncFallbackCron.stop();
    }

    // Cron: every 15 minutes from 12:45 to 15:55 CET
    const cronExpression = '45,0,15,30,45 12-15 * * *';
    this.dailySyncFallbackCron = cron.schedule(cronExpression, async () => {
      const startTime = Date.now();
      const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
      const activeStart = nowCET.clone().hour(12).minute(45).second(0).millisecond(0);
      const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);
      
      // Only run if we're in active period
      if (!nowCET.isBetween(activeStart, activeEnd, null, '[]')) {
        return;
      }

      // Check if dynamic sync is working
      const minutesSinceLastCheck = this.dailySyncLastCheck 
        ? moment().tz('UTC').diff(moment(this.dailySyncLastCheck), 'minutes')
        : 999;

      // If last check was more than 10 minutes ago, force a check
      if (minutesSinceLastCheck > 10) {
        console.warn('[Daily Sync Fallback] ⚠️  Dynamic sync appears stuck, forcing check via fallback cron');
        try {
          await this.runDailySyncCheck();
          const duration = Date.now() - startTime;
          await logScheduledJob('Fallback Cron', 'success', `Forced check - last check was ${minutesSinceLastCheck} minutes ago`, duration);
        } catch (error) {
          console.error('[Daily Sync Fallback] Error in fallback check:', error);
          const duration = Date.now() - startTime;
          await logScheduledJob('Fallback Cron', 'error', error.message, duration);
        }
      } else {
        const duration = Date.now() - startTime;
        console.log('[Daily Sync Fallback] Dynamic sync is working, skipping fallback');
        await logScheduledJob('Fallback Cron', 'skipped', 'Dynamic sync is working, no action needed', duration);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Paris' // CET/CEST timezone
    });

    console.log('[Daily Sync] Fallback cron started (every 15 min during active period, 12:45-15:55 CET)');
  }

  // Schedule the next daily sync check (recursive, schedules itself)
  scheduleNextDailySyncCheck() {
    const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
    const activeStart = nowCET.clone().hour(12).minute(45).second(0).millisecond(0);
    const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);

    // Check if we're in the active period
    if (nowCET.isBefore(activeStart)) {
      // Before active period - schedule for 12:45 CET
      const msUntilStart = activeStart.diff(nowCET);
      this.dailySyncNextRun = activeStart.toISOString();
      this.dailySyncTimeout = setTimeout(() => {
        this.runDailySyncCheck();
      }, msUntilStart);
      console.log(`[Daily Sync] Scheduled first check at 12:45 CET (in ${Math.round(msUntilStart / 1000 / 60)} minutes)`);
      return;
    }

    if (nowCET.isAfter(activeEnd)) {
      // After active period - schedule for tomorrow at 12:45 CET
      const tomorrowStart = activeStart.clone().add(1, 'day');
      const msUntilTomorrow = tomorrowStart.diff(nowCET);
      this.dailySyncNextRun = tomorrowStart.toISOString();
      this.dailySyncTimeout = setTimeout(() => {
        this.scheduleNextDailySyncCheck();
      }, msUntilTomorrow);
      console.log(`[Daily Sync] Outside active period, scheduling for tomorrow 12:45 CET`);
      return;
    }

    // We're in the active period - run check now, then schedule next one
    this.runDailySyncCheck();
  }

  // Run a single daily sync check and schedule the next one
  async runDailySyncCheck() {
    const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
    const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);
    const startTime = Date.now();
    
    // Update last check timestamp (store in UTC for consistency)
    this.dailySyncLastCheck = moment().tz('UTC').toISOString();

    try {
      // Check if we should suppress this run
      if (await this.shouldSuppressDailySyncForToday()) {
        console.log('[Daily Sync] Suppressed - today is already complete');
        const duration = Date.now() - startTime;
        await logScheduledJob('Daily Sync', 'skipped', 'Today is already complete, no sync needed', duration);
        
        // Still schedule next check in case data becomes incomplete
        // But only if we're still in active period
        if (nowCET.isBefore(activeEnd)) {
          this.scheduleNextCheckIn5Minutes();
        }
        return;
      }

      console.log(`[Daily Sync] Running daily sync check at ${nowCET.format('HH:mm:ss')} CET...`);
      try {
        await this.checkRecentDataSyncByCompleteness();
        const duration = Date.now() - startTime;
        await logScheduledJob('Daily Sync', 'success', 'Daily sync check completed', duration);
      } catch (error) {
        console.error('[Daily Sync] Error during daily sync:', error.message);
        const duration = Date.now() - startTime;
        await logScheduledJob('Daily Sync', 'error', error.message, duration);
        // Continue scheduling even on error
      }

      // Schedule next check in 5 minutes (if still in active period)
      // Always schedule next check, even if there was an error
      if (nowCET.isBefore(activeEnd)) {
        this.scheduleNextCheckIn5Minutes();
      } else {
        console.log('[Daily Sync] Active period ended, stopping checks for today');
        this.dailySyncNextRun = null;
      }
    } catch (error) {
      // Critical error - log but ensure we reschedule
      console.error('[Daily Sync] Critical error in runDailySyncCheck:', error);
      const duration = Date.now() - startTime;
      await logScheduledJob('Daily Sync', 'error', `Critical error: ${error.message}`, duration);
      
      // Try to reschedule if still in active period
      if (nowCET.isBefore(activeEnd)) {
        console.log('[Daily Sync] Attempting to reschedule after error...');
        this.scheduleNextCheckIn5Minutes();
      }
    }
  }

  // Schedule the next check in exactly 5 minutes
  scheduleNextCheckIn5Minutes() {
    const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
    const nextCheck = nowCET.clone().add(5, 'minutes');
    const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);

    // If next check would be after active period, don't schedule
    if (nextCheck.isAfter(activeEnd)) {
      console.log('[Daily Sync] Next check would be after active period, stopping');
      this.dailySyncNextRun = null;
      return;
    }

    const msUntilNext = nextCheck.diff(nowCET);
    this.dailySyncNextRun = nextCheck.toISOString();
    this.dailySyncTimeout = setTimeout(() => {
      this.runDailySyncCheck();
    }, msUntilNext);
    
    console.log(`[Daily Sync] Next check scheduled at ${nextCheck.format('HH:mm:ss')} CET (in 5 minutes)`);
  }

  // Check for missed daily sync jobs on container restart
  async checkForMissedDailySync() {
    try {
      const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
      const today = nowCET.format('YYYY-MM-DD');
      
      // Only check if we're in the active period (12:45-15:55 CET)
      const activeStart = nowCET.clone().hour(12).minute(45).second(0).millisecond(0);
      const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);
      
      if (nowCET.isBetween(activeStart, activeEnd)) {
        console.log('[Daily Sync] Container started during active period, checking for missed sync...');
        
        // Use country sync status to check if sync is needed
        await this.checkRecentDataSyncByCompleteness();
      } else {
        // Outside active period - just check once if we need to sync
        console.log('[Daily Sync] Outside active period, checking once if sync needed...');
        await this.checkOnceOutsideActivePeriod();
      }
    } catch (error) {
      console.error('[Daily Sync] Error checking for missed sync:', error.message);
    }
  }

  // Check once outside active period if sync is needed
  async checkOnceOutsideActivePeriod() {
    try {
      // Use country sync status instead of date completeness
      await this.checkRecentDataSyncByCompleteness();
    } catch (error) {
      console.error('[Daily Sync] Error in outside period check:', error.message);
    }
  }

  // Schedule weekly full sync
  scheduleWeeklySync(cronExpression, description) {
    this.weeklySyncJob = cron.schedule(cronExpression, async () => {
      console.log(`[Weekly Sync] Running ${description}...`);
      
      try {
        await this.runWeeklySync(description);
      } catch (error) {
        console.error(`[Weekly Sync] Error during ${description}:`, error.message);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Vilnius'
    });
    
    this.weeklySyncJob.start();
    console.log(`[Weekly Sync] Scheduled: ${cronExpression} (CET)`);
  }

  // Schedule next day sync
  scheduleNextDaySync(cronExpression, description) {
    this.nextDaySyncJob = cron.schedule(cronExpression, async () => {
      console.log(`[Next Day Sync] Running ${description}...`);
      
      try {
        await this.runNextDaySync(description);
      } catch (error) {
        console.error(`[Next Day Sync] Error during ${description}:`, error.message);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Paris' // CET/CEST timezone
    });
    
    this.nextDaySyncJob.start();
    console.log(`[Next Day Sync] Scheduled: ${cronExpression} (CET)`);
  }

  // Run weekly sync
  async runWeeklySync(description) {
    if (this.isRunning) {
      console.log(`${description} skipped - another sync is already running`);
      await logScheduledJob('Weekly Sync', 'skipped', 'Another sync is already running');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Starting ${description} ===`);
      console.log(`Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
      
      await this.syncFromLastAvailable(); // Use simple sync logic
      
      const duration = Date.now() - startTime;
      console.log(`${description} completed in ${duration}ms`);
      
      // Log successful sync
      await this.logSync('weekly_sync', 'success', 0, 0, 0, null, duration);
      await logScheduledJob('Weekly Sync', 'success', 'Weekly sync completed', duration);
      
    } catch (error) {
      console.error(`${description} failed:`, error.message);
      const duration = Date.now() - startTime;
      await this.logSync('weekly_sync', 'error', 0, 0, 0, error.message, duration);
      await logScheduledJob('Weekly Sync', 'error', error.message, duration);
    } finally {
      this.isRunning = false;
    }
  }

  // Run next day sync
  async runNextDaySync(description) {
    if (this.isRunning) {
      console.log(`${description} skipped - another sync is already running`);
      await logScheduledJob('Next Day Sync', 'skipped', 'Another sync is already running');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Starting ${description} ===`);
      console.log(`Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
      
      // Check if we need to sync next day data
      const needsNextDaySync = await this.checkNextDaySyncNeeded();
      
      if (needsNextDaySync) {
        await this.syncFromLastAvailable(); // Use simple sync logic
        const duration = Date.now() - startTime;
        console.log(`${description} completed - next day data synced`);
        await this.logSync('nextday_sync', 'success', 0, 0, 0, 'Next day data synced', duration);
        await logScheduledJob('Next Day Sync', 'success', 'Next day data synced', duration);
      } else {
        const duration = Date.now() - startTime;
        console.log(`${description} skipped - next day data already available`);
        await this.logSync('nextday_sync', 'skipped', 0, 0, 0, 'Next day data already available', duration);
        await logScheduledJob('Next Day Sync', 'skipped', 'Next day data already available', duration);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`${description} failed:`, error.message);
      await this.logSync('nextday_sync', 'error', 0, 0, 0, error.message, duration);
      await logScheduledJob('Next Day Sync', 'error', error.message, duration);
    } finally {
      this.isRunning = false;
    }
  }

  // Check if next day sync is needed
  async checkNextDaySyncNeeded() {
    try {
      const countries = ['lt', 'ee', 'lv', 'fi'];
      const now = moment().tz('Europe/Vilnius');
      const tomorrow = now.clone().add(1, 'day').startOf('day');

      console.log(`[Next Day Sync Check] Checking if sync needed for ${tomorrow.format('YYYY-MM-DD')}`);
      console.log(`[Next Day Sync Check] Comparing database latest timestamps with Elering API latest endpoint`);

      for (const country of countries) {
        // Get our database's latest timestamp
        const ourLatestTimestamp = await this.getLatestPriceTimestamp(country);
        if (!ourLatestTimestamp) {
          console.log(`[Next Day Sync Check] ${country.toUpperCase()}: No data in database - sync needed`);
          return true; // No data at all
        }

        const ourLatestDate = moment.unix(ourLatestTimestamp).tz('Europe/Vilnius');
        console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Database latest: ${ourLatestDate.format('YYYY-MM-DD HH:mm:ss')} (CET)`);

        // Get Elering's latest timestamp from their /latest endpoint
        let eleringLatestTimestamp = null;
        try {
          eleringLatestTimestamp = await this.api.getLatestTimestamp(country);
        } catch (error) {
          console.warn(`[Next Day Sync Check] ${country.toUpperCase()}: Failed to fetch Elering latest timestamp: ${error.message}`);
          // If we can't check Elering, assume we need to sync to be safe
          return true;
        }

        if (!eleringLatestTimestamp) {
          console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Elering has no latest data - skipping check for this country`);
          continue; // Skip this country if Elering has no data
        }

        const eleringLatestDate = moment.unix(eleringLatestTimestamp).tz('Europe/Vilnius');
        console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Elering latest: ${eleringLatestDate.format('YYYY-MM-DD HH:mm:ss')} (CET)`);

        // Compare timestamps - if Elering has newer data, we need to sync
        if (eleringLatestTimestamp > ourLatestTimestamp) {
          const diffMinutes = eleringLatestDate.diff(ourLatestDate, 'minutes');
          console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Elering has newer data (${diffMinutes} minutes ahead) - sync needed`);
          return true; // Elering has newer data
        } else if (eleringLatestTimestamp < ourLatestTimestamp) {
          const diffMinutes = ourLatestDate.diff(eleringLatestDate, 'minutes');
          console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Database is ahead of Elering (${diffMinutes} minutes ahead) - OK`);
        } else {
          console.log(`[Next Day Sync Check] ${country.toUpperCase()}: Database is up-to-date with Elering - OK`);
        }
      }
      
      console.log(`[Next Day Sync Check] All countries are up-to-date with Elering - sync not needed`);
      return false; // All countries are up-to-date
    } catch (error) {
      console.error('Error checking next day sync need:', error);
      return true; // Default to sync if check fails
    }
  }

  // Get next sync times
  getNextNordPoolSyncTime() {
    if (this.nordPoolJobs['all'] && this.nordPoolJobs['all'].nextDate) {
      return this.nordPoolJobs['all'].nextDate().toISOString();
    }
    return null;
  }

  getNextWeeklySyncTime() {
    if (this.weeklySyncJob && this.weeklySyncJob.nextDate) {
      return this.weeklySyncJob.nextDate().toISOString();
    }
    return null;
  }

  getNextNextDaySyncTime() {
    if (this.nextDaySyncJob && this.nextDaySyncJob.nextDate) {
      return this.nextDaySyncJob.nextDate().toISOString();
    }
    return null;
  }

  getEarliestTime(times) {
    const validTimes = times.filter(t => t !== null).map(t => moment(t));
    if (validTimes.length === 0) return null;
    return validTimes.reduce((earliest, current) => 
      current.isBefore(earliest) ? current : earliest
    ).toISOString();
  }

  // Sync all countries
  async syncAllCountries(daysBack = 1) {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    let totalRecords = 0;
    
    for (const country of countries) {
      const records = await this.syncPriceData(country, daysBack);
      totalRecords += records;
    }
    
    return totalRecords;
  }

  // Sync price data for a specific country
  async syncPriceData(country, daysBack = 1) {
    try {
      const endDate = moment();
      const startDate = moment().subtract(daysBack, 'days');
      
      console.log(`Syncing ${country.toUpperCase()} data from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
      
      // Use the proper Elering API client
      const priceData = await this.api.fetchPricesForRange(startDate.toDate(), endDate.toDate(), country);
      
      if (!priceData || priceData.length === 0) {
        console.log(`No data available for ${country.toUpperCase()}`);
        return 0;
      }
      
      const result = await this.insertPriceData(priceData, country);
      console.log(`Synced ${result.insertedCount} records for ${country.toUpperCase()}`);
      
      return result.insertedCount;
    } catch (error) {
      console.error(`Error syncing ${country.toUpperCase()}:`, error.message);
      
      // If it's a rate limit or temporary error, we might want to retry
      if (error.message.includes('429') || error.message.includes('503') || error.message.includes('502')) {
        console.log(`[DEBUG] Rate limit or temporary error detected, will retry later`);
      }
      
      throw error;
    }
  }

  // Insert price data into database
  async insertPriceData(priceData, country) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO price_data (timestamp, price, country, date)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (timestamp, country) DO UPDATE SET
          price = EXCLUDED.price,
          date = EXCLUDED.date,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      let insertedCount = 0;
      let maxTimestamp = null;
      
      for (const data of priceData) {
        // Calculate date in CET/EET timezone (Europe/Vilnius) from timestamp
        // Nord Pool data is published in CET/EET, so we should use that timezone for date calculation
        const timestampMoment = moment.unix(data.timestamp).tz('Europe/Vilnius');
        const date = timestampMoment.format('YYYY-MM-DD');
        await client.query(insertQuery, [data.timestamp, data.price, country, date]);
        insertedCount++;
        
        // Track max timestamp
        if (!maxTimestamp || data.timestamp > maxTimestamp) {
          maxTimestamp = data.timestamp;
        }
      }
      
      await client.query('COMMIT');
      
      // Return maxTimestamp so caller can update sync status after all countries are synced
      return {
        insertedCount,
        maxTimestamp
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error inserting price data:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Log sync operation
  async logSync(syncType, status, recordsProcessed = 0, recordsCreated = 0, recordsUpdated = 0, errorMessage = null, durationMs = null) {
    await logSync(syncType, status, recordsProcessed, recordsCreated, recordsUpdated, errorMessage, durationMs);
  }

  // Stop the worker
  stop() {
    console.log('Stopping Electricity Prices Sync Worker...');
    
    // Stop weekly sync job
    if (this.weeklySyncJob && this.weeklySyncJob.stop) {
      this.weeklySyncJob.stop();
      console.log('Stopped weekly sync job');
    }
    
    // Stop next day sync job
    if (this.nextDaySyncJob && this.nextDaySyncJob.stop) {
      this.nextDaySyncJob.stop();
      console.log('Stopped next day sync job');
    }
    
    // Stop daily sync timeout
    if (this.dailySyncTimeout) {
      clearTimeout(this.dailySyncTimeout);
      this.dailySyncTimeout = null;
      this.dailySyncNextRun = null;
      console.log('Stopped daily sync timeout');
    }
    
    // Stop watchdog
    if (this.dailySyncWatchdogInterval) {
      clearInterval(this.dailySyncWatchdogInterval);
      this.dailySyncWatchdogInterval = null;
      console.log('Stopped daily sync watchdog');
    }
    
    // Stop fallback cron
    if (this.dailySyncFallbackCron) {
      this.dailySyncFallbackCron.stop();
      this.dailySyncFallbackCron = null;
      console.log('Stopped daily sync fallback cron');
    }
    
    // Stop daily sync jobs (legacy cron jobs, if any)
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach(job => job.stop());
      console.log('Stopped daily sync cron jobs');
    }
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      console.log('Stopped health monitoring');
    }
    
    this.isRunning = false;
    console.log('Sync worker stopped');
  }

  // Calculate next run time for a cron expression
  getNextRunTime(cronExpression, timezone) {
    try {
      const now = moment().tz(timezone);
      
      // Parse cron expression manually for our specific patterns
      if (cronExpression === '0 2 * * 0') {
        // Weekly sync: Every Sunday at 2 AM
        let nextRun = now.clone().day(0).hour(2).minute(0).second(0).millisecond(0);
        if (nextRun.isBefore(now) || (nextRun.isSame(now, 'day') && now.hour() >= 2)) {
          nextRun = nextRun.add(1, 'week');
        }
        return nextRun.toISOString();
      }
      
      if (cronExpression === '30 13 * * *') {
        // Next day sync: Every day at 13:30 CET
        let nextRun = now.clone().hour(13).minute(30).second(0).millisecond(0);
        if (nextRun.isBefore(now)) {
          nextRun = nextRun.add(1, 'day');
        }
        return nextRun.toISOString();
      }
      
      // Daily sync: 45,50,55 12 * * *; */5 13-15 * * * (in CET timezone)
      if (cronExpression.includes('45,50,55 12') || cronExpression.includes('*/5 13-15')) {
        const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
        const candidates = [];
        
        // First cron: 12:45, 12:50, 12:55 CET
        if (nowCET.hour() < 12 || (nowCET.hour() === 12 && nowCET.minute() < 45)) {
          // Before 12:45 today
          candidates.push(nowCET.clone().hour(12).minute(45).second(0).millisecond(0));
        } else if (nowCET.hour() === 12) {
          if (nowCET.minute() < 50) {
            candidates.push(nowCET.clone().minute(50).second(0).millisecond(0));
          } else if (nowCET.minute() < 55) {
            candidates.push(nowCET.clone().minute(55).second(0).millisecond(0));
          } else {
            // After 12:55, next is 13:00
            candidates.push(nowCET.clone().hour(13).minute(0).second(0).millisecond(0));
          }
        }
        
        // Second cron: */5 13-15 (every 5 minutes from 13:00 to 15:55 CET)
        if (nowCET.hour() >= 13 && nowCET.hour() <= 15) {
          const currentMinute = nowCET.minute();
          let nextMinute = Math.ceil((currentMinute + 1) / 5) * 5;
          
          if (nextMinute >= 60) {
            // Next hour
            if (nowCET.hour() < 15) {
              candidates.push(nowCET.clone().add(1, 'hour').minute(0).second(0).millisecond(0));
            }
          } else if (nowCET.hour() === 15 && nextMinute > 55) {
            // Past 15:55, next is tomorrow
            candidates.push(nowCET.clone().add(1, 'day').hour(12).minute(45).second(0).millisecond(0));
          } else {
            candidates.push(nowCET.clone().minute(nextMinute).second(0).millisecond(0));
          }
        } else if (nowCET.hour() < 13) {
          // Before 13:00, next is 13:00
          candidates.push(nowCET.clone().hour(13).minute(0).second(0).millisecond(0));
        }
        
        // If no candidates for today, next is tomorrow at 12:45 CET
        if (candidates.length === 0 || nowCET.hour() > 15 || (nowCET.hour() === 15 && nowCET.minute() > 55)) {
          candidates.push(nowCET.clone().add(1, 'day').hour(12).minute(45).second(0).millisecond(0));
        }
        
        // Return the earliest candidate
        if (candidates.length > 0) {
          const earliest = candidates.reduce((earliest, current) => 
            moment(current).isBefore(moment(earliest)) ? current : earliest
          );
          return moment(earliest).toISOString();
        }
        
        return nowCET.clone().add(1, 'day').hour(12).minute(45).second(0).millisecond(0).toISOString();
      }
      
      return null;
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return null;
    }
  }

  // Get scheduled job information
  getScheduledJobs() {
    const jobs = [];
    
    // Daily sync (using dynamic setTimeout)
    const nowCET = moment().tz('Europe/Paris'); // CET/CEST timezone
    const activeStart = nowCET.clone().hour(12).minute(45).second(0).millisecond(0);
    const activeEnd = nowCET.clone().hour(15).minute(55).second(0).millisecond(0);
    const isInActivePeriod = nowCET.isBetween(activeStart, activeEnd, null, '[]');
    
    jobs.push({
      name: 'Daily Sync',
      cron: 'Dynamic (every 5 min) + Fallback (every 15 min)',
      timezone: 'Europe/Paris',
      description: 'Every 5 minutes from 12:45 to 15:55 CET (dynamic scheduling with watchdog)',
      running: this.dailySyncTimeout !== null || (isInActivePeriod && this.dailySyncFallbackCron),
      nextRun: this.dailySyncNextRun || this.getNextRunTime('45,50,55 12 * * *; */5 13-15 * * *', 'Europe/Paris'),
      lastCheck: this.dailySyncLastCheck,
      watchdogActive: this.dailySyncWatchdogInterval !== null,
      fallbackActive: this.dailySyncFallbackCron !== null
    });
    
    // Weekly sync job
    if (this.weeklySyncJob) {
      const nextRun = this.getNextRunTime('0 2 * * 0', 'Europe/Vilnius');
      jobs.push({
        name: 'Weekly Sync',
        cron: '0 2 * * 0',
        timezone: 'Europe/Vilnius',
        description: 'Every Sunday at 2 AM CET',
        running: this.weeklySyncJob.running,
        nextRun: nextRun
      });
    }
    
    // Next day sync job
    if (this.nextDaySyncJob) {
      const nextRun = this.getNextRunTime('30 13 * * *', 'Europe/Paris');
      jobs.push({
        name: 'Next Day Sync',
        cron: '30 13 * * *',
        timezone: 'Europe/Paris',
        description: 'Every day at 13:30 CET',
        running: this.nextDaySyncJob.running,
        nextRun: nextRun
      });
    }
    
    return jobs;
  }

  // Get sync worker status
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      lastHealthCheck: this.lastHealthCheck,
      scheduledJobs: this.getScheduledJobs(),
      currentSync: this.currentSync,
      syncInProgress: this.syncInProgress
    };
  }

  // Trigger manual sync
  async triggerManualSync(country = 'lt', daysBack = 1) {
    console.log(`Manual sync triggered for ${country}, ${daysBack} days back`);
    return await this.syncPriceData(country, daysBack);
  }

  // Enhanced historical data sync (for initial setup or data recovery)
  async syncHistoricalData(startDate, endDate, country = 'lt') {
    const startTime = Date.now();
    const start = moment(startDate);
    const end = moment(endDate);
    const diffDays = end.diff(start, 'days');
    
    try {
      console.log(`\n=== Historical sync for ${country.toUpperCase()} ===`);
      console.log(`Date range: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')} (${diffDays} days)`);
      
      if (diffDays > 180) {
        console.log(`Large date range detected (${diffDays} days). Using half-year chunking...`);
        const chunks = this.splitToHalfYearChunks(startDate, endDate);
        let totalCreated = 0;
        
        for (const chunk of chunks) {
          console.log(`Processing chunk: ${chunk.start} to ${chunk.end}`);
          totalCreated += await this.syncHistoricalChunk(chunk.start, chunk.end, country);
          
          // Add delay between chunks to avoid rate limits
          if (chunks.indexOf(chunk) < chunks.length - 1) {
            console.log('Waiting 1 second before next chunk...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        const duration = Date.now() - startTime;
        console.log(`Historical sync completed: ${totalCreated} records in ${duration}ms`);
        await this.logSync('historical_data', 'success', 0, totalCreated, 0, null, duration);
        return totalCreated;
      } else {
        return await this.syncHistoricalChunk(startDate, endDate, country);
      }
    } catch (error) {
      console.error('Historical sync failed:', error);
      const duration = Date.now() - startTime;
      await this.logSync('historical_data', 'error', 0, 0, 0, error.message, duration);
      throw error;
    }
  }

  // Enhanced historical sync for all countries in parallel
  async syncAllCountriesHistorical(startDate, endDate) {
    const startTime = Date.now();
    const start = moment(startDate);
    const end = moment(endDate);
    const diffDays = end.diff(start, 'days');
    const countries = ['lt', 'ee', 'lv', 'fi'];
    
    try {
      console.log(`\n=== Historical sync for ALL countries ===`);
      console.log(`Date range: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')} (${diffDays} days)`);
      
      if (diffDays > 180) {
        console.log(`Large date range detected (${diffDays} days). Using half-year chunking...`);
        const chunks = this.splitToHalfYearChunks(startDate, endDate);
        let totalCreated = 0;
        
        for (const chunk of chunks) {
          console.log(`Processing chunk: ${chunk.start} to ${chunk.end}`);
          const chunkCreated = await this.syncHistoricalChunkAllCountries(chunk.start, chunk.end);
          totalCreated += chunkCreated;
          
          // Add delay between chunks to avoid rate limits
          if (chunks.indexOf(chunk) < chunks.length - 1) {
            console.log('Waiting 1 second before next chunk...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        const duration = Date.now() - startTime;
        console.log(`Historical sync completed: ${totalCreated} records in ${duration}ms`);
        await this.logSync('historical_data_all', 'success', 0, totalCreated, 0, null, duration);
        return totalCreated;
      } else {
        return await this.syncHistoricalChunkAllCountries(startDate, endDate);
      }
    } catch (error) {
      console.error('Historical sync failed:', error);
      const duration = Date.now() - startTime;
      await this.logSync('historical_data_all', 'error', 0, 0, 0, error.message, duration);
      throw error;
    }
  }

  // Process a single historical chunk for all countries
  async syncHistoricalChunkAllCountries(startDate, endDate) {
    const startTime = Date.now();
    try {
      console.log(`Starting historical chunk sync for ALL countries from ${startDate} to ${endDate}`);
      
      // Use fetchAllCountriesData to get data for all countries in one API call
      const allCountriesData = await this.api.fetchAllCountriesData(startDate, endDate);
      
      if (!allCountriesData || Object.keys(allCountriesData).length === 0) {
        console.log('No historical data found for this chunk');
        return 0;
      }
      
      let totalRecords = 0;
      
      // Process data for all countries
      for (const country of Object.keys(allCountriesData)) {
        const countryData = allCountriesData[country];
        if (countryData && countryData.length > 0) {
          console.log(`Processing ${country.toUpperCase()}: ${countryData.length} records`);
          const result = await this.insertPriceData(countryData, country);
          totalRecords += result.insertedCount;
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`Historical chunk sync completed: ${totalRecords} total records in ${duration}ms`);
      
      await this.logSync('historical_chunk_all', 'success', 0, totalRecords, 0, null, duration);
      return totalRecords;
    } catch (error) {
      console.error('Historical chunk sync failed:', error);
      const duration = Date.now() - startTime;
      await this.logSync('historical_chunk_all', 'error', 0, 0, 0, error.message, duration);
      throw error;
    }
  }

  // Process a single historical chunk
  async syncHistoricalChunk(startDate, endDate, country = 'lt') {
    const startTime = Date.now();
    try {
      console.log(`Starting historical chunk sync for ${country.toUpperCase()} from ${startDate} to ${endDate}`);
      
      // Use fetchAllCountriesData to get data for all countries in one API call
      const allCountriesData = await this.api.fetchAllCountriesData(startDate, endDate);
      
      if (!allCountriesData || Object.keys(allCountriesData).length === 0) {
        console.log('No historical data found for this chunk');
        return 0;
      }
      
      // Process data for the specific country
      const countryData = allCountriesData[country] || [];
      if (countryData.length === 0) {
        console.log(`No data available for ${country.toUpperCase()} in this range`);
        return 0;
      }
      
      const result = await this.insertPriceData(countryData, country);
      const duration = Date.now() - startTime;
      console.log(`Historical chunk sync completed: ${result.insertedCount} records in ${duration}ms`);
      
      await this.logSync('historical_chunk', 'success', countryData.length, result.insertedCount, 0, null, duration);
      return result.insertedCount;
    } catch (error) {
      console.error('Historical chunk sync failed:', error);
      const duration = Date.now() - startTime;
      await this.logSync('historical_chunk', 'error', 0, 0, 0, error.message, duration);
      throw error;
    }
  }

  // Sync data for a specific year
  async syncYearData(year, country = 'lt') {
    const startDate = moment.utc(year, 0, 1).format('YYYY-MM-DD');
    const endDate = moment.utc(year, 11, 31).format('YYYY-MM-DD');
    
    console.log(`\n=== Syncing data for year ${year} (${country.toUpperCase()}) ===`);
    return await this.syncHistoricalData(startDate, endDate, country);
  }

  // Sync all historical data from 2012-07-01
  async syncAllHistoricalData(country = 'lt') {
    const startDate = '2012-07-01';
    const endDate = moment().format('YYYY-MM-DD');
    
    console.log(`\n=== Syncing ALL historical data for ${country.toUpperCase()} ===`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log('This will take a significant amount of time...');
    
    return await this.syncHistoricalData(startDate, endDate, country);
  }

  // Sync multiple years
  async syncYearRange(startYear, endYear, country = 'lt') {
    console.log(`\n=== Syncing data for years ${startYear} to ${endYear} (${country.toUpperCase()}) ===`);
    
    let totalRecords = 0;
    
    for (let year = startYear; year <= endYear; year++) {
      try {
        console.log(`\n--- Syncing year ${year} ---`);
        const records = await this.syncYearData(year, country);
        totalRecords += records;
        
        // Add delay between years
        if (year < endYear) {
          console.log('Waiting 1 second before next year...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to sync year ${year}:`, error.message);
      }
    }
    
    console.log(`\nYear range sync completed: ${totalRecords} total records`);
    return totalRecords;
  }

  // Helper: split a date range into half-year chunks (Jan 1-Jun 30, Jul 1-Dec 31)
  splitToHalfYearChunks(startDate, endDate) {
    const chunks = [];
    let start = moment(startDate);
    const end = moment(endDate);
    
    while (start.isBefore(end)) {
      const year = start.year();
      let chunkEnd;
      
      // Determine which half of the year we're in
      if (start.month() < 6) {
        // First half: Jan 1 to Jun 30
        chunkEnd = moment([year, 5, 30]); // June 30 (month is 0-indexed)
      } else {
        // Second half: Jul 1 to Dec 31
        chunkEnd = moment([year, 11, 31]); // December 31
      }
      
      // Don't exceed the requested end date
      if (chunkEnd.isAfter(end)) {
        chunkEnd = moment(end);
      }
      
      chunks.push({
        start: start.format('YYYY-MM-DD'),
        end: chunkEnd.format('YYYY-MM-DD'),
      });
      
      // Move to the next half-year period
      start = chunkEnd.clone().add(1, 'day');
    }
    
    return chunks;
  }

  // Efficient sync for multiple countries (single API call if possible)
  async syncAllCountriesEfficient() {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    const now = moment().tz('Europe/Vilnius');
    const targetEndDate = now.clone().add(2, 'days');
    const dataStart = moment('2012-07-01');
    
    console.log(`\n=== Efficient sync for all countries ===`);
    console.log(`Target range: ${dataStart.format('YYYY-MM-DD')} to ${targetEndDate.format('YYYY-MM-DD')}`);
    
    let totalRecords = 0;
    
    // Get the date range that needs syncing for all countries
    const syncRanges = {};
    
    for (const country of countries) {
      const latestTimestamp = await this.getLatestPriceTimestamp(country);
      let startDate;
      
      if (!latestTimestamp) {
        // No data, start from 2012-07-01
        startDate = dataStart.clone();
        console.log(`[Efficient Sync] ${country.toUpperCase()}: No data - starting from ${startDate.format('YYYY-MM-DD')}`);
      } else {
        // Start from last available -1 day
        const latestDate = moment.unix(latestTimestamp).tz('Europe/Vilnius');
        startDate = latestDate.clone().subtract(1, 'day').startOf('day');
        console.log(`[Efficient Sync] ${country.toUpperCase()}: Last data at ${latestDate.format('YYYY-MM-DD HH:mm')} - syncing from ${startDate.format('YYYY-MM-DD')}`);
      }
      
      syncRanges[country] = {
        start: startDate.toDate(),
        end: targetEndDate.toDate()
      };
    }
    
    // Find the earliest start date and latest end date to cover all countries
    const allStartDates = Object.values(syncRanges).map(range => moment(range.start));
    const allEndDates = Object.values(syncRanges).map(range => moment(range.end));
    
    const globalStartDate = moment.min(allStartDates);
    const globalEndDate = moment.max(allEndDates);
    const diffDays = globalEndDate.diff(globalStartDate, 'days');
    
    console.log(`[Efficient Sync] Global sync range: ${globalStartDate.format('YYYY-MM-DD')} to ${globalEndDate.format('YYYY-MM-DD')} (${diffDays} days)`);
    
    // Check if we need to use chunking (API limit is 1 year = 365 days)
    if (diffDays > 365) {
      console.log(`[Efficient Sync] Large date range detected (${diffDays} days). Using chunking to respect API 1-year limit...`);
      return await this.syncAllCountriesHistorical(globalStartDate.format('YYYY-MM-DD'), globalEndDate.format('YYYY-MM-DD'));
    }
    
    // Make a single API call to get data for the entire range (if under 1 year)
    try {
      const allCountriesData = await this.api.fetchAllCountriesData(globalStartDate.toDate(), globalEndDate.toDate());
      
      if (!allCountriesData || Object.keys(allCountriesData).length === 0) {
        console.log('[Efficient Sync] No data received from API');
        return 0;
      }
      
      // Store all countries' data from the single API response
      for (const country of Object.keys(allCountriesData)) {
        const countryData = allCountriesData[country];
        if (countryData && countryData.length > 0) {
          console.log(`[Efficient Sync] Storing ${country.toUpperCase()}: ${countryData.length} records`);
          const result = await this.insertPriceData(countryData, country);
          totalRecords += result.insertedCount;
        }
      }
      
      console.log(`[Efficient Sync] Completed: ${totalRecords} total records across all countries`);
      return totalRecords;
      
    } catch (error) {
      console.error(`[Efficient Sync] Error syncing all countries:`, error.message);
      throw error;
    }
  }

  // Check historical data coverage
  async checkHistoricalDataCoverage() {
    const expectedStart = moment('2012-07-01');
    const countries = ['lt', 'ee', 'lv', 'fi'];
    const earliestTimestamps = await getAllEarliestTimestamps();
    const countryEarliest = Object.fromEntries(countries.map(c => [c, null]));
    for (const row of earliestTimestamps) {
      countryEarliest[row.country] = row.earliest_timestamp ? moment.unix(row.earliest_timestamp) : null;
    }
    for (const country of countries) {
      const earliest = countryEarliest[country];
      if (!earliest || earliest.isAfter(expectedStart)) {
        console.warn(`[Startup Historical Check] ${country.toUpperCase()} missing historical data. Earliest: ${earliest ? earliest.format('YYYY-MM-DD') : 'none'}`);
        // Optionally trigger historical sync for missing range
        const startDate = expectedStart.format('YYYY-MM-DD');
        const endDate = earliest ? earliest.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
        console.log(`[Startup Historical Check] Triggering historical sync for ${country.toUpperCase()} from ${startDate} to ${endDate}`);
        await this.syncHistoricalData(startDate, endDate, country);
      } else {
        console.log(`[Startup Historical Check] ${country.toUpperCase()} has historical data from ${earliest.format('YYYY-MM-DD')}`);
      }
    }
  }

  // Enhanced startup sync: check for presence of initial day (2012-07-01) in DB and Elering API
  async checkHistoricalDataPresence() {
    const countries = ['lt', 'ee', 'lv', 'fi'];
    const initialDate = '2012-07-01';
    let allPresent = true;

    // Check DB for initial day for all countries
    const dbResults = await pool.query(
      'SELECT country, COUNT(*) as count FROM price_data WHERE date = $1 GROUP BY country',
      [initialDate]
    );
    const dbCounts = {};
    dbResults.rows.forEach(row => {
      dbCounts[row.country] = parseInt(row.count, 10);
    });

    // Check Elering API for initial day - single call for all countries
    let apiData = {};
    try {
      const response = await this.api.fetchAllCountriesData(initialDate, initialDate);
      if (response && typeof response === 'object') {
        // API returns data for all countries in one response
        Object.keys(response).forEach(country => {
          apiData[country] = Array.isArray(response[country]) ? response[country].length : 0;
        });
      }
    } catch (err) {
      console.error(`[Startup Sync] Error fetching initial day from Elering API:`, err.message);
    }

    // Compare DB vs API for each country
    for (const country of countries) {
      const dbCount = dbCounts[country] || 0;
      const apiCount = apiData[country] || 0;

      if (dbCount === 0 && apiCount > 0) {
        allPresent = false;
        console.warn(`[Startup Sync] Historical data missing for ${country.toUpperCase()} on ${initialDate}. Elering API has ${apiCount} records, but DB has ${dbCount}.`);
        // Don't trigger sync here - just log warning
      } else if (dbCount === 0 && apiCount === 0) {
        console.warn(`[Startup Sync] No historical data for ${country.toUpperCase()} on ${initialDate} in either DB or Elering API.`);
      } else {
        console.log(`[Startup Sync] Historical data present for ${country.toUpperCase()} on ${initialDate} (DB: ${dbCount}, API: ${apiCount})`);
      }
    }
    return allPresent;
  }
}

// Create singleton instance
const syncWorker = new SyncWorker();

// Export functions
export const startSyncWorker = () => syncWorker.start();
export const stopSyncWorker = () => syncWorker.stop();
export const getSyncStatus = () => syncWorker.getStatus();

// Export the worker instance for direct access
export default syncWorker; 