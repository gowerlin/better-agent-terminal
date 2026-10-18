// Screenshots and short clips for the project site (`site/`) and README. Manual only: skipped
// unless BAT_SITE_MEDIA=1, never part of `npm run test:e2e` / CI.
//
//   npx vite build
//   BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts            (bash)
//   $env:BAT_SITE_MEDIA='1'; npx playwright test e2e/site-media.spec.ts   (PowerShell)
//
// Output: BAT_SITE_MEDIA_DIR (default `e2e-media/`, gitignored — outside Playwright's outputDir
// `e2e-results/`, which every run empties). Pick the files from there into `site/public/media/`
// and `assets/` by hand, after the privacy check.
//
// Everything on screen is made up: an isolated source build (fixtures/electron-isolation.ts,
// temp userData, its own --runtime), zh-TW, a fixed 1280×800 window, and a fictional project
// `demo-shop` with work orders T1024–T1026 under BAT_SITE_MEDIA_ROOT (default `<drive>:\bat-demo`,
// short so no user path shows in a prompt; created with a marker file and removed afterwards,
// an existing directory without the marker is never touched). Shells are cmd with PROMPT=$P$G,
// git reads only a demo identity (GIT_CONFIG_GLOBAL / GIT_CONFIG_NOSYSTEM).
//
// The Tower and the Workers are one custom CLI, `demo-agent` (a node script, see AGENT_SCRIPT):
// it prints what the test tells it to and runs the BAT helpers (`bat-terminal.mjs`,
// `bat-notify.mjs`, `bat-hook.mjs`) inside its own tab, with that tab's own capability. Nothing
// starts an LLM or signs in to a real agent. The remote wizards stop at their first question:
// `wsl:list`, `ssh:list-hosts`, `docker:status` / `docker:list-containers` and
// `remote:detect-tools` are answered by main-process stubs, so no server is installed and the
// user's own WSL distros / SSH aliases never show.
//
// ffmpeg on PATH (optional): the clip is trimmed to the scenario and re-encoded (VP9, no audio),
// and a poster PNG is cut; without it the raw Playwright WebM is kept.

