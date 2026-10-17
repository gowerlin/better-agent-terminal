---
schema_version: 1
schema_kind: workorder
id: CT-T015
title: "【受派】CT 支援 BAT 0.7.0-pre.2 的 worktree 隔離派工（`--isolation worktree`、`CT_HOME`、C-0 修正、SHA 回報）與 BAT MCP 唯讀 tool"
type: implementation
status: DONE
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-17T22:56:03+0800"
depends_on:
  - "T0583（worktree 隔離派工，`462522ef` / `4e7da0e3`）"
  - "T0584（`bat-mcp.mjs` shim + 注入，`d1b82946`）"
  - "T0582（唯讀查詢 channel，`6b2ac19e`）"
related:
  - D150
  - D152
  - PLAN-047
  - "CT-T016（合併工單模板，依賴本單的 SHA 回報欄位）"
  - "CT-T011 / CT-T013 / CT-T014（同類「BAT 定介面契約、CT 依約撰寫」範本）"
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T015 — worktree 隔離派工與 BAT MCP

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 M1 / W1，D150 / D152）
- **目標專案**：BMad-Control-Tower（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\`，現行 v5.2.4；由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `CLAUDE.md` 的「worktree 隔離派工（PLAN-047 W1 / T0583）」「worktree 狀態查詢（T0585）」「helper 唯讀查詢 channel（T0582）」「BAT MCP shim（T0584）」四個小節（唯讀參考；本檔摘錄重點，衝突時以 CLAUDE.md 為準）
- **版本**：BAT `>= 0.7.0-pre.2`（本檔建立時發版中）。舊 BAT 對新參數的行為見各節；**隔離為選用，不帶時行為與現在完全相同**

## BAT 端已提供（source / test 驗證完成；runtime 隨 0.7.0-pre.2）

### A. 派工：`--isolation worktree`

```
"${BAT_HELPER_NODE:-node}" "<helper>\bat-terminal.mjs" --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" \
  --cwd "<專案根目錄>" --mode <m> [--interactive|--no-interactive] --agent default \
  --skill ct-exec --workorder T#### --isolation worktree
```

- 只在 agent skill 模式（`--skill` + `--workorder`）有效；raw command 或缺 `--workorder` → exit 1（用法錯誤）。
- BAT 以派工 cwd 的 git toplevel 為主 checkout，建立 `<主 checkout 上層>/.bat-worktrees/<repo 名>/<T####>`，分支 `ct/<T####>`，base = 主 checkout 當下 `HEAD`。同工單重派（Renew）沿用既有 worktree 與分支（`reused`，base 回報為 `merge-base HEAD ct/T####`）。
- 成功：exit 0；stdout 在既有行之後多 `  worktree: <path>`、`  branch: ct/T####`、`  base: <40 字元 SHA>`（沿用時加 `(reused)`）。
- **失敗：exit 7**，stderr `create: WORKTREE_FAILED`（前一行為原因），**不建立分頁**。
- 舊 BAT（< 0.7.0-pre.2）的 helper：`--isolation` 印 `Unknown option`、exit 1，**在建立分頁之前結束**。
- 隔離派工的 helper 等待上限 40 s（建 worktree 可能較久），一般派工仍 3 s。
- **BAT 不安裝依賴**（D152）：worktree 內沒有 `node_modules` 等；Worker 依專案規則自行安裝（本專案：`npm ci`，約 16 s / 2 GB）。

### B. Worker 分頁的 env（BAT 注入）

| 變數 | 值 |
|---|---|
| `CT_HOME` | 主 checkout 絕對路徑（Windows 為反斜線） |
| `CT_WORKTREE` | worktree 路徑（Worker 的 cwd 在其中，派工 cwd 若在子目錄則保留子路徑） |
| `CT_WORKTREE_BRANCH` | `ct/<T####>` |
| `CT_WORKTREE_BASE` | base SHA（40 字元） |

worktree 內也有一份 base 當下的 `_ct-workorders/` 副本；那是**唯讀副本**，不得修改或 stage。

### C. 回收：`--close-worker … --worktree keep|remove|archive`

- 不帶 = `keep`（只關分頁）。清理在分頁實際關閉後執行（延遲 / 等安靜 / 使用者輸入取消規則不變；取消則不清理），結果只寫 BAT 日誌，exit code 與既有 `--close-worker` 相同。
- `remove`：`git worktree remove`（不 `--force`），**分支 `ct/T####` 保留**；worktree 有未提交 / 未追蹤變更 → 不刪（保留並記 warn）。
- `archive`：同 `remove`，另把分支改名 `ct-archive/T####` → **合併前不要用**。
- 未隔離派出的 Worker 帶 `--worktree` → 忽略，照常關分頁。

### D. 查詢：`--worktree-status` 與 MCP

- `bat-terminal.mjs --worktree-status T#### --notify-id "$BAT_TERMINAL_ID"` → stdout 一行 JSON；exit `0` / `3` NOT_FOUND / `4` NOT_OWNER / `5` AMBIGUOUS / `1` 其他（stderr `worktree-status: <CODE>`，`UNSUPPORTED` = BAT 太舊）。欄位語意見 CT-T016。
- **BAT MCP**（Settings「BAT MCP」預設開）：BAT 啟動的 claude / codex 分頁有 `mcp__bat__*` 唯讀 tool：`bat_whoami`、`bat_list_terminals`、`bat_get_state`（`working` / `idle` / `exited`；`blocked` 尚未提供）、`bat_read_output`（去 ANSI、權杖類字串已遮罩、`cursor` 增量）、`bat_wait`（≤ 45 s）、`bat_worktree_status`。範圍由分頁權杖決定：Worker 只能查自己（另可查綁定塔台的 metadata）；塔台可查自己與自己派出的 Worker。錯誤以 tool 結果 `isError` + `code` 回（`NOT_OWNER` / `NOT_FOUND` / `UNSUPPORTED` / `CONNECT_FAILED` …）。

## 修改清單

1. **派工**（`references/auto-session.md` 命令表 + `work-order-template.md`）：
   - 工單 frontmatter 新增選用欄位（名稱由 CT 決定，建議 `isolation: worktree`）；有此欄位時派工命令加 `--isolation worktree`，沒有則不加（預設不隔離，D152）。
   - exit 7 → 不重試、**不自動改用非隔離派工**；告知使用者原因，由使用者決定重派方式。exit 1 照既有規則（舊 BAT 不認識 `--isolation` 也是 exit 1）。
2. **ct-exec / ct-done 在 worktree 中**（以 `CT_HOME` 存在判定）：
   - 工單讀寫與 commit 一律走 `$CT_HOME/_ct-workorders/`：`git -C "$CT_HOME" commit --only _ct-workorders/<檔>`；worktree 內**禁止 stage** `_ct-workorders/`。
   - 產品變更 commit 在 worktree（目前分支 `ct/T####`），不碰主 checkout 的產品檔。
   - **落點檢查 C-0**：worktree 的 `basename(git rev-parse --show-toplevel)` 是 `T####`，改用 `basename "$CT_HOME"`（或 `basename(dirname(realpath(git rev-parse --git-common-dir)))`）。
   - 依賴：worktree 缺依賴時依專案規則安裝（ct-exec 提示查專案 `CLAUDE.md` / `AGENTS.md`）。
   - 收工前**全部 commit**（`--worktree remove` 不刪髒 worktree）。
   - 回報區新增：`base_sha`（`$CT_WORKTREE_BASE`）、`head_sha`（`git -C "$CT_WORKTREE" rev-parse HEAD`）、`validated_sha`（跑驗收時的 HEAD；與 `head_sha` 不同要說明）、`branch`。
3. **收單 / 回收**（`work-order-system.md` § 回報處理流程）：隔離工單的 `worker_auto_close` 用 `--worktree keep`（分支與 worktree 留給合併）；合併完成後才 `--worktree remove`（或塔台手動清理）。合併流程本身見 CT-T016。
4. **MCP（選用通道）**：`auto-session.md` 增一小節說明上述 tool、範圍、錯誤碼；降級鏈 **MCP → helper CLI → 檔案**；判斷仍以 exit code / tool 的 `isError` 為準。目前沒有 CT 規則必須使用 MCP（斷點 D 的 blocked 偵測待 BAT M1b）。
5. 版本說明 / CHANGELOG：註明 BAT `>= 0.7.0-pre.2`；不使用隔離時與 v5.2.4 行為相同。

