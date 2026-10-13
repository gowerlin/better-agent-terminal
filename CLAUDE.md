# CLAUDE.md - Project Guidelines

## No Regressions Policy

- **NEVER** break existing features when implementing new ones.
- Before committing, verify ALL existing features still work — not just the new changes.
- Run the build (`npx vite build`) to confirm compilation succeeds.
- When modifying shared code (stores, IPC handlers, types), trace all consumers to ensure nothing breaks.

## Frontend unit tests

- 框架：vitest + jsdom + React Testing Library + jest-dom（T0307b 引入）
- 執行：`npm run test:unit`（一次跑完）/ `npm run test:unit:watch`（watch mode）/ `npm run test:unit:ui`（UI mode）
- 測試檔位置：`src/**/*.test.{ts,tsx}` 或 `src/**/__tests__/**/*.{ts,tsx}`
- 設定：`vite.config.ts` 內的 `test` 區塊；setup 檔 `vitest.setup.ts`（auto-import jest-dom matchers）
- e2e（playwright）獨立：`npm run test:e2e`，不與 unit test 混跑

## Logging

- **Frontend (renderer)**: Use `window.electronAPI.debug.log(...)` instead of `console.log()`. This sends logs to the electron main process logger, which writes to disk.
- **Backend (electron)**: Use `logger.log(...)` / `logger.error(...)` from `./logger`.
- Do NOT use `console.log()` for debugging — use the logger so logs are persisted and visible in the log file.
- **Log file location**: `<appData>/BetterAgentTerminal/Logs/debug-<YYYYMMDD-HHMMSS>.log`（每次啟動一檔，保留最近 10 個；`electron/logger.ts`）。`<appData>`：Windows `%APPDATA%`、macOS `~/Library/Application Support`、Linux `~/.config`。磁碟日誌**預設開啟**（Settings → Advanced → Debug Logging 可關 / 調等級），與 `BAT_DEBUG` 無關（`BAT_DEBUG` 只控制 `isDebugMode` 的 debug UI，`electron/preload.ts`）。userData 根部若有舊版留下的 `debug.log`，啟動時搬到 `Logs/debug-legacy-<stamp>.log`。
- **單一 userData 目錄**（BUG-119，T0480 起）：`settings.json` / `windows.json` / `profiles/` / `Local State` / `snippets.json` / `message-archives/` / `Logs/` / `Crashes/` 全在 `<appData>/BetterAgentTerminal[-runtime-<N>]/`（`--runtime=<N>` / `BAT_RUNTIME=<N>` 實例為 `BetterAgentTerminal-runtime-<N>`）。T0480 前 `snippet-db` 單例在 import 期呼叫 `app.getPath('userData')`，Chromium PathService 把 userData 快取成 `package.json` `name`（`better-agent-terminal`），日誌 / snippets / `Local State` 因此落在小寫目錄。現由 `electron/app-paths-bootstrap.ts` 依序 `setName` → 解析 runtime id → app ready 前同步 migration（`electron/userdata-migration.ts`）→ 顯式 `app.setPath('userData', ...)`；`main.ts` 在 `setPath('crashDumps')` 後自檢 userData 未漂移（不符即 `logger.error`）。**開發規則**：① `app-paths-bootstrap` 必須維持 `main.ts` 的**第一個** import（rollup 把被 import 模組的主體排在 `main.ts` 主體之前），且它只 import `electron` / `path` / `./userdata-migration`；② 任何模組**不得在 import 期**呼叫 `app.getPath('userData')`（含模組層級單例的建構子），一律在函式內 lazy 取值（範本：`snippet-db.ts` 的 `dataPath` getter）。`electron/__tests__/app-paths-bootstrap-order.test.ts` 靜態守住 ①。**舊目錄**：升版首次啟動複製 `Local State`（缺才複製）、複製 / 合併 `snippets.json`、單檔移動 `message-archives/*.jsonl`，`Logs/` / `Crashes/` 不搬；runtime 實例整個目錄改名（terminal server 仍在執行或 rename 失敗時本次沿用舊目錄）；完成寫 marker `.userdata-migration.json`（只跑一次）。舊 `<appData>/better-agent-terminal[-runtime-<N>]/` 一律保留不刪（降版安全，舊日誌在那裡）；結果在 `logger.init` 後以 `[userdata-migration]` 寫入日誌。
- **Helper scripts 的 userData**（T0481）：本機 PTY（Terminal Server `pty:create`、node-pty、child_process fallback 三條路徑，`electron/pty-manager.ts` `localHelperEnv()`）注入 `BAT_USER_DATA` = `app.getPath('userData')`，覆蓋繼承值與 `customEnv`；只在 host 提供 `helperDir` 時注入（headless PTY 不注入）。`scripts/_bat-cert.mjs` / `scripts/_bat-logger.mjs` 解析順序：① 明確 override（`BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR`，headless bat-server 設定）→ ② `BAT_USER_DATA`（須為絕對路徑，相對路徑忽略）→ ③ 舊推測 `BetterAgentTerminal` + `BAT_RUNTIME`（T0481 前的 BAT 或 BAT 外執行）。`--runtime=<N>` 啟動的實例 PTY 沒有 `BAT_RUNTIME`，靠 ② 找到該實例自己的 `server-cert.json` 與 `Logs/bat-scripts.log`。

## Child Process Spawning

新增涉及 child_process 的程式碼（特別是 IPC handler / wizard step / shell 互動）：

- ✅ 用 `execFile` 或 `spawn` + array args（既有 `electron/docker-detect.ts` / `electron/claude-resolver.ts` 為範本）
- ❌ 禁用 `child_process.exec` 模板字串呼叫（shell injection 風險；`execSync` 僅限 hardcoded 命令無 user input 的場景，如 `electron/codex-agent-manager.ts`）
- 任何外部輸入（distro / container name / profileId / path）使用前必過 regex `/^[a-zA-Z0-9._-]+$/` 白名單
- timeout 必設（建議 5s for 同步 detect / 30s for IO 操作）
- 注意：security hook 提示的 `src/utils/execFileNoThrow.ts` 在本專案**不存在**（hook 是泛用建議），沿用 Node 內建 `child_process.execFile` 即可

## Sub-agent / Active Tasks Tracking

