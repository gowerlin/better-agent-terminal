---
schema_version: 1
schema_kind: workorder
id: T0400
title: "PLAN-036 P1-E：ClaudeAgentManager 去 Electron 化（HostDeps 注入 emit / notifier / getSettings / focus），行為不變"
type: refactor
status: DONE
started_at: "2026-10-05T01:46:33+08:00"
updated_at: "2026-10-05T01:51:52+08:00"
completed_at: "2026-10-05T01:51:52+08:00"
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
- **狀態**：DONE
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
**DONE** — 驗收條件 5/5 達成。

**Landing Zone Check**：PASS
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` ✅（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 ✅；C-3：`electron/claude-agent-manager.ts` / `electron/handlers/types.ts` / `electron/main.ts` 皆存在 ✅；C-2：工單無 `branch` 欄位（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=on`、`CT_INTERACTIVE=0`

### 產出摘要

**`electron/claude-agent-manager.ts`**
- 移除 `import { BrowserWindow, Notification, app } from 'electron'`（含 type-only 皆無）
- 建構子改為 `new ClaudeAgentManager(deps: ClaudeAgentManagerDeps)`，`ClaudeAgentManagerDeps = Pick<HostDeps, 'emit' | 'getSettings' | 'notifier'>` ⇒ T0401 可直接把 headless 的 `HostDeps` 傳入（無 notifier ⇒ 不發完成通知、也不讀 settings）
- `send()` → `this.deps.emit(...)`；`sendCompletionNotification()` → `deps.notifier` + `deps.getSettings()`，判斷順序與欄位語意不變（`notifyOnComplete === false` 不發；`notifyOnlyBackground !== false` 且有 focused window 不發；`silent = notifySound === false`；body 截 100 字 + `...`；外層 try/catch + `logger.error` 保留）
- 新增 Electron 形狀但**不 import electron** 的工廠（比照 T0389 `createWindowBroadcastEmit` 的結構型別作法）：
  - `createElectronClaudeEmit(getWindows)`：live windows `webContents.send` → `broadcastHub.broadcast` 一次（逐字保留修改前 `send()`，**刻意不沿用** pty 的 `createWindowBroadcastEmit`——後者對 `send` 有 try/catch，會改變 error path 行為）
  - `createElectronNotifier(NotificationApi, getWindows)`：`isSupported()` false 即 no-op；`new Notification({ title, body, silent })`；click → 第一個未 destroyed 視窗 `show()` + `focus()`；`hasFocusedWindow()` = 任一未 destroyed 視窗 `isFocused()`
  - 結構型別 `ClaudeHostWindow` / `DesktopNotificationApi`
- `claude.exe` 僅剩 BUG-059 註解文字，無硬寫路徑（embedded 路徑走 T0389 的 `resolveEmbeddedClaudePath`）

**`electron/handlers/types.ts`**（補欄位，皆 optional）
- `HostNotification.silent?: boolean`
- `HostNotifier.hasFocusedWindow?(): boolean`（缺 ⇒ 視為無 focused window）

**`electron/main.ts`**（只動建構點 + 組 deps）
- electron import 補 `Notification`；import 補 `createElectronClaudeEmit` / `createElectronNotifier` / `ClaudeAgentManagerDeps`
- 新增 `createElectronClaudeDeps()`（緊接 `createElectronPtyDeps()` 之後）
- `:1026` `new ClaudeAgentManager(getAllWindows)` → `new ClaudeAgentManager(createElectronClaudeDeps())`
- 未搬任何 `claude:*` handler；未碰 `electron/pty-manager.ts` / `e2e/`

**`electron/__tests__/claude-agent-manager-deps.test.ts`**（新增，14 tests）
- `vi.mock('electron', ...)` 回傳「任何屬性存取即 throw」的 Proxy，import + 建構成功；建構子副作用 `DISABLE_AUTOUPDATER=1` 保留
- emit：`sendMessage('missing-session')` 經 `deps.emit('claude:error', ...)` 送出，manager 本身不再呼叫 `broadcastHub`
- 通知：title / body 截斷 / silent；預設 body `Task completed`；`notifyOnComplete:false` 不發；focused 時不發、`notifyOnlyBackground:false` 時照發；無 notifier 不發且不讀 settings；notifier throw 被吞
- Electron 工廠：emit 扇出 + 只 broadcast 一次；notifier `isSupported` false 不建立；click 聚焦第一個 live window（跳過 destroyed、不碰第二個）；`hasFocusedWindow` 忽略 destroyed；manager + Electron notifier 端到端 focus gate
- esbuild resolve 掃描：`electron/claude-agent-manager.ts` 整個 import graph 不 resolve `electron`

### 驗證證據

