---
schema_version: 1
schema_kind: workorder
id: T0400
title: "PLAN-036 P1-E：ClaudeAgentManager 去 Electron 化（HostDeps 注入 emit / notifier / getSettings / focus），行為不變"
type: refactor
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T01:45:16+08:00"
target_version: next
depends_on:
  - T0389
related:
  - "PLAN-036 P1 佇列（D130）：T0400 E → T0401 F → T0402 G"
  - "T0386 回報區 §2（耦合表 claude-agent-manager 列）、§3（HostDeps）"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **純重構，本機行為不得改變**：Agent 面板串流、權限詢問、完成通知（含點通知聚焦視窗）、runtime degraded / warning 事件、settings 通知欄位行為都要與修改前一致。"
  - "🔴 `main.ts` 只改 `ClaudeAgentManager` 建構點（約 :1005）與組裝 deps 所需的最少行數；**不搬 `claude:*` handler 註冊**（那是 T0401）。T0398 / T0399 平行中，不得碰 `electron/pty-manager.ts`、`e2e/`。"
  - "🔴 **不執行 `npx vite build`**：T0399 平行在跑 vite build + Playwright；build 由塔台複驗時跑。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0400 — ClaudeAgentManager HostDeps（PLAN-036 P1-E）

## 元資料
- **工單編號**：T0400
- **任務名稱**：ClaudeAgentManager 去 Electron 化
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:45 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`electron/claude-agent-manager.ts`、`electron/handlers/types.ts`（如需補欄位）、`electron/main.ts`（建構點）、`electron/__tests__/`

## 背景

PLAN-036 P0 已讓遠端 headless server 提供終端。P1 要讓 Claude Agent 面板在遠端可用（使用者 01:40 裁決，D130）：E（本單）→ F（`claude:*` 上線 headless，T0401）→ G（遠端登入引導，T0402）。

`electron/claude-agent-manager.ts`（2391 行）頂層 `import { BrowserWindow, Notification, app } from 'electron'`。在 server bundle 裡 `electron` 是 external 且沒有套件 ⇒ **import 當下 `MODULE_NOT_FOUND`**，所以 F 之前必須先拿掉。已知耦合點（T0386 §2，行號以現況為準）：

| 耦合 | 位置（約） |
|---|---|
| `getAllWindows` → `win.webContents.send` 發事件（另有 `broadcastHub`） | :237 |
| `app.getPath('userData')` 讀 `settings.json`（通知設定） | :294 |
| `new Notification(...)` + 點擊後 `win.isFocused / show / focus` | :314 起 |
| 建構：`new ClaudeAgentManager(getAllWindows)` | `main.ts:1005` |

embedded claude 路徑已由 T0389 合一為 `resolveEmbeddedClaudePath`（:17 / :113），本單不需再處理，但要確認沒有殘留 `claude.exe` 硬寫。

## 範圍

1. 以 `electron/handlers/types.ts` 既有的 `HostEmit` / `HostNotification` 等型別為基礎（不足就補，保持「optional = 該 host 可能沒有此能力」的語意），讓 `ClaudeAgentManager` 建構子接受 deps，例如 `{ emit, notifier?, getSettings, focusWindow? }`
2. `claude-agent-manager.ts` **移除對 `electron` 的任何 import**（type-only import 也不要，避免日後被改成 value import）
3. Electron 端在 `main.ts` 提供 `createElectronClaudeDeps()`（或同等）組出與現行完全相同的行為：emit = webContents.send + broadcastHub（照現狀，勿重複廣播）、notifier = Electron `Notification` + 點擊聚焦、getSettings 讀 `userData/settings.json`
4. 不改 `claude:*` handler 註冊位置、不改 headless（T0401 才上線）

## 驗收條件

- [ ] `electron/claude-agent-manager.ts` 無 `from 'electron'`（`grep` 證據）
- [ ] 新增測試：在 `electron` 被 mock 成「任何屬性存取即 throw」的環境下 import `claude-agent-manager.ts` 並建構成功（可沿用 `electron/remote/__tests__/headless-electron-free.test.ts` / T0388 harness 的作法）
- [ ] 新增測試：emit 事件、通知（含 settings 關閉通知時不發）、點擊通知 focus 的 deps 呼叫行為
- [ ] `npm run test:unit` 全綠（基線 1141，T0398 合入後可能略增）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區列出「修改前 Electron API 呼叫點 → 修改後 deps 欄位」對照表

## 不在範圍

- `claude:*` handler 搬移 / headless 註冊（T0401）
- codex-agent-manager、`claude:detectRuntime` 等 main.ts inline handler

## Sub-session 執行指示

1. 讀本工單 + T0386 回報區 §2 / §3 + `electron/handlers/types.ts` + `electron/claude-agent-manager.ts`
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

### Electron API → deps 對照表

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