- The Claude Agent SDK does **NOT** reliably emit `task_started` / `task_progress` / `task_notification` system messages.
- We track Agent/Task tools from `tool_use` blocks directly in `session.activeTasks` (in `claude-agent-manager.ts`).
- `stopTask()` falls back to using `toolUseId` as `task_id` when no mapping exists.
- Tool results for Agent/Task must clean up `activeTasks` entries.

## React Rendering

- Use `flushSync` from `react-dom` for Agent/Task tool state changes (`setMessages` in `onToolUse` and `onToolResult`) to prevent rendering delays from React 18 batching during streaming.
- Do NOT use `flushSync` for regular tool calls — only for state changes that affect the active tasks bar visibility.

## Status Line

- Our status line implementation is superior to external alternatives (e.g., ccstatusline). Do not replace it.
- 13 configurable items with custom colors, zone alignment, and template-based config.
- Usage polling: Chrome session key (primary, lenient rate limits) → OAuth fallback (strict rate limits).

## Claude Agent SDK / CLI

- `@anthropic-ai/claude-agent-sdk` `^0.2.111`（npm 實際安裝 `0.2.113`）、`@anthropic-ai/claude-code` `^2.1.296`（實裝 `2.1.296`）。2026-10-13 T0483 追版 CLI（`^2.1.289` → `^2.1.296`，含 8 個 `@anthropic-ai/claude-code-*` 平台子套件）；2026-10-04 T0371 只升 CLI（原 `^2.1.111` / 實裝 `2.1.113`，T0165 C1.1），SDK 刻意留在 0.2 線（0.3 移除 V2 session API，見 T0368 第 2 節；Phase 2 另案，D123）。CLI 2.1.289 提供 **Claude 5 系列**（`claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5`）支援；2.1.293 新增 `claude-haiku-5-5`（CLI 的 `haiku` alias 改指向它）。
- 🔴 **服務端以 CLI 版本擋新模型**：CLI 太舊時 API 回 `400` + `error_code: "claude_code_version_too_old"`（原文例：`Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required`）。目前門檻：Opus 5.5 需 `>= 2.1.280`、Fable 5.1 需 `>= 2.1.251`（T0368 實測；門檻由服務端逐模型設定，隨時可能擴及其他模型）。⇒ **內嵌 CLI 落後即功能故障**，每次預覽版發布前應 `npm view @anthropic-ai/claude-code version` 追版。Claude 面板以 `src/lib/claude-error-classify.ts`（`classifyClaudeError`）辨識此錯誤，在原訊息後附 i18n 提示（`claude.claudeErrorHintCliTooOld*`：升級 BAT，或切 system runtime 並升級系統 claude），`claude:error` IPC 簽章不變（T0372）。
- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）已前插 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5` / `claude-haiku-5-5`（Haiku 5.5 為 T0483 加入；`claude-haiku-4-5-20251001` 保留）。5 系列原生 1M context，**不再加 `[1m]` 變體**（CLI 2.1.289 / 2.1.296 的模型清單也不列 `[1m]` 行）；既有 `claude-opus-4-7[1m]` / `-4-6[1m]` / `claude-sonnet-4-6[1m]` 保留（legacy 未退役）。`getSupportedModels()` 的 SDK 補充清單以 runtime router 解出的 CLI 取得，SDK alias（`opus` / `fable` / `sonnet` / `haiku`）若其 `resolvedModel` 已是 builtin 即略過（`default` 保留，因它跟隨帳號預設）；取完清單即 `close()` 該 probe 子行程（T0372）。
- 計價表集中於 `src/lib/model-pricing.ts`（`P()` / `MODEL_PRICING` / `getModelPricing()`），Claude 與 Codex 面板的 Cache History 成本皆引用此模組（T0374，原為兩份內嵌複本）。已收錄 5 系列（`opus-5-5` / `fable-5-1` / `sonnet-5-5` / `haiku-5-5` 及 legacy `opus-5` / `opus-4-8` / `sonnet-5` / `fable-5`，價格只取自官方價目頁：T0368 第 4 節，T0483 於 2026-10-13 重讀補 Haiku 5.5 與 Sonnet 5.5 cache read 調降）。`P(input, output, { cacheReadMultiplier })` 預設 0.1x，Opus 5.5 與 Sonnet 5.5 為 **0.05x**、Fable 5.1 為 **0.025x**。Haiku 5.5 依 prompt 長度分段計價（prompt 含 cache read / write 的全部 input tokens 超過 100,000 時改用 `haiku-5-5-long`，5 倍價）：`getModelPricing(model, { promptTokens })` 支援分段，但 Claude / Codex 面板目前未傳 `promptTokens`，一律以 ≤100K 價格計（長 prompt 會低估）。`getModelPricing()` 以 `includes` 比對，**point release 必須排在 base model 之前**（`opus-5-5` 先於 `opus-5`、`fable-5-1` 先於 `fable-5`）；新增模型時同步補 `src/lib/__tests__/model-pricing.test.ts`。未命中的 ID（含 OpenAI / Codex 模型）回 `null`，成本顯示 `—`。
- `EFFORT_LEVELS = ['low','medium','high','max','xhigh']` + `EffortLevel` type 集中宣告於 `src/types/index.ts`。新增 effort 成員時只改 const，其他檔案自動套用。
- Settings 的 effort dropdown 包含完整 5 級，不再標示「(Opus only)」（T0374 移除：CLI 2.1.289 對 Sonnet 5.5 / Fable 5.1 / Opus 5.5 的 `supportedEffortLevels` 皆含 `max` 與 `xhigh`，T0368；CLI 2.1.296 的 Haiku 5.5 同為 5 級，T0483）。`xhigh` 需 CLI `>= 2.1.111`。

### Claude Runtime Selection (PLAN-027, v2.1.49+)

BAT 預設使用**內嵌版** claude CLI（隨 BAT 打包，版本鎖在 `@anthropic-ai/claude-code ^2.1.296`）。若使用者想改用系統上自己安裝的 claude CLI（例如剛 release 的新版），可在 `Settings → Advanced → Claude Runtime` 切換。

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

### Embedded claude auto-update 停用（BUG-059）

BAT 對 embedded 與 system 兩種 runtime 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`：

