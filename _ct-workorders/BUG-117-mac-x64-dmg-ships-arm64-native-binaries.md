---
schema_version: 1
schema_kind: bug
id: BUG-117
title: "mac x64 dmg 內嵌 arm64 原生 binary（T0474 證實）：macOS CI 只有 arm64 host，npm ci 只裝 host 平台 optional 子套件，build.npmRebuild=false 下 x64 / arm64 兩個 .app 打包同一份 node_modules → Intel Mac 內嵌 claude 等原生元件不可用"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-13T16:47:18+08:00"
updated_at: "2026-10-13T16:59:11+08:00"
impact:
  - macos-x64
  - embedded-claude
  - packaging
  - macos-x64-voice-input
  - macos-x64-embedded-codex
links:
  fix_workorder: T0475
  research_workorder: T0474
  related: [BUG-116, T0470, T0472, T0473, D057]
---

# BUG-117 — mac x64 dmg 內嵌 arm64 原生 binary

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（T0474 建議由 medium 上調：x64 dmg 內嵌 claude 不可用的升級條件已成立；待塔台確認） |
| 可重現 | 必現（T0474 以 v0.6.0-pre.2 release 產物靜態證實；未在 Intel Mac 實機執行） |
| **狀態** | 🔧 FIXING（T0475，D136） |
| 回報者 | 塔台（第五十八 session；T0472 Worker 回報區「待查」段提出） |

## 推論

- `pre-release.yml` / `release.yml` 的 mac build 只跑在 `macos-latest`（arm64），`npm ci` 依 `os` / `cpu` 欄位只安裝 host 平台的 optional 子套件（如 `@anthropic-ai/claude-code-darwin-arm64`、`@anthropic-ai/claude-agent-sdk-darwin-arm64`、`@lydell/node-pty-darwin-arm64`）；`package.json` 雖列 `@img/sharp-darwin-x64` 等，cpu 不符時同樣不會被安裝
- claude-code 的 `install.cjs` 只把 host（darwin-arm64）binary 放進 `bin/claude.exe`
- `build.npmRebuild: false`、`mac.target.arch = [x64, arm64]`（D057）⇒ 兩個 `.app` 打包同一份 `node_modules` ⇒ x64 dmg 很可能帶 arm64 Mach-O（claude、claude-agent-sdk、node-pty、better-sqlite3、sharp）
- whisper 不受影響（套件本身同時附 `mac-x64` / `mac-arm64`；T0470 已在 CI 檢查）

## 預期 vs 實際（待證實）

- 預期：x64 dmg 內所有原生元件為 x86_64（或 universal）
- 疑似實際：內嵌 claude 等為 arm64；Intel Mac 上內嵌 claude 無法執行（Rosetta 不能反向執行 arm64），node-pty 可能退回 child_process fallback

## 處置

2026-10-13 16:47：開研究工單 **T0474**——下載 `v0.6.0-pre.2` x64 dmg 實際檢查各原生元件架構，並提出修正選項。

## T0474 證據摘要（2026-10-13，靜態檢查 `v0.6.0-pre.2` 的 release 產物）

**結論：成立**（已用實際產物證實，不再只是推論）。完整證據表見 T0474 回報區 E2。

- **x64 `.app`**：
  - 主程式、Electron Framework 與全部 Frameworks 都是 **x86_64**（19 個）
  - `app.asar.unpacked` 內的 npm 原生元件**全部是 arm64**（55 個），而且只有 `-darwin-arm64` 子套件，沒有任何 `-darwin-x64`：
    - `claude-code-darwin-arm64/claude`
    - `claude-agent-sdk-darwin-arm64/claude`
    - `node-pty-darwin-arm64/{pty.node,spawn-helper}`
    - `better_sqlite3.node`
    - `sharp-darwin-arm64`、`sharp-libvips-darwin-arm64`
    - `codex-darwin-arm64/**`（新發現，原清單沒有列）
- **CI 證據**（run `37265491592` mac job）：
  - arm64 host，`npm 11.19.0`
  - `@electron/rebuild` 只建 host arch
  - `npmRebuild is set to false` 之後依序 `packaging arch=x64` → `arch=arm64`，兩次打包同一份 `node_modules`
- **推論修正**：原本寫「whisper 不受影響」**不成立**。`@kutalia/whisper-node-addon@1.1.0` 的 `dist/mac-x64/` 內容是 **arm64**，與 `dist/mac-arm64/` 位元相同（sha256 `94efeb05…bebf`），屬於上游打包缺陷。T0470 的 `verify-packaged-native.js` 只檢查檔案存在，所以假綠燈通過。
- **推論修正**：原本寫「claude-code 的 `install.cjs` 把 host binary 放進 `bin/claude.exe`」，在 CI 上確實成立；但 electron-builder 在非 Windows 目標會排除 node_modules 的 `.exe`（`app-builder-lib/out/util/appFileCopier.js:127-138`），所以 **mac（兩種 arch）與 Linux 打包版都沒有 `bin/claude.exe`**。這個問題不限於 x64，已建議塔台另開 BUG（見 T0474「附帶發現」1）。

**Intel Mac 實際後果**：

| 功能 | 狀況 |
|---|---|
| App 啟動 | 正常 |
| 內嵌 claude | 不可用。路徑不存在；就算補上，binary 也是 arm64 |
| 內嵌 codex | 不可用（只能用系統另裝的 codex） |
| 終端 | node-pty 無法載入，退回 child_process（降級） |
| 語音輸入 | 不可用 |
| better-sqlite3 / sharp | 桌面 runtime 不使用，不受影響 |

**嚴重度建議**：🟡 medium → **🔴 high**（工單原本的升級條件「x64 dmg 的內嵌 claude 不能執行」已經滿足）。

**修正方向**（詳見 T0474「結論與修正選項」）：
- **推薦 B1**：mac 拆成 x64 / arm64 兩個 job，各用原生 runner。要先確認還有可用的 Intel runner label
- 替代 **B3**：停止發 x64 dmg
- **不建議 B2**：同 host 替換子套件，脆弱
- 不論選哪個，都同時擴充 `verify-packaged-native.js`：檢查每個 `.app` 內 Mach-O 的 cputype 與內嵌 claude 是否存在
- whisper 另外處理：向上游回報，或在 `darwin-x64` 明確顯示不支援
