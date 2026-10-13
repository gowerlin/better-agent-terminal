---
schema_version: 1
schema_kind: bug
id: BUG-118
title: "非 Windows 打包版（mac 兩種 arch、Linux AppImage）缺 claude-code/bin/claude.exe：electron-builder 在非 Windows 目標排除 node_modules 內 .exe → 預設 embedded runtime 的 Agent / claude-cli 分頁無法啟動"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-13T16:59:31+08:00"
updated_at: "2026-10-13T16:59:31+08:00"
impact:
  - macos
  - linux
  - embedded-claude
  - packaging
links:
  fix_workorder: T0475
  research_workorder: T0474
  related: [BUG-117, BUG-116, BUG-052, T0470, T0472]
---

# BUG-118 — 非 Windows 打包版缺內嵌 claude 執行檔

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（mac / Linux 使用者在預設 embedded runtime 下 Agent 與 claude-cli 分頁不可用） |
| 可重現 | 必現（靜態證據：pre.2 x64 / arm64 dmg、AppImage；mac / Linux 實機未驗） |
| **狀態** | 🔧 FIXING（T0475，D136） |
| 回報者 | 塔台（T0474 研究附帶發現 E4） |

## 證據（T0474 E4，`v0.6.0-pre.2` release 產物靜態檢查）

- x64 與 arm64 dmg 的 `Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code/` 只有 `cli-wrapper.cjs`、`install.cjs`、`LICENSE.md`、`package.json`，**沒有 `bin/`**（以 HFS 已用空間對帳排除 hardlink 漏列）；AppImage 同樣沒有 `bin/`，但 `claude-code-linux-x64/claude`（246 MB）有打包
- 根因：`app-builder-lib@26.8.1` `out/util/appFileCopier.js:127-138` `getNodeModuleExcludedExts()` 在 `platform !== WINDOWS` 時排除 node_modules 內 `.dll` / `.exe`（electron-builder #1738）；`NodeModuleCopyHelper.js:71-82` 只有 `build.onNodeModuleFile` 回傳 true 才保留，本 repo 未設
- BAT 指向該檔：`electron/claude-runtime-router.ts:151-154`（`electron-packaged` 版面固定 `…/claude-code/bin/claude.exe`，BUG-052），embedded 分支（`:236-242`）不檢查存在
- SDK 0.2.113 spawn ENOENT → `Claude Code native binary not found at <path>`，傳了 `pathToClaudeCodeExecutable` 就不會退回 `claude-agent-sdk-<plat>` binary
- Windows 不受影響（`.exe` 不被排除；CI log `signing with signtool.exe path=…\claude-code\bin\claude.exe`）

## 預期 vs 實際

- 預期：預設 embedded runtime 下 mac / Linux 可直接使用內嵌 claude
- 實際（推論）：Agent session 與 claude-cli 分頁啟動失敗；只能切 system runtime 並另裝 claude

## 修正方向（T0474 建議）

- **A1（推薦）**：`resolveEmbeddedClaudePath` 在 `electron-packaged` 且非 win32 時改指 `@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`（已打包），`bin/claude.exe` 留作 fallback，加 existsSync 與單元測試
- A2：`build.onNodeModuleFile` 強制保留 `bin/claude.exe`（hardlink 變實體檔，每包 +~230 MB）
- A3：afterPack 建 symlink
- 防回歸：擴充 `scripts/verify-packaged-native.js`，檢查各 `.app` / Linux 產物內 BAT 解析出的內嵌 claude 路徑存在且 arch 正確（T0474「verify 擴充 (c)」）
