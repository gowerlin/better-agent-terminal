/**
 * T0552 (BUG-139): clean overwrite install of a server bundle (WSL
 * `installBundle` and the SSH upload share the script). The path rules are
 * unit-tested; the script itself runs under a real POSIX `sh` + `tar` (Git Bash
 * on Windows, skipped when neither is on PATH) against a temp directory.
 * T0554 (BUG-141): keep-previous, restore, cleanup and interrupted runs.
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
  buildSshBundleDiscardPreviousCommand,
  buildSshBundleInstallCommand,
  buildSshBundleRestoreCommand,
  buildWslBundleDiscardPreviousScript,
  buildWslBundleInstallScript,
  buildWslBundleRestoreScript,
  parseBundleInstallPrevious,
  parseBundleRestoreOutcome,
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

  // T0554: restore / cleanup share the whitelist (the current root is moved to
  // $stage before it is deleted, never removed by name) and the root checks.
  it.each([
    ['restore', buildWslBundleRestoreScript()],
    ['discard', buildWslBundleDiscardPreviousScript()],
    ['ssh install (keep)', buildSshBundleInstallCommand('/home/bat/.local/bat-server', { keepPrevious: true })],
    ['ssh restore', buildSshBundleRestoreCommand('/home/bat/.local/bat-server')],
    ['ssh discard', buildSshBundleDiscardPreviousCommand('/home/bat/.local/bat-server')],
  ])('T0554 %s only ever deletes the whitelisted siblings and refuses $HOME', (_name, script) => {
    const removals = script.split('\n').flatMap((line) => line.match(/rm -rf -- [^;|&]+/g) ?? [])
    expect(removals.length).toBeGreaterThan(0)
    const targets = new Set(removals.flatMap((rm) => rm.replace('rm -rf -- ', '').trim().split(/\s+/)))
    expect([...targets].every((target) => target === '"$old"' || target === '"$stage"')).toBe(true)
    expect(script).toContain(`stage="$dst${BUNDLE_STAGE_SUFFIX}"`)
    expect(script).toContain(`old="$dst${BUNDLE_OLD_SUFFIX}"`)
    expect(script).toContain('refusing to replace the home directory')
    expect(script).toContain('case "$dst" in /?*/?*)')
  })

  it('T0554: markers parse; anything else is null', () => {
    expect(parseBundleInstallPrevious('server bundle install: replaced /x\nBAT_BUNDLE_PREVIOUS=kept\n')).toBe('kept')
    expect(parseBundleInstallPrevious('BAT_BUNDLE_PREVIOUS=none\r\n')).toBe('none')
    expect(parseBundleInstallPrevious('BAT_BUNDLE_PREVIOUS=unmanaged')).toBe('unmanaged')
    expect(parseBundleInstallPrevious('BAT_BUNDLE_PREVIOUS=rm -rf')).toBeNull()
    expect(parseBundleInstallPrevious('')).toBeNull()
    expect(parseBundleRestoreOutcome('BAT_BUNDLE_RESTORE=restored\n')).toBe('restored')
    expect(parseBundleRestoreOutcome('BAT_BUNDLE_RESTORE=missing')).toBe('missing')
    expect(parseBundleRestoreOutcome('restored')).toBeNull()
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

  function runWsl(tarball: string, installRoot = root, env: NodeJS.ProcessEnv = {}, keep = false) {
    return spawnSync('sh', ['-c', buildWslBundleInstallScript(), 'sh', shPath(installRoot), shPath(tarball), ...(keep ? ['keep'] : [])], {
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

  // ── T0554 (BUG-141): keep-previous, restore, cleanup, interrupted runs ──

  function runScript(script: string, ...args: string[]) {
    return spawnSync('sh', ['-c', script, 'sh', ...args], { encoding: 'utf8', windowsHide: true })
  }

  function installOld(): void {
    write(path.join(root, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'node_modules', 'better-sqlite3', 'index.js'), 'old dep')
  }

  it('T0554 keep: the previous install stays at .bat-old, marker kept', () => {
    installOld()
    const result = runWsl(makeBundle('keep', { 'package.json': '{}' }), root, {}, true)
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleInstallPrevious(result.stdout)).toBe('kept')
    expect(listTree(root)).toEqual(['bin/bat-server', 'package.json'])
    expect(listTree(root + BUNDLE_OLD_SUFFIX)).toEqual(['bin/bat-server', 'node_modules/better-sqlite3/index.js'])
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
  })

  it('T0554 without keep: marker none and no .bat-old (pre-T0554 behaviour)', () => {
    installOld()
    const result = runWsl(makeBundle('nokeep', {}))
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleInstallPrevious(result.stdout)).toBe('none')
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
  })

  it('T0554 first install with keep: marker none, nothing kept', () => {
    const result = runWsl(makeBundle('first', {}), root, {}, true)
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleInstallPrevious(result.stdout)).toBe('none')
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
  })

  it('T0554 a non-BAT root is extracted over: marker unmanaged', () => {
    write(path.join(root, 'notes.txt'), 'mine')
    const result = runWsl(makeBundle('overlay2', {}), root, {}, true)
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleInstallPrevious(result.stdout)).toBe('unmanaged')
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
  })

  it('T0554 restore: the previous install is back, the new one gone, data dir untouched', () => {
    installOld()
    expect(runWsl(makeBundle('upgrade', { 'package.json': '{}' }), root, {}, true).status).toBe(0)
    const result = runScript(buildWslBundleRestoreScript(), shPath(root))
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleRestoreOutcome(result.stdout)).toBe('restored')
    expect(listTree(root)).toEqual(['bin/bat-server', 'node_modules/better-sqlite3/index.js'])
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
    expect(listTree(dataDir)).toEqual(['server-cert.json', 'server-token.json'])
    expect(fs.existsSync(path.join(parent, 'bat-server.bak-0.5.9-pre.4-t0550', 'bin', 'bat-server'))).toBe(true)
  })

  it('T0554 restore with nothing kept: missing, root unchanged', () => {
    installOld()
    const result = runScript(buildWslBundleRestoreScript(), shPath(root))
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleRestoreOutcome(result.stdout)).toBe('missing')
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')
  })

  it('T0554 restore refuses to replace a root that is not a BAT install', () => {
    write(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'notes.txt'), 'mine')
    const result = runScript(buildWslBundleRestoreScript(), shPath(root))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not a BAT server bundle install')
    expect(listTree(root)).toEqual(['notes.txt'])
    expect(listTree(root + BUNDLE_OLD_SUFFIX)).toEqual(['bin/bat-server'])
  })

  it('T0554 discard: removes .bat-old after a finished upgrade', () => {
    installOld()
    expect(runWsl(makeBundle('done', {}), root, {}, true).status).toBe(0)
    const result = runScript(buildWslBundleDiscardPreviousScript(), shPath(root))
    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
    expect(listTree(root)).toEqual(['bin/bat-server'])
  })

  it('T0554 discard and install refuse a .bat-old that holds something else (never deleted)', () => {
    installOld()
    write(path.join(root + BUNDLE_OLD_SUFFIX, 'mine.txt'), 'user data')
    const discard = runScript(buildWslBundleDiscardPreviousScript(), shPath(root))
    expect(discard.status).toBe(1)
    expect(discard.stderr).toContain('not a BAT server bundle install')
    const install = runWsl(makeBundle('blocked', {}), root, {}, true)
    expect(install.status).toBe(1)
    expect(listTree(root + BUNDLE_OLD_SUFFIX)).toEqual(['mine.txt'])
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')
  })

  it('T0554 BAT closed after a kept upgrade: the next install replaces the leftover .bat-old with the current root', () => {
    write(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'older', 0o755)
    write(path.join(root, 'bin', 'bat-server'), 'current', 0o755)
    const result = runWsl(makeBundle('again', {}), root, {}, true)
    expect(result.status, result.stderr).toBe(0)
    expect(parseBundleInstallPrevious(result.stdout)).toBe('kept')
    expect(fs.readFileSync(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'utf8')).toBe('current')
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toContain('echo new')
  })

  it('T0554 BAT closed between the two renames (no root, install only in .bat-old): recovered, never deleted', () => {
    write(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root + BUNDLE_STAGE_SUFFIX, 'partial'), 'x')
    const result = runWsl(makeBundle('recover', {}), root, {}, true)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('recovered')
    expect(parseBundleInstallPrevious(result.stdout)).toBe('kept')
    expect(fs.readFileSync(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'utf8')).toBe('old')
    expect(listTree(root)).toEqual(['bin/bat-server'])
    expect(fs.existsSync(root + BUNDLE_STAGE_SUFFIX)).toBe(false)
  })

  it('T0554 restore refuses $HOME as the root', () => {
    write(path.join(root + BUNDLE_OLD_SUFFIX, 'bin', 'bat-server'), 'old', 0o755)
    write(path.join(root, 'bin', 'bat-server'), 'new', 0o755)
    const result = spawnSync('sh', ['-c', buildWslBundleRestoreScript(), 'sh', shPath(root)], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, HOME: shPath(root) },
    })
    expect(result.status).toBe(2)
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('new')
  })

  it('T0554 SSH: keep on a stdin install; restore runs the after-restore command only when it restored', () => {
    installOld()
    const tarball = makeBundle('ssh-keep', {})
    const install = spawnSync('sh', ['-c', buildSshBundleInstallCommand(shPath(root), { keepPrevious: true })], {
      input: fs.readFileSync(tarball),
      encoding: 'utf8',
      windowsHide: true,
    })
    expect(install.status, install.stderr).toBe(0)
    expect(parseBundleInstallPrevious(install.stdout)).toBe('kept')

    const restore = runScript(buildSshBundleRestoreCommand(shPath(root), 'echo AFTER_RESTORE'))
    expect(restore.status, restore.stderr).toBe(0)
    expect(parseBundleRestoreOutcome(restore.stdout)).toBe('restored')
    expect(restore.stdout).toContain('AFTER_RESTORE')
    expect(fs.readFileSync(path.join(root, 'bin', 'bat-server'), 'utf8')).toBe('old')

    const again = runScript(buildSshBundleRestoreCommand(shPath(root), 'echo AFTER_RESTORE'))
    expect(again.status).toBe(0)
    expect(parseBundleRestoreOutcome(again.stdout)).toBe('missing')
    expect(again.stdout).not.toContain('AFTER_RESTORE')
  })

  it('T0554 SSH discard removes .bat-old', () => {
    installOld()
    expect(runWsl(makeBundle('ssh-discard', {}), root, {}, true).status).toBe(0)
    const result = runScript(buildSshBundleDiscardPreviousCommand(shPath(root)))
    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(root + BUNDLE_OLD_SUFFIX)).toBe(false)
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
