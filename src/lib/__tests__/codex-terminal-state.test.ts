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
  PROGRAM_STATUS_APPS,
  PROGRAM_STATUS_PROBE_REPLY,
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
    // T0717 (D192): codex 0.166+ ends a turn with `done` / `error` (kept until a key press) → idle;
    // `blocked` carries `:kind=…`, ignored
    ['state=done:app=codex', 'idle'],
    ['state=error:app=codex', 'idle'],
    ['state=blocked:app=codex:kind=permission', 'blocked'],
    ['state=blocked:app=codex:kind=question', 'blocked'],
    ['state=blocked:app=codex:kind=auth', 'blocked'],
  ])('%s → %s', (payload, state) => {
    expect(parseCodexOscPayload(payload)).toBe(state)
  })

  it.each([
    ['state=idle:app=other', 'another app'],
    ['state=done:app=other', 'another app (done)'],
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
    expect(scanCodexStates(text)).toEqual({ states: ['idle', 'working', 'clear'], probes: 0, tail: '' })
  })

  it('other OSC sequences (titles, OSC 9, 7501 of another app, unknown values) are ignored', () => {
    const text = `\x1b]0;codex${BEL}\x1b]9;Approval requested${BEL}${osc('state=idle:app=vim')}${osc('state=thinking')}${osc('state=blocked:app=codex')}`
    expect(scanCodexStates(text).states).toEqual(['blocked'])
  })

  it('codex 0.166 turn: working → blocked (kind) → working → done → (key press) idle', () => {
    // the exact bytes 0.166 writes: `ESC ] 7501 ; state=<s>:app=codex[:kind=<k>] ESC \`
    const text = [
      osc('state=working:app=codex'),
      osc('state=blocked:app=codex:kind=permission'),
      osc('state=working:app=codex'),
      osc('state=done:app=codex'),
      osc('state=idle:app=codex'),
      osc('state=working:app=codex'),
      osc('state=error:app=codex'),
    ].join('out ')
    expect(scanCodexStates(text).states).toEqual(['working', 'blocked', 'working', 'idle', 'idle', 'working', 'idle'])
    expect(lastCodexState(text)).toBe('idle')
  })

  it('a sequence broken by another escape or an overlong one is skipped; the scan goes on', () => {
    const broken = `${CODEX_OSC_PREFIX}state=idle\x1b[0m`
    const overlong = `${CODEX_OSC_PREFIX}${'x'.repeat(CODEX_OSC_PAYLOAD_MAX + 5)}${ST}`
    expect(scanCodexStates(`${broken}${overlong}${osc('state=working')}`)).toEqual({ states: ['working'], probes: 0, tail: '' })
  })

  it('an unfinished sequence at the end comes back as the tail (bounded)', () => {
    expect(scanCodexStates(`x${CODEX_OSC_PREFIX}state=blo`)).toEqual({ states: [], probes: 0, tail: `${CODEX_OSC_PREFIX}state=blo` })
    expect(scanCodexStates(`x${CODEX_OSC_PREFIX}state=blocked\x1b`)).toEqual({ states: [], probes: 0, tail: `${CODEX_OSC_PREFIX}state=blocked\x1b` })
    // the prefix itself split
    expect(scanCodexStates('abc\x1b]75')).toEqual({ states: [], probes: 0, tail: '\x1b]75' })
    expect(scanCodexStates('abc\x1b')).toEqual({ states: [], probes: 0, tail: '\x1b' })
    expect(scanCodexStates('abc\x1b[3')).toEqual({ states: [], probes: 0, tail: '' })
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

// PLAN-061 / T0811: claude's OSC 7501 (sequences as measured with claude 2.1.316, T0789 ②)
describe('claude-code OSC 7501 (T0811)', () => {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')

  it.each([
    ['state=idle:app=claude-code', 'idle'],
    ['state=working:app=claude-code', 'working'],
    [`state=working:app=claude-code:msg=${b64('T0789 permission prompt')}`, 'working'],
    [`state=blocked:app=claude-code:kind=permission:msg=${b64('approve Bash: curl -s x')}`, 'blocked'],
    [`state=blocked:app=claude-code:kind=question:msg=${b64('answer: which?')}`, 'blocked'],
    ['state=blocked:app=claude-code:kind=auth', 'blocked'],
    ['state=blocked:app=claude-code', 'blocked'], // `dialog open`: no kind
    ['state=done:app=claude-code', 'idle'],
    [`state=error:app=claude-code:msg=${b64('API Error: 400')}`, 'idle'],
    ['state=working:app=claude-code:progress=50', 'working'],
    ['state=clear', 'clear'], // the end of the program: no app, no id → the tab's clear
  ])('%s → %s', (payload, state) => {
    expect(parseCodexOscPayload(payload)).toBe(state)
  })

  it('allowed apps only: codex and claude-code', () => {
    expect(PROGRAM_STATUS_APPS).toEqual(['codex', 'claude-code'])
    expect(parseCodexOscPayload('state=idle:app=claude')).toBeNull()
    expect(parseCodexOscPayload('state=idle:app=claude-code-x')).toBeNull()
    expect(parseCodexOscPayload('state=idle:app=Claude-Code')).toBeNull()
  })

  it('a sub-record with id= never changes the tab: working / blocked with app, clear without app', () => {
    const title = b64('T0789 background helper')
    expect(parseCodexOscPayload(`state=working:app=claude-code:id=aaa1f21de1a96b886:title=${title}`)).toBeNull()
    expect(parseCodexOscPayload('state=blocked:app=claude-code:id=aaa1f21de1a96b886')).toBeNull()
    expect(parseCodexOscPayload('state=clear:id=aaa1f21de1a96b886')).toBeNull()
    expect(parseCodexOscPayload('state=clear:id=')).toBeNull()
    expect(parseCodexOscPayload('id=x:state=idle:app=codex')).toBeNull()
    // the background sub-agent sequence of T0789 ②: the tab stays working, then done
    const text = [
      osc('state=working:app=claude-code'),
      osc(`state=working:app=claude-code:id=aaa1f21de1a96b886:title=${title}`),
      osc('state=working:app=claude-code'),
      osc('state=clear:id=aaa1f21de1a96b886'),
      osc('state=done:app=claude-code'),
      osc('state=clear', BEL),
    ].join('')
    expect(scanCodexStates(text).states).toEqual(['working', 'working', 'idle', 'clear'])
  })

  it('unknown keys and values are ignored; title / msg are not decoded', () => {
    expect(parseCodexOscPayload('state=thinking:app=claude-code')).toBeNull()
    expect(parseCodexOscPayload('state=idle:app=claude-code:future=1:kind=unknown')).toBe('idle')
    // a msg that decodes to `state=blocked` changes nothing: it is never decoded
    expect(parseCodexOscPayload(`state=working:app=claude-code:msg=${b64('state=blocked:app=codex')}`)).toBe('working')
  })

  it('payload limit 4096: a long blocked msg (130 → ~2.8k) is read, past the limit it is dropped', () => {
    expect(CODEX_OSC_PAYLOAD_MAX).toBe(4096)
    const head = 'state=blocked:app=claude-code:kind=permission:msg='
    const t0789 = `${head}${'A'.repeat(130 - head.length)}` // the 130 chars dropped by the old 128 limit
    expect(scanCodexStates(osc(t0789)).states).toEqual(['blocked'])
    const max = `${head}${'A'.repeat(2732)}` // msg 2,048 bytes in base64
    expect(scanCodexStates(osc(max)).states).toEqual(['blocked'])
    const atLimit = `${head}${'A'.repeat(CODEX_OSC_PAYLOAD_MAX - head.length)}`
    expect(atLimit).toHaveLength(CODEX_OSC_PAYLOAD_MAX)
    expect(scanCodexStates(osc(atLimit)).states).toEqual(['blocked'])
    expect(scanCodexStates(`${osc(`${atLimit}A`)}${osc('state=idle:app=claude-code')}`).states).toEqual(['idle'])
    // split across chunks: the tail keeps up to the limit
    const scanner = new CodexStateScanner()
    const whole = osc(max)
    expect(scanner.feed('a', whole.slice(0, 1500))).toEqual([])
    expect(scanner.feed('a', whole.slice(1500))).toEqual(['blocked'])
  })

  it('the probe ESC ] 7501 ; ? (BEL or ST) is counted, never a state', () => {
    expect(scanCodexStates(`\x1b[>0q\x1b[?u${CODEX_OSC_PREFIX}?${BEL}\x1b[c`)).toEqual({ states: [], probes: 1, tail: '' })
    expect(scanCodexStates(`${CODEX_OSC_PREFIX}?${ST}`)).toEqual({ states: [], probes: 1, tail: '' })
    expect(scanCodexStates(`${CODEX_OSC_PREFIX}?${BEL}x${CODEX_OSC_PREFIX}?${ST}`).probes).toBe(2)
    // not the probe: other payloads that start with `?` or contain it, the reply's echo is the same bytes
    expect(scanCodexStates(`${CODEX_OSC_PREFIX}?x${BEL}${CODEX_OSC_PREFIX}ok${BEL}${CODEX_OSC_PREFIX}${BEL}`).probes).toBe(0)
    expect(PROGRAM_STATUS_PROBE_REPLY).toBe('\x1b]7501;?\x07')
    // split at every point: counted once, by the chunk that ends it
    const whole = `a${CODEX_OSC_PREFIX}?${BEL}b`
    for (let cut = 0; cut <= whole.length; cut++) {
      const scanner = new CodexStateScanner()
      const n = scanner.scan('a', whole.slice(0, cut)).probes + scanner.scan('a', whole.slice(cut)).probes
      expect(n, `cut=${cut}`).toBe(1)
    }
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
