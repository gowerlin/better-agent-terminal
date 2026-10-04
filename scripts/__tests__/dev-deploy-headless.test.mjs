// @vitest-environment node
// T0391 — scripts/dev-deploy-headless.mjs (PLAN-036 P0-D)

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_TAG,
  DEFAULT_WSL_INSTALL_ROOT,
  deployDir,
  inspectDir,
  loadBuildConfig,
  main,
  outputFileNames,
  parseArgs,
  parseBuildConfig,
  parseScriptOutput,
  planDeploy,
  planRollback,
  renderBashScript,
  rollbackDir,
  sha256,
  shq,
} from '../dev-deploy-headless.mjs'

const FILES = ['server-entry.js', 'headless-entry.js', 'lockfile.js', 'dataDir.js']

function makeInstallRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 't0391-root-'))
  mkdirSync(path.join(root, 'electron', 'remote'), { recursive: true })
  return root
}

function remote(root, name) {
  return path.join(root, 'electron', 'remote', name)
}

function snapshot(dir) {
  const out = {}
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else out[path.relative(dir, p)] = sha256(readFileSync(p))
    }
  }
  walk(dir)
  return out
}

describe('parseArgs', () => {
  it('defaults to dry-run with restart, default tag and default WSL install root', () => {
    const opts = parseArgs(['--target', 'wsl:Ubuntu-24.04'])
    expect(opts.target).toEqual({ kind: 'wsl', distro: 'Ubuntu-24.04' })
    expect(opts.yes).toBe(false)
    expect(opts.rollback).toBe(false)
    expect(opts.restart).toBe(true)
    expect(opts.tag).toBe(DEFAULT_TAG)
    expect(opts.installRoot).toBe(DEFAULT_WSL_INSTALL_ROOT)
  })

  it('parses all flags, --flag=value form and repeated --expect-string', () => {
    const opts = parseArgs([
      '--target=wsl:Debian',
      '--yes',
      '--no-restart',
      '--rollback',
      '--tag',
      't0391',
      '--install-root',
      '/opt/bat-server',
      '--expect-string',
      'MARKER_A',
      '--expect-string=MARKER B',
    ])
    expect(opts).toMatchObject({
      target: { kind: 'wsl', distro: 'Debian' },
      yes: true,
      restart: false,
      rollback: true,
      tag: 't0391',
      installRoot: '/opt/bat-server',
      expectStrings: ['MARKER_A', 'MARKER B'],
    })
  })

  it('resolves dir: targets to an absolute path and leaves installRoot null', () => {
    const opts = parseArgs(['--target', 'dir:some/rel/dir'])
    expect(opts.target.kind).toBe('dir')
    expect(path.isAbsolute(opts.target.path)).toBe(true)
    expect(opts.installRoot).toBeNull()
  })

  it.each(['Ubuntu 24.04', 'Ubuntu;rm -rf ~', '$(id)', 'a|b', '', 'Ubuntu`x`'])(
    'rejects distro %j outside the [A-Za-z0-9._-]+ whitelist',
    (distro) => {
      expect(() => parseArgs(['--target', `wsl:${distro}`])).toThrow(/distro/)
    }
  )

  it('rejects bad tags, bad install roots and misplaced --install-root', () => {
    expect(() => parseArgs(['--target', 'wsl:U', '--tag', 'a b'])).toThrow(/--tag/)
    expect(() => parseArgs(['--target', 'wsl:U', '--tag', '../x'])).toThrow(/--tag/)
    expect(() => parseArgs(['--target', 'wsl:U', '--install-root', 'relative/path'])).toThrow(/install-root/)
    expect(() => parseArgs(['--target', 'wsl:U', '--install-root', '~/a/../b'])).toThrow(/install-root/)
    expect(() => parseArgs(['--target', 'wsl:U', '--install-root', '/x;rm'])).toThrow(/install-root/)
    expect(() => parseArgs(['--target', 'dir:x', '--install-root', '/x'])).toThrow(/only applies to wsl/)
  })

  it('rejects missing target, unknown args and missing values', () => {
    expect(() => parseArgs([])).toThrow(/--target is required/)
    expect(() => parseArgs(['--target', 'ssh:host'])).toThrow(/Unsupported --target/)
    expect(() => parseArgs(['--target', 'wsl:U', '--force'])).toThrow(/Unknown argument/)
    expect(() => parseArgs(['--target'])).toThrow(/Missing value/)
    expect(() => parseArgs(['--target', 'wsl:U', '--tag', '--yes'])).toThrow(/Missing value for --tag/)
  })

  it('returns early for --help without requiring a target', () => {
    expect(parseArgs(['--help']).help).toBe(true)
  })
})

