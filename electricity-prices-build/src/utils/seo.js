/**
 * SEO utility functions for managing meta tags, structured data, and SEO-related content
 */

const SUPPORTED_LOCALES = ['lt', 'en']

/**
 * Get the base URL for the application
 * Uses environment variable, package.json homepage, or falls back to current origin
 */
export function getBaseUrl() {
  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL
  }

  if (import.meta.env.VITE_HOMEPAGE) {
    return import.meta.env.VITE_HOMEPAGE
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

/**
 * Build absolute page URL with optional locale query for hreflang alternates.
 * Lithuanian is the default locale and uses the canonical path without ?lang=.
 */
export function buildLocalizedUrl(path, locale = 'lt') {
  const baseUrl = getBaseUrl()
  const [pathname, search = ''] = path.split('?')
  const params = new URLSearchParams(search)

  if (locale === 'en') {
    params.set('lang', 'en')
  } else {
    params.delete('lang')
  }

  const query = params.toString()
  return `${baseUrl}${pathname}${query ? `?${query}` : ''}`
}

/**
 * Update or create a meta tag
 */
function setMetaTag(name, content, attribute = 'name') {
  let element = document.querySelector(`meta[${attribute}="${name}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

/**
 * Update hreflang alternate links for supported locales.
 * Uses ?lang=en for English; Lithuanian remains the canonical default URL.
 */
export function setHreflang(path) {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())

  const alternates = [
    { hreflang: 'lt', href: buildLocalizedUrl(path, 'lt') },
    { hreflang: 'en', href: buildLocalizedUrl(path, 'en') },
    { hreflang: 'x-default', href: buildLocalizedUrl(path, 'lt') },
  ]

  alternates.forEach(({ hreflang, href }) => {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = hreflang
    link.href = href
    document.head.appendChild(link)
  })
}

/**
 * Update the page title
 */
export function setTitle(title) {
  document.title = title
}

/**
 * Update meta description
 */
export function setDescription(description) {
  setMetaTag('description', description)
}

/**
 * Update Open Graph meta tags
 */
export function setOpenGraph({ title, description, image, url, type = 'website', locale = 'lt' }) {
  setMetaTag('og:title', title, 'property')
  setMetaTag('og:description', description, 'property')
  setMetaTag('og:type', type, 'property')
  setMetaTag('og:url', url || window.location.href, 'property')
  if (image) {
    setMetaTag('og:image', image, 'property')
  }
  setMetaTag('og:site_name', 'Elektros kaina LT', 'property')
  setMetaTag('og:locale', locale === 'en' ? 'en_US' : 'lt_LT', 'property')
}

/**
 * Update Twitter Card meta tags
 */
export function setTwitterCard({ title, description, image }) {
  setMetaTag('twitter:card', 'summary_large_image')
  setMetaTag('twitter:title', title)
  setMetaTag('twitter:description', description)
  if (image) {
    setMetaTag('twitter:image', image)
  }
}

/**
 * Update canonical URL
 */
export function setCanonical(url) {
  let element = document.querySelector('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', url)
}

/**
 * Update HTML lang attribute
 */
export function setLanguage(locale) {
  document.documentElement.setAttribute('lang', locale === 'lt' ? 'lt' : 'en')
}

/**
 * Add or update structured data (JSON-LD)
 * Supports both single objects and arrays for multiple structured data items
 */
export function setStructuredData(data) {
  const existing = document.querySelectorAll('script[type="application/ld+json"]')
  existing.forEach((el) => el.remove())

  const dataArray = Array.isArray(data) ? data : [data]

  dataArray.forEach((item) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(item)
    document.head.appendChild(script)
  })
}

/**
 * Build breadcrumb items for a route
 */
export function getRouteBreadcrumbItems(route, locale = 'lt') {
  const baseUrl = getBaseUrl()
  const homeLabel = locale === 'lt' ? 'Pradžia' : 'Home'
  const items = [{ name: homeLabel, url: baseUrl }]

  const path = route.path
  if (path === '/' || path === '/upcoming') {
    return items
  }

  const title = route.meta?.title?.[locale] || route.meta?.title || route.name
  if (title) {
    items.push({ name: title, url: `${baseUrl}${route.fullPath}` })
  }

  return items
}

/**
 * Build default structured data bundle for a route
 */
export function buildRouteStructuredData(route, locale = 'lt', extraItems = []) {
  const breadcrumb = generateBreadcrumbStructuredData(getRouteBreadcrumbItems(route, locale))
  return [
    generateWebsiteStructuredData(),
    generateOrganizationStructuredData(),
    breadcrumb,
    ...extraItems,
  ]
}

/**
 * Set comprehensive SEO meta tags for a page
 */
export function setSEO({
  title,
  description,
  image,
  url,
  type = 'website',
  locale = 'lt',
  structuredData,
}) {
  const baseUrl = getBaseUrl()
  const defaultImage = image || `${baseUrl}/android-chrome-512x512.png`
  const fullTitle = title ? `${title} | Elektros kaina LT su mokesčiais` : 'Elektros kaina LT su mokesčiais'
  const path = url || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')
  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`

  setTitle(fullTitle)
  setDescription(description)
  setCanonical(buildLocalizedUrl(path, locale))
  setLanguage(locale)
  setHreflang(path)
  setOpenGraph({ title: fullTitle, description, image: defaultImage, url: fullUrl, type, locale })
  setTwitterCard({ title: fullTitle, description, image: defaultImage })

  if (structuredData) {
    setStructuredData(structuredData)
  }
}

/**
 * Generate structured data for the electricity price website
 */
export function generateWebsiteStructuredData() {
  const baseUrl = getBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Elektros kaina LT su mokesčiais',
    alternateName: 'Electricity Prices Lithuania',
    description: 'Rodykite Nord Pool elektros kainas su visais taikomais mokesčiais ir prievolėmis. Kainos atnaujinamos automatiškai.',
    url: baseUrl,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    softwareVersion: '1.0',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Elektros kaina LT',
      url: baseUrl,
    },
    inLanguage: SUPPORTED_LOCALES,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/today?date={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Generate Organization structured data for Google Knowledge Graph
 */
export function generateOrganizationStructuredData() {
  const baseUrl = getBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Elektros kaina LT',
    alternateName: 'Electricity Prices Lithuania',
    url: baseUrl,
    logo: `${baseUrl}/android-chrome-512x512.png`,
    sameAs: [],
    description: 'Nord Pool elektros kainų rodymo sistema su visais mokesčiais',
  }
}

/**
 * Generate BreadcrumbList structured data for Google
 */
export function generateBreadcrumbStructuredData(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

const COUNTRY_NAMES = {
  LT: 'Lithuania',
  EE: 'Estonia',
  LV: 'Latvia',
  FI: 'Finland',
}

/**
 * Generate structured data for a price data page (valid Dataset schema)
 */
export function generatePriceDataStructuredData({ date, averagePrice, country = 'LT', minPrice, maxPrice }) {
  const baseUrl = getBaseUrl()
  const countryName = COUNTRY_NAMES[country] || country
  const pageUrl = `${baseUrl}/today?date=${date}`

  const variableMeasured = []
  if (averagePrice != null) {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: 'average electricity price',
      value: Number(averagePrice.toFixed(2)),
      unitText: 'ct/kWh',
    })
  }
  if (minPrice != null) {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: 'minimum electricity price',
      value: Number(minPrice.toFixed(2)),
      unitText: 'ct/kWh',
    })
  }
  if (maxPrice != null) {
    variableMeasured.push({
      '@type': 'PropertyValue',
      name: 'maximum electricity price',
      value: Number(maxPrice.toFixed(2)),
      unitText: 'ct/kWh',
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Elektros kainos ${date} - ${country}`,
    description: `Nord Pool elektros kainos ${date} su visais mokesčiais${averagePrice != null ? `. Vidutinė kaina: ${averagePrice.toFixed(2)} ct/kWh` : ''}.`,
    url: pageUrl,
    identifier: `${country}-${date}`,
    datePublished: date,
    dateModified: new Date().toISOString().split('T')[0],
    temporalCoverage: date,
    spatialCoverage: {
      '@type': 'Place',
      name: countryName,
    },
    creator: {
      '@type': 'Organization',
      name: 'Nord Pool',
      url: 'https://www.nordpoolgroup.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Elektros kaina LT',
      url: baseUrl,
    },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: `${baseUrl}/api/v1/nps/prices?date=${date}&country=${country}`,
    },
    ...(variableMeasured.length > 0 ? { variableMeasured } : {}),
    keywords: ['elektros kaina', 'electricity prices', 'Nord Pool', countryName, 'energy market'],
    inLanguage: ['lt', 'en'],
    isAccessibleForFree: true,
  }
}
