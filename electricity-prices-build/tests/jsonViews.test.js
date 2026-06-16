import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import moment from 'moment-timezone';
import { DISPLAY_TIMEZONE } from '../src/utils/releaseWindow.js';

const INTERVAL_15_MIN = 900;

function mtuSlotsForDay(dateStr, count = 6) {
  const start = moment.tz(`${dateStr} 03:00`, DISPLAY_TIMEZONE);
  return Array.from({ length: count }, (_, index) => ({
    timestamp: start.clone().add(index * 15, 'minutes').unix(),
    price: 40 + index,
  }));
}

const todaySlots = mtuSlotsForDay('2026-06-16');
const tomorrowSlots = Array.from({ length: 4 }, (_, index) => ({
  timestamp: moment.tz('2026-06-17 10:00', DISPLAY_TIMEZONE).add(index * 15, 'minutes').unix(),
  price: 50 + index,
}));

vi.mock('../src/services/priceService.js', () => ({
  fetchPrices: vi.fn(async (date) => {
    const day = moment(date).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
    const slots = day === '2026-06-16' ? todaySlots : tomorrowSlots;
    return {
      success: true,
      data: { lt: slots },
      meta: { country: 'lt', count: slots.length, timezone: DISPLAY_TIMEZONE },
    };
  }),
}));

vi.mock('../src/services/priceCalculationService.js', () => ({
  calculatePrice: vi.fn((row) => row.price),
}));

vi.mock('../src/services/alertSettingsService.js', () => ({
  getColorThresholdSettings: vi.fn(() => ({
    cheapThreshold: 20,
    expensiveThreshold: 50,
    cheapRange: 15,
    expensiveRange: 15,
  })),
}));

vi.mock('../src/utils/priceColor.js', () => ({
  getPriceClass: vi.fn(() => ({ classes: '' })),
}));

function parseViewJson(wrapper) {
  const text = wrapper.find('pre').text();
  return JSON.parse(text);
}

function slotLabel(timestamp) {
  return moment.unix(timestamp).tz(DISPLAY_TIMEZONE).format('HH:mm');
}

describe('JsonPriceView upcoming filter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE).toDate());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes the active 15-min MTU slot in today prices', async () => {
    const JsonPriceView = (await import('../src/views/JsonPriceView.vue')).default;
    const wrapper = mount(JsonPriceView);
    await flushPromises();
    await flushPromises();

    const payload = parseViewJson(wrapper);
    const labels = payload.prices.map((row) => slotLabel(row.timestamp));

    expect(labels).toContain('03:45');
    expect(labels).not.toContain('03:30');
  });
});

describe('JsonFuturePriceView upcoming filter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(moment.tz('2026-06-16 03:48', DISPLAY_TIMEZONE).toDate());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes the active 15-min MTU slot in today prices', async () => {
    const JsonFuturePriceView = (await import('../src/views/JsonFuturePriceView.vue')).default;
    const wrapper = mount(JsonFuturePriceView);
    await flushPromises();
    await flushPromises();

    const payload = parseViewJson(wrapper);
    const labels = payload.prices.map((row) => slotLabel(row.timestamp));

    expect(labels).toContain('03:45');
    expect(labels).not.toContain('03:30');
  });
});
