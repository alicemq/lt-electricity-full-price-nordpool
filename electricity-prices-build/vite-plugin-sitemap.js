import { writeFileSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

/**
 * Get file modification date in YYYY-MM-DD format
 */
function getFileLastMod(filePath) {
  try {
    const stats = statSync(filePath)
    return new Date(stats.mtime).toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function getRecentDates(days) {
  const dates = []
  const today = new Date()
  for (let i = 0; i < days; i += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
}

function hreflangLinks(baseUrl, path) {
  const ltHref = `${baseUrl}${path}`
  const separator = path.includes('?') ? '&' : '?'
  const enHref = `${baseUrl}${path}${separator}lang=en`
  return `    <xhtml:link rel="alternate" hreflang="lt" href="${ltHref}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ltHref}"/>`
}

function urlEntry({ baseUrl, path, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${baseUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangLinks(baseUrl, path)}
  </url>`
}

/**
 * Vite plugin to generate sitemap.xml dynamically at build time.
 * Build output is the sole source of truth; do not commit public/sitemap.xml.
 */
export function sitemapPlugin() {
  let outputDir = 'dist'
  let rootDir = ''

  const generateSitemap = () => {
    const packageJsonPath = new URL('./package.json', import.meta.url)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    const baseUrl = process.env.VITE_BASE_URL ||
      packageJson.homepage ||
      'https://elektra.teletigras.lt'

    const today = new Date().toISOString().split('T')[0]
    const recentDates = getRecentDates(14)

    const aboutViewPath = resolve(rootDir, 'src/views/AboutView.vue')
    const settingsViewPath = resolve(rootDir, 'src/views/SettingsView.vue')
    const statusViewPath = resolve(rootDir, 'src/views/StatusView.vue')
    const routerPath = resolve(rootDir, 'src/router/index.js')

    const aboutLastMod = getFileLastMod(aboutViewPath)
    const settingsLastMod = getFileLastMod(settingsViewPath)
    const statusLastMod = getFileLastMod(statusViewPath)
    const appLastMod = getFileLastMod(routerPath)

    const staticPages = [
      { path: '/', lastmod: appLastMod, changefreq: 'daily', priority: '1.0' },
      { path: '/upcoming', lastmod: today, changefreq: 'hourly', priority: '0.9' },
      { path: '/today', lastmod: today, changefreq: 'hourly', priority: '0.9' },
      { path: '/settings', lastmod: settingsLastMod, changefreq: 'monthly', priority: '0.5' },
      { path: '/about', lastmod: aboutLastMod, changefreq: 'monthly', priority: '0.6' },
      { path: '/status', lastmod: statusLastMod, changefreq: 'daily', priority: '0.4' },
    ]

    const datedTodayPages = recentDates.map((date) => ({
      path: `/today?date=${date}`,
      lastmod: date,
      changefreq: 'daily',
      priority: '0.8',
    }))

    const entries = [...staticPages, ...datedTodayPages]
      .map((entry) => urlEntry({ baseUrl, ...entry }))
      .join('\n')

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`

    const outputPath = resolve(process.cwd(), outputDir, 'sitemap.xml')
    writeFileSync(outputPath, sitemap, 'utf-8')
    console.log(`✓ Generated sitemap.xml (${entries.split('<url>').length - 1} URLs) at ${outputPath}`)
  }

  return {
    name: 'sitemap-generator',
    configResolved(config) {
      outputDir = config.build.outDir || 'dist'
      rootDir = config.root || process.cwd()
    },
    closeBundle() {
      generateSitemap()
    },
  }
}
