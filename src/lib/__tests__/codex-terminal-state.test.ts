/**
 * PLAN-047 M1b-2 / T0621: codex's OSC 7501 (src/lib/codex-terminal-state.ts).
 *
 *   - payload: state values, `app=` other than codex, unknown values, separators
 *   - scan: ST and BEL endings, several per chunk, malformed / overlong sequences skipped, the
 *     sequence split anywhere across chunks (prefix included), bounded tail, buried in a lot of output
 *   - lastCodexState (the replay), CodexStateScanner per PTY, the version threshold
 */
import { describe, expect, it } from 'vitest'
import {
  CODEX_OSC_PAYLOAD_MAX,
  CODEX_OSC_PREFIX,
  CodexStateScanner,
  codexVersionWritesOsc,
  lastCodexState,
  parseCodexOscPayload,
  scanCodexStates,
} from '../codex-terminal-state'

const ST = '\x1b\\'
const BEL = '\x07'
const osc = (payload: string, end = ST) => `${CODEX_OSC_PREFIX}${payload}${end}`

describe('parseCodexOscPayload', () => {
  it.each([
    ['state=idle:app=codex', 'idle'],
    ['state=working:app=codex', 'working'],
    ['state=blocked:app=codex', 'blocked'],
    ['state=clear', 'clear'],
    ['state=working', 'working'],
    ['app=codex:state=blocked', 'blocked'],
    ['state=idle;app=codex', 'idle'],
  ])('%s → %s', (payload, state) => {
    expect(parseCodexOscPayload(payload)).toBe(state)
  })

  it.each([
    ['state=idle:app=other', 'another app'],
    ['state=thinking:app=codex', 'unknown value'],
    ['status=idle', 'no state key'],
    ['', 'empty'],
    ['state=', 'empty value'],
  ])('%s → null (%s)', payload => {
    expect(parseCodexOscPayload(payload)).toBeNull()
  })
})

describe('scanCodexStates', () => {
  it('ST and BEL endings, several in one chunk, between other output', () => {
    const text = `hello ${osc('state=idle:app=codex')}\x1b[2J${osc('state=working:app=codex', BEL)} text ${osc('state=clear')}`
    expect(scanCodexStates(text)).toEqual({ states: ['idle', 'working', 'clear'], tail: '' })
  })

  it('other OSC sequences (titles, OSC 9, 7501 of another app, unknown values) are ignored', () => {
    const text = `\x1b]0;codex${BEL}\x1b]9;Approval requested${BEL}${osc('state=idle:app=vim')}${osc('state=thinking')}${osc('state=blocked:app=codex')}`
    expect(scanCodexStates(text).states).toEqual(['blocked'])
  })

  it('a sequence broken by another escape or an overlong one is skipped; the scan goes on', () => {
    const broken = `${CODEX_OSC_PREFIX}state=idle\x1b[0m`
    const overlong = `${CODEX_OSC_PREFIX}${'x'.repeat(CODEX_OSC_PAYLOAD_MAX + 5)}${ST}`
    expect(scanCodexStates(`${broken}${overlong}${osc('state=working')}`)).toEqual({ states: ['working'], tail: '' })
  })

  it('an unfinished sequence at the end comes back as the tail (bounded)', () => {
    expect(scanCodexStates(`x${CODEX_OSC_PREFIX}state=blo`)).toEqual({ states: [], tail: `${CODEX_OSC_PREFIX}state=blo` })
    expect(scanCodexStates(`x${CODEX_OSC_PREFIX}state=blocked\x1b`)).toEqual({ states: [], tail: `${CODEX_OSC_PREFIX}state=blocked\x1b` })
    // the prefix itself split
    expect(scanCodexStates('abc\x1b]75')).toEqual({ states: [], tail: '\x1b]75' })
    expect(scanCodexStates('abc\x1b')).toEqual({ states: [], tail: '\x1b' })
    expect(scanCodexStates('abc\x1b[3')).toEqual({ states: [], tail: '' })
    // no terminator within the limit: dropped, not kept forever
    expect(scanCodexStates(`${CODEX_OSC_PREFIX}${'y'.repeat(CODEX_OSC_PAYLOAD_MAX + 1)}`).tail).toBe('')
  })

  it('every split point of a sequence gives the same state (ST and BEL)', () => {
    for (const end of [ST, BEL]) {
      const whole = `before ${osc('state=blocked:app=codex', end)} after`
      for (let cut = 0; cut <= whole.length; cut++) {
        const scanner = new CodexStateScanner()
        const states = [...scanner.feed('a', whole.slice(0, cut)), ...scanner.feed('a', whole.slice(cut))]
        expect(states, `cut=${cut}`).toEqual(['blocked'])
      }
    }
  })

  it('buried in a lot of output: found, and linear (no backtracking)', () => {
    const noise = 'line of output \x1b[32mgreen\x1b[0m\r\n'.repeat(40_000) // ~1.3 MB
    const text = `${noise}${osc('state=working:app=codex')}${noise}${osc('state=idle:app=codex')}${noise}`
    const t0 = performance.now()
    expect(scanCodexStates(text).states).toEqual(['working', 'idle'])
    expect(performance.now() - t0).toBeLessThan(1_000)
    // an ESC-heavy chunk that never forms the prefix
    const escs = '\x1b]'.repeat(200_000)
    const t1 = performance.now()
    expect(scanCodexStates(escs).states).toEqual([])
    expect(performance.now() - t1).toBeLessThan(1_000)
  })
})

