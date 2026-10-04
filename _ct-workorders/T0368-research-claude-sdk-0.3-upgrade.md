---
schema_version: 1
schema_kind: workorder
id: T0368
title: "研究：Claude Agent SDK 0.2.113 → 0.3.x / claude-code 2.1.113 → 2.1.289 升級影響與 Claude 5 系列模型支援"
type: research
status: PENDING
priority: P2
sizing: S
created_at: "2026-10-04T15:57:28+08:00"
updated_at: "2026-10-04T15:57:28+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "T0165 / commit 84c2930（2026-04-18 上次 bump：SDK ^0.2.111 / CLI ^2.1.111 + Opus 4.7）"
  - "PLAN-027（claude runtime selection：embedded / system；electron/claude-runtime-router.ts）"
  - "BUG-059（embedded CLI auto-update；DISABLE_AUTOUPDATER 注入）"
  - "T0366（同類研究：Codex 版本落後，可參考其方法與報告結構）"
affects_files: []
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。實驗請在 scratchpad 或 `git worktree` 進行，結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 **與 T0367 並行**：T0367 正在改 `electron/codex-agent-manager.ts`、`src/components/CodexAgentPanel.tsx`、`src/locales/*`、`src/lib/codex-error-classify*`。這些檔一律不要碰，也不要 `git stash` / `checkout` 主工作樹。"
  - "🔴 不改 `~/.claude/` 下任何檔案、不改使用者全域安裝的 claude CLI（只讀）。"
  - "🔴 模型 ID、context 長度、價格**一律以官方來源為準**（Anthropic 文件 / SDK 型別 / CLI 實測），不得憑記憶填寫；來源要寫在報告裡。"
---

# T0368 — 研究：Claude Agent SDK 0.3 升級影響與 Claude 5 系列模型支援

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題；能用實驗回答的不要問）
- **工作量預估**：S
- **Context Window 風險**：中（SDK changelog 跨 0.2.113 → 0.3.289，請挑與 BAT 用法相關的重點）

## 背景

塔台 2026-10-04 查得：

| 套件 | `package.json` | 實裝（repo 與已安裝 BAT 相同） | npm 最新 |
|------|---------------|------------------------------|---------|
| `@anthropic-ai/claude-agent-sdk` | `^0.2.111`（:43） | 0.2.113（2026-04-17） | **0.3.289**（2026-10-03）—— `^0.2` 不會自動跨到 0.3 |
| `@anthropic-ai/claude-code` | `^2.1.111`（:44） | 2.1.113 | **2.1.289**（同 range，被 lock 鎖住） |

`BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）最新只到 `claude-opus-4-7`，無 Claude 5 系列。Codex 端已因同類落後出事（BUG-083 / T0366：服務端以 CLI 版本擋新模型）。Claude 端有 PLAN-027 system runtime 可繞，但預設 embedded 使用者沒有。

## 研究目標

1. **現況是否已壞**：內嵌 CLI 2.1.113（經 SDK 0.2.113，與 BAT 同路徑）能否使用 Claude 5 系列模型？是否有「需要新版」類錯誤、模型清單刷新失敗等徵兆？舊模型（Opus 4.7 / Sonnet 4.6）是否仍可用？
2. **0.2 → 0.3 breaking changes**：對 BAT 的實際影響範圍。SDK 使用點：`electron/claude-agent-manager.ts`（`import type { Query, PermissionMode, CanUseTool, SlashCommand, SDKSession }` 等）、`electron/main.ts`、`scripts/build-server-bundle.mjs`（remote server bundle 也打包 SDK）。重點檢查：
   - `query()` 參數 / 回傳型別、串流 message 型別（含 `system` / `task_*` / `tool_use` / `tool_result`）
   - Agent/Task 子 agent 追蹤（CLAUDE.md「Sub-agent / Active Tasks Tracking」：BAT 從 `tool_use` 追蹤 `activeTasks`、`stopTask()` fallback）
   - permission / `canUseTool`、effort 參數與 `EFFORT_LEVELS`（`src/types/index.ts:123`）、`settingSources`、session resume / fork
   - 打包：`package.json` `build.asarUnpack` 中 `@anthropic-ai/claude-code` / `claude-agent-sdk` 的 binary 路徑是否改變（**T0366 發現 Codex 0.160 改了平台套件目錄結構，導致寫死路徑失效——請特別檢查 Claude 是否有同類變化**，含 `electron/claude-resolver.ts` / `claude-runtime-router.ts` 的 embedded 路徑解析）
3. **CLI 2.1.113 → 2.1.289**：若 SDK 留在 0.2，單獨把 CLI 升到 2.1.289 是否可行（SDK 0.2 驅動新 CLI 的相容性）？可作為低風險的第一步嗎？
4. **模型清單與計價**：需新增哪些模型 ID（含 `[1m]` 等 context 變體是否仍適用）、應否移除過時項；`MODEL_PRICING`（`src/components/ClaudeAgentPanel.tsx:3588`）需補哪些價格。**以官方來源為準並附出處**
5. **auto-update（BUG-059）**：新版 CLI 的 auto-update 行為與 `DISABLE_AUTOUPDATER=1` 是否仍有效

## 實驗限制

- 可用使用者現有 Claude 登入跑**極小** smoke（例如 prompt `Reply with exactly: pong`），每個組合 1 次，總數控制在 ~10 次內；**若需複製 credential 到隔離目錄，先問使用者**（T0366 Q1 先例）
- 新版 SDK/CLI 請裝在 scratchpad 或 worktree，不得動主工作樹 `node_modules`

## 回報要求

- 「調查結論」逐題作答，附證據（指令輸出、型別 diff、程式碼行號）
- 「建議方向」給升級路徑選項（例：A 只升 CLI 2.1.289 + 補模型清單；B SDK 0.3 + CLI 一起升；或分階段），每個選項列改動檔案、工作量、風險，並給推薦
- 「建議下一步」列可直接拆成實作工單的項目與建議 `affects_files`
- 指出 CLAUDE.md「Claude Agent SDK / CLI」節需要更新的內容（**本工單不改 CLAUDE.md**，只列出）

## Sub-session 執行指示

1. 讀取本工單全部內容；可參考 `T0366-research-bug083-codex-version-skew.md` 的報告結構
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 依研究目標 1 → 5 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0368-research-claude-sdk-0.3-upgrade.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`；YOLO 依 ct-exec 規則帶 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 遭遇問題

### 回報時間
