---
schema_version: 1
schema_kind: workorder
id: T0623
title: "codex 分頁 `blocked` / `input`（OSC 7501）時 Worker 縮圖顯示 ⚠️、不計入批次關閉"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-18T12:21:54+0800"
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

（Worker 填寫）
