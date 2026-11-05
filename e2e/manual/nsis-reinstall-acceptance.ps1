#Requires -Version 5.1
<#
.SYNOPSIS
  BAT Windows NSIS 安裝檔驗收：覆蓋安裝 → 解除安裝 → 乾淨重裝（T0740）。

.DESCRIPTION
  步驟：
    ⓪ 前置檢查：安裝範圍（HKLM / HKCU uninstall 鍵）、安裝路徑、版本、執行中程序、userData 備份
    ① 下載安裝檔（gh release download）並驗證雜湊
    ② 覆蓋安裝（同版本）並檢查
    ③ 靜默解除安裝並檢查
    ④ 乾淨重裝並檢查
    ⑤ 選做（-LaunchCheck）：啟動 BAT 10 秒後關閉，檢查 debug log
    ⑥ 輸出 report.md / report.json 到 %TEMP%\bat-nsis-acceptance-<YYYYMMDD-HHMMSS>\

  任何一步 FAIL：停下、寫報告、印出還原 userData 與重新安裝的指令。
  🔴 必須在 BAT 已完全關閉（含 Terminal Server）後，從一般 PowerShell（不是 BAT 分頁）執行。
  -DryRun 只做唯讀檢查（會下載安裝檔到輸出目錄），印出每一步將執行的指令與判讀規則，不改任何東西。
  -Version 必填（T0801 / D247），-DryRun 也要帶：格式 X.Y.Z 或 X.Y.Z-pre.N（release tag 去掉 v）。
  不帶或格式不對時，在建立輸出目錄、下載、備份、安裝之前就以 exit 2 結束並印出用法。

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version <版號> -DryRun
.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version <版號> -InstallerPath "$env:TEMP\bat-nsis-acceptance-<YYYYMMDD-HHMMSS>\BetterAgentTerminal.Setup.<版號>.exe"
#>
[CmdletBinding()]
param(
  # 必填（T0801）：不用 [Parameter(Mandatory)]，檢查在 param 之後，見「-Version 必填」
  [string]$Version = '',
  [string]$InstallerPath = '',
  [string]$ExpectedSha256 = '',
  [switch]$DryRun,
  [switch]$StopRunning,
  [switch]$LaunchCheck,
  [ValidateSet('Auto', 'AllUsers', 'CurrentUser')]
  [string]$Scope = 'Auto',
  [string]$OutputRoot = $env:TEMP,
  [string]$Repo = 'gowerlin/better-agent-terminal',
  [int]$InstallTimeoutSec = 900,
  [int]$UninstallTimeoutSec = 600
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# ---------------------------------------------------------------- -Version 必填（T0801 / D247）
# 原本預設 0.7.2-pre.8：漏帶 -Version 會下載並驗收舊版，報告看起來 PASS 卻不是本版。
# 這段必須在任何動作（建立輸出目錄、下載、備份、安裝）之前。
# 不用 [Parameter(Mandatory)]：互動執行時 PowerShell 會停下來要求輸入，-NonInteractive 時只有通用的
# 「缺少必要參數」錯誤，兩者都不會印出用法。這裡自己檢查，任何模式都直接結束（exit 2 = 用法錯誤）。
$VersionPattern = '^\d+\.\d+\.\d+(-pre\.\d+)?$'
if ($Version -cnotmatch $VersionPattern) {
  $self = $(if ($PSCommandPath) { $PSCommandPath } else { 'e2e\manual\nsis-reinstall-acceptance.ps1' })
  $problem = $(if ([string]::IsNullOrWhiteSpace($Version)) {
      '缺少 -Version（必填）'
    } else {
      "-Version 格式不正確：'$Version'（應為 X.Y.Z 或 X.Y.Z-pre.N，不加 v 前綴）"
    })
  $usage = @(
    "nsis-reinstall-acceptance.ps1: $problem"
    '沒有做任何事：沒有建立輸出目錄、下載、備份或安裝。'
    ''
    '版號 = 要驗收的 GitHub release tag 去掉 v（tag v<版號> → -Version <版號>），每次都要明確帶。'
    ''
    '用法（把 <版號> 換成要驗收的版號）：'
    '  演練（只做唯讀檢查並下載安裝檔）：'
    "    pwsh -NoProfile -ExecutionPolicy Bypass -File `"$self`" -Version <版號> -DryRun"
    '  實際執行（重用已下載的安裝檔）：'
    "    pwsh -NoProfile -ExecutionPolicy Bypass -File `"$self`" -Version <版號> -InstallerPath `"<安裝檔路徑>`""
    '  實際執行（先下載，需要已登入的 gh）：'
    "    pwsh -NoProfile -ExecutionPolicy Bypass -File `"$self`" -Version <版號>"
  )
  [Console]::Error.WriteLine(($usage -join [Environment]::NewLine))
  exit 2
}

# ---------------------------------------------------------------- 常數
$ProductName = 'BetterAgentTerminal'
$AssetName = "BetterAgentTerminal.Setup.$Version.exe"
$Tag = "v$Version"
$HelperNames = @('bat-terminal.mjs', 'bat-notify.mjs', 'bat-mcp.mjs')
$StartedAt = Get-Date
$Stamp = $StartedAt.ToString('yyyyMMdd-HHmmss')
$OutDir = Join-Path $OutputRoot "bat-nsis-acceptance-$Stamp"
$BackupDir = Join-Path $OutDir 'userdata-backup'
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
# 轉成絕對路徑：helper 的 BAT_HELPER_LOG_DIR 只接受絕對路徑（相對值會被忽略、改寫 userData），-OutputRoot 可能是相對路徑
$OutDir = (Resolve-Path -LiteralPath $OutDir).ProviderPath
$BackupDir = Join-Path $OutDir 'userdata-backup'
# T0745：helper --version 檢查的 bat-scripts.log 導到這裡，不寫入 userData（見 Invoke-Helper）
$HelperLogDir = Join-Path $OutDir 'helper-logs'

# ---------------------------------------------------------------- 報告
function Get-Now { (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz') }

$Report = [ordered]@{
  tool          = 'e2e/manual/nsis-reinstall-acceptance.ps1 (T0740)'
  mode          = $(if ($DryRun) { 'dry-run' } else { 'real' })
  version       = $Version
  startedAt     = $StartedAt.ToString('yyyy-MM-ddTHH:mm:sszzz')
  finishedAt    = ''
  result        = ''
  outputDir     = $OutDir
  powershell    = $PSVersionTable.PSVersion.ToString()
  isAdmin       = $IsAdmin
  installer     = $null
  installation  = $null
  userDataDirs  = @()
  backupDir     = ''
  steps         = New-Object System.Collections.ArrayList
  restoreHints  = @()
}

function New-Step([string]$Id, [string]$Title) {
  $s = [ordered]@{
    id = $Id; title = $Title; result = ''; startedAt = (Get-Now); durationSec = $null
    commands = New-Object System.Collections.ArrayList
    checks = New-Object System.Collections.ArrayList
    notes = New-Object System.Collections.ArrayList
  }
  [void]$Report.steps.Add($s)
  Write-Host ''
  Write-Host "=== $Id $Title ===" -ForegroundColor Cyan
  return $s
}

function Add-Check($Step, [string]$Name, [string]$Result, $Expected, $Actual, [string]$Rule = '') {
  $c = [ordered]@{ name = $Name; result = $Result; expected = "$Expected"; actual = "$Actual"; rule = $Rule }
  [void]$Step.checks.Add($c)
  $color = switch ($Result) { 'PASS' { 'Green' } 'FAIL' { 'Red' } 'WARN' { 'Yellow' } default { 'Gray' } }
  Write-Host ("  [{0}] {1}: expected={2} actual={3}" -f $Result, $Name, $Expected, $Actual) -ForegroundColor $color
}

function Add-Note($Step, [string]$Text) {
  [void]$Step.notes.Add($Text)
  Write-Host "  - $Text"
}

function Add-Command($Step, [string]$Text) {
  [void]$Step.commands.Add($Text)
  $prefix = $(if ($DryRun) { '  (dry-run) 將執行：' } else { '  執行：' })
  Write-Host "$prefix$Text" -ForegroundColor DarkCyan
}

function Complete-Step($Step, [string]$Forced = '') {
  $start = [datetimeoffset]::Parse($Step.startedAt)
  if ($null -eq $Step.durationSec) { $Step.durationSec = [math]::Round(((Get-Date) - $start.LocalDateTime).TotalSeconds, 1) }
  if ($Forced) { $Step.result = $Forced }
  else {
    $results = @($Step.checks | ForEach-Object { $_.result })
    if ($results -contains 'FAIL') { $Step.result = 'FAIL' }
    elseif ($results -contains 'WARN') { $Step.result = 'WARN' }
    elseif ($DryRun) { $Step.result = 'DRYRUN' }
    else { $Step.result = 'PASS' }
  }
  Write-Host ("  => {0} {1}（{2} s）" -f $Step.id, $Step.result, $Step.durationSec)
}

function ConvertTo-MdCell([string]$s) { ($s -replace '\|', '\|' -replace "`r?`n", ' ') }

function Save-Report {
  $Report.finishedAt = Get-Now
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $json = $Report | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText((Join-Path $OutDir 'report.json'), $json, $utf8)

  $md = New-Object System.Collections.Generic.List[string]
  $md.Add("# BAT NSIS 重裝驗收報告（T0740）")
  $md.Add('')
  $md.Add("- 模式：$($Report.mode)")
  $md.Add("- 版本：$Version")
  $md.Add("- 結果：**$($Report.result)**")
  $md.Add("- 開始：$($Report.startedAt)　結束：$($Report.finishedAt)")
  $md.Add("- PowerShell：$($Report.powershell)　系統管理員：$($Report.isAdmin)")
  if ($Report.installer) { $md.Add("- 安裝檔：``$($Report.installer.path)``（$($Report.installer.size) bytes）") }
  if ($Report.installation) { $md.Add("- 安裝範圍：$($Report.installation.scope)（$($Report.installation.hive)）　路徑：``$($Report.installation.installDir)``") }
  if ($Report.backupDir) { $md.Add("- userData 備份：``$($Report.backupDir)``（含權杖檔，驗收結束後請刪除）") }
  $md.Add('')
  $md.Add('| 步驟 | 結果 | 耗時 (s) |')
  $md.Add('|---|---|---|')
  foreach ($s in $Report.steps) { $md.Add("| $($s.id) $($s.title) | $($s.result) | $($s.durationSec) |") }
  foreach ($s in $Report.steps) {
    $md.Add('')
    $md.Add("## $($s.id) $($s.title) — $($s.result)")
    if ($s.commands.Count -gt 0) {
      $md.Add('')
      $md.Add('指令：')
      $md.Add('')
      $md.Add('```')
      foreach ($c in $s.commands) { $md.Add($c) }
      $md.Add('```')
    }
    if ($s.checks.Count -gt 0) {
      $md.Add('')
      $md.Add('| 檢查 | 結果 | 預期 | 實際 | 判讀規則 |')
      $md.Add('|---|---|---|---|---|')
      foreach ($c in $s.checks) {
        $md.Add("| $(ConvertTo-MdCell $c.name) | $($c.result) | $(ConvertTo-MdCell $c.expected) | $(ConvertTo-MdCell $c.actual) | $(ConvertTo-MdCell $c.rule) |")
      }
    }
    if ($s.notes.Count -gt 0) {
      $md.Add('')
      foreach ($n in $s.notes) { $md.Add("- $n") }
    }
  }
  if ($Report.restoreHints.Count -gt 0) {
    $md.Add('')
    $md.Add('## 還原指令')
    $md.Add('')
    $md.Add('```powershell')
    foreach ($h in $Report.restoreHints) { $md.Add($h) }
    $md.Add('```')
  }
  [System.IO.File]::WriteAllText((Join-Path $OutDir 'report.md'), ($md -join "`r`n") + "`r`n", $utf8)
  Write-Host ''
  Write-Host "報告：$(Join-Path $OutDir 'report.md')" -ForegroundColor Cyan
  Write-Host "      $(Join-Path $OutDir 'report.json')" -ForegroundColor Cyan
}

