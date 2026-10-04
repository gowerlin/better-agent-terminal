#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
    Better Agent Terminal — 發行版打包流程
.DESCRIPTION
    完整發行流程：Git 狀態檢查 → 版本號解析 → npm run build:release（fetch:baseline + verify 檢查 + vite build + electron-builder）→ 產出 checksum → Chocolatey nupkg
    打包後 tracked 檔案（package.json / choco/**）維持原狀，不留 dirty。
.PARAMETER Version
    明確指定版本號 (e.g. 0.5.9-pre.4，可帶 v 前綴)。
    省略時依序：package.json 的 version（repo 版號 SoT）→ 加 -Snapshot 時產生 <version>-local.<yyMMddHHmmss>。
    git tag 不作為版號來源；HEAD 上的 v* tag 與 package.json 不一致時只印警告，以 package.json 為準。
    解析邏輯與 scripts/build-version.js 共用（node scripts/build-version.js --resolve-only）。
.PARAMETER Snapshot
    產生本地快照版號 <package.json version>-local.<yyMMddHHmmss>（排序低於下一個正式版，不會造成之後安裝官方版被判為降級）。
    與 -Version 同時指定時以 -Version 為準。
.PARAMETER SkipGitCheck
    跳過 Git 工作區乾淨度檢查
.PARAMETER ChocoPackOnly
    僅打包 Chocolatey nupkg（需先完成完整建置）
.PARAMETER DryRun
    只顯示流程，不實際執行（不寫任何檔案）
#>
param(
    [string]$Version,
    [switch]$Snapshot,
    [switch]$SkipGitCheck,
    [switch]$ChocoPackOnly,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 專案根目錄（.vscode/scripts/ 往上兩層）
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $Root

$pkgPath = Join-Path $Root 'package.json'
$pkgOriginalBytes = [System.IO.File]::ReadAllBytes($pkgPath)
$envOriginal = @{ VERSION = $env:VERSION; BAT_VERSION_SNAPSHOT = $env:BAT_VERSION_SNAPSHOT }
$chocoStage = $null

try {
    # ── 1. Git 狀態檢查 ──
    if (-not $SkipGitCheck -and -not $ChocoPackOnly) {
        Write-Host "`n[1/5] 檢查 Git 工作區..." -ForegroundColor Cyan
        $status = git status --porcelain 2>&1
        if ($status) {
            Write-Warning "工作區有未提交的變更："
            $status | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
            $answer = Read-Host "是否繼續？(y/N)"
            if ($answer -ne 'y') {
                Write-Host "已取消。" -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "  工作區乾淨 ✓" -ForegroundColor Green
        }
    }

    # ── 2. 版本號（與 build-version.js 同一套解析）──
    Write-Host "`n[2/5] 解析版本號..." -ForegroundColor Cyan
    $env:VERSION = if ($Version) { $Version } else { $null }
    $env:BAT_VERSION_SNAPSHOT = if ($Snapshot) { '1' } else { $null }
    $resolvedJson = node (Join-Path $Root 'scripts' 'build-version.js') --resolve-only
    if ($LASTEXITCODE -ne 0) { throw "版本號解析失敗 (exit code: $LASTEXITCODE)" }
    $resolved = $resolvedJson | ConvertFrom-Json
    foreach ($w in $resolved.warnings) { Write-Warning $w }
    $Version = $resolved.version
    $pkgVersion = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
    Write-Host "  版本號: $Version（來源: $($resolved.source)；package.json: $pkgVersion）" -ForegroundColor Green
    # 傳給 build:release → build-version.js，避免重新計算（快照時間戳）
    $env:VERSION = $Version
    $env:BAT_VERSION_SNAPSHOT = $null

    if ($DryRun) {
        if (-not $ChocoPackOnly) {
            Write-Host "`n[DryRun] 將執行: npm run build:release（VERSION=$Version）" -ForegroundColor Magenta
            Write-Host "[DryRun]   = fetch:baseline → verify-native-modules / verify-helper-bundle / verify-renderer-imports → vite build → electron-builder" -ForegroundColor Magenta
            if ($Version -ne $pkgVersion) {
                Write-Host "[DryRun] package.json 會暫時改為 $Version，打包後還原" -ForegroundColor Magenta
            }
        }
        Write-Host "[DryRun] Chocolatey: 暫存複本內改 nuspec 版號 + Setup exe checksum 後 choco pack（tracked choco/** 不動）" -ForegroundColor Magenta
        Write-Host "[DryRun] 輸出目錄: release/" -ForegroundColor Magenta
        exit 0
    }

    if (-not $ChocoPackOnly) {
        # ── 3-4. 前置檢查 + 編譯 + electron-builder 打包 ──
        Write-Host "`n[3-4/5] npm run build:release..." -ForegroundColor Cyan
        npm run build:release
        if ($LASTEXITCODE -ne 0) { throw "build:release 失敗 (exit code: $LASTEXITCODE)" }
        Write-Host "  打包完成 ✓" -ForegroundColor Green
    }

    # ── 5. 產出 Checksum ──
    $releaseDir = Join-Path $Root 'release'
    if (Test-Path $releaseDir) {
        Write-Host "`n[5/5] 產出 checksum..." -ForegroundColor Cyan
        $artifacts = Get-ChildItem $releaseDir -File | Where-Object { $_.Extension -in '.exe', '.zip', '.nupkg', '.dmg', '.AppImage' }
        if ($artifacts) {
            $checksumFile = Join-Path $releaseDir 'checksums.sha256'
            $lines = @()
            foreach ($f in $artifacts) {
                $hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
                $lines += "$hash  $($f.Name)"
                Write-Host "  $hash  $($f.Name)" -ForegroundColor Gray
            }
            $lines | Set-Content $checksumFile -Encoding UTF8
            Write-Host "  寫入 $checksumFile ✓" -ForegroundColor Green
        }
        else {
            Write-Host "  release/ 無可用產出檔案" -ForegroundColor Yellow
        }
    }

    # ── Chocolatey 打包（可選）──
    # 在暫存複本內改 nuspec 版號與 checksum，tracked 的 choco/** 不動。
    $chocoDir = Join-Path $Root 'choco'
    $nuspecName = 'better-agent-terminal.nuspec'
    if (($ChocoPackOnly -or (Test-Path $chocoDir)) -and (Test-Path (Join-Path $chocoDir $nuspecName))) {
        Write-Host "`n[Choco] 打包 nupkg (v$Version)..." -ForegroundColor Cyan

        # electron-builder 本地檔名: "BetterAgentTerminal Setup <ver>.exe"（GitHub 上傳後空白變成點）
        $setupExe = Get-ChildItem $releaseDir -File -Filter '*Setup*.exe' -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "* Setup $Version.exe" -or $_.Name -like "*.Setup.$Version.exe" } |
            Select-Object -First 1

        if (-not $setupExe) {
            Write-Warning "release/ 找不到 v$Version 的 Setup exe，無法計算 checksum，跳過 choco pack"
        }
        elseif (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
            Write-Warning "找不到 choco 指令，跳過 choco pack"
        }
        else {
            $chocoStage = Join-Path ([System.IO.Path]::GetTempPath()) "bat-choco-$([guid]::NewGuid().ToString('N'))"
            Copy-Item $chocoDir $chocoStage -Recurse
            $stagedNuspec = Join-Path $chocoStage $nuspecName

            $xml = [xml](Get-Content $stagedNuspec -Raw)
            $xml.package.metadata.version = $Version
            $xml.Save($stagedNuspec)

            $sha = (Get-FileHash $setupExe.FullName -Algorithm SHA256).Hash.ToUpper()
            $installScript = Join-Path $chocoStage 'tools' 'chocolateyinstall.ps1'
            $content = (Get-Content $installScript -Raw) -replace '__CHECKSUM64__', $sha
            Set-Content $installScript $content -Encoding UTF8
            Write-Host "  checksum ($($setupExe.Name)): $sha" -ForegroundColor Gray

            choco pack $stagedNuspec --output-directory $releaseDir
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  nupkg → release/ ✓" -ForegroundColor Green
            }
            else {
                Write-Warning "choco pack 失敗，跳過"
            }
        }
    }

    Write-Host "`n完成！" -ForegroundColor Green
    if (Test-Path $releaseDir) {
        Write-Host "產出目錄: $releaseDir" -ForegroundColor Cyan
        Get-ChildItem $releaseDir -File | ForEach-Object {
            $size = if ($_.Length -gt 1MB) { "{0:N1} MB" -f ($_.Length / 1MB) } else { "{0:N0} KB" -f ($_.Length / 1KB) }
            Write-Host "  $($_.Name)  ($size)" -ForegroundColor Gray
        }
    }
}
finally {
    # build-version.js 本地模式已會還原；此處防中斷（Ctrl+C / 例外）殘留
    $pkgNowBytes = [System.IO.File]::ReadAllBytes($pkgPath)
    if ([Convert]::ToBase64String($pkgNowBytes) -cne [Convert]::ToBase64String($pkgOriginalBytes)) {
        [System.IO.File]::WriteAllBytes($pkgPath, $pkgOriginalBytes)
        Write-Host "package.json 已還原" -ForegroundColor Gray
    }
    if ($chocoStage -and (Test-Path $chocoStage)) {
        Remove-Item $chocoStage -Recurse -Force
    }
    $env:VERSION = $envOriginal.VERSION
    $env:BAT_VERSION_SNAPSHOT = $envOriginal.BAT_VERSION_SNAPSHOT
    Pop-Location
}
