import { describe, it, expect, beforeEach, vi } from 'vitest';
import moment from 'moment-timezone';
import {
  ALERT_SETTINGS_KEY,
  LEGACY_PRICE_SETTINGS_KEY,
  getDefaultAlertSettings,
  loadAlertSettings,
  saveAlertSettings,
  isInQuietHours,
  shouldDeliverPush,
  getSubscriptionMetadata,
} from '../src/services/alertSettingsService.js';

describe('alertSettingsService', () => {
  let store;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete store[key];
      }),
    });
  });

  it('returns defaults when storage is empty', () => {
    const settings = loadAlertSettings();
    expect(settings.country).toBe('lt');
    expect(settings.colorThresholds.cheapThreshold).toBe(20);
    expect(settings.alerts.cheap.channels.inApp).toBe(true);
    expect(settings.quietHours.enabled).toBe(true);
  });

  it('migrates legacy priceSettings into alertSettings', () => {
    store[LEGACY_PRICE_SETTINGS_KEY] = JSON.stringify({
      cheapThreshold: 12,
      expensiveThreshold: 88,
      cheapRange: 10,
      expensiveRange: 20,
    });

    const settings = loadAlertSettings();
    expect(settings.colorThresholds.cheapThreshold).toBe(12);
    expect(settings.alerts.cheap.value).toBe(12);
    expect(store[ALERT_SETTINGS_KEY]).toBeTruthy();
  });

  it('keeps alert thresholds aligned with color thresholds on save', () => {
    const settings = getDefaultAlertSettings();
    settings.colorThresholds.cheapThreshold = 5;
    settings.colorThresholds.expensiveThreshold = 95;
    saveAlertSettings(settings);

    const loaded = loadAlertSettings();
    expect(loaded.alerts.cheap.value).toBe(5);
    expect(loaded.alerts.expensive.value).toBe(95);
    expect(JSON.parse(store[LEGACY_PRICE_SETTINGS_KEY]).cheapThreshold).toBe(5);
  });

  it('detects quiet hours within same-day window', () => {
    const settings = getDefaultAlertSettings();
    settings.quietHours = { enabled: true, start: '22:00', end: '23:00' };
    const inside = moment.tz('2024-06-15 22:30', 'Europe/Vilnius');
    const outside = moment.tz('2024-06-15 21:30', 'Europe/Vilnius');
    expect(isInQuietHours(settings, inside)).toBe(true);
    expect(isInQuietHours(settings, outside)).toBe(false);
  });

  it('detects quiet hours across midnight', () => {
    const settings = getDefaultAlertSettings();
    settings.quietHours = { enabled: true, start: '22:00', end: '07:00' };
    const lateNight = moment.tz('2024-06-15 23:30', 'Europe/Vilnius');
    const earlyMorning = moment.tz('2024-06-15 06:30', 'Europe/Vilnius');
    const midday = moment.tz('2024-06-15 12:00', 'Europe/Vilnius');
    expect(isInQuietHours(settings, lateNight)).toBe(true);
    expect(isInQuietHours(settings, earlyMorning)).toBe(true);
    expect(isInQuietHours(settings, midday)).toBe(false);
  });

  it('blocks push delivery during quiet hours when push enabled', () => {
    const settings = getDefaultAlertSettings();
    settings.alerts.cheap.channels.push = true;
    settings.quietHours = { enabled: true, start: '22:00', end: '07:00' };
    const quiet = moment.tz('2024-06-15 23:00', 'Europe/Vilnius');
    const active = moment.tz('2024-06-15 12:00', 'Europe/Vilnius');
    expect(shouldDeliverPush(settings, quiet)).toBe(false);
    expect(shouldDeliverPush(settings, active)).toBe(true);
  });

  it('exports subscription metadata for server sync', () => {
    const settings = getDefaultAlertSettings();
    settings.country = 'ee';
    const metadata = getSubscriptionMetadata(settings);
    expect(metadata.country).toBe('ee');
    expect(metadata.alerts.cheap.channels).toEqual({ inApp: true, push: false });
    expect(metadata.timezone).toBe('Europe/Vilnius');
  });
});
