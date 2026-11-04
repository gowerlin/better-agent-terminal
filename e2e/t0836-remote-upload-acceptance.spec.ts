// T0836 (PLAN-038 U5): remote attachment upload (T0832–T0835) end to end, against a test-only
// headless bat-server built from this tree — over SSH and in a Docker container. Same environment as
// T0763 (e2e/t0763-remote-waiting-acceptance.spec.ts, left unchanged): the installed WSL bundle copied
// read only to /tmp/bat-e2e-t0836, this tree's headless JS + helpers laid over it; a user-mode sshd
// unpacked from `apt-get download openssh-server`; e2e/real-remote/t0763-ssh-shim.go on the isolated
// instance's PATH so Windows OpenSSH never reads / writes the real ~/.ssh.
// OPT-IN: skipped unless BAT_E2E_T0836=1.
//
//   npx vite build
//   $env:BAT_E2E_T0836='1'
//   npx playwright test e2e/t0836-remote-upload-acceptance.spec.ts
//
// Needs: Windows host, WSL distro (default Ubuntu-24.04, BAT_E2E_T0836_DISTRO) already running with an
// installed bat-server bundle (~/.local/bat-server) and a Docker engine, the local image
// debian:bookworm-slim (BAT_E2E_T0836_BASE_IMAGE; never pulled), Go on PATH, Windows OpenSSH, and the
// Ubuntu archive reachable from WSL (`apt-get download`, no root, nothing installed).
//
//   ① SSH panel   a Claude Agent tab in an ssh-linux window. (a) a 50 MiB + 1 file → refused with the
//                 per-file limit, nothing sent, nothing staged; (b) a 49 MiB file: "uploading N%",
//                 send disabled, input read only → the chip's × cancels: nothing sent, draft and chip
//                 kept, partial upload gone; (c) a dropped file (`file` source, name with a space and
//                 CJK) + a dialog-picked file (`path` source) → the prompt that reaches main's
//                 `claude:send-message` starts with `@<server path>` lines; on the server the files
//                 exist with the same sha256, mode 0600 in 0700 dirs; (d) BUG-211 (T0842): 3 × 9 MiB
//                 images → the remote image budget notice, nothing sent, images and text kept, still
//                 connected; one removed → 2 images sent, the invoke reaches the host (no
//                 FRAME_TOO_LARGE), still connected; (e) the tab closed → `claude:dispose-session` →
//                 the session's staging directory is gone.
//   ② SSH terminal a shell tab in the same window. A dropped file → its quoted server path typed (no
//                 Enter); Ctrl+V with an image on the (stubbed, main-side) clipboard → uploaded, its
//                 path typed, the debug log says `image upload … ok`; both hashes match on the server.
//                 ⏻ restart → after the 10 s grace the staging is kept; the tab closed → it is gone
//                 after ≥ 10 s (PTY_UPLOAD_DISPOSE_GRACE_MS) and before 30 s.
//   ③ Docker panel a docker-linux window (no mounts: every local file is outside them) → a dropped
//                 file is uploaded into the container (sha256 / 0600 checked with `docker exec`), the
//                 prompt has the container path; the tab closed → gone.
//
// No model request: claude:send-message is recorded in main and forwarded to the test server, whose
// claude has no credentials (HOME is a temp dir, env -i). The OS clipboard is never read or written:
// main's `clipboard.read` is replaced in the isolated instance only, for ② only.
//
// User environment (asserted in afterAll, as T0763): WSL home / installed bundle / systemd units / the
// user's bat-server MainPID / tagged processes / ROOT, Docker containers not named bat-e2e-t0836-*, the
// image list, Windows ~/.ssh. Every WSL process the test starts carries T0836_E2E_TAG; the container
// carries label bat.t0836=1; all removed after.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAIN_BUNDLE, REPO_ROOT, closeIsolated, freePort, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0836 === '1'
const log = testLogger('t0836')
const DISTRO = process.env.BAT_E2E_T0836_DISTRO || 'Ubuntu-24.04'
const BASE_IMAGE = process.env.BAT_E2E_T0836_BASE_IMAGE || 'debian:bookworm-slim'
const ROOT = '/tmp/bat-e2e-t0836'
const TAG = 'T0836_E2E_TAG=bat-e2e-t0836'
const PREFIX = 'bat-e2e-t0836-'
const CONTAINER = `${PREFIX}server`
const LABEL = 'bat.t0836=1'
const DOCKER_DATA = '/var/lib/bat-e2e-t0836'
const REAL_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const REAL_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const MiB = 1024 * 1024
const NAME_MARK = 't0836名稱標記' // in file names only: must never reach a log
// 1×1 PNG (the clipboard image of ②)
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

// ── WSL ──────────────────────────────────────────────────────────────────────

/** `bash -c <script> bash <args…>` in the distro (no login profile); never throws. */
async function wsl(script: string, args: string[] = [], timeout = 60_000): Promise<string> {
  return run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-c', script, 'bash', ...args], timeout)
    .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

function distroRunning(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const out = execFileSync('wsl.exe', ['-l', '--running', '-q'], { timeout: 15_000, windowsHide: true })
    return out.toString('utf16le').replace(/\0/g, '').split(/\r?\n/).map(s => s.trim()).includes(DISTRO)
  } catch {
    return false
  }
}

/** Hashes / counts / ports / process names only (no home path, no user name). */
const USER_STATE = `
echo "## home"; ls -A "$HOME" | sha256sum | cut -c1-16
echo "## install"; find "$HOME/.local/bat-server" -printf '%P %s %T@\\n' 2>/dev/null | sort | sha256sum | cut -c1-16
echo "## units"; ls -A "$HOME/.config/systemd/user" 2>/dev/null | sha256sum | cut -c1-16
echo "## bat-units"; systemctl --user list-units --all --no-legend 'bat*' 2>&1 | awk '{print $1, $3, $4}'
echo "## bat-server"; systemctl --user show -p MainPID -p ActiveState bat-server 2>&1 | tr '\\n' ' '; echo
echo "## listeners"; ss -tlnH | awk '{print $4}' | sort | tr '\\n' ' '; echo
echo "## tagged"; grep -lsa '${TAG}' /proc/[0-9]*/environ 2>/dev/null | wc -l
echo "## root"; [ -e ${ROOT} ] && echo present || echo absent
echo "## containers"; docker ps -a --no-trunc --format '{{.ID}} {{.Names}}' | grep -v ' ${PREFIX}' | while read -r id name; do echo "$id $name $(docker inspect -f '{{.State.Status}} {{.State.StartedAt}} {{.RestartCount}}' "$id")"; done | sort | sha256sum | cut -c1-16
echo "## container-count"; docker ps -a --format '{{.Names}}' | grep -vc '^${PREFIX}'
echo "## own-containers"; docker ps -a --format '{{.Names}}' | grep -c '^${PREFIX}'
echo "## images"; docker images -q --no-trunc | sort -u | sha256sum | cut -c1-16
`

