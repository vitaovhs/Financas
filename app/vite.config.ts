import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Modos de build:
//  - padrão: app instalável (PWA) para hospedagem estática, conectado ao Supabase
//  - --mode demo: página única com tudo embutido (modo demonstração), para visualização
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    base: process.env.BASE_PATH ?? '/',
    plugins: [
      react(),
      demo
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Finanças',
              short_name: 'Finanças',
              description: 'Controle financeiro pessoal e da empresa',
              lang: 'pt-BR',
              start_url: '.',
              scope: '.',
              display: 'standalone',
              orientation: 'any',
              background_color: '#f3f4f6',
              theme_color: '#f3f4f6',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // Só a "casca" do app fica guardada; dados financeiros nunca são guardados no aparelho.
              globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
              navigateFallbackDenylist: [/^\/auth/, /^\/rest/],
              runtimeCaching: [],
            },
          }),
    ],
    build: { target: 'es2020', assetsInlineLimit: demo ? 100_000_000 : 4096 },
  }
})
