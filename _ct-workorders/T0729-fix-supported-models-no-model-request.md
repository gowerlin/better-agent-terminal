---
schema_version: 1
schema_kind: workorder
id: T0729
title: "BUG-177：Claude 面板查模型清單不送模型請求、不留 session 檔（`getSupportedModels`）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-01T11:51:27+0800"
started_at: ""
updated_at: "2026-11-01T11:51:27+0800"
completed_at: ""
depends_on: []
related:
  - "BUG-177（T0727 回報區〈發現的問題〉1）；使用者 2026-11-01 第一百零二 session 選「兩個都現在修」"
  - "T0718 回報區 init smoke：prompt 用不 yield 的 AsyncIterable，`initializationResult()` 不送訊息、不耗 token"
  - "`e2e/fixtures/fake-anthropic-api.ts`、`e2e/v072-pre6-claude-panel.spec.ts`（T0727）"
  - "CLAUDE.md「Claude Agent SDK / CLI」；`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - electron/claude-agent-manager.ts
  - "electron/__tests__/（`getSupportedModels` 的測試）"
  - "src/components/ClaudeAgentPanel.tsx（只在需要調整呼叫時機 / 快取時）"
  - e2e/v072-pre6-claude-panel.spec.ts
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/BUG-177-supported-models-probe-sends-model-request.md
  - _ct-workorders/T0729-fix-supported-models-no-model-request.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標：取得模型清單時 0 個 `/v1/messages` 請求、不在 `~/.claude/projects/` 建立 session 檔。做法由你依 SDK 0.3.316 實測決定（候選：prompt 改不 yield 的 AsyncIterable 再呼叫 `supportedModels()` / `initializationResult()`，取得後 `close()`；必要時加快取避免每個 session 都查），回報區寫明選擇與理由。不得改用寫死清單取代 SDK 回傳（`BAT_BUILTIN_MODELS` 的合併邏輯不變）。"
  - "🔴 行為不變：模型清單內容、面板顯示、`cwd` 以外的選項、embedded / system runtime 選擇、`claudeUpdateGuardEnv` / `claudeTodoToolsEnv` 注入都不變；失敗時的既有 fallback 照舊。若 `cwd: '/'` 也要調整，說明原因。"
  - "🔴 驗證：在 `e2e/v072-pre6-claude-panel.spec.ts` 加斷言（或另一個情境）：查模型清單期間假 API 收到 0 個請求、暫存 home 的 `projects/` 沒有對應 session 檔；原有 ①–⑨ 仍綠。單元測試涵蓋新做法（不送訊息、close 被呼叫、快取若有）。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。不耗 token：只用假 API；隔離實例規則同 T0727（暫存 HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋對外 proxy）。"
  - "🔴 BUG-177 修好後由你把 BUG 檔改 `FIXED`（附 commit 與驗證摘要）；`_bug-tracker.md` 由塔台重建，不要改。docs 補一句查模型清單的做法。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。測試失敗輸出不得傾印整個 `process.env`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0729 — BUG-177：查模型清單不送模型請求

## 元資料

- **工單編號**：T0729
- **類型**：implementation
- **優先級**：P1
- **建立時間**：2026-11-01T11:51:27+0800
- **預估規模**：S

## 背景

T0727 以假 Anthropic API 發現：`ClaudeAgentManager.getSupportedModels` 用空 prompt 啟動 CLI 取模型清單，CLI 仍會跑一個 turn，送出完整的預設模型請求（耗 token），並在 `~/.claude/projects/<磁碟根>` 留下 session 檔。使用者決定現在修。

## 範圍

1. 改 `getSupportedModels` 不送模型請求（必要時加快取）。
2. 單元測試＋e2e 斷言。
3. BUG-177 改 FIXED、docs 一句。

## 不做

- 不改模型清單內容與面板 UI。
- 不碰 BUG-178（T0730）。

## 驗收

- [ ] 查模型清單 = 0 個模型請求、0 個 session 檔（e2e 證據）
- [ ] e2e ①–⑨ 仍綠；`test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] BUG-177 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
