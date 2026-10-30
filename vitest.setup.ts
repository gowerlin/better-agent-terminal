/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom/vitest'

// T0712 — Node 25+ defines its own `localStorage` / `sessionStorage` on globalThis
// (a getter that returns undefined without `--localstorage-file`). vitest's jsdom
// environment skips window keys that already exist on the global, so tests read
// Node's undefined instead of jsdom's Storage. Point both back at jsdom's window.
// Defined unconditionally: reading Node's getter first would print its ExperimentalWarning.
// On Node 24 vitest already exposes the same jsdom objects, so this changes nothing there;
// node-environment files have no `jsdom` global and are left alone.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window
if (jsdomWindow) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: jsdomWindow[key],
      configurable: true,
      writable: true,
    })
  }
}
