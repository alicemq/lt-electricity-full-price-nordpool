import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
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
})