import { _electron as electron, test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  REPO_ROOT,
  closeIsolated,
  freePort,
  isolatedEnv,
  launchIsolated,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('site-media')
const ROOT = path.resolve(process.env.BAT_SITE_MEDIA_ROOT || path.join(path.parse(REPO_ROOT).root, 'bat-demo'))
const OUT = path.resolve(REPO_ROOT, process.env.BAT_SITE_MEDIA_DIR || 'e2e-media')
const MARKER = '.bat-site-media'
const WIDTH = 1280
const HEIGHT = 800

const SHOP = path.join(ROOT, 'demo-shop')
const BIN = path.join(ROOT, 'bin')
const JOBS = path.join(ROOT, 'jobs')
const GITCONFIG = path.join(ROOT, 'gitconfig')

const AGENT = { id: 'demo-agent', name: 'Demo Agent', icon: 'D', color: '#5b8def', command: 'demo-agent', args: [] as string[] }
const WS = { shop: 'ws-demo-shop', api: 'ws-demo-api', docs: 'ws-docs-site' }
const TOWER = 'tab-demo-tower'

test.skip(process.env.BAT_SITE_MEDIA !== '1', 'manual: set BAT_SITE_MEDIA=1 (see the header of this file)')
test.describe.configure({ mode: 'serial' })

// ── the demo agent ───────────────────────────────────────────────────────────

/**
 * Runs step files the test drops into DEMO_JOBS: `<terminal id>-<n>.json` = { steps: [...] },
 * result `<terminal id>-<n>.res.json`. Steps: { print }, { sleep }, { clear },
 * { run: [cmd, ...args] } (output shown), { helper, args, stdin?, show? } (a BAT helper; output
 * hidden unless `show`). `$BAT_*` in helper args is filled from the env. Lines typed into the tab
 * (a notify with --submit) are appended to `<terminal id>.input.log`.
 */
const AGENT_SCRIPT = String.raw`
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = process.env.DEMO_JOBS
const id = process.env.BAT_TERMINAL_ID
const helpers = process.env.BAT_HELPER_DIR
const fill = v => String(v).replace(/\$(BAT_[A-Z0-9_]+)/g, (_, n) => process.env[n] || '')
let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, id + '.argv.json'), JSON.stringify(process.argv.slice(2)))
process.stdout.write('\x1b[2J\x1b[3J\x1b[H')
process.stdin.setEncoding('utf8')
process.stdin.on('data', d => fs.appendFileSync(path.join(jobs, id + '.input.log'), d))
fs.writeFileSync(path.join(jobs, id + '.ready'), String(Date.now()))
const sh = (cmd, args, show, stdin) => new Promise(resolve => {
  const child = spawn(cmd, args, { env: process.env, windowsHide: true, shell: false })
  let stdout = '', stderr = ''
  child.stdout.on('data', d => { stdout += d; if (show) process.stdout.write(String(d).replace(/\r?\n/g, '\r\n')) })
  child.stderr.on('data', d => { stderr += d; if (show) process.stdout.write(String(d).replace(/\r?\n/g, '\r\n')) })
  child.on('close', code => resolve({ code, stdout, stderr }))
  child.stdin.end(stdin || '')
})
async function runSteps(steps) {
  const out = []
  for (const s of steps) {
    if (s.print !== undefined) process.stdout.write(s.print.replace(/\n/g, '\r\n') + '\r\n')
    else if (s.sleep) await new Promise(r => setTimeout(r, s.sleep))
    else if (s.clear) process.stdout.write('\x1b[2J\x1b[3J\x1b[H')
    else if (s.run) {
      const r = await sh(s.run[0], s.run.slice(1), true)
      if (!/\n$/.test(r.stdout + r.stderr)) process.stdout.write('\r\n')
      out.push(r)
    }
    else if (s.helper) out.push(await sh(process.execPath, [path.join(helpers, s.helper), ...s.args.map(fill)], !!s.show, s.stdin))
  }
  return out
}
setInterval(async () => {
  const file = path.join(jobs, id + '-' + n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const res = await runSteps(JSON.parse(fs.readFileSync(file, 'utf8')).steps)
  fs.writeFileSync(file + '.tmp', JSON.stringify(res))
  fs.renameSync(file + '.tmp', path.join(jobs, id + '-' + n + '.res.json'))
  n++
  busy = false
}, 100)
`

interface HelperRun { code: number | null; stdout: string; stderr: string }
type Step = { print: string } | { sleep: number } | { clear: true } | { run: string[] } | { helper: string; args: string[]; stdin?: string; show?: boolean }

const jobCount = new Map<string, number>()

/** Drops steps for tab `id` and waits for them. */
async function steps(id: string, list: Step[], timeout = 60_000): Promise<HelperRun[]> {
  const n = jobCount.get(id) ?? 0
  jobCount.set(id, n + 1)
  fs.writeFileSync(path.join(JOBS, `${id}-${n}.json`), JSON.stringify({ steps: list }))
  const res = path.join(JOBS, `${id}-${n}.res.json`)
  await expect.poll(() => fs.existsSync(res), { timeout }).toBe(true)
  const out = JSON.parse(fs.readFileSync(res, 'utf8')) as HelperRun[]
  for (const r of out) log(`${id} #${n}: exit=${r.code} ${(r.stdout + r.stderr).trim().slice(0, 400)}`)
  return out
}

async function waitReady(id: string): Promise<void> {
  await expect.poll(() => fs.existsSync(path.join(JOBS, `${id}.ready`)), { timeout: 30_000 }).toBe(true)
}

async function waitInput(id: string, text: string): Promise<void> {
  const file = path.join(JOBS, `${id}.input.log`)
  await expect.poll(() => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(text), { timeout: 30_000 }).toBe(true)
}

// ── demo content ─────────────────────────────────────────────────────────────

const T = { cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (text: string): Step => ({ print: text })
const pause = (ms: number): Step => ({ sleep: ms })

const WORKORDERS: Record<string, string> = {
  T1024: '購物車小計改成以「分」計算，修正四捨五入',
  T1025: '結帳頁套用優惠碼',
  T1026: '更新付款 SDK 到 4.x',
}

const QUESTION = {
  question: '優惠碼要不要連運費一起折？',
  options: ['只折商品金額', '商品金額與運費都折'],
  detail: '規格只寫「訂單折 10%」，沒有提到運費。',
  allowFreeText: true,
  blocking: true,
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...gitEnv(), ...env }, windowsHide: true })
}

function gitEnv(): Record<string, string> {
  return { GIT_CONFIG_GLOBAL: GITCONFIG, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content.replace(/^\n/, ''))
}

