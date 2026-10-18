---
schema_version: 1
schema_kind: workorder
id: T0657
title: "BUG-162：查明 yolo Worker 的 Bash 為何觸發 `PermissionRequest`、由誰放行；權限請求結束後清除 `blocked` / `permission`（評估 `PostToolBatch` / `PostToolUse` 成本後實作）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-162
priority: P2
sizing: M
created_at: "2026-10-18T19:30:08+0800"
depends_on: []
related:
  - "BUG-162（使用者截圖；debug log 第 2634 行 `→ blocked reason=permission (hook permission-request tool=Bash)`，terminal `9e13a14065edf2130036ef0c4869d0b6` = T0656 Worker，claude session id `17d6ac32-f620-4f1c-ae43-148976d22a46`）"
  - "契約與實作：CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」節；`docs/agent-guide/blocked-state.md`（事件表、清除規則、已知限制的「清除漏洞」與候選 `PostToolBatch`）；`BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`）、`scripts/bat-hook.mjs`、`TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`）；T0594 / T0597 / T0620 的前例；縮圖 ⚠️ `workerAttention`（`src/lib/terminal-attention.ts`，T0609）"
affects_files:
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - electron/terminal-blocked-state.ts
  - "electron/__tests__/terminal-blocked-state.test.ts、electron/__tests__/blocked-hooks-launch.test.ts、scripts/__tests__/bat-hook.test.mjs、electron/remote/__tests__/headless-blocked-state-e2e.test.ts（擴充）"
  - "docs/agent-guide/blocked-state.md；CLAUDE.md（只在「blocked 狀態偵測」節的必守規則改變時動一句）"
  - _ct-workorders/T0657-fix-permission-blocked-clear.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **先查明再修**（寫進回報區，標實測 / 原始碼 / 推論）：① 2026-10-18T11:22:52Z 那次 `PermissionRequest(Bash)` 的來源——唯讀查 T0656 Worker 的 claude transcript（`~/.claude/projects/<該專案>/17d6ac32-f620-4f1c-ae43-148976d22a46.jsonl`，只看那個時間點前後的 tool_use / 權限相關紀錄；回報**不得**貼命令全文或任何內容，只寫命令類型與權限判斷結果）、該 Worker 實際的啟動參數（是否有 `--dangerously-skip-permissions`，看 BAT 日誌的派工命令或 PTY 命令列，不印權杖）、claude 版本；② bypass 模式下哪些 Bash 情況仍會執行 `PermissionRequest` hook、之後由誰放行（自動模式分類器、受保護路徑、sandbox、其他 hook…），以內嵌 / 系統 claude 二進位字串與官方文件查證，標版本；③ 放行（允許 / 拒絕 / 自動）之後 claude 會執行哪些 hook（`PostToolUse` / `PostToolUseFailure` / `PostToolBatch` / `PermissionDenied`…），可用於清除的是哪個。"
  - "🔴 **修正原則**：只清 `permission`（比照 T0594 / T0620 的 `HOOK_EVENT_CLEARS_ONLY`：不得誤清 `question` / `elicitation` / codex `input` / `tower`）；平行工具呼叫中另一個權限對話框仍開著時不得誤清（若選定的 hook 無法區分，回報說明風險與取捨）。清除類 hook 一律 `async: true`。比較 `PostToolBatch`、全工具 `PostToolUse`（+ `PostToolUseFailure`）等候選的成本（每次工具呼叫多啟動一個 node 的實測耗時，`bat-hook.mjs` 已有 1.8 s 總時限）與正確性，選一個並寫明理由；若成本不可接受，改提替代（例如只在已是 `blocked` / `permission` 時才需要的作法），不要硬上。"
  - "🔴 `bat-hook.mjs` 規則不變：一律 exit 0、stdout 不輸出任何東西、任何失敗靜默、不送 `tool_input` / `tool_response`；新事件名在舊 BAT 回 `INVALID_ARGS` 時仍 exit 0。不得在 `--settings` 寫 `disableAllHooks: false`。介面契約（T0590 / T0600 的欄位、值域、優先序）不變。"
  - "🔴 測試：狀態機（只清 `permission`、其他 reason `unchanged`）、hook 表（新 entry、async、matcher）、真 `bat-hook.mjs` 程序（新事件送出、不送內容、exit 0 無 stdout）、headless e2e（真 node-pty：permission → 新事件 → 離開 blocked，無 client 輸入）。不耗 token；不呼叫模型。🔴 **不要執行 Playwright e2e**（`playwright.config.ts` 的 `outputDir` 是 `e2e-results`，會清空；且 T0656 正在跑隔離實例）；e2e spec 若需要更新期望值，改檔不跑、回報列出待跑的 spec。"
  - "🔴 非隔離工單。T0656（`e2e/**`、`site/**`、`README.md`、`assets/**`、`.gitignore`、`playwright.config.ts`）同時進行，不碰它的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0657 — 權限請求放行後清除 ⚠️

## 背景

使用者截圖：T0656 Worker 的縮圖顯示 ⚠️（等使用者），但 Worker 一直在執行、沒有等輸入。BAT 日誌：19:22:52（本地）`→ blocked reason=permission (hook permission-request tool=Bash)`。BAT 的 `permission` 只在 `UserPromptSubmit` / `Stop` / 使用者輸入時清除，所以權限請求在沒有鍵盤輸入的情況下被放行後，⚠️ 會留到該回合 `Stop`（`docs/agent-guide/blocked-state.md` 已知限制）。CT yolo Worker 以 `--dangerously-skip-permissions` 啟動，原本預期一般工具不會有權限請求，這次 Bash 為何會有、由誰放行，尚未知道。詳見 BUG-162。

## 要做的事

1. 查明（見 memory_overrides 第 1 點），回報區附證據。
2. 選定清除用的 hook 並說明成本 / 正確性取捨；實作（hook 表、`bat-hook.mjs`、狀態機）。
3. 測試（見 memory_overrides）。
4. `docs/agent-guide/blocked-state.md`：事件表、清除規則、已知限制更新；CLAUDE.md 只在必守規則改變時動一句。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功

## 驗收

- 權限請求被放行（不經鍵盤）後，分頁離開 `blocked` / `permission`；其他 reason 不受影響
- 回報區附：觸發來源與放行者查證、候選比較與選擇理由、測試清單、待跑的 e2e、commit
- 只改 `affects_files`；未 push