describe('lastCodexState (Terminal Server replay)', () => {
  it('the last sequence wins; none → null', () => {
    expect(lastCodexState(`${osc('state=idle')}x${osc('state=blocked:app=codex')}y`)).toBe('blocked')
    expect(lastCodexState(`${osc('state=blocked')}${osc('state=working', BEL)}`)).toBe('working')
    expect(lastCodexState(`${osc('state=working')}${osc('state=clear')}\r\n$ `)).toBe('clear')
    expect(lastCodexState('plain shell output\r\n')).toBeNull()
  })
})

describe('CodexStateScanner', () => {
  it('keeps a tail per PTY only while a sequence is open', () => {
    const scanner = new CodexStateScanner()
    expect(scanner.feed('a', `x${CODEX_OSC_PREFIX}state=wor`)).toEqual([])
    expect(scanner.feed('b', `${osc('state=idle')}`)).toEqual(['idle'])
    expect(scanner.feed('a', `king${ST}`)).toEqual(['working'])
    expect((scanner as unknown as { tails: Map<string, string> }).tails.size).toBe(0)
    scanner.feed('a', `${CODEX_OSC_PREFIX}state=bl`)
    scanner.clear('a') // the PTY ended
    expect(scanner.feed('a', `ocked${ST}`)).toEqual([])
  })

  it('plain output (no ESC) keeps nothing', () => {
    const scanner = new CodexStateScanner()
    expect(scanner.feed('a', 'hello world\r\n')).toEqual([])
    expect((scanner as unknown as { tails: Map<string, string> }).tails.size).toBe(0)
  })
})

describe('codexVersionWritesOsc (>= 0.163.0)', () => {
  it.each([
    ['codex-cli 0.163.0', true],
    ['codex-cli 0.163.1\n', true],
    ['codex-cli 0.170.2', true],
    ['codex-cli 1.0.0', true],
    ['codex-cli v0.163.0', true],
    ['codex-cli 0.162.1', false],
    ['codex-cli 0.159.2', false],
    ['codex-cli 0.163.0-alpha.3', false],
    ['codex-cli 0.164.0-alpha.1', true],
  ])('%s → %s', (output, expected) => {
    expect(codexVersionWritesOsc(output)).toBe(expected)
  })

  it('no version in the output → null', () => {
    expect(codexVersionWritesOsc('')).toBeNull()
    expect(codexVersionWritesOsc('error: unknown')).toBeNull()
  })
})
