# CLAUDE.md - Project Guidelines

## CLAUDE.md 撰寫規則（T0595）

- 本檔每個 session 都會載入。Claude Code 的上限是 150k 字元（超過會警告，可能被截斷），目標 ≤ 100k。
- 新功能 / 新契約在本檔只寫：一兩句用途、必守規則（原文）、唯一實作位置（檔案 / 函式名）、改這個功能前一定要知道的不變式、一行連到 `docs/agent-guide/<主題>.md`。每節以 3–12 行為原則。
- 細節（契約表、參數、exit code、日誌格式、實測數據、已知限制、驗證清單、歷史原因）寫進 `docs/agent-guide/`，索引在 [docs/agent-guide/README.md](docs/agent-guide/README.md)。改功能時兩邊一起更新。
- `##` 標題不改名：工單與 `_ct-workorders/_local-rules.md` 以「CLAUDE.md『<小節標題>』節」引用。必守規則在本檔與 docs 檔各留一份。

## No Regressions Policy

- **NEVER** break existing features when implementing new ones.
- Before committing, verify ALL existing features still work — not just the new changes.
- Run the build (`npx vite build`) to confirm compilation succeeds.
- When modifying shared code (stores, IPC handlers, types), trace all consumers to ensure nothing breaks.

## Frontend unit tests

- 框架：vitest + jsdom + React Testing Library + jest-dom（T0307b 引入）
- 執行：`npm run test:unit`（一次跑完）/ `npm run test:unit:watch`（watch mode）/ `npm run test:unit:ui`（UI mode）
- 測試檔位置（以 `vite.config.ts` 的 `test.include` 為準）：`src/**/*.test.{ts,tsx}`、`src/**/__tests__/**/*.{ts,tsx}`、`electron/__tests__/**/*.test.ts`、`electron/remote/__tests__/**/*.test.ts`、`electron/remote-tools/__tests__/**/*.test.ts`、`scripts/__tests__/**/*.test.mjs`，以及 `tests/` 底下逐檔列出的 5 個 `bat-*.test.mjs`。
- 🔴 新測試一律放 vitest 收得到的位置，不要再放進 `tests/`（D177）。
- `npm run test:legacy`（`scripts/run-legacy-tests.mjs`，T0685）：跑 `tests/` 底下 vitest 不收的舊測試；node:test 檔一次 `tsx --test --test-timeout=60000`，自寫 harness 逐檔 `tsx`（每檔 180 s 上限）。自動找檔，不跑的檔案（probe、互動式、Playwright、mock）列在腳本的 `EXCLUDED` 並註明原因。`tests.yml` 在 unit tests 之後跑它。
- 設定：`vite.config.ts` 內的 `test` 區塊；setup 檔 `vitest.setup.ts`（auto-import jest-dom matchers）
- e2e（playwright）獨立：`npm run test:e2e`，不與 unit test 混跑
- 測試若用 fake timers，不要用 `vi.waitFor` 等待 socket / IPC 事件：vitest 在 fake timers 下每次輪詢都會 `advanceTimersByTime(interval)`，會偷跑被假造的 interval（T0508，`helper-connection-hygiene.test.ts` 改用事件驅動的 `until()`）。真實 socket 的 heartbeat 測試只假造 `setInterval` / `clearInterval`，再以 `vi.advanceTimersByTime` 逐拍推進。

## Type check

- `npm run typecheck`（= `tsc --noEmit -p .`）：只涵蓋 `src/`（`tsconfig.json` 的 `include`），基線 **0**（T0486 清零 BUG-061）。改 `src/**` 的工單驗收寫「`npm run typecheck` = 0」。
- `npm run typecheck:electron`（= `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022`）：涵蓋 `electron/**` + `vite.config.ts`，基線 **0**（T0496 清零，原 77）。旗標只用於型別檢查：`--target ES2022` 消除未設 target 造成的 TS2802、`--composite false` 消除 composite file-list 的 TS6307；**不要**把 `target` 寫進 `tsconfig.node.json`（vite / esbuild 會經 root `references` 讀它，`useDefineForClassFields` 預設值隨 target 變動，可能改變 electron 產物語意）。改 `electron/**` 的工單驗收寫「`npm run typecheck:electron` = 0」。
- `registerHandler`（`electron/remote/handler-registry.ts`）是泛型：handler 可宣告具體參數型別，但 IPC / remote frame 參數**不在執行期驗證**，需要防禦的 handler 自己收窄。
- vite build（esbuild）與 vitest 只轉譯、不做型別檢查；兩個 typecheck 都要另外跑。
- CI：`pre-release.yml` / `release.yml` 的 `typecheck` job 依序跑 `npm run typecheck`、`npm run typecheck:electron`（`npm ci --ignore-scripts` 即可，T0496 實測），任一失敗 → build / release skipped（見「Packaging / Release 前置檢查」的 **Typecheck gate**）。
- 測試關卡（T0686）：同兩個 workflow 的 `tests` job 呼叫可重用的 `tests.yml`（`test:unit` → `test:legacy`），也列在 `build.needs`，失敗 → build / release skipped；手動試跑仍可 `workflow_dispatch` `tests.yml`（見「Packaging / Release 前置檢查」的 **Test gate**）。

## Logging

