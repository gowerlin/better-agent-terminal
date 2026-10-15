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
- 測試若用 fake timers，不要用 `vi.waitFor` 等待 socket / IPC 事件：vitest 在 fake timers 下每次輪詢都會 `advanceTimersByTime(interval)`，會偷跑被假造的 interval（T0508，`helper-connection-hygiene.test.ts` 改用事件驅動的 `until()`）。真實 socket 的 heartbeat 測試只假造 `setInterval` / `clearInterval`，再以 `vi.advanceTimersByTime` 逐拍推進。

## Type check

- `npm run typecheck`（= `tsc --noEmit -p .`）：只涵蓋 `src/`（`tsconfig.json` 的 `include`），基線 **0**（T0486 清零 BUG-061）。改 `src/**` 的工單驗收寫「`npm run typecheck` = 0」。
- `npm run typecheck:electron`（= `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`）：涵蓋 `electron/**` + `vite.config.ts`，基線 **0**（T0496 清零，原 77）。旗標只用於型別檢查：`--target ES2022` 消除未設 target 造成的 TS2802、`--composite false` 消除 composite file-list 的 TS6307；**不要**把 `target` 寫進 `tsconfig.node.json`（vite / esbuild 會經 root `references` 讀它，`useDefineForClassFields` 預設值隨 target 變動，可能改變 electron 產物語意）。改 `electron/**` 的工單驗收寫「`npm run typecheck:electron` = 0」。
- `registerHandler`（`electron/remote/handler-registry.ts`）是泛型：handler 可宣告具體參數型別，但 IPC / remote frame 參數**不在執行期驗證**，需要防禦的 handler 自己收窄。
- vite build（esbuild）與 vitest 只轉譯、不做型別檢查；兩個 typecheck 都要另外跑。
- CI：`pre-release.yml` / `release.yml` 的 `typecheck` job 依序跑 `npm run typecheck`、`npm run typecheck:electron`（`npm ci --ignore-scripts` 即可，T0496 實測），任一失敗 → build / release skipped（見「Packaging / Release 前置檢查」的 **Typecheck gate**）。

## Logging

- **Frontend (renderer)**: Use `window.electronAPI.debug.log(...)` instead of `console.log()`. This sends logs to the electron main process logger, which writes to disk.
- **Backend (electron)**: Use `logger.log(...)` / `logger.error(...)` from `./logger`.
- Do NOT use `console.log()` for debugging — use the logger so logs are persisted and visible in the log file.
- **Log file location**: `<appData>/BetterAgentTerminal/Logs/debug-<YYYYMMDD-HHMMSS>.log`（每次啟動一檔，保留最近 10 個；`electron/logger.ts`）。`<appData>`：Windows `%APPDATA%`、macOS `~/Library/Application Support`、Linux `~/.config`。磁碟日誌**預設開啟**（Settings → Advanced → Debug Logging 可關 / 調等級），與 `BAT_DEBUG` 無關（`BAT_DEBUG` 只控制 `isDebugMode` 的 debug UI，`electron/preload.ts`）。userData 根部若有舊版留下的 `debug.log`，啟動時搬到 `Logs/debug-legacy-<stamp>.log`。
- **啟動期日誌（T0485）**：磁碟日誌由 `electron/app-paths-bootstrap.ts` 在 `setPath('userData')` 之後立即 `logger.init`（設定以 `logger.readSettings` 同步讀 `settings.json`），早於所有其他模組主體；whenReady 的 `logger.init` 為冪等（已初始化只重套設定，不重開檔、不重複輪替），一次啟動只產生一個 `debug-*.log`。bootstrap 同時呼叫 `installEarlyCrashCapture()`（`electron/early-crash-log.ts`）：
  - `uncaughtExceptionMonitor` → `[CRASH] early <origin>: …`；main.ts 註冊自己的 `uncaughtException` / `unhandledRejection` 後呼叫 `handOffEarlyCrashCapture()` 移除，不重複記錄
  - `console.error` 鏡像（`logger.mirrorConsoleErrors`）→ `[console.error] …`，到 whenReady 的 `endEarlyCrashCapture()` 為止。Electron 41 對主 bundle **載入期同步丟錯**不發 `uncaughtException`，而是 `console.error('App threw an error during load')` + stack 後讓行程無視窗存活；Node 的 `UnhandledPromiseRejectionWarning` 也走 `console.error`。鏡像是這兩者進磁碟日誌的唯一管道
  - **不得**在 main.ts handler 之前註冊 `uncaughtException` / `unhandledRejection` listener：前者會關掉 Electron 預設錯誤對話框（它只在 listener 數為 1 時顯示），後者會抑制 rejection warning（Electron 為 warn 模式）
