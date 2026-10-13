// @vitest-environment node
/**
 * BUG-116 / T0469: voice-opencc is imported at main.ts top level (via voice-handler),
 * so it must not load opencc-js until the first conversion. A missing / broken
 * opencc-js only degrades conversion to returning the original text, with the
 * initialization error logged once.
 *
 * opencc-js is loaded with a CommonJS require(), which vi.mock does not intercept,
 * so the failure is simulated at Module._load.
 */
import * as os from 'os'
import * as path from 'path'
import Module from 'module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => path.join(os.tmpdir(), 'bat-t0469-voice-opencc-test-nonexistent') },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn() } },
  systemPreferences: { getMediaAccessStatus: vi.fn(() => 'granted') },
}))
const loggerMock = vi.hoisted(() => ({ log: vi.fn(), error: vi.fn(), warn: vi.fn() }))
vi.mock('../logger', () => ({ logger: loggerMock }))
vi.mock('../gpu-detector', () => ({ getGpuStatus: vi.fn(), resolveUseGpu: () => true }))
vi.mock('../whisper-addon-loader', () => ({
  loadWhisperAddon: vi.fn(),
  transcribe: vi.fn(),
  WhisperAddonUnavailableError: class extends Error {},
}))

type ModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown
const moduleInternals = Module as unknown as { _load: ModuleLoad }
const originalLoad = moduleInternals._load
const openccRequests: string[] = []

function interceptOpencc(behavior: 'throw' | 'pass'): void {
  moduleInternals._load = function (this: unknown, request, parent, isMain) {
    if (request === 'opencc-js') {
      openccRequests.push(request)
      if (behavior === 'throw') throw new Error("Cannot find module 'opencc-js'")
    }
    return originalLoad.call(this, request, parent, isMain)
  }
}

describe('voice-opencc lazy opencc-js require', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    openccRequests.length = 0
    loggerMock.log.mockReset()
    loggerMock.error.mockReset()
    loggerMock.warn.mockReset()
  })

  afterEach(() => {
    moduleInternals._load = originalLoad
  })

  it('missing opencc-js: import + registerVoiceHandlers survive, conversion returns original text, error logged once', async () => {
    interceptOpencc('throw')

    const { convertSimplifiedToTraditional } = await import('../voice-opencc')
    const { registerVoiceHandlers } = await import('../voice-handler')
    expect(() => registerVoiceHandlers(() => [])).not.toThrow()
    expect(openccRequests).toEqual([])

    expect(convertSimplifiedToTraditional('语音')).toBe('语音')
    expect(convertSimplifiedToTraditional('简体')).toBe('简体')

    expect(openccRequests).toEqual(['opencc-js'])
    expect(loggerMock.error).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith('[voice] OpenCC initialization failed:', expect.any(Error))
  })

  it('opencc-js available: loads on first conversion only and converts as before', async () => {
    interceptOpencc('pass')

    const { convertSimplifiedToTraditional } = await import('../voice-opencc')
    expect(openccRequests).toEqual([])

    expect(convertSimplifiedToTraditional('语音')).toBe('語音')
    expect(convertSimplifiedToTraditional('简体中文')).toBe('簡體中文')

    expect(openccRequests).toEqual(['opencc-js'])
    expect(loggerMock.error).not.toHaveBeenCalled()
  })
})
