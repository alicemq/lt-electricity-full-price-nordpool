export const BACKUP_FETCH_TIMEOUT_MS = 15_000;

export function parseAllowBackupFlag(query = {}) {
  const raw = query.allow_backup ?? query.backup;
  if (raw == null || raw === '') return false;
  const normalized = String(raw).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function isSingleDateRecordCountComplete(recordCount) {
  if (recordCount >= 90) {
    return recordCount >= 92 && recordCount <= 100;
  }
  if (recordCount > 0) {
    return recordCount >= 23 && recordCount <= 25;
  }
  return false;
}

export function needsBackupFetch(rawData, date) {
  if (!rawData.length) return true;
  if (date) return !isSingleDateRecordCountComplete(rawData.length);
  return false;
}

/**
 * Decide whether the route should call the vendor backup path.
 */
export function resolveBackupFetchPlan({ needsLiveFetch, inReleaseWindow, allowBackup }) {
  if (!needsLiveFetch) {
    return { attempt: false, reason: 'db_complete' };
  }
  if (inReleaseWindow && !allowBackup) {
    return { attempt: false, reason: 'release_window', returnPartial: true };
  }
  if (allowBackup) {
    return { attempt: true, reason: 'explicit_flag' };
  }
  return { attempt: true, reason: 'outside_release_window' };
}

export function withTimeout(promise, timeoutMs = BACKUP_FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('backup fetch timeout')), timeoutMs);
    }),
  ]);
}
