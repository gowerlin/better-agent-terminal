/**
 * T0436 / BUG-108: Claude / Codex panel image attachments are read on the client and never
 * through the proxied, workspace-sandboxed `image:read-as-data-url`:
 *   - drop   → the dropped DOM `File` via FileReader
 *   - paste  → `clipboard.readImageDataUrl()` (main reads its own clipboard; no temp file)
 *   - dialog → `dialog.selectAttachments()` (main reads the images its own dialog returned)
 * Main-side handlers and the local-only channel guard: electron/__tests__/image-attachments.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'
import { MAX_ATTACHMENT_IMAGE_BYTES, droppedImageKey, readFileAsDataUrl } from '../lib/image-attachment'

/** Same permissive stand-in as drag-drop-get-path-for-file.test.tsx. */
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

const getPathForFile = vi.fn<(file: File) => string>()
const readAsDataUrl = vi.fn(async (_p: string) => 'data:image/png;base64,PROXIED')
const readImageDataUrl = vi.fn<() => Promise<string | null>>()
const saveImage = vi.fn(async () => 'C:\\Temp\\bat-clipboard-1.png')
const selectAttachments = vi.fn<() => Promise<{ files: string[]; images: Array<{ path: string; dataUrl: string }> }>>()
const selectFiles = vi.fn(async () => [] as string[])

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
  Element.prototype.scrollIntoView = vi.fn()
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  for (const fn of [getPathForFile, readAsDataUrl, readImageDataUrl, saveImage, selectAttachments, selectFiles]) fn.mockClear()
  getPathForFile.mockReset()
  readImageDataUrl.mockReset()
  selectAttachments.mockReset()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    shell: { getPathForFile },
    image: { readAsDataUrl },
    clipboard: { readImageDataUrl, saveImage },
    dialog: { selectAttachments, selectFiles },
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})) },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function thumbs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.claude-attachment-thumb')).map(img => img.getAttribute('src') ?? '')
}

function noProxiedRead() {
  expect(readAsDataUrl).not.toHaveBeenCalled()
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
] as const)('%s image attachments (client-side read)', (name, renderPanel) => {
  test('drop: data URL comes from the dropped File, also when it has no disk path', async () => {
    getPathForFile.mockImplementation((f: File) => (f.name === 'disk.png' ? 'C:\\Users\\u\\Pictures\\disk.png' : ''))
    const { container } = render(renderPanel(`t0436-drop-${name}`))

    await act(async () => {
      fireEvent.drop(container.querySelector('.claude-agent-panel')!, {
        dataTransfer: {
          files: [new File(['x'], 'disk.png', { type: 'image/png' }), new File(['yy'], 'web.png', { type: 'image/png' })],
          types: ['Files'],
          getData: () => '',
        },
      })
    })

    // 'x' → eA==, 'yy' → eXk=
    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,eA==', 'data:image/png;base64,eXk=']))
    noProxiedRead()
  })

  test('paste: data URL comes from clipboard.readImageDataUrl, no temp-file path', async () => {
    readImageDataUrl.mockResolvedValue('data:image/png;base64,CLIP')
    const { container } = render(renderPanel(`t0436-paste-${name}`))

    await act(async () => {
      fireEvent.paste(container.querySelector('textarea.claude-input')!, {
        clipboardData: { items: [{ type: 'image/png', kind: 'file' }] },
      })
    })

    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,CLIP']))
    expect(readImageDataUrl).toHaveBeenCalledTimes(1)
    expect(saveImage).not.toHaveBeenCalled()
    noProxiedRead()
  })

  test('paste: empty clipboard image attaches nothing', async () => {
    readImageDataUrl.mockResolvedValue(null)
    const { container } = render(renderPanel(`t0436-paste-empty-${name}`))

    await act(async () => {
      fireEvent.paste(container.querySelector('textarea.claude-input')!, {
        clipboardData: { items: [{ type: 'image/png', kind: 'file' }] },
      })
    })

    expect(readImageDataUrl).toHaveBeenCalledTimes(1)
    expect(thumbs(container)).toEqual([])
  })

  test('dialog: images arrive as data URLs from dialog.selectAttachments; files by path', async () => {
    selectAttachments.mockResolvedValue({
      files: ['C:\\Users\\u\\notes.md'],
      images: [{ path: 'C:\\Users\\u\\Pictures\\pick.png', dataUrl: 'data:image/png;base64,PICK' }],
    })
    const { container, getByTitle } = render(renderPanel(`t0436-dialog-${name}`))

    await act(async () => {
      fireEvent.click(getByTitle(i18n.t('claude.attachImages')))
    })

    await waitFor(() => expect(thumbs(container)).toEqual(['data:image/png;base64,PICK']))
    expect(container.querySelector('.claude-attachment-file')).toHaveAttribute('title', 'C:\\Users\\u\\notes.md')
    expect(selectAttachments).toHaveBeenCalledWith()
    expect(selectFiles).not.toHaveBeenCalled()
    noProxiedRead()
  })
})

describe('src/lib/image-attachment', () => {
  test('readFileAsDataUrl reads the File content', async () => {
    await expect(readFileAsDataUrl(new File(['hi'], 'a.gif', { type: 'image/gif' }))).resolves.toBe('data:image/gif;base64,aGk=')
  })

  test('readFileAsDataUrl rejects images over the size cap without reading', async () => {
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: MAX_ATTACHMENT_IMAGE_BYTES + 1 })
    await expect(readFileAsDataUrl(big)).rejects.toThrow(/Image too large/)
  })

  test('droppedImageKey prefers the disk path, else a File-derived key', () => {
    const f = new File(['x'], 'a.png', { type: 'image/png', lastModified: 42 })
    expect(droppedImageKey(f, 'C:\\a.png')).toBe('C:\\a.png')
    expect(droppedImageKey(f, '')).toBe('dropped:a.png:1:42')
  })
})