describe('build config parsed from build-server-bundle.mjs', () => {
  it('reads entryPoints / externals / esbuild options from the real build script', () => {
    const config = loadBuildConfig()
    expect(config.entryPoints).toEqual([
      'electron/remote/server-entry.ts',
      'electron/remote/headless-entry.ts',
      'electron/remote/lockfile.ts',
      'electron/remote/dataDir.ts',
    ])
    expect(outputFileNames(config.entryPoints)).toEqual(FILES)
    expect(config.options).toEqual({
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'cjs',
      sourcemap: 'inline',
    })
    // The hand-copied list in T0385 missed these; they must come from the script.
    for (const pkg of ['@kutalia/whisper-node-addon', '@img/sharp-linux-x64', '@lydell/node-pty-linux-x64']) {
      expect(config.externals).toContain(pkg)
    }
  })

  it('matches the externalPackages array in the build script exactly', () => {
    const source = readFileSync(fileURLToPath(new URL('../build-server-bundle.mjs', import.meta.url)), 'utf8')
    const block = source.slice(source.indexOf('const externalPackages'), source.indexOf(']', source.indexOf('const externalPackages')))
    const expected = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(loadBuildConfig().externals).toEqual(expected)
  })

  it('fails fast instead of falling back when the build script shape drifts', () => {
    const good = `
const externalPackages = ['a', "b"]
async function bundleServerEntry() {
  await build({
    entryPoints: [resolveProjectPath('electron', 'remote', 'x.ts')],
    bundle: true, platform: 'node', target: 'node24', format: 'cjs', sourcemap: 'inline',
    external: externalPackages,
  })
}`
    expect(parseBuildConfig(good)).toMatchObject({ entryPoints: ['electron/remote/x.ts'], externals: ['a', 'b'] })
    expect(() => parseBuildConfig(good.replace('const externalPackages', 'const ext'))).toThrow(/externalPackages/)
    expect(() => parseBuildConfig(good.replace('external: externalPackages', 'external: []'))).toThrow(/externalPackages/)
    expect(() => parseBuildConfig(good.replace("format: 'cjs', ", ''))).toThrow(/"format"/)
    expect(() => parseBuildConfig(good.replace('bundleServerEntry', 'other'))).toThrow(/bundleServerEntry/)
  })
})

describe('planning', () => {
  it('classifies overwrite / create / unchanged and backup intent', () => {
    const installed = new Map([
      ['a.js', { sha: 'old', backup: false }],
      ['b.js', { sha: 'same', backup: true }],
      ['c.js', { sha: 'old', backup: true }],
    ])
    const plan = planDeploy(
      [
        { name: 'a.js', sha: 'new' },
        { name: 'b.js', sha: 'same' },
        { name: 'c.js', sha: 'new' },
        { name: 'd.js', sha: 'new' },
      ],
      installed
    )
    expect(plan.map((p) => [p.name, p.action, p.backup])).toEqual([
      ['a.js', 'overwrite', 'create'],
      ['b.js', 'unchanged', 'keep-existing'],
      ['c.js', 'overwrite', 'keep-existing'],
      ['d.js', 'create', 'absent-marker'],
    ])
  })

  it('classifies rollback actions', () => {
    const installed = new Map([
      ['a.js', { sha: 'dev', backup: true, backupSha: 'orig', absent: false }],
      ['b.js', { sha: 'orig', backup: true, backupSha: 'orig', absent: false }],
      ['c.js', { sha: 'dev', backup: false, backupSha: null, absent: true }],
      ['d.js', { sha: 'x', backup: false, backupSha: null, absent: false }],
    ])
    expect(planRollback(['a.js', 'b.js', 'c.js', 'd.js'], installed).map((p) => p.action)).toEqual([
      'restore',
      'unchanged',
      'remove-created',
      'skip-no-backup',
    ])
  })

  it('parses FILE / EXPECT lines from the bash script output', () => {
    const out = 'DEST /x\nFILE\ta.js\tabc\tMISSING\tno\nFILE\tb.js\tMISSING\tMISSING\tyes\nEXPECT\ta.js\tM\t2\nIS_ACTIVE active\n'
    const parsed = parseScriptOutput(out)
    expect(parsed.files.get('a.js')).toEqual({ sha: 'abc', backup: false, backupSha: null, absent: false })
    expect(parsed.files.get('b.js')).toEqual({ sha: null, backup: false, backupSha: null, absent: true })
    expect(parsed.expects).toEqual([{ name: 'a.js', marker: 'M', count: 2 }])
    expect(parsed.other).toEqual(['DEST /x', 'IS_ACTIVE active'])
  })
})