/** The demo tree under ROOT. Refuses a ROOT it did not create. */
function prepareRoot(): void {
  if (fs.existsSync(ROOT)) {
    if (!fs.existsSync(path.join(ROOT, MARKER))) throw new Error(`${ROOT} exists and is not a site-media demo root; set BAT_SITE_MEDIA_ROOT`)
    fs.rmSync(ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(ROOT, { recursive: true })
  fs.writeFileSync(path.join(ROOT, MARKER), 'created by e2e/site-media.spec.ts; removed after the run\n')
  for (const dir of [BIN, JOBS]) fs.mkdirSync(dir, { recursive: true })
  write(path.join(BIN, 'demo-agent.mjs'), AGENT_SCRIPT)
  write(path.join(BIN, 'demo-agent.cmd'), '@node "%~dp0demo-agent.mjs" %*\r\n')
  write(GITCONFIG, '[user]\n\tname = Mei Chen\n\temail = mei@demo-shop.example\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n')

  write(path.join(SHOP, 'package.json'), `
{
  "name": "demo-shop",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
`)
  write(path.join(SHOP, 'README.md'), '\n# demo-shop\n\n示範用的小型網路商店：購物車、結帳、優惠碼。\n')
  write(path.join(SHOP, '.gitignore'), 'node_modules/\n')
  write(path.join(SHOP, 'src', 'catalog.js'), `
export const products = [
  { sku: 'MUG-01', name: '馬克杯', price: 320 },
  { sku: 'TEE-02', name: 'T 恤', price: 590 },
  { sku: 'BAG-03', name: '帆布袋', price: 249.5 },
]
`)
  write(path.join(SHOP, 'src', 'cart.js'), `
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0)
}
`)
  write(path.join(SHOP, 'src', 'checkout.js'), `
import { subtotal } from './cart.js'

export function total(items, shipping = 60) {
  return subtotal(items) + shipping
}
`)
  write(path.join(SHOP, 'test', 'cart.test.js'), `
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subtotal } from '../src/cart.js'

test('空購物車小計為 0', () => {
  assert.equal(subtotal([]), 0)
})

test('小計加總每項金額', () => {
  assert.equal(subtotal([{ price: 320, qty: 2 }, { price: 590, qty: 1 }]), 1230)
})
`)
  write(path.join(SHOP, 'test', 'checkout.test.js'), `
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { total } from '../src/checkout.js'

test('總額含運費', () => {
  assert.equal(total([{ price: 320, qty: 1 }]), 380)
})
`)
  const daysAgo = (days: number, hm: string) => {
    const d = new Date(Date.now() - days * 86_400_000)
    const pad = (v: number) => String(v).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hm}:00+08:00`
  }
  const commit = (message: string, date: string, author?: [string, string]) => {
    git(SHOP, ['add', '-A'])
    git(SHOP, ['commit', '-q', '-m', message], {
      GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
      ...(author ? { GIT_AUTHOR_NAME: author[0], GIT_AUTHOR_EMAIL: author[1] } : {}),
    })
  }
  const LEO: [string, string] = ['Leo Wang', 'leo@demo-shop.example']
  git(SHOP, ['init', '-q'])
  const shopFiles = fs.readdirSync(SHOP)
  for (const f of shopFiles) if (f !== '.git') fs.renameSync(path.join(SHOP, f), path.join(ROOT, `stash-${f}`))
  const restore = (f: string) => fs.renameSync(path.join(ROOT, `stash-${f}`), path.join(SHOP, f))
  restore('package.json'); restore('README.md'); restore('.gitignore')
  commit('chore: 建立專案', daysAgo(20, '10:12'))
  restore('src')
  fs.rmSync(path.join(SHOP, 'src', 'checkout.js'))
  commit('feat: 商品目錄與購物車小計', daysAgo(18, '15:40'), LEO)
  write(path.join(SHOP, 'src', 'checkout.js'), `
import { subtotal } from './cart.js'

export function total(items, shipping = 60) {
  return subtotal(items) + shipping
}
`)
  commit('feat: 結帳總額（含運費）', daysAgo(15, '11:05'))
  // A short feature branch, merged back, so the Git graph has a fork.
  git(SHOP, ['checkout', '-q', '-b', 'feat/tests'])
  restore('test')
  commit('test: 購物車與結帳的單元測試', daysAgo(10, '17:22'), LEO)
  git(SHOP, ['checkout', '-q', 'main'])
  write(path.join(SHOP, 'README.md'), `
# demo-shop

示範用的小型網路商店：購物車、結帳、優惠碼。

執行測試：\`npm test\`
`)
  commit('docs: README 補上測試指令', daysAgo(9, '09:30'))
  git(SHOP, ['merge', '-q', '--no-ff', 'feat/tests', '-m', "Merge branch 'feat/tests'"], { GIT_AUTHOR_DATE: daysAgo(8, '14:02'), GIT_COMMITTER_DATE: daysAgo(8, '14:02') })
  git(SHOP, ['branch', '-q', '-d', 'feat/tests'])
  write(path.join(SHOP, 'src', 'cart.js'), `
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0)
}

export function itemCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0)
}
`)
  commit('feat: 購物車商品數量', daysAgo(3, '09:48'))
  // T1024's work in progress: an uncommitted change and a new file for the Git view.
  write(path.join(SHOP, 'src', 'cart.js'), `
const cents = (price) => Math.round(price * 100)

export function subtotal(items) {
  const total = items.reduce((sum, item) => sum + cents(item.price) * item.qty, 0)
  return total / 100
}

export function itemCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0)
}
`)
  write(path.join(SHOP, 'src', 'money.js'), `
export function formatTWD(amount) {
  return 'NT$' + amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
`)
  for (const dir of ['demo-api', 'docs-site']) {
    write(path.join(ROOT, dir, 'README.md'), `\n# ${dir}\n`)
  }
}

function removeRoot(): void {
  if (!fs.existsSync(path.join(ROOT, MARKER))) return
  for (let i = 0; i < 10; i++) {
    try { fs.rmSync(ROOT, { recursive: true, force: true }); return } catch { /* a shell may still hold it */ }
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{}, 500)'])
  }
  log(`could not remove ${ROOT}; delete it by hand`)
}

