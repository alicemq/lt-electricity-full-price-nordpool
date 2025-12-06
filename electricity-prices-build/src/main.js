import './assets/main.css'
// Import Bootstrap and Bootswatch Solar theme (bundled, not CDN)
import 'bootswatch/dist/solar/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

const app = createApp(App)
app.config.devtools = false
app.use(createPinia())
app.use(router)
app.use(i18n)
app.component('VueDatePicker', VueDatePicker)
app.mount('#app')
