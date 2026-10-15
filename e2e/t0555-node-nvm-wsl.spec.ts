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
// T0556 — the Update path on a distro that ALREADY has nvm (opt-in BAT_E2E_T0556=1, its own test):
// press Update on Node.js twice; the first adds the nvm loader block to the bash login profile
// (~/.profile on stock Ubuntu), the second finds it and adds nothing; then `bash -lc` / `sh -lc`
// find nvm's node and `bash -lic` loads nvm.sh once. It writes only that block (back the profile
// file up first); profile before / after, the appended part and sha256 go to the evidence dir.
// Update is offered only for an nvm-managed node, so the server needs the T0555 probe.
//
//   $env:BAT_E2E_T0556='1'
//   npx playwright test e2e/t0555-node-nvm-wsl.spec.ts -g "T0556"
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
const UPDATE_ENABLED = process.env.BAT_E2E_T0556 === '1'
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

test.skip(!ENABLED && !UPDATE_ENABLED, 'opt-in: set BAT_E2E_T0555=1 (installs nvm + Node.js LTS into the WSL distro) or BAT_E2E_T0556=1 (Update on a distro with nvm)')
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
    test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0555=1')
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

    // Outside BAT. nvm's loader sits at the end of ~/.bashrc (nvm's own choice), which the stock
    // Ubuntu ~/.bashrc never reaches in a non-interactive shell; T0556's login profile block covers `bash -lc`.
    const nonInteractive = await wsl('command -v node || echo node-not-found')
    const interactive = await run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-lic', 'command -v node; node --version'], 60_000).catch((err: AnyApi) => `ERR ${String(err?.message ?? err)}`)
    const files = await wsl('ls ~/.nvm/versions/node; sha256sum ~/.bashrc; wc -l < ~/.bashrc')
    evidence('after.txt', `## bash -lc\n${nonInteractive}\n## bash -lic\n${interactive}\n## files\n${files}`)
    log(`after: bash -lc → ${nonInteractive.trim()} | bash -lic → ${interactive.replace(/\n/g, ' ')} | ${files.replace(/\n/g, ' | ')}`)
    expect(interactive).toContain('/.nvm/versions/node/')
    expect(interactive).toContain(`v${node.version}`)
    expect(nonInteractive).toContain('/.nvm/versions/node/')
  })
})

