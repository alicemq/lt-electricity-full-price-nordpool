import moment from 'moment-timezone';

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

export function isCurrentHour(time, intervalSeconds = 3600) {
  const now = moment();
  const start = moment.unix(time);
  const end = start.clone().add(intervalSeconds, 'seconds');
  // Same calendar day and now is within [start, end)
  return now.isSame(start, 'day') && now.isBetween(start, end, null, '[)');
}
