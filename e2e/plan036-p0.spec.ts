// PLAN-036 P0 — UI-layer acceptance (T0397).
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT. Every test launches its own instance with
// `--runtime=e2e-plan036-<tag>-<timestamp>` through the shared isolation fixture
// (`e2e/fixtures/electron-isolation.ts`, T0399): separate userData → separate
// Terminal Server, inherited BAT_* env dropped, BAT_REMOTE_PORT on a free port,
// and a teardown that answers the quit dialog and removes the runtime userData.
//
// E1  claude:abort-session is bound to IPC                 (T0392 / BUG-095)
// E2  Terminal Server mode: restart does not orphan the PTY (T0394 / BUG-101)
// E3  remote (wsl-linux) window lists Linux shells only    (T0393)
// E4  WSL window folder dialog defaults to WSL home + /mnt/c hint (T0393)
//
// E3 / E4 need a window that is really served by a remote connection. Instead
// of the user's WSL server, the isolated instance connects to its own
// RemoteServer (loopback, 127.0.0.1:<isolated port>) through a remote profile
// with targetOS 'wsl-linux'. This exercises the real renderer / main code paths
// (initProfile → remote.connect → windowRemoteTarget; wslFolderDefaultForSender)
// without creating anything on the WSL host.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PROXIED_CHANNELS } from '../electron/remote/protocol'
import {
  MAIN_BUNDLE,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  commandLineOf,
  launchIsolated as launchFixture,
  readPid,
  run,
  testLogger,
  type IsolatedInstance as Instance,
} from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('plan036-p0')

function launchIsolated(tag: string): Promise<Instance> {
  return launchFixture(`plan036-${tag}`, log)
}

async function detectWslDistro(): Promise<string | null> {
  if (process.platform !== 'win32') return null
  try {
    // `wsl -l -q` prints UTF-16LE.
    const out = await run('wsl.exe', ['-l', '-q'], 10_000, 'utf16le')
    const distros = out.split(/\r?\n/).map(s => s.replace(/\0/g, '').trim()).filter(Boolean)
      .filter(d => /^[a-zA-Z0-9._-]+$/.test(d) && !/^docker-desktop/i.test(d))
    return distros.find(d => d === 'Ubuntu-24.04') ?? distros[0] ?? null
  } catch {
    return null
  }
}

async function wslHome(distro: string): Promise<string | null> {
  try {
    const home = (await run('wsl.exe', ['-d', distro, '--', 'printenv', 'HOME'], 10_000)).trim()
    return /^\/[^\0]*$/.test(home) ? home : null
  } catch {
    return null
  }
}

