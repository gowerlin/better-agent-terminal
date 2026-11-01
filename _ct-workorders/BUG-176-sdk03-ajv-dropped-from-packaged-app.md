---
schema_version: 1
schema_kind: bug
id: BUG-176
title: "Agent SDK 0.3 升版後 ajv / ajv-formats 掉出 production 相依樹，安裝檔不含它們，mac 打包驗證失敗擋下 0.7.2-pre.5"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-11-01T09:12:39+0800"
updated_at: "2026-11-01T09:12:39+0800"
impact:
  - packaging
  - release
links:
  discovered_in: "pre-release.yml run 41259467662（0.7.2-pre.5，target a3a74762）build (macos-latest, mac) → Verify packaged native binaries 失敗；linux / win build 被取消，release skipped，未建 tag"
  related: [T0718, T0546, D191, T0719]
---

# BUG-176 — SDK 0.3 後 ajv / ajv-formats 不在安裝檔

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（擋發版；若漏過檢查，安裝檔可能缺執行期模組） |
| 可重現 | 必現（CI 打包） |
| **狀態** | 🔧 FIXING（T0719） |
| 回報者 | 塔台（CI 失敗） |

## 現象

- `scripts/verify-packaged-native.js --platform mac --arch arm64`：`2 runtime package(s) missing from app.asar / app.asar.unpacked` — `ajv`、`ajv-formats`（required by `dist-electron/sdk-CzVYtfWT.js`）。
- 本機 `asar-runtime-deps.test.mjs`（T0718 實跑通過）沒抓到。

## 塔台初判（只看 lock，未查產品碼）

- `v0.7.2-pre.4`：`@anthropic-ai/claude-agent-sdk` 0.2.113 的 `dependencies` 有 `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`（→ `ajv` / `ajv-formats`），所以 ajv 在 production 相依樹內。
- T0718 後：SDK 0.3.316 沒有 `dependencies`，`@anthropic-ai/sdk` / `@modelcontextprotocol/sdk` / `zod` 都是 `peerDependencies` → electron-builder 收集 production 相依時不會走到 ajv。`node_modules/ajv` 本機仍在、`build.files` 白名單也有 ajv，所以白名單 matcher 的測試會過，但打包時被排除。
- T0718 回報說 chunk 裡的 `require("ajv/dist/runtime/*")` 是 ajv codegen 的字串，是否真的會在執行期 require 未實證。

## 處置

- T0719 修正並補本機守門，修好後重發 `0.7.2-pre.5`。
