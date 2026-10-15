// @vitest-environment node
/**
 * T0556: the nvm loader block the node recipe appends to the bash login profile, run under real
 * shells (Git Bash `sh` / `bash` / `dash` on Windows, the system ones elsewhere; skipped when there
 * is no `sh`) against a temp $HOME with a fake nvm. Covers which file gets the block, appending only
 * once, `sh -lc` / `bash -lc` / `bash -lic` finding nvm's node with nvm loaded once, and a missing,
 * broken or noisy nvm leaving a login unchanged.
 */
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NVM_PROFILE_COMMAND, NVM_PROFILE_MARKER_BEGIN, NVM_PROFILE_MARKER_END, NVM_PROFILE_SNIPPET_LINES } from '../recipes'

/** Git Bash (MSYS) sees `C:\x\y` as `/c/x/y`. */
function shPath(p: string): string {
  if (process.platform !== 'win32') return p
  return p.replace(/^([A-Za-z]):/, (_m, drive: string) => `/${drive.toLowerCase()}`).replace(/\\/g, '/')
}

function has(shell: string): boolean {
  const probe = spawnSync('sh', ['-c', `command -v ${shell} >/dev/null 2>&1 && echo ok`], { encoding: 'utf8', windowsHide: true })
  return probe.status === 0 && probe.stdout.trim() === 'ok'
}

const shAvailable = has('sh') && has('grep')
const bashAvailable = shAvailable && has('bash')
const dashAvailable = shAvailable && has('dash')

const FAKE_NODE_DIR = '.nvm/versions/node/v24.0.0/bin'
/** Ubuntu's stock ~/.profile sources ~/.bashrc for bash (trimmed to that part). */
const UBUNTU_PROFILE = 'if [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n\t. "$HOME/.bashrc"\n    fi\nfi\n'
/** Ubuntu's ~/.bashrc stops early for non-interactive shells; nvm's install.sh appended its loader after that. */
const UBUNTU_BASHRC = 'case $- in\n    *i*) ;;\n      *) return;;\nesac\n\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"  # This loads nvm\n'
const BASH_PROFILE_SOURCING_BASHRC = '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"\n'

