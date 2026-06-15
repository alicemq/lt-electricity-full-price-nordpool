import { createRouter, createWebHistory } from 'vue-router'
import TodayView from '../views/TodayView.vue'
import UpcomingPrices from '../components/UpcomingPrices.vue'
import { setSEO, buildRouteStructuredData } from '../utils/seo'
import i18n from '../i18n'

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
      component: TodayView,
      meta: {
        title: {
          lt: 'Šiandienos kainos',
          en: 'Today\'s Prices'
        },
        description: {
          lt: 'Peržiūrėkite šiandienos Nord Pool elektros kainas su visais mokesčiais. Raskite geriausius laikus elektros vartojimui.',
          en: 'View today\'s Nord Pool electricity prices with all taxes. Find the best times for electricity consumption.'
        }
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: {
        title: {
          lt: 'Nustatymai',
          en: 'Settings'
        },
        description: {
          lt: 'Konfigūruokite elektros kainų rodymą: pasirinkite tarifo planą, PVM, tiekėjo maržą ir spalvų slenksčius.',
          en: 'Configure electricity price display: select tariff plan, VAT, vendor margin, and color thresholds.'
        }
      }
    },
    {
      path: '/todayprices',
      component: () => import('../views/JsonPriceView.vue'),
      meta: {
        title: {
          lt: 'JSON kainos',
          en: 'JSON Prices'
        },
        description: {
          lt: 'Elektros kainų duomenys JSON formatu.',
          en: 'Electricity price data in JSON format.'
        }
      }
    },
    {
      path: '/futureprices',
      component: () => import('../views/JsonFuturePriceView.vue'),
      meta: {
        title: {
          lt: 'Būsimos kainos JSON',
          en: 'Future Prices JSON'
        },
        description: {
          lt: 'Būsimų elektros kainų duomenys JSON formatu.',
          en: 'Future electricity price data in JSON format.'
        }
      }
    },
    {
      path: '/upcoming',
      name: 'upcoming',
      component: () => import('../views/UpcomingPricesView.vue'),
      meta: {
        title: {
          lt: 'Artimiausios kainos',
          en: 'Upcoming Prices'
        },
        description: {
          lt: 'Peržiūrėkite artimiausias Nord Pool elektros kainas. Planuokite elektros vartojimą iš anksto.',
          en: 'View upcoming Nord Pool electricity prices. Plan your electricity consumption in advance.'
        }
      }
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('../views/StatusView.vue'),
      meta: {
        title: {
          lt: 'Sistemos būsena',
          en: 'System Status'
        },
        description: {
          lt: 'Peržiūrėkite sistemos būseną, duomenų sinchronizacijos statusą ir API veikimą.',
          en: 'View system status, data synchronization status, and API health.'
        }
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: {
        title: {
          lt: 'Apie & Pagalba',
          en: 'About & Help'
        },
        description: {
          lt: 'Sužinokite daugiau apie elektros kainų programą, nustatymus ir kaip efektyviai naudotis sistema.',
          en: 'Learn more about the electricity prices application, settings, and how to use the system effectively.'
        }
      }
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('../views/EditorView.vue'),
      meta: {
        title: {
          lt: 'Išdėstymo redaktorius',
          en: 'Layout Editor'
        },
        description: {
          lt: 'Kurkite ir išsaugokite TV ar kiosk rodinių išdėstymus.',
          en: 'Build and save TV or kiosk display layouts.'
        }
      }
    },
    {
      path: '/display',
      name: 'display',
      component: () => import('../views/DisplayView.vue'),
      meta: {
        kiosk: true,
        title: {
          lt: 'Ekrano rodinys',
          en: 'Display Mode'
        },
        description: {
          lt: 'Bendrinamas TV arba kiosk rodinys su užkoduota išdėstymo nuoroda.',
          en: 'Shareable TV or kiosk view with an encoded layout link.'
        }
      }
    },
    {
      path: '/tv',
      name: 'tv',
      component: () => import('../views/DisplayView.vue'),
      meta: {
        kiosk: true,
        title: {
          lt: 'TV rodinys',
          en: 'TV Display'
        },
        description: {
          lt: 'Pilno ekrano TV rodinys su užkoduota išdėstymo nuoroda.',
          en: 'Fullscreen TV display with an encoded layout link.'
        }
      }
    }
  ]
})

// Navigation guard to update SEO meta tags and sync locale from ?lang= query
router.beforeEach((to, from, next) => {
  const queryLang = typeof to.query.lang === 'string' ? to.query.lang : null
  if (queryLang === 'en' || queryLang === 'lt') {
    i18n.global.locale.value = queryLang
    localStorage.setItem('locale', queryLang)
  }

  const locale = i18n.global.locale.value || 'lt'
  const meta = to.meta || {}
  
  const title = meta.title?.[locale] || meta.title || 'Elektros kaina LT'
  const description = meta.description?.[locale] || meta.description || 
    (locale === 'lt' 
      ? 'Rodykite Nord Pool elektros kainas su visais taikomais mokesčiais ir prievolėmis. Kainos atnaujinamos automatiškai.'
      : 'Display Nord Pool electricity prices with all applicable taxes and fees. Prices are updated automatically.')
  
  setSEO({
    title,
    description,
    url: to.fullPath,
    locale,
    structuredData: buildRouteStructuredData(to, locale),
  })
  
  next()
})

export default router
