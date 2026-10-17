---
schema_version: 1
schema_kind: workorder
id: T0602
title: "驗證：pre.5 / pre.6 修正的隔離實例 e2e（t0590 / t0598 / t0599 / t0600）"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: S
created_at: "2026-10-18T04:13:45+0800"
started_at: "2026-10-18T04:14:56+0800"
updated_at: "2026-10-18T04:16:41+0800"
completed_at: "2026-10-18T04:16:41+0800"
depends_on: [T0597, T0598, T0599, T0600]
related:
  - "BUG-150 / BUG-151 / BUG-152（FIXED，等實機）；T0601（同批，安裝版探針）"
affects_files:
  - _ct-workorders/T0602-e2e-pre5-pre6-acceptance.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 驗證單：**不改任何產品程式碼、測試、CLAUDE.md、docs**；只寫本工單回報區並 commit 本檔（`git commit --only <本檔>`）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 e2e 失敗時**不修**：記錄失敗的 spec、測試名稱、錯誤訊息前 30 行與 `test-results/` 內的附件路徑，判斷是產品回歸、環境問題還是測試本身不穩，回報 PARTIAL / FAILED 交塔台決定。同一 spec 失敗最多重跑 1 次，用來分辨不穩定。"
  - "🔴 只跑隔離實例（spec 內的 `launchIsolated`）；不得對使用者正在用的 BAT 視窗或安裝版做任何操作，不得關閉或結束任何 BAT / electron 程序以外於 playwright 自己啟動的實例。"
---

# T0602 — 驗證：pre.5 / pre.6 修正的隔離實例 e2e

## 背景

`v0.7.0-pre.5` / `pre.6` 的四項修正各自有 e2e，但只在各自工單跑過一次。本單在 `main` @ `bae3c278`（內容與 pre.6 相同，之後只有 `(ct)` 文件 commit）一次跑完，補上安裝版難以自動驗的「派工時在塔台打字」「畫面不跳」兩項。

| spec | 對應 |
|---|---|
| `e2e/t0590-blocked-state.spec.ts` | BUG-150：AskUserQuestion → `question`（T0597 修改的 3b 段） |
| `e2e/t0598-dispatch-input-before-command.spec.ts` | BUG-151：派工前打的字不接在指令前 |
| `e2e/t0599-dispatch-no-focus-steal.spec.ts` | BUG-152：派工分頁不搶焦點、字留在塔台 |
| `e2e/t0600-launch-confirmation.spec.ts` | T0600：`--wait-started` / exit 8 / `agentStarted` |

注意：這是**原始碼建置的隔離實例**，不是安裝檔；回報時請標明 lane。

## 步驟

1. 讀本工單、標 `IN_PROGRESS`。
2. `npx vite build`（必須成功）。
3. `npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0598-dispatch-input-before-command.spec.ts e2e/t0599-dispatch-no-focus-steal.spec.ts e2e/t0600-launch-confirmation.spec.ts`（`--reporter=list`）。
4. 有失敗依 memory_overrides 處理。
5. 回報區填：HEAD hash、vite build 結果、每個 spec 的 passed / failed / skipped 數與耗時、skipped 的原因、失敗細節（若有）。commit 本檔，依 ct-exec 流程通知塔台。

## 驗收

- 四個 spec 全部 passed（skipped 須說明原因）→ DONE；否則 PARTIAL / FAILED。
- 只 commit 本工單檔。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

（無）

### 完成狀態

**DONE** — 四個 spec 全部 passed（4 passed / 0 failed / 0 skipped），未重跑。

Lane：**原始碼建置的隔離實例**（`npx vite build` 產物 + `launchIsolated`），不是安裝檔。

### 產出摘要

**落點檢查**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable
- C-2：工單無 `branch` 欄位；實際 `main`
- `CT_HOME` 未設定（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

**HEAD**：`b020151cac539fac1e6522cf4fa4b582a578f6ea`（`bae3c278` 之後只有 `b020151c chore: T0601 / T0602 … (ct)` 一個工單 commit，產品內容與 pre.6 相同）

**vite build**：exit 0（04:15:03 → 04:15:11）；renderer 5.03 s、其餘 bundle 全部 built，只有既有的 chunk size 警告，無 error。

**e2e**（`npx playwright test <4 specs> --reporter=list`，1 worker，總計 31.0 s，exit 0，04:15:19 → 04:15:51）：

| # | spec › test | 結果 | 耗時 |
|---|---|---|---|
| 1 | `t0590-blocked-state.spec.ts:131` › blocked: a claude hook in a Worker tab → the Tower reads blocked (MCP); typing clears it | ✅ passed | 17.0 s |
| 2 | `t0598-dispatch-input-before-command.spec.ts:58` › git-bash dispatch: input typed into the new tab before the command does not break the launch | ✅ passed | 2.2 s |
| 3 | `t0599-dispatch-no-focus-steal.spec.ts:58` › helper dispatch from the Tower tab: the focus and the typing stay in the Tower tab | ✅ passed | 4.0 s |
| 4 | `t0600-launch-confirmation.spec.ts:127` › launch confirmation: --wait-started on a tab without a start signal → unknown; SessionStart → agentStarted (MCP) | ✅ passed | 7.3 s |

skipped：0（t0598 的兩個 `test.skip` 條件 — 非 win32、沒有 Git for Windows bash.exe — 都不成立，有實際執行）。

**日誌佐證**（節錄）：
- t0590（BUG-150 / T0597 的 3b 段）：`bat_get_state` 回 `state: "blocked"`、`blockedReason: "question"`、`blockedDetection: "hook"`；`claude-settings.json` 內有 `matcher: "AskUserQuestion"` 的 `ask-user-question` / `ask-user-question-done` 兩個 hook；之後 `bat_wait` 回 `changed=true state=idle`（打字清除）。
- t0600：`--wait-started 20000` → exit 0、stdout 最後一行 `  started: unknown`、stderr `wait-started: NO_SIGNAL`，耗時 65 ms（不等滿 20 s）；不帶參數的派工輸出沒有 `started:` 行。

**涵蓋範圍提醒**：`t0600` spec 只跑「cannot tell」（`unknown`）路徑與 `agentStarted` 的 MCP 讀取；`started: <ISO>` 與 `started: unconfirmed` / exit **8** 路徑依 spec 檔頭註解由 `electron/remote/__tests__/headless-blocked-state-e2e.test.ts` 與 `electron/__tests__/bat-terminal-wait-started.test.ts` 涵蓋，本單未跑這兩個 unit 測試（不在步驟內）。

**變更檔案**：只有本工單檔（commit `--only`）。未改任何產品程式碼 / 測試 / docs；未 push、未觸發 workflow、未建 tag。

### 互動紀錄

（無；`CT_MODE=yolo`、`CT_INTERACTIVE=0`，沒有向塔台提問）

### 遭遇問題

- 無失敗、無重跑。
- 工作樹另有 `src/styles/settings.css`（工單已說明非本單變更）與 `_ct-workorders/T0601-probe-pre6-installed-acceptance.md`（執行期間出現，應為同批 T0601 Worker 的變更）的 M，皆未碰觸，commit 以 `--only` 排除。
- 原始 `status` 為 `TODO`（非 ct-exec 預期的 `PENDING`），直接改為 `IN_PROGRESS`。

### 回報時間

2026-10-18T04:16:18+0800
