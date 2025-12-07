import { useStorage } from '@vueuse/core';
import { ref } from 'vue';
import moment from 'moment-timezone';
import { timeZones, timeSchedules } from '../config/priceConfig';
import { getPriceConfig } from './priceConfigService';
import { isHoliday } from './holidayService';
import { logPriceCalculation } from './logService';

// Function to get time period (night/morning/day/evening) for a given timestamp
export function getTimePeriod(timestamp, country = 'lt') {
  const date = new Date(timestamp * 1000);
  const newDate = moment(date);
  let weekend = [0, 6].includes(newDate.day()) === false ? 'mondayToFriday' : 'weekend';
  const hour = newDate.hour();
  const daylightSaving = newDate.isDST() === false ? "wintertime" : "summertime";
  const zone = timeZones[state.value.zone];
  
  let timetable;
  switch (zone.name) {
    case "Four zones":
      weekend = isHoliday(date) ? 'weekend' : weekend;
      timetable = timeSchedules[zone.name]['alltime'][weekend];
      break;
    case "Two zones":
      timetable = timeSchedules[zone.name][daylightSaving][weekend];
      break;
    case "Single zone":
      timetable = timeSchedules[zone.name]['alltime'][weekend];
      break;
    default:
      return 'day';
  }
  
  return timetable[hour] || 'day';
}

let state = ref(useStorage('elecsettings', {
  zone: "Four zones",
  plan: "Standart",
  vendorMargin: '0.02003',
  PVMIncluded: true,
  includeExtraTariffs: true
}));

// Cache for price config per country (loaded synchronously from localStorage)
const priceConfigCache = {};

// Debug: Array to store price breakdowns for each hour
const priceBreakdowns = [];
// Track logged timestamps to avoid duplicates
const loggedTimestamps = new Set();

// Debug: Function to log all price breakdowns
export function logAllPriceBreakdowns() {
  if (priceBreakdowns.length > 0) {
    // Deduplicate by timestamp
    const uniqueBreakdowns = [];
    const seenTimestamps = new Set();
    
    for (const breakdown of priceBreakdowns) {
      if (!seenTimestamps.has(breakdown.timestamp)) {
        seenTimestamps.add(breakdown.timestamp);
        uniqueBreakdowns.push(breakdown);
      }
    }
    
    console.log(`📊 Price Components Breakdown (${uniqueBreakdowns.length} unique hours, ${priceBreakdowns.length} total calculations):`, uniqueBreakdowns);
    console.table(uniqueBreakdowns);
    
    // Clear after logging to avoid memory issues
    priceBreakdowns.length = 0;
    loggedTimestamps.clear();
  }
}

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
  
  // Find applicable tariff period (most recent date <= current date)
  const tariffPeriods = Object.keys(configToUse.tariffs || {}).sort().reverse(); // Sort descending
  const applicableTariffPeriod = tariffPeriods.find(period => dateStr >= period) || tariffPeriods[tariffPeriods.length - 1] || '';
  
  // Find applicable system charges period (most recent date <= current date)
  const chargePeriods = Object.keys(configToUse.systemCharges || {}).sort().reverse(); // Sort descending
  const applicableChargePeriod = chargePeriods.find(period => dateStr >= period) || chargePeriods[chargePeriods.length - 1] || '';

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
    console.warn(`Available zones:`, Object.keys(prices.tariffs || {}));
    if (prices.tariffs[state.value.zone]) {
      console.warn(`Available plans for ${state.value.zone}:`, Object.keys(prices.tariffs[state.value.zone]));
    }
    console.warn(`Price config cache for ${country}:`, priceConfigCache[country]);
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

  // VIAP and distributionplus are stored without VAT in the database - apply VAT (1.21)
  // distributionPrice is already WITH VAT - do not apply VAT again
  // vendorMargin is assumed to be correct as-is
  // Use full precision (up to 10 decimals) for calculations
  const baseVAT = 1.21;
  const VIAPBase = includeExtra ? Number(historicalPrices.systemCharges.VIAP || 0) : 0;
  const distributionplusBase = includeExtra ? Number(historicalPrices.systemCharges.distributionplus || 0) : 0;
  const vendorMargin = includeExtra ? Number(state.value.vendorMargin) : 0;

  const modifiers = {
    originalPrice,
    originalPriceWithVAT,
    VIAP: VIAPBase * baseVAT,
    vendorMargin: vendorMargin,
    distributionplus: distributionplusBase * baseVAT,
    distributionPrice: distributionPrice, // Already with VAT, no multiplication needed
    VAT: VAT,
    baseVAT: baseVAT
  };

  const extraCosts = includeExtra 
    ? (modifiers.VIAP + modifiers.vendorMargin + modifiers.distributionplus + modifiers.distributionPrice)
    : 0;

  // Calculate final price: (originalPrice * VAT + extraCosts) / VAT
  // Convert to cents (multiply by 100) and round to 3 decimal places
  const priceWithVAT = (originalPrice * modifiers.baseVAT) + extraCosts;
  const finalPriceInEuros = (priceWithVAT / modifiers.VAT);
  const finalPriceInCents = finalPriceInEuros * 100; // Convert to cents first
  const finalPrice = Math.round(finalPriceInCents * 1000) / 1000; // Round to 3 decimals in cents

  // Debug: Store detailed price breakdown for each hour (only once per timestamp)
  if (!loggedTimestamps.has(price.timestamp)) {
    const dateTime = moment(timestamp);
    const timePeriod = getTimePeriod(price.timestamp, country);
    const priceBreakdown = {
      timestamp: price.timestamp,
      dateTime: dateTime.format('YYYY-MM-DD HH:mm:ss'),
      hour: dateTime.format('HH:mm'),
      period: timePeriod,
      originalPrice: parseFloat(originalPrice.toFixed(6)),
      originalPriceWithVAT: parseFloat(originalPriceWithVAT.toFixed(6)),
      VIAPBase: parseFloat(VIAPBase.toFixed(10)),
      VIAPWithVAT: parseFloat((VIAPBase * baseVAT).toFixed(10)),
      distributionplusBase: parseFloat(distributionplusBase.toFixed(10)),
      distributionplusWithVAT: parseFloat((distributionplusBase * baseVAT).toFixed(10)),
      distributionPriceBase: parseFloat(distributionPrice.toFixed(6)),
      distributionPriceWithVAT: parseFloat(distributionPrice.toFixed(6)), // Already with VAT
      vendorMargin: parseFloat(vendorMargin.toFixed(6)),
      extraCosts: parseFloat(extraCosts.toFixed(6)),
      baseVAT: baseVAT,
      VAT: VAT,
      finalPrice: parseFloat(finalPrice.toFixed(3)),
      includeExtra: includeExtra,
      country: country,
      zone: state.value.zone,
      plan: state.value.plan
    };
    
    priceBreakdowns.push(priceBreakdown);
    loggedTimestamps.add(price.timestamp);
  }

  logPriceCalculation(price.timestamp, originalPrice, finalPrice, modifiers);
  
  return finalPrice;
}
