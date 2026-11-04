import { describe, expect, it } from 'vitest'
import {
  REMOTE_IMAGE_BUDGET_BYTES,
  checkRemoteImageBudget,
  classifyRemoteSendFailure,
  dataUrlDecodedBytes,
  formatMiB,
  remoteImageBudgetMessage,
  remoteSendFailureMessage,
  restoredAttachments,
  restoredInputText,
  totalImageBytes,
} from '../remote-image-budget'

const MiB = 1024 * 1024

/** A base64 data URL whose payload decodes to exactly `rawBytes` bytes. */
function dataUrl(rawBytes: number, type = 'image/png'): string {
  const padding = (3 - (rawBytes % 3)) % 3
  return `data:${type};base64,` + 'A'.repeat(4 * Math.ceil(rawBytes / 3) - padding) + '='.repeat(padding)
}

const t = (key: string, options?: Record<string, unknown>) => `${key}${options ? ' ' + JSON.stringify(options) : ''}`

const FRAME_ERROR = "Error invoking remote method 'claude:send-message': Error: FRAME_TOO_LARGE: claude:send-message frame is 41943230 bytes; the remote connection accepts at most 33554432 bytes"

describe('remote-image-budget', () => {
  it('decodes base64 sizes exactly, padding included', () => {
    for (const n of [0, 1, 2, 3, 1024, 10 * MiB, 10 * MiB + 1]) expect(dataUrlDecodedBytes(dataUrl(n))).toBe(n)
    expect(dataUrlDecodedBytes('data:image/svg+xml,<svg/>')).toBe(6)
    expect(dataUrlDecodedBytes('no-comma')).toBe(8)
    expect(totalImageBytes([dataUrl(5), dataUrl(7)])).toBe(12)
  })

  it('budget is 20 MiB and applies to remote windows only', () => {
    expect(REMOTE_IMAGE_BUDGET_BYTES).toBe(20 * MiB)
    const ten = dataUrl(10 * MiB)
    const three = [ten, ten, ten]
    expect(checkRemoteImageBudget(three, false)).toBeNull() // local window: never checked
    expect(checkRemoteImageBudget([], true)).toBeNull()
    expect(checkRemoteImageBudget([ten, ten], true)).toBeNull() // exactly 20 MiB still fits
    expect(checkRemoteImageBudget([ten, ten, dataUrl(1)], true)).toEqual({ totalBytes: 20 * MiB + 1, limitBytes: 20 * MiB })
    expect(checkRemoteImageBudget(three, true)).toEqual({ totalBytes: 30 * MiB, limitBytes: 20 * MiB })
  })

  it('formats the notice in MiB', () => {
    expect(formatMiB(30 * MiB)).toBe('30.0')
    expect(remoteImageBudgetMessage({ totalBytes: 25 * MiB + MiB / 2, limitBytes: 20 * MiB }, t))
      .toBe('claude.remoteImagesTooLarge {"size":"25.5","limit":"20.0"}')
  })

  it('classifies FRAME_TOO_LARGE (wrapped by IPC or not) and any other failure', () => {
    expect(classifyRemoteSendFailure(new Error(FRAME_ERROR))).toEqual({ kind: 'frame-too-large', frameBytes: 41943230, limitBytes: 33554432 })
    expect(classifyRemoteSendFailure('FRAME_TOO_LARGE')).toEqual({ kind: 'frame-too-large', frameBytes: null, limitBytes: null })
    expect(classifyRemoteSendFailure(new Error("Error invoking remote method 'claude:send-message': Error: Connection closed")))
      .toEqual({ kind: 'failed', reason: 'Connection closed' })
    expect(classifyRemoteSendFailure(new Error('x'.repeat(500)))).toEqual({ kind: 'failed', reason: 'x'.repeat(200) })
  })

  it('failure messages', () => {
    expect(remoteSendFailureMessage(new Error(FRAME_ERROR), t)).toBe('claude.remoteSendTooLarge {"size":"40.0","limit":"32.0"}')
    expect(remoteSendFailureMessage(new Error('FRAME_TOO_LARGE'), t)).toBe('claude.remoteSendTooLargeNoSize')
    expect(remoteSendFailureMessage(new Error('Connection closed'), t)).toBe('claude.remoteSendFailed {"reason":"Connection closed"}')
  })

  it('restores the draft without dropping anything typed or attached since', () => {
    expect(restoredInputText('look', '')).toBe('look')
    expect(restoredInputText('look', '  ')).toBe('look')
    expect(restoredInputText('', 'new')).toBe('new')
    expect(restoredInputText('look', 'new')).toBe('look\nnew')
    const a = { path: 'a' }, b = { path: 'b' }, c = { path: 'c' }
    expect(restoredAttachments([a, b], [], 5)).toEqual([a, b])
    expect(restoredAttachments([a, b], [b, c], 5)).toEqual([a, b, c])
    expect(restoredAttachments([a, b], [c], 2)).toEqual([a, b])
  })
})
