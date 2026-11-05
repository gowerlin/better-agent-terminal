// T0869 / D293 — e2e/manual/nsis-reinstall-acceptance.ps1 step ④ (clean reinstall) compares userData with the
// snapshot taken at the end of ③, not with ⓪'s:
//  - ③ allows the debug log added / rotated by `--uninstall-quit-request` (T0868, Get-UninstallUserDataVerdict).
//    Comparing ④ with ⓪ counted that same difference again and failed ④ (0.7.5-pre.1 rerun, 2026-11-05 11:22).
//  - ④'s rule is unchanged: identical snapshot or FAIL. Only the baseline moved. ② still compares with ⓪.
//  - No ③ snapshot (③ never reached the userData comparison) → ④ falls back to ⓪ with a note.
//
// Source guards plus Compare-Snapshot run by itself (extracted with the PowerShell parser): nothing is installed,
// uninstalled or downloaded. The behaviour part is skipped when pwsh is not on PATH.

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

describe('nsis-reinstall-acceptance.ps1 ④ userData baseline source (T0869)', () => {
  const step2 = section("New-Step '②'", "New-Step '③'")
  const step3 = section("New-Step '③'", "New-Step '④'")
  const step4 = section("New-Step '④'", "New-Step '⑤'")
  const installed = section('function Test-InstalledState', 'function Wait-Until')

  it('Test-InstalledState labels its baseline instead of hard-coding ⓪, and stays strict', () => {
    expect(installed).toContain("[string]$SnapshotBaseline = '⓪ 的'")
    expect(installed).toContain('"與 $SnapshotBaseline SHA-256 快照相同"')
    expect(installed).not.toContain("'與 ⓪ 的 SHA-256 快照相同'")
    expect(installed).toContain("Add-Check $Step 'userData 未被改動' $(if ($diff.same) { 'PASS' } else { 'FAIL' })")
    expect(installed).not.toContain('Get-UninstallUserDataVerdict')
  })

  it('② still compares with ⓪', () => {
    expect(step2).toContain("Test-InstalledState $s2 $installScope $installDir $snapshot0 $desktop0 '⓪ 的'")
  })

  it('③ still judges through Get-UninstallUserDataVerdict and keeps that snapshot only on PASS / WARN', () => {
    expect(step3).toContain('$snapshot3 = $null')
    expect(step3).toContain('$snapshotAfter3 = Get-UserDataSnapshot (Get-UserDataDirs)')
    expect(step3).toContain('$diff = Compare-Snapshot $snapshot0 $snapshotAfter3')
    expect(step3).toContain('Get-UninstallUserDataVerdict -Added $diff.added')
    expect(step3).toMatch(/if \(\$verdict\.result -eq 'PASS' -or \$verdict\.result -eq 'WARN'\) \{\r?\n\s*\$snapshot3 = \$snapshotAfter3/)
  })

  it('④ passes the ③ snapshot, falls back to ⓪ only when it is missing, and never uses the ③ allowance', () => {
    expect(step4).toContain('$snapshot4Base = $snapshot3')
    expect(step4).toContain("$snapshot4Label = '③ 結束時的'")
    expect(step4).toMatch(/if \(\$null -eq \$snapshot4Base\) \{\r?\n\s*\$snapshot4Base = \$snapshot0/)
    expect(step4).toContain('Test-InstalledState $s4 $installScope $installDir $snapshot4Base $true $snapshot4Label')
    expect(step4).not.toMatch(/Test-InstalledState \$s4 [^\r\n]*\$snapshot0/)
    expect(step4).not.toContain('Get-UninstallUserDataVerdict')
    // dry-run text names the new baseline
    expect(step4).toContain('userData 基準 = ③ 結束時的 SHA-256 快照')
  })

  it('Test-InstalledState is called only from ② preview, ② and ④', () => {
    const calls = src.match(/^\s*(?:else \{ )?Test-InstalledState \$s\S+/gm) ?? []
    expect(calls.map((c) => c.trim().split(' ')[1])).toEqual(['$s2p', '$s2', '$s4'])
  })
})

describe.skipIf(!pwshAvailable)('Compare-Snapshot with the ③ baseline (T0869)', () => {
  const D = 'BetterAgentTerminal\\Logs\\'
  // the 0.7.5-pre.1 rerun report (2026-11-05 11:22): ③ added 112244, rotated out 140749
  const OLD = D + 'debug-20261104-140749.log'
  const NEW = D + 'debug-20261105-112244.log'
  const snap0 = {
    [OLD]: '100:AAA',
    [D + 'debug-20261104-150000.log']: '200:BBB',
    'BetterAgentTerminal\\settings.json': '300:CCC',
  }
  const snap3 = { ...snap0, [NEW]: '400:DDD' }
  delete snap3[OLD]

  const cases = {
    rerun4VsSnap0: { before: snap0, after: snap3 },
    rerun4VsSnap3: { before: snap3, after: snap3 },
    settingsChangedIn4: { before: snap3, after: { ...snap3, 'BetterAgentTerminal\\settings.json': '301:CCD' } },
    debugLogAddedIn4: { before: snap3, after: { ...snap3, [D + 'debug-20261105-113000.log']: '500:EEE' } },
    fileRemovedIn4: { before: snap3, after: Object.fromEntries(Object.entries(snap3).filter(([k]) => k !== NEW)) },
  }

  let dir
  let results

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 't0869-nsis-'))
    const casesPath = join(dir, 'cases.json')
    writeFileSync(casesPath, JSON.stringify(cases), 'utf8')
    const runner = join(dir, 'run.ps1')
    writeFileSync(
      runner,
      [
        'param([string]$Script, [string]$Cases)',
        'Set-StrictMode -Version Latest',
        "$ErrorActionPreference = 'Stop'",
        '$script:IgnoreServerFiles = $false',
        '$t = $null; $e = $null',
        '$ast = [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$t, [ref]$e)',
        "if ($e.Count -gt 0) { throw \"parse errors: $($e.Count)\" }",
        "$fn = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Compare-Snapshot' }, $true))",
        "if ($fn.Count -ne 1) { throw \"function count: $($fn.Count)\" }",
        '. ([scriptblock]::Create($fn[0].Extent.Text))',
        'function ConvertTo-Map($o) { $m = @{}; foreach ($q in $o.PSObject.Properties) { $m[$q.Name] = [string]$q.Value }; return $m }',
        '$in = Get-Content -LiteralPath $Cases -Raw -Encoding UTF8 | ConvertFrom-Json',
        '$out = [ordered]@{}',
        'foreach ($p in $in.PSObject.Properties) {',
        '  $d = Compare-Snapshot (ConvertTo-Map $p.Value.before) (ConvertTo-Map $p.Value.after)',
        '  $out[$p.Name] = [ordered]@{ same = $d.same; added = @($d.added); removed = @($d.removed); changed = @($d.changed) }',
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

  it('the rerun: ④ against ⓪ repeats ③\'s difference (the old FAIL)', () => {
    const d = results.rerun4VsSnap0
    expect(d.same).toBe(false)
    expect(d.added).toEqual([NEW])
    expect(d.removed).toEqual([OLD])
  })

  it('the rerun: ④ against the ③ snapshot (has 112244, lacks 140749) with no change during ④ → same', () => {
    expect(results.rerun4VsSnap3.same).toBe(true)
  })

  it.each(['settingsChangedIn4', 'debugLogAddedIn4', 'fileRemovedIn4'])('%s → not same (④ still allows nothing)', (name) => {
    expect(results[name].same).toBe(false)
  })
})