- **Embedded**：必須關，否則 claude CLI 會把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`，再 `npm install -g` 到使用者 npm prefix（不在 BAT 路徑），導致 BAT 下次 spawn 找不到 binary（BUG-059 / BUG-055 同根因）
- **System**：native installer 已自我關閉 auto-update（`autoUpdatesProtectedForNative: true`），疊加 env flag 無副作用；npm-global system 安裝同樣受益於此 flag
- 使用者要更新 embedded：等 BAT release 重打包；要更新 system：手動 `claude update` 或重跑 installer（embedded claude-cli 分頁內不行，見下）

注入點：`electron/pty-manager.ts` 三處 `envWithUtf8`（terminal 子行程） + `electron/claude-agent-manager.ts` constructor（Agent SDK 子行程繼承 `process.env`）。

**`DISABLE_UPDATES=1`（只給 embedded，T0372）**：CLI 2.1.289 新增的 `DISABLE_UPDATES` 比 `DISABLE_AUTOUPDATER` 更強——連手動 `claude update` / upgrade 都拒絕（`Updates are disabled by your administrator...`；2.1.296 實測仍拒絕，判斷順序仍是 `DISABLE_UPDATES` → `DISABLE_AUTOUPDATER`，T0483）。`DISABLE_AUTOUPDATER` 只關背景更新，使用者在 embedded claude 裡手動更新仍可能重演 BUG-059，因此 embedded 額外注入；**system runtime 絕不注入**（使用者需能自行更新）。決策集中在 `claudeUpdateGuardEnv(source)`（`electron/claude-resolver.ts`，`source !== 'system'` 才回 `{ DISABLE_UPDATES: '1' }`）：
- **Agent SDK**：`claude-agent-manager.ts` 的 `sdkSpawnEnv(resolvedRuntime)` 依 runtime router 解析結果決定，套在 `runQuery` / V2 session / `forkSession` / `getSupportedModels` 四個 spawn 點；`embedded` 與 `system-fallback-to-embedded` 都注入。SDK 0.2.113 起 `options.env` **取代**而非合併 `process.env`，故以 `{ ...process.env, DISABLE_UPDATES: '1' }` 組；system 不傳 `options.env`，維持繼承 `process.env`。**不可**比照 `DISABLE_AUTOUPDATER` 寫進全域 `process.env`（會波及 system）。
- **Terminal claude-cli preset**：`pty-manager.ts` 僅在 `agentPreset` 為 `claude-cli` / `claude-cli-worktree` 且持久化設定 `claudeRuntime.mode === 'embedded'` 時注入（`claudeCliUpdateGuardEnv()`）。PTY 是 shell，env 作用於整個分頁：在 embedded claude-cli 分頁內另外對 PATH 上的 system claude 執行 `claude update` 也會被拒，請改用一般 terminal 分頁。已知缺口：system 模式且 fallback 到 embedded 的 claude-cli 分頁不注入（fallback 為非同步偵測，`pty.create` 時拿不到），該情境仍有 `DISABLE_AUTOUPDATER` 擋背景更新；remote `terminal:create-agent-command` 建立的分頁與 `pty:restart` 重建的分頁不帶 `agentPreset`，同樣不注入。

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。

## Electron Runtime

- 本專案使用 Electron 41.x（Node 24、Chromium M146）；於 PLAN-016 Phase 2 從 Electron 28.3.3 升級（EXP-ELECTRON41-001 CONCLUDED）。
- native modules 依 ABI 145 建置。`package.json` 的 `postinstall` 在非 CI 環境跑 `electron-rebuild -f -w better-sqlite3`（repo 既有的 `@electron/rebuild`，經 electron-builder 間接安裝，非直接 devDependency），產出 Electron ABI 145；環境變數 `CI` 有值時跳過，原因見下節「CI」（T0473）。若 app 啟動出現 `NODE_MODULE_VERSION mismatch`（例如 shell 裡殘留 `CI`，或用 `--ignore-scripts` 安裝），執行 `npx electron-rebuild -f -w better-sqlite3`。**不要**用 `npm rebuild better-sqlite3`：它重跑 better-sqlite3 的 install script，`prebuild-install` 預設 `runtime=node`，下載的是 Node ABI 137 的 prebuilt，反而造成 mismatch（T0473 以 npm 11.19.0 實測：Electron ABI 的 binary 被覆蓋成 Node ABI）。
- BAT 內執行 `npm run dev` 需確認 `ELECTRON_RUN_AS_NODE` 未被污染（見 BUG-038 / T0161）。若 renderer 無法啟動且 log 出現 `ELECTRON_RUN_AS_NODE=1`，清除該環境變數後重試。
- electron-builder 26.x（2026-04-18 PLAN-005 / EXP-BUILDER26-001 CONCLUDED，原 24.13.3 → 26.8.1，清除 9 個 Group A CVE，見 PLAN-003 Group A）。

## 本機開發：npm 12 install scripts（T0471 / T0473）

- **背景**：npm 12（`npm -v` ≥ 12）預設擋**相依套件**的 install scripts，只放行 `package.json` `allowScripts` 列為 `true` 的套件。未放行時 `npm ci` / `npm install` 仍 exit 0，只在結尾印 `npm warn ... install scripts blocked because they are not covered by allowScripts`。T0471 時本 repo 沒有 `allowScripts`，結果 `electron` 無 `dist/`、`esbuild` 無原生 binary、`better-sqlite3` 無 `.node`、內嵌 claude 的 `bin/claude.exe` 是 500 bytes 的 stub（執行即 `Error: claude native binary not installed.`）。
- **`allowScripts`（T0473）**：放行 `better-sqlite3`、`electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code`，用不綁版本的 name-only entry（`"<pkg>": true`，等同 `npm install-scripts approve --no-allow-scripts-pin <pkg>`），升版不必重新 approve。本機 npm 12 跑 `npm ci` 後**不需任何手動補跑**：`node scripts/verify-native-modules.js` exit 0、內嵌 claude `--version` = `2.1.289 (Claude Code)`（T0483 追版後為 `2.1.296`）、better-sqlite3 在 Electron 下可開 `:memory:`。
- **`electron-winstaller` 刻意不列入**（不寫 `false`）：它只供 Squirrel.Windows target，本專案 `build.win.target` 為 `nsis` + `zip`，用不到。本機 npm 12 會擋它，`npm ci` 結尾與 `npm install-scripts ls` 會列出這一個套件，屬預期。不寫 `false` 是因為 npm 11.19.0（CI）也會遵守 `false` 而不跑它的 script（T0473 實測少了 `electron-winstaller/vendor/7z.dll`、`7z.exe`），CI 行為就變了；不列入時 npm 11 照跑，只多一行警告。
- **npm 11 也認得 `allowScripts`**：npm 11.19.0 對未列入的套件只警告、照跑；對 `false` 則跳過。T0473 以 `npx -y npm@11.19.0 ci`（`CI=true`）比對改動前後的 `package.json`，`node_modules` 內容完全相同（只有 `.package-lock.json` 換行不同）。
- **`allowScripts` 是政策**：新增帶 install script 的相依時，npm 12 會在 `npm ci` 結尾列出它。要放行（加 `true`）或拒絕（加 `false`）需塔台決策；不要用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts` 一次放行。
- **根 `postinstall`**：根專案自己的 lifecycle script 不受 `allowScripts` 管制。它在非 CI 環境直接以 `node node_modules/@electron/rebuild/lib/cli.js -f -w better-sqlite3` 重建 Electron ABI 145（不經 `npm rebuild`，所以也不經 allowScripts gate）；mac 的 `plutil` 段不變。T0473 前用的 `npm rebuild better-sqlite3` 已移除：npm 12 未放行時被擋成 no-op（T0471），放行後或在 npm 11 下則產出 Node ABI（見「Electron Runtime」）。
- **手動補跑**：只在用 `--ignore-scripts` 安裝、`allowScripts` 被改掉、或單一套件損壞時才需要（repo 根目錄執行）：

  | 套件 | install script | 手動補跑 |
  |---|---|---|
  | `electron` | `postinstall: node install.js` | `node node_modules/electron/install.js` |
  | `esbuild` | `postinstall: node install.js` | `node node_modules/esbuild/install.js` |
  | `sharp` | `install: node install/check.js \|\| npm run build` | `node node_modules/sharp/install/check.js` |
  | `better-sqlite3` | `install: prebuild-install \|\| node-gyp rebuild --release` | `npx electron-rebuild -f -w better-sqlite3`（建 Electron ABI 145；Node 下 `require` 失敗屬正常） |
  | `@anthropic-ai/claude-code` | `postinstall: node install.cjs` | `node node_modules/@anthropic-ai/claude-code/install.cjs`（把 `@anthropic-ai/claude-code-win32-x64` 的 binary 放到 `bin/claude.exe`）；驗證 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = `package.json` 鎖定的版本（T0483 起 `2.1.296 (Claude Code)`） |

