// T0868 / D292 — e2e/manual/nsis-reinstall-acceptance.ps1 step ③ (real uninstall) follows T0860:
//  - customUnInstall always starts `BetterAgentTerminal.exe --uninstall-quit-request`, whose logger.init creates one
//    debug log and (keep the newest 10, by mtime) deletes the oldest one. ③ allows exactly that and nothing else:
//    only `BetterAgentTerminal\Logs\debug-*.log`, ≤ 1 added, ≤ 1 deleted and the deleted one is the oldest at ⓪
//    (no mtime recorded → WARN, never PASS). ② / ④ keep the strict "userData unchanged" rule.
//  - ③'s PTY holder checks follow the version installed before the uninstall (the one ② installed), not ⓪'s
//    `$holderVersion0`.
//
// The verdict function is extracted from the script with the PowerShell parser and run by itself, so nothing is
// installed, uninstalled or downloaded. Skipped when pwsh is not on PATH.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const src = readFileSync(SCRIPT, 'utf8')

function section(startMarker, endMarker) {
  const start = src.indexOf(startMarker)
  const end = src.indexOf(endMarker, start + 1)
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('nsis-reinstall-acceptance.ps1 ③ source (T0868)', () => {
  const step3 = section("New-Step '③'", "New-Step '④'")

  it('③ judges userData through Get-UninstallUserDataVerdict, ② / ④ keep the strict comparison', () => {
    expect(step3).toContain('Get-UninstallUserDataVerdict')
    expect(step3).toContain('$UninstallUserDataRule')
    expect(step3).not.toMatch(/'userData 保留且未被改動' \$\(if \(\$diff\.same\)/)
    // Test-InstalledState (② / ④) still requires an identical snapshot
    const installed = section('function Test-InstalledState', 'function Wait-Until')
    expect(installed).toContain("Add-Check $Step 'userData 未被改動' $(if ($diff.same) { 'PASS' } else { 'FAIL' })")
    expect(installed).not.toContain('Get-UninstallUserDataVerdict')
    // only one call site
    expect(src.split('Get-UninstallUserDataVerdict -Added').length - 1).toBe(1)
  })

  it('the allowance is limited to debug-*.log directly under BetterAgentTerminal\\Logs\\', () => {
    const fn = section('function Get-UninstallUserDataVerdict', 'function Get-DebugLogTimes')
    expect(fn).toContain("[string]$LogDirRel = 'BetterAgentTerminal\\Logs\\'")
    expect(fn).toContain("$re = '^' + [regex]::Escape($LogDirRel) + 'debug-[^\\\\]*\\.log$'")
    expect(step3).toContain('-LogDirRel "$ProductName\\Logs\\"')
  })

  it('③ holder checks follow the version before the uninstall, not $holderVersion0 / $holderRun0', () => {
    expect(step3).toContain('$holderVersion3 = [bool](Get-PackagedHolderManifest $installDir)')
    expect(step3).toContain('if ($holderVersion3) {')
    expect(step3).toContain('foreach ($h in $holderRun3) {')
    expect(step3).not.toContain('$holderVersion0')
    expect(step3).not.toContain('$holderRun0')
    // ⓪ keeps its own meaning
    expect(section("New-Step '⓪'", "New-Step '①'")).toContain('$holderVersion0 = [bool](Get-PackagedHolderManifest $inst.installDir)')
  })

  it('⓪ records debug log mtimes next to the snapshot', () => {
    expect(src).toMatch(/\$snapshot0 = Get-UserDataSnapshot \$udDirs\r?\n[^\n]*\r?\n\s*\$script:DebugLogTimes0 = Get-DebugLogTimes \$udDirs/)
  })
})

describe.skipIf(!pwshAvailable)('Get-UninstallUserDataVerdict (T0868)', () => {
  const D = 'BetterAgentTerminal\\Logs\\'
  // the 0.7.5-pre.1 FAIL report (2026-11-05 11:03): ⓪ had 10 debug logs, 140843 the oldest
  const logs0 = [
    'debug-20261104-140843.log',
    'debug-20261104-151200.log',
    'debug-20261104-160000.log',
    'debug-20261104-170000.log',
    'debug-20261104-180000.log',
    'debug-20261104-190000.log',
    'debug-20261104-200000.log',
    'debug-20261105-090000.log',
    'debug-20261105-100000.log',
    'debug-20261105-105000.log',
  ]
  const times0 = Object.fromEntries(logs0.map((n, i) => [D + n, 1_000_000 + i * 1_000]))
  const ADDED = D + 'debug-20261105-110422.log'
  const OLDEST = D + logs0[0]

  const cases = {
    unchanged: { added: [], removed: [], changed: [], times: times0 },
    failReport: { added: [ADDED], removed: [OLDEST], changed: [], times: times0 },
    addedOnly: { added: [ADDED], removed: [], changed: [], times: times0 },
    settingsChanged: { added: [], removed: [], changed: ['BetterAgentTerminal\\settings.json'], times: times0 },
    failReportPlusSettings: { added: [ADDED], removed: [OLDEST], changed: ['BetterAgentTerminal\\settings.json'], times: times0 },
    notOldest: { added: [ADDED], removed: [D + logs0[3]], changed: [], times: times0 },
    noTimes: { added: [ADDED], removed: [OLDEST], changed: [], times: null },
    timesMissingThatFile: { added: [ADDED], removed: [OLDEST], changed: [], times: Object.fromEntries(Object.entries(times0).slice(1)) },
    twoAdded: { added: [ADDED, D + 'debug-20261105-110423.log'], removed: [OLDEST], changed: [], times: times0 },
    twoRemoved: { added: [ADDED], removed: [OLDEST, D + logs0[1]], changed: [], times: times0 },
    removedOnly: { added: [], removed: [OLDEST], changed: [], times: times0 },
    debugLogChanged: { added: [], removed: [], changed: [D + logs0[9]], times: times0 },
    batScriptsLog: { added: [ADDED, D + 'bat-scripts.log'], removed: [], changed: [], times: times0 },
    otherLogsFile: { added: [D + 'debug-20261105-110422.txt'], removed: [], changed: [], times: times0 },
    subdirectory: { added: [D + 'old\\debug-20261105-110422.log'], removed: [], changed: [], times: times0 },
    runtimeDir: { added: ['BetterAgentTerminal-runtime-1\\Logs\\debug-20261105-110422.log'], removed: [], changed: [], times: times0 },
    tokenFile: { added: [], removed: ['BetterAgentTerminal\\server-token.json'], changed: [], times: times0 },
  }

  let dir
  let results

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 't0868-nsis-'))
    const casesPath = join(dir, 'cases.json')
    writeFileSync(casesPath, JSON.stringify(cases), 'utf8')
    const runner = join(dir, 'run.ps1')
    writeFileSync(
      runner,
      [
        'param([string]$Script, [string]$Cases)',
        'Set-StrictMode -Version Latest',
        "$ErrorActionPreference = 'Stop'",
        '$t = $null; $e = $null',
        '$ast = [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$t, [ref]$e)',
        "if ($e.Count -gt 0) { throw \"parse errors: $($e.Count)\" }",
        "$fn = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-UninstallUserDataVerdict' }, $true))",
        "if ($fn.Count -ne 1) { throw \"function count: $($fn.Count)\" }",
        '. ([scriptblock]::Create($fn[0].Extent.Text))',
        '$in = Get-Content -LiteralPath $Cases -Raw -Encoding UTF8 | ConvertFrom-Json',
        '$out = [ordered]@{}',
        'foreach ($p in $in.PSObject.Properties) {',
        '  $c = $p.Value',
        '  $times = $null',
        '  if ($null -ne $c.times) { $times = @{}; foreach ($q in $c.times.PSObject.Properties) { $times[$q.Name] = [int64]$q.Value } }',
        '  $v = Get-UninstallUserDataVerdict -Added @($c.added) -Removed @($c.removed) -Changed @($c.changed) -LogTimes0 $times',
        '  $out[$p.Name] = [ordered]@{ result = $v.result; actual = $v.actual; notes = @($v.notes) }',
        '}',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        '$out | ConvertTo-Json -Depth 5 -Compress',
      ].join('\n'),
      'utf8',
    )
    const r = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', runner, '-Script', SCRIPT, '-Cases', casesPath], {
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
    })
    if (r.status !== 0) throw new Error(`pwsh exit ${r.status}: ${r.stderr}`)
    results = JSON.parse(r.stdout.trim())
  }, TIMEOUT_MS)

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('no difference → PASS', () => {
    expect(results.unchanged.result).toBe('PASS')
    expect(results.unchanged.notes).toEqual([])
  })

  it('the 0.7.5-pre.1 FAIL report (1 debug log added, the oldest rotated out) → PASS with a note per file', () => {
    const v = results.failReport
    expect(v.result).toBe('PASS')
    expect(v.actual).toBe('新增 1 / 刪除 1 / 變更 0')
    expect(v.notes.some((n) => n.includes(ADDED) && n.includes('--uninstall-quit-request') && n.includes('T0860'))).toBe(true)
    expect(v.notes.some((n) => n.includes(OLDEST) && n.includes('最舊'))).toBe(true)
  })

  it('one debug log added without rotation → PASS', () => {
    expect(results.addedOnly.result).toBe('PASS')
  })

  it.each(['settingsChanged', 'failReportPlusSettings', 'tokenFile'])('%s → FAIL (outside the allowance)', (name) => {
    expect(results[name].result).toBe('FAIL')
    expect(results[name].notes.some((n) => n.includes('超出容許範圍'))).toBe(true)
  })

  it.each(['batScriptsLog', 'otherLogsFile', 'subdirectory', 'runtimeDir', 'debugLogChanged'])(
    '%s → FAIL (only debug-*.log directly under BetterAgentTerminal\\Logs\\ may be added / removed)',
    (name) => {
      expect(results[name].result).toBe('FAIL')
    },
  )

  it.each(['twoAdded', 'twoRemoved', 'removedOnly', 'notOldest'])('%s → FAIL (not a single rotation of the oldest log)', (name) => {
    expect(results[name].result).toBe('FAIL')
  })

  it.each(['noTimes', 'timesMissingThatFile'])('%s → WARN (cannot confirm the deleted log was the oldest)', (name) => {
    expect(results[name].result).toBe('WARN')
    expect(results[name].notes.some((n) => n.includes('無法確認'))).toBe(true)
  })
})
