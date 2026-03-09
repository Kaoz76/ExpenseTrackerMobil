import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Yeni sürüm gelince otomatik güncelle
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Expense Tracker',
        short_name: 'ExpTracker',
        description: 'Track your expenses easily',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        display: 'standalone', // Tarayıcı çubuğunu gizle, uygulama gibi aç
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
             src: '/pwa-512x512.png',
             sizes: '512x512',
             type: 'image/png',
             purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});