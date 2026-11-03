// T0801 / D247 — e2e/manual/nsis-reinstall-acceptance.ps1: -Version is required (it used to default to
// 0.7.2-pre.8, so forgetting it silently accepted an old release). Without it, or with a bad format, the
// script must exit 2 with usage on stderr before it creates the output directory, downloads, backs up or
// installs anything, and must not wait for input when run non-interactively.
//
// Only the failure paths are executed for real. The valid-version path is checked on Windows by pointing
// -OutputRoot at an illegal path, so the script stops at its first action (New-Item) — nothing is downloaded
// or installed. Skipped when pwsh is not on PATH.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e', 'manual', 'nsis-reinstall-acceptance.ps1')
const TIMEOUT_MS = 60_000

const pwshAvailable = (() => {
  try {
    const r = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { timeout: 30_000 })
    return r.status === 0
  } catch {
    return false
  }
})()

function runScript(args, outputRoot) {
  const extra = outputRoot ? ['-OutputRoot', outputRoot] : []
  const r = spawnSync(
    'pwsh',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args, ...extra],
    { encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return { status: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error }
}

describe('nsis-reinstall-acceptance.ps1 source (T0801)', () => {
  const src = readFileSync(SCRIPT, 'utf8')

  it('has no default version and does not use [Parameter(Mandatory)] for -Version', () => {
    expect(src).toMatch(/\[string\]\$Version = ''/)
    expect(src).not.toMatch(/0\.7\.2-pre\.8'/)
    // an actual attribute right before the parameter, not the comment that explains why it is not used
    expect(src).not.toMatch(/^\s*\[Parameter\([^)\n]*Mandatory[^)\n]*\)\]\s*(\r?\n\s*)?\[string\]\$Version/m)
  })

  it('checks -Version before its first action (creating the output directory)', () => {
    const check = src.indexOf('$Version -cnotmatch $VersionPattern')
    const firstAction = src.indexOf('New-Item -ItemType Directory')
    expect(check).toBeGreaterThan(0)
    expect(firstAction).toBeGreaterThan(check)
    expect(src).toContain("$VersionPattern = '^\\d+\\.\\d+\\.\\d+(-pre\\.\\d+)?$'")
  })
})

describe.skipIf(!pwshAvailable)('nsis-reinstall-acceptance.ps1 -Version gate (T0801)', () => {
  let outputRoot

  beforeAll(() => {
    outputRoot = mkdtempSync(join(tmpdir(), 't0801-nsis-'))
  })

  afterAll(() => {
    if (outputRoot) rmSync(outputRoot, { recursive: true, force: true })
  })

  function expectUsageExit(r, problem) {
    expect(r.error).toBeUndefined()
    expect(r.signal).toBeNull()
    expect(r.status).toBe(2)
    expect(r.stdout.trim()).toBe('')
    expect(r.stderr).toContain(problem)
    expect(r.stderr).toContain('沒有做任何事')
    expect(r.stderr).toContain('-Version <版號> -DryRun')
    expect(r.stderr).toContain('-Version <版號> -InstallerPath "<安裝檔路徑>"')
    // nothing was created under -OutputRoot (the report directory is the script's first action)
    expect(readdirSync(outputRoot)).toEqual([])
  }

  it.each([[[]], [['-DryRun']], [['-Version', '', '-DryRun']], [['-LaunchCheck', '-Scope', 'CurrentUser']]])(
    'missing -Version %j → exit 2 with usage, nothing done',
    (args) => {
      expectUsageExit(runScript(args, outputRoot), '缺少 -Version（必填）')
    },
    TIMEOUT_MS,
  )

  it.each(['v0.7.4-pre.2', '0.7.4-PRE.2', '0.7.4-exp.1', '0.7', '0.7.4-pre', '0.7.4.1', ' 0.7.4', '<版號>'])(
    'bad -Version %j → exit 2 with usage, nothing done',
    (version) => {
      expectUsageExit(runScript(['-Version', version, '-DryRun'], outputRoot), '-Version 格式不正確')
    },
    TIMEOUT_MS,
  )

  it.runIf(process.platform === 'win32').each(['0.7.4-pre.2', '0.7.4', '10.20.30-pre.40'])(
    'valid -Version %j passes the gate and reaches the first action (stopped by an illegal -OutputRoot)',
    (version) => {
      // '|' is illegal in Windows paths: New-Item (the script's first action) throws, nothing else runs
      const r = runScript(['-Version', version, '-DryRun'], 'C:\\t0801|illegal')
      expect(r.error).toBeUndefined()
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('New-Item')
      expect(r.stderr).not.toContain('nsis-reinstall-acceptance.ps1: ')
      expect(r.stdout).not.toContain('=== ')
    },
    TIMEOUT_MS,
  )
})
