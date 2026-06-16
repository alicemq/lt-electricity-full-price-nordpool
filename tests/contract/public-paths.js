/**
 * Public API routes (no AdminToken). Canonical list for UA3 contract sample coverage.
 * Admin routes (/admin/*) and push admin are excluded.
 */

/** @typedef {{ path: string, operationId: string, markers?: string[] }} PublicGetPath */

/** @type {PublicGetPath[]} */
export const PUBLIC_GET_PATHS = [
  { path: '/health', operationId: 'getHealth', markers: ['success', 'overallStatus'] },
  { path: '/ready', operationId: 'getReady', markers: ['status', 'checks'] },
  { path: '/countries', operationId: 'getCountries', markers: ['success', 'data'] },
  { path: '/nps/price/{country}/latest', operationId: 'getNpsPriceCountryLatest', markers: ['data', 'meta'] },
  { path: '/nps/price/{country}/current', operationId: 'getNpsPriceCountryCurrent', markers: ['data', 'meta'] },
  { path: '/nps/prices', operationId: 'getNpsPrices', markers: ['success', 'meta'] },
  { path: '/nps/prices/upcoming', operationId: 'getNpsPricesUpcoming', markers: ['success', 'data'] },
  { path: '/latest', operationId: 'getLatest', markers: ['success', 'data'] },
  { path: '/prices', operationId: 'getPrices' },
  { path: '/settings', operationId: 'getSettings' },
  { path: '/configurations', operationId: 'getConfigurations', markers: ['success', 'data'] },
  { path: '/sync/status', operationId: 'getSyncStatus', markers: ['success', 'isRunning'] },
  { path: '/sync/initial-status', operationId: 'getSyncInitial-status', markers: ['success', 'isComplete'] },
  { path: '/sync/date-complete/{date}', operationId: 'getSyncDate-completeDate', markers: ['success', 'data'] },
  { path: '/sync/recent-completeness', operationId: 'getSyncRecent-completeness', markers: ['success', 'needsSync'] },
  { path: '/push/vapid-public', operationId: 'getPushVapid-public' },
  { path: '/push/status', operationId: 'getPushStatus' },
];

/** @type {{ path: string, method: string, operationId: string }[]} */
export const PUBLIC_WRITE_PATHS = [
  { path: '/settings/{key}', method: 'put', operationId: 'putSettingsKey' },
  { path: '/sync/trigger', method: 'post', operationId: 'postSyncTrigger' },
  { path: '/sync/historical', method: 'post', operationId: 'postSyncHistorical' },
  { path: '/sync/year', method: 'post', operationId: 'postSyncYear' },
  { path: '/sync/years', method: 'post', operationId: 'postSyncYears' },
  { path: '/sync/all-historical', method: 'post', operationId: 'postSyncAll-historical' },
  { path: '/sync/efficient', method: 'post', operationId: 'postSyncEfficient' },
  { path: '/sync/all-countries-historical', method: 'post', operationId: 'postSyncAll-countries-historical' },
  { path: '/sync/all-countries-all-historical', method: 'post', operationId: 'postSyncAll-countries-all-historical' },
  { path: '/sync/reset-initial', method: 'post', operationId: 'postSyncReset-initial' },
  { path: '/push/subscribe', method: 'post', operationId: 'postPushSubscribe' },
  { path: '/push/subscribe', method: 'delete', operationId: 'deletePushSubscribe' },
  { path: '/push/test', method: 'post', operationId: 'postPushTest' },
];
