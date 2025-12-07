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

/**
 * Vite plugin to generate sitemap.xml dynamically at build time
 * Uses accurate lastmod dates based on content type:
 * - Dynamic pages (price data): current date
 * - Static pages: file modification date
 */
export function sitemapPlugin() {
  let outputDir = 'dist'
  let rootDir = ''
  
  const generateSitemap = () => {
      // Read package.json to get homepage
      const packageJsonPath = new URL('./package.json', import.meta.url)
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      
      const baseUrl = process.env.VITE_BASE_URL || 
                     packageJson.homepage || 
                     'https://elektra.teletigras.lt'
      
      const today = new Date().toISOString().split('T')[0]
      
      // Get last modification dates for static pages
      const aboutViewPath = resolve(rootDir, 'src/views/AboutView.vue')
      const settingsViewPath = resolve(rootDir, 'src/views/SettingsView.vue')
      const statusViewPath = resolve(rootDir, 'src/views/StatusView.vue')
      const routerPath = resolve(rootDir, 'src/router/index.js')
      
      // Use file modification date for static pages, current date for dynamic content
      const aboutLastMod = getFileLastMod(aboutViewPath)
      const settingsLastMod = getFileLastMod(settingsViewPath)
      const statusLastMod = getFileLastMod(statusViewPath)
      // Use router or app file for homepage/upcoming (they're dynamic but structure changes less)
      const appLastMod = getFileLastMod(routerPath)
      
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${appLastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/upcoming</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/today</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/settings</loc>
    <lastmod>${settingsLastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${aboutLastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/status</loc>
    <lastmod>${statusLastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>
`
      
      // Write to output directory
      const outputPath = resolve(process.cwd(), outputDir, 'sitemap.xml')
      writeFileSync(outputPath, sitemap, 'utf-8')
      console.log(`✓ Generated sitemap.xml with accurate lastmod dates at ${outputPath}`)
    }
  
  return {
    name: 'sitemap-generator',
    configResolved(config) {
      outputDir = config.build.outDir || 'dist'
      rootDir = config.root || process.cwd()
    },
    closeBundle() {
      // Generate sitemap after build is complete
      generateSitemap()
    }
  }
}

