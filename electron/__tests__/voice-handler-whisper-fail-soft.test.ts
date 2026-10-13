/**
 * BUG-116 / T0468: importing voice-handler (done at main.ts top level) must not load
 * the whisper addon, and an unavailable addon only fails `voice:transcribe` — with a
 * clear error, before any model / temp-file work.
 */
import * as os from 'os'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => path.join(os.tmpdir(), 'bat-t0468-voice-handler-test-nonexistent') },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn() } },
  systemPreferences: { getMediaAccessStatus: vi.fn(() => 'granted') },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('../voice-opencc', () => ({ convertSimplifiedToTraditional: (s: string) => s }))
vi.mock('../gpu-detector', () => ({ getGpuStatus: vi.fn(), resolveUseGpu: () => true }))
// The upstream package throws at import on macOS; voice-handler must never import it.
vi.mock('@kutalia/whisper-node-addon', () => {
  throw new Error('voice-handler must not import @kutalia/whisper-node-addon')
})

const loaderMocks = vi.hoisted(() => ({
  loadWhisperAddon: vi.fn(),
  transcribe: vi.fn(),
}))
vi.mock('../whisper-addon-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../whisper-addon-loader')>()
  return { ...actual, loadWhisperAddon: loaderMocks.loadWhisperAddon, transcribe: loaderMocks.transcribe }
})

import { registerVoiceHandlers } from '../voice-handler'
import { VOICE_IPC_CHANNELS } from '../../src/types/voice-ipc'
import { WhisperAddonUnavailableError } from '../whisper-addon-loader'

describe('voice-handler whisper fail-soft', () => {
  beforeEach(() => {
    handlers.clear()
    loaderMocks.loadWhisperAddon.mockReset()
    loaderMocks.transcribe.mockReset()
  })

  it('registers every voice IPC handler without loading the addon', () => {
    expect(() => registerVoiceHandlers(() => [])).not.toThrow()
    expect(handlers.has(VOICE_IPC_CHANNELS.transcribe)).toBe(true)
    expect(handlers.has(VOICE_IPC_CHANNELS.listModels)).toBe(true)
    expect(loaderMocks.loadWhisperAddon).not.toHaveBeenCalled()
  })

  it('voice:transcribe rejects with WhisperAddonUnavailableError when the addon cannot load', async () => {
    loaderMocks.loadWhisperAddon.mockReturnValue({ ok: false, error: new Error('no whisper.node for darwin-arm64') })
    registerVoiceHandlers(() => [])

    const transcribe = handlers.get(VOICE_IPC_CHANNELS.transcribe)!
    const err = await Promise.resolve(transcribe({}, new ArrayBuffer(64), 16000)).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(WhisperAddonUnavailableError)
    expect((err as Error).message).toBe(
      'Voice recognition module (whisper) is unavailable: no whisper.node for darwin-arm64',
    )
    expect(loaderMocks.transcribe).not.toHaveBeenCalled()
  })

  it('with the addon available, transcribe continues to the model check as before', async () => {
    loaderMocks.loadWhisperAddon.mockReturnValue({ ok: true, addonPath: '/x/whisper.node', whisperAsync: vi.fn() })
    registerVoiceHandlers(() => [])

    const transcribe = handlers.get(VOICE_IPC_CHANNELS.transcribe)!
    await expect(Promise.resolve(transcribe({}, new ArrayBuffer(64), 16000)))
      .rejects.toThrow(/not downloaded/)
    expect(loaderMocks.transcribe).not.toHaveBeenCalled()
  })
})
