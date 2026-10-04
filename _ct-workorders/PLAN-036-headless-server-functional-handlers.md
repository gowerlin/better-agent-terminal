---
schema_version: 1
schema_kind: plan
id: PLAN-036
title: headless bat-server 功能 handler 層（終端 / Agent / git / fs），讓 WSL / SSH / Docker 遠端 profile 真正可用
status: PLANNED
priority: high
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-04T23:34:17+08:00"
links:
  research_workorder: T0386
  related: [BUG-094, T0385, PLAN-035, PLAN-031, PLAN-015, BUG-093]
---

# PLAN-036 — headless bat-server 功能 handler 層

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-036 |
| 優先級 | 🔴 High |
| 狀態 | 📋 PLANNED（研究 T0386 派發中） |
| 建立時間 | 2026-10-04 23:34 (UTC+8) |
| 決策 | 使用者裁決：開 PLAN、研究先行（第五十三 session） |

## 背景與動機

T0385（BUG-094）盤點證實：headless bat-server（WSL / SSH / Docker 遠端 profile 的伺服器端）**註冊的功能 handler 數量為 0**。

- `scripts/bat-server.mjs:118` 呼叫 `createHeadlessServer` 不傳 `handlers`
- `_spec-remote-dev-support-2026-04.md` §2.3 規劃的 `electron/handlers/`（renderer-agnostic 純 JS handler）從未落地；`build-server-bundle.mjs` 的複製步驟因目錄不存在而靜默略過
- T0385 只補了開 profile 主路徑（`profile:*` 子集 + `settings:load/save`），遠端 profile 現在能開出**空視窗**，但 `pty:*` / `claude:*` / `git:*` / `fs:*` 等全部 `No handler for channel`

⇒ PLAN-007 / PLAN-031 / PLAN-035 一路做的遠端環境（打包、分發、精靈、常駐）最終交付的伺服器**沒有可用功能**。

## 缺口（T0385 回報區 B-2，T0386 複核）

| 優先 | 缺口 | 已知難點 |
|---|---|---|
| P0 | `settings:get-shell-path` + `pty:*`（6 個） | `electron/pty-manager.ts` import `electron` `app` / `BrowserWindow`；bundle 已含 `@lydell/node-pty-<target>` |
| P1 | `claude:*`（約 40 個） | `claude-agent-manager.ts` 依賴 runtime router / settings；bundle 已含 claude-code / agent-sdk |
| P2 | `git:*` / `git-scaffold:*` / `fs:*` / `image:read-as-data-url` / `github:*` / `worktree:*` | path sandbox（`isPathAllowed`）在 headless 需重新定義 |
| P3 | `snippet:*`（better-sqlite3）、`terminal:*`（Tower 通知） | 次要 |

## 階段

1. **Phase 0**：研究 T0386 —— 解耦策略、共用 handler 架構（避免 Electron 端與 headless 端雙實作漂移）、分階段拆單
2. **Phase 1+**：依 T0386 拆單（預期 P0 終端先行）

## 相關觀察（T0385）

- `App.tsx` initProfile 的 `remote.connect(host, port, token)` 不帶 fingerprint，會以新 client 取代 main 已做 pin 驗證的 client
- 本機驗證 headless 改動缺工具：無 local-tarball override、manifest 產生器要求三 target、`fetch:baseline` 無 skip 旗標
