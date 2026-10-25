---
schema_version: 1
schema_kind: workorder
id: T0623
title: "codex 分頁 `blocked` / `input`（OSC 7501）時 Worker 縮圖顯示 ⚠️、不計入批次關閉"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-18T12:21:54+0800"
started_at: "2026-10-18T12:23:03+08:00"
updated_at: "2026-10-18T12:29:00+08:00"
completed_at: "2026-10-18T12:29:00+08:00"
depends_on: [T0621]
related:
  - "T0621 回報區「縮圖 UI 建議」：`src/lib/terminal-attention.ts` 的 `ATTENTION_HOOK_REASONS` / `AttentionBlockedReason` 加 `input`，移除 `electron/terminal-attention.ts` 的略過（T0621 加註）；批次關閉同樣不計入；tooltip「codex 等待輸入（核准或提問）」"
  - "T0609（Worker 縮圖 ⚠️ / `?` / `✓`、`workerAttention`、`TerminalAttentionNotifier`、批次關閉 `findReportingWorkers`）、T0613（BUG-154）"
  - "並行：T0622（研究，只改自己的工單檔）—— 無重疊"
affects_files:
  - src/lib/terminal-attention.ts
  - electron/terminal-attention.ts
  - "src/components/**（只在縮圖 tooltip / 標示需要時）"
  - "src/locales/*.json（tooltip 文字）"
  - "src/lib/__tests__/**、electron/__tests__/**、src/components/__tests__/**"
  - "e2e/t0609-worker-attention-badge.spec.ts 或 e2e/t0621-codex-osc-state.spec.ts（擇一補案例）"
  - "docs/agent-guide/worker-tab-recycle.md、docs/agent-guide/blocked-state.md（各改必要的句子）"
  - _ct-workorders/T0623-codex-input-attention-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 非隔離工單，在主 checkout 工作。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>` 或精確 stage。不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "🔴 不改 `terminal:get-state` / `list` / `wait` 回傳與 T0621 契約；`terminal:attention-changed` 推送仍只含狀態欄位、不含任何輸出內容（CLAUDE.md「Worker 分頁回收」節）。"
  - "🔴 Dialog / 確認一律照既有規則；本單不新增 Dialog。i18n 三語（en / zh-TW / zh-CN）都要補。"
---

# T0623 — codex `input` 時縮圖顯示 ⚠️

## 目標

T0621 讓 codex `>= 0.163.0` 分頁在等使用者（核准提示、Plan mode 提問等）時回報 `blocked` / `input`，但縮圖刻意不顯示（`electron/terminal-attention.ts` 略過 `input`）。
本單讓 `input` 與 claude 的 hook reason 一樣：Worker 縮圖顯示 ⚠️、**不計入**塔台「關閉已回報的 Worker 分頁（N）」。

## 要做的事

1. `src/lib/terminal-attention.ts`：`input` 納入「等使用者」（⚠️）的判斷（型別與常數），`workerAttention` 結果與 hook reason 相同。
2. `electron/terminal-attention.ts`：移除 T0621 的 `input` 略過，`terminal:attention-changed` 照常推送 `blocked` / `input`。
3. tooltip / 無障礙文字：`input` 顯示「codex 等待輸入（核准或提問）」（三語），其他 reason 文字不變。
4. 批次關閉：`input` 不計入（沿用 hook reason 的處理；確認 `findReportingWorkers` 路徑）。
5. 測試：unit（`workerAttention` 對 `input`、attention notifier 推送 `input`、批次關閉不計入）；e2e 擇一補案例：在 `t0621-codex-osc-state.spec.ts` 的核准提示步驟斷言縮圖 `.worker-badge` = ⚠️、核准後消失（優先，真 codex），若不可行則在 `t0609` 以模擬方式補。
6. 文件：`docs/agent-guide/worker-tab-recycle.md`（縮圖標示表）、`docs/agent-guide/blocked-state.md`（codex 節「縮圖不顯示」改為顯示 ⚠️）。CLAUDE.md 只在必要時改一句。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- 補的 e2e 通過；回歸 `e2e/t0609-worker-attention-badge.spec.ts` 通過
- 回報區：改動檔案、測試結果、commit hash

---

## 回報區

### 結果摘要

DONE。codex `blocked` / `input`（OSC 7501）現在與 claude hook reason 同樣經 `terminal:attention-changed` 推送（優先於 `tower`，與查詢的優先序一致），Worker 縮圖顯示 ⚠️（class `blocked`、`data-blocked-reason="input"`），tooltip「codex 等待輸入（核准或提問）」三語，**不計入**塔台「關閉已回報的 Worker 分頁（N）」。`terminal:get-state` / `list` / `wait` 回傳與 T0621 契約未動；推送 payload 欄位未變（只多一個 `blockedReason` 值）。

### Landing check

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1：工單在 REPO_ROOT 下。C-3：前 5 個可測項目皆存在。C-2：無 `branch` 欄位（目前 `main`）。
- `CT_HOME` 未設（非隔離，主 checkout）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 改動檔案

- `src/lib/terminal-attention.ts`：`AttentionHookReason` / `ATTENTION_HOOK_REASONS` 加 `input`（註解改為「等使用者」：claude hook 或 codex `input`），表頭多一列；`workerAttention` 邏輯不變，`input` 因 `isHookReason` 走 `blocked` 分支（與 hook reason 相同）。
- `electron/terminal-attention.ts`：移除 `blocked.reason !== 'input'` 略過（T0621 加註），`input` 照常推送；檔頭註解補 codex `input`。
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`：`workerTabs.blockedTooltip.input`（其他 reason 文字不變）。`TerminalThumbnail.tsx` 不需改（tooltip 以 `blockedTooltip.<reason>` 取值，`data-blocked-reason` 已涵蓋）。
- 批次關閉：`findReportingWorkers` 只處理通知比對；N 由 `reportedWorkersOfTower`（`workerAttention(...).kind === 'reported'`）決定，`input` 為 `blocked` → 自動不計入，`src/stores/workspace-store.ts` 不需改。
- 測試：`electron/__tests__/terminal-attention.test.ts`（`computeTerminalAttention` 的 `input` 與優先於 `tower`；真 PtyManager 餵 OSC 7501：`blocked` → 推送 `input` + `[attention]` 日誌、使用者輸入不清、`working` 清除、`clear` 後回到 `tower`、PTY 結束清除）、`electron/__tests__/codex-osc-state.test.ts`（T0621 的「attention 不送 input」改為「送 input、優先於 tower」）、`src/stores/__tests__/workspace-store.workerAttention.test.ts`（`workerAttention` 對 `input` → `blocked`；`reportedWorkersOfTower` 排除 `input` Worker、清除後回到計入）、`src/components/__tests__/worker-tab-attention.test.tsx`（`input` → ⚠️ + tooltip、N = 0，清除後 ✓、N = 1）。
- e2e：`e2e/t0621-codex-osc-state.spec.ts` 步驟 2 在核准提示時斷言 `.thumbnail[data-workorder="T0621"] .worker-badge` = ⚠️、class `blocked`、`data-blocked-reason=input`、塔台選單 N = 0 且停用；送 `y` 後 `.worker-badge.blocked` 消失（真 codex，未改用 t0609 模擬）。
- 文件：`docs/agent-guide/blocked-state.md`（codex「renderer 標示」改為顯示 ⚠️、驗證清單一句）、`docs/agent-guide/worker-tab-recycle.md`（縮圖標示表「等使用者」列加 `input`、推送來源與驗證清單各一句）、`CLAUDE.md`「Worker 分頁回收」節一句（⚠️ 來源含 codex `input`）。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 303 files passed、5298 tests passed / 3 skipped |
| `npm run typecheck` | PASS — exit 0（0 errors） |
| `npm run typecheck:electron` | PASS — exit 0（0 errors） |
| `npx vite build` | PASS — exit 0 |
| e2e `e2e/t0621-codex-osc-state.spec.ts`（含本單新增的縮圖斷言，真 codex 0.163.0 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`） | PASS |
| e2e 回歸 `e2e/t0609-worker-attention-badge.spec.ts` | PASS（兩支同次執行 `2 passed (28.7s)`） |

### Commit

- 產品：`1481f65cecfd59fd66cf40e11a3716a6c852ff5c` feat(attention): show codex input (OSC 7501) as the Worker ⚠️ badge (T0623)
- 工單：本檔另一個 commit（以 `git commit --only`）。未 push。`src/styles/settings.css` 的 M 非本單變更，未碰。

### 偏差 / 備註

- 型別名稱沿用 `AttentionHookReason`（依 T0621 建議直接加 `input`，避免改名波及 consumer）；註解已說明涵蓋 codex `input`。
- en tooltip：「Waiting for you: codex needs input, an approval or a question (since {{time}})」；zh-CN：「等待用户：codex 等待输入（批准或提问）（{{time}} 起）」。

### 互動紀錄

無（未向塔台提問）。
