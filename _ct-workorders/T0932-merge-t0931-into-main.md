---
schema_version: 1
schema_kind: workorder
id: T0932
title: "合併 `ct/T0931`（BUG-225：💬 卡片收合摘要略過程式碼圍欄）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
project: BUG-225
priority: P3
sizing: S
created_at: "2026-11-26T20:15:14+08:00"
updated_at: "2026-11-26T20:18:22+08:00"
started_at: "2026-11-26T20:15:58+08:00"
completed_at: "2026-11-26T20:18:22+08:00"
session_ids:
  - "e9cbb875-7d40-47ff-b57f-a0408d14fe24"
target_version: "0.8.0-pre.5"
kind: merge
merges:
  - "ct/T0931"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: 78f4ecf6f127a449123a770d8ba101eea6a1e713
merge_target: main
depends_on: [T0931]
related:
  - "D371；T0931（`bfc83d1b`，base `a26ceaac`）；`main` 自 base 起併入 T0929（`InboxLists.tsx`、`inbox.css`、新測試、`docs/agent-guide/tower-inbox.md`），判準 1 不成立，所以派合併單。`--worktree-status` conflicts []、塔台 `git merge-tree` 試合併 exit 0（`tower-inbox.md` 兩邊都改但不同段落）"
affects_files:
  - _ct-workorders/T0932-merge-t0931-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0932`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0932-merge-t0931-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0932 — 合併 `ct/T0931` → `main`

## 背景

T0931（BUG-225）改 `src/lib/tower-card-view.ts`、`src/lib/__tests__/tower-card-view.test.ts`、`docs/agent-guide/tower-inbox.md`（`bfc83d1b`，base `a26ceaac`）。期間 `main` 併入了 T0929（`78f4ecf6`：`InboxLists.tsx`、`inbox.css`、`src/components/__tests__/inbox-layout-t0929.test.tsx`、`tower-inbox.md` 一條），塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0931` = `bfc83d1ba54597e37cae2ac1e141045737d306a6`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0932 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0932 T0931 BUG-225 tower card preview" ct/T0931`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 `docs/agent-guide/tower-inbox.md`、`src/lib/__tests__/tower-card-view.test.ts`、`src/lib/tower-card-view.ts`；其他檔算範圍外，照實回報。`tower-inbox.md` 確認 T0929 那條與 T0931 那條都在。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

## 收尾

- 回報區填：merge commit、parent1 / parent2、衝突（無則寫無）、驗收 SHA、樹比對、範圍外檔案。
- 只 commit 本工單檔到主 checkout；通知塔台。塔台做收單 SHA 比對後 ff `main`（斷點 E）。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突，驗收全綠）
- **完成時間**：2026-11-26T20:18:22+08:00
- **session_id**：e9cbb875-7d40-47ff-b57f-a0408d14fe24

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單檔（`_ct-workorders/` 排除）→ not applicable
- C-2：無 `branch` 欄位；主 checkout 在 `main`
- `CT_HOME` 未設定（非 BAT 隔離 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 開工檢查（任務指令 1）

- 整合 worktree（`<repo 上層>/.ct-integration/better-agent-terminal`）：`status --porcelain` 為空、detached 在 `78f4ecf6f127a449123a770d8ba101eea6a1e713` → 乾淨
- `ct/T0931` = `bfc83d1ba54597e37cae2ac1e141045737d306a6` → 相符
- `main` = `3a3e4e10`（開工時），`78f4ecf6..main` 只多 `34096799`、`3a3e4e10` 兩個 commit，檔案全在 `_ct-workorders/**`（`T0930-*.md`、`T0932-*.md`、`_decision-log.md`、`_insights/session-stats/2026-11.json`、`_tower-state.md`）→ 符合
- `ct-merge/T0932` 開工前不存在

### 合併結果

| 項目 | 值 |
|---|---|
| 合併分支 | `ct-merge/T0932`（整合 worktree） |
| merge commit | `f317755c3f09b1f00b539b785238d743cffefcbb` |
| parent1 | `78f4ecf6f127a449123a770d8ba101eea6a1e713`（= `base_main_sha`） |
| parent2 | `bfc83d1ba54597e37cae2ac1e141045737d306a6`（= `ct/T0931`） |
| commit 訊息 | `merge(ct): T0932 T0931 BUG-225 tower card preview` |
| 策略 | `ort`，`--no-ff`；`docs/agent-guide/tower-inbox.md` auto-merging |
| 衝突 | 無 |

### 樹比對

`git diff --name-only 78f4ecf6 f317755c`：

- `docs/agent-guide/tower-inbox.md`
- `src/lib/__tests__/tower-card-view.test.ts`
- `src/lib/tower-card-view.ts`

與預期三檔完全相同；**範圍外檔案：無**。`tower-inbox.md` 兩條都在：BUG-225 / T0931 那條（第 361 行「收合預覽的取行規則」）、T0929 那條（第 429 行「版面（T0929…）」）。

### 驗收（全部跑在 merge commit `f317755c3f09b1f00b539b785238d743cffefcbb`）

| 關卡 | 結果 |
|---|---|
| `npm ci` | exit 0（結尾 `electron-winstaller` install script 被擋，CLAUDE.md 列為預期） |
| `npm run typecheck` | exit 0，`error TS` 0 個 |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0；Test Files 499 passed / 3 skipped（502）；Tests 9064 passed / 41 skipped（9105）；64.42 s |
| e2e | 依工單不跑 |

- 驗收 SHA = merge commit；驗收後整合 worktree `status --porcelain` 為空。

### 遵守的護欄

- 只在整合 worktree 合併；未 ff `main`、未 push、未建 tag、未觸發 workflow、未刪分支；未用 `--force` / `reset --hard` / rebase / stash / `checkout --` / `restore`。
- git 指令皆帶 `-c core.longpaths=true`（`rev-parse` / `log` 等唯讀查詢除外）。
- 主 checkout 只 commit 本工單檔（`git commit --only`）。

### Commit

- 產品變更：無（合併 commit `f317755c` 在整合 worktree 的 `ct-merge/T0932`，由塔台收單 SHA 比對後 `--ff-only`）
- 工單檔：`0c802e5d`（開工）＋收尾 commit（本次）

### 遭遇問題

無。

### 互動紀錄

- [20:15] 開工，yolo、無提問。

### 後續建議

- 塔台：收單 SHA 比對五步 → 斷點 E → `git -C <主 checkout> merge --ff-only ct-merge/T0932` → 合併完成後清理（`ct/T0931` worktree／分支、`ct-merge/T0932`）。
