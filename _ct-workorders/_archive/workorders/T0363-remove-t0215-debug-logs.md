---
schema_version: 1
schema_kind: workorder
id: T0363
title: "移除 [T0215-DEBUG-REMOVE] 三處除錯輸出（保留 writeWithResult {ok, reason} 邏輯）"
type: chore
status: DONE
priority: P2
sizing: XS
created_at: "2026-10-04T11:10:00+08:00"
updated_at: "2026-10-04T11:24:33+08:00"
started_at: "2026-10-04T11:11:11+08:00"
completed_at: "2026-10-04T11:12:53+08:00"
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

- **狀態**：DONE（塔台 2026-10-04 11:24 裁決：Worker 回報 PARTIAL，唯一缺口 AC-3 經塔台複驗為 `7243ce2` *archive 移走 parser-parity 測試樣本所致的既有回歸，與本單改動無關 → gate 豁免，另開 T0364 修復）
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

**PARTIAL** — 範圍內的刪除與 CHANGELOG 全部完成並已 commit；唯一未達標的 gate 是 AC-3（測試非全綠），原因為**既有回歸**（`7243ce2` 歸檔移走了測試樣本），與本工單改動無關，且不在 `affects_files` 內，依範圍守則未修。

### 產出摘要

- Commit：`36bf6f0` `chore(pty): remove T0215 debug diagnostics (T0363)`（`git commit --only` 四檔，未推送）
- `scripts/bat-notify.mjs`：刪 570-575（writeResp dump，6 行）
- `electron/pty-manager.ts`：刪 636-643 + 其後空行（writeWithResult entry log，9 行；整理後函式首行即 `// Manager-level check`）
- `electron/terminal-server/server.ts`：刪 251-256 + 其後空行（writePty stderr，7 行）
- `CHANGELOG.md`：`## [Unreleased]` → `### Changed` 末尾新增一筆 chore（屬噪音清理非 bug 修復，故選 Changed）
- 行號與工單表格（`7243ce2`）完全一致，無差異
- 三檔 CRLF 行尾保留（刪除前後所有行皆 CRLF）

**Landing check**：WARN
- C-0：frontmatter 無 `repo` 欄位 → WARN「repo identity unavailable」；observed `basename(REPO_ROOT)` = `better-agent-terminal`
- C-1：PASS（工單位於 `REPO_ROOT/_ct-workorders/`）
- C-3：PASS（4 個 testable entries 全部存在）
- C-2：工單無 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 環境：`CT_MODE=on`、BAT vars 齊全

### 驗收條件逐項

- [x] AC-1 `grep -rn "T0215-DEBUG" electron scripts src` → **0 筆** ✅ PASS
- [x] AC-2 `grep -rn "T0215 (BUG-050" electron scripts` → **3 筆**（`main.ts:1898`、`pty-manager.ts:628`、`bat-notify.mjs:570`）✅ PASS
- [ ] AC-3 `npm run test:unit` → **546 passed / 4 failed（共 550，總數未減少）** ⚠️ 非全綠，既有回歸
  - 失敗皆在 `src/types/__tests__/parser-parity.test.ts`：`Sample <file> not found in ..._ct-workorders. Replace with another workorder/bug.`
  - 缺失樣本：`T0335-…`、`T0336-…`、`T0337-…`、`BUG-081-…`——全部在 `7243ce2`（`*archive 7 items to cold zone`）被移到 `_archive/workorders/`、`_archive/bugs/`
  - 與本工單三檔改動無任何依賴關係；本工單未觸及測試或樣本
- [x] AC-4 `npx vite build` → exit 0 ✅ PASS（含 `dist-electron/terminal-server.js` 重建）
- [x] AC-5 `git diff` 三程式檔 **0 行新增**、僅刪除；`writeWithResult(...): { ok: boolean; reason?: string }` 仍在（`pty-manager.ts:635`），`Error: PTY write failed: ${reason}` 仍在（`bat-notify.mjs:574`）✅ PASS
- [x] AC-6 `36bf6f0` stat 僅 `CHANGELOG.md` / `electron/pty-manager.ts` / `electron/terminal-server/server.ts` / `scripts/bat-notify.mjs` 四檔（+6 / -22）✅ PASS

驗證 lane：source ✅ / build ✅ / unit test ⚠️（既有失敗）/ runtime —（依工單說明由塔台於下次 release 處理，未改安裝目錄）

### 遭遇問題

1. **parser-parity 測試因歸檔失效（既有，範圍外）**：`7243ce2` 歸檔時未同步更新 `src/types/__tests__/parser-parity.test.ts` 的樣本清單（:36-39 一帶）。建議塔台開一張 XS 工單：把 4 個樣本換成仍在 `_ct-workorders/` 的檔案，或讓測試也搜尋 `_archive/` 子目錄；並考慮在 `*archive` 流程加一道「是否被測試引用」檢查。
2. `AGENTS.md` 既有 dirty 未觸碰；本工單檔本身未納入 commit（依步驟 7 只 commit 四檔），留待塔台同步。

### 回報時間

2026-10-04T11:12:30+08:00
