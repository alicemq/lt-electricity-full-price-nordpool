<script setup>
import { RouterLink } from 'vue-router'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
</script>

<template>
  <div class="container">
    <div class="about-page">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="mb-0">{{ $t('about.title') }}</h1>
        <LanguageSwitcher />
      </div>
      
      <div class="card mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3">{{ $t('about.descriptionTitle') }}</h2>
          <p>{{ $t('about.description') }}</p>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3">{{ $t('about.settingsTitle') }}</h2>
          
          <h3 class="h6 mt-3 mb-2">{{ $t('about.esoSettingsTitle') }}</h3>
          <ul>
            <li><strong>{{ $t('about.timezoneLabel') }}:</strong> {{ $t('about.timezoneHelp') }}</li>
            <li><strong>{{ $t('about.planLabel') }}:</strong> {{ $t('about.planHelp') }}</li>
            <li><strong>{{ $t('about.vatLabel') }}:</strong> {{ $t('about.vatHelp') }}</li>
            <li><strong>{{ $t('about.vendorMarginLabel') }}:</strong> {{ $t('about.vendorMarginHelp') }}</li>
            <li><strong>{{ $t('about.includeExtraTariffsLabel') }}:</strong> {{ $t('about.includeExtraTariffsHelp') }}</li>
          </ul>

          <h3 class="h6 mt-3 mb-2">{{ $t('about.colorThresholdsTitle') }}</h3>
          <ul>
            <li><strong>{{ $t('about.cheapThresholdLabel') }}:</strong> {{ $t('about.cheapThresholdHelp') }}</li>
            <li><strong>{{ $t('about.expensiveThresholdLabel') }}:</strong> {{ $t('about.expensiveThresholdHelp') }}</li>
            <li><strong>{{ $t('about.rangesLabel') }}:</strong> {{ $t('about.rangesHelp') }}</li>
          </ul>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3">{{ $t('about.dataSourceTitle') }}</h2>
          <p>{{ $t('about.dataSource') }}</p>
          <p class="mb-0"><small>{{ $t('about.dataAvailability') }}</small></p>
        </div>
      </div>

      <div class="text-center mt-4">
        <RouterLink to="/settings" class="btn btn-primary">{{ $t('about.backToSettings') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.about-page ul {
  margin-bottom: 0;
}

.about-page li {
  margin-bottom: 0.5rem;
}
</style>

