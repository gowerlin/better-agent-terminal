/**
 * T0884 (BUG-211 follow-up): after a fork, the new Claude / Codex panel auto-sends the prompt and
 * images the fork left (`pendingPrompt` / `pendingImages`) once its history has loaded (`onHistory`).
 * In a remote window with images over the budget (`planForkPendingSend`, src/lib/remote-image-budget.ts)
 * nothing is sent: the same toast as a normal send, the history loaded, the prompt and images back in
 * the input. Within the budget, or in a local window, the auto-send is unchanged. The pending fields
 * are cleared at the same moment as before, so a second history load never sends again.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import i18n from '../../i18n'
import { ClaudeAgentPanel } from '../ClaudeAgentPanel'
import { CodexAgentPanel } from '../CodexAgentPanel'
import { resetRemoteWindowCache } from '../../hooks/useIsRemoteWindow'
import { workspaceStore } from '../../stores/workspace-store'

const MiB = 1024 * 1024

/** A base64 data URL decoding to exactly `rawBytes` bytes. */
function bigDataUrl(rawBytes: number): string {
  const padding = (3 - (rawBytes % 3)) % 3
  return 'data:image/png;base64,' + 'A'.repeat(4 * Math.ceil(rawBytes / 3) - padding) + '='.repeat(padding)
}

/** Same permissive stand-in as remote-image-budget-panel.test.tsx. */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): unknown {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = {}
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

type Listener = (sid: string, payload: unknown) => void
let listeners: Record<string, Listener | undefined> = {}
const capture = (name: string) => vi.fn((cb: Listener) => { listeners[name] = cb; return () => {} })

const sendMessage = vi.fn(async (_sid: string, _prompt: string, _images?: string[]) => true as unknown)
const debugLog = vi.fn()
let windowProfileId: string | null = 'remote-1'
const createdWorkspaces: string[] = []

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  listeners = {}
  sendMessage.mockReset()
  sendMessage.mockImplementation(async () => true)
  debugLog.mockReset()
  windowProfileId = 'remote-1'
  resetRemoteWindowCache()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    app: { getWindowProfile: vi.fn(async () => windowProfileId) },
    profile: { listLocal: vi.fn(async () => ({ profiles: [{ id: 'remote-1', type: 'remote' }, { id: 'local-1', type: 'local' }] })) },
    debug: { log: debugLog, isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage, onHistory: capture('history') },
  })
})

afterEach(() => {
  cleanup()
  resetRemoteWindowCache()
  for (const id of createdWorkspaces.splice(0)) workspaceStore.removeWorkspace(id)
})

/** A forked tab: a terminal whose `pendingPrompt` / `pendingImages` were set by the fork. */
function forkedTerminal(preset: 'claude-code' | 'codex-agent', prompt: string, images: string[]): string {
  const ws = workspaceStore.addWorkspace('T0884', '/repo')
  createdWorkspaces.push(ws.id)
  const terminal = workspaceStore.addTerminal(ws.id, preset)
  workspaceStore.setTerminalPendingPrompt(terminal.id, prompt, images)
  return terminal.id
}

const history = (sid: string) => [{ id: 'h1', sessionId: sid, role: 'assistant', content: 'earlier answer', timestamp: 1_700_000_000_000 }]

/** Lets the remote-window detection (two awaited IPC calls) settle. */
async function settle() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

async function loadHistory(sid: string) {
  await act(async () => { listeners.history?.(sid, history(sid)) })
}

const inputOf = (container: HTMLElement) => container.querySelector('textarea.claude-input') as HTMLTextAreaElement
const pendingOf = (sid: string) => {
  const t = workspaceStore.getState().terminals.find(x => x.id === sid)
  return { prompt: t?.pendingPrompt, images: t?.pendingImages }
}

describe.each([
  ['ClaudeAgentPanel', 'claude-code', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="/repo" isActive={true} isRemoteConnected={true} />],
  ['CodexAgentPanel', 'codex-agent', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="/repo" isActive={true} isRemoteConnected={true} />],
] as const)('%s fork auto-send (T0884)', (_name, preset, renderPanel) => {
  test('remote window, images over 20 MiB: not sent, toast, prompt and images back, history loaded', async () => {
    const images = [bigDataUrl(8 * MiB), bigDataUrl(8 * MiB), bigDataUrl(8 * MiB)]
    const sid = forkedTerminal(preset, 'compare these', images)
    const { container } = render(renderPanel(sid))
    await settle()
    await loadHistory(sid)

    const toast = await waitFor(() => {
      const el = container.querySelector('.ct-toast')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(toast).toHaveTextContent('Images too large for a remote window: 24.0 MiB attached, at most 20.0 MiB per message')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(inputOf(container).value).toBe('compare these')
    const thumbs = [...container.querySelectorAll('.claude-attachment-thumb')] as HTMLImageElement[]
    expect(thumbs.map(img => img.getAttribute('src'))).toEqual(images)
    expect(container.textContent).toContain('earlier answer')
    expect(container.querySelector('.claude-stop-btn')).toBeNull()
    // pending fields cleared as before; the log line has counts only
    expect(pendingOf(sid)).toEqual({ prompt: '', images: undefined })
    const logs = debugLog.mock.calls.map(c => String(c[0]))
    expect(logs).toContain(`[remote-image-budget] fork pending images blocked count=3 bytes=${24 * MiB}`)
    expect(logs.some(l => l.includes('AUTO-SENDING'))).toBe(false)

    // a second history load (resume, reconnect) does not send it either
    await loadHistory(sid)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  test('remote window, images within 20 MiB: auto-sent as before', async () => {
    const images = [bigDataUrl(10 * MiB), bigDataUrl(10 * MiB)]
    const sid = forkedTerminal(preset, 'two', images)
    const { container } = render(renderPanel(sid))
    await settle()
    await loadHistory(sid)

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0]).toEqual([sid, 'two', images])
    expect(container.querySelector('.ct-toast')).toBeNull()
    expect(inputOf(container).value).toBe('')
    expect(container.querySelectorAll('.claude-attachment-thumb')).toHaveLength(0)
    expect(pendingOf(sid)).toEqual({ prompt: '', images: undefined })
  })

  test('local window, images over 20 MiB: auto-sent without a check', async () => {
    windowProfileId = 'local-1'
    const images = [bigDataUrl(8 * MiB), bigDataUrl(8 * MiB), bigDataUrl(8 * MiB)]
    const sid = forkedTerminal(preset, 'local', images)
    const { container } = render(renderPanel(sid))
    await settle()
    await loadHistory(sid)

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0]).toEqual([sid, 'local', images])
    expect(container.querySelector('.ct-toast')).toBeNull()
    expect(inputOf(container).value).toBe('')
  })

  test('remote window, prompt without images: auto-sent as before', async () => {
    const sid = forkedTerminal(preset, 'just text', [])
    render(renderPanel(sid))
    await settle()
    await loadHistory(sid)

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0][0]).toBe(sid)
    expect(sendMessage.mock.calls[0][1]).toBe('just text')
  })
})
