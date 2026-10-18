---
schema_version: 1
schema_kind: workorder
id: T0620
title: "PLAN-047 M1b-2：claude `ElicitationResult` 清除 `blocked: elicitation`（滑鼠回答 / 逾時關閉的清除漏洞）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-18T11:25:51+0800"
depends_on: []
related:
  - "`docs/agent-guide/blocked-state.md` 已知限制「清除漏洞」：elicitation 以滑鼠回答或逾時自行關閉時，`blocked` 維持到該回合 `Stop`；候選 `ElicitationResult` hook（claude 2.1.300：`After a user responds to an MCP elicitation`）與 `Notification` 的 `elicitation_complete` / `elicitation_response`"
  - "T0590（hooks 事件表、`terminal:report-hook`）/ T0594（`ask-user-question-done` 只清 `question` 的寫法）/ T0597（`hookEventReason`）/ T0600（`SessionStart`、`claudeHooksDisabledBy`）"
  - "並行：T0619（codex 研究，不改產品檔）"
affects_files:
  - electron/bat-mcp-launch.ts
  - electron/terminal-blocked-state.ts
  - scripts/bat-hook.mjs
  - "electron/__tests__/**、scripts/__tests__/**（相關測試）"
  - "e2e/t0590-blocked-state.spec.ts（若需補案例）"
  - docs/agent-guide/blocked-state.md
  - "CLAUDE.md（只在「blocked 狀態偵測（PLAN-047 M1b / T0590）」節需要時改一句）"
  - _ct-workorders/T0620-claude-elicitation-result-clear.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 非隔離工單，在主 checkout 工作。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>` 或精確 stage。不 push。"
  - "🔴 hook 腳本規則沿用 T0590 / T0600（CLAUDE.md「blocked 狀態偵測」節）：`scripts/bat-hook.mjs` 一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、總時限 `HOOK_DEADLINE_MS`；不得在 `--settings` 寫 `disableAllHooks: false`。"
  - "🔴 不改 `terminal:get-state` / `list` / `wait` 的回傳欄位與 `blockedReason` 值域（T0590 / T0600 / T0607 契約）；本單只新增一個清除事件。"
---

# T0620 — claude `ElicitationResult` 清除 `blocked: elicitation`

## 目標

claude 分頁顯示 MCP elicitation 對話框時，BAT 記 `blocked` / `elicitation`（`Notification` matcher `elicitation_dialog|elicitation_url_dialog`）。
目前只有 `UserPromptSubmit` / `Stop` / 使用者鍵盤輸入能清除，所以**滑鼠回答**或**對話框逾時自行關閉**時，`blocked` 會維持到該回合 `Stop`。
本單加一個清除事件，讓 elicitation 結束時立即清除 `elicitation`（只清 `elicitation`，比照 `ask-user-question-done` 只清 `question`）。

## 要做的事

1. **查證**（內嵌 claude 的實際版本，`node_modules/@anthropic-ai/claude-code*` 二進位 / 文件）：`ElicitationResult` hook 是否存在、何時執行（回答 / 拒絕 / 取消 / 逾時各自會不會執行）、payload 欄位；`Notification` 的 `elicitation_complete` / `elicitation_response` 類型是否存在、何時送。選定清除用的事件（可兩者都掛，需說明理由），寫進回報區並標證據等級。
2. **實作**：
   - `BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）新增清除項，`async: true`（claude 不等）。
   - `scripts/bat-hook.mjs` 的 `HOOK_EVENTS` 加新事件名（例如 `elicitation-done`）。
   - `electron/terminal-blocked-state.ts`：新事件只清 `elicitation`；其他 reason（`permission` / `question` / `tower`）時回 `unchanged`。
   - 舊版 `bat-hook.mjs` / 舊設定檔不送這個事件 → 行為與現在相同（向下相容）。
3. **測試**：`electron/__tests__` 的 blocked-state / launch 相關測試補案例（事件表、設定檔內容、只清 `elicitation`、其他 reason 不清、未知事件仍拒絕）；`scripts/__tests__` 的 bat-hook 測試補新事件。e2e `t0590-blocked-state.spec.ts` 若已有 elicitation 案例就補一個清除步驟，沒有就不新增。
4. **文件**：`docs/agent-guide/blocked-state.md` 事件表、清除規則、已知限制（把 elicitation 從「仍未涵蓋」移出，寫明新的涵蓋範圍與仍不涵蓋的情況）；CLAUDE.md 只在必要時改一句。

## 不在本單

- 權限對話框以滑鼠允許 / 拒絕的清除（`PostToolBatch` 成本高，未決定）。
- codex（T0619 研究中）。
- 不改 Claude Agent SDK 面板。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npx vite build` 成功
- 若改了 e2e：`npx playwright test e2e/t0590-blocked-state.spec.ts` 通過（需先 `npx vite build`）
- 回報區：查證結論（證據等級）、改動檔案、測試結果、commit hash

---

## 回報區

（Worker 填寫）
