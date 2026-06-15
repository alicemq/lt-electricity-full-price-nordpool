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

console.log(`\nTest results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
