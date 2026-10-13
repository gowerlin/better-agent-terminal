<#
.SYNOPSIS
  觸發 GitHub Actions Pre-Release workflow
.PARAMETER Version
  版本號，必填，格式 X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）。
  不帶版號時 pre-release.yml 會自動遞增出脫節版號（見 CLAUDE.md「Release」），因此未帶或格式錯誤一律拒絕，不呼叫 gh。
.PARAMETER DryRun
  只印出將執行的 gh 指令，不檢查 gh、不觸發 workflow。
#>
param(
    [string]$Version = "",
    [switch]$DryRun
)

$Owner = "gowerlin"
$Repo = "better-agent-terminal"
$WorkflowFile = "pre-release.yml"
$VersionPattern = '^\d+\.\d+\.\d+-pre\.\d+$'

$Version = $Version.Trim()
$Reason = $null
if (-not $Version) {
    $Reason = "未指定版本號"
} elseif ($Version -notmatch $VersionPattern) {
    $Reason = "版本號格式錯誤：'$Version'"
}
if ($Reason) {
    Write-Host "❌ $Reason" -ForegroundColor Red
    Write-Host "   格式：X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）" -ForegroundColor Gray
    Write-Host "   用法：pwsh -File .vscode/scripts/trigger-prerelease.ps1 -Version 0.6.0-pre.4 [-DryRun]" -ForegroundColor Gray
    Write-Host "   版號取本 fork 主線（v0.x）最新 tag 遞增，不要信 git tag 排序第一名（見 CLAUDE.md「Release」）" -ForegroundColor Gray
    exit 1
}

# Get current branch
$Branch = git branch --show-current 2>$null
if (-not $Branch) { $Branch = "main" }

$GhArgs = @("workflow", "run", $WorkflowFile, "--repo", "$Owner/$Repo", "--ref", $Branch, "-f", "version=$Version")

if ($DryRun) {
    Write-Host "🔍 DryRun：不會觸發 workflow，將執行的指令：" -ForegroundColor Yellow
    Write-Host "   gh $($GhArgs -join ' ')"
    exit 0
}

# Check gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 需要安裝 GitHub CLI (gh): https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# Check auth
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 請先登入 GitHub CLI: gh auth login" -ForegroundColor Red
    exit 1
}

Write-Host "📦 觸發 Pre-Release workflow..." -ForegroundColor Cyan
Write-Host "   Repo:    $Owner/$Repo" -ForegroundColor Gray
Write-Host "   Branch:  $Branch" -ForegroundColor Gray
Write-Host "   Version: $Version" -ForegroundColor Gray

gh @GhArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Workflow 已觸發！" -ForegroundColor Green
    Write-Host "   查看進度: https://github.com/$Owner/$Repo/actions/workflows/$WorkflowFile" -ForegroundColor Gray
} else {
    Write-Host "`n❌ 觸發失敗" -ForegroundColor Red
    exit 1
}
