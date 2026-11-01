---
schema_version: 1
schema_kind: bug
id: BUG-177
title: "Claude 面板查模型清單（`getSupportedModels`）會送一次真的模型請求（耗 token），並在 `~/.claude/projects/<磁碟根>` 留下 session 檔"
status: FIXED
severity: medium
reproducibility: intermittent
created_at: "2026-11-01T11:17:31+0800"
updated_at: "2026-11-01T11:58:47+0800"
impact:
  - claude-agent-panel
  - token-usage
links:
  discovered_in: "T0727 回報區〈發現的問題〉第 1 點（2026-11-01，假 Anthropic API e2e＋SDK 直接呼叫原型）"
  related: [T0729, T0727, T0718, T0725]
---

# BUG-177 — 查模型清單會送一次真的模型請求

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（每次查清單可能多一個完整 system prompt＋工具定義的 input token 請求；使用者看不到） |
| 可重現 | 時有時無（看 `close()` 與 CLI 誰快；T0727 第 1 次全綠執行出現 4 次，第 2 次 0 次） |
| **狀態** | ✅ FIXED：T0729（commit `ceb24910`），等驗收 |
| 回報者 | T0727 Worker |

## 現象

- 預期：只為了取得 `supportedModels()` 啟動 CLI 時，不送任何模型請求、不建立 session。
- 實際：`ClaudeAgentManager.getSupportedModels`（`electron/claude-agent-manager.ts`）以 `query({ prompt: '', options: { cwd: '/' } })` 啟動 CLI，取得 `supportedModels()` 後 `close()`；CLI 拿到空 prompt 仍會跑一個 turn。SDK 直接呼叫原型：`supportedModels()` 回 5 個模型時還沒有請求，3 秒內假 API 收到 1 個預設模型 `claude-opus-5-5` 的完整請求（14 個 tools、system prompt、空白使用者訊息），並在 `~/.claude/projects/D--`（`cwd: '/'` = 磁碟根）留下 session 檔。
- 面板在 session 取得 `sdkSessionId` 後呼叫一次（`ClaudeAgentPanel.tsx` 載入模型清單的 effect）。

## 影響

- 真實帳號：每次查模型清單可能多耗一個請求的 input token（不論使用者選哪個模型，都用預設模型）。
- `~/.claude/projects/<磁碟根>` 累積空 session 檔，`claude /resume` 清單可能看得到。

## 重現

- 用 `e2e/fixtures/fake-anthropic-api.ts` 起假 API，env 同 `e2e/v072-pre6-claude-panel.spec.ts`，對內嵌 CLI 執行 `query({ prompt: '', options: { cwd: '/', env, pathToClaudeCodeExecutable } }).supportedModels()`，等 3 秒看 `fake.requests`。
- 或跑該 spec，看 `model requests` log 中 `scenario=- … tools=14` 的請求。

## 修正方向（待修正單評估）

- 用不會開始 turn 的 prompt（例如不 yield 的 AsyncIterable，T0718 init smoke 的做法：`initializationResult()` 不送訊息）取得模型清單。
- 或快取結果，避免每個 session 都查。
- 修正後以假 API 斷言「查模型清單 = 0 個 `/v1/messages` 請求、不建立 session 檔」。

## 修正（T0729，commit `ceb24910`）

- `getSupportedModels` 的 prompt 由 `''` 改成不 yield 任何訊息的 AsyncIterable（`idleSdkPrompt`，`electron/claude-agent-manager.ts`）；讀完 `supportedModels()` 後結束 iterable 再 `close()`。`cwd: '/'`、runtime 路徑、spawn env、與 `BAT_BUILTIN_MODELS` 的合併都不變；沒有加快取（不送請求後每個 session 查一次只多一個短命子行程）。
- SDK 原型（假 API、內嵌 CLI 2.1.316）：舊做法 3 秒內 1 個 `claude-opus-5-5` 請求＋`projects/D--/<uuid>.jsonl`；新做法 0 請求、0 session 檔，模型清單相同（`default` / `opus` / `fable` / `sonnet` / `haiku`）。
- 驗證：`e2e/v072-pre6-claude-panel.spec.ts` ⑩（`getSupportedModels` 後 4 秒內 0 個請求、暫存 home 沒有新 session 檔；整次執行沒有來自無標記對話的請求）＋①–⑨ 全綠；`electron/__tests__/claude-supported-models-probe.test.ts`；`test:unit` 351 檔全過、兩個 typecheck = 0、`vite build` 成功。
