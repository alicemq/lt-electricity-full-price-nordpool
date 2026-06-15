import moment from 'moment-timezone';
import {
  getInitialSyncStatus,
  getCountrySyncStatus,
  updateCountrySyncStatus,
} from '../../database.js';
import pool from '../../database.js';
import {
  DISPLAY_TIMEZONE,
  displayToday,
  displayTomorrow,
  displayDateOffset,
} from './releaseWindow.js';
import { SUPPORTED_COUNTRIES, findIncompleteDates, isDateComplete } from './completeness.js';

const STALE_LOOKBACK_DAYS = 7;
const STALE_HOURS_THRESHOLD = 48;

/**
 * Do not suppress release-window polling while tomorrow's prices are still incomplete.
 */
export { shouldSuppressDailySyncForToday } from './suppression.js';

export async function detectStaleDatabase(worker) {
  const now = moment().tz(DISPLAY_TIMEZONE);
  const reasons = [];

  for (const country of SUPPORTED_COUNTRIES) {
    const latestTimestamp = await worker.getLatestPriceTimestamp(country);
    if (!latestTimestamp) {
      reasons.push(`${country.toUpperCase()} has no price data`);
      continue;
    }

    const latestDate = moment.unix(latestTimestamp).tz(DISPLAY_TIMEZONE);
    const hoursOld = now.diff(latestDate, 'hours');
    if (hoursOld > STALE_HOURS_THRESHOLD) {
      reasons.push(
        `${country.toUpperCase()} latest data is ${hoursOld}h old (${latestDate.format('YYYY-MM-DD HH:mm')})`
      );
    }
  }

  const lookbackStart = displayDateOffset(-STALE_LOOKBACK_DAYS);
  const lookbackEnd = displayToday();
  const incompleteDates = await findIncompleteDates(pool, lookbackStart, lookbackEnd);
  const staleIncompleteDates = incompleteDates.filter((date) => date !== displayTomorrow());

  if (staleIncompleteDates.length > 0) {
    reasons.push(`Incomplete dates: ${staleIncompleteDates.join(', ')}`);
  }

  const yesterday = displayDateOffset(-1);
  const yesterdayStatus = await isDateComplete(yesterday, pool);
  if (!yesterdayStatus.isComplete) {
    reasons.push(`Yesterday (${yesterday}) is incomplete`);
  }

  return {
    isStale: reasons.length > 0,
    reasons,
    incompleteDates: staleIncompleteDates,
  };
}

export async function markCountriesNeedsSyncIfStale(staleInfo) {
  if (!staleInfo.isStale) {
    return;
  }

  for (const country of SUPPORTED_COUNTRIES) {
    const currentStatus = await getCountrySyncStatus(country);
    const lastDate =
      currentStatus?.last_sync_ok_date ||
      displayDateOffset(-STALE_LOOKBACK_DAYS);

    await updateCountrySyncStatus(
      country,
      lastDate,
      currentStatus?.last_sync_ok_timestamp || null,
      false
    );
  }

  console.log(
    `[Startup Sync] Marked countries sync_ok=false due to stale data: ${staleInfo.reasons.join('; ')}`
  );
}

export async function runStartupSyncCheck(worker) {
  console.log('[Startup Sync] Checking initial sync status...');

  const initialSyncStatus = await getInitialSyncStatus();
  if (!initialSyncStatus.isComplete) {
    console.log('[Startup Sync] Initial sync not complete, running full initial sync with chunk tracking...');
    try {
      const totalRecords = await worker.runInitialSyncWithChunks();
      console.log(`[Startup Sync] Initial sync completed successfully: ${totalRecords} records`);
      await worker.initializeCountrySyncStatuses();
    } catch (error) {
      console.error('[Startup Sync] Error during initial sync:', error.message);
    }
    return;
  }

  console.log(
    `[Startup Sync] Initial sync already completed to ${initialSyncStatus.completedDate} (${initialSyncStatus.recordsCount} records)`
  );

  const staleInfo = await detectStaleDatabase(worker);
  if (staleInfo.isStale) {
    console.log('[Startup Sync] Stale database detected on startup:');
    staleInfo.reasons.forEach((reason) => console.log(`  - ${reason}`));
    await markCountriesNeedsSyncIfStale(staleInfo);
  } else {
    console.log('[Startup Sync] Recent data looks fresh, running wake-up recovery check...');
  }

  console.log('[Startup Sync] Running immediate catch-up sync from last sync OK state...');
  await worker.checkAndSyncFromLastSyncOk();
}
