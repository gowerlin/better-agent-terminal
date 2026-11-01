// T0763 (D210): the remote ⚠️ / `?` acceptance T0748 did not cover — SSH, Docker, a real network cut
// (the server keeps running) and a remote Worker that asks its remote Tower. Every remote is a
// test-only headless bat-server built from this tree (T0748's way: the installed WSL bundle copied
// read only, this tree's headless JS + helpers laid over it), all under /tmp/bat-e2e-t0763 in WSL.
// OPT-IN: skipped unless BAT_E2E_T0763=1.
//
//   npx vite build
//   $env:BAT_E2E_T0763='1'
//   npx playwright test e2e/t0763-remote-waiting-acceptance.spec.ts
//
// Needs: Windows host, WSL distro (default Ubuntu-24.04, BAT_E2E_T0763_DISTRO) already running with
// an installed bat-server bundle (~/.local/bat-server) and a Docker engine, the local image
// debian:bookworm-slim (BAT_E2E_T0763_BASE_IMAGE; never pulled), Go on PATH, Windows OpenSSH, and
// the Ubuntu archive reachable from WSL (`apt-get download`, no root, nothing installed).
//
//   ① SSH     WSL has no sshd: `apt-get download openssh-server` into ROOT, `dpkg-deb -x`, run as the
//             user (own config / host key / authorized_keys in ROOT, random high port, 127.0.0.1
//             only, `UsePAM no`). An ssh-linux profile → BAT's SSH tunnel (ssh -N -L) → the test
//             server. Windows OpenSSH reads / writes the REAL ~/.ssh whatever HOME says, so the
//             isolated instance gets e2e/real-remote/t0763-ssh-shim.go first on ITS PATH: the real
//             ssh with `-F none -o UserKnownHostsFile=<temp> -o IdentitiesOnly=yes`; ~/.ssh is
//             hashed before / after and must not change. Shell tab OSC 7501 blocked → the row ⚠️;
//             looked at, then idle → cleared. sshd stopped → the window loses the connection (the
//             connection really went through the tunnel).
//   ② Docker  a `bat-e2e-t0763-server` container (debian:bookworm-slim, the same install mounted read
//             only, `--bind-interface all`, `-p 127.0.0.1:<P>:9876`) → a docker-linux profile → same
//             wait / answer as ①; the shell reports the container's hostname.
//   ③ cut     a wsl-linux profile pointed at a TCP relay on this machine (relay → the test server).
//             X waits, Y does not; both tabs change state while the relay is closed (`sleep 8;
//             printf OSC …`) → after the relay is back the window reconciles with the server (T0749):
//             X no longer waits (faded: not seen), Y waits ⚠️; same server pid, same shell pids.
//   ④ Worker  in the same window: a remote Tower shell tab dispatches `bat-terminal.mjs --agent codex
//             --skill ct-exec --workorder T9763` on the server; `codex` there is a fake on the test
//             server's PATH (answers `--version` 0.166.0, then becomes an interactive bash). The
//             Worker `bat-notify --ask` (question on stdin) → the Worker label `?` here; the Tower
//             `--answer` → `?` cleared; the Worker waits for the user (OSC) → ⚠️ label and row;
//             looked at + idle → cleared; `--close-worker`. The question text never reaches a log.
//
// User environment (asserted in afterAll): WSL home / installed bundle / systemd units / the user's
// bat-server MainPID / tagged processes / ROOT, Docker containers not named bat-e2e-t0763-* (id,
// status, start time, restarts), the image list, and Windows ~/.ssh (names, sizes, mtimes, content
// hashes) — the same before and after. Every WSL process the test starts carries T0763_E2E_TAG;
// the container carries label bat.t0763=1; all removed after. No model request (no agent runs).

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAIN_BUNDLE, REPO_ROOT, closeIsolated, freePort, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_T0763 === '1'
const log = testLogger('t0763')
const DISTRO = process.env.BAT_E2E_T0763_DISTRO || 'Ubuntu-24.04'
const BASE_IMAGE = process.env.BAT_E2E_T0763_BASE_IMAGE || 'debian:bookworm-slim'
const ROOT = '/tmp/bat-e2e-t0763'
const TAG = 'T0763_E2E_TAG=bat-e2e-t0763'
const PREFIX = 'bat-e2e-t0763-'
const CONTAINER = `${PREFIX}server`
const LABEL = 'bat.t0763=1'
const REAL_SSH = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
const REAL_SSH_KEYGEN = 'C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe'
const WORKORDER = 'T9763'
const QUESTION_MARK = 'T0763-QTEXT-5e2c' // in the question only: must never reach a log
const INPUT_TIP = /codex 等待輸入|codex needs input|codex 等待输入/
const OSC = (state: string) => `printf '\\033]7501;state=${state}:app=codex\\007'; echo t0763-osc-${state}\r`
const OSC_LATE = (state: string) => `sleep 8; printf '\\033]7501;state=${state}:app=codex\\007'; echo t0763-osc-late-${state}\r`

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
echo "## pids"; ps -eo pid=,comm= | awk '{print $1":"$2}' | tr '\\n' ' '; echo
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

