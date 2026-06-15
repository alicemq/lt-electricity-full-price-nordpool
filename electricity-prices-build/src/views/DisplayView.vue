<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import moment from 'moment-timezone';
import PriceTable from '../components/PriceTable.vue';
import DisplayChartPanel from '../components/display/DisplayChartPanel.vue';
import { decodeLayout, buildShareUrl } from '../lib/layoutCodec.js';
import { fetchPrices, fetchUpcomingPrices, onPricesUpdated, runSmartSync } from '../services/priceService';
import { logAllPriceBreakdowns } from '../services/priceCalculationService';

const route = useRoute();

const layoutConfig = ref(null);
const layoutError = ref(null);
const priceData = ref([]);
const allPrices = ref([]);
const isLoading = ref(true);
const loadError = ref(null);
const copyStatus = ref(null);

let refreshTimeout = null;
let copyStatusTimeout = null;
let unsubscribePrices = null;

const isKiosk = computed(() => route.meta.kiosk === true || route.query.kiosk === '1');

const themeClass = computed(() => {
  const theme = layoutConfig.value?.theme || 'dark';
  return theme === 'light' ? 'display-view--light' : 'display-view--dark';
});

function parseLayoutFromRoute() {
  const encoded = route.query.layout;
  if (typeof encoded !== 'string' || encoded.length === 0) {
    layoutConfig.value = null;
    layoutError.value = 'missing';
    return;
  }

  const result = decodeLayout(encoded);
  if (!result.ok) {
    layoutConfig.value = null;
    layoutError.value = result.error;
    return;
  }

  layoutConfig.value = result.config;
  layoutError.value = null;
  moment.tz.setDefault(result.config.tz);
}

function getIntervalMs() {
  const rows = allPrices.value.length ? allPrices.value : priceData.value;
  if (rows.length >= 2) {
    const diffSec = rows[1].timestamp - rows[0].timestamp;
    if (diffSec > 0) return diffSec * 1000;
  }
  return 60 * 60 * 1000;
}

function scheduleNextRefresh() {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  const intervalMs = getIntervalMs();
  const now = Date.now();
  const nextBoundary = now - (now % intervalMs) + intervalMs;
  const delay = Math.max(nextBoundary - now, 5 * 1000);
  refreshTimeout = setTimeout(async () => {
    await loadPrices();
    scheduleNextRefresh();
  }, delay);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    runSmartSync('lt').finally(() => {
      loadPrices();
      scheduleNextRefresh();
    });
  }
}

async function loadPrices() {
  if (!layoutConfig.value) return;

  try {
    isLoading.value = true;
    loadError.value = null;

    if (layoutConfig.value.source === 'today') {
      const data = await fetchPrices(new Date());
      const rows = data.data?.lt || [];
      priceData.value = rows;
      allPrices.value = rows;
    } else {
      const data = await fetchUpcomingPrices('lt');
      const upcoming = data?.data?.lt || [];
      allPrices.value = upcoming
        .filter((price) => price !== null && price !== undefined)
        .sort((a, b) => a.timestamp - b.timestamp);
      priceData.value = allPrices.value;
    }

    logAllPriceBreakdowns();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'load-failed';
    priceData.value = [];
    allPrices.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  parseLayoutFromRoute();
  if (layoutConfig.value) {
    loadPrices();
    scheduleNextRefresh();
    unsubscribePrices = onPricesUpdated(() => {
      loadPrices();
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
});

async function copyShareLink() {
  if (!layoutConfig.value) return;

  const url = buildShareUrl(layoutConfig.value, route.path.startsWith('/tv') ? '/tv' : '/display');
  try {
    await navigator.clipboard.writeText(url);
    copyStatus.value = 'copied';
  } catch {
    copyStatus.value = 'failed';
  }

  if (copyStatusTimeout) clearTimeout(copyStatusTimeout);
  copyStatusTimeout = setTimeout(() => {
    copyStatus.value = null;
  }, 2500);
}

onUnmounted(() => {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  if (copyStatusTimeout) clearTimeout(copyStatusTimeout);
  if (unsubscribePrices) unsubscribePrices();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

watch(
  () => route.query.layout,
  () => {
    parseLayoutFromRoute();
    if (layoutConfig.value) {
      loadPrices();
      scheduleNextRefresh();
    }
  },
);
</script>

<template>
  <div
    class="display-view"
    :class="[themeClass, { 'display-view--kiosk': isKiosk }]"
  >
    <div v-if="layoutError" class="display-view__message" role="alert">
      <h1 class="display-view__title">{{ $t('display.invalidTitle') }}</h1>
      <p>{{ $t('display.invalidBody') }}</p>
    </div>

    <template v-else>
      <div class="display-view__toolbar">
        <button
          type="button"
          class="display-view__copy"
          :aria-label="$t('display.copyLink')"
          @click="copyShareLink"
        >
          {{ copyStatus === 'copied' ? $t('display.copied') : $t('display.copyLink') }}
        </button>
        <span
          v-if="copyStatus === 'failed'"
          class="display-view__copy-error"
          role="status"
        >
          {{ $t('display.copyFailed') }}
        </span>
      </div>
      <div v-if="isLoading" class="display-view__message">
        {{ $t('display.loading') }}
      </div>
      <div v-else-if="loadError" class="display-view__message" role="alert">
        {{ $t('display.error') }}
      </div>
      <div v-else-if="priceData.length === 0" class="display-view__message">
        {{ $t('display.empty') }}
      </div>
      <div v-else class="display-view__panel">
        <DisplayChartPanel
          v-if="layoutConfig.panel === 'chart'"
          :price-data="priceData"
          :theme="layoutConfig.theme"
        />
        <PriceTable
          v-else
          :price-data="priceData"
          :all-price-data="allPrices"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.display-view {
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(1rem, 3vw, 2.5rem);
  box-sizing: border-box;
}

.display-view--kiosk {
  padding: clamp(1.5rem, 4vw, 3rem);
}

.display-view--dark {
  background: #0b0f19;
  color: #f5f5f5;
}

.display-view--light {
  background: #f8f9fa;
  color: #111;
}

.display-view__message {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  text-align: center;
  font-size: clamp(1.25rem, 2.5vw, 2rem);
  max-width: 48rem;
  margin: 0 auto;
  line-height: 1.5;
}

.display-view__title {
  font-size: clamp(2rem, 4vw, 3.5rem);
  margin-bottom: 1rem;
}

.display-view__toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.display-view__copy {
  font-size: clamp(0.875rem, 1.5vw, 1.125rem);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.85;
}

.display-view__copy:hover,
.display-view__copy:focus-visible {
  opacity: 1;
}

.display-view__copy-error {
  font-size: 0.875rem;
  color: #f87171;
}

.display-view__panel {
  width: 100%;
}

.display-view--kiosk :deep(.table) {
  font-size: clamp(1.1rem, 2vw, 2rem);
}

.display-view--kiosk :deep(.table th),
.display-view--kiosk :deep(.table td) {
  padding: clamp(0.5rem, 1.2vw, 1rem) clamp(0.75rem, 1.5vw, 1.25rem);
}

@media (min-width: 1920px) {
  .display-view--kiosk {
    padding: 3rem 4rem;
  }

  .display-view--kiosk :deep(.table) {
    font-size: 2.25rem;
  }
}
</style>