- **Frontend (renderer)**: Use `window.electronAPI.debug.log(...)` instead of `console.log()`. This sends logs to the electron main process logger, which writes to disk.
- **Backend (electron)**: Use `logger.log(...)` / `logger.error(...)` from `./logger`.
- Do NOT use `console.log()` for debugging — use the logger so logs are persisted and visible in the log file.
- **Log file location**: `<appData>/BetterAgentTerminal/Logs/debug-<YYYYMMDD-HHMMSS>.log`（每次啟動一檔，保留最近 10 個；`electron/logger.ts`）。`<appData>`：Windows `%APPDATA%`、macOS `~/Library/Application Support`、Linux `~/.config`。磁碟日誌**預設開啟**（Settings → Advanced → Debug Logging 可關 / 調等級），與 `BAT_DEBUG` 無關（`BAT_DEBUG` 只控制 `isDebugMode` 的 debug UI，`electron/preload.ts`）。userData 根部若有舊版留下的 `debug.log`，啟動時搬到 `Logs/debug-legacy-<stamp>.log`。
- **啟動期日誌（T0485）**：`electron/app-paths-bootstrap.ts` 在 `setPath('userData')` 後立即 `logger.init`，並呼叫 `installEarlyCrashCapture()`（`electron/early-crash-log.ts`）。**不得**在 main.ts handler 之前註冊 `uncaughtException` / `unhandledRejection` listener：前者會關掉 Electron 預設錯誤對話框，後者會抑制 rejection warning。
- **單一 userData 目錄**（BUG-119，T0480 起）：所有資料在 `<appData>/BetterAgentTerminal[-runtime-<N>]/`。**開發規則**：① `app-paths-bootstrap` 必須維持 `main.ts` 的**第一個** import，且它只 import `electron` / `path` / `./userdata-migration` / `./logger` / `./early-crash-log` / `./early-path-fix`（`electron/__tests__/app-paths-bootstrap-order.test.ts` 靜態守住）；② 任何模組**不得在 import 期**呼叫 `app.getPath('userData')`（含模組層級單例的建構子），一律在函式內 lazy 取值（範本：`snippet-db.ts` 的 `dataPath` getter）。
- **GPU 狀態日誌 `[gpu]`（T0533 / BUG-136）**：`electron/gpu-status-log.ts`，只記錄、不改任何繪圖行為；判讀方式見 docs。T0669（BUG-164）：macOS 預設 `--disable-skia-graphite`（`decideSkiaGraphite`，逃生口 `BAT_SKIA_GRAPHITE=1`；🔴 不得改成第二個 `disable-features`）、GPU 崩潰後可見終端重建，見 [docs](docs/agent-guide/logging.md)。
- **Helper scripts 的 userData**（T0481）：本機 PTY 注入 `BAT_USER_DATA`（`electron/pty-manager.ts` `localHelperEnv()`）；`scripts/_bat-cert.mjs` / `scripts/_bat-logger.mjs` 解析順序：明確 override → `BAT_USER_DATA` → 舊推測。
- **PTY env 唯一組裝點**（T0525 / BUG-131）：`PtyManager.buildPtyEnv()`（`electron/pty-manager.ts`）供首次建立、`pty:restart`、Terminal Server recovery 共用。新增 env 一律改這個函式，不要在分支內聯。`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 只來自 host 的 `helperEnv`（T0575）。
- **塔台派工落點**（T0523 / BUG-129）：落點以 `--notify-id` 塔台所屬工作區為準（`electron/dispatch-workspace.ts`），`--workspace` 為 fallback；cwd 檢核 `checkDispatchCwd`（T0527，cwd 只做檢核，不是落點規則）；`--agent` 簡寫 `normalizeAgentAlias`（`electron/terminal-command-handlers.ts`）。
- 完整說明（日誌位置細節、early crash capture、`[gpu]` 判讀、userData migration、helper env 解析順序、派工 cwd 檢核規則）：[docs/agent-guide/logging.md](docs/agent-guide/logging.md)

## Detached workspace 視窗的持久化（T0453 / T0491）

- detached 視窗沒有自己的 registry entry：`workspace:load` 回父視窗 entry（`loadDetachedWorkspace`，`electron/main.ts`），`workspace:save` 只把該 detached workspace 的終端清單合併進父 entry（`saveDetachedWorkspaceTerminals`，`electron/window-registry.ts`）。🔴 不要改回「detached store 覆寫父 entry」（BUG-113 前的問題）。
- detach 期間終端清單歸 detached 視窗所有（`DetachedTerminalOwners`）；關閉後 main 先 `windowRegistry.whenIdle()` 再送 `workspace:reattached`，父 renderer 以 `workspace:adopt-detached` 取回。
- `WindowRegistry` 的寫入共用一個序列化佇列；同一 entry 的讀改寫請用 `updateEntry`，不要 `getEntry` → 改 → `saveEntry`。
- 關窗前 flush（T0504）：`flushBeforeClose` / `createRendererFlusher`（`electron/renderer-flush.ts`）。🔴 live 的 detached 視窗在自己的 `closed` 之前不得從 `detachedWindows` / `detachedWindowRecords` 移除（否則它的 flush-save 會被當成未知 sender 丟棄）；`workspace:reattach` 與最後一個主視窗關閉都只 `close()`。
- 再 detach（T0508）：遇到同 workspace 的視窗還在關閉（`DetachedTeardowns`）會先等它結束；🔴 等待迴圈最後一次檢查到 `detachedWindows.set()` 之間不得有 await。
- detached 的「開啟設定」經 `workspace:open-settings-in-parent`（`electron/detached-open-settings.ts`）。🔴 不要改成在 detached 視窗開 Settings：`settings.json` 由各 renderer 以整份記憶體副本 `save()`，main 沒有變更廣播，多一個編輯者會互相覆寫。
- 完整規則、quit 對話框互動、驗證清單：[docs/agent-guide/detached-workspace.md](docs/agent-guide/detached-workspace.md)

## 工作區層級 Agent / 啟動參數（PLAN-040 / T0529，D142）

- 資料：`Workspace.defaultAgent` / `Workspace.agentCustomArgs`（`src/types/index.ts`），入口 `src/components/WorkspaceEnvDialog.tsx`，store `setWorkspaceDefaultAgent` / `setWorkspaceAgentCustomArg`（每次變更立即 `save()`）。
- 查找順序唯一實作 `src/lib/agent-launch-settings.ts`（renderer 與 main 共用，不要在 consumer 內聯）：預設 agent = 工作區 → Settings → `claude-code`（D140，不得改成沿用塔台自己的 agent）；啟動參數以 preset 為單位，工作區有 key（含空字串）即整串取代全域。
- consumer 一律經 `workspaceStore.getEffectiveDefaultAgent()` / `getEffectiveAgentArgs()`。🔴 不要再直接用 `settingsStore.getAgentCustomArgs` 或 `workspace.defaultAgent || settings.defaultAgent`（`src/components/__tests__/workspace-settings-dialog.test.tsx` source guard）。
- helper 派工套用落點工作區的生效參數（main 讀 `findWorkspaceAgentSettings`，`electron/dispatch-workspace.ts`）；raw command 模式不加參數；detached 視窗唯讀；headless 派工沒有工作區層級。
- 完整規則、遠端行為、驗證清單：[docs/agent-guide/workspace-agent-launch.md](docs/agent-guide/workspace-agent-launch.md)

## Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145）

- **契約**（PLAN-041「介面契約」，CT-T011 依此撰寫，不得單方更改）：`node "$BAT_HELPER_DIR/bat-terminal.mjs" --close-worker T#### --notify-id "$BAT_TERMINAL_ID" [--delay-ms <n>]`；exit `0` 已排程 / `3` NOT_FOUND / `4` NOT_OWNER / `5` AMBIGUOUS / `6` BUSY（只留供舊 BAT 相容）/ `1` 用法錯誤、連線失敗、BAT 太舊。
- 唯一實作：`terminal:close-worker` → `WorkerCloseScheduler`（`electron/close-worker.ts`），本機與 headless 共用；只由 helper 經 RemoteServer 呼叫。不加 Settings 開關（D144）。
- 等安靜（T0545 / D145）：延遲期間的輸出不取消；到期後等連續安靜 `CLOSE_WORKER_IDLE_MS` = 5 s，最多再等 `CLOSE_WORKER_MAX_QUIET_WAIT_MS` = 60 s。只有排程後的使用者輸入取消；終端自動回應（`isTerminalAutoReply`，T0551）不算輸入。
- 歸屬：Worker 的 `customEnv.BAT_TOWER_TERMINAL_ID`；BAT 重開後經 `withSavedWorkerOwnership`（`electron/worker-ownership.ts`，T0537）以已存分頁判斷。歸屬只來自 BAT 視窗存的資料，不接受請求參數宣告。
- 關閉路徑：`App.tsx` `ownsTerminalForCloseRequest` → `workspaceStore.closeTerminalNow(id, { cleanWorktree: false })`；✕ 也走 `closeTerminalNow`。🔴 改 ✕ 行為時同步看 `src/stores/__tests__/workspace-store.closeTerminalNow.test.ts`（含 T0535 前邏輯的對照與 source guard）。
- 分頁標示與手動批次關閉（T0538）：已回報比對唯一實作 `findReportingWorkers`（`src/stores/workspace-store.ts`）；批次關閉的頁內確認 `.worker-batch-close-dialog`（列出工單編號 + 標題，🔴 不得改用 `window.confirm`）。
- 等使用者 / 等塔台答覆（T0609 / BUG-153）：Worker 標籤 ⚠️（hook `blocked`，T0623 起含 codex `input`）/ `?`（塔台問題，或舊 CT 通知結尾 `提問` → `workerQuestion`）/ `✓`，提問與 blocked **不計入**批次關閉；判斷唯一實作 `workerAttention`（`src/lib/terminal-attention.ts`），主行程推送 `terminal:attention-changed`（`TerminalAttentionNotifier`，`electron/terminal-attention.ts`，只含狀態欄位、不含問題內容）。
- 外部建立分頁的標題（T0553）唯一實作 `externalTerminalTitle`（`src/lib/external-terminal-title.ts`）；使用者改名後一律不動。
- 完整契約、取消規則、日誌、已知限制、遠端 headless、驗證清單：[docs/agent-guide/worker-tab-recycle.md](docs/agent-guide/worker-tab-recycle.md)

## worktree 隔離派工（PLAN-047 W1 / T0583，D150 / D152）

