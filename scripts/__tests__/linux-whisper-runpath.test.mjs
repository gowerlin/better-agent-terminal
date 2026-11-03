// T0800 / BUG-204 — Linux packaged whisper addon: RUNPATH $ORIGIN set by the afterPack hook with patchelf
// (scripts/linux-whisper-runpath.cjs), checked again by scripts/verify-packaged-native.js (`whisper-runpath`).
//
// patchelf itself is replaced by a fake that rewrites the hand-made ELF (scripts/__tests__/_elf-fixture.mjs),
// so this runs on every host. The real patchelf run is covered by the desktop-build Linux job and the
// linux-acceptance W1 row (docs/agent-guide/linux-ci-acceptance.md).

import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { makeElfSharedObject, whisperLinuxFiles } from './_elf-fixture.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const {
  WHISPER_RUNPATH,
  readElfDynamic,
  readElfDynamicFile,
  isWhisperSharedObjectName,
  whisperSharedObjects,
  whisperLinuxDirs,
  whisperRunpathProblems,
  ensurePatchelf,
  patchWhisperRunpath,
  afterPackWhisperRunpath,
} = require('../linux-whisper-runpath.cjs')
const { verifyWhisperRunpath } = require('../verify-packaged-native.js')

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

function tmpDir() {
  const d = mkdtempSync(path.join(os.tmpdir(), 'bat-t0800-'))
  dirs.push(d)
  return d
}

function linuxDir(resources, arch = 'x64') {
  return path.join(resources, 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', `linux-${arch}`)
}

/** A packaged resources dir with the whisper linux set (runpath per file) plus js/ and a text file. */
function makeResources(runpath = '/home/runner/work/whisper-node-addon/whisper-node-addon/deps/whisper.cpp/build/Release') {
  const resources = tmpDir()
  const dir = linuxDir(resources)
  mkdirSync(dir, { recursive: true })
  for (const [name, buf] of Object.entries(whisperLinuxFiles(runpath))) writeFileSync(path.join(dir, name), buf)
  writeFileSync(path.join(dir, 'README.txt'), 'not an ELF')
  mkdirSync(path.join(path.dirname(dir), 'js'), { recursive: true })
  return { resources, dir }
}

/** Fake patchelf: `--version`, and `--set-rpath <p> <file>` rewriting the file in place (same inode). */
function fakePatchelf({ missing = false, ignoreSetRpath = false, version = 'patchelf 0.18.0\n' } = {}) {
  const calls = []
  const execFileSync = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    if (missing) throw Object.assign(new Error(`spawnSync ${cmd} ENOENT`), { code: 'ENOENT' })
    if (args[0] === '--version') return version
    if (args[0] === '--set-rpath') {
      if (ignoreSetRpath) return ''
      const file = args[2]
      const dyn = readElfDynamic(readFileSync(file))
      writeFileSync(file, makeElfSharedObject({ needed: dyn.needed, soname: dyn.soname, runpath: args[1] }))
      return ''
    }
    throw new Error(`unexpected patchelf args ${args.join(' ')}`)
  }
  return { calls, execFileSync }
}

describe('readElfDynamic', () => {
  it('reads NEEDED / SONAME / RUNPATH / RPATH from 64- and 32-bit, little- and big-endian ELF', () => {
    for (const is64 of [true, false]) {
      for (const littleEndian of [true, false]) {
        const buf = makeElfSharedObject({ needed: ['libwhisper.so.1', 'libc.so.6'], soname: 'x.so', runpath: '$ORIGIN', rpath: '/opt/x', is64, littleEndian })
        expect(readElfDynamic(buf)).toEqual({ needed: ['libwhisper.so.1', 'libc.so.6'], soname: 'x.so', runpath: '$ORIGIN', rpath: '/opt/x' })
      }
    }
  })

  it('absent entries are null; no PT_DYNAMIC → empty result; not ELF → null', () => {
    expect(readElfDynamic(makeElfSharedObject({ needed: ['libc.so.6'] }))).toEqual({ needed: ['libc.so.6'], soname: null, runpath: null, rpath: null })
    expect(readElfDynamic(makeElfSharedObject({ dynamic: false }))).toEqual({ needed: [], soname: null, runpath: null, rpath: null })
    expect(readElfDynamic(Buffer.from('#!/bin/sh\necho hi\n'))).toBeNull()
    expect(readElfDynamic(Buffer.alloc(0))).toBeNull()
  })

  it('a truncated ELF throws instead of reading past the end', () => {
    const buf = makeElfSharedObject({ needed: ['libc.so.6'], runpath: '$ORIGIN' })
    expect(() => readElfDynamic(buf.subarray(0, 100))).toThrow(/truncated/)
  })

  it('reads the upstream v1.1.0 linux-x64 binaries as shipped in node_modules (BUG-204 evidence)', () => {
    const dir = path.join(ROOT, 'node_modules', '@kutalia', 'whisper-node-addon', 'dist', 'linux-x64')
    if (!existsSync(path.join(dir, 'whisper.node'))) return // package not installed on this host
    const addon = readElfDynamicFile(path.join(dir, 'whisper.node'))
    expect(addon.needed).toContain('libwhisper.so.1')
    expect(readElfDynamicFile(path.join(dir, 'libwhisper.so.1')).soname).toBe('libwhisper.so.1')
  })
})

