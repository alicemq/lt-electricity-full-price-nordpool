import moment from 'moment-timezone';

/** Nord Pool release window uses Europe/Paris (CET/CEST), aligned with backend syncWorker */
export const RELEASE_TIMEZONE = 'Europe/Paris';
export const DISPLAY_TIMEZONE = 'Europe/Vilnius';

export const RELEASE_WINDOW_START = { hour: 12, minute: 45 };
export const RELEASE_WINDOW_END = { hour: 15, minute: 55 };

export const RELEASE_PHASE = {
  BEFORE: 'before',
  DURING: 'during',
  AFTER: 'after',
};

/**
 * @param {import('moment').Moment} [now]
 */
export function getReleaseWindowBounds(now = moment()) {
  const nowParis = now.clone().tz(RELEASE_TIMEZONE);
  const start = nowParis
    .clone()
    .hour(RELEASE_WINDOW_START.hour)
    .minute(RELEASE_WINDOW_START.minute)
    .second(0)
    .millisecond(0);
  const end = nowParis
    .clone()
    .hour(RELEASE_WINDOW_END.hour)
    .minute(RELEASE_WINDOW_END.minute)
    .second(0)
    .millisecond(0);
  return { start, end, nowParis };
}

/**
 * @param {import('moment').Moment} [now]
 * @returns {'before'|'during'|'after'}
 */
export function getReleasePhase(now = moment()) {
  const { start, end, nowParis } = getReleaseWindowBounds(now);
  if (nowParis.isBefore(start)) {
    return RELEASE_PHASE.BEFORE;
  }
  if (nowParis.isBetween(start, end, null, '[]')) {
    return RELEASE_PHASE.DURING;
  }
  return RELEASE_PHASE.AFTER;
}

/**
 * Calendar day (Vilnius) whose next-day prices are published during the current release window.
 * @param {import('moment').Moment} [now]
 */
export function getTargetReleaseDay(now = moment()) {
  return now.clone().tz(DISPLAY_TIMEZONE).add(1, 'day').format('YYYY-MM-DD');
}

/**
 * Milliseconds until the next release window opens (12:45 Europe/Paris).
 * @param {import('moment').Moment} [now]
 */
export function getMsUntilNextWindowStart(now = moment()) {
  const nowParis = now.clone().tz(RELEASE_TIMEZONE);
  let nextStart = nowParis
    .clone()
    .hour(RELEASE_WINDOW_START.hour)
    .minute(RELEASE_WINDOW_START.minute)
    .second(0)
    .millisecond(0);
  if (nowParis.isSameOrAfter(nextStart)) {
    nextStart = nextStart.add(1, 'day');
  }
  return Math.max(nextStart.diff(nowParis), 0);
}

/**
 * Milliseconds until the current release window ends, or 0 if not in window.
 * @param {import('moment').Moment} [now]
 */
export function getMsUntilWindowEnd(now = moment()) {
  const { end, nowParis } = getReleaseWindowBounds(now);
  if (nowParis.isAfter(end)) {
    return 0;
  }
  return Math.max(end.diff(nowParis), 0);
}

/**
 * Recommended background poll interval for the current phase (ms).
 * Callers MAY lengthen this when post-window sync is already complete.
 * @param {import('moment').Moment} [now]
 */
export function getSyncPollIntervalMs(now = moment()) {
  const phase = getReleasePhase(now);
  switch (phase) {
    case RELEASE_PHASE.DURING:
      return 60 * 1000;
    case RELEASE_PHASE.AFTER:
      return 5 * 60 * 1000;
    case RELEASE_PHASE.BEFORE:
    default:
      return getMsUntilNextWindowStart(now);
  }
}

/**
 * Whether the requested date is the current calendar day in Vilnius.
 * @param {Date|string|import('moment').Moment} date
 * @param {import('moment').Moment} [now]
 */
export function isCurrentDisplayDay(date, now = moment()) {
  const nowVilnius = now.clone().tz(DISPLAY_TIMEZONE);
  return moment(date).tz(DISPLAY_TIMEZONE).isSame(nowVilnius, 'day');
}

/**
 * Whether a network fetch for today/future data is allowed in the current phase.
 * Historical dates are always allowed via {@link isHistoricalDate}.
 * Today's prices were published in a prior release window and are always fetchable.
 * @param {Date|string|import('moment').Moment} date
 * @param {import('moment').Moment} [now]
 */
export function shouldFetchFutureData(date, now = moment()) {
  if (isCurrentDisplayDay(date, now)) {
    return true;
  }

  const phase = getReleasePhase(now);
  if (phase === RELEASE_PHASE.DURING) {
    return true;
  }
  if (phase === RELEASE_PHASE.AFTER) {
    const targetDay = getTargetReleaseDay(now);
    const requestedDay = moment(date).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
    return requestedDay === targetDay;
  }
  return false;
}

/**
 * Parse any date input to the start of that calendar day in Vilnius.
 * @param {Date|string|import('moment').Moment} date
 */
export function toDisplayDayMoment(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return moment.tz(date, DISPLAY_TIMEZONE).startOf('day');
  }
  return moment(date).tz(DISPLAY_TIMEZONE).startOf('day');
}

/**
 * @param {Date|string|import('moment').Moment} date
 */
export function formatDisplayDateString(date) {
  return toDisplayDayMoment(date).format('YYYY-MM-DD');
}

/**
 * @param {Date|string|import('moment').Moment} date
 * @param {import('moment').Moment} [now]
 */
export function isHistoricalDate(date, now = moment()) {
  const nowVilnius = now.clone().tz(DISPLAY_TIMEZONE);
  return toDisplayDayMoment(date).isBefore(nowVilnius, 'day');
}
