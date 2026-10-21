---
schema_version: 1
schema_kind: bug
id: BUG-169
title: "安裝版的 helper 回報版號 v0.0.0（`--version`、BAT MCP `serverInfo.version`）：helper 讀 `<scripts>/../package.json`，安裝目錄的 `resources/` 沒有這個檔"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-21T22:17:40+0800"
updated_at: "2026-10-21T23:29:38+0800"
impact:
  - helper-scripts
  - bat-mcp
links:
  discovered_in: "T0689 回報區「遭遇問題」第 1 點（2026-10-21，`build:dir` 產物實測）"
  related: [T0689, D179, T0691]
---

# BUG-169 — 安裝版的 helper 回報版號 v0.0.0

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響顯示；塔台判讀 helper 一律看 exit code，不讀版號） |
| 可重現 | 一定（安裝版） |
| **狀態** | 🔧 FIXING：T0691 修正中（方向 ①：打包時在 resources 放只含 name / version 的 package.json）；原本排除於 `v0.7.1-pre.5`（D179） |
| 回報者 | T0689 Worker |

## 現象

`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs` 以 `join(<helper 所在目錄>, '..', 'package.json')` 讀版號，讀不到時 fallback `0.0.0`。開發環境是 repo 根目錄的 `package.json`，版號正確；安裝版的 helper 在 `<安裝目錄>/resources/scripts/`，而 `resources/` 底下沒有 `package.json`（app 的 `package.json` 在 `app.asar` 裡），所以：

- `bat-terminal.mjs --version`、`bat-notify.mjs --version`、`bat-mcp.mjs --version` 印 `v0.0.0`（T0689 在 `release/win-unpacked/resources/scripts` 實測）。
- BAT MCP `initialize` 回傳的 `serverInfo.version` 是 `0.0.0`。

T0689 改 `extraResources` 前同樣如此（`*.mjs` 也不含 `package.json`），不是回歸。server bundle 不受影響：`build-server-bundle.mjs` 在 bundle 根目錄寫了只含 `name` / `version` 的 `package.json`。

## 修正方向（待設計）

- ① 打包時讓安裝目錄有可讀的版號來源（例如 `resources/` 放只含 `name` / `version` 的檔；注意 T0689 規定 `resources/scripts` 只放 6 個執行期 helper，`verify-packaged-native.js` 會擋多出的檔案）。
- ② 由 PTY env 提供版號（必須經 `PtyManager.buildPtyEnv()`；BAT MCP 的 codex `env_vars` 白名單也要同步加）。
- 兩者擇一或並用由修正單評估；修正後以 `build:dir` 產物實測三個 helper 的 `--version` 與 MCP `serverInfo.version`。
