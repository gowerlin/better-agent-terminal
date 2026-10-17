---
schema_version: 1
schema_kind: workorder
id: CT-T016
title: "【受派】CT 合併工單：三種模式模板（機械 / 衝突解決 / 等價移植）、收單 SHA 比對、塔台直接合併判準（用 BAT `--worktree-status`）"
type: implementation
status: DONE
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-17T22:56:03+0800"
depends_on:
  - "CT-T015（隔離派工與 Worker 的 SHA 回報欄位）"
  - "T0585（`worktree:terminal-status` / `--worktree-status`，`77c93c64`）"
related:
  - D150
  - D152
  - PLAN-047（§三之一、§三之二）
  - "BAT T0574 回報區 R5（合併流程實測：`--ff-only` 機械保證 main 不變的四種情況、merge-tree 成本、直接合併五條判準）"
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T016 — 合併工單

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 軌道 W，D150：合併由塔台派合併工單執行，BAT 不做合併引擎，只提供唯讀信號）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `CLAUDE.md`「worktree 狀態查詢（PLAN-047 W1 / T0585）」小節
- **依賴**：CT-T015（隔離派工）。兩張可同版發佈。

## BAT 提供的唯讀信號（T0585）

`bat-terminal.mjs --worktree-status T#### --notify-id "$BAT_TERMINAL_ID"`（或 MCP `bat_worktree_status`）→ JSON：

| 欄位 | 意義 |
|---|---|
| `isolated` | `false` = 該 Worker 不是隔離派出，其餘欄位不存在 |
| `branch` / `base` / `head` / `mainHead` / `mainCheckout` / `path` | 分支、派工 base、分支目前 SHA、主 checkout 目前 HEAD |
| `ahead` / `behind` | 相對 `mainHead` |
| `dirty`（陣列）/ `dirtyCount`；`worktreeMissing` | worktree 未提交 / 未追蹤檔；目錄已刪時 `dirty: null` |
| `changedFiles` / `changedCount` | `mainHead...head` 實際變更（`--no-renames`，搬移時新舊路徑都列） |
| `outOfScopeFiles` / `outOfScopeCount` | 不符工單 `affects_files` 的變更；`null` = 讀不到工單或沒有該欄位（**不代表範圍內**）；`_ct-workorders/**` 不算 |
| `touchesCtWorkorders` | 分支改到 `_ct-workorders/**` |
| `conflicts` | `merge-tree` 預測衝突檔；`[]` 乾淨；`null` + `conflictsError` = 無法判斷；可 ff 時固定 `[]` |
| `cached` | ahead / behind / changedFiles / conflicts 沿用同一組 head / mainHead 的結果 |

限制：只查**執行中**的 Worker 分頁；分頁關閉後改用 git 直接查 `ct/T####`。錯誤碼另有 `GIT_FAILED`（分支或主 checkout 已不在）、`TIMEOUT`（10 s）。

## 修改清單

1. **合併工單模板**（`work-order-template.md`；沿用一般工單 + 固定欄位，不新增單據類型）：frontmatter `kind: merge`、`merges: [T####]`、`merge_mode: mechanical | conflict | port`、`integration_worktree`（長期保留的整合 worktree 路徑，避免每次重裝依賴）、`base_main_sha`（派合併工單時的 main）、`merge_target`（預設 `main`；需要 PR 的專案可指定整合分支）。
2. **三種模式**（D150，原文見 PLAN-047 §三之二）：
   - ① 機械合併：無衝突且符合直接合併判準 → 塔台可直接做（見第 4 點），不必派單。
   - ② 衝突解決：在整合 worktree 解衝突、跑專案完整驗收；回報每個衝突檔的雙方意圖、解法與理由；驗收全綠且無範圍外檔案 → yolo 自動 ff，否則暫停（斷點 E）。
   - ③ 等價移植：分支過舊 / 程式碼已重構 / EXP 或上游成果 → 以原工單目標與驗收條件為規格在目前 main 重新實作，不用 git merge；回報「原 commit / hunk → 新位置」對照表與逐條重驗；**一律暫停**等使用者確認。
   - 模式由塔台決定；Worker 在 ② 遇到超出衝突解決的情況回報 PARTIAL 並建議改 ③，不自行升級。
3. **共同護欄**：只在整合 worktree 工作；`--no-ff` 合併（commit 訊息含工單 ID），main 只 `git merge --ff-only`；不 push（沿用各專案授權）；主 checkout 有與合併檔重疊的髒檔時 ff 會被拒（正常保護），清掉再 ff。
4. **塔台直接合併判準**（全部成立才可直接做，否則派合併工單；BAT 實測依據 T0574 R5 / T0585）：
   1. `--worktree-status` 的 `behind == 0`；**或** main 自 base 以來只在 `_ct-workorders/**` 前進（`git diff --name-only <base>..main` 只有 `_ct-workorders/**`）—— BAT 塔台建議採這個放寬版本，因為塔台的工單記帳 commit 幾乎一定讓 main 前進；最終由 BMad-Guide 塔台 / 使用者決定
   2. Worker 回報的 `validated_sha` = `head`
   3. `outOfScopeFiles` 為空陣列（`null` 不算通過），且 `touchesCtWorkorders == false`
   4. `conflicts == []`
   5. `dirty` 為空陣列（`worktreeMissing` 不算通過），主 checkout 沒有與 `changedFiles` 重疊的髒檔
   - `behind == 0` 時直接 `git merge --ff-only ct/T####`（線性）或依 Q9 走 `--no-ff`（在整合 worktree 合併後對 main `--ff-only`）；放寬情況（main 只有工單記帳前進）一律走整合 worktree `--no-ff` 再 ff。
5. **收單 SHA 比對五步**（合併工單回報後，塔台執行）：① `base_main_sha` = 派單時 main；② `head_sha` = Worker 工單分支驗收時的 SHA；③ 合併 commit 的 parent1 = ff 前的 main、parent2 = ②；④ ff 後 main = 合併 commit；⑤ 合併期間 main 前進：`git diff --name-only <parent1>..main` 只有 `_ct-workorders/**` → 在整合分支再 merge main 後 ff（產品樹相同，不重跑驗收）；否則 Renew 重做。
6. **斷點 E**：非 yolo 一律在 ff 前暫停確認；yolo 依第 2 點各模式規則。
7. **合併完成後清理**：`--close-worker T#### --worktree remove`（或塔台手動 `git worktree remove`），分支保留到使用者同意刪除或 `archive`。

## 驗收

- 文件：模板、三模式、判準、SHA 五步各在權威位置一份。
- 實機（BAT 0.7.0-pre.2，發版後另開單，可與 CT-T015 實機驗收合併）：隔離派兩張小單 → 一張符合判準由塔台直接合併 → 另一張故意製造衝突走 ② 合併工單 → main 只以 `--ff-only` 前進、SHA 五步全部成立。

---

## 轉交紀錄

- 2026-10-17T23:01:56+0800：BAT 塔台以跨 session 訊息轉交 BMad-Guide 塔台（`bmad-guide-47`，msg `3deb4bbe`，`notify_when_idle`）。
- 2026-10-17T23:01:56+0800：對方**已受理**，CT-T015 + CT-T016 合為 **CT v5.3.0**（對方 T0155，23:01 派工；guide v5.3.0 由 T0156；對方決策 D031）。基底為 CT v5.2.6（非規格寫的 v5.2.4）；欄位名採 `isolation: worktree`；直接合併判準第 1 條採放寬版；合併一律整合 worktree `--no-ff` 後 main `--ff-only`（behind == 0 亦同，不做線性 ff，與 T0574 Q9 一致）；斷點 E 寫入 `yolo-mode.md`、斷點 D 待 M1b；本輪 source / release / 兩端安裝，runtime 待 0.7.0-pre.2 發佈後另開單合驗；介面權威以 BAT CLAUDE.md 四小節為準，差異於完成回覆時列出。BAT 塔台**接受**上述全部。
- 2026-10-17T23:18:28+0800：對方回報 **DONE（source / release / 兩端安裝）**：CT **v5.3.0**（T0155，commit `70afce0`，未 push）；CT-T016 新 reference `merge-workorder.md` 為合併流程唯一權威，直接合併一律 `ct-merge/T####` `--no-ff` 後 main `--ff-only`。差異 1–3（舊 BAT 忽略 isolation 以「exit 0 無 `worktree:` 行」判定、`GIT_FAILED` 歸 exit 1、判準比 CLAUDE.md 嚴）BAT 塔台**接受**。Q1–Q4 裁決（msg 回覆）：Q1 確定 exit 0，建議判定順序 exit code → `bat-scripts.log` `terminal-created` 的 `worktree` 欄位（字串 / null）→ stdout；Q2 `CT_HOME` 維持 Windows 反斜線（契約）；Q3 關閉後仍可查列為 BAT 後續工單候選（未排期）；Q4 尾端 `/` 會被去除，等同目錄前綴。**runtime lane 待使用者安裝 0.7.0-pre.2 後對方開單合驗。**
- 2026-10-18T00:05:53+0800：對方回報 **runtime lane PASS**（對方 T0158 DONE，AC-1～AC-11；CT v5.3.0 × BAT 0.7.0-pre.2，`merge_target: dev-main`），回覆檔 `D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-v530-runtime.md`，由使用者轉交。隔離派工（含 exit `7`）、`CT_*` env、C-0、SHA 回報、MCP 塔台 / Worker、回收順序、直接合併判準與模式 ①、清理都通過。對方未驗：模式 ② / ③、舊主程式的「未隔離」路徑、Codex 分頁 MCP、斷點 D。BAT 端同日補驗：Codex 分頁 MCP → BUG-148 / T0586（FIXED，實機待 0.7.0-pre.3）；模式 ② → T0588（合併 T0587）。對方給 BAT 的三點觀察：① 以 `keep` 關閉的分頁 `bat_list_terminals` 仍列為 `exited`，`--worktree-status` 回 `NOT_FOUND` → 併入 PLAN-047 Q3 的考量（以 list 看得到的 exited 分頁為範圍）；② Claude Code 只顯示 MCP 錯誤的 `content` 文字、看不到 `structuredContent` → shim 的錯誤 `content` 已以 `<CODE>: <message>` 開頭，不需改；③ `bat_worktree_status` 的 `cached: true` 行為符合 T0585。**全部 lane 結案。**
