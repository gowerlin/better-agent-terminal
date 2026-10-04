// @vitest-environment node
/**
 * T0388 (PLAN-036 / D129): channel parity between PROXIED_CHANNELS and the
 * headless bat-server.
 *
 * A remote-profile window proxies every PROXIED_CHANNELS call to its server.
 * Each channel must be answered by headless, or be listed in
 * HEADLESS_UNSUPPORTED (with its phase) / ALWAYS_LOCAL_CHANNELS — see
 * electron/remote/headless-channel-status.ts. Adding a proxied channel
 * without classifying it, or bringing one online without deleting its
 * HEADLESS_UNSUPPORTED line, turns this red.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasHandler } from '../handler-registry'
import {
  ALWAYS_LOCAL_CHANNELS,
  HEADLESS_UNSUPPORTED,
  checkHeadlessParity,
  countHeadlessUnsupportedByPhase,
  type HeadlessParityViolation,
} from '../headless-channel-status'
import { createHeadlessServer, type HeadlessServer } from '../headless-entry'
import { createHeadlessDefaultHandlers } from '../headless-handlers'
import { PROXIED_CHANNELS } from '../protocol'
import { makeHeadlessDataDir, removeHeadlessDataDir } from './helpers/headless-harness'
import { PROJECT_ROOT } from './helpers/server-bundle-config'

function formatViolations(violations: HeadlessParityViolation[]): string {
  return violations.map(v => `  ${v.channel}: ${v.problem}`).join('\n')
}

let dataDir: string
let server: HeadlessServer

beforeAll(async () => {
  dataDir = makeHeadlessDataDir('parity')
  // Registration happens in createHeadlessServer itself; no need to listen.
  server = await createHeadlessServer({
    dataDir,
    port: 0,
    token: 'parity-test-token',
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  })
})

afterAll(async () => {
  await server.stop()
  removeHeadlessDataDir(dataDir)
})

describe('headless channel parity', () => {
  it('every PROXIED_CHANNELS entry is registered on headless, HEADLESS_UNSUPPORTED, or ALWAYS_LOCAL', () => {
    const violations = checkHeadlessParity({ proxiedChannels: PROXIED_CHANNELS, hasHandler })
    expect(
      violations,
      'headless parity broken (see electron/remote/headless-channel-status.ts):\n' + formatViolations(violations),
    ).toEqual([])
  })

  it('headless built-ins only answer proxied channels (no extra capability exposed)', () => {
    const extra = createHeadlessDefaultHandlers({ dataDir }).map(r => r.channel).filter(c => !PROXIED_CHANNELS.has(c))
    expect(extra).toEqual([])
  })

  it('ALWAYS_LOCAL_CHANNELS mirrors the set main.ts bindProxiedHandlersToIpc uses', () => {
    const mainSource = fs.readFileSync(path.join(PROJECT_ROOT, 'electron', 'main.ts'), 'utf8')
    const match = mainSource.match(/const\s+ALWAYS_LOCAL_CHANNELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/)
    expect(match, 'ALWAYS_LOCAL_CHANNELS literal not found in electron/main.ts').not.toBeNull()
    const inMain = [...match![1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort()
    expect([...ALWAYS_LOCAL_CHANNELS].sort()).toEqual(inMain)
  })

  it('HEADLESS_UNSUPPORTED phases are valid', () => {
    for (const [channel, phase] of Object.entries(HEADLESS_UNSUPPORTED)) {
      expect(['P0', 'P1', 'P2', 'P3'], channel).toContain(phase)
    }
    const counts = countHeadlessUnsupportedByPhase()
    expect(counts.P0 + counts.P1 + counts.P2 + counts.P3).toBe(Object.keys(HEADLESS_UNSUPPORTED).length)
  })
})

describe('checkHeadlessParity (negative cases)', () => {
  const proxied = ['a:registered', 'a:unsupported', 'a:local']
  const registered = new Set(['a:registered'])
  const base = {
    proxiedChannels: proxied,
    hasHandler: (c: string) => registered.has(c),
    unsupported: { 'a:unsupported': 'P0' } as const,
    alwaysLocal: new Set(['a:local']),
  }

  it('consistent ledger → no violations', () => {
    expect(checkHeadlessParity(base)).toEqual([])
  })

  it('a new proxied channel nobody classified is flagged', () => {
    expect(checkHeadlessParity({ ...base, proxiedChannels: [...proxied, 'fake:new-channel'] }))
      .toEqual([{ channel: 'fake:new-channel', problem: 'unclassified' }])
  })

  it('a channel brought online but still listed unsupported is flagged', () => {
    expect(checkHeadlessParity({ ...base, hasHandler: c => c === 'a:registered' || c === 'a:unsupported' }))
      .toEqual([{ channel: 'a:unsupported', problem: 'registered-but-listed-unsupported' }])
  })

  it('stale and double-listed entries are flagged', () => {
    expect(checkHeadlessParity({
      ...base,
      unsupported: { 'a:unsupported': 'P0', 'a:local': 'P3', 'gone:channel': 'P1' },
      alwaysLocal: new Set(['a:local', 'gone:local']),
    })).toEqual([
      { channel: 'a:local', problem: 'listed-twice' },
      { channel: 'gone:channel', problem: 'stale-unsupported' },
      { channel: 'gone:local', problem: 'stale-always-local' },
    ])
  })
})
