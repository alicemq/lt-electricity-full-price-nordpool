import cron from 'node-cron';
import moment from 'moment-timezone';
import { logScheduledJob } from '../../database.js';
import {
  DAILY_SYNC_CHECK_INTERVAL_MINUTES,
  DAILY_SYNC_FALLBACK_CRON,
  RELEASE_TIMEZONE,
  getReleaseWindowBounds,
  isInReleaseWindow,
  nowInReleaseTz,
  displayToday,
} from './releaseWindow.js';
import { shouldSuppressDailySyncForToday } from './suppression.js';

export class DailySyncScheduler {
  constructor(worker) {
    this.worker = worker;
    this.dailySyncTimeout = null;
    this.dailySyncNextRun = null;
    this.dailySyncLastCheck = null;
    this.dailySyncSuppressedDate = null;
    this.dailySyncWatchdogInterval = null;
    this.dailySyncFallbackCron = null;
    this.dailySyncJobs = [];
  }

  bindToWorker() {
    this.worker.dailySyncTimeout = this.dailySyncTimeout;
    this.worker.dailySyncNextRun = this.dailySyncNextRun;
    this.worker.dailySyncLastCheck = this.dailySyncLastCheck;
    this.worker.dailySyncSuppressedDate = this.dailySyncSuppressedDate;
    this.worker.dailySyncWatchdogInterval = this.dailySyncWatchdogInterval;
    this.worker.dailySyncFallbackCron = this.dailySyncFallbackCron;
    this.worker.dailySyncJobs = this.dailySyncJobs;
  }

  syncFromWorker() {
    this.dailySyncTimeout = this.worker.dailySyncTimeout;
    this.dailySyncNextRun = this.worker.dailySyncNextRun;
    this.dailySyncLastCheck = this.worker.dailySyncLastCheck;
    this.dailySyncSuppressedDate = this.worker.dailySyncSuppressedDate;
    this.dailySyncWatchdogInterval = this.worker.dailySyncWatchdogInterval;
    this.dailySyncFallbackCron = this.worker.dailySyncFallbackCron;
    this.dailySyncJobs = this.worker.dailySyncJobs;
  }

  publishState() {
    this.worker.dailySyncTimeout = this.dailySyncTimeout;
    this.worker.dailySyncNextRun = this.dailySyncNextRun;
    this.worker.dailySyncLastCheck = this.dailySyncLastCheck;
    this.worker.dailySyncSuppressedDate = this.dailySyncSuppressedDate;
    this.worker.dailySyncWatchdogInterval = this.dailySyncWatchdogInterval;
    this.worker.dailySyncFallbackCron = this.dailySyncFallbackCron;
    this.worker.dailySyncJobs = this.dailySyncJobs;
  }

  scheduleDailySync() {
    if (this.dailySyncTimeout) {
      clearTimeout(this.dailySyncTimeout);
      this.dailySyncTimeout = null;
    }

    this.scheduleNextDailySyncCheck();
    this.startDailySyncWatchdog();
    this.startDailySyncFallback();
    this.checkForMissedDailySync();
    this.publishState();
  }

  startDailySyncWatchdog() {
    if (this.dailySyncWatchdogInterval) {
      clearInterval(this.dailySyncWatchdogInterval);
    }

    this.dailySyncWatchdogInterval = setInterval(() => {
      this.checkDailySyncWatchdog();
    }, 10 * 60 * 1000);

    console.log('[Daily Sync] Watchdog started (checks every 10 minutes)');
    this.publishState();
  }

