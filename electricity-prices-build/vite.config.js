import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { sitemapPlugin } from './vite-plugin-sitemap.js'

// Read package.json to get homepage
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function docsRedirectPlugin() {
  return {
    name: 'docs-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/docs' || req.url === '/docs/') {
          res.writeHead(302, { Location: '/api/' })
          res.end()
          return
        }
        next()
      })
    },
  }
}

function googleSiteVerificationPlugin(verificationCode) {
  return {
    name: 'google-site-verification',
    transformIndexHtml(html) {
      if (!verificationCode) {
        return html
      }
      return html.replace(
        '<!-- google-site-verification-stub -->',
        `<meta name="google-site-verification" content="${verificationCode}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const googleVerification = env.VITE_GOOGLE_SITE_VERIFICATION || ''

  return {
  plugins: [
    vue(),
    sitemapPlugin(),
    googleSiteVerificationPlugin(googleVerification),
    docsRedirectPlugin(),
  ],
  define: {
    // Inject homepage from package.json as environment variable
    'import.meta.env.VITE_HOMEPAGE': JSON.stringify(packageJson.homepage || ''),
  },
  build: {
    // Optimize for Google Core Web Vitals
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vendor'
            }
            if (id.includes('bootstrap')) {
              return 'ui'
            }
            if (id.includes('moment-timezone') || id.includes('axios')) {
              return 'utils'
            }
            // Other node_modules
            return 'vendor-other'
          }
        }
      }
    },
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Minify for production (esbuild is faster and default)
    minify: 'esbuild',
    // Remove console.log in production via esbuild
    esbuild: {
      drop: ['console', 'debugger']
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://backend:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/v1/, '/api/v1'),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[${new Date().toISOString()}] Proxying to Backend: ${req.method} ${req.url} -> ${options.target}${proxyReq.path}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error(`[${new Date().toISOString()}] Backend proxy error:`, err.message);
          });
        }
      },
      '/api': {
        target: 'http://swagger-ui:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[${new Date().toISOString()}] Proxying to Swagger UI: ${req.method} ${req.url} -> ${options.target}${proxyReq.path}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error(`[${new Date().toISOString()}] Swagger UI proxy error:`, err.message);
          });
        }
      },
    }
  }
  }
})

