// T0555 — WSL real-machine acceptance for the remote tools "Node.js" one-click install (nvm).
// An isolated source-build instance (`npx vite build` first) gets a remote profile for the user's
// WSL bat-server (token / fingerprint read from the distro, as smoke-remote-headless does), opens
// the profile card's tools panel, presses Install on Node.js and confirms; the remote window runs
// the nvm recipe in a terminal tab. Then "Check again" must show the node LTS version and the nvm
// chip, and a non-interactive `bash -lc 'command -v node'` must see nvm's node.
//
// OPT-IN and it installs nvm + Node.js LTS into the distro's ~/.nvm (and nvm appends its loader to
// ~/.bashrc): skipped unless BAT_E2E_T0555=1. Windows only. The server must already run the T0555
// probe (`node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --yes`), otherwise the
// nvm chip check fails.
//
//   $env:BAT_E2E_T0555='1'
//   npx playwright test e2e/t0555-node-nvm-wsl.spec.ts
//
// Ground rules: the user's BAT (9876) and its profiles are never touched; nothing under /mnt/c is
// written; the remote window's PTYs created here are killed at the end.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAIN_BUNDLE, REPO_ROOT, closeIsolated, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0555 === '1'
const DISTRO = process.env.BAT_E2E_T0555_DISTRO || 'Ubuntu-24.04'
const EVIDENCE_DIR = process.env.BAT_E2E_T0555_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0555', 'evidence')
const INSTALL_TIMEOUT_MS = 10 * 60_000
const log = testLogger('t0555')

