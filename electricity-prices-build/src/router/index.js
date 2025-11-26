import { createRouter, createWebHistory } from 'vue-router'
import TodayView from '../views/TodayView.vue'
import UpcomingPrices from '../components/UpcomingPrices.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/upcoming'
    },
    {
      path: '/today',
      name: 'today',
      component: TodayView
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: {
        title: 'Settings'
      }
    },
    {
      path: '/todayprices',
      component: () => import('../views/JsonPriceView.vue')
    },
    {
      path: '/futureprices',
      component: () => import('../views/JsonFuturePriceView.vue')
    },
    {
      path: '/upcoming',
      name: 'upcoming',
      component: () => import('../views/UpcomingPricesView.vue')
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('../views/StatusView.vue'),
      meta: {
        title: 'System Status'
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: {
        title: 'About'
      }
    }
  ]
})

export default router
