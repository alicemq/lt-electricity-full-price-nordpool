<script setup>
import { computed, ref, watch } from 'vue';
import moment from 'moment-timezone';
import { formatPriceHours, isCurrentHour } from '../services/timeService';
import { calculatePrice, getTimePeriod } from '../services/priceCalculationService';
import { getPriceClass } from '../utils/priceColor';

const props = defineProps({
  priceData: {
    type: Array,
    required: true,
    default: () => []
  },
  allPriceData: {
    type: Array,
    required: false,
    default: null // Will use priceData if not provided
  }
})

const hasEnoughData = computed(() => props.priceData && props.priceData.length >= 3)

const intervalSeconds = computed(() => {
  if (props.priceData && props.priceData.length >= 2) {
    const diff = props.priceData[1].timestamp - props.priceData[0].timestamp;
    return diff > 0 ? diff : 3600;
  }
  return 3600;
});

// Default layout mode based on interval (after label swap):
// - "Per hour" button = 'slot' mode (one row per interval)
// - "Per interval" button = 'hour' mode (grouped by hour)
// 
// User wants:
// - For hourly (60-min) slots: show "hourly view" = 'slot' mode (one row per interval)
// - For 15-min slots: show "interval view" = 'hour' mode (grouped by hour)
const getDefaultLayoutMode = () => {
  if (props.priceData && props.priceData.length >= 2) {
    const diff = props.priceData[1].timestamp - props.priceData[0].timestamp;
    // 60-min (hourly) → hourly view → 'slot' mode (one per row)
    // 15-min → interval view → 'hour' mode (grouped)
    return diff === 3600 ? 'slot' : 'hour';
  }
  return 'slot'; // Default to slot view (hourly view) for hourly data
};

const layoutMode = ref(getDefaultLayoutMode());

// Update layout mode when data changes (e.g., when user selects a different day)
watch(() => props.priceData, (newData) => {
  if (newData && newData.length >= 2) {
    const diff = newData[1].timestamp - newData[0].timestamp;
    layoutMode.value = diff === 3600 ? 'slot' : 'hour';
  }
}, { deep: true });

const settings = ref(JSON.parse(localStorage.getItem('priceSettings')) || {
  cheapThreshold: 20,
  expensiveThreshold: 50,
  cheapRange: 15,
  expensiveRange: 15
});

const averagePrice = computed(() => {
  // Use allPriceData for average calculation if provided, otherwise use priceData
  const dataToUse = props.allPriceData || props.priceData;
  
  if (!dataToUse.length) return 0;
  const sum = dataToUse.reduce((acc, price) => acc + parseFloat(calculatePrice(price)), 0);
  return sum / dataToUse.length;
});

const getRowClass = (price) => {
  const priceValue = parseFloat(calculatePrice(price));
  return getPriceClass(
    priceValue, 
    averagePrice.value, 
    settings.value, 
    isCurrentHour(price.timestamp, intervalSeconds.value)
  );
};

const getRowInfo = (price) => {
  const priceValue = parseFloat(calculatePrice(price));
  return { classes: getPriceClass(
    priceValue, 
    averagePrice.value, 
    settings.value, 
    isCurrentHour(price.timestamp, intervalSeconds.value)
  ).classes };
};

const isCurrentHourClass = (timestamp) => {
  return isCurrentHour(timestamp, intervalSeconds.value) ? 'fw-bold border border-dark' : '';
};

const formatTimeLabel = (timestamp) => {
  const m = moment.unix(timestamp);
  const hour = m.format('HH');
  const minute = m.format('mm');
  return `${hour}<sup>${minute}</sup>`;
};

const formatHourLabel = (timestamp) => {
  const m = moment.unix(timestamp);
  return m.format('HH');
};

const formatMinuteLabel = (timestamp) => {
  const m = moment.unix(timestamp);
  const minute = m.format('mm');
  return `<sup>${minute}</sup>`;
};

const getPeriodLabel = (timestamp) => {
  const period = getTimePeriod(timestamp);
  // Map period to display labels
  const labels = {
    'night': 'Night',
    'morning': 'Morning',
    'day': 'Day',
    'evening': 'Evening'
  };
  return labels[period] || period;
};

const slotsPerHour = computed(() => (intervalSeconds.value === 900 ? 4 : 1));

