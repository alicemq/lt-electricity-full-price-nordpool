import moment from 'moment-timezone';
import { DISPLAY_TIMEZONE, getVilniusDayBounds } from './releaseWindow.js';

export const SUPPORTED_COUNTRIES = ['lt', 'ee', 'lv', 'fi'];

/**
 * Expected hourly MTU counts for a Vilnius calendar day (handles DST).
 */
export function getExpectedMtuRange(totalCount, intervalSamples = []) {
  let expectedRecordsMin = 24;
  let expectedRecordsMax = 24;

  if (totalCount >= 90) {
    expectedRecordsMin = 92;
    expectedRecordsMax = 100;
  } else if (totalCount > 0 && intervalSamples.length >= 2) {
    const intervals = [];
    for (let i = 1; i < intervalSamples.length; i++) {
      const diff = intervalSamples[i] - intervalSamples[i - 1];
      if (diff > 0) {
        intervals.push(diff);
      }
    }

    const mostCommonInterval = intervals.length > 0 ? intervals[0] : null;
    if (mostCommonInterval === 900) {
      expectedRecordsMin = 92;
      expectedRecordsMax = 100;
    } else if (mostCommonInterval === 3600) {
      expectedRecordsMin = 23;
      expectedRecordsMax = 25;
    }
  }

  return { expectedRecordsMin, expectedRecordsMax };
}

export async function isDateComplete(date, pool) {
  try {
    const { startOfDay, endOfDay } = getVilniusDayBounds(date);

    const countResult = await pool.query(
      `
        SELECT COUNT(*) as total_count
        FROM price_data
        WHERE timestamp BETWEEN $1 AND $2
      `,
      [startOfDay, endOfDay]
    );

    const totalCount = countResult.rows[0]
      ? parseInt(countResult.rows[0].total_count, 10)
      : 0;

    let intervalSamples = [];
    if (totalCount > 0 && totalCount < 90) {
      const intervalResult = await pool.query(
        `
          SELECT timestamp
          FROM price_data
          WHERE timestamp BETWEEN $1 AND $2
          ORDER BY timestamp
          LIMIT 10
        `,
        [startOfDay, endOfDay]
      );
      intervalSamples = intervalResult.rows.map((row) => row.timestamp);
    }

    const { expectedRecordsMin, expectedRecordsMax } = getExpectedMtuRange(
      totalCount,
      intervalSamples
    );

    const result = await pool.query(
      `
        SELECT country, COUNT(*) as record_count
        FROM price_data
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY country
        ORDER BY country
      `,
      [startOfDay, endOfDay]
    );

    const countryCounts = {};
    SUPPORTED_COUNTRIES.forEach((country) => {
      countryCounts[country] = 0;
    });

    result.rows.forEach((row) => {
      countryCounts[row.country] = parseInt(row.record_count, 10);
    });

    const isComplete = SUPPORTED_COUNTRIES.every((country) => {
      const count = countryCounts[country];
      return count >= expectedRecordsMin && count <= expectedRecordsMax;
    });

    console.log(
      `[Date Complete Check] ${date}: ${JSON.stringify(countryCounts)} (expected: ${expectedRecordsMin}-${expectedRecordsMax}) - Complete: ${isComplete}`
    );

    return {
      isComplete,
      countryCounts,
      date,
      expectedRecordsMin,
      expectedRecordsMax,
    };
  } catch (error) {
    console.error(`[Date Complete Check] Error checking completeness for ${date}:`, error.message);
    return {
      isComplete: false,
      countryCounts: {},
      date,
      error: error.message,
    };
  }
}

export async function findIncompleteDates(pool, startDate, endDate) {
  const incomplete = [];
  let current = moment(startDate).tz(DISPLAY_TIMEZONE).startOf('day');
  const end = moment(endDate).tz(DISPLAY_TIMEZONE).startOf('day');

  while (current.isSameOrBefore(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const status = await isDateComplete(dateStr, pool);
    if (!status.isComplete) {
      incomplete.push(dateStr);
    }
    current.add(1, 'day');
  }

  return incomplete;
}