/** Copies the installed bundle (read only) to ROOT/install, lays this tree's headless JS + helpers over it, adds the fake codex. */
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
mkdir -p $R/fakebin $R/ssh/ws/a $R/ssh/ws/o $R/net/ws/x $R/net/ws/y $R/net/ws/o $R/net/ws/t $R/net/out
cp -a "$HOME/.local/bat-server" $R/install
cp "$W"/remote/*.js $R/install/electron/remote/
cp "$W"/scripts/* $R/install/scripts/
cat > $R/fakebin/codex <<'EOF'
#!/bin/bash
# T0763: a fake codex (no model). --version → a codex that writes OSC 7501; otherwise an interactive bash.
if [ "$1" = "--version" ]; then echo "codex-cli 0.166.0"; exit 0; fi
echo "t0763-fake-codex args=$#"
exec /bin/bash --norc --noprofile -i
EOF
chmod 755 $R/fakebin/codex
echo "installed version $(sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' $R/install/package.json)"`, [linuxOut], 180_000)
}

interface ServerArgs { name: string; port: number; token: string }

async function startServer(a: ServerArgs): Promise<string> {
  return wsl(`R=${ROOT}; D=$R/$1; mkdir -p $D/data $D/home; cd $D || exit 3
setsid nohup env -i HOME=$D/home PATH=$R/fakebin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SHELL=/bin/bash LANG=C.UTF-8 TERM=xterm-256color ${TAG} \\
  $R/install/bin/node $R/install/bin/bat-server.mjs --data-dir $D/data --port "$2" --bind-interface localhost --token "$3" >>$D/server.log 2>&1 </dev/null &
echo $! > $D/server.pid
for i in $(seq 1 60); do ss -tlnH | grep -q "127.0.0.1:$2 " && { echo listening; exit 0; }; sleep 0.5; done
echo not-listening; tail -20 $D/server.log`, [a.name, String(a.port), a.token], 60_000)
}

async function stopServer(name: string): Promise<string> {
  return wsl(`D=${ROOT}/$1; [ -f $D/server.pid ] || { echo no-pid; exit 0; }
P=$(cat $D/server.pid); kill $P 2>/dev/null
for i in $(seq 1 40); do kill -0 $P 2>/dev/null || { echo stopped; exit 0; }; sleep 0.25; done
kill -9 $P 2>/dev/null; echo killed`, [name])
}

const certFingerprintSed = `sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p'`

async function serverFingerprint(name: string): Promise<string> {
  return (await wsl(`${certFingerprintSed} ${ROOT}/$1/data/server-cert.json`, [name])).trim()
}

/** openssh-server unpacked into ROOT/sshd (no root, nothing installed), keys + config, started as the user. */
async function startSshd(port: number, serverPort: number, authorizedKey: string): Promise<string> {
  return wsl(`set -e; R=${ROOT}; S=$R/sshd; mkdir -p $S/pkg $S/root; cd $S/pkg
apt-get download openssh-server >/dev/null 2>&1 || { echo DOWNLOAD-FAILED; exit 3; }
dpkg-deb -x openssh-server_*.deb $S/root
echo "package $(ls openssh-server_*.deb)"
ssh-keygen -q -t ed25519 -N '' -C t0763-host -f $S/host_ed25519
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

/**
 * The listener and every per-connection sshd it forked (the connection lives in the child). sshd's
 * setproctitle overwrites its environ, so the tag cannot find it: match the executable under ROOT.
 */
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
  const id = (await docker(['run', '-d', '--name', CONTAINER, '--label', LABEL,
    '-p', `127.0.0.1:${port}:9876`, '-v', `${ROOT}/install:/opt/bat-server:ro`,
    '-e', 'LANG=C.UTF-8', '-e', 'TERM=xterm-256color', '-e', 'SHELL=/bin/bash', '-e', 'HOME=/root',
    '--entrypoint', '/opt/bat-server/bin/node', BASE_IMAGE,
    '/opt/bat-server/bin/bat-server.mjs', '--data-dir', '/var/lib/bat-e2e-t0763', '--port', '9876', '--bind-interface', 'all', '--token', token], 120_000)).trim()
  return id
}

async function removeContainer(): Promise<string> {
  const names = (await docker(['ps', '-a', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.Names}} {{.Label "bat.t0763"}}'])).trim()
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
P=$(tagged); echo "tagged before: $(echo $P | wc -w) ($(for p in $P; do cat /proc/$p/comm 2>/dev/null; done | sort | uniq -c | tr -s ' ' | tr '\\n' ','))"
[ -n "$P" ] && kill $P 2>/dev/null; sleep 1
P=$(tagged); [ -n "$P" ] && { echo "SIGKILL $(echo $P | wc -w)"; kill -9 $P 2>/dev/null; sleep 0.5; }
echo "tagged after: $(tagged | wc -w)"
underRoot() { for d in /proc/[0-9]*; do case "$(readlink $d/exe 2>/dev/null)" in "$R"/*) echo \${d#/proc/};; esac; done; }
P=$(underRoot); [ -n "$P" ] && { echo "running from ${ROOT} (untagged): $(echo $P | wc -w), SIGKILL"; kill -9 $P 2>/dev/null; sleep 0.5; }
echo "running from ${ROOT} after: $(underRoot | wc -w)"
rm -rf $R && echo "removed ${ROOT}"`)
}

// ── TCP relay on this machine (③) ───────────────────────────────────────────

interface Relay { port: number; cut(): Promise<number>; resume(): Promise<void>; close(): Promise<void>; accepted: number }

async function startRelay(target: number): Promise<Relay> {
  const port = await freePort()
  const sockets = new Set<net.Socket>()
  let server: net.Server | null = null
  const relay: Relay = {
    port,
    accepted: 0,
    async cut() {
      const n = sockets.size
      const s = server
      server = null
      for (const sock of sockets) sock.destroy()
      sockets.clear()
      if (s) await new Promise<void>(resolve => s.close(() => resolve()))
      return n
    },
    async resume() {
      const s = net.createServer(client => {
        relay.accepted++
        const upstream = net.connect(target, '127.0.0.1')
        sockets.add(client)
        sockets.add(upstream)
        const end = () => { client.destroy(); upstream.destroy(); sockets.delete(client); sockets.delete(upstream) }
        client.on('error', end).on('close', end)
        upstream.on('error', end).on('close', end)
        client.pipe(upstream)
        upstream.pipe(client)
      })
      await new Promise<void>((resolve, reject) => { s.once('error', reject); s.listen(port, '127.0.0.1', () => resolve()) })
      server = s
    },
    async close() { await relay.cut() },
  }
  await relay.resume()
  return relay
}

// ── UI ───────────────────────────────────────────────────────────────────────

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rowOf = (win: Page, name: string): Locator => win.locator('.workspace-item', { hasText: name }) // no name here is a prefix of another
const badgeOf = (win: Page, name: string): Locator => rowOf(win, name).locator('.workspace-waiting-badge')
const thumbOf = (win: Page, title: string): Locator => win.locator('.workspace-container.active .thumbnail')
  .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })
const workerThumb = (win: Page, workorder: string): Locator => win.locator(`.workspace-container.active .thumbnail[data-workorder="${workorder}"]`)

async function selectWorkspace(win: Page, name: string): Promise<void> {
  await rowOf(win, name).locator('.workspace-folder').click()
  await expect(rowOf(win, name)).toHaveClass(/\bactive\b/)
}

async function focusWindow(app: ElectronApplication, page: Page): Promise<boolean> {
  const url = page.url()
  await app.evaluate(({ BrowserWindow }, u) => {
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL() === u)
    w?.show()
    w?.focus()
  }, url)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  return page.evaluate(() => document.hasFocus())
}

const buffer = async (page: Page, id: string) => ((await page.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''
const write = (page: Page, id: string, data: string) => page.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
const connectedOf = (page: Page) => page.evaluate(async () => ((await (window as AnyApi).electronAPI.remote.clientStatus()) as { connected: boolean }).connected)

/** Runs `echo <mark> <expr>` in the tab and returns the first line starting with the mark. */
async function probe(page: Page, id: string, mark: string, expr: string, timeout = 20_000): Promise<string> {
  await write(page, id, `echo "${mark} ${expr}"\r`)
  let line = ''
  const re = new RegExp(`^${escapeRe(mark)} (?!\\$|\\S*\\$\\().*$`, 'm')
  await expect.poll(async () => (line = re.exec(stripAnsi(await buffer(page, id)).replace(/\r/g, ''))?.[0] ?? ''), { timeout }).not.toBe('')
  return line
}

interface Seed { workspaces: Array<{ id: string; folder: string }>; terminals: Array<{ id: string; ws: string; title: string; cwd: string }>; active: string; activeTab: string }

let inst: IsolatedInstance | undefined
let tmp = ''
let before = ''
let sshBefore = ''
let sshUser = ''
let relay: Relay | undefined
const results: Record<string, string> = {}
const ports = { ssh: 0, net: 0, sshd: 0, docker: 0 }
const tokens = { ssh: '', net: '', docker: '' }
let keyPath = ''
let shimLog = ''

/** Profile → its own window, seeded with the workspaces / tabs, connected again after the reload. */
async function openRemoteWindow(name: string, create: Record<string, unknown>, update: Record<string, unknown>, seed: Seed): Promise<{ page: Page; profileId: string }> {
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
  await expect(rowOf(page, seed.active)).toHaveClass(/\bactive\b/, { timeout: 30_000 })
  return { page, profileId }
}

/**
 * The wait every scenario checks: the tab's OSC 7501 `blocked` → server `input` → its workspace row
 * ⚠️ (another workspace selected); looked at in the focused window, then `idle` → cleared.
 */
async function waitThenAnswer(tag: string, page: Page, serverLog: () => Promise<string>, ws: string, other: string, tab: string, title: string): Promise<string> {
  const waitLog = async (re: RegExp, what: string) => {
    try {
      await expect.poll(async () => re.test(await serverLog()), { timeout: 30_000, intervals: [1_000] }).toBe(true)
    } catch (error) {
      log(`${tag} ${what}: not seen. server log tail:\n${(await serverLog()).split('\n').slice(-30).map(l => l.slice(0, 300)).join('\n')}`)
      throw error
    }
  }
  await selectWorkspace(page, other)
  const badge = badgeOf(page, ws)
  await expect(badge).toHaveCount(0)
  await write(page, tab, OSC('blocked'))
  await waitLog(new RegExp(`${escapeRe(tab)}.*→ blocked reason=input \\(osc\\)`), 'blocked on the server')
  await expect(badge).toHaveText('⚠️', { timeout: 15_000 })
  await expect(badge).toHaveAttribute('data-waiting', 'waiting')
  await expect(badge).toHaveAttribute('data-waiting-target', tab)
  const tip = (await badge.getAttribute('title')) ?? ''
  expect(tip).toContain(title)
  expect(tip).toMatch(INPUT_TIP)
  await page.screenshot({ path: test.info().outputPath(`${tag}-row-waiting.png`) })
  const focused = await focusWindow(inst!.app, page)
  await selectWorkspace(page, ws)
  await thumbOf(page, title).click()
  await expect(thumbOf(page, title).locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 10_000 })
  await write(page, tab, OSC('idle'))
  await waitLog(new RegExp(`${escapeRe(tab)}.*→ cleared \\(osc idle\\)`), 'cleared on the server')
  if (focused) {
    await expect(badge).toHaveCount(0, { timeout: 15_000 })
    await expect(thumbOf(page, title).locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
    return `row ⚠️ (target ${tab}, tooltip "${title}" + input reason) → looked at (focused window) → idle → row and tab cleared`
  }
  await expect(badge).not.toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
  test.info().annotations.push({ type: 'skip-step', description: `${tag}: window focus unavailable, "cleared once looked at" not checked` })
  return `row ⚠️ (target ${tab}) → idle → no longer waiting (no OS focus: "looked at" not checked)`
}

test.skip(!ENABLED, 'opt-in: set BAT_E2E_T0763=1 (T0763)')
test.skip(process.platform !== 'win32', 'Windows host with WSL only')
test.skip(!fs.existsSync(MAIN_BUNDLE), 'dist-electron/ missing — run `npx vite build` first')
test.skip(process.platform === 'win32' && ENABLED && !distroRunning(), `WSL distro ${DISTRO} is not running (this test never starts it)`)

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(600_000)
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0763-'))
  before = await wsl(USER_STATE)
  sshBefore = windowsSshState()
  log(`WSL before: ${before.replace(/^## pids\n.*$/m, '## pids <list>').replace(/\n/g, ' | ')}`)
  log(`Windows ~/.ssh before: ${sshBefore}`)
  expect(section(before, 'root'), `${ROOT} already exists: a previous run did not clean up`).toBe('absent')
  expect(section(before, 'own-containers'), `leftover ${PREFIX}* containers`).toBe('0')
  expect((await docker(['images', '-q', BASE_IMAGE])).trim(), `${BASE_IMAGE} is not on the engine (never pulled by this test)`).toMatch(/^[0-9a-f]{12}/)
  expect(fs.existsSync(REAL_SSH), `${REAL_SSH} missing`).toBe(true)

  const installed = await buildAndInstall(tmp)
  log(`install: ${installed.replace(/\n/g, ' | ')}`)
  expect(installed).toContain('installed version')
  sshUser = (await wsl('id -un')).trim()

  // the ssh shim + the test's client key (Windows side, temp dir only)
  const shimDir = path.join(tmp, 'shim-bin')
  fs.mkdirSync(shimDir, { recursive: true })
  execFileSync('go', ['build', '-o', path.join(shimDir, 'ssh.exe'), path.join(REPO_ROOT, 'e2e', 'real-remote', 't0763-ssh-shim.go')], { encoding: 'utf8', timeout: 300_000, windowsHide: true })
  keyPath = path.join(tmp, 'client_ed25519')
  execFileSync(REAL_SSH_KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 't0763-client', '-f', keyPath], { timeout: 30_000, windowsHide: true })
  shimLog = path.join(tmp, 'ssh-shim.log')

  for (const k of ['ssh', 'net', 'docker'] as const) tokens[k] = `t0763-${k}-${randomBytes(18).toString('base64url')}`
  ports.ssh = await freePort()
  ports.net = await freePort()
  ports.sshd = await freePort()
  ports.docker = await freePort()
  for (const name of ['ssh', 'net'] as const) {
    const started = await startServer({ name, port: ports[name], token: tokens[name] })
    log(`server ${name} on 127.0.0.1:${ports[name]}: ${started.trim().replace(/\n/g, ' | ')}`)
    expect(started).toContain('listening')
  }
  const sshd = await startSshd(ports.sshd, ports.ssh, fs.readFileSync(`${keyPath}.pub`, 'utf8').trim())
  log(`sshd on 127.0.0.1:${ports.sshd}: ${sshd.trim().replace(/\n/g, ' | ')}`)
  expect(sshd).toContain('listening')

  inst = await launchIsolated('t0763', log, {
    env: {
      Path: `${shimDir};${process.env.PATH ?? process.env.Path ?? ''}`,
      T0763_SSH_REAL: REAL_SSH,
      T0763_SSH_KNOWN_HOSTS: path.join(tmp, 'known_hosts').split(path.sep).join('/'),
      T0763_SSH_LOG: shimLog,
    },
  })
  await expect.poll(async () => (await inst!.win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
})

test.afterAll(async () => {
  test.setTimeout(240_000)
  const userData = inst?.userData
  if (userData) {
    const logs = path.join(userData, 'Logs')
    const debug = fs.existsSync(logs) ? fs.readdirSync(logs).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(logs, f), 'utf8')).join('\n') : ''
    for (const t of Object.values(tokens)) if (t) expect.soft(debug.includes(t), 'a test token in the debug log').toBe(false)
    expect.soft(debug.includes(QUESTION_MARK), 'the question text in the debug log').toBe(false)
    expect.soft(/batcap\.[A-Za-z0-9_-]{16,}/.test(debug), 'a batcap token in the debug log').toBe(false)
  }
  if (inst) await closeIsolated(inst, log).catch(e => log(`closeIsolated: ${String(e)}`))
  if (relay) await relay.close()
  const shimEntries = fs.existsSync(shimLog) ? fs.readFileSync(shimLog, 'utf8').split(/\r?\n/).filter(Boolean) : []
  log(`ssh shim: ${shimEntries.length} log lines; known_hosts (temp) ${fs.existsSync(path.join(tmp, 'known_hosts')) ? 'written' : 'absent'}`)
  log(`WSL stop: ssh ${(await stopServer('ssh')).trim()}, net ${(await stopServer('net')).trim()}, sshd ${(await stopSshd()).trim()}`)
  log(`docker cleanup: ${await removeContainer()}`)
  log(`WSL cleanup: ${(await cleanupWsl()).trim().replace(/\n/g, ' | ')}`)
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  log(`Windows temp ${tmp} removed: ${!fs.existsSync(tmp)}`)

  const after = await wsl(USER_STATE)
  const sshAfter = windowsSshState()
  const beforePids = section(before, 'pids').split(' ').filter(Boolean)
  const afterPids = new Set(section(after, 'pids').split(' ').filter(Boolean))
  const gone = beforePids.filter(p => !afterPids.has(p) && !/:(ps|awk|bash|sh|tr|wslpath|sleep|cat|grep|sed|sort|ss|docker|\(udev-worker\)|SessionLeader|Relay\(\d+\))$/.test(p))
  const compare: Record<string, string> = {}
  for (const key of ['home', 'install', 'units', 'bat-units', 'bat-server', 'listeners', 'tagged', 'root', 'containers', 'container-count', 'own-containers', 'images']) {
    compare[key] = section(before, key) === section(after, key) ? 'same' : `before ${JSON.stringify(section(before, key))} after ${JSON.stringify(section(after, key))}`
  }
  compare['windows-ssh'] = sshBefore === sshAfter ? 'same' : `before ${sshBefore} after ${sshAfter}`
  log(`user environment after: ${JSON.stringify(compare)}; processes of before that are gone (short-lived tools excluded): ${JSON.stringify(gone)}`)
  log(`T0763 results: ${JSON.stringify(results, null, 2)}`)
  for (const key of ['home', 'install', 'units', 'bat-units', 'bat-server', 'tagged', 'root', 'containers', 'container-count', 'own-containers', 'images', 'windows-ssh']) expect(compare[key], key).toBe('same')
  expect(section(after, 'tagged')).toBe('0')
  expect(section(after, 'root')).toBe('absent')
  expect(section(after, 'own-containers')).toBe('0')
  const listeners = section(after, 'listeners').split(' ')
  for (const [name, port] of Object.entries(ports)) if (port) expect(listeners, `a listener left on the ${name} port ${port}`).not.toContain(`127.0.0.1:${port}`)
})