// The isolated instance follows the OS language: match UI text in any of the three locales.
const LOCALES = ['en', 'zh-TW', 'zh-CN'].map(l => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'locales', `${l}.json`), 'utf8')))
function ui(key: string): RegExp {
  const texts = LOCALES.map(loc => key.split('.').reduce<AnyApi>((o, k) => o?.[k], loc)).filter((v): v is string => typeof v === 'string')
  return new RegExp(`^(${[...new Set(texts)].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)
}

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0555=1 (installs nvm + Node.js LTS into the WSL distro)')
test.skip(process.platform !== 'win32', 'WSL acceptance runs on Windows')

let inst: IsolatedInstance | undefined
let remotePage: Page | undefined
let profileId = ''
let profileName = ''

async function wsl(script: string, timeout = 60_000): Promise<string> {
  return run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-lc', script], timeout)
    .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file }).catch(err => log(`screenshot ${name} failed: ${(err as Error).message}`))
  log(`screenshot ${file}`)
}

function evidence(name: string, text: string): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), text)
}

function pageForWindowId(windowId: string): Page | undefined {
  const needle = `windowId=${encodeURIComponent(windowId)}`
  return inst!.app.windows().find(p => p.url().includes(needle))
}

async function nodeRow(win: Page) {
  const card = win.locator('.profile-card').filter({ hasText: profileName })
  if (await card.locator('[data-testid="remote-tools-entry-profile"]').count() === 0) await card.locator('.profile-card-toggle').click()
  const row = card.locator('[data-testid="remote-tool-node"]')
  await expect(row).toBeVisible({ timeout: 60_000 })
  return { card, row }
}

test.describe.serial('T0555 Node.js via nvm on WSL', () => {
  test.afterAll(async () => {
    if (remotePage && !remotePage.isClosed()) {
      const killed = await remotePage.evaluate(async () => {
        const ids = ((window as AnyApi).__t0555Ids ?? []) as string[]
        for (const id of ids) await (window as AnyApi).electronAPI.pty.kill(id).catch(() => {})
        return ids
      }).catch(() => [])
      log(`afterAll: killed remote PTY(s) ${JSON.stringify(killed)}`)
    }
    await closeIsolated(inst, log)
    inst = undefined
  })

  test('install Node.js from the profile card tools panel; re-check shows the LTS and nvm', async () => {
    test.setTimeout(INSTALL_TIMEOUT_MS + 180_000)
    test.skip(!fs.existsSync(MAIN_BUNDLE), 'dist-electron/ missing — run `npx vite build` first')

    const before = await wsl('ls -d ~/.nvm 2>&1; sha256sum ~/.bashrc; wc -l < ~/.bashrc; command -v node || echo node-missing')
    evidence('before.txt', before)
    log(`before: ${before.replace(/\n/g, ' | ')}`)
    test.skip(!before.includes('cannot access'), 'the distro already has ~/.nvm: this check needs a host without nvm (remove ~/.nvm and the nvm lines in ~/.bashrc to re-run)')

    const smoke = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'smoke-remote-headless.mjs')).href)
    const target = await smoke.resolveWslTarget({ ...smoke.parseTarget(`wsl:${DISTRO}`), host: '127.0.0.1' })
    const port = Number(new URL(target.url).port)
    log(`server ${target.url} fingerprint ${String(target.fingerprint).slice(0, 11)}…`)

    inst = await launchIsolated('t0555', log)
    profileName = `T0555 WSL ${DISTRO}`
    profileId = await inst.win.evaluate(async ({ name, port: p, token, fingerprint, distro }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create(name, { type: 'remote', remoteHost: '127.0.0.1', remotePort: p, remoteToken: token, remoteFingerprint: fingerprint })
      await api.profile.update(created.id, { targetOS: 'wsl-linux', wslDistro: distro })
      return created.id as string
    }, { name: profileName, port, token: target.token, fingerprint: target.fingerprint, distro: DISTRO })

    // Profiles panel → the card's tools entry (local short connection to the WSL server).
    await inst.win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
    await expect(inst.win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
    const { card, row } = await nodeRow(inst.win)
    const beforeText = (await row.innerText()).replace(/\s+/g, ' ')
    evidence('row-before.txt', beforeText)
    log(`node row before: ${beforeText}`)
    await shot(inst.win, 'before')

    // Install → confirm dialog (command, nvm tag, SHASUMS) → confirm.
    await row.getByRole('button', { name: ui('remoteTools.install') }).click()
    const dialog = inst.win.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const command = await dialog.getByTestId('remote-tools-confirm-command').innerText()
    const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ')
    evidence('dialog.txt', `${command}\n\n${dialogText}`)
    expect(command).toContain('https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh')
    expect(dialogText).toContain('v0.40.8')
    expect(dialogText).toContain('SHASUMS256.txt')
    await shot(inst.win, 'dialog')

    const windowsBefore = new Set(inst.app.windows())
    await dialog.getByRole('button', { name: ui('remoteTools.confirm.confirmInstall') }).click()

    // The remote profile window opens and runs the recipe in a terminal tab.
    await expect.poll(() => inst!.app.windows().find(p => !windowsBefore.has(p) && /windowId=/.test(p.url())) !== undefined, {
      timeout: 60_000, message: 'remote window never opened',
    }).toBe(true)
    remotePage = inst.app.windows().find(p => !windowsBefore.has(p) && /windowId=/.test(p.url()))!
    await remotePage.waitForLoadState('domcontentloaded')
    await remotePage.evaluate(() => {
      const w = window as AnyApi
      w.__t0555Out = {}
      w.__t0555Ids = []
      w.electronAPI.pty.onOutput((id: string, data: string) => {
        if (!w.__t0555Out[id]) { w.__t0555Out[id] = ''; w.__t0555Ids.push(id) }
        w.__t0555Out[id] = (w.__t0555Out[id] + data).slice(-200_000)
      })
    })
    const done = /__BAT_TOOL_DONE_[0-9a-f]{16}_(\d{1,3})__/
    let exitCode = -1
    await expect.poll(async () => {
      const out = await remotePage!.evaluate(() => Object.values((window as AnyApi).__t0555Out as Record<string, string>).join('\n'))
      const m = done.exec(out.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ''))
      if (m) exitCode = Number(m[1])
      return m !== null
    }, { timeout: INSTALL_TIMEOUT_MS, intervals: [2_000], message: 'install sentinel never arrived' }).toBe(true)
    const output = await remotePage.evaluate(() => Object.values((window as AnyApi).__t0555Out as Record<string, string>).join('\n'))
    evidence('install-output.txt', output)
    log(`install exit code ${exitCode}`)
    await shot(remotePage, 'remote-after-install')
    expect(exitCode).toBe(0)

    // "Check again" in the profile card: node LTS version + nvm chip.
    await inst.win.bringToFront()
    await card.getByRole('button', { name: ui('remoteTools.recheck') }).click()
    await expect(row.locator('.remote-tools-status')).toHaveText(ui('remoteTools.status.ok'), { timeout: 60_000 })
    await expect(row.getByTestId('remote-tool-nvm')).toHaveText('nvm 0.40.8')
    const afterText = (await row.innerText()).replace(/\s+/g, ' ')
    evidence('row-after.txt', afterText)
    log(`node row after: ${afterText}`)
    expect(afterText).toMatch(/\.nvm\/versions\/node\/v\d+\.\d+\.\d+\/bin\/node/)
    await expect(row.getByRole('button', { name: ui('remoteTools.update') })).toBeVisible()
    await shot(inst.win, 'after')

    const detected = await inst.win.evaluate(async (id) => (window as AnyApi).electronAPI.remoteTools.detect(id), profileId)
    const node = (detected?.report?.tools ?? []).find((t: AnyApi) => t.id === 'node')
    evidence('detect-after.json', JSON.stringify(detected, null, 2))
    expect(node).toMatchObject({ status: 'ok', nvm: { version: '0.40.8' }, nvmManaged: true })

    // Outside BAT. nvm's loader sits at the end of ~/.bashrc (nvm's own choice); the stock Ubuntu
    // ~/.bashrc returns early for non-interactive shells, so `bash -lc` is recorded, not asserted.
    const nonInteractive = await wsl('command -v node || echo node-not-found')
    const interactive = await run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-lic', 'command -v node; node --version'], 60_000).catch((err: AnyApi) => `ERR ${String(err?.message ?? err)}`)
    const files = await wsl('ls ~/.nvm/versions/node; sha256sum ~/.bashrc; wc -l < ~/.bashrc')
    evidence('after.txt', `## bash -lc\n${nonInteractive}\n## bash -lic\n${interactive}\n## files\n${files}`)
    log(`after: bash -lc → ${nonInteractive.trim()} | bash -lic → ${interactive.replace(/\n/g, ' ')} | ${files.replace(/\n/g, ' | ')}`)
    expect(interactive).toContain('/.nvm/versions/node/')
    expect(interactive).toContain(`v${node.version}`)
  })
})
