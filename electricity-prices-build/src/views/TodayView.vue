<script setup>

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

import { useRoute, onBeforeRouteLeave } from 'vue-router'

import moment from 'moment-timezone';

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



function resolveInitialDate() {

  const queryDate = route.query.date;

  if (typeof queryDate === 'string' && moment.tz(queryDate, DISPLAY_TIMEZONE).isValid()) {

    return moment.tz(queryDate, DISPLAY_TIMEZONE).startOf('day').toDate();

  }

  return moment().tz(DISPLAY_TIMEZONE).startOf('day').toDate();

}



const date = ref(resolveInitialDate());

const minDate = moment.tz('2012-07-01', DISPLAY_TIMEZONE).startOf('day').toDate();

const maxDate = moment().tz(DISPLAY_TIMEZONE).add(1, 'day').startOf('day').toDate();

const priceData = ref([]);

const isLoading = ref(true);

const error = ref(null);



let refreshTimeout = null;

let unsubscribePrices = null;



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

  try {

    isLoading.value = true;

    error.value = null;

    const data = await fetchPrices(date.value);

    priceData.value = data.data?.lt || [];

    await nextTick();

    logAllPriceBreakdowns();

  } catch (err) {

    error.value = err?.message || 'Failed to load prices';

    priceData.value = [];

  } finally {

    isLoading.value = false;

  }

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



watch(date, () => {

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

  const dateStr = moment(date.value).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');

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



watch([priceData, date], () => {

  updateTodaySEO();

}, { deep: true });



function setToday() {

  date.value = moment().tz(DISPLAY_TIMEZONE).startOf('day').toDate();

}



function setTomorrow() {

  date.value = moment().tz(DISPLAY_TIMEZONE).add(1, 'day').startOf('day').toDate();

}

</script>



<template>

  <div class="container-fluid px-2 px-md-3">

    <div class="today-page">

      <div class="d-flex gap-2 mb-3">

        <VueDatePicker v-model="date" locale="lt" month-name-format="long" format="yyyy-MM-dd"

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

        {{ $t('upcoming.error') }}

      </div>

      <PriceTable v-else :priceData="priceData" />

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


