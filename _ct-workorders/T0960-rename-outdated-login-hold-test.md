---
schema_version: 1
schema_kind: workorder
id: T0960
title: "`launch-command.test.ts` 一個測試名稱「登入分頁不要求保留」與 BUG-232 修正後的行為不符 → 只改名，斷言不動"
type: chore
status: IN_PROGRESS
repo: better-agent-terminal
priority: P4
sizing: XS
created_at: "2026-11-27T23:46:23+08:00"
started_at: "2026-11-27T23:46:59+08:00"
updated_at: "2026-11-27T23:46:59+08:00"
target_version: "下一個預覽版（`0.8.1-pre.3`）"
depends_on: []
related:
  - "D464（使用者：測試名稱改名開單）；T0956 回報區〈相關事項 / 後續建議〉；BUG-232；T0951"
affects_files:
  - _ct-workorders/T0960-rename-outdated-login-hold-test.md
  - src/lib/__tests__/launch-command.test.ts
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支：只在 `ct/T0960` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 範圍：`src/lib/__tests__/launch-command.test.ts` 第 114 行附近的 `it('the login terminal (typed, not submitted) and plain shell tabs do not ask for the hold', …)`。T0956（BUG-232）後登入導引分頁**會**要求保留，旗標由 `src/lib/claude-login-guide.ts` 決定、`WorkspaceView.tsx` 只展開 `launchHold`；這個 `it` 的斷言（WorkspaceView 的登入片段與一般 shell 分支不內聯 `holdInputUntilLaunch`）仍成立，只有名稱過時。改成正確描述現況的名稱（例：「WorkspaceView does not inline the hold flag for the login terminal (claude-login-guide decides it) and plain shell tabs do not ask for the hold」），必要時同一個 `it` 內的註解同步。🔴 斷言、regex、其他測試一字不改；不改產品程式、docs、CLAUDE.md。"
  - "🔴 驗證：worktree `npm ci`；`npx vitest run src/lib/__tests__/launch-command.test.ts` 全過；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npm run typecheck` = 0。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0960 — 改掉過時的測試名稱

## 背景

T0956（BUG-232）讓登入導引分頁在命令寫入前保留使用者輸入。`launch-command.test.ts` 有一個 `it` 名稱寫「登入分頁不要求保留」，斷言（WorkspaceView 不內聯旗標）仍成立，但名稱已與現況不符。使用者指示開單（D464）。

## 範圍

- 只改該 `it` 的名稱（與必要的同一 `it` 內註解）。

## 不做

- 不改任何斷言、其他測試、產品程式、文件。

## 驗收

- [ ] 名稱正確描述現況；`git diff` 只有名稱（與註解）一兩行
- [ ] 該檔測試全過；`npm run test:unit` head 第一次全綠；`npm run typecheck` = 0

---

## 回報區

（Worker 填寫）
