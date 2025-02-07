import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'stream', 'http', 'https', 'os', 'assert', 'url', 'zlib'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3000,
    open: true
  },
  define: {
    'process.env': process.env,
    global: {},
  },
  build: {
    rollupOptions: {
      external: ['fsevents']
    }
  }
}) 