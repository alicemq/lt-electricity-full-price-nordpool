<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomMenu from './components/BottomMenu.vue'
import { initializeCache, startSmartSync, stopSmartSync } from './services/priceService'
import { initializePriceConfig } from './services/priceConfigService'

const route = useRoute()
const showBottomMenu = computed(() => route.meta.kiosk !== true)

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
  <div class="app-container" :class="{ 'app-container--kiosk': !showBottomMenu }">
    <RouterView :key="route.name" />
  </div>
  <BottomMenu v-if="showBottomMenu" />
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
}
.app-container {
  padding-bottom: 100px; /* Space for fixed bottom menu with header */
}
.app-container--kiosk {
  padding-bottom: 0;
}
</style>
