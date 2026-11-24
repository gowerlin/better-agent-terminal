---
schema_version: 1
schema_kind: workorder
id: T0914
title: "合併 T0913（W8 整合驗收的測試）→ `v0.8.x`（已含 T0912 文件），跑完整驗收"
type: chore
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: S
created_at: "2026-11-25T07:01:19+08:00"
started_at: "2026-11-25T07:01:52+08:00"
completed_at: "2026-11-25T07:06:26+08:00"
updated_at: "2026-11-25T07:06:26+08:00"
session_ids:
  - "2c701224-cb4f-4c09-a4df-b999bf65a57b"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
kind: merge
merges:
  - T0913
merge_mode: conflict
integration_worktree: 'D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\.ct-integration\better-agent-terminal'
base_main_sha: e6f18bf0f8971333cc7d8b8a1b7e50f9deb641a9
merge_target: v0.8.x
depends_on: [T0912, T0913]
related:
  - "PLAN-068；D335；T0912（W7 文件，已在 `v0.8.x` `e6f18bf0`）；T0913（只新增 `e2e/t0913-tower-inbox-integration.spec.ts`、`e2e/fixtures/helper-job-runner.mjs`、`electron/remote/__tests__/headless-tower-inbox-e2e.test.ts`）"
affects_files:
  - _ct-workorders/T0914-merge-t0913-into-v08x.md
  - e2e/
  - electron/remote/__tests__/
renew_count: 0
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ②（`conflict`）與 § 共同護欄執行。選 ② 只因為 `v0.8.x` 在 T0913 開工後多了 T0912 的文件改動（不符直接合併判準第 1 條）；塔台試合併**沒有衝突**（T0912 只改文件，T0913 只加測試）。只在整合 worktree 工作；Windows 上 git 指令加 `-c core.longpaths=true`。"
  - "🔴 開工：整合 worktree 乾淨（目前 detached `e6f18bf0`）；`switch -c ct-merge/T0914 e6f18bf0f8971333cc7d8b8a1b7e50f9deb641a9`（已存在就停下問塔台）；確認 `ct/T0913` = `a00b1b4a4a93d7700551a272c42119519347a8cb`、`v0.8.x` = `e6f18bf0…`。合併：`git merge --no-ff -m \"merge(ct): T0913 PLAN-068 W8 integration acceptance tests\" ct/T0913`。出現衝突就照模式 ② 處理並在回報區說明（預期沒有）。"
  - "🔴 驗收（跑在合併後的 head，回報 SHA）：`npm ci`；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0；`npm run test:unit` 第一次完整執行即綠（附數字，失敗照實回報、不重跑矇過）；`npm run test:legacy` 全綠；e2e `e2e/t0913-tower-inbox-integration.spec.ts` 1 次。只用隔離實例；不碰使用者的 BAT；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的回合；`TMP` 用系統預設；程序清理照 D308。"
  - "🔴 不 ff `v0.8.x`、不動 `main`、不 push、不建 tag、不觸發 workflow；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/<本檔>`）。範圍外檔案：回報合併結果相對 `base_main_sha` 不在 T0913 `affects_files` 的檔案，沒有就寫「無」。yolo：不得問使用者，判讀問題問塔台。"
---

# T0914 — 合併 T0913 → `v0.8.x`

| 被合併分支 | head_sha | 內容 |
|---|---|---|
| `ct/T0913` | `a00b1b4a` | W8：隔離實例整合 e2e、headless 遠端路徑測試、helper job runner fixture |

## 驗收

- [x] `--no-ff` 合併（預期無衝突）
- [x] 驗收全綠（`test:unit` 第一次即綠）、e2e t0913 1 次
- [x] 範圍外檔案：無

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（模式 ② `conflict`，實際無衝突；未 ff `v0.8.x`、未動 `main`、未 push）
- **session_id**：2c701224-cb4f-4c09-a4df-b999bf65a57b

### 落點檢查
- PASS。C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1：工單在 REPO_ROOT 底下；C-3：`e2e/`、`electron/remote/__tests__/` 都存在；C-2：工單沒有 `branch` 欄位，不適用。
- 未設 `CT_HOME`（非 BAT 隔離派工，合併在 `integration_worktree` 進行）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 合併結果
- 開工前確認：整合 worktree `status --porcelain` 為空、detached 在 `e6f18bf0f8971333cc7d8b8a1b7e50f9deb641a9`；`ct/T0913` = `a00b1b4a4a93d7700551a272c42119519347a8cb`、`v0.8.x` = `e6f18bf0f8971333cc7d8b8a1b7e50f9deb641a9`（與工單一致）；`ct-merge/T0914` 原本不存在。
- `git -c core.longpaths=true -C <integration_worktree> switch -c ct-merge/T0914 e6f18bf0…` → `git … merge --no-ff -m "merge(ct): T0913 PLAN-068 W8 integration acceptance tests" ct/T0913`：`ort` 策略，**無衝突**，3 檔新增、890 行。
- **merge commit**：`92652e53564686372940f77d8c3b6a0162cdb904`（分支 `ct-merge/T0914`）
  - parent1 = `e6f18bf0f8971333cc7d8b8a1b7e50f9deb641a9`（= `base_main_sha` = `v0.8.x`）
  - parent2 = `a00b1b4a4a93d7700551a272c42119519347a8cb`（= `ct/T0913` head）
- 衝突檔：無（不需雙方意圖說明）。
- 合併結果相對 `base_main_sha` 的變更（`diff --name-only --no-renames e6f18bf0 HEAD`）：
  - `e2e/fixtures/helper-job-runner.mjs`
  - `e2e/t0913-tower-inbox-integration.spec.ts`
  - `electron/remote/__tests__/headless-tower-inbox-e2e.test.ts`
- 收尾時整合 worktree 乾淨（`status --porcelain` 為空），仍在 `ct-merge/T0914` 上留給塔台 ff；`v0.8.x` 仍是 `e6f18bf0`、`main` 未動。

### 驗收結果（跑在哪個 SHA）
全部跑在 merge commit `92652e53564686372940f77d8c3b6a0162cdb904`（= 整合分支 head，之後沒有其他 commit）。

| 項目 | 結果 |
|---|---|
| `npm ci` | exit 0（749 packages；`electron-winstaller` install script 被 allowScripts 擋屬預期） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | exit 0 |
| `npm run test:unit`（第一次完整執行） | exit 0：Test Files 491 passed / 3 skipped（494）、Tests 8951 passed / 41 skipped（8992），63.4 s；沒有重跑 |
| `npm run test:legacy` | exit 0：files 33 passed / 0 failed、tests 472 passed / 0 failed |
| e2e `npx playwright test e2e/t0913-tower-inbox-integration.spec.ts`（1 次） | 1 passed（1.5m）；隔離實例 `runtime=e2e-t0913-…`，結束後 Terminal Server alive=false、runtime userData 已刪 |

- 只用隔離實例；沒碰使用者的 BAT（安裝版）/ userData / Terminal Server / `bat-pty-holder`；沒跑 `t0859-pty-holder.spec.ts`；沒開 claude / codex 回合；`TMP` 用系統預設。
- 程序清理（D308）：e2e 前快照（07:04:37）後，比對之後建立且仍存活的 electron / node / shell 類程序，只剩本 session 自己的查詢指令（`cmd` 15652 → `pwsh` 47048 / `conhost` 46012），沒有 e2e 遺留程序，**未結束任何 PID**。

### 範圍外檔案
無（3 個變更檔全部在 T0913 `affects_files` 的 `e2e/`、`electron/remote/__tests__/` 之內；沒有 `_ct-workorders/**` 變更）。

### 遭遇問題
- `npx vite build` 的日誌第一次誤寫到整合 worktree 上層 `.ct-integration/vite-build-T0914.log`，已立即移到 session scratchpad；不在任何 repo 內、未影響 worktree 狀態。
- 其餘無。

### 互動紀錄
- 無（yolo，沒有向塔台提問）。

### 回報時間
- 2026-11-25T07:06:26+08:00
