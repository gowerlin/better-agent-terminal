---
schema_version: 1
schema_kind: workorder
id: T0587
title: "隔離派工驗收探針：README「與 BMad Control Tower 協作」版本對照表補「唯讀查詢（MCP）」一列（`isolation: worktree`）"
type: docs
status: DONE
started_at: "2026-10-17T23:53:54+0800"
updated_at: "2026-10-17T23:55:01+0800"
completed_at: "2026-10-17T23:55:01+0800"
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-17T23:52:53+0800"
target_version: "0.7.0-pre.3（候選）"
isolation: worktree
depends_on: []
related:
  - "第七十四 session `v0.7.0-pre.2` 實機驗收待辦 1（隔離派工：Worker 在 `.bat-worktrees` 工作、main 不動、`--worktree-status` 正確）"
  - "T0583（`--isolation worktree`）、T0585（`--worktree-status`）、CT v5.3.0 `ct-exec` § Worktree Isolation"
affects_files:
  - README.md
renew_count: 0
workdir: "BAT 隔離 worktree（`CT_WORKTREE`）"
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 這是**驗收探針**：主要目的是驗證隔離派工本身，產品變更刻意很小。產品檔只改 `README.md` 一處（下方任務），不得動其他產品檔。"
  - "🔴 依 `ct-exec` § Worktree Isolation：`README.md` 在 worktree（`CT_WORKTREE`）裡改並 commit 到 `ct/T0587`；本工單檔（`_ct-workorders/`）一律在主 checkout（`CT_HOME`）修改、**不 commit**（塔台收單時處理）。worktree 裡的 `_ct-workorders/` 不得修改、不得 stage。"
  - "🔴 不得在主 checkout commit 任何東西、不得切換主 checkout 的分支；不 merge 回 main（塔台合併）。不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。寫檔 LF。"
  - "🔴 只改文件，**不需要** `npm install` / `npm ci`（不安裝依賴，D152 的「Worker 依專案規則安裝」在本單不適用）；不跑 unit test / build。"
  - "🔴 並行：T0586 正在主 checkout 改 `electron/bat-mcp-launch.ts`、相關測試與 `CLAUDE.md`；你不碰這些檔，也不碰主 checkout 的工作樹（工單檔除外）。"
---

# T0587 — README 版本對照表補 MCP 一列（隔離派工驗收探針）

## 背景

`v0.7.0-pre.2` 實機驗收要驗隔離派工：Worker 在 `.bat-worktrees/better-agent-terminal/T0587` 工作、分支 `ct/T0587`、主 checkout 不動，塔台用 `--worktree-status T0587` 查狀態後合併。為此選一個無害的小改動。

README「與 BMad Control Tower 協作」→「版本對照」表目前有四列，缺少「BAT 提供的整合點」表已列出的「唯讀查詢（MCP）」。

## 任務

1. 確認自己在隔離 worktree：`CT_HOME` / `CT_WORKTREE` / `CT_WORKTREE_BRANCH`（= `ct/T0587`）/ `CT_WORKTREE_BASE` 都存在，cwd 在 `CT_WORKTREE` 底下，`git branch --show-current` = `ct/T0587`。任一不符 → 不改任何檔，回報 BLOCKED 並附實際值（權杖類 env 值一律不得寫出）。
2. 在 worktree 的 `README.md`「### 版本對照」表最後加一列：

   `| 唯讀查詢（MCP，`mcp__bat__*`） | `>= 0.7.0-pre.2` | 不需要（CT `>= v5.3.0` 列為選用通道） |`

   （表格欄位格式比照既有列；反引號正確成對。不改表格其他列與章節其他內容。）
3. 在 worktree commit（只含 `README.md`），訊息 `docs: README version row for BAT MCP`，附專案 commit attribution。
4. 回報區填「隔離分支證據」（`branch` / `base_sha` / `validated_sha` / `head_sha`），並附：
   - `git -C "$CT_HOME" status --short` 與 `git -C "$CT_HOME" branch --show-current`（證明主 checkout 沒被你動到：分支仍是 `main`；工作樹除了既有的 `src/styles/settings.css`、T0586 的變更與本工單檔之外沒有你造成的變更）
   - worktree 路徑（`CT_WORKTREE`）

## 驗收

- `ct/T0587` 比 base 多一個 commit，只動 `README.md`，內容如任務 2
- 主 checkout 分支仍為 `main`，HEAD 未被本單改變
- 回報區「隔離分支證據」完整

## 不在範圍

- 合併回 `main`（塔台依 `merge-workorder.md` 處理）
- README 其他章節、`CLAUDE.md`、任何程式碼

## 回報區

### 結果摘要

- 狀態：DONE
- 在隔離 worktree 的 `README.md`「### 版本對照」表最後加一列 `| 唯讀查詢（MCP，`mcp__bat__*`） | `>= 0.7.0-pre.2` | 不需要（CT `>= v5.3.0` 列為選用通道） |`，其他列與章節沒有改動。換行為 LF（`cat -A` 確認沒有 `^M`）。
- 已 commit 到 `ct/T0587`：`901cfc48 docs: README version row for BAT MCP`（只含 `README.md`，1 insertion，附 attribution）。
- 依本單 memory_overrides，工單檔只在主 checkout（`CT_HOME`）修改、**沒有 commit**（交給塔台收單）；worktree 內的 `_ct-workorders/` 沒有修改、沒有 stage。
- 沒有 `npm install`、unit test、build（本單規定不跑）；沒有 push、merge、stash、reset、restore，也沒有切換分支。

### 落點檢查（Landing Zone）：PASS

- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單檔在 `$CT_HOME/_ct-workorders/` 底下 → PASS
- C-3：`README.md` 在 worktree 中存在 → PASS
- C-2：工單沒有 `branch` 欄位，不適用（實際分支 `ct/T0587`）
- `CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`
- `CT_WORKTREE_BRANCH` = `ct/T0587`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，沒有拿來比對）
- 任務 1：`CT_HOME` / `CT_WORKTREE` / `CT_WORKTREE_BRANCH` / `CT_WORKTREE_BASE` 都存在；cwd = `CT_WORKTREE`；`git branch --show-current` = `ct/T0587` → 符合
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 隔離分支證據

| 欄位 | 值 |
|---|---|
| worktree（`CT_WORKTREE`） | `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\.bat-worktrees\better-agent-terminal\T0587` |
| `branch` | `ct/T0587` |
| `base_sha` | `45380d4a553b52ce89b09d5c3d4c9f5fae1b7cf8` |
| `validated_sha` | `901cfc4835b56e9d32da3f589fd7eb054c7abbed` |
| `head_sha` | `901cfc4835b56e9d32da3f589fd7eb054c7abbed` |

`validated_sha` = `head_sha`。

- `git rev-list --count base..HEAD` = `1`；`git diff --name-only base..HEAD` = `README.md`
- `git -C "$CT_WORKTREE" status --porcelain` 輸出空白（worktree 乾淨）
- `mcp__bat__bat_worktree_status`（查自己）：`isolated:true`、`branch:"ct/T0587"`、`head:"901cfc48…"`、`mainHead:"45380d4a…"`、`ahead:1`、`behind:0`、`dirty:[]`、`changedFiles:["README.md"]`、`outOfScopeFiles:[]`、`touchesCtWorkorders:false`、`conflicts:[]`、`cached:false` → 可直接 `--ff-only` 合併（`behind == 0` 且 `dirty` 為空）

### 主 checkout 未被變動的證據

`git -C "$CT_HOME" branch --show-current`：

```
main
```

`git -C "$CT_HOME" rev-parse HEAD`：`45380d4a553b52ce89b09d5c3d4c9f5fae1b7cf8`（= base，本單沒有改變 HEAD）

`git -C "$CT_HOME" status --short`：

```
 M _ct-workorders/T0586-codex-mcp-forward-bat-env.md
 M _ct-workorders/T0587-readme-mcp-version-row-isolated.md
 M electron/bat-mcp-launch.ts
 M src/styles/settings.css
```

除了本工單檔，其餘都是既有的變更（`src/styles/settings.css`）或 T0586 的變更（T0586 工單、`electron/bat-mcp-launch.ts`），本單沒有造成。

### 驗證

| 項目 | 結果 |
|---|---|
| `ct/T0587` 比 base 多一個 commit，只動 `README.md`，內容如任務 2 | PASS |
| 主 checkout 分支為 `main`，HEAD 沒有被本單改變 | PASS |
| 隔離分支證據完整 | PASS |
| build / unit test | 不適用（本單規定不跑） |

### 偏離 / 阻礙 / 後續

- 偏離：ct-exec v5.3.0 § Worktree Isolation 第 2 條要求把工單檔 commit 到主 checkout，本單 memory_overrides 規定不 commit，依工單執行，沒有 commit 工單檔。
- 阻礙：無
- 後續：塔台依 `merge-workorder.md` 合併 `ct/T0587`（可 `--ff-only`），並收單 commit 本工單檔。
