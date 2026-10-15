import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GestorDeFinanças',
        short_name: 'Finanças',
        lang: 'pt-BR',
        display: 'standalone',
        background_color: '#F3F5F4',
        theme_color: '#1F6F4A',
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // dado financeiro nunca fica em cache offline: a API sempre vai na rede
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // em desenvolvimento o Vite repassa /api para o back-end, sem CORS
    proxy: { '/api': 'http://127.0.0.1:3100' },
  },
})