- **本機打包**：`build.npmRebuild` 為 `false`，electron-builder 直接打包 `node_modules` 現況（`asarUnpack` 含 `@anthropic-ai/claude-code`）。`scripts/verify-native-modules.js` 自 T0472 起會擋內嵌 claude stub 與缺 better-sqlite3 `.node`，`node_modules` 不完整時 `npm run build` / `release.ps1` 在打包前就失敗。
- **CI**：workflow 用 `actions/setup-node` `node-version: '24'`，用 Node 隨附的 npm（Node 24.21.0 隨附 npm 11.19.0，nodejs.org `dist/index.json`），沒有升級 npm 的 step；本機的 npm 12 是另外全域升級的。GitHub Actions 會設 `CI=true`，postinstall 因此不跑 electron-rebuild：桌面 build job 隨後的 `npx --yes @electron/rebuild` 負責 Electron ABI（不重複 rebuild），server-bundle job 只跑 `npm ci`，better-sqlite3 維持 install script 產出的 Node ABI（bundle 以 Node 24 執行）。若 CI 改用 npm 12，`allowScripts` 已涵蓋所需套件。

## Build Toolchain

- Vite 7.x（2026-04-18 PLAN-003 Group B / T0163 升級，原 vite 5.4.21 → 7.3.2，清除 esbuild SSRF 與 vite path traversal 2 個 moderate CVE）。
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0（實裝 5.2.0）
  - `vite-plugin-electron` ^0.29.1（stable，官方宣告支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- `vite.config.ts` 目前未用 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式、`resolve.conditions` custom、Sass）；若日後新增構建設定請留意這些被移除的 API。
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）。相關研究見 T0162、決策見 D052/D053。

### electron-builder 26 migration notes

- **mac.notarize 格式變更**：v26 將 `mac.notarize` 從物件（`{ teamId }`）改為 boolean，認證資訊統一從環境變數讀取。目前 `package.json` 設為 `notarize: true`。
- **啟用 mac notarization 需設以下環境變數任一組合**（官方推薦組合 1）：
  1. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
  2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`（本專案 teamId = `8JVDJGLLYR`）
  3. `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`
- **CI workflow 注意**：`.github/workflows/pre-release.yml` 目前 mac job 未設 `APPLE_*` secrets，實際無 notarization（與升級前行為一致）。若要啟用，需補環境變數到 `Package for macOS` step。
- **Windows 打包驗收**：NSIS installer 產出約 172 MB、zip 約 230 MB；electron-builder 26 在 Windows 禁止跑 `--mac --dir`（v24 曾允許），但 schema parse 仍可通過。
- **mac 只打 arm64 dmg**（2026-10-13 D136，v0.6.0-pre.3 起；取代 D057 的雙 arch dmg）：`mac.target.arch = ["arm64"]`，產出 `BetterAgentTerminal-*-arm64.dmg`，**不支援 Intel Mac**。原因（BUG-117 / T0474）：macOS CI 只有一台 arm64 host，`npm ci` 只裝 host 平台的 optional 子套件、`build.npmRebuild: false`，x64 `.app` 實際打包的是 arm64 的內嵌 claude / codex / node-pty / whisper，Intel Mac 上全不可用。要恢復 x64 必須改成 Intel runner 獨立 job（D136 不採用的 B1），不要在 arm64 host 上替換子套件（B2，whack-a-mole）。**不要改成 `"universal"`**（D057 仍有效）— `@electron/universal` 合併 ASAR 時對 `asarUnpack` 內所有 bit-identical 檔案都要求 `x64ArchFiles` 規則覆蓋，本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@img/**`、`@lydell/node-pty-*` 都 ship 全平台 binary，維護 pattern 是 whack-a-mole。完整 root cause 與 5 次 CI run 失敗記錄見 `_ct-workorders/EXP-BUILDER26-001` 的「CI 實戰後續」段落。

