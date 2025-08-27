import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        error: 'error.html'
      }
    }
  },
  preview: {
    allowedHosts: ['hunt-refund-production.up.railway.app', 'refund.hunt-tickets.com']
  }
})