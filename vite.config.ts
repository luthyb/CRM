import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = { '/api': { target: 'http://127.0.0.1:5174', changeOrigin: false } }

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
})
