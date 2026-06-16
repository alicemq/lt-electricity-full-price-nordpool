import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import moment from 'moment-timezone';
import PriceTable from '../src/components/PriceTable.vue';

vi.mock('../src/services/timeService.js', () => ({
  formatPriceHours: vi.fn((ts) => String(ts)),
  isCurrentHour: vi.fn(() => false),
}));

vi.mock('../src/services/priceCalculationService.js', () => ({
  calculatePrice: vi.fn((row) => row.price / 10),
  getTimePeriod: vi.fn(() => 'day'),
}));

vi.mock('../src/services/alertSettingsService.js', () => ({
  getColorThresholdSettings: vi.fn(() => ({
    cheapRange: 10,
    expensiveRange: 10,
    absoluteCheap: 0,
    absoluteExpensive: 999,
  })),
}));

vi.mock('../src/utils/priceColor.js', () => ({
  getPriceClass: vi.fn(() => ({ classes: '' })),
}));

const hourlyRows = (count, basePrice = 45) =>
  Array.from({ length: count }, (_, index) => ({
    timestamp: moment.tz('2024-06-15 00:00', 'Europe/Vilnius').add(index, 'hours').unix(),
    price: basePrice + index,
  }));

describe('PriceTable empty state', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('shows historical empty message for past selected dates', () => {
    const wrapper = mount(PriceTable, {
      props: { priceData: [], selectedDate: '2026-06-14' },
      global: { mocks: { $t: (key) => key } },
    });

    expect(wrapper.find('.alert-warning').exists()).toBe(true);
    expect(wrapper.text()).toContain('table.noDataHistorical');
  });

  it('shows release-window message when no selected date is provided', () => {
    const wrapper = mount(PriceTable, {
      props: { priceData: [] },
      global: { mocks: { $t: (key) => key } },
    });

    expect(wrapper.text()).toContain('table.noData');
    expect(wrapper.text()).not.toContain('table.noDataHistorical');
  });

  it('shows average badge when enough hourly rows exist', () => {
    const wrapper = mount(PriceTable, {
      props: { priceData: hourlyRows(3) },
      global: { mocks: { $t: (key) => key } },
    });

    expect(wrapper.find('.alert-warning').exists()).toBe(false);
    expect(wrapper.find('table.table').exists()).toBe(true);
    expect(wrapper.find('.badge.bg-primary').exists()).toBe(true);
    expect(wrapper.findAll('tbody tr').length).toBe(3);
  });
});
