import { test, expect } from '@playwright/test';
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation';

// Isolated runtime + env, and a teardown that answers the quit dialog (T0399).
const log = testLogger('smoke');

test('launches the Electron app and reads a non-empty window title', async () => {
  let inst: IsolatedInstance | undefined;
  try {
    inst = await launchIsolated('smoke', log);
    const title = await inst.win.title();
    expect(title.trim().length).toBeGreaterThan(0);
  } finally {
    await closeIsolated(inst, log);
  }
});
