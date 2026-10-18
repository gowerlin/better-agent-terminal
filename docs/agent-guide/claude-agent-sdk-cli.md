# Claude Agent SDK / CLI

> 從 CLAUDE.md「Claude Agent SDK / CLI」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

- `@anthropic-ai/claude-agent-sdk` `^0.2.111`（npm 實際安裝 `0.2.113`）、`@anthropic-ai/claude-code` `^2.1.300`（實裝 `2.1.300`）。2026-10-15 T0541 追版 CLI（`^2.1.296` → `^2.1.300`，含 8 個 `@anthropic-ai/claude-code-*` 平台子套件；模型清單、effort、計價皆無變動）；2026-10-13 T0483 追版 CLI（`^2.1.289` → `^2.1.296`，含 8 個平台子套件）；2026-10-04 T0371 只升 CLI（原 `^2.1.111` / 實裝 `2.1.113`，T0165 C1.1），SDK 刻意留在 0.2 線（0.3 移除 V2 session API，見 T0368 第 2 節；Phase 2 另案，D123）。CLI 2.1.289 提供 **Claude 5 系列**（`claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`）支援；2.1.293 新增 `claude-haiku-5-5`（CLI 的 `haiku` alias 改指向它）。
- 🔴 **服務端以 CLI 版本擋新模型**：CLI 太舊時 API 回 `400` + `error_code: "claude_code_version_too_old"`（原文例：`Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required`）。目前門檻：Opus 5.5 需 `>= 2.1.280`、Fable 5.1 需 `>= 2.1.251`（T0368 實測；門檻由服務端逐模型設定，隨時可能擴及其他模型）。⇒ **內嵌 CLI 落後即功能故障**，每次預覽版發布前應 `npm view @anthropic-ai/claude-code version` 追版。Claude 面板以 `src/lib/claude-error-classify.ts`（`classifyClaudeError`）辨識此錯誤，在原訊息後附 i18n 提示（`claude.claudeErrorHintCliTooOld*`：升級 BAT，或切 system runtime 並升級系統 claude），`claude:error` IPC 簽章不變（T0372）。
- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）已前插 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5` / `claude-haiku-5-5`（Haiku 5.5 為 T0483 加入；`claude-haiku-4-5-20251001` 保留）。5 系列原生 1M context，**不再加 `[1m]` 變體**（CLI 2.1.289 / 2.1.296 / 2.1.300 的模型清單也不列 `[1m]` 行）；既有 `claude-opus-4-7[1m]` / `-4-6[1m]` / `claude-sonnet-4-6[1m]` 保留（legacy 未退役）。`getSupportedModels()` 的 SDK 補充清單以 runtime router 解出的 CLI 取得，SDK alias（`opus` / `fable` / `sonnet` / `haiku`）若其 `resolvedModel` 已是 builtin 即略過（`default` 保留，因它跟隨帳號預設）；取完清單即 `close()` 該 probe 子行程（T0372）。`setModel()` 切換模型後、下一次 `modelUsage` 回報前，顯示的 context window / max output 取自 `estimateModelLimits()`（`electron/claude-agent-manager.ts` `MODEL_LIMITS`，T0484）：Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Haiku 5.5 為 1M / 128K（官方 models overview，2026-10-13）；其餘 ID（含 legacy 與 alias）沿用舊推估（`[1m]` → 1M 否則 200K；含 `haiku` → 8192 否則 64000）。新增 5 系列模型時同步補此表與 `electron/__tests__/claude-model-limits-and-call-usage.test.ts`。
- 計價表集中於 `src/lib/model-pricing.ts`（`P()` / `MODEL_PRICING` / `getModelPricing()`），Claude 與 Codex 面板的 Cache History 成本皆引用此模組（T0374，原為兩份內嵌複本）。已收錄 5 系列（`opus-5-5` / `fable-5-1` / `sonnet-5-5` / `haiku-5-5` 及 legacy `opus-5` / `opus-4-8` / `sonnet-5` / `fable-5`，價格只取自官方價目頁：T0368 第 4 節，T0483 於 2026-10-13 重讀補 Haiku 5.5 與 Sonnet 5.5 cache read 調降）。`P(input, output, { cacheReadMultiplier })` 預設 0.1x，Opus 5.5 與 Sonnet 5.5 為 **0.05x**、Fable 5.1 為 **0.025x**。Haiku 5.5 依 prompt 長度分段計價（prompt 含 cache read / write 的全部 input tokens 超過 100,000 時改用 `haiku-5-5-long`，5 倍價）：`getModelPricing(model, { promptTokens })` 支援分段。Claude 面板的 Cache History 自 T0484 起經 `estimateCallCost()` / `estimateModelUsageCost()`（同模組，運算順序與舊面板相同，價格不分段的模型結果逐位元不變）計價：單次呼叫列以該列 prompt 長度選價；R 列的 `modelUsage` 是跨呼叫加總，主行程依 API message id 追蹤每次呼叫（`stream_event` 的 `message_start` / `message_delta` + `assistant` 訊息 usage，sub-agent 一併記錄），result 時把 prompt > 100,000 的呼叫加總寫入 `modelUsage[model].longPrompt`（含在總量內），renderer 對這部分用 long 價、其餘用基本價。漏追的呼叫（CLI 背景呼叫等）仍以 ≤100K 價計，只會低估。Codex 面板只計 OpenAI 模型（皆回 `null`），未接線。`getModelPricing()` 以 `includes` 比對，**point release 必須排在 base model 之前**（`opus-5-5` 先於 `opus-5`、`fable-5-1` 先於 `fable-5`）；新增模型時同步補 `src/lib/__tests__/model-pricing.test.ts`。未命中的 ID（含 OpenAI / Codex 模型）回 `null`，成本顯示 `—`。
- Cache History 的列與總計邏輯在 `src/lib/cache-history.ts`（T0498）。主行程在主 agent 的串流 `claude:status` 帶 `lastCall`（該次 API 呼叫的 id / model / query 編號 / token，取自 per-call tracker）；query 開始與 result 時為 `null`（`null` 代表新版 server，欄位不存在代表舊版，renderer 走舊邏輯）。單次呼叫列一呼叫一列，以自己的 token 計價。R 列為 SDK `modelUsage`，含同 query 所有呼叫（含 sub-agent），**總計不重複加同 query 的單次呼叫列**，只加沒有 result 的 query 與進行中 query 的列。V1 / V2 開始 query 時都經 `resetQueryUsage()` 清 `modelUsage` / `lastCall` / tracker（T0498 前 V2 不清，上一 result 會被當成新的 R 列重複加總）。
- `EFFORT_LEVELS = ['low','medium','high','max','xhigh']` + `EffortLevel` type 集中宣告於 `src/types/index.ts`。新增 effort 成員時只改 const，其他檔案自動套用。
- Settings 的 effort dropdown 包含完整 5 級，不再標示「(Opus only)」（T0374 移除：CLI 2.1.289 對 Sonnet 5.5 / Fable 5.1 / Opus 5.5 的 `supportedEffortLevels` 皆含 `max` 與 `xhigh`，T0368；CLI 2.1.296 的 Haiku 5.5 同為 5 級，T0483；2.1.300 五個 alias 皆不變，T0541）。`xhigh` 需 CLI `>= 2.1.111`。

# Claude Runtime Selection (PLAN-027, v2.1.49+)

BAT 預設使用**內嵌版** claude CLI（隨 BAT 打包，版本鎖在 `@anthropic-ai/claude-code ^2.1.300`）。若使用者想改用系統上自己安裝的 claude CLI（例如剛 release 的新版），可在 `Settings → Advanced → Claude Runtime` 切換。

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

**`DISABLE_UPDATES=1`（只給 embedded，T0372）**：CLI 2.1.289 新增的 `DISABLE_UPDATES` 比 `DISABLE_AUTOUPDATER` 更強——連手動 `claude update` / upgrade 都拒絕（`Updates are disabled by your administrator...`；2.1.296 / 2.1.300 實測仍拒絕，判斷順序仍是 `DISABLE_UPDATES` → `DISABLE_AUTOUPDATER`，T0483 / T0541）。`DISABLE_AUTOUPDATER` 只關背景更新，使用者在 embedded claude 裡手動更新仍可能重演 BUG-059，因此 embedded 額外注入；**system runtime 絕不注入**（使用者需能自行更新）。決策集中在 `claudeUpdateGuardEnv(source)`（`electron/claude-resolver.ts`，`source !== 'system'` 才回 `{ DISABLE_UPDATES: '1' }`）：
- **Agent SDK**：`claude-agent-manager.ts` 的 `sdkSpawnEnv(resolvedRuntime)` 依 runtime router 解析結果決定，套在 `runQuery` / V2 session / `forkSession` / `getSupportedModels` 四個 spawn 點；`embedded` 與 `system-fallback-to-embedded` 都注入。SDK 0.2.113 起 `options.env` **取代**而非合併 `process.env`，故以 `{ ...process.env, DISABLE_UPDATES: '1' }` 組；system 不傳 `options.env`，維持繼承 `process.env`。**不可**比照 `DISABLE_AUTOUPDATER` 寫進全域 `process.env`（會波及 system）。
- **Terminal claude-cli preset**：`pty-manager.ts` 僅在 `agentPreset` 為 `claude-cli` / `claude-cli-worktree` 且持久化設定 `claudeRuntime.mode === 'embedded'` 時注入（`claudeCliUpdateGuardEnv()`）。PTY 是 shell，env 作用於整個分頁：在 embedded claude-cli 分頁內另外對 PATH 上的 system claude 執行 `claude update` 也會被拒，請改用一般 terminal 分頁。已知缺口：system 模式且 fallback 到 embedded 的 claude-cli 分頁不注入（fallback 為非同步偵測，`pty.create` 時拿不到），該情境仍有 `DISABLE_AUTOUPDATER` 擋背景更新；helper 派工（`terminal:create-agent-command`，本機與 headless）建立的分頁自 BUG-155 / T0639 起帶解析出的 agent（`claude-cli` 等），同樣依 runtime 注入（T0639 前不帶、不注入）；raw command 模式（`terminal:create-with-command`）仍不帶 `agentPreset`、不注入。`pty:restart` 與 Terminal Server recovery 重建的分頁自 T0525 起沿用原 `agentPreset`。

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。