function section(text: string, name: string): string {
  const hit = text.split(/^## /m).find(p => p.startsWith(`${name}\n`))
  return hit ? hit.slice(name.length + 1).trim() : ''
}

/** Windows ~/.ssh: names, sizes, mtimes and content hashes (never contents) → one hash + count. */
function windowsSshState(): string {
  const dir = path.join(os.homedir(), '.ssh')
  if (!fs.existsSync(dir)) return 'absent'
  const rows: string[] = []
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) { rows.push(`${path.relative(dir, p)}/ ${st.mtimeMs}`); walk(p); continue }
      let digest = 'unreadable'
      try { digest = createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) } catch { /* locked */ }
      rows.push(`${path.relative(dir, p)} ${st.size} ${st.mtimeMs} ${digest}`)
    }
  }
  walk(dir)
  return `${rows.length} entries ${createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 16)}`
}

/** Copies the installed bundle (read only) to ROOT/install and lays this tree's headless JS + helpers over it. */
async function buildAndInstall(tmp: string): Promise<string> {
  const out = path.join(tmp, 'headless')
  const dd = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'dev-deploy-headless.mjs')).href)
  const config = dd.loadBuildConfig()
  const { build } = await import(pathToFileURL(path.join(REPO_ROOT, 'node_modules', 'esbuild', 'lib', 'main.js')).href)
  await build({
    entryPoints: config.entryPoints.map((e: string) => path.join(REPO_ROOT, ...e.split('/'))),
    outdir: path.join(out, 'remote'),
    ...config.options,
    logLevel: 'warning',
    external: config.externals,
  })
  dd.stageHelperScripts(dd.loadHelperScripts(), path.join(out, 'scripts'))
  const linuxOut = (await wsl('wslpath -u "$1"', [out])).trim()
  return wsl(`set -e
R=${ROOT}; W="$1"
[ -x "$HOME/.local/bat-server/bin/node" ] || { echo NO-INSTALL; exit 3; }
mkdir -p $R/ssh/ws/a
cp -a "$HOME/.local/bat-server" $R/install
cp "$W"/remote/*.js $R/install/electron/remote/
cp "$W"/scripts/* $R/install/scripts/
grep -q "upload:begin" $R/install/electron/remote/*.js && echo "upload handlers present"
echo "installed version $(sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' $R/install/package.json)"`, [linuxOut], 180_000)
}

async function startServer(name: string, port: number, token: string): Promise<string> {
  return wsl(`R=${ROOT}; D=$R/$1; mkdir -p $D/data $D/home; cd $D || exit 3
setsid nohup env -i HOME=$D/home PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SHELL=/bin/bash LANG=C.UTF-8 TERM=xterm-256color ${TAG} \\
  $R/install/bin/node $R/install/bin/bat-server.mjs --data-dir $D/data --port "$2" --bind-interface localhost --token "$3" >>$D/server.log 2>&1 </dev/null &
echo $! > $D/server.pid
for i in $(seq 1 60); do ss -tlnH | grep -q "127.0.0.1:$2 " && { echo listening; exit 0; }; sleep 0.5; done
echo not-listening; tail -20 $D/server.log`, [name, String(port), token], 60_000)
}

async function stopServer(name: string): Promise<string> {
  return wsl(`D=${ROOT}/$1; [ -f $D/server.pid ] || { echo no-pid; exit 0; }
P=$(cat $D/server.pid); kill $P 2>/dev/null
for i in $(seq 1 40); do kill -0 $P 2>/dev/null || { echo stopped; exit 0; }; sleep 0.25; done
kill -9 $P 2>/dev/null; echo killed`, [name])
}

const certFingerprintSed = `sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p'`

/** openssh-server unpacked into ROOT/sshd (no root, nothing installed), keys + config, started as the user. */
async function startSshd(port: number, serverPort: number, authorizedKey: string): Promise<string> {
  return wsl(`set -e; R=${ROOT}; S=$R/sshd; mkdir -p $S/pkg $S/root; cd $S/pkg
apt-get download openssh-server >/dev/null 2>&1 || { echo DOWNLOAD-FAILED; exit 3; }
dpkg-deb -x openssh-server_*.deb $S/root
ssh-keygen -q -t ed25519 -N '' -C t0836-host -f $S/host_ed25519
printf '%s\\n' "$3" > $S/authorized_keys; chmod 600 $S/authorized_keys
cat > $S/sshd_config <<EOF
Port $1
ListenAddress 127.0.0.1
HostKey $S/host_ed25519
PidFile $S/sshd.pid
AuthorizedKeysFile $S/authorized_keys
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
StrictModes no
AllowTcpForwarding local
PermitOpen localhost:$2 127.0.0.1:$2
AllowAgentForwarding no
X11Forwarding no
PermitTTY no
LogLevel VERBOSE
EOF
$S/root/usr/sbin/sshd -t -f $S/sshd_config
setsid nohup env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 ${TAG} $S/root/usr/sbin/sshd -D -e -f $S/sshd_config >>$S/sshd.log 2>&1 </dev/null &
echo $! > $S/sshd.run.pid
for i in $(seq 1 40); do ss -tlnH | grep -q "127.0.0.1:$1 " && { echo "sshd $($S/root/usr/sbin/sshd -V 2>&1 | head -1) listening"; exit 0; }; sleep 0.25; done
echo not-listening; tail -20 $S/sshd.log`, [String(port), String(serverPort), authorizedKey], 120_000)
}

/** The listener and every per-connection sshd it forked (setproctitle hides the tag: match the executable). */
async function stopSshd(): Promise<string> {
  return wsl(`S=${ROOT}/sshd; [ -f $S/sshd.run.pid ] || { echo no-pid; exit 0; }
mine() { for d in /proc/[0-9]*; do case "$(readlink $d/exe 2>/dev/null)" in "$S/root/usr/sbin/sshd"*) echo \${d#/proc/};; esac; done; }
P=$(mine); N=$(echo $P | wc -w); [ -n "$P" ] && kill $P 2>/dev/null
for i in $(seq 1 40); do [ -z "$(mine)" ] && { echo "stopped $N sshd"; exit 0; }; sleep 0.25; done
kill -9 $(mine) 2>/dev/null; echo "killed $N sshd"`)
}

// ── Docker (the engine inside WSL; only names starting with PREFIX are touched) ─────────────