describe('whisperSharedObjects / whisperLinuxDirs', () => {
  it('whisper.node and lib*.so[.N…] ELF files only, sorted; tools, text and look-alike names are skipped', () => {
    expect(['whisper.node', 'libggml.so', 'libwhisper.so.1', 'libwhisper.so.1.7.6'].every(isWhisperSharedObjectName)).toBe(true)
    expect(['vulkan-shaders-gen', 'libwhisper.so.bak', 'whisper.node.bak', 'README.txt', 'libx.so.1a'].some(isWhisperSharedObjectName)).toBe(false)
    const { dir } = makeResources()
    writeFileSync(path.join(dir, 'libfake.so'), 'text, not ELF')
    expect(whisperSharedObjects(dir).map((f) => path.basename(f))).toEqual([
      'libggml-base.so', 'libggml-cpu.so', 'libggml-vulkan.so', 'libggml.so',
      'libwhisper.so', 'libwhisper.so.1', 'libwhisper.so.1.7.6', 'whisper.node',
    ])
  })

  it('lists only dist/linux-* directories (none → empty)', () => {
    const { resources, dir } = makeResources()
    expect(whisperLinuxDirs(resources)).toEqual([dir])
    expect(whisperLinuxDirs(tmpDir())).toEqual([])
  })
})

describe('whisperRunpathProblems', () => {
  it('every file $ORIGIN, bundled NEEDED present → ok', () => {
    expect(whisperRunpathProblems(makeResources(WHISPER_RUNPATH).dir)).toEqual([])
  })

  it('upstream RUNPATH (the BUG-204 state) → one problem per shared object', () => {
    const problems = whisperRunpathProblems(makeResources().dir)
    expect(problems).toHaveLength(8)
    expect(problems.every((p) => p.includes('expected "$ORIGIN"'))).toBe(true)
  })

  it('DT_RPATH left over, a missing bundled library, or no whisper.node → problems', () => {
    const { dir } = makeResources(WHISPER_RUNPATH)
    writeFileSync(path.join(dir, 'libggml.so'), makeElfSharedObject({ needed: ['libggml-base.so'], runpath: WHISPER_RUNPATH, rpath: '/old' }))
    rmSync(path.join(dir, 'libwhisper.so.1'))
    const problems = whisperRunpathProblems(dir)
    expect(problems).toEqual([
      expect.stringContaining('has DT_RPATH "/old"'),
      expect.stringContaining('NEEDED libwhisper.so.1 is not in'),
    ])
    rmSync(path.join(dir, 'whisper.node'))
    expect(whisperRunpathProblems(dir)[0]).toContain('missing:')
  })
})

