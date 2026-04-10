#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
    終止 Better Agent Terminal 開發伺服器相關進程
.DESCRIPTION
    精準終止 Vite dev server 和 Electron 開發進程，不影響其他應用。
.PARAMETER Target
    要終止的目標：all (預設) / vite / electron
#>
param(
    [ValidateSet('all', 'vite', 'electron')]
    [string]$Target = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$killed = 0

function Stop-MatchingProcesses {
    param([string]$Pattern, [string]$Label)

    $procs = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern } |
        Where-Object { $_.ProcessId -ne $PID }

    if ($procs) {
        foreach ($p in $procs) {
            try {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "  終止 [$Label] PID $($p.ProcessId): $($p.Name)" -ForegroundColor Yellow
                $script:killed++
            }
            catch {
                Write-Warning "  無法終止 PID $($p.ProcessId): $_"
            }
        }
    }
}

Write-Host "終止開發伺服器進程..." -ForegroundColor Cyan

if ($Target -in 'all', 'vite') {
    Stop-MatchingProcesses -Pattern 'better-agent-terminal.*vite|vite.*better-agent-terminal' -Label 'Vite'
    Stop-MatchingProcesses -Pattern 'node\.exe.*vite' -Label 'Vite/Node'
}

if ($Target -in 'all', 'electron') {
    Stop-MatchingProcesses -Pattern 'electron\.exe.*better-agent-terminal|BetterAgentTerminal' -Label 'Electron'
}

if ($killed -eq 0) {
    Write-Host "  沒有找到相關的開發進程" -ForegroundColor Gray
}
else {
    Write-Host "共終止 $killed 個進程 ✓" -ForegroundColor Green
}