const groupedByHour = computed(() => {
  if (!props.priceData || props.priceData.length === 0) return [];

  // Group by timestamp order to handle DST correctly
  // During DST fall back, the same hour appears twice - we'll create separate rows
  // During DST spring forward, one hour is skipped - that's fine, just fewer rows
  const sortedData = [...props.priceData].sort((a, b) => a.timestamp - b.timestamp);
  
  const groups = [];
  let currentGroup = null;
  
  sortedData.forEach(item => {
    const m = moment.unix(item.timestamp);
    const date = m.format('YYYY-MM-DD');
    const hour = parseInt(m.format('HH'), 10);
    const hourStr = m.format('HH');
    const lastSlot = currentGroup?.slots[currentGroup.slots.length - 1];
    
    // Start a new group if:
    // 1. No current group
    // 2. Different date
    // 3. Different hour number (handles hour transitions for 15-min intervals)
    // 4. Timestamp difference is > 1 hour (new hour or DST transition)
    // 5. Current group is full (slotsPerHour slots) - this handles DST fall back where same hour repeats
    const hourChanged = currentGroup && currentGroup.hour !== hourStr;
    const isNewHour = !lastSlot || (item.timestamp - lastSlot.timestamp) > 3600;
    const isGroupFull = currentGroup && currentGroup.slots.length >= slotsPerHour.value;
    
    if (!currentGroup || currentGroup.date !== date || hourChanged || isNewHour || isGroupFull) {
      // Save previous group if it exists
      if (currentGroup) {
        // Pad previous group to slotsPerHour
        const padded = [...currentGroup.slots];
        while (padded.length < slotsPerHour.value) padded.push(null);
        currentGroup.slots = padded.slice(0, slotsPerHour.value);
        groups.push(currentGroup);
      }
      
      // Start new group
      currentGroup = {
        key: `${date}-${hourStr}-${item.timestamp}`, // Include timestamp to handle duplicate hours
        date,
        hour: hourStr,
        slots: [item]
      };
    } else {
      // Add to current group
      currentGroup.slots.push(item);
    }
  });
  
  // Don't forget the last group
  if (currentGroup) {
    const padded = [...currentGroup.slots];
    while (padded.length < slotsPerHour.value) padded.push(null);
    currentGroup.slots = padded.slice(0, slotsPerHour.value);
    groups.push(currentGroup);
  }

  return groups;
});
</script>

<template>
  <div v-if="!hasEnoughData" class="alert alert-warning" role="alert">
    <span v-html="$t('table.noData').replace('\n', '<br>')"></span>
  </div>
  <div class="table-responsive">
    <table class="table table-hover align-middle">
      <thead>
        <tr>
          <th v-if="layoutMode === 'slot'">{{ $t('table.timeHeader') }}</th>
          <th v-if="layoutMode === 'slot'">{{ $t('table.priceHeaderShort') }}</th>
          <th v-else></th>
          <th :colspan="layoutMode === 'slot' ? 0 : slotsPerHour * 2" class="text-end sticky-top bg-body">
            <div class="d-flex align-items-center justify-content-end gap-2">
              <span class="fw-bold mb-0">{{ $t('table.averageLabel') }}</span>
              <span class="badge bg-primary">{{ averagePrice.toFixed(3) }} ct/kWh</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody v-if="layoutMode === 'slot'">
        <tr 
          v-for="price in priceData" 
          :key="price.timestamp" 
          :class="[
            getRowInfo(price).classes,
            isCurrentHourClass(price.timestamp)
          ]"
        >
          <td v-html="formatPriceHours(price.timestamp, intervalSeconds)"></td>
          <td>{{ calculatePrice(price).toFixed(3) }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="group in groupedByHour" :key="group.key">
          <td>
            <span v-if="group.slots[0]" v-html="formatHourLabel(group.slots[0].timestamp)"></span>
          </td>
          <template v-for="(slot, idx) in group.slots" :key="idx">
            <td
              v-if="slot"
              v-html="formatMinuteLabel(slot.timestamp)"
              :class="[
                getRowInfo(slot).classes,
                isCurrentHourClass(slot.timestamp)
              ]"
            ></td>
            <td v-else></td>
            <td
              v-if="slot"
              :class="[
                getRowInfo(slot).classes,
                isCurrentHourClass(slot.timestamp)
              ]"
            >
              {{ calculatePrice(slot).toFixed(3) }}
            </td>
            <td v-else></td>
          </template>
        </tr>
      </tbody>
    </table>
    <div class="d-flex justify-content-center mt-3">
      <div class="btn-group btn-group-sm" role="group" aria-label="Layout toggle">
        <button
          type="button"
          class="btn"
          :class="layoutMode === 'slot' ? 'btn-primary' : 'btn-outline-primary'"
          @click="layoutMode = 'slot'"
        >
          {{ $t('table.perHour') }}
        </button>
        <button
          type="button"
          class="btn"
          :class="layoutMode === 'hour' ? 'btn-primary' : 'btn-outline-primary'"
          @click="layoutMode = 'hour'"
        >
          {{ $t('table.perInterval') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mobile: compact table to fit without horizontal scrolling */
@media (max-width: 767.98px) {
  .table-responsive {
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    padding-left: 0.25rem;
    padding-right: 0.25rem;
    overflow-x: visible;
  }
  
  .table-responsive .table {
    margin-bottom: 0;
    font-size: 0.75rem;
  }
  
  .table th,
  .table td {
    padding: 0.25rem 0.35rem;
    white-space: nowrap;
  }
  
  /* Compact header */
  .table thead th {
    font-size: 0.7rem;
    font-weight: 600;
  }
  
  /* Hide average badge on mobile in grouped view */
  .table thead th .badge {
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
  }
  
  .table thead th .fw-bold {
    font-size: 0.7rem;
  }
  
  /* Ensure sticky header doesn't hide content */
  .sticky-top {
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  /* Compact buttons */
  .btn-group-sm .btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }
}
</style>
