// BUG-083 / T0367 — pure tests for classifyCodexError.
//
// Fixtures #1-#3 are the raw strings observed in T0366 experiments, verbatim.

import { describe, it, expect } from 'vitest'
import { classifyCodexError, codexTransientNoticeKind, isCodexTransientNotice } from '../codex-error-classify'

// #1 CLI 0.160 config warning (item.type="error"; main no longer forwards it as claude:error)
const RAW_CONFIG_WARNING = 'Codex is ignoring 1 unrecognized configuration setting. ... `env` is ignored.'
// #2 H3: embedded 0.124 reads a config.toml value written by a newer Codex
const RAW_CONFIG_INCOMPATIBLE = 'Codex Exec exited with code 1: Error loading config.toml: unknown variant `default`, expected `fast` or `flex` in `service_tier`'
// #3 H1: old CLI + new model
const RAW_CLI_TOO_OLD = "The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."

describe('classifyCodexError — T0366 raw fixtures', () => {
  it('#1 config warning is unknown (no hint)', () => {
    expect(classifyCodexError(RAW_CONFIG_WARNING)).toEqual({ kind: 'unknown' })
  })

  it('#2 config.toml load failure is config-incompatible with key detail', () => {
    expect(classifyCodexError(RAW_CONFIG_INCOMPATIBLE)).toEqual({
      kind: 'config-incompatible',
      detail: 'service_tier',
    })
  })

  it('#3 newer-version requirement is cli-too-old with model detail', () => {
    expect(classifyCodexError(RAW_CLI_TOO_OLD)).toEqual({
      kind: 'cli-too-old',
      detail: 'gpt-5.6-terra',
    })
  })
})

describe('classifyCodexError — case and wording variants', () => {
  it('matches config-incompatible case-insensitively', () => {
    expect(classifyCodexError(RAW_CONFIG_INCOMPATIBLE.toUpperCase()).kind).toBe('config-incompatible')
    expect(classifyCodexError('error LOADING Config.Toml: something').kind).toBe('config-incompatible')
  })

  it('matches cli-too-old case-insensitively and keeps model detail', () => {
    expect(classifyCodexError(RAW_CLI_TOO_OLD.toLowerCase())).toEqual({
      kind: 'cli-too-old',
      detail: 'gpt-5.6-terra',
    })
  })

  it('omits detail when the config key cannot be extracted', () => {
    expect(classifyCodexError('Error loading config.toml: invalid TOML')).toEqual({ kind: 'config-incompatible' })
  })

  it('extracts the key from "unknown field" wording', () => {
    expect(classifyCodexError('Error loading config.toml: unknown field `foo_bar`')).toEqual({
      kind: 'config-incompatible',
      detail: 'foo_bar',
    })
  })

  it('extracts an unquoted or double-quoted model name', () => {
    expect(classifyCodexError('The gpt-9 model requires a newer version of Codex.')).toEqual({
      kind: 'cli-too-old',
      detail: 'gpt-9',
    })
    expect(classifyCodexError('The "gpt-9-mini" model requires a newer version of Codex.')).toEqual({
      kind: 'cli-too-old',
      detail: 'gpt-9-mini',
    })
  })

  it('omits detail when the model cannot be extracted', () => {
    expect(classifyCodexError('This model requires a newer version of Codex')).toEqual({ kind: 'cli-too-old' })
  })
})

describe('classifyCodexError — unrelated and empty input', () => {
  it('returns unknown for unrelated errors', () => {
    expect(classifyCodexError("The 'o3' model is not supported when using Codex with a ChatGPT account.")).toEqual({ kind: 'unknown' })
    expect(classifyCodexError('Codex Exec exited with code 1: network error')).toEqual({ kind: 'unknown' })
  })

  it('returns unknown for empty string', () => {
    expect(classifyCodexError('')).toEqual({ kind: 'unknown' })
  })
})

// T0370 — fixtures #4-#6 are the CLI 0.160 strings recorded in T0369 AC-4 (unauthenticated smoke).
// #4 top-level { type: 'error' } while the WebSocket transport retries
const RAW_RECONNECTING = 'Reconnecting... 2/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: wss://api.openai.com/v1/responses, ...)'
// #5 item.type="error" when switching transport
const RAW_TRANSPORT_FALLBACK = 'Falling back from WebSockets to HTTPS transport...'
// #6 turn.failed after the retries are exhausted — a real failure
const RAW_TURN_FAILED_401 = 'unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses, ...'

describe('isCodexTransientNotice — T0369 / T0366 raw fixtures', () => {
  it('treats the three in-turn progress messages as notices', () => {
    expect(isCodexTransientNotice(RAW_CONFIG_WARNING)).toBe(true)
    expect(isCodexTransientNotice(RAW_RECONNECTING)).toBe(true)
    expect(isCodexTransientNotice(RAW_TRANSPORT_FALLBACK)).toBe(true)
  })

  it('reports the notice kind', () => {
    expect(codexTransientNoticeKind(RAW_CONFIG_WARNING)).toBe('config-warning')
    expect(codexTransientNoticeKind(RAW_RECONNECTING)).toBe('reconnecting')
    expect(codexTransientNoticeKind(RAW_TRANSPORT_FALLBACK)).toBe('transport-fallback')
  })

  it('keeps real failures as errors', () => {
    expect(isCodexTransientNotice(RAW_TURN_FAILED_401)).toBe(false)
    expect(isCodexTransientNotice(RAW_CONFIG_INCOMPATIBLE)).toBe(false)
    expect(isCodexTransientNotice(RAW_CLI_TOO_OLD)).toBe(false)
    expect(isCodexTransientNotice("The 'o3' model is not supported when using Codex with a ChatGPT account.")).toBe(false)
  })
})

describe('isCodexTransientNotice — case, wording and empty input', () => {
  it('matches case-insensitively', () => {
    expect(isCodexTransientNotice(RAW_RECONNECTING.toUpperCase())).toBe(true)
    expect(isCodexTransientNotice(RAW_TRANSPORT_FALLBACK.toLowerCase())).toBe(true)
    expect(isCodexTransientNotice('  codex IS IGNORING 2 unrecognized configuration settings.')).toBe(true)
  })

  it('matches the reconnect counter with or without spaces, any position', () => {
    expect(isCodexTransientNotice('Reconnecting... 5/5')).toBe(true)
    expect(isCodexTransientNotice('stream error: Reconnecting... 1 / 5 (timeout)')).toBe(true)
    expect(isCodexTransientNotice('Falling back from WebSocket to HTTPS transport. reason: 426')).toBe(true)
  })

  it('does not match partial phrases', () => {
    expect(isCodexTransientNotice('Reconnecting failed')).toBe(false)
    expect(isCodexTransientNotice('Error: Codex is ignoring nothing')).toBe(false)
    expect(isCodexTransientNotice('Falling back to defaults')).toBe(false)
  })

  it('returns false for empty input', () => {
    expect(isCodexTransientNotice('')).toBe(false)
    expect(codexTransientNoticeKind('')).toBeUndefined()
  })
})
