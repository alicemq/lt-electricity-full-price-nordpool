import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import moment from 'moment-timezone';
import axios from 'axios';
import { DISPLAY_TIMEZONE } from '../src/utils/releaseWindow.js';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../src/services/logService.js', () => ({
  logApiCall: vi.fn(),
}));

const NOW = moment.tz('2026-06-16 05:00', DISPLAY_TIMEZONE);

function buildHourlyDay(dateStr, count = 24) {
  const base = moment.tz(dateStr, DISPLAY_TIMEZONE).startOf('day');
  return Array.from({ length: count }, (_, index) => ({
    timestamp: base.clone().add(index, 'hours').unix(),
    price: 40 + index,
  }));
}

function seedCache(ltPrices) {
  const payload = {
    version: 1,
    data: { lt: ltPrices },
    lastUpdated: Date.now(),
  };
  localStorage.setItem('priceDataCache', JSON.stringify(payload));
}

describe('fetchPrices historical dates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW.toDate());
    vi.clearAllMocks();
    vi.stubGlobal('import.meta', { env: { VITE_API_BASE_URL: '/api/v1' } });
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(key) {
        return this.store[key] ?? null;
      },
      setItem(key, value) {
        this.store[key] = value;
      },
      removeItem(key) {
        delete this.store[key];
      },
    });
    localStorage.removeItem('priceDataCache');
    axios.get.mockResolvedValue({
      data: {
        success: true,
        data: { lt: buildHourlyDay('2026-06-14') },
        meta: { country: 'lt', count: 24 },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches from API when historical day has no cache', async () => {
    const { fetchPrices } = await import('../src/services/priceService.js');
    const date = moment.tz('2026-06-14', DISPLAY_TIMEZONE).startOf('day').toDate();

    const result = await fetchPrices(date, 'lt');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('nps/prices?date=2026-06-14&country=lt');
    expect(result.data.lt).toHaveLength(24);
  });

  it('fetches from API when historical day cache is incomplete', async () => {
    seedCache(buildHourlyDay('2026-06-14', 2));

    const { fetchPrices } = await import('../src/services/priceService.js');
    const date = moment.tz('2026-06-14', DISPLAY_TIMEZONE).startOf('day').toDate();

    await fetchPrices(date, 'lt');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('nps/prices?date=2026-06-14&country=lt');
  });

  it('uses complete historical cache without network', async () => {
    seedCache(buildHourlyDay('2026-06-14'));

    const { fetchPrices } = await import('../src/services/priceService.js');
    const date = moment.tz('2026-06-14', DISPLAY_TIMEZONE).startOf('day').toDate();

    const result = await fetchPrices(date, 'lt');

    expect(axios.get).not.toHaveBeenCalled();
    expect(result.meta.cached).toBe(true);
    expect(result.data.lt).toHaveLength(24);
  });

  it('skips network for tomorrow before release window when cache is empty', async () => {
    const { fetchPrices } = await import('../src/services/priceService.js');
    const date = moment.tz('2026-06-17', DISPLAY_TIMEZONE).startOf('day').toDate();

    const result = await fetchPrices(date, 'lt');

    expect(axios.get).not.toHaveBeenCalled();
    expect(result.meta.skippedNetwork).toBe(true);
    expect(result.data.lt).toEqual([]);
  });

  it('throws on network error when historical cache is incomplete', async () => {
    seedCache(buildHourlyDay('2026-06-14', 2));
    axios.get.mockRejectedValueOnce(new Error('Network Error'));

    const { fetchPrices } = await import('../src/services/priceService.js');
    const date = moment.tz('2026-06-14', DISPLAY_TIMEZONE).startOf('day').toDate();

    await expect(fetchPrices(date, 'lt')).rejects.toThrow('Network Error');
  });
});
