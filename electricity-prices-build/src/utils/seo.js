/**
 * SEO utility functions for managing meta tags, structured data, and SEO-related content
 */

/**
 * Get the base URL for the application
 * Uses environment variable, package.json homepage, or falls back to current origin
 */
function getBaseUrl() {
  // Try environment variable first
  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL
  }
  
  // Try package.json homepage (set during build)
  if (import.meta.env.VITE_HOMEPAGE) {
    return import.meta.env.VITE_HOMEPAGE
  }
  
  // Fall back to current origin (works in browser)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // Last resort: return empty string (relative URLs)
  return ''
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
export function setOpenGraph({ title, description, image, url, type = 'website' }) {
  setMetaTag('og:title', title, 'property')
  setMetaTag('og:description', description, 'property')
  setMetaTag('og:type', type, 'property')
  setMetaTag('og:url', url || window.location.href, 'property')
  if (image) {
    setMetaTag('og:image', image, 'property')
  }
  setMetaTag('og:site_name', 'Elektros kaina LT', 'property')
  setMetaTag('og:locale', 'lt_LT', 'property')
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
  // Remove existing structured data scripts
  const existing = document.querySelectorAll('script[type="application/ld+json"]')
  existing.forEach(el => el.remove())
  
  // Handle both arrays and single objects
  const dataArray = Array.isArray(data) ? data : [data]
  
  // Add each structured data item
  dataArray.forEach(item => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(item)
    document.head.appendChild(script)
  })
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
  structuredData
}) {
  const baseUrl = getBaseUrl()
  const defaultImage = image || `${baseUrl}/android-chrome-512x512.png`
  const fullTitle = title ? `${title} | Elektros kaina LT su mokesčiais` : 'Elektros kaina LT su mokesčiais'
  const fullUrl = url ? `${baseUrl}${url}` : (typeof window !== 'undefined' ? window.location.href : baseUrl)
  
  setTitle(fullTitle)
  setDescription(description)
  setCanonical(fullUrl)
  setLanguage(locale)
  setOpenGraph({ title: fullTitle, description, image: defaultImage, url: fullUrl, type })
  setTwitterCard({ title: fullTitle, description, image: defaultImage })
  
  if (structuredData) {
    setStructuredData(structuredData)
  }
}

/**
 * Generate structured data for the electricity price website
 * Optimized for Google Rich Results
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
      availability: 'https://schema.org/InStock'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Elektros kaina LT',
      url: baseUrl
    },
    inLanguage: ['lt', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/today?date={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
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
    description: 'Nord Pool elektros kainų rodymo sistema su visais mokesčiais'
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
      item: item.url
    }))
  }
}

/**
 * Generate structured data for a price data page
 * Optimized for Google Dataset Rich Results
 */
export function generatePriceDataStructuredData({ date, averagePrice, country = 'LT', minPrice, maxPrice }) {
  const baseUrl = getBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Elektros kainos ${date} - ${country}`,
    description: `Nord Pool elektros kainos ${date} su visais mokesčiais. Vidutinė kaina: ${averagePrice} ct/kWh`,
    url: `${baseUrl}/today?date=${date}`,
    datePublished: date,
    dateModified: new Date().toISOString(),
    temporalCoverage: date,
    spatialCoverage: {
      '@type': 'Country',
      name: country === 'LT' ? 'Lithuania' : country === 'EE' ? 'Estonia' : country === 'LV' ? 'Latvia' : 'Finland'
    },
    creator: {
      '@type': 'Organization',
      name: 'Nord Pool',
      url: 'https://www.nordpoolgroup.com'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Elektros kaina LT',
      url: baseUrl
    },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: `${baseUrl}/api/v1/nps/prices/${date}`
    },
    ...(averagePrice && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: averagePrice,
        bestRating: maxPrice || averagePrice * 1.5,
        worstRating: minPrice || averagePrice * 0.5
      }
    }),
    keywords: 'elektros kaina, electricity prices, Nord Pool, Lithuania, energy market',
    inLanguage: 'lt'
  }
}

