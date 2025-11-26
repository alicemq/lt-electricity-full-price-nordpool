<script setup>
import { useStorage } from '@vueuse/core';
import { watch, computed } from 'vue';
import { timeZones } from '../config/priceConfig';
import { getAvailablePlans, getMigratedPlan } from '../config/planVersionConfig';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const theDefault = {
  zone: "Four zones",
  plan: "Standart",
  vendorMargin: '0.02003',
  PVMIncluded: true,
  includeExtraTariffs: true
}

const state = useStorage('elecsettings', theDefault)

const includeExtraTariffs = computed(() => state.value.includeExtraTariffs !== false)

const currentDate = new Date().toISOString().split('T')[0];
const availablePlans = computed(() => getAvailablePlans(currentDate, state.value.zone));

watch(state, (newValue) => {
  const migratedPlan = getMigratedPlan(newValue.plan, currentDate);
  if (migratedPlan !== newValue.plan) {
    state.value.plan = migratedPlan;
  } else if (!availablePlans.value.includes(newValue.plan)) {
    state.value.plan = availablePlans.value[0];
  }
}, { deep: true })
</script>

<template>
  <div class="card settings-container mb-3">
    <div class="card-body">
      <h2 class="h5 mb-3">{{ $t('settings.esoTitle') }}</h2>

      <div class="mb-3">
        <div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            id="includeExtraTariffs"
            v-model="state.includeExtraTariffs"
          />
          <label class="form-check-label" for="includeExtraTariffs">
            {{ $t('settings.includeExtraTariffs') }}
          </label>
        </div>
        <small class="form-text text-muted">{{ $t('settings.includeExtraTariffsHelp') }}</small>
      </div>

      <div class="row justify-content-center">
        <div class="col">
          <label class="form-label d-block">{{ $t('settings.timezoneLabel') }}</label>
          <div
            class="form-check"
            v-for="zone in timeZones"
            :key="zone.id"
          >
            <input
              class="form-check-input"
              type="radio"
              :id="`zone-${zone.id}`"
              :value="zone.name"
              v-model="state.zone"
              :disabled="!includeExtraTariffs"
            />
            <label class="form-check-label" :for="`zone-${zone.id}`">
              {{ $t(`zones.${zone.name}`) }}
            </label>
          </div>
        </div>

        <div class="col">
          <label class="form-label d-block">{{ $t('settings.vatLabel') }}</label>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              id="vat-yes"
              v-model="state.PVMIncluded"
              :value="true"
            />
            <label class="form-check-label" for="vat-yes">
              {{ $t('settings.vatWith') }}
            </label>
          </div>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              id="vat-no"
              v-model="state.PVMIncluded"
              :value="false"
            />
            <label class="form-check-label" for="vat-no">
              {{ $t('settings.vatWithout') }}
            </label>
          </div>
        </div>
      </div>

      <div class="row justify-content-center">
        <div class="col">
          <label class="form-label d-block">{{ $t('settings.planLabel') }}</label>
          <div
            class="form-check"
            v-for="plan in availablePlans"
            :key="plan"
          >
            <input
              class="form-check-input"
              type="radio"
              :id="`plan-${plan}`"
              :value="plan"
              v-model="state.plan"
              :disabled="!includeExtraTariffs"
            />
            <label class="form-check-label" :for="`plan-${plan}`">
              {{ $t(`plans.${plan}`) }}
            </label>
          </div>
        </div>

        <div class="col">
          <label for="venmar" class="form-label">{{ $t('settings.vendorMarginLabel') }}</label>
          <div class="input-group">
          <input
            type="number"
            step="0.00001"
            class="form-control"
            name="vendorMargin"
            id="venmar"
            v-model="state.vendorMargin"
            :disabled="!includeExtraTariffs"
          />
          <span class="input-group-text">€/kWh</span>
        </div>

        </div>
      </div>

      <div class="row justify-content-center mt-3">
        <div class="col">
          <small class="h6">
            {{ $t('settings.planChangePrefix') }}
            <a href="https://mano.eso.lt/objects/change-private-plan" target="_blank" rel="noopener noreferrer">
              {{ $t('settings.planChangeLink') }}
            </a>
            {{ $t('settings.planChangeSuffix') }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 600px;
  margin: 0 auto;
}

.form-check-input:disabled + .form-check-label,
.form-control:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