async function docker(args: string[], timeout = 60_000): Promise<string> {
  return run('wsl.exe', ['-d', DISTRO, '--exec', 'docker', ...args], timeout)
    .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

async function startContainer(port: number, token: string): Promise<string> {
  return (await docker(['run', '-d', '--name', CONTAINER, '--label', LABEL,
    '-p', `127.0.0.1:${port}:9876`, '-v', `${ROOT}/install:/opt/bat-server:ro`,
    '-e', 'LANG=C.UTF-8', '-e', 'TERM=xterm-256color', '-e', 'SHELL=/bin/bash', '-e', 'HOME=/root',
    '--entrypoint', '/opt/bat-server/bin/node', BASE_IMAGE,
    '/opt/bat-server/bin/bat-server.mjs', '--data-dir', DOCKER_DATA, '--port', '9876', '--bind-interface', 'all', '--token', token], 120_000)).trim()
}

async function removeContainer(): Promise<string> {
  const names = (await docker(['ps', '-a', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.Names}} {{.Label "bat.t0836"}}'])).trim()
  if (names.startsWith('ERR')) return `${CONTAINER}: docker ps failed ${names.slice(0, 200)}`
  if (!names) return `${CONTAINER}: absent`
  if (names !== `${CONTAINER} 1`) return `${CONTAINER}: exists WITHOUT label ${LABEL} — not ours, left alone`
  const out = await docker(['rm', '-f', CONTAINER])
  return `${CONTAINER}: ${out.startsWith('ERR') ? `remove FAILED ${out.slice(0, 200)}` : 'removed'}`
}

/** Every process left with the tag: SIGTERM, then SIGKILL; then ROOT. */
async function cleanupWsl(): Promise<string> {
  return wsl(`R=${ROOT}
tagged() { grep -lsa '${TAG}' /proc/[0-9]*/environ 2>/dev/null | sed 's#/proc/\\([0-9]*\\)/environ#\\1#' | grep -vx "$$"; }
P=$(tagged); echo "tagged before: $(echo $P | wc -w)"
[ -n "$P" ] && kill $P 2>/dev/null; sleep 1
P=$(tagged); [ -n "$P" ] && { echo "SIGKILL $(echo $P | wc -w)"; kill -9 $P 2>/dev/null; sleep 0.5; }
echo "tagged after: $(tagged | wc -w)"
underRoot() { for d in /proc/[0-9]*; do case "$(readlink $d/exe 2>/dev/null)" in "$R"/*) echo \${d#/proc/};; esac; done; }
P=$(underRoot); [ -n "$P" ] && { echo "running from ${ROOT} (untagged): $(echo $P | wc -w), SIGKILL"; kill -9 $P 2>/dev/null; sleep 0.5; }
rm -rf $R && echo "removed ${ROOT}"`)
}

// ── the staging on a host ──────────────────────────────────────────────────

interface Host {
  name: string
  /** `bash -c <script> bash <args…>` where the server runs. */
  sh(script: string, args?: string[]): Promise<string>
  uploads: string
  log(): Promise<string>
}

const sshHost: Host = {
  name: 'ssh',
  sh: (script, args = []) => wsl(script, args),
  uploads: `${ROOT}/ssh/data/uploads`,
  log: async () => (await wsl(`cat ${ROOT}/ssh/server.log 2>/dev/null`)).replace(/\r/g, ''),
}

const dockerHost: Host = {
  name: 'docker',
  sh: (script, args = []) => docker(['exec', CONTAINER, 'bash', '-c', script, 'bash', ...args]),
  uploads: `${DOCKER_DATA}/uploads`,
  log: async () => (await docker(['logs', CONTAINER])).replace(/\r/g, ''),
}

/** `<mode> <size> <sha256>` of a server file, and the modes of its upload / session / uploads dirs. */
async function stagedFile(host: Host, serverPath: string): Promise<{ file: string; dirs: string }> {
  const out = (await host.sh(`F="$1"; U=$(dirname "$F"); S=$(dirname "$U"); A=$(dirname "$S")
echo "$(stat -c '%a %s' "$F") $(sha256sum "$F" | cut -d' ' -f1)"
echo "$(stat -c '%a' "$U") $(stat -c '%a' "$S") $(stat -c '%a' "$A")"`, [serverPath])).trim().split('\n')
  return { file: out[0] ?? '', dirs: out[1] ?? '' }
}

/** Entries under the session's staging dir (`absent` when the dir itself is gone). */
async function stagedEntries(host: Host, sessionKey: string): Promise<string> {
  return (await host.sh(`D="$1/$2"; [ -d "$D" ] || { echo absent; exit 0; }; find "$D" -mindepth 1 -printf '%P\\n' | sort | tr '\\n' ' '`, [host.uploads, sessionKey])).trim()
}

// ── UI ───────────────────────────────────────────────────────────────────────

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\[\?2004[hl]/g, '')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const activePanel = (win: Page): Locator => win.locator('.workspace-container.active .terminal-wrapper.active .claude-agent-panel')
const toasts = (win: Page): Locator => win.locator('.ct-toast-text')

const buffer = async (page: Page, id: string) => ((await page.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''
const write = (page: Page, id: string, data: string) => page.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
const connectedOf = (page: Page) => page.evaluate(async () => ((await (window as AnyApi).electronAPI.remote.clientStatus()) as { connected: boolean }).connected)

/** Drops the real files on `target`: an <input type=file> gets them via setInputFiles, their Files go into one DragEvent. */
async function dropRealFiles(win: Page, target: string, filePaths: string[]): Promise<void> {
  await win.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.id = 't0836-drop-input'
    input.style.display = 'none'
    document.body.appendChild(input)
  })
  await win.setInputFiles('#t0836-drop-input', filePaths)
  await win.evaluate((selector) => {
    const input = document.getElementById('t0836-drop-input') as HTMLInputElement
    const el = document.querySelector(selector)
    if (!el || !input.files?.length) throw new Error(`drop target ${selector} or files missing`)
    const dt = new DataTransfer()
    for (const f of Array.from(input.files)) dt.items.add(f)
    for (const type of ['dragenter', 'dragover', 'drop']) {
      el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }))
    }
    input.remove()
  }, target)
}

interface SendCall { sessionId: string; prompt: string; images: number; imageChars: number; result?: string; error?: string; at: number }

/** main: `claude:send-message` recorded (prompt, image count) and forwarded unchanged; the file dialog and the clipboard stubbable. */
async function installMainHooks(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ ipcMain, dialog, clipboard }) => {
    const g = globalThis as AnyApi
    g.__t0836 = { sends: [] as unknown[], picks: [] as string[], clipboardPng: null as string | null, clipboardReads: 0 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: g.__t0836.picks })
    const originalRead = clipboard.read.bind(clipboard) as (...a: unknown[]) => ReturnType<typeof clipboard.read>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(clipboard as any).read = async (...a: any[]) => {
      if (!g.__t0836.clipboardPng) return originalRead(...a)
      g.__t0836.clipboardReads++
      const png = Buffer.from(g.__t0836.clipboardPng, 'base64')
      return [{ types: ['image/png'], getType: async (type: string) => { if (type !== 'image/png') throw new Error('no such type'); return new Blob([png], { type }) } }]
    }
    const handlers = (ipcMain as AnyApi)._invokeHandlers as Map<string, (...a: unknown[]) => unknown>
    if (!handlers || typeof handlers.get !== 'function') return 'ipcMain._invokeHandlers unavailable'
    const original = handlers.get('claude:send-message')
    if (!original) return 'no claude:send-message handler'
    ipcMain.removeHandler('claude:send-message')
    ipcMain.handle('claude:send-message', async (event, ...args: unknown[]) => {
      const images = Array.isArray(args[2]) ? (args[2] as string[]) : []
      const call: AnyApi = { sessionId: String(args[0]), prompt: String(args[1]), images: images.length, imageChars: images.reduce((n, s) => n + String(s).length, 0), at: Date.now() }
      g.__t0836.sends.push(call)
      try {
        const result = await original(event, ...args)
        call.result = JSON.stringify(result ?? null).slice(0, 200)
        return result
      } catch (err) {
        call.error = String((err as Error)?.message ?? err).slice(0, 300)
        throw err
      }
    })
    return 'ok'
  })
}

