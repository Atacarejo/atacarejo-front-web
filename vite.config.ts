import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // O bundle UMD do @tiendanube/nexo referencia `global` (Node), que não existe no browser
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Se usar túnel (ngrok/cloudflared), adicione o host aqui, ex.: ['.ngrok-free.app']
    // allowedHosts: [],
  },
})
