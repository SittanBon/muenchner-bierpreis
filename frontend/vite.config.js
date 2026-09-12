import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // useApi.js now calls same-origin relative "/api" paths (so the built app
    // works served from the Node backend in production). In dev the frontend
    // runs on its own Vite port, so proxy /api through to the Express server
    // instead — otherwise those requests would hit Vite itself and 404.
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
})
