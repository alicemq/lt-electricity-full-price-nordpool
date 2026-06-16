<script setup>

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

import { useRoute, onBeforeRouteLeave } from 'vue-router'

import moment from 'moment-timezone';

import { lt as ltLocale } from 'date-fns/locale';

import { fetchPrices, onPricesUpdated, runSmartSync } from '../services/priceService';

import { calculatePrice, logAllPriceBreakdowns } from '../services/priceCalculationService';

import PriceTable from '../components/PriceTable.vue';

import i18n from '../i18n';

import {

  setSEO,

  buildRouteStructuredData,

  generatePriceDataStructuredData,

} from '../utils/seo';

import { DISPLAY_TIMEZONE } from '../utils/releaseWindow';



moment.tz.setDefault(DISPLAY_TIMEZONE);



const route = useRoute();



function formatDisplayDate(value) {

  return moment.tz(value, DISPLAY_TIMEZONE).format('YYYY-MM-DD');

}



function resolveInitialDateStr() {

  const queryDate = route.query.date;

  if (typeof queryDate === 'string' && moment.tz(queryDate, DISPLAY_TIMEZONE).isValid()) {

    return formatDisplayDate(queryDate);

  }

  return formatDisplayDate(moment().tz(DISPLAY_TIMEZONE));

}



const selectedDate = ref(resolveInitialDateStr());

const minDate = '2012-07-01';

const maxDate = computed(() => formatDisplayDate(moment().tz(DISPLAY_TIMEZONE).add(1, 'day')));

const priceData = ref([]);

const isLoading = ref(true);

const error = ref(null);
const errorKind = ref(null);



let refreshTimeout = null;

let unsubscribePrices = null;

let reloadPromise = null;



function selectedDateAsDate() {

  return moment.tz(selectedDate.value, DISPLAY_TIMEZONE).startOf('day').toDate();

}



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

    runSmartSync('lt').finally(() => {

      reloadPrices();

      scheduleNextRefresh();

    });

  }

}



async function reloadPrices() {
  if (reloadPromise) {
    return reloadPromise;
  }

  reloadPromise = (async () => {
    try {
      isLoading.value = true;
      error.value = null;
      errorKind.value = null;
      const data = await fetchPrices(selectedDateAsDate());
      priceData.value = data.data?.lt || [];
      await nextTick();
      logAllPriceBreakdowns();
    } catch (err) {
      errorKind.value = err?.response ? 'load' : 'network';
      error.value = err?.message || 'Failed to load prices';
      priceData.value = [];
    } finally {
      isLoading.value = false;
      reloadPromise = null;
    }
  })();

  return reloadPromise;
}



onMounted(() => {

  reloadPrices();

  scheduleNextRefresh();

  unsubscribePrices = onPricesUpdated(() => {

    reloadPrices();

  });

  document.addEventListener('visibilitychange', handleVisibilityChange);

});



onBeforeRouteLeave(() => {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  refreshTimeout = null;
});

onUnmounted(() => {

  if (refreshTimeout) clearTimeout(refreshTimeout);

  if (unsubscribePrices) unsubscribePrices();

  document.removeEventListener('visibilitychange', handleVisibilityChange);

});



watch(selectedDate, (nextDate, prevDate) => {
  if (prevDate !== undefined && nextDate === prevDate) {
    return;
  }
  reloadPrices();
});



function updateTodaySEO() {
  if (route.name !== 'today') {
    return;
  }

  const locale = i18n.global.locale.value || 'lt';

  const meta = route.meta || {};

  const title = meta.title?.[locale] || meta.title || 'Elektros kaina LT';

  const description = meta.description?.[locale] || meta.description ||

    (locale === 'lt'

      ? 'Rodykite Nord Pool elektros kainas su visais taikomais mokesčiais ir prievolėmis. Kainos atnaujinamos automatiškai.'

      : 'Display Nord Pool electricity prices with all applicable taxes and fees. Prices are updated automatically.');

  const dateStr = selectedDate.value;

  const path = `/today?date=${dateStr}`;



  const extraStructuredData = [];

  if (priceData.value.length > 0) {

    const prices = priceData.value.map((entry) => parseFloat(calculatePrice(entry)));

    const averagePrice = prices.reduce((sum, value) => sum + value, 0) / prices.length;

    extraStructuredData.push(generatePriceDataStructuredData({

      date: dateStr,

      averagePrice,

      minPrice: Math.min(...prices),

      maxPrice: Math.max(...prices),

    }));

  }



  setSEO({

    title,

    description,

    url: path,

    locale,

    structuredData: buildRouteStructuredData({ ...route, fullPath: path, path: '/today' }, locale, extraStructuredData),

  });

}



watch([priceData, selectedDate], () => {

  updateTodaySEO();

}, { deep: true });



function setToday() {

  selectedDate.value = formatDisplayDate(moment().tz(DISPLAY_TIMEZONE));

}



function setTomorrow() {

  selectedDate.value = formatDisplayDate(moment().tz(DISPLAY_TIMEZONE).add(1, 'day'));

}

</script>



<template>

  <div class="container-fluid px-2 px-md-3">

    <div class="today-page">

      <div class="d-flex gap-2 mb-3">

        <VueDatePicker v-model="selectedDate" :locale="ltLocale"
          :formats="{ input: 'yyyy-MM-dd', month: 'MMMM' }"
          model-type="yyyy-MM-dd"
          auto-apply reverse-years :enable-time-picker="false"
          :max-date="maxDate" :min-date="minDate" prevent-min-max-navigation
          class="flex-grow-1" />

        <button @click="setToday" class="btn btn-secondary">{{ $t('home.today') }}</button>

        <button @click="setTomorrow" class="btn btn-secondary">{{ $t('home.tomorrow') }}</button>

      </div>



      <div v-if="isLoading" class="alert alert-info">

        {{ $t('upcoming.loading') }}

      </div>

      <div v-else-if="error" class="alert alert-danger">

        {{ $t(errorKind === 'network' ? 'today.apiUnavailable' : 'upcoming.error') }}

      </div>

      <PriceTable v-else :priceData="priceData" :selectedDate="selectedDate" />

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

