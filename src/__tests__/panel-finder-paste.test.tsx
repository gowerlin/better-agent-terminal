/**
 * T0522 / BUG-128: Claude / Codex panel — a macOS Finder copy pasted into the input attaches
 * the items like a drop (images by data URL from the File, other files by path). A screenshot
 * / copied web image (File with no disk path) keeps the T0436 main-clipboard route, and
 * Windows / Linux paste is unchanged.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'

/** Same permissive stand-in as image-attachment-client-read.test.tsx, plus a top-level `platform`. */
function permissiveApi(platform: string, overrides: Record<string, Record<string, unknown>>): unknown {
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
  const namespaces: Record<string, unknown> = { platform }
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

const getPathForFile = vi.fn<(file: File) => string>()
const readImageDataUrl = vi.fn<() => Promise<string | null>>()

function setup(platform: 'darwin' | 'win32' | 'linux') {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi(platform, {
    shell: { getPathForFile },
    clipboard: { readImageDataUrl },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})) },
  })
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  getPathForFile.mockReset()
  readImageDataUrl.mockReset()
  readImageDataUrl.mockResolvedValue('data:image/png;base64,CLIP')
})

afterEach(() => {
  cleanup()
})

const thumbs = (c: HTMLElement) => Array.from(c.querySelectorAll('.claude-attachment-thumb')).map(img => img.getAttribute('src') ?? '')
const fileChips = (c: HTMLElement) => Array.from(c.querySelectorAll('.claude-attachment-file')).map(el => el.getAttribute('title') ?? '')

function finderClipboard() {
  const doc = new File(['doc'], 'My Report.pdf', { type: 'application/pdf' })
  const pic = new File(['x'], 'pic.png', { type: 'image/png' })
  getPathForFile.mockImplementation((f: File) => (f === doc ? '/Users/gary/My Report.pdf' : f === pic ? '/Users/gary/pic.png' : ''))
  return { files: [doc, pic], items: [{ type: 'application/pdf', kind: 'file' }, { type: 'image/png', kind: 'file' }], types: ['Files'] }
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="/Users/gary/repo" isActive={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="/Users/gary/repo" isActive={true} />],
] as const)('%s Finder paste', (name, renderPanel) => {
  test('macOS: Finder items attach like a drop (file by path, image from the File)', async () => {
    setup('darwin')
    const { container } = render(renderPanel(`t0522-finder-${name}`))

    await act(async () => {
      fireEvent.paste(container.querySelector('textarea.claude-input')!, { clipboardData: finderClipboard() })
    })

    // 'x' → eA==
    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,eA==']))
    expect(fileChips(container)).toEqual(['/Users/gary/My Report.pdf'])
    expect(readImageDataUrl).not.toHaveBeenCalled()
  })

  test('macOS: a screenshot (File without a disk path) still uses clipboard.readImageDataUrl', async () => {
    setup('darwin')
    getPathForFile.mockReturnValue('')
    const { container } = render(renderPanel(`t0522-shot-${name}`))

    await act(async () => {
      fireEvent.paste(container.querySelector('textarea.claude-input')!, {
        clipboardData: { files: [new File(['s'], 'image.png', { type: 'image/png' })], items: [{ type: 'image/png', kind: 'file' }] },
      })
    })

    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,CLIP']))
    expect(readImageDataUrl).toHaveBeenCalledTimes(1)
    expect(fileChips(container)).toEqual([])
  })

  test('Windows: unchanged — image items go through clipboard.readImageDataUrl, no Finder route', async () => {
    setup('win32')
    const { container } = render(renderPanel(`t0522-win-${name}`))

    await act(async () => {
      fireEvent.paste(container.querySelector('textarea.claude-input')!, { clipboardData: finderClipboard() })
    })

    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,CLIP']))
    expect(readImageDataUrl).toHaveBeenCalledTimes(1)
    expect(getPathForFile).not.toHaveBeenCalled()
    expect(fileChips(container)).toEqual([])
  })
})
