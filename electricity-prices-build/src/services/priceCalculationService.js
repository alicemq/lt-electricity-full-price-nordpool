import { useStorage } from '@vueuse/core';
import { ref } from 'vue';
import moment from 'moment-timezone';
import { timeZones, timeSchedules } from '../config/priceConfig';
import { getPriceConfig } from './priceConfigService';
import { isHoliday } from './holidayService';
import { logPriceCalculation } from './logService';

let state = ref(useStorage('elecsettings', {
  zone: "Four zones",
  plan: "Standart",
  vendorMargin: '0.02003',
  PVMIncluded: true,
  includeExtraTariffs: true
}));

// Cache for price config per country (loaded synchronously from localStorage)
const priceConfigCache = {};

// Initialize config cache from localStorage for a country
function initConfigCache(country = 'lt') {
  try {
    const cached = localStorage.getItem(`priceConfigCache_${country.toLowerCase()}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.version === 2 && parsed.data) {
        priceConfigCache[country] = parsed.data;
      }
    }
  } catch (error) {
    console.error(`Error initializing price config cache for ${country}:`, error);
  }
}

// Initialize on module load (default to 'lt')
initConfigCache('lt');

// Listen for config updates
if (typeof window !== 'undefined') {
  window.addEventListener('priceConfigUpdated', (event) => {
    const { data, country = 'lt' } = event.detail;
    priceConfigCache[country] = data;
  });
}

function getPricesForDate(date, country = 'lt') {
  const config = priceConfigCache[country];
  if (!config) {
    // Try to initialize cache for this country
    initConfigCache(country);
    const retryConfig = priceConfigCache[country];
    if (!retryConfig) {
      // Fallback to empty if config not loaded yet
      return { tariffs: {}, systemCharges: {} };
    }
  }
  
  const dateStr = moment(date).format('YYYY-MM-DD');
  const configToUse = priceConfigCache[country] || {};
  
  // Find applicable tariff period
  const tariffPeriods = Object.keys(configToUse.tariffs || {}).sort();
  const applicableTariffPeriod = tariffPeriods.reduce((prev, curr) => {
    return dateStr >= curr ? curr : prev;
  }, tariffPeriods[0] || '');
  
  // Find applicable system charges period
  const chargePeriods = Object.keys(configToUse.systemCharges || {}).sort();
  const applicableChargePeriod = chargePeriods.reduce((prev, curr) => {
    return dateStr >= curr ? curr : prev;
  }, chargePeriods[0] || '');

  return {
    tariffs: configToUse.tariffs?.[applicableTariffPeriod] || {},
    systemCharges: configToUse.systemCharges?.[applicableChargePeriod] || {}
  };
}

function getDistributionPrice(time, country = 'lt') {
  const timestamp = new Date(time * 1000);
  const prices = getPricesForDate(timestamp, country);
  const newDate = moment(timestamp);
  let weekend = [0, 6].includes(newDate.day()) === false ? 'mondayToFriday' : 'weekend';
  const hour = newDate.hour();
  const daylightSaving = newDate.isDST() === false ? "wintertime" : "summertime";
  const zone = timeZones[state.value.zone];
  const plan = prices.tariffs[state.value.zone]?.[state.value.plan];
  
  if (!plan) {
    console.warn(`No plan found for country ${country}, zone ${state.value.zone}, plan ${state.value.plan}`);
    return 0;
  }
  
  let timetable;
  switch (zone.name) {
    case "Four zones":
      weekend = isHoliday(timestamp) ? 'weekend' : weekend;
      timetable = timeSchedules[zone.name]['alltime'][weekend];
      break;
    case "Two zones":
      timetable = timeSchedules[zone.name][daylightSaving][weekend];
      break;
    case "Single zone":
      timetable = timeSchedules[zone.name]['alltime'][weekend];
      break;
  }
  
  return plan[timetable[hour]] || 0;
}

export function calculatePrice(price) {
  const timestamp = new Date(price.timestamp * 1000);
  // Extract country from price object, default to 'lt'
  const country = price.country || 'lt';
  const historicalPrices = getPricesForDate(timestamp, country);
  const VAT = state.value.PVMIncluded ? 1 : 1.21;
  const originalPrice = parseFloat(price.price) / 1000;
  const originalPriceWithVAT = originalPrice * 1.21;
  const includeExtra = state.value.includeExtraTariffs !== false; // Default to true if not set

  const distributionPrice = includeExtra ? getDistributionPrice(price.timestamp, country) : 0;

  const modifiers = {
    originalPrice,
    originalPriceWithVAT,
    VIAP: includeExtra ? parseFloat(historicalPrices.systemCharges.VIAP || 0) : 0,
    vendorMargin: includeExtra ? parseFloat(state.value.vendorMargin) : 0,
    distributionplus: includeExtra ? parseFloat(historicalPrices.systemCharges.distributionplus || 0) : 0,
    distributionPrice,
    VAT: VAT,
    baseVAT: 1.21
  };

  const extraCosts = includeExtra 
    ? (modifiers.VIAP + modifiers.vendorMargin + modifiers.distributionplus + modifiers.distributionPrice)
    : 0;

  const finalPrice = (Math.round(((((originalPrice * modifiers.baseVAT) + extraCosts) * 100) / modifiers.VAT) * 100) / 100);

  logPriceCalculation(price.timestamp, originalPrice, finalPrice, modifiers);
  
  return finalPrice;
}
