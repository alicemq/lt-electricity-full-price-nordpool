function hasHealthError(health) {
  return !health || typeof health !== 'object' || typeof health.error === 'string';
}

function safeSystemSection(system) {
  if (!system || typeof system !== 'object') {
    return { uptime: 'unknown' };
  }
  const uptimeHours = typeof system.uptime === 'number'
    ? `${Math.floor(system.uptime / 3600)} hours`
    : 'unknown';
  return { ...system, uptime: uptimeHours };
}

function safeDatabaseSection(database, stats) {
  const section = database && typeof database === 'object' ? { ...database } : { connected: false };
  if (!stats || typeof stats !== 'object' || typeof stats.error === 'string') {
    return section;
  }
  return {
    ...section,
    stats: {
      totalRecords: stats.totalRecords,
      countries: stats.countries,
      databaseSize: stats.databaseSize,
      tableSizes: stats.tableSizes,
    },
  };
}

function safeSyncSection(sync, syncStatus, stats, extras = {}) {
  const section = sync && typeof sync === 'object' ? { ...sync } : {};
  const dataFreshness = Array.isArray(section.dataFreshness) ? section.dataFreshness : [];

  return {
    ...section,
    dataFreshness,
    worker: syncStatus ?? null,
    recentActivity: stats && !stats.error ? stats.recentSyncs : [],
    statistics: stats && !stats.error ? stats.syncStats : [],
    ...extras,
  };
}

function collectIssues({
  health,
  syncStatus,
  requireSyncWorker = false,
  isInActivePeriod = true,
}) {
  const issues = [];
  const database = health?.database;
  const dataFreshness = Array.isArray(health?.sync?.dataFreshness) ? health.sync.dataFreshness : [];

  if (typeof health?.error === 'string') {
    issues.push(`System health unavailable: ${health.error}`);
  }

  if (!database?.connected) {
    issues.push('Database connection failed');
  }

  const staleData = dataFreshness.filter((country) => !country.isRecent);
  if (staleData.length > 0) {
    issues.push(
      `Stale data detected: ${staleData.map((c) => `${c.country.toUpperCase()} (${c.hoursOld}h old)`).join(', ')}`,
    );
  }

  if (requireSyncWorker && !syncStatus?.isRunning) {
    issues.push('Sync worker not running');
  } else if (!requireSyncWorker && !syncStatus?.isRunning && isInActivePeriod) {
    issues.push('Sync worker not running');
  }

  return issues;
}

export function buildHealthResponse({
  health,
  stats,
  syncStatus,
  requireSyncWorker = false,
  isInActivePeriod = true,
  syncExtras = {},
}) {
  const timestamp = new Date().toISOString();

  if (hasHealthError(health)) {
    const issues = collectIssues({
      health: health ?? { error: 'Unknown health status' },
      syncStatus,
      requireSyncWorker,
      isInActivePeriod,
    });
    return {
      success: false,
      timestamp,
      overallStatus: 'degraded',
      issues,
      error: health?.error ?? 'Failed to get health status',
      system: safeSystemSection(null),
      database: safeDatabaseSection(null, stats),
      sync: safeSyncSection(null, syncStatus, stats, syncExtras),
      scheduledJobs: syncStatus?.scheduledJobs ?? null,
      dataFreshness: [],
    };
  }

  const database = health.database ?? {};
  const sync = health.sync ?? {};
  const dataFreshness = Array.isArray(sync.dataFreshness) ? sync.dataFreshness : [];
  const isHealthy = database.connected === true
    && dataFreshness.every((country) => country.isRecent)
    && (!requireSyncWorker || syncStatus?.isRunning === true);

  const response = {
    success: true,
    timestamp,
    system: safeSystemSection(health.system),
    database: safeDatabaseSection(database, stats),
    sync: safeSyncSection(sync, syncStatus, stats, syncExtras),
    scheduledJobs: syncStatus?.scheduledJobs ?? null,
    dataFreshness,
    overallStatus: isHealthy ? 'healthy' : 'degraded',
    issues: collectIssues({
      health,
      syncStatus,
      requireSyncWorker,
      isInActivePeriod,
    }),
  };

  return response;
}
