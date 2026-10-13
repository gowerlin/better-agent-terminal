---
schema_version: 1
schema_kind: bug
id: BUG-117
title: "（疑似）mac x64 dmg 內嵌 arm64 原生 binary：macOS CI 只有 arm64 host，npm ci 只裝 host 平台 optional 子套件，build.npmRebuild=false 下 x64 / arm64 兩個 .app 打包同一份 node_modules → Intel Mac 內嵌 claude 等原生元件不可用"
status: OPEN
severity: medium
reproducibility: unknown
created_at: "2026-10-13T16:47:18+08:00"
updated_at: "2026-10-13T16:47:18+08:00"
impact:
  - macos-x64
  - embedded-claude
  - packaging
links:
  fix_workorder: null
  research_workorder: T0474
  related: [BUG-116, T0470, T0472, D057]
---

# BUG-117 — （疑似）mac x64 dmg 內嵌 arm64 原生 binary

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（只影響 Intel Mac 使用者；若確認 x64 dmg 的內嵌 claude 不能執行，升為 high） |
| 可重現 | 未知（靜態推論，待 T0474 以實際 release 產物證實） |
| **狀態** | 📂 OPEN |
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
