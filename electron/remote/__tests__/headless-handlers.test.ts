/**
 * T0385 (BUG-094): headless bat-server registered no handlers, so a remote
 * profile died on `profile:load-snapshot` ("No handler for channel").
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessDefaultHandlers } from '../headless-handlers'
import { createHeadlessServer } from '../headless-entry'
import { hasHandler, invokeHandler } from '../handler-registry'

const tempDirs: string[] = []
function makeDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-headless-handlers-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function handlerMap(dataDir: string) {
  return new Map(createHeadlessDefaultHandlers({ dataDir }).map(r => [r.channel, r.handler]))
}

const ctx = { windowId: null }

describe('createHeadlessDefaultHandlers — profile', () => {
  it('profile:load-snapshot returns null (no snapshot on headless) for any profile id', async () => {
    const h = handlerMap(makeDataDir())
    expect(await h.get('profile:load-snapshot')!(ctx, 'default')).toBeNull()
    expect(await h.get('profile:load-snapshot')!(ctx, 'some-remote-profile-id')).toBeNull()
    expect(await h.get('profile:load-snapshot')!(ctx)).toBeNull()
  })

  it('answers the rest of the profile subset with an empty store', async () => {
    const h = handlerMap(makeDataDir())
    expect(await h.get('profile:list')!(ctx)).toEqual({ profiles: [], activeProfileIds: [] })
    expect(await h.get('profile:get-active-ids')!(ctx)).toEqual([])
    expect(await h.get('profile:load')!(ctx, 'default')).toBeNull()
    expect(await h.get('profile:activate')!(ctx, 'default')).toBeUndefined()
    expect(await h.get('profile:deactivate')!(ctx, 'default')).toBeUndefined()
  })
})

describe('createHeadlessDefaultHandlers — settings', () => {
  it('settings:load returns null before anything is saved', async () => {
    const h = handlerMap(makeDataDir())
    expect(await h.get('settings:load')!(ctx)).toBeNull()
  })

  it('settings:save persists into dataDir and settings:load returns it verbatim', async () => {
    const dataDir = makeDataDir()
    const h = handlerMap(dataDir)
    const payload = JSON.stringify({ theme: 'dark', fontSize: 14 })
    expect(await h.get('settings:save')!(ctx, payload)).toBe(true)
    expect(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf-8')).toBe(payload)
    expect(await h.get('settings:load')!(ctx)).toBe(payload)
  })

  it('settings:save rejects non-JSON payloads without writing', async () => {
    const dataDir = makeDataDir()
    const h = handlerMap(dataDir)
    await expect(h.get('settings:save')!(ctx, '{not json')).rejects.toThrow()
    await expect(h.get('settings:save')!(ctx, 42)).rejects.toThrow(/JSON string/)
    expect(fs.existsSync(path.join(dataDir, 'settings.json'))).toBe(false)
  })
})

describe('createHeadlessServer — built-in registration', () => {
  it('registers profile:load-snapshot so remote invoke no longer hits "No handler"', async () => {
    const dataDir = makeDataDir()
    const server = await createHeadlessServer({ dataDir, port: 0, logger: { log() {}, warn() {}, error() {} } })
    try {
      expect(hasHandler('profile:load-snapshot')).toBe(true)
      expect(await invokeHandler('profile:load-snapshot', ['default'])).toBeNull()
    } finally {
      await server.stop()
    }
  })

  it('lets caller-supplied handlers override the built-ins', async () => {
    const dataDir = makeDataDir()
    const snapshot = { id: 'default', name: 'Default', version: 2, windows: [] }
    const server = await createHeadlessServer({
      dataDir,
      port: 0,
      logger: { log() {}, warn() {}, error() {} },
      handlers: [{ channel: 'profile:load-snapshot', handler: () => snapshot }],
    })
    try {
      expect(await invokeHandler('profile:load-snapshot', ['default'])).toEqual(snapshot)
    } finally {
      await server.stop()
      // restore built-in for later tests in this process
      await createHeadlessServer({ dataDir: makeDataDir(), port: 0, logger: { log() {}, warn() {}, error() {} } })
    }
  })
})
