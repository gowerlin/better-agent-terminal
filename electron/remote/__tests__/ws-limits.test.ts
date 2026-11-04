// @vitest-environment node
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { FRAME_TOO_LARGE, WS_MAX_PAYLOAD_BYTES, encodeFrameWithinLimit, frameTooLargeMessage } from '../ws-limits'

describe('ws-limits (T0842 / BUG-211)', () => {
  it('32 MiB, the value every released bat-server uses', () => {
    expect(WS_MAX_PAYLOAD_BYTES).toBe(32 * 1024 * 1024)
  })

  it('encodes a frame within the limit as JSON', () => {
    const frame = { type: 'invoke', id: '1', channel: 'test:x', args: ['é'] }
    const r = encodeFrameWithinLimit(frame, 1000)
    expect(r).toEqual({ ok: true, data: JSON.stringify(frame), bytes: Buffer.byteLength(JSON.stringify(frame)) })
  })

  it('measures UTF-8 bytes, not characters; the limit itself is allowed', () => {
    const base = { type: 'invoke', id: '1', channel: 'c', args: [''] }
    const overhead = Buffer.byteLength(JSON.stringify(base))
    const atLimit = { ...base, args: ['中'.repeat(10)] } // 30 bytes, 10 characters
    expect(encodeFrameWithinLimit(atLimit, overhead + 30).ok).toBe(true)
    const r = encodeFrameWithinLimit(atLimit, overhead + 29)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe(FRAME_TOO_LARGE)
    expect(r.error.bytes).toBe(overhead + 30)
    expect(r.error.limit).toBe(overhead + 29)
    expect(r.error.message).toBe(frameTooLargeMessage('c', overhead + 30, overhead + 29))
    expect(r.error.message).toBe(`FRAME_TOO_LARGE: c frame is ${overhead + 30} bytes; the remote connection accepts at most ${overhead + 29} bytes`)
  })

  it('a frame without a channel is named by its type', () => {
    const r = encodeFrameWithinLimit({ type: 'auth', token: 'x'.repeat(100) } as { type: string }, 10)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message.startsWith('FRAME_TOO_LARGE: auth frame is ')).toBe(true)
  })

  it('source guard: server and client use the shared constant; the client never sends an unchecked frame', () => {
    const dir = path.join(__dirname, '..')
    const server = fs.readFileSync(path.join(dir, 'remote-server.ts'), 'utf8')
    const client = fs.readFileSync(path.join(dir, 'remote-client.ts'), 'utf8')
    expect(server).toMatch(/import \{ WS_MAX_PAYLOAD_BYTES \} from '\.\/ws-limits'/)
    expect(server).not.toMatch(/const WS_MAX_PAYLOAD_BYTES\s*=/)
    expect(server).toMatch(/maxPayload: WS_MAX_PAYLOAD_BYTES/)
    // every ws.send in the client sends an encodeFrameWithinLimit result
    const sends = client.match(/\bws!?\??\.send\(([^)]*)\)/g) ?? []
    expect(sends.length).toBeGreaterThanOrEqual(2)
    for (const s of sends) expect(s).toMatch(/\.send\(encoded\w*\.data\)/)
  })
})
