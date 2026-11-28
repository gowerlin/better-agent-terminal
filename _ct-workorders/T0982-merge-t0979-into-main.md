---
schema_version: 1
schema_kind: workorder
id: T0982
title: "合併 `ct/T0979`（PLAN-066 後續研究的量測腳本與結果，只在 `experiments/`）→ `main`"
type: chore
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T19:04:38+08:00"
started_at: "2026-11-28T19:06:52+08:00"
updated_at: "2026-11-28T19:08:52+08:00"
completed_at: "2026-11-28T19:08:52+08:00"
target_version: "—（只有 experiments/）"
kind: merge
merges:
  - "ct/T0979"
merge_mode: mechanical
integration_worktree: 'D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/.ct-integration/better-agent-terminal'
base_main_sha: d2c9e9803294caa0bafabebcf7ded71da47a6360
merge_target: main
depends_on: [T0979]
related:
  - "D522（U-78：A）；T0979（`e882e120`，base `80d96e25`，7 檔全在 `experiments/node-pty-worker/`：`t0979/` 3 支腳本＋`run-env-churn.sh`、`results/t0979-*` 3 個結果檔）；`main` 自 base 起併入 T0977 / T0978 / T0980（不重疊），判準 1 不成立，所以派合併單。BAT `--worktree-status` `conflicts: []`"
affects_files:
  - _ct-workorders/T0982-merge-t0979-into-main.md
renew_count: 0
session_ids:
  - "9cdecb3c-bfb7-4bb5-ad6f-6406c0455587"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 依 `merge-workorder.md` 模式 ①（`mechanical`）與 § 共同護欄執行；只在整合 worktree 工作，合併分支名 `ct-merge/T0979`。出現衝突 → `merge --abort`，回報 `PARTIAL`（建議改模式 ②），不自行解衝突。"
  - "🔴 不 ff `main`、不 push、不建 tag、不觸發 workflow；不刪任何分支；不 `--force` / `reset --hard` / rebase / `git stash`（含 `stash list`）/ `checkout -- <path>` / `restore`（L138）。主 checkout 只能寫本工單檔（`git -C <主 checkout> commit --only _ct-workorders/T0982-merge-t0979-into-main.md`）。"
  - "🔴 不執行 `experiments/` 下的量測腳本（會起 Terminal Server / PTY）。"
  - "🔴 Windows 的 git 指令一律加 `-c core.longpaths=true`。公開 repo（D176）：回報不寫真名、家目錄路徑（用 `<使用者資料夾>`）；結果檔只應有數字、pid 與程序名稱，合併前抽查一次沒有 env 內容與權杖樣式（`batcap.`、`sk-ant-`、`ghp_`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0982 — 合併 `ct/T0979` → `main`

## 背景

T0979（PLAN-066 三項後續研究）只新增 `experiments/node-pty-worker/` 下 7 檔（量測腳本與結果），`e882e120`，base `80d96e25`。F4 實作單 T0983 的驗收會重用這些腳本，使用者裁示併進 `main`（U-78：A，D522）。期間 `main` 併入 T0977 / T0978 / T0980（不重疊），塔台直接合併判準第 1 條不成立，依規則派本單。

## 任務指令

1. 開工：整合 worktree 必須乾淨（目前 detached）。確認 `ct/T0979` = `e882e1204e543f4e64b587315564cd4e379f0c5d`；`main` 是 `base_main_sha` 或它之後只多了 `_ct-workorders/**`。不符就停下問塔台。
2. `git -C <整合 worktree> -c core.longpaths=true switch -c ct-merge/T0979 <base_main_sha>`（分支已存在就停下回報）。
3. `git -C <整合 worktree> -c core.longpaths=true merge --no-ff -m "merge(ct): T0979 PLAN-066 follow-up measurement scripts" ct/T0979`。
4. 出現任何衝突 → `git merge --abort`，停下回報 `PARTIAL`。

## 驗收（跑在 merge commit，回報 SHA 與 parent1 / parent2）

- [ ] 樹比對：`git diff --name-only <base_main_sha> <merge commit>` 只有 T0979 的 7 檔（全在 `experiments/node-pty-worker/`）；其他檔算範圍外，照實回報。
- [ ] 結果檔抽查：沒有 env 內容與權杖樣式。
- [ ] 整合 worktree `npm ci`；`npm run test:unit` 第一次完整執行即綠（附數字；確認沒有收到 `experiments/` 的檔）。typecheck / vite build 可略（沒有產品檔），寫明略過。
- [ ] e2e 不跑。

---

## 回報區

### 完成狀態

- **狀態**：DONE（模式 ① `mechanical`，無衝突）
- **開始 / 完成**：2026-11-28T19:06:52+08:00 / 2026-11-28T19:08:52+08:00
- **session_id**：9cdecb3c-bfb7-4bb5-ad6f-6406c0455587

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。C-1 PASS。C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable。C-2：無 `branch` 欄位。
- `CT_HOME` 未設（非隔離 Worker）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE` = `yolo`，`CT_INTERACTIVE` = `0`。

### 開工檢查（任務指令 1）

- 整合 worktree `status --porcelain` 為空，開工前 detached 在 `12dce91b`。
- `ct/T0979` = `e882e1204e543f4e64b587315564cd4e379f0c5d` ✅。
- `main` 開工時 = `850d99d8`；`git diff --name-only d2c9e980 main` 只有 `_ct-workorders/**`（BUG-238、T0982、T0983、`_bug-tracker.md`、`_decision-log.md`、`_tower-state.md`）✅。
- `ct-merge/T0979` 不存在 ✅。

### 合併結果

- **合併分支**：`ct-merge/T0979`（整合 worktree，從 `base_main_sha` `d2c9e9803294caa0bafabebcf7ded71da47a6360` 開出）
- **merge commit**：`b5a12b63f4ae5210fb1276602ac8627b43b063e0`（`merge(ct): T0979 PLAN-066 follow-up measurement scripts`，ort，無衝突）
- **parent1**：`d2c9e9803294caa0bafabebcf7ded71da47a6360`（= `base_main_sha`）
- **parent2**：`e882e1204e543f4e64b587315564cd4e379f0c5d`（= `ct/T0979`）
- **跑驗收時的 SHA**：`b5a12b63`（= merge commit）
- 未 ff `main`、未 push、未建 tag、未刪分支；整合 worktree 結束時乾淨、留在 `ct-merge/T0979`（供塔台 ff）。
- 📌 塔台 ff 前注意（收單五步第 5 步）：`main` 在合併期間前進到 `098d5505`（本單 IN_PROGRESS commit）以及之後本單的收尾 commit，全是 `_ct-workorders/**`；parent1 是 `base_main_sha`（工單第 2 步指定），所以 ff 前需依第 5 步在整合分支再 `merge --no-ff main` 一次。

### 驗收

- [x] **樹比對**：`git diff --name-only d2c9e980 b5a12b63` = 7 檔，全在 `experiments/node-pty-worker/`：
  `results/t0979-env-churn.csv`、`results/t0979-pty-end-residue.jsonl`、`results/t0979-ts-exit-residue.jsonl`、
  `t0979/pty-end-residue.cjs`、`t0979/run-env-churn.sh`、`t0979/ts-env-churn.mjs`、`t0979/ts-exit-residue.mjs`。範圍外檔案：無。
- [x] **結果檔抽查**：3 個結果檔只有標籤、步驟、數字（MB、handle、thread 數）、pid、程序名稱與 UTC 時間；jsonl 鍵名逐一列出確認，沒有 env 內容；
  `batcap.` / `sk-ant-` / `ghp_` / `github_pat_` / 使用者資料夾路徑皆 0 筆。全 7 檔掃描唯一命中是腳本 `t0979/ts-env-churn.mjs:48`：
  以 `crypto.randomBytes(48)` 當場產生的假 `batcap.` 權杖樣板（量測 env 大小用，不是真實權杖、不在結果檔），判定無問題。
- [x] **`npm ci`**（整合 worktree）：exit 0；結尾只有 npm 12 對 `electron-winstaller` install script 的預期警告（CLAUDE.md「npm 12 install scripts」節）。
- [x] **`npm run test:unit`**（第一次完整執行即綠）：Test Files 535 passed | 3 skipped (538)；Tests 9668 passed | 41 skipped (9709)；68.26 s；exit 0。
  輸出中 `experiments/` 出現 0 次（`vite.config.ts` `test.include` 不含 `experiments/`）。stderr 有 4 行 `Error: AttachConsole failed`（Windows node-pty 測試的已知噪音，不影響結果）。
- [x] typecheck / `vite build`：略過（沒有產品檔變更，依工單）。
- [x] e2e：未跑（依工單）。量測腳本未執行（依 memory_overrides）。

### 異動檔案

- 主 checkout：只有本工單檔（`098d5505` IN_PROGRESS、收尾 commit）。
- 整合 worktree：merge commit `b5a12b63`（`ct-merge/T0979`）。

### 遭遇問題

- 無。（自己的操作失誤一次：frontmatter 檢查腳本路徑沒先 `cygpath -m`，改正後 PASS。）

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 後續

- 塔台：收單 SHA 比對五步（含第 5 步）→ 斷點 E → `--ff-only` → `switch --detach` 整合 worktree。