describe.skipIf(!shAvailable)('nvm login profile block under real shells (T0556)', () => {
  let home: string

  function write(rel: string, content: string, mode?: number): void {
    const file = path.join(home, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
    if (mode !== undefined) fs.chmodSync(file, mode)
  }

  function read(rel: string): string {
    return fs.readFileSync(path.join(home, rel), 'utf8')
  }

  function exists(rel: string): boolean {
    return fs.existsSync(path.join(home, rel))
  }

  /** A fake nvm: `nvm` function, its node on PATH, a load counter and some output to swallow. */
  function installFakeNvm(): void {
    write(`${FAKE_NODE_DIR}/node`, '#!/bin/sh\necho fake-node\n', 0o755)
    write('.nvm/nvm.sh', [
      'nvm() { :; }',
      'echo loaded >> "$HOME/load.log"',
      `PATH="$NVM_DIR/versions/node/v24.0.0/bin:$PATH"`,
      'echo "nvm noise on stdout"',
      'echo "nvm noise on stderr" >&2',
      '',
    ].join('\n'))
  }

  function env(): NodeJS.ProcessEnv {
    const e: NodeJS.ProcessEnv = { ...process.env, HOME: shPath(home) }
    for (const key of ['NVM_DIR', 'ENV', 'BASH_ENV', 'PROFILE']) delete e[key]
    return e
  }

  /** `<shell> <flags> <script>` started through sh, so PATH lookup is the POSIX one (Git Bash, not WSL bash.exe). */
  function login(shell: string, flags: string, script: string) {
    const result = spawnSync('sh', ['-c', 'exec "$@"', 'sh', shell, flags, script], {
      encoding: 'utf8', windowsHide: true, env: env(), cwd: home, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
  }

  function append() {
    return spawnSync('sh', ['-c', NVM_PROFILE_COMMAND], { encoding: 'utf8', windowsHide: true, env: env(), cwd: home })
  }

  function loads(): number {
    if (!exists('load.log')) return 0
    const count = read('load.log').split('\n').filter(Boolean).length
    fs.rmSync(path.join(home, 'load.log'))
    return count
  }

  function blocks(text: string): number {
    return text.split(NVM_PROFILE_MARKER_BEGIN).length - 1
  }

  const BLOCK = `\n${NVM_PROFILE_SNIPPET_LINES.join('\n')}\n`

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0556-'))
  })

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true })
  })

  describe('target file and idempotency', () => {
    it('no profile file at all: creates ~/.profile with the block; a second run changes nothing', () => {
      const first = append()
      expect(first.status).toBe(0)
      expect(first.stdout).toContain('nvm loader for login shells added to')
      expect(read('.profile')).toBe(BLOCK)
      expect(exists('.bash_profile') || exists('.bash_login')).toBe(false)

      const second = append()
      expect(second.status).toBe(0)
      expect(second.stdout).toContain('nvm loader for login shells already in')
      expect(read('.profile')).toBe(BLOCK)
    })

    it('only ~/.profile: appended after the existing content, which is left as is', () => {
      write('.profile', UBUNTU_PROFILE)
      expect(append().status).toBe(0)
      expect(read('.profile')).toBe(UBUNTU_PROFILE + BLOCK)
      for (let i = 0; i < 3; i++) expect(append().status).toBe(0)
      expect(blocks(read('.profile'))).toBe(1)
      expect(read('.profile')).toBe(UBUNTU_PROFILE + BLOCK)
    })

    it('a profile without a trailing newline still gets the block on lines of its own', () => {
      write('.profile', 'export FOO=1')
      expect(append().status).toBe(0)
      expect(read('.profile')).toBe(`export FOO=1${BLOCK}`)
    })

    it.each([
      [['.bash_profile', '.bash_login', '.profile'], '.bash_profile'],
      [['.bash_profile', '.profile'], '.bash_profile'],
      [['.bash_login', '.profile'], '.bash_login'],
      [['.bash_profile', '.bash_login'], '.bash_profile'],
      [['.bash_login'], '.bash_login'],
    ])('existing %j: the block goes to %s (the file bash reads), the others stay untouched', (files, target) => {
      for (const f of files) write(f, `# ${f}\n`)
      expect(append().status).toBe(0)
      expect(append().status).toBe(0)
      for (const f of files) {
        expect(read(f)).toBe(f === target ? `# ${f}\n${BLOCK}` : `# ${f}\n`)
      }
      if (!files.includes('.profile')) expect(exists('.profile')).toBe(false)
    })

    it('a block someone edited keeps its begin marker and is not appended again', () => {
      write('.profile', `${NVM_PROFILE_MARKER_BEGIN}\n# edited by hand\n${NVM_PROFILE_MARKER_END}\n`)
      const before = read('.profile')
      expect(append().stdout).toContain('already in')
      expect(read('.profile')).toBe(before)
    })
  })

  describe('login shells find nvm\'s node', () => {
    beforeEach(() => {
      installFakeNvm()
      write('.bashrc', UBUNTU_BASHRC)
    })

    it.skipIf(!bashAvailable)('before the block, bash -lc misses nvm (the T0555 gap this closes)', () => {
      write('.profile', UBUNTU_PROFILE)
      const r = login('bash', '-lc', 'command -v node || echo node-not-found')
      expect(r.stdout).not.toContain(FAKE_NODE_DIR)
      expect(loads()).toBe(0)
    })

    it('~/.profile layout: sh -lc finds the node, nvm loaded once, its output swallowed', () => {
      write('.profile', UBUNTU_PROFILE)
      expect(append().status).toBe(0)
      const r = login('sh', '-lc', 'command -v node')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(`${r.stdout}${r.stderr}`).not.toContain('nvm noise')
      expect(loads()).toBe(1)
    })

    it.skipIf(!dashAvailable)('~/.profile layout: dash -lc finds the node', () => {
      write('.profile', UBUNTU_PROFILE)
      expect(append().status).toBe(0)
      const r = login('dash', '-lc', 'command -v node')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(loads()).toBe(1)
    })

    it.skipIf(!bashAvailable)('~/.profile layout: bash -lc finds it; bash -lic loads nvm once (from ~/.bashrc, the block skips)', () => {
      write('.profile', UBUNTU_PROFILE)
      expect(append().status).toBe(0)
      const lc = login('bash', '-lc', 'command -v node')
      expect(lc.status).toBe(0)
      expect(lc.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(`${lc.stdout}${lc.stderr}`).not.toContain('nvm noise')
      expect(loads()).toBe(1)

      const lic = login('bash', '-lic', 'command -v node')
      expect(lic.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(loads()).toBe(1)
    })

    it('an `nvm` program on PATH (nvm-windows seen from Git Bash / WSL interop) is not a loaded nvm', () => {
      write('fakebin/nvm', '#!/bin/sh\necho not-nvm-sh\n', 0o755)
      write('.profile', `PATH="$HOME/fakebin:$PATH"\n${UBUNTU_PROFILE}`)
      expect(append().status).toBe(0)
      const r = login('sh', '-lc', 'command -v nvm; command -v node')
      expect(r.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(loads()).toBe(1)
    })

    it.skipIf(!bashAvailable)('~/.bash_profile layout: the block lands there; bash -lc / bash -lic find the node, loaded once', () => {
      write('.bash_profile', BASH_PROFILE_SOURCING_BASHRC)
      write('.profile', UBUNTU_PROFILE)
      expect(append().status).toBe(0)
      expect(blocks(read('.bash_profile'))).toBe(1)
      expect(read('.profile')).toBe(UBUNTU_PROFILE)

      const lc = login('bash', '-lc', 'command -v node')
      expect(lc.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(loads()).toBe(1)
      const lic = login('bash', '-lic', 'command -v node')
      expect(lic.stdout).toContain(`${FAKE_NODE_DIR}/node`)
      expect(loads()).toBe(1)
    })
  })

  describe('no nvm, or a broken one: a login behaves as without the block', () => {
    const shells = (['sh', ...(bashAvailable ? ['bash'] : []), ...(dashAvailable ? ['dash'] : [])])

    /** Same login with and without the block; /etc/profile noise (Git Bash under dash) cancels out. */
    function compare(shell: string) {
      write('.profile', UBUNTU_PROFILE)
      const without = login(shell, '-lc', 'echo login-ok')
      expect(append().status).toBe(0)
      const withBlock = login(shell, '-lc', 'echo login-ok')
      expect(withBlock).toEqual(without)
      expect(withBlock.status).toBe(0)
      expect(withBlock.stdout).toContain('login-ok')
    }

    it.each(shells)('%s -lc: no ~/.nvm at all', (shell) => {
      compare(shell)
    })

    it.each(shells)('%s -lc: an empty nvm.sh', (shell) => {
      write('.nvm/nvm.sh', '')
      compare(shell)
    })

    it.each(shells)('%s -lc: nvm.sh with a syntax error (would end a plain `.` in sh / dash)', (shell) => {
      write('.nvm/nvm.sh', 'nvm() {\n  if then\n')
      compare(shell)
      expect(exists('load.log')).toBe(false)
    })
  })
})
