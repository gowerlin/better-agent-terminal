/**
 * T0834 (PLAN-038 U3): Claude / Codex panel attachments the window's host cannot read are uploaded
 * when the message is sent (T0833 `uploadToRemoteHost`, run for real here against a mocked
 * `window.electronAPI.upload`) and go out as `@<serverPath>`; a failure, a limit or an old
 * bat-server falls back to the T0437 refusal with a toast; the upload can be cancelled (nothing
 * is sent, the draft stays); a local window is unchanged.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { ClaudeAgentPanel } from '../components/ClaudeAgentPanel'
import { CodexAgentPanel } from '../components/CodexAgentPanel'
import type { ResolvedClientPath } from '../lib/client-paths'
import type {
  RemoteUploadApi,
  RemoteUploadChunkResult,
  RemoteUploadPrepareResult,
  RemoteUploadProgressEvent,
  RemoteUploadSourceDescriptor,
} from '../lib/remote-upload'

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

/** SSH-like rules: no local file is on the host. */
function sshLike(paths: string[]): ResolvedClientPath[] {
  return paths.map(input => ({ input, serverPath: null, reachable: false, reason: 'ssh-local-file' as const }))
}

const getPathForFile = vi.fn<(file: File) => string>()
const sendMessage = vi.fn(async (_sid: string, _prompt: string, _images?: string[]) => undefined)
const resolveClientPaths = vi.fn(async (paths: string[], _purpose: string) => sshLike(paths))

/** A fake main side of T0833: every `file` transfer is accepted unless `refuse` names it. */
function fakeUploadApi(opts: { refuse?: Record<string, string>; prepareFails?: string; chunkBytes?: number; holdSecondChunk?: boolean } = {}) {
  let progressListener: ((event: RemoteUploadProgressEvent) => void) | null = null
  const transfers = new Map<string, { name: string; size: number }>()
  let pendingChunk: ((result: RemoteUploadChunkResult) => void) | null = null
  let batchId = ''
  let chunkCalls = 0
  const api: RemoteUploadApi = {
    prepare: vi.fn(async (sessionKey: string, sources: RemoteUploadSourceDescriptor[]): Promise<RemoteUploadPrepareResult> => {
      if (opts.prepareFails) return { ok: false, code: opts.prepareFails as 'SERVER_TOO_OLD', message: 'refused' }
      batchId = `b-${sessionKey}`
      return {
        ok: true,
        batchId,
        items: sources.map((s, i) => {
          const name = s.kind === 'file' ? s.name : s.kind === 'path' ? s.path.split(/[\\/]/).pop()! : 'clipboard.png'
          const code = opts.refuse?.[name]
          if (code) return { ok: false as const, code: code as 'TOO_LARGE', message: 'refused' }
          const size = s.kind === 'file' ? s.size : 1
          const transferId = `t${i}`
          transfers.set(transferId, { name, size })
          return { ok: true as const, transferId, kind: s.kind, name, size }
        }),
      }
    }),
    begin: vi.fn(async () => ({ ok: true as const, chunkBytes: opts.chunkBytes ?? 256 * 1024 })),
    chunk: vi.fn((transferId: string, offset: number, data: Uint8Array) => {
      chunkCalls++
      const received = offset + data.byteLength
      if (opts.holdSecondChunk && chunkCalls >= 2) {
        return new Promise<RemoteUploadChunkResult>(resolve => { pendingChunk = resolve })
      }
      progressListener?.({ batchId, transferId, received, size: transfers.get(transferId)!.size })
      return Promise.resolve<RemoteUploadChunkResult>({ ok: true, received })
    }),
    finish: vi.fn(async (transferId: string) => {
      const t = transfers.get(transferId)!
      return { ok: true as const, serverPath: `/home/u/.bat/uploads/s/${transferId}/${t.name}`, size: t.size }
    }),
    run: vi.fn(async (transferId: string) => {
      const t = transfers.get(transferId)!
      return { ok: true as const, serverPath: `/home/u/.bat/uploads/s/${transferId}/${t.name}`, size: t.size }
    }),
    abort: vi.fn(async (_id: string) => {
      // main fails the chunk in flight when its transfer is aborted
      pendingChunk?.({ ok: false, code: 'CANCELLED', message: 'aborted' })
      pendingChunk = null
      return { ok: true as const, aborted: 1 }
    }),
    onProgress: vi.fn((cb: (event: RemoteUploadProgressEvent) => void) => {
      progressListener = cb
      return () => { if (progressListener === cb) progressListener = null }
    }),
  }
  return api
}

let uploadApi: RemoteUploadApi

function installApi() {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    shell: { getPathForFile },
    remote: { resolveClientPaths },
    upload: uploadApi as unknown as Record<string, unknown>,
    debug: { log: vi.fn(), isDebugMode: false },
    claude: { getStatuslineExtras: vi.fn(async () => ({})), sendMessage },
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
  sendMessage.mockClear()
  resolveClientPaths.mockClear()
  resolveClientPaths.mockImplementation(async (paths: string[]) => sshLike(paths))
  uploadApi = fakeUploadApi()
  installApi()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function dropFiles(container: HTMLElement, files: Array<{ path: string; content?: string }>) {
  const objects = files.map(f => new File([f.content ?? 'x'], f.path.split(/[\\/]/).pop()!, { type: 'text/plain' }))
  getPathForFile.mockImplementation((f: File) => files[objects.indexOf(f)]?.path ?? '')
  const panel = container.querySelector('.claude-agent-panel')!
  await act(async () => {
    fireEvent.drop(panel, { dataTransfer: { files: objects, types: ['Files'], getData: () => '' } })
  })
  await waitFor(() => expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(files.length))
  return objects
}

async function typeAndEnter(container: HTMLElement, text: string) {
  const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
  await act(async () => {
    input.value = text
    fireEvent.input(input)
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

async function toastText(container: HTMLElement): Promise<string> {
  return waitFor(() => {
    const el = container.querySelector('.ct-toast')
    expect(el).not.toBeNull()
    return el!.textContent ?? ''
  })
}

describe.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} isRemoteConnected={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} isRemoteConnected={true} />],
] as const)('%s: attachments uploaded to the remote host', (name, renderPanel) => {
  test('every unreachable attachment is uploaded and sent as @<serverPath>', async () => {
    const sid = `t0834-ok-${name}`
    const { container } = render(renderPanel(sid))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }, { path: 'D:\\data\\b.csv', content: 'hello' }])
    await typeAndEnter(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(uploadApi.prepare).toHaveBeenCalledWith(sid, [
      { kind: 'file', name: 'a.txt', size: 1 },
      { kind: 'file', name: 'b.csv', size: 5 },
    ])
    expect(sendMessage.mock.calls[0][1]).toBe('@/home/u/.bat/uploads/s/t0/a.txt\n@/home/u/.bat/uploads/s/t1/b.csv\n\nlook')
    expect(container.querySelector('.ct-toast')).toBeNull()
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(0)
    expect((container.querySelector('textarea.claude-input') as HTMLTextAreaElement).readOnly).toBe(false)
  })

  test('one attachment over the per-file limit: refused with a toast, the others are sent', async () => {
    uploadApi = fakeUploadApi({ refuse: { 'big.bin': 'TOO_LARGE' } })
    installApi()
    const { container } = render(renderPanel(`t0834-partial-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }, { path: 'C:\\Users\\u\\big.bin' }])
    await typeAndEnter(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][1]).toBe('@/home/u/.bat/uploads/s/t0/a.txt\n\nlook')
    const text = await toastText(container)
    // T0843: the reason first, the file named once, no T0437 sentence (an upload was tried).
    expect(text.replace(/×$/, '')).toBe('Not attached (over the 50 MiB per-file limit): big.bin')
  })

  test('an old bat-server (no upload:*): the T0437 refusal and toast, the text is still sent', async () => {
    uploadApi = fakeUploadApi({ prepareFails: 'SERVER_TOO_OLD' })
    installApi()
    const { container } = render(renderPanel(`t0834-old-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }])
    await typeAndEnter(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(sendMessage.mock.calls[0][1]).toBe('look')
    const text = await toastText(container)
    expect(text.replace(/×$/, '')).toBe('Not attached (the BAT server on the remote host is too old to accept uploads; update it): a.txt')
  })

  test('upload failed and nothing else to send: nothing is sent, the refused chip is removed', async () => {
    uploadApi = fakeUploadApi({ prepareFails: 'NOT_CONNECTED' })
    installApi()
    const { container } = render(renderPanel(`t0834-none-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }])
    await typeAndEnter(container, '')

    // T0843: uploadable reason + connection failure → the reason first, verbatim.
    expect((await toastText(container)).replace(/×$/, '')).toBe('Not attached (the connection to the remote host failed): a.txt')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(0)
  })

  test('progress on the chip, Send disabled while uploading; cancel keeps the draft and sends nothing', async () => {
    uploadApi = fakeUploadApi({ chunkBytes: 4, holdSecondChunk: true })
    installApi()
    const { container } = render(renderPanel(`t0834-cancel-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt', content: 'abcdefgh' }])
    await typeAndEnter(container, 'look')

    // first 4 of 8 bytes confirmed, the second chunk is in flight
    await waitFor(() => expect(container.querySelector('.claude-attachment-upload-progress')).toHaveTextContent('uploading 50%'))
    const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
    expect(input.readOnly).toBe(true)
    expect(container.querySelector('.claude-send-btn')).toBeDisabled()
    expect(container.querySelector('.claude-add-image-btn')).toBeNull()

    // Enter again does not start a second send
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(uploadApi.prepare).toHaveBeenCalledTimes(1)

    const cancel = container.querySelector('.claude-attachment-file .claude-attachment-remove') as HTMLButtonElement
    expect(cancel).toHaveAttribute('aria-label', 'Cancel upload (nothing is sent)')
    await act(async () => { fireEvent.click(cancel) })

    expect(await toastText(container)).toContain('Upload cancelled')
    expect(uploadApi.abort).toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(1)
    expect(container.querySelector('.claude-attachment-upload-progress')).toBeNull()
    expect(input.value).toBe('look')
    expect(input.readOnly).toBe(false)
    expect(container.querySelector('.claude-send-btn')).not.toBeDisabled()
  })

  test('Esc in the input while uploading cancels the upload and keeps the draft', async () => {
    uploadApi = fakeUploadApi({ chunkBytes: 4, holdSecondChunk: true })
    installApi()
    const { container } = render(renderPanel(`t0834-esc-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt', content: 'abcdefgh' }])
    await typeAndEnter(container, 'look')
    await waitFor(() => expect(container.querySelector('.claude-attachment-upload-progress')).not.toBeNull())

    const input = container.querySelector('textarea.claude-input') as HTMLTextAreaElement
    await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }) })

    expect(await toastText(container)).toContain('Upload cancelled')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(input.value).toBe('look')
    expect(container.querySelectorAll('.claude-attachment-file')).toHaveLength(1)
  })

  test('a reachable attachment (WSL /mnt/c) is not uploaded; only the unreachable one is', async () => {
    resolveClientPaths.mockImplementation(async (paths: string[]) => paths.map(input => (input.startsWith('C:\\')
      ? { input, serverPath: '/mnt/c/' + input.slice(3).replace(/\\/g, '/'), reachable: true }
      : { input, serverPath: null, reachable: false, reason: 'outside-wsl-distro' as const })))
    const { container } = render(renderPanel(`t0834-mixed-${name}`))
    await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }, { path: '\\\\srv\\share\\doc.pdf' }])
    await typeAndEnter(container, 'look')

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    expect(uploadApi.prepare).toHaveBeenCalledWith(expect.any(String), [{ kind: 'file', name: 'doc.pdf', size: 1 }])
    expect(sendMessage.mock.calls[0][1]).toBe('@/mnt/c/Users/u/a.txt\n@/home/u/.bat/uploads/s/t0/doc.pdf\n\nlook')
  })
})

test.each([
  ['ClaudeAgentPanel', (sid: string) => <ClaudeAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
  ['CodexAgentPanel', (sid: string) => <CodexAgentPanel sessionId={sid} cwd="C:\\repo" isActive={true} />],
] as const)('%s in a local window: the attachment path is sent unchanged, nothing is uploaded', async (name, renderPanel) => {
  resolveClientPaths.mockImplementation(async (paths: string[]) => paths.map(input => ({ input, serverPath: input, reachable: true })))
  const { container } = render(renderPanel(`t0834-local-${name}`))
  await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }])
  await typeAndEnter(container, 'hi')

  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
  expect(sendMessage.mock.calls[0][1]).toBe('@C:\\Users\\u\\a.txt\n\nhi')
  expect(uploadApi.prepare).not.toHaveBeenCalled()
  expect(uploadApi.onProgress).not.toHaveBeenCalled()
})

test('a local Claude window shows the attachment note exactly as before T0834', async () => {
  resolveClientPaths.mockImplementation(async (paths: string[]) => paths.map(input => ({ input, serverPath: input, reachable: true })))
  const { container } = render(<ClaudeAgentPanel sessionId="t0834-local-note" cwd="C:\\repo" isActive={true} />)
  await dropFiles(container, [{ path: 'C:\\Users\\u\\a.txt' }])
  await typeAndEnter(container, 'hi')

  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
  // `split('/')` of a Windows path is the whole path (unchanged T0437 note)
  await waitFor(() => expect(container.textContent).toContain('[1 file attached: C:\\Users\\u\\a.txt]'))
})

test('an uploaded attachment shows its own file name in a local-session note', async () => {
  // isRemoteConnected false + a remote window is not a real combination; the note is what the
  // panel would show for a non-mirrored session, so it checks displayNames end to end.
  const { container } = render(<ClaudeAgentPanel sessionId="t0834-note" cwd="C:\\repo" isActive={true} />)
  await dropFiles(container, [{ path: 'C:\\Users\\u\\report final.txt' }])
  await typeAndEnter(container, 'hi')

  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(container.textContent).toContain('[1 file attached: report final.txt]'))
})
