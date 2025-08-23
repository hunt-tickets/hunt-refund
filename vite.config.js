import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        accept: 'accept.html'
      }
    }
  },
  preview: {
    allowedHosts: ['hunt-refund-production.up.railway.app']
  }
})