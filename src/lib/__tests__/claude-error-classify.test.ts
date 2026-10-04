// BUG-084 / T0372 — pure tests for classifyClaudeError.
//
// Fixtures #1-#2 are the raw strings observed in T0368 experiments, verbatim.

import { describe, it, expect } from 'vitest'
import { classifyClaudeError } from '../claude-error-classify'

// #1 embedded 2.1.113 + claude-opus-5-5 (assistant text / result text)
const RAW_OPUS_TOO_OLD = `API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required. Run 'claude update', or update the Claude desktop app, then try again.","error_code":"claude_code_version_too_old"},"request_id":"req_011CfgrA72sUuecgiqB9xRCj"}`
// #2 same, as thrown by the SDK iterator and forwarded on `claude:error`
const RAW_THROWN = `Claude Code returned an error result: ${RAW_OPUS_TOO_OLD}`

describe('classifyClaudeError — T0368 raw fixtures', () => {
  it('#1 version-too-old API error yields both versions', () => {
    expect(classifyClaudeError(RAW_OPUS_TOO_OLD)).toEqual({
      kind: 'cli-too-old',
      currentVersion: '2.1.113',
      requiredVersion: '2.1.280',
    })
  })

  it('#2 SDK-wrapped thrown error is classified the same way', () => {
    expect(classifyClaudeError(RAW_THROWN)).toEqual({
      kind: 'cli-too-old',
      currentVersion: '2.1.113',
      requiredVersion: '2.1.280',
    })
  })

  it('Fable 5.1 threshold (2.1.251) is extracted', () => {
    const raw = RAW_OPUS_TOO_OLD.replace('2.1.280', '2.1.251')
    expect(classifyClaudeError(raw).requiredVersion).toBe('2.1.251')
  })
})

describe('classifyClaudeError — case and wording variants', () => {
  it('matches case-insensitively', () => {
    expect(classifyClaudeError(RAW_OPUS_TOO_OLD.toUpperCase())).toEqual({
      kind: 'cli-too-old',
      currentVersion: '2.1.113',
      requiredVersion: '2.1.280',
    })
  })

  it('error code alone is enough (no versions)', () => {
    expect(classifyClaudeError('API Error: 400 {"error_code":"claude_code_version_too_old"}')).toEqual({
      kind: 'cli-too-old',
    })
  })

  it('missing current version keeps the required one', () => {
    expect(classifyClaudeError('This model needs version 2.1.280 or newer is required. error_code: claude_code_version_too_old')).toEqual({
      kind: 'cli-too-old',
      requiredVersion: '2.1.280',
    })
  })

  it('phrase match without error code (JSON stripped)', () => {
    expect(classifyClaudeError('Claude Code 2.1.200 does not support this model; version 2.1.280 or newer is required.')).toEqual({
      kind: 'cli-too-old',
      currentVersion: '2.1.200',
      requiredVersion: '2.1.280',
    })
  })
})

describe('classifyClaudeError — unrelated errors', () => {
  it.each([
    '',
    'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long"}}',
    'Claude Code process exited with code 1',
    'Session not found',
    // Required-version phrase alone, without the "does not support this model" context
    'Node version 22.0.0 or newer is required',
  ])('%s -> unknown', raw => {
    expect(classifyClaudeError(raw)).toEqual({ kind: 'unknown' })
  })

  it('non-string input -> unknown', () => {
    expect(classifyClaudeError(undefined as unknown as string)).toEqual({ kind: 'unknown' })
  })
})
