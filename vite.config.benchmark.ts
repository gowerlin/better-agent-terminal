/**
 * 獨立 Vite 設定給 T0154 benchmark — 不啟動 electron,純 React dev server。
 *
 * 啟動:npx vite --config vite.config.benchmark.ts
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/components/git-poc/benchmark'),
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-benchmark'),
    emptyOutDir: true,
  },
})
