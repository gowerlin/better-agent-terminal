/**
 * T0842 / BUG-211: in a remote window the Claude / Codex panel checks the attached images before
 * sending (`src/lib/remote-image-budget.ts`, 20 MiB): over the budget → a toast, nothing sent, the
 * input and images kept. A remote send that fails anyway (FRAME_TOO_LARGE, connection closed, …)
 * puts the draft back, ends the "running" state and says so. Local windows are not checked.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'
import { resetRemoteWindowCache } from '../hooks/useIsRemoteWindow'

const MiB = 1024 * 1024

/** A base64 data URL decoding to exactly `rawBytes` bytes. */
function bigDataUrl(rawBytes: number): string {
  const padding = (3 - (rawBytes % 3)) % 3
  return 'data:image/png;base64,' + 'A'.repeat(4 * Math.ceil(rawBytes / 3) - padding) + '='.repeat(padding)
}

// Dropped images are read with FileReader; size them by name instead ("<MiB>mb-<n>.png").
vi.mock('../lib/image-attachment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/image-attachment')>()
  return {
    ...actual,
    readFileAsDataUrl: vi.fn(async (file: File) => bigDataUrl(Number(/^(\d+)mb-/.exec(file.name)?.[1] ?? 0) * MiB)),
  }
})

/** Same permissive stand-in as attachment-remote-paths.test.tsx. */
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

const sendMessage = vi.fn(async (_sid: string, _prompt: string, _images?: string[]) => true as unknown)
let windowProfileId: string | null = 'remote-1'

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  sendMessage.mockReset()
  sendMessage.mockImplementation(async () => true)
  windowProfileId = 'remote-1'
  resetRemoteWindowCache()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    app: { getWindowProfile: vi.fn(async () => windowProfileId) },
    profile: { listLocal: vi.fn(async () => ({ profiles: [{ id: 'remote-1', type: 'remote' }, { id: 'local-1', type: 'local' }] })) },
    shell: { getPathForFile: vi.fn(() => '') },
    remote: { resolveClientPaths: vi.fn(async (paths: string[]) => paths.map(input => ({ input, serverPath: input, reachable: true }))) },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage },
  })
})

afterEach(() => {
  cleanup()
  resetRemoteWindowCache()
})

async function dropImages(container: HTMLElement, sizesMiB: number[]) {
  const files = sizesMiB.map((mb, i) => new File(['x'], `${mb}mb-${i}.png`, { type: 'image/png' }))
  const panel = container.querySelector('.claude-agent-panel')!
  await act(async () => {
    fireEvent.drop(panel, { dataTransfer: { files, types: ['Files'], getData: () => '' } })
  })
  await waitFor(() => expect(container.querySelectorAll('.claude-attachment-thumb')).toHaveLength(sizesMiB.length))
}

function inputOf(container: HTMLElement): HTMLTextAreaElement {
  return container.querySelector('textarea.claude-input') as HTMLTextAreaElement
}

async function send(container: HTMLElement, text: string) {
  const input = inputOf(container)
  await act(async () => {
    input.value = text
    fireEvent.input(input)
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

/** Lets the remote-window detection (two awaited IPC calls) settle. */
async function settle() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="/repo" isActive={true} isRemoteConnected={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="/repo" isActive={true} isRemoteConnected={true} />],
] as const)('%s in a remote window (T0842)', (name, renderPanel) => {
  test('images over 20 MiB: toast, nothing sent, input and images kept', async () => {
    const { container } = render(renderPanel(`t0842-over-${name}`))
    await settle()
    await dropImages(container, [8, 8, 8])
    await send(container, 'compare these')

    const toast = await waitFor(() => {
      const el = container.querySelector('.ct-toast')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(toast).toHaveTextContent('Images too large for a remote window: 24.0 MiB attached, at most 20.0 MiB per message')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(inputOf(container).value).toBe('compare these')
    expect(container.querySelectorAll('.claude-attachment-thumb')).toHaveLength(3)
    expect(container.querySelector('.claude-stop-btn')).toBeNull()
  })

  test('images within 20 MiB are sent as before', async () => {
    const { container } = render(renderPanel(`t0842-within-${name}`))
    await settle()
    await dropImages(container, [10, 10])
    await send(container, 'two')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][2]).toHaveLength(2)
    expect(container.querySelector('.ct-toast')).toBeNull()
    expect(inputOf(container).value).toBe('')
    expect(container.querySelectorAll('.claude-attachment-thumb')).toHaveLength(0)
  })

  test('a remote send that fails with FRAME_TOO_LARGE: draft back, not running, message shown', async () => {
    sendMessage.mockImplementation(async () => {
      throw new Error("Error invoking remote method 'claude:send-message': Error: FRAME_TOO_LARGE: claude:send-message frame is 41943230 bytes; the remote connection accepts at most 33554432 bytes")
    })
    const { container } = render(renderPanel(`t0842-frame-${name}`))
    await settle()
    await dropImages(container, [10])
    await send(container, 'hello')

    await waitFor(() => expect(container.textContent).toContain('Not sent: this message is 40.0 MiB, the remote connection accepts at most 32.0 MiB per message'))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(inputOf(container).value).toBe('hello')
    expect(container.querySelectorAll('.claude-attachment-thumb')).toHaveLength(1)
    expect(container.querySelector('.claude-stop-btn')).toBeNull()
  })

  test('a remote send that fails with Connection closed: draft back, not running, reason shown', async () => {
    sendMessage.mockImplementation(async () => {
      throw new Error("Error invoking remote method 'claude:send-message': Error: Connection closed")
    })
    const { container } = render(renderPanel(`t0842-closed-${name}`))
    await settle()
    await send(container, 'still here?')

    await waitFor(() => expect(container.textContent).toContain('Sending to the remote host failed (Connection closed)'))
    expect(inputOf(container).value).toBe('still here?')
    expect(container.querySelector('.claude-stop-btn')).toBeNull()
  })
})

describe('a local window (T0842: unchanged)', () => {
  test('Claude: images over 20 MiB are sent without a check', async () => {
    windowProfileId = 'local-1'
    const { container } = render(<ClaudeAgentPanel sessionId="t0842-local-claude" cwd="/repo" isActive={true} />)
    await settle()
    await dropImages(container, [8, 8, 8])
    await send(container, 'local')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][2]).toHaveLength(3)
    expect(container.querySelector('.ct-toast')).toBeNull()
  })

  test('Codex: images over 20 MiB are sent without a check', async () => {
    windowProfileId = null
    const { container } = render(<CodexAgentPanel sessionId="t0842-local-codex" cwd="/repo" isActive={true} />)
    await settle()
    await dropImages(container, [8, 8, 8])
    await send(container, 'local')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][2]).toHaveLength(3)
    expect(container.querySelector('.ct-toast')).toBeNull()
  })
})
