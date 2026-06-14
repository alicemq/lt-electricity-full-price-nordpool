<script setup>
import { onMounted, onUnmounted } from 'vue'
import BottomMenu from './components/BottomMenu.vue'
import { initializeCache, startSmartSync, stopSmartSync } from './services/priceService'
import { initializePriceConfig } from './services/priceConfigService'

onMounted(() => {
  initializePriceConfig('lt').catch(err => {
    console.error('Price config initialization failed:', err)
  })

  initializeCache('lt').catch(err => {
    console.error('Cache initialization failed:', err)
  })

  startSmartSync('lt')
})

onUnmounted(() => {
  stopSmartSync()
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
