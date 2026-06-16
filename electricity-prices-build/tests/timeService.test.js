import { describe, it, expect, vi, afterEach } from 'vitest';
import moment from 'moment-timezone';
import {
  filterUpcomingSlots,
  isCurrentOrFutureSlot,
  isCurrentHour,
} from '../src/services/timeService.js';
import { DISPLAY_TIMEZONE } from '../src/utils/releaseWindow.js';

const INTERVAL_15_MIN = 900;

function mtuSlotsForDay(dateStr, count = 8) {
  const start = moment.tz(`${dateStr} 03:00`, DISPLAY_TIMEZONE);
  return Array.from({ length: count }, (_, index) => ({
    timestamp: start.clone().add(index * 15, 'minutes').unix(),
    price: 40 + index,
  }));
}

describe('filterUpcomingSlots', () => {
  it('includes the active 15-min slot at 03:48 Vilnius', () => {
    const now = moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE);
    const slots = mtuSlotsForDay('2026-06-16');
    const filtered = filterUpcomingSlots(slots, INTERVAL_15_MIN, now);

    expect(filtered.map((row) => moment.unix(row.timestamp).tz(DISPLAY_TIMEZONE).format('HH:mm'))).toEqual([
      '03:45',
      '04:00',
      '04:15',
      '04:30',
      '04:45',
    ]);
  });

  it('excludes past slots before the active MTU boundary', () => {
    const now = moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE);
    const slots = mtuSlotsForDay('2026-06-16');
    const filtered = filterUpcomingSlots(slots, INTERVAL_15_MIN, now);

    expect(filtered.some((row) => moment.unix(row.timestamp).tz(DISPLAY_TIMEZONE).format('HH:mm') === '03:30')).toBe(false);
    expect(filtered.some((row) => moment.unix(row.timestamp).tz(DISPLAY_TIMEZONE).format('HH:mm') === '03:45')).toBe(true);
  });

  it('includes the active hourly slot at 14:30 Vilnius', () => {
    const now = moment.tz('2026-06-16 14:30', DISPLAY_TIMEZONE);
    const slots = Array.from({ length: 4 }, (_, index) => ({
      timestamp: moment.tz('2026-06-16 14:00', DISPLAY_TIMEZONE).add(index, 'hours').unix(),
      price: 50,
    }));
    const filtered = filterUpcomingSlots(slots, 3600, now);

    expect(filtered.map((row) => moment.unix(row.timestamp).tz(DISPLAY_TIMEZONE).format('HH:mm'))).toEqual([
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]);
  });
});

describe('isCurrentOrFutureSlot', () => {
  it('treats the slot containing now as current', () => {
    const now = moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE);
    const currentStart = moment.tz('2026-06-16 03:45', DISPLAY_TIMEZONE).unix();

    expect(isCurrentOrFutureSlot(currentStart, INTERVAL_15_MIN, now)).toBe(true);
  });

  it('treats earlier slots as neither current nor future', () => {
    const now = moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE);
    const pastStart = moment.tz('2026-06-16 03:30', DISPLAY_TIMEZONE).unix();

    expect(isCurrentOrFutureSlot(pastStart, INTERVAL_15_MIN, now)).toBe(false);
  });
});

describe('isCurrentHour', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses Vilnius timezone for the active slot', () => {
    const slotStart = moment.tz('2026-06-16 03:45', DISPLAY_TIMEZONE).unix();
    vi.useFakeTimers();
    vi.setSystemTime(moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE).toDate());

    expect(isCurrentHour(slotStart, INTERVAL_15_MIN, DISPLAY_TIMEZONE)).toBe(true);
  });
});