// ── app setup ────────────────────────────────────────────────────────────────

function appEnv(): Record<string, string> {
  const pathVar = process.env.Path ?? process.env.PATH ?? ''
  return { Path: `${BIN};${pathVar}`, PROMPT: '$P$G', DEMO_JOBS: JOBS, ...gitEnv() }
}

async function setWindowSize(app: ElectronApplication, win: Page): Promise<void> {
  await app.evaluate(({ BrowserWindow }, size) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.unmaximize()
    w.setContentSize(size.width, size.height)
    w.center()
  }, { width: WIDTH, height: HEIGHT })
  // 1.5x display scaling rounds the content size by a pixel.
  await expect.poll(async () => Math.abs(await win.evaluate(() => window.innerWidth) - WIDTH), { timeout: 5_000 }).toBeLessThanOrEqual(2)
}

/** Settings, the demo agent, workspaces, snippets and remote profiles. */
async function seed(win: Page): Promise<void> {
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  await win.evaluate(async () => {
    const api = (window as AnyApi).electronAPI
    const raw = await api.settings.load()
    const s = raw ? JSON.parse(raw) : {}
    Object.assign(s, { language: 'zh-TW', shell: 'cmd', createDefaultAgentTerminal: false, checkForUpdates: false, defaultAgent: 'demo-agent' })
    await api.settings.save(JSON.stringify(s))
  })
  expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), AGENT)).toBeTruthy()
  const now = Date.now()
  const data = {
    workspaces: [
      { id: WS.shop, name: 'demo-shop', folderPath: SHOP, createdAt: now, defaultAgent: AGENT.id, color: 'blue' },
      { id: WS.api, name: 'demo-api', folderPath: path.join(ROOT, 'demo-api'), createdAt: now, color: 'green' },
      { id: WS.docs, name: 'docs-site', folderPath: path.join(ROOT, 'docs-site'), createdAt: now, color: 'purple' },
    ],
    activeWorkspaceId: WS.shop,
    activeGroup: null,
    terminals: [
      { id: TOWER, workspaceId: WS.shop, type: 'terminal', agentPreset: AGENT.id, title: AGENT.name, cwd: SHOP },
      { id: 'tab-api', workspaceId: WS.api, type: 'terminal', title: 'Terminal', cwd: path.join(ROOT, 'demo-api') },
      { id: 'tab-docs', workspaceId: WS.docs, type: 'terminal', title: 'Terminal', cwd: path.join(ROOT, 'docs-site') },
    ],
    activeTerminalId: TOWER,
  }
  expect(await win.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(data))).toBe(true)
  await win.evaluate(async (ws) => {
    const api = (window as AnyApi).electronAPI
    const existing = await api.snippet.getAll()
    if (existing.length > 0) return
    await api.snippet.create({ title: '跑全部測試', content: 'npm test', format: 'plaintext', category: 'demo-shop', isFavorite: true })
    await api.snippet.create({ title: '只跑購物車測試', content: 'node --test test/cart.test.js', format: 'plaintext', category: 'demo-shop' })
    await api.snippet.create({ title: '看最近的提交', content: 'git log --oneline -10', format: 'plaintext', category: 'git' })
    await api.snippet.create({ title: '請 Agent 寫測試', content: '替 src/cart.js 的 subtotal 補邊界測試：空陣列、小數價格、數量 0。', format: 'markdown', category: 'prompt', workspaceId: ws })
  }, WS.shop)
}