describe('patchWhisperRunpath / afterPackWhisperRunpath', () => {
  it('runs patchelf --set-rpath $ORIGIN (no shell) on each shared object, then the check passes', () => {
    const { resources, dir } = makeResources()
    const fake = fakePatchelf()
    const result = patchWhisperRunpath(resources, { execFileSync: fake.execFileSync })
    expect(result.patchelf).toBe('patchelf 0.18.0')
    expect(result.dirs).toEqual([{ dir, files: whisperSharedObjects(dir) }])
    expect(fake.calls[0].args).toEqual(['--version'])
    const set = fake.calls.slice(1)
    expect(set.map((c) => c.cmd)).toEqual(Array(8).fill('patchelf'))
    expect(set.map((c) => c.args)).toEqual(whisperSharedObjects(dir).map((f) => ['--set-rpath', '$ORIGIN', f]))
    expect(set.every((c) => !c.opts.shell && c.opts.timeout > 0)).toBe(true)
    expect(whisperRunpathProblems(dir)).toEqual([])
    // vulkan-shaders-gen is a build tool: left as shipped
    expect(readElfDynamicFile(path.join(dir, 'vulkan-shaders-gen')).runpath).toBe('/home/runner/build')
  })

  it('patchelf missing → throws with an install hint before touching anything', () => {
    const { resources, dir } = makeResources()
    const before = readFileSync(path.join(dir, 'whisper.node'))
    expect(() => patchWhisperRunpath(resources, { execFileSync: fakePatchelf({ missing: true }).execFileSync }))
      .toThrow(/patchelf not found on PATH.*apt-get install -y patchelf/s)
    expect(readFileSync(path.join(dir, 'whisper.node'))).toEqual(before)
    expect(() => ensurePatchelf(fakePatchelf({ missing: true }).execFileSync)).toThrow(/BUG-204/)
  })

  it('patchelf that does not change the RUNPATH → the read-back check throws', () => {
    const { resources } = makeResources()
    expect(() => patchWhisperRunpath(resources, { execFileSync: fakePatchelf({ ignoreSetRpath: true }).execFileSync }))
      .toThrow(/whisper RUNPATH check failed after patchelf/)
  })

  it('no packaged dist/linux-* directory → throws (whisper dropped from asarUnpack)', () => {
    expect(() => patchWhisperRunpath(tmpDir(), { execFileSync: fakePatchelf().execFileSync })).toThrow(/no dist\/linux-\* directory/)
  })

  it('a hard-linked file is copied first: the other link (node_modules) keeps its RUNPATH', () => {
    const { resources, dir } = makeResources()
    const outside = path.join(tmpDir(), 'whisper.node')
    linkSync(path.join(dir, 'whisper.node'), outside)
    patchWhisperRunpath(resources, { execFileSync: fakePatchelf().execFileSync })
    expect(readElfDynamicFile(path.join(dir, 'whisper.node')).runpath).toBe('$ORIGIN')
    expect(readElfDynamicFile(outside).runpath).toMatch(/^\/home\/runner\//)
    expect(existsSync(`${path.join(dir, 'whisper.node')}.t0800-tmp`)).toBe(false)
  })

  it('afterPack: Linux only (any target); Windows / macOS builds are untouched and never call patchelf', () => {
    for (const electronPlatformName of ['win32', 'darwin']) {
      const fake = fakePatchelf()
      expect(afterPackWhisperRunpath({ electronPlatformName, appOutDir: tmpDir(), packager: {} }, { execFileSync: fake.execFileSync })).toBeNull()
      expect(fake.calls).toEqual([])
    }
    const { resources, dir } = makeResources()
    const appOutDir = path.dirname(resources)
    const fake = fakePatchelf()
    const context = { electronPlatformName: 'linux', appOutDir, targets: [{ name: 'dir' }], packager: { getResourcesDir: (out) => (out === appOutDir ? resources : null) } }
    expect(afterPackWhisperRunpath(context, { execFileSync: fake.execFileSync }).dirs[0].dir).toBe(dir)
    expect(whisperRunpathProblems(dir)).toEqual([])
  })

  it('scripts/version-manifest.cjs afterPack calls it (the electron-builder hook in package.json)', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.build.afterPack).toBe('./scripts/version-manifest.cjs')
    const hook = readFileSync(path.join(ROOT, 'scripts', 'version-manifest.cjs'), 'utf8')
    expect(hook).toContain("require('./linux-whisper-runpath.cjs')")
    expect(hook).toMatch(/\n {2}afterPackWhisperRunpath\(context, deps\);\n/)
  })
})

describe('verifyWhisperRunpath (verify-packaged-native whisper-runpath)', () => {
  it('ok after the afterPack hook, problems before it, missing dir → problem', () => {
    expect(verifyWhisperRunpath(makeResources(WHISPER_RUNPATH).resources, 'x64')).toEqual([])
    const before = verifyWhisperRunpath(makeResources().resources, 'x64')
    expect(before.map((p) => p.id)).toEqual(['whisper-runpath'])
    expect(before[0].details).toHaveLength(8)
    expect(verifyWhisperRunpath(tmpDir(), 'x64')[0].details[0]).toContain(`missing: `)
  })
})

describe('Linux build workflows install patchelf before packaging (BUG-204)', () => {
  const yaml = require('js-yaml')
  it.each(['pre-release.yml', 'release.yml', 'desktop-build.yml'])('%s', (workflow) => {
    const doc = yaml.load(readFileSync(path.join(ROOT, '.github', 'workflows', workflow), 'utf8'))
    const steps = doc.jobs.build.steps
    const install = steps.findIndex((s) => s.name === 'Install patchelf (Linux, BUG-204)')
    expect(install).toBeGreaterThan(-1)
    expect(install).toBeLessThan(steps.findIndex((s) => s.name === 'Package for Linux'))
    expect(steps[install].if).toBe("matrix.platform == 'linux'")
    expect(steps[install].run).toContain('apt-get install -y --no-install-recommends patchelf')
    expect(steps[install].run).toContain('patchelf --version')
  })
})