## Remote 資安（PLAN-018 T0182）

- **TLS + fingerprint pinning**：Remote server 自 T0182 起以 `wss://` + 自簽憑證運行（`electron/remote/certificate.ts`），client 以 SHA-256 fingerprint (TOFU) 驗證。首次連線會自動寫入 `remoteFingerprint` 到 profile；後續不符即拒絕。
- **憑證儲存位置**：`app.getPath('userData')/server-cert.json`（10 年 expiry；90 天內自動重生）。**不要手動刪除**——會觸發 fingerprint mismatch 讓既有 client 全部失效。
- **Bind-interface 三選項**：
  - `localhost`（預設，`127.0.0.1`）—— 最安全，僅本機連入
  - `tailscale`（`100.x.x.x`）—— fail-closed：找不到 Tailscale 介面時直接報錯，**不會** fallback
  - `all`（`0.0.0.0`）—— 完全裸露，僅在受信 LAN 使用
- **Token 儲存**：`server-token.json` 以 Electron `safeStorage` 加密（Windows DPAPI / macOS Keychain）。Linux 無 keychain 時 fallback 到 plaintext + warn log（fork 現行行為，見 D Q1.A）。
- **QR payload 格式**（tunnel-manager）：`{ url: wss://..., token, fingerprint, mode, addresses }`——client 掃描後必須把 fingerprint 寫入 profile 才能建立 TLS 信任鏈。
- **ProfilePanel UI**：remote profile 有 read-only fingerprint 欄位 + 「Pin expected fingerprint」按鈕（手動刷新）。首次建立 profile 時欄位空白，`Fetch profiles` 成功後自動填入（TOFU）。
- **依賴套件**：`selfsigned@^5.x`（v5 是 async API；`await selfsigned.generate(...)`，v4 同步呼叫會回 Promise 導致 `.cert.replace` undefined）。
- **降級情境**：若 `safeStorage.isEncryptionAvailable() === false`，`[Secrets]` warn log 會顯示一次；工單決策是「fallback 不阻擋啟動」，使用者可觀察 log 判斷是否需要切離 Linux 環境。

## 遠端 Tower 通知（PLAN-036 K）

遠端視窗（WSL / SSH / Docker profile）裡的 Tower 與本機一樣能派單（`bat-terminal.mjs`）、Worker 能回報（`bat-notify.mjs`，toast + badge + 預填 + `--submit`）。方案 A'（T0420 / D134）：headless bat-server 為**每個 PTY** 簽發範圍權杖，**server token 永不進 PTY env**。實作 T0431（`terminal:*` 上線）/ T0432（權杖）/ T0433（helper 隨 bundle + env 注入）/ T0447-T0450（安全修正）/ T0434（端到端驗收）。

- **遠端 PTY 的 `BAT_*`**（`buildHeadlessHelperEnv`，`electron/remote/headless-entry.ts`）：`BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` + `BAT_REMOTE_PORT`（headless port）/ `BAT_REMOTE_TOKEN`（**= 該 PTY 的權杖**，`batcap.` 前綴，T0449）/ `BAT_SERVER_CERT_PATH`（`<dataDir>/server-cert.json`，helper 指紋釘選用）/ `BAT_HELPER_DIR`（`<installRoot>/scripts`）/ `BAT_HELPER_LOG_DIR`（`<dataDir>/Logs`）/ `BAT_HELPER_NODE`（`<installRoot>/bin/node`，存在才注入，T0456）；另把 `<installRoot>/bin` **附加在 `PATH` 尾端**（不 prepend，使用者自己的 node 仍優先，T0456）。Worker 分頁另有 `BAT_TOWER_TERMINAL_ID`（+ `CT_MODE` / `CT_INTERACTIVE`）。繼承來的 `BAT_*` 一律 scrub（`isHeadlessScrubbedEnvKey` 不變）。`<installRoot>/scripts` 缺 `bat-terminal.mjs` / `bat-notify.mjs`（T0433 前的 bundle、或只部署 JS 的 dev deploy）⇒ **不注入、不簽發、不動 `PATH`**，回到「`BAT_SESSION=1` 但無 helper env」的降級狀態
- **權杖範圍**（`electron/remote/helper-capability.ts`，預設拒絕）：
  | 角色 | 允許 | 限制 |
  |---|---|---|
  | `tower`（無 notify target 的 PTY） | `terminal:create-agent-command` | 只能建**新** id；`BAT_TOWER_TERMINAL_ID` 只能是自己；`customEnv` 限 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` / `MSYS_NO_PATHCONV`；不得指定 `shell`；agent 必須是 registry 已知 id（T0450，未知 → `agent-not-allowed`）；同時存活子 PTY ≤ 8、建立間隔 ≥ 1 s、server 有 PTY 上限時保留 8 個名額給 client（T0450） |
  | `worker`（帶 `BAT_TOWER_TERMINAL_ID` 的 PTY） | `terminal:notify` / `pty:write` / `terminal:keypress` | target 只能是綁定的 tower；`pty:write` 只收可列印文字（控制字元 → `control-character-not-allowed`，送出走 keypress，T0450） |
  其餘 channel（`pty:create` / `terminal:create-with-command` / `fs:*` / `git:*` / `claude:*` …）一律 `Forbidden: channel-not-allowed`。helper 連線不收廣播、不計入 T0404 孤兒回收的 client 數
- **生命週期**：權杖只在記憶體（registry 只存 SHA-256 digest）；PTY exit / kill 即撤銷（已認證 socket 上後續 frame 一律不執行、連線 terminate，T0447）；`pty:restart` 保留角色（T0448）；server 重啟全失效。撤銷 10 分鐘內再用 → `Authentication failed: Capability revoked`；權杖認證失敗**不**計入 server-token 暴力破解封鎖（T0449）
- **限制**：
  - **遠端 Tower 派單只能用 agent 模式**：`bat-terminal.mjs --skill ct-exec --workorder T#### --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID"`（或 `--prompt`）。本機慣用的 raw command 形式 `bat-terminal.mjs claude "/ct-exec T####"` 走 `terminal:create-with-command`，權杖一律 `Forbidden: channel-not-allowed`
  - `--submit` 的 Enter 由 client renderer 合成：**沒有任何 BAT client 連著時** keypress 回 `no-client`，`bat-notify` exit 1（yolo 不會假裝已送出；預填文字仍寫進 Tower PTY）
  - **遠端 PATH 不一定有 `node`**（WSL 測試機 smoke S10 實測 `node=missing`）：遠端呼叫 helper 用 `"${BAT_HELPER_NODE:-node}"`（T0456；T0456 前部署的 server 無此變數，改用 `"$BAT_HELPER_DIR/../bin/node"`，`scripts/` 與 `bin/` 同在 `<installRoot>`）。T0456 起 `PATH` 尾端也有 `<installRoot>/bin`，但 login shell 的 profile 可能重設 `PATH`（如 Debian `/etc/profile`），`BAT_HELPER_NODE` 才是可靠寫法
  - **`bat-terminal.mjs` 未建立即 exit 1**：server 回 `{ ok:false }`（T0433）或單純 `false`（T0456 起；之前會印 `✓ Terminal created` 並 exit 0）都 exit 1。本機 `false` 情境：無 PtyManager（`no-pty-manager`）、`shell` 被拒（`invalid-shell`，headless `validateShell`）、node-pty 與 child_process 皆 spawn 失敗、`create-agent-command` 同時/皆未給 prompt 與 skill+workorder、或無法為該 agent 組出啟動命令。塔台 auto-session 只信 exit code
  - server bundle 不含 codex：server 上偵測不到 codex 時遠端派 codex 回 `AGENT_UNAVAILABLE`（偵測未完成為 `AGENT_CHECK_PENDING`，稍後重試），T0433
  - 遠端 `~/.claude/skills` 須自行安裝 control-tower 系列 skill
  - 遠端事件只送到收到它的那條連線所屬 profile 的視窗。PLAN-039 起每個 remote profile 各自持有連線（`RemoteConnectionRegistry`，`electron/remote/remote-connection-registry.ts`），WSL + SSH 同時開窗兩邊的 Tower / Worker 通知都正常（T0463 前的「全域只有一個 `remoteClient`、非當前綁定 profile 收不到事件」限制已解除）。已知限制：兩個 profile 指向**同一** server 會各持一條連線，Worker `--submit` 會到兩邊 renderer，Tower PTY 可能收到兩次 Enter（連上時 `logger.warn`）
  - 本機 Electron 的 PTY 仍注入全權 server token（A' 回移本機為另案）