async function seedProfiles(win: Page): Promise<void> {
  await win.evaluate(async () => {
    const api = (window as AnyApi).electronAPI
    const wsl = await api.profile.create('WSL Ubuntu-24.04', { type: 'remote', remoteHost: '127.0.0.1', remotePort: 9881, remoteToken: 'demo', remoteFingerprint: '3F:A2:7C:19:D4:5E:88:0B' })
    await api.profile.update(wsl.id, { targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04' })
    const ssh = await api.profile.create('SSH dev-server', { type: 'remote', remoteHost: '127.0.0.1', remotePort: 9892, remoteToken: 'demo', remoteFingerprint: '91:6B:E0:2D:47:C3:5A:F8' })
    await api.profile.update(ssh.id, { targetOS: 'ssh-linux', sshHost: 'dev-server', sshUser: '', useSshTunnel: true })
    const docker = await api.profile.create('Docker demo-shop', { type: 'remote', remoteHost: '127.0.0.1', remotePort: 9903, remoteToken: 'demo', remoteFingerprint: 'C8:14:9A:6F:B2:03:DE:57' })
    await api.profile.update(docker.id, { targetOS: 'docker-linux', dockerContainer: 'bat-demo-shop' })
  })
}

/** Main-process stubs: no WSL / SSH / Docker is touched, no server is installed. */
async function stubRemote(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const handle = (channel: string, fn: () => unknown) => { ipcMain.removeHandler(channel); ipcMain.handle(channel, async () => fn()) }
    handle('wsl:list', () => ({ distros: [{ name: 'Ubuntu-24.04', version: 2, state: 'Running' }, { name: 'Debian', version: 2, state: 'Stopped' }], default: 'Ubuntu-24.04' }))
    handle('ssh:list-hosts', () => ['dev-server', 'build-box'])
    handle('docker:status', () => ({ available: true, version: '28.3.2' }))
    handle('docker:list-containers', () => [])
    handle('remote:detect-tools', () => ({
      ok: true,
      report: {
        schemaVersion: 1,
        env: {
          osFamily: 'linux', osId: 'ubuntu', osVersion: '24.04', arch: 'x86_64', musl: false, pkgManager: 'apt',
          privilege: 'passwordless', isWsl: true, hasTimeout: true,
          authEnv: { ANTHROPIC_API_KEY: false, CLAUDE_CODE_OAUTH_TOKEN: false, OPENAI_API_KEY: false },
        },
        tools: [
          { id: 'claude', status: 'ok', version: '2.1.300', login: 'loggedOut', path: '/home/dev/.local/bin/claude', serverVisible: true },
          { id: 'codex', status: 'missing', login: 'n/a', serverVisible: false },
          { id: 'node', status: 'ok', version: '24.11.0', login: 'n/a', path: '/home/dev/.nvm/versions/node/v24.11.0/bin/node', serverVisible: true },
          { id: 'git', status: 'ok', version: '2.43.0', login: 'n/a', path: '/usr/bin/git', serverVisible: true },
          { id: 'gh', status: 'ok', version: '2.45.0', login: 'loggedOut', path: '/usr/bin/gh', serverVisible: true },
          { id: 'rg', status: 'ok', version: '14.1.0', login: 'n/a', path: '/usr/bin/rg', serverVisible: true },
          { id: 'python3', status: 'ok', version: '3.12.3', login: 'n/a', path: '/usr/bin/python3', serverVisible: true },
          { id: 'uv', status: 'missing', login: 'n/a', serverVisible: false },
        ],
        serverViewAvailable: true,
        warnings: [],
      },
    }))
  })
}

async function reload(win: Page): Promise<Locator> {
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  const view = win.locator('.workspace-container.active')
  await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
  return view
}

async function shot(win: Page, name: string, opts: { clip?: { x: number; y: number; width: number; height: number }; locator?: Locator } = {}): Promise<void> {
  const file = path.join(OUT, `${name}.png`)
  // Notify toasts pile up in the top right corner and keep arriving; stills are clearer without
  // them (the clip keeps them).
  await win.addStyleTag({ content: '.bat-notify-toast-stack, .ct-toast-container { display: none !important; }' })
  await win.waitForTimeout(400)
  if (opts.locator) await opts.locator.screenshot({ path: file })
  else await win.screenshot({ path: file, clip: opts.clip })
  log(`shot ${file} (${Math.round(fs.statSync(file).size / 1024)} KB)`)
}

const workerThumb = (view: Locator, workorder: string) => view.locator(`.thumbnail[data-workorder="${workorder}"]`)

async function closeMenu(win: Page): Promise<void> {
  await win.keyboard.press('Escape')
  await win.evaluate(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(win.locator('.context-menu')).toHaveCount(0)
}

// ── scenario pieces ──────────────────────────────────────────────────────────

const towerBanner: Step[] = [
  say(`${T.bold}demo-shop · 塔台${T.reset}`),
  say(`${T.dim}待辦：T1024 購物車小計、T1025 優惠碼、T1026 付款 SDK${T.reset}`),
  say(''),
]

async function setRole(): Promise<void> {
  const [r] = await steps(TOWER, [{ helper: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] }, ...towerBanner])
  expect(r.code, r.stderr).toBe(0)
}

