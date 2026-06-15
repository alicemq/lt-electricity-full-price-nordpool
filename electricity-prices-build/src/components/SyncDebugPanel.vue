<script setup>
import { ref, onMounted } from 'vue';
import moment from 'moment-timezone';
import { getSyncDebugInfo, runSmartSync } from '../services/priceService';
import { getCountrySyncMarkers } from '../services/priceCacheService';

const debugInfo = ref(null);
const syncMarkers = ref({});
const isRefreshing = ref(false);

function refreshDebugInfo() {
  debugInfo.value = getSyncDebugInfo('lt');
  syncMarkers.value = getCountrySyncMarkers('lt');
}

async function triggerSync() {
  isRefreshing.value = true;
  try {
    await runSmartSync('lt');
    refreshDebugInfo();
  } finally {
    isRefreshing.value = false;
  }
}

function formatMs(ms) {
  if (!ms) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

function formatSyncedAt(ts) {
  return moment(ts).tz('Europe/Vilnius').format('YYYY-MM-DD HH:mm');
}

onMounted(refreshDebugInfo);
</script>

<template>
  <div class="card mt-4 sync-debug">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h6 mb-0">{{ $t('settings.syncDebugTitle') }}</h2>
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          :disabled="isRefreshing"
          @click="triggerSync"
        >
          {{ isRefreshing ? $t('settings.syncDebugRunning') : $t('settings.syncDebugRun') }}
        </button>
      </div>

      <template v-if="debugInfo">
        <dl class="row small mb-0">
          <dt class="col-sm-5">{{ $t('settings.syncDebugPhase') }}</dt>
          <dd class="col-sm-7"><code>{{ debugInfo.phase }}</code></dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugTargetDay') }}</dt>
          <dd class="col-sm-7">{{ debugInfo.targetReleaseDay }}</dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugNextWindow') }}</dt>
          <dd class="col-sm-7">{{ formatMs(debugInfo.nextWindowInMs) }}</dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugPoll') }}</dt>
          <dd class="col-sm-7">{{ formatMs(debugInfo.pollIntervalMs) }}</dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugToday') }}</dt>
          <dd class="col-sm-7">
            {{ debugInfo.todayCachedCount }}
            / {{ debugInfo.todayValidation.expectedMin }}–{{ debugInfo.todayValidation.expectedMax }}
            <span v-if="debugInfo.todayValidation.isComplete" class="text-success">✓</span>
          </dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugTomorrow') }}</dt>
          <dd class="col-sm-7">
            {{ debugInfo.tomorrowCachedCount }}
            / {{ debugInfo.tomorrowValidation.expectedMin }}–{{ debugInfo.tomorrowValidation.expectedMax }}
            <span v-if="debugInfo.tomorrowValidation.isComplete" class="text-success">✓</span>
          </dd>

          <dt class="col-sm-5">{{ $t('settings.syncDebugGaps') }}</dt>
          <dd class="col-sm-7">
            <span v-if="debugInfo.gaps.hasGaps" class="text-warning">
              {{ debugInfo.gaps.missingDays.join(', ') || 'ranges' }}
            </span>
            <span v-else class="text-success">{{ $t('settings.syncDebugNoGaps') }}</span>
          </dd>
        </dl>

        <div v-if="Object.keys(syncMarkers).length" class="mt-3">
          <h3 class="h6">{{ $t('settings.syncDebugMarkers') }}</h3>
          <ul class="list-unstyled small mb-0">
            <li v-for="(marker, date) in syncMarkers" :key="date">
              <code>{{ date }}</code>:
              {{ marker.recordCount }} MTU @ {{ marker.intervalSeconds }}s
              ({{ formatSyncedAt(marker.syncedAt) }})
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sync-debug {
  max-width: 600px;
  margin: 0 auto;
}
</style>
