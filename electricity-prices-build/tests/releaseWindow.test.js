import { describe, it, expect } from 'vitest';
import moment from 'moment-timezone';
import {
  shouldFetchFutureData,
  isCurrentDisplayDay,
  isHistoricalDate,
  getTargetReleaseDay,
  toDisplayDayMoment,
  DISPLAY_TIMEZONE,
} from '../src/utils/releaseWindow.js';

describe('shouldFetchFutureData', () => {
  it('allows fetching the current Vilnius calendar day in every phase', () => {
    const now = moment.tz('2026-06-16 00:30', DISPLAY_TIMEZONE);
    const today = now.clone().startOf('day').toDate();

    expect(isCurrentDisplayDay(today, now)).toBe(true);
    expect(shouldFetchFutureData(today, now)).toBe(true);
  });

  it('allows tomorrow only after release window on the target day', () => {
    const now = moment.tz('2026-06-16 00:30', DISPLAY_TIMEZONE);
    const tomorrow = now.clone().add(1, 'day').startOf('day').toDate();
    const targetDay = getTargetReleaseDay(now);

    expect(moment(tomorrow).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD')).toBe(targetDay);
    expect(shouldFetchFutureData(tomorrow, now)).toBe(true);
  });

  it('blocks day-after-tomorrow before release window', () => {
    const now = moment.tz('2026-06-16 00:30', DISPLAY_TIMEZONE);
    const dayAfterTomorrow = now.clone().add(2, 'day').startOf('day').toDate();

    expect(shouldFetchFutureData(dayAfterTomorrow, now)).toBe(false);
  });

  it('parses YYYY-MM-DD strings in Vilnius timezone', () => {
    const day = toDisplayDayMoment('2026-06-14');
    expect(day.format('YYYY-MM-DD HH:mm:ss Z')).toBe('2026-06-14 00:00:00 +03:00');
    expect(isHistoricalDate('2026-06-14', moment.tz('2026-06-16', DISPLAY_TIMEZONE))).toBe(true);
  });
});