- **驗證**：`electron/remote/__tests__/headless-remote-tower-e2e.test.ts`（真 headless + 真 node-pty，helper 在 PTY 內執行：派單 → `created-externally` → `bat-notify --submit` → `notified` + `keypress` + 預填；越權與撤銷負向；no-client）；`npm run smoke:remote:headless` 的 **S13**（對已部署 server；server 無 helper env 時 SKIP 且不算失敗）；`npm run deploy:headless:dev` 自 T0434 起一併部署 `serverBundleHelperScripts` 到 `<installRoot>/scripts/`

## 多 remote profile 同時連線（PLAN-039）

`main.ts` 以 `RemoteConnectionRegistry`（T0462 模組、T0463 接線、T0464 生命週期）取代單一 `remoteClient` 槽位：`Map<profileId, entry>`，每個 profile 一把 mutex（同 profile 的 connect / pin 變更 / release 串行，不同 profile 並行）。

- **路由**：proxied IPC 以 sender 綁定的 profile（detached 視窗用父視窗的）查自己的 entry；無 live 連線 → 拒絕（`no-client` / `reconnecting`），不 fallback 本機。`'other-profile'` 已移除（T0463）。每個 client 的事件只送 `getWindowsForProfile(profileId)`；本機來源事件（本機 PTY 輸出、Claude emit、`system:resume`）仍送所有視窗，renderer 以 id 過濾
- **生命週期**：最後一個視窗關閉後寬限 `IDLE_GRACE_MS = 15 s`，到期在 mutex 內重算仍無視窗才斷；縮到 tray 的 hidden 視窗算 live（`collectProfileWindows()`）；連上但沒建出視窗 → `FIRST_WINDOW_GRACE_MS = 60 s`；quit 全量 `disconnectAll` 等 ≤ 2 s（`DISCONNECT_ALL_TIMEOUT_MS`）。常數皆無注入點，測試不得為縮短等待改產品常數
- **上限 `MAX_CONCURRENT_REMOTE_PROFILES = 8`**（含連線中 / 重連中；`remote:test-connection` / `remote:list-profiles` 的暫時 client 不計）：第 9 個 → main 端原生對話框（`showRemoteProfileFailureDialog`，`reason: 'limit'`，三語）、`openProfileWindows` 回 `error: 'remote-limit'`、`remote:connect` 回 `errorCode: 'remote-limit'`，**不擠掉既有連線**
- **同 target 兩 profile**：允許 + `logger.warn`（見上方雙 Enter 限制）；SSH 動態本機埠 bind 失敗換埠重試一次、固定 `tunnelLocalPort` 重複 warn（T0465）
- **驗證**：單元 / 整合見 `electron/remote/__tests__/remote-connection-*.test.ts`；e2e `e2e/plan039-multi-remote.spec.ts`（T0466）起兩個 isolated 實例互為 server（P → A 自身、Q → B），驗雙視窗 connected、`pty:create` 落在正確 server、第 9 個被拒、關 P 15 s 後才斷且 Q 不受影響、釋放後名額回收；單獨跑 `npx playwright test e2e/plan039-multi-remote.spec.ts`（需先 `npx vite build`，約 25 s）。P 是 loopback 到 A 自身，故 P 的 PTY 是 A 本機 PTY、會經本機廣播送到 A 所有視窗（含 Q 視窗）——spec 只斷言「B 上的 PTY 輸出不進 P 視窗」這個方向
- **實機驗收**（WSL + SSH，AI 無法代驗）步驟見 `docs/remote-dev-overview.md`「Several remote profiles at once (PLAN-039)」

## Control Tower 本專案規則

- 塔台啟動時**必須讀取** `_ct-workorders/_local-rules.md` 並遵循其中所有規範
- 該檔案定義了本專案的擴充單據類型（BUG/PLAN）、索引同步原則、歸檔策略等
- 此為 Layer 3 附加規則，優先級高於 skill 預設行為

### 工單與文件撰寫慣例

塔台工單（`_ct-workorders/T*.md`）與 spec 文件中提及 child_process 安全規則時：

- ❌ 禁止在「禁用範例」段落寫具體 `exec(\`command ${var}\`)` 字串（security hook 會在 Write 時誤觸並 abort 寫入；T0319 草稿首發即被攔截兩次）
- ✅ 改用敘述：「禁用 `child_process.exec` 模板字串呼叫」或「禁用 shell-spawning exec API」
- 程式碼範例只放正確寫法（`execFile` / `spawn`），不放 ❌ 反例
- 同樣慣例適用於提及任何受 hook 攔截的 API（後續發現再補進此清單）

## Packaging / Release 前置檢查

- **Squash merge 後打包前必做**：在 main repo 根目錄跑 `npm install`（CI 跑 `npm ci`）確保 `node_modules/` 與 `package-lock.json` 一致。Squash merge 只更新 lock file，不同步實際 `node_modules/`，遺漏此步會導致 native module 缺失（見 BUG-056 / T0242 / T0243）。
- **Build fail-fast**：`npm run build` / `npm run build:release` / `npm run build:dir` 會先執行 `scripts/verify-native-modules.js`，檢查 `@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3` 等關鍵 native modules 是否存在於 `node_modules/`。缺失即 abort，不會進 vite build 或 electron-builder。新增關鍵 native module（特別是 `build.asarUnpack` 內的）時請同步更新 `REQUIRED_NATIVE_MODULES` 清單。`verify-native-modules.js` 也檢查 **host 平台**的 whisper binary（`@kutalia/whisper-node-addon/dist/<dir>/whisper.node`，`<dir>` 規則與 `electron/whisper-addon-loader.ts` 同步：macOS 為 `mac-<arch>` 優先、`darwin-<arch>` fallback；T0468 / BUG-116）。T0472 起另檢查內嵌 claude 與 better-sqlite3：`@anthropic-ai/claude-code/bin/claude.exe` 必須是 host 格式的原生執行檔（PE / ELF / Mach-O），不能是 npm 的 500 bytes stub；`better-sqlite3/build/Release/better_sqlite3.node` 必須存在（只查存在，不載入、不驗 ABI）。desktop host（`win32-x64` / `linux-x64` / `darwin-arm64`）缺失即 exit 1，其他 host（含 `darwin-x64`：mac 只打 arm64，D136 / D137）只 warn。
- **打包產物檢查**（`scripts/verify-packaged-native.js`，T0470 → T0475）：`verify-native-modules.js` 只看打包前 host 的 `node_modules`，看不到 electron-builder 實際打進去的東西（BUG-117 的 x64 `.app` 帶 arm64 binary、BUG-118 的非 Windows 包缺 `claude-code/bin/claude.exe` 都曾讓它假綠燈）。`pre-release.yml` / `release.yml` 在打包之後、上傳 artifact 之前執行，只讀檔頭、不執行產物內任何程式：
  - **mac**（`--platform mac --out release --arch arm64`，`Package for macOS` 之後）：對 `release/mac-arm64/*.app`（x64 會是 `release/mac/`）檢查 (a) `Contents/MacOS/<exe>` 的 cputype 符合 `--arch`，作為基準；(b) `Contents/Resources/app.asar.unpacked` 下所有 Mach-O（含 fat）都是基準 cputype 或 fat 內含基準，ELF / PE 不查，允許清單只有 whisper `dist/{mac,darwin}-<其他 arch>/`（`isCrossArchAllowed`）；(c) 內嵌 claude 依 runtime 規則找到且 cputype 符合；(d) whisper `dist/{mac,darwin}-<arch>/whisper.node` 存在。缺 `.app` 也算失敗
  - **Linux**（`--platform linux --out release --arch x64`，`Package for Linux` 之後）：`release/linux-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude`（或 fallback `claude-code/bin/claude.exe`）必須存在且為 ELF x86-64
  - 內嵌 claude 候選規則是 `electron/claude-runtime-router.ts` `embeddedClaudeCandidates` 的 JS 複本（`packagedEmbeddedClaudeCandidates`），router 單元測試斷言兩者一致；改 `build.mac.target` arch、whisper 目錄規則或內嵌路徑規則時同步改此腳本與 workflow 的 `--arch`
- **Helper bundle fail-fast**：同一條 pipeline 也會跑 `scripts/verify-helper-bundle.js`，靜態掃描 `scripts/*.mjs` 的 relative `.mjs` import，比對 `package.json` `build.extraResources[].filter` 是否涵蓋所有 import target。若有 helper 被 filter 漏掉即 abort，錯誤訊息會指出漏了哪個檔 + 建議加什麼 pattern（見 BUG-058 / T0247 / T0248）。新增 `scripts/_bat-*.mjs` helper 或修改 `extraResources.filter` 時，先跑 `npm run verify:helpers` 確認配對。範圍刻意縮小到 top-level `.mjs` + static import；子目錄 / 動態 `import()` 不在掃描內。
- **CI pipeline**：`.github/workflows/pre-release.yml` 三平台 build job 依序為 `npm ci` → `@electron/rebuild` → `verify-native-modules.js` → `verify-helper-bundle.js`（在 `build-version.js` 開頭自動 require） → `build-version.js` → `electron-builder` →（mac / linux job）`verify-packaged-native.js` → 上傳 artifact。新增 CI job 時請沿用相同順序。
- **Release 驗收必跑 NSIS 完整重裝**：`--dir` mode 和 `zip` smoke 不是 production 等價；release 前必須完整「uninstall → 跑 installer → 啟動 UI → 踩 voice input / terminal / sqlite 路徑」驗收（BUG-056 盲點記錄）。

### Server bundle baseline（PLAN-031）

- **`npm run fetch:baseline` 在 build 前**：electron-builder build 前必跑（`prebuild` hook 已自動串接），從 GitHub Release 抓對應 host arch 的 baseline tarball 到 `dist-baseline/`，由 installer 內建 (`extraResources`)
- **per-host matrix（C-narrow，D092）**：
  - Win × x64 → `linux-x64`
  - Mac × arm64 → `linux-x64` + `darwin-arm64`（雙 tarball）
  - Linux × x64 → `linux-x64`
  - Linux × arm64 → `linux-arm64`
