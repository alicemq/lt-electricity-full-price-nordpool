<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import moment from 'moment-timezone';
import { fetchPrices } from '../services/priceService';
import { logAllPriceBreakdowns } from '../services/priceCalculationService';
import PriceTable from '../components/PriceTable.vue';

moment.tz.setDefault("Europe/Vilnius");

const date = ref(new Date());
const minDate = ref(new Date("2012-07-01"));
const priceData = ref([]);
const nextDay = moment().add(1, 'days').format('YYYY-MM-DD');

let refreshTimeout = null;

function getIntervalMs() {
  if (priceData.value && priceData.value.length >= 2) {
    const diffSec = priceData.value[1].timestamp - priceData.value[0].timestamp;
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
    await reloadPrices();
    scheduleNextRefresh();
  }, delay);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    reloadPrices();
    scheduleNextRefresh();
  }
}

async function reloadPrices() {
  try {
    const data = await fetchPrices(date.value);
    priceData.value = data.data?.lt || [];
    // Debug: Log price breakdowns after prices are loaded and calculated
    await nextTick();
    logAllPriceBreakdowns();
  } catch (error) {
    priceData.value = [];
  }
}

onMounted(() => {
  reloadPrices();
  scheduleNextRefresh();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

watch(date, () => {
  reloadPrices();
});

function setToday() {
  date.value = new Date();
}

function setTomorrow() {
  date.value = moment().add(1, 'days').toDate();
}
</script>

<template>
  <div class="container-fluid px-2 px-md-3">
    <div class="today-page">
      <div class="d-flex gap-2 mb-3">
        <VueDatePicker v-model="date" locale="lt" month-name-format="long" format="yyyy-MM-dd" 
          auto-apply reverse-years :enable-time-picker="false" 
          :max-date="nextDay" :min-date="minDate" prevent-min-max-navigation 
          class="flex-grow-1" />
        <button @click="setToday" class="btn btn-secondary">{{ $t('home.today') }}</button>
        <button @click="setTomorrow" class="btn btn-secondary">{{ $t('home.tomorrow') }}</button>
      </div>

      <PriceTable :priceData="priceData" />
      
    </div>
  </div>
</template>

<style scoped>
.today-page {
  padding: 0;
}

/* Mobile: reduce container padding and ensure proper horizontal scrolling */
@media (max-width: 767.98px) {
  .container-fluid {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }
}
</style>

