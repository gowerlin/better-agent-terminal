import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: __dirname,
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.test.ts'],
  // Nested git worktrees (Kilo / Claude Code) carry their own e2e specs but no build output.
  testIgnore: ['**/node_modules/**', '**/.kilo/**', '**/.claude/worktrees/**'],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'e2e-results',
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
