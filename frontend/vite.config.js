import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  // Prevent esbuild from crawling parent dirs for broken jsconfig/tsconfig
  esbuild: {
    tsconfigRaw: '{}'
  },
  optimizeDeps: {
    esbuildOptions: {
      tsconfigRaw: '{}'
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      },
      '/health': 'http://localhost:3001',
      '/calibration': 'http://localhost:3001',
      '/calibrate': 'http://localhost:3001',
      '/session': 'http://localhost:3001',
      '/sessions': 'http://localhost:3001',
      '/simulate': 'http://localhost:3001',
    }
  }
})
