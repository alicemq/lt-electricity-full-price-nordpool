<template>
  <nav class="bottom-menu">
    <div class="bottom-menu-header">
      <h3 class="mb-0">{{ $t('nav.title') }}</h3>
    </div>
    <div class="bottom-menu-buttons">
      <button @click="goToday" :class="{ active: isActive('today') }">
        <span>{{ $t('nav.today') }}</span>
      </button>
      <button @click="goUpcoming" :class="{ active: isActive('upcoming') }">
        <span>{{ $t('nav.upcoming') }}</span>
      </button>
      <button @click="goSettings" :class="{ active: isActive('settings') }">
        <span>{{ $t('nav.settings') }}</span>
      </button>
      <!-- <button @click="goSwagger" :class="{ active: isActive('swagger') }">
        <span>API</span>
      </button> -->
    </div>
  </nav>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
const router = useRouter()
const route = useRoute()

function goToday() {
  router.push({ name: 'today' })
}
function goUpcoming() {
  router.push({ name: 'upcoming' })
}
function goSettings() {
  router.push({ name: 'settings' })
}
function goSwagger() {
  router.push({ name: 'swagger' })
}
function isActive(tab) {
  if (tab === 'today' && route.name === 'today') return true
  if (tab === 'upcoming' && route.name === 'upcoming') return true
  if (tab === 'settings' && route.name === 'settings') return true
  if (tab === 'swagger' && route.name === 'swagger') return true
  return false
}
</script>

<style scoped>
.bottom-menu {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 1000;
  padding: 0.5rem 0;
}
.bottom-menu-header {
  text-align: center;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #eee;
}
.bottom-menu-header h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}
.bottom-menu-buttons {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-top: 0.25rem;
}
.bottom-menu button,
.bottom-menu .api-link {
  background: none;
  border: none;
  outline: none;
  font: inherit;
  color: #333;
  padding: 0.5rem 1rem;
  cursor: pointer;
  flex: 1 1 0;
  text-align: center;
  transition: background 0.2s, color 0.2s;
}
.bottom-menu .active {
  color: #1976d2;
  font-weight: bold;
}
.bottom-menu button:active,
.bottom-menu .api-link:active {
  background: #f0f0f0;
}
@media (max-width: 600px) {
  .bottom-menu span {
    font-size: 0.9rem;
  }
  .bottom-menu-header h3 {
    font-size: 0.8rem;
  }
}
</style> 