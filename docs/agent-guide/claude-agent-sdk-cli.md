# Claude Agent SDK / CLI

> 從 CLAUDE.md「Claude Agent SDK / CLI」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

- `@anthropic-ai/claude-agent-sdk` `^0.3.316`（實裝 `0.3.316`，2026-11-01 T0718 / D191 自 `^0.2.111` / 實裝 `0.2.113` 升上來，執行 D123 Phase 2）、`@anthropic-ai/claude-code` `^2.1.316`（實裝 `2.1.316`）。2026-11-01 T0717 追版 CLI（`^2.1.306` → `^2.1.316`，D191 追 latest，含 8 個平台子套件；模型清單、effort、計價、`HEALTHY_MIN`、update guard、BAT 整合點皆無變動；2.1.312 / 2.1.316 改了兩句限額訊息，`src/lib/usage-limit.ts` 同步補認 `5-hour limit` 與 `Usage limit reset · Continuing automatically`，D192）；2026-10-21 T0690 追版 CLI（`^2.1.300` → `^2.1.306`，含 8 個平台子套件；模型清單、effort、計價、`HEALTHY_MIN`、update guard、BAT 整合點（`--mcp-config=` / `--settings=` hooks / `--name` / `disableAllHooks` / `autoContinueAtUsageLimit`）與 `src/lib/usage-limit.ts` 句型皆無變動）；2026-10-15 T0541 追版 CLI（`^2.1.296` → `^2.1.300`，含 8 個 `@anthropic-ai/claude-code-*` 平台子套件；模型清單、effort、計價皆無變動）；2026-10-13 T0483 追版 CLI（`^2.1.289` → `^2.1.296`，含 8 個平台子套件）；2026-10-04 T0371 只升 CLI（原 `^2.1.111` / 實裝 `2.1.113`，T0165 C1.1），SDK 當時刻意留在 0.2 線（0.3 移除 V2 session API，見 T0368 第 2 節；Phase 2 另案，D123，T0718 已執行）。CLI 2.1.289 提供 **Claude 5 系列**（`claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`）支援；2.1.293 新增 `claude-haiku-5-5`（CLI 的 `haiku` alias 改指向它）。
- 🔴 **服務端以 CLI 版本擋新模型**：CLI 太舊時 API 回 `400` + `error_code: "claude_code_version_too_old"`（原文例：`Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required`）。目前門檻：Opus 5.5 需 `>= 2.1.280`、Fable 5.1 需 `>= 2.1.251`（T0368 實測；門檻由服務端逐模型設定，隨時可能擴及其他模型）。⇒ **內嵌 CLI 落後即功能故障**，每次預覽版發布前應 `npm view @anthropic-ai/claude-code version` 追版。Claude 面板以 `src/lib/claude-error-classify.ts`（`classifyClaudeError`）辨識此錯誤，在原訊息後附 i18n 提示（`claude.claudeErrorHintCliTooOld*`：升級 BAT，或切 system runtime 並升級系統 claude），`claude:error` IPC 簽章不變（T0372）。
- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）已前插 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5` / `claude-haiku-5-5`（Haiku 5.5 為 T0483 加入；`claude-haiku-4-5-20251001` 保留）。5 系列原生 1M context，**不再加 `[1m]` 變體**（CLI 2.1.289 / 2.1.296 / 2.1.300 / 2.1.306 / 2.1.316 的模型清單也不列 `[1m]` 行）；既有 `claude-opus-4-7[1m]` / `-4-6[1m]` / `claude-sonnet-4-6[1m]` 保留（legacy 未退役）。`getSupportedModels()` 的 SDK 補充清單以 runtime router 解出的 CLI 取得，SDK alias（`opus` / `fable` / `sonnet` / `haiku`）若其 `resolvedModel` 已是 builtin 即略過（`default` 保留，因它跟隨帳號預設）；取完清單即 `close()` 該 probe 子行程（T0372）。probe 的 prompt 是不 yield 任何訊息的 AsyncIterable（`idleSdkPrompt`，T0729 / BUG-177）：CLI 只回 control request，不跑 turn，所以查清單 0 個模型請求、不在 `~/.claude/projects/` 留 session 檔；🔴 不要改回字串 prompt（連 `''` 也會跑一個 turn，以預設模型送完整請求）。`setModel()` 切換模型後、下一次 `modelUsage` 回報前，顯示的 context window / max output 取自 `estimateModelLimits()`（`electron/claude-agent-manager.ts` `MODEL_LIMITS`，T0484）：Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Haiku 5.5 為 1M / 128K（官方 models overview，2026-10-13）；其餘 ID（含 legacy 與 alias）沿用舊推估（`[1m]` → 1M 否則 200K；含 `haiku` → 8192 否則 64000）。新增 5 系列模型時同步補此表與 `electron/__tests__/claude-model-limits-and-call-usage.test.ts`。
- 計價表集中於 `src/lib/model-pricing.ts`（`P()` / `MODEL_PRICING` / `getModelPricing()`），Claude 與 Codex 面板的 Cache History 成本皆引用此模組（T0374，原為兩份內嵌複本）。已收錄 5 系列（`opus-5-5` / `fable-5-1` / `sonnet-5-5` / `haiku-5-5` 及 legacy `opus-5` / `opus-4-8` / `sonnet-5` / `fable-5`，價格只取自官方價目頁：T0368 第 4 節，T0483 於 2026-10-13 重讀補 Haiku 5.5 與 Sonnet 5.5 cache read 調降）。`P(input, output, { cacheReadMultiplier })` 預設 0.1x，Opus 5.5 與 Sonnet 5.5 為 **0.05x**、Fable 5.1 為 **0.025x**。Haiku 5.5 依 prompt 長度分段計價（prompt 含 cache read / write 的全部 input tokens 超過 100,000 時改用 `haiku-5-5-long`，5 倍價）：`getModelPricing(model, { promptTokens })` 支援分段。Claude 面板的 Cache History 自 T0484 起經 `estimateCallCost()` / `estimateModelUsageCost()`（同模組，運算順序與舊面板相同，價格不分段的模型結果逐位元不變）計價：單次呼叫列以該列 prompt 長度選價；R 列的 `modelUsage` 是跨呼叫加總，主行程依 API message id 追蹤每次呼叫（`stream_event` 的 `message_start` / `message_delta` + `assistant` 訊息 usage，sub-agent 一併記錄），result 時把 prompt > 100,000 的呼叫加總寫入 `modelUsage[model].longPrompt`（含在總量內），renderer 對這部分用 long 價、其餘用基本價。漏追的呼叫（CLI 背景呼叫等）仍以 ≤100K 價計，只會低估。Codex 面板只計 OpenAI 模型（皆回 `null`），未接線。`getModelPricing()` 以 `includes` 比對，**point release 必須排在 base model 之前**（`opus-5-5` 先於 `opus-5`、`fable-5-1` 先於 `fable-5`）；新增模型時同步補 `src/lib/__tests__/model-pricing.test.ts`。未命中的 ID（含 OpenAI / Codex 模型）回 `null`，成本顯示 `—`。
- **SDK 0.3（T0718）**：
  - 0.3.142 Breaking 三項：① V2 session API（`unstable_v2_*` / `SDKSession` / `SDKSessionOptions`）移除 → `claude-code-v2`「Claude Agent V2」preset 下架（D123：不改寫成 `query()` wrapper），V1↔V2 切換鈕、「+」選單的 V2 項目一併移除。T0722 / D194：只剩一種 SDK 面板，`claude-code` / `claude-code-worktree` 的顯示名稱拿掉「V1」，改為 `Claude Agent` / `Claude Agent (Worktree)`（renderer `src/types/agent-presets.ts`、main `electron/agent-runtime/agent-registry.ts`、`ThumbnailBar.tsx` 沒有 agent 定義時的備用選單、i18n `v1Model1mWarning` 文字；id、helper `--agent`、IPC / remote 協定不變）。舊預設標題 `Claude Agent V1` / `V2` / `V1 (Worktree)` → 新名稱的對照只在 `src/lib/retired-agent-presets.ts` `RETIRED_AGENT_PRESET_TITLES`：分頁還原與 detached adopt 經 `migrateTerminalAgentPreset` 改 `title` / `autoTitle`（只改完全相同的字串，不論 preset；使用者標題、`sdkSessionId`、`model` 不動），`isDefaultTerminalTitle` 經 `isRetiredPresetTitle` 仍當預設標題。新舊版混用：顯示名稱由 client（桌面版）自己決定 ——「+」選單的 `agent:list-definitions` 不經 proxy、由本機 main registry 回答，分頁標題（`externalTerminalTitle`、`towerAgentLabel`）先用 renderer preset 名稱，server 帶的 `agentName` 只在 renderer 不認得該 preset 時才用；所以舊 client 連新 bat-server 照舊顯示 `Claude Agent V1`，新 client 連舊 bat-server 顯示 `Claude Agent`，沒有任何協定欄位變動。② MCP server 改背景連線，使用者設定檔裡慢的 server 在 `init` 為 `pending`（BAT 不自帶 `mcpServers`、面板不顯示 MCP 狀態，只影響首輪工具是否已可用）；③ SDK session 改用 `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`（取代 `TodoWrite`）。面板把它們畫成工作清單卡片（T0725 起，見下「Claude 面板工作清單」；`TodoWrite` 勾選清單只對舊 session 歷史），**不是** sub-agent：`activeTasks` 只登記 `Agent` / `Task`（`electron/__tests__/claude-sdk03-task-tools.test.ts`）。另外 Claude 5 系列模型預設不帶 task 工具（CLI 側行為，T0368），T0725 起面板以 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 開啟。
  - peer：0.3.143 起 `@anthropic-ai/sdk`（`>=0.93.0`）、`@modelcontextprotocol/sdk`（`^1.29.0`）、`zod`（`^4.0.0`）是 peerDependencies。repo 的 `@modelcontextprotocol/sdk` 1.29.0 / `zod` 4.3.6 已滿足、不升；`@anthropic-ai/sdk` 0.81.0 → 1.3.0（新增 `@opentelemetry/api` / `standardwebhooks` / `@stablelib/base64` / `fast-sha256`）。只影響型別：BAT 只 import `.`（`sdk.mjs`），執行期外部依賴仍只有 `ajv` / `ajv-formats`（安裝檔白名單已有）；`./core` 入口才 import MCP SDK / zod。npm 12 在既有 lock 上升級會回自相矛盾的 `ERESOLVE`（peer 衝突），T0718 以移植方式產 lock（見工單回報區）。
  - `query()` 選項（`systemPrompt` / `tools` preset、`settingSources`、`thinking: adaptive`、`effort`、`toolConfig`、`agentProgressSummaries`、`promptSuggestions`、`plugins`、`canUseTool`、`resume` / `continue`、`pathToClaudeCodeExecutable`、`env`、`executable`、`forkSession` / `maxTurns`）在 0.3.316 的 `Options` 型別上逐一存在；`runQuery` 的 `queryOptions` 是 `Record<string, unknown>` 再轉型，typecheck 抓不到選項改名，升 SDK 時要另外比對。`CanUseTool` 可回 `null`（抑制自動回應）只是型別放寬，BAT 不回 `null`。
- Cache History 的列與總計邏輯在 `src/lib/cache-history.ts`（T0498）。主行程在主 agent 的串流 `claude:status` 帶 `lastCall`（該次 API 呼叫的 id / model / query 編號 / token，取自 per-call tracker）；query 開始與 result 時為 `null`（`null` 代表新版 server，欄位不存在代表舊版，renderer 走舊邏輯）。單次呼叫列一呼叫一列，以自己的 token 計價。R 列取自 SDK `modelUsage`，含同 query 所有呼叫（含 sub-agent；`modelUsage` 是 session 累計，T0744 起 R 列是本回合的差值，見「Cache History 的 R 列：CLI 累計值換算」節），**總計不重複加同 query 的單次呼叫列**，只加沒有 result 的 query 與進行中 query 的列。開始 query 時經 `resetQueryUsage()` 清 `modelUsage` / `lastCall` / tracker（T0498 前已下架的 V2 路徑不清，上一 result 會被當成新的 R 列重複加總；V2 路徑 T0718 移除）。
- `EFFORT_LEVELS = ['low','medium','high','max','xhigh']` + `EffortLevel` type 集中宣告於 `src/types/index.ts`。新增 effort 成員時只改 const，其他檔案自動套用。
- Settings 的 effort dropdown 包含完整 5 級，不再標示「(Opus only)」（T0374 移除：CLI 2.1.289 對 Sonnet 5.5 / Fable 5.1 / Opus 5.5 的 `supportedEffortLevels` 皆含 `max` 與 `xhigh`，T0368；CLI 2.1.296 的 Haiku 5.5 同為 5 級，T0483；2.1.300 五個 alias 皆不變，T0541；2.1.306 同，T0690；2.1.316 同，T0717）。`xhigh` 需 CLI `>= 2.1.111`。

## Cache History 的 R 列：CLI 累計值換算（T0744 / BUG-181）

- 🔴 必守：R 列的 tokens 與費用 = 本回合累計 − 同一 session 上一個 result 的累計，依 model 分開相減；換算唯一實作 `turnModelUsage`（`src/lib/cache-history.ts`），ClaudeAgentPanel 不內聯；計價一律經 `src/lib/model-pricing.ts`。
- 語意（SDK 0.3.316 `SDKResultSuccess` / `SDKResultError` 的型別註解；T0739 以 CLI 2.1.316 實測）：
  - `result.modelUsage`、`result.total_cost_usd`：**session 累計值**。每個 result 帶到目前為止的總量，涵蓋主 agent、Task 子代理、sidechain 與 compaction 等內部呼叫（不含權限分類器、token 計數等 query pipeline 以外的呼叫）。resume / fork 的 session 從 transcript 存的總量接續（第一個 result 就含先前的回合）；session 中的 `/clear` 重置；crash / 啟動錯誤的 result 可能是 0。
  - `result.usage`：只有主 agent 迴圈，而且是單一回合。
  - 主行程不換算：`claude:status` 的 `modelUsage`、`inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheCreationTokens`（result 後由 `modelUsage` 加總）與 `totalCost` 都是累計值。`claude:status` / `claude:result` 的 IPC 簽章不變。
- 換算規則（`turnModelUsage(current, previous)`，由 `applyStatusToCacheHistory(hist, status, ctx, baseline)` 呼叫）：
  - 依 model：本回合 = 本次累計 − 基準。新出現的 model 以 0 為基準；這回合沒有變化的 model 不列（全部沒變時保留為 0）。
  - 任何欄位（4 個 token 欄位或 `costUSD`；`costUSD` 容許 1e-9 浮點誤差）比基準小，或基準裡有用量的 model 不見了 → 視為累計重置：該列 = 本次累計原值（`usageBasis: 'reset'`），面板記 debug log `cache history R row usageBasis=reset`，`#` 欄 tooltip 說明。
  - 基準未知 → 該列 = 本次累計原值（`usageBasis: 'includes-prior'`），`#` 欄顯示 `R*`，tooltip 說明含 session 先前的回合；面板記 debug log。
  - 與基準完全相同的 result（同一個 result 重送，例如回合結束後 setModel 的 status）不加列。
  - `longPrompt`（主行程依本 query 的呼叫追蹤，不是累計值）原樣保留；`estimateModelUsageCost` 本來就把它夾在列的總量內。
  - R 列的 `%`、turn c.read / c.write / total、output、est. $、real $ 都由差值算出；`cumulativeModelUsage` 保留收到的累計原值（下一列的基準）。
- 基準（`CacheHistoryUsageBaseline`，面板的 `cacheUsageBaselineRef`）：
  - 新 session（掛載時沒有 `sdkSessionId`、`/new`、`claude:session-reset`）→ `freshUsageBaseline()`（全 0）。
  - 掛載時 auto-resume（BAT 重開）、從清單 resume 另一個 session、fork 出的新分頁、面板重新掛載 → `unknownUsageBaseline()`：resume 後第一個 R 列是 `R*`（含先前累計），之後的列正常相減。
  - 選「標示 R*」而不是「改用 `result.usage`」：`usage` 不含子代理與額外請求、也沒有 `costUSD`，用它會讓 real $ 合計 ≠ 累計值。
  - Cache History 的 Clear 只清列、不清基準（session 的累計沒變）。
- 合計：
  - real $ = `cacheHistoryApiTotal(hist)`（R 列的 `costUSD` 相加）。從新 session 或 `R*` 開始、中途沒有重置時，等於最後一個 result 的累計值（= 狀態列 session cost `totalCost`）；中途重置時 = 重置前的累計 + 重置後的累計（實際花費）。
  - est. $ = `cacheHistoryGrandTotal(hist)`，規則不變（T0498）；R 列改成差值後不再重複計算。
  - 各列 real $ = `cacheHistoryRealCost(h)`。
  - 已知限制：`R*` 列（含先前回合）的 est. $ 只有本 query 的長 prompt 呼叫用 Haiku 5.5 long 價（`longPrompt` 只追本 query），先前回合一律以基本價估 → 低估（T0744 e2e ②：est. $0.0845、real $0.1626）；real $ 不受影響。
- 回合之間的額外請求（prompt suggestion、背景子代理結束後 CLI 自己接續的回合等）會算進下一個 R 列。
- 存檔：Cache History 只在記憶體（`cacheHistoryRef`），沒有存檔與還原，所以沒有「舊存檔」要換算；BAT 重開後是空的，resume 後第一列為 `R*`。`applyStatusToCacheHistory` 沒給 `baseline` 時，以 hist 裡上一個 R 列的 `cumulativeModelUsage`（T0744 前建立的列：`modelUsage`，當時就是累計值）為基準，沒有 R 列時以 0 為基準。
- 不變：
  - 單次呼叫列、pre-T0498 server 的非 R 列。
  - 狀態列：`cost` = 累計 `totalCost`（session cost）；`cache:` 百分比 = 累計 cache read ÷ 累計 input（session 值）。
  - 狀態列 `cache:` 的顏色取 history 裡 input ≥ 50k 的列的最低 %，R 列改成每回合後，這個顏色跟著改用每回合的值。
- Codex 面板（`CodexAgentPanel.tsx` 自己有一份 Cache History，未改）：`codex-agent-manager.ts` 不送 `modelUsage`（所以沒有 R 列）；`turn.completed.usage` 依 `@openai/codex-sdk` 型別註解是單一回合，主行程以 `+=` 加到 `inputTokens` / `outputTokens` / `cacheReadTokens`（session 累計）。
- 驗證：
  - 單元：`src/lib/__tests__/cache-history.test.ts`「T0744」（T0739 實測數字：7 個 R 列合計 US$0.1432，舊算法約 0.337；換模型、重置、resume、重送、Clear、舊列、`longPrompt`、面板 source guard）；`electron/__tests__/claude-cache-history-last-call.test.ts` 的 harness 改以累計格式送 result（T0498 的 before 數字以 `perQuery` 保留）。
  - e2e：`e2e/t0744-cache-history-cumulative.spec.ts`（假 API 每回合回報已知 token，由內嵌 CLI 自己累計；新 session 3 回合 → 3 個 `turn` 的 R 列、real $ 合計 = session cost；重開後 resume → `R*`）。
  - 真實模型複驗（耗少量 token，需使用者同意）：`BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-claude-panel.spec.ts`。T0746 起 spec 在兩次啟動結束前各讀一次 Cache History（DOM），逐列比對 `[Claude result]` 日誌的累計值（依 model 相減、resume 第一列 `R*`、real $ 合計 = 最後的 `total_cost_usd`），不符只在最後斷言；`BAT_E2E_RUN_TAG=t####` 指定工作區 / session 資料夾名稱。
  - 2026-11-01 T0746 複驗（v0.7.2-pre.9 原始碼 build、CLI 2.1.316、Haiku 5.5 + 1 回合 Haiku 4.5，8 個模型回合、US$0.148）：PASS。第一次啟動 7 個 R 列逐列 = 累計差值（換到 4.5 那列的 4.5 子列從 0 起算），real $ 合計 $0.1366 vs `total_cost_usd` 0.136555；resume 後唯一一列為 `R*`、= 累計 0.148042，合計 $0.1480。

## Claude 面板工作清單（T0725 / D195）