/** Opens a window bound to a remote profile that loops back to the instance's own RemoteServer. */
async function openLoopbackRemoteWindow(inst: Instance, profile: { targetOS: string; wslDistro?: string }): Promise<Page> {
  const conn = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.tunnel.getConnection())
  if (!conn || 'error' in conn) throw new Error(`tunnel.getConnection failed: ${JSON.stringify(conn)}`)
  const status = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.remote.serverStatus())
  expect(status.running).toBe(true)
  expect(status.port).toBe(inst.remotePort)
  log(`isolated RemoteServer running on ${status.host}:${status.port}`)

  const profileId = await inst.win.evaluate(async ({ port, token, fingerprint, targetOS, wslDistro }) => {
    const api = (window as AnyApi).electronAPI
    const created = await api.profile.create('E2E loopback remote', {
      type: 'remote', remoteHost: '127.0.0.1', remotePort: port, remoteToken: token, remoteFingerprint: fingerprint,
    })
    await api.profile.update(created.id, { targetOS, wslDistro })
    return created.id as string
  }, { port: inst.remotePort, token: conn.token, fingerprint: conn.fingerprint, ...profile })

  const windowPromise = inst.app.waitForEvent('window', { timeout: 30_000 })
  const opened = await inst.win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
  log(`openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
  const remoteWin = await windowPromise
  await remoteWin.waitForLoadState('domcontentloaded')
  await expect.poll(
    async () => (await remoteWin.evaluate(async () => (window as AnyApi).electronAPI.remote.clientStatus())).connected,
    { timeout: 30_000, message: 'remote window never reported a live remote connection' },
  ).toBe(true)
  return remoteWin
}

async function shellOptionValues(page: Page): Promise<string[]> {
  await page.locator('.sidebar-footer .settings-btn').last().click()
  const select = page.locator('.settings-section select:has(option[value="custom"])').first()
  await expect(select).toBeVisible({ timeout: 15_000 })
  return select.locator('option').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value))
}

test.describe('PLAN-036 P0 — Electron UI layer (T0397)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(150_000)

  test.beforeEach(() => {
    test.skip(!fs.existsSync(MAIN_BUNDLE) || !fs.existsSync(TERMINAL_SERVER_SCRIPT),
      'dist-electron/ missing — run `npx vite build` first')
  })

  test('E1 claude:abort-session has an IPC handler (BUG-095)', async () => {
    let inst: Instance | undefined
    try {
      inst = await launchIsolated('e1')
      const result = await inst.win.evaluate(async () => {
        try {
          const value = await (window as AnyApi).electronAPI.claude.abortSession('e2e-plan036-no-such-session')
          return { ok: true, value: value ?? null, message: '' }
        } catch (err) {
          return { ok: false, value: null, message: String((err as Error)?.message ?? err) }
        }
      })
      log(`abortSession(<unknown id>) → ${JSON.stringify(result)}`)
      expect(result.message).not.toMatch(/No handler registered/)

      // Every claude:* channel in PROXIED_CHANNELS must have an ipcMain.handle binding.
      const handled = await inst.app.evaluate(({ ipcMain }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlers = (ipcMain as any)._invokeHandlers as Map<string, unknown> | undefined
        return handlers ? [...handlers.keys()] : null
      })
      if (handled === null) {
        log('ipcMain._invokeHandlers not available in this Electron build — PROXIED_CHANNELS sweep skipped')
      } else {
        const claudeChannels = [...PROXIED_CHANNELS].filter(c => c.startsWith('claude:'))
        const missing = claudeChannels.filter(c => !handled.includes(c))
        log(`PROXIED_CHANNELS claude:* sweep: ${claudeChannels.length} channel(s), unbound: ${missing.length ? missing.join(', ') : 'none'}`)
        expect(claudeChannels).toContain('claude:abort-session')
        expect(missing).toEqual([])
      }
    } finally {
      await closeIsolated(inst, log)
    }
  })

  test('E2 Terminal Server mode: restart keeps the terminal alive (BUG-101)', async () => {
    let inst: Instance | undefined
    try {
      inst = await launchIsolated('e2')
      const { userData } = inst
      await expect.poll(() => fs.existsSync(path.join(userData, 'bat-pty-server.port')), {
        timeout: 20_000, message: 'Terminal Server never wrote its port file — not in Terminal Server mode',
      }).toBe(true)
      const serverPid = readPid(userData)
      expect(serverPid).not.toBeNull()
      const serverCmd = await commandLineOf(serverPid!)
      log(`Terminal Server pid=${serverPid} port=${fs.readFileSync(path.join(userData, 'bat-pty-server.port'), 'utf8').trim()} cmd=${serverCmd.trim()}`)
      expect(serverCmd.toLowerCase()).toContain(TERMINAL_SERVER_SCRIPT.toLowerCase())

      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/sh'
      const cwd = os.homedir()
      // The marker is computed by the shell, so the echoed command line cannot satisfy the check.
      const marker = (a: number, b: number) => (isWin ? `set /a ${a}+${b}\r` : `echo $((${a}+${b}))\n`)
      const id = `e2e-plan036-e2-${Date.now()}`

      await inst.win.evaluate((ptyId) => {
        const w = window as AnyApi
        w.__e2e = { out: '', exits: [] as number[] }
        w.electronAPI.pty.onOutput((pid: string, data: string) => { if (pid === ptyId) w.__e2e.out += data })
        w.electronAPI.pty.onExit((pid: string, code: number) => { if (pid === ptyId) w.__e2e.exits.push(code) })
      }, id)
      const state = () => inst!.win.evaluate(() => (window as AnyApi).__e2e as { out: string; exits: number[] })

      const created = await inst.win.evaluate(async ({ ptyId, cwd: dir, shell: sh }) =>
        (window as AnyApi).electronAPI.pty.create({ id: ptyId, cwd: dir, type: 'terminal', shell: sh }), { ptyId: id, cwd, shell })
      expect(created).toEqual({ ok: true, created: true }) // T0403 shape
      await inst.win.evaluate(({ ptyId, data }) => (window as AnyApi).electronAPI.pty.write(ptyId, data), { ptyId: id, data: marker(1200, 34) })
      await expect.poll(async () => (await state()).out, { timeout: 20_000 }).toContain('1234')

      const restarted = await inst.win.evaluate(async ({ ptyId, dir, sh }) =>
        (window as AnyApi).electronAPI.pty.restart(ptyId, dir, sh), { ptyId: id, dir: cwd, sh: shell })
      expect(restarted).toBe(true)
      // Give the replaced PTY's exit event ample time to reach main + renderer.
      await new Promise(r => setTimeout(r, 4_000))
      const afterRestart = await state()
      const cwdAfter = await inst.win.evaluate(async (ptyId) => (window as AnyApi).electronAPI.pty.getCwd(ptyId), id)
      log(`after restart + 4s: pty:exit events=${afterRestart.exits.length}, getCwd=${JSON.stringify(cwdAfter)}`)
      expect(afterRestart.exits).toEqual([])
      expect(cwdAfter).not.toBeNull()

      await inst.win.evaluate(({ ptyId, data }) => (window as AnyApi).electronAPI.pty.write(ptyId, data), { ptyId: id, data: marker(5000, 678) })
      await expect.poll(async () => (await state()).out, { timeout: 20_000, message: 'restarted terminal produced no output' }).toContain('5678')
      expect((await state()).exits).toEqual([])
      log('restarted terminal answered (5678) and was never marked exited')

      // Sanity: a normal kill still delivers exactly one exit.
      await inst.win.evaluate(async (ptyId) => (window as AnyApi).electronAPI.pty.kill(ptyId), id)
      await expect.poll(async () => (await state()).exits.length, { timeout: 15_000 }).toBe(1)
      log('kill after restart delivered 1 pty:exit')
    } finally {
      await closeIsolated(inst, log)
    }
  })

  test('E3 remote wsl-linux window lists Linux shells only (T0393)', async () => {
    test.skip(process.platform !== 'win32', 'local shell list is already POSIX off Windows — nothing to distinguish')
    const distro = await detectWslDistro()
    test.skip(!distro, 'no WSL distro installed')
    let inst: Instance | undefined
    try {
      inst = await launchIsolated('e3')
      const localValues = await shellOptionValues(inst.win)
      log(`local window shell options: ${localValues.join(',')}`)
      expect(localValues).toEqual(expect.arrayContaining(['pwsh', 'cmd']))

      const remoteWin = await openLoopbackRemoteWindow(inst, { targetOS: 'wsl-linux', wslDistro: distro! })
      let remoteValues: string[] = []
      await expect.poll(async () => {
        if (await remoteWin.locator('.settings-section select:has(option[value="custom"])').count() === 0) {
          remoteValues = await shellOptionValues(remoteWin)
        } else {
          remoteValues = await remoteWin.locator('.settings-section select:has(option[value="custom"])').first()
            .locator('option').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value))
        }
        return remoteValues
      }, { timeout: 20_000, message: 'remote window shell list never switched to Linux shells' })
        .toEqual(['auto', 'zsh', 'bash', 'sh', 'custom'])
      log(`remote (wsl-linux) window shell options: ${remoteValues.join(',')}`)
      for (const winShell of ['pwsh', 'powershell', 'cmd', 'git-bash']) expect(remoteValues).not.toContain(winShell)
      const optionText = await remoteWin.locator('.settings-section select:has(option[value="custom"]) option').allTextContents()
      expect(optionText.join('|')).not.toMatch(/[A-Za-z]:\\|PowerShell|Command Prompt/)
    } finally {
      await closeIsolated(inst, log)
    }
  })

  test('E4 WSL window folder dialog defaults to WSL home and hints /mnt/c (T0393)', async () => {
    const distro = await detectWslDistro()
    test.skip(!distro, 'no WSL distro installed (Windows-only feature)')
    let inst: Instance | undefined
    const picked = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-e2e-t0393-'))
    try {
      test.skip(!/^[A-Za-z]:\\/.test(picked), `temp dir ${picked} is not on a drive letter — cannot exercise the /mnt/<drive> hint`)
      inst = await launchIsolated('e4')
      const remoteWin = await openLoopbackRemoteWindow(inst, { targetOS: 'wsl-linux', wslDistro: distro! })

      await inst.app.evaluate(({ dialog }, folder) => {
        const g = globalThis as AnyApi
        g.__e2eOpenDialogCalls = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showOpenDialog = async (...args: any[]) => {
          const opts = args.length > 1 ? args[1] : args[0]
          g.__e2eOpenDialogCalls.push({ defaultPath: opts?.defaultPath ?? null })
          return { canceled: false, filePaths: [folder] }
        }
      }, picked)

      await remoteWin.locator('.add-workspace-btn').first().click()
      await expect.poll(
        () => inst!.app.evaluate(() => ((globalThis as AnyApi).__e2eOpenDialogCalls as unknown[]).length),
        { timeout: 20_000, message: 'dialog.showOpenDialog was never called' },
      ).toBeGreaterThan(0)
      const calls = await inst.app.evaluate(() => (globalThis as AnyApi).__e2eOpenDialogCalls as { defaultPath: string | null }[])
      const defaultPath = calls[0].defaultPath
      log(`select-folder defaultPath = ${defaultPath}`)

      const home = await wslHome(distro!)
      if (home) {
        const tail = home.replace(/\//g, '\\')
        expect([`\\\\wsl.localhost\\${distro}${tail}`, `\\\\wsl$\\${distro}${tail}`]).toContain(defaultPath)
      } else {
        expect(defaultPath ?? '').toMatch(new RegExp(`^\\\\\\\\wsl(\\.localhost|\\$)\\\\${distro!.replace(/[.]/g, '\\.')}\\\\`))
      }

      const drive = picked[0].toLowerCase()
      const hint = remoteWin.getByText(new RegExp(`/mnt/${drive}/`)).first()
      await expect(hint).toBeVisible({ timeout: 15_000 })
      log(`hint shown: ${(await hint.textContent())?.split('\n')[0]}`)
    } finally {
      await closeIsolated(inst, log)
      fs.rmSync(picked, { recursive: true, force: true })
    }
  })
})
