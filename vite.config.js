import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // bind to all network interfaces so ngrok (or other remote tunnels) can reach the dev server
    host: true,
    // allow requests with ngrok host header (use 'all' for convenience while developing)
    allowedHosts: ['heliaean-bleakly-rosana.ngrok-free.dev'],
    open: true
  }
})