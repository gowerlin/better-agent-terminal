# T0349 — PLAN-033 Sprint 2: Quick Recovery hygiene 重構

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0349 |
| 標題 | _tower-state.md 🌅 起手式區段瘦身（hygiene refactor）+ archive 內嵌摘要 |
| 類型 | refactor（state hygiene） |
| 優先級 | 🔴 High |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 18:08 (UTC+8) |
| 開始時間 | 2026-04-27 21:23 (UTC+8) |
| 完成時間 | 2026-04-27 21:29 (UTC+8) |
| 派發模式 | `--mode on --no-interactive` |
| 關聯 PLAN | PLAN-033 |
| 關聯規則 | T0348（_local-rules.md「Quick Recovery Hygiene」段落）+ GP121（實證驅動補規則） |
| 預估時間 | 20-40 min |
| Renew 次數 | 0 |
| affects_files | `_ct-workorders/_tower-state.md`、`_ct-workorders/_archive/state-snapshots/2026-Q2-b.md`、`_ct-workorders/_archive/state-snapshots/INDEX.md` |

## 背景

T0347 archive 結構落地後，`_tower-state.md` 從 270 KB 降到 48 KB，但仍超 30 KB 軟警告。T0348 新增「Quick Recovery Hygiene」規則並列入 OOS「下次收工事項」。

實測診斷：
- 🌅 起手式區段（line 171-403）約 232 行，遠超新規則「≤ 50 行」上限
- 內嵌歷史 session 完整摘要（疑似 Session 31 大段時間線/統計表）
- 違反 T0348 規則 #2「禁止內嵌完整 session 收工快照」

本工單 dogfood T0348 剛立的規則，瘦身 🌅 起手式至 hygiene 規則範圍內，把內嵌歷史內容歸檔到 `_archive/state-snapshots/2026-Q2-b.md`。

## 目標

將 `_tower-state.md` 🌅 起手式（line 171-403）瘦身到 ≤ 50 行，內容僅保留：
- 立即待辦（≤ 5 條）
- 近期完成摘要（≤ 5 條，每條一行）
- 快速連結
- 編號起始

被移除的歷史 session 完整摘要 append 到 `_archive/state-snapshots/2026-Q2-b.md`，並更新 `INDEX.md`。

## 任務範圍

### A. 讀取與分析

1. Read `_ct-workorders/_tower-state.md`（特別是 line 171-403 區段）
2. 區分內容類型：
   - **保留**：當前指引（立即待辦、近期完成、快速連結、編號起始）
   - **歸檔**：歷史 session 完整摘要、大段時間線（> 10 行）、詳細統計表
3. 讀取 `_ct-workorders/_archive/state-snapshots/INDEX.md` 確認 session header label 慣例
4. Read `_ct-workorders/_local-rules.md`「Quick Recovery Hygiene」段落（line 386 起，T0348 落地）作為瘦身依據

### B. Archive 寫入

依 `_local-rules.md`「Tower State Archive 規則」的「季檔切割規則」與「INDEX.md 格式」執行：

1. 從起手式抽出歷史 session 完整摘要區塊（連同其 session header）
2. Append 到 `_archive/state-snapshots/2026-Q2-b.md` 末尾（保留原 session header 與時間線格式）
3. 若 append 後 `2026-Q2-b.md` size > 200 KB → 啟動再切割（按 entry count 對半，建立 `2026-Q2-c.md`）；< 200 KB 維持原檔
4. 更新 `INDEX.md`：
   - Append 新的 session row（`| Session | Date | File | Summary |`）
   - Summary 欄位 ≤ 60 字
   - 更新「Last archived session #」（若 INDEX.md 有此 metadata 欄位）

### C. _tower-state.md 瘦身

1. 用結構化清單取代內嵌摘要：
   ```markdown
   ## 🌅 起手式（Quick Recovery）

   > 最後更新：2026-04-27 18:xx

   ### 立即待辦
   1. <最緊急>
   2. <次緊急>
   ...

   ### 近期完成
   - <關鍵成果一行>
   - ...

   ### 快速連結
   - Bug Tracker → [_bug-tracker.md](_bug-tracker.md)
   - Backlog → [_backlog.md](_backlog.md)
   - Decision Log → [_decision-log.md](_decision-log.md)
   - Learnings → [_learnings.md](_learnings.md)
   - 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

   ### 編號起始
   - T#### / BUG-### / PLAN-### / D###
   ```
2. **嚴格上限：50 行**（含區段標題與空行）
3. **僅刪除 line 171-403 內的歷史內嵌**，line 405 以後（明日起手式 ORIGINAL / 基本資訊 / 進度快照 / 管理筆記 / 歸檔索引 / 環境快照 / YOLO 歷程）**完全不動**
4. line 7-169 的本 / 前 session 收工快照**不動**

### D. 驗證

