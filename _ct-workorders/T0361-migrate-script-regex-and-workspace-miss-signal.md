---
schema_version: 1
schema_kind: workorder
id: T0361
title: "統一 migrate script ID regex（第五處）+ 新增 workspace miss 觀測訊號"
type: fix
status: DONE
priority: P2
sizing: S
created_at: "2026-09-01T23:34:29+08:00"
updated_at: "2026-09-01T23:41:08+08:00"
started_at: "2026-09-01T23:36:12+08:00"
completed_at: "2026-09-01T23:41:08+08:00"
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

- **狀態**：DONE
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

### 結果摘要

兩個 Part 皆完成，皆為**零行為改變**。

- **Part A**：`scripts/migrate-ct-frontmatter.mjs` 內三處分歧的工單 ID regex 收斂為單一
  `WORKORDER_ID_PREFIX` / `WORKORDER_ID_HEAD` 宣告，文法與 T0360 的 `(?:[A-Z]{2,4}-)?T\d+`
  一致，並補上指向另外三處 sibling 的註解。BUG / PLAN / EXP 文法未動。
- **Part B**：`addExternalTerminal` 在 workspaceId 查無時發出 `[T0361] Workspace miss` warn
  （requested / landed / terminal id 三者並陳）；`src/App.tsx` 的 `[T0130]` log 改印實際落點
  並保留請求值對照。fallback 語意、回傳值、回傳型別全部未動。
- **明確排除項全部遵守**：未實作 ADVISORY B-1、未加 workspaceId 驗證或攔截、未動 BUG/PLAN/EXP
  規則、未做版本 bump / tag / push / release。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter **無 `repo` 欄位**（`expected = absent`），實際 `basename(REPO_ROOT) = better-agent-terminal`。依規則回落到 C-3 + C-1 判定，非 STOP。 |
| C-1 工單路徑 | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` 之下 |
| C-3 affects_files | ✅ PASS | 4 個 testable entry **全部 present**：`scripts/migrate-ct-frontmatter.mjs`、`src/stores/workspace-store.ts`、`src/App.tsx`、`CHANGELOG.md` |
| C-2 branch | ✅ PASS | 工單無 `branch` 欄位；`workdir: main repo`，HEAD = `main` |

- `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- 觀測到的 `BAT_WORKSPACE_ID` = `2eda2f34-9f69-4704-895e-494d9ec0054b`（僅記錄，不比對）

### 變更檔案

| 檔案 | 內容 |
|------|------|
| `scripts/migrate-ct-frontmatter.mjs` | 新增 `WORKORDER_ID_PREFIX` / `WORKORDER_ID_HEAD` 共用常數 + sibling 註解；`inferIdAndKind()` 的 `CT-T\d+` 與裸 `T\d+` 兩個 branch 合併為一；`shouldProcess()` 的 hot-zone regex 拆為 workorder（共用常數）+ BUG/PLAN/EXP（原文法照舊） |
| `src/stores/workspace-store.ts` | `addExternalTerminal()` 加入 `workspaceMiss` 觀測旗標與 `[T0361]` warn |
| `src/App.tsx` | `[T0130] External terminal added` log 改為 `workspaceId(landed)=...` + `workspaceId(requested)=...` 並陳 |
| `src/stores/__tests__/workspace-store.addExternalTerminal.test.ts` | **新增**，4 個 case，覆蓋 G4 / G5 |
| `CHANGELOG.md` | `[Unreleased]` 的 Fixed 加 Part A、Changed 加 Part B |

### 驗收證據

| # | Gate | 結果 | 證據 |
|---|------|------|------|
| G1 | migrate script 前綴 | ✅ PASS | 在 scratch 沙箱建 fixture 後跑**真實 script**（非複製邏輯）：`T0001` / `CT-T001` / `CP-T1148` / `KEEN-T0002` 四者皆被判為 workorder；實跑（非 dry-run）後產出的 frontmatter `id:` 分別為 `T0001` / `CT-T001` / `CP-T1148` / `KEEN-T0002`，**前綴完整保留未被截掉** |
| G2 | migrate script 不誤收 | ✅ PASS | `cp-t1-lower`（小寫）與 `TOOLONG-T1-bad`（前綴 7 字元）在改動前後皆**不出現**於掃描結果。BUG/PLAN/EXP 完全一致：改動前後同為 bug 1 / plan 1 / experiment 1，且三筆 FAIL 訊息逐字相同 |
| G3 | migrate script CLI 行為 | ✅ PASS | 以 `--dry-run --verbose` 對同一組 fixture 跑 `git show HEAD:` 的**改動前版本**與改動後版本並比對輸出。差異只有新增的 2 筆 workorder（`CP-T1148` / `KEEN-T0002`），即本工單的目標；exclude 規則（`T0292-review-report` / `_spec-*` / 非 CT 前綴檔）、summary 表格格式、failure-rate 警示皆未回歸 |
| G4 | miss 訊號 | ✅ PASS | 新測試 4 case：未知 id → 恰 1 則 warn，內容含 `requested=no-such-workspace`、`landed=<active id>`、`terminal=term-miss`；合法 id → **0 則**；完全不帶 → **0 則** |
| G5 | 行為不變 | ✅ PASS | 同測試斷言：miss 情境回傳非 null、`added.workspaceId === active.id`（仍舊 fallback）；合法 id 落在指定 workspace；重複 id 早退路徑仍回 `null` 且不發 warn |
| G6 | App.tsx log | ✅ PASS（原始碼檢視 + 間接測試） | log 改讀 `added.workspaceId`（實際落點），與 `info.workspaceId`（請求值）並陳，未知 id 時兩值不同即可直接看出 miss。此 callback 位於 `useEffect` 內的 IPC listener，無既有 harness 可直接單測；但「`added.workspaceId` 即落點」已由 G5 的 store 測試證實 |
| G7 | 單元測試 | ✅ PASS | `npm run test:unit` → **41 files / 511 tests passed**（基線 507 + 本工單新增 4，≥ 507） |
| G8 | 編譯 | ✅ PASS | `npm run compile` exit 0（renderer 2157 modules + main + preload + terminal-server 全部 built）；`npm run verify:renderer-imports` → `OK -- scanned 151 files under src/ (2 allow-listed), no banned Node imports` |