- **契約**（T0583「介面契約」，CT-T015 / CT-T016 依此撰寫，不得單方更改）：派工 `bat-terminal.mjs … --skill ct-exec|ct-done --workorder T#### --isolation worktree`；回收 `bat-terminal.mjs --close-worker T#### --notify-id … [--delay-ms n] [--worktree keep|remove|archive]`。失敗 → `WORKTREE_FAILED`、helper exit **7**、不建立分頁。不帶 `--isolation` = 不隔離（D152 預設關）。
- 唯一實作 `electron/ct-worktree.ts` `CtWorktreeService`（本機與 headless 共用、不 import electron）；位置 `<主 checkout 上層>/.bat-worktrees/<主 checkout 目錄名>/<T####>`（`ctWorktreeLocation`），分支 `ct/<T####>`。與 `WorktreeManager`（Agent 面板）無關。
- git 一律 `execFile('git', [...])` + timeout，`GIT_TERMINAL_PROMPT=0`。🔴 **Windows 一律帶 `-c core.longpaths=true`**（T0583 實測 git 2.56.0.windows.2：worktree 內路徑 > 260 字元時，沒帶旗標的 `worktree add` 以 `Filename too long` 失敗且**分支已建立**；`status` / `worktree remove` 把長路徑檔看成已刪除，乾淨的 worktree 會被當成髒的而不刪）。
- 派工流程（`createWithCommand`，`electron/terminal-command-handlers.ts`）：參數 / cwd 檢核 → Recovery create hold → 建立 / 沿用 worktree → `ptyManager.create`；隔離派工不經 `invokeHandler`；`terminal:create-with-command` 帶 `isolation` 一律拒絕。`CT_HOME` / `CT_WORKTREE` / `CT_WORKTREE_BRANCH` / `CT_WORKTREE_BASE` 由主行程加，呼叫者 `customEnv` 的同名鍵被丟掉。
- 回收清理在分頁實際關閉後才做（`WorkerCloseScheduler` 的 `cleanupWorktree` dep）；`remove` 不加 `--force`，有未提交 / 未追蹤變更不刪；`archive` 改名 `ct-archive/<T####>`。BAT 不合併、不跑依賴安裝（D152）。
- 完整契約、命名規則、輸出、持久化、已知限制、驗證清單：[docs/agent-guide/worktree-isolated-dispatch.md](docs/agent-guide/worktree-isolated-dispatch.md)

## worktree 狀態查詢（PLAN-047 W1 / T0585）

- 用途：塔台決定合併順序 / 能否 `--ff-only` / 是否派合併工單（D150：BAT 只提供唯讀信號，不合併）。唯一實作：git 查詢 `CtWorktreeService.status` / `statusFromGit`（`electron/ct-worktree.ts`），handler `registerWorktreeStatusHandler`（`electron/worktree-status-handlers.ts`），本機與 headless 共用；只供 helper 經 RemoteServer 呼叫。
- **契約**（T0585「介面契約」，T0584 的 `bat_worktree_status` 與 CT 依此撰寫，不得單方更改）：channel `worktree:terminal-status`，參數 `{ terminalId?, workorder? }`（擇一；都沒給 = 自己）；helper `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --worktree-status [<T####> --notify-id "$BAT_TERMINAL_ID"]`，stdout 一行 JSON，exit `0` / `3` NOT_FOUND / `4` NOT_OWNER / `5` AMBIGUOUS / `1` 其他。
- 範圍沿用 `authorizeHelperQueryTarget`（T0582）。分頁關閉後（T0589）依序 `live` → `exited`（結束紀錄 10 分鐘 / 32 筆）→ `git`（只限 `workorder` 參數 + tower 權杖 + 呼叫者 PTY 仍在執行），回傳 `source` 標明來源。
- 唯讀：只有 `merge-tree --write-tree` 寫入物件庫，`status` 帶 `--no-optional-locks`；不 checkout / merge / commit / 改分支。
- 給合併判準（CT-T016）：可直接 `git merge --ff-only ct/T####` 的條件 = `behind == 0` 且 `dirty` 為空；其餘判斷見 docs。
- 完整欄位、`affects_files` 解析、快取、耗時、已知限制、驗證清單：[docs/agent-guide/worktree-status.md](docs/agent-guide/worktree-status.md)

## 塔台分頁標題（T0562，D147）

- **契約**（T0562「介面契約」，CT-T013 依此撰寫，不得單方更改）：`"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --set-role tower [--mode yolo|ask|off|on] [--terminal-id <id>] [--agent <id>]`；exit `0` 已處理 / `3` NOT_FOUND / `1` 其他；不帶 `--mode` 不清除已記錄的模式。
- 主行程 `terminal:set-role`（`electron/terminal-role.ts` `setTerminalRole`，本機與 headless 共用）把 `role` / `towerMode` 記在 `PtyInstance` 並送 `terminal:role-changed`；主行程不判斷標題。
- yolo 判定唯一實作 `PtyManager.isYoloTerminal(id)`：塔台宣告優先，否則看 `customEnv.CT_MODE`。不持久化。
- 標題唯一實作 `src/lib/tower-terminal-title.ts`（`<Agent 顯示名> · Tower`），只在 `isDefaultTerminalTitle` 為真時套用（使用者命名優先）。🔴 BAT 程式碼替分頁命名一律用 `workspaceStore.setAutoTitle`；`renameTerminal` 專指使用者改名（`MainPanel` 雙擊），會清掉 `autoTitle`（`workspace-store.towerRole.test.ts` source guard）。
- 完整契約、預設標題清單、遠端行為、驗證清單：[docs/agent-guide/tower-tab-title.md](docs/agent-guide/tower-tab-title.md)

## 用量限制自動繼續（PLAN-044 / T0566，D148）

- 規格（D148）：只對 yolo 分頁自動動作，Settings 開關**預設關**（關閉時完全不偵測、不提示、不送）。Codex：重置後輸入 Settings 文字（預設 `繼續`）+ Enter；非 yolo 分頁只提示。
- **claude**：🔴 **絕不送文字**（CLI 2.1.234 起內建 `autoContinueAtUsageLimit`，雙送會產生兩個續行 turn）。
- 辨識唯一實作 `src/lib/usage-limit.ts`（main / headless / renderer 共用、不 import electron / DOM）；句型取自 CLI 二進位、無實測樣本，CLI 改字串時需同步改此檔與測試。
- 排程 `UsageLimitContinueScheduler`（`electron/usage-limit-continue.ts`，本機與 headless 共用）；使用者輸入取消；連續自動送出上限 2；`pty:write` 第三參數 `{ auto: true }` 不算使用者輸入。設定讀取唯一入口 `normalizeUsageLimitConfig`。
- 完整規格、句型、排程與取消、送出路徑、日誌、已知限制、驗證清單：[docs/agent-guide/usage-limit-continue.md](docs/agent-guide/usage-limit-continue.md)

## Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）

- Dialog / modal 只經 [X] / 確認 / 取消（與 Esc）關閉；點遮罩、從 Dialog 內拖曳到外部放開都不關閉。選單 / popover 照舊點外部關閉。
- 遮罩一律用 `ModalOverlay`（`src/components/common/ModalOverlay.tsx`，型別上沒有 `onClick`）。🔴 新增 Dialog 請用它，且必須有 [X] 或取消按鈕（app 通知原本只有 OK，T0563 補了 [X]，`aria-label` = `common.close`）。不要在遮罩元素上掛 `onClick` / `onMouseDown`。
- Esc 一律經 `ModalOverlay` 的 `onEscape`（確認類 = **取消**），由 `src/components/common/modal-stack.ts` 統一處理，只作用於最上層。🔴 Dialog 不得自己加 `keydown` listener 關閉（T0567 前 Profiles / 工具安裝確認各自掛 window listener，已移除）。
- 🔴 新增 Dialog 要給 `onEscape`；刻意不給的要加進 `dialog-escape.test.tsx` 的 `NO_ESCAPE_DIALOGS`（source guard 逐檔計數）。
- 沒有 `onEscape` 的 Dialog（`RecoveryPrompt`、setup wizard）擋下 Esc。
- 完整清單、Esc 規則細節、驗證清單：[docs/agent-guide/dialog-close-and-escape.md](docs/agent-guide/dialog-close-and-escape.md)

## 終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）

- 分頁內程式開了滑鼠追蹤（`terminal.modes.mouseTrackingMode` 為 `x10` / `vt200` / `drag` / `any`）時不開 BAT 的 複製 / 貼上 選單；Shift + 右鍵一律開。判斷唯一實作 `shouldShowTerminalContextMenu`（`src/lib/terminal-context-menu.ts`）。
- 🔴 不改 xterm 寫進 PTY 的滑鼠回報；只決定 BAT 選單要不要出現。Claude / Codex 面板、縮圖、檔案樹等其他右鍵選單不受影響。例外（T0672 / BUG-166）：追蹤中 BAT 剛送出的回報被 shell 回顯成文字時，於本機 xterm `terminal.write` DECRST 關閉追蹤（🔴 不寫 PTY、不自動離開 alt screen）；追蹤中的選單另有「重設滑鼠模式」，alt screen 時有「離開替代畫面」。偵測唯一實作 `MouseReportEchoDetector`（`src/lib/mouse-tracking-reset.ts`），接在 TerminalPanel 的 `onData` / `writeOutput`。
- 選單開著時的 Esc（T0569）：`shouldCloseTerminalContextMenuOnKey`（同檔，經 `attachCustomKeyEventHandler`）；選單沒開時 Esc 照常送進 PTY。
- 追蹤中的 Shift + 拖曳選取（T0571 / T0573）：`MouseReportSelectionKeeper`（同檔）、TerminalPanel 的 `registerCsiHandler` 偵測重送的追蹤 DECSET、`SelectionDrag.resume()`。實機再失敗時先看 `[terminal-context-menu] … shown:` 診斷日誌。
- 完整原因分析、實測、驗證清單：[docs/agent-guide/terminal-context-menu.md](docs/agent-guide/terminal-context-menu.md)

## 新 PTY 的初始尺寸（T0572 / BUG-145）

- host 一律以 120x30 spawn（`PtyManager.create`、Terminal Server）；`pty:resize` 對 host 還不認得的 id 直接丟棄。分頁先進 store（TerminalPanel 掛載即送第一次 resize），`pty:create` 要等 shell 查詢等非同步步驟後才到 host，所以那次 resize 可能被丟；TerminalPanel 的 resize 去重（`lastSentCols` / `lastSentRows`）之後不再送同一尺寸。⏻ 重啟（`pty:restart`）的新 PTY 同樣是 120x30，去重也擋住重送（修正前 100% 停在 120x30）。
- 修正：`createPtyWithReplay` 在 `{ ok, created: true }`、`restartOrCreatePty` 在 restart 成功時呼叫 `requestPtySizeSync(id)`（`src/lib/pty-replay.ts`）；TerminalPanel 的 sink 重設去重，分頁 active 時立即 `doResize()`，hidden 時等下次 activation 送出。`created: false`（PTY 已在跑）不重送；未掛載的分頁不保留請求（掛載後第一次 resize 時 PTY 已存在）。新建 PTY 一律經這兩個函式，不要直接呼叫 `pty.create` / `pty.restart`。
- 已知限制：Terminal Server recovery（`handleServerDeath` 重建）以 120x30 重建，renderer 不知道，直到下一次 resize / 重繪；背景（未 active）分頁本來就不 fit，其 PTY 在第一次切到該分頁前維持 spawn 尺寸（例如外部建立、尚未切過去的分頁；本單未改）。
- 驗證：`src/__tests__/terminal-pty-size-sync.test.tsx`；e2e `e2e/t0572-new-pty-initial-size.spec.ts`（隔離實例：還原分頁、4 個新分頁、⏻ 重啟，分頁內 node 腳本記錄 `process.stdout.columns` / `rows`，與工具列重繪後的 xterm 尺寸比對；需先 `npx vite build`）。

## 關閉分頁時的程序樹（T0540 / PLAN-042）

- direct 模式：`PtyManager.kill` 後 Windows 另跑 `taskkill /F /T /PID <shell>`。Terminal Server 模式：`endPty`（`electron/terminal-server/server.ts`）在 Windows **先** `killProcessTree`（`electron/terminal-server/process-tree.ts`）**再** `pty.kill()`；順序不可對調（shell 先死就找不到孫程序）。
- server `shutdown()` 等全部 taskkill 結束後才清 pid / port / registry 檔並 `exit(0)`。
- quit Step A（Windows）：`stopTerminalServerGracefully`（`electron/main.ts`）對 fork 出的 server 改送 IPC `server:shutdown`。🔴 不要改回 `child.kill('SIGTERM')`：Windows 上那是 TerminateProcess，server 的 SIGTERM handler / shutdown 都不會執行（實測 detached 孫程序殘留）。
- ⏻ 重啟已結束的分頁（T0539 / BUG-137）：`restartOrCreatePty`（`src/lib/pty-replay.ts`）。
- 完整實測、macOS / Linux 行為、驗證清單：[docs/agent-guide/pty-process-tree.md](docs/agent-guide/pty-process-tree.md)

## Recovery 提示期間的 `pty:create`（T0578 / BUG-146）

- BAT 重開、Terminal Server 存活且有 PTY 時，main `ptyManager.holdCreates(...)`；`pty:create` handler（`electron/handlers/pty.ts`）在 hold 中等 `whenCreatesReleased`。🔴 Recovery 提示回答前不得 spawn direct shell：此時 PtyManager 尚未連上任何 Terminal Server，T0578 前的 create 走 direct node-pty，同 id 在 Electron 主程序下另起一個 shell（選「保留」後仍存活，輸出併入同 id；T0578 隔離實例實測 `pwsh.exe` 1 個）。
- 放行：「保留」→ `releaseCreatesOnReplayList()`（存活 id 冪等 skip，`created: false`）；「重新開始」→ `waitForTerminalServerExit` 後才刪檔、fork 新 server，再 `releaseCreates(...)`。
- helper 派工（T0580）：`createWithCommand` 最多等 `HELPER_CREATE_HOLD_WAIT_MS` = 2 s，仍未放行 → `RECOVERY_PENDING`，之後也不建立。🔴 不要改成無限等待：helper 逾時 exit 1 後 Worker 仍會在回答後建立，塔台以為失敗而重派 → 同一工單兩個 Worker。
- 沒有 hold 時（無存活 server / 0 個 PTY / direct / headless）行為不變。
- 完整流程、T0576 對照、日誌、驗證清單：[docs/agent-guide/recovery-create-hold.md](docs/agent-guide/recovery-create-hold.md)

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
- 19 configurable items (`STATUSLINE_ITEMS` in `src/types/index.ts`) with custom colors, zone alignment, and template-based config.
- Usage polling: Chrome session key (primary, lenient rate limits) → OAuth fallback (strict rate limits).

## Claude Agent SDK / CLI

- 版本：`@anthropic-ai/claude-agent-sdk` `^0.2.111`（實裝 `0.2.113`，刻意留在 0.2 線：0.3 移除 V2 session API，D123）、`@anthropic-ai/claude-code` `^2.1.300`（含 8 個 `@anthropic-ai/claude-code-*` 平台子套件）。
- 🔴 **服務端以 CLI 版本擋新模型**：CLI 太舊時 API 回 `400` + `error_code: "claude_code_version_too_old"`（原文例：`Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required`）。目前門檻：Opus 5.5 需 `>= 2.1.280`、Fable 5.1 需 `>= 2.1.251`（T0368 實測；門檻由服務端逐模型設定，隨時可能擴及其他模型）。⇒ **內嵌 CLI 落後即功能故障**，每次預覽版發布前應 `npm view @anthropic-ai/claude-code version` 追版。Claude 面板以 `src/lib/claude-error-classify.ts`（`classifyClaudeError`）辨識此錯誤，在原訊息後附 i18n 提示（`claude.claudeErrorHintCliTooOld*`：升級 BAT，或切 system runtime 並升級系統 claude），`claude:error` IPC 簽章不變（T0372）。
- 模型清單 `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）；5 系列原生 1M context，不加 `[1m]` 變體；新增 5 系列模型時同步補 `MODEL_LIMITS`（`estimateModelLimits()`）與 `electron/__tests__/claude-model-limits-and-call-usage.test.ts`。
- 計價唯一 `src/lib/model-pricing.ts`（`getModelPricing()` 以 `includes` 比對，**point release 必須排在 base model 之前**；新增模型時同步補 `src/lib/__tests__/model-pricing.test.ts`）；Cache History 邏輯 `src/lib/cache-history.ts`。
- `EFFORT_LEVELS` + `EffortLevel` 集中宣告於 `src/types/index.ts`，新增成員時只改 const。
- 完整模型 / 計價 / Cache History / effort 說明：[docs/agent-guide/claude-agent-sdk-cli.md](docs/agent-guide/claude-agent-sdk-cli.md)

### Claude Runtime Selection (PLAN-027, v2.1.49+)

- 預設內嵌 claude CLI；`Settings → Advanced → Claude Runtime` 可切系統 claude（`fallbackToEmbedded` 預設開）。設定只影響新開的 session 與新開的終端。
- runtime router 讀設定的唯一入口 `resolveClaudeRuntime()`（`electron/claude-runtime-router.ts`）；內嵌 binary 位置 `resolveEmbeddedClaudePath` / `embeddedClaudeCandidates`（Windows 一律 `bin/claude.exe`；mac / Linux 打包版用平台子套件，BUG-118）。
- fallback 條件、常見故障表、跨平台安裝：docs 檔同節與 `docs/plan-027-cross-platform-verification.md`。

### Embedded claude auto-update 停用（BUG-059）

- embedded 與 system 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`；`DISABLE_UPDATES=1` 只給 embedded，**system runtime 絕不注入**，決策集中在 `claudeUpdateGuardEnv(source)`（`electron/claude-resolver.ts`）。**不可**比照 `DISABLE_AUTOUPDATER` 寫進全域 `process.env`。
- 注入點、已知缺口與副作用：[docs/agent-guide/claude-agent-sdk-cli.md](docs/agent-guide/claude-agent-sdk-cli.md)

