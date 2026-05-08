import { defineConfig } from 'vite'
import path from 'node:path'
import os from 'node:os'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Move cache to temp to avoid Windows locking issues
  cacheDir: path.join(os.tmpdir(), 'vite-chat-cache'),
  optimizeDeps: {
    include: ['socket.io-client', 'debug', 'date-fns', 'emoji-picker-react']
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/api")
      }
    }
  },
  preview: {
    host: true,
    port: 4173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    }
  }
})
