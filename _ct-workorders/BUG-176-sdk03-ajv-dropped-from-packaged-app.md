---
schema_version: 1
schema_kind: bug
id: BUG-176
title: "Agent SDK 0.3 升版後 ajv / ajv-formats 掉出 production 相依樹，安裝檔不含它們，mac 打包驗證失敗擋下 0.7.2-pre.5"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-11-01T09:12:39+0800"
updated_at: "2026-11-01T09:23:24+0800"
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
| **狀態** | ✅ FIXED（T0719 `59ef7f37`：`ajv` / `ajv-formats` 加進 `dependencies`；`asar-runtime-deps.test.mjs` 新增 production 相依樹守門；本機 Windows 打包驗證修正前 exit 1、修正後 exit 0；mac / Linux 待重發 0.7.2-pre.5 的 CI 確認） |
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

## 修正（T0719，2026-11-01）

- 原因確認：electron-builder 26.8.1 的 `NpmNodeModulesCollector` 只走 `dependencies` / `optionalDependencies`；SDK 0.3.316 三個相依都只在 `peerDependencies`，production 閉包 342 → 250 個（少 92 個），執行期需要的只有 `ajv` / `ajv-formats`（且 chunk 內的 require 其實是 ajv codegen 字串，執行期不呼叫；仍依 D193 保守補回）。
- 修正：`package.json` `dependencies` 加 `ajv ^8.18.0`、`ajv-formats ^3.0.1`，lock 只有 root 兩行增列；`asar-runtime-deps.test.mjs` 新增 production 相依樹守門（修正前 4 failed、修正後 31 passed）；CLAUDE.md / docs 補說明。
- 驗證：unit 6211 passed / legacy 472 / typecheck 0 / 0 / build；本機 `build:dir --win` + `verify-packaged-native --platform win` exit 0。塔台複驗守門 31 / 31、lock diff 只有兩行。