## Electron Runtime

- 本專案使用 Electron 41.x（Node 24、Chromium M146）；於 PLAN-016 Phase 2 從 Electron 28.3.3 升級（EXP-ELECTRON41-001 CONCLUDED）。
- native modules（Electron ABI 145）：目前沒有任何原生模組需要針對 Electron 重建。`@lydell/node-pty`、`@kutalia/whisper-node-addon` 都直接使用上游 prebuilt binary。`sharp`（含 `@img/*`）只是 devDependency，給 `scripts/generate-icons.js` 用，桌面 app 與 server bundle 都不打包（T0503）。T0492 移除了 app 與 server bundle 都沒用到的 `better-sqlite3`，postinstall 裡的 `electron-rebuild -f -w better-sqlite3`（T0473）也一起刪掉。T0492 在乾淨的 `npm ci` 上跑 `npx @electron/rebuild`：win32-x64 與 linux-x64 都是 0 個模組要重建，因為 prod 樹裡已沒有任何套件在根目錄放 `binding.gyp`（`sharp` 的在 `src/` 底下，不會被掃到）。CI 桌面 build job 的 `npx --yes @electron/rebuild` step 仍保留，原因是 darwin-arm64 host 沒有實測，留著當保險（現在等同 no-op）。日後若新增需要 Electron ABI 的原生模組，要加回 postinstall rebuild（不經 `npm rebuild`，見下節「根 `postinstall`」），並把它列進 `verify-native-modules.js`。**不要**用 `npm rebuild <pkg>` 重建這類模組：它會重跑套件的 install script，`prebuild-install` 預設 `runtime=node`，下載回來的是 Node ABI 的 prebuilt，反而造成 `NODE_MODULE_VERSION mismatch`（T0473 以 npm 11.19.0 實測過）。
- BAT 內執行 `npm run dev` 需確認 `ELECTRON_RUN_AS_NODE` 未被污染（見 BUG-038 / T0161）。若 renderer 無法啟動且 log 出現 `ELECTRON_RUN_AS_NODE=1`，清除該環境變數後重試。
- electron-builder 26.x（2026-04-18 PLAN-005 / EXP-BUILDER26-001 CONCLUDED，原 24.13.3 → 26.8.1，清除 9 個 Group A CVE，見 PLAN-003 Group A）。

## 本機開發：npm 12 install scripts（T0471 / T0473）

- npm 12 預設擋相依套件的 install scripts（`npm ci` 仍 exit 0，只在結尾警告）。`package.json` `allowScripts` 以 name-only entry 放行 `electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code`。
- `electron-winstaller` 與 `fsevents` 刻意不列入、也不寫 `false`（npm 11 / CI 會遵守 `false` 而跳過它們的 script，改變 CI 行為）；`npm ci` 結尾列出它們屬預期。
- **`allowScripts` 是政策**：新增帶 install script 的相依時，放行或拒絕需塔台決策；不要用 `npm install-scripts approve --all` 或 `--dangerously-allow-all-scripts` 一次放行。
- 日後要加回 postinstall rebuild 時直接執行 `@electron/rebuild` 的 `cli.js`，不經 `npm rebuild`。
- 背景、手動補跑表、本機打包、CI 與 actions / runner 版本：[docs/agent-guide/npm12-install-scripts.md](docs/agent-guide/npm12-install-scripts.md)

## Build Toolchain

- Vite 7.x + `@vitejs/plugin-react` ^5、`vite-plugin-electron` ^0.29.1、`vite-plugin-electron-renderer` ^0.14.6；新增構建設定時留意 vite 7 移除的 API。下次升級 vite 8 等 `vite-plugin-electron@1.0.0` GA。
- 完整說明：[docs/agent-guide/build-toolchain.md](docs/agent-guide/build-toolchain.md)

### electron-builder 26 migration notes

- `mac.notarize` 為 boolean，認證資訊從 `APPLE_*` 環境變數讀取。mac 只打 arm64 dmg（D136，不支援 Intel Mac）；**不要改成 `"universal"`**（D057）。
- 環境變數組合、Windows 打包驗收、arch 決策原因：[docs/agent-guide/build-toolchain.md](docs/agent-guide/build-toolchain.md)

## Remote 資安（PLAN-018 T0182）

- Remote server 以 `wss://` + 自簽憑證（`electron/remote/certificate.ts`），client 以 SHA-256 fingerprint（TOFU）驗證。憑證 `app.getPath('userData')/server-cert.json`，**不要手動刪除**（既有 client 全部失效）。
- Bind-interface：`localhost`（預設）/ `tailscale`（fail-closed，不 fallback）/ `all`。Token `server-token.json` 以 `safeStorage` 加密。`selfsigned@^5.x` 是 async API。
- SSH target（T0505）：`buildBaseSshArgs`（`electron/remote/ssh-args.ts`）；SSH 與 WSL 的 bundle 安裝共用 `electron/server-bundle-install-script.ts`（乾淨覆蓋、刪除白名單、精靈升級的 rollback，T0552 / T0554）；WSL 升版沿用 port `pickServerPortForUnit`（`electron/wsl-systemd.ts`）。
- 完整說明（QR payload、ProfilePanel、SSH wizard 安裝 / 啟動 / 取消 rollback、systemd / launchd 參數）：[docs/agent-guide/remote-security.md](docs/agent-guide/remote-security.md)

## 遠端 Tower 通知（PLAN-036 K）

- 遠端視窗（WSL / SSH / Docker）的 Tower 與本機一樣能派單、Worker 能回報。方案 A'（T0420 / D134）：為**每個 PTY** 簽發範圍權杖（`batcap.`），**server token 永不進 PTY env**；本機 PTY 自 T0575 起同樣（D149）。
- 唯一實作 `electron/remote/helper-capability.ts`：`HelperCapabilityRegistry`、`HELPER_CHANNEL_ROLES`（本機與 headless 共用）、`authorizeHelperInvoke`、`buildLocalHelperEnv`；遠端 env `buildHeadlessHelperEnv`（`electron/remote/headless-entry.ts`）。權限預設拒絕：tower 可派工 / `--close-worker` / `--set-role`，worker 只能 notify / `pty:write` / keypress 到綁定的塔台；T0607：worker 可 `question:ask` / `cancel`（目標固定綁定的塔台），tower 可 `question:answer`（`towerId` 須是自己），兩者皆可唯讀 `question:list` / `wait`。
- 本機權杖跨 BAT 重開保留（T0576）：`<userData>/helper-capabilities.json` 只存 SHA-256 digest，不含 token；token 不寫檔、不記日誌。
- 遠端呼叫 helper 用 `"${BAT_HELPER_NODE:-node}"`（遠端 PATH 不一定有 `node`）。
- **helper 回應必須以 frame id 比對**（BUG-114）：等待 `auth-result` / `invoke-result` 時只接受 `frame.id === 送出的 id`；新增 helper 腳本時沿用此規則。helper 測試須設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp。
- 完整 env、權杖範圍表、生命週期、限制、驗證清單：[docs/agent-guide/remote-tower-notify.md](docs/agent-guide/remote-tower-notify.md)

## helper 唯讀查詢 channel（PLAN-047 M1 / T0582）

