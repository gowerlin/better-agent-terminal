// BUG-119 / T0480: userData is a single `BetterAgentTerminal-runtime-<id>` directory, and a
// legacy `better-agent-terminal-runtime-<id>` directory is renamed into it on startup.
// Only isolated e2e runtimes are used — the default instance's directories are never touched.
// Run: `npx vite build` then `npx playwright test e2e/bug119-userdata-unification.spec.ts`.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('bug119')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

/** Electron's appData for this platform (the app is launched with the inherited env). */
function electronAppData(): string {
  if (process.platform === 'win32') return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support')
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
}

function legacyDir(runtimeId: string): string {
  return path.join(electronAppData(), `better-agent-terminal-runtime-${runtimeId}`)
}

/** Removes the legacy directory only if it is an e2e runtime's. */
function removeLegacy(runtimeId: string | undefined): void {
  if (!runtimeId || !runtimeId.startsWith('e2e-')) return
  const dir = legacyDir(runtimeId)
  if (!fs.existsSync(dir)) return
  fs.rmSync(dir, { recursive: true, force: true })
  log(`legacy dir removed: ${dir}`)
}

// Chromium's single-instance lock: `lockfile` on Windows, `SingletonLock` symlink elsewhere.
const LOCK_NAME = process.platform === 'win32' ? 'lockfile' : 'SingletonLock'

function exists(p: string): boolean {
  try { fs.lstatSync(p); return true } catch { return false }
}

test('fresh runtime: everything lands in BetterAgentTerminal-runtime-<id>, no legacy directory', async () => {
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('bug119-fresh', log)
    const { userData, runtimeId } = inst
    expect(await inst.app.evaluate(({ app }) => app.getPath('appData'))).toBe(electronAppData())
    expect(userData).toBe(path.join(electronAppData(), `BetterAgentTerminal-runtime-${runtimeId}`))

    for (const name of ['Logs', 'Crashes', 'Local State', LOCK_NAME]) {
      await expect.poll(() => exists(path.join(userData, name)), { message: `${name} in userData`, timeout: 20_000 }).toBe(true)
    }
    const info = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.settings.getLoggingInfo())
    expect(info.logsDir).toBe(path.join(userData, 'Logs'))
    expect(info.crashesDir).toBe(path.join(userData, 'Crashes'))
    expect(fs.existsSync(legacyDir(runtimeId))).toBe(false)
    log(`userData entries: ${fs.readdirSync(userData).sort().join(', ')}`)
  } finally {
    const runtimeId = inst?.runtimeId
    await closeIsolated(inst, log)
    removeLegacy(runtimeId)
  }
})

test('legacy runtime directory is renamed; settings and snippets survive', async () => {
  let inst: IsolatedInstance | undefined
  let seededRuntime: string | undefined
  try {
    inst = await launchIsolated('bug119-legacy', log, {
      beforeLaunch: (runtimeId) => {
        seededRuntime = runtimeId
        const dir = legacyDir(runtimeId)
        fs.mkdirSync(dir, { recursive: true })
        // logLevel is read from settings.json by logger.init at startup — a wrong
        // userData would fall back to the default level 'debug'.
        fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ logLevel: 'warn' }))
        fs.writeFileSync(path.join(dir, 'snippets.json'), JSON.stringify({
          snippets: [{ id: 7, title: 'bug119-e2e-snippet', content: 'echo bug119', format: 'plaintext', action: 'terminal', isFavorite: false, createdAt: 1, updatedAt: 1 }],
          nextId: 8,
        }))
        fs.writeFileSync(path.join(dir, 't0480-marker.txt'), runtimeId)
        log(`seeded legacy dir ${dir}`)
      },
    })
    const { userData, runtimeId } = inst
    expect(userData).toBe(path.join(electronAppData(), `BetterAgentTerminal-runtime-${runtimeId}`))
    expect(fs.existsSync(legacyDir(runtimeId))).toBe(false)
    expect(fs.readFileSync(path.join(userData, 't0480-marker.txt'), 'utf-8')).toBe(runtimeId)
    const marker = JSON.parse(fs.readFileSync(path.join(userData, '.userdata-migration.json'), 'utf-8'))
    expect(marker).toMatchObject({ v: 1, from: legacyDir(runtimeId), items: { 'runtime-dir': 'renamed' } })

    const info = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.settings.getLoggingInfo())
    expect(info.logLevel).toBe('warn')
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf-8')).logLevel).toBe('warn')

    const snippets = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.snippet.getAll())
    expect(snippets.map((s: { id: number; title: string }) => [s.id, s.title])).toContainEqual([7, 'bug119-e2e-snippet'])
  } finally {
    await closeIsolated(inst, log)
    removeLegacy(seededRuntime)
  }
})