const sends = (app: ElectronApplication) => app.evaluate(() => (globalThis as AnyApi).__t0836.sends) as Promise<SendCall[]>
const setPicks = (app: ElectronApplication, picks: string[]) => app.evaluate((_e, p) => { (globalThis as AnyApi).__t0836.picks = p }, picks)

interface Seed { workspaces: Array<{ id: string; folder: string }>; terminals: Array<{ id: string; ws: string; title: string; cwd: string }>; active: string; activeTab: string }

let inst: IsolatedInstance | undefined
let tmp = ''
let before = ''
let sshBefore = ''
let sshUser = ''
let keyPath = ''
let shimLog = ''
let sshPage: Page | undefined
const results: Record<string, string> = {}
const ports = { ssh: 0, sshd: 0, docker: 0 }
const tokens = { ssh: '', docker: '' }
const SSH_WS = 'e2e-t0836-ssh', SSH_TAB = 'e2e-t0836-ssh-shell'

/** Profile → its own window, seeded with the workspaces / tabs, connected again after the reload. */
async function openRemoteWindow(name: string, create: Record<string, unknown>, update: Record<string, unknown>, seed: Seed): Promise<Page> {
  const { app, win } = inst!
  const profileId = await win.evaluate(async ({ n, c, u }) => {
    const api = (window as AnyApi).electronAPI
    const created = await api.profile.create(n, { type: 'remote', ...c })
    await api.profile.update(created.id, u)
    return created.id as string
  }, { n: name, c: create, u: update })
  const opened = await win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId) as { windowIds?: string[]; error?: string }
  log(`${name}: openNewInstance → ${JSON.stringify(opened)}`)
  expect(opened.error).toBeUndefined()
  const needle = `windowId=${encodeURIComponent(opened.windowIds![0])}`
  let found: Page | undefined
  await expect.poll(() => (found = app.windows().find(p => p.url().includes(needle))) !== undefined, { timeout: 30_000 }).toBe(true)
  const page = found!
  await page.waitForLoadState('domcontentloaded')
  await expect.poll(() => connectedOf(page), { timeout: 60_000 }).toBe(true)
  expect(await page.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify({
    workspaces: seed.workspaces.map(w => ({ id: w.id, name: w.id, folderPath: w.folder, createdAt: Date.now() })),
    activeWorkspaceId: seed.active, activeGroup: null,
    terminals: seed.terminals.map(t => ({ id: t.id, workspaceId: t.ws, type: 'terminal', title: t.title, cwd: t.cwd })),
    activeTerminalId: seed.activeTab,
  }))).toBe(true)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await expect.poll(() => connectedOf(page), { timeout: 60_000 }).toBe(true)
  await expect(page.locator('.workspace-item.active', { hasText: seed.active })).toHaveCount(1, { timeout: 30_000 })
  return page
}

/** A Claude Agent tab from the thumbnail "+" menu; returns its panel. */
async function openClaudeTab(page: Page): Promise<Locator> {
  await page.locator('.workspace-container.active .thumbnail-add-btn').click()
  const item = page.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: 'Claude Agent', hasNotText: 'Worktree' }).first()
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.click()
  const panel = activePanel(page)
  await expect(panel).toBeVisible({ timeout: 45_000 })
  await expect(panel.locator('textarea.claude-input')).toBeVisible({ timeout: 30_000 })
  return panel
}

/** Closes the active tab with its header ×, confirming the agent-tab dialog when it appears. */
async function closeActiveTab(page: Page): Promise<void> {
  await page.locator('.workspace-container.active .terminal-wrapper.active button.action-btn.danger', { hasText: '×' }).first().click()
  const confirm = page.locator('.dialog-overlay .dialog-actions .dialog-btn.confirm:not(.danger)')
  if (await confirm.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)) await confirm.click()
}

/** The local file's chip(s) are attached; type `text` and press Enter in the panel input. */
async function typeAndSend(panel: Locator, text: string): Promise<void> {
  const input = panel.locator('textarea.claude-input')
  await input.fill(text)
  await input.press('Enter')
}

function writeFile(name: string, data: Buffer): { path: string; sha: string; size: number } {
  const p = path.join(tmp, 'local', name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, data)
  return { path: p, sha: sha256(data), size: data.length }
}

/** A deterministic, incompressible-enough payload (fast to make, distinct per seed). */
function bulk(size: number, seed: number): Buffer {
  const block = createHash('sha512').update(`t0836-${seed}`).digest()
  const buf = Buffer.allocUnsafe(size)
  for (let off = 0; off < size; off += block.length) block.copy(buf, off, 0, Math.min(block.length, size - off))
  return buf
}

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0836=1 (T0836)')
test.skip(process.platform !== 'win32', 'Windows host with WSL only')
test.skip(!fs.existsSync(MAIN_BUNDLE), 'dist-electron/ missing — run `npx vite build` first')
test.skip(process.platform === 'win32' && ENABLED && !distroRunning(), `WSL distro ${DISTRO} is not running (this test never starts it)`)

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(600_000)
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0836-'))
  before = await wsl(USER_STATE)
  sshBefore = windowsSshState()
  log(`WSL before: ${before.replace(/\n/g, ' | ')}`)
  log(`Windows ~/.ssh before: ${sshBefore}`)
  expect(section(before, 'root'), `${ROOT} already exists: a previous run did not clean up`).toBe('absent')
  expect(section(before, 'own-containers'), `leftover ${PREFIX}* containers`).toBe('0')
  expect((await docker(['images', '-q', BASE_IMAGE])).trim(), `${BASE_IMAGE} is not on the engine (never pulled by this test)`).toMatch(/^[0-9a-f]{12}/)
  expect(fs.existsSync(REAL_SSH), `${REAL_SSH} missing`).toBe(true)

  const installed = await buildAndInstall(tmp)
  log(`install: ${installed.replace(/\n/g, ' | ')}`)
  expect(installed).toContain('upload handlers present')
  sshUser = (await wsl('id -un')).trim()

  const shimDir = path.join(tmp, 'shim-bin')
  fs.mkdirSync(shimDir, { recursive: true })
  execFileSync('go', ['build', '-o', path.join(shimDir, 'ssh.exe'), path.join(REPO_ROOT, 'e2e', 'real-remote', 't0763-ssh-shim.go')], { encoding: 'utf8', timeout: 300_000, windowsHide: true })
  keyPath = path.join(tmp, 'client_ed25519')
  execFileSync(REAL_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 't0836-client', '-f', keyPath], { timeout: 30_000, windowsHide: true })
  shimLog = path.join(tmp, 'ssh-shim.log')

  for (const k of ['ssh', 'docker'] as const) tokens[k] = `t0836-${k}-${randomBytes(18).toString('base64url')}`
  ports.ssh = await freePort()
  ports.sshd = await freePort()
  ports.docker = await freePort()
  const started = await startServer('ssh', ports.ssh, tokens.ssh)
  log(`server ssh on 127.0.0.1:${ports.ssh}: ${started.trim().replace(/\n/g, ' | ')}`)
  expect(started).toContain('listening')
  const sshd = await startSshd(ports.sshd, ports.ssh, fs.readFileSync(`${keyPath}.pub`, 'utf8').trim())
  log(`sshd on 127.0.0.1:${ports.sshd}: ${sshd.trim().replace(/\n/g, ' | ')}`)
  expect(sshd).toContain('listening')

  inst = await launchIsolated('t0836', log, {
    env: {
      Path: `${shimDir};${process.env.PATH ?? process.env.Path ?? ''}`,
      T0763_SSH_REAL: REAL_SSH,
      T0763_SSH_KNOWN_HOSTS: path.join(tmp, 'known_hosts').split(path.sep).join('/'),
      T0763_SSH_LOG: shimLog,
    },
  })
  await expect.poll(async () => (await inst!.win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  const hooked = await installMainHooks(inst.app)
  log(`main hooks: ${hooked}`)
  expect(hooked).toBe('ok')

  const fp = (await wsl(`${certFingerprintSed} ${ROOT}/ssh/data/server-cert.json`)).trim()
  expect(fp).toMatch(/^[0-9A-F:]{95}$/i)
  sshPage = await openRemoteWindow('e2e-t0836 SSH',
    { remoteHost: 'localhost', remotePort: ports.ssh, remoteToken: tokens.ssh, remoteFingerprint: fp },
    { targetOS: 'ssh-linux', sshHost: '127.0.0.1', sshUser, sshPort: ports.sshd, sshKeyPath: keyPath },
    { workspaces: [{ id: SSH_WS, folder: `${ROOT}/ssh/ws/a` }], terminals: [{ id: SSH_TAB, ws: SSH_WS, title: 'T0836 SSH shell', cwd: `${ROOT}/ssh/ws/a` }], active: SSH_WS, activeTab: SSH_TAB })
  const shim = fs.readFileSync(shimLog, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l) as { args: string[]; exit: number })
  const tunnel = shim.find(e => e.args.includes('-L') && e.exit === -1)
  expect(tunnel, 'a running `ssh -L` started by BAT (the window goes through the SSH tunnel)').toBeTruthy()
})