test.describe.serial('T0556 nvm login profile block via Update on WSL', () => {
  let updInst: IsolatedInstance | undefined
  let updRemote: Page | undefined

  test.afterAll(async () => {
    if (updRemote && !updRemote.isClosed()) {
      const killed = await updRemote.evaluate(async () => {
        const ids = ((window as AnyApi).__t0556Ids ?? []) as string[]
        for (const id of ids) await (window as AnyApi).electronAPI.pty.kill(id).catch(() => {})
        return ids
      }).catch(() => [])
      log(`T0556 afterAll: killed remote PTY(s) ${JSON.stringify(killed)}`)
    }
    await closeIsolated(updInst, log)
    updInst = undefined
  })

  /** Plain `sh -c` (no login files) for the file checks, so they do not depend on the block. */
  async function wslSh(script: string): Promise<string> {
    return run('wsl.exe', ['-d', DISTRO, '--exec', 'sh', '-c', script], 60_000)
      .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
  }

  const PROFILE_TARGET = 'p="$HOME/.profile"; for f in "$HOME/.bash_profile" "$HOME/.bash_login"; do if [ -e "$f" ]; then p="$f"; break; fi; done'
  const MARKER = '# >>> nvm loader for login shells (added by BetterAgentTerminal) >>>'
  /** xtrace lines that source nvm.sh: `. …/nvm.sh` from ~/.bashrc, `command . …/nvm.sh` from the block. */
  const NVM_SOURCE_TRACE = /^\++ (?:command )?\. \S*\/\.nvm\/nvm\.sh$/gm

  test('T0556: Update twice → the block is added once; bash -lc / sh -lc find node; bash -lic loads nvm once', async () => {
    test.setTimeout(2 * INSTALL_TIMEOUT_MS + 240_000)
    test.skip(!UPDATE_ENABLED, 'opt-in: set BAT_E2E_T0556=1')
    test.skip(!fs.existsSync(MAIN_BUNDLE), 'dist-electron/ missing — run `npx vite build` first')

    const hasNvm = await wslSh('[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ] && echo has-nvm || echo no-nvm')
    test.skip(!hasNvm.includes('has-nvm'), 'the distro has no nvm: run the T0555 install check first')

    const target = (await wslSh(`${PROFILE_TARGET}; echo "$p"`)).trim()
    const before = await wslSh(`${PROFILE_TARGET}; ls -la "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile" 2>&1; sha256sum "$p" 2>&1; wc -l < "$p" 2>&1; grep -cF '${MARKER}' "$p" 2>&1; true`)
    const profileBefore = await wslSh(`cat "${target}" 2>/dev/null`)
    const lcBefore = await wsl('command -v node || echo node-not-found')
    evidence('t0556-before.txt', `target ${target}\n${before}\n## bash -lc\n${lcBefore}`)
    evidence('t0556-profile-before.txt', profileBefore)
    log(`T0556 before: target ${target} | ${before.replace(/\n/g, ' | ')} | bash -lc → ${lcBefore.trim()}`)

    const smoke = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'smoke-remote-headless.mjs')).href)
    const server = await smoke.resolveWslTarget({ ...smoke.parseTarget(`wsl:${DISTRO}`), host: '127.0.0.1' })
    const port = Number(new URL(server.url).port)
    log(`T0556 server ${server.url} fingerprint ${String(server.fingerprint).slice(0, 11)}…`)

    updInst = await launchIsolated('t0556', log)
    const name = `T0556 WSL ${DISTRO}`
    const id = await updInst.win.evaluate(async ({ name: n, port: p, token, fingerprint, distro }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create(n, { type: 'remote', remoteHost: '127.0.0.1', remotePort: p, remoteToken: token, remoteFingerprint: fingerprint })
      await api.profile.update(created.id, { targetOS: 'wsl-linux', wslDistro: distro })
      return created.id as string
    }, { name, port, token: server.token, fingerprint: server.fingerprint, distro: DISTRO })

    await updInst.win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
    await expect(updInst.win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
    const card = updInst.win.locator('.profile-card').filter({ hasText: name })
    if (await card.locator('[data-testid="remote-tools-entry-profile"]').count() === 0) await card.locator('.profile-card-toggle').click()
    const row = card.locator('[data-testid="remote-tool-node"]')
    await expect(row).toBeVisible({ timeout: 60_000 })
    await expect(row.getByRole('button', { name: ui('remoteTools.update') })).toBeVisible({ timeout: 60_000 })
    evidence('t0556-row-before.txt', (await row.innerText()).replace(/\s+/g, ' '))

    const done = /__BAT_TOOL_DONE_[0-9a-f]{16}_(\d{1,3})__/g
    const remoteOutput = async (): Promise<string> => updRemote!.evaluate(() => Object.values((window as AnyApi).__t0556Out as Record<string, string>).join('\n'))
      .then(out => out.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ''))

    /** Update → confirm → wait for the n-th sentinel; returns that run's exit code. */
    async function pressUpdate(n: number): Promise<number> {
      await updInst!.win.bringToFront()
      await row.getByRole('button', { name: ui('remoteTools.update') }).click()
      const dialog = updInst!.win.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const command = await dialog.getByTestId('remote-tools-confirm-command').innerText()
      evidence(`t0556-dialog-${n}.txt`, `${command}\n\n${(await dialog.innerText()).replace(/\s+/g, ' ')}`)
      expect(command).toContain(MARKER)
      await shot(updInst!.win, `t0556-dialog-${n}`)
      const windowsBefore = new Set(updInst!.app.windows())
      await dialog.getByRole('button', { name: ui('remoteTools.confirm.confirmUpdate') }).click()
      if (!updRemote || updRemote.isClosed()) {
        await expect.poll(() => updInst!.app.windows().find(p => !windowsBefore.has(p) && /windowId=/.test(p.url())) !== undefined, {
          timeout: 60_000, message: 'remote window never opened',
        }).toBe(true)
        updRemote = updInst!.app.windows().find(p => !windowsBefore.has(p) && /windowId=/.test(p.url()))!
        await updRemote.waitForLoadState('domcontentloaded')
        await updRemote.evaluate(() => {
          const w = window as AnyApi
          w.__t0556Out = {}
          w.__t0556Ids = []
          w.electronAPI.pty.onOutput((pid: string, data: string) => {
            if (!w.__t0556Out[pid]) { w.__t0556Out[pid] = ''; w.__t0556Ids.push(pid) }
            w.__t0556Out[pid] = (w.__t0556Out[pid] + data).slice(-200_000)
          })
        })
      }
      let code = -1
      await expect.poll(async () => {
        const matches = [...(await remoteOutput()).matchAll(done)]
        if (matches.length >= n) code = Number(matches[n - 1][1])
        return matches.length >= n
      }, { timeout: INSTALL_TIMEOUT_MS, intervals: [2_000], message: `update #${n} sentinel never arrived` }).toBe(true)
      evidence(`t0556-update-output-${n}.txt`, await remoteOutput())
      await shot(updRemote, `t0556-remote-after-update-${n}`)
      log(`T0556 update #${n} exit code ${code}`)
      return code
    }

    expect(await pressUpdate(1)).toBe(0)
    expect(await remoteOutput()).toContain(`nvm loader for login shells added to ${target}`)
    const afterFirst = await wslSh(`sha256sum "${target}"; grep -cF '${MARKER}' "${target}"`)
    log(`T0556 after update #1: ${afterFirst.replace(/\n/g, ' | ')}`)
    expect(afterFirst.trim().split('\n').pop()).toBe('1')

    expect(await pressUpdate(2)).toBe(0)
    expect(await remoteOutput()).toContain(`nvm loader for login shells already in ${target}`)

    const after = await wslSh(`sha256sum "${target}"; wc -l < "${target}"; grep -cF '${MARKER}' "${target}"`)
    const profileAfter = await wslSh(`cat "${target}"`)
    evidence('t0556-profile-after.txt', profileAfter)
    // Only appended: the old content is an untouched prefix, one block after it.
    expect(profileAfter.startsWith(profileBefore)).toBe(true)
    const added = profileAfter.slice(profileBefore.length)
    evidence('t0556-profile-diff.txt', added)
    expect(added.split(MARKER).length - 1).toBe(1)
    expect(after.trim().split('\n').pop()).toBe('1')
    expect(after.split('\n')[0]).toBe(afterFirst.split('\n')[0])

    const lc = await wsl('command -v node || echo node-not-found')
    const shLc = await run('wsl.exe', ['-d', DISTRO, '--exec', 'sh', '-lc', 'command -v node || echo node-not-found'], 60_000).catch((err: AnyApi) => `ERR ${String(err?.message ?? err)}`)
    const lic = await run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-lic', 'command -v node; node --version'], 60_000).catch((err: AnyApi) => `ERR ${String(err?.message ?? err)}`)
    const licTrace = await wslSh('bash -x -lic true 2>&1')
    const lcTrace = await wslSh('bash -x -lc true 2>&1')
    const licLoads = licTrace.match(NVM_SOURCE_TRACE) ?? []
    const lcLoads = lcTrace.match(NVM_SOURCE_TRACE) ?? []
    evidence('t0556-after.txt', `target ${target}\n## before\n${before}\n## after\n${after}\n## bash -lc\n${lc}\n## sh -lc\n${shLc}\n## bash -lic\n${lic}\n## bash -x -lic nvm.sh loads\n${licLoads.join('\n')}\n## bash -x -lc nvm.sh loads\n${lcLoads.join('\n')}`)
    log(`T0556 after: ${after.replace(/\n/g, ' | ')} | bash -lc → ${lc.trim()} | sh -lc → ${shLc.trim()} | bash -lic → ${lic.replace(/\n/g, ' ')} | loads -lic ${JSON.stringify(licLoads)} -lc ${JSON.stringify(lcLoads)}`)
    expect(lc).toContain('/.nvm/versions/node/')
    expect(shLc).toContain('/.nvm/versions/node/')
    expect(lic).toContain('/.nvm/versions/node/')
    expect(licLoads).toHaveLength(1)
    expect(lcLoads).toEqual([expect.stringMatching(/^\++ command \. /)])

    const detected = await updInst.win.evaluate(async (pid) => (window as AnyApi).electronAPI.remoteTools.detect(pid), id)
    evidence('t0556-detect-after.json', JSON.stringify(detected, null, 2))
    expect((detected?.report?.tools ?? []).find((t: AnyApi) => t.id === 'node')).toMatchObject({ status: 'ok', nvmManaged: true })
  })
})
