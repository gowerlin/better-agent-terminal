---
schema_version: 1
schema_kind: workorder
id: T0363
title: "移除 [T0215-DEBUG-REMOVE] 三處除錯輸出（保留 writeWithResult {ok, reason} 邏輯）"
type: chore
status: PENDING
priority: P2
sizing: XS
created_at: "2026-10-04T11:10:00+08:00"
updated_at: "2026-10-04T11:10:00+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-050（CLOSED 2026-04-23，_archive/bugs/）"
  - "PLAN-024（DROPPED 2026-04-23，_archive/plans/）"
  - "D063（_decision-log.md:706「CLOSED 或 階段 2 完成時清理」）"
  - "T0215（BUG-050 階段 1 方案 A，commit 38725e9）"
affects_files:
  - scripts/bat-notify.mjs
  - electron/pty-manager.ts
  - electron/terminal-server/server.ts
  - CHANGELOG.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只刪 log，不動邏輯**。`writeWithResult` 的 `{ ok, reason }` 回傳、bat-notify 的 `failed` 判斷與 `Error: PTY write failed: <reason>` 輸出、server 的 `writePty` 分支全部原樣保留。"
  - "保留不帶 `-DEBUG-REMOVE` 的 `T0215 (BUG-050 階段 1)` 說明註解（`electron/main.ts:1898`、`electron/pty-manager.ts:628`、`scripts/bat-notify.mjs:576`）——它們解釋現存邏輯，不是除錯標記。"
---

# T0363 — 移除 [T0215-DEBUG-REMOVE] 三處除錯輸出

- **狀態**：PENDING
- **任務類型**：chore（純刪除除錯輸出）
- **工作量預估**：XS
- **Context Window 風險**：低（3 個檔，各刪 5-8 行）

## 背景

T0215（BUG-050 階段 1）為了觀察 refork race，在 PTY 寫入鏈路三處加上 `[T0215-DEBUG-REMOVE]` 除錯輸出，並在 D063 約定「BUG-050 CLOSED 或 PLAN-024 階段 2 完成時」以 grep 清理。

塔台 2026-10-04 已核實清理條件成立：

- BUG-050 → 🚫 CLOSED（2026-04-23）
- PLAN-024 → 🚫 DROPPED（2026-04-23，階段 2 不會發生）
- 三處標記仍在 `main`（`7243ce2`），行號與下表一致

影響：`server.ts` 那處在 server 模式下**每次 `pty:write`（含一般鍵入）都寫一行 stderr**；`bat-notify.mjs` 那處每次 notify 都會把 `writeResp` dump 印到 Worker 畫面。輸出內容只有 id / 長度 / 布林 / 時間戳，無資料外洩疑慮——本工單是噪音清理，不是資安修復。

## 範圍

刪除下列三個區塊（**含其上方的 `// [T0215-DEBUG-REMOVE] ...` 註解行**），其餘一行不動：

| # | 檔案 | 行號（`7243ce2`） | 內容 |
|---|------|------------------|------|
| 1 | `scripts/bat-notify.mjs` | 570-575 | `console.error` writeResp dump |
| 2 | `electron/pty-manager.ts` | 636-643 | `logger.log` writeWithResult entry |
| 3 | `electron/terminal-server/server.ts` | 251-256 | `process.stderr.write` writePty entry |

刪除後若留下多餘空行，順手整理成與周邊一致即可。

另在 `CHANGELOG.md` 的 `## [Unreleased]` 下補一筆（沿用既有 `### Fixed` 或新增 `### Changed`，依現有慣例擇一），例如：

> chore: remove leftover `[T0215-DEBUG-REMOVE]` diagnostics from the PTY write path (`bat-notify.mjs`, `pty-manager.ts`, `terminal-server/server.ts`). The terminal server no longer writes a stderr line on every `pty:write`. Error reporting via `writeWithResult` `{ ok, reason }` is unchanged. (refs: T0363, BUG-050, T0215)

## 明確排除（不要做）

- ❌ 不要改 `writeWithResult` / `writePty` / bat-notify `failed` 判斷的任何邏輯
- ❌ 不要刪 `T0215 (BUG-050 階段 1)` 的非 DEBUG 說明註解（見 memory_overrides）
- ❌ 不要順手清理其他 log 或重構周邊程式
- ❌ 不要碰 `AGENTS.md`（既有 dirty，claude-mem 產生）
- ❌ 不要 push、不要 bump 版號、不要發 release（未授權）

## 驗收條件

- [ ] AC-1 `grep -rn "T0215-DEBUG" electron scripts src` → **0 筆**
- [ ] AC-2 `grep -rn "T0215 (BUG-050" electron scripts` → 仍為 **3 筆**（說明註解保留）
- [ ] AC-3 `npm run test:unit` 全綠，基線 **550**（不得減少）
- [ ] AC-4 `npx vite build` 成功（CLAUDE.md「No Regressions Policy」）
- [ ] AC-5 `git diff` 只有刪除行（+ CHANGELOG 新增），三檔皆無邏輯變更；`writeWithResult` 仍回 `{ ok, reason }`，bat-notify 失敗路徑仍輸出 `Error: PTY write failed: <reason>`
- [ ] AC-6 `git diff --stat` 僅動 `affects_files` 四檔

> **驗證 lane 說明**：本工單只要求 source / build / test 證據。`bat-notify.mjs` 由安裝版 `resources/scripts/` 提供給 Worker，**改動要到下次 release 重裝後才在 runtime 生效**——Worker 不需、也不該去改安裝目錄。runtime 驗收由塔台在下次 release 時處理。

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 先以 `grep -rn "T0215-DEBUG" electron scripts src` 確認三處現況與表格行號一致；若不一致，以 grep 結果為準並在回報區記錄差異
4. 刪除三處區塊 + 補 CHANGELOG
5. 跑 AC-1 ~ AC-6
6. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
7. commit（`git commit --only` 精確指定四個路徑，避免掃進 `AGENTS.md`），訊息建議：`chore(pty): remove T0215 debug diagnostics (T0363)`
8. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
