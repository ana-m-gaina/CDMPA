import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../app',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/CDMService': 'http://localhost:4004',
      '/AdminService': 'http://localhost:4004',
      '/api': 'http://localhost:4004'
    }
  }
})
