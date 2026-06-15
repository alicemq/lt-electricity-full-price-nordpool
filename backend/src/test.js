import assert from 'node:assert/strict';
import moment from 'moment-timezone';
import {
  RELEASE_TIMEZONE,
  DISPLAY_TIMEZONE,
  getReleaseWindowBounds,
  isInReleaseWindow,
  getVilniusDayBounds,
  displayToday,
  displayTomorrow,
} from './lib/sync/releaseWindow.js';
import { getExpectedMtuRange } from './lib/sync/completeness.js';
import { shouldSuppressDailySyncForToday } from './lib/sync/suppression.js';
import { validateCronSchedule } from './lib/admin/cronValidation.js';
import {
  buildBackupFetchKey,
  resetBackupFetchGuard,
  withBackupFetchGuard,
} from './lib/prices/backupFetchGuard.js';
import {
  isSingleDateRecordCountComplete,
  needsBackupFetch,
  parseAllowBackupFlag,
  resolveBackupFetchPlan,
} from './lib/prices/backupFetchPolicy.js';
import { hashManageToken, createManageToken } from './push/tokens.js';
import { getVapidConfig, isPushConfigured } from './push/vapid.js';
import { buildHealthResponse } from './lib/healthResponse.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

test('release window uses Europe/Paris timezone', () => {
  assert.equal(RELEASE_TIMEZONE, 'Europe/Paris');
  assert.equal(DISPLAY_TIMEZONE, 'Europe/Vilnius');
});

test('release window bounds are 12:45-15:55 Paris', () => {
  const anchor = moment.tz('2026-06-15 13:00:00', RELEASE_TIMEZONE);
  const { activeStart, activeEnd } = getReleaseWindowBounds(anchor);
  assert.equal(activeStart.format('HH:mm'), '12:45');
  assert.equal(activeEnd.format('HH:mm'), '15:55');
});

test('isInReleaseWindow is true at 13:00 Paris and false at 16:00 Paris', () => {
  const inside = moment.tz('2026-06-15 13:00:00', RELEASE_TIMEZONE);
  const outside = moment.tz('2026-06-15 16:00:00', RELEASE_TIMEZONE);
  assert.equal(isInReleaseWindow(inside), true);
  assert.equal(isInReleaseWindow(outside), false);
});

test('release window uses Paris local time, not UTC wall clock', () => {
  const parisInside = moment.tz('2026-06-15 13:00:00', RELEASE_TIMEZONE);
  const utcBeforeParisRelease = moment.tz('2026-06-15 10:00:00', 'UTC');
  assert.equal(isInReleaseWindow(parisInside), true);
  assert.equal(isInReleaseWindow(utcBeforeParisRelease), false);
});

