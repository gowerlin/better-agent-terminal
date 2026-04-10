#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
    Better Agent Terminal — 發行版打包流程
.DESCRIPTION
    完整發行流程：Git 狀態檢查 → 版本號計算 → 編譯 → electron-builder 打包 → 產出 checksum
.PARAMETER Version
    明確指定版本號 (e.g. 2.1.4)。省略則自動從 git tag / 時間戳產生。
.PARAMETER SkipGitCheck
    跳過 Git 工作區乾淨度檢查
.PARAMETER ChocoPackOnly
    僅打包 Chocolatey nupkg（需先完成完整建置）
.PARAMETER DryRun
    只顯示流程，不實際執行
#>
param(
    [string]$Version,
    [switch]$SkipGitCheck,
    [switch]$ChocoPackOnly,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 專案根目錄（.vscode/scripts/ 往上兩層）
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $Root

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

    # ── 2. 版本號 ──
    if (-not $ChocoPackOnly) {
        Write-Host "`n[2/5] 計算版本號..." -ForegroundColor Cyan
        if ($Version) {
            Write-Host "  使用指定版本: $Version"
        }
        else {
            # 嘗試 git tag
            $tag = git describe --tags --exact-match 2>$null
            if ($tag) {
                $Version = $tag -replace '^v', '' -replace '-.*$', ''
                Write-Host "  從 git tag 取得: $Version"
            }
            else {
                $now = Get-Date
                $Version = "1.{0}.{1}" -f $now.ToString('yy'), $now.ToString('MMddHHmmss')
                Write-Host "  自動產生時間戳版本: $Version"
            }
        }

        # 更新 package.json
        $pkgPath = Join-Path $Root 'package.json'
        $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $oldVer = $pkg.version
        $pkg.version = $Version
        $pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding UTF8
        Write-Host "  package.json: $oldVer → $Version ✓" -ForegroundColor Green

        if ($DryRun) {
            Write-Host "`n[DryRun] 將執行: npm run compile → electron-builder" -ForegroundColor Magenta
            Write-Host "[DryRun] 輸出目錄: release/" -ForegroundColor Magenta
            exit 0
        }

        # ── 3. 編譯 (vite build) ──
        Write-Host "`n[3/5] 編譯前端 + Electron..." -ForegroundColor Cyan
        npm run compile
        if ($LASTEXITCODE -ne 0) { throw "編譯失敗 (exit code: $LASTEXITCODE)" }
        Write-Host "  編譯完成 ✓" -ForegroundColor Green

        # ── 4. Electron Builder 打包 ──
        Write-Host "`n[4/5] electron-builder 打包..." -ForegroundColor Cyan
        npx electron-builder --win
        if ($LASTEXITCODE -ne 0) { throw "electron-builder 失敗 (exit code: $LASTEXITCODE)" }
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
    if ($ChocoPackOnly -or (Test-Path (Join-Path $Root 'choco'))) {
        $chocoDir = Join-Path $Root 'choco'
        $nuspec = Join-Path $chocoDir 'better-agent-terminal.nuspec'
        if (Test-Path $nuspec) {
            if (-not $Version) {
                $pkg = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
                $Version = $pkg.version
            }
            Write-Host "`n[Choco] 打包 nupkg (v$Version)..." -ForegroundColor Cyan

            # 更新 nuspec 版本
            $xml = [xml](Get-Content $nuspec -Raw)
            $xml.package.metadata.version = $Version
            $xml.Save($nuspec)

            # 更新 checksum（如果有 setup exe）
            $setupExe = Get-ChildItem $releaseDir -Filter "*.Setup.*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($setupExe) {
                $sha = (Get-FileHash $setupExe.FullName -Algorithm SHA256).Hash.ToUpper()
                $installScript = Join-Path $chocoDir 'tools' 'chocolateyinstall.ps1'
                $content = Get-Content $installScript -Raw
                $content = $content -replace '__CHECKSUM64__', $sha
                Set-Content $installScript $content -Encoding UTF8
                Write-Host "  checksum 已更新: $sha" -ForegroundColor Gray
            }

            Push-Location $chocoDir
            choco pack
            Pop-Location

            if ($LASTEXITCODE -eq 0) {
                # 移動 nupkg 到 release/
                $nupkg = Get-ChildItem $chocoDir -Filter '*.nupkg' | Select-Object -First 1
                if ($nupkg) {
                    Move-Item $nupkg.FullName $releaseDir -Force
                    Write-Host "  $($nupkg.Name) → release/ ✓" -ForegroundColor Green
                }
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
    Pop-Location
}
