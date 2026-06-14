import { displayToday, displayTomorrow } from './releaseWindow.js';

/**
 * Do not suppress release-window polling while tomorrow's prices are still incomplete.
 */
export async function shouldSuppressDailySyncForToday(worker) {
  const today = displayToday();
  const tomorrow = displayTomorrow();

  const tomorrowStatus = await worker.isDateComplete(tomorrow);
  if (!tomorrowStatus.isComplete) {
    if (worker.dailySyncSuppressedDate === today) {
      console.log(
        `[Daily Sync] Tomorrow (${tomorrow}) is incomplete — clearing suppression for ${today}`
      );
      worker.dailySyncSuppressedDate = null;
      if (worker.dailyScheduler) {
        worker.dailyScheduler.dailySyncSuppressedDate = null;
      }
    }
    return false;
  }

  if (worker.dailySyncSuppressedDate === today) {
    const todayStatus = await worker.isDateComplete(today);
    if (todayStatus.isComplete) {
      return true;
    }

    console.log(`[Daily Sync] Date ${today} is no longer complete, clearing suppression`);
    worker.dailySyncSuppressedDate = null;
    if (worker.dailyScheduler) {
      worker.dailyScheduler.dailySyncSuppressedDate = null;
    }
    return false;
  }

  const todayStatus = await worker.isDateComplete(today);
  if (todayStatus.isComplete) {
    console.log(
      `[Daily Sync] Today (${today}) and tomorrow (${tomorrow}) are complete, stopping dynamic sync checks`
    );
    worker.dailySyncSuppressedDate = today;
    if (worker.dailySyncTimeout) {
      clearTimeout(worker.dailySyncTimeout);
      worker.dailySyncTimeout = null;
      worker.dailySyncNextRun = null;
    }
    if (worker.dailyScheduler) {
      worker.dailyScheduler.dailySyncSuppressedDate = today;
      worker.dailyScheduler.dailySyncTimeout = null;
      worker.dailyScheduler.dailySyncNextRun = null;
    }
    return true;
  }

  return false;
}
