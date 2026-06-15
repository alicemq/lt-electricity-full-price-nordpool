<script setup>
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { locale } = useI18n()
const route = useRoute()
const router = useRouter()

function setLocale(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)

  const query = { ...route.query }
  if (lang === 'en') {
    query.lang = 'en'
  } else {
    delete query.lang
  }

  router.replace({ path: route.path, query })
}
</script>

<template>
  <div class="btn-group btn-group-sm" role="group" aria-label="Language switcher">
    <button
      type="button"
      class="btn"
      :class="locale === 'lt' ? 'btn-primary' : 'btn-outline-primary'"
      @click="setLocale('lt')"
    >
      LT
    </button>
    <button
      type="button"
      class="btn"
      :class="locale === 'en' ? 'btn-primary' : 'btn-outline-primary'"
      @click="setLocale('en')"
    >
      EN
    </button>
  </div>
</template>


