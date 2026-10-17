---
schema_version: 1
schema_kind: workorder
id: T0600
title: "Worker 啟動確認：claude `SessionStart` hook 回報「已啟動」、狀態查詢加欄位、helper 加 opt-in 等待參數（D154）"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T03:13:30+0800"
depends_on: [T0590, T0597, T0598]
related:
  - D154
  - "T0598 回報區第 3 點（方案 A：`SessionStart` hook + `--wait-started`；方案 B 輸出比對只記日誌）"
  - "CLAUDE.md「blocked 狀態偵測」「helper 唯讀查詢 channel」「BAT MCP shim」小節；docs/agent-guide/blocked-state.md、helper-query-channels.md、bat-mcp-shim.md"
  - "並行工單 T0599（BUG-152：renderer 焦點，`src/stores/workspace-store.ts` 等）"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - electron/terminal-query-handlers.ts
  - "electron/pty-manager.ts（只在狀態需要記在 PtyManager 時）"
  - "electron/terminal-command-handlers.ts（只在派工時需要初始化狀態時）"
  - scripts/bat-hook.mjs
  - scripts/bat-terminal.mjs
  - "scripts/bat-mcp.mjs（tool 說明 / 回傳欄位）"
  - "electron/remote/headless-entry.ts（只在 headless 需要同步時）"
  - "electron/__tests__/、electron/remote/__tests__/、scripts/__tests__/ 下對應的測試檔"
  - "e2e/（新增一支，或擴充 e2e/t0590-blocked-state.spec.ts）"
  - "scripts/verify-helper-bundle.js（只在新增 helper 腳本時）"
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/helper-query-channels.md
  - "docs/agent-guide/README.md（只在新增主題檔時）"
  - "CLAUDE.md（新增或修改相關小節：只寫契約摘要與唯一實作位置，細節進 docs，依 T0595 撰寫規則）"
  - _ct-workorders/T0600-worker-launch-confirmation.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit 工具（L129）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 並行：T0599 同時在主 checkout 改 renderer 焦點相關檔（`src/stores/workspace-store.ts`、可能 `src/App.tsx` / `src/components/*`）。你不碰 `src/` 的 renderer 檔；commit 一律 `git commit --only <你的檔>`，`CLAUDE.md` 只納入自己的 hunk。"
  - "🔴 hook 腳本規則沿用 T0590：一律 exit 0、**stdout 不輸出任何東西**（`SessionStart` 的 stdout 會被 claude 加進對話上下文）、任何失敗靜默、時限不得加長、不送 prompt / 內容 / 權杖。`SessionStart` 掛 `async: true`，不得延遲 claude 啟動。"
  - "🔴 相容（D154）：helper 不帶新參數時，輸出與 exit code 完全不變；既有 exit code（0 / 1 / 3 / 4 / 5 / 6 / 7）語意不變。沒有信號的 agent（codex、hooks 未注入、`disableAllHooks`）回「無法判定」，**不得**當成啟動失敗。既有 channel 的既有欄位不改名、不移除。"
  - "🔴 實機查證最多 1 次、`--model claude-haiku-5-5`、提示詞極短，可略過；確認 claude 2.1.300 / 2.1.302 的 `SessionStart` 在互動模式啟動時會執行（以二進位字串或日誌佐證）。"
---

# T0600 — Worker 啟動確認

## 背景（D154）

helper 派工在建立 PTY 後就回 exit 0，啟動指令 500 ms 後才寫入，塔台無從得知 Worker 是否真的啟動（BUG-151 就是 exit 0 但 claude 沒起來）。T0598 建議：claude 的 `SessionStart` hook 經既有的 `terminal:report-hook` 回報「已啟動」，狀態查詢揭露，helper 加 opt-in 等待。

## 要做的事

1. **hook**：`BAT_CLAUDE_HOOKS` 加 `SessionStart`（`async: true`）→ `bat-hook.mjs session-start` → `terminal:report-hook`。注入條件與現有 hooks 相同（只對 claude-cli）。只記「已啟動」與時間，不送 payload 內容（`source` 等欄位若要用，只取列舉值並說明）。
2. **狀態**：`terminal:get-state` / `terminal:list` / `terminal:wait` 的回傳加啟動確認欄位（名稱與值域由你定，例：`agentStarted: true | false | null` + `agentStartedAt`；`null` = 這個分頁無法判定，對應 `blockedDetection: none` 的情況）。PTY 結束 / restart / Terminal Server recovery 的行為比照 `blocked` 的既有規則並寫明。MCP shim 的回傳與 tool 說明同步。
3. **helper**：`bat-terminal.mjs` 派工加 opt-in 參數（例：`--wait-started <ms>`，上限自訂並寫明）。行為：
   - 確認啟動 → exit 0，stdout 多一行可解析的確認（例 `started: <ISO 時間>`）
   - 逾時仍未啟動 → **新的 exit code**（例 `8` / `LAUNCH_UNCONFIRMED`），分頁**不關閉**
   - 無法判定（codex、未注入 hooks…）→ exit 0，stdout 註明 `started: unknown`
   - 舊 BAT（不認得參數或查不到欄位）→ 依既有 helper「BAT 太舊」規則處理，寫明 CT 怎麼判定
   - 等待以既有的 `terminal:wait` 或新 channel 實作皆可；權杖範圍沿用 `authorizeHelperQueryTarget`（塔台查自己的 Worker）。
4. **方案 B（只記日誌）**：可選。寫入指令後短時間內 PTY 輸出比對 `command not found` / `is not recognized as` / `CommandNotFoundException` 時記 `[agent-command] launch-suspect`，不改 exit code、不進 state。範圍或成本過大可略過，回報區說明。
5. **介面契約**：回報區寫一節「介面契約」（參數、欄位、exit code、相容規則、版本判定方式），塔台以此寫 CT 規格轉交（比照 T0562 / T0585 / T0590）。

## 驗收

- `npm run test:unit` 全綠（回報 passed / files 數）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功；`npm run verify:helpers` 通過（若改了 helper 打包清單）；新增 / 擴充的 e2e 與 `e2e/t0590-blocked-state.spec.ts`、`e2e/t0598-dispatch-input-before-command.spec.ts` 通過。
- 測試至少涵蓋：hook 回報後狀態為已啟動；不帶參數的 helper 行為不變；`--wait-started` 成功 / 逾時 / 無法判定三種 exit；headless 同步；hook 無 stdout、exit 0。
- 回報區：改動摘要、介面契約、測試、實機驗收步驟、已知限制。
- commit 只含 `affects_files`；訊息 `feat(dispatch): …（T0600）`。

---

## 回報區

（Worker 填寫）
