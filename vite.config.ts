import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
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
                'whisper-node-addon',
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-unicode11'],
          'hljs': ['highlight.js'],
        }
      }
    }
  }
})
