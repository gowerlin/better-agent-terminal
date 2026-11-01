---
schema_version: 1
schema_kind: workorder
id: T0729
title: "BUG-177：Claude 面板查模型清單不送模型請求、不留 session 檔（`getSupportedModels`）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-01T11:51:27+0800"
started_at: "2026-11-01T11:52:57+0800"
updated_at: "2026-11-01T11:59:26+0800"
completed_at: "2026-11-01T11:59:26+0800"
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

- [x] 查模型清單 = 0 個模型請求、0 個 session 檔（e2e 證據）
- [x] e2e ①–⑨ 仍綠；`test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [x] BUG-177 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 查模型清單改用不 yield 的 AsyncIterable prompt：0 個模型請求、0 個 session 檔（SDK 原型＋e2e ⑩ 證據）；①–⑨ 仍綠；`test:unit`、兩個 typecheck、`vite build` 全過；BUG-177 = FIXED。

### 落地檢查

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS。C-3：`electron/claude-agent-manager.ts`、`e2e/v072-pre6-claude-panel.spec.ts`、`docs/agent-guide/claude-agent-sdk-cli.md` 都存在（資訊性）。C-2：無 `branch` 欄位（在 `main`）。
- 不在 worktree（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作證據）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 做法與理由

- **選擇**：`getSupportedModels`（`electron/claude-agent-manager.ts`）的 prompt 由 `''` 改成 `idleSdkPrompt()`：一個在 `release()` 前不 yield 任何 `SDKUserMessage` 的 AsyncIterable（streaming input 模式）。照舊呼叫 `supportedModels()`；`finally` 先 `release()` 結束 iterable，再 `close()`。
- **理由（SDK 0.3.316＋內嵌 CLI 2.1.316 實測，假 API、暫存 HOME、擋外連 proxy）**：

  | 做法 | 模型清單 | 取得耗時 | 取得當下請求 | 3 秒後請求 | session 檔 |
  |---|---|---|---|---|---|
  | 舊：`prompt: ''` + `supportedModels()` | default / opus / fable / sonnet / haiku | 279 ms | 0 | **1**（`claude-opus-5-5`） | **`D--/<uuid>.jsonl`** |
  | 新：不 yield 的 AsyncIterable + `supportedModels()` | 同上 | 276 ms | 0 | 0 | 無 |
  | 新：不 yield 的 AsyncIterable + `initializationResult().models` | 同上 | 279 ms | 0 | 0 | 無 |

  字串 prompt（連 `''`）會被當成一則使用者訊息、跑一個 turn；streaming input 沒有訊息時 CLI 只回 control request。`supportedModels()` 與 `initializationResult()` 結果相同，保留原本的 `supportedModels()` 呼叫，改動最小。
- **沒加快取**：不送請求後，每個 session 查一次的成本只剩一個約 0.3 秒的短命子行程；快取還要處理換帳號 / 換 runtime / CLI 升版後的失效，風險大於收益。
- **`cwd: '/'` 不改**：不跑 turn 就不會建立 session 檔，`cwd` 只影響 session 檔落點（BUG-177 的 `D--`），已無影響；依工單「`cwd` 以外的選項不變」原則，連 `cwd` 也保留。
- **沒加 `persistSession: false`**：AsyncIterable 已達成 0 session 檔，維持「選項不變」。
- 行為不變：`BAT_BUILTIN_MODELS` 合併 / alias 過濾、runtime router 路徑、`sdkSpawnEnv`（`claudeUpdateGuardEnv` / `claudeTodoToolsEnv`）、失敗回 builtins 的 fallback、`ClaudeAgentPanel.tsx` 呼叫時機都沒動。

### 修改檔案

- `electron/claude-agent-manager.ts`：新增 export `idleSdkPrompt()`；`getSupportedModels` 改用它，`finally` 先 `release()` 再 `close()`。
- `electron/__tests__/claude-supported-models-probe.test.ts`（新增，6 項）：`idleSdkPrompt` 在 release 前不產生訊息、之後結束；probe 傳的不是字串、整個過程 iterable 沒產生任何訊息、`close()` 呼叫 1 次；`cwd` / 執行檔路徑 / env 與選項鍵集合不變；builtin 合併結果不變；失敗時只回 builtins 且仍 release＋close；source guard（`getSupportedModels` 內不得有字串 prompt）。
- `e2e/v072-pre6-claude-panel.spec.ts`：新增 ⑩（launch 1 的 ⑨ 之後，經 IPC `claude.getSupportedModels(TAB_OPUS)`，等 4 秒：假 API 0 個新請求、暫存 home `.claude/projects` 沒有新檔；正向對照 = 清單含 `source: 'sdk'` 列）；收尾斷言多一條：整次執行沒有「對話裡完全沒有 `[[T0727:` 標記」且帶 tools 的請求（舊 probe 的空白對話特徵）。新增 `tempHomeProjects()` 與一行無 scenario 請求的摘要 log。
- `docs/agent-guide/claude-agent-sdk-cli.md`：補一句 probe 的做法與「不要改回字串 prompt」。
- `_ct-workorders/BUG-177-…md`：`FIXED`（附 commit 與驗證摘要）。`_bug-tracker.md` 未動（塔台重建）。

### 驗證

| 關卡 | 結果 | 證據 |
|---|---|---|
| SDK 原型（假 API） | PASS | 上表；舊做法重現 BUG（1 請求＋`D--` session 檔），新做法 0 / 0 |
| e2e `v072-pre6-claude-panel.spec.ts` | PASS（1 passed，18 s） | ⑩ `getSupportedModels: 12 rows (sdk ["default"]); 0 model requests within 4 s; no new session file`；①–⑨ 全 PASS；proxy attempts `[]`、off-machine `[]`、使用者 `~/.claude/projects` 無本次項目；暫存 home 的 sessions 只有工作區那一個（無 `D--`） |
| `npm run test:unit` | PASS | 351 檔、6262 passed / 3 skipped |
| `npm run typecheck` | 0 | exit 0 |
| `npm run typecheck:electron` | 0 | exit 0 |
| `npx vite build` | 成功 | exit 0 |

- 驗證時的程式碼 = commit `ceb24910` 的產品內容；docs 那一句在測試之後補上（純文件，不影響測試）。
- e2e 第一次執行的收尾斷言原本寫成「無 scenario 且帶 tools 的請求 = 0」，抓到 5 個請求而失敗；查證它們都用分頁自己的模型（opus / sonnet）、15 個 tools、在已標記的對話裡（`marked=true`、messages 5–17），緊接在各情境結束後，不是模型清單 probe（BUG-177 的 probe 是預設模型＋空白對話）。斷言收窄為「對話完全沒有標記」後全綠，並加一行 log 列出這些請求。

### Commit

- 產品：`ceb249106dc4cea189f5135bc056b9087a9acd4b` — fix(claude): read the model list without starting a turn (T0729, BUG-177)
- 工單＋BUG 檔：本次收尾 commit（`git commit --only`）。未 push、未發版、未改 CHANGELOG。

### 發現的問題 / 後續

1. （觀察，非本單範圍）每個情境的最後一個 turn 結束後，CLI 在同一段對話又送一個請求（無新的 `[[T0727:` 使用者訊息，分頁自己的模型，15 tools；本次 5 個）。T0727 也有（當時被歸在 `scenario=-` 一起看）。可能是 CLI 自己的後續功能（例如 prompt suggestion），在真實帳號會耗 token。是否值得追查由塔台決定；本單未動。
2. 本機原型執行時 tsx 不接受 Git Bash 的 `/d/...` 絕對路徑 import（`ERR_INVALID_MODULE_SPECIFIER`），改用相對路徑解決；原型腳本只在 scratchpad，未進 repo。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

2026-11-01T11:59:26+0800
