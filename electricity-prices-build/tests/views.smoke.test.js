import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import moment from 'moment-timezone';

const mockPrices = {
  success: true,
  data: {
    lt: [
      { timestamp: moment.tz('2024-06-15 00:00', 'Europe/Vilnius').unix(), price: 45.5 },
      { timestamp: moment.tz('2024-06-15 01:00', 'Europe/Vilnius').unix(), price: 42.1 },
      { timestamp: moment.tz('2024-06-15 02:00', 'Europe/Vilnius').unix(), price: 40.0 },
    ],
  },
  meta: { country: 'lt', count: 3, timezone: 'Europe/Vilnius' },
};

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

vi.mock('vue-router', () => ({
  useRoute: () => ({
    meta: {
      title: { lt: 'Today', en: 'Today' },
      description: { lt: 'Desc', en: 'Desc' },
    },
    path: '/today',
    fullPath: '/today',
    query: {},
  }),
}));

vi.mock('../src/services/priceService.js', () => ({
  fetchPrices: vi.fn(async () => mockPrices),
  fetchUpcomingPrices: vi.fn(async () => mockUpcoming),
  onPricesUpdated: vi.fn(() => () => {}),
  runSmartSync: vi.fn(async () => {}),
}));

vi.mock('../src/services/priceCalculationService.js', () => ({
  calculatePrice: vi.fn((row) => row.price / 10),
  logAllPriceBreakdowns: vi.fn(),
  getTimePeriod: vi.fn(() => 'day'),
}));

vi.mock('../src/utils/seo.js', () => ({
  setSEO: vi.fn(),
  buildRouteStructuredData: vi.fn(() => ({})),
  generatePriceDataStructuredData: vi.fn(() => ({})),
}));

vi.mock('../src/i18n.js', () => ({
  default: {
    global: {
      locale: { value: 'lt' },
      t: (key) => key,
    },
  },
}));

describe('TodayView smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('renders price rows from mocked API', async () => {
    const TodayView = (await import('../src/views/TodayView.vue')).default;
    const wrapper = mount(TodayView, {
      global: {
        stubs: {
          VueDatePicker: true,
          PriceTable: {
            template: '<div class="price-table-stub">{{ priceData.length }}</div>',
            props: ['priceData'],
          },
        },
        mocks: { $t: (key) => key },
      },
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('.price-table-stub').text()).toBe('3');
  });
});

describe('UpcomingPricesView smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('renders upcoming rows from mocked API', async () => {
    const UpcomingPricesView = (await import('../src/views/UpcomingPricesView.vue')).default;
    const wrapper = mount(UpcomingPricesView, {
      global: {
        stubs: {
          PriceTable: {
            template: '<div class="price-table-stub">{{ priceData.length }}</div>',
            props: ['priceData'],
          },
        },
        mocks: { $t: (key) => key },
      },
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('.price-table-stub').text()).toBe('3');
  });
});