- 五個 channel `terminal:whoami` / `terminal:list` / `terminal:get-state` / `terminal:read-output` / `terminal:wait`，唯一實作 `electron/terminal-query-handlers.ts`（`registerTerminalQueryHandlers`），本機與 headless 共用；只供 helper 經 RemoteServer 呼叫。
- 身分 = 權杖綁定（`HandlerContext.helper`），不接受參數宣告身分；範圍唯一實作 `authorizeHelperQueryTarget`（`electron/remote/helper-capability.ts`）：worker 對塔台只限 metadata。`list` 的 scope（`mine` / `workspace` / `towers`）誰能用由 `authorizeHelperListScope` 決定；`workspace` / `towers`（T0643）只給已宣告的塔台、只有 metadata，不放寬其他 channel。
- read-output 必經遮罩 `redactTerminalSecrets`（`src/lib/terminal-output-redaction.ts`）；wait 上限 45 s、每呼叫者同時 8 個；稽核 `[helper-query]` 不記輸出內容與權杖。
- 完整契約表、state / cursor 規則、遮罩樣式、shim 須知、已知限制、驗證清單：[docs/agent-guide/helper-query-channels.md](docs/agent-guide/helper-query-channels.md)

## BAT MCP shim（PLAN-047 M1 / T0584）

- `scripts/bat-mcp.mjs` 是 stdio MCP server（零依賴），8 個唯讀 tool 轉接 helper channel，以分頁自己的範圍權杖認證；T0608 起含 `bat_list_questions` / `bat_wait_question`，全部唯讀，問答寫入只走 helper。Settings「BAT MCP」`batMcpEnabled` 預設開（D152）。
- 🔴 日後若新增寫入型 tool，不得開放給 workflow 子 agent（PLAN-054 B4）；新增須另開工單、塔台決策，設計說明子 agent 如何拿不到（理由見 docs「寫入型 tool 的權限政策」）。
- 注入唯一實作 `electron/bat-mcp-launch.ts` `buildBatMcpLaunchArgs`（本機與 headless 共用）：claude 用 `--mcp-config=<file>`（**一定用 `=` 形式**，variadic 參數會吃掉 prompt）；codex 用 `-c mcp_servers.bat.*`，含 `env_vars`（codex 只轉送白名單 env）。🔴 不得改用 `mcp_servers.bat.env = { BAT_REMOTE_TOKEN = "…" }`（權杖值會出現在命令列與日誌）；新增 shim 讀的 env 時同步加進清單。
- 組裝點：renderer `withBatMcpLaunchArgs`（`src/lib/bat-mcp-launch.ts`）、helper 派工 `createAgentPromptCommandBuilder` 的 `batMcpLaunchArgs` dep。🔴 新增 claude / codex 啟動路徑時一律經這兩者之一（`bat-mcp-launch.test.ts` source guard 數 `buildLaunchCommand(` 次數）。
- 派工的 shell 只解析一次：`resolveDispatchShell`（`electron/terminal-command-handlers.ts`）同時決定 PTY 啟動的 shell 與引號 family（沒有持久化 shell 時用 `PtyManager.getDefaultShell()`，BUG-149 / T0593）；🔴 不要在 `createWithCommand` 或 consumer 另行推導（T0598 / BUG-151）。派工指令寫入前打進新分頁的輸入由 `PtyManager.holdInputForDispatch` / `writeDispatchCommand` 移到指令之後（BUG-151）。codex 升版時必跑 `e2e/t0592-codex-tower-worker.spec.ts`。
- 🔴 codex 共用 daemon（T0648 / BUG-159，T0651）：BAT 的 codex 分頁靠非 `features.*` 的 `-c`（`mcp_servers.bat.*`、派工的 `check_for_update_on_startup`）讓 codex 走 embedded，否則 shell 命令與 MCP 拿到 daemon（別的分頁）的 `BAT_*`；`features.daemon_auto_start=false` 擋不住已在跑的 daemon。BAT MCP 沒注入的手動分頁加 `--no-daemon`（codex `>= 0.156.0` 才加，`codexNoDaemonDecision` / `createCodexNoDaemonSupportCheck`），helper 派工不加。codex 升版時查 `tui/src/daemon_startup.rs` `config_exclusion`（[docs](docs/agent-guide/bat-mcp-shim.md)「codex 共用 daemon」）。
- 完整 tool 表、協定、連線、注入條件、日誌、健康檢查、已知限制、驗證清單：[docs/agent-guide/bat-mcp-shim.md](docs/agent-guide/bat-mcp-shim.md)

## blocked 狀態偵測（PLAN-047 M1b / T0590）

- **契約**（T0590「介面契約」，CT 斷點 D 依此撰寫，不得單方更改）：`terminal:get-state` / `terminal:list` / `terminal:wait` 多一個 `blocked`（`blockedReason` = `permission` / `question` / `elicitation`），優先序 `exited` > `blocked` > `working` / `idle`；每個 state 回傳都帶 `blockedDetection`（`hook` / `osc` / `none`），`none` 的分頁永遠不會回 hook / osc 的 reason。T0607 / D156：另有 `blockedReason: tower`（`source: 'question'`，Worker 等塔台答覆，由 BAT 自己的問答 store 判斷，`none` 分頁也會回；優先序在 hook reason 之後），見「Worker 問塔台」節。
- 唯一實作：`TerminalBlockedTracker`、`registerReportHookHandler`（`electron/terminal-blocked-state.ts`）；hook 事件表 `BAT_CLAUDE_HOOKS`（`electron/bat-mcp-launch.ts`），經 `--settings=<dataDir>/bat-mcp/claude-settings.json` 注入（只對 claude-cli，設定檔只有 `hooks`、無權杖）。回報 channel `terminal:report-hook` 的目標永遠是呼叫者自己。
- hook 腳本 `scripts/bat-hook.mjs`：🔴 **不得影響 claude**：一律 exit 0、stdout 不輸出任何東西（`PermissionRequest` / `PreToolUse` 印 JSON 會替使用者做決定）、任何失敗靜默、總時限 `HOOK_DEADLINE_MS` = 1.8 s（stdin 300 ms、連線 1 s、invoke 1 s）。
- 使用者 / 專案設定 `disableAllHooks: true` 時 BAT hooks 也停用。🔴 不得在 `--settings` 寫 `disableAllHooks: false` 反制。
- codex（T0621 / D158，契約 C-1–C-8）：codex `>= 0.163.0` 自己在 PTY 送 OSC 7501（`state=idle|working|blocked|clear`）；`blocked` → `blockedReason: input`（`source: 'osc'`，與 hook reason 同級、優先於 `tower`），`working` / `idle` / `clear` / PTY 結束 / recovery 清除，🔴 使用者輸入**不清除** `input`；第一個序列把 `blockedDetection` 設為 `osc`（已是 `hook` 時忽略）。解析唯一實作 `src/lib/codex-terminal-state.ts`，接在 `PtyManager.enqueuePtyOutput`（🔴 只讀、不改寫輸出）與 `handleReplayBuffer`（BAT 重開補掃），轉換 `TerminalBlockedTracker.observeCodexState`。🔴 不得注入 codex hooks、`-c notify`、`-c tui.*`。
- 完整事件表、清除規則、注入條件、codex 轉換表、日誌、已知限制（含滑鼠回答的清除漏洞）、驗證清單：[docs/agent-guide/blocked-state.md](docs/agent-guide/blocked-state.md)

## Worker 啟動確認（T0600，D154）

