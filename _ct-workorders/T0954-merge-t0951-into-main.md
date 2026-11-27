---
schema_version: 1
schema_kind: workorder
id: T0954
title: "合併 `ct/T0951`（renderer 啟動命令前打的字移到命令之後，BUG-231）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:33:31+08:00"
updated_at: "2026-11-27T21:37:15+08:00"
started_at: "2026-11-27T21:34:33+08:00"
completed_at: "2026-11-27T21:37:15+08:00"
session_ids:
  - "bd361f2c-b0c9-42aa-9403-49be398022ad"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認）"
kind: merge
merges:
  - "ct/T0951"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: a86b23259218da7ec95d43b06633bdf2d346d7d3
merge_target: main
depends_on: [T0951]
related:
  - "D446；T0951（`f975ef45`，base `18d0a229`）；`main` 自 base 起併入 T0949（經 T0952：`electron/pty-manager.ts`、`electron/main.ts`、`electron/terminal-role.ts`、`CLAUDE.md` 等）與 T0950（經 T0953：`src/lib/pty-replay.ts`、`src/lib/mouse-tracking-reset.ts`、`TerminalPanel.tsx`、`CLAUDE.md` 等），判準 1 不成立，所以派合併單。塔台 `git merge-tree` 試合併無衝突（`pty-manager.ts`、`pty-replay.ts`、`CLAUDE.md` 兩邊都改）"
affects_files:
  - _ct-workorders/T0954-merge-t0951-into-main.md
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0954`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0954-merge-t0951-into-main.md`）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0954 — 合併 `ct/T0951` → `main`

## 背景

T0951（BUG-231）改 17 檔（`electron/pty-manager.ts`、`electron/handlers/pty.ts`、`electron/preload.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/lib/launch-command.ts`、`src/lib/pty-replay.ts`、`src/components/WorkspaceView.tsx`、型別、測試、docs、`CLAUDE.md`），`f975ef45`，base `18d0a229`。期間 `main` 併入了 T0949（經 T0952）與 T0950（經 T0953），`pty-manager.ts`、`pty-replay.ts`、`CLAUDE.md` 兩邊都改，塔台直接合併判準第 1 條不成立，依規則派本單。塔台 `git merge-tree` 試合併無衝突。這是本批最後一張合併。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0951` = `f975ef45e6b46a572381b67e2549c9f3cf87aa81`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0954 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0954 T0951 hold input typed before a renderer launch command (BUG-231)" ct/T0951`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0951 的 17 檔（以 `git diff --name-only 18d0a229 ct/T0951` 為準）；其他檔算範圍外，照實回報。
- [ ] 兩邊都改的檔確認雙方改動都在：`electron/pty-manager.ts`（T0949 `noteTowerDeclaration` / `restoreTowerDeclaration`；T0951 `holdInputForLaunch` / `writeLaunchCommand`）、`src/lib/pty-replay.ts`（T0947 `resetLeftoverMouseTracking`、T0950 `leaveLeftoverAltScreen`、T0951 `holdInputUntilLaunch`）、`CLAUDE.md`（T0946 / T0947 / T0949 / T0950 / T0951 五處）。
- [ ] 整合 worktree `npm ci`；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **結果**：模式 ①（`mechanical`）合併成功，無衝突；驗收全部通過。未 ff `main`、未 push、未刪分支。
- **session_id**：bd361f2c-b0c9-42aa-9403-49be398022ad

### 合併證據

| 項目 | 值 |
|---|---|
| 整合 worktree | `<主 checkout 上層>/.ct-integration/better-agent-terminal`（開工時 detached @ `a86b2325`，`status --porcelain` 空） |
| 合併分支 | `ct-merge/T0954`（新建，從 `base_main_sha`） |
| `base_main_sha` | `a86b23259218da7ec95d43b06633bdf2d346d7d3` |
| 被合併分支 | `ct/T0951` = `f975ef45e6b46a572381b67e2549c9f3cf87aa81`（與工單相符） |
| merge commit | `5661128dc8b7374fd13ba80d0c1c17af757094f4` |
| parent1 / parent2 | `a86b23259218da7ec95d43b06633bdf2d346d7d3` / `f975ef45e6b46a572381b67e2549c9f3cf87aa81` |
| 驗收時 SHA | `5661128dc8b7374fd13ba80d0c1c17af757094f4`（= merge commit） |
| `main` 開工時 | `a001bbb5`；`a86b2325..main` 只改 `_ct-workorders/T0954-…md`、`_decision-log.md`、`_tower-state.md`（符合任務指令 1） |

git 自動合併的三個兩邊都改檔：`CLAUDE.md`、`electron/pty-manager.ts`、`src/lib/pty-replay.ts`（ort，無衝突）。

### 驗收

- [x] 樹比對：`git diff --name-only <base_main_sha> 5661128d` 共 17 檔，與 `git diff --name-only 18d0a229 ct/T0951` 逐行相同（`diff` 無差異）。**範圍外檔案：無。**
- [x] 兩邊改動都在（merge commit 上 `grep -c`）：
  - `electron/pty-manager.ts`：`noteTowerDeclaration` 3、`restoreTowerDeclaration` 2（T0949）；`holdInputForLaunch` 4、`writeLaunchCommand` 2（T0951）
  - `src/lib/pty-replay.ts`：`resetLeftoverMouseTracking` 4（T0947）、`leaveLeftoverAltScreen` 3（T0950）、`holdInputUntilLaunch` 3（T0951）
  - `CLAUDE.md`：T0946 / T0947 / T0949 / T0950 / T0951 各 1 處
- [x] `npm ci` exit 0（結尾 `electron-winstaller` install script 被 allowScripts 擋，屬 CLAUDE.md 記載的預期）
- [x] `npm run typecheck` exit 0，`error TS` 0
- [x] `npm run typecheck:electron` exit 0，`error TS` 0
- [x] `npx vite build` exit 0
- [x] `npm run test:unit` 第一次完整執行即綠：Test Files 519 passed | 3 skipped (522)；Tests 9397 passed | 41 skipped (9438)；Duration 72.14 s
- [x] e2e 未跑（依工單）
- 收尾時整合 worktree `status --porcelain` 為空（停在 `ct-merge/T0954` @ `5661128d`）

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於主 checkout `_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/**` → not applicable
- C-2：工單無 `branch` 欄位；主 checkout 在 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設（非 worktree Worker，合併依工單在整合 worktree 進行）；`BAT_REMOTE_TOKEN` 已設定

### 修改檔案

- 主 checkout：只改本工單檔。
- 整合 worktree：merge commit `5661128d`（分支 `ct-merge/T0954`），沒有其他 commit。

### Commit 狀態

- 產品端：merge commit `5661128dc8b7374fd13ba80d0c1c17af757094f4`（整合 worktree，未 ff `main`）
- 工單檔：`git -C <主 checkout> commit --only _ct-workorders/T0954-merge-t0951-into-main.md`

### 遭遇問題

無。

### 互動紀錄

- 無（yolo，無提問；執行中沒有新的〈塔台補充〉段落）。

### 後續建議

- 塔台依 `merge-workorder.md` § 收單 SHA 比對五步確認後，在主 checkout `git -c core.longpaths=true merge --ff-only ct-merge/T0954`；之後整合 worktree `switch --detach`（§ 合併完成後清理）。