function Get-RestoreHints {
  $hints = New-Object System.Collections.Generic.List[string]
  if ($Report.backupDir -and (Test-Path -LiteralPath $Report.backupDir)) {
    $hints.Add('# 以備份還原 userData（BAT 必須先關閉；/MIR 會讓目標與備份完全一致）')
    foreach ($d in (Get-ChildItem -LiteralPath $Report.backupDir -Directory)) {
      $hints.Add("robocopy `"$($d.FullName)`" `"$(Join-Path $env:APPDATA $d.Name)`" /MIR /COPY:DAT /R:1 /W:1")
    }
  }
  if ($Report.installer -and $Report.installation) {
    $hints.Add('# 重新安裝（需要時以系統管理員 PowerShell 執行）')
    $hints.Add("& `"$($Report.installer.path)`" $(Get-InstallArgs $Report.installation.scope $Report.installation.installDir)")
    $hints.Add('# 或直接雙擊安裝檔，以互動方式安裝')
  }
  return $hints.ToArray()
}

function Stop-Acceptance([string]$Why) {
  Write-Host ''
  Write-Host "中止：$Why" -ForegroundColor Red
  $Report.result = 'FAIL'
  $Report.restoreHints = @(Get-RestoreHints)
  Save-Report
  if ($Report.restoreHints.Count -gt 0) {
    Write-Host ''
    Write-Host '還原指令：' -ForegroundColor Yellow
    foreach ($h in $Report.restoreHints) { Write-Host "  $h" }
  }
  exit 1
}

# ---------------------------------------------------------------- 工具函式
function Get-Prop($Obj, [string]$Name) {
  if ($null -ne $Obj -and $Obj.PSObject.Properties[$Name]) { return $Obj.$Name }
  return $null
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
  $ErrorActionPreference = 'Continue'
  $out = & $File @Arguments 2>&1 | ForEach-Object { "$_" }
  return [pscustomobject]@{ exitCode = $LASTEXITCODE; output = (@($out) -join "`n") }
}

function Get-InstallArgs([string]$InstallScope, [string]$Dir) {
  # electron-builder NSIS（assistedInstaller.nsh / multiUser.nsh）：/allusers 或 /currentuser 決定範圍；
  # /D= 必須是最後一個參數、不加引號（NSIS 規則，路徑含空白也一樣）。
  $scopeArg = $(if ($InstallScope -eq 'AllUsers') { '/allusers' } else { '/currentuser' })
  return "/S $scopeArg /D=$Dir"
}

function Find-Installations {
  $found = New-Object System.Collections.ArrayList
  $roots = @(
    @{ hive = 'HKLM'; scope = 'AllUsers'; uninstall = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall') },
    @{ hive = 'HKCU'; scope = 'CurrentUser'; uninstall = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall') }
  )
  foreach ($r in $roots) {
    foreach ($u in $r.uninstall) {
      if (-not (Test-Path -LiteralPath $u)) { continue }
      foreach ($k in @(Get-ChildItem -LiteralPath $u -ErrorAction SilentlyContinue)) {
        $p = $null
        try { $p = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction Stop } catch { continue }
        $name = Get-Prop $p 'DisplayName'
        if (-not $name -or -not ("$name" -like "$ProductName*")) { continue }
        $guid = $k.PSChildName
        $appKey = "$($r.hive):\Software\$guid"
        $appProps = $null
        if (Test-Path -LiteralPath $appKey) { $appProps = Get-ItemProperty -LiteralPath $appKey -ErrorAction SilentlyContinue }
        $installDir = Get-Prop $appProps 'InstallLocation'
        $dirSource = "$appKey\InstallLocation"
        if (-not $installDir) { $installDir = Get-Prop $p 'InstallLocation'; $dirSource = 'Uninstall\InstallLocation' }
        $uninstallString = Get-Prop $p 'UninstallString'
        if (-not $installDir -and $uninstallString -match '^"([^"]+)"') { $installDir = Split-Path -Parent $Matches[1]; $dirSource = 'UninstallString' }
        [void]$found.Add([ordered]@{
          hive = $r.hive; scope = $r.scope; guid = $guid; uninstallKey = ($k.PSPath -replace '^Microsoft\.PowerShell\.Core\\Registry::', '')
          displayName = "$name"; displayVersion = "$(Get-Prop $p 'DisplayVersion')"
          installDir = "$installDir"; installDirSource = $dirSource; appRegistryKey = $appKey
          uninstallString = "$uninstallString"; quietUninstallString = "$(Get-Prop $p 'QuietUninstallString')"
        })
      }
    }
  }
  return $found.ToArray()
}

function Get-RelatedProcesses([string]$Dir) {
  $list = New-Object System.Collections.ArrayList
  if (-not $Dir) { return $list.ToArray() }
  $prefix = $Dir.TrimEnd('\') + '\'
  foreach ($p in @(Get-CimInstance Win32_Process)) {
    $exe = Get-Prop $p 'ExecutablePath'
    $cmd = Get-Prop $p 'CommandLine'
    $kind = $null
    if ($exe -and $exe.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $kind = 'exe-in-install-dir' }
    elseif ($cmd -and $cmd.IndexOf($prefix, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $p.ProcessId -ne $PID) { $kind = 'cmdline-references-install-dir' }
    if ($kind) {
      # 只記名稱 / PID / 執行檔路徑，不記命令列（可能含使用者資料）
      [void]$list.Add([ordered]@{ name = $p.Name; pid = $p.ProcessId; kind = $kind; path = "$exe" })
    }
  }
  return $list.ToArray()
}

function Get-UserDataDirs {
  return @(Get-ChildItem -LiteralPath $env:APPDATA -Directory -Filter "$ProductName*" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
}

function Get-UserDataSnapshot([string[]]$Dirs) {
  $map = @{}
  foreach ($d in $Dirs) {
    $base = Split-Path -Leaf $d
    foreach ($f in @(Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue)) {
      $rel = $base + $f.FullName.Substring($d.Length)
      $h = 'unreadable'
      try { $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256 -ErrorAction Stop).Hash } catch { }
      $map[$rel] = "$($f.Length):$h"
    }
  }
  return $map
}

function Compare-Snapshot([hashtable]$Before, [hashtable]$After) {
  if ($script:IgnoreServerFiles) {
    # T0862：⓪ 有執行中的 PTY holder 時，它（Terminal Server）自己會改寫 pid / port / token / registry，③ 解除安裝也會停掉它並清這些檔
    $Before = Select-WithoutServerFiles $Before
    $After = Select-WithoutServerFiles $After
  }
  $added = @($After.Keys | Where-Object { -not $Before.ContainsKey($_) } | Sort-Object)
  $removed = @($Before.Keys | Where-Object { -not $After.ContainsKey($_) } | Sort-Object)
  $changed = @($Before.Keys | Where-Object { $After.ContainsKey($_) -and $After[$_] -ne $Before[$_] } | Sort-Object)
  return [pscustomobject]@{ added = $added; removed = $removed; changed = $changed; same = ($added.Count + $removed.Count + $changed.Count -eq 0) }
}

# T0868 / D292：③ 真的解除安裝時，customUnInstall（batUninstallPtyHolder）啟動 $INSTDIR\BetterAgentTerminal.exe
# --uninstall-quit-request（T0860，沒有 BAT 在跑也送，用來停 holder）。請求程序的 logger.init 建立一份 debug log，
# 並依「保留最近 10 個」（electron/logger.ts cleanupOldLogs，依修改時間）刪掉最舊的一份。這是設計行為，由腳本容許。
# 容許範圍只有 ③、只有 BetterAgentTerminal\Logs\debug-*.log（不含子目錄、其他 userData 目錄）：新增 ≤ 1 份、
# 因輪替刪除 ≤ 1 份且是 ⓪ 時修改時間最舊的那份。其他任何差異（Logs 內其他檔、bat-scripts*.log、settings、權杖檔、
# debug log 內容變更）仍是 FAIL。② / ④ 不用這個函式，規則不變。
$UninstallUserDataRule = 'T0868 / D292：只容許 BetterAgentTerminal\Logs\debug-*.log 新增 ≤ 1 份、因輪替刪除 ≤ 1 份且是 ⓪ 時修改時間最舊的那份（解除安裝程式啟動 --uninstall-quit-request，logger.init 建檔並只保留最近 10 個，T0860）；其他任何差異 FAIL；⓪ 沒有被刪那份的修改時間、無法確認是最舊 → WARN'
function Get-UninstallUserDataVerdict {
  param(
    [string[]]$Added = @(),
    [string[]]$Removed = @(),
    [string[]]$Changed = @(),
    # ⓪ 時的 debug log 修改時間（key 與 userData 快照相同的相對路徑，值 = LastWriteTimeUtc.Ticks），見 Get-DebugLogTimes
    [hashtable]$LogTimes0 = $null,
    [string]$LogDirRel = 'BetterAgentTerminal\Logs\'
  )
  $Added = @($Added | Where-Object { $_ }); $Removed = @($Removed | Where-Object { $_ }); $Changed = @($Changed | Where-Object { $_ })
  $re = '^' + [regex]::Escape($LogDirRel) + 'debug-[^\\]*\.log$'
  $notes = New-Object System.Collections.ArrayList
  $actual = "新增 $($Added.Count) / 刪除 $($Removed.Count) / 變更 $($Changed.Count)"
  if ($Added.Count + $Removed.Count + $Changed.Count -eq 0) { return [pscustomobject]@{ result = 'PASS'; actual = $actual; notes = @() } }

  $addedLogs = @($Added | Where-Object { $_ -match $re })
  $removedLogs = @($Removed | Where-Object { $_ -match $re })
  # debug log 被改內容也不在容許範圍（請求程序只建新檔、刪最舊的）
  $outside = @(@($Changed) + @($Added | Where-Object { $_ -notmatch $re }) + @($Removed | Where-Object { $_ -notmatch $re }))
  foreach ($x in $outside) { [void]$notes.Add("userData 差異（超出容許範圍）：$x") }
  $result = 'PASS'
  if ($outside.Count -gt 0) { $result = 'FAIL' }
  if ($addedLogs.Count -gt 1) { $result = 'FAIL'; [void]$notes.Add("debug log 新增 $($addedLogs.Count) 份（容許 ≤ 1）：$($addedLogs -join ', ')") }
  if ($removedLogs.Count -gt 1) { $result = 'FAIL'; [void]$notes.Add("debug log 刪除 $($removedLogs.Count) 份（容許 ≤ 1）：$($removedLogs -join ', ')") }
  if ($removedLogs.Count -eq 1 -and $addedLogs.Count -eq 0) { $result = 'FAIL'; [void]$notes.Add("debug log 刪除但沒有新增，不是輪替：$($removedLogs[0])") }
  if ($result -eq 'FAIL') {
    foreach ($x in @($addedLogs + $removedLogs)) { [void]$notes.Add("userData 差異：$x") }
    return [pscustomobject]@{ result = 'FAIL'; actual = $actual; notes = $notes.ToArray() }
  }

  foreach ($x in $addedLogs) { [void]$notes.Add("debug log 新增：$x — 解除安裝程式啟動 --uninstall-quit-request（T0860），屬預期") }
  if ($removedLogs.Count -eq 1) {
    $r = $removedLogs[0]
    $logs0 = @()
    if ($null -ne $LogTimes0) { $logs0 = @($LogTimes0.Keys | Where-Object { $_ -match $re }) }
    if ($null -eq $LogTimes0 -or -not $LogTimes0.ContainsKey($r)) {
      $result = 'WARN'
      [void]$notes.Add("debug log 刪除：$r — ⓪ 沒有這份的修改時間，無法確認是最舊的那份（不放寬為 PASS）")
    } else {
      $oldest = @($logs0 | Sort-Object { [int64]$LogTimes0[$_] }, { $_ }) | Select-Object -First 1
      if ([int64]$LogTimes0[$r] -le [int64]$LogTimes0[$oldest]) {
        [void]$notes.Add("debug log 輪替刪除：$r — ⓪ 時 $($logs0.Count) 份中修改時間最舊的一份（保留最近 10 個，electron/logger.ts），屬預期")
      } else {
        $result = 'FAIL'
        [void]$notes.Add("debug log 刪除：$r — 不是 ⓪ 時修改時間最舊的那份（最舊：$oldest），不是輪替")
      }
    }
  }
  return [pscustomobject]@{ result = $result; actual = $actual; notes = $notes.ToArray() }
}

function Get-DebugLogTimes([string[]]$Dirs) {
  # ⓪ 時各 userData 目錄 Logs\ 下（不含子目錄）debug-*.log 的修改時間；檔名規則同 electron/logger.ts（debug- 開頭、.log 結尾）
  $map = @{}
  foreach ($d in $Dirs) {
    $logs = Join-Path $d 'Logs'
    foreach ($f in @(Get-ChildItem -LiteralPath $logs -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^debug-.*\.log$' })) {
      $map["$(Split-Path -Leaf $d)\Logs\$($f.Name)"] = $f.LastWriteTimeUtc.Ticks
    }
  }
  return $map
}

function Get-ShortcutPaths([string]$InstallScope) {
  if ($InstallScope -eq 'AllUsers') {
    return @{ desktop = (Join-Path $env:PUBLIC "Desktop\$ProductName.lnk"); startMenu = (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\$ProductName.lnk") }
  }
  return @{ desktop = (Join-Path ([Environment]::GetFolderPath('Desktop')) "$ProductName.lnk"); startMenu = (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$ProductName.lnk") }
}

# ---------------------------------------------------------------- PTY holder（T0862 / PLAN-065，docs/agent-guide/pty-holder.md）
# 安裝目錄有 resources\pty-holder\holder-manifest.json 的版本才檢查；沒有的版本（PLAN-065 前）照舊判讀、只記一行。
$ServerFileNames = @('bat-pty-server.pid', 'bat-pty-server.port', 'bat-pty-server.token', 'bat-pty-registry.json')
$script:IgnoreServerFiles = $false
function Select-WithoutServerFiles([hashtable]$Map) {
  $out = @{}
  foreach ($k in $Map.Keys) { if ($ServerFileNames -notcontains (Split-Path -Leaf $k)) { $out[$k] = $Map[$k] } }
  return $out
}

function Get-HolderRoot([string]$InstallScope) {
  # 與 build/installer.nsh 相同：per-machine $PROGRAMFILES64\BAT-PtyHolder、per-user $LOCALAPPDATA\BAT-PtyHolder
  if ($InstallScope -eq 'AllUsers') { return (Join-Path $(if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles }) 'BAT-PtyHolder') }
  return (Join-Path $env:LOCALAPPDATA 'BAT-PtyHolder')
}

function Get-PackagedHolderManifest([string]$Dir) {
  $m = Join-Path $Dir 'resources\pty-holder\holder-manifest.json'
  if (Test-Path -LiteralPath $m) { return $m }
  return $null
}

function Test-HolderRootOverlap([string]$Root, [string]$Dir) {
  # 安裝程式的規則：互為字串前綴（不分大小寫、任一方向、不加 \）→ 不複製、不清理
  $r = $Root.TrimEnd('\'); $d = $Dir.TrimEnd('\')
  return ($r.StartsWith($d, [StringComparison]::OrdinalIgnoreCase) -or $d.StartsWith($r, [StringComparison]::OrdinalIgnoreCase))
}

function Get-HolderProcesses([string]$Root) {
  # 執行檔在 holder 根目錄下的程序（holder 本身）與它的子程序（分頁的 shell、conhost）；只記名稱與 PID
  $list = New-Object System.Collections.ArrayList
  if (-not $Root -or -not (Test-Path -LiteralPath $Root)) { return $list.ToArray() }
  $prefix = $Root.TrimEnd('\') + '\'
  $all = @(Get-CimInstance Win32_Process)
  foreach ($h in $all) {
    $exe = Get-Prop $h 'ExecutablePath'
    if (-not ($exe -and $exe.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) { continue }
    $children = @($all | Where-Object { $_.ParentProcessId -eq $h.ProcessId } | ForEach-Object { [ordered]@{ name = $_.Name; pid = $_.ProcessId } })
    [void]$list.Add([ordered]@{ name = $h.Name; pid = $h.ProcessId; dir = (Split-Path -Leaf (Split-Path -Parent $exe)); children = $children })
  }
  return $list.ToArray()
}

function Test-HolderState($Step, [string]$InstallScope, [string]$Dir) {
  $m = Get-PackagedHolderManifest $Dir
  if (-not $m) { Add-Note $Step 'PTY holder：此版本沒有 resources\pty-holder（PLAN-065 前的版本），略過 holder 檢查'; return }
  $key = "$((Get-Content -LiteralPath $m -Raw | ConvertFrom-Json).key)"
  $root = Get-HolderRoot $InstallScope
  if (Test-HolderRootOverlap $root $Dir) {
    Add-Note $Step "PTY holder：根目錄 $root 與安裝目錄互為前綴，安裝程式不複製（BAT 改用原本的 Terminal Server）"
    return
  }
  $copy = Join-Path $root "$key\holder-manifest.json"
  $same = (Test-Path -LiteralPath $copy) -and ((Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $m -Algorithm SHA256).Hash)
  Add-Check $Step "PTY holder 目錄（$key）" $(if ($same) { 'PASS' } else { 'FAIL' }) "$root\$key\holder-manifest.json 與安裝目錄那份位元組相同" $(if (Test-Path -LiteralPath $copy) { $(if ($same) { '相同' } else { '不同' }) } else { '不存在' }) 'customInstall 把 holder 複製到安裝目錄外（T0858）'
  $exeOk = Test-Path -LiteralPath (Join-Path $root "$key\bat-pty-holder.exe")
  Add-Check $Step 'PTY holder 執行檔' $(if ($exeOk) { 'PASS' } else { 'FAIL' }) "$key\bat-pty-holder.exe 存在" $(if ($exeOk) { '存在' } else { '不存在' }) ''
  $inUse = @(Get-HolderProcesses $root)
  foreach ($d in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne $key })) {
    $running = @($inUse | Where-Object { $_.dir -eq $d.Name })
    if ($running.Count -gt 0) { Add-Note $Step "PTY holder：其他目錄 $($d.Name) 有程序在跑（$($running.Count) 個），保留（D9）" }
    else { Add-Check $Step "PTY holder 其他目錄 $($d.Name)" 'WARN' '沒有程序在跑的其他目錄已被刪除' '仍存在' 'customInstall 刪除根目錄下沒有程序在跑的其他目錄（D9）' }
  }
}

function Find-NodeForHelpers([string]$Dir) {
  $n = Get-Command node -ErrorAction SilentlyContinue
  if ($n) { return [pscustomobject]@{ kind = 'node'; path = $n.Source } }
  return [pscustomobject]@{ kind = 'electron-as-node'; path = (Join-Path $Dir "$ProductName.exe") }
}

function Invoke-Helper($NodeInfo, [string]$Helper) {
  # T0745：helper 一啟動（含 --version）就 append 一筆到 bat-scripts.log。位置依 scripts/_bat-logger.mjs：
  # BAT_HELPER_LOG_DIR（絕對路徑）> BAT_USER_DATA\Logs > %APPDATA%\BetterAgentTerminal\Logs。
  # 在 BAT 外執行時落在 userData，② / ④ 的 userData SHA-256 比對就會把腳本自己的寫入判成 FAIL。
  # 只在這次子程序執行期間設定（本腳本程序的 Process 範圍，結束即還原），不改使用者環境。
  $set = [ordered]@{ BAT_HELPER_LOG_DIR = $HelperLogDir }
  if ($NodeInfo.kind -ne 'node') { $set['ELECTRON_RUN_AS_NODE'] = '1' }
  $saved = @{}
  foreach ($k in @($set.Keys)) {
    $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
    [Environment]::SetEnvironmentVariable($k, $set[$k], 'Process')
  }
  try { return Invoke-Native $NodeInfo.path @($Helper, '--version') }
  finally { foreach ($k in @($saved.Keys)) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') } }
}

function Get-HelperLogLineCount {
  $f = Join-Path $HelperLogDir 'bat-scripts.log'
  if (-not (Test-Path -LiteralPath $f)) { return 0 }
  return @(Get-Content -LiteralPath $f -ErrorAction SilentlyContinue).Count
}

# $SnapshotBaseline：快照基準的說明（T0869 / D293）。② 用 ⓪ 的快照、④ 用 ③ 結束時的快照；規則都是完全相同才 PASS。
function Test-InstalledState($Step, [string]$InstallScope, [string]$Dir, [hashtable]$SnapshotBefore, [bool]$DesktopExpected, [string]$SnapshotBaseline = '⓪ 的') {
  $inst = @(Find-Installations | Where-Object { $_.scope -eq $InstallScope })
  $rule = 'uninstall 鍵在 ⓪ 判定的 hive、DisplayVersion = 版本'
  if ($inst.Count -eq 1) {
    Add-Check $Step 'uninstall 鍵 DisplayVersion' $(if ($inst[0].displayVersion -eq $Version) { 'PASS' } else { 'FAIL' }) $Version $inst[0].displayVersion $rule
    Add-Check $Step '安裝路徑（Software\<GUID>\InstallLocation）' $(if ($inst[0].installDir.TrimEnd('\') -eq $Dir.TrimEnd('\')) { 'PASS' } else { 'FAIL' }) $Dir "$($inst[0].installDir)（來源 $($inst[0].installDirSource)）" '與 ⓪ 的路徑相同'
  } else {
    Add-Check $Step 'uninstall 鍵' 'FAIL' "$InstallScope 範圍恰好 1 個" "$($inst.Count) 個" $rule
  }
  $other = @(Find-Installations | Where-Object { $_.scope -ne $InstallScope })
  Add-Check $Step '另一範圍沒有安裝紀錄' $(if ($other.Count -eq 0) { 'PASS' } else { 'WARN' }) '0' "$($other.Count)" '覆蓋安裝不得產生第二份（per-user / per-machine 並存）'

  $exe = Join-Path $Dir "$ProductName.exe"
  if (Test-Path -LiteralPath $exe) {
    $fv = (Get-Item -LiteralPath $exe).VersionInfo.FileVersion
    Add-Check $Step '主程式 FileVersion' $(if ($fv -eq $Version) { 'PASS' } else { 'FAIL' }) $Version $fv '主程式執行 --version 會開啟 GUI，改讀檔案版本資訊'
  } else { Add-Check $Step '主程式存在' 'FAIL' $exe '不存在' '' }

  $res = Join-Path $Dir 'resources'
  $pkgPath = Join-Path $res 'package.json'
  if (Test-Path -LiteralPath $pkgPath) {
    $pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
    $keys = (@($pkg.PSObject.Properties | ForEach-Object { $_.Name }) | Sort-Object) -join ','
    Add-Check $Step 'resources/package.json' $(if ((Get-Prop $pkg 'version') -eq $Version -and $keys -eq 'name,version') { 'PASS' } else { 'FAIL' }) "version=$Version, keys=name,version" "version=$(Get-Prop $pkg 'version'), keys=$keys" 'T0691：只含 name / version'
  } else { Add-Check $Step 'resources/package.json' 'FAIL' '存在' '不存在' '' }

  $nodeInfo = Find-NodeForHelpers $Dir
  $envDesc = "BAT_HELPER_LOG_DIR=$HelperLogDir$(if ($nodeInfo.kind -ne 'node') { '、ELECTRON_RUN_AS_NODE=1' })"
  $helperLogBefore = Get-HelperLogLineCount
  foreach ($h in $HelperNames) {
    $hp = Join-Path $res "scripts\$h"
    if (-not (Test-Path -LiteralPath $hp)) { Add-Check $Step "$h --version" 'FAIL' "v$Version" '檔案不存在' ''; continue }
    Add-Note $Step "helper 指令：`"$($nodeInfo.path)`" `"$hp`" --version（子程序環境：$envDesc）"
    $r = Invoke-Helper $nodeInfo $hp
    $ok = ($r.exitCode -eq 0 -and $r.output -match [regex]::Escape("v$Version"))
    Add-Check $Step "$h --version" $(if ($ok) { 'PASS' } else { 'FAIL' }) "exit 0, v$Version" "exit $($r.exitCode), $($r.output.Trim())" "以 $($nodeInfo.kind) 執行"
  }
  Add-Note $Step ("helper 日誌導向：{0}（本步驟新增 {1} 行；helper 檢查不寫入 userData 的 Logs\bat-scripts.log）" -f (Join-Path $HelperLogDir 'bat-scripts.log'), ((Get-HelperLogLineCount) - $helperLogBefore))

  $claude = Join-Path $res 'app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe'
  $claudeOk = (Test-Path -LiteralPath $claude) -and ((Get-Item -LiteralPath $claude).Length -gt 1MB)
  Add-Check $Step '內嵌 claude' $(if ($claudeOk) { 'PASS' } else { 'FAIL' }) 'claude-code\bin\claude.exe 存在且 > 1 MiB' $(if (Test-Path -LiteralPath $claude) { "$((Get-Item -LiteralPath $claude).Length) bytes" } else { '不存在' }) 'Windows 只用 claude-code/bin/claude.exe（T0546 C1）'
  $codex = @(Get-ChildItem -Path (Join-Path $res 'app.asar.unpacked\node_modules\@openai') -Filter 'codex.exe' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '\\codex-win32-[^\\]+\\vendor\\[^\\]+\\bin\\codex\.exe$' })
  Add-Check $Step '內嵌 codex' $(if ($codex.Count -ge 1) { 'PASS' } else { 'FAIL' }) '@openai\codex-win32-<arch>\vendor\<triple>\bin\codex.exe' $(if ($codex.Count -ge 1) { "$($codex[0].Length) bytes" } else { '不存在' }) ''

  $sc = Get-ShortcutPaths $InstallScope
  Add-Check $Step '開始功能表捷徑' $(if (Test-Path -LiteralPath $sc.startMenu) { 'PASS' } else { 'FAIL' }) $sc.startMenu $(if (Test-Path -LiteralPath $sc.startMenu) { '存在' } else { '不存在' }) 'createStartMenuShortcut 預設開'
  $deskNow = Test-Path -LiteralPath $sc.desktop
  Add-Check $Step '桌面捷徑' $(if ($deskNow -eq $DesktopExpected) { 'PASS' } else { 'WARN' }) $(if ($DesktopExpected) { '存在' } else { '不存在' }) $(if ($deskNow) { '存在' } else { '不存在' }) '覆蓋安裝沿用 ⓪ 的狀態（KeepShortcuts）；乾淨重裝預設建立'

  $running = @(Get-RelatedProcesses $Dir)
  Add-Check $Step '安裝後沒有自動啟動 BAT' $(if ($running.Count -eq 0) { 'PASS' } else { 'WARN' }) '0' "$($running.Count)" '靜默安裝不帶 --force-run 不會啟動'

  Test-HolderState $Step $InstallScope $Dir

  if ($null -ne $SnapshotBefore) {
    $diff = Compare-Snapshot $SnapshotBefore (Get-UserDataSnapshot (Get-UserDataDirs))
    Add-Check $Step 'userData 未被改動' $(if ($diff.same) { 'PASS' } else { 'FAIL' }) "與 $SnapshotBaseline SHA-256 快照相同" "新增 $($diff.added.Count) / 刪除 $($diff.removed.Count) / 變更 $($diff.changed.Count)" "逐檔 SHA-256 + 大小；基準 = $SnapshotBaseline 快照；任何差異 FAIL"
    foreach ($x in ($diff.added + $diff.removed + $diff.changed | Select-Object -First 30)) { Add-Note $Step "userData 差異：$x" }
  }
}

function Wait-Until([scriptblock]$Condition, [int]$TimeoutSec, [int]$IntervalMs = 1000) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds $IntervalMs
  }
  return [bool](& $Condition)
}

function Invoke-Installer($Step, [string]$Installer, [string]$Arguments) {
  Add-Command $Step "Start-Process -FilePath `"$Installer`" -ArgumentList '$Arguments' -Wait -PassThru"
  Add-Note $Step '判讀：exit code 0 = 成功；計時 = Start-Process 開始到安裝程式結束'
  if ($DryRun) { return }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $Installer -ArgumentList $Arguments -Wait -PassThru
  $sw.Stop()
  $Step.durationSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  Add-Check $Step '安裝程式 exit code' $(if ($p.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }) '0' "$($p.ExitCode)" ''
  Add-Note $Step "安裝耗時 $($Step.durationSec) s"
  if ($sw.Elapsed.TotalSeconds -gt $InstallTimeoutSec) { Add-Check $Step '安裝耗時上限' 'WARN' "≤ $InstallTimeoutSec s" "$($Step.durationSec) s" '' }
}

# ================================================================ ⓪ 前置檢查
$s0 = New-Step '⓪' '前置檢查'
Add-Note $s0 "輸出目錄：$OutDir"
if ($PSVersionTable.PSVersion.Major -lt 5) { Stop-Acceptance '需要 Windows PowerShell 5.1 或 PowerShell 7' }
Add-Note $s0 "PowerShell $($PSVersionTable.PSVersion)（$($PSVersionTable.PSEdition)）；系統管理員 = $IsAdmin"
if ($env:BAT_SESSION -or $env:BAT_TERMINAL_ID) {
  Add-Check $s0 '不在 BAT 分頁內執行' $(if ($DryRun) { 'WARN' } else { 'FAIL' }) '沒有 BAT_SESSION / BAT_TERMINAL_ID' '偵測到 BAT 分頁環境變數' '實際模式必須從 BAT 以外的一般 PowerShell 執行'
}

$all = @(Find-Installations)
foreach ($i in $all) { Add-Note $s0 "安裝紀錄：$($i.hive) $($i.displayName) DisplayVersion=$($i.displayVersion) 路徑=$($i.installDir)（來源 $($i.installDirSource)）" }
$inst = $null
if ($Scope -ne 'Auto') { $inst = @($all | Where-Object { $_.scope -eq $Scope }) | Select-Object -First 1 }
elseif ($all.Count -eq 1) { $inst = $all[0] }
$scopeRule = 'uninstall 鍵在 HKLM = AllUsers（/allusers），在 HKCU = CurrentUser（/currentuser）；兩邊都有時須以 -Scope 指定'
if ($null -eq $inst) {
  Add-Check $s0 '安裝範圍判定' 'FAIL' '恰好一個安裝紀錄（或以 -Scope 指定）' "$($all.Count) 個" $scopeRule
  Complete-Step $s0
  if (-not $DryRun) { Stop-Acceptance '無法判定安裝範圍' }
} else {
  Add-Check $s0 '安裝範圍判定' 'PASS' 'HKLM 或 HKCU 恰好一個' "$($inst.scope)（$($inst.hive)，$($inst.uninstallKey)）" $scopeRule
  Add-Check $s0 '目前安裝版本' $(if ($inst.displayVersion -eq $Version) { 'PASS' } else { 'WARN' }) $Version $inst.displayVersion '② 是同版本覆蓋安裝；版本不同時 ② 實際上是升 / 降級'
  $Report.installation = $inst
  if ($inst.scope -eq 'AllUsers' -and -not $IsAdmin) {
    Add-Check $s0 '系統管理員權限' $(if ($DryRun) { 'WARN' } else { 'FAIL' }) '是（per-machine 安裝 / 解除安裝需要 UAC）' '否' '請以「以系統管理員身分執行」開啟 PowerShell 再執行；腳本不自動提權'
  } else {
    Add-Check $s0 '系統管理員權限' 'PASS' $(if ($inst.scope -eq 'AllUsers') { '是' } else { '不需要' }) $IsAdmin ''
  }

  $procs = @(Get-RelatedProcesses $inst.installDir)
  $byName = ($procs | Group-Object { $_.name } | ForEach-Object { "$($_.Name)×$($_.Count)" }) -join ', '
  Add-Check $s0 '沒有從安裝目錄執行的程序' $(if ($procs.Count -eq 0) { 'PASS' } else { 'FAIL' }) '0' "$($procs.Count)（$byName）" '執行檔位於安裝目錄（BAT、Terminal Server、內嵌 claude / codex），或命令列引用安裝目錄（helper 腳本）'
  foreach ($p in $procs) { Add-Note $s0 "執行中：$($p.name) PID=$($p.pid) $($p.kind) $($p.path)" }
  if ($procs.Count -gt 0) {
    if ($DryRun) {
      Add-Note $s0 '實際模式會在此中止（不自動結束程序；除非帶 -StopRunning 並輸入 STOP 確認）'
    } elseif ($StopRunning) {
      Write-Host ''
      Write-Host "以下 $($procs.Count) 個程序會被結束（先嘗試正常關閉視窗，15 秒後強制結束程序樹）：" -ForegroundColor Yellow
      foreach ($p in $procs) { Write-Host "  $($p.name) PID=$($p.pid)" }
      $answer = Read-Host '輸入 STOP 確認'
      if ($answer -ne 'STOP') { Complete-Step $s0; Stop-Acceptance '使用者未確認結束程序' }
      foreach ($p in $procs) { try { [void](Get-Process -Id $p.pid -ErrorAction Stop).CloseMainWindow() } catch { } }
      [void](Wait-Until { @(Get-RelatedProcesses $inst.installDir).Count -eq 0 } 15)
      foreach ($p in @(Get-RelatedProcesses $inst.installDir)) { [void](Invoke-Native 'taskkill.exe' @('/F', '/T', '/PID', "$($p.pid)")) }
      [void](Wait-Until { @(Get-RelatedProcesses $inst.installDir).Count -eq 0 } 15)
      $left = @(Get-RelatedProcesses $inst.installDir)
      Add-Check $s0 '-StopRunning 後沒有殘留程序' $(if ($left.Count -eq 0) { 'PASS' } else { 'FAIL' }) '0' "$($left.Count)" ''
    } else {
      Complete-Step $s0
      Stop-Acceptance "仍有 $($procs.Count) 個程序從安裝目錄執行（$byName）。請完全關閉 BAT（含 Terminal Server）後重跑，或加 -StopRunning"
    }
  }
}

# T0862：PTY holder。holder 不在安裝目錄內，上面的檢查看不到它；BAT 關閉時選了保留 Terminal Server 的話它還在跑（含分頁的 shell）。
$holderVersion0 = $false
$holderRun0 = @()
if ($null -ne $inst) {
  $holderVersion0 = [bool](Get-PackagedHolderManifest $inst.installDir)
  $holderRoot0 = Get-HolderRoot $inst.scope
  if (-not $holderVersion0) {
    Add-Note $s0 'PTY holder：目前安裝的版本沒有 holder，holder 檢查只記錄、不判讀'
  } else {
    $holderRun0 = @(Get-HolderProcesses $holderRoot0)
    Add-Note $s0 "PTY holder 根目錄：$holderRoot0（$(@(Get-ChildItem -LiteralPath $holderRoot0 -Directory -ErrorAction SilentlyContinue).Count) 個目錄）"
    foreach ($h in $holderRun0) { Add-Note $s0 "執行中的 PTY holder：$($h.name) PID=$($h.pid)（$($h.dir)），子程序 $(($h.children | ForEach-Object { "$($_.name) $($_.pid)" }) -join ', ')" }
    if ($holderRun0.Count -gt 0) {
      $script:IgnoreServerFiles = $true
      Add-Note $s0 '有執行中的 PTY holder（保留的 Terminal Server 與分頁）：② 覆蓋安裝後檢查這些 PID 不變；③ 真的解除安裝會結束它們並刪除 holder 根目錄（T0860）；userData 比對不含 Terminal Server 自己的 pid / port / token / registry 檔'
    }
  }
}

$udDirs = @(Get-UserDataDirs)
$Report.userDataDirs = $udDirs
$snapshot0 = $null
$script:DebugLogTimes0 = $null
foreach ($d in $udDirs) {
  $files = @(Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue)
  Add-Note $s0 ("userData：{0}（{1} 檔，{2:N1} MiB）" -f $d, $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB))
}
if ($udDirs.Count -eq 0) { Add-Check $s0 'userData 存在' 'WARN' "%APPDATA%\$ProductName*" '找不到' '沒有 userData 時無法驗證「解除安裝保留 userData」' }
foreach ($d in $udDirs) { Add-Command $s0 "robocopy `"$d`" `"$(Join-Path $BackupDir (Split-Path -Leaf $d))`" /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS" }
Add-Note $s0 '判讀：robocopy exit < 8 且備份檔數 = 來源檔數；之後對 userData 逐檔取 SHA-256 快照，② ③ 後與它比對；④ 與 ③ 結束時的快照比對（T0869）'
if (-not $DryRun) {
  if (@($s0.checks | Where-Object { $_.result -eq 'FAIL' }).Count -gt 0) { Complete-Step $s0; Stop-Acceptance '前置檢查未通過' }
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  foreach ($d in $udDirs) {
    $dest = Join-Path $BackupDir (Split-Path -Leaf $d)
    $r = Invoke-Native 'robocopy.exe' @($d, $dest, '/E', '/COPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS')
    $srcCount = @(Get-ChildItem -LiteralPath $d -Recurse -File -Force).Count
    $dstCount = @(Get-ChildItem -LiteralPath $dest -Recurse -File -Force).Count
    Add-Check $s0 "備份 $(Split-Path -Leaf $d)" $(if ($r.exitCode -lt 8 -and $srcCount -eq $dstCount) { 'PASS' } else { 'FAIL' }) "robocopy < 8，$srcCount 檔" "robocopy $($r.exitCode)，$dstCount 檔" ''
  }
  $Report.backupDir = $BackupDir
  Add-Note $s0 "userData 備份：$BackupDir（含 server-token.json 等權杖檔，驗收結束後請刪除）"
  $snapshot0 = Get-UserDataSnapshot $udDirs
  # T0868：③ 判斷被輪替刪除的 debug log 是不是最舊的那份（快照只有大小與雜湊）
  $script:DebugLogTimes0 = Get-DebugLogTimes $udDirs
  $unreadable = @($snapshot0.Values | Where-Object { $_ -like '*:unreadable' }).Count
  Add-Check $s0 'userData SHA-256 快照' $(if ($unreadable -eq 0) { 'PASS' } else { 'WARN' }) '全部可讀' "$($snapshot0.Count) 檔，無法讀取 $unreadable" '無法讀取通常代表檔案仍被開著（BAT 未完全關閉）'
}
if ($DryRun -and $udDirs.Count -gt 0) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $snapDry = Get-UserDataSnapshot $udDirs
  $sw.Stop()
  $unreadableDry = @($snapDry.Values | Where-Object { $_ -like '*:unreadable' }).Count
  Add-Note $s0 ("(dry-run) 唯讀試算 SHA-256 快照：{0} 檔、無法讀取 {1}、耗時 {2:N1} s（BAT 執行中時被開著的檔案讀不到；實際模式 BAT 已關閉，預期 0）" -f $snapDry.Count, $unreadableDry, $sw.Elapsed.TotalSeconds)
}
$desktop0 = $false
if ($null -ne $inst) { $desktop0 = Test-Path -LiteralPath (Get-ShortcutPaths $inst.scope).desktop; Add-Note $s0 "桌面捷徑（$($inst.scope)）：$(if ($desktop0) { '存在' } else { '不存在' })" }
Complete-Step $s0
if (-not $DryRun -and $s0.result -eq 'FAIL') { Stop-Acceptance '前置檢查未通過' }

# ================================================================ ① 安裝檔
$s1 = New-Step '①' "取得 $Tag 安裝檔並驗證雜湊"
$expectedSha256 = $ExpectedSha256.ToLowerInvariant()
$expectedSize = $null
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $expectedSha256) {
  if (-not $gh) { Add-Check $s1 'gh CLI' 'FAIL' '可用（或以 -ExpectedSha256 提供雜湊）' '找不到 gh' '' }
  else {
    Add-Command $s1 "gh release view $Tag -R $Repo --json assets"
    $r = Invoke-Native $gh.Source @('release', 'view', $Tag, '-R', $Repo, '--json', 'assets')
    if ($r.exitCode -ne 0) { Add-Check $s1 'gh release view' 'FAIL' 'exit 0' "exit $($r.exitCode)：$($r.output)" '' }
    else {
      $assets = @(($r.output | ConvertFrom-Json).assets)
      $a = @($assets | Where-Object { $_.name -eq $AssetName }) | Select-Object -First 1
      $hasLatestYml = @($assets | Where-Object { $_.name -eq 'latest.yml' }).Count -gt 0
      Add-Note $s1 "release 資產內 latest.yml：$(if ($hasLatestYml) { '有' } else { '沒有（release 只上傳 exe / zip，見 docs/agent-guide/packaging-release-checks.md「NSIS 差分打包關閉」）→ 以 GitHub 計算的 asset digest（sha256）驗證' })"
      if ($null -eq $a) { Add-Check $s1 'release 資產' 'FAIL' $AssetName '找不到' '' }
      else {
        $digest = "$(Get-Prop $a 'digest')"
        if ($digest -match '^sha256:([0-9a-fA-F]{64})$') { $expectedSha256 = $Matches[1].ToLowerInvariant() }
        $expectedSize = [int64](Get-Prop $a 'size')
        Add-Note $s1 "asset digest：$digest，size $expectedSize"
        if (-not $expectedSha256) { Add-Check $s1 'asset digest' 'FAIL' 'sha256:<64 hex>' $digest '' }
      }
    }
  }
}
if (-not $InstallerPath) {
  $InstallerPath = Join-Path $OutDir $AssetName
  if ($gh) {
    Add-Command $s1 "gh release download $Tag -R $Repo -p `"$AssetName`" -D `"$OutDir`" --clobber"
    Add-Note $s1 '下載只寫入輸出目錄（-DryRun 也會下載，供實際執行時以 -InstallerPath 重用）'
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-Native $gh.Source @('release', 'download', $Tag, '-R', $Repo, '-p', $AssetName, '-D', $OutDir, '--clobber')
    $sw.Stop()
    Add-Check $s1 'gh release download' $(if ($r.exitCode -eq 0) { 'PASS' } else { 'FAIL' }) 'exit 0' "exit $($r.exitCode)" ''
    Add-Note $s1 ("下載耗時 {0:N1} s" -f $sw.Elapsed.TotalSeconds)
  }
} else { Add-Note $s1 "使用 -InstallerPath：$InstallerPath" }
if (Test-Path -LiteralPath $InstallerPath) {
  $InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path
  $size = (Get-Item -LiteralPath $InstallerPath).Length
  $sha256 = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $sha512hex = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA512).Hash
  $bytes = New-Object byte[] ([int]($sha512hex.Length / 2))
  for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($sha512hex.Substring($i * 2, 2), 16) }
  $sha512b64 = [Convert]::ToBase64String($bytes)
  $Report.installer = [ordered]@{ path = $InstallerPath; size = $size; sha256 = $sha256; sha512Base64 = $sha512b64 }
  Add-Note $s1 "sha512（base64，latest.yml 格式）：$sha512b64"
  if ($expectedSha256) { Add-Check $s1 'SHA-256' $(if ($sha256 -eq $expectedSha256) { 'PASS' } else { 'FAIL' }) $expectedSha256 $sha256 'GitHub asset digest 或 -ExpectedSha256' }
  else { Add-Check $s1 'SHA-256' 'FAIL' '有預期值' '沒有預期值可比對' '' }
  if ($null -ne $expectedSize) { Add-Check $s1 '檔案大小' $(if ($size -eq $expectedSize) { 'PASS' } else { 'FAIL' }) $expectedSize $size '' }
} else { Add-Check $s1 '安裝檔存在' 'FAIL' $InstallerPath '不存在' '' }
Complete-Step $s1
if (-not $DryRun -and $s1.result -eq 'FAIL') { Stop-Acceptance '安裝檔取得或驗證失敗' }

if ($null -eq $inst) {
  $Report.result = $(if ($DryRun) { 'DRYRUN-INCOMPLETE' } else { 'FAIL' })
  Save-Report
  exit $(if ($DryRun) { 0 } else { 1 })
}
$installScope = $inst.scope
$installDir = $inst.installDir.TrimEnd('\')
$installArgs = Get-InstallArgs $installScope $installDir

# ================================================================ ② 預檢（只在 -DryRun）
if ($DryRun) {
  $s2p = New-Step '②p' '安裝後檢查邏輯試跑（唯讀，對象是目前已安裝的版本）'
  Add-Note $s2p '只在 -DryRun 執行：用 ②④ 的同一組檢查讀現有安裝，確認檢查本身可用；userData 比對略過；BAT 執行中，「沒有自動啟動」預期 WARN'
  Test-InstalledState $s2p $inst.scope $inst.installDir.TrimEnd('\') $null $desktop0
  Complete-Step $s2p
}

# ================================================================ ② 覆蓋安裝
$s2 = New-Step '②' '覆蓋安裝（同版本）'
Add-Note $s2 "安裝範圍依據：⓪ 的 uninstall 鍵在 $($inst.hive) → $installScope；路徑依據：$($inst.installDirSource)"
Invoke-Installer $s2 $InstallerPath $installArgs
if ($DryRun) {
  Add-Note $s2 '安裝後檢查：uninstall 鍵 DisplayVersion、InstallLocation、主程式 FileVersion、resources/package.json、3 個 helper --version、內嵌 claude / codex、捷徑、沒有自動啟動、userData 與 ⓪ 的 SHA-256 快照相同'
  Add-Note $s2 "helper --version 執行時子程序帶 BAT_HELPER_LOG_DIR=$HelperLogDir，helper 的 bat-scripts.log 寫到報告目錄，不寫入 userData（T0745；④ 相同）"
} else {
  Test-InstalledState $s2 $installScope $installDir $snapshot0 $desktop0 '⓪ 的'
}
if ($holderRun0.Count -gt 0) {
  # T0862：holder 在安裝目錄外，覆蓋安裝不結束它；分頁的 shell（holder 的子程序）PID 也不變
  $pidRule = '覆蓋安裝不結束安裝目錄外的 PTY holder 與它的分頁（T0860 / T0861）'
  if ($DryRun) { Add-Note $s2 "安裝後檢查：執行中的 PTY holder 與子程序 PID 不變（$($holderRun0.Count) 個 holder）" }
  else {
    $alive = @(Get-CimInstance Win32_Process | ForEach-Object { $_.ProcessId })
    foreach ($h in $holderRun0) {
      $ids = @($h.pid) + @($h.children | Where-Object { $_.name -notmatch '^conhost\.exe$' } | ForEach-Object { $_.pid })
      $gone = @($ids | Where-Object { $alive -notcontains $_ })
      Add-Check $s2 "PTY holder PID $($h.pid) 與分頁 shell PID 不變" $(if ($gone.Count -eq 0) { 'PASS' } else { 'FAIL' }) "$($ids.Count) 個 PID 仍在" "結束 $($gone.Count) 個：$($gone -join ', ')" $pidRule
    }
  }
}
Complete-Step $s2
if (-not $DryRun -and $s2.result -eq 'FAIL') { Stop-Acceptance '覆蓋安裝檢查失敗' }

# ================================================================ ③ 解除安裝
$s3 = New-Step '③' '解除安裝（靜默）'
# T0869 / D293：③ 的 userData 判讀為 PASS / WARN 時保存判讀用的那份快照，④ 以它為基準（不重算 ③ 已容許的差異）
$snapshot3 = $null
# T0868：holder 檢查依解除安裝前的版本（實際模式 = ② 裝上的版本），不依 ⓪ 時安裝的版本：
# ⓪ 是沒有 holder 的舊版、② 裝上有 holder 的版本時，③ 正是要驗 holder 結束與根目錄刪除的路徑。來源與 ② 的 Test-HolderState 相同。
$holderVersion3 = [bool](Get-PackagedHolderManifest $installDir)
$holderRoot3 = Get-HolderRoot $installScope
$holderRun3 = @()
$versionSource3 = $(if ($DryRun) { '演練讀目前安裝的版本，實際模式讀 ② 裝上的版本' } else { '② 裝上的版本' })
if (-not $holderVersion3) {
  Add-Note $s3 "PTY holder（依解除安裝前的版本：$versionSource3）：沒有 resources\pty-holder，略過 holder 檢查"
} elseif (Test-HolderRootOverlap $holderRoot3 $installDir) {
  Add-Note $s3 "PTY holder（依解除安裝前的版本：$versionSource3）：有 holder；根目錄 $holderRoot3 與安裝目錄互為前綴，安裝程式不碰"
} else {
  $holderRun3 = @(Get-HolderProcesses $holderRoot3)
  Add-Note $s3 "PTY holder（依解除安裝前的版本：$versionSource3）：有 holder；根目錄 $holderRoot3，執行中的 holder $($holderRun3.Count) 個"
  foreach ($h in $holderRun3) { Add-Note $s3 "解除安裝前執行中的 PTY holder：$($h.name) PID=$($h.pid)（$($h.dir)），子程序 $(($h.children | ForEach-Object { "$($_.name) $($_.pid)" }) -join ', ')" }
  # 解除安裝會停 holder 並清 Terminal Server 自己的 pid / port / token / registry 檔，③ / ④ 的 userData 比對不含它們（同 ⓪ 有 holder 時）
  if ($holderRun3.Count -gt 0) { $script:IgnoreServerFiles = $true }
}
$uninstallMarker3 = Test-Path -LiteralPath (Join-Path $installDir 'resources\uninstall-quit-request.supported')
Add-Note $s3 "解除安裝前的版本（$versionSource3）$(if ($uninstallMarker3) { '有' } else { '沒有' }) resources\uninstall-quit-request.supported（有 = 解除安裝程式會啟動 --uninstall-quit-request，T0860）"
$cur = $inst
if (-not $DryRun) { $cur = @(Find-Installations | Where-Object { $_.scope -eq $installScope }) | Select-Object -First 1 }
$uninstallExe = $null; $uninstallArgs = ''
$q = $(if ($cur -and $cur.quietUninstallString) { $cur.quietUninstallString } elseif ($cur) { "$($cur.uninstallString) /S" } else { '' })
if ($q -match '^"([^"]+)"\s*(.*)$') { $uninstallExe = $Matches[1]; $uninstallArgs = $Matches[2].Trim() }
if (-not $uninstallExe) { Add-Check $s3 '解除安裝指令' 'FAIL' 'QuietUninstallString / UninstallString' "$q" '' }
else {
  if ($uninstallArgs -notmatch '(^|\s)/S(\s|$)') { $uninstallArgs = "$uninstallArgs /S".Trim() }
  Add-Command $s3 "Start-Process -FilePath `"$uninstallExe`" -ArgumentList '$uninstallArgs' -Wait -PassThru"
  Add-Note $s3 "判讀：exit 0；NSIS 解除安裝程式會複製到 %TEMP% 再執行，原程序先結束，所以之後輪詢到 uninstall 鍵與安裝目錄都消失（上限 $UninstallTimeoutSec s）才算完成；計時含輪詢"
  Add-Note $s3 '不帶 --delete-app-data：userData 應保留'
  if (-not $DryRun) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath $uninstallExe -ArgumentList $uninstallArgs -Wait -PassThru
    Add-Check $s3 '解除安裝程式 exit code' $(if ($p.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }) '0' "$($p.ExitCode)" ''
    $done = Wait-Until { (@(Find-Installations | Where-Object { $_.scope -eq $installScope }).Count -eq 0) -and -not (Test-Path -LiteralPath (Join-Path $installDir "$ProductName.exe")) } $UninstallTimeoutSec
    # 等 %TEMP% 內的 NSIS 解除安裝程式副本（~nsu*.tmp\Un_*.exe）結束
    [void](Wait-Until { @(Get-CimInstance Win32_Process | Where-Object { (Get-Prop $_ 'ExecutablePath') -match '\\~nsu[^\\]*\.tmp\\' }).Count -eq 0 } 60)
    $sw.Stop()
    $s3.durationSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    Add-Note $s3 "解除安裝耗時 $($s3.durationSec) s"
    Add-Check $s3 '在時限內完成' $(if ($done) { 'PASS' } else { 'FAIL' }) "≤ $UninstallTimeoutSec s" "$($s3.durationSec) s" ''
    Add-Check $s3 'uninstall 鍵已移除' $(if (@(Find-Installations | Where-Object { $_.scope -eq $installScope }).Count -eq 0) { 'PASS' } else { 'FAIL' }) '不存在' $(if (@(Find-Installations | Where-Object { $_.scope -eq $installScope }).Count -eq 0) { '不存在' } else { '仍存在' }) ''
    Add-Check $s3 'Software\<GUID> 已移除' $(if (-not (Test-Path -LiteralPath $inst.appRegistryKey)) { 'PASS' } else { 'FAIL' }) '不存在' $(if (Test-Path -LiteralPath $inst.appRegistryKey) { '仍存在' } else { '不存在' }) $inst.appRegistryKey
    $leftFiles = @(); if (Test-Path -LiteralPath $installDir) { $leftFiles = @(Get-ChildItem -LiteralPath $installDir -Recurse -File -Force -ErrorAction SilentlyContinue) }
    Add-Check $s3 '安裝目錄已移除' $(if ($leftFiles.Count -eq 0) { 'PASS' } else { 'FAIL' }) '不存在或沒有檔案' $(if (Test-Path -LiteralPath $installDir) { "存在，$($leftFiles.Count) 檔" } else { '不存在' }) ''
    foreach ($f in ($leftFiles | Select-Object -First 20)) { Add-Note $s3 "殘留：$($f.FullName)" }
    $sc = Get-ShortcutPaths $installScope
    foreach ($k in @('desktop', 'startMenu')) {
      Add-Check $s3 "捷徑已移除（$k）" $(if (-not (Test-Path -LiteralPath $sc[$k])) { 'PASS' } else { 'FAIL' }) '不存在' $(if (Test-Path -LiteralPath $sc[$k]) { '仍存在' } else { '不存在' }) $sc[$k]
    }
    if ($holderVersion3) {
      # T0862：真的解除安裝停 holder（--uninstall-quit-request）並刪除本範圍的 holder 根目錄；根目錄有程序在跑時保留（DetailPrint，/S 看不到）
      # T0868：依解除安裝前（② 裝上）的版本與當時執行中的 holder（$holderRun3），見本步驟開頭
      $root = $holderRoot3
      if (Test-HolderRootOverlap $root $installDir) { Add-Note $s3 "PTY holder：根目錄 $root 與安裝目錄互為前綴，安裝程式不碰" }
      else {
        $stillRun = @(Get-HolderProcesses $root)
        foreach ($h in $holderRun3) {
          Add-Check $s3 "PTY holder PID $($h.pid) 已結束" $(if (-not (Get-Process -Id $h.pid -ErrorAction SilentlyContinue)) { 'PASS' } else { 'FAIL' }) '已結束' '仍在執行' '真的解除安裝一律停 holder（T0860）'
        }
        $rootLeft = Test-Path -LiteralPath $root
        Add-Check $s3 'PTY holder 根目錄已移除' $(if (-not $rootLeft) { 'PASS' } elseif ($stillRun.Count -gt 0) { 'WARN' } else { 'FAIL' }) "$root 不存在" $(if (-not $rootLeft) { '不存在' } else { "仍存在，$($stillRun.Count) 個程序從它執行" }) '沒有程序在跑才刪；有程序在跑時保留（不是 FAIL）'
        foreach ($h in $stillRun) { Add-Note $s3 "仍從 holder 根目錄執行：$($h.name) PID=$($h.pid)（$($h.dir)）" }
      }
    }
    if ($null -ne $snapshot0) {
      $snapshotAfter3 = Get-UserDataSnapshot (Get-UserDataDirs)
      $diff = Compare-Snapshot $snapshot0 $snapshotAfter3
      # T0868 / D292：只有 ③ 容許 --uninstall-quit-request 造成的 debug log 新增 / 輪替（Get-UninstallUserDataVerdict）
      $verdict = Get-UninstallUserDataVerdict -Added $diff.added -Removed $diff.removed -Changed $diff.changed -LogTimes0 $script:DebugLogTimes0 -LogDirRel "$ProductName\Logs\"
      Add-Check $s3 'userData 保留且未被改動' $verdict.result '與 ⓪ 的 SHA-256 快照相同（只容許 debug log 新增 / 輪替）' $verdict.actual $UninstallUserDataRule
      foreach ($n in @($verdict.notes | Select-Object -First 30)) { Add-Note $s3 $n }
      if ($verdict.result -eq 'PASS' -or $verdict.result -eq 'WARN') {
        $snapshot3 = $snapshotAfter3
        $unreadable3 = @($snapshot3.Values | Where-Object { $_ -like '*:unreadable' }).Count
        Add-Note $s3 "保存 ③ 結束時的 userData 快照（$($snapshot3.Count) 檔，無法讀取 $unreadable3）：④ 以它為基準，完全相同才 PASS（T0869）"
      }
    }
  } else {
    Add-Note $s3 '解除安裝後檢查：uninstall 鍵與 Software\<GUID> 已移除、安裝目錄沒有檔案、該範圍的桌面 / 開始功能表捷徑已移除、userData 與 ⓪ 的 SHA-256 快照比對（判讀 PASS / WARN 時保存這份快照，作為 ④ 的基準，T0869）'
    Add-Note $s3 "userData 判讀（只有 ③）：$UninstallUserDataRule"
    $logTimesDry = Get-DebugLogTimes $udDirs
    $mainLogs = @($logTimesDry.Keys | Where-Object { $_ -like "$ProductName\Logs\*" } | Sort-Object { [int64]$logTimesDry[$_] }, { $_ })
    if ($mainLogs.Count -gt 0) {
      # logger.init 先清理（刪掉「現有份數 − 10」份最舊的）再建新檔，所以平常是 11 份，③ 新增 1 份、刪 1 份
      $expectDel = [math]::Max(0, $mainLogs.Count - 10)
      Add-Note $s3 "(dry-run) 目前 $ProductName\Logs 有 $($mainLogs.Count) 份 debug-*.log，修改時間最舊 $(Split-Path -Leaf $mainLogs[0])；實際模式 ⓪ 另記這些修改時間。--uninstall-quit-request 先刪「現有份數 − 10」份最舊的再建 1 份：以目前份數預期 ③ 新增 1 份、刪除 $expectDel 份$(if ($expectDel -gt 1) { '（> 1 份超出容許範圍，③ 會判 FAIL）' })"
    } else {
      Add-Note $s3 "(dry-run) 目前 $ProductName\Logs 沒有 debug-*.log"
    }
    if ($holderVersion3 -and -not (Test-HolderRootOverlap $holderRoot3 $installDir)) {
      Add-Note $s3 "解除安裝後檢查（PTY holder，依解除安裝前的版本）：解除安裝前執行中的 holder（$($holderRun3.Count) 個）已結束、$holderRoot3 已移除（有程序在跑時保留 = WARN）"
    }
  }
}
Complete-Step $s3
if (-not $DryRun -and $s3.result -eq 'FAIL') { Stop-Acceptance '解除安裝檢查失敗' }

# ================================================================ ④ 乾淨重裝
$s4 = New-Step '④' '乾淨重裝'
Add-Note $s4 '參數與 ② 相同（沒有既有安裝紀錄時，範圍只由 /allusers | /currentuser 決定，路徑只由 /D= 決定）'
Invoke-Installer $s4 $InstallerPath $installArgs
if ($DryRun) {
  Add-Note $s4 '安裝後檢查同 ②（桌面捷徑預期存在）；userData 基準 = ③ 結束時的 SHA-256 快照（③ 的 userData 判讀為 PASS / WARN 時保存；取不到時退回 ⓪ 的快照並加 Note），完全相同才 PASS（T0869 / D293）'
} else {
  # T0869 / D293：④ 以 ③ 結束時的快照為基準；③ 已容許的 debug log 新增 / 輪替不再算一次，④ 期間的任何差異仍 FAIL
  $snapshot4Base = $snapshot3
  $snapshot4Label = '③ 結束時的'
  if ($null -eq $snapshot4Base) {
    $snapshot4Base = $snapshot0
    $snapshot4Label = '⓪ 的'
    if ($null -ne $snapshot0) { Add-Note $s4 '取不到 ③ 結束時的 userData 快照（③ 沒有跑到 userData 比對），改以 ⓪ 的快照為基準' }
  }
  Test-InstalledState $s4 $installScope $installDir $snapshot4Base $true $snapshot4Label
}
Complete-Step $s4
if (-not $DryRun -and $s4.result -eq 'FAIL') { Stop-Acceptance '乾淨重裝檢查失敗' }

# ================================================================ ⑤ 啟動檢查（選做）
$s5 = New-Step '⑤' '啟動 BAT 10 秒後關閉（選做，-LaunchCheck）'
$exePath = Join-Path $installDir "$ProductName.exe"
$logDir = Join-Path $env:APPDATA "$ProductName\Logs"
if (-not $LaunchCheck) {
  Add-Note $s5 '未帶 -LaunchCheck，略過'
  Complete-Step $s5 'SKIPPED'
} else {
  Add-Command $s5 "Start-Process -FilePath `"$exePath`"；10 s 後 CloseMainWindow()，等所有安裝目錄程序結束（上限 60 s，之後提示手動關閉再等 120 s）"
  Add-Note $s5 "判讀：$logDir 內本次啟動後新增的 debug-*.log 不含 uncaughtException / unhandledRejection；注意 BAT 會還原上次的工作區與分頁"
  if (-not $DryRun) {
    $before = @(Get-ChildItem -LiteralPath $logDir -Filter 'debug-*.log' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    $launchAt = Get-Date
    $app = Start-Process -FilePath $exePath -PassThru
    Start-Sleep -Seconds 10
    try { [void]$app.CloseMainWindow() } catch { }
    $closed = Wait-Until { @(Get-RelatedProcesses $installDir).Count -eq 0 } 60
    if (-not $closed) {
      Write-Host '  BAT 沒有在 60 秒內結束（可能有關閉確認對話框）。請手動關閉 BAT，腳本再等 120 秒。' -ForegroundColor Yellow
      $closed = Wait-Until { @(Get-RelatedProcesses $installDir).Count -eq 0 } 120
    }
    Add-Check $s5 'BAT 已結束' $(if ($closed) { 'PASS' } else { 'WARN' }) '所有安裝目錄程序結束' $(if ($closed) { '已結束' } else { "仍有 $(@(Get-RelatedProcesses $installDir).Count) 個" }) '腳本不強制結束'
    $newLogs = @(Get-ChildItem -LiteralPath $logDir -Filter 'debug-*.log' -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.FullName -and $_.LastWriteTime -ge $launchAt.AddSeconds(-5) })
    Add-Check $s5 '產生新的 debug log' $(if ($newLogs.Count -ge 1) { 'PASS' } else { 'WARN' }) '≥ 1' "$($newLogs.Count)" ''
    foreach ($l in $newLogs) {
      $hits = @(Select-String -LiteralPath $l.FullName -Pattern 'uncaughtException|unhandledRejection' -SimpleMatch:$false -ErrorAction SilentlyContinue)
      Add-Check $s5 "$($l.Name) 無 uncaughtException / unhandledRejection" $(if ($hits.Count -eq 0) { 'PASS' } else { 'FAIL' }) '0 行' "$($hits.Count) 行" ''
    }
  }
  Complete-Step $s5
}

# ================================================================ ⑥ 輸出
$final = @($Report.steps | ForEach-Object { $_.result })
if ($DryRun) { $Report.result = 'DRYRUN' }
elseif ($final -contains 'FAIL') { $Report.result = 'FAIL' }
elseif ($final -contains 'WARN') { $Report.result = 'PASS-WITH-WARN' }
else { $Report.result = 'PASS' }
if ($Report.result -ne 'PASS') { $Report.restoreHints = @(Get-RestoreHints) }
Save-Report
Write-Host ''
Write-Host "整體結果：$($Report.result)" -ForegroundColor $(if ($Report.result -like 'PASS*' -or $Report.result -eq 'DRYRUN') { 'Green' } else { 'Red' })
if ($Report.backupDir) { Write-Host "userData 備份：$($Report.backupDir)（含權杖檔，確認驗收結果後請刪除）" -ForegroundColor Yellow }
exit $(if ($Report.result -eq 'FAIL') { 1 } else { 0 })
