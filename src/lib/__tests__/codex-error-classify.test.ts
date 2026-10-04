// BUG-083 / T0367 — pure tests for classifyCodexError.
//
// Fixtures #1-#3 are the raw strings observed in T0366 experiments, verbatim.

import { describe, it, expect } from 'vitest'
import { classifyCodexError } from '../codex-error-classify'

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
