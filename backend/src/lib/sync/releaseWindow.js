import moment from 'moment-timezone';

/** Nord Pool day-ahead prices publish window (CET/CEST). */
export const RELEASE_TIMEZONE = 'Europe/Paris';

/** User-facing display timezone for Baltic prices. */
export const DISPLAY_TIMEZONE = 'Europe/Vilnius';

/** Database timestamps are stored as UTC unix seconds. */
export const STORAGE_TIMEZONE = 'UTC';

export const RELEASE_WINDOW = {
  startHour: 12,
  startMinute: 45,
  endHour: 15,
  endMinute: 55,
};

export const DAILY_SYNC_FALLBACK_CRON = '45,0,15,30,45 12-15 * * *';
export const DAILY_SYNC_CHECK_INTERVAL_MINUTES = 5;

export function nowInReleaseTz() {
  return moment().tz(RELEASE_TIMEZONE);
}

export function nowInDisplayTz() {
  return moment().tz(DISPLAY_TIMEZONE);
}

export function getReleaseWindowBounds(now = nowInReleaseTz()) {
  const parisNow = now.clone().tz(RELEASE_TIMEZONE);
  const activeStart = parisNow
    .clone()
    .hour(RELEASE_WINDOW.startHour)
    .minute(RELEASE_WINDOW.startMinute)
    .second(0)
    .millisecond(0);
  const activeEnd = parisNow
    .clone()
    .hour(RELEASE_WINDOW.endHour)
    .minute(RELEASE_WINDOW.endMinute)
    .second(0)
    .millisecond(0);
  return { activeStart, activeEnd, now: parisNow };
}

export function isInReleaseWindow(now = nowInReleaseTz()) {
  const { activeStart, activeEnd } = getReleaseWindowBounds(now);
  return now.isBetween(activeStart, activeEnd, null, '[]');
}

export function getVilniusDayBounds(date) {
  const startOfDay = moment(date).tz(DISPLAY_TIMEZONE).startOf('day').unix();
  const endOfDay = moment(date).tz(DISPLAY_TIMEZONE).endOf('day').unix();
  return { startOfDay, endOfDay };
}

export function displayToday() {
  return nowInDisplayTz().format('YYYY-MM-DD');
}

export function displayTomorrow() {
  return nowInDisplayTz().clone().add(1, 'day').format('YYYY-MM-DD');
}

export function displayDateOffset(days) {
  return nowInDisplayTz().clone().add(days, 'day').format('YYYY-MM-DD');
}