- 用途：helper 派工 exit 0 後塔台仍不知 Worker 是否真的啟動（BUG-151）。claude 的 `SessionStart` hook（async、無 matcher）經 `terminal:report-hook` 回報 `session-start`，狀態查詢揭露，helper 加 opt-in 等待。
- **契約**（T0600「介面契約」，CT 依此撰寫，不得單方更改）：`terminal:get-state` / `terminal:list` / `terminal:wait` 每個 state 回傳多 `agentStarted: true | false | null`（`true` 時 get-state / wait 另回 `agentStartedAt` ms；`null` = `blockedDetection: none`，無法判定，**不得**當成啟動失敗；T0621：`osc` 分頁以第一個 OSC 7501 為準，之前 `false`）；`terminal:wait` 多 `until: 'agent-started'`。helper `bat-terminal.mjs … --notify-id "$BAT_TERMINAL_ID" --wait-started <ms>`（上限 120000，必須帶 `--notify-id`）：stdout 最後一行 `  started: <ISO>` exit 0 / `  started: unknown` exit 0（stderr `wait-started: <CODE>`）/ `  started: unconfirmed` exit **8**（stderr `create: LAUNCH_UNCONFIRMED`，分頁不關閉）。不帶參數時輸出與 exit code 完全不變；舊 helper → `Unknown option '--wait-started'` exit 1、不建立分頁。
- 唯一實作：狀態 `TerminalBlockedTracker`（`electron/terminal-blocked-state.ts`，`session-start` 不影響 `blocked`），讀取 `stateOf` / `agentStartedFields`（`electron/terminal-query-handlers.ts`），等待 `runWaitStarted`（`scripts/bat-terminal.mjs`），hook 表 `BAT_CLAUDE_HOOKS`；本機與 headless 共用。
- 生命週期比照 `blocked`：PTY 結束 / restart / Terminal Server recovery 清除（結束紀錄保留 `agentStartedAt`），使用者輸入不清除，只記每個 PTY 第一次 `SessionStart`。
- claude 自己的設定關閉 hooks（managed / 使用者設定檔的 `disableAllHooks`、managed 的 `allowManagedHooksOnly`；`claudeHooksDisabledBy`，`electron/bat-mcp-launch.ts`）→ 參數照注入、分頁記 `blockedDetection: none`。🔴 hook 腳本規則沿用 T0590（exit 0、stdout 不輸出：`SessionStart` 的 stdout 會進對話上下文；不送 `source` 等 payload）。
- 方案 B（只記日誌）：派工指令寫入後 10 s 內輸出含 `command not found` 等 → `[agent-command] launch-suspect`（`LaunchSuspectWatcher`）。
- codex（T0621 / D158）：helper 派工的 codex 先 `codex --version`（`createCodexOscVersionCheck`，`electron/codex-osc-version.ts`：`execFile` + 5 s timeout，路徑 + mtime 快取）；`>= 0.163.0` → 啟動即 `blockedDetection: osc`（`--wait-started` 可回 `started` / `unconfirmed`），確認不到 → `none`（🔴 回 `unknown`、絕不回 `unconfirmed`）。派工的 codex 命令另加 `-c check_for_update_on_startup=false`（`createAgentPromptCommandBuilder`，自訂參數已設時不加，手動分頁不加）。codex 升版時必跑 `e2e/t0621-codex-osc-state.spec.ts`。
- 完整契約、CT 判斷、版本判定、日誌、實機查證、已知限制、驗證清單：[docs/agent-guide/worker-launch-confirmation.md](docs/agent-guide/worker-launch-confirmation.md)

## Worker 問塔台（PLAN-048 / T0607）

- 用途：yolo Worker 以結構化通道問塔台、等答覆，取代 CT 的工單檔往返（D155 / D156）。
- **契約**（T0606 回報區「介面契約草案」C-1–C-11，CT-T019 依此撰寫，不得單方更改）：channel `question:ask` / `question:cancel`（worker）、`question:answer`（tower，`towerId` 綁定自己）、`question:list` / `question:wait`（唯讀，≤ 45 s）；id `q-<boot>-<rand>`，BAT 重開後回 `lost`；Worker 有 blocking 待答問題時 state = `blocked` / `blockedReason: tower` / `source: 'question'`，每個 state 回傳帶 `pendingQuestions`。
- 唯一實作 `electron/tower-questions.ts`（store + `registerTowerQuestionHandlers`，本機與 headless 共用、不 import electron）；狀態合成在 `terminal-query-handlers.ts` `stateOf`（`getQuestionSummary`）；PTY 結束經 `onPtyExit`、Terminal Server recovery 經 `PtyManagerDeps.onServerRecovery` 取消問題。
- helper（T0608，契約 C-5，唯一實作 `scripts/bat-notify.mjs` / `scripts/bat-terminal.mjs`）：Worker `bat-notify.mjs --ask --source T#### --target "$BAT_TOWER_TERMINAL_ID" [--submit] "T#### 提問" < question.json`（exit `0` / `3` / `10` TOO_MANY_QUESTIONS / `1`；notify 任一步失敗 → 先 `question:cancel` 再 exit 1）、`--wait-answer <id>`（stdout 一行 JSON，任何狀態含 `lost` 都 exit 0）、`--cancel-question <id>`（已結束與 `lost` 也 exit 0：🔴 看 `status:` 行，`cancelled worker` 才是取消了，T0611）；塔台 `bat-terminal.mjs --answer <id> --notify-id "$BAT_TERMINAL_ID" [--choice <n>] < answer.txt`（`0` / `3`（含 `answer: LOST`）/ `4` / `9` CLOSED / `1`）。
- 🔴 BAT MCP 維持全唯讀：只有 `bat_list_questions` / `bat_wait_question`（invoke 逾時 55 s），不得新增問答寫入 tool（D155 / D156），所有 tool `readOnlyHint: true`（`bat-mcp.test.mjs` 斷言）。
- 🔴 問題 / 選項 / detail / 答案只存在主行程記憶體、收件即 `redactTerminalSecrets`，**不寫入任何檔案**；`[tower-question]` 日誌與 bat-scripts.log 只記 id / 長度 / 數量 / 結果，永遠不記內容與權杖。
- 🔴 helper 的問題 / 答案內容只從 stdin 讀（UTF-8、≤ 64 KiB），不得放 argv（helper 把完整 argv 寫進 bat-scripts.log）；helper 日誌只記 id / 長度 / 選項數 / choice / 結果。
- 🔴 使用者在 Worker 分頁輸入**不清除** `tower`、不取消問題（中斷後由 120 s 租約到期 `expired` / `not-polled`）。
- 完整契約、helper / MCP 細節、限制常數、結束原因、日誌、已知限制、驗證清單（含 e2e `e2e/t0611-tower-question.spec.ts`）：[docs/agent-guide/tower-questions.md](docs/agent-guide/tower-questions.md)

## Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）

- 用途：claude-cli 分頁啟動時加 `claude --name=<名稱>`，讓 CT 從 ListAgents 分得出 BAT 的塔台與 Worker。格式唯一實作 `claudeSessionName`（`src/lib/claude-session-name.ts`，main / renderer 共用）：Worker `<ws> · Worker · <T####>`、Tower `<ws> · Tower`（「以塔台開啟 Claude」，T0644）、其他 `<ws> · <短 ID>`；`<ws>` = 工作區 `alias || name` 清理後 ≤ 60 字、整個名稱 ≤ 200 字（從 `<ws>` 截斷）、空 → `BAT`。
- 注入：`buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts`）的獨立一段，只對 `claude-cli` / `claude-cli-worktree`，`--name=` 形式放在 BAT 參數最後。🔴 不受 `batMcpEnabled` 影響、不加 Settings 開關（D167）；名稱由呼叫端算好（renderer `startClaudeCliPty`、helper 派工以落點工作區），一律經 `withBatMcpLaunchArgs` / `createAgentPromptCommandBuilder`。
- 降級（不注入、記原因）：非 claude-cli、自訂參數已含 `--name` / `-n` / 短旗標群組含 `n`（`user-args`）。🔴 system runtime 的 claude `< 2.1.76` 或讀不到版本絕不注入（`claude-too-old` / `version-unknown`，否則 claude exit 1）；檢查唯一實作 `createClaudeNameSupportCheck`（`electron/claude-version-check.ts`，`execFile` + 5 s、路徑 + mtime 快取），embedded 不檢查。
- 記錄：每個分頁實際注入的名稱（或原因）以 terminal id 記在 `claudeSessionNameRecords`（`electron/claude-session-name-record.ts`，與 PTY 分開）。
- 查詢 R3（T0642，契約 C-4 / C-5 / C-8）：`terminal:whoami` / `list` 每列 / `get-state` 多 `claudeSessionName`（注入的名稱）/ `claudeSessionId`（`SessionStart` hook 回報的 UUID，🔴 `null` 不代表沒有 session），結束紀錄保留。sessionId 由 `bat-hook.mjs session-start` 送 `sessionId`（改 T0600 契約，D167；🔴 其餘 hook 規則不變，日誌只記前 8 碼），存在 `TerminalBlockedTracker`；Electron 以 `ClaudeSessionPersistence`（`<userData>/claude-sessions.json`，無權杖）在 BAT 重開、Terminal Server 存活時還原，headless 不持久化。
- 「以塔台開啟 Claude」（T0644）：縮圖列「+」選單，位置在 Claude CLI 下方；開 claude-cli 分頁並記錄 `launchRole: 'tower'`（持久化），`startClaudeCliPty` 依此取名 `<ws> · Tower`，⏻ 重啟與還原沿用。🔴 只命名，不做 `--set-role`、不輸入指令；標題用 `setAutoTitle`（`Claude CLI · Tower`）。
- 列出所有塔台（T0643，契約 C-6，D167 放寬 D149）：`terminal:list { scope: 'towers' }` 只給已宣告的塔台，回同一 BAT host 所有工作區的執行中塔台，每列只有 `id` / `workspaceId` / `workspaceName` / `title?` / `claudeSessionName` / `state` / `alive` / `self`。🔴 不回 `claudeSessionId` / cwd / 輸出 / `towerMode` / `workorder`，那些分頁的 get-state / read-output / wait 仍 `NOT_OWNER`；舊 BAT 回 `INVALID_ARGS`。範圍唯一實作 `authorizeHelperListScope` / `isTowersScopeMember`。
- 完整格式、降級表、headless 行為、日誌、pwsh / cmd(950) / Git Bash 編碼實測、已知限制、T0644 入口、`scope: 'towers'` 契約、驗證清單：[docs/agent-guide/claude-session-name.md](docs/agent-guide/claude-session-name.md)

