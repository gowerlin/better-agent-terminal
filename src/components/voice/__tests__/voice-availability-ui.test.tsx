/**
 * T0802 / D247: mic button, recording start (every entry — button and Alt+M — goes through
 * useVoiceRecording.start) and Settings follow the whisper availability. 🔴 available / unknown keep the
 * pre-T0802 button exactly.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import i18next from 'i18next'

const recorder = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(), cancel: vi.fn(), constructed: 0 }))
vi.mock('../../../lib/voice', () => ({
  RecordingError: class extends Error { code = 'unknown' },
  RecordingService: class {
    constructor() { recorder.constructed++ }
    start = recorder.start
    stop = recorder.stop
    cancel = recorder.cancel
  },
}))

import { MicButton } from '../MicButton'
import { VoiceAvailabilityStatus } from '../VoiceAvailabilityStatus'
import { useVoiceRecording } from '../../../hooks/useVoiceRecording'
import { __setVoiceAvailabilityForTests } from '../../../lib/voice-availability-store'
import type { VoiceAvailability } from '../../../lib/voice-availability'

const GLIBC: VoiceAvailability = { state: 'unavailable', code: 'glibc-too-old', platform: 'linux', libraries: [], requiredGlibc: '2.38', detail: 'd' }
const MISSING: VoiceAvailability = { state: 'unavailable', code: 'missing-library', platform: 'linux', libraries: ['libgomp.so.1', 'libvulkan.so.1'], detail: 'd' }

function setVoiceApi(extra: Record<string, unknown> = {}) {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    voice: {
      getPreferences: vi.fn(async () => null),
      isModelDownloaded: vi.fn(async () => true),
      ...extra,
    },
    debug: { log: vi.fn() },
  }
}

beforeEach(async () => {
  await i18next.changeLanguage('zh-TW')
  recorder.start.mockClear()
  recorder.constructed = 0
  setVoiceApi()
})
afterEach(() => {
  cleanup()
  act(() => __setVoiceAvailabilityForTests(null))
})

function renderMic(state: Parameters<typeof MicButton>[0]['state'] = 'idle', extra: Partial<Parameters<typeof MicButton>[0]> = {}) {
  const onClick = vi.fn()
  render(<MicButton state={state} onClick={onClick} disabled={state === 'disabled'} disabledTooltip="請先在 Settings 下載語音模型" {...extra} />)
  return { onClick, button: screen.getByRole('button') }
}

describe('MicButton', () => {
  it('🔴 unknown (no answer yet) and available render exactly as before T0802', () => {
    act(() => __setVoiceAvailabilityForTests({ state: 'unknown', reason: 'pending' }))
    const before = renderMic().button.outerHTML
    cleanup()
    act(() => __setVoiceAvailabilityForTests({ state: 'available', source: 'probe' }))
    const { button, onClick } = renderMic()
    expect(button.outerHTML).toBe(before)
    expect(button).not.toBeDisabled()
    expect(button.getAttribute('title')).toBe('語音輸入 (Alt+M)')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalled()
    cleanup()
    act(() => __setVoiceAvailabilityForTests({ state: 'unknown', reason: 'timeout' }))
    expect(renderMic().button.outerHTML).toBe(before)
  })

  it('unavailable: disabled, tooltip = reason + install command', () => {
    act(() => __setVoiceAvailabilityForTests(MISSING))
    const { button } = renderMic()
    expect(button).toBeDisabled()
    expect(button.getAttribute('data-voice-unavailable')).toBe('missing-library')
    const title = button.getAttribute('title') ?? ''
    expect(title).toContain('缺少系統函式庫：libgomp.so.1, libvulkan.so.1')
    expect(title).toContain('sudo apt install libgomp1 libvulkan1')
  })

  it('unavailable beats the model-not-downloaded tooltip', () => {
    act(() => __setVoiceAvailabilityForTests(GLIBC))
    const { button } = renderMic('disabled')
    expect(button.getAttribute('title')).toContain('glibc 2.38')
  })

  it('a recording already running is not cut off', () => {
    act(() => __setVoiceAvailabilityForTests(GLIBC))
    const { button } = renderMic('recording')
    expect(button).not.toBeDisabled()
    expect(button.getAttribute('title')).toBe('停止錄音 (Alt+M)')
  })

  it('follows a pushed change while mounted', () => {
    const { button } = renderMic()
    expect(button).not.toBeDisabled()
    act(() => __setVoiceAvailabilityForTests(GLIBC))
    expect(button).toBeDisabled()
  })

  it('reads the main process state through the preload API', async () => {
    let push: ((a: VoiceAvailability) => void) | null = null
    setVoiceApi({
      getAvailability: vi.fn(async () => ({ state: 'unknown', reason: 'pending' })),
      onAvailabilityChanged: vi.fn((cb: (a: VoiceAvailability) => void) => { push = cb; return () => {} }),
    })
    const { button } = renderMic()
    await act(async () => {})
    expect(button).not.toBeDisabled()
    act(() => push?.(MISSING))
    expect(button).toBeDisabled()
  })
})

describe('useVoiceRecording.start (mic button and Alt+M)', () => {
  it('unavailable: no recording, error = the same reason text', async () => {
    act(() => __setVoiceAvailabilityForTests(GLIBC))
    const { result } = renderHook(() => useVoiceRecording())
    await act(async () => { await result.current.start() })
    expect(recorder.start).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toContain('glibc 2.38')
  })

  it('toggle (Alt+M path) is refused the same way', async () => {
    act(() => __setVoiceAvailabilityForTests(MISSING))
    const { result } = renderHook(() => useVoiceRecording())
    await act(async () => { result.current.toggle() })
    expect(recorder.start).not.toHaveBeenCalled()
    expect(result.current.error).toContain('sudo apt install libgomp1 libvulkan1')
  })

  it('🔴 unknown and available record as before', async () => {
    for (const a of [{ state: 'unknown', reason: 'crashed' }, { state: 'available', source: 'probe' }] as VoiceAvailability[]) {
      act(() => __setVoiceAvailabilityForTests(a))
      recorder.start.mockClear()
      const { result, unmount } = renderHook(() => useVoiceRecording())
      await act(async () => { await result.current.start() })
      expect(recorder.start).toHaveBeenCalledTimes(1)
      expect(result.current.state).toBe('recording')
      expect(result.current.error).toBeNull()
      unmount()
    }
  })
})

describe('VoiceAvailabilityStatus (Settings › Voice)', () => {
  it('shows each state; recheck asks the main process', async () => {
    const recheck = vi.fn(async () => ({ state: 'available', source: 'probe' }))
    setVoiceApi({ recheckAvailability: recheck })
    act(() => __setVoiceAvailabilityForTests(MISSING))
    const { container } = render(<VoiceAvailabilityStatus />)
    expect(container.textContent).toContain('❌ 無法使用')
    expect(container.textContent).toContain('sudo apt install libgomp1 libvulkan1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新檢查' })) })
    expect(recheck).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('✅ 可以使用')
    expect(container.querySelector('[data-voice-availability]')?.getAttribute('data-voice-availability')).toBe('available')
  })

  it('pending and unknown', () => {
    act(() => __setVoiceAvailabilityForTests({ state: 'unknown', reason: 'pending' }))
    const { container, rerender } = render(<VoiceAvailabilityStatus />)
    expect(container.textContent).toContain('尚未檢查')
    act(() => __setVoiceAvailabilityForTests({ state: 'unknown', reason: 'timeout' }))
    rerender(<VoiceAvailabilityStatus />)
    expect(container.textContent).toContain('未確認（timeout）')
    expect(container.textContent).toContain('語音輸入照常可用')
  })
})