test('① SSH (temporary sshd in WSL): tunnel → remote tab waits → row ⚠️, looked at + answered → cleared; sshd gone → disconnected', async () => {
  test.setTimeout(240_000)
  const WS = 'e2e-t0763-ssh-a', OTHER = 'e2e-t0763-ssh-o', TAB = 'e2e-t0763-ssh-shell', TITLE = 'T0763 SSH shell'
  const fp = await serverFingerprint('ssh')
  expect(fp).toMatch(/^[0-9A-F:]{95}$/i)
  const { page } = await openRemoteWindow('e2e-t0763 SSH',
    { remoteHost: 'localhost', remotePort: ports.ssh, remoteToken: tokens.ssh, remoteFingerprint: fp },
    { targetOS: 'ssh-linux', sshHost: '127.0.0.1', sshUser, sshPort: ports.sshd, sshKeyPath: keyPath },
    {
      workspaces: [{ id: WS, folder: `${ROOT}/ssh/ws/a` }, { id: OTHER, folder: `${ROOT}/ssh/ws/o` }],
      terminals: [{ id: TAB, ws: WS, title: TITLE, cwd: `${ROOT}/ssh/ws/a` }, { id: `${TAB}-o`, ws: OTHER, title: 'T0763 SSH other', cwd: `${ROOT}/ssh/ws/o` }],
      active: WS, activeTab: TAB,
    })
  const where = await probe(page, TAB, 't0763-where', '$(uname -s) $PWD ${T0763_E2E_TAG:-untagged}')
  log(`① remote shell: ${where}`)
  expect(where).toBe(`t0763-where Linux ${ROOT}/ssh/ws/a bat-e2e-t0763`)

  // the connection is BAT's SSH tunnel: the shim saw `ssh … -N -L <local>:localhost:<server port> … -- <user>@127.0.0.1`
  const shim = fs.readFileSync(shimLog, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l) as { args: string[]; exit: number; pid?: number })
  const tunnel = shim.find(e => e.args.includes('-L') && e.exit === -1)
  log(`① ssh calls through the shim: ${JSON.stringify(shim.map(e => ({ args: e.args.join(' '), exit: e.exit })))}`)
  expect(tunnel, 'a running `ssh -L` started by BAT').toBeTruthy()
  const forward = tunnel!.args[tunnel!.args.indexOf('-L') + 1]
  expect(forward).toMatch(new RegExp(`^\\d+:localhost:${ports.ssh}$`))
  expect(tunnel!.args).toContain('StrictHostKeyChecking=accept-new')
  expect(tunnel!.args).toContain(`${sshUser}@127.0.0.1`)
  const sshdLog = (await wsl(`cat ${ROOT}/sshd/sshd.log`)).replace(/\r/g, '')
  expect(sshdLog).toMatch(/Accepted publickey for \S+ from 127\.0\.0\.1/)
  expect(fs.existsSync(path.join(tmp, 'known_hosts')), 'the host key went to the temp known_hosts').toBe(true)
  const serverLog = async () => (await wsl(`cat ${ROOT}/ssh/server.log 2>/dev/null`)).replace(/\r/g, '')

  results['①'] = `PASS — ssh-linux profile, BAT's tunnel ssh -N -L ${forward.replace(/^\d+/, '<local>')} through the temporary sshd (Accepted publickey); ` +
    await waitThenAnswer('1-ssh', page, serverLog, WS, OTHER, TAB, TITLE)

  // sshd stopped → the tunnel's ssh exits → the window is no longer connected
  log(`① sshd: ${(await stopSshd()).trim()}`)
  await expect.poll(() => connectedOf(page), { timeout: 60_000 }).toBe(false)
  results['①'] += '; sshd stopped → the window disconnected (the connection went through the tunnel)'
})

