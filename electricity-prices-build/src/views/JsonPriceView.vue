<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import moment from 'moment-timezone';
import { fetchPrices } from '../services/priceService';
import { calculatePrice } from '../services/priceCalculationService';
import { getPriceClass } from '../utils/priceColor';
import { getColorThresholdSettings } from '../services/alertSettingsService';

const jsonData = ref(null);
const isDev = computed(() => import.meta.env.DEV);

const settings = getColorThresholdSettings();

function filterPricesFromNow(prices) {
  const now = moment().unix();
  return prices.filter(price => price.timestamp >= now);
}

let refreshTimeout = null;

function scheduleNextRefresh() {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  const now = new Date();
  const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  refreshTimeout = setTimeout(async () => {
    await loadAndProcessPrices();
    scheduleNextRefresh();
  }, msToNextHour);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    loadAndProcessPrices();
    scheduleNextRefresh();
  }
}

async function loadAndProcessPrices() {
  try {
    const [todayData, tomorrowData] = await Promise.all([
      fetchPrices(new Date()),
      fetchPrices(moment().add(1, 'days').toDate())
    ]);

    const todayPrices = filterPricesFromNow(todayData.data?.lt || []);
    const tomorrowPrices = tomorrowData.data?.lt || [];

    const allPrices = [...todayPrices, ...tomorrowPrices];
    const averagePrice = allPrices.reduce((acc, price) => acc + parseFloat(calculatePrice(price)), 0) / allPrices.length;

    const processPrice = price => {
      const calculatedPrice = parseFloat(calculatePrice(price));
      const priceInfo = getPriceClass(calculatedPrice, averagePrice, settings, false);
      const normalizedType = priceInfo.classes?.includes('success') ? 'cheap' 
        : priceInfo.classes?.includes('danger') ? 'expensive' 
        : 'normal';
      return {
        timestamp: price.timestamp,
        originalPrice: price.price,
        calculatedPrice,
        priceClassification: normalizedType
      };
    };

    jsonData.value = {
      fromDate: moment().format('YYYY-MM-DD HH:mm'),
      toDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm'),
      settings,
      averagePrice: averagePrice.toFixed(2),
      count: allPrices.length,
      prices: allPrices.map(processPrice)
    };
  } catch (error) {
    jsonData.value = { error: 'Failed to fetch prices' };
  }
}

onMounted(() => {
  loadAndProcessPrices();
  scheduleNextRefresh();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <pre>{{ JSON.stringify(jsonData, null, 2) }}</pre>
</template>

<style>
pre {
  padding: 1rem;
  background: #f5f5f5;
  white-space: pre-wrap;
}
</style>
