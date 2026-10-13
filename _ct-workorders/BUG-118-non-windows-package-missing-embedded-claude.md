---
schema_version: 1
schema_kind: bug
id: BUG-118
title: "非 Windows 打包版（mac 兩種 arch、Linux AppImage）缺 claude-code/bin/claude.exe：electron-builder 在非 Windows 目標排除 node_modules 內 .exe → 預設 embedded runtime 的 Agent / claude-cli 分頁無法啟動"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-13T16:59:31+08:00"
updated_at: "2026-10-13T17:16:52+08:00"
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
| **狀態** | ✅ FIXED（T0475，D136；待 pre.3 CI 與 mac / Linux 實機驗收） |
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

## 修復（T0475）

採 **A1**（D136）。

- **路徑規則**：`electron/claude-runtime-router.ts` 新增 `embeddedClaudeCandidates()`。`electron-packaged` 版面且非 win32 時，候選依序為：
  1. `app.asar.unpacked/node_modules/@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`
  2. `claude-code/bin/claude.exe`（fallback）

  `resolveEmbeddedClaudePath()` 取第一個存在的；都不存在就回第 1 個。musl 判定比照 claude-code `install.cjs`：`process.report` 沒有 `glibcVersionRuntime` 即視為 musl。Windows 打包版、node-modules（dev）、server-bundle 版面維持原狀，有單元測試證明。
- **存在檢查**：`resolveClaudeRuntime()` 在 embedded 模式下，若檔案不存在就丟 `EmbeddedClaudeMissingError`，訊息列出所有找過的路徑。同一組路徑只寫一次 `logger.error`。
  - system 模式需要 fallback、但 embedded 也不在時，丟原本的 `SystemClaudeUnavailableError` / `SystemClaudeUnsafePathError`（reason 不變，`detail` 附上缺少的路徑），沿用既有的 degraded toast。
  - 路徑為 `''`（dev 環境找不到套件）時行為不變。
- **呼叫點**：Agent SDK 的 4 個 spawn 點（含 `getSupportedModels` probe）、`claude:get-cli-path`（terminal claude-cli preset）、`claude:auth-status` / `auth-logout`、`resolveClaudeBaseCommand`、`claude:detectRuntime`、BUG-047 啟動斷言，全部走 `resolveClaudeRuntime` / `resolveEmbeddedClaudePath`。沒有其他地方寫死 `bin/claude.exe`。
- **防回歸**：`scripts/verify-packaged-native.js` 會檢查 mac `.app` 與 Linux `linux-unpacked` 內的內嵌 claude 是否存在、arch 是否正確。`pre-release.yml` / `release.yml` 的 mac 與 linux job 都會在打包後執行。
- **pre.2 實物回放**：pre.2 的 arm64 `.app` 與 AppImage 內**有**平台子套件 binary（`claude-code-darwin-arm64/claude` 為 arm64；`claude-code-linux-x64/claude` 為 ELF x86-64，246,107,320 B），只缺舊規則指向的 `bin/claude.exe`。
  - 新版 verify 對這兩個產物都 PASS，代表 A1 規則下 pre.2 的打包內容就夠用。
  - 把解壓樹裡的平台子套件目錄改名後，mac / Linux 都 exit 1，並列出兩個候選。
  - 細節見 T0475 回報區。
- **未驗**：mac / Linux 實機啟動 Agent 與 claude-cli 分頁（AI 無法代驗）；pre.3 CI 實跑由塔台觀察。
