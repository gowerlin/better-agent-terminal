---
schema_version: 1
schema_kind: workorder
id: T0960
title: "`launch-command.test.ts` 一個測試名稱「登入分頁不要求保留」與 BUG-232 修正後的行為不符 → 只改名，斷言不動"
type: chore
status: DONE
repo: better-agent-terminal
priority: P4
sizing: XS
created_at: "2026-11-27T23:46:23+08:00"
started_at: "2026-11-27T23:46:59+08:00"
updated_at: "2026-11-27T23:49:10+08:00"
completed_at: "2026-11-27T23:49:10+08:00"
target_version: "下一個預覽版（`0.8.1-pre.3`）"
depends_on: []
related:
  - "D464（使用者：測試名稱改名開單）；T0956 回報區〈相關事項 / 後續建議〉；BUG-232；T0951"
affects_files:
  - _ct-workorders/T0960-rename-outdated-login-hold-test.md
  - src/lib/__tests__/launch-command.test.ts
renew_count: 0
session_ids:
  - "27c331d5-c141-4123-913e-b85a8c8c4b4b"
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

- [x] 名稱正確描述現況；`git diff` 只有名稱（與註解）一兩行
- [x] 該檔測試全過；`npm run test:unit` head 第一次全綠；`npm run typecheck` = 0

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T23:49:10+08:00
- **session_id**：27c331d5-c141-4123-913e-b85a8c8c4b4b

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`src/lib/__tests__/launch-command.test.ts` 存在 → PASS
- C-2：工單沒有 `branch` 欄位，不比對
- `CT_HOME` 已設定（主 checkout）；`CT_WORKTREE_BRANCH` = `ct/T0960`；`BAT_WORKSPACE_ID` 已設定（只記錄、不比對）；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

`src/lib/__tests__/launch-command.test.ts:114` 的 `it` 名稱改為：

`WorkspaceView does not inline the hold flag for the login terminal (claude-login-guide decides it) and plain shell tabs do not ask for the hold`

查證：`src/lib/claude-login-guide.ts:76` 在有 `sendLaunchCommand` 時給 `{ holdInputUntilLaunch: true }`，WorkspaceView 的登入片段不內聯旗標，新名稱與現況相符。斷言、regex、其他測試、註解（這個 `it` 內沒有註解）都沒有改。

### 變更檔案

- `src/lib/__tests__/launch-command.test.ts`：1 行（`git diff --stat`：1 insertion, 1 deletion），維持 LF（`git ls-files --eol`：`i/lf w/lf`）

### 驗證

| 項目 | 結果 |
|---|---|
| worktree `npm ci` | 完成（結尾只有 `electron-winstaller` install script 被擋的預期警告） |
| `npx vitest run src/lib/__tests__/launch-command.test.ts` | PASS：1 檔、12 / 12 |
| `npm run test:unit`（head 第一次完整執行） | PASS：exit 0，Test Files 522 passed / 3 skipped（525），Tests 9426 passed / 47 skipped（9473），67.10 s |
| `npm run typecheck` | 0（`tsc --noEmit -p .` 沒有輸出任何錯誤） |

### Git

- **branch**：`ct/T0960`
- **base_sha**：`043a50ad7ac0dbb658911fcf62b2d970d0b11168`
- **validated_sha**：`ff8cd7919818a1ae469e3968813ecb4a2c9f8ea3`
- **head_sha**：`ff8cd7919818a1ae469e3968813ecb4a2c9f8ea3`（與 validated_sha 相同）
- 產品 commit：`ff8cd791` `test: T0960 rename outdated login-terminal hold test (assertions unchanged)`
- worktree `git status --porcelain` 為空；沒有 push、tag、workflow

### 遭遇問題

無。

### 互動紀錄

無（yolo，沒有向塔台提問；沒有讀到塔台補充段）。

### 相關事項 / 後續建議

無。
