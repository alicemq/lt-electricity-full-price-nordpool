<script setup>
import { onMounted, onUnmounted } from 'vue'
import BottomMenu from './components/BottomMenu.vue'
import { initializeCache, startNextDayDataChecker, stopNextDayDataChecker } from './services/priceService'
import { initializePriceConfig } from './services/priceConfigService'

onMounted(() => {
  // Initialize price config cache for LT (default country) in background
  initializePriceConfig('lt').catch(err => {
    console.error('Price config initialization failed:', err)
  })
  
  // Initialize price data cache for LT in background
  initializeCache('lt').catch(err => {
    console.error('Cache initialization failed:', err)
  })
  
  // Start periodic checker for next day data (especially after 15:00 CET)
  // Check every 30 minutes
  startNextDayDataChecker('lt', 30)
  
  // TODO: Initialize config for other countries (ee, lv, fi) when needed
  // This can be done lazily when user switches country or in background
})

onUnmounted(() => {
  // Clean up interval when component is unmounted
  stopNextDayDataChecker()
})
</script>

<template>
  <div class="app-container">
    <RouterView />
  </div>
  <BottomMenu />
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
}
.app-container {
  padding-bottom: 100px; /* Space for fixed bottom menu with header */
}
</style>