  async checkDailySyncWatchdog() {
    const startTime = Date.now();
    try {
      const nowCET = nowInReleaseTz();
      const isInActivePeriod = isInReleaseWindow(nowCET);
      let actionTaken = null;

      if (isInActivePeriod && !this.dailySyncTimeout) {
        console.warn('[Daily Sync Watchdog] In active period but no sync scheduled. Rescheduling...');
        this.scheduleNextDailySyncCheck();
        actionTaken = 'Rescheduled - no sync was scheduled';
        await logScheduledJob('Watchdog', 'success', actionTaken, Date.now() - startTime);
        this.publishState();
        return;
      }

      if (isInActivePeriod && this.dailySyncTimeout && this.dailySyncNextRun) {
        const nextRun = moment(this.dailySyncNextRun);
        const timeUntilNext = nextRun.diff(nowCET, 'minutes');

        if (timeUntilNext > 10) {
          console.warn(
            `[Daily Sync Watchdog] Next run is ${timeUntilNext} minutes away, might be stuck. Rescheduling...`
          );
          clearTimeout(this.dailySyncTimeout);
          this.dailySyncTimeout = null;
          this.scheduleNextCheckIn5Minutes();
          actionTaken = `Rescheduled - next run was ${timeUntilNext} minutes away`;
          await logScheduledJob('Watchdog', 'success', actionTaken, Date.now() - startTime);
          this.publishState();
          return;
        }

        if (nextRun.isBefore(moment())) {
          console.warn('[Daily Sync Watchdog] Next run time is in the past. Rescheduling...');
          clearTimeout(this.dailySyncTimeout);
          this.dailySyncTimeout = null;
          this.scheduleNextCheckIn5Minutes();
          actionTaken = 'Rescheduled - next run was in the past';
          await logScheduledJob('Watchdog', 'success', actionTaken, Date.now() - startTime);
          this.publishState();
          return;
        }
      }

      if (isInActivePeriod && this.dailySyncLastCheck) {
        const lastCheck = moment(this.dailySyncLastCheck);
        const minutesSinceLastCheck = moment().diff(lastCheck, 'minutes');
        if (minutesSinceLastCheck > 15) {
          console.warn(
            `[Daily Sync Watchdog] Last check was ${minutesSinceLastCheck} minutes ago. Forcing check...`
          );
          await this.runDailySyncCheck();
          actionTaken = `Forced check - last check was ${minutesSinceLastCheck} minutes ago`;
          await logScheduledJob('Watchdog', 'success', actionTaken, Date.now() - startTime);
          this.publishState();
          return;
        }
      }

      if (isInActivePeriod && this.dailySyncSuppressedDate) {
        const today = displayToday();
        if (this.dailySyncSuppressedDate !== today) {
          console.log('[Daily Sync Watchdog] Suppression date changed, clearing suppression');
          this.dailySyncSuppressedDate = null;
          this.scheduleNextCheckIn5Minutes();
          actionTaken = 'Cleared suppression - date changed';
          await logScheduledJob('Watchdog', 'success', actionTaken, Date.now() - startTime);
          this.publishState();
          return;
        }
      }

      if (!actionTaken) {
        await logScheduledJob(
          'Watchdog',
          'success',
          'No action needed - sync is healthy',
          Date.now() - startTime
        );
      }
    } catch (error) {
      console.error('[Daily Sync Watchdog] Error in watchdog check:', error);
      await logScheduledJob('Watchdog', 'error', error.message, Date.now() - startTime);
    }
  }

  startDailySyncFallback() {
    if (this.dailySyncFallbackCron) {
      this.dailySyncFallbackCron.stop();
    }

    this.dailySyncFallbackCron = cron.schedule(
      DAILY_SYNC_FALLBACK_CRON,
      async () => {
        const startTime = Date.now();
        if (!isInReleaseWindow()) {
          return;
        }

        const minutesSinceLastCheck = this.dailySyncLastCheck
          ? moment().diff(moment(this.dailySyncLastCheck), 'minutes')
          : 999;

        if (minutesSinceLastCheck > 10) {
          console.warn('[Daily Sync Fallback] Dynamic sync appears stuck, forcing check via fallback cron');
          try {
            await this.runDailySyncCheck();
            await logScheduledJob(
              'Fallback Cron',
              'success',
              `Forced check - last check was ${minutesSinceLastCheck} minutes ago`,
              Date.now() - startTime
            );
          } catch (error) {
            console.error('[Daily Sync Fallback] Error in fallback check:', error);
            await logScheduledJob('Fallback Cron', 'error', error.message, Date.now() - startTime);
          }
        } else {
          await logScheduledJob(
            'Fallback Cron',
            'skipped',
            'Dynamic sync is working, no action needed',
            Date.now() - startTime
          );
        }
      },
      {
        scheduled: true,
        timezone: RELEASE_TIMEZONE,
      }
    );

    console.log('[Daily Sync] Fallback cron started (every 15 min during active period, 12:45-15:55 CET)');
    this.publishState();
  }

  scheduleNextDailySyncCheck() {
    const nowCET = nowInReleaseTz();
    const { activeStart, activeEnd } = getReleaseWindowBounds(nowCET);

    if (nowCET.isBefore(activeStart)) {
      const msUntilStart = activeStart.diff(nowCET);
      this.dailySyncNextRun = activeStart.toISOString();
      this.dailySyncTimeout = setTimeout(() => {
        this.runDailySyncCheck();
      }, msUntilStart);
      console.log(
        `[Daily Sync] Scheduled first check at 12:45 CET (in ${Math.round(msUntilStart / 1000 / 60)} minutes)`
      );
      this.publishState();
      return;
    }

    if (nowCET.isAfter(activeEnd)) {
      const tomorrowStart = activeStart.clone().add(1, 'day');
      const msUntilTomorrow = tomorrowStart.diff(nowCET);
      this.dailySyncNextRun = tomorrowStart.toISOString();
      this.dailySyncTimeout = setTimeout(() => {
        this.scheduleNextDailySyncCheck();
      }, msUntilTomorrow);
      console.log('[Daily Sync] Outside active period, scheduling for tomorrow 12:45 CET');
      this.publishState();
      return;
    }

    this.runDailySyncCheck();
  }

