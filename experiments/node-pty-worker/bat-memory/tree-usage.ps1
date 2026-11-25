# T0886: copied from branch ct/T0885 experiments/rust-eval/measure/tree-usage.ps1, with one fix (T0886 incident,
# 2026-11-23 17:29): a process only counts as a child when it was created after its parent. Win32_Process keeps the
# ParentProcessId of a dead parent, so without the check an unrelated process whose dead parent had the same PID as
# the probe was counted (and then force-killed as a "leftover" by measure.ps1).
# Read-only: Win32_Process (pid / parent pid / name only, never the command line) + Get-Process counters.
#
# Dot-source for the functions, or run directly to print one JSON sample:
#   pwsh -NoProfile -File tree-usage.ps1 -RootPid 1234
# A process counts as "shell" when its own name is a shell / console host (pwsh, conhost, OpenConsole, node,
# powershell, cmd) or any ancestor below the root is one. Everything else under the root is "framework"
# (Electron main / renderer / GPU / utility, WebView2, Terminal Server, the Tauri exe).
param([int]$RootPid = 0)

$script:ShellNames = @('pwsh', 'conhost', 'OpenConsole', 'node', 'powershell', 'cmd')

function Get-Tree([int]$rootPid) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, CreationDate
  $kids = @{}
  foreach ($p in $all) { $k = [int]$p.ParentProcessId; if (-not $kids.ContainsKey($k)) { $kids[$k] = @() }; $kids[$k] += $p }
  $out = @(); $stack = New-Object System.Collections.Stack
  $self = $all | Where-Object ProcessId -eq $rootPid
  if (-not $self) { return @() }
  $stack.Push(@($self, $false))
  while ($stack.Count) {
    $item = $stack.Pop(); $p = $item[0]; $inShell = $item[1]
    $name = [IO.Path]::GetFileNameWithoutExtension($p.Name)
    $isShell = $inShell -or ($script:ShellNames -contains $name)
    $out += [pscustomobject]@{ Pid = [int]$p.ProcessId; Name = $name; Shell = $isShell; Created = $p.CreationDate }
    foreach ($c in @($kids[[int]$p.ProcessId])) { if ($c -and [int]$c.ProcessId -ne [int]$p.ProcessId -and $c.CreationDate -ge $p.CreationDate) { $stack.Push(@($c, $isShell)) } }
  }
  return $out
}

function Get-Usage($tree) {
  $fw = [ordered]@{ Priv = 0L; WS = 0L; Cpu = 0.0; N = 0 }; $sh = [ordered]@{ Priv = 0L; WS = 0L; Cpu = 0.0; N = 0 }
  $names = @{}; $per = @()
  foreach ($t in $tree) {
    $gp = Get-Process -Id $t.Pid -ErrorAction SilentlyContinue; if (-not $gp) { continue }
    $b = if ($t.Shell) { $sh } else { $fw }
    $b.Priv += $gp.PrivateMemorySize64; $b.WS += $gp.WorkingSet64; $b.Cpu += $gp.TotalProcessorTime.TotalSeconds; $b.N++
    if (-not $t.Shell) { $names[$t.Name] = 1 + [int]$names[$t.Name] }
    $per += [pscustomobject]@{ Pid = $t.Pid; Name = $t.Name; Shell = $t.Shell; PrivMB = [math]::Round($gp.PrivateMemorySize64 / 1MB, 1); WsMB = [math]::Round($gp.WorkingSet64 / 1MB, 1) }
  }
  return [pscustomobject]@{
    Fw = $fw; Sh = $sh
    Names = (($names.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)x$($_.Value)" }) -join ' ')
    Per = $per
  }
}

if ($RootPid -gt 0) {
  $u = Get-Usage (Get-Tree $RootPid)
  [pscustomobject]@{
    fwPrivMB = [math]::Round($u.Fw.Priv / 1MB, 1); fwWsMB = [math]::Round($u.Fw.WS / 1MB, 1); fwProcs = $u.Fw.N; fwCpuSec = [math]::Round($u.Fw.Cpu, 2)
    shellPrivMB = [math]::Round($u.Sh.Priv / 1MB, 1); shellWsMB = [math]::Round($u.Sh.WS / 1MB, 1); shellProcs = $u.Sh.N
    fwNames = $u.Names; per = $u.Per
  } | ConvertTo-Json -Compress -Depth 4
}