test('getVilniusDayBounds returns unix day range', () => {
  const { startOfDay, endOfDay } = getVilniusDayBounds('2026-06-15');
  assert.ok(endOfDay > startOfDay);
  assert.equal(moment.unix(startOfDay).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD'), '2026-06-15');
});

test('15-minute MTU expects 92-100 records', () => {
  const range = getExpectedMtuRange(96);
  assert.equal(range.expectedRecordsMin, 92);
  assert.equal(range.expectedRecordsMax, 100);
});

test('60-minute MTU expects 24 records by default', () => {
  const range = getExpectedMtuRange(20);
  assert.equal(range.expectedRecordsMin, 24);
  assert.equal(range.expectedRecordsMax, 24);
});

await testAsync('does not suppress when tomorrow is incomplete', async () => {
  const today = displayToday();
  const tomorrow = displayTomorrow();
  const worker = {
    dailySyncSuppressedDate: null,
    dailySyncTimeout: null,
    dailySyncNextRun: null,
    dailyScheduler: {
      dailySyncSuppressedDate: null,
      dailySyncTimeout: null,
      dailySyncNextRun: null,
    },
    isDateComplete: async (date) => ({
      isComplete: date === today,
    }),
  };

  const suppressed = await shouldSuppressDailySyncForToday(worker);
  assert.equal(suppressed, false);
});

await testAsync('suppresses only when today and tomorrow are complete', async () => {
  const today = displayToday();
  const tomorrow = displayTomorrow();
  const worker = {
    dailySyncSuppressedDate: null,
    dailySyncTimeout: setTimeout(() => {}, 10000),
    dailySyncNextRun: '2099-01-01T00:00:00.000Z',
    dailyScheduler: {
      dailySyncSuppressedDate: null,
      dailySyncTimeout: null,
      dailySyncNextRun: null,
    },
    isDateComplete: async (date) => ({
      isComplete: date === today || date === tomorrow,
    }),
  };

  const suppressed = await shouldSuppressDailySyncForToday(worker);
  assert.equal(suppressed, true);
  assert.ok(worker.dailySyncSuppressedDate);
  clearTimeout(worker.dailySyncTimeout);
});

test('validateCronSchedule accepts known weekly sync expression', () => {
  const result = validateCronSchedule('0 2 * * 0', 'Europe/Vilnius');
  assert.equal(result.valid, true);
});

test('validateCronSchedule rejects invalid cron expression', () => {
  const result = validateCronSchedule('not-a-cron', 'Europe/Vilnius');
  assert.equal(result.valid, false);
});

test('validateCronSchedule rejects invalid timezone', () => {
  const result = validateCronSchedule('0 2 * * 0', 'Not/AZone');
  assert.equal(result.valid, false);
});

test('parseAllowBackupFlag accepts explicit truthy values', () => {
  assert.equal(parseAllowBackupFlag({ allow_backup: '1' }), true);
  assert.equal(parseAllowBackupFlag({ backup: 'true' }), true);
  assert.equal(parseAllowBackupFlag({}), false);
});

test('needsBackupFetch flags empty and incomplete single-day data', () => {
  assert.equal(needsBackupFetch([], '2024-06-15'), true);
  assert.equal(needsBackupFetch([{ timestamp: 1 }], '2024-06-15'), true);
  assert.equal(needsBackupFetch(Array.from({ length: 24 }, (_, i) => ({ timestamp: i })), '2024-06-15'), false);
});

test('isSingleDateRecordCountComplete handles hourly and quarter-hour MTU', () => {
  assert.equal(isSingleDateRecordCountComplete(24), true);
  assert.equal(isSingleDateRecordCountComplete(23), true);
  assert.equal(isSingleDateRecordCountComplete(10), false);
  assert.equal(isSingleDateRecordCountComplete(96), true);
  assert.equal(isSingleDateRecordCountComplete(90), false);
});

test('resolveBackupFetchPlan skips backup during release window unless forced', () => {
  const skipped = resolveBackupFetchPlan({
    needsLiveFetch: true,
    inReleaseWindow: true,
    allowBackup: false,
  });
  assert.equal(skipped.attempt, false);
  assert.equal(skipped.reason, 'release_window');

  const forced = resolveBackupFetchPlan({
    needsLiveFetch: true,
    inReleaseWindow: true,
    allowBackup: true,
  });
  assert.equal(forced.attempt, true);
  assert.equal(forced.reason, 'explicit_flag');
});

await testAsync('withBackupFetchGuard rate-limits duplicate keys', async () => {
  resetBackupFetchGuard();
  const key = buildBackupFetchKey({ country: 'lt', date: '2024-06-15' });
  const first = await withBackupFetchGuard(key, async () => 'ok');
  assert.equal(first.status, 'fetched');
  const second = await withBackupFetchGuard(key, async () => 'again');
  assert.equal(second.status, 'rate_limited');
  resetBackupFetchGuard();
});

test('push manage token hash is deterministic', () => {
  const token = 'abc123';
  assert.equal(hashManageToken(token), hashManageToken(token));
  assert.notEqual(hashManageToken(token), hashManageToken('other'));
});

test('createManageToken returns hex string', () => {
  const token = createManageToken();
  assert.match(token, /^[0-9a-f]{48}$/);
});

test('isPushConfigured is false without VAPID env', () => {
  const prevPublic = process.env.VAPID_PUBLIC_KEY;
  const prevPrivate = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  assert.equal(isPushConfigured(), false);
  if (prevPublic) process.env.VAPID_PUBLIC_KEY = prevPublic;
  if (prevPrivate) process.env.VAPID_PRIVATE_KEY = prevPrivate;
});

test('getVapidConfig defaults subject', () => {
  const config = getVapidConfig();
  assert.equal(config.subject, 'mailto:ops@example.com');
});

test('buildHealthResponse returns degraded when system health reports error', () => {
  const response = buildHealthResponse({
    health: { error: 'ECONNREFUSED' },
    stats: { error: 'ECONNREFUSED' },
    syncStatus: { isRunning: false, scheduledJobs: null },
  });
  assert.equal(response.overallStatus, 'degraded');
  assert.equal(response.success, false);
  assert.equal(response.system.uptime, 'unknown');
  assert.ok(response.issues.some((issue) => issue.includes('ECONNREFUSED')));
  assert.ok(response.issues.some((issue) => issue.includes('Database connection failed')));
});

test('buildHealthResponse guards missing nested health fields', () => {
  const response = buildHealthResponse({
    health: { database: { connected: false }, sync: {}, system: {} },
    stats: { error: 'unavailable' },
    syncStatus: { isRunning: true, scheduledJobs: [] },
  });
  assert.equal(response.overallStatus, 'degraded');
  assert.equal(response.success, true);
  assert.deepEqual(response.dataFreshness, []);
  assert.ok(response.issues.includes('Database connection failed'));
});

console.log(`\nTest results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
