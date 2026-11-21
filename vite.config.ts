import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',  // Use .json instead of .webmanifest for nginx compatibility
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'DevPad',
        short_name: 'DevPad',
        description: 'The intelligent scratchpad for engineers',
        theme_color: '#1e1e1e',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2,ttf,wasm}']
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor') || id.includes('@monaco-editor/react')) return 'monaco-editor'
            if (id.includes('reactflow')) return 'reactflow'
            if (id.includes('dexie')) return 'db'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) return 'react-vendor'
          }
        }
      }
    }
  }
})