**G8 附註**：`npm run compile` 實為 `vite build`，屬 bundle gate 而非 type gate。額外跑
`npx tsc --noEmit` 作為補強：全 repo 共 42 個**既有**型別錯誤（`CodexAgentPanel.tsx`、
`agent-profiles.ts` 等，皆與本工單無關），以 grep 確認**本次觸碰的三個檔案
（`workspace-store.ts` / `App.tsx` / 新測試檔）零錯誤**，未引入新的型別問題。

### 設計決策

1. **常數命名用 `WORKORDER_ID_HEAD` 而非直接沿用 `WORKORDER_ID_PATTERN`**：T0360 三處的
   `WORKORDER_ID_PATTERN` 是**頭尾皆錨定**（`^...$`）的完整 ID 驗證器，而 migrate script 的用途是
   從**檔名開頭抽取** ID（後面還接 `-title.md`），語意不同。共用 `WORKORDER_ID_PREFIX` 字串常數
   （與 `src/types/control-tower.ts` 完全同名同值）以保證文法單一來源，另以 `WORKORDER_ID_HEAD`
   表達「前綴匹配」這個不同的用途，避免同名不同語意造成後續誤用。

2. **log prefix 選擇**：`App.tsx` 保留 `[T0130]` 不改為 `[T0361]`。理由是既有維運習慣與可能的
   log 過濾規則都綁在 `[T0130]` 上，改 prefix 會製造新的斷點；T0361 的變更以就地註解標記。
   反之 `workspace-store.ts` 的 warn 是**全新**訊號，用 `[T0361]` 便於在 log 中直接定位來源工單。

3. **warn 發出時機在 fallback 解析之後**：工單原文寫「在 fallback 前發出」，但訊號要求含
   `landed` 值，而 landed 必須先解析 fallback 才知道。實作改為「**判定 miss 在 fallback 前**
   （`workspaceMiss` 旗標於 fallback 前計算），**輸出在 fallback 後**」，兩者皆不影響控制流。
   附帶好處：連 active workspace 也不存在（最終回傳 `null`）的極端情況同樣會留下
   `landed=(none)` 的訊號，診斷力更完整。

4. **`window.electronAPI?.debug?.log?.()` 使用 optional chaining**：沿用同檔既有 776 / 811 /
   821 行的寫法。renderer store 會在 jsdom 單元測試環境被 import，無 preload bridge 時
   optional chaining 可避免 throw；同時符合 CLAUDE.md「renderer 禁用 `console.log`」。

### 偏離與備註

- 工單原文 Part A 表格描述 migrate script 的第五份 regex 位於「~36 / ~40 / ~256 行」共三個位置，
  合併後實際只剩**一份宣告 + 兩個引用點**，符合「宣告一份共用常數」的要求。
- Part A 表格把本檔稱為「第五處」（全鏈路第五份 regex），而檔內註解自稱「第四份」——
  註解計數的是 T0360 已建立的**三處 sibling** + 本檔，兩種說法指涉同一組檔案，無矛盾。
- `AGENTS.md` 在本 session 開始前即為 dirty（非本工單產物），已以 `git commit --only` 精確指定
  路徑提交，**未觸碰亦未還原**該檔。

### Commit

- `007adf8` — `fix(ct): unify migrate script workorder ID regex + add workspace miss signal (T0361)`
- 未 push（工單未授權，塔台負責發布）

### 阻塞 / 後續

- 無阻塞。
- 後續觀察點（非本工單範圍）：ADVISORY B-1（`--workspace` 缺漏時改讀 `BAT_WORKSPACE_ID`）依塔台
  裁決本版不含；本工單新增的 `[T0361] Workspace miss` 訊號可在 0.5.9-pre.1 安裝驗證期間作為
  「是否真的發生 workspace miss」的直接證據，供塔台日後復議 B-1 時引用。

### 互動紀錄

無（`interactive: false` / `fire-and-forget`，全程未需使用者介入）。

