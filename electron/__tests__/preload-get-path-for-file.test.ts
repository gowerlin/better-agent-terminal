/**
 * T0435 / BUG-107: preload exposes `shell.getPathForFile` backed by Electron's
 * `webUtils.getPathForFile` (Electron 32+ dropped DOM `File.path`), without putting the
 * `webUtils` object itself on `window.electronAPI`.
 */
import { describe, expect, test, vi } from 'vitest'

const { webUtilsGetPathForFile, exposeInMainWorld } = vi.hoisted(() => ({
  webUtilsGetPathForFile: vi.fn((file: File) => `C:\\from-webUtils\\${file.name}`),
  exposeInMainWorld: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
  webUtils: { getPathForFile: webUtilsGetPathForFile },
}))

describe('preload shell.getPathForFile', () => {
  test('delegates to webUtils.getPathForFile without exposing webUtils', async () => {
    await import('../preload')
    const call = exposeInMainWorld.mock.calls.find(([key]) => key === 'electronAPI')
    expect(call).toBeDefined()
    const exposed = call![1] as { shell: { getPathForFile: (f: File) => string }; webUtils?: unknown }
    const file = new File(['x'], 'a.txt')

    expect(exposed.shell.getPathForFile(file)).toBe('C:\\from-webUtils\\a.txt')
    expect(webUtilsGetPathForFile).toHaveBeenCalledWith(file)
    expect(exposed.webUtils).toBeUndefined()
  })
})
