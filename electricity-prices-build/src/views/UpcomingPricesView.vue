<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import PriceTable from '../components/PriceTable.vue';
import { fetchUpcomingPrices } from '../services/priceService';
import { calculatePrice, logAllPriceBreakdowns } from '../services/priceCalculationService';
import { formatPriceHours, formatLocalTime } from '../services/timeService';
import moment from 'moment-timezone';

moment.tz.setDefault('Europe/Vilnius');

const priceData = ref([]);
const allPrices = ref([]);
const isLoading = ref(true);
const error = ref(null);

let refreshTimeout = null;

function getIntervalMs() {
  if (allPrices.value && allPrices.value.length >= 2) {
    const diffSec = allPrices.value[1].timestamp - allPrices.value[0].timestamp;
    if (diffSec > 0) return diffSec * 1000;
  }
  return 60 * 60 * 1000; // default 1 hour
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
    // If user returns after sleep or tab hidden, reload prices and reschedule
    loadPrices();
    scheduleNextRefresh();
  }
}

const loadPrices = async () => {
  try {
    isLoading.value = true;
    
    const data = await fetchUpcomingPrices('lt');
    const upcoming = data?.data?.lt || [];
    
    allPrices.value = upcoming
      .filter(price => price !== null && price !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    priceData.value = allPrices.value;
    
    console.log('Calculated Price Objects:');
    const intervalSeconds =
      allPrices.value.length >= 2
        ? Math.max(allPrices.value[1].timestamp - allPrices.value[0].timestamp, 60)
        : 3600;

    const calculatedPrices = priceData.value.map(price => ({
      timestamp: price.timestamp,
      formattedTime: formatPriceHours(price.timestamp, intervalSeconds),
      localDateTime: formatLocalTime(price.timestamp),
      rawPrice: price.price,
      calculatedPrice: calculatePrice(price)
    }));
    
    console.log(calculatedPrices);
    
    // Debug: Log all price components breakdown for each hour
    logAllPriceBreakdowns();
    
  } catch (e) {
    error.value = e.message;
    console.error('Error loading prices:', e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadPrices();
  scheduleNextRefresh();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <div class="container-fluid px-2 px-md-3">
    <!-- Loading and error states -->
    <div v-if="isLoading" class="alert alert-info">
      {{ $t('upcoming.loading') }}
    </div>
    <div v-else-if="error" class="alert alert-danger">
      {{ $t('upcoming.error') }}
    </div>
    <div v-else-if="priceData.length === 0" class="alert alert-warning">
      {{ $t('upcoming.empty') }}
    </div>
    <div v-else>
      <PriceTable :priceData="priceData" :allPriceData="allPrices" />
    </div>
  </div>
</template>

<style scoped>
/* Mobile: reduce container padding and ensure proper horizontal scrolling */
@media (max-width: 767.98px) {
  .container-fluid {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }
}
</style>
