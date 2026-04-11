import { _electron as electron, test, expect } from '@playwright/test';
import path from 'node:path';

test('launches the Electron app and reads a non-empty window title', async () => {
  const runtimeId = `e2e-smoke-${Date.now()}`;
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..'), `--runtime=${runtimeId}`],
  });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    const title = await window.title();
    expect(title.trim().length).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});