test.afterAll(async () => {
  test.setTimeout(240_000)
  const userData = inst?.userData
  if (userData) {
    const logs = path.join(userData, 'Logs')
    const debug = fs.existsSync(logs) ? fs.readdirSync(logs).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(logs, f), 'utf8')).join('\n') : ''
    for (const t of Object.values(tokens)) if (t) expect.soft(debug.includes(t), 'a test token in the debug log').toBe(false)
    expect.soft(debug.includes(NAME_MARK), 'a file name in the debug log (T0832 C-10)').toBe(false)
    const uploadLines = debug.split('\n').filter(l => /\[(upload-client|attachments|terminal-paste)\]/.test(l))
    log(`client upload log lines: ${uploadLines.length}; sample: ${JSON.stringify(uploadLines.slice(0, 6).map(l => l.replace(/^.*?\[/, '[').slice(0, 200)))}`)
  }
  for (const host of [sshHost]) {
    const hostLog = await host.log().catch(() => '')
    if (hostLog) {
      expect.soft(hostLog.includes(NAME_MARK), `a file name in the ${host.name} server log`).toBe(false)
      log(`${host.name} server [upload] lines: ${JSON.stringify(hostLog.split('\n').filter(l => l.includes('[upload]')).slice(0, 12).map(l => l.replace(/^.*\[upload\]/, '[upload]').slice(0, 160)))}`)
    }
  }
  if (inst) await closeIsolated(inst, log).catch(e => log(`closeIsolated: ${String(e)}`))
  log(`WSL stop: ssh ${(await stopServer('ssh')).trim()}, sshd ${(await stopSshd()).trim()}`)
  log(`docker cleanup: ${await removeContainer()}`)
  log(`WSL cleanup: ${(await cleanupWsl()).trim().replace(/\n/g, ' | ')}`)
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  log(`Windows temp ${tmp} removed: ${!fs.existsSync(tmp)}`)

  const after = await wsl(USER_STATE)
  const sshAfter = windowsSshState()
  const compare: Record<string, string> = {}
  for (const key of ['home', 'install', 'units', 'bat-units', 'bat-server', 'tagged', 'root', 'containers', 'container-count', 'own-containers', 'images']) {
    compare[key] = section(before, key) === section(after, key) ? 'same' : `before ${JSON.stringify(section(before, key))} after ${JSON.stringify(section(after, key))}`
  }
  compare['windows-ssh'] = sshBefore === sshAfter ? 'same' : `before ${sshBefore} after ${sshAfter}`
  log(`user environment after: ${JSON.stringify(compare)}`)
  log(`T0836 results: ${JSON.stringify(results, null, 2)}`)
  for (const key of Object.keys(compare)) expect(compare[key], key).toBe('same')
  const listeners = section(after, 'listeners').split(' ')
  for (const [name, port] of Object.entries(ports)) if (port) expect(listeners, `a listener left on the ${name} port ${port}`).not.toContain(`127.0.0.1:${port}`)
})

