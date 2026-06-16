<script setup>
import { computed } from 'vue';
import { calculatePrice } from '../../services/priceCalculationService';
import { formatPriceHours, isCurrentHour, filterUpcomingSlots } from '../../services/timeService';

const props = defineProps({
  priceData: {
    type: Array,
    required: true,
    default: () => [],
  },
  theme: {
    type: String,
    default: 'dark',
  },
  maxHours: {
    type: Number,
    default: 12,
  },
});

const intervalSeconds = computed(() => {
  if (props.priceData.length >= 2) {
    const diff = props.priceData[1].timestamp - props.priceData[0].timestamp;
    return diff > 0 ? diff : 3600;
  }
  return 3600;
});

const chartRows = computed(() => {
  const upcoming = filterUpcomingSlots(props.priceData, intervalSeconds.value)
    .slice(0, props.maxHours);

  if (upcoming.length === 0) {
    return props.priceData.slice(0, props.maxHours).map((row) => ({
      row,
      value: parseFloat(calculatePrice(row)),
      label: formatPriceHours(row.timestamp, intervalSeconds.value),
      isCurrent: isCurrentHour(row.timestamp, intervalSeconds.value),
    }));
  }

  return upcoming.map((row) => ({
    row,
    value: parseFloat(calculatePrice(row)),
    label: formatPriceHours(row.timestamp, intervalSeconds.value),
    isCurrent: isCurrentHour(row.timestamp, intervalSeconds.value),
  }));
});

const maxValue = computed(() => {
  const values = chartRows.value.map((entry) => entry.value);
  if (values.length === 0) return 1;
  return Math.max(...values, 1);
});

const themeClass = computed(() => (props.theme === 'light' ? 'display-chart--light' : 'display-chart--dark'));
</script>

<template>
  <div class="display-chart" :class="themeClass">
    <div
      v-for="entry in chartRows"
      :key="entry.row.timestamp"
      class="display-chart__row"
      :class="{ 'display-chart__row--current': entry.isCurrent }"
    >
      <div class="display-chart__label" v-html="entry.label" />
      <div class="display-chart__bar-track">
        <div
          class="display-chart__bar"
          :style="{ width: `${(entry.value / maxValue) * 100}%` }"
        />
      </div>
      <div class="display-chart__value">{{ entry.value.toFixed(2) }}</div>
    </div>
  </div>
</template>

<style scoped>
.display-chart {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}

.display-chart__row {
  display: grid;
  grid-template-columns: minmax(7rem, 12rem) 1fr minmax(5rem, 8rem);
  align-items: center;
  gap: 1.5rem;
}

.display-chart__row--current .display-chart__label,
.display-chart__row--current .display-chart__value {
  font-weight: 700;
}

.display-chart__label {
  font-size: clamp(1.5rem, 2.5vw, 2.75rem);
  line-height: 1.1;
}

.display-chart__bar-track {
  height: clamp(2rem, 4vw, 3.5rem);
  border-radius: 0.5rem;
  overflow: hidden;
}

.display-chart__bar {
  height: 100%;
  border-radius: 0.5rem;
  transition: width 0.3s ease;
}

.display-chart__value {
  font-size: clamp(1.75rem, 3vw, 3rem);
  text-align: right;
  line-height: 1.1;
}

.display-chart--dark {
  color: #f5f5f5;
}

.display-chart--dark .display-chart__bar-track {
  background: rgba(255, 255, 255, 0.12);
}

.display-chart--dark .display-chart__bar {
  background: linear-gradient(90deg, #4cc9f0, #4361ee);
}

.display-chart--light {
  color: #111;
}

.display-chart--light .display-chart__bar-track {
  background: rgba(0, 0, 0, 0.08);
}

.display-chart--light .display-chart__bar {
  background: linear-gradient(90deg, #0077b6, #023e8a);
}
</style>
