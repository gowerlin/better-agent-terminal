// T0887: config for the BAT Terminal Server memory measurement only (not part of the repo's e2e suite).
// Run from the checkout root after `npm ci` + `npx vite build` (Windows):
//   $env:T0887_LABEL='shared'; npx playwright test -c experiments/node-pty-worker/bat-memory/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: __dirname,
  testMatch: ['*.spec.ts'],
  timeout: 900_000,
  fullyParallel: false,
  workers: 1,
  outputDir: '../../../e2e-results/t0887-bat-memory',
  reporter: [['list']],
})