test('① SSH Claude panel: limit, progress + cancel, upload into the prompt (sha256 / 0600), BUG-211 image budget, closed → staging removed', async () => {
  test.setTimeout(420_000)
  const { app } = inst!
  const page = sshPage!
  const panel = await openClaudeTab(page)
  const panelSel = '.workspace-container.active .terminal-wrapper.active .claude-agent-panel'
  const chips = panel.locator('.claude-attachment-file')
  const input = panel.locator('textarea.claude-input')
  const out: string[] = []

  // (a) 50 MiB + 1 → refused before any upload; nothing sent, nothing staged
  const tooBig = writeFile(`t0836-too-big-${NAME_MARK}.bin`, bulk(50 * MiB + 1, 1))
  const sendsBefore = (await sends(app)).length
  await dropRealFiles(page, panelSel, [tooBig.path])
  await expect(chips).toHaveCount(1, { timeout: 15_000 })
  await input.focus()
  await input.press('Enter')
  const tooBigToast = toasts(page).filter({ hasText: /50 MiB/ })
  await expect(tooBigToast).toHaveCount(1, { timeout: 15_000 })
  const tooBigText = (await tooBigToast.first().textContent()) ?? ''
  await expect(chips).toHaveCount(0, { timeout: 10_000 })
  expect((await sends(app)).length).toBe(sendsBefore)
  const uploadsAfterTooBig = (await sshHost.sh(`ls -A "$1" 2>/dev/null | wc -l`, [sshHost.uploads])).trim()
  expect(uploadsAfterTooBig).toBe('0')
  expect.soft(tooBigText.includes(NAME_MARK) || tooBigText.includes('too-big'), 'the toast names the refused file').toBe(true)
  // T0843: the reason comes first ("未附加（超過單檔 50 MiB 上限）：<file>" / "Not attached (over the 50 MiB
  // per-file limit): <file>"), the file is named once, no T0437 "not on the remote host" sentence.
  expect.soft(/^\s*(未附加（|Not attached \()/.test(tooBigText), `the toast starts with the reason: "${tooBigText.slice(0, 80)}"`).toBe(true)
  expect.soft(tooBigText.split('t0836-too-big-').length - 1, 'the refused file is named once').toBe(1)
  expect.soft(/不在遠端主機上|不在远程主机上|Not on the remote host/.test(tooBigText), 'no T0437 sentence for a tried upload').toBe(false)
  out.push(`(a) 50 MiB + 1 B → toast "${tooBigText.replace(/t0836-too-big-\S+/, '<file>').slice(0, 140)}", chip removed, no claude:send-message, host uploads/ entries ${uploadsAfterTooBig}`)
  await page.locator('.ct-toast-close').first().click().catch(() => {})

  // (b) 49 MiB: progress, send disabled, input read only → cancel (the chip's ×) keeps the draft
  const big = writeFile(`t0836-cancel-${NAME_MARK}.bin`, bulk(49 * MiB, 2))
  await dropRealFiles(page, panelSel, [big.path])
  await expect(chips).toHaveCount(1, { timeout: 15_000 })
  await input.fill('t0836 draft kept')
  await input.press('Enter')
  const progress = panel.locator('.claude-attachment-upload-progress')
  await expect(progress).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => /([1-9]\d?)%/.test((await progress.textContent()) ?? ''), { timeout: 30_000, intervals: [50] }).toBe(true)
  const progressText = (await progress.textContent()) ?? ''
  const sendBtn = panel.locator('button.claude-send-btn:not(.claude-stop-btn)')
  const sendDisabled = await sendBtn.isDisabled()
  const readOnly = await input.evaluate(el => (el as HTMLTextAreaElement).readOnly)
  const cancelLabel = (await chips.first().locator('.claude-attachment-remove').getAttribute('aria-label')) ?? ''
  const addHidden = (await panel.locator('.claude-add-image-btn').count()) === 0
  const sessionKeyDuring = (await sshHost.sh(`ls -A "$1" 2>/dev/null`, [sshHost.uploads])).trim()
  await page.screenshot({ path: test.info().outputPath('1b-uploading.png') })
  await chips.first().locator('.claude-attachment-remove').click()
  const cancelToast = toasts(page).filter({ hasText: /已取消上傳|Upload cancelled|已取消上传/ })
  await expect(cancelToast).toHaveCount(1, { timeout: 15_000 })
  await expect(progress).toHaveCount(0, { timeout: 10_000 })
  expect(sendDisabled).toBe(true)
  expect(readOnly).toBe(true)
  expect(addHidden).toBe(true)
  await expect(input).toHaveValue('t0836 draft kept')
  await expect(chips).toHaveCount(1)
  expect((await sends(app)).length).toBe(sendsBefore)
  expect(sessionKeyDuring, 'the upload had started on the host').not.toBe('')
  let afterCancel = ''
  await expect.poll(async () => (afterCancel = await stagedEntries(sshHost, sessionKeyDuring)), { timeout: 15_000 }).toMatch(/^(absent|)$/)
  out.push(`(b) 49 MiB: "${progressText}" shown, send button disabled ${sendDisabled}, input readOnly ${readOnly}, "+" hidden ${addHidden}, chip × = "${cancelLabel}" → toast "${(await cancelToast.first().textContent())?.slice(0, 80)}", draft "t0836 draft kept" + chip kept, no send; host staging of the session after cancel: "${afterCancel || 'empty'}"`)
  // remove the big file (no longer uploading: × removes it)
  await chips.first().locator('.claude-attachment-remove').click()
  await expect(chips).toHaveCount(0)

  // (c) a dropped file (`file` source) + a dialog pick (`path` source) → uploaded, @<server path> in the prompt
  const dropped = writeFile(`t0836 拖放 ${NAME_MARK}.txt`, randomBytes(300 * 1024 + 7)) // 2 chunks
  const picked = writeFile(`t0836-dialog-${NAME_MARK}.log`, randomBytes(1 * MiB + 3))
  await dropRealFiles(page, panelSel, [dropped.path])
  await expect(chips).toHaveCount(1, { timeout: 15_000 })
  await setPicks(app, [picked.path])
  await panel.locator('.claude-add-image-btn').click()
  await expect(chips).toHaveCount(2, { timeout: 15_000 })
  await typeAndSend(panel, 't0836 read both files')
  await expect.poll(async () => (await sends(app)).length, { timeout: 60_000 }).toBe(sendsBefore + 1)
  let call = (await sends(app)).at(-1)!
  await expect.poll(async () => { call = (await sends(app)).at(-1)!; return call.result !== undefined || call.error !== undefined }, { timeout: 60_000 }).toBe(true)
  const sessionKey = call.sessionId
  log(`① (c) send: session ${sessionKey.slice(0, 8)}… prompt ${JSON.stringify(call.prompt.replace(new RegExp(escapeRe(NAME_MARK), 'g'), '<mark>'))} result ${call.result ?? ''} error ${call.error ?? ''}`)
  expect(sessionKey).toBe(sessionKeyDuring)
  const lines = call.prompt.split('\n')
  const prefix = `@${sshHost.uploads}/${sessionKey}/`
  expect(lines[0].startsWith(prefix) && lines[0].endsWith(`/${path.basename(dropped.path)}`), `line 1 ${lines[0]}`).toBe(true)
  expect(lines[1].startsWith(prefix) && lines[1].endsWith(`/${path.basename(picked.path)}`), `line 2 ${lines[1]}`).toBe(true)
  expect(lines.slice(2).join('\n')).toBe('\nt0836 read both files')
  expect(call.prompt).not.toContain(tmp) // no client path in the prompt
  const staged = []
  for (const [line, local] of [[lines[0], dropped], [lines[1], picked]] as const) {
    const s = await stagedFile(sshHost, line.slice(1))
    staged.push(s)
    expect(s.file).toBe(`600 ${local.size} ${local.sha}`)
    expect(s.dirs).toBe('700 700 700')
  }
  await expect(chips).toHaveCount(0)
  out.push(`(c) drop (\`file\`, ${dropped.size} B, name with space + CJK) + dialog (\`path\`, ${picked.size} B) → claude:send-message prompt "@${sshHost.uploads}/<session>/<id>/<name>" × 2 + text; server: ${staged.map(s => `${s.file.slice(0, 20)}… dirs ${s.dirs}`).join('; ')} (mode / size / sha256 = local); send ${call.error ? `error ${call.error}` : `result ${call.result}`}`)

  // (d) BUG-211 (T0842): 3 × 9 MiB images → budget notice, nothing sent, kept; 2 → sent, still connected
  const imgs = [3, 4, 5].map(n => writeFile(`t0836-img-${n}.png`, Buffer.concat([Buffer.from(PNG_1PX, 'base64'), bulk(9 * MiB, n)])))
  const thumbs = panel.locator('.claude-attachment-thumb')
  await setPicks(app, imgs.map(i => i.path))
  await panel.locator('span.claude-status-btn', { hasText: '📎' }).click()
  await expect(thumbs).toHaveCount(3, { timeout: 30_000 })
  const n3 = (await sends(app)).length
  await typeAndSend(panel, 't0836 three images')
  const budgetToast = toasts(page).filter({ hasText: /20\.0 MiB/ })
  await expect(budgetToast).toHaveCount(1, { timeout: 15_000 })
  const budgetText = (await budgetToast.first().textContent()) ?? ''
  await page.waitForTimeout(1_500)
  expect((await sends(app)).length).toBe(n3)
  await expect(thumbs).toHaveCount(3)
  await expect(input).toHaveValue('t0836 three images')
  expect(await connectedOf(page)).toBe(true)
  await panel.locator('.claude-attachment .claude-attachment-remove').first().click()
  await expect(thumbs).toHaveCount(2)
  await input.press('Enter')
  await expect.poll(async () => (await sends(app)).length, { timeout: 60_000 }).toBe(n3 + 1)
  let two = (await sends(app)).at(-1)!
  await expect.poll(async () => { two = (await sends(app)).at(-1)!; return two.result !== undefined || two.error !== undefined }, { timeout: 60_000 }).toBe(true)
  log(`① (d) 2 images: images ${two.images} (${two.imageChars} data-URL chars) result ${two.result ?? ''} error ${two.error ?? ''}`)
  expect(two.images).toBe(2)
  expect(two.error ?? '').not.toMatch(/FRAME_TOO_LARGE|closed|timeout/i)
  await page.waitForTimeout(2_000)
  expect(await connectedOf(page)).toBe(true)
  out.push(`(d) 3 × ${(imgs[0].size / MiB).toFixed(1)} MiB images → toast "${budgetText.slice(0, 120)}", no send, 3 images + text kept, connected; 1 removed → claude:send-message with 2 images (${(two.imageChars / MiB).toFixed(1)} M data-URL chars) reached the host (${two.error ? `error ${two.error}` : `result ${two.result}`}), still connected`)

  // (e) the tab closed → claude:dispose-session → the session's staging is gone
  expect(await stagedEntries(sshHost, sessionKey)).not.toBe('absent')
  await closeActiveTab(page)
  await expect(panel).toHaveCount(0, { timeout: 15_000 })
  await expect.poll(() => stagedEntries(sshHost, sessionKey), { timeout: 20_000 }).toBe('absent')
  const disposeLine = (await sshHost.log()).split('\n').find(l => l.includes(`[upload] dispose session=${sessionKey.slice(0, 8)}`)) ?? ''
  out.push(`(e) tab closed → ${sshHost.uploads}/<session> gone; server log "${disposeLine.replace(/^.*\[upload\]/, '[upload]')}"`)
  results['①'] = `PASS — ${out.join(' | ')}`
})

