# T0888: read-only process sampling for e2e/t0888-shared-conout-stress.spec.ts (Windows).
# Never ends a process. Process tree rule = experiments/node-pty-worker/bat-memory/tree-usage.ps1 (ct/T0886 fix:
# a child only counts when it was created after its parent), dot-sourced from there.
#
# One sample (JSON on stdout):
#   pwsh -NoProfile -File proc-sample.ps1 -RootPid <Terminal Server pid>
#   -> { pid, alive, privMB, wsMB, threads, exe, children: [ { pid, name } ] }   (children = descendants, root excluded)
#   exe is the executable path only (no command line, no env).
#
# Watch mode (peak memory while something runs): appends "<ms since epoch>,<private bytes>" lines to -OutFile every
# -IntervalMs until -StopFile exists or the process is gone.
#   pwsh -NoProfile -File proc-sample.ps1 -RootPid <pid> -Watch -OutFile <csv> -StopFile <path> [-IntervalMs 250]
param(
  [int]$RootPid = 0,
  [switch]$Watch,
  [string]$OutFile = '',
  [string]$StopFile = '',
  [int]$IntervalMs = 250
)

# Dot-sourcing runs tree-usage.ps1's own param block in this scope (RootPid = 0 there, so it prints nothing):
# keep our value across it.
$target = $RootPid
. (Join-Path $PSScriptRoot '..\bat-memory\tree-usage.ps1')
$RootPid = $target

if ($RootPid -le 0) { exit 0 }

if ($Watch) {
  while (-not (Test-Path -LiteralPath $StopFile)) {
    $p = Get-Process -Id $RootPid -ErrorAction SilentlyContinue
    if (-not $p) { break }
    $ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Add-Content -LiteralPath $OutFile -Value "$ms,$($p.PrivateMemorySize64)"
    Start-Sleep -Milliseconds $IntervalMs
  }
  exit 0
}

$gp = Get-Process -Id $RootPid -ErrorAction SilentlyContinue
if (-not $gp) {
  [pscustomobject]@{ pid = $RootPid; alive = $false; privMB = 0; wsMB = 0; threads = 0; exe = ''; children = @() } | ConvertTo-Json -Compress -Depth 4
  exit 0
}
$tree = @(Get-Tree $RootPid)
$children = @($tree | Where-Object { $_.Pid -ne $RootPid } | ForEach-Object { [pscustomobject]@{ pid = $_.Pid; name = $_.Name } })
$exe = (Get-CimInstance Win32_Process -Filter "ProcessId=$RootPid" -Property ExecutablePath).ExecutablePath
[pscustomobject]@{
  pid = $RootPid; alive = $true
  privMB = [math]::Round($gp.PrivateMemorySize64 / 1MB, 1); wsMB = [math]::Round($gp.WorkingSet64 / 1MB, 1)
  threads = $gp.Threads.Count; exe = "$exe"; children = $children
} | ConvertTo-Json -Compress -Depth 4