- **GPU 狀態日誌 `[gpu]`（T0533 / BUG-136）**：`electron/gpu-status-log.ts`，main.ts 接線，只記錄、不改任何繪圖行為。`[gpu] info:` = `app.getGPUInfo('basic')` 精簡（每顆 GPU 的 vendor / device / 名稱 / driver、`active`）；`[gpu] feature status:` = 基準，在**第一次 `gpu-info-update`** 才記（之前 `getGPUFeatureStatus()` 回的是佔位值，全部 `disabled_software` / `disabled_off`，Windows whenReady 實測；15 s 內沒有 update 則記 `feature status (no gpu-info-update yet):`）；GPU 行程 `child-process-gone` 時在原 `[CRASH]` 行（格式不變）之後記 `[gpu] crash #N this session`、`feature status at crash:` 與 `changes since last logged:`；之後 `gpu-info-update` 只在狀態改變時記 `feature status changed: <key: 前 → 後> | <全部 key>`。判讀：`gpu_compositing` / `rasterization` / `2d_canvas` 為 `enabled` = 硬體繪圖；`disabled_software` / `unavailable_software` = 已退回軟體繪圖（CPU 負擔，畫面由 CPU 合成）；`disabled_off` / `unavailable_off` = 該功能關閉。Chromium 在 GPU 行程反覆崩潰後會整體退回軟體（隔離實例以 `chrome://gpucrash` 實測：第 3 次崩潰起全部變 `disabled_software`）。
- **單一 userData 目錄**（BUG-119，T0480 起）：`settings.json` / `windows.json` / `profiles/` / `Local State` / `snippets.json` / `message-archives/` / `Logs/` / `Crashes/` 全在 `<appData>/BetterAgentTerminal[-runtime-<N>]/`（`--runtime=<N>` / `BAT_RUNTIME=<N>` 實例為 `BetterAgentTerminal-runtime-<N>`）。T0480 前 `snippet-db` 單例在 import 期呼叫 `app.getPath('userData')`，Chromium PathService 把 userData 快取成 `package.json` `name`（`better-agent-terminal`），日誌 / snippets / `Local State` 因此落在小寫目錄。現由 `electron/app-paths-bootstrap.ts` 依序 `setName` → 解析 runtime id → app ready 前同步 migration（`electron/userdata-migration.ts`）→ 顯式 `app.setPath('userData', ...)`；`main.ts` 在 `setPath('crashDumps')` 後自檢 userData 未漂移（不符即 `logger.error`）。**開發規則**：① `app-paths-bootstrap` 必須維持 `main.ts` 的**第一個** import（rollup 把被 import 模組的主體排在 `main.ts` 主體之前），且它只 import `electron` / `path` / `./userdata-migration` / `./logger` / `./early-crash-log` / `./early-path-fix`（後三者各自只 import fs / path / child_process / `./logger`；`app-paths-bootstrap-order.test.ts` 靜態守住）；② 任何模組**不得在 import 期**呼叫 `app.getPath('userData')`（含模組層級單例的建構子），一律在函式內 lazy 取值（範本：`snippet-db.ts` 的 `dataPath` getter）。`electron/__tests__/app-paths-bootstrap-order.test.ts` 靜態守住 ①。**macOS GUI 啟動 PATH 修正**（T0485）在 `electron/early-path-fix.ts`，由 bootstrap 在 early capture 之後呼叫（早於所有其他模組主體）；先前寫在 `main.ts` 頂部，實際晚於所有 import 的模組主體。**舊目錄**：升版首次啟動複製 `Local State`（缺才複製）、複製 / 合併 `snippets.json`、單檔移動 `message-archives/*.jsonl`，`Logs/` / `Crashes/` 不搬；runtime 實例整個目錄改名（terminal server 仍在執行或 rename 失敗時本次沿用舊目錄）；完成寫 marker `.userdata-migration.json`（只跑一次）。舊 `<appData>/better-agent-terminal[-runtime-<N>]/` 一律保留不刪（降版安全，舊日誌在那裡）；結果在 `logger.init` 後以 `[userdata-migration]` 寫入日誌。
- **Helper scripts 的 userData**（T0481）：本機 PTY（Terminal Server `pty:create`、node-pty、child_process fallback 三條路徑，`electron/pty-manager.ts` `localHelperEnv()`）注入 `BAT_USER_DATA` = `app.getPath('userData')`，覆蓋繼承值與 `customEnv`；只在 host 提供 `helperDir` 時注入（headless PTY 不注入）。`scripts/_bat-cert.mjs` / `scripts/_bat-logger.mjs` 解析順序：① 明確 override（`BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR`，headless bat-server 設定）→ ② `BAT_USER_DATA`（須為絕對路徑，相對路徑忽略）→ ③ 舊推測 `BetterAgentTerminal` + `BAT_RUNTIME`（T0481 前的 BAT 或 BAT 外執行）。`--runtime=<N>` 啟動的實例 PTY 沒有 `BAT_RUNTIME`，靠 ② 找到該實例自己的 `server-cert.json` 與 `Logs/bat-scripts.log`。
- **PTY env 唯一組裝點**（T0525 / BUG-131）：`PtyManager.buildPtyEnv()`（`electron/pty-manager.ts`）供第一次建立（三條 spawn 分支）、`pty:restart`、Terminal Server recovery 共用；instance 記 `customEnv` / `workspaceId` / `agentPreset`，重建時沿用，helper 值（port / token / `BAT_USER_DATA`）在呼叫當下重新取得。新增 env 一律改這個函式，不要在分支內聯。
- **塔台派工落點**（T0523 / BUG-129）：本機 `terminal:create-agent-command` / `create-with-command` 由外部 helper 呼叫時，落點與 `--agent default` 解析以 `--notify-id` 塔台終端在 window registry 所屬的工作區為準（`electron/dispatch-workspace.ts`），`--workspace` 為 fallback，不一致時 `logger.warn` `[T0523]`；兩者皆無仍落在 active workspace（T0137）。遠端 headless 由 client renderer 的 `addExternalTerminal` 依塔台終端判斷。`bat-terminal.mjs` 成功時在 `✓ Terminal created` 之後印 `workspace:` / `agent:` 實際落點。已知限制：agent CLI 自己還原舊環境（例如 Codex 接續別的分頁開的 thread）時，`BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 兩者都可能指向別的分頁，BAT 無法從 env 修正。**cwd 檢核（T0527 / BUG-132）**：main 解析出落點後，比對派工 cwd 與落點工作區 `folderPath`（`checkDispatchCwd`，`electron/dispatch-workspace.ts`；win32 / darwin 不分大小寫，原路徑與 realpath 都比，realpath 逾時 300 ms 即只比原路徑）：在底下 → 照舊；不在任何工作區底下 → 建立 + 警告（跨專案派工不擋）；在**另一個**工作區底下（取最深者）→ 非 yolo 建立 + 警告，`--mode yolo`（`customEnv.CT_MODE`）**拒派**，回 `{ ok:false, code:'DISPATCH_CWD_OTHER_WORKSPACE' }`，helper exit 1 並列出兩個工作區。落點工作區無 `folderPath` / 解析不到 / cwd 非絕對路徑 → 跳過。日誌 `[BUG-132]`，`bat-scripts.log` 事件 `dispatch-cwd-check`（`status` / `action`）。cwd 只做檢核，**不是**落點規則（T0137 不變）。遠端 headless 不檢核（server 沒有 client 的 `folderPath`）。**`--agent` 簡寫**：`normalizeAgentAlias`（`electron/terminal-command-handlers.ts`）只映射到 registry 已知 id（原 id → 小寫 → `<id>-cli`，例 `codex` → `codex-cli`）；仍不認得 → `{ ok:false, code:'AGENT_UNKNOWN', knownAgents }`，helper exit 1。headless 權杖的 `isKnownAgent` 以正規化後的 id 查 registry（T0450 範圍不變）。

## Detached workspace 視窗的持久化（T0453 / T0491）

- detached 視窗沒有自己的 registry entry：`workspace:load` 回父視窗 entry（`loadDetachedWorkspace`，`electron/main.ts`），`workspace:save` 只把**該 detached workspace 的終端清單**合併進父 entry（`saveDetachedWorkspaceTerminals`，`electron/window-registry.ts`），其他欄位與其他 workspace 一律不動。🔴 不要改回「detached store 覆寫父 entry」（BUG-113 前的問題）。
- detach 期間該 workspace 的終端清單歸 detached 視窗所有（`DetachedTerminalOwners`，記憶體）：父視窗的 save（含 30 秒 autosave、quit flush）保留 entry 內的清單。detached 視窗關閉後 main 先 `windowRegistry.whenIdle()` 再送 `workspace:reattached`，父 renderer 在 save 佇列中呼叫 `workspace:adopt-detached` 取回清單並釋放所有權；父視窗完整 `workspace:load` 也會釋放已無 detached 視窗的所有權。
- `WindowRegistry` 的 `saveEntry` / `removeEntry` / `updateEntry` / `withEntry` / `whenIdle` 共用一個序列化佇列；同一 entry 的讀改寫請用 `updateEntry`，不要 `getEntry` → 改 → `saveEntry`（會與其他 writer 交錯而丟更新）。
- **關窗前 flush（T0504）**：detached 視窗的 `close` 由 main 攔下（`flushBeforeClose`，`electron/renderer-flush.ts`），送 `workspace:flush-save` 給該視窗，等**該視窗自己的** `workspace:flush-save-done`（`requestRendererFlush`，最多 `DETACHED_CLOSE_FLUSH_TIMEOUT_MS` = 1.5 s）後 `destroy()`；逾時 / 失敗照樣關閉並 `logger.warn`。rename / sdkSessionId 等非增刪變更因此不再依賴 30 秒 autosave。🔴 live 的 detached 視窗在自己的 `closed` 之前不得從 `detachedWindows` / `detachedWindowRecords` 移除（否則它的 flush-save 會被當成未知 sender 丟棄）；`workspace:reattach` 與最後一個主視窗關閉都只 `close()`。renderer 的 `workspaceStore.save()` 在已有排隊 save 時回傳該 promise，flush ack 一定在最新狀態送出之後。
- **quit 對話框與再 detach（T0508）**：detached 關窗 flush 只在 quit flush **已開始**後跳過（`quitFlushStarted`，`before-quit` 確認對話框之後才設；quit flush 已對全部視窗含 detached flush，每個 renderer 各等自己的 ack，各 2 s），所以對話框開著時關窗照常 flush，取消 quit 不會遺失。quit flush 與關窗 flush 共用 `createRendererFlusher`（`electron/renderer-flush.ts`），同一 renderer 同時只有一個 flush，確認 quit 時會併入進行中的關窗 flush，不重送。`workspace:detach` 遇到同 workspace 的視窗還在關閉（flush 中，或已 `closed` 但 `workspace:reattached` 尚未送出，`DetachedTeardowns`）時，會等它結束再開新視窗，不會 focus 正在關閉的視窗；🔴 等待迴圈最後一次檢查到 `detachedWindows.set()` 之間不得有 await。
- **detached 視窗不渲染 `SettingsPanel`（T0530 / BUG-133）**：detached 的「開啟設定」經 `workspace:open-settings-in-parent`（`electron/detached-open-settings.ts`）把父主視窗（已關則同 profile 最近活動的主視窗）帶到前景並開 Settings。🔴 不要改成在 detached 視窗開 Settings：`settings.json` 由各 renderer 以整份記憶體副本 `save()`，main 沒有變更廣播，多一個編輯者會互相覆寫。工作區設定（T0529）在 detached 視窗同樣只讀。
- 驗證：`electron/__tests__/window-registry-detached-terminals.test.ts`、`electron/__tests__/renderer-flush.test.ts`、`electron/__tests__/detached-workspace-persistence.test.ts`（T0508 source guard）、`src/stores/__tests__/workspace-store.adoptDetached.test.ts`、`src/stores/__tests__/workspace-store.flushSave.test.ts`；e2e `e2e/detached-terminal-persistence.spec.ts`、`e2e/detached-flush-on-close.spec.ts`、`e2e/detached-close-edges.spec.ts`（需先 `npx vite build`）。

## 工作區層級 Agent / 啟動參數（PLAN-040 / T0529，D142）

- **資料**：`Workspace.defaultAgent` / `Workspace.agentCustomArgs?: Record<presetId, string>`（`src/types/index.ts`），隨工作區物件整個存進 window registry。設定入口：工作區右鍵 →「工作區設定…」（`src/components/WorkspaceEnvDialog.tsx`，環境變數為其中一區）；store `setWorkspaceDefaultAgent(id, agent | undefined)` / `setWorkspaceAgentCustomArg(id, presetId, args | undefined)`，每次變更立即 `save()`，main 下一次讀 registry 即看得到。下拉與參數列沿用 Settings 的 `getVisiblePresets()`（不含自訂 CLI，與 Settings 一致）。
- **查找順序**（唯一實作 `src/lib/agent-launch-settings.ts`，renderer 與 main 共用，不要在 consumer 內聯）：
  - 預設 agent：工作區 `defaultAgent` → Settings `defaultAgent` → `claude-code`（D140，不得改成沿用塔台自己的 agent）
  - 啟動參數以 preset 為單位：工作區 `agentCustomArgs` **有** key（含空字串）→ 整串取代全域，不串接；空字串 = 此工作區不帶參數；**沒有** key → Settings `agentCustomArgs[preset]`。helper 以 `[terminal-driven id, 指定 id]` 兩個候選查（例 `claude-code` → `claude-cli`），工作區層全部候選先於全域層
- **consumer**：`App.tsx` CT 派工按鈕、`WorkspaceView.tsx`（新建 / 還原 / 重啟 Agent 終端、claude-cli、CT 派工）一律經 `workspaceStore.getEffectiveDefaultAgent()` / `getEffectiveAgentArgs()`（讀最新 state，避開 memo 過的 closure）。🔴 不要再直接用 `settingsStore.getAgentCustomArgs` 或 `workspace.defaultAgent || settings.defaultAgent`（`src/components/__tests__/workspace-settings-dialog.test.tsx` source guard）。`agent:build-launch-command` 第三參數帶生效參數（只供 codex daemon opt-out 去重，T0377），未帶時退回 Settings。
- **helper 派工**：`terminal:create-agent-command`（`--agent default` 與 `--agent <id>`）套用落點工作區（T0523 規則）的生效參數，與 UI 按鈕一致；主行程日誌 `[agent-command] resolved … argsSource=workspace|settings|builtin`。raw command 模式（`bat-terminal.mjs codex …` = `terminal:create-with-command`）不加參數。T0529 前 helper 已會套全域 `agentCustomArgs`，只是不看工作區。main 讀工作區欄位：`findWorkspaceAgentSettings`（`electron/dispatch-workspace.ts`）。
- **detached 視窗**：設定入口唯讀（分頁列齒輪按鈕 → 唯讀工作區設定，提示回主視窗修改），因為 detached 的 `workspace:save` 只合併終端清單（見上節，`saveDetachedWorkspaceTerminals` 語意不變）。主視窗 sidebar 不列 detached 中的工作區，所以 detach 期間兩邊都改不了；detached 視窗開啟時讀父 entry，值與 detach 當下一致，派工 / 新建終端讀得到。
- **遠端**：遠端視窗的 UI consumer 在 client 端算生效值（工作區存在 client 的 registry），照樣生效；遠端 Tower 經 headless bat-server 的 helper 派工**沒有**工作區層級（server 只讀 `<dataDir>/settings.json`，`resolveWorkspaceAgentSettings: async () => null`）。
- 驗證：`src/lib/__tests__/agent-launch-settings.test.ts`、`src/stores/__tests__/workspace-store.agentSettings.test.ts`、`src/components/__tests__/workspace-settings-dialog.test.tsx`、`electron/__tests__/workspace-agent-launch-dispatch.test.ts`；e2e `e2e/t0529-workspace-agent-launch.spec.ts`（隔離實例，自訂 CLI 跑 node 腳本記錄 argv，不耗 token；需先 `npx vite build`）。

## Worker 分頁回收（PLAN-041 / T0535，D144）

- **契約**（PLAN-041「介面契約」，CT-T011 依此撰寫，不得單方更改）：`node "$BAT_HELPER_DIR/bat-terminal.mjs" --close-worker T#### --notify-id "$BAT_TERMINAL_ID" [--delay-ms <n>]`。`--close-worker` 格式同 `--workorder`（BAT 去前後空白、轉大寫後比對）；`--notify-id` 必填；`--delay-ms` 預設 0，BAT 夾在 0–300000；與建立分頁的參數（`--cwd` / `--workspace` / `--agent` / `--prompt` / `--skill` / `--workorder` / `--mode` / `--interactive` / `--no-interactive` / 位置參數）互斥。exit code：`0` 已排程（delay 0 = 已送出關閉）/ `3` NOT_FOUND / `4` NOT_OWNER / `5` AMBIGUOUS / `6` BUSY / `1` 用法錯誤、連線失敗、BAT 太舊（舊 helper 對 `--close-worker` 印 `Unknown option` exit 1，不建立分頁；新 helper 對舊 BAT 主行程收到 `No handler for channel` → `close-worker: UNSUPPORTED`）。stderr 另印 `close-worker: <CODE>`（診斷用，CT 只看 exit code）；成功 stdout `✓ Worker close scheduled: <id> (in <n> ms)`。`bat-scripts.log` 事件 `close-worker`。
- **BAT 檢查**（`terminal:close-worker`，`electron/close-worker.ts` `WorkerCloseScheduler`，main.ts 接線；只由 helper 經 RemoteServer 呼叫，列在 `proxied-channels-binding.test.ts` 的 REGISTRY_ONLY）：參數不合 → `INVALID_ARGS`；先只以工單找 Worker（`PtyManager.findWorkerTerminals(null, workorder)`）→ 0 個 `NOT_FOUND`；再比 `customEnv.BAT_TOWER_TERMINAL_ID` → 都不是此塔台 `NOT_OWNER`、>1 個 `AMBIGUOUS`（Renew 重派等）；最近 `CLOSE_WORKER_IDLE_MS` = 5 s 內有輸出 → `BUSY`（常數）。**不加 Settings 開關**（D144：要不要回收、延遲多久由 CT `*config` 決定）。
- **工單記錄**：`terminal:create-agent-command` 的 skill 模式把 `workorder` 帶到 `PtyInstance.workorder`（`createWithCommand` → `ptyManager.create`），`pty:restart`、Terminal Server 冪等重建（T0108 replay 後補齊）與 recovery 沿用（比照 T0525 `customEnv`）。prompt / raw command 模式不記錄。
- **延遲與取消**：計時在 main。到期時若該 PTY 在排程後有**新輸出**或**本機視窗的 `pty:write`**（`handlers/pty.ts` 在 `ctx.connectionId` 為空時呼叫 `noteUserInput`；helper 經 RemoteServer 的寫入不算）→ 取消，`[close-worker] … → cancelled (…)`；分頁已不存在 → 靜默結束；同一分頁再次成功請求 → 以最新一次為準（重設計時器），被拒的請求不動既有排程。到期 → 送 `terminal:close-requested { id }` 給所有視窗（含 detached）。
- **關閉路徑**：renderer 由 `App.tsx` 處理（`ownsTerminalForCloseRequest`：detached 視窗只關自己工作區的分頁，主視窗只關未 detach 的工作區），呼叫 `workspaceStore.closeTerminalNow(id, { cleanWorktree: false })`——不跳確認框、不清 worktree。✕（`WorkspaceView` 的閒置 shell 直接關與確認框確認）也改走 `closeTerminalNow`，逐項與 T0535 前相同（integrated agent → `claude.stopSession`，其他 → `pty.kill`；worktree 只在使用者勾選時清；`removeTerminal` + `save()`）。🔴 改 ✕ 行為時同步看 `src/stores/__tests__/workspace-store.closeTerminalNow.test.ts`（含 T0535 前邏輯的對照與 source guard）。
- **已知限制**：BAT 重開後主行程不知道 Worker 的塔台 / 工單（T0108 replay 不帶 `customEnv`），`--close-worker` 回 `NOT_FOUND`，T0537 前需手動關閉；遠端 headless 見下一條；Windows Terminal Server 模式下 `pty:kill` 後子程序是否結束由 T0540（PLAN-042）處理，本功能沿用既有 `pty.kill` 不變；Worker 若持續有輸出（例如 TUI 週期重繪）會一直 `BUSY` / 被取消。
- **遠端 headless（T0536）**：遠端視窗的 Tower 用同一個 helper 指令（`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --close-worker …`），契約與 exit code 不變。headless 的 `terminal:close-worker` 是同一個 `WorkerCloseScheduler`（`createHeadlessTerminalModule`，`electron/remote/headless-entry.ts`），工單記錄同本機（skill 模式派工寫進 headless PTY）；權杖：tower 角色可呼叫、`towerId` 須為自己（`authorizeHelperInvoke`），handler 另以 `HelperCapabilityRegistry.isWorkerOf` 驗證候選（scheduler `isOwnedBy` dep，與 `BAT_TOWER_TERMINAL_ID` 比對同時成立才算；不成立 → `NOT_OWNER`），worker 權杖 → `Forbidden: role-not-allowed`。延遲期間的「使用者輸入」只算 **client 連線**的 `pty:write`（`registerPtyHandlers` 的 `isUserInput` dep → `RemoteServer.isClientConnection`），helper 的寫入不算。`terminal:close-requested` 在 `PROXIED_EVENTS`，經 `RemoteConnectionRegistry` 送到該 profile 的視窗，renderer 沿用 `App.tsx` 的處理。已知限制：到期時沒有任何 client 連著 → 事件無人接收，分頁在下次連線時仍在（不補送）；server 重啟後權杖與工單記錄全失，回 `NOT_FOUND`。
- 驗證：`electron/__tests__/close-worker.test.ts`（scheduler 各 code、延遲取消、PtyManager 記錄 / restart / recovery、handler）、`electron/remote/__tests__/headless-close-worker-e2e.test.ts`（T0536，真 headless + 真 node-pty，helper 在 PTY 內執行：成功 + 事件、別人的 Worker、`towerId` 冒用、目標為自己、worker 權杖、client 輸入取消、撤銷權杖）、`electron/remote/__tests__/helper-capability.test.ts`（`isWorkerOf`、角色表）、`electron/__tests__/bat-terminal-close-worker.test.ts`（helper exit code、互斥參數、`--help`）、`src/stores/__tests__/workspace-store.closeTerminalNow.test.ts`；e2e `e2e/t0535-close-worker.spec.ts`（隔離實例，自訂 CLI 跑 node 腳本，不耗 token；需先 `npx vite build`）。

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
- `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）已前插 `claude-opus-5-5` / `claude-fable-5-1` / `claude-sonnet-5-5` / `claude-haiku-5-5`（Haiku 5.5 為 T0483 加入；`claude-haiku-4-5-20251001` 保留）。5 系列原生 1M context，**不再加 `[1m]` 變體**（CLI 2.1.289 / 2.1.296 的模型清單也不列 `[1m]` 行）；既有 `claude-opus-4-7[1m]` / `-4-6[1m]` / `claude-sonnet-4-6[1m]` 保留（legacy 未退役）。`getSupportedModels()` 的 SDK 補充清單以 runtime router 解出的 CLI 取得，SDK alias（`opus` / `fable` / `sonnet` / `haiku`）若其 `resolvedModel` 已是 builtin 即略過（`default` 保留，因它跟隨帳號預設）；取完清單即 `close()` 該 probe 子行程（T0372）。`setModel()` 切換模型後、下一次 `modelUsage` 回報前，顯示的 context window / max output 取自 `estimateModelLimits()`（`electron/claude-agent-manager.ts` `MODEL_LIMITS`，T0484）：Opus 5.5 / Fable 5.1 / Sonnet 5.5 / Haiku 5.5 為 1M / 128K（官方 models overview，2026-10-13）；其餘 ID（含 legacy 與 alias）沿用舊推估（`[1m]` → 1M 否則 200K；含 `haiku` → 8192 否則 64000）。新增 5 系列模型時同步補此表與 `electron/__tests__/claude-model-limits-and-call-usage.test.ts`。
- 計價表集中於 `src/lib/model-pricing.ts`（`P()` / `MODEL_PRICING` / `getModelPricing()`），Claude 與 Codex 面板的 Cache History 成本皆引用此模組（T0374，原為兩份內嵌複本）。已收錄 5 系列（`opus-5-5` / `fable-5-1` / `sonnet-5-5` / `haiku-5-5` 及 legacy `opus-5` / `opus-4-8` / `sonnet-5` / `fable-5`，價格只取自官方價目頁：T0368 第 4 節，T0483 於 2026-10-13 重讀補 Haiku 5.5 與 Sonnet 5.5 cache read 調降）。`P(input, output, { cacheReadMultiplier })` 預設 0.1x，Opus 5.5 與 Sonnet 5.5 為 **0.05x**、Fable 5.1 為 **0.025x**。Haiku 5.5 依 prompt 長度分段計價（prompt 含 cache read / write 的全部 input tokens 超過 100,000 時改用 `haiku-5-5-long`，5 倍價）：`getModelPricing(model, { promptTokens })` 支援分段。Claude 面板的 Cache History 自 T0484 起經 `estimateCallCost()` / `estimateModelUsageCost()`（同模組，運算順序與舊面板相同，價格不分段的模型結果逐位元不變）計價：單次呼叫列以該列 prompt 長度選價；R 列的 `modelUsage` 是跨呼叫加總，主行程依 API message id 追蹤每次呼叫（`stream_event` 的 `message_start` / `message_delta` + `assistant` 訊息 usage，sub-agent 一併記錄），result 時把 prompt > 100,000 的呼叫加總寫入 `modelUsage[model].longPrompt`（含在總量內），renderer 對這部分用 long 價、其餘用基本價。漏追的呼叫（CLI 背景呼叫等）仍以 ≤100K 價計，只會低估。Codex 面板只計 OpenAI 模型（皆回 `null`），未接線。`getModelPricing()` 以 `includes` 比對，**point release 必須排在 base model 之前**（`opus-5-5` 先於 `opus-5`、`fable-5-1` 先於 `fable-5`）；新增模型時同步補 `src/lib/__tests__/model-pricing.test.ts`。未命中的 ID（含 OpenAI / Codex 模型）回 `null`，成本顯示 `—`。
- Cache History 的列與總計邏輯在 `src/lib/cache-history.ts`（T0498）。主行程在主 agent 的串流 `claude:status` 帶 `lastCall`（該次 API 呼叫的 id / model / query 編號 / token，取自 per-call tracker）；query 開始與 result 時為 `null`（`null` 代表新版 server，欄位不存在代表舊版，renderer 走舊邏輯）。單次呼叫列一呼叫一列，以自己的 token 計價。R 列為 SDK `modelUsage`，含同 query 所有呼叫（含 sub-agent），**總計不重複加同 query 的單次呼叫列**，只加沒有 result 的 query 與進行中 query 的列。V1 / V2 開始 query 時都經 `resetQueryUsage()` 清 `modelUsage` / `lastCall` / tracker（T0498 前 V2 不清，上一 result 會被當成新的 R 列重複加總）。
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
- **Terminal claude-cli preset**：`pty-manager.ts` 僅在 `agentPreset` 為 `claude-cli` / `claude-cli-worktree` 且持久化設定 `claudeRuntime.mode === 'embedded'` 時注入（`claudeCliUpdateGuardEnv()`）。PTY 是 shell，env 作用於整個分頁：在 embedded claude-cli 分頁內另外對 PATH 上的 system claude 執行 `claude update` 也會被拒，請改用一般 terminal 分頁。已知缺口：system 模式且 fallback 到 embedded 的 claude-cli 分頁不注入（fallback 為非同步偵測，`pty.create` 時拿不到），該情境仍有 `DISABLE_AUTOUPDATER` 擋背景更新；remote `terminal:create-agent-command` 建立的分頁不帶 `agentPreset`，同樣不注入（`pty:restart` 與 Terminal Server recovery 重建的分頁自 T0525 起沿用原 `agentPreset`，會注入）。

**已知未修副作用**：使用者一旦觸發過 BUG-059，`~/.claude/...` config 已被寫入 `installMethod: "global"`。本修復不重置該 config（影響面評估中），但 spawn env 注入會 short-circuit update flow，config 值不會再被讀取觸發新一輪 update。

## Electron Runtime

- 本專案使用 Electron 41.x（Node 24、Chromium M146）；於 PLAN-016 Phase 2 從 Electron 28.3.3 升級（EXP-ELECTRON41-001 CONCLUDED）。
- native modules（Electron ABI 145）：目前沒有任何原生模組需要針對 Electron 重建。`@lydell/node-pty`、`@kutalia/whisper-node-addon` 都直接使用上游 prebuilt binary。`sharp`（含 `@img/*`）只是 devDependency，給 `scripts/generate-icons.js` 用，桌面 app 與 server bundle 都不打包（T0503）。T0492 移除了 app 與 server bundle 都沒用到的 `better-sqlite3`，postinstall 裡的 `electron-rebuild -f -w better-sqlite3`（T0473）也一起刪掉。T0492 在乾淨的 `npm ci` 上跑 `npx @electron/rebuild`：win32-x64 與 linux-x64 都是 0 個模組要重建，因為 prod 樹裡已沒有任何套件在根目錄放 `binding.gyp`（`sharp` 的在 `src/` 底下，不會被掃到）。CI 桌面 build job 的 `npx --yes @electron/rebuild` step 仍保留，原因是 darwin-arm64 host 沒有實測，留著當保險（現在等同 no-op）。日後若新增需要 Electron ABI 的原生模組，要加回 postinstall rebuild（不經 `npm rebuild`，見下節「根 `postinstall`」），並把它列進 `verify-native-modules.js`。**不要**用 `npm rebuild <pkg>` 重建這類模組：它會重跑套件的 install script，`prebuild-install` 預設 `runtime=node`，下載回來的是 Node ABI 的 prebuilt，反而造成 `NODE_MODULE_VERSION mismatch`（T0473 以 npm 11.19.0 實測過）。
- BAT 內執行 `npm run dev` 需確認 `ELECTRON_RUN_AS_NODE` 未被污染（見 BUG-038 / T0161）。若 renderer 無法啟動且 log 出現 `ELECTRON_RUN_AS_NODE=1`，清除該環境變數後重試。
- electron-builder 26.x（2026-04-18 PLAN-005 / EXP-BUILDER26-001 CONCLUDED，原 24.13.3 → 26.8.1，清除 9 個 Group A CVE，見 PLAN-003 Group A）。

## 本機開發：npm 12 install scripts（T0471 / T0473）

- **背景**：npm 12（`npm -v` ≥ 12）預設擋**相依套件**的 install scripts，只放行 `package.json` `allowScripts` 列為 `true` 的套件。未放行時 `npm ci` / `npm install` 仍 exit 0，只在結尾印 `npm warn ... install scripts blocked because they are not covered by allowScripts`。T0471 時本 repo 沒有 `allowScripts`，結果 `electron` 無 `dist/`、`esbuild` 無原生 binary、`better-sqlite3` 無 `.node`（該套件已於 T0492 移除）、內嵌 claude 的 `bin/claude.exe` 是 500 bytes 的 stub（執行即 `Error: claude native binary not installed.`）。
- **`allowScripts`（T0473）**：放行 `electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code`（`better-sqlite3` 隨套件於 T0492 移除），用不綁版本的 name-only entry（`"<pkg>": true`，等同 `npm install-scripts approve --no-allow-scripts-pin <pkg>`），升版不必重新 approve。`sharp` 只給 `scripts/generate-icons.js`（devDependency，不打包，T0503）。本機 npm 12 跑 `npm ci` 後**不需任何手動補跑**：`node scripts/verify-native-modules.js` exit 0、內嵌 claude `--version` = `2.1.296 (Claude Code)`（T0492 以 npm 12.2.0 乾淨 `npm ci` 複驗）。
- **`electron-winstaller` 刻意不列入**（不寫 `false`）：它只供 Squirrel.Windows target，本專案 `build.win.target` 為 `nsis` + `zip`，用不到。本機 npm 12 會擋它，`npm ci` 結尾與 `npm install-scripts ls` 會列出這一個套件，屬預期。不寫 `false` 是因為 npm 11.19.0（CI）也會遵守 `false` 而不跑它的 script（T0473 實測少了 `electron-winstaller/vendor/7z.dll`、`7z.exe`），CI 行為就變了；不列入時 npm 11 照跑，只多一行警告。
- **`fsevents` 同樣刻意不列入**（D139，不寫 `false`）：它是 devDependency 樹裡的 darwin-only optional 套件（lock 內 `node_modules/fsevents` 2.3.2 與 `node_modules/vite/node_modules/fsevents` 2.3.3，皆 `hasInstallScript`），mac 上的 npm 12 會擋它的 install script，`npm ci` 結尾會列出它，屬預期；Windows / Linux 不安裝它。理由比照 `electron-winstaller`：寫 `false` 會讓 npm 11（CI）也跳過它的 script，改變 CI 行為。fsevents 為 optional，mac 開發一般不受影響。
- **npm 11 也認得 `allowScripts`**：npm 11.19.0 對未列入的套件只警告、照跑；對 `false` 則跳過。T0473 以 `npx -y npm@11.19.0 ci`（`CI=true`）比對改動前後的 `package.json`，`node_modules` 內容完全相同（只有 `.package-lock.json` 換行不同）。
- **`allowScripts` 是政策**：新增帶 install script 的相依時，npm 12 會在 `npm ci` 結尾列出它。要放行（加 `true`）或拒絕（加 `false`）需塔台決策；不要用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts` 一次放行。
- **根 `postinstall`**：根專案自己的 lifecycle script 不受 `allowScripts` 管制。T0492 起只剩 mac 的 `plutil` 段（改 `Electron.app` 顯示名稱）與 `echo 'postinstall done'`。T0473 加入的非 CI electron-rebuild 段（`node node_modules/@electron/rebuild/lib/cli.js -f -w better-sqlite3`）已隨 better-sqlite3 移除。日後若要加回 rebuild，沿用同樣做法：直接執行 `@electron/rebuild` 的 `cli.js`，不經 `npm rebuild`。原因是 `npm rebuild` 在 npm 12 未放行時會被擋成 no-op（T0471），放行後或在 npm 11 下又會產出 Node ABI（見「Electron Runtime」）。
- **手動補跑**：只在用 `--ignore-scripts` 安裝、`allowScripts` 被改掉、或單一套件損壞時才需要（repo 根目錄執行）：

  | 套件 | install script | 手動補跑 |
  |---|---|---|
  | `electron` | `postinstall: node install.js` | `node node_modules/electron/install.js` |
  | `esbuild` | `postinstall: node install.js` | `node node_modules/esbuild/install.js` |
  | `sharp` | `install: node install/check.js \|\| npm run build` | `node node_modules/sharp/install/check.js` |
  | `@anthropic-ai/claude-code` | `postinstall: node install.cjs` | `node node_modules/@anthropic-ai/claude-code/install.cjs`（把 `@anthropic-ai/claude-code-win32-x64` 的 binary 放到 `bin/claude.exe`）；驗證 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = `package.json` 鎖定的版本（T0483 起 `2.1.296 (Claude Code)`） |

- **本機打包**：`build.npmRebuild` 為 `false`，electron-builder 直接打包 `node_modules` 現況（`asarUnpack` 含 `@anthropic-ai/claude-code`）。`scripts/verify-native-modules.js` 自 T0472 起會擋內嵌 claude stub（T0472 另加的 better-sqlite3 `.node` 檢查已於 T0492 隨套件移除），`node_modules` 不完整時 `npm run build` / `release.ps1` 在打包前就失敗。
- **CI**：workflow 用 `actions/setup-node` `node-version: '24'`，用 Node 隨附的 npm（Node 24.21.0 隨附 npm 11.19.0，nodejs.org `dist/index.json`），沒有升級 npm 的 step；本機的 npm 12 是另外全域升級的。GitHub Actions 會設 `CI=true`。T0492 移除 electron-rebuild 段後，postinstall 已不再看 `CI`。桌面 build job 的 `npx --yes @electron/rebuild` step 保留，理由見「Electron Runtime」。server-bundle job 只跑 `npm ci`，bundle 不再含 better-sqlite3。若 CI 改用 npm 12，`allowScripts` 已涵蓋所需套件。
- **CI actions / runner 版本**（T0487 / T0494）：workflow 用的 action 全部是原生 Node 24 的 major：`actions/checkout@v7`、`actions/setup-node@v7`、`actions/upload-artifact@v7`、`actions/download-artifact@v8`（upload / download 須成對升級）、`softprops/action-gh-release@v3`、`peter-evans/repository-dispatch@v4`。Linux job（含 `typecheck`）釘 `ubuntu-24.04`（不用 `ubuntu-latest`：它自 2026-10-19 起分批改為 Ubuntu 26.04，runner-images#14748），AppImage glibc 基線 = 24.04；server-bundle 刻意用 `ubuntu-22.04` / `ubuntu-22.04-arm`（glibc 相容，2027-04-17 停止支援，runner-images#14254）與 `macos-15`（見「Server bundle baseline」）。`macos-latest`（現為 macos-26）/ `windows-latest`（現為 Windows Server 2025 + VS 2026）未釘版。升級 action 前以 `gh api repos/<owner>/<repo>/contents/action.yml?ref=<tag>` 確認 `runs.using`；`download-artifact@v8` 的 digest 不符預設會讓 job 失敗。

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
- **mac 只打 arm64 dmg**（2026-10-13 D136，v0.6.0-pre.3 起；取代 D057 的雙 arch dmg）：`mac.target.arch = ["arm64"]`，產出 `BetterAgentTerminal-*-arm64.dmg`，**不支援 Intel Mac**。原因（BUG-117 / T0474）：macOS CI 只有一台 arm64 host，`npm ci` 只裝 host 平台的 optional 子套件、`build.npmRebuild: false`，x64 `.app` 實際打包的是 arm64 的內嵌 claude / codex / node-pty / whisper，Intel Mac 上全不可用。要恢復 x64 必須改成 Intel runner 獨立 job（D136 不採用的 B1），不要在 arm64 host 上替換子套件（B2，whack-a-mole）。**不要改成 `"universal"`**（D057 仍有效）— `@electron/universal` 合併 ASAR 時對 `asarUnpack` 內所有 bit-identical 檔案都要求 `x64ArchFiles` 規則覆蓋，本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@lydell/node-pty-*` 都 ship 全平台 binary（`@img/**` 自 T0503 起不打包），維護 pattern 是 whack-a-mole。完整 root cause 與 5 次 CI run 失敗記錄見 `_ct-workorders/EXP-BUILDER26-001` 的「CI 實戰後續」段落。

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
- **SSH target 與 user（T0505）**：`sshUser` 可為空。空時所有 ssh 呼叫點（`buildBaseSshArgs`，`electron/remote/ssh-args.ts`）的 argv 結尾為 `-- <host>`，由 `~/.ssh/config` 決定 user / HostName / Port / IdentityFile / ProxyJump（wizard 選 alias 即走此路，存 `sshUser: ''`）；有值時維持 `-- user@host`。host-only target 必須符合 `^(?!-)[A-Za-z0-9._:-]{1,253}$`（不得以 `-` 開頭、不含 `@`），`listSshHosts` 只列出符合者。遠端 `loginctl enable-linger` 在無 user 時用 `"$(id -un)"`。
- **SSH wizard 安裝 / 啟動（T0511，BUG-120 / BUG-121）**：server bundle tarball 頂層是 `staging/`，上傳時遠端 `tar xz --strip-components=1`（同 WSL `installBundle` / `docker/Dockerfile`），落在 `<installPath>/bin/bat-server`；先刪舊 wizard 留下的 `staging/`（僅當內含 `staging/bin/bat-server`），解完 `test -x bin/bat-server` 不過即上傳失敗（`electron/remote/ssh-bundle-uploader.ts`）。systemd unit 的 `ExecStart` 與 launchd plist 的 `ProgramArguments` 以命令列帶 `--port <serverPort> --bind-interface localhost`（bat-server 自 T0272 起即支援，舊 bundle 相容；**不是** `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`，bat-server 不讀）；enable 階段 systemd 用 `enable` + `restart`、launchd 先 `unload` 再 `load -w`（重跑 wizard 會換上新 bundle / 參數）；verify（`sh -c` 迴圈最多 20 秒）要求服務自己的行程在該埠 LISTEN（systemd：`is-active` + MainPID 擁有 `/proc/net/tcp{,6}` 的 socket；launchd：`launchctl list` 的 PID + `lsof -iTCP:<port> -sTCP:LISTEN`），不用 `pgrep -x bat-server`（行程是 node，比對不到）。實機驗證：`e2e/pre5-ssh-alias.spec.ts`（`BAT_E2E_PRE5_SSH=1`，先 `node e2e/real-remote/t0510-ssh-alias-env.mjs up`）。

## 遠端 Tower 通知（PLAN-036 K）

遠端視窗（WSL / SSH / Docker profile）裡的 Tower 與本機一樣能派單（`bat-terminal.mjs`）、Worker 能回報（`bat-notify.mjs`，toast + badge + 預填 + `--submit`）。方案 A'（T0420 / D134）：headless bat-server 為**每個 PTY** 簽發範圍權杖，**server token 永不進 PTY env**。實作 T0431（`terminal:*` 上線）/ T0432（權杖）/ T0433（helper 隨 bundle + env 注入）/ T0447-T0450（安全修正）/ T0434（端到端驗收）。

- **遠端 PTY 的 `BAT_*`**（`buildHeadlessHelperEnv`，`electron/remote/headless-entry.ts`）：`BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` + `BAT_REMOTE_PORT`（headless port）/ `BAT_REMOTE_TOKEN`（**= 該 PTY 的權杖**，`batcap.` 前綴，T0449）/ `BAT_SERVER_CERT_PATH`（`<dataDir>/server-cert.json`，helper 指紋釘選用）/ `BAT_HELPER_DIR`（`<installRoot>/scripts`）/ `BAT_HELPER_LOG_DIR`（`<dataDir>/Logs`）/ `BAT_HELPER_NODE`（`<installRoot>/bin/node`，存在才注入，T0456）；另把 `<installRoot>/bin` **附加在 `PATH` 尾端**（不 prepend，使用者自己的 node 仍優先，T0456）。Worker 分頁另有 `BAT_TOWER_TERMINAL_ID`（+ `CT_MODE` / `CT_INTERACTIVE`）。繼承來的 `BAT_*` 一律 scrub（`isHeadlessScrubbedEnvKey` 不變）。`<installRoot>/scripts` 缺 `bat-terminal.mjs` / `bat-notify.mjs`（T0433 前的 bundle、或只部署 JS 的 dev deploy）⇒ **不注入、不簽發、不動 `PATH`**，回到「`BAT_SESSION=1` 但無 helper env」的降級狀態
- **權杖範圍**（`electron/remote/helper-capability.ts`，預設拒絕）：
  | 角色 | 允許 | 限制 |
  |---|---|---|
  | `tower`（無 notify target 的 PTY） | `terminal:create-agent-command`、`terminal:close-worker`（T0536） | close-worker：`towerId` 必須是自己（否則 `tower-not-bound`），只能關 `isWorkerOf(候選, 自己)` 成立的 Worker（不屬於 → `NOT_OWNER`，自己永遠不是自己的 Worker）；create-agent-command：只能建**新** id；`BAT_TOWER_TERMINAL_ID` 只能是自己；`customEnv` 限 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` / `MSYS_NO_PATHCONV`；不得指定 `shell`；agent 必須是 registry 已知 id（T0450，未知 → `agent-not-allowed`）；同時存活子 PTY ≤ 8、建立間隔 ≥ 1 s、server 有 PTY 上限時保留 8 個名額給 client（T0450） |
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
- **helper 回應必須以 frame id 比對**（BUG-114 / T0490 / T0497）：本機 PTY 的 helper 用全權 server token 連 RemoteServer，屬一般 client，會收到全部 `PROXIED_EVENTS` 廣播（含每個 PTY 的 `pty:output`）。等待 `auth-result` / `invoke-result` 時只接受 `frame.id === 送出的 id`，其餘 frame 一律忽略（`scripts/bat-notify.mjs` `waitForMessageById` / `scripts/bat-terminal.mjs` `waitForMessage`）。auth 等待另接受 `type: 'auth-result'`（`acceptType`）：伺服器 pre-auth 拒絕（banned IP / auth timeout）帶 `id: '0'`，banned IP 在連線時即送、可能與 101 同一 chunk；兩支 helper 的 `MinimalWS` 會暫存 `onMessage` 註冊前抵達的 text frame（`#pending`，T0499 / T0501），該拒絕回報為 `auth-failed`，不再顯示成 `auth-timeout`。T0490 前的 `bat-terminal.mjs` 收「下一個任意 frame」，廣播搶先抵達時誤報 `✓ Terminal created`（exit 0），並在伺服器讀到 invoke 前退出（RST），派發遺失（2026-09-25 起 471 次中 8 次）。新增 helper 腳本時沿用此規則；helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp（否則寫入使用者真實的 `bat-scripts.log`）。
- **驗證**：`electron/remote/__tests__/headless-remote-tower-e2e.test.ts`（真 headless + 真 node-pty，helper 在 PTY 內執行：派單 → `created-externally` → `bat-notify --submit` → `notified` + `keypress` + 預填；越權與撤銷負向；no-client）；`npm run smoke:remote:headless` 的 **S13**（對已部署 server；server 無 helper env 時 SKIP 且不算失敗）；`npm run deploy:headless:dev` 自 T0434 起一併部署 `serverBundleHelperScripts` 到 `<installRoot>/scripts/`

## 多 remote profile 同時連線（PLAN-039）

`main.ts` 以 `RemoteConnectionRegistry`（T0462 模組、T0463 接線、T0464 生命週期）取代單一 `remoteClient` 槽位：`Map<profileId, entry>`，每個 profile 一把 mutex（同 profile 的 connect / pin 變更 / release 串行，不同 profile 並行）。

- **路由**：proxied IPC 以 sender 綁定的 profile（detached 視窗用父視窗的）查自己的 entry；無 live 連線 → 拒絕（`no-client` / `reconnecting`），不 fallback 本機。`'other-profile'` 已移除（T0463）。每個 client 的事件只送 `getWindowsForProfile(profileId)`；本機來源事件（本機 PTY 輸出、Claude emit、`system:resume`）仍送所有視窗，renderer 以 id 過濾
- **生命週期**：最後一個視窗關閉後寬限 `IDLE_GRACE_MS = 15 s`，到期在 mutex 內重算仍無視窗才斷；縮到 tray 的 hidden 視窗算 live（`collectProfileWindows()`）；連上但沒建出視窗 → `FIRST_WINDOW_GRACE_MS = 60 s`；quit 全量 `disconnectAll` 等 ≤ 2 s（`DISCONNECT_ALL_TIMEOUT_MS`）。常數皆無注入點，測試不得為縮短等待改產品常數
- **上限 `MAX_CONCURRENT_REMOTE_PROFILES = 8`**（含連線中 / 重連中；`remote:test-connection` / `remote:list-profiles` 的暫時 client 不計）：第 9 個 → main 端原生對話框（`showRemoteProfileFailureDialog`，`reason: 'limit'`，三語）、`openProfileWindows` 回 `error: 'remote-limit'`、`remote:connect` 回 `errorCode: 'remote-limit'`，**不擠掉既有連線**
- **同 target 兩 profile**：允許 + `logger.warn`（見上方雙 Enter 限制）；SSH 動態本機埠 bind 失敗換埠重試一次、固定 `tunnelLocalPort` 重複 warn（T0465）
- **驗證**：單元 / 整合見 `electron/remote/__tests__/remote-connection-*.test.ts`；e2e `e2e/plan039-multi-remote.spec.ts`（T0466）起兩個 isolated 實例互為 server（P → A 自身、Q → B），驗雙視窗 connected、`pty:create` 落在正確 server、第 9 個被拒、關 P 15 s 後才斷且 Q 不受影響、釋放後名額回收；單獨跑 `npx playwright test e2e/plan039-multi-remote.spec.ts`（需先 `npx vite build`，約 25 s）。P 是 loopback 到 A 自身，故 P 的 PTY 是 A 本機 PTY、會經本機廣播送到 A 所有視窗（含 Q 視窗）——spec 只斷言「B 上的 PTY 輸出不進 P 視窗」這個方向
- **實機驗收**（WSL + SSH，AI 無法代驗）步驟見 `docs/remote-dev-overview.md`「Several remote profiles at once (PLAN-039)」
- **失敗對話框三語（T0491）**：main 端 remote profile 失敗對話框（`unreachable` / `trust` / `protocol` / `limit`）全部依設定語言三語化（`electron/remote/remote-profile-error.ts` `getRemoteProfileFailureStrings` / `getRemoteProfileLimitStrings`，與 `src/locales/*.json` `remoteProfileFailure.*` / `remoteProfileLimit.*` 由單元測試保持一致）；原始錯誤文字逐字附在 detail。
- **profile index 序列化（T0509）**：`profiles/index.json` 的讀改寫全部經 `electron/profile-manager.ts` 的 `withIndexLock()` 佇列（模組層，比照 T0491 `WindowRegistry`），`ProfileManager` 每個方法都把 `ensureInitialized()` → 修改 → `writeIndex()` 放在同一個單元（讀取也排隊）。🔴 鎖內程式碼不得呼叫 `ProfileManager` 公開方法（佇列不可重入，會等自己）；新增方法時建立邏輯用 `addProfileEntry()`。`writeIndex` 的 rename 對 `EPERM` / `EBUSY` / `EACCES` 依 `INDEX_RENAME_RETRY_DELAYS_MS`（25–800 ms，重試 6 次、共 7 次嘗試）重試，用盡即拋錯。修正 plan039 e2e M3 在完整回歸組合下的 `EPERM … rename index.json.tmp -> index.json`。驗證：`electron/__tests__/profile-index-serialization.test.ts`。

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
- **Build fail-fast**：`npm run build` / `npm run build:release` / `npm run build:dir` 會先執行 `scripts/verify-native-modules.js`，檢查 `@kutalia/whisper-node-addon`、`@lydell/node-pty` 等關鍵 native modules 是否存在於 `node_modules/`（`better-sqlite3` 已於 T0492 移出清單）。缺失即 abort，不會進 vite build 或 electron-builder。新增關鍵 native module（特別是 `build.asarUnpack` 內的）時請同步更新 `REQUIRED_NATIVE_MODULES` 清單。`verify-native-modules.js` 也檢查 **host 平台**的 whisper binary（`@kutalia/whisper-node-addon/dist/<dir>/whisper.node`，`<dir>` 規則與 `electron/whisper-addon-loader.ts` 同步：macOS 為 `mac-<arch>` 優先、`darwin-<arch>` fallback；T0468 / BUG-116）。T0472 起另檢查內嵌 claude：`@anthropic-ai/claude-code/bin/claude.exe` 必須是 host 格式的原生執行檔（PE / ELF / Mach-O），不能是 npm 的 500 bytes stub。T0472 同時加的 `better-sqlite3/build/Release/better_sqlite3.node` 檢查已於 T0492 隨套件移除。desktop host（`win32-x64` / `linux-x64` / `darwin-arm64`）缺失即 exit 1，其他 host（含 `darwin-x64`：mac 只打 arm64，D136 / D137）只 warn。
- **打包產物檢查**（`scripts/verify-packaged-native.js`，T0470 → T0475）：`verify-native-modules.js` 只看打包前 host 的 `node_modules`，看不到 electron-builder 實際打進去的東西（BUG-117 的 x64 `.app` 帶 arm64 binary、BUG-118 的非 Windows 包缺 `claude-code/bin/claude.exe` 都曾讓它假綠燈）。`pre-release.yml` / `release.yml` 在打包之後、上傳 artifact 之前執行，只讀檔頭、不執行產物內任何程式：
  - **mac**（`--platform mac --out release --arch arm64`，`Package for macOS` 之後）：對 `release/mac-arm64/*.app`（x64 會是 `release/mac/`）檢查 (a) `Contents/MacOS/<exe>` 的 cputype 符合 `--arch`，作為基準；(b) `Contents/Resources/app.asar.unpacked` 下所有 Mach-O（含 fat）都是基準 cputype 或 fat 內含基準，ELF / PE 不查，允許清單只有 whisper `dist/{mac,darwin}-<其他 arch>/`（`isCrossArchAllowed`）；(c) 內嵌 claude 依 runtime 規則找到且 cputype 符合；(d) whisper `dist/{mac,darwin}-<arch>/whisper.node` 存在。缺 `.app` 也算失敗
  - **Linux**（`--platform linux --out release --arch x64`，`Package for Linux` 之後）：`release/linux-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude`（或 fallback `claude-code/bin/claude.exe`）必須存在且為 ELF x86-64
  - 內嵌 claude 候選規則是 `electron/claude-runtime-router.ts` `embeddedClaudeCandidates` 的 JS 複本（`packagedEmbeddedClaudeCandidates`），router 單元測試斷言兩者一致；改 `build.mac.target` arch、whisper 目錄規則或內嵌路徑規則時同步改此腳本與 workflow 的 `--arch`
- **Helper bundle fail-fast**：同一條 pipeline 也會跑 `scripts/verify-helper-bundle.js`，靜態掃描 `scripts/*.mjs` 的 relative `.mjs` import，比對 `package.json` `build.extraResources[].filter` 是否涵蓋所有 import target。若有 helper 被 filter 漏掉即 abort，錯誤訊息會指出漏了哪個檔 + 建議加什麼 pattern（見 BUG-058 / T0247 / T0248）。新增 `scripts/_bat-*.mjs` helper 或修改 `extraResources.filter` 時，先跑 `npm run verify:helpers` 確認配對。範圍刻意縮小到 top-level `.mjs` + static import；子目錄 / 動態 `import()` 不在掃描內。
- **CI pipeline**：`.github/workflows/pre-release.yml` 三平台 build job 依序為 `npm ci` → `@electron/rebuild` → `verify-native-modules.js` → `verify-helper-bundle.js`（在 `build-version.js` 開頭自動 require） → `build-version.js` → `electron-builder` →（mac / linux job）`verify-packaged-native.js` → 上傳 artifact。新增 CI job 時請沿用相同順序。
- **Typecheck gate**（T0495 / T0496）：`pre-release.yml` / `release.yml` 有獨立 `typecheck` job（`ubuntu-24.04`，`npm ci --ignore-scripts` → `npm run typecheck` → `npm run typecheck:electron`，無 `needs`，與 server-bundle 並行），列在 `build.needs`。typecheck 失敗 → `build` skipped → `release`（及 `choco`）skipped，不發版。`--ignore-scripts` 足夠：`tsc` 只讀套件內的 `.d.ts`（T0495 實測無 electron `dist/` 時 exit 0）。改 `tsconfig.json` / `tsconfig.node.json` 的 `include` 或新增依賴 postinstall 產物的型別時，先以 `npm ci --ignore-scripts && npm run typecheck && npm run typecheck:electron` 確認。
- **Release 驗收必跑 NSIS 完整重裝**：`--dir` mode 和 `zip` smoke 不是 production 等價；release 前必須完整「uninstall → 跑 installer → 啟動 UI → 踩 voice input / terminal 路徑」驗收（BUG-056 盲點記錄；原清單的 sqlite 路徑隨 better-sqlite3 於 T0492 移除，app 本來就沒用它）。

### Server bundle baseline（PLAN-031）

- **`npm run fetch:baseline` 在 build 前**：electron-builder build 前必跑（`prebuild` hook 已自動串接），從 GitHub Release 抓對應 host arch 的 baseline tarball 到 `dist-baseline/`，由 installer 內建 (`extraResources`)
- **baseline 版號**（`scripts/fetch-baseline-tarball.mjs`，BUG-115 / T0488）：`--version` → `BAT_BASELINE_VERSION` env → `package.json`；本機 snapshot 版號（`<base>-local.<yyMMddHHmmss>` / `<base>.local.<…>`，`build-version.js` `formatSnapshotVersion`）一律去後綴取基底版號（`stripSnapshotSuffix`，SoT 為 `src/lib/snapshot-version.ts`，T0492 起 `build-version.js` / fetch / distributor 共用），因 snapshot 沒有自己的 server-bundle release。**不讀 `VERSION` env**（`build` / `build:dir` 打包 package.json 版號）。`release.ps1`（`.vscode/scripts/release.ps1`）把解析出的版號放進 `BAT_BASELINE_VERSION`（使用者預先設定者優先），`build:release` 開頭與 `prebuild` 的兩次 fetch 因此同一版號，第二次命中快取。`-Version X` 而 `server-bundle-vX` 尚未發佈時 fetch 404 即中止並提示，不自動改用其他版號；要刻意內建已發佈版號的 baseline，先設 `$env:BAT_BASELINE_VERSION`。`dist-baseline/manifest.json` 版號與 baseline 版號不符時重新下載（T0488 前只要存在就沿用）。
- **舊版 baseline 清理**（T0492）：`fetch:baseline` 在目前版號就緒後，會刪除 `dist-baseline/` 內其他版號的 `bat-server-*` tarball / sidecar（`pruneStaleBaselines`；T0492 前會累積並全部打進本機安裝檔）。
- **runtime 下載 fallback 版號**（T0492）：`electron/remote/server-bundle-distributor.ts` 以 `src/lib/snapshot-version.ts` 的 `stripSnapshotSuffix(app.getVersion())` 取基底版號，snapshot 安裝在 baseline / cache 都缺時不再下載不存在的 `server-bundle-v<snapshot>`。
- **per-host matrix（C-narrow，D092）**：
  - Win × x64 → `linux-x64`
  - Mac × arm64 → `linux-x64` + `darwin-arm64`（雙 tarball）
  - Linux × x64 → `linux-x64`
  - Linux × arm64 → `linux-arm64`
- **server bundle runner 與最低 OS**（T0494）：server-bundle matrix 為 `linux-x64` → `ubuntu-22.04`、`linux-arm64` → `ubuntu-22.04-arm`（glibc 2.35 基線，runner 2027-04-17 退役，runner-images#14254）、`darwin-arm64` → `macos-15`（原 `macos-14`，2026-11-02 退役，runner-images#13518）。darwin-arm64 bundle 最低 **macOS 13.5**，由 nodejs.org 的 Node 24 `bin/node` 決定（`LC_BUILD_VERSION` minos 13.5），bundle README 寫 `- macOS lower bound: 13.5 (arm64)`（T0492）；node-pty / claude-code / claude-agent-sdk 為 npm prebuilt（minos 11.0 / 13.0）。T0492 移除 better-sqlite3、T0503 移除 sharp 後，bundle 已沒有需要在 runner 上編譯的套件，換 macOS runner **不影響**最低 macOS。
- **bundle 內容限制**：不含 `node_modules/**/.bin/`（`build-server-bundle.mjs` 打包時移除；`fs.cp` 會把相對 symlink 改寫成指向 runner 的絕對路徑），`verify-server-bundle.js` 擋絕對路徑 symlink（T0492）。**不含 sharp / `@img`**（T0503）：`build-server-bundle.mjs` 的 `nativePackages` / `externalPackages` 不列它們，`verify-server-bundle.js` 對所有 target 禁止 `sharp` / `@img/`。執行時的 claude 一律是 `@anthropic-ai/claude-code-<platform>`，SDK 自帶的 `claude-agent-sdk-<platform>/claude`（內含 sharp，會 `require('@img/sharp-<platform>/sharp.node')`）不會被 BAT 執行，因為每個 spawn 點都傳 `pathToClaudeCodeExecutable`。
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
