<script setup>
import { computed, ref, onMounted } from 'vue';
import { formatPriceHours, isCurrentHour } from '../services/timeService';
import { calculatePrice } from '../services/priceCalculationService';

const props = defineProps({
  priceData: {
    type: Array,
    required: true,
    default: () => []
  }
});

const settings = ref({
  numberOfHours: 12,
  isDarkTheme: false,
  currentHourSize: 48,
  otherHourSize: 24
});

onMounted(() => {
  const savedSettings = localStorage.getItem('upcomingPricesSettings');
  if (savedSettings) {
    settings.value = JSON.parse(savedSettings);
  }
});

const saveSettings = () => {
  localStorage.setItem('upcomingPricesSettings', JSON.stringify(settings.value));
};

const upcomingPrices = computed(() => {
  const nowSec = Math.floor(Date.now() / 1000);
  return props.priceData
    .filter(price => price.timestamp >= nowSec)
    .slice(0, settings.value.numberOfHours);
});

const intervalSeconds = computed(() => {
  if (props.priceData && props.priceData.length >= 2) {
    const diff = props.priceData[1].timestamp - props.priceData[0].timestamp;
    return diff > 0 ? diff : 3600;
  }
  return 3600;
});

// Add debugging to see what data is coming in
console.log('UpcomingPrices props data:', props.priceData);

const themeClass = computed(() => {
  return settings.value.isDarkTheme ? 'bg-dark text-light' : 'bg-light text-dark';
});
</script>

<template>
  <div class="container-fluid">
    <!-- Settings Panel -->
    <div class="card mb-3">
      <div class="card-header">
        <h5 class="card-title">{{ $t('upcoming.displaySettings') }}</h5>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">{{ $t('upcoming.numberOfHours') }}</label>
            <input 
              type="number" 
              class="form-control" 
              v-model="settings.numberOfHours"
              @change="saveSettings"
              min="1" 
              max="24"
            >
          </div>
          <div class="col-md-6">
            <div class="form-check form-switch mt-4">
              <input 
                class="form-check-input" 
                type="checkbox" 
                v-model="settings.isDarkTheme"
                @change="saveSettings"
              >
              <label class="form-check-label">{{ $t('upcoming.darkTheme') }}</label>
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">{{ $t('upcoming.currentHourFontSize') }}</label>
            <input 
              type="number" 
              class="form-control" 
              v-model="settings.currentHourSize"
              @change="saveSettings"
              min="12" 
              max="72"
            >
          </div>
          <div class="col-md-6">
            <label class="form-label">{{ $t('upcoming.otherHoursFontSize') }}</label>
            <input 
              type="number" 
              class="form-control" 
              v-model="settings.otherHourSize"
              @change="saveSettings"
              min="12" 
              max="72"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Prices Display -->
    <div :class="['card', themeClass]">
      <div class="card-body">
        <div class="row g-4">
          <div 
            v-for="price in upcomingPrices" 
            :key="price.timestamp"
            class="col-12 text-center"
          >
            <div 
              :style="{
                fontSize: `${isCurrentHour(price.timestamp, intervalSeconds) ? settings.currentHourSize : settings.otherHourSize}px`
              }"
            >
              {{ calculatePrice(price) }} ct/kWh
              <small class="text-muted d-block">
                ({{ formatPriceHours(price.timestamp, intervalSeconds) }})
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
