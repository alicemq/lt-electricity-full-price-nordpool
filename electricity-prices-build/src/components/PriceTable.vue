<script setup>
import { computed, ref, watch } from 'vue';
import moment from 'moment-timezone';
import { formatPriceHours, isCurrentHour } from '../services/timeService';
import { calculatePrice } from '../services/priceCalculationService';
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
    const lastSlot = currentGroup?.slots[currentGroup.slots.length - 1];
    
    // Start a new group if:
    // 1. No current group
    // 2. Different date
    // 3. Timestamp difference is > 1 hour (new hour or DST transition)
    // 4. Current group is full (slotsPerHour slots) - this handles DST fall back where same hour repeats
    const isNewHour = !lastSlot || (item.timestamp - lastSlot.timestamp) > 3600;
    const isGroupFull = currentGroup && currentGroup.slots.length >= slotsPerHour.value;
    
    if (!currentGroup || currentGroup.date !== date || isNewHour || isGroupFull) {
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
        key: `${date}-${hour}-${item.timestamp}`, // Include timestamp to handle duplicate hours
        date,
        hour: m.format('HH'),
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
          <th :colspan="layoutMode === 'slot' ? 2 : (1 + slotsPerHour * 2)" class="text-end sticky-top bg-body">
            <div class="d-flex align-items-center justify-content-end gap-2">
              <span class="fw-bold mb-0">{{ $t('table.averageLabel') }}</span>
              <span class="badge bg-primary">{{ averagePrice.toFixed(2) }} ct/kWh</span>
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
          <td>{{ calculatePrice(price) }}</td>
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
              {{ calculatePrice(slot) }}
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
/* Remove all custom styling and rely on Bootstrap classes */
</style>
