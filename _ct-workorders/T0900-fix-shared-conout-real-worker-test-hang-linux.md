---
schema_version: 1
schema_kind: workorder
id: T0900
title: "查修 BUG-219（在 `v0.8.x`）：Linux CI 上 `shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s —— 找根因並修正，不靠拉長 timeout"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-25T02:48:36+08:00"
updated_at: "2026-11-25T02:48:36+08:00"
target_version: "0.8.0-pre.3"
depends_on: []
related:
  - "BUG-219；pre-release run `45460440287`（第一次嘗試 tests / unit-tests failure）；D325（使用者 2026-11-25：「依建議」）；T0887 / T0889 / T0890（共用 conout Worker 與其測試）；PLAN-066"
  - "CLAUDE.md「Windows PTY holder」「Terminal Server 存活判定與 recovery」「Frontend unit tests」各節；`docs/agent-guide/terminal-server-recovery.md`、`docs/agent-guide/pty-holder.md`"
affects_files:
  - _ct-workorders/T0900-fix-shared-conout-real-worker-test-hang-linux.md
  - electron/__tests__/shared-conout.test.ts
  - electron/__tests__/shared-conout*.test.ts
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0900（塔台 2026-11-25 從 `v0.8.x` `7063e45e` 建立分支）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0900` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `7063e45ee4eb201c27b39454c440f0c9bed99f20`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查根因：失敗只在 GitHub Actions ubuntu-24.04 出現一次（`electron/__tests__/shared-conout.test.ts:233` describe，`open → ready, data reaches the <pipe>-worker client, close → closed; an unreachable pipe → closed only for that id`，20 s 逾時）；pre.1 CI 同檔 1.0 s 通過；Windows 本機多次通過。可用 `gh run view 45460440287 -R gowerlin/better-agent-terminal --log-failed`（唯讀；只取該測試相關段落，回報區不貼大段 log）看失敗前後的輸出，並用 `--attempt` 比對重跑結果。本機有 WSL `Ubuntu-24.04`：可以在 WSL 裡（repo 複製到 WSL 檔案系統的暫存目錄、`npm ci`）反覆單獨跑這個檔與整套平行跑來重現（例：`npx vitest run electron/__tests__/shared-conout.test.ts --repeat`／迴圈 50 次，記錄失敗率與耗時）；量測完刪除 WSL 內的暫存複本。找出掛在哪一步（unix socket 的 open / ready / data / close 事件、不可達 pipe 的 closed、Worker 結束時序、等待條件）。"
  - "🔴 修正原則：根因在測試（等待條件太窄、事件順序假設、資源沒清）→ 修測試；根因在產品程式（`shared-conout.ts` / `shared-conout-worker.cjs` 在非 win32 的 unix socket 路徑）→ 先問塔台並附證據，因為 CLAUDE.md 規定共用 conout 在非 win32 的行為不得改變。🔴 不得只拉長 timeout、不得 `skip` 這個測試；任何 timeout 調整都要附量測依據。若無法重現，回報 `PARTIAL`：附重現嘗試紀錄、程式碼分析與加強診斷的建議（例：失敗時印出已收到的事件序列），不要猜修。"
  - "🔴 驗證：worktree（Windows）`npm ci`；`npm run test:unit` 全綠（第一次完整執行，附 passed / files 數）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。WSL Ubuntu-24.04 上修正後的檔案連續跑 ≥ 50 次 0 失敗（附修正前的失敗率對照）。不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不觸發 GitHub workflow（要在 CI 上驗證先問塔台）。`TMP` 用系統預設（T0716）。程序清理照 D308（只結束本單啟動且可追溯的、一次一個、不 `taskkill /T`，WSL 內同理）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。CLAUDE.md 與 docs 不改（建議文字寫在回報區）。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`（WSL 家目錄寫 `/home/<使用者>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0900 — 查修 BUG-219：Linux CI 上 `shared-conout` 真 Worker 測試掛住

## 背景

`0.8.0-pre.2` 的 pre-release run `45460440287` 第一次嘗試在 `tests / unit-tests`（ubuntu-24.04）失敗：只有 `electron/__tests__/shared-conout.test.ts`「the real Worker script relays a pipe」逾時 20 s，其餘 464 檔全過；Test gate 擋下 build / release。pre.1 CI 同檔 1.0 s 全過，本批（T0891 / T0893–T0898）沒有改這個檔或 `shared-conout*`。共用 conout Worker 只在 win32 生效，所以這是 Linux 上的測試掛住，不影響 Linux 使用者；但它會讓 CI Test gate 偶發擋發版。詳見 `_ct-workorders/BUG-219-shared-conout-real-worker-test-hang-linux-ci.md`。

使用者 2026-11-25 指示「依建議」（D325）：重跑過了照常發 pre.2，BUG-219 另開工單查根因；重跑仍失敗則停發版、先修。

## 驗收

- [ ] 根因說明（重現紀錄、失敗率、卡在哪一步）
- [ ] 修正（測試或經塔台同意的產品程式）；WSL 連續 ≥ 50 次 0 失敗
- [ ] Windows `test:unit` 全綠、兩個 typecheck = 0、`vite build` exit 0
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0900`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