- **fail-fast**：`scripts/verify-helper-bundle.js` 已擴 server bundle 檢查（T0316 落地），dist-baseline 缺 tarball 即 abort with actionable msg
- **Server bundle release（獨立 tag）**：tag 命名 `server-bundle-vX.Y.Z`（D093）。自 D120（T0365）起 `pre-release.yml` / `release.yml` 發佈 desktop release 時**同時自動發佈** `server-bundle-v<版號>` prerelease（同 run 的 `server-bundle-baseline` artifact）；`build-server-bundle.yml` 手動推 tag 線保留為備援（見下方「Server bundle 是獨立 tag 線」）
- **預設下載來源**：`https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v<版號>/`（`src/lib/arch-normalize.ts` `DEFAULT_RELEASE_BASE_URL`；D120 前誤指不存在的 `anthropics/...`）
- **Mac installer size cap**：280 MB（D094）；超出觸發塔台復議
- **私有 fork**：設 `BAT_SERVER_BUNDLE_BASE_URL` env override GitHub Release 預設（D095）
- **詳細**：見 `docs/server-bundle-distribution.md`

## Release

> 以下依 `.github/workflows/*.yml` 實際內容核對（2026-09-02，CP-T0362）。行號皆指該 workflow 檔本身；
> 與 `_ct-workorders/_local-rules.md`「Release 流程實況」同源。

| 線 | workflow | 觸發 | tag 從哪來 |
|----|----------|------|-----------|
| 正式版 | `release.yml` | `on: push: tags: ['v*']`（:3-6） | 本機 `git tag vX.Y.Z && git push origin vX.Y.Z`；CI 由 `GITHUB_REF` 反解版號（:15-23） |
| 預覽版 | `pre-release.yml` | **`workflow_dispatch` only**（:3-9）—— push tag **不會**觸發它 | 不 push tag；tag 由 release step 的 `tag_name` 建立（:252-257） |

預覽版發布指令：

```bash
gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N
```

- 🔴 **`gh` 一律帶 `-R gowerlin/better-agent-terminal`**：本 repo 有 3 個 remote（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**。不帶 `-R` 時唯讀操作報 404，寫入操作（`gh release create` / `gh pr create`）則是打到別人的 repo。
- 🔴 **`-f version=` 不可留空**：留空會走自動遞增 —— `git tag -l 'v*' --sort=-v:refname | head -n1` → patch +1 → 找未使用的 `-pre.N`（`pre-release.yml:34-55`）。本 repo 有 **257 個 `v*` tag**，橫跨 `v0.x`（本 fork 主線）/ `v2.2.x` / `v4.0.x` 三條版本線，`-v:refname` 排序第一名是 **`v4.0.3-pre.1`**，留空即產出 `4.0.4-pre.1`，與主線完全脫節。判版方式：取**本 fork 主線（`v0.x`）**最新 tag 遞增，不要信排序第一名。

### prerelease 標記與下游發佈

| 行為 | `release.yml`（正式版線） | `pre-release.yml`（預覽版線） |
|------|--------------------------|------------------------------|
| GitHub Release `prerelease` | `contains(github.ref, '-pre')` —— tag 含 `-pre` 才標 Pre-release（:267） | **恆為 `true`**（:277） |
| Homebrew tap | **opt-in，預設跳過**（D137）：repo variable `HOMEBREW_TAP_REPO`（tap repo `owner/name`）有值**且** tag **不含** `-pre` 時才 `repository-dispatch` 到該 repo，需 secret `TAP_GITHUB_TOKEN`（:298-308）。T0476 前寫死上游 `tonyq-org/homebrew-tap` | **完全沒有此 step** |
| Chocolatey push | **opt-in，預設跳過**（D137）：repo variable `CHOCOLATEY_PUBLISH == 'true'` **且** tag **不含** `-pre` 時才跑 `choco` job，需 secret `CHOCO_API_KEY`（:310-369）。chocolatey.org 上 package id `better-agent-terminal` 的 owner 為上游；T0476 已移除過期的日期 gate | 無 |
| `server-bundle-v<版號>` release（D120） | 恆發佈、恆 `prerelease: true`（:277-296，接在 desktop release step 後、Homebrew 前） | 恆發佈、恆 `prerelease: true`（:285-304） |

⇒ 走 `release.yml` 打 `v0.5.9-pre.1` 這種 tag 一樣會被標成 Pre-release 且不動 Homebrew / Chocolatey；正式版 tag 在未設定上述 repo variable 時同樣不動這兩個下游通道；但預覽版的建議路徑仍是 `pre-release.yml`（免 push tag、版號可控）。

### Server bundle 是獨立 tag 線

`build-server-bundle.yml` 有**三個**觸發條件（:3-9）：`workflow_dispatch`、push 到 `feature/plan-007-remote-dev` 分支、以及 `server-bundle-v*` tag。但其 release job 另有 `if: startsWith(github.ref, 'refs/tags/server-bundle-v')` 閘門（:133），⇒ **只有 tag 那條會真的發佈**，分支 push 僅建置不發佈。產出恆 `prerelease: true`（:160）。此即上方「Server bundle baseline（PLAN-031）」節所指的獨立線。

注意「解耦」的精確意思：`release.yml` / `pre-release.yml` 內各自另有 `server-bundle` job（`release.yml:25-70`）在 desktop 發布時就地重建 bundle 並打進安裝檔。解耦指的是 **baseline tarball 的獨立發佈線**，不是 desktop 流程完全不碰 server bundle。

**自 D120（T0365）起，desktop 線也會發佈 `server-bundle-v<版號>`**：`release.yml` / `pre-release.yml` 的 `release` job 在 desktop release step 成功後，接一個 `Create server bundle release` step，把同 run 的 `server-bundle-baseline` artifact（3 arch × `.tar.gz` + `.sha256` + `manifest.json`）以 `server-bundle-v${{ needs.prepare.outputs.version }}` 發成 prerelease，target 為 `github.sha`（與 desktop release 同 commit）。build 失敗時 `release` job 不會跑，不會留下孤兒 server-bundle release。runtime 下載的預設來源為 `gowerlin/better-agent-terminal`。
- 該 tag 由 `GITHUB_TOKEN` 建立，依 GitHub 規則**不會**再觸發 `build-server-bundle.yml` 的 `server-bundle-v*` tag 觸發條件，不會重複建置。
- `build-server-bundle.yml` 手動推 tag 線**保留為備援**（例如 desktop run 的 server bundle step 失敗需補發）。同一版號不要兩條線都發。
