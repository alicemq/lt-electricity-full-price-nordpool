<script setup>
import { ref, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import PriceSettings from '../components/PriceSettings.vue';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import SyncDebugPanel from '../components/SyncDebugPanel.vue';
import {
  ALERT_COUNTRIES,
  DEFAULT_TIMEZONE,
  loadAlertSettings,
  saveAlertSettings,
} from '../services/alertSettingsService';
import {
  getNotificationPermission,
  getPushEnvironmentStatus,
  isPushSubscriptionActive,
  subscribeToPush,
  syncPushSubscription,
  unsubscribeFromPush,
} from '../services/pushNotificationService';

const settings = ref(loadAlertSettings());
const pushStatus = ref({ loading: false, messageKey: null, errorKey: null });
const pushEnv = ref(getPushEnvironmentStatus());
const notificationPermission = ref(getNotificationPermission());
const pushSubscribed = ref(false);
const countryOptions = ALERT_COUNTRIES;

watch(
  settings,
  (newSettings) => {
    const saved = saveAlertSettings(newSettings);
    if (saved.alerts.cheap.channels.push || saved.alerts.expensive.channels.push) {
      syncPushSubscription(saved).catch(() => {});
    }
  },
  { deep: true },
);

async function refreshPushState() {
  pushEnv.value = getPushEnvironmentStatus();
  notificationPermission.value = getNotificationPermission();
  pushSubscribed.value = await isPushSubscriptionActive();
}

async function enablePushAlerts(ruleKey) {
  pushStatus.value = { loading: true, messageKey: null, errorKey: null };
  try {
    const result = await subscribeToPush(settings.value);
    if (result.ok) {
      pushStatus.value = { loading: false, messageKey: 'settings.pushEnabled', errorKey: null };
    } else if (result.unavailable) {
      pushStatus.value = { loading: false, messageKey: 'settings.pushPendingBackend', errorKey: null };
    } else if (result.hintKey) {
      settings.value.alerts[ruleKey].channels.push = false;
      pushStatus.value = { loading: false, messageKey: null, errorKey: result.hintKey };
    } else {
      settings.value.alerts[ruleKey].channels.push = false;
      pushStatus.value = { loading: false, messageKey: null, errorKey: result.errorKey || 'settings.pushSubscribeFailed' };
    }
  } finally {
    pushStatus.value.loading = false;
    await refreshPushState();
  }
}

async function disablePushAlerts() {
  pushStatus.value = { loading: true, messageKey: null, errorKey: null };
  try {
    await unsubscribeFromPush();
    settings.value.alerts.cheap.channels.push = false;
    settings.value.alerts.expensive.channels.push = false;
    pushStatus.value = { loading: false, messageKey: 'settings.pushDisabled', errorKey: null };
  } finally {
    pushStatus.value.loading = false;
    await refreshPushState();
  }
}

function onPushChannelChange(ruleKey, enabled) {
  if (enabled) {
    settings.value.alerts[ruleKey].channels.push = true;
    enablePushAlerts(ruleKey);
    return;
  }
  settings.value.alerts[ruleKey].channels.push = false;
  if (!settings.value.alerts.cheap.channels.push && !settings.value.alerts.expensive.channels.push) {
    disablePushAlerts();
  }
}

onMounted(() => {
  refreshPushState();
});
</script>

<template>
  <div class="settings-page container">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="mb-0">{{ $t('settings.title') }}</h1>
      <LanguageSwitcher />
    </div>
    <PriceSettings />
    <div class="settings card">
      <div class="card-body">
        <h2 class="h5 mb-3">{{ $t('settings.colorTitle') }}</h2>
        <div class="row justify-content-center">
          <div class="col">
            <label for="cheapThreshold" class="form-label">{{ $t('settings.cheapThreshold') }}</label>
            <div class="input-group">
              <input id="cheapThreshold" type="number" class="form-control" v-model.number="settings.colorThresholds.cheapThreshold" step="0.1" min="0">
              <span class="input-group-text">ct/kWh</span>
            </div>
          </div>
          <div class="col">
            <label for="expensiveThreshold" class="form-label">{{ $t('settings.expensiveThreshold') }}</label>
            <div class="input-group">
              <input id="expensiveThreshold" type="number" class="form-control" v-model.number="settings.colorThresholds.expensiveThreshold" step="0.1" min="0">
              <span class="input-group-text">ct/kWh</span>
            </div>
          </div>
        </div>
        <div class="mt-4 mb-0">
          <label class="form-label mb-2">{{ $t('settings.rangesLabel') }}</label>
          <div class="row justify-content-center">
            <div class="col">
              <label for="cheapRange" class="form-label text-muted">{{ $t('settings.cheapBelow') }}</label>
              <div class="input-group">
                <input id="cheapRange" type="number" class="form-control" v-model.number="settings.colorThresholds.cheapRange" min="0" max="100" step="1">
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="col">
              <label for="expensiveRange" class="form-label text-muted">{{ $t('settings.expensiveAbove') }}</label>
              <div class="input-group">
                <input id="expensiveRange" type="number" class="form-control" v-model.number="settings.colorThresholds.expensiveRange" min="0" max="100" step="1">
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="settings card mt-3">
      <div class="card-body">
        <h2 class="h5 mb-3">{{ $t('settings.alertsTitle') }}</h2>
        <p class="text-muted small">{{ $t('settings.alertsHelp') }}</p>
        <div class="mb-3">
          <label for="alertCountry" class="form-label">{{ $t('settings.alertCountry') }}</label>
          <select id="alertCountry" class="form-select" v-model="settings.country">
            <option v-for="code in countryOptions" :key="code" :value="code">{{ $t(`settings.countries.${code}`) }}</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label d-block">{{ $t('settings.alertChannels') }}</label>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="cheap-inapp" v-model="settings.alerts.cheap.channels.inApp">
            <label class="form-check-label" for="cheap-inapp">{{ $t('settings.cheapInApp', { value: settings.colorThresholds.cheapThreshold }) }}</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="cheap-push" :checked="settings.alerts.cheap.channels.push" @change="onPushChannelChange('cheap', $event.target.checked)">
            <label class="form-check-label" for="cheap-push">{{ $t('settings.cheapPush', { value: settings.colorThresholds.cheapThreshold }) }}</label>
          </div>
          <div class="form-check mt-2">
            <input class="form-check-input" type="checkbox" id="expensive-inapp" v-model="settings.alerts.expensive.channels.inApp">
            <label class="form-check-label" for="expensive-inapp">{{ $t('settings.expensiveInApp', { value: settings.colorThresholds.expensiveThreshold }) }}</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="expensive-push" :checked="settings.alerts.expensive.channels.push" @change="onPushChannelChange('expensive', $event.target.checked)">
            <label class="form-check-label" for="expensive-push">{{ $t('settings.expensivePush', { value: settings.colorThresholds.expensiveThreshold }) }}</label>
          </div>
        </div>
        <div class="mb-3">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="quietHoursEnabled" v-model="settings.quietHours.enabled">
            <label class="form-check-label" for="quietHoursEnabled">{{ $t('settings.quietHoursEnabled') }}</label>
          </div>
          <small class="form-text text-muted">{{ $t('settings.quietHoursHelp', { timezone: settings.timezone || DEFAULT_TIMEZONE }) }}</small>
          <div class="row mt-2" v-if="settings.quietHours.enabled">
            <div class="col">
              <label for="quietStart" class="form-label">{{ $t('settings.quietHoursStart') }}</label>
              <input id="quietStart" type="time" class="form-control" v-model="settings.quietHours.start">
            </div>
            <div class="col">
              <label for="quietEnd" class="form-label">{{ $t('settings.quietHoursEnd') }}</label>
              <input id="quietEnd" type="time" class="form-control" v-model="settings.quietHours.end">
            </div>
          </div>
        </div>
        <div class="alert alert-secondary small mb-0" role="status">
          <div>{{ $t('settings.pushPermissionStatus', { status: $t(`settings.pushPermission.${notificationPermission}`) }) }}</div>
          <div v-if="pushSubscribed">{{ $t('settings.pushSubscribed') }}</div>
          <div v-else-if="!pushEnv.ready && pushEnv.hintKey">{{ $t(pushEnv.hintKey) }}</div>
          <div v-if="pushStatus.messageKey" class="text-success mt-1">{{ $t(pushStatus.messageKey) }}</div>
          <div v-if="pushStatus.errorKey" class="text-danger mt-1">{{ $t(pushStatus.errorKey) }}</div>
          <div v-if="pushStatus.loading" class="mt-1">{{ $t('settings.pushWorking') }}</div>
        </div>
      </div>
    </div>
    <SyncDebugPanel />
    <div class="text-center mt-4">
      <RouterLink to="/" class="btn btn-primary">{{ $t('settings.saveAndClose') }}</RouterLink>
    </div>
    <div class="text-center mt-4" id="extra-links">
      <div class="btn-group" role="group">
        <RouterLink to="/about" class="btn btn-outline-secondary btn-sm">{{ $t('settings.about') }}</RouterLink>
        <a href="/api" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm">{{ $t('settings.swaggerDocs') }}</a>
        <RouterLink to="/status" class="btn btn-outline-secondary btn-sm">{{ $t('settings.systemStatus') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page { padding: 1rem; }
.settings { max-width: 600px; margin: 0 auto; }
</style>