  async runDailySyncCheck() {
    const nowCET = nowInReleaseTz();
    const { activeEnd } = getReleaseWindowBounds(nowCET);
    const startTime = Date.now();
    this.dailySyncLastCheck = moment().tz('UTC').toISOString();
    this.publishState();

    try {
      if (await shouldSuppressDailySyncForToday(this.worker)) {
        console.log('[Daily Sync] Suppressed - today and tomorrow are complete');
        await logScheduledJob(
          'Daily Sync',
          'skipped',
          'Today and tomorrow are complete, no sync needed',
          Date.now() - startTime
        );

        if (nowCET.isBefore(activeEnd)) {
          this.scheduleNextCheckIn5Minutes();
        }
        return;
      }

      console.log(`[Daily Sync] Running daily sync check at ${nowCET.format('HH:mm:ss')} CET...`);
      try {
        await this.worker.checkRecentDataSyncByCompleteness();
        await logScheduledJob('Daily Sync', 'success', 'Daily sync check completed', Date.now() - startTime);
      } catch (error) {
        console.error('[Daily Sync] Error during daily sync:', error.message);
        await logScheduledJob('Daily Sync', 'error', error.message, Date.now() - startTime);
      }

      if (nowCET.isBefore(activeEnd)) {
        this.scheduleNextCheckIn5Minutes();
      } else {
        console.log('[Daily Sync] Active period ended, stopping checks for today');
        this.dailySyncNextRun = null;
        this.publishState();
      }
    } catch (error) {
      console.error('[Daily Sync] Critical error in runDailySyncCheck:', error);
      await logScheduledJob(
        'Daily Sync',
        'error',
        `Critical error: ${error.message}`,
        Date.now() - startTime
      );

      if (nowCET.isBefore(activeEnd)) {
        this.scheduleNextCheckIn5Minutes();
      }
    }
  }

  scheduleNextCheckIn5Minutes() {
    const nowCET = nowInReleaseTz();
    const nextCheck = nowCET.clone().add(DAILY_SYNC_CHECK_INTERVAL_MINUTES, 'minutes');
    const { activeEnd } = getReleaseWindowBounds(nowCET);

    if (nextCheck.isAfter(activeEnd)) {
      console.log('[Daily Sync] Next check would be after active period, stopping');
      this.dailySyncNextRun = null;
      this.publishState();
      return;
    }

    const msUntilNext = nextCheck.diff(nowCET);
    this.dailySyncNextRun = nextCheck.toISOString();
    this.dailySyncTimeout = setTimeout(() => {
      this.runDailySyncCheck();
    }, msUntilNext);

    console.log(
      `[Daily Sync] Next check scheduled at ${nextCheck.format('HH:mm:ss')} CET (in ${DAILY_SYNC_CHECK_INTERVAL_MINUTES} minutes)`
    );
    this.publishState();
  }

  async checkForMissedDailySync() {
    try {
      if (isInReleaseWindow()) {
        console.log('[Daily Sync] Container started during active period, checking for missed sync...');
        await this.worker.checkRecentDataSyncByCompleteness();
      } else {
        console.log('[Daily Sync] Outside active period, checking once if sync needed...');
        await this.worker.checkRecentDataSyncByCompleteness();
      }
    } catch (error) {
      console.error('[Daily Sync] Error checking for missed sync:', error.message);
    }
  }

  suppressDailySyncJobs() {
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach((job) => {
        if (job && job.stop) {
          job.stop();
        }
      });
      console.log(`[Daily Sync] Suppressed ${this.dailySyncJobs.length} daily sync cron jobs`);
    }
  }

  resumeDailySyncJobs() {
    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach((job) => {
        if (job && job.start) {
          job.start();
        }
      });
      console.log(`[Daily Sync] Resumed ${this.dailySyncJobs.length} daily sync cron jobs`);
    }
  }

  stop() {
    if (this.dailySyncTimeout) {
      clearTimeout(this.dailySyncTimeout);
      this.dailySyncTimeout = null;
      this.dailySyncNextRun = null;
    }

    if (this.dailySyncWatchdogInterval) {
      clearInterval(this.dailySyncWatchdogInterval);
      this.dailySyncWatchdogInterval = null;
    }

    if (this.dailySyncFallbackCron) {
      this.dailySyncFallbackCron.stop();
      this.dailySyncFallbackCron = null;
    }

    if (this.dailySyncJobs && this.dailySyncJobs.length > 0) {
      this.dailySyncJobs.forEach((job) => job.stop());
    }

    this.publishState();
  }

  getDailySyncJobInfo(getNextRunTime) {
    const nowCET = nowInReleaseTz();
    const isInActivePeriod = isInReleaseWindow(nowCET);

    return {
      name: 'Daily Sync',
      cron: 'Dynamic (every 5 min) + Fallback (every 15 min)',
      timezone: RELEASE_TIMEZONE,
      description: 'Every 5 minutes from 12:45 to 15:55 CET (dynamic scheduling with watchdog)',
      running: this.dailySyncTimeout !== null || (isInActivePeriod && this.dailySyncFallbackCron),
      nextRun:
        this.dailySyncNextRun ||
        getNextRunTime('45,50,55 12 * * *; */5 13-15 * * *', RELEASE_TIMEZONE),
      lastCheck: this.dailySyncLastCheck,
      watchdogActive: this.dailySyncWatchdogInterval !== null,
      fallbackActive: this.dailySyncFallbackCron !== null,
    };
  }
}