1. 重新計算 `_tower-state.md` size：目標 ≤ 30 KB（軟警告綠燈）
2. Grep 確認瘦身後 🌅 起手式區段行數 ≤ 50
3. Grep 確認 `_archive/state-snapshots/2026-Q2-b.md` 含新 append entry
4. Grep 確認 `INDEX.md` 新 session row 已加

### E. Commit

單 commit 收尾：

```
chore(state): refactor _tower-state.md Quick Recovery section per hygiene rule (PLAN-033 Sprint 2)

- 起手式從 232 行 → ≤ 50 行（hygiene rule compliant）
- 內嵌歷史 session 摘要 → _archive/state-snapshots/2026-Q2-b.md
- 更新 INDEX.md（新 session row）
- _tower-state.md size: 48 KB → ~XX KB（軟警告閾值內）

Closes T0349 (PLAN-033 Sprint 2 OOS hygiene cleanup)
```

## 完成定義（DoD）

1. ✅ `_tower-state.md` 🌅 起手式區段 ≤ 50 行
2. ✅ `_tower-state.md` total size < 30 KB（軟警告綠燈）
3. ✅ 被移除的歷史內嵌已 append 到 `_archive/state-snapshots/2026-Q2-b.md`（無資料遺失）
4. ✅ `INDEX.md` 已更新（新 session row + ≤ 60 字 summary）
5. ✅ `_tower-state.md` line 7-169（本 / 前 session 收工快照）與 line 405 以後（其他結構化區段）完全不動
6. ✅ 單 commit 收尾

## OOS

- ❌ 不修改 line 7-169 的 session 收工快照區段（只動 🌅 起手式）
- ❌ 不修改 SKILL.md 主檔（T0350 上游 PR 工作範圍）
- ❌ 不重構其他區段（明日起手式 ORIGINAL / 基本資訊 / 進度快照 / 管理筆記 / 歸檔索引 / 環境快照 / YOLO 歷程）
- ❌ 不執行 archive 自動化命令的程式碼實作（只手動執行一次依規則手動 archive，命令實作併入後續 sprint）
- ❌ 不刪除 line 405 「明日起手式 ORIGINAL」區段（原始 baseline 保留供對照）

## 互動旗標

`--no-interactive`：純 refactor 工作，規則明確。

例外情境（停手回報）：
- 起手式內容無法清楚區分「保留」vs「歸檔」（含混合語意段落）→ 暫停請塔台仲裁
- `2026-Q2-b.md` append 後 size > 200 KB 且需再切割（新建 `2026-Q2-c.md`）→ 確認切割點後執行
- 發現 `INDEX.md` 既有 row 與將 append 的 session 重複 → 暫停請塔台確認

## 回報區

（Worker 填寫）

### 結論摘要

DONE — Quick Recovery hygiene refactor 完成，`_tower-state.md` 起手式已由 238 行歷史內嵌縮至 28 行，state size 49,502 bytes → 24,077 bytes（< 30 KB）。Session 31 歷史摘要已 append 至 `_archive/state-snapshots/2026-Q2-b.md`，`INDEX.md` 新增 row #55。

### 完成狀態

DONE

### 產出摘要

- 修改 `_ct-workorders/_tower-state.md`：保留 line 7-169，將 Quick Recovery 改為 立即待辦 / 近期完成 / 快速連結 / 編號起始。
- 修改 `_ct-workorders/_archive/state-snapshots/2026-Q2-b.md`：append Session 31 收工快照，Entries 27 → 28。
- 修改 `_ct-workorders/_archive/state-snapshots/INDEX.md`：Total archived entries 54 → 55，新增 Session 31 row。
- 修改 `sprint-status.yaml`：更新 last_updated 與 next ID pointers。
- 修改本工單：開始時間與回報區。

### 驗證

- `git diff --check`：通過（僅 Git 提示 LF/CRLF touch warning）。
- `_tower-state.md` size：24,077 bytes，< 30 KB。
- Quick Recovery section：line 171-198，28 lines，≤ 50。
- `2026-Q2-b.md` size：178,853 bytes，< 200 KB，未觸發再切割。
- Archive entry count：`^## 🏆 Session 31 收工快照` = 1。
- INDEX row count：`| 55 | Session 31 收工快照` = 1。
- `sprint-status.yaml`：已更新。

### 遭遇問題

PowerShell 第一次機械 rewrite 時 `AddRange(System.Object[])` 型別錯誤，導致 `_tower-state.md` 先寫入了缺失 Quick Recovery 的中間狀態；已立即以 `apply_patch` 修復。另一次 `INDEX.md` rewrite 將既有 embedded CR 拆成多行；已從 `HEAD` 原文重建並只重套 metadata + row 55，diff 已確認只剩預期變更。

### 互動紀錄

無

### Renew 歷程

無

### Commit

`ff528ee` — `chore(state): refactor _tower-state.md Quick Recovery section per hygiene rule (PLAN-033 Sprint 2)`

### 回報時間

2026-04-27 21:28 (UTC+8)