| 閘門 | 結果 | 證據 |
|---|---|---|
| 無 `from 'electron'` | ✅ PASS | `grep -n "from 'electron'\|require('electron')" electron/claude-agent-manager.ts` → 無輸出（exit 1） |
| electron-throw 環境 import + 建構 | ✅ PASS | 新測試 `imports and constructs while electron throws on any access`；另做臨時負向驗證（已刪）：對「修改前形狀」模組（值使用 `Notification` / `app` 但建構時不觸碰），Proxy mock 與 factory-throw mock 皆在 import 時 throw ⇒ 本測試對回歸有鑑別力 |
| emit / 通知 / click focus 測試 | ✅ PASS | `npx vitest run electron/__tests__/claude-agent-manager-deps.test.ts` → 14 passed |
| `npm run test:unit` | ✅ PASS | 82 files / **1191 passed**（基線 1141 + T0398/T0399 + 本單 14） |
| `npx tsc --noEmit` ≤ 40 | ✅ PASS | **40**，無任何錯誤位於 `claude-agent-manager.ts` / `handlers/types.ts` / `main.ts` / 新測試檔 |
| `npx vite build` | ⏭️ 未跑 | 依 memory_overrides 禁跑（T0399 平行），留塔台複驗 |
| runtime smoke（Agent 面板串流 / 權限詢問 / 完成通知點擊聚焦） | ⏭️ 未跑 | fire-and-forget、非互動；行為由單元測試 + 逐字保留邏輯覆蓋，建議塔台複驗時順手踩一次完成通知 |

### Electron API → deps 對照表

| 修改前（`claude-agent-manager.ts`） | 修改後 deps 欄位 | Electron 實作（`main.ts` → 工廠） | headless（T0401） |
|---|---|---|---|
| 建構子 `getWindows: () => BrowserWindow[]` | `ClaudeAgentManagerDeps`（`Pick<HostDeps,'emit'\|'getSettings'\|'notifier'>`） | `createElectronClaudeDeps()` | 直接傳 `HostDeps` |
| `send()`：`getWindows()` → `win.webContents.send` + `broadcastHub.broadcast` | `deps.emit` | `createElectronClaudeEmit(getAllWindows)`（逐字同邏輯） | `broadcastHub.broadcast` only |
| `Notification.isSupported()` | `deps.notifier` 存在與否 + notifier 內部 `isSupported()` | `createElectronNotifier(Notification, …).notify` 開頭檢查 | 無 notifier ⇒ 不發 |
| `app.getPath('userData')` + `readFileSync('settings.json')` + `JSON.parse` | `deps.getSettings()` | `main.ts` inline：每次通知時重讀 `userData/settings.json`，失敗回 `{}` | `readHeadlessSettings(dataDir)`（不會被呼叫，因無 notifier） |
| `getWindows().some(w => !w.isDestroyed() && w.isFocused())` | `deps.notifier.hasFocusedWindow?.()` | `createElectronNotifier(...).hasFocusedWindow` | — |
| `new Notification({ title, body, silent })` + `.show()` | `deps.notifier.notify({ title, body, silent })` | `createElectronNotifier(...).notify` | — |
| `notification.on('click')` → 第一個 live window `show()` + `focus()` | notifier 內部（`HostNotification.windowId` 未使用） | `createElectronNotifier` click handler | — |

### 行為差異（皆為退化輸入，記錄供塔台判斷）
1. `settings.json` 內容為 JSON `null`：修改前 `null.notifyOnComplete` TypeError → 被外層 catch 記 log、不發通知；修改後 `getSettings` 依 `HostDeps` 契約回 `{}` ⇒ 照預設發通知。其他非物件值（陣列 / 數字 / 字串）讀屬性皆為 `undefined`，前後一致。
2. `app.getPath('userData')` 若 throw：修改前外層 catch 不發；修改後 `getSettings` 內 catch 回 `{}` 照發。實務上 app ready 後不會 throw。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
- 負向驗證第一版 fixture 只把 `BrowserWindow` 當型別用，被 esbuild 消除 import ⇒ 兩種 mock 都不 throw；改為值使用後確認兩者皆會 throw。結論：mock-throw 測試能抓「值使用 electron 的 import」，純型別 import 由 esbuild resolve 掃描測試補強（本單已加）。
- 無阻擋事項。

### 後續建議
- T0401 上線 headless 時可直接 `new ClaudeAgentManager(hostDeps)`；`headless-electron-free.test.ts` 的 bundle guard 會在 `claude-agent-manager.ts` 進入 server bundle 後自動涵蓋。
- （非本單範圍）`codex-agent-manager.ts` 仍以 `getAllWindows` 建構，若之後要上 headless 可比照本單。
- （非本單範圍）`main.ts` `broadcastRuntimeEvent` 與 `createElectronClaudeEmit` 邏輯重複，可待 T0401 搬 handler 時改用 deps.emit。

### Commit
`git commit --only` 本單 + 4 個產品/測試檔（訊息含 T0400），不 push；hash 見 `git log --grep T0400`。

### 回報時間
2026-10-05T01:50:57+08:00