## 驗收

- 文件：上述規則在 CT 的權威位置各一份（SKILL.md 只放摘要，遵守 summary-authority rule）。
- 舊 BAT / 不帶 `isolation` 的工單：派工、回報、回收與 v5.2.4 完全相同。
- 新 BAT 0.7.0-pre.2 實機（發版後另開單）：隔離派一張小單 → Worker 在 worktree commit 產品變更、工單回報寫回主 checkout、C-0 PASS、回報含三個 SHA → `--close-worker --worktree keep` → 分支在、主 checkout 的 main 未動。

---

## 轉交紀錄

- 2026-10-17T23:01:56+0800：BAT 塔台以跨 session 訊息轉交 BMad-Guide 塔台（`bmad-guide-47`，msg `3deb4bbe`，`notify_when_idle`）。
- 2026-10-17T23:01:56+0800：對方**已受理**，CT-T015 + CT-T016 合為 **CT v5.3.0**（對方 T0155，23:01 派工；guide v5.3.0 由 T0156；對方決策 D031）。基底為 CT v5.2.6（非規格寫的 v5.2.4）；欄位名採 `isolation: worktree`；直接合併判準第 1 條採放寬版；合併一律整合 worktree `--no-ff` 後 main `--ff-only`（behind == 0 亦同，不做線性 ff，與 T0574 Q9 一致）；斷點 E 寫入 `yolo-mode.md`、斷點 D 待 M1b；本輪 source / release / 兩端安裝，runtime 待 0.7.0-pre.2 發佈後另開單合驗；介面權威以 BAT CLAUDE.md 四小節為準，差異於完成回覆時列出。BAT 塔台**接受**上述全部。
- 2026-10-17T23:18:28+0800：對方回報 **DONE（source / release / 兩端安裝）**：CT **v5.3.0**（T0155，commit `70afce0`，未 push）；CT-T016 新 reference `merge-workorder.md` 為合併流程唯一權威，直接合併一律 `ct-merge/T####` `--no-ff` 後 main `--ff-only`。差異 1–3（舊 BAT 忽略 isolation 以「exit 0 無 `worktree:` 行」判定、`GIT_FAILED` 歸 exit 1、判準比 CLAUDE.md 嚴）BAT 塔台**接受**。Q1–Q4 裁決（msg 回覆）：Q1 確定 exit 0，建議判定順序 exit code → `bat-scripts.log` `terminal-created` 的 `worktree` 欄位（字串 / null）→ stdout；Q2 `CT_HOME` 維持 Windows 反斜線（契約）；Q3 關閉後仍可查列為 BAT 後續工單候選（未排期）；Q4 尾端 `/` 會被去除，等同目錄前綴。**runtime lane 待使用者安裝 0.7.0-pre.2 後對方開單合驗。**
- 2026-10-18T00:05:53+0800：對方回報 **runtime lane PASS**（對方 T0158 DONE，AC-1～AC-11；CT v5.3.0 × BAT 0.7.0-pre.2，`merge_target: dev-main`），回覆檔 `D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-v530-runtime.md`，由使用者轉交。隔離派工（含 exit `7`）、`CT_*` env、C-0、SHA 回報、MCP 塔台 / Worker、回收順序、直接合併判準與模式 ①、清理都通過。對方未驗：模式 ② / ③、舊主程式的「未隔離」路徑、Codex 分頁 MCP、斷點 D。BAT 端同日補驗：Codex 分頁 MCP → BUG-148 / T0586（FIXED，實機待 0.7.0-pre.3）；模式 ② → T0588（合併 T0587）。對方給 BAT 的三點觀察：① 以 `keep` 關閉的分頁 `bat_list_terminals` 仍列為 `exited`，`--worktree-status` 回 `NOT_FOUND` → 併入 PLAN-047 Q3 的考量（以 list 看得到的 exited 分頁為範圍）；② Claude Code 只顯示 MCP 錯誤的 `content` 文字、看不到 `structuredContent` → shim 的錯誤 `content` 已以 `<CODE>: <message>` 開頭，不需改；③ `bat_worktree_status` 的 `cached: true` 行為符合 T0585。**全部 lane 結案。**