describe('dir: target (local fs)', () => {
  let root
  let staging

  beforeEach(() => {
    root = makeInstallRoot()
    staging = mkdtempSync(path.join(tmpdir(), 't0391-staging-'))
    for (const name of ['a.js', 'b.js']) writeFileSync(path.join(staging, name), `new ${name}`)
    writeFileSync(remote(root, 'a.js'), 'orig a.js')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    rmSync(staging, { recursive: true, force: true })
  })

  it('backs up once, keeps the first backup on redeploy, and rolls back', () => {
    deployDir(root, staging, ['a.js', 'b.js'], 'dev')
    expect(readFileSync(remote(root, 'a.js'), 'utf8')).toBe('new a.js')
    expect(readFileSync(remote(root, 'a.js.bak-dev'), 'utf8')).toBe('orig a.js')
    expect(existsSync(remote(root, 'b.js.bak-dev.absent'))).toBe(true)

    writeFileSync(path.join(staging, 'a.js'), 'newer a.js')
    deployDir(root, staging, ['a.js', 'b.js'], 'dev')
    expect(readFileSync(remote(root, 'a.js.bak-dev'), 'utf8')).toBe('orig a.js')
    // b.js did not exist originally: a redeploy must not back up the dev copy
    expect(existsSync(remote(root, 'b.js.bak-dev'))).toBe(false)

    expect(rollbackDir(root, ['a.js', 'b.js'], 'dev')).toEqual(['RESTORED a.js', 'REMOVED b.js'])
    expect(readFileSync(remote(root, 'a.js'), 'utf8')).toBe('orig a.js')
    expect(existsSync(remote(root, 'b.js'))).toBe(false)
    expect(inspectDir(root, ['a.js'], 'dev').files.get('a.js')).toMatchObject({ backup: true, absent: false })
  })

  it('refuses a missing install root', () => {
    expect(() => inspectDir(path.join(root, 'nope'), ['a.js'], 'dev')).toThrow(/install root missing/)
  })
})

describe('main() dry-run never writes', () => {
  let root
  let logSpy

  beforeEach(() => {
    root = makeInstallRoot()
    for (const name of FILES) writeFileSync(remote(root, name), `orig ${name}`)
    writeFileSync(remote(root, 'server-entry.js.bak-dev'), 'orig server-entry.js')
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    rmSync(root, { recursive: true, force: true })
  })

  it('deploy dry-run builds into staging but leaves the install root untouched', async () => {
    const before = snapshot(root)
    expect(await main(['--target', `dir:${root}`])).toBe(0)
    expect(snapshot(root)).toEqual(before)
    const output = logSpy.mock.calls.flat().join('\n')
    expect(output).toMatch(/DRY-RUN/)
    expect(output).toMatch(/server-entry\.js\s+built=[0-9a-f]{12} installed=[0-9a-f]{12} action=overwrite backup=keep-existing/)
  }, 120_000)

  it('rollback dry-run leaves the install root untouched', async () => {
    const before = snapshot(root)
    expect(await main(['--target', `dir:${root}`, '--rollback'])).toBe(0)
    expect(snapshot(root)).toEqual(before)
  })
})

