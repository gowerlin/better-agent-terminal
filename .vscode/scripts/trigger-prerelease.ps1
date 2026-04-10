<#
.SYNOPSIS
  觸發 GitHub Actions Pre-Release workflow
.PARAMETER Version
  版本號 (e.g. 2.1.4-pre.1)，留空則自動遞增
#>
param(
    [string]$Version = ""
)

$Owner = "gowerlin"
$Repo = "better-agent-terminal"
$WorkflowFile = "pre-release.yml"

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

# Get current branch
$Branch = git branch --show-current 2>$null
if (-not $Branch) { $Branch = "main" }

Write-Host "📦 觸發 Pre-Release workflow..." -ForegroundColor Cyan
Write-Host "   Repo:    $Owner/$Repo" -ForegroundColor Gray
Write-Host "   Branch:  $Branch" -ForegroundColor Gray
if ($Version) {
    Write-Host "   Version: $Version" -ForegroundColor Gray
}

$args = @("workflow", "run", $WorkflowFile, "--repo", "$Owner/$Repo", "--ref", $Branch)
if ($Version) {
    $args += @("-f", "version=$Version")
}

gh @args

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Workflow 已觸發！" -ForegroundColor Green
    Write-Host "   查看進度: https://github.com/$Owner/$Repo/actions/workflows/$WorkflowFile" -ForegroundColor Gray
} else {
    Write-Host "`n❌ 觸發失敗" -ForegroundColor Red
    exit 1
}