test('② Docker (bat-e2e-t0763-server container): remote tab waits → row ⚠️, looked at + answered → cleared', async () => {
  test.setTimeout(240_000)
  const WS = 'e2e-t0763-dock-a', OTHER = 'e2e-t0763-dock-o', TAB = 'e2e-t0763-docker-shell', TITLE = 'T0763 Docker shell'
  const id = await startContainer(ports.docker, tokens.docker)
  log(`② container ${CONTAINER}: ${id.slice(0, 12)}`)
  expect(id).toMatch(/^[0-9a-f]{64}$/)
  let fp = ''
  await expect.poll(async () => (fp = (await wsl(`docker exec ${CONTAINER} cat /var/lib/bat-e2e-t0763/server-cert.json 2>/dev/null | ${certFingerprintSed}`)).trim()), { timeout: 60_000, intervals: [1_000] }).toMatch(/^[0-9A-F:]{95}$/i)
  await expect.poll(async () => (await wsl(`ss -tlnH | grep -c "127.0.0.1:$1 "`, [String(ports.docker)])).trim(), { timeout: 30_000 }).not.toBe('0')
  const bindings = (await docker(['inspect', '-f', '{{json .HostConfig.PortBindings}}', CONTAINER])).trim()
  const hostname = (await docker(['inspect', '-f', '{{.Config.Hostname}}', CONTAINER])).trim()
  log(`② PortBindings ${bindings}; hostname ${hostname}`)
  expect(JSON.parse(bindings)).toEqual({ '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: String(ports.docker) }] })
  const { page } = await openRemoteWindow('e2e-t0763 Docker',
    { remoteHost: '127.0.0.1', remotePort: ports.docker, remoteToken: tokens.docker, remoteFingerprint: fp },
    { targetOS: 'docker-linux', dockerContainer: CONTAINER },
    {
      workspaces: [{ id: WS, folder: '/root' }, { id: OTHER, folder: '/tmp' }],
      terminals: [{ id: TAB, ws: WS, title: TITLE, cwd: '/root' }, { id: `${TAB}-o`, ws: OTHER, title: 'T0763 Docker other', cwd: '/tmp' }],
      active: WS, activeTab: TAB,
    })
  const where = await probe(page, TAB, 't0763-where', '$(uname -s) $(hostname) $PWD')
  log(`② remote shell: ${where}`)
  expect(where).toBe(`t0763-where Linux ${hostname} /root`)
  const serverLog = async () => (await docker(['logs', CONTAINER])).replace(/\r/g, '')
  results['②'] = `PASS — docker-linux profile → ${CONTAINER} (${BASE_IMAGE}, -p 127.0.0.1:<P>:9876, shell hostname = container ${hostname}); ` +
    await waitThenAnswer('2-docker', page, serverLog, WS, OTHER, TAB, TITLE)
})

test('③ network cut (server keeps running) + ④ remote Worker asks its remote Tower: ? / ⚠️ on this machine', async () => {
  test.setTimeout(420_000)
  const WS_X = 'e2e-t0763-net-x', WS_Y = 'e2e-t0763-net-y', WS_O = 'e2e-t0763-net-o', WS_T = 'e2e-t0763-net-t'
  const TAB_X = 'e2e-t0763-x-shell', TAB_Y = 'e2e-t0763-y-shell', TAB_O = 'e2e-t0763-o-shell', TOWER = 'e2e-t0763-tower-shell'
  const TITLE_X = 'T0763 X shell', TITLE_Y = 'T0763 Y shell', TITLE_TOWER = 'T0763 Tower'
  relay = await startRelay(ports.net)
  log(`③ relay 127.0.0.1:${relay.port} → 127.0.0.1:${ports.net}`)
  const fp = await serverFingerprint('net')
  const { page } = await openRemoteWindow('e2e-t0763 relay',
    { remoteHost: '127.0.0.1', remotePort: relay.port, remoteToken: tokens.net, remoteFingerprint: fp },
    { targetOS: 'wsl-linux', wslDistro: DISTRO },
    {
      workspaces: [
        { id: WS_X, folder: `${ROOT}/net/ws/x` }, { id: WS_Y, folder: `${ROOT}/net/ws/y` },
        { id: WS_O, folder: `${ROOT}/net/ws/o` }, { id: WS_T, folder: `${ROOT}/net/ws/t` },
      ],
      terminals: [
        { id: TAB_X, ws: WS_X, title: TITLE_X, cwd: `${ROOT}/net/ws/x` },
        { id: TAB_Y, ws: WS_Y, title: TITLE_Y, cwd: `${ROOT}/net/ws/y` },
        { id: TAB_O, ws: WS_O, title: 'T0763 O shell', cwd: `${ROOT}/net/ws/o` },
        { id: TOWER, ws: WS_T, title: TITLE_TOWER, cwd: `${ROOT}/net/ws/t` },
      ],
      active: WS_O, activeTab: TAB_O,
    })
  const serverLog = async () => (await wsl(`cat ${ROOT}/net/server.log 2>/dev/null`)).replace(/\r/g, '')
  const waitLog = async (re: RegExp, what: string, timeout = 30_000) => {
    try {
      await expect.poll(async () => re.test(await serverLog()), { timeout, intervals: [1_000] }).toBe(true)
    } catch (error) {
      log(`${what}: not seen. server log tail:\n${(await serverLog()).split('\n').slice(-40).map(l => l.slice(0, 300)).join('\n')}`)
      throw error
    }
  }
  const debugLog = () => {
    const dir = path.join(inst!.userData, 'Logs')
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  }
  // a tab's PTY starts when its workspace is first shown: show each one, wait for its prompt
  for (const [ws, tab] of [[WS_X, TAB_X], [WS_Y, TAB_Y], [WS_T, TOWER], [WS_O, TAB_O]]) {
    await selectWorkspace(page, ws)
    await expect.poll(async () => stripAnsi(await buffer(page, tab)).includes('$'), { timeout: 30_000, message: `${tab} prompt` }).toBe(true)
  }
  const where = await probe(page, TAB_O, 't0763-where', '$(uname -s) $PWD ${T0763_E2E_TAG:-untagged}')
  expect(where).toBe(`t0763-where Linux ${ROOT}/net/ws/o bat-e2e-t0763`)
  const shellPid = async (tab: string, mark: string) => (await probe(page, tab, mark, '$$')).split(' ')[1]
  const serverPid = async () => (await wsl(`cat ${ROOT}/net/server.pid`)).trim()

  // ── ③ X waits, Y does not; both change while the relay is closed ──
  const xBadge = badgeOf(page, WS_X)
  const yBadge = badgeOf(page, WS_Y)
  await write(page, TAB_X, OSC('blocked'))
  await waitLog(new RegExp(`${escapeRe(TAB_X)}.*→ blocked reason=input \\(osc\\)`), '③ X blocked')
  await expect(xBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
  await expect(yBadge).toHaveCount(0)
  const pids = { server: await serverPid(), x: await shellPid(TAB_X, 't0763-pid-x'), y: await shellPid(TAB_Y, 't0763-pid-y') }
  const logMark = (await serverLog()).length
  const reconcileBefore = debugLog().split('\n').filter(l => l.includes('[attention] reconnect reconcile')).length
  await write(page, TAB_X, OSC_LATE('idle'))
  await write(page, TAB_Y, OSC_LATE('blocked'))
  const cutAt = Date.now()
  const dropped = await relay.cut()
  log(`③ relay closed (${dropped} sockets destroyed); listener closed`)
  await expect.poll(() => connectedOf(page), { timeout: 30_000 }).toBe(false)
  const disconnectedAfter = Date.now() - cutAt
  // the state changes on the server while this window cannot hear them
  await expect.poll(async () => {
    const since = (await serverLog()).slice(logMark)
    return new RegExp(`${escapeRe(TAB_X)}.*→ cleared \\(osc idle\\)`).test(since) && new RegExp(`${escapeRe(TAB_Y)}.*→ blocked reason=input \\(osc\\)`).test(since)
  }, { timeout: 30_000, intervals: [1_000] }).toBe(true)
  const whileDown = { connected: await connectedOf(page), x: await xBadge.getAttribute('data-waiting').catch(() => null), y: await yBadge.count() }
  log(`③ while the relay is closed (disconnected after ${disconnectedAfter} ms): ${JSON.stringify(whileDown)}`)
  expect(whileDown).toEqual({ connected: false, x: 'waiting', y: 0 }) // no event reaches the window
  await page.screenshot({ path: test.info().outputPath('3-while-cut.png') })
  const downFor = Date.now() - cutAt
  await relay.resume()
  await expect.poll(() => connectedOf(page), { timeout: 90_000 }).toBe(true)
  const reconnectedAfter = Date.now() - cutAt
  await expect(yBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 30_000 })
  await expect(yBadge).toHaveAttribute('data-waiting-target', TAB_Y)
  await expect(xBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 30_000 }) // ended while not looked at (D203)
  let reconcile = ''
  await expect.poll(() => (reconcile = debugLog().split('\n').filter(l => l.includes('[attention] reconnect reconcile')).slice(reconcileBefore).at(-1) ?? ''), { timeout: 15_000 }).not.toBe('')
  reconcile = reconcile.replace(/^.*\[attention\]/, '[attention]')
  expect(reconcile).toMatch(/ gone=0 /)
  const pidsAfter = { server: await serverPid(), x: await shellPid(TAB_X, 't0763-pid-x2'), y: await shellPid(TAB_Y, 't0763-pid-y2') }
  log(`③ relay reopened after ${downFor} ms, reconnected ${reconnectedAfter} ms after the cut (relay accepted ${relay.accepted}); ${reconcile}; pids ${JSON.stringify(pids)} → ${JSON.stringify(pidsAfter)}`)
  expect(pidsAfter).toEqual(pids) // nothing restarted
  await page.screenshot({ path: test.info().outputPath('3-after-reconnect.png') })
  // answers: Y looked at + idle → cleared; X's faded ⚠️ looked at → cleared
  const focused = await focusWindow(inst!.app, page)
  await selectWorkspace(page, WS_Y)
  await thumbOf(page, TITLE_Y).click()
  await write(page, TAB_Y, OSC('idle'))
  await selectWorkspace(page, WS_X)
  await thumbOf(page, TITLE_X).click()
  if (focused) {
    await expect(yBadge).toHaveCount(0, { timeout: 15_000 })
    await expect(xBadge).toHaveCount(0, { timeout: 15_000 })
  } else {
    await expect(yBadge).not.toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
  }
  results['③'] = `PASS — relay closed (window disconnected in ${disconnectedAfter} ms); while down the server cleared X and blocked Y, the window still showed X ⚠️ / no Y; relay reopened → reconnected ${reconnectedAfter} ms after the cut → ${reconcile.replace(/^\[attention\] reconnect reconcile /, 'reconcile ')}: Y row ⚠️ (target ${TAB_Y}), X row faded (ended unseen); server pid and both shell pids unchanged${focused ? '; looked at → both cleared' : ' (no OS focus: looked-at clearing not checked)'}`

  // ── ④ the remote Tower dispatches a Worker; the Worker asks; the Tower answers ──
  await selectWorkspace(page, WS_T)
  await thumbOf(page, TITLE_TOWER).click()
  const OUT = `${ROOT}/net/out`
  const helper = (script: string) => `"\${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/${script}"`
  const outFile = async (name: string) => {
    let text = ''
    await expect.poll(async () => /(^|\n)exit=\d+/.test(text = (await wsl(`cat ${OUT}/$1 2>/dev/null`, [name])).replace(/\r/g, '')), { timeout: 60_000, intervals: [500] }).toBe(true)
    return text
  }
  await write(page, TOWER, `${helper('bat-terminal.mjs')} --set-role tower > ${OUT}/role.txt 2>&1; echo "exit=$?" >> ${OUT}/role.txt\r`)
  const role = await outFile('role.txt')
  log(`④ --set-role tower: ${JSON.stringify(role)}`)
  expect(role).toMatch(/exit=0/)
  await write(page, TOWER, `${helper('bat-terminal.mjs')} --notify-id "$BAT_TERMINAL_ID" --workspace ${WS_T} --agent codex --skill ct-exec --workorder ${WORKORDER} > ${OUT}/dispatch.txt 2>&1; echo "exit=$?" >> ${OUT}/dispatch.txt\r`)
  const dispatched = await outFile('dispatch.txt')
  log(`④ dispatch: ${JSON.stringify(dispatched)}`)
  expect(dispatched).toMatch(/exit=0/)
  const worker = /Terminal created: (\S+)/.exec(dispatched)?.[1]
  expect(worker).toBeTruthy()
  const wThumb = workerThumb(page, WORKORDER)
  await expect(wThumb).toHaveCount(1, { timeout: 30_000 })
  await expect.poll(async () => stripAnsi(await buffer(page, worker!)).includes('t0763-fake-codex'), { timeout: 30_000, message: 'the fake codex in the Worker tab' }).toBe(true)
  const wEnv = await probe(page, worker!, 't0763-worker', '$BAT_TOWER_TERMINAL_ID ${BAT_REMOTE_TOKEN:+token-set} $(uname -s) ${T0763_E2E_TAG:-untagged}')
  log(`④ Worker ${worker}: ${wEnv}; thumbnail title ${JSON.stringify(await wThumb.locator('.thumbnail-title > span').first().textContent())}`)
  expect(wEnv).toBe(`t0763-worker ${TOWER} token-set Linux bat-e2e-t0763`)
  const wBadge = wThumb.locator('.worker-badge')

  // Worker → --ask (question on stdin only) → `?` here
  const question = JSON.stringify({ question: `${QUESTION_MARK} which environment?`, options: ['staging', 'prod'], allowFreeText: true, blocking: true })
  await write(page, worker!, `printf '%s' '${question}' > ${OUT}/q.json && ${helper('bat-notify.mjs')} --ask --source ${WORKORDER} --target "$BAT_TOWER_TERMINAL_ID" --no-pty-write "${WORKORDER} question" < ${OUT}/q.json > ${OUT}/ask.txt 2>&1; echo "exit=$?" >> ${OUT}/ask.txt\r`)
  const asked = await outFile('ask.txt')
  log(`④ --ask: ${JSON.stringify(asked)}`)
  expect(asked).toMatch(/exit=0/)
  expect(asked).toContain('  notified: yes')
  const qid = /^ {2}question: (q-[0-9a-f]{8}-[0-9a-f]{16})$/m.exec(asked)?.[1]
  expect(qid).toBeTruthy()
  await expect(wBadge).toHaveText('?', { timeout: 15_000 })
  await expect(wBadge).toHaveAttribute('data-attention', 'question')
  const rowDuringQuestion = await badgeOf(page, WS_T).count()
  log(`④ while the question is open: Worker label "?" (data-attention question); ${WS_T} row waiting badges: ${rowDuringQuestion} (a tower question is not "waiting for the user", D200)`)
  await page.screenshot({ path: test.info().outputPath('4-worker-question.png') })

  // Tower → --answer (answer on stdin) → `?` cleared
  await write(page, TOWER, `printf 'staging please\\n' | ${helper('bat-terminal.mjs')} --answer ${qid} --notify-id "$BAT_TERMINAL_ID" --choice 1 > ${OUT}/answer.txt 2>&1; echo "exit=$?" >> ${OUT}/answer.txt\r`)
  const answered = await outFile('answer.txt')
  log(`④ --answer: ${JSON.stringify(answered)}`)
  expect(answered).toMatch(/exit=0/)
  expect(answered).toContain(`  answered: ${qid}`)
  await expect(wThumb.locator('.worker-badge[data-attention]')).toHaveCount(0, { timeout: 15_000 })
  await write(page, worker!, `${helper('bat-notify.mjs')} --wait-answer ${qid} --timeout-ms 5000 > ${OUT}/wait.txt 2>&1; echo "exit=$?" >> ${OUT}/wait.txt\r`)
  const waited = await outFile('wait.txt')
  const answer = JSON.parse(waited.split('\n').find(l => l.startsWith('{')) ?? '{}')
  log(`④ --wait-answer: status ${answer.status}, choice ${answer.answer?.choice}`)
  expect(answer).toMatchObject({ status: 'answered', answer: { choice: 1, text: 'staging please' } })

  // the Worker waits for the user (OSC 7501) → ⚠️ label, row ⚠️; looked at + idle → cleared
  await write(page, worker!, OSC('blocked'))
  await waitLog(new RegExp(`${escapeRe(worker!)}.*→ blocked reason=input \\(osc\\)`), '④ Worker blocked')
  await expect(wBadge).toHaveText('⚠️', { timeout: 15_000 })
  await expect(wBadge).toHaveAttribute('data-attention', 'blocked')
  await expect(wBadge).toHaveAttribute('data-blocked-reason', 'input')
  await selectWorkspace(page, WS_O)
  const tBadge = badgeOf(page, WS_T)
  await expect(tBadge).toHaveText('⚠️', { timeout: 15_000 })
  await expect(tBadge).toHaveAttribute('data-waiting-target', worker!)
  await page.screenshot({ path: test.info().outputPath('4-worker-waiting-row.png') })
  const focused4 = await focusWindow(inst!.app, page)
  await selectWorkspace(page, WS_T)
  await wThumb.click()
  await write(page, worker!, OSC('idle'))
  await waitLog(new RegExp(`${escapeRe(worker!)}.*→ cleared \\(osc idle\\)`), '④ Worker cleared')
  await expect(wThumb.locator('.worker-badge[data-attention="blocked"]')).toHaveCount(0, { timeout: 15_000 })
  if (focused4) await expect(tBadge).toHaveCount(0, { timeout: 15_000 })
  else await expect(tBadge).not.toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })

  // the Tower closes its Worker
  await thumbOf(page, TITLE_TOWER).click()
  await write(page, TOWER, `${helper('bat-terminal.mjs')} --close-worker ${WORKORDER} --notify-id "$BAT_TERMINAL_ID" > ${OUT}/close.txt 2>&1; echo "exit=$?" >> ${OUT}/close.txt\r`)
  const closed = await outFile('close.txt')
  log(`④ --close-worker: ${JSON.stringify(closed)}`)
  expect(closed).toMatch(/exit=0/)
  await expect(wThumb).toHaveCount(0, { timeout: 60_000 })

  // the question text never reached a log on the server (the server log, <dataDir>/Logs incl. bat-scripts.log)
  const holders = (await wsl(`grep -rl -- "$1" ${ROOT}/net 2>/dev/null | sed "s#^${ROOT}/##"`, [QUESTION_MARK])).trim().split('\n').filter(Boolean)
  log(`④ files under ${ROOT}/net holding the question text: ${JSON.stringify(holders)} (q.json = what the Worker typed; a shell history is no log)`)
  expect(holders.filter(f => /\.log$|\/Logs\//.test(f))).toEqual([])
  expect((await wsl(`ls ${ROOT}/net/data/Logs 2>/dev/null | tr '\n' ' '`)).trim(), 'the server wrote its logs where the check looks').not.toBe('')
  const slog = await serverLog()
  expect(slog).not.toContain(tokens.net)
  expect(slog).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
  results['④'] = `PASS — remote Tower (${TOWER}, --set-role tower exit 0) dispatched --agent codex --skill ct-exec --workorder ${WORKORDER} on the server (fake codex) → Worker tab here (BAT_TOWER_TERMINAL_ID = the Tower); Worker --ask (stdin) exit 0 → label "?" (row badges ${rowDuringQuestion}); Tower --answer exit 0 → "?" cleared, --wait-answer answered choice 1; Worker OSC blocked → label ⚠️ (input) + ${WS_T} row ⚠️ (target the Worker); looked at${focused4 ? '' : ' (no OS focus)'} + idle → cleared; --close-worker exit 0 → tab closed; question text in no server log`
})
