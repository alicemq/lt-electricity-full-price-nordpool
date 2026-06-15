import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import moment from 'moment-timezone';
import { encodeLayout } from '../src/lib/layoutCodec.js';

const mockUpcoming = {
  success: true,
  data: {
    lt: [
      { timestamp: moment.tz('2024-06-15 12:00', 'Europe/Vilnius').unix(), price: 55.0 },
      { timestamp: moment.tz('2024-06-15 13:00', 'Europe/Vilnius').unix(), price: 58.2 },
      { timestamp: moment.tz('2024-06-15 14:00', 'Europe/Vilnius').unix(), price: 51.3 },
    ],
  },
  meta: { country: 'lt', count: 3, timezone: 'Europe/Vilnius' },
};

let routeQuery = {};
let routeMeta = { kiosk: true };

vi.mock('vue-router', () => ({
  useRoute: () => ({
    meta: routeMeta,
    query: routeQuery,
  }),
}));

vi.mock('../src/services/priceService.js', () => ({
  fetchPrices: vi.fn(async () => mockUpcoming),
  fetchUpcomingPrices: vi.fn(async () => mockUpcoming),
  onPricesUpdated: vi.fn(() => () => {}),
  runSmartSync: vi.fn(async () => {}),
}));

vi.mock('../src/services/priceCalculationService.js', () => ({
  calculatePrice: vi.fn((row) => row.price / 10),
  logAllPriceBreakdowns: vi.fn(),
  getTimePeriod: vi.fn(() => 'day'),
}));

describe('DisplayView smoke', () => {
  beforeEach(() => {
    routeQuery = {};
    routeMeta = { kiosk: true };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('shows friendly error when layout param is missing', async () => {
    const DisplayView = (await import('../src/views/DisplayView.vue')).default;
    const wrapper = mount(DisplayView, {
      global: {
        mocks: { $t: (key) => key },
      },
    });
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('display.invalidTitle');
  });

  it('renders table panel from encoded layout', async () => {
    routeQuery = { layout: encodeLayout({ v: 1, panel: 'table', source: 'upcoming' }) };

    const DisplayView = (await import('../src/views/DisplayView.vue')).default;
    const wrapper = mount(DisplayView, {
      global: {
        stubs: {
          PriceTable: {
            template: '<div class="price-table-stub">{{ priceData.length }}</div>',
            props: ['priceData', 'allPriceData'],
          },
          DisplayChartPanel: true,
        },
        mocks: { $t: (key) => key },
      },
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('.price-table-stub').text()).toBe('3');
  });
});
