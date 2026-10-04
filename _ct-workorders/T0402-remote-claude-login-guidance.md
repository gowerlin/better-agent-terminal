---
schema_version: 1
schema_kind: workorder
id: T0402
title: "PLAN-036 P1-G：Claude 面板未登入引導（遠端：開終端分頁執行登入）+ auth-status 在 exit≠0 時仍解析 stdout"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: S
created_at: "2026-10-05T02:35:05+08:00"
target_version: next
depends_on:
  - T0401
related:
  - "PLAN-036 P1 佇列（D130）：T0400 ✅ → T0401 ✅ → **T0402 G**；與 T0404 平行"
  - "T0401 回報區「遭遇問題」：`claude auth status` 未登入 exit 1，stdout 仍有 JSON"
  - "T0386 回報區 §4 auth 列"
affects_files:
  - electron/handlers/claude.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/
  - src/lib/
  - src/locales/
  - electron/__tests__/
  - electron/remote/__tests__/headless-claude.test.ts
  - src/components/__tests__/
  - src/lib/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **使用者已裁決（02:34）**：`claude:auth-status` 在 `claude auth status` exit≠0 時，若 stdout 是含 `loggedIn` 欄位的 JSON 就照實回傳，否則照舊回 `null`。本機也套用。"
  - "🔴 T0404 平行中：不得碰 `electron/remote/remote-server.ts`、`electron/remote/headless-entry.ts`、`electron/pty-manager.ts`、`electron/remote/protocol.ts`。"
  - "🔴 不送真實 Claude API 對話；不在任何機器上實際執行登入。不得部署到 WSL。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0402 — Claude 面板未登入引導（PLAN-036 P1-G）

## 元資料
- **工單編號**：T0402
- **任務名稱**：遠端 claude 登入引導
- **狀態**：PENDING
- **建立時間**：2026-10-05 02:35 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0401 後遠端視窗的 Claude 面板可以開 session（WSL 實機 smoke S9 PASS：`get-cli-path` 為 bundle 路徑、embedded healthy、`auth-status → null`）。但 WSL 上沒登入：使用者送訊息只會看到 CLI 原文錯誤，`/whoami` 顯示 `Not logged in.`。`claude:auth-login` 本機與遠端都是 stub（`electron/handlers/claude.ts`），登入要在終端執行 claude。

另外 `claude auth status` 未登入時 exit 1、stdout 為 `{"loggedIn": false, "authMethod": "none", …}`，現行 handler（`electron/handlers/claude.ts:187` 起）走 err 分支回 `null`，分不出「未登入」與「runtime 壞掉」。

## 範圍

1. **auth-status**：依使用者裁決修改（見 memory_overrides 第 1 條）。stdout 解析失敗 / 非 JSON / 無 `loggedIn` ⇒ `null`；log 記錄 exit code
2. **未登入引導**（本機與遠端共用，文案依視窗類型調整）：
   - Claude 面板在 session 開始前或第一次送訊息失敗時，若 `auth-status` 回 `loggedIn: false`，顯示引導卡片：說明未登入、提供「開啟終端分頁登入」按鈕
   - 按鈕：在**同一視窗**（遠端視窗 ⇒ 遠端終端）開新終端分頁並打入登入指令。指令用 `claude:get-cli-path` 回傳的路徑（遠端為 bundle 內 claude），以 shell 安全的方式引用路徑；只打入、**不自動送出 Enter**，讓使用者確認
   - 登入完成後可按「重新檢查」重跑 `auth-status`
   - `auth-status` 為 `null`（無法判斷）時不顯示引導卡片，維持現行錯誤顯示
3. i18n：en / zh-TW / zh-CN

## 驗收條件

- [ ] unit：auth-status 的 exit≠0 + JSON stdout / exit≠0 + 非 JSON / exit 0 三種情況
- [ ] unit：引導卡片顯示條件（`loggedIn:false` 顯示；`true` / `null` 不顯示）、按鈕打入的指令（含路徑有空白的引用）、不自動送出
- [ ] headless harness（`headless-claude.test.ts`）：未登入時 `auth-status` 回 `{ loggedIn: false, … }`（不再是 `null`）
- [ ] `npm run test:unit` 全綠（基線 1258）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附使用者實機步驟（WSL 遠端視窗 → Claude 面板 → 引導卡片 → 終端分頁登入 → 重新檢查）

## 不在範圍
- 實作真正的 `claude:auth-login`（仍為 stub）
- codex 登入

## Sub-session 執行指示
1. 讀本工單 + T0401 回報區 + `electron/handlers/claude.ts`（auth-status / get-cli-path / auth-login）+ `src/components/ClaudeAgentPanel.tsx`（`/whoami`、session 啟動、錯誤顯示）+ 既有「開終端分頁並帶指令」的 renderer 流程（依實際位置）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 使用者實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
