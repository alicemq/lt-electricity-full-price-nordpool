import moment from 'moment-timezone';
import { DISPLAY_TIMEZONE } from '../utils/releaseWindow';

export function inferIntervalSecondsFromPrices(prices) {
  if (!prices || prices.length < 2) {
    return 3600;
  }
  const diff = prices[1].timestamp - prices[0].timestamp;
  return diff > 0 ? diff : 3600;
}

/**
 * Whether a price slot is the active MTU or starts in the future (Vilnius display TZ).
 */
export function isCurrentOrFutureSlot(
  timestamp,
  intervalSeconds = 3600,
  now = moment(),
  timezone = DISPLAY_TIMEZONE,
) {
  const nowLocal = now.clone().tz(timezone);
  const start = moment.unix(timestamp).tz(timezone);
  const end = start.clone().add(intervalSeconds, 'seconds');
  const isCurrentSlot = start.isSameOrBefore(nowLocal) && end.isAfter(nowLocal);
  const isFutureSlot = start.isAfter(nowLocal);
  return isCurrentSlot || isFutureSlot;
}

/**
 * Keep the active MTU slot plus all future slots for the day (matches backend /upcoming).
 */
export function filterUpcomingSlots(
  prices,
  intervalSeconds,
  now = moment(),
  timezone = DISPLAY_TIMEZONE,
) {
  if (!prices || prices.length === 0) {
    return [];
  }
  const interval = intervalSeconds ?? inferIntervalSecondsFromPrices(prices);
  return prices
    .filter((price) => isCurrentOrFutureSlot(price.timestamp, interval, now, timezone))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function formatPriceHours(time, intervalSeconds = 3600) {
  const start = moment.unix(time);
  const end = start.clone().add(intervalSeconds, 'seconds');
  const hour = start.format('HH');
  const minute = start.format('mm');
  const nextHour = end.format('HH');
  const nextMinute = end.format('mm');
  return `${hour}<sup>${minute}</sup> - ${nextHour}<sup>${nextMinute}</sup>`;
}

/**
 * Returns the local date and time from a timestamp in a readable format
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted local date and time
 */
export function formatLocalTime(timestamp) {
  // Convert Unix timestamp (seconds) to milliseconds
  const date = new Date(timestamp * 1000);
  
  return date.toLocaleDateString([], { 
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  }) + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export function isCurrentHour(time, intervalSeconds = 3600, timezone = DISPLAY_TIMEZONE) {
  const now = moment().tz(timezone);
  const start = moment.unix(time).tz(timezone);
  const end = start.clone().add(intervalSeconds, 'seconds');
  return now.isSame(start, 'day') && now.isBetween(start, end, null, '[)');
}
