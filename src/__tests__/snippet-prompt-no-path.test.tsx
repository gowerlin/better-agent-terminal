/**
 * T0441 / BUG-109: `/snippet` in the Claude panel sends a prompt built from the local `snippet:*`
 * IPC (ALWAYS_LOCAL since T0422) — same prompt in a local and a remote-profile window, carrying the
 * snippet content and never the hard-coded macOS `snippets.json` path. Prompt builder details:
 * src/lib/__tests__/snippet-context.test.ts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'

/** Same permissive stand-in as image-attachment-client-read.test.tsx. */
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

const SNIPPETS = [{ id: 7, title: 'Deploy', content: 'npm run deploy -- --prod', format: 'plaintext', isFavorite: false }]
const search = vi.fn(async (_q: string) => SNIPPETS)
const getByWorkspace = vi.fn(async (_ws?: string) => SNIPPETS)
const sendMessage = vi.fn(async (_sid: string, _prompt: string) => undefined)

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  for (const fn of [search, getByWorkspace, sendMessage]) fn.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    snippet: { search, getByWorkspace },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function runSnippet(container: HTMLElement, text: string) {
  const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
  await act(async () => {
    input.value = text
    fireEvent.input(input)
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

function expectSnippetPrompt(prompt: string) {
  expect(prompt).toContain('[BAT Snippets Context]')
  expect(prompt).toContain('- [7] Deploy (plaintext, global)')
  expect(prompt).toContain('npm run deploy -- --prod')
  expect(prompt).not.toMatch(/~\/Library|Application Support|snippets\.json/)
}

describe.each([
  ['local window', false],
  ['remote-profile window', true],
] as const)('ClaudeAgentPanel /snippet (%s)', (label, isRemoteConnected) => {
  test('/snippet <query> searches the local store and sends its content, no file path', async () => {
    const { container } = render(
      <ClaudeAgentPanel sessionId={`t0441-q-${label}`} cwd="C:\\repo" isActive={true} workspaceId="ws-1" isRemoteConnected={isRemoteConnected} />,
    )
    await runSnippet(container, '/snippet deploy')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(search).toHaveBeenCalledWith('deploy')
    const [sid, prompt] = sendMessage.mock.calls[0]
    expect(sid).toBe(`t0441-q-${label}`)
    expectSnippetPrompt(prompt)
    expect(prompt).toContain('1 snippet(s) matching "deploy":')
  })

  test('/snippet lists the current workspace snippets', async () => {
    const { container } = render(
      <ClaudeAgentPanel sessionId={`t0441-ws-${label}`} cwd="C:\\repo" isActive={true} workspaceId="ws-1" isRemoteConnected={isRemoteConnected} />,
    )
    // trailing space keeps the slash-command menu closed, so Enter sends
    await runSnippet(container, '/snippet ')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(getByWorkspace).toHaveBeenCalledWith('ws-1')
    const prompt = sendMessage.mock.calls[0][1]
    expectSnippetPrompt(prompt)
    expect(prompt).toContain('Current workspaceId: "ws-1"')
  })
})

test('no panel source hard-codes the macOS snippets.json path', () => {
  for (const file of ['ClaudeAgentPanel.tsx', 'CodexAgentPanel.tsx']) {
    const src = readFileSync(path.resolve(__dirname, '../components', file), 'utf-8')
    expect(src, file).not.toMatch(/~\/Library\/Application Support/)
    expect(src, file).not.toMatch(/snippets\.json/)
  }
})