## 多 remote profile 同時連線（PLAN-039）

- `RemoteConnectionRegistry`（`electron/remote/remote-connection-registry.ts`）取代單一 `remoteClient`：每個 profile 一條連線、一把 mutex。proxied IPC 依 sender 綁定的 profile 路由，無 live 連線即拒絕，不 fallback 本機。
- 寬限 / 上限常數（`IDLE_GRACE_MS` = 15 s、`MAX_CONCURRENT_REMOTE_PROFILES` = 8 等）皆無注入點，測試不得為縮短等待改產品常數；第 9 個 profile 被拒，不擠掉既有連線。
- profile index 序列化（T0509）：`profiles/index.json` 讀改寫一律經 `withIndexLock()`（`electron/profile-manager.ts`）。🔴 鎖內程式碼不得呼叫 `ProfileManager` 公開方法（佇列不可重入，會等自己）；新增方法時建立邏輯用 `addProfileEntry()`。
- 完整生命週期、失敗對話框、e2e 與實機驗收：[docs/agent-guide/multi-remote-profiles.md](docs/agent-guide/multi-remote-profiles.md)

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

- **Squash merge 後打包前必做**：在 main repo 根目錄跑 `npm install`（CI 跑 `npm ci`），否則 native module 可能缺失（BUG-056）。
- **Build fail-fast**：`scripts/verify-native-modules.js`（新增關鍵 native module 時同步更新 `REQUIRED_NATIVE_MODULES`）；**打包產物檢查** `scripts/verify-packaged-native.js`（內嵌 claude 候選規則是 `embeddedClaudeCandidates` 的 JS 複本，改 arch、whisper 目錄規則或內嵌路徑規則時同步改此腳本與 workflow 的 `--arch`）。
- **安裝檔瘦身**（T0546）：`build.files` 以否定 extglob 表示 node_modules 白名單。🔴 **新增執行期依賴**（main 端 `require` 的外部套件，或新的 rollup external）時，把它與其 `dependencies` 閉包加進白名單；`scripts/__tests__/asar-runtime-deps.test.mjs` 以 electron-builder 自己的 matcher 驗證（需先 `npx vite build`，否則跳過 dist-electron 那一項），CI 打包後 `verify-packaged-native.js` 的 `runtime-require` 再驗一次。非字串字面的 require 須登記在 `asar-runtime-deps.test.mjs` 的 `DYNAMIC_REQUIRE_SITES`。
- 🔴 **不得使用 `build.<platform>.files`**：平台層 `files` 的字串會變成另一個只有排除 pattern 的 matcher，electron-builder 自動補 `**/*`，整個 repo（src/、.claude/、dist-baseline/…）被打進 asar（T0546 實測 508 MiB）。平台差異一律用頂層 `files` 的 `${os}`（目標平台 `win` / `mac` / `linux`）與 `${arch}` 巨集；`${platform}` 是**建置主機**的 `process.platform`，不要用
- 不內建 server bundle baseline（D146 / T0547）；Windows 壓縮 `normal`、其他 `maximum`；`build` / `build:dir` 先清 `dist-electron`。
- **Helper bundle fail-fast**：`scripts/verify-helper-bundle.js`。安裝檔的 `resources/scripts` 只收執行期 helper（T0689）：`build.extraResources` 的 scripts `filter` 逐一列檔名（不得用萬用字元），與 `scripts/build-server-bundle.mjs` 的 `serverBundleHelperScripts` 同一組。新增 helper（含它 import 的 `_bat-*.mjs`）兩處都加，再跑 `npm run verify:helpers`；打包後 `verify-packaged-native.js` 的 `helper-scripts` 再驗一次。
- **Test gate**（T0686）：`pre-release.yml` / `release.yml` 的 `tests` job（`uses: ./.github/workflows/tests.yml`，唯讀權杖、不傳 secret）列在 `build.needs`，`test:unit` 或 `test:legacy` 失敗即不 build、不發版。🔴 測試步驟只改 `tests.yml`，不要在兩個發版 workflow 內另寫一份。
- CI 順序、**Typecheck gate**、**Test gate**、**Release 驗收必跑 NSIS 完整重裝**：見 docs 檔。
- 完整說明（打包產物檢查項目、瘦身規則、CI pipeline、產物大小）：[docs/agent-guide/packaging-release-checks.md](docs/agent-guide/packaging-release-checks.md)

### Server bundle baseline（PLAN-031；D146 起安裝檔不內建）

- 安裝檔不內建 baseline；wizard 經 distributor（`electron/remote/server-bundle-distributor.ts`）依序：cache + 自帶 `.sha256` sidecar → baseline（舊安裝檔）→ 下載 `server-bundle-v<版號>`；下載失敗可匯入本機 tarball（`server-bundle:import-local`，`electron/remote/server-bundle-import.ts`）。
- 版號：snapshot 一律去後綴取基底版號（`stripSnapshotSuffix`，SoT `src/lib/snapshot-version.ts`）。
- **bundle 內容限制**：不含 `node_modules/**/.bin/`、sharp / `@img`、`claude-agent-sdk-<platform>`（`verify-server-bundle.js` 擋）。
- 完整說明：[docs/agent-guide/packaging-release-checks.md](docs/agent-guide/packaging-release-checks.md) 同節與 `docs/server-bundle-distribution.md`

## Release

- 正式版 `release.yml`（push `v*` tag 觸發）；預覽版 `pre-release.yml`（**`workflow_dispatch` only**，push tag 不會觸發）：`gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`
- 🔴 **`gh` 一律帶 `-R gowerlin/better-agent-terminal`**：本 repo 有 3 個 remote（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**。不帶 `-R` 時唯讀操作報 404，寫入操作（`gh release create` / `gh pr create`）則是打到別人的 repo。
- 🔴 **`-f version=` 不可留空**：留空會走自動遞增 —— `git tag -l 'v*' --sort=-v:refname | head -n1` → patch +1 → 找未使用的 `-pre.N`（`pre-release.yml:34-55`）。本 repo 有 **257 個 `v*` tag**，橫跨 `v0.x`（本 fork 主線）/ `v2.2.x` / `v4.0.x` 三條版本線，`-v:refname` 排序第一名是 **`v4.0.3-pre.1`**，留空即產出 `4.0.4-pre.1`，與主線完全脫節。判版方式：取**本 fork 主線（`v0.x`）**最新 tag 遞增，不要信排序第一名。
- 完整 workflow 對照、行號、下游發佈：[docs/agent-guide/release.md](docs/agent-guide/release.md)

### prerelease 標記與下游發佈

- `pre-release.yml` 的 GitHub Release 恆為 prerelease；`release.yml` 依 tag 是否含 `-pre`。Homebrew tap / Chocolatey 皆 opt-in、預設跳過（D137）。兩條線都會發 `server-bundle-v<版號>`（D120）。

### Server bundle 是獨立 tag 線

- desktop 線（`release.yml` / `pre-release.yml`）同時發佈 `server-bundle-v<版號>`，是 wizard 首次下載的唯一官方來源，**不可省略**；`build-server-bundle.yml` 手動推 tag 線保留為備援，同一版號不要兩條線都發。
