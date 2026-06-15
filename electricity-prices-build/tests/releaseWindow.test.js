import { describe, it, expect } from 'vitest';
import moment from 'moment-timezone';
import {
  shouldFetchFutureData,
  isCurrentDisplayDay,
  getTargetReleaseDay,
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
});