describe('renderBashScript (WSL target)', () => {
  const base = { installRoot: '~/.local/bat-server', stagingDir: '/mnt/d/x', files: FILES, tag: 'dev', restart: true, expectStrings: [] }

  it('inspect mode is read-only', () => {
    const script = renderBashScript('inspect', base)
    expect(script).not.toMatch(/\bcp\b|\brm\b|systemctl|: >/)
    expect(script).toContain(`ROOT="$HOME"/'.local/bat-server'`)
  })

  it('deploy mode never overwrites an existing backup and restarts only when asked', () => {
    const script = renderBashScript('deploy', base)
    expect(script).toContain('if [ ! -e "$DEST/$f.bak-$TAG" ] && [ ! -e "$DEST/$f.bak-$TAG.absent" ]; then')
    expect(script).toContain('cp -p "$DEST/$f" "$DEST/$f.bak-$TAG"')
    expect(script).toContain('systemctl --user restart bat-server')
    expect(renderBashScript('deploy', { ...base, restart: false })).not.toContain('systemctl')
  })

  it('single-quotes untrusted values', () => {
    expect(shq(`it's $(id)`)).toBe(`'it'\\''s $(id)'`)
    const script = renderBashScript('deploy', { ...base, expectStrings: [`$(touch /tmp/pwn)'`] })
    expect(script).toContain(`-- '$(touch /tmp/pwn)'\\'''`)
  })

  it('rejects unsafe tags / file names', () => {
    expect(() => renderBashScript('deploy', { ...base, tag: 'a;b' })).toThrow(/tag/)
    expect(() => renderBashScript('deploy', { ...base, files: ['a b.js'] })).toThrow(/file name/)
  })

  // Execute the generated script for real with a local POSIX bash. On Windows
  // only Git Bash is used (explicit path) — never PATH `bash`, which may be WSL.
  const localBash =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'].find((p) => existsSync(p))
      : ['/bin/bash', '/usr/bin/bash'].find((p) => existsSync(p))

  it.skipIf(!localBash)('deploy + rollback round-trip through the generated script', () => {
    const root = makeInstallRoot()
    const staging = mkdtempSync(path.join(tmpdir(), 't0391-staging-'))
    const scripts = mkdtempSync(path.join(tmpdir(), 't0391-sh-'))
    const posix = (p) => p.replace(/\\/g, '/')
    try {
      writeFileSync(remote(root, 'a.js'), 'orig a.js')
      writeFileSync(path.join(staging, 'a.js'), 'new a.js MARKER')
      writeFileSync(path.join(staging, 'b.js'), 'new b.js')
      const opts = { installRoot: posix(root), stagingDir: posix(staging), files: ['a.js', 'b.js'], tag: 't0391', restart: false, expectStrings: ['MARKER'] }
      const run = (mode) => {
        const file = path.join(scripts, `${mode}.sh`)
        writeFileSync(file, renderBashScript(mode, opts))
        return parseScriptOutput(execFileSync(localBash, [posix(file)], { encoding: 'utf8', timeout: 30_000 }))
      }

      const before = snapshot(root)
      expect(run('inspect').files.get('a.js').sha).toBe(sha256(Buffer.from('orig a.js')))
      expect(snapshot(root)).toEqual(before)

      run('deploy')
      writeFileSync(path.join(staging, 'a.js'), 'new a.js MARKER v2')
      const deployed = run('deploy')
      expect(existsSync(remote(root, 'b.js.bak-t0391'))).toBe(false)
      expect(deployed.files.get('a.js')).toMatchObject({ sha: sha256(Buffer.from('new a.js MARKER v2')), backupSha: sha256(Buffer.from('orig a.js')) })
      expect(deployed.files.get('b.js')).toMatchObject({ absent: true })
      expect(deployed.expects).toEqual([
        { name: 'a.js', marker: 'MARKER', count: 1 },
        { name: 'b.js', marker: 'MARKER', count: 0 },
      ])

      const rolled = run('rollback')
      expect(rolled.other).toEqual(expect.arrayContaining(['RESTORED a.js', 'REMOVED b.js']))
      expect(readFileSync(remote(root, 'a.js'), 'utf8')).toBe('orig a.js')
      expect(existsSync(remote(root, 'b.js'))).toBe(false)
    } finally {
      for (const d of [root, staging, scripts]) rmSync(d, { recursive: true, force: true })
    }
  })
})
