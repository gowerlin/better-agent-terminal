/**
 * T0552 (BUG-139): clean overwrite install of a server bundle (WSL
 * `installBundle` and the SSH upload share the script). The path rules are
 * unit-tested; the script itself runs under a real POSIX `sh` + `tar` (Git Bash
 * on Windows, skipped when neither is on PATH) against a temp directory.
 */
import { execFileSync, spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BUNDLE_OLD_SUFFIX,
  BUNDLE_STAGE_SUFFIX,
  assertBundleInstallRoot,
  buildSshBundleInstallCommand,
  buildWslBundleInstallScript,
} from '../server-bundle-install-script'

describe('assertBundleInstallRoot (T0552)', () => {
  it.each([
    ['/home/gower/.local/bat-server', '/home/gower/.local/bat-server'],
    ['/home/gower/.local/bat-server/', '/home/gower/.local/bat-server'],
    ['/opt/bat', '/opt/bat'],
    ['/home/a b/bat-server', '/home/a b/bat-server'],
  ])('accepts %p', (input, expected) => {
    expect(assertBundleInstallRoot(input)).toBe(expected)
  })

  it.each([
    '', '/', '//', '~', '~/.local/bat-server', 'relative/bat-server', '/opt', '/opt/',
    '/home//bat', '/home/./bat', '/home/gower/../root', "/home/it's/bat", '/home/x/"bat"',
    '/home/x/$HOME', '/home/x/`id`', '/home/x\\bat', '/home/x/bat\nrm', null, 42,
  ])('rejects %p', (input) => {
    expect(() => assertBundleInstallRoot(input)).toThrow(/install path/)
  })
})

describe('install script text (T0552)', () => {
  it('only ever deletes the root and its two whitelisted siblings', () => {
    const script = buildWslBundleInstallScript()
    const removals = script.split('\n').flatMap((line) => line.match(/rm -rf -- [^;|&]+/g) ?? [])
    const targets = new Set(removals.flatMap((rm) => rm.replace('rm -rf -- ', '').trim().split(/\s+/)))
    expect([...targets].sort()).toEqual(['"$old"', '"$stage"'])
    expect(script).toContain(`stage="$dst${BUNDLE_STAGE_SUFFIX}"`)
    expect(script).toContain(`old="$dst${BUNDLE_OLD_SUFFIX}"`)
  })

  it('WSL reads root / tarball from argv, SSH quotes the root and reads stdin', () => {
    expect(buildWslBundleInstallScript().split('\n').slice(0, 2)).toEqual(['dst="$1"', 'tarball="$2"'])
    expect(buildWslBundleInstallScript()).toContain('tar -xzf "$tarball" -C "$target" --strip-components=1')
    const ssh = buildSshBundleInstallCommand('/home/bat/.local/bat-server')
    expect(ssh.split('\n')[0]).toBe("dst='/home/bat/.local/bat-server'")
    expect(ssh).toContain('tar xz -C "$target" --strip-components=1')
  })
})

// ---------------------------------------------------------------------------
// Real shell
// ---------------------------------------------------------------------------

function hasPosixShell(): boolean {
  const probe = spawnSync('sh', ['-c', 'tar --version >/dev/null 2>&1 && echo ok'], { encoding: 'utf8', windowsHide: true })
  return probe.status === 0 && probe.stdout.trim() === 'ok'
}

/** Git Bash (MSYS) sees `C:\x\y` as `/c/x/y`. */
function shPath(p: string): string {
  if (process.platform !== 'win32') return p
  return p.replace(/^([A-Za-z]):/, (_m, drive: string) => `/${drive.toLowerCase()}`).replace(/\\/g, '/')
}

const shellAvailable = hasPosixShell()