/** The Tower dispatches `workorder`; returns the Worker's terminal id. */
async function dispatch(workorder: string): Promise<string> {
  const [r] = await steps(TOWER, [
    // A Tower may create one tab per second (HELPER_TOWER_CREATE_INTERVAL_MS).
    pause(1100),
    say(`${T.cyan}›${T.reset} 派工 ${T.bold}${workorder}${T.reset}  ${WORKORDERS[workorder]}`),
    { helper: 'bat-terminal.mjs', args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', '$BAT_WORKSPACE_ID', '--skill', 'ct-exec', '--workorder', workorder] },
    say(`${T.dim}  已開 Worker 分頁${T.reset}`),
  ])
  expect(r.code, r.stderr).toBe(0)
  const id = /Terminal created: (\S+)/.exec(r.stdout)?.[1]
  expect(id, r.stdout).toBeTruthy()
  await waitReady(id!)
  log(`${workorder} argv: ${fs.readFileSync(path.join(JOBS, `${id}.argv.json`), 'utf8')}`)
  return id!
}

const workerHeader = (workorder: string): Step[] => [
  say(`${T.bold}${workorder}${T.reset}  ${WORKORDERS[workorder]}`),
  say(''),
]

/** T1024: run the tests for real, report to the Tower. */
const workerTestAndReport = (workorder: string): Step[] => [
  ...workerHeader(workorder),
  say(`${T.cyan}●${T.reset} 修改 src/cart.js：先換算成「分」再加總`),
  pause(600),
  say(`${T.cyan}●${T.reset} 執行測試`),
  { run: ['node', '--test', '--test-reporter=spec'] },
  say(''),
  say(`${T.green}✓${T.reset} 測試全數通過，回報塔台`),
  { helper: 'bat-notify.mjs', args: ['--source', workorder, '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', `${workorder} 完成`] },
]

// ── tests ────────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

test.afterAll(() => {
  removeRoot()
})

test('screens: overview, Worker badges, question, features, remote', async () => {
  test.setTimeout(420_000)
  prepareRoot()
  jobCount.clear()
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('site-media', log, { env: appEnv() })
    const { app, win } = inst
    await setWindowSize(app, win)
    await seed(win)
    await seedProfiles(win)
    await stubRemote(app)
    const view = await reload(win)
    await waitReady(TOWER)
    await setRole()
    await expect(view.locator('.thumbnail-title', { hasText: 'Demo Agent · Tower' })).toHaveCount(1, { timeout: 15_000 })

    // ── Tower + three Workers: ✓ reported, ? asks the Tower, ⚠️ waits for the user ──
    const w1 = await dispatch('T1024')
    const w2 = await dispatch('T1025')
    const w3 = await dispatch('T1026')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(4, { timeout: 20_000 })

    await steps(w1, workerTestAndReport('T1024'))
    await waitInput(TOWER, 'T1024 完成')
    await steps(TOWER, [say(`${T.green}‹${T.reset} T1024 回報完成，等你確認後收單`)])
    await expect(workerThumb(view, 'T1024').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })

    const [asked] = await steps(w2, [
      ...workerHeader('T1025'),
      say(`${T.cyan}●${T.reset} 讀規格：結帳頁輸入優惠碼，訂單折 10%`),
      say(`${T.yellow}?${T.reset} 規格沒寫運費要不要折，先問塔台`),
      { helper: 'bat-notify.mjs', args: ['--ask', '--source', 'T1025', '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', 'T1025 提問'], stdin: JSON.stringify(QUESTION) },
      say(`${T.dim}  等待塔台答覆…${T.reset}`),
    ])
    expect(asked.code, asked.stderr).toBe(0)
    const questionId = /^ {2}question: (q-[0-9a-f]{8}-[0-9a-f]{16})$/m.exec(asked.stdout)?.[1]
    expect(questionId, asked.stdout).toBeTruthy()
    await waitInput(TOWER, 'T1025 提問')
    await steps(TOWER, [
      say(`${T.yellow}‹${T.reset} T1025 提問：${QUESTION.question}`),
      say(`${T.dim}    1. ${QUESTION.options[0]}   2. ${QUESTION.options[1]}${T.reset}`),
    ])
    await expect(workerThumb(view, 'T1025').locator('.worker-badge')).toHaveAttribute('data-attention', 'question', { timeout: 15_000 })

    await steps(w3, [
      ...workerHeader('T1026'),
      say(`${T.cyan}●${T.reset} 準備執行 npm install payment-sdk@4`),
      say(`${T.yellow}!${T.reset} 需要你同意執行這個指令`),
      { helper: 'bat-hook.mjs', args: ['permission-request'], stdin: JSON.stringify({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' }) },
    ])
    await expect(workerThumb(view, 'T1026').locator('.worker-badge')).toHaveText('⚠️', { timeout: 15_000 })

    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click()
    await shot(win, 'overview')

    // Thumbnail bar close-up with the Tower's context menu.
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click({ button: 'right' })
    await expect(win.locator('.context-menu [data-action="close-reported-workers"]')).toBeVisible()
    const bar = await view.locator('.thumbnail-bar').first().boundingBox()
    const menu = await win.locator('.context-menu').boundingBox()
    if (bar && menu) {
      const top = Math.max(0, Math.min(bar.y, menu.y) - 8)
      await shot(win, 'worker-badges', { clip: { x: Math.max(0, bar.x - 8), y: top, width: Math.min(WIDTH - bar.x + 8, 980), height: Math.min(HEIGHT - top, bar.y + bar.height - top + 8) } })
    }
    await closeMenu(win)

    // ── the Tower answers T1025; the Worker goes on ──
    const answer = steps(w2, [
      { helper: 'bat-notify.mjs', args: ['--wait-answer', questionId!] },
    ], 90_000)
    await steps(TOWER, [
      say(`${T.cyan}›${T.reset} 答覆 T1025：1. ${QUESTION.options[0]}`),
      { helper: 'bat-terminal.mjs', args: ['--answer', questionId!, '--notify-id', '$BAT_TERMINAL_ID', '--choice', '1'], stdin: '運費照原價，優惠只算商品金額。\n' },
    ])
    const [waited] = await answer
    expect(waited.code, waited.stderr).toBe(0)
    await steps(w2, [
      say(`${T.green}‹${T.reset} 塔台答覆：${QUESTION.options[0]}（運費照原價，優惠只算商品金額）`),
      say(`${T.cyan}●${T.reset} 繼續實作 src/coupon.js`),
    ])
    await workerThumb(view, 'T1025').click()
    await shot(win, 'worker-question')

    // ── T1025 reports too: the batch-close confirmation lists both ──
    await steps(w2, [
      say(`${T.green}✓${T.reset} 完成，回報塔台`),
      { helper: 'bat-notify.mjs', args: ['--source', 'T1025', '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', 'T1025 完成'] },
    ])
    await expect(workerThumb(view, 'T1025').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click()
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click({ button: 'right' })
    await win.locator('.context-menu [data-action="close-reported-workers"]').click()
    const dialog = win.locator('.worker-batch-close-dialog')
    await expect(dialog.locator('.worker-batch-close-list li')).toHaveCount(2)
    await shot(win, 'worker-batch-close')
    await win.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // ── features ──
    await view.locator('.thumbnail-add-btn').first().click()
    await expect(win.locator('.thumbnail-add-menu-item').first()).toBeVisible()
    await shot(win, 'agents-menu')
    await win.keyboard.press('Escape')
    await win.evaluate(() => document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))

    await view.locator('.workspace-tab-btn', { hasText: '檔案' }).click()
    await win.waitForTimeout(1500)
    const cartFile = view.getByText('cart.js', { exact: true }).first()
    if (!(await cartFile.isVisible().catch(() => false))) await view.getByText('src', { exact: true }).first().click()
    await cartFile.click()
    await win.waitForTimeout(1500)
    await shot(win, 'files')

    await view.locator('.workspace-tab-btn', { hasText: /^Git$/ }).click()
    await win.waitForTimeout(2500)
    await view.getByText('未提交的變更').filter({ visible: true }).first().click()
    await win.waitForTimeout(1000)
    await view.getByText('cart.js').filter({ visible: true }).first().click()
    await win.waitForTimeout(1500)
    await shot(win, 'git')

    await view.locator('.workspace-tab-btn', { hasText: 'Git 圖譜' }).click()
    await win.waitForTimeout(2500)
    await shot(win, 'git-graph')
    await view.locator('.workspace-tab-btn', { hasText: '終端' }).click()

    await win.locator('.right-sidebar-collapsed-btn').first().click()
    await expect(win.locator('.snippet-sidebar')).toBeVisible()
    await win.waitForTimeout(800)
    await shot(win, 'snippets')
    await win.locator('.right-sidebar-collapse').first().click().catch(() => undefined)

    await win.locator('.sidebar-footer-buttons .settings-btn').nth(1).click()
    await win.locator('.settings-tabs button', { hasText: '外觀' }).click()
    const sl = win.locator('.statusline-config-list')
    await sl.scrollIntoViewIfNeeded()
    await shot(win, 'statusline-settings')
    await win.keyboard.press('Escape')

    // ── remote: profiles, add menu, card with remote tools, three wizards ──
    await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
    await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
    await shot(win, 'remote-profiles')
    const wslCard = win.locator('.profile-card', { hasText: 'WSL' })
    if (await wslCard.locator('.profile-card-body').count() === 0) await wslCard.locator('.profile-card-toggle').click()
    await expect(wslCard.locator('[data-testid="remote-tool-claude"]')).toBeVisible({ timeout: 15_000 })
    await shot(win, 'remote-tools')
    if (await wslCard.locator('.profile-card-body').count() > 0) await wslCard.locator('.profile-card-toggle').click()
    const addMore = win.getByRole('button', { name: /更多/ })
    await addMore.click()
    await expect(win.locator('.thumbnail-add-menu-item').first()).toBeVisible()
    await shot(win, 'remote-add-menu')

    for (const [kind, label] of [['wsl', 'WSL'], ['ssh', 'SSH'], ['docker', 'Docker']] as const) {
      if (!(await win.locator('.thumbnail-add-menu-item').first().isVisible().catch(() => false))) await addMore.click()
      await win.locator('.thumbnail-add-menu-item', { hasText: label }).click()
      const shell = win.locator('.bat-wizard-shell')
      await expect(shell).toBeVisible({ timeout: 15_000 })
      await expect(win.locator('#bat-wizard-active-prompt')).toBeVisible({ timeout: 30_000 })
      await win.waitForTimeout(800)
      await shot(win, `wizard-${kind}`)
      await win.locator('.settings-panel .settings-close').last().click()
      await expect(shell).toHaveCount(0, { timeout: 30_000 })
      if (!(await win.locator('.profile-card').first().isVisible().catch(() => false))) {
        await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
        await expect(win.locator('.profile-card').first()).toBeVisible({ timeout: 15_000 })
      }
    }

    const sshCard = win.locator('.profile-card', { hasText: 'SSH dev-server' })
    if (await sshCard.locator('.profile-card-body').count() === 0) await sshCard.locator('.profile-card-toggle').click()
    const edit = sshCard.locator('button[title="編輯連線"]').first()
    if (await edit.isVisible().catch(() => false)) {
      await edit.click()
      await win.waitForTimeout(800)
      await shot(win, 'remote-edit')
    } else {
      log('edit button not found on the SSH card — remote-edit skipped')
    }
  } finally {
    if (inst) await closeIsolated(inst, log)
  }
})

/** launchIsolated with Playwright's recordVideo (the fixture has no option for it). */
async function launchRecording(name: string): Promise<{ inst: IsolatedInstance; windowAt: number }> {
  const runtimeId = `e2e-${name}-${Date.now()}`
  const remotePort = await freePort()
  const app = await electron.launch({
    args: [REPO_ROOT, `--runtime=${runtimeId}`],
    env: isolatedEnv(remotePort, appEnv()),
    recordVideo: { dir: path.join(OUT, 'raw'), size: { width: WIDTH, height: HEIGHT } },
  })
  const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
  if (!path.basename(userData).includes(`-runtime-${runtimeId}`)) {
    await app.close()
    throw new Error(`not an isolated userData: ${userData}`)
  }
  const win = await app.firstWindow()
  const windowAt = Date.now()
  await win.waitForLoadState('domcontentloaded')
  log(`launched (recording) runtime=${runtimeId} remotePort=${remotePort}`)
  return { inst: { app, win, runtimeId, userData, remotePort }, windowAt }
}

function hasFfmpeg(): boolean {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore', windowsHide: true }); return true } catch { return false }
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: 180_000, windowsHide: true }, (err) => err ? reject(err) : resolve())
  })
}