test('② SSH terminal: drop → quoted server path, Ctrl+V image → uploaded path; ⏻ restart keeps the staging, closing the tab removes it after the 10 s grace', async () => {
  test.setTimeout(300_000)
  const { app, userData } = inst!
  const page = sshPage!
  const tabSel = `.workspace-container.active .terminal-wrapper.active .terminal-panel`
  await page.locator('.workspace-container.active .thumbnail', { hasText: 'T0836 SSH shell' }).first().click()
  await expect(page.locator(tabSel)).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => stripAnsi(await buffer(page, SSH_TAB)).includes('$'), { timeout: 30_000, message: 'shell prompt' }).toBe(true)
  const out: string[] = []
  const lineWith = async (needle: string): Promise<string> => {
    let line = ''
    await expect.poll(async () => (line = stripAnsi(await buffer(page, SSH_TAB)).replace(/\r/g, '').split('\n').reverse().find(l => l.includes(needle)) ?? ''), { timeout: 30_000 }).not.toBe('')
    return line
  }

  // drop: `sha256sum ` typed first, the drop types the quoted server path (no Enter), then Enter
  const dropped = writeFile(`t0836 終端 ${NAME_MARK}.bin`, randomBytes(400 * 1024 + 11))
  await write(page, SSH_TAB, 'printf "t0836-drop "; sha256sum ')
  await page.waitForTimeout(300)
  await dropRealFiles(page, tabSel, [dropped.path])
  const typed = await lineWith(`/uploads/${SSH_TAB}/`)
  expect(typed).toContain(`'${sshHost.uploads}/${SSH_TAB}/`)
  expect(typed).toContain(`/${path.basename(dropped.path)}'`)
  await page.waitForTimeout(300)
  await write(page, SSH_TAB, '\r')
  const dropHash = await lineWith(`t0836-drop ${dropped.sha}`)
  const dropPath = /'([^']+)'/.exec(typed)![1]
  const s1 = await stagedFile(sshHost, dropPath)
  expect(s1.file).toBe(`600 ${dropped.size} ${dropped.sha}`)
  out.push(`drop → typed ${typed.slice(typed.indexOf("'")).replace(new RegExp(escapeRe(NAME_MARK)), '<mark>')} (single-quoted, no Enter); sha256sum on the server = local (${dropHash.length > 0}); mode ${s1.file.split(' ')[0]}`)

  // Ctrl+V with an image on main's (stubbed) clipboard → uploaded, its path typed, no paste key
  await app.evaluate((_e, png) => { (globalThis as AnyApi).__t0836.clipboardPng = png }, PNG_1PX)
  try {
    await write(page, SSH_TAB, 'printf "t0836-paste "; sha256sum ')
    await page.waitForTimeout(300)
    await page.locator(`${tabSel} .xterm`).first().click()
    await page.keyboard.press('Control+v') // lowercase: 'V' would be key "V" (T0524 spec does the same)
    const pasted = await lineWith('.png').catch(async (err) => {
      const dir = path.join(userData, 'Logs')
      const lines = fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n').split('\n')
      const focus = await page.evaluate(() => `${document.activeElement?.tagName}.${(document.activeElement as HTMLElement | null)?.className ?? ''} hasFocus=${document.hasFocus()}`)
      const direct = await page.evaluate(async () => { try { const r = await (window as AnyApi).electronAPI.clipboard.readImageDataUrl(); return r ? `data-url ${String(r).length}` : String(r) } catch (e) { return `threw ${String((e as Error)?.message ?? e)}` } })
      log(`② paste diagnostics: direct readImageDataUrl → ${direct}; focus ${focus}; clipboard reads ${await app.evaluate(() => (globalThis as AnyApi).__t0836.clipboardReads)}; log ${JSON.stringify(lines.filter(l => /\[(terminal-paste|clipboard|upload-client)\]/.test(l)).slice(-12).map(l => l.slice(0, 260)))}; buffer tail ${JSON.stringify(stripAnsi(await buffer(page, SSH_TAB)).slice(-300))}`)
      throw err
    })
    expect(pasted).toContain(`${sshHost.uploads}/${SSH_TAB}/`)
    await page.waitForTimeout(300)
    await write(page, SSH_TAB, '\r')
    const pngSha = sha256(Buffer.from(PNG_1PX, 'base64'))
    await lineWith(`t0836-paste ${pngSha}`)
    const pngPath = /(\/\S+\.png)/.exec(pasted.replace(/'/g, ' '))![1]
    const s2 = await stagedFile(sshHost, pngPath)
    expect(s2.file).toBe(`600 ${Buffer.from(PNG_1PX, 'base64').length} ${pngSha}`)
    const debug = fs.readdirSync(path.join(userData, 'Logs')).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(userData, 'Logs', f), 'utf8')).join('\n')
    const pasteLog = debug.split('\n').filter(l => l.includes(`[terminal-paste] image upload terminal=${SSH_TAB}`)).at(-1) ?? ''
    expect(pasteLog).toMatch(/: ok size=\d+/)
    const reads = await app.evaluate(() => (globalThis as AnyApi).__t0836.clipboardReads)
    out.push(`Ctrl+V (clipboard image ${Buffer.from(PNG_1PX, 'base64').length} B, main-side stub, ${reads} reads) → typed "${pasted.slice(pasted.indexOf(sshHost.uploads) - 1)}"; sha256sum on the server = local; log "${pasteLog.replace(/^.*\[terminal-paste\]/, '[terminal-paste]')}"`)
  } finally {
    await app.evaluate(() => { (globalThis as AnyApi).__t0836.clipboardPng = null })
  }

  // ⏻ restart → still staged after the 10 s grace
  const shellPid = async (mark: string): Promise<string> => {
    await write(page, SSH_TAB, `echo ${mark}-$$\r`)
    let pid = ''
    const re = new RegExp(`^${mark}-(\\d+)$`, 'm')
    await expect.poll(async () => (pid = re.exec(stripAnsi(await buffer(page, SSH_TAB)).replace(/\r/g, ''))?.[1] ?? ''), { timeout: 30_000 }).not.toBe('')
    return pid
  }
  const pidBefore = await shellPid('t0836-pid-a')
  const stagedBefore = await stagedEntries(sshHost, SSH_TAB)
  expect(stagedBefore).not.toBe('absent')
  await page.locator('.workspace-container.active .terminal-wrapper.active button.action-btn.danger', { hasText: '⏻' }).first().click()
  const confirm = page.locator('.dialog-overlay .dialog-actions .dialog-btn.confirm')
  const confirmed = await confirm.first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false)
  if (confirmed) await confirm.first().click()
  await page.waitForTimeout(13_000)
  const afterRestart = await stagedEntries(sshHost, SSH_TAB)
  expect(afterRestart).toBe(stagedBefore)
  const pidAfter = await shellPid('t0836-pid-b')
  expect(pidAfter, 'the shell really restarted').not.toBe(pidBefore)
  out.push(`⏻ restart (confirm dialog ${confirmed ? 'answered' : 'not shown'}; shell pid ${pidBefore} → ${pidAfter}) → after 13 s the staging is unchanged (${afterRestart.split(' ').length} entries)`)

  // the tab closed → kept within the grace, gone after it
  const closedAt = Date.now()
  await closeActiveTab(page)
  await page.waitForTimeout(5_000)
  const within = await stagedEntries(sshHost, SSH_TAB)
  expect(within, 'still staged 5 s after closing (grace 10 s)').not.toBe('absent')
  await expect.poll(() => stagedEntries(sshHost, SSH_TAB), { timeout: 25_000, intervals: [500] }).toBe('absent')
  const goneAfter = Date.now() - closedAt
  expect(goneAfter).toBeGreaterThanOrEqual(10_000)
  const disposeLine = (await sshHost.log()).split('\n').find(l => l.includes(`[upload] dispose session=${SSH_TAB.slice(0, 8)}`)) ?? ''
  out.push(`tab closed → still staged at +5 s, gone at ~${(goneAfter / 1000).toFixed(1)} s; server log "${disposeLine.replace(/^.*\[upload\]/, '[upload]')}"`)
  results['②'] = `PASS — ${out.join(' | ')}`
})