describe.skipIf(!shellAvailable)('install script under a real sh (T0552 / BUG-139)', () => {
  let base: string
  let parent: string
  let root: string
  let dataDir: string

  function write(file: string, content: string, mode?: number): void {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
    if (mode !== undefined) fs.chmodSync(file, mode)
  }

  /** Tarball with a single top-level `staging/` like build-server-bundle.mjs. */
  function makeBundle(name: string, files: Record<string, string>, withLauncher = true): string {
    const src = path.join(base, `src-${name}`)
    if (withLauncher) write(path.join(src, 'staging', 'bin', 'bat-server'), '#!/bin/sh\necho new\n', 0o755)
    for (const [rel, content] of Object.entries(files)) write(path.join(src, 'staging', rel), content)
    const tarball = path.join(base, `${name}.tar.gz`)
    execFileSync('sh', ['-c', 'cd "$1" && chmod +x staging/bin/bat-server 2>/dev/null; tar -czf "$2" staging', 'sh', shPath(src), shPath(tarball)], { windowsHide: true })
    return tarball
  }

  function runWsl(tarball: string, installRoot = root, env: NodeJS.ProcessEnv = {}) {
    return spawnSync('sh', ['-c', buildWslBundleInstallScript(), 'sh', shPath(installRoot), shPath(tarball)], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...env },
    })
  }

  function listTree(dir: string): string[] {
    const out: string[] = []
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) walk(full)
        else out.push(path.relative(dir, full).replace(/\\/g, '/'))
      }
    }
    walk(dir)
    return out.sort()
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0552-'))
    parent = path.join(base, 'home', '.local')
    root = path.join(parent, 'bat-server')
    dataDir = path.join(base, 'home', '.local', 'share', 'bat-server')
    write(path.join(dataDir, 'server-cert.json'), '{"cert":1}')
    write(path.join(dataDir, 'server-token.json'), '{"token":"t"}')
    write(path.join(parent, 'bat-server.bak-0.5.9-pre.4-t0550', 'bin', 'bat-server'), 'backup', 0o755)
  })

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true })
  })

  it('upgrade: the root ends up equal to the new bundle; data dir and backups untouched', () => {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'node_modules', '@anthropic-ai', 'claude-agent-sdk-linux-x64', 'claude'), 'stale sdk')
    write(path.join(root, 'node_modules', 'better-sqlite3', 'index.js'), 'stale')
    write(path.join(root, 'handlers', 'old.js'), 'pre-T0388 layout')
    const tarball = makeBundle('new', { 'node_modules/ws/index.js': 'ws', 'scripts/bat-notify.mjs': 'n', 'package.json': '{}' })

    const result = runWsl(tarball)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('server bundle install: replaced')
    expect(listTree(root)).toEqual(['bin/bat-server', 'node_modules/ws/index.js', 'package.json', 'scripts/bat-notify.mjs'])
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toContain('echo new')
    expect(listTree(dataDir)).toEqual(['server-cert.json', 'server-token.json'])
    expect(fs.existsSync(path.join(parent, 'bat-server.bak-0.5.9-pre.4-t0550', 'bin', 'bat-server'))).toBe(true)
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
  })

  it('fresh install: creates the root', () => {
    const result = runWsl(makeBundle('fresh', { 'package.json': '{}' }))
    expect(result.status, result.stderr).toBe(0)
    expect(listTree(root)).toEqual(['bin/bat-server', 'package.json'])
  })

  it('pre-T0511 layout (staging/bin/bat-server) is replaced as well', () => {
    write(path.join(root, 'staging', 'bin', 'bat-server'), 'old', 0o755)
    const result = runWsl(makeBundle('legacy', {}))
    expect(result.status, result.stderr).toBe(0)
    expect(listTree(root)).toEqual(['bin/bat-server'])
  })

  it('a broken tarball fails and leaves the old install untouched', () => {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'node_modules', 'keep', 'x.js'), 'x')
    const broken = path.join(base, 'broken.tar.gz')
    fs.writeFileSync(broken, 'not a tarball')
    const result = runWsl(broken)
    expect(result.status).not.toBe(0)
    expect(listTree(root)).toEqual(['bin/bat-server', 'node_modules/keep/x.js'])
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
  })

  it('a bundle without bin/bat-server fails and leaves the old install untouched', () => {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    const result = runWsl(makeBundle('nolauncher', { 'package.json': '{}' }, false))
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('bin/bat-server missing after extract')
    expect(listTree(root)).toEqual(['bin/bat-server'])
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
  })

  it('a directory that is not a BAT install is extracted over, nothing deleted', () => {
    write(path.join(root, 'notes.txt'), 'mine')
    const result = runWsl(makeBundle('overlay', { 'package.json': '{}' }))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toContain('not a BAT server bundle install')
    expect(listTree(root)).toEqual(['bin/bat-server', 'notes.txt', 'package.json'])
  })

  it('refuses to replace $HOME', () => {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    const result = runWsl(makeBundle('home', {}), root, { HOME: shPath(root) })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('refusing to replace the home directory')
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')
  })

  it('SSH variant: same clean install with the tarball on stdin', () => {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'node_modules', 'sharp', 'index.js'), 'stale')
    const tarball = makeBundle('ssh', { 'node_modules/ws/index.js': 'ws' })
    const result = spawnSync('sh', ['-c', buildSshBundleInstallCommand(shPath(root))], {
      input: fs.readFileSync(tarball),
      encoding: 'utf8',
      windowsHide: true,
    })
    expect(result.status, result.stderr).toBe(0)
    expect(listTree(root)).toEqual(['bin/bat-server', 'node_modules/ws/index.js'])
  })
})