test('clip: the Tower dispatches, the Worker reports, its tab is recycled', async () => {
  test.setTimeout(300_000)
  prepareRoot()
  jobCount.clear()
  let inst: IsolatedInstance | undefined
  let rawVideo: string | undefined
  let startSec = 0
  let durationSec = 0
  try {
    const launched = await launchRecording('site-media-clip')
    inst = launched.inst
    const { app, win } = inst
    rawVideo = await win.video()?.path()
    await setWindowSize(app, win)
    await seed(win)
    const view = await reload(win)
    await waitReady(TOWER)
    await setRole()
    await expect(view.locator('.thumbnail-title', { hasText: 'Demo Agent · Tower' })).toHaveCount(1, { timeout: 15_000 })
    await win.waitForTimeout(800)

    const started = Date.now()
    // The first frame lands a little after firstWindow(); start a beat later rather than early.
    startSec = Math.max(0, (started - launched.windowAt) / 1000 + 0.3)
    await win.waitForTimeout(1500)
    const worker = await dispatch('T1024')
    await win.waitForTimeout(1200)
    await workerThumb(view, 'T1024').click()
    await steps(worker, [
      ...workerHeader('T1024'),
      pause(700),
      say(`${T.cyan}●${T.reset} 修改 src/cart.js：先換算成「分」再加總`),
      pause(1200),
      say(`${T.cyan}●${T.reset} 執行測試`),
      pause(500),
      { run: ['node', '--test', '--test-reporter=spec'] },
      pause(1200),
      say(`${T.green}✓${T.reset} 測試全數通過，回報塔台`),
      pause(500),
      { helper: 'bat-notify.mjs', args: ['--source', 'T1024', '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', 'T1024 完成'] },
    ])
    await expect(workerThumb(view, 'T1024').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await waitInput(TOWER, 'T1024 完成')
    await win.waitForTimeout(1500)
    await shot(win, 'clip-dispatch-poster')
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click()
    await win.waitForTimeout(800)
    await steps(TOWER, [
      say(`${T.green}‹${T.reset} T1024 回報完成，驗收通過`),
      pause(800),
      say(`${T.cyan}›${T.reset} 回收 T1024 的 Worker 分頁`),
      { helper: 'bat-terminal.mjs', args: ['--close-worker', 'T1024', '--notify-id', '$BAT_TERMINAL_ID', '--delay-ms', '500'] },
    ])
    await expect(workerThumb(view, 'T1024')).toHaveCount(0, { timeout: 30_000 })
    await win.waitForTimeout(2000)
    durationSec = (Date.now() - started) / 1000
  } finally {
    if (inst) await closeIsolated(inst, log)
  }

  expect(rawVideo, 'recordVideo produced no file').toBeTruthy()
  const raw = path.join(OUT, 'clip-dispatch-raw.webm')
  fs.copyFileSync(rawVideo!, raw)
  if (!hasFfmpeg()) {
    log(`ffmpeg not found — kept the untrimmed recording ${raw}`)
    return
  }
  const clip = path.join(OUT, 'clip-dispatch.webm')
  log(`trim ${startSec.toFixed(1)}s + ${durationSec.toFixed(1)}s`)
  await ffmpeg(['-ss', startSec.toFixed(2), '-i', raw, '-t', durationSec.toFixed(2), '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-deadline', 'good', clip])
  log(`clip ${clip} (${Math.round(fs.statSync(clip).size / 1024)} KB)`)
})