- 🔴 **開啟方式**：只在 Claude 面板（SDK）的 spawn env 加 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`，唯一位置 `sdkSpawnEnv` → `claudeTodoToolsEnv`（`electron/claude-agent-manager.ts`），套在 `runQuery` / `forkSession` / `getSupportedModels` 三個 spawn 點，embedded 與 system runtime 都適用（與 `claudeUpdateGuardEnv` 分開寫，`DISABLE_UPDATES` 規則不變）。不影響 Claude CLI 終端分頁、helper 派工、codex；不加 Settings 開關；不用 `allowedTools`（它同時是免詢問權限清單）。
- **為什麼要開**（T0721 R2，CLI 2.1.316）：Task\* 的 `isEnabled` 需要 `o3()`，舊模型（`claude-opus-4-*`、`claude-sonnet-4-*`、`claude-haiku-4-5` 等）預設成立，Claude 5 模型只有 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 為 true 或明確點名工具才成立；BAT 傳 `tools: { type: 'preset' }`、沒有 `allowedTools`，所以不開的話 Claude 5 不會出現 Task\*。`TodoWrite` 只在 `CLAUDE_CODE_ENABLE_TASKS` 關掉時出現。
- **尊重既有值**：主行程環境已有 `CLAUDE_CODE_ENABLE_TODO_TOOLS` 或 `CLAUDE_CODE_ENABLE_TASKS`（任何值，含空字串）時一律不加、不覆寫。理由：`CLAUDE_CODE_ENABLE_TODO_TOOLS=0` 是使用者明確關閉；`CLAUDE_CODE_ENABLE_TASKS=false` 是使用者要 `TodoWrite`，此時再加 todo 旗標會讓 Claude 5 多出 `TodoWrite`，改變使用者自己選的行為。只看 BAT 主行程的 `process.env`（使用者 / 系統環境變數）；`~/.claude/settings.json` 的 `env` 由 CLI 自己套用，BAT 不讀。
- **清單重播**：純函式 `src/lib/claude-task-list.ts`（`replayTaskList` / `applyTaskToolCall`），依訊息順序重播，不新增 IPC：
  - `TaskCreate`：結果文字 `Task #<id> created successfully: <subject>` 建項目（id 只在結果文字）；還沒有結果時先以 `call-<tool id>` 暫列，結果到了改成 `task-<id>`。
  - `TaskUpdate`：輸入的 `status`（`pending` / `in_progress` / `completed`；`deleted` 移除）、`subject`、`activeForm`；沒有結果時先套用，結果不是 `Updated task #…`（`Task not found`、hook 擋下的錯誤文字，CLI 不設 `is_error`）就不套用。`status: 'error'` / `denied` 的呼叫一律忽略。
  - `TaskList`：結果每行 `#<id> [<status>] <subject>[ (<owner>)][ [blocked by #…]]` 整份取代（`No tasks found` = 空清單）；去掉 `[blocked by …]`；`(<owner>)` 與結尾帶括號的 subject 分不出來，只在已知 subject 加上 owner 後綴時保留已知 subject。歷史結果被截在 `HISTORY_RESULT_MAX_CHARS` = 2000 字時不當完整快照：丟掉最後一行、只更新列出的項目。
  - 結果文字是 JSON 區塊陣列（BAT 對非字串 content 存 `JSON.stringify`）時取 text 區塊。任何解析失敗都不丟例外、不清空清單。`TaskGet` 不改清單。
- **面板**（`ClaudeAgentPanel.tsx`）：Task\* 卡片標題「工作清單」＋本次動作摘要（新增：subject / `#id → 狀態` / 已同步清單）；每段連續的 Task\* 呼叫只在最後一張卡片畫累積清單（沿用 `TodoWrite` 的 `claude-todo-*` 樣式，`activeForm` 放 tooltip）與「已完成 n/m」。重播只看主時間軸 `messages`；被封存（`ARCHIVE_TRIGGER`）移出的訊息先重播進 `taskListBase`，所以封存不會丟項目；session 重開 / 歷史載入 / resume 切換時與封存一起重設。從封存載回的舊卡片、sub-agent 視窗內的 Task\* 卡片沒有快照，只顯示摘要。`TodoWrite` 的顯示不變。
- **不做**：不加 pinned「工作清單」區塊（與 `TodoWrite` 一致，最新清單就在最後一張 Task\* 卡片；長 session 捲走後要往下看）；sub-agent 自己呼叫的 Task\* 不併入主清單（它們在 sub-agent bucket，不在主時間軸）。
- 驗證：`src/lib/__tests__/claude-task-list.test.ts`（重播）、`electron/__tests__/claude-todo-tools-env.test.ts`（env 注入與尊重既有值）、`src/__tests__/claude-panel-task-list.test.tsx`（歷史 / 即時事件畫清單、不進 active task bar、`TodoWrite` 不變）、`electron/__tests__/claude-sdk03-task-tools.test.ts`（Task\* 不進 `activeTasks`）。CLI 改結果文字格式時同步改 `claude-task-list.ts` 與測試。
- e2e（T0727，不耗 token）：`e2e/v072-pre6-claude-panel.spec.ts` 以本機假 Anthropic Messages API（`e2e/fixtures/fake-anthropic-api.ts`，`ANTHROPIC_BASE_URL`）驅動真的內嵌 CLI，涵蓋 Claude 5 / 4.x 首個請求提供 Task\*（CLI 2.1.316 放在 ToolSearch 的 deferred 清單，不在 `tools`）、工作清單逐回合變化、重開後 resume 重建、串流、權限詢問、sub-agent、`claude-code-v2` 分頁遷移、claude-cli 分頁 env；隔離方式（暫存 USERPROFILE、工作區放 `%ProgramData%`、阻擋並記錄對外連線的 proxy）見 spec 檔頭。升 SDK / CLI 時跑一次（需先 `npx vite build`）。
- 真實模型驗收（T0739，🔴 會耗 token）：`e2e/v072-real-model-claude-panel.spec.ts`，預設 skip，`BAT_E2E_REAL_MODEL=1` 才跑；沿用使用者自己的 claude 登入，只用 `claude-haiku-5-5`（另 1 回合 `claude-haiku-4-5` 對照），≤ 12 回合、session 費用超過 US$0.5 就停（T0746 前為 US$1）。2026-11-01 結果（CLI 2.1.316）：Haiku 5.5 經 ToolSearch 主動用 TaskCreate / TaskUpdate、清單正確更新，4.5 直接用 Task\*（兩者都沒用 `TodoWrite`）；搜尋走 `Grep`；背景 `Agent` 卡片有「背景」標籤、完成後 dot-success，但執行中不進 active task bar；resume 後歷史重建、可接續。注意：CLI 2.1.316 的 `total_cost_usd` / `modelUsage` 是 session 累計值（含 prompt suggestion 等額外請求、resume 後延續），不是單一回合。

## Claude 設定目錄（BUG-178 / T0730）

- 🔴 **規則**：Claude 的使用者設定目錄 = `CLAUDE_CONFIG_DIR`（去掉前後空白後非空）優先，否則 `<home>/.claude`。唯一實作 `resolveClaudeConfigDir(env, homeDir, join?)`（`electron/claude-config-dir.ts`，不 import electron）。沒設或設成空字串時路徑與 T0730 前完全相同。
- **env 來源**：每個 consumer 傳「讀的是哪一個 claude」的 env，不一律看主行程 `process.env`：
  | 位置 | 讀什麼 | env |
  |---|---|---|
  | `panelClaudeConfigDir`（`electron/claude-agent-manager.ts`） | Claude 面板的 session 歷史 `loadSessionHistory`、session 清單 fallback `listSessionsFallback`（`projects/<encoded cwd>`）、`runQuery` 的 `plugins/installed_plugins.json` | 面板 spawn CLI 的 env（`sdkSpawnEnv(runtime).env ?? process.env`）。`sdkSpawnEnv` 兩種 runtime 都不動 `CLAUDE_CONFIG_DIR`，所以沒有 runtime 的歷史 / 清單路徑不解析 runtime（`claude-config-dir.test.ts` 守住） |
  | `claude:scan-skills` / `claude:scan-star-commands` / `claude:get-statusline-extras`（`electron/handlers/claude.ts`） | 使用者的 `commands/`、`skills/`、`account-label.txt`、`cache/` | 回答主機的 env（`deps.env ?? process.env`；遠端 = bat-server） |
  | `defaultClaudeSettingsFiles`（`electron/bat-mcp-launch.ts`） | `settings.json`（hooks 是否停用） | 分頁啟動時的 env |
  | `claudeConfigDir`（`electron/ct-install-detect.ts`）、`ctConfigCandidates` 預設值層（`electron/handlers/ct-config.ts`） | CT 手動安裝 `skills/control-tower`、`ct@*` plugin | 回答主機的 env |
- **不是 Claude 設定目錄（不經這個函式）**：`<home>/.claude/local`（舊版 claude 本機安裝位置，`claude-resolver.ts` / `node-resolver.ts`）、CT 自己的 `<home>/.claude/control-tower-data/config.yaml` 與舊 `control-tower-config.yaml`（ct-config global 層；CT `tower-config.md` 寫死 `~/.claude`，不隨 `CLAUDE_CONFIG_DIR` 移動）、專案的 `<cwd>/.claude`（`worktree-manager.ts`、scan-skills 的 project scope）。Claude 面板以 SDK 在主行程讀 session 清單（`listSessions`）時，SDK 自己讀 `process.env.CLAUDE_CONFIG_DIR`，與 spawn env 相同。
- 🔴 新增讀 Claude 設定目錄的程式一律經 `resolveClaudeConfigDir`（或上表的包裝），不要手寫 `path.join(home, '.claude')`；`electron/__tests__/claude-config-dir.test.ts` 的 source guard 掃 `electron/` 與 `src/`，例外只有上一點列的檔案。
- **與 CLI 的已知差異**（刻意保留）：CLI 2.1.316 / SDK 0.3.316 是 `(CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')).normalize('NFC')`：空字串或全空白照用（相對路徑），並正規化為 NFC。BAT 對空白值回到 `<home>/.claude`、不做 NFC，讓沒設變數的使用者路徑不變。設成空白的 `CLAUDE_CONFIG_DIR` 本身就是壞設定（CLI 會把 session 寫到 cwd 底下的 `projects/`）。
- **已知限制**：`installed_plugins.json` 的位置沿用 T0710 規則（`<config>/plugins/`）；CT `data-layer-architecture.md` 記載設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時整個 plugins 目錄（含 `installed_plugins.json`）在該處，BAT 目前只把 cache 根目錄改到那裡（`findClaudeCtPlugins`），面板的 plugins 清單也一樣。
- 驗證：`electron/__tests__/claude-config-dir.test.ts`（設 / 未設 / 空字串 / 全空白；兩種 runtime 的 spawn env；歷史與清單讀 `CLAUDE_CONFIG_DIR`；scan-skills / star commands / statusline extras；ct-config 預設值層與 global 層；source guard）；e2e `e2e/v072-pre6-claude-panel.spec.ts` 第二個 test（⑪ session 檔寫在 `CLAUDE_CONFIG_DIR`、清單找得到、plugins 從 `<CLAUDE_CONFIG_DIR>/plugins` 載入且暫存 home 的誘餌不載；⑫ 重開後 resume 歷史重建）。
- 介面層 e2e（T0737，不耗 token）：`e2e/v072-pre7-claude-panel-ui.spec.ts` 從介面操作（縮圖列「+」新增 Claude Agent、`/model` 選模型、`/resume`、斜線選單、塔台 › 總覽）：BUG-177 新分頁與模型清單 0 個模型請求 / 0 個 session 檔、送一則後只有 1 個且 `/resume` 只列它；BUG-178 session 與 plugins 指令來自 `CLAUDE_CONFIG_DIR`、`*config` 預設值層讀 `<CLAUDE_CONFIG_DIR>/skills/control-tower/references/tower-config.md`、重開後新分頁以 `/resume` 接續、HOME 下 `.claude` 誘餌檔不變。

## Claude 面板的背景子代理（T0759 / BUG-190）

- **用途**：背景子代理（`Agent` 帶 `run_in_background: true`；CLI 2.1.316 的 `Agent` 不帶此參數時也預設背景執行）執行中留在 active task bar（可停止），結束時移出並在卡片標示結果。修正前 tool_result 在啟動時就回來，`activeTasks` 隨即清掉，bar 約 1.5 s 後變 0 項；結束後卡片只顯示原本的描述（T0739 F2）。
- 🔴 規則：前景 `Agent` / `Task` 照舊在 tool_result 結束（CLAUDE.md「Sub-agent / Active Tasks Tracking」）；背景的 tool_result 只是啟動通知，項目保留到 `task_notification`（`completed` / `failed` / `stopped`），描述寫 `[completed] <summary>` 等；收不到結束信號時以 query 結束為上限（`runQuery` 的 finally 清空 `activeTasks`，仍 `running` 的卡片標 error）。🔴 主回合的 `result` 不清背景項目：此時子代理還在跑。
- **背景判定**（任一成立）：`task_started.is_backgrounded === true`、`task_updated.patch.is_backgrounded === true`（前景改背景）、該 user 訊息只帶一個 tool_result 且 `tool_use_result.status === 'async_launched'`（沒有 `task_started` 的舊 CLI）。`task_started` 把 tool_use 時以 tool_use_id 登記的項目改以 task_id 為 key（一個子代理一筆）；`task_notification` 先以 task_id、再以 tool_use_id 找項目，並刪掉同一 tool_use 的所有項目。
- **唯一實作**：`applyToolResult` / `deleteActiveTasksOf` 與 `processMessage` 的 `task_started` / `task_updated` / `task_notification` 分支（`electron/claude-agent-manager.ts`）；工具卡片欄位 `ClaudeToolCall.isBackground`（`src/types/claude-agent.ts`，主行程設定）；卡片結果標示 `backgroundAgentResultLabel` / 「背景」標籤 `isBackgroundAgentCall`（`src/lib/agent-task-label.ts`，`ClaudeAgentPanel.tsx` 的 `.claude-task-end-label` 只對已結束的背景卡片顯示；前景卡片照舊顯示 tool_result）。
- **訊息序列**（SDK 0.3.316 / CLI 2.1.316，T0727 假 API 實錄，不用真實模型）：
  - 背景：`tool_use Agent` → `background_tasks_changed`（含該 task）→ `task_started`（`is_backgrounded: true`、`tool_use_id`）→ user `tool_result`「Async agent launched successfully…」（`tool_use_result.status: 'async_launched'`、`isAsync: true`）→ 主回合 `result` → 子代理的訊息（`parent_tool_use_id`）→ `task_updated`（`patch.status: 'completed'`）→ `task_notification`（`status: 'completed'`、`summary` = 子代理最後的文字）→ `background_tasks_changed`（空）→ CLI 自己多跑 1 回合（第 2 個 `result`）→ query 結束。
  - 前景：`task_started`（`is_backgrounded: false`）→ 子代理訊息 → `task_updated` / `task_notification`（`completed`）→ user `tool_result`「[Subagent hand-back] …」（`tool_use_result.status: 'completed'`）→ 主回合繼續。
- **`stopTask`**（實錄）：送 task_id → `task_updated`（`killed`）+ `task_notification`（`stopped`）後 resolve；卡片 `[stopped by user] …`。🔴 送 tool_use_id 會 resolve 但**不停**（子代理照跑完）：修正前 `activeTasks` 同一子代理有兩筆、先找到 tool_use_id 那筆，送的正是這個 id。主回合 `result` 之後能不能停取決於 SDK 是否還開著 CLI 的輸入：BAT 的選項（`canUseTool`、`promptSuggestions`、`includePartialMessages`）下仍開著，可停（e2e ⑦b、探測實錄）；不帶這些選項的字串 prompt 在第一個 `result` 就關輸入，`stopTask` 不送達、到 query 結束才 reject `Query closed before response received`。後者時背景項目不改寫已標的結果；仍在跑就只把描述改 `[stop failed] …`、保持 `running`。
- **已知限制**（既有行為，本單未改）：背景子代理執行中 query 仍在跑（`isStreaming`），這時送新訊息會走「中止目前 query 再送」路徑（`sendMessage`）：CLI 被中止、背景子代理一起結束，卡片標 error（`Agent terminated unexpectedly`）。`background_tasks_changed`（level 信號）目前不用。歷史重建（resume）不保留 `isBackground`。
- **驗證**：`electron/__tests__/claude-background-agent.test.ts`（實錄序列：背景完成 / 失敗 / 舊 CLI / 前景改背景 / 錯誤 tool_result / re-key；前景不變；`stopTask` 送 task_id、失敗不蓋結果）、`src/lib/__tests__/agent-task-label.test.ts`；e2e `e2e/v072-pre6-claude-panel.spec.ts` ⑦b（假 API：主回合結束後 bar 1 項含「背景」標籤、子代理結束後 0 項並標 `[completed] …`；第 2 個背景子代理從 bar 停止 → `[stopped by user] …`；前景 ⑦ 照舊）。修正前的 `claude-agent-manager.ts` 在 ⑦b「主回合結束後 bar 1 項」失敗（實得 0）。

## Claude 面板額外的模型請求（T0733 / T0734，D199）

Claude 面板在 `queryOptions`（`electron/claude-agent-manager.ts`）開了兩個 SDK 選項，除了你送出的訊息之外，還會多送幾個模型請求。兩者都計入 token 用量（訂閱帳號計入用量限制）。D199：兩項都維持開啟，這裡記下用途、成本與關閉方式。

數字來源標記：**實測** = SDK 0.3.316 驅動內嵌 CLI 2.1.316 打本機假 Anthropic API（不連 api.anthropic.com、不耗 token；T0733 / T0734 原型）；**原始碼** = 讀 CLI 2.1.316 二進位內的 JS；**估算** = 依實測大小推算真實帳號，不是帳單數字。

### 1. 下一步建議（prompt suggestion，`promptSuggestions: true`）

- **用途**：猜你下一句可能要打什麼，顯示成輸入框上方的「建議」晶片；輸入框是空的時候按 Tab 會填入（`claude:prompt-suggestion` IPC → `ClaudeAgentPanel.tsx`）。
- **什麼時候送**（實測 + 原始碼）：每個 turn 的 `result` 之後送 1 個，一個 turn 內有多個工具回合也只送 1 個。以下情況不送：
  - 對話裡的 assistant 回覆少於 2 則（所以第 1 個 turn 通常不送）；
  - plan mode；
  - 上一次回應是 API 錯誤；
  - 有待回答的權限詢問；
  - 帳號用量接近或到達限制；
  - cache 沒熱（上一次回應的未快取 input + output，或再加上 cache write，超過 10,000 tokens）。
- **請求內容**（實測）：把主對話 fork 一次，`model`、system、tools、`thinking`、`effort` 都和主請求相同，最後多一則約 1.4 KB 的 `[SUGGESTION MODE…]` 提示。
- **成本**（估算）：
  - input 約等於整段對話 context（真實 session 估 30k–150k+ tokens），因為只在 cache 熱的時候送，大部分是 cache read（約 0.1 倍價），換算約 3k–15k 個一般 input token；
  - 未快取部分約 300–400 tokens；
  - output 是 2–12 個字，另加 adaptive thinking，thinking 數量量不到；
  - 大約讓每個 turn 的 cache read 多一倍。
- **面板比 Claude CLI 終端少的節流**（原始碼）：終端版另有 GrowthBook 旗標（服務端逐帳號開放）、連續不採用時降頻（每 10 個 turn 才產生 1 次）、終端沒有焦點時不產生。面板經 SDK 選項直接開啟，這三個都不適用，所以面板分頁不在畫面上時也照樣產生。
- **使用者自己關閉**（三種都實測為 0 個額外請求，不必改 BAT）：
  - `~/.claude/settings.json` 寫 `"promptSuggestionEnabled": false`（面板的 `settingSources` 含 `user`，所以會讀到）；
  - 或在啟動 BAT 的環境設 `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false`（env 優先於 setting）；
  - 開發者：把 `queryOptions.promptSuggestions` 改成 `false`。
  - 關掉之後面板就沒有建議晶片，Tab 也不會填入；其他功能不受影響。

### 2. 子代理進度摘要（`agentProgressSummaries: true`）

- **用途**：子代理（`Agent` 工具）執行期間，大約每 30 秒產生一句 3–5 個字的英文進行式描述，例如 `Reading runAgent.ts`。SDK 以 `task_progress` 訊息送出，`summary` 欄位放這句話，`description` 欄位也放同一句。
- **BAT 怎麼顯示**（原始碼）：
  - `processMessage`（`task_progress` 分支）寫進 Agent 工具卡片的 `description`；
  - 會加上最後一個工具名，例如 `Reading notes.txt [Glob]`；
  - 經 `claude:tool-result` IPC 顯示在 `ClaudeAgentPanel.tsx` 時間軸 Agent 卡片的進度列（`.claude-task-progress-text`），以及上方執行中工作列（`.claude-active-task-progress`）。
  - 子代理下一次呼叫工具時，這一行會被 CLI 自己的工具標籤蓋掉（例如 `Glob: step1*.txt` 或 `Finding step1*.txt [Glob]`），所以摘要只在兩次工具呼叫之間看得到。
- **頻率**（實測 + 原始碼）：
  - 子代理啟動 30 秒後第一次，之後在上一次摘要完成 30 秒後再一次；
  - 子代理的對話少於 3 則、或和上次相比沒有變化（例如卡在一個很長的指令上）就跳過；
  - 前景與背景子代理都會產生；同時跑多個子代理時各自計時。
  - 實測：一個跑 72 秒的子代理，在第 30.6 秒與第 60.6 秒各送 1 次（前景、背景結果相同）。
- **請求內容**（實測）：
  - 把子代理自己的對話 fork 一次：`model`、system、tools（12 個）、`max_tokens` 128000、`thinking`（adaptive，display omitted）、`effort` 都和子代理的請求相同，只在最後一則 user 訊息加上約 0.6 KB 的「Describe your most recent action in 3-5 words…」提示（第二次起附上一句摘要，要求說新的）；
  - CLI 以拒絕所有工具、只跑 1 回合的方式送出；
  - `cache_control` 標在倒數第二則訊息上：讀子代理已寫入的快取，不寫入新快取（原始碼 `skipCacheWrite: true`）。
  - 最小環境（沒有 CLAUDE.md、plugins、MCP）下每次約 38 KB（約 9.5k tokens，以 4 B/token 估）。
- **成本**（估算）：每次摘要約等於「子代理再多跑一步」的 input：
  - 大部分是 cache read（子代理目前的整段 context，真實工作常見 20k–100k tokens，換算約 2k–10k 個一般 input token）；
  - 未快取部分 = 提示約 150 tokens + 子代理最近一次工具結果；
  - output 是幾個字，另加 adaptive thinking（沿用子代理的 `effort`），數量量不到；
  - 模型 = 子代理的模型（子代理沿用主模型時就是 Opus 等級）。
  - 例：一個連續工作 5 分鐘的子代理約產生 9 次摘要。
- **怎麼關閉**（實測）：**只有 SDK 選項有效**。
  - `queryOptions.agentProgressSummaries` 改成 `false`（或不傳）→ 0 次。
  - 使用者端目前沒有自己關的辦法：env `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=0` 無效，settings 沒有對應的鍵（試過 `agentProgressSummaries` / `agentProgressSummariesEnabled`，都無效）。
  - 反過來，選項為 `false` 時，BAT 主行程環境有 `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES=1` 仍會開啟。
  - 關掉之後少的只有這一句摘要：卡片進度列改成只顯示 CLI 自己的工具標籤；`task_progress` 照樣送（每次子代理呼叫工具時），「可能已停滯」判斷（60 秒沒有進度）、停止按鈕、子代理紀錄都不受影響。
- **Claude CLI 終端分頁**（原始碼，未以真實帳號實測）：
  - BAT 不額外開啟，行為和一般 `claude` 相同；
  - 互動式終端的前景子代理不產生摘要；
  - 背景子代理預設會產生，除非是非互動模式，或 fork-subagent 功能被關閉；CLI 2.1.316 的 `Agent` 預設背景執行，所以終端裡多數子代理也有摘要；
  - 終端版另受服務端旗標控制：可能改用小模型、不帶快取的精簡版請求，也可能在子代理的快取可能已冷時暫緩。

### 附註

- 查模型清單不再送模型請求：BUG-177 修正後，`getSupportedModels` 的 probe 不跑 turn（T0729，見本檔開頭「`idleSdkPrompt`」）。
- 第一個 turn 另有一個 0 tools 的會話標題請求（每個 session 一次）：只在沒設 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 時出現，和上面兩項無關（T0733 實測）。
- 升 SDK / CLI 時，選項名稱、頻率與提示字串可能改變；本節數字以 SDK 0.3.316 / CLI 2.1.316 為準。

# Claude Runtime Selection (PLAN-027, v2.1.49+)

BAT 預設使用**內嵌版** claude CLI（隨 BAT 打包，版本鎖在 `@anthropic-ai/claude-code ^2.1.316`）。若使用者想改用系統上自己安裝的 claude CLI（例如剛 release 的新版），可在 `Settings → Advanced → Claude Runtime` 切換。

**內嵌 binary 的位置**（`resolveEmbeddedClaudePath` / `embeddedClaudeCandidates`，`electron/claude-runtime-router.ts`）：Windows 打包版與 dev（node-modules）版面一律是 `@anthropic-ai/claude-code/bin/claude.exe`（BUG-052）；**mac / Linux 打包版**優先用 `app.asar.unpacked/node_modules/@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`，`bin/claude.exe` 為 fallback——electron-builder 對非 Windows 目標會排除 node_modules 內的 `.exe`（app-builder-lib `getNodeModuleExcludedExts`），打包後沒有 `bin/claude.exe`（BUG-118 / T0475）。musl 判定同 claude-code `install.cjs`（`process.report` 無 `glibcVersionRuntime`）。embedded 模式下解析出的檔案不存在時，`resolveClaudeRuntime()` 丟 `EmbeddedClaudeMissingError`（訊息列出找過的路徑，`logger.error` 同一組路徑只記一次），Agent 面板經 `claude:error` 顯示；system 模式要 fallback 時 embedded 也不在，則丟原本的 `SystemClaudeUnavailableError`（`detail` 附上缺的路徑，既有 degraded toast 照常顯示）。

**為什麼有兩個選項**
- **內嵌（embedded，預設）**：版本跟 BAT 發行綁定，穩定、可控、不受系統環境影響。適合大多數使用者。
- **系統（system）**：用系統 PATH 上的 claude，或使用者透過 `customPath` 指定的絕對路徑。適合想立即試用新 CLI 功能、不想等 BAT release 重打包的 power user。

**什麼時候該切 system**
- 上游剛 ship 新 model / effort 支援，BAT 尚未 bump SDK 版本
- 想用某個特定版本測試 / debug
- 其他時候建議用內嵌，減少環境變動面

**Fallback 行為**（`fallbackToEmbedded`，預設開啟）

當 system claude 符合下列任一條件時，自動退回 embedded，並觸發 toast 顯示 degraded reason：
- 偵測不到（PATH / customPath 找不到，或 spawn ENOENT）
- 健康檢查失敗（spawn error / version parse 失敗）
- 版本太舊（`< 2.0.0`）

關閉 fallback 時，偵測失敗會讓 Agent spawn 與 terminal claude-cli 啟動都失敗，適合嚴格要求只用 system 的場景。

**設定變更範圍（T0233 Worker 旗標）**

切換**只影響新開的 session 與新開的終端**。進行中的 Agent session 不受影響（transcript 仍在原 runtime 下）；既有 terminal 分頁要關掉重開才會套用新 preset。runtime router 讀設定的唯一入口是 `resolveClaudeRuntime()`（`electron/claude-runtime-router.ts`），由 agent-manager / auth-manager / terminal claude-cli preset 共享。

**跨平台安裝指引**（完整 playbook 見 `docs/plan-027-cross-platform-verification.md`）
- **macOS**：anthropic 官方 installer（`~/.local/bin/claude`）或 Homebrew（`/opt/homebrew/bin/claude`）
- **Linux**：anthropic 官方 installer（`~/.local/bin/claude`）
- **Windows**：anthropic 官方 installer 會放 `%USERPROFILE%\.local\bin\claude.exe`。`npm install -g` 產出的 `.cmd` / `.bat` shim **不被 router 偵測**（BUG-053 決策為 Node 20+ 不再支援 shim 探測，見 `docs/plan-027-cross-platform-verification.md`）

**常見故障**

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| 切 system 但 Agent 版本沒變 | 在現有 session 觀察 | 開新 session，設定只影響新 session |
| 切 system 後 terminal claude-cli 版本沒變 | 舊 terminal 分頁未重開 | 關掉 terminal 分頁重開 |
| Toast 顯示 `system-not-found` | PATH 上找不到 claude | 確認 installer 跑過，或在 UI 勾選 Use custom path 指定絕對路徑 |
| Toast 顯示 `system-too-old` | 版本 `< 2.0.0` | 升級 claude CLI |
| Toast 顯示 `version-warning` | 版本 `>= 2.0.0` 但 `< 2.1.280`（`HEALTHY_MIN`，`electron/claude-resolver.ts`；T0372 前為 `2.1.111`） | SDK 可載入，但較新模型（Opus 5.5 等）會被服務端拒絕，建議升級到 `2.1.280+` |
| 選 Claude 5 模型回 `API Error: 400 ... claude_code_version_too_old`，訊息後附「Claude Code X 太舊」提示 | 實際執行的 CLI 低於該模型門檻（Opus 5.5 `2.1.280`、Fable 5.1 `2.1.251`）：embedded 為舊版 BAT，或 system claude 過舊 | embedded：升級 BAT；或切 `Settings → Advanced → Claude Runtime` → system 並升級系統 claude（`claude update` / 重跑 installer） |

# Embedded claude auto-update 停用（BUG-059）

BAT 對 embedded 與 system 兩種 runtime 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`：

- **Embedded**：必須關，否則 claude CLI 會把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`，再 `npm install -g` 到使用者 npm prefix（不在 BAT 路徑），導致 BAT 下次 spawn 找不到 binary（BUG-059 / BUG-055 同根因）
- **System**：native installer 已自我關閉 auto-update（`autoUpdatesProtectedForNative: true`），疊加 env flag 無副作用；npm-global system 安裝同樣受益於此 flag
- 使用者要更新 embedded：等 BAT release 重打包；要更新 system：手動 `claude update` 或重跑 installer（embedded claude-cli 分頁內不行，見下）

注入點：`electron/pty-manager.ts` 三處 `envWithUtf8`（terminal 子行程） + `electron/claude-agent-manager.ts` constructor（Agent SDK 子行程繼承 `process.env`）。

**`DISABLE_UPDATES=1`（只給 embedded，T0372）**：CLI 2.1.289 新增的 `DISABLE_UPDATES` 比 `DISABLE_AUTOUPDATER` 更強——連手動 `claude update` / upgrade 都拒絕（`Updates are disabled by your administrator...`；2.1.296 / 2.1.300 / 2.1.306 / 2.1.316 實測仍拒絕，判斷順序仍是 `DISABLE_UPDATES` → `DISABLE_AUTOUPDATER`，T0483 / T0541 / T0690 / T0717）。`DISABLE_AUTOUPDATER` 只關背景更新，使用者在 embedded claude 裡手動更新仍可能重演 BUG-059，因此 embedded 額外注入；**system runtime 絕不注入**（使用者需能自行更新）。決策集中在 `claudeUpdateGuardEnv(source)`（`electron/claude-resolver.ts`，`source !== 'system'` 才回 `{ DISABLE_UPDATES: '1' }`）：
- **Agent SDK**：`claude-agent-manager.ts` 的 `sdkSpawnEnv(resolvedRuntime)` 依 runtime router 解析結果決定，套在 `runQuery` / `forkSession` / `getSupportedModels` 三個 spawn 點（V2 session 路徑 T0718 移除）；`embedded` 與 `system-fallback-to-embedded` 都注入。SDK 0.2.113 起 `options.env` **取代**而非合併 `process.env`，故以 `{ ...process.env, DISABLE_UPDATES: '1' }` 組；system 不傳 `options.env`，維持繼承 `process.env`。**不可**比照 `DISABLE_AUTOUPDATER` 寫進全域 `process.env`（會波及 system）。
- **Terminal claude-cli preset**：`pty-manager.ts` 僅在 `agentPreset` 為 `claude-cli` / `claude-cli-worktree` 且持久化設定 `claudeRuntime.mode === 'embedded'` 時注入（`claudeCliUpdateGuardEnv()`）。PTY 是 shell，env 作用於整個分頁：在 embedded claude-cli 分頁內另外對 PATH 上的 system claude 執行 `claude update` 也會被拒，請改用一般 terminal 分頁。已知缺口：system 模式且 fallback 到 embedded 的 claude-cli 分頁不注入（fallback 為非同步偵測，`pty.create` 時拿不到），該情境仍有 `DISABLE_AUTOUPDATER` 擋背景更新；helper 派工（`terminal:create-agent-command`，本機與 headless）建立的分頁自 BUG-155 / T0639 起帶解析出的 agent（`claude-cli` 等），同樣依 runtime 注入（T0639 前不帶、不注入）；raw command 模式（`terminal:create-with-command`）仍不帶 `agentPreset`、不注入。`pty:restart` 與 Terminal Server recovery 重建的分頁自 T0525 起沿用原 `agentPreset`。

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。