test('③ Docker (no mounts) Claude panel: a local file is uploaded into the container, the prompt has the container path; closed → removed', async () => {
  test.setTimeout(240_000)
  const { app } = inst!
  const id = await startContainer(ports.docker, tokens.docker)
  log(`③ container ${CONTAINER}: ${id.slice(0, 12)}`)
  expect(id).toMatch(/^[0-9a-f]{64}$/)
  let fp = ''
  await expect.poll(async () => (fp = (await wsl(`docker exec ${CONTAINER} cat ${DOCKER_DATA}/server-cert.json 2>/dev/null | ${certFingerprintSed}`)).trim()), { timeout: 60_000, intervals: [1_000] }).toMatch(/^[0-9A-F:]{95}$/i)
  await expect.poll(async () => (await wsl(`ss -tlnH | grep -c "127.0.0.1:$1 "`, [String(ports.docker)])).trim(), { timeout: 30_000 }).not.toBe('0')
  const hostname = (await docker(['inspect', '-f', '{{.Config.Hostname}}', CONTAINER])).trim()
  const WS = 'e2e-t0836-dock', TAB = 'e2e-t0836-docker-shell'
  const page = await openRemoteWindow('e2e-t0836 Docker',
    { remoteHost: '127.0.0.1', remotePort: ports.docker, remoteToken: tokens.docker, remoteFingerprint: fp },
    { targetOS: 'docker-linux', dockerContainer: CONTAINER },
    { workspaces: [{ id: WS, folder: '/root' }], terminals: [{ id: TAB, ws: WS, title: 'T0836 Docker shell', cwd: '/root' }], active: WS, activeTab: TAB })
  const panel = await openClaudeTab(page)
  const panelSel = '.workspace-container.active .terminal-wrapper.active .claude-agent-panel'
  const file = writeFile(`t0836-docker-${NAME_MARK}.csv`, randomBytes(700 * 1024 + 5))
  const before = (await sends(app)).length
  await dropRealFiles(page, panelSel, [file.path])
  await expect(panel.locator('.claude-attachment-file')).toHaveCount(1, { timeout: 15_000 })
  await typeAndSend(panel, 't0836 docker file')
  await expect.poll(async () => (await sends(app)).length, { timeout: 60_000 }).toBe(before + 1)
  let call = (await sends(app)).at(-1)!
  await expect.poll(async () => { call = (await sends(app)).at(-1)!; return call.result !== undefined || call.error !== undefined }, { timeout: 60_000 }).toBe(true)
  const first = call.prompt.split('\n')[0]
  log(`③ prompt first line ${first.replace(new RegExp(escapeRe(NAME_MARK)), '<mark>')}; send ${call.error ? `error ${call.error}` : `result ${call.result}`}`)
  expect(first.startsWith(`@${DOCKER_DATA}/uploads/${call.sessionId}/`)).toBe(true)
  expect(first.endsWith(`/${path.basename(file.path)}`)).toBe(true)
  const s = await stagedFile(dockerHost, first.slice(1))
  expect(s.file).toBe(`600 ${file.size} ${file.sha}`)
  expect(s.dirs).toBe('700 700 700')
  await closeActiveTab(page)
  await expect.poll(() => stagedEntries(dockerHost, call.sessionId), { timeout: 20_000 }).toBe('absent')
  const dockerLog = await dockerHost.log()
  expect.soft(dockerLog.includes(NAME_MARK), 'a file name in the container server log').toBe(false)
  results['③'] = `PASS — docker-linux profile → ${CONTAINER} (hostname ${hostname}, no mounts): dropped ${file.size} B → prompt "@${DOCKER_DATA}/uploads/<session>/<id>/<name>", in the container ${s.file.slice(0, 24)}… dirs ${s.dirs} (= local sha256); tab closed → staging gone`
})
