/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import fs from 'fs'
import path from 'path'

// T0887 (PLAN-066): emits electron/terminal-server/shared-conout-worker.cjs as dist-electron/shared-conout-worker.cjs
// (plain CommonJS run by worker_threads, so it is copied, not bundled; electron/terminal-server/shared-conout.ts).
const SHARED_CONOUT_WORKER_SOURCE = path.resolve(__dirname, 'electron/terminal-server/shared-conout-worker.cjs')
const sharedConoutWorkerAsset = () => ({
  name: 'bat-shared-conout-worker',
  buildStart(this: { addWatchFile: (id: string) => void }) {
    this.addWatchFile(SHARED_CONOUT_WORKER_SOURCE)
  },
  generateBundle(this: { emitFile: (file: { type: 'asset'; fileName: string; source: string }) => string }) {
    this.emitFile({ type: 'asset', fileName: 'shared-conout-worker.cjs', source: fs.readFileSync(SHARED_CONOUT_WORKER_SOURCE, 'utf8') })
  },
})

// vitest mode: skip electron + renderer plugins (they shim Node built-ins
// like `node:stream`/`node:crypto` for Electron renderer, which breaks
// vitest's pure-Node test runner — see T0317).
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

// vitest mode only (T0454): a CRLF checkout (core.autocrlf=true, no
// .gitattributes) leaves `#!/usr/bin/env node\r` on line 1 of scripts/*.mjs.
// Vite's SSR transform only recognises a hashbang ending in `\n`
// (`/^#!.*\n/`, and `.` stops at `\r`), so it hoists the rewritten imports
// above the `#!` and loading fails with `SyntaxError: Invalid or unexpected
// token`. Turning the hashbang into a line comment keeps every offset, so no
// source map is needed.
const crlfHashbang = () => ({
  name: 'bat:crlf-hashbang',
  enforce: 'pre' as const,
  transform(code: string) {
    if (!/^#![^\n]*\r\n/.test(code)) return null
    return { code: `//${code.slice(2)}`, map: null }
  },
})

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
      // T0408 — PLAN-037 remote-tools probe / parse
      'electron/remote-tools/__tests__/**/*.test.ts',
      // T0342 — Windows/MSYS regression guard for bat-terminal helper
      'tests/bat-terminal-msys.test.mjs',
      'tests/bat-notify-submit.test.mjs',
      // T0499 — bat-notify reports the server's id-less auth rejection as auth-failed
      'tests/bat-notify-auth-reject.test.mjs',
      // T0360 / BUG-082 — work order ID grammar + --workspace hint guard
      'tests/bat-terminal-workorder-id.test.mjs',
      // T0497 / BUG-114 — auth / invoke reply matched by frame id (broadcasts ignored)
      'tests/bat-terminal-response-correlation.test.mjs',
      // T0391 — dev-deploy-headless tool (arg parsing / build-config parse / dry-run)
      'scripts/__tests__/**/*.test.mjs',
    ],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'],
  },
  plugins: isTest ? [react(), crlfHashbang()] : [
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
          // T0887 (PLAN-066): the shared conout Worker script ships next to terminal-server.js (and is copied into
          // the Windows PTY holder by scripts/pty-holder.cjs); build.asarUnpack keeps it outside app.asar
          plugins: [sharedConoutWorkerAsset()],
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
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // T0878 / D299: do not bundle elkjs (`EPL-2.0 OR GPL-3.0-or-later`, ~1.5 MB). mermaid 12's lazy ELK
      // layout renderer imports `elkjs/lib/elk.bundled.js`; every `elkjs` specifier resolves to a stub whose
      // layout() rejects, so a diagram that asks for `layout: elk` / `flowchart-elk` gets mermaid's error
      // diagram and the rest of the preview renders (BAT itself uses `layout: 'dagre'`). Guarded by
      // scripts/__tests__/no-elkjs-in-dist.test.mjs; see docs/agent-guide/build-toolchain.md.
      { find: /^elkjs(?:\/.*)?$/, replacement: path.resolve(__dirname, './src/lib/elkjs-stub.ts') },
    ]
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
