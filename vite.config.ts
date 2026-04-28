/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// vitest mode: skip electron + renderer plugins (they shim Node built-ins
// like `node:stream`/`node:crypto` for Electron renderer, which breaks
// vitest's pure-Node test runner — see T0317).
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      // T0325 — integration tests for electron/remote modules
      'electron/remote/__tests__/**/*.test.ts',
      // T0348 / BUG-078 — drift telemetry relocated to electron/ (D090 guard)
      'electron/__tests__/**/*.test.ts',
      // T0342 — Windows/MSYS regression guard for bat-terminal helper
      'tests/bat-terminal-msys.test.mjs',
    ],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'],
  },
  plugins: isTest ? [react()] : [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                '@lydell/node-pty',
                'ws',
                'bufferutil',
                'utf-8-validate',
                '@kutalia/whisper-node-addon',
                /\.node$/,
              ]
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      // Terminal Server — independent Node.js process forked by main.ts (PLAN-008)
      // Outputs to dist-electron/terminal-server.js
      // NOTE: This file must be excluded from ASAR in electron-builder config
      //       (asarUnpack: ["dist-electron/terminal-server.js"]) for fork() to work
      //       in the packaged app.
      {
        entry: 'electron/terminal-server.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                '@lydell/node-pty',
                'ws',
                'bufferutil',
                'utf-8-validate',
                /\.node$/,
              ]
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      external: ['@lydell/node-pty'],
      output: {
        // PLAN-029 R5 + T0309: split setup-wizard out so wizard regressions
        // don't bloat or invalidate the launch chunk. Function form lets us
        // catch every file under src/components/setup-wizard/ without
        // listing each step file individually.
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@xterm/')) {
            return 'xterm'
          }
          if (id.includes('node_modules/highlight.js/')) {
            return 'hljs'
          }
          // Normalize Windows backslashes before matching.
          const normalized = id.replace(/\\/g, '/')
          if (normalized.includes('/src/components/setup-wizard/')) {
            return 'setup-wizard'
          }
          return undefined
        },
      }
    }
  }
})
