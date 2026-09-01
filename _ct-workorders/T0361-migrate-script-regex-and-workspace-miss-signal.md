---
schema_version: 1
schema_kind: workorder
id: T0361
title: "統一 migrate script ID regex（第五處）+ 新增 workspace miss 觀測訊號"
type: fix
status: PENDING
priority: P2
sizing: S
created_at: "2026-09-01T23:34:29+08:00"
updated_at: "2026-09-01T23:34:29+08:00"
target_version: 0.5.9-pre.1
depends_on:
  - T0360
related:
  - BUG-082
  - T0360
  - T0137
  - BUG-031
affects_files:
  - scripts/migrate-ct-frontmatter.mjs
  - src/stores/workspace-store.ts
  - src/App.tsx
  - CHANGELOG.md
interaction:
  mode_hint: ask
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 禁止實作 ADVISORY B-1（漏帶 --workspace 時改讀 BAT_WORKSPACE_ID 作為預設來源）。塔台已裁決本版不含 B-1，理由是避免與 BUG-082 的安裝驗證信號混淆。本工單只加『觀測訊號』，不改任何 workspace 解析行為。"
  - "renderer 端 log 一律用 window.electronAPI.debug.log(...)，禁用 console.log（見 CLAUDE.md Logging 節）。"
---

# T0361 — migrate script regex 統一 + workspace miss 觀測訊號

- **狀態**：PENDING
- **任務類型**：fix
- **工作量預估**：S
- **目標版本**：0.5.9-pre.1（與 T0360 同批發布驗證）
- **Context Window 風險**：低

## 背景

T0360 已把工單 ID 文法統一為 `^(?:[A-Z]{2,4}-)?T\d+$`（helper / main / renderer parser 四處）。
本工單收掉 T0360 報告中標記為「範圍外但已確認」的**第五處**，並補上 Part C 調查指出的觀測缺口。

兩件事都是**零行為改變**，目的是讓 0.5.9-pre.1 的安裝驗證信號更乾淨、更有診斷力。

## 範圍

### Part A — `scripts/migrate-ct-frontmatter.mjs` 第五份 ID regex

現況（T0360 報告「設計決策 3」已定位）：

| 行 | 現況 | 問題 |
|----|------|------|
| ~36 | `/^(CT-T\d+)/` | 只認 `CT-`，不認 `CP-` 及其他 2–4 字前綴 |
| ~40 | `/^(T\d+)/` | 裸 T |
| ~256 | `/^(T\d+|BUG-\d+|PLAN-\d+|EXP-[A-Z0-9]+-\d+|CT-T\d+)/` | 同上，且與前兩處重複表述 |

要求：

- 工單 ID 部分統一為 `(?:[A-Z]{2,4}-)?T\d+`，與 T0360 的文法一致
- 在檔內宣告一份共用常數（沿用 T0360 的命名慣例 `WORKORDER_ID_PATTERN` / `WORKORDER_ID_PREFIX`），
  並補上 sibling 指認註解，列出 T0360 已建立的另外三處位置
- **BUG / PLAN / EXP 的 ID 規則不動**（本次只處理工單 T####）
- 該檔是一次性 migration script、不在派工路徑，改動須保持既有 CLI 行為不變

### Part B — workspace miss 觀測訊號（純觀測）

T0360 Part C 結論：整條鏈路對 workspaceId **零驗證**，指定一個不存在的 id 會靜默 fallback 到
active workspace，且**與完全沒指定無法區分**。

**B1 — `src/stores/workspace-store.ts` `addExternalTerminal`（~329-340）**

當 `info.workspaceId` 有值、但 `workspaces.find(...)` 查無時，在 fallback 前發出一則 warn：

- 內容需同時包含：請求的 `workspaceId`、實際落點 workspace id、terminal id
- 使用 `window.electronAPI.debug.log(...)`（renderer，禁用 `console.log`）
- **不得改變任何回傳值或 fallback 行為** —— 查無仍舊 fallback 到 active，仍舊回傳 terminal

**B2 — `src/App.tsx:458` 誤導性 log**

現況印的是**請求值**而非實際落點：

```
[T0130] External terminal added: id=... workspaceId=${info.workspaceId ?? '(active)'}
```

T0360 Part C 明確指出：帶了未知 id 時，這行會顯示該 id，實際卻落在 active workspace —— log 本身在誤導診斷。

要求：改為印**實際落點**（`added.workspaceId`），並保留請求值以利對照，例如同時呈現
requested 與 landed 兩個值。log prefix 標記維持可辨識（可沿用 `[T0130]` 或補 `[T0361]`，由 Worker 決定並說明）。

## 明確排除

- ❌ **不實作 B-1**（漏帶 `--workspace` 時改讀 `BAT_WORKSPACE_ID` 作為預設來源）—— 塔台裁決本版不含
- ❌ 不改 `addExternalTerminal` 的 fallback 語意、不改回傳型別
- ❌ 不對 workspaceId 加驗證或拒絕（只觀測，不攔截）
- ❌ 不動 BUG / PLAN / EXP 的 ID 規則
- ❌ 不做版本 bump / tag / push / release（塔台負責）

## 驗收條件

| # | Gate | 判準 |
|---|------|------|
| G1 | migrate script 前綴 | `CP-T1148` / `CT-T001` / `KEEN-T0002` / `T0001` 皆被辨識為 workorder 且 id 正確 |
| G2 | migrate script 不誤收 | `cp-t1` / `TOOLONG-T1` 不被當 workorder；`BUG-###` / `PLAN-###` / `EXP-*` 行為與改動前**完全一致** |
| G3 | migrate script CLI 行為 | 以 dry-run（若支援）或等效方式確認既有輸出未回歸 |
| G4 | miss 訊號 | 指定不存在的 workspaceId 時發出 warn，內容含 requested + landed + terminal id；指定合法 id 時**不發** |
| G5 | 行為不變 | `addExternalTerminal` 在 miss 情境下的回傳值與落點與改動前一致（測試斷言） |
| G6 | App.tsx log | 印出實際落點；未知 id 情境下 landed ≠ requested 可從 log 直接看出 |
| G7 | 單元測試 | `npm run test:unit` 全綠（基線 **507**，本工單後應 ≥ 507） |
| G8 | 編譯 | `npm run compile` PASS；`npm run verify:renderer-imports` OK |

## 回報區

（Worker 填寫）
