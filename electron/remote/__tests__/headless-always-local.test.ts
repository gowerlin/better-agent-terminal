// @vitest-environment node
/**
 * T0422 (PLAN-036 P3 / T0386 J): snippet:* and the BAT log channels
 * (settings:get-logging-info / settings:cleanup-logs) are ALWAYS_LOCAL.
 *
 * A remote-profile window calling them is answered by this machine's Electron
 * main (bindProxiedHandlersToIpc short-circuits ALWAYS_LOCAL_CHANNELS to
 * invokeHandler before the remote branch): snippets live in the local
 * userData, and the log dir the settings page shows is opened with the local
 * shell:open-path. Headless never answers them.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ALWAYS_LOCAL_CHANNELS, HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { PATH_FREE_CHANNELS, SERVER_PATH_RESULT_CHANNELS } from '../path-aware-channels'
import { PROXIED_CHANNELS } from '../protocol'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'
import { PROJECT_ROOT } from './helpers/server-bundle-config'

const T0422_CHANNELS = [
  'settings:get-logging-info',
  'settings:cleanup-logs',
  'snippet:getAll',
  'snippet:getById',
  'snippet:create',
  'snippet:update',
  'snippet:delete',
  'snippet:toggleFavorite',
  'snippet:search',
  'snippet:getCategories',
  'snippet:getFavorites',
  'snippet:getByWorkspace',
]

const mainSource = fs.readFileSync(path.join(PROJECT_ROOT, 'electron', 'main.ts'), 'utf8')

describe('T0422: snippet / logging channels are always-local', () => {
  it('each channel is ALWAYS_LOCAL, still IPC-bound (proxied list), and not HEADLESS_UNSUPPORTED', () => {
    for (const channel of T0422_CHANNELS) {
      expect(ALWAYS_LOCAL_CHANNELS.has(channel), channel).toBe(true)
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(HEADLESS_UNSUPPORTED, channel), channel).toBe(false)
    }
  })

  it('the snippet / logging block is gone from HEADLESS_UNSUPPORTED', () => {
    expect(Object.keys(HEADLESS_UNSUPPORTED).filter(c => c.startsWith('snippet:') || c.startsWith('settings:'))).toEqual([])
  })

  it('main.ts registers a local handler for each channel', () => {
    for (const channel of T0422_CHANNELS) {
      expect(mainSource, channel).toContain(`registerHandler('${channel}'`)
    }
  })

  it('bindProxiedHandlersToIpc answers ALWAYS_LOCAL locally before the remote branch', () => {
    const bind = mainSource.slice(mainSource.indexOf('function bindProxiedHandlersToIpc'))
    const localShortCircuit = bind.search(/if \(ALWAYS_LOCAL_CHANNELS\.has\(channel\)\) \{\s*return invokeHandler\(channel, args, windowId\)/)
    const remoteInvoke = bind.indexOf('remoteClient.invoke(channel, args)')
    expect(localShortCircuit).toBeGreaterThan(-1)
    expect(remoteInvoke).toBeGreaterThan(localShortCircuit)
  })

  it('path tables: path-free with an ALWAYS_LOCAL reason, no server-path result', () => {
    for (const channel of T0422_CHANNELS) {
      expect(PATH_FREE_CHANNELS.get(channel), channel).toMatch(/^ALWAYS_LOCAL \(never proxied\)/)
      expect(SERVER_PATH_RESULT_CHANNELS.has(channel), channel).toBe(false)
    }
  })

  describe('headless', () => {
    let harness: HeadlessHarness

    beforeAll(async () => {
      harness = await startHeadlessHarness({ timeoutMs: 15_000 })
    })

    afterAll(async () => {
      await harness.dispose()
    })

    it('does not answer them (the client does)', async () => {
      for (const channel of T0422_CHANNELS) {
        await expect(harness.invoke(channel), channel).rejects.toThrow(`No handler for channel: ${channel}`)
      }
    })
  })
})
