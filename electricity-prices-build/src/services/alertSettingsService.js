import moment from 'moment-timezone';

export const ALERT_SETTINGS_KEY = 'alertSettings';
export const LEGACY_PRICE_SETTINGS_KEY = 'priceSettings';
export const SETTINGS_VERSION = 1;
export const DEFAULT_TIMEZONE = 'Europe/Vilnius';
export const ALERT_COUNTRIES = ['lt', 'ee', 'lv', 'fi'];

export const DEFAULT_COLOR_THRESHOLDS = {
  cheapThreshold: 20,
  expensiveThreshold: 50,
  cheapRange: 15,
  expensiveRange: 15,
};

function defaultAlertRule(value) {
  return {
    enabled: true,
    thresholdType: 'absolute',
    value,
    channels: { inApp: true, push: false },
  };
}

export function getDefaultAlertSettings() {
  return {
    version: SETTINGS_VERSION,
    timezone: DEFAULT_TIMEZONE,
    country: 'lt',
    colorThresholds: { ...DEFAULT_COLOR_THRESHOLDS },
    alerts: {
      cheap: defaultAlertRule(DEFAULT_COLOR_THRESHOLDS.cheapThreshold),
      expensive: defaultAlertRule(DEFAULT_COLOR_THRESHOLDS.expensiveThreshold),
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
    },
  };
}

function migrateLegacyPriceSettings() {
  try {
    const raw = localStorage.getItem(LEGACY_PRICE_SETTINGS_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw);
    const defaults = getDefaultAlertSettings();
    return {
      ...defaults,
      colorThresholds: {
        cheapThreshold: legacy.cheapThreshold ?? defaults.colorThresholds.cheapThreshold,
        expensiveThreshold: legacy.expensiveThreshold ?? defaults.colorThresholds.expensiveThreshold,
        cheapRange: legacy.cheapRange ?? defaults.colorThresholds.cheapRange,
        expensiveRange: legacy.expensiveRange ?? defaults.colorThresholds.expensiveRange,
      },
      alerts: {
        cheap: {
          ...defaults.alerts.cheap,
          value: legacy.cheapThreshold ?? defaults.alerts.cheap.value,
        },
        expensive: {
          ...defaults.alerts.expensive,
          value: legacy.expensiveThreshold ?? defaults.alerts.expensive.value,
        },
      },
    };
  } catch {
    return null;
  }
}

function normalizeAlertSettings(parsed) {
  const defaults = getDefaultAlertSettings();
  if (!parsed || typeof parsed !== 'object') {
    return defaults;
  }

  return {
    version: SETTINGS_VERSION,
    timezone: parsed.timezone || DEFAULT_TIMEZONE,
    country: ALERT_COUNTRIES.includes(parsed.country) ? parsed.country : defaults.country,
    colorThresholds: {
      ...defaults.colorThresholds,
      ...(parsed.colorThresholds || {}),
    },
    alerts: {
      cheap: {
        ...defaults.alerts.cheap,
        ...(parsed.alerts?.cheap || {}),
        channels: {
          ...defaults.alerts.cheap.channels,
          ...(parsed.alerts?.cheap?.channels || {}),
        },
      },
      expensive: {
        ...defaults.alerts.expensive,
        ...(parsed.alerts?.expensive || {}),
        channels: {
          ...defaults.alerts.expensive.channels,
          ...(parsed.alerts?.expensive?.channels || {}),
        },
      },
    },
    quietHours: {
      ...defaults.quietHours,
      ...(parsed.quietHours || {}),
    },
  };
}

export function loadAlertSettings() {
  try {
    const raw = localStorage.getItem(ALERT_SETTINGS_KEY);
    if (raw) {
      return normalizeAlertSettings(JSON.parse(raw));
    }
  } catch (error) {
    console.error('Error reading alert settings:', error);
  }

  const migrated = migrateLegacyPriceSettings();
  if (migrated) {
    saveAlertSettings(migrated);
    return migrated;
  }

  return getDefaultAlertSettings();
}

export function saveAlertSettings(settings) {
  const normalized = normalizeAlertSettings(settings);
  syncColorThresholdsWithAlerts(normalized);
  localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(normalized));
  writeLegacyPriceSettings(normalized.colorThresholds);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alertSettingsUpdated', { detail: normalized }));
  }
  return normalized;
}

function writeLegacyPriceSettings(colorThresholds) {
  localStorage.setItem(LEGACY_PRICE_SETTINGS_KEY, JSON.stringify(colorThresholds));
}

export function syncColorThresholdsWithAlerts(settings) {
  settings.alerts.cheap.value = settings.colorThresholds.cheapThreshold;
  settings.alerts.expensive.value = settings.colorThresholds.expensiveThreshold;
}

export function getColorThresholdSettings() {
  return { ...loadAlertSettings().colorThresholds };
}

export function saveColorThresholdSettings(colorThresholds) {
  const settings = loadAlertSettings();
  settings.colorThresholds = { ...settings.colorThresholds, ...colorThresholds };
  return saveAlertSettings(settings);
}

export function getSubscriptionMetadata(settings = loadAlertSettings()) {
  return {
    country: settings.country,
    timezone: settings.timezone,
    alerts: settings.alerts,
    quietHours: settings.quietHours,
    colorThresholds: settings.colorThresholds,
  };
}

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isInQuietHours(settings = loadAlertSettings(), at = moment.tz(DEFAULT_TIMEZONE)) {
  if (!settings.quietHours?.enabled) {
    return false;
  }

  const zone = settings.timezone || DEFAULT_TIMEZONE;
  const now = at.clone().tz(zone);
  const currentMinutes = now.hours() * 60 + now.minutes();
  const start = parseTimeToMinutes(settings.quietHours.start);
  const end = parseTimeToMinutes(settings.quietHours.end);

  if (start === end) {
    return false;
  }

  if (start < end) {
    return currentMinutes >= start && currentMinutes < end;
  }

  return currentMinutes >= start || currentMinutes < end;
}

export function shouldDeliverPush(settings = loadAlertSettings(), at = moment.tz(DEFAULT_TIMEZONE)) {
  const pushEnabled =
    settings.alerts.cheap.channels.push || settings.alerts.expensive.channels.push;
  if (!pushEnabled) {
    return false;
  }
  return !isInQuietHours(settings, at);
}
