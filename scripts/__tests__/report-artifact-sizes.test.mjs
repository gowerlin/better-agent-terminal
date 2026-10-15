// T0546 — scripts/report-artifact-sizes.mjs: read-only size report of electron-builder output
// (installers + what each unpacked app is made of). Fake release trees in a temp dir.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { buildReport, collectArtifacts, collectUnpackedApps, diskUsage, formatMiB, formatReport, parseArgs } from '../report-artifact-sizes.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'report-artifact-sizes.mjs')
const MIB = 1024 * 1024
const dirs = []

function makeOutDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 't0546-sizes-'))
  dirs.push(dir)
  return dir
}

function writeBytes(filePath, bytes) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, Buffer.alloc(bytes))
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe('report-artifact-sizes', () => {
  it('lists installers largest first and skips blockmaps / metadata', () => {
    const out = makeOutDir()
    writeBytes(path.join(out, 'BetterAgentTerminal Setup 1.0.0.exe'), 3 * MIB)
    writeBytes(path.join(out, 'BetterAgentTerminal-1.0.0-win.zip'), 4 * MIB)
    writeBytes(path.join(out, 'BetterAgentTerminal Setup 1.0.0.exe.blockmap'), 10)
    writeBytes(path.join(out, 'latest.yml'), 10)
    expect(collectArtifacts(out)).toEqual([
      { name: 'BetterAgentTerminal-1.0.0-win.zip', bytes: 4 * MIB },
      { name: 'BetterAgentTerminal Setup 1.0.0.exe', bytes: 3 * MIB },
    ])
  })

  it('finds win / linux unpacked dirs and mac .app bundles', () => {
    const out = makeOutDir()
    mkdirSync(path.join(out, 'win-unpacked', 'resources'), { recursive: true })
    mkdirSync(path.join(out, 'linux-arm64-unpacked', 'resources'), { recursive: true })
    mkdirSync(path.join(out, 'mac-arm64', 'BetterAgentTerminal.app', 'Contents', 'Resources'), { recursive: true })
    mkdirSync(path.join(out, 'unrelated'), { recursive: true })
    expect(collectUnpackedApps(out).map((a) => [a.label, path.relative(out, a.resources)])).toEqual([
      ['linux-arm64-unpacked', path.join('linux-arm64-unpacked', 'resources')],
      ['mac-arm64/BetterAgentTerminal.app', path.join('mac-arm64', 'BetterAgentTerminal.app', 'Contents', 'Resources')],
      ['win-unpacked', path.join('win-unpacked', 'resources')],
    ])
  })

  it('breaks an unpacked app into asar / unpacked packages / baselines / other / Electron', () => {
    const out = makeOutDir()
    const root = path.join(out, 'win-unpacked')
    const res = path.join(root, 'resources')
    writeBytes(path.join(root, 'BetterAgentTerminal.exe'), 5 * MIB)
    writeBytes(path.join(res, 'app.asar'), 2 * MIB)
    writeBytes(path.join(res, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'), 3 * MIB)
    writeBytes(path.join(res, 'app.asar.unpacked', 'node_modules', 'ws', 'index.js'), MIB)
    writeBytes(path.join(res, 'app.asar.unpacked', 'dist-electron', 'terminal-server.js'), MIB)
    writeBytes(path.join(res, 'bat-server-baseline', 'bat-server-linux-x64-v1.0.0.tar.gz'), 4 * MIB)
    writeBytes(path.join(res, 'scripts', 'bat-notify.mjs'), MIB)

    const report = buildReport(out, 1)
    expect(report.apps).toHaveLength(1)
    const app = report.apps[0]
    expect(app).toMatchObject({
      label: 'win-unpacked',
      total: 17 * MIB,
      asar: 2 * MIB,
      unpacked: 5 * MIB,
      unpackedPackageCount: 2,
      unpackedPackages: [{ name: '@anthropic-ai/claude-code', bytes: 3 * MIB }],
      baselines: [{ name: 'bat-server-linux-x64-v1.0.0.tar.gz', bytes: 4 * MIB }],
      otherResources: MIB,
      rest: 5 * MIB,
    })
    const text = formatReport(report)
    expect(text).toContain('win-unpacked: 17.0 MiB unpacked')
    expect(text).toContain('3.0 MiB    node_modules/@anthropic-ai/claude-code')
    expect(text).toContain('4.0 MiB  bat-server-baseline/bat-server-linux-x64-v1.0.0.tar.gz')
  })

  it('an empty / missing output dir reports nothing and exits 0 (no threshold)', () => {
    const missing = path.join(makeOutDir(), 'nope')
    expect(diskUsage(missing)).toBe(0)
    expect(formatReport(buildReport(missing))).toContain('artifacts: none')
    const stdout = execFileSync(process.execPath, [SCRIPT, '--out', missing], { encoding: 'utf8', timeout: 30000 })
    expect(stdout).toContain('unpacked apps: none')
  })

  it('parses arguments', () => {
    expect(parseArgs([], '/repo')).toEqual({ outDir: path.join('/repo', 'release'), top: 12 })
    expect(parseArgs(['--out', 'x', '--top', '3'], '/repo')).toEqual({ outDir: path.resolve('x'), top: 3 })
    expect(() => parseArgs(['--top', '-1'], '/repo')).toThrow(/non-negative/)
    expect(() => parseArgs(['--bogus'], '/repo')).toThrow(/unknown or incomplete/)
    expect(formatMiB(1.5 * MIB)).toBe('1.5 MiB')
  })
})
