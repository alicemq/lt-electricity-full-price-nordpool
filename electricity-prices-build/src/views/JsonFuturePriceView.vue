<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import moment from 'moment-timezone';
import { fetchPrices } from '../services/priceService';
import { calculatePrice } from '../services/priceCalculationService';
import { filterUpcomingSlots } from '../services/timeService';

const jsonData = ref(null);

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

    const todayPrices = filterUpcomingSlots(todayData.data?.lt || []);
    const tomorrowPrices = tomorrowData.data?.lt || [];

    const processPrice = price => ({
      timestamp: price.timestamp,
      hour: moment.unix(price.timestamp).format('HH:mm'),
      originalPrice: price.price,
      calculatedPrice: calculatePrice(price)
    });

    jsonData.value = {
      from: moment().format('YYYY-MM-DD HH:mm'),
      to: moment().add(1, 'days').endOf('day').format('YYYY-MM-DD HH:mm'),
      count: todayPrices.length + tomorrowPrices.length,
      prices: [
        ...todayPrices.map(processPrice),
        ...tomorrowPrices.map(processPrice)
      ]
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
