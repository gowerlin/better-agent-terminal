# Changelog

All notable changes to Better Agent Terminal are documented in this file.

## [Unreleased]

## [0.7.2-pre.3] — 2026-10-30

### Fixed
- 終端縮圖預覽（BUG-175，T0714）：全螢幕介面在 macOS / Linux PTY 以游標定位重繪、不送 `
` 時，預覽停在啟動畫面並露出 `>0q>4m`。預覽層依游標換列分行（換列後第 2 欄以後、少於 8 字的原地更新丟掉；`CSI 2 J`、alt screen 切換重新開始），`stripAnsi` 改認 ECMA-48 完整 CSI 語法；T0667 的上限與 150 ms flush 不變。Windows ConPTY 以 `CSI row;1 H` 跳過空白列時，原本黏成一行的兩列改為兩行。唯一實作 `src/lib/thumbnail-preview.ts`

### Known issues
- 預覽是最近寫出的列，不一定是畫面最下面幾列；跳脫序列被切在兩次 flush 之間時後半段仍可能變成文字；尚未在 macOS 實機確認

## [0.7.2-pre.2] — 2026-10-30

### Fixed
- 終端 `file:///` 連結（BUG-174，GitHub #20，T0713）：範圍改以格子欄位計算（全形字不再讓底線與可點範圍變短、網址前的全形字不再讓起點偏移）；串接 `isWrapped` 續行（上下各 ≤ 20 列），跨行路徑整段是同一個連結；OSC 8 超連結設定 `linkHandler`，只開 `http` / `https` / `file`，其他 scheme 不開並只記 scheme 與長度，滑過時顯示實際目標。唯一實作 `src/lib/terminal-file-links.ts`；`WebLinksAddon` 的 http(s) 連結經測試本來就正確，未改

### Known issues
- 跨行的 OSC 8 連結底線只畫在滑鼠所在列（xterm.js 行為）；遠端視窗的 `file:///` 仍以本機開啟；只有自動測試涵蓋，尚未實機點擊確認

## [0.7.2-pre.1] — 2026-10-30

### Added
- CT 以 plugin（`ct@control-tower`，CT 5.14.0 起）安裝時，Codex Worker 的派工字串依安裝方式決定：分頁 `CODEX_HOME` 下有手動安裝（`skills/<skill>` 或 `~/.agents/skills/<skill>`）→ `$ct-exec`；只有啟用中的 `ct@*` plugin → `$ct:ct-exec`；判斷不了 → `$ct-exec`。唯一實作 `electron/ct-install-detect.ts`，helper 派工與面板一鍵派工（新 proxied channel `terminal:control-tower-prompt`，遠端在回答主機判斷）共用；Claude 字串不變（T0710，BMad-Guide HANDOVER）
- 指揮塔總覽「預設」層找得到 plugin 安裝的 `tower-config.md`；Claude CLI 面板 skill 清單與 `*` 補全列出 `ct@*` plugin 的 skill（與手動同名只列一次）（T0710）
- 指揮塔總覽：Claude / Codex 同時以 zip 與 plugin 安裝 CT 時，提示 `/ct-exec`、`$ct-exec` 使用 zip 那份，版號不同時以警示顯示（`ct:read-config-sources` 選填欄位 `installs`）（T0711）

### Fixed
- 面板一鍵派工給 Codex 的命令 `codex "$ct-exec T####"` 在 pwsh / bash 把 `$ct` 展開成變數；改由主機依分頁 shell 加引號（T0710）

### Changed
- `bat-notify.mjs --help` 補充 `--source` 要和派工 `--workorder` 用同一個 ID
- 單元測試在 Node 25+ 不再讀到 Node 內建的 `localStorage`（`vitest.setup.ts` 改指 jsdom storage；不用 `--no-webstorage`，Node 24 不認得）（T0712）

### Known issues
- Claude 的 plugin 安裝只有自動測試涵蓋；遠端需升級 BAT 伺服器才會依安裝方式判斷；Linux 版本未實機驗證

## [0.7.1-pre.9] — 2026-10-29

### Fixed
- 指揮塔讀不到 CT 檔案（含超過 512 KiB 的 `File too large`）時，臭蟲／待辦／決策三頁不再靜默顯示空清單、工單不再從清單消失：讀取失敗與檔案不存在分開判斷（`readCtFile`），臭蟲、待辦、決策、Epics、Sprint 顯示「無法讀取 <檔名>」（i18n，檔案太大時附 KB 數與上限），讀取失敗的工單以 `UNKNOWN`（no status）列出，封存 BUG／PLAN 讀取失敗列在錯誤訊息；檔案不存在時維持空清單。`fs:readFile` 上限不變（BUG-172，T0708）
- 索引文字與 PLAN 檔補優先級時，`critical` 一律算 High（`extractPriority` / `extractSeverity`），與 frontmatter 路徑一致（BUG-173，T0709）

### Known issues
- 兩項修正只有自動測試涵蓋；Linux 版本未實機驗證

## [0.7.1-pre.8] — 2026-10-25

### Fixed
- 系統時鐘往前跳（Windows NTP 校時、睡眠喚醒）時，Terminal Server 被誤判死亡、所有分頁的 agent 被結束並顯示 `[Process exited with code 1]`（BUG-171）。heartbeat 改用單調時鐘、連續 3 次遲到且 server 程序或 IPC 已不在才 recovery；recovery 以 server generation 丟棄舊 server 的訊息、先結束舊 server 程序樹再 re-fork、孤兒 PTY 先殺程序樹（T0703 研究、T0704）
- Terminal Server 不再把自己的 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES` 帶進每個 PTY 的 env（`buildServerPtyEnv`，T0705）
- ubuntu CI 上 2 項測試失敗（shell 回顯被當成輸出、真 shell 測試逾時），只改測試（T0707）

### Changed
- Terminal Server recovery toast 與 BAT 重開時的 Recovery 提示改走 i18n（en / zh-TW / zh-CN；zh-TW 文字不變）（T0705 / T0706）

### Known issues
- Terminal Server 真的停止時仍只重建 shell，分頁內的 agent 不會自動接回（PLAN-055）；macOS / Linux 只有自動測試涵蓋

## [0.7.1-pre.7] — 2026-10-25

### Added
- 指揮塔「總覽」改為依序顯示塔台狀態、Control Tower 設定、Sprint（只在有 `sprint-status.yaml` 時）。塔台狀態：最後更新（`_tower-state.md` frontmatter 摘要，沒有時取「最後更新」行）、進行中工單（`workOrderPhase`）、下一個編號與待辦（只讀摘要契約 v1：`schema_kind: tower-state`、`summary_version` 整數 ≥ 1，不切 Markdown 章節）。設定：預設（已安裝 CT `tower-config.md` § 可用選項）→ global（`~/.claude/control-tower-data/config.yaml`，舊路徑備援）→ project（`_tower-config.yaml`）三層鍵的聯集、生效值與來源；global / 預設兩層經新的唯讀 proxied channel `ct:read-config-sources`（`electron/handlers/ct-config.ts`，main 與 headless 共用，路徑固定在回答主機的家目錄）。`_ct-workorders/` 內的來源跟既有 `fs.watch` 自動重讀，外部兩層在總覽變成可見與按 ↻ 時重讀（D184，T0701）

### Fixed
- 沒有狀態欄位的工單檔（報告、筆記）不再被 legacy parser 預設為 `PENDING`：新狀態 `UNKNOWN`（`no status`），另列計數；同編號時有狀態的檔優先，報告不再蓋掉工單（T0701）
- legacy parser 讀得到引用區塊形式的狀態（`> 狀態:✅ DONE`，半形 / 全形冒號、可選 emoji）；新增 `PAUSED`（open，`⏸ Paused`，可補救結案）；frontmatter `status: TODO` 視同 `PENDING`（D185，T0702）

### Changed
- 專案網站與 README：Control Tower 已公開（MIT），「去哪取得」連到 CT Portal 安裝頁（安裝頁網址由 `CT_PORTAL_URL` 組出，只寫一處）；網站導覽列、側欄與 Control Tower 相關頁面連到 CT Portal；CaseCard 結果欄可換行（D182 / D183，T0699 / T0700）

### Known issues
- 總覽的下一個編號與待辦需 CT `>= v6.0.0-pre.1`（預覽版）寫入 `_tower-state.md` 摘要；較舊的 CT 只顯示最後更新與進行中工單
- 遠端視窗讀遠端主機的 CT global / 預設設定需把遠端 bat-server 升級到本版；未升級時標示無法讀取。遠端總覽與 bmad 專案 Sprint 區塊未實機確認
- Linux 版本未實機驗證

## [0.7.1-pre.6] — 2026-10-22

### Added
- Worker 回報後又開始新回合時，分頁標籤顯示 `↻`（`resumed`），不列入「批次關閉已回報的 Worker」，回合結束回到 `✓`。主行程以 `TerminalBlockedTracker` 記回合（claude `UserPromptSubmit` / `Stop` hook、codex OSC 7501 `working` / `idle` / `clear`，60 s 無輸出備援），經 `terminal:attention-changed` 的 `busy` 推送；批次關閉確認框標出 5 秒內仍在輸出的分頁。helper、MCP、查詢 channel 與 `--close-worker` 不變（D180，T0694）

### Fixed
- **Codex 分頁在 alt screen 捲動不夠順**：xterm.js 5.5 在滑鼠追蹤模式下每個 wheel 事件最多送 1 個回報。`agentPreset === 'codex-cli'` + alt buffer + `vt200` / `drag` / `any` 追蹤 + SGR 時，`attachCustomWheelEventHandler` 依累積行數送多個 SGR 滾輪回報（每事件上限 8，反向丟餘量），回報與 xterm 逐位元相同、經 `terminal.input(report, true)` 送出；其他情況交回 xterm。helper 派工的 codex Worker 分頁不涵蓋（BUG-165，T0698）
- 安裝版 helper 的 `--version` 與 BAT MCP `serverInfo.version` 顯示 `0.0.0`：electron-builder `afterPack`（`scripts/version-manifest.cjs`）寫只含 `name` / `version` 的 `<resources>/package.json`，server bundle 共用同一函式；`verify-packaged-native.js` 新增 `helper-version` 檢查（BUG-169，T0691）
- `Usage limit reset · continuing automatically`（claude CLI 2.1.300+ 自動繼續觸發時的提示）歸為 `claude-cli-resumed`，分頁不再殘留「CLI 將於 … 自動繼續」徽章；claude 路徑不新增 PTY 寫入（T0692）

### Changed
- 內嵌 Codex 0.160.0 → 0.163.0（`@openai/codex-sdk` `^0.163.0`、`@openai/codex` 與 6 個平台子套件；lock 只動 codex 系列）。原生 binary 目錄結構、SDK API、BAT 整合點（`-c mcp_servers.bat.*` / `env_vars`、`--no-daemon`、`config_exclusion`、`check_for_update_on_startup`、OSC 7501）與 `usage-limit.ts` 句型皆無變動；mac / Linux 平台包不再附帶 zsh（BAT 未使用）（T0697）

## [0.7.1-pre.5] — 2026-10-21

### Fixed
- **SSH 精靈啟動遠端 bat-server 失敗時，錯誤字首與 `errorCode` 不一致**：stage 2（`systemctl --user enable` + `restart` / `launchctl load -w`）被判為 `start-failed` 時，`error` 仍以 `enable-failed:` 開頭。改為先判斷 `isStartIssue` 再組字串，`error` 與 `[ssh-start-server]` 日誌的字首都跟 `errorCode` 一致；分類 regex 不變。另補 `sshUser` 含 `@` 的拒絕測試（`startServerOnRemote` 與 teardown 都在任何 ssh exec 之前被拒）（T0688）

### Changed
- 內嵌 Claude CLI 2.1.300 → 2.1.306（`@anthropic-ai/claude-code` `^2.1.306` 與 8 個平台子套件；lock 只動 claude-code 系列）。模型清單、計價、effort、`HEALTHY_MIN`、update guard、BAT 整合點（`--mcp-config=` / `--settings=` hooks / `--name` / `disableAllHooks`）與 `usage-limit.ts` 句型皆無變動（T0690）
- 安裝檔的 `resources/scripts` 只收 6 個執行期 helper：`build.extraResources` 的 filter 由 `*.mjs` 改為逐一列出檔名，與 `scripts/build-server-bundle.mjs` 的 `serverBundleHelperScripts` 同一組。`verify-helper-bundle.js` 擋萬用字元、兩組不一致與 import 未封閉；`verify-packaged-native.js` 新增 `helper-scripts` 檢查打包產物（缺少或多出都失敗）（T0689）
- CI：`pre-release.yml` / `release.yml` 新增 Test gate，`tests` job 呼叫可重用的 `tests.yml`（`test:unit` → `test:legacy`）並列在 `build.needs`，失敗即不 build、不發版（BUG-168，T0686）。`tests/` 底下未被執行的舊測試修正後收進 vitest，或由新的 `npm run test:legacy` 執行；刪除 5 個指向不存在檔案的 npm script（BUG-167 / BUG-168，T0678–T0685）
- `electron/wsl-detect.ts` 檢查 WSL 安裝用的 Windows tarball 路徑改用 `path.win32.isAbsolute`（Windows 上行為不變，D178）；`electron/wsl-systemd.ts` 解析使用者失敗時的錯誤訊息改用 `describeError`（T0684 / T0685）
- 文件：BAT MCP 權限政策——日後若新增寫入型 tool，不得開放給 workflow 子 agent（PLAN-054 B4，T0687）
- 專案網站：新增「把腦力留給判斷」頁 `/why`，首頁故事章節加上交給工具的說明（T0674）
- repo 內工單與文件去識別化（D176，T0676 / T0677）

### Known issues
- 安裝版的 helper `--version` 與 BAT MCP `serverInfo.version` 顯示 `0.0.0`：helper 讀 `<scripts>/../package.json`，安裝目錄的 `resources/` 沒有這個檔；既有行為，只影響顯示（BUG-169）
- Agent 面板未以新版內嵌 CLI 實機對話；Claude Code 2.1.302 起 SDK 預設以 fork 方式執行 subagent
- 滑鼠追蹤自動重設未經 macOS 實機驗證（BUG-166）
- Codex 分頁觸控板快速捲動（BUG-165；暫解 `~/.codex/config.toml` `[tui] mouse_scroll_speed = 3`）
- 遠端視窗需重跑設定精靈把遠端 server 升級到本版
- Linux 版本未實機驗證

## [0.7.1-pre.4] — 2026-10-19

### Fixed
- **TUI 被訊號結束 / 崩潰後滑鼠追蹤殘留，SGR 滑鼠回報被 shell 當文字插入命令列**（`35;52;69M…`）：codex 0.163 以 `/quit`、Ctrl+C / D / Z 離開會還原，但收到 SIGINT / SIGTERM / SIGHUP / SIGKILL 時不送 DECRST，xterm 停在 `mouseTrackingMode=any` + alt screen。新增 `MouseReportEchoDetector`（`src/lib/mouse-tracking-reset.ts`）：BAT 送出的 SGR 回報本體在 500 ms 內出現在 PTY 輸出（去掉 CSI / OSC 與控制字元後比對）即在**本機 xterm** 寫入 `?1000/1002/1003/1006/1015/1016l`（不寫 PTY）、清除選取保留，日誌 `[mouse-tracking] reset: reports echoed as text`。Unix PTY（macOS / Linux / WSL / SSH / Docker）會發生，Windows 原生 ConPTY 不會（BUG-166，T0671 / T0672）

### Added
- 終端右鍵選單（追蹤中 Shift + 右鍵）新增「重設滑鼠模式」（同上本機 DECRST，日誌 `reset: manual`）；alt buffer 時另有「離開替代畫面（alt screen）」（本機 `?1049l`）；三語系 `terminal.resetMouseMode` / `terminal.exitAltScreen`（BUG-166，T0672）
- e2e `e2e/t0672-mouse-tracking-reset.spec.ts`；`e2e/t0571-shift-right-click-copy.spec.ts` 的選單清單斷言加入新選項（D174）

### Known issues
- 滑鼠追蹤自動重設未經 macOS 實機驗證；命中前的前幾筆殘骸仍會進命令列；1004 / 2004 殘留未處理
- Codex 分頁觸控板快速捲動受 xterm 追蹤模式「每個 wheel 事件最多 1 個回報」限制（BUG-165，T0670；暫解 `~/.codex/config.toml` `[tui] mouse_scroll_speed = 3`）
- macOS 停用 Graphite 後是否不再 GPU 崩潰待實機確認；根本修正需 Electron 42+（PLAN-053）
- 遠端視窗需重跑設定精靈把遠端 server 升級到本版
- Linux 版本未實機驗證

## [0.7.1-pre.3] — 2026-10-19

### Fixed
- **macOS 長時間使用的分頁打字延遲、Renderer 約一顆核心**：縮圖預覽 `scheduleBatchedPreviewUpdate` 只在遇到 `\n` 時截短。alt screen 程式（Codex）在 Linux / macOS PTY 的輸出幾乎沒有 `\n`，預覽字串因此無上限累積（使用者量到 71 萬到 105 萬字元），每 150 ms 就要 regex 清理加單行 layout 一次。改為輸入端只保留尾端 16 Ki、輸出端每行 256 字元 × 8 行（≤ 2055 字元），Claude `onStream` / `onMessage` 同一上限；純邏輯抽到 `src/lib/thumbnail-preview.ts`（BUG-136，T0666 / T0667）
- **macOS GPU 程序在建立 / 切換分頁時 CHECK 崩潰**：Chromium 146 `graphite_shared_context.cc:291` 遇到 Skia Graphite `kOutOfOrderRecording` 會直接中止（Chromium 147 起才改為 context lost）。macOS 預設加 `--disable-skia-graphite`，env `BAT_SKIA_GRAPHITE=1` 可恢復（`decideSkiaGraphite`，`electron/gpu-status-log.ts`）；啟動記 `[gpu] skia graphite:` 一行（BUG-164，T0668 / T0669）
- **GPU 程序崩潰後可見終端空白 / 殘影**：main 在 GPU `child-process-gone` 時廣播 `system:gpu-process-gone`；可見的終端在圖層 canvas `contextrestored`（或確認 context 已恢復）後 `clearTextureAtlas()` + `refresh()`，同一序號只重建一次、間隔 ≥ 1 s；isActive effect（Win11 修正）不變（BUG-164，T0669）

### Changed
- 專案網站：install / compatibility / releases 頁的 description、404 中文 description、更版紀錄頁標題；故事插圖改用實際工單目錄名 `_ct-workorders/`（D173）、SSH 頁說明範例主機名稱（T0665）
- 新增 opt-in e2e：`e2e/v071-pre2-acceptance.spec.ts`、`e2e/v071-pre2-blocked-acceptance.spec.ts`（`BAT_E2E_V071PRE2=1`）（T0663 / T0664）

### Known issues
- 兩項 macOS 修正未經 macOS 實機驗證（打字延遲、停用 Graphite 後是否不再崩潰）
- GPU 崩潰的根本修正需 Electron 42+（PLAN-053）
- 遠端視窗需重跑設定精靈把遠端 server 升級到本版
- Linux 版本未實機驗證

## [0.7.1-pre.2] — 2026-10-18

### Fixed
- **Docker 設定精靈固定用 `127.0.0.1:9876`，與 BAT RemoteServer 預設埠衝突**：「建立新容器」改由主行程挑埠（9877–9976，避開 RemoteServer 埠與已佔用埠，與 WSL 共用 `pickServerPort`）；「沿用既有容器」改讀容器公開的 `9876/tcp` 主機埠；埠衝突時只移除本次建立的容器、重試換埠；新 IPC `docker:pick-server-port`（BUG-156，T0649）
- **「編輯連線」釘選新指紋後按「儲存」寫回舊指紋**：釘選成功後對話框持有新指紋，釘選失敗顯示錯誤（BUG-157，T0650）
- **SSH 設定的「重新釘選指紋」不經 SSH 通道、直連本機同號埠**（可能釘到本機其他 BAT 伺服器並送出權杖）：SSH 設定（`ssh-linux` / `ssh-darwin`）停用該按鈕、`handlePinFingerprint` 防禦性拒絕（BUG-160，T0655）
- **權限請求被放行 / 逾時拒絕（未經鍵盤）後仍維持 `blocked` / `permission`**：新增 async `PostToolBatch` hook（`post-tool-batch`），只清 `permission`，依 hook 的 `agent_id` 區分 subagent（每分頁上限 32，超過退回任何批次都清）；`terminal:report-hook` 多選用 `agentId`（BUG-162，T0657）
- **codex 共用 app-server daemon 讓分頁內命令讀到別的分頁的 `BAT_*`**：BAT MCP 沒注入的 codex 分頁在 codex `>= 0.156.0` 時加 `--no-daemon`（`createCodexNoDaemonSupportCheck`），BAT MCP 有注入與 helper 派工命令列不變（BUG-159，T0648 / T0651）
- **設定精靈的選項按鈕、輸入框、進度條用 Tailwind class 但 App 未載入 Tailwind**：改用 `profile-action-btn` / `profile-name-input` 與 `.bat-wizard-*`（`src/styles/setup-wizard.css`）；WSL / SSH / Docker 步驟說明三語改寫（BUG-163，T0658）
- **遠端設定畫面與精靈的英文字樣**：配置面板 / 編輯連線 / 精靈提示與警告走 i18n（三語 +48 key）、SSH 認證失敗文案改指向金鑰 / ssh-agent；精靈 step 錯誤改帶 code、error-mapper +32 entry（`Error.message` 與日誌維持英文）；復原警告、縮圖列 `suggested`、「Set as Supervisor」翻譯；21 個 modal × 補 `aria-label`（BUG-158，T0652；BUG-161，T0660）
- `smoke:remote:headless` S13 的 raw command 探測改為帶別的塔台 `--notify-id`（T0579 後塔台可用 raw command；探測不再建出分頁）（T0654）

### Changed
- 專案網站：新增「遠端開發」四頁（`/remote/`）、真實截圖與派工短片（`e2e/site-media.spec.ts`，手動執行）、OG 分享卡片、sitemap、`pages.yml` 的 lychee `link-check`（只警告）；「BAT × Control Tower」改名「與 Control Tower 協作」（PLAN-049，T0646 / T0656 / T0659）
- README 截圖換新；`docs/` 的 WSL / SSH / Docker 部署指南與 remote-dev-overview 更新為目前行為（T0653）
- 狀態列可設定項目數更正為 19

### Call for testing
Codex CLI 使用者（一般權限執行 BAT）：關閉 BAT MCP 後開 Codex 分頁，確認分頁內命令讀到的 `BAT_TERMINAL_ID` 是自己的；以 Control Tower 派 Codex Worker 確認通知與回收；到 GitHub Issues 回報 BAT / Codex 版本、作業系統與安裝方式。

### Known issues
- 未實機驗證：Docker 精靈挑埠、指紋重新釘選、權限請求結束後 ⚠️ 消失、非系統管理員下的 codex `--no-daemon`
- 「沿用既有容器」仍自動選最近建立的容器（PLAN-052）
- 遠端視窗需重跑設定精靈把遠端 server 升級到本版
- macOS / Linux 版本未實機驗證

## [0.7.1-pre.1] — 2026-10-18

### Added
- **Claude CLI 分頁的 session 名稱**：claude-cli / claude-cli-worktree 分頁啟動時注入 `--name=<名稱>`（顯示在 ListAgents、`/resume`、輸入框）。helper 派出的 Worker `<工作區> · Worker · <T####>`、其他分頁 `<工作區> · <短 ID>`；唯一實作 `claudeSessionName`（`src/lib/claude-session-name.ts`），注入點 `buildBatMcpLaunchArgs`（不受 BAT MCP 開關影響、無 Settings 開關）。使用者自訂參數已有 `--name` / `-n`、system claude `< 2.1.76` 或讀不到版本時不注入（PLAN-050，D167，T0640 / T0641）
- **以塔台開啟 Claude**：縮圖列「+」選單新增入口，開出的 claude-cli 分頁記錄 `launchRole: 'tower'`，名稱 `<工作區> · Tower`，⏻ 重啟與還原沿用；只命名，不做 `--set-role`（PLAN-050，T0644）
- **查詢欄位 `claudeSessionName` / `claudeSessionId`**：`terminal:whoami` / `terminal:list` / `terminal:get-state`（MCP `bat_whoami` / `bat_list_terminals` / `bat_get_state`）；sessionId 由 `SessionStart` hook 回報（`terminal:report-hook` 多選用 `sessionId`，hook 仍 exit 0、stdout 不輸出，日誌只記前 8 碼）；`<userData>/claude-sessions.json` 在 BAT 重開、Terminal Server 存活時還原（PLAN-050，T0642）
- **`terminal:list { scope: 'towers' }`**：已宣告的塔台列出同一 BAT host 所有工作區的塔台（`id` / `workspaceId` / `workspaceName` / `title?` / `claudeSessionName` / `state` / `alive` / `self`），其他查詢範圍不變；舊 BAT 回 `INVALID_ARGS`（PLAN-050，T0643）
- 網站新增「實戰案例」頁 `/cases`（PLAN-049，T0638）

### Fixed
- **helper 派出的 Worker PTY 沒有記錄 agent preset**：`bat_whoami` 缺 `agent`，claude Worker 少了 embedded 的 `DISABLE_UPDATES`；`terminal:create-agent-command` 改傳 resolved agent，raw command 不變（BUG-155，T0639）

### Call for testing
Codex CLI 使用者：在 Codex 分頁與塔台派出的 Codex Worker 呼叫 `bat_whoami`，確認有 `agent`（Codex），Worker 完成後通知回到塔台、分頁被回收；到 GitHub Issues 回報 BAT / Codex 版本、作業系統與安裝方式。

### Known issues
- session 名稱只用在 Claude CLI 分頁；Codex 分頁兩欄一律 `null`
- 名稱只在啟動時決定（`/rename`、工作區改名不回寫）；同一工作區兩個「以塔台開啟」分頁同名
- 塔台面板「執行工單 / 補結案」按鈕（raw command）沒有名稱；遠端 headless 派工名稱為 `BAT · Worker · T####`，需升級遠端 server
- Control Tower 依這些欄位選收件人的規則待 CT 新版
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.9] — 2026-10-18

### Added
- **Codex CLI 分頁的「在等你」與「已啟動」**：Codex CLI `>= 0.163.0` 在 PTY 送 OSC 7501 回報狀態，BAT 只讀、不改輸出，新增 `blockedDetection: osc` 與 `blockedReason: input`（使用者輸入不清除，Codex 自己送轉換才清除）；Worker 縮圖顯示 ⚠️、不計入批次關閉；`--wait-started` / `agentStarted` 對 Codex 生效（派工前以 `codex --version` 判斷，確認不到 → `unknown`，絕不回 `unconfirmed`）；BAT 重開時由 replay 補回最後狀態（PLAN-047 M1b-2，D158，T0619 / T0621 / T0623）
- **專案網站**：GitHub Pages <https://gowerlin.github.io/better-agent-terminal/>（VitePress 於 `site/`、`.github/workflows/pages.yml`）：故事化首頁、BAT × Control Tower 協作頁、Control Tower 功能導覽、功能、常見問題、回報與協助測試、安裝、版本對照、更版紀錄（PLAN-049，D159–D166，T0622 / T0624 / T0630–T0636）

### Fixed
- **Claude CLI 分頁回答 MCP 表單後 `blocked`（`elicitation`）沒有清除**：新增 `ElicitationResult` 與 `Notification(elicitation_response)` hook → `elicitation-done`，只清 `elicitation`，涵蓋回答、取消與請求逾時（PLAN-047，T0620）

### Changed
- 塔台派出的 Codex Worker 命令加 `-c check_for_update_on_startup=false`，避免更新提示擋住 Worker（自訂參數已設定時不加；手動開的分頁不加）（T0621）
- Control Tower v5.8.0 支援 Codex 的 `osc` / `input`（斷點 D）與 Worker 啟動確認；BAT 最低版本 `0.7.0-pre.9`（CT-T020）
- README「下載最新版本」改連網站下載區（GitHub `releases/latest` 常落在 `server-bundle-v*`）

### Call for testing
Codex CLI 0.163.0 以上的使用者：在 Codex 分頁以 `bat_whoami` / `bat_get_state` 確認 `blockedDetection: osc`；停在核准提示時確認縮圖 ⚠️ 與 `blocked` / `input`，核准後清除；搭配 Control Tower v5.8.0 派 Codex Worker（`--agent codex --wait-started 30000`）確認 `started: <時間>`，完成後通知回到塔台、分頁被回收；到 GitHub Issues 回報 BAT / Codex 版本、作業系統與安裝方式。

### Known issues
- Codex 版本以 BAT 主程序的 PATH 判斷：Windows 上 PATH 第一個 codex 是 npm shim（`codex.cmd`）時判斷不到（`unknown`，行為同前）；分頁實際執行較舊的 codex 時可能回報 `unconfirmed`
- Codex 的 `input` 不分種類（核准 / 提問）；未信任的 git repo 會停在「Trust this folder?」→ `unconfirmed`
- 需搭配本版內附 helper；遠端視窗需升級遠端 server
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.8] — 2026-10-18

### Fixed
- **Worker 問完塔台後，縮圖標示沒有恢復**：`bat-notify.mjs --ask` 提問、塔台答覆後，仍在工作的 Worker 縮圖停在 `?`（訊息以「提問」結尾）或變成 `✓` 並計入「關閉已回報的 Worker 分頁（N）」。`--ask` 的通知改帶選用欄位 `questionId`（只有 id），renderer 不記為回報並清除殘留；答覆後回到「執行中」，下一次一般回報才 `✓`（BUG-154，T0613）

### Changed
- Control Tower v5.7.0 支援「Worker 問塔台」（`--ask` / `bat_list_questions` / `--answer`，失敗回到工單往返）；BAT 最低版本 `0.7.0-pre.7`

### Call for testing
Codex CLI 使用者（CT v5.7.0）：派一張工單請 Codex Worker 向塔台提問一次，確認通知、縮圖 `?`、`blocked` / `tower`，答覆後繼續工作、縮圖無標示，完成後 `✓` 並回收，並到 GitHub Issues 回報 BAT / Codex 版本與結果。

### Known issues
- 需搭配本版內附 helper；遠端視窗需升級遠端 server
- 舊版 CT（v5.6.x 以前）以「T#### 提問」在工單往返時，答覆後 `?` 保留到 Worker 下一次通知
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.7] — 2026-10-18

### Added
- **Worker 可以直接問塔台、等塔台答覆**：Worker 以 `bat-notify.mjs --ask`（問題與選項從 stdin 傳入）把問題送給派它的塔台並通知塔台分頁，再以 BAT MCP `bat_wait_question` 等答覆（每次 ≤ 45 秒）；塔台以 `bat_list_questions` 看題目、`bat-terminal.mjs --answer` 回答。問題與答案只存在 BAT 記憶體，不寫檔、日誌不記內容；BAT 重開後未答的問題回報 `lost`（PLAN-048，D155 / D156，T0606–T0611）
- **狀態查詢看得出 Worker 在等塔台**：有待答問題時 `bat_get_state` / `bat_wait` / `bat_list_terminals` 回 `blocked`、`blockedReason: tower`，並多 `pendingQuestions` 欄位；Codex 分頁也適用，使用者輸入不清除（T0607）
- BAT MCP 新增唯讀 tool `bat_list_questions`、`bat_wait_question`（共 8 個，全部唯讀）（T0608）

### Fixed
- **Worker 向塔台提問時，縮圖就顯示 ✓**：縮圖改為 ⚠️ 等使用者（權限確認、Claude 提問等）/ `?` 等塔台答覆 / `✓` 已回報，tooltip 說明原因與時間；只有 `✓` 計入「關閉已回報的 Worker 分頁（N）」。主行程以 `terminal:attention-changed` 推送狀態（本機與遠端視窗）（BUG-153，T0609）

### Changed
- `blockedDetection: "none"` 改為「不會回報 Claude hook 的三種原因」；`tower` 由 BAT 判斷，任何分頁都可能出現（D156）

### Call for testing
Codex CLI 使用者：歡迎在 Codex 分頁呼叫 `bat_list_questions`（應回 `0 pending questions`）與 `bat_whoami`，Control Tower v5.7.0 起可讓 Codex Worker 提問一次，確認塔台收到、`blocked` / `tower` 與答覆後繼續，並到 GitHub Issues 回報 BAT / Codex 版本與結果。

### Known issues
- Control Tower 使用「Worker 問塔台」需 v5.7.0（準備中）；Claude / Codex 自己的對話紀錄仍會包含問答內容
- 縮圖 ⚠️ / `?` 只存在視窗記憶體，重新載入或遠端重連後要等下一次狀態變化；舊版 CT 以「T#### 提問」通知時，答覆後 `?` 保留到 Worker 下一次通知
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.6] — 2026-10-18

### Added
- **確認塔台派出的 Worker 真的啟動了**：Claude CLI 分頁啟動時，BAT 會記下「已啟動」。BAT MCP 的 `bat_get_state` / `bat_wait` / `bat_list_terminals` 多一個 `agentStarted` 欄位（`true` / `false` / `null` = 無法判定），`bat_wait` 可等到啟動（`until: 'agent-started'`）。塔台派工時可加 `--wait-started <毫秒>`：已啟動回 `started: <時間>`；等不到回 exit `8`（分頁保留，不要重派）；無法判定（例如 Codex）回 `started: unknown`。不加參數時派工行為不變（D154，T0600）

### Fixed
- **塔台派工時，Worker 分頁搶走鍵盤焦點**：Worker 分頁照常出現在分頁列與縮圖，但畫面和焦點留在你正在用的分頁；手動開的分頁、Control Tower 面板按鈕開的分頁仍會切過去（BUG-152，T0599）
- **Claude 設定關閉 hooks 時，`blocked` 偵測誤以為有在偵測**：以 `disableAllHooks` 關閉 hooks 時，分頁改回報 `blockedDetection: "none"`（T0600）

### Call for testing
Codex CLI 使用者：歡迎以 Codex 當 Worker 跑一次塔台 / Worker 流程（`bat_whoami` → 派一張小工單 `--agent codex` → 確認通知回到塔台、分頁被回收；帶 `--wait-started` 時 Codex Worker 應回 `started: unknown`），並到 GitHub Issues 回報 BAT / Codex 版本與結果。

### Known issues
- 啟動確認只支援 Claude CLI 分頁；Claude 的 hooks 在專案層設定或公司政策中關閉時 BAT 偵測不到，`--wait-started` 會等到期限後回 exit `8`
- 以 server token 呼叫 helper 派出的分頁仍會取得焦點；Worker 分頁在第一次切過去前終端尺寸維持 120x30
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.5] — 2026-10-18

### Fixed
- **塔台派工時正在打字，Worker 會起不來**：塔台派出的 Worker 分頁會取得鍵盤焦點，而 BAT 要等分頁的 shell 準備好才送出啟動指令。這段時間打進來的字會接在指令前面，Worker 啟動失敗（例如 `bash: ,: command not found`），塔台卻收到派工成功。現在這段時間的輸入會在啟動指令之後才送出，不會丟失；派工的 shell 也改為只判斷一次（BUG-151，T0598）
- **Claude 用 AskUserQuestion 提問時，`blocked` 的原因誤報為權限確認**：Claude 對提問也會送出權限請求，BAT 因此把原因從 `question` 改成 `permission`；用滑鼠回答後，`blocked` 也要等到該回合結束才清除。現在提問一律回報 `question`，用滑鼠或鍵盤回答後都會立即清除（BUG-150，T0596 / T0597）

### Known issues
- 塔台派出的 Worker 分頁仍會搶走鍵盤焦點；派工後接著打的字會進到 Worker 分頁（不再破壞啟動指令）
- 塔台派工時，helper 回傳成功只代表分頁已建立，不代表 Worker 已經啟動；請以 `bat_get_state` 確認 Worker 有沒有開始工作
- `blocked` 偵測目前只支援 Claude CLI 分頁；Codex 分頁回 `blockedDetection: "none"`。在權限確認上用滑鼠按允許 / 拒絕時，`blocked` 會維持到該回合結束或下一次鍵盤輸入
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.4] — 2026-10-18

### Added
- **偵測 Claude 分頁卡在等人回答**：Claude CLI 分頁停在權限確認、AskUserQuestion 提問或 MCP 表單（elicitation）時，BAT MCP 的 `bat_get_state` / `bat_list_terminals` / `bat_wait` 會回 `blocked`，並附原因（`permission` / `question` / `elicitation`）。塔台可以藉此知道 Worker 是在等人，而不是還在工作。BAT 以 Claude 的 hooks 回報，hook 不影響 Claude 的任何判斷、不送出工具參數或對話內容；與「BAT MCP」用同一個 Settings 開關（預設開）。每個分頁另回 `blockedDetection`（`hook` / `none`），表示這個分頁有沒有在偵測（PLAN-047，T0590 / T0594）
- **Worker 分頁關掉之後仍可查 worktree 狀態**：以 `--worktree keep` 回收 Worker 分頁、甚至 `--worktree remove` 刪掉 worktree 之後，`--worktree-status T####` / `bat_worktree_status` 仍會回答（`source` 為 `exited` 或 `git`），塔台合併時不必再自己用 git 重算（PLAN-047，T0589）

### Fixed
- **全新安裝的 Windows 上，塔台派出的 Claude / Codex Worker 起不來**：從未在 Settings 存過任何設定時，BAT 派工以 bash 的方式替參數加引號，但分頁實際是 PowerShell，命令被拆壞，Worker 啟動即失敗。現在依分頁實際啟動的 shell 加引號（BUG-149，T0593）

### Changed
- 新增 Codex CLI 擔任塔台 / Worker 的自動化整合測試（用真的 Codex 連 BAT，不呼叫模型）；BUG-149 就是這組測試找到的（D153，T0592）
- CLAUDE.md 壓縮：各功能細節搬到 `docs/agent-guide/`，CLAUDE.md 只留摘要與必守規則（T0595）

### Call for testing
如果你平常使用 **Codex CLI**，歡迎幫忙跑一次塔台 / Worker 流程（需要 BMad Control Tower）：

1. 新開一個 Codex CLI 分頁，請它呼叫 MCP tool `bat_whoami`（不帶參數），確認回傳的 `role` 與 `agent`（應為 `codex-cli`）
2. 在塔台分頁派一張小工單給 Codex Worker（`--agent codex`）
3. 確認 Worker 完成後通知有回到塔台分頁，Worker 分頁也有被自動回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。如果你在 `~/.codex/config.toml` 改過 `shell_environment_policy`，也請一併註明（可能讓 Codex 執行的指令拿不到 BAT 的連線資訊）。

### Known issues
- `blocked` 偵測目前只支援 Claude CLI 分頁；Codex 分頁回 `blockedDetection: "none"`（後續版本）。以 `--dangerously-skip-permissions` 執行時不會出現權限確認；在權限確認上用**滑鼠**按允許 / 拒絕時，`blocked` 會維持到該回合結束或你下一次鍵盤輸入
- `blocked` 的權限確認、AskUserQuestion、MCP 表單三種情況尚未在真實 Claude 互動中觸發驗證，遇到時歡迎回報
- Claude 設定了 `disableAllHooks` 時 BAT 的 hooks 也會停用，`blocked` 不會出現
- Control Tower 尚未使用 `blocked`（需 CT 後續版本）；本版其他功能沿用 Control Tower v5.3.x
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.3...v0.7.0-pre.4

## [0.7.0-pre.3] — 2026-10-18

### Fixed
- **Codex 分頁的 BAT MCP 無法連線**：0.7.0-pre.2 的 Codex CLI 分頁呼叫 `mcp__bat__*` 一律回 `CONNECT_FAILED: not running inside a BAT terminal`。原因是 Codex 啟動 MCP 程式時只傳少數系統環境變數，分頁的連線資訊沒有傳下去。現在 BAT 會告訴 Codex 要轉送哪些變數（只給變數名稱，權杖不會出現在命令列或設定裡）。需要新開的 Codex 分頁才會套用（BUG-148，T0586）

### Changed
- README「與 BMad Control Tower 協作」的版本對照表補上「唯讀查詢（MCP）」：BAT `>= 0.7.0-pre.2`（Codex 分頁 `>= 0.7.0-pre.3`），不需要特定 CT 版本（T0587）

### Known issues
- Control Tower v5.3.0 已在 0.7.0-pre.2 上完成實機驗收（worktree 隔離派工、合併工單），本版沿用
- Codex 分頁的 BAT MCP 修正已用 Codex 0.160.0 / 0.163.0 驗證轉送機制，實際分頁連線待本版安裝後驗證；以 npm 安裝的 `codex.cmd`、遠端（WSL / SSH / Docker）的 Codex 分頁未實測
- Claude / Codex 面板（非終端分頁）不掛 BAT MCP；BAT MCP 開關只影響之後啟動的分頁
- 「偵測 Worker 停下來等回答」尚未提供（後續版本）
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.2] — 2026-10-17

### Added
- **分頁內的 agent 可以直接查詢 BAT（BAT MCP）**：BAT 啟動的 Claude CLI / Codex 分頁會自動掛上一組唯讀 MCP 工具（`mcp__bat__*`），可以查自己是誰、列出分頁、查分頁狀態（執行中 / 閒置 / 已結束）、讀取分頁輸出、等待分頁狀態改變、查 worktree 狀態。範圍依分頁權杖限制：塔台只能看自己與自己派出的 Worker，Worker 只能看自己。讀出的輸出會先遮蔽權杖、API key、私鑰等字串。設定檔不含任何權杖，也不會覆蓋你自己的 MCP 設定。可在 Settings → Advanced「BAT MCP」關閉（預設開啟）（PLAN-047，T0582 / T0584）
- **Worker 可以在獨立的 git worktree 執行**：派工加 `--isolation worktree`，BAT 會在 repo 外建立 `.bat-worktrees/<repo>/<工單號>` 與分支 `ct/<工單號>`，Worker 在裡面工作，主 checkout 不受影響；回收 Worker 時可選擇保留、移除或封存 worktree（`--close-worker … --worktree keep|remove|archive`，預設保留）。依賴套件由 Worker 自行安裝。預設不隔離，不加參數時行為與先前相同（PLAN-047，T0583）
- **查詢 Worker 分支的合併狀態**：`bat-terminal.mjs --worktree-status T####` 回報分支相對 main 的領先 / 落後、未提交的檔案、實際改動、超出工單範圍的檔案、預測的合併衝突，只讀不改（PLAN-047，T0585）

### Known issues
- Control Tower 要使用 worktree 隔離派工與合併工單，需等對應的 CT 版本（CT-T015 / CT-T016 進行中）；目前的 CT v5.2.4 不受影響
- Codex 分頁的 BAT MCP 只驗證到設定解析，尚未實際連線驗證；以 npm 安裝的 `codex.cmd` 在 PowerShell 下的參數引號未實測
- Claude / Codex 面板（非終端分頁）不掛 BAT MCP；BAT MCP 開關只影響之後啟動的分頁
- 「偵測 Worker 停下來等回答」尚未提供（後續版本）
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.7.0-pre.1] — 2026-10-17

### Changed
- **每個終端分頁改用自己專屬的權杖**：本機分頁裡的 `BAT_REMOTE_TOKEN` 不再是可以操作整個 BAT 的全權 token，而是只屬於該分頁的 `batcap.` 權杖（遠端 WSL / SSH / Docker 分頁早已如此）。分頁裡的程式能透過 BAT 做的事，依分頁角色限制（PLAN-047）：
  - 一般分頁與塔台分頁：可以派工（agent 模式與 raw command 模式）、回收自己派出的 Worker 分頁、設定自己的塔台角色
  - 塔台派出的 Worker 分頁：只能通知 / 預填 / 送出給派出它的那個塔台
  - 其他操作（讀寫檔案、改設定、寫入別的分頁等）一律拒絕
- **權杖在 BAT 重開後仍有效**：退出 BAT 時選「不停止 Terminal Server」、重開後選「保留」，存活分頁裡的塔台與 Worker 照常可以派工、回報、回收（權杖紀錄只存雜湊，不存權杖本身）
- **遠端 Tower 也能用 raw command 派工**（`bat-terminal.mjs claude "/ct-exec T####"`），規則與本機相同；建議仍以 agent 模式（`--skill` / `--workorder`）為主

### Fixed
- **BAT 重開時，回答 Recovery 提示之前不再多開一個 shell**：之前還原的分頁會在背景另起一個本機 shell，選「保留」後它仍在執行，輸出也混進同一個分頁。現在分頁會等你回答後才接回或建立；在提示開著時派工，BAT 最多等 2 秒，仍未回答就回報失敗（`RECOVERY_PENDING`），不會建立分頁（BUG-146）
- **Recovery 選「重新開始」後，新的 Terminal Server 不會再被當成不存在**：之前舊 server 結束時會刪掉新 server 剛寫好的紀錄檔，下次啟動又另開一個（BUG-147）

### Known issues
- **行為改變**：Worker 分頁裡不能再派工、回收或設定塔台角色；也不能在一般分頁手動用 `bat-notify --target` 通知任意分頁。Control Tower 的正常流程不受影響，請在一般分頁（不是 Worker 分頁）啟動塔台
- 升級當下仍開著的舊分頁沿用舊的權杖，重開分頁後才會換成新的
- Control Tower 建議搭配 v5.2.4（文件與失敗提示對齊本版；舊版 CT 仍可正常使用）
- 遠端 raw command 用的是遠端使用者 `PATH` 上的 `claude`，不是 BAT 內建的版本
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版；Terminal Server 意外結束後重建的分頁要等下一次調整視窗大小或重繪才會同步寬度
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.6.1-pre.9] — 2026-10-17

### Fixed
- **claude CLI 分頁的 Shift + 右鍵「複製」**：pre.8 的修正在真實的 claude CLI 裡沒有作用，這版補上。以下兩種情況，原本 Shift + 右鍵選單只有「貼上」：
  - 從別的視窗或分頁切回來的那一下就用 Shift + 拖曳選取
  - 同一段文字選了第二次

  現在 Shift + 拖曳選取 → Shift + 右鍵，選單都會出現「複製」，複製到的就是反白的文字。claude CLI 自己的選取是藍底反白（不按 Shift 直接拖曳時出現，放開滑鼠時 claude 已經複製到剪貼簿）；BAT 的選取是另一種顏色（BUG-144）
- BAT 日誌會在每次開啟終端右鍵選單時記一行 `[terminal-context-menu]`，方便回報問題時判讀

### Known issues
- 終端分頁裡的程式追蹤滑鼠時，Alt + Shift 拖曳的欄選取仍會在滑鼠移動時被清掉
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版（顯示後會自動調整）；Terminal Server 意外結束後重建的分頁也要等下一次調整視窗大小或重繪才會同步寬度
- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.6.1-pre.8] — 2026-10-16

### Fixed
- **Shift + 右鍵可以複製選取的文字**：在 claude CLI 等會追蹤滑鼠的程式分頁裡，按住 Shift 拖曳選取後再按 Shift + 右鍵，選單現在會出現「複製」，複製到的就是反白的文字。之前滑鼠一移動，選取就被清掉，選單只剩「貼上」。不按 Shift 直接拖曳時，反白是 claude CLI 自己的選取，放開滑鼠時 claude 已經複製到剪貼簿（BUG-144）
- **新分頁與重啟的分頁畫面寬度正確**：新開、還原或按 ⏻ 重啟的分頁，分頁裡的程式有時會以 120 欄排版，比實際視窗窄，要按重繪才恢復（重啟的分頁每次都會發生）。現在分頁一建立就會同步實際寬度（BUG-145）

### Changed
- repo 的 `CHANGELOG.md` / `release-note.md` 補齊 v0.4.3 起的各版內容
- 伺服器套件說明文件更正 GitHub 下載限流時的行為（遇到限流直接失敗、不重試，可改用「匯入本機 tarball…」）

### Known issues
- 終端分頁裡的程式追蹤滑鼠時，Alt + Shift 拖曳的欄選取仍會在滑鼠移動時被清掉
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版（顯示後會自動調整）；Terminal Server 意外結束後重建的分頁也要等下一次調整視窗大小或重繪才會同步寬度
- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.6.1-pre.7] — 2026-10-16

### Fixed
- **終端右鍵不再「貼上又跳選單」**：claude CLI 等會自己處理滑鼠的程式（例如 claude CLI 右鍵直接貼上），在分頁裡按右鍵時，BAT 不再同時跳出「複製 / 貼上」選單。一般 shell 分頁照舊顯示選單。需要 BAT 選單時按 **Shift + 右鍵**（例如在 claude CLI 分頁以 Shift + 拖曳選取後複製）（BUG-142）
- **終端右鍵選單可用 Esc 關閉**：選單開著、終端仍有焦點時，按 Esc 會關閉選單，這次的 Esc 不會送進分頁裡的程式（不會中斷 claude CLI）。選單沒開時 Esc 照常送出（BUG-143）

### Known issues
- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）；claude CLI 在 macOS 不以右鍵貼上，所以不會重複動作
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

## [0.6.1-pre.6] — 2026-10-16

### Added
- **塔台分頁標題**：分頁內執行 `bat-terminal.mjs --set-role tower` 後，該分頁標題會改為 `<Agent 顯示名> · Tower`（例 `Claude CLI · Tower`），與 Worker 分頁（`Claude CLI · Worker · T####`）一致。自己改過名的分頁會保留原名。本機與遠端（WSL / SSH）都適用。搭配 Control Tower v5.2.0 以上，`/control-tower` 啟動時會自動設定（PLAN-045）
- **塔台模式宣告**：`--set-role tower --mode yolo|ask|off|on`，讓 BAT 知道塔台分頁目前的 auto-session 模式（PLAN-044 使用）
- **用量限制自動繼續**（Settings → Advanced，預設關閉）：yolo 分頁（`--mode yolo` 派出的 Worker，以及宣告為 yolo 的塔台）撞到 5 小時用量限制時：
  - **Codex**：在解鎖時間再加上設定的延遲（預設 2 分鐘）後，確認畫面仍停在限制訊息，就自動輸入設定的文字（預設「繼續」）並按 Enter
  - **Claude**：Claude Code CLI 2.1.234 起會自己在解鎖後繼續，BAT 不另外輸入，只在縮圖上標示；電腦休眠跨過解鎖時間、CLI 停在「Press enter to continue」時，BAT 只補一個 Enter
  - 週限制、非時間型限制（額度、預算）只標示，不自動輸入；等待期間在該分頁打字會取消；同一分頁連續自動送出最多 2 次
  - 縮圖顯示 ⏳ 與預計時間，或「限制」標示（PLAN-044）

### Changed
- **Dialog 不再因點擊外部而關閉**：設定、配置、工作區設定、各種確認框、About、Snippet、設定精靈、Claude / Codex 面板的視窗等，只能用 [×]、[取消] / [確認] 或 Esc 關閉，避免誤觸遮罩讓輸入到一半的內容消失。右鍵選單、下拉選單與小型 popover 照舊點外面就關（PLAN-046）
- **Dialog 統一支援 Esc**：Esc 等同 [×] 或取消，只關最上層的 Dialog；確認框按 Esc 是取消。輸入法組字中、或 Dialog 內的選單開著時，Esc 只處理該操作。只有一個「OK」按鈕的通知視窗補上 [×]（PLAN-046）
- **設定精靈開著時 Esc 不作用**：以前按 Esc 會連同配置面板一起關掉，精靈也被取消並還原已安裝的 server；現在只能用精靈自己的 [×] / 取消
- 修正：在配置面板上點刪除確認、遠端 profile 編輯或設定精靈的遮罩時，會連外層配置面板一起關掉

### Known issues
- 塔台分頁標題需要 Control Tower v5.2.0 以上才會在 `/control-tower` 啟動時自動設定；舊版 Control Tower 不受影響
- Dialog 開著時，Esc 不會再傳到後面的 Claude / Codex 面板（例如中斷串流），需先關閉 Dialog
- 用量限制的訊息格式取自 Claude Code 2.1.300 / Codex 0.160–0.162 的程式字串，尚未在真實撞到限制時驗證；Codex 的自動輸入尚未在真實 Codex 上驗證。遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- 兩台 BAT 互相作為遠端時，用量限制不會自動輸入（headless bat-server 正常）
- BAT 重開但 Terminal Server 仍在執行時，分頁的 yolo 記錄會遺失，需重新啟動塔台或重新派工
- macOS / Linux 版本未實機驗證

## [0.6.1-pre.5] — 2026-10-16

### Added
- **Worker 分頁標題看得出是哪張單**：塔台派出的 Worker 分頁標題改為「Agent · Worker · 工單號」，例如 `Claude CLI · Worker · T0553`；Worker 回報後小標籤顯示 ✓。其他由外部建立的分頁改顯示 agent 名稱或命令名稱，不再是 `Remote: <完整路徑>`；真正由遠端 server 建立的分頁另有「遠端」小標籤。你改過名字的分頁不受影響，舊分頁重開 BAT 後也會套用新格式
- **遠端工具可以一鍵安裝 Node.js（透過 nvm）**：遠端（WSL / SSH）工具清單中的 Node.js 改為可安裝，使用 nvm（裝在 `~/.nvm`，不需 sudo）安裝最新 LTS，並可用「更新」升到新的 LTS。卡片會顯示 nvm 版本。安裝時除了 nvm 原本會改的 `~/.bashrc`，也會在 bash 登入設定檔（`~/.bash_profile`、`~/.bash_login` 或 `~/.profile`，取第一個存在的）加一段有標記的載入設定，讓 agent 以非互動方式執行的指令也找得到 node。已有系統 node 時保留不動。Alpine（musl）沒有官方 binary，維持安裝說明連結

### Fixed
- **重跑 WSL 設定精靈升級 server 時會換 port，原本的連線設定失效**（BUG-138）：現在會沿用原本的 port，並更新既有的連線設定，不再另建一個。SSH 精靈也不再重複建立連線設定
- **覆蓋安裝時沒有清掉舊版檔案**（BUG-139）：WSL / SSH 安裝改為先解到暫存目錄再整批換入，舊版移除的套件不再殘留（實測 WSL 安裝目錄 708 → 390 MiB）
- **升級到一半取消，原本能用的 server 也一起被刪掉**（BUG-141）：升級後若後面的步驟失敗並取消，現在會換回升級前的版本與服務設定，並重新啟動原本的 server；第一次安裝取消仍會整個移除
- **塔台回收 Worker 分頁時，只是切換工作區或分頁焦點就讓回收被取消**（BUG-140）：終端機自動送出的訊號（焦點通知、游標位置回報等）不再被當成你在打字；在該分頁真正打字或貼上仍會取消回收

### Known issues
- SSH 精靈的升級與取消還原只有自動化測試，尚未在真的 SSH 主機上實測
- 透過 nvm 安裝的 Node.js：zsh 非互動登入（`zsh -lc`）仍看不到；已有 `~/.bash_profile` 的環境，`sh -lc` 看不到（`bash -lc` 可以）
- Worker 分頁自動回收需搭配 Control Tower v5.1.0 並開啟 `worker_auto_close`
- 安裝檔不含遠端 server bundle（自 pre.4 起）：第一次設定 WSL / SSH 遠端需要連上 GitHub，或使用「匯入本機 tarball」
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）

## [0.6.1-pre.4] — 2026-10-16

### Added
- **安裝檔大幅縮小**
  - 安裝檔不再內建遠端 server bundle。第一次設定 WSL / SSH 遠端時，BAT 會從 GitHub Release（`server-bundle-v<版號>`）下載，下載後留在快取，之後離線也能用
  - 移除重複或用不到的內容：Windows 重複的一份 Claude 執行檔、Agent SDK 內建但不會執行的 Claude 執行檔、介面已打包好的套件、其他平台的語音辨識檔案，以及 Linux 多帶的一份 arm64 server bundle
  - 遠端 server bundle 本身也變小（linux-x64 約 229 → 159 MiB）
  - AppImage 與 dmg 改用較高壓縮；Windows 維持一般壓縮（實測更高壓縮對 Windows 安裝檔沒有效果）
- **設定遠端時可以匯入本機的 server bundle**：下載失敗（離線、內網）時，WSL / SSH 設定精靈會出現「匯入本機 tarball」，選 `bat-server-<平台>-v<版號>.tar.gz`（同目錄要有 `.sha256`），驗證通過後繼續安裝。也可以設定 `BAT_SERVER_BUNDLE_BASE_URL` 指向內部鏡像

### Fixed
- **塔台回收 Worker 分頁時，Worker 剛回報完常被判定「仍在輸出」而不回收**（PLAN-041 實機驗收發現）：現在 Worker 還在輸出時也會照常排程，等分頁安靜 5 秒後再關，最多再等 60 秒；延遲期間你在該分頁打字仍會取消回收
- 下載 server bundle 遇到暫時性連線錯誤時，判斷是否重試更準確

### Known issues
- 本版起安裝檔不含遠端 server bundle：**第一次**設定 WSL / SSH 遠端需要連上 GitHub（約 160–230 MiB），或使用「匯入本機 tarball」
- dmg / AppImage 改用較高壓縮後的實際大小、掛載與啟動速度，以本版 CI 產物為準，尚未在 Mac / Linux 實機確認
- Worker 分頁自動回收需搭配 Control Tower v5.1.0 並開啟 `worker_auto_close`；Codex Worker 完成工作後的收尾時間尚未實測
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）

## [0.6.1-pre.3] — 2026-10-15

### Added
- **塔台可以回收自己派出的 Worker 分頁**（PLAN-041）
  - BAT 新增 `bat-terminal.mjs --close-worker T#### --notify-id <塔台分頁 id> [--delay-ms N]`
  - 只能關「這個塔台為這張工單派出的」Worker 分頁，關不到你自己開的分頁，也關不到別的塔台派的
  - Worker 最近 5 秒內仍有輸出時不關；延遲期間 Worker 有新輸出，或你在該分頁打字，會取消這次回收
  - 關閉方式與按 ✕ 相同（不清 worktree），BAT 重開後依然有效
  - 遠端視窗（WSL / SSH / Docker）同樣支援
  - **自動回收需搭配 Control Tower v5.1.0**，並以 `*config worker_auto_close done` 開啟（預設關閉）。延遲由 `worker_close_delay` 設定，預設 10 秒。只有工單 DONE 且不 Renew 時才會回收
- **Worker 分頁標示與批次關閉**
  - Worker 分頁的標題後面會顯示工單編號；Worker 回報後變成綠色的 `✓ T####`，滑鼠移上去可看到回報內容與派工的塔台
  - 塔台分頁按右鍵：「關閉已回報的 Worker 分頁（N）」，關閉前會列出清單讓你確認
  - Worker 分頁按右鍵：「關閉此 Worker」（等同按 ✕）
  - 「已回報」包含「部分完成」與「需要協助」，批次關閉前請確認清單

### Fixed
- **程序已結束的分頁按 ⏻ 重啟沒有反應**（BUG-137）：現在會在同一個分頁重新開一個 shell，沿用工作區環境變數；agent 分頁會重新執行啟動命令。
- **Windows：關閉分頁後，agent 以背景方式啟動的子程序殘留**：使用 Terminal Server（預設）時，關閉分頁、重啟分頁、退出 BAT 並停止 Terminal Server，現在都會結束整個程序樹。退出時選擇保留終端的行為不變。
- 塔台派工日誌的 `sourceTerminalId` 改為記錄派工的塔台（原本永遠是空的）。

### Changed
- 內嵌 Claude CLI：2.1.296 → 2.1.300（模型清單、價格、effort 等級皆無變動）。

### Known issues
- 尚未在真實的 Claude / Codex Worker 上確認：Worker 閒置時如果畫面會定時重繪（例如 spinner），回收可能一直被判定為「仍在輸出」而不執行。遇到請回報。
- macOS / Linux 的程序樹處理只經程式碼確認，未實機驗證。本版以單元測試與 Windows 隔離實例 e2e 驗證。
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）。

## [0.6.1-pre.2] — 2026-10-15

### Added
- **GPU 狀態日誌**（協助診斷 BUG-136：macOS 上使用已久的分頁打字嚴重延遲）：`debug-*.log` 新增 `[gpu]` 開頭的紀錄。
  - 啟動時記錄 GPU 型號、驅動版本，以及各項繪圖功能目前是硬體還是軟體繪圖
  - GPU 行程崩潰時，記錄這是本次第幾次崩潰、崩潰當下的狀態，以及和上次紀錄相比有哪些變化
  - 之後狀態有變化（例如退回軟體繪圖）也會記錄
  - 只記錄，不改變任何繪圖行為

### Known issues
- BUG-136 的根因尚未確定，這版只是協助判斷。遇到卡頓時，請回傳：
  - 最新的 `debug-*.log`（macOS 位於 `~/Library/Application Support/BetterAgentTerminal/Logs/`）
  - `~/Library/Logs/DiagnosticReports/` 裡最新的 `BetterAgentTerminal Helper-*.ips`
- 內嵌 Claude CLI 仍為 2.1.296。

## [0.6.1-pre.1] — 2026-10-15

### Fixed
- **終端焦點不再跳到其他工作區**（BUG-135）：以下情況原本可能讓焦點指向其他工作區的終端，使 snippet 貼上、Skills / Agents 面板作用到錯的終端，現在都限定在目前的工作區：
  - 獨立視窗（detached）關閉、終端交回主視窗時
  - 刪除或封存目前的工作區時
  - 重新載入工作區資料時
- **塔台派工的 Worker 分頁開在你沒在看的工作區時，不再搶走目前的焦點**。Worker 分頁開在目前工作區時與先前相同。
- **新工作區第一次開啟時，不再短暫閃出「沒有終端」的空狀態**：預設終端建立期間改顯示不透明底色，建立完成後直接顯示終端，避免剛好點到「新增終端」多開一個。遠端視窗等待重新連線期間同樣不顯示該按鈕。關閉工作區的最後一個終端時，空狀態仍會立即出現（pre.11 的修正不變）。

### Known issues
- 本版以單元測試與 Windows 隔離實例 e2e 驗證；macOS 尚未實機驗收。

## [0.6.0-pre.11] — 2026-10-15

### Fixed
- **關閉工作區的全部終端後，畫面看起來像當機的問題已修正**（BUG-134）：原本主畫面會透出其他工作區的終端畫面，點擊、輸入都沒有反應，要新增終端才會恢復。現在沒有終端的工作區會顯示空狀態與「新增終端」按鈕，切到其他工作區再切回來也一樣。
  - 根因：切換走的工作區只是被隱藏，它目前所在分頁的面板仍會繪製在畫面底層；目前工作區沒有終端時，空的容器是透明的，底層畫面就透了出來，滑鼠與鍵盤則落在上層的空容器。
- 關閉目前焦點所在的終端後，焦點只會移到同一個工作區的其他終端；工作區已沒有終端時不再指向其他工作區的終端（影響 snippet 貼上等以焦點終端為對象的功能）。

### Known issues
- 新工作區第一次開啟、預設終端建立完成前，可能短暫看到空狀態。
- 本版以單元測試與 Windows 隔離實例 e2e 驗證；macOS 尚未實機驗收。

## [0.6.0-pre.10] — 2026-10-14

### Added
- **工作區設定：每個工作區可各自設定預設 Agent 與啟動參數**（PLAN-040）
  - 工作區右鍵選單的「環境變數」改為「**工作區設定…**」，環境變數成為其中一區
  - **預設 Agent**：可選「跟隨全域設定」或任一 Agent。查找順序不變：工作區 → Settings 預設 Agent → claude-code
  - **啟動參數**：每個 Agent 一列，勾「覆寫」後填入此工作區專用的參數，整串取代 Settings 的全域參數（不串接）；覆寫為空白代表此工作區不帶任何參數。未勾選時沿用全域值
  - 對話框會顯示目前生效的 Agent 與參數，以及來源（此工作區 / 全域設定 / 內建預設）
  - 套用範圍：派工按鈕、新建 Agent 終端、塔台用 `bat-terminal.mjs --agent …` 派工（以 Worker 落點的工作區為準）。以完整指令派工（例如 `bat-terminal.mjs codex --model …`）時不另外加參數

### Fixed
- **獨立視窗（detached）按「開啟設定」改為在主視窗開啟 Settings**（BUG-133）：原本按了沒有反應。主視窗被最小化或縮到系統匣時會一併叫回；找不到主視窗時顯示提示。

### Known issues
- 獨立視窗中的工作區設定只能查看，請在主視窗修改。
- 工作區設定與 Settings 的 Agent 下拉選單都不會列出自訂 CLI。
- 遠端（WSL / SSH / Docker）profile 的塔台經遠端伺服器派工時，沒有工作區層級設定，仍使用遠端伺服器的全域設定。
- 本版以單元測試與 Windows 隔離實例 e2e 驗證；新的工作區設定對話框尚未實機驗收，macOS 尚未實機驗收。

## [0.6.0-pre.9] — 2026-10-14

### Added
- **塔台派工的 cwd 檢查**（BUG-132）：`bat-terminal.mjs` 派工時，會比對派工目錄（`--cwd`）與 Worker 分頁落點工作區的資料夾：
  - 派工目錄不屬於任何工作區（例如跨專案派工）→ 照常建立，印出警告
  - 派工目錄屬於**另一個**工作區 → 照常建立並警告；若帶 `--mode yolo` 則**拒絕派工**（exit 1，錯誤碼 `DISPATCH_CWD_OTHER_WORKSPACE`），訊息列出兩個工作區
  - 背景：某些 agent CLI（目前觀察到 Codex）會沿用另一個分頁保存下來的環境，`$BAT_TERMINAL_ID` / `$BAT_WORKSPACE_ID` 指向別的工作區，導致 Worker 開在別的工作區、完成通知送進別的專案塔台。這個檢查讓這種情況被看見，yolo 下直接擋下
  - 路徑比對在 Windows / macOS 不分大小寫，也會比對 symlink 解開後的實際路徑（iCloud / 雲端硬碟資料夾）
- **`--agent` 簡寫**：`--agent codex` / `--agent claude` 會對應到 `codex-cli` / `claude-cli`；不認得的 agent id 會列出可用的 id（原本只顯示 `terminal-not-created`）。

### Known issues
- 遠端（WSL / SSH / Docker）profile 的派工尚未做 cwd 檢查。
- 若刻意以 `--mode yolo` 把 Worker 派到另一個工作區的資料夾，會被擋下；不帶 `--mode yolo` 即可建立（附警告）。
- 工作區層級的預設 Agent 設定入口仍未提供（PLAN-040）；要讓 `--agent default` 開 Codex，請在 Settings 把預設 Agent 設為 Codex，或派工時帶 `--agent codex`。

## [0.6.0-pre.8] — 2026-10-14

### Fixed
- **macOS：Finder 拷貝後 Command+V 貼不出東西的問題已修正**（BUG-128）。Claude / Codex 面板也能用 Command+V 把 Finder 拷貝的檔案加為附件。
- **塔台派工落點**（BUG-129）：`bat-terminal.mjs` 派工時，Worker 分頁改開在「下指令的塔台分頁目前所在的工作區」，`--agent default` 也依該工作區解析；與 `--workspace` 不一致時寫入警告。派工成功後會多印 `workspace:` / `agent:` 兩行實際落點，方便核對。
- 指揮塔面板：切換工作區時不再把既有工單當成「新工單」或「已完成」跳出整排提示；同一工作區內的新增與狀態變更照常通知。提示框改為不透明底色，不再與底下面板文字重疊（BUG-127）。
- 分頁按 ↺ 重新啟動、或 Terminal Server 當掉後自動重建時，保留原本的環境變數（工作區 / 全域環境變數、Worker 回報塔台所需的變數），連線資訊取當下的值（BUG-131）。

### Changed
- **終端貼上統一規則（Windows / macOS / Linux）**：Ctrl+V、macOS 的 Command+V、右鍵選單「貼上」都依剪貼簿內容決定（BUG-128 / BUG-130）：
  - 檔案（Finder / 檔案總管拷貝）→ 貼上完整路徑，有空白或特殊字元時自動加引號，與拖放檔案相同；macOS 支援多檔
  - 圖片 → 送 claude CLI 的貼圖鍵（Windows 為 Alt+V，macOS / Linux 為 Ctrl+V），在終端執行的 `claude` 可直接貼圖
  - 文字 → 一般貼上
  - 剪貼簿同時有圖片與文字時（例如從 Excel 複製儲存格）視為圖片；要貼文字請用 Ctrl+Shift+V
  - 每次判斷都寫入 debug log（搜尋 `[terminal-paste]`），貼圖偶發失效時可據此回報

### Known issues
- `--agent default` 的查找順序：工作區預設 → Settings 預設 Agent → claude-code。目前**還沒有**工作區層級的設定入口（預計下一批補上，PLAN-040），要讓派工開 Codex，請在 Settings 把預設 Agent 設為 Codex，或派工時帶 `--agent codex`。
- Windows 終端貼圖偶發失效的原因尚未重現，本版改由主程序判斷剪貼簿並加上 log。
- macOS 的修正以單元測試驗證，實機驗收進行中。

## [0.6.0-pre.7] — 2026-10-14

### Fixed
- **配置（Profile）對話框的遠端狀態燈改為反映本機實際連線**。之前 WSL / SSH / Docker profile 的燈號永遠是紅燈「Disconnected」，即使該 profile 的視窗開著、連線正常（BUG-123）。現在分為：
  - 🟢 已連線：本機持有此 profile 的連線
  - 🟡 連線中 / 重新連線中
  - 🔴 連線中斷或連線失敗，滑鼠移上去會顯示原因
  - ⚪ 未開視窗
  - 提示文字三語；對話框開著時，連線 / 斷線會即時更新。
  - 指向另一台完整 BAT 的舊式 remote profile：綠燈改為「本機已連上」才亮；遠端機器上該 profile 使用中但本機未連線時顯示 ⚪ 並註明。
- **SSH 設定精靈**：目標主機的 sshd 不允許 port forwarding（`AllowTcpForwarding no`）時，改為直接說明這個原因並建議修改 sshd 設定，不再顯示成「伺服器埠上的程式沒有提供 TLS 憑證」（BUG-124）。
- Claude 面板的指令清單：`.claude/commands/*.md` 帶 YAML frontmatter 時，描述改讀 `description:`，不再顯示成 `---`（BUG-125）。
- skill 的 frontmatter 沒有 `description:` 時，描述改為 frontmatter 之後的第一行，不再是空白（BUG-126）。

## [0.6.0-pre.6] — 2026-10-14

### Fixed
- **SSH 設定精靈終於能在 Linux 主機上裝好並啟動 server**。自 `v0.4.1` 起，SSH 精靈的「安裝 server bundle」與「啟動 server」兩步都有缺陷，任何版本都無法在 Linux 目標完成（macOS 目標推定相同）。pre.5 release notes 所說的 alias 支援本身是對的，但被這兩個缺陷擋住，本版一併修正：
  - 上傳的 bundle 多解了一層 `staging/`，服務找不到執行檔（BUG-120）。
  - 服務以錯誤的設定名稱傳 port，server 改聽 54321，精靈的啟動檢查因此失敗（BUG-121）。
  - 若 pre.5 曾在某台主機留下 `~/.local/bat-server/staging/`，用 pre.6 重跑精靈即會自動清除並裝成正確佈局；重跑時也會重新啟動已在跑的舊服務。
- **配置（Profile）對話框加寬**：remote 卡片展開後不再只用右半邊；「遠端 AI 工具」改為卡片排列，寬視窗可並排多欄，窄視窗自動縮回（BUG-122）。
- SSH 精靈認證失敗（`permission-denied`）時，現在會顯示「修改 SSH 設定」並回到主機設定步驟。

## [0.6.0-pre.5] — 2026-10-14

### Added
- **SSH 設定精靈**：選 `~/.ssh/config` 的 alias 現在可以完整走完（使用者 / Port / IdentityFile / ProxyJump 由 ssh config 決定）；也可以手動輸入 `user@host:port`。

### Fixed
- **Cache History 成本修正**：總計不再重複加總（先前可能高估 45%–77%），Haiku 5.5 依每次呼叫的 prompt 長度分段計價，Sonnet 5.5 cache read 改為官方 0.05x。
- 自訂 CLI Agents（Settings → Custom CLI Agents）的新增 / 移除先前從未寫入磁碟，重啟後會消失 —— 已修正。
- 本機派工 helper（`bat-terminal`）偶爾把其他分頁的輸出誤判為「分頁已建立」，造成派工遺失（BUG-114）；連線被拒時改為立即顯示原因，不再等到逾時。
- detached workspace 視窗內新增 / 關閉 / 改名的終端，會正確存回原視窗；關閉視窗前會先存檔。
- 設定精靈：跳回前面步驟時會回收本次建立的資源，且可以真的重新修改設定；「Use existing」但沒有容器時重試不再卡住；錯誤畫面改為依介面語言顯示。
- remote profile 連線失敗對話框改為依介面語言顯示（英 / 繁中 / 簡中）。
- 同時建立多個 remote profile 時可能出錯或遺失資料 —— 改為依序寫入。
- remote server 自簽憑證的有效期改為實際 10 年（先前誤為 365 天；用戶端以指紋驗證，既有連線不受影響）。
- 啟動早期就崩潰的情況現在也會寫入日誌，方便回報問題。
- 本機以 snapshot 版號打包時下載 server bundle baseline 會失敗（BUG-115）。

### Changed
- **內嵌 Claude Code CLI 升級到 2.1.296**，新增 **Haiku 5.5** 模型。
- 移除未使用的 `better-sqlite3`，`sharp` / `@img` 不再打包進安裝檔與 server bundle（安裝檔與 server bundle 變小）。
- server bundle 不再含指向建置機路徑的 symlink；macOS server bundle 最低需求 macOS 13.5。
- CI：新增型別檢查關卡；GitHub Actions 升級到原生 Node 24 版本；Linux runner 固定 `ubuntu-24.04`，server bundle 的 macOS runner 改為 `macos-15`。

## [0.6.0-pre.4] — 2026-10-13

### Fixed
- 啟動時忽略 Settings 中的日誌開關與等級（同 BUG-119 根因），已修正
- 終端分頁內的 helper（`bat-terminal` / `bat-notify`）在 `--runtime=<N>` 實例中會找錯憑證，改為依實際資料目錄解析

### Changed
- **資料目錄統一為 `BetterAgentTerminal`**（BUG-119）：日誌、Crashes、snippets 不再寫到小寫的 `better-agent-terminal/`；首次啟動自動複製 / 合併 `Local State`、`snippets.json`、`message-archives/`，`--runtime=<N>` 實例整個目錄改名，舊目錄保留不刪。升級前請先關閉舊版，不要同時執行新舊兩版（細節見 `release-note.md`）
- macOS 仍只提供 Apple Silicon（arm64）版，不支援 Intel Mac（自 v0.6.0-pre.3 起）
- README 更新：版本 badge、技術堆疊、發行流程、資料與日誌路徑

## [0.6.0-pre.3] — 2026-10-13

### Fixed
- **macOS 啟動即崩潰**（BUG-116）：語音模組 `@kutalia/whisper-node-addon` 的 binary 目錄命名與套件內部尋找的路徑不一致，載入失敗導致 app 無法開啟。改為延遲載入並相容兩種目錄名；語音模組不可用時只影響語音輸入，不再拖垮整個 app。
- **macOS / Linux 打包版缺內嵌 claude**（BUG-118）：打包時非 Windows 平台會排除 `.exe`，內嵌 claude 指向的檔案不存在。改用隨套件打包的平台專用 binary；找不到時顯示列出搜尋路徑的明確錯誤。
- 簡繁轉換（opencc）改為使用時才載入，縮短啟動時間。

### Changed
- **不再支援 Intel Mac**：macOS 只提供 Apple Silicon（arm64）版 `BetterAgentTerminal-<版號>-arm64.dmg`；先前的 Intel dmg 內含的原生元件實際上是 arm64，無法使用（BUG-117 / D136）
- CI 在 macOS / Linux 打包後檢查產物：所有原生 binary 的架構、內嵌 claude 是否存在且架構正確、語音模組 binary 是否存在。
- `package.json` 新增 `allowScripts`，支援 npm 12 預設阻擋相依套件 install scripts 的行為；postinstall 改以 `@electron/rebuild` 建置 Electron ABI 的 better-sqlite3。

## [0.6.0-pre.2] — 2026-10-05

（依 commit 整理）

### Added
- **可同時連線多個遠端 profile**（PLAN-039）：每個 profile 各自持有連線，最多 8 個；最後一個視窗關閉 15 秒後才斷線（T0462–T0466）
- **遠端塔台派工與 Worker 回報**（PLAN-036）：遠端視窗的塔台可用 `bat-terminal.mjs` 派工、Worker 可用 `bat-notify.mjs` 回報；遠端 server 為每個 PTY 簽發範圍權杖，helper 隨 server bundle 安裝（T0431–T0434、T0447–T0451、T0456）
- 遠端視窗新增「複製遠端路徑」（T0438）
- 拖放檔案到終端時插入加引號的路徑（T0439）
- 在遠端視窗的 prompt 輸入本機路徑時提示（T0440）
- 遠端 PTY 達上限時顯示提示，不再是空白終端（T0424）

### Fixed
- 開啟外部連結 / 檔案的安全限制：只開 http(s)、執行檔需確認、每個視窗都有導覽保護（BUG-105，T0457 / T0458 / T0460 / T0461）
- 遠端連線：重連沿用已釘選的 client 與指紋、連線成功才替換、載入失敗時釋放（BUG-096，T0419 / T0430 / T0442）
- Docker：主機埠只綁 `127.0.0.1`，偵測舊版對外開放的容器（BUG-097，T0418 / T0427 / T0428）
- 設定精靈：取消時回收失敗的步驟、只回收本次建立的資源、Docker 重試重新啟動本次建立的容器（BUG-099 / BUG-100 / BUG-111，T0426 / T0444 / T0452）
- 拖放檔案路徑、Claude 面板圖片附件、`/snippet` 提示（BUG-107 / BUG-108 / BUG-109，T0435 / T0436 / T0441）
- 遠端視窗未連線時不改在本機執行（BUG-110，T0443）
- detached 工作區視窗綁定父視窗的 profile、讀取父視窗的工作區資料（BUG-112 / BUG-113，T0446 / T0453）
- client 心跳檢查 pong、SSH tunnel 本機埠衝突時重試一次（T0455 / T0465）

### Changed
- SSH 設定精靈只保留 tunnel 模式（BUG-098，T0425）
- 移除未使用的 `worktree:merge` 通道（BUG-106，T0417）

## [0.6.0-pre.1] — 2026-10-05

（依 commit 整理）

### Added
- **遠端視窗功能補齊**（PLAN-036）：WSL / SSH / Docker 遠端視窗的終端、Claude 面板、Git / GitHub / worktree、檔案與圖片功能改由遠端 server 處理（T0388–T0406）
- **遠端 AI 工具偵測與安裝**（PLAN-037）：遠端工具面板列出 claude / codex 等工具的安裝狀態，可在遠端視窗內一鍵安裝，設定精靈完成頁與配置卡片都有入口（T0408–T0415）
- Claude 面板未登入時顯示登入引導（T0402）
- 終端重新連上時重播先前的輸出，不重新啟動 agent（T0403）
- 遠端視窗的 shell 清單依遠端作業系統列出，WSL 工作區預設資料夾（T0393）
- 遠端 server 回收無人使用的 PTY 並設上限（BUG-103，T0404）

### Fixed
- WSL 設定精靈：沒有 distro 被誤判為沒裝 WSL、linger 使用者與 unit 路徑、重試時不再 rollback、網路模式偵測、server port 避開本機 RemoteServer、TLS 指紋擷取逾時、每個 distro 保持一條 wsl.exe 連線（BUG-086 / 087 / 089 / 090 / 091 / 092，T0378–T0384）
- SSH 設定精靈：服務設定檔與 bundle 上傳改用絕對路徑、經 tunnel 驗證遠端 server（BUG-088 / BUG-093，T0379 / T0387）
- 遠端 server 缺少 profile / settings 處理、連線失敗原因分類（BUG-094，T0385）
- Claude 面板的中斷在遠端視窗無效（BUG-095，T0392）
- Terminal Server 重啟後舊 PTY 的結束事件誤關新分頁（BUG-101，T0394）
- Linux 不再強制使用 `en_US.UTF-8` locale（BUG-102，T0398）
- 遠端安裝 codex 不再卡在互動提示（BUG-104，T0415）
- 遠端視窗的路徑參數改依遠端主機解析（BUG-105，T0416）
- 以系統管理員身分執行 BAT 時不自動啟動 codex daemon（BUG-085，T0377）
- 本機打包的版號改以 `package.json` 為準（T0376）

## [0.5.9-pre.4] — 2026-10-04

（依 commit 整理；條目自原 `[Unreleased]` 段移入）

### Fixed
- fix(pricing): the Cache History cost view prices Claude 5 models. `claude-opus-5-5`,
  `claude-fable-5-1`, `claude-sonnet-5-5` and the legacy `claude-opus-5` / `claude-opus-4-8` /
  `claude-sonnet-5` / `claude-fable-5` matched no pricing rule and showed `—`; they now use the
  official per-MTok prices, including the lower cache-read rate of Opus 5.5 (0.05x) and Fable 5.1
  (0.025x) — the old fixed 0.1x would have overstated their cache-read cost 2x / 4x. The pricing
  table moves from two inline copies (Claude and Codex panels) into `src/lib/model-pricing.ts`,
  with unit tests locking every existing 4.x / 3.x price. Settings → default effort no longer
  labels `max` as "(Opus only)" (CLI 2.1.289 supports `max` on all Claude 5 models).
  (refs: BUG-084, T0374)
- fix(claude): Claude panel explains "CLI too old" model rejections. The server rejects a model
  the Claude Code CLI is too old for with `API Error: 400 ... "error_code":"claude_code_version_too_old"`
  (e.g. `Claude Code 2.1.113 does not support this model; version 2.1.280 or newer is required`);
  BAT showed only the raw JSON. The assistant text and the `claude:error` message now get a hint
  naming both versions and the way out (upgrade BAT, or Settings → Advanced → Claude Runtime →
  system and upgrade the system claude), at most once per turn. Classification is a pure renderer
  helper (`src/lib/claude-error-classify.ts`); the `claude:error` channel is unchanged. Also:
  the system-runtime health threshold `HEALTHY_MIN` is raised 2.1.111 → 2.1.280 (Opus 5.5
  minimum), so an older system claude now triggers the `version-warning` toast; the embedded
  runtime additionally gets `DISABLE_UPDATES=1` (CLI 2.1.289+ refuses even a manual
  `claude update`, so the binary inside `app.asar.unpacked` cannot be renamed — BUG-059), for
  Agent sessions resolved to embedded / fallback-to-embedded and for claude-cli terminals in
  embedded mode, never for system runtime; and the model dropdown no longer lists SDK aliases
  (`opus`, `fable`, `sonnet`, `haiku`) whose `resolvedModel` is already a built-in entry, and
  closes the CLI process it spawns to read the model list. (refs: BUG-084, T0372)
- fix(claude): the embedded Claude Code CLI is bumped to 2.1.289 (`@anthropic-ai/claude-code`
  `^2.1.111` → `^2.1.289`; Agent SDK stays `^0.2.111`). The bundled 2.1.113 was rejected
  server-side for `claude-opus-5-5` / `claude-fable-5-1` (`claude_code_version_too_old`). The
  built-in model list now leads with `claude-opus-5-5`, `claude-fable-5-1` and
  `claude-sonnet-5-5` (native 1M context, no `[1m]` variants); the SDK-supplied model list is
  read from the embedded/system CLI instead of the SDK's own bundled binary; queries use
  `thinking: { type: 'adaptive' }`; and the `release.yml` desktop build job moves from Node 20
  to Node 24 (claude-code 2.1.289 requires node >= 22). (refs: BUG-084, T0371)
- fix(codex): Codex connection retries no longer show up as errors. Codex 0.160 reports transport
  retries while the turn is still running — a top-level `error` event `Reconnecting... n/5 (...)`
  and an `item.type="error"` `Falling back from WebSockets to HTTPS transport...` — and BAT
  forwarded both as `claude:error`, so a brief network hiccup showed a red `Error:` and turned off
  the streaming indicator mid-turn. These messages (and the existing `Codex is ignoring ...` config
  warning) are now matched by `isCodexTransientNotice()` in `src/lib/codex-error-classify.ts`,
  logged, and shown as a system notice — the first reconnect / fallback notice of each turn only,
  so the changing retry counter does not flood the chat. `turn.failed` and any other error still
  go to `claude:error` unchanged. (refs: BUG-083, T0370)
- fix(codex): the Codex panel no longer reports config warnings as errors. Newer Codex CLIs emit
  `item.type="error"` for unrecognized `~/.codex/config.toml` keys (`Codex is ignoring ...`) while
  the turn keeps running; BAT forwarded these as `claude:error`, so every turn opened with a red
  `Error:` and the streaming indicator went out early. They are now logged and shown once per
  session as a system notice. Two known Codex failures also get an actionable hint after the raw
  error: `Error loading config.toml` (the Codex in use cannot read a value written by a newer
  Codex — names the key, e.g. `service_tier`) and `requires a newer version of Codex` (names the
  model); both suggest upgrading BAT or pointing `BAT_CODEX_BIN` at a newer `codex`. Classification
  is a pure renderer helper (`src/lib/codex-error-classify.ts`); the `claude:error` channel is
  unchanged. (refs: BUG-083, T0367)

### Changed
- feat(codex): BAT now runs the newest Codex CLI it can find instead of preferring PATH. It
  compares `codex --version` of the embedded binary, the official installer
  (`%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`), every Codex Desktop App build
  (`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`) and `codex` executables on PATH (npm
  `.cmd`/`.ps1` shims still skipped; installer / Desktop App locations are Windows-only), and on a
  tie prefers the embedded one. A newer Codex can write `~/.codex/config.toml` values an older
  binary fails to parse, which used to break sessions when BAT fell back to its embedded copy.
  Candidates whose version cannot be read are skipped (all unreadable → embedded); versions are
  cached per binary path + mtime for the life of the process. `BAT_CODEX_BIN` still overrides the
  choice and is never compared. Each Codex session shows the chosen runtime once as a system
  notice (`Codex CLI <version> (<source>)`), and all candidates are logged. The Codex panel now
  loads the model list on mount so the effort filter applies immediately, and switching to a
  model that does not support the current reasoning effort changes it to that model's default
  effort (or the supported level closest to `medium`). (refs: BUG-083, T0373)
- feat(codex): the Codex model list now comes from the Codex CLI's own
  `$CODEX_HOME/models_cache.json` (default `~/.codex`), read-only: entries with
  `visibility: "list"` in `priority` order, shown under "Codex Agent" in the model picker. If the
  file is missing or unreadable BAT silently falls back to its built-in list, which drops `gpt-5.4`
  and `o3` (ChatGPT accounts get "not supported when using Codex with a ChatGPT account") and adds
  `gpt-6-luna`, `gpt-5.6-terra` and `gpt-5.6-luna`; the default model stays `gpt-5.5`. Codex
  reasoning effort gains `max` and `ultra` (`ultra` is listed by `gpt-5.6-terra` in the cache;
  SDK `persistent` is left out because no model lists it), and the effort dropdown only offers
  levels the selected model supports when that is known. (refs: BUG-083, T0370)
- deps(codex): bump the embedded `@openai/codex-sdk` (and `@openai/codex` + platform packages)
  from 0.124.0 to 0.160.0. The 0.160 platform packages moved the native binary to
  `vendor/<triple>/bin/codex[.exe]` (plus `codex-package.json`, a `codex-path/` helper dir with
  `rg`, and `codex-resources/`); BAT's embedded-binary lookup hard-coded the old
  `vendor/<triple>/codex/` path and would have stopped finding it. Resolution now lives in a pure
  helper (`electron/codex-bundled-path.ts`) that mirrors the SDK's `resolveNativePackage()` and
  accepts both layouts. When the embedded binary is used, its helper dir is prepended to the
  child `PATH` (the SDK only does this when it resolves the binary itself, and BAT always passes
  `codexPathOverride`). Every Codex instance also passes `check_for_update_on_startup=false`.
  Binary selection order (`BAT_CODEX_BIN` → PATH → embedded), the model list and effort levels
  are unchanged. The win32-x64 platform package grows from ~213 MB to ~430 MB unpacked, so
  installers get larger. (refs: BUG-083, T0369)

## [0.5.9-pre.3] — 2026-10-04

（依 commit 整理；條目自原 `[Unreleased]` 段移入）

### Fixed
- fix(server-bundle): the setup wizard's runtime fallback download could never succeed. The
  default base URL (`DEFAULT_RELEASE_BASE_URL` in `src/lib/arch-normalize.ts`, and the two copies
  in `scripts/fetch-baseline-tarball.mjs`) used the owner `anthropics`, under which the repo
  does not exist, and no `server-bundle-v*` release had ever been published — the desktop
  workflows only kept the baseline as an Actions artifact. The owner is now `gowerlin`, and
  `pre-release.yml` / `release.yml` publish the same run's `server-bundle-baseline` artifact
  (3 arch tarballs + `.sha256` sidecars + `manifest.json`) as a `server-bundle-v<version>`
  prerelease right after the desktop release step, on the same commit. URL format, manifest
  schema, tarball naming and the `BAT_SERVER_BUNDLE_BASE_URL` override are unchanged;
  `build-server-bundle.yml`'s manual tag line stays as a fallback. Arches the installer does not
  embed (e.g. a Windows host targeting an arm64 SSH server) previously always hit a 404.
  (refs: BUG-071, T0365, D120)

### Changed
- chore: remove leftover `[T0215-DEBUG-REMOVE]` diagnostics from the PTY write path
  (`scripts/bat-notify.mjs`, `electron/pty-manager.ts`, `electron/terminal-server/server.ts`).
  The terminal server no longer writes a stderr line on every `pty:write`, and `bat-notify`
  no longer dumps the `writeResp` payload on every notify. Error reporting via
  `writeWithResult` `{ ok, reason }` and the `Error: PTY write failed: <reason>` path is
  unchanged. (refs: T0363, BUG-050, T0215)

## [0.5.9-pre.2] — 2026-09-02

（依 commit 整理；條目自原 `[Unreleased]` 段移入）

### Fixed
- fix(terminal): the agent prompt argument is now quoted with the rules of the target shell
  instead of always POSIX. `ShellFamily` had been wired into `buildAgentPromptCommand` but was
  only consumed by `resolveClaudeBaseCommand`; the prompt itself still went through a private
  POSIX-only helper in `electron/main.ts`, so a prompt containing `'` was escaped as `'\''` —
  not a valid escape in PowerShell, which is the common Windows case. The new
  `quoteArgForShell()` in `src/utils/shell-quote.ts` handles posix (`'\''`), pwsh (doubled
  quote) and cmd (`CommandLineToArgvW` backslash rules) separately. The safe-character fast
  path is byte-identical to the removed helper, so existing dispatch prompts are unchanged, and
  `agentCustomArgs` is still passed through without re-quoting. On cmd, `%` is deliberately left
  alone: `%%` folds back to `%` only in batch files, so doubling it would corrupt ordinary text
  such as `100% done`; escaping `%VAR%` on an interactive cmd.exe command line is not possible
  and is documented as a cmd limitation. Design skeleton contributed by the community in PR #19;
  its `cmd` branch was reimplemented here. (refs: T0362, PR #19, PR #18)

## [0.5.9-pre.1] — 2026-09-01

（依 commit 整理；條目自原 `[Unreleased]` 段移入）

### Fixed
- fix(ct): unify the work order ID grammar to `^(?:[A-Z]{2,4}-)?T\d+$` across the whole
  dispatch chain, so cross-project / delegate work orders (`CP-T0113`, `CT-T001`) can be
  dispatched through the structured `--skill` + `--workorder` path instead of only through
  free-text `--prompt`. Four components previously disagreed on the format; `scripts/bat-terminal.mjs`,
  `electron/main.ts` (`buildControlTowerSkillPrompt`) and `src/types/control-tower.ts`
  (`filenameToId` / `filenameToTitle` / `isWorkOrderFile`) now share one grammar. The Control
  Tower panel also stops ignoring `CT-T####` files. (refs: BUG-082, T0360)
- fix(ct): `scripts/migrate-ct-frontmatter.mjs` was the fifth, previously-missed copy of the
  work order ID grammar — it recognised only `CT-T####` and bare `T####`, so `CP-`/`KEEN-`
  style prefixes were silently skipped during migration. It now shares the T0360 grammar
  `(?:[A-Z]{2,4}-)?T\d+` via a single in-file `WORKORDER_ID_PREFIX` / `WORKORDER_ID_HEAD`
  declaration, with sibling pointers to the other three sites. BUG / PLAN / EXP ID rules and
  the script's CLI behaviour are unchanged. (refs: T0361, BUG-082, T0360)

### Changed
- `scripts/bat-terminal.mjs` now prints a stderr hint when `--workspace` is omitted, naming
  `--workspace "$BAT_WORKSPACE_ID"` as the fix. Advisory only — allocation behaviour and exit
  codes are unchanged. (refs: T0360)
- External terminals now leave a diagnosable trail when a requested workspace is not found.
  `workspaceStore.addExternalTerminal()` emits a `[T0361] Workspace miss` debug log naming the
  requested id, the workspace actually landed in, and the terminal id; the `[T0130] External
  terminal added` log in `src/App.tsx` now prints the landed workspace alongside the requested
  one instead of only the requested one, which previously made an unknown id look like it had
  been honoured. Observation only — workspace resolution, the silent fallback to the active
  workspace, and all return values are unchanged. (refs: T0361, T0360, T0137, BUG-031)

## [0.5.8] — 2026-05-24

（依 commit 整理）

> 這段期間 tag 為 v0.5.x，`package.json` 版號仍為 0.4.1 / 0.4.2（安裝檔版號由 CI 依 tag 決定）；CHANGELOG 的 `[0.4.2]` 段所列內容實際分散在 v0.5.0-pre.2–v0.5.8 發佈。

### Fixed
- 指揮塔可解析首字大寫的 bug tracker 區段標題

### Changed
- `package.json` 版號同步為 0.4.2

## [0.5.7] — 2026-05-23

（依 commit 整理）

### Fixed
- 指揮塔支援 `ABANDONED` 工單狀態，視為已結束（T0359，CP-T1148）

### Changed
- 以 Claude 塔台實測 yolo 模式的 `--submit`（BUG-081，T0358）

## [0.5.6] — 2026-05-17

（依 commit 整理）

### Fixed
- `bat-notify --submit` 在預填文字之後延遲送出 Enter，避免 yolo 模式送出時文字還沒寫完（BUG-081，T0357）

## [0.5.5] — 2026-05-17

（依 commit 整理）

### Fixed
- `bat-notify --submit` 的 Enter 改經視窗內的鍵盤事件送出

## [0.5.4] — 2026-05-17

（依 commit 整理）

### Fixed
- `bat-notify --submit` 改以按鍵（keypress）方式送出 Enter

## [0.5.3] — 2026-05-15

（依 commit 整理）

### Fixed
- 遠端 claude-cli 派工會套用 Settings 的 `claudeRuntime.customPath`（PR #18，@RicoChen727）
- `claudeRuntime.customPath` 含 shell 特殊字元時拒絕使用（T0355，BUG-080）
- claude-cli 啟動命令依目標 shell 加引號（T0356，BUG-080）

## [0.5.2] — 2026-05-15

（依 commit 整理）

### Fixed
- GitHub 面板找不到 `gh` CLI 的問題：改為解析 `gh` 的實際路徑（BUG-079，T0352 / T0353）

### Changed
- GitHub 面板補齊簡體中文翻譯

## [0.5.1] — 2026-05-07

（依 commit 整理）

### Fixed
- `bat-terminal.mjs` 以 `--skill --workorder` 派工時，「Terminal created」訊息不再印出 `null`（T0110，BUG-020）

## [0.5.0-pre.2] — 2026-04-28

（依 commit 整理）

> 這段期間 tag 為 v0.5.x，`package.json` 版號仍為 0.4.1 / 0.4.2（安裝檔版號由 CI 依 tag 決定）；CHANGELOG 的 `[0.4.2]` 段所列內容實際分散在 v0.5.0-pre.2–v0.5.8 發佈。

### Added
- **設定精靈錯誤處理全面整修**（PLAN-032）：等待輸入的步驟改為中性的「等待輸入」狀態、錯誤改顯示有標題與說明的面板並提供對應的恢復動作、步驟前置檢查（T0330–T0341；細節見 CHANGELOG `[0.4.2]` 段）
- **指揮塔面板改為優先讀取工單 / BUG / PLAN 的 YAML frontmatter**（PLAN-034，T0344–T0346）；狀態無法辨識時標示為無效，不再誤顯示為 PENDING（BUG-077）

### Fixed
- 設定精靈：WSL linger / systemd 失敗、Docker daemon 未啟動、SSH 主機設定步驟一開始就顯示失敗、錯誤碼在畫面上遺失（BUG-072 / BUG-073 / BUG-074 / BUG-076，T0335–T0339）
- 指揮塔 drift 紀錄移到主程序寫入（BUG-078，T0348）

## [0.4.3] — 2026-04-27

（依 commit 整理）

### Added
- **設定精靈改版**（PLAN-030）：WSL / Docker / SSH 設定精靈改為垂直步驟列（stepper），步驟與說明左右兩欄並排、各自捲動，對話框加寬（T0307、T0309、T0311、T0312）
- **配置（Profile）進階類型改為分類下拉選單**（BUG-070，T0306）
- **遠端 server bundle 發佈機制**（PLAN-031）：安裝檔依平台內建 server bundle baseline，缺少的架構改從 GitHub Release 下載並以 SHA-256 manifest 驗證；精靈自動偵測遠端架構，WSL / SSH / Docker 的「安裝 server bundle」步驟改用同一套分發流程（T0313–T0327）

### Fixed
- **塔台派工的 shell 偏好與 MSYS 路徑改寫回歸**（BUG-075）：Worker prompt 帶 `MSYS_NO_PATHCONV`，避免 Git Bash 把參數中的路徑改寫；派工流程不再綁定特定 agent（T0329 研究，修正 T0341 / T0343）

### Changed
- 前端單元測試改用 vitest + jsdom + React Testing Library（T0307b）
- server bundle 建置 workflow 支援多平台並產生 manifest（T0315）

## [0.4.2] — 2026-05-23 — Control Tower Status Parsing + Setup Wizard UX

### Fixed
- fix(ct): support `ABANDONED` as a final/inactive workorder status for `T####` and `CP-T####` Control Tower workorders (refs: T0359, CP-T1148).
- fix(bat-terminal): clarify "Terminal created" stdout message; no longer prints "null" in --skill --workorder mode (refs: BMad-Guide T0110, 專案A BUG-020)

### Added
- **PLAN-032 — Setup Wizard 錯誤 UX 全面整修**
  Setup Wizard（WSL / Docker / SSH）的失敗處理從「丟一行紅字 + Retry」升級為結構化的可恢復 UX：
  - **`awaiting-input` 狀態**：等待使用者輸入的 step（選 distro / 選 container / 設定 host 等）改用中性藍 `awaiting-input` 狀態，不再進場閃現「失敗」UI。
  - **`WizardErrorMapper`**：4-stage error resolver（exact errorCode → step-scoped regex → platform-wide regex → fallback），把 raw 錯誤翻譯成有標題、body、可展開原始錯誤的 friendly 面板。
  - **`WizardPreflight`**：每個 step 可宣告 preflight check（如 Docker daemon 可達性 / WSL service 狀態），失敗會直接 short-circuit 為 mapped error，不必跑進 step 才爆。
  - **`WizardRecoveryAction` 7 種 kinds**：`retry` / `fixed-and-retry` / `open-link` / `edit-config` / `skip` / `cancel` / `custom`，按 entry 量身訂制最合適的恢復路徑。
  - **6 個 baseline error mappings**：Docker daemon 未啟動、WSL linger 失敗、WSL service 啟動逾時、WSL 未安裝、SSH 認證失敗、SSH 主機名稱為空。
- **PLAN-007 Phase 1–5 — Remote dev support across four environments**
  (`local`, `wsl-linux`, `docker-linux`, `ssh-linux` / `ssh-darwin`). BAT
  terminal now drives AI agents in a remote BAT server installed via a
  unified setup wizard that installs the bundle, registers the service,
  pins the TLS fingerprint, and verifies connectivity end-to-end.
- **SSH deployment** — full SSH wizard with `~/.ssh/config` alias detection,
  key-based authentication (with permission-denied recovery), tunnel mode
  (default, NAT-friendly) and direct mode (advanced), and a multi-arch
  server bundle matrix covering `linux-x64`, `linux-arm64`, and
  `darwin-arm64`. Backed by `SshTunnel` with exponential-backoff
  reconnect (1s → 2s → 4s → 8s → 16s) and `SshPathTranslator` for
  cross-OS chat-context attachments (Windows client → linux/darwin server).
- **Setup wizard rollback contract (C-3, best-effort)** — every wizard step
  registers a rollback handler; on failure or cancellation, the runner
  walks completed steps in reverse and invokes each handler. Profiles are
  **not** persisted unless the wizard reaches `done` cleanly. Coverage:
  `tests/wizard-rollback.test.ts` + `tests/wizard-rollback-cross.test.ts`.
- **ProfileCard UI (C-7)** — ProfilePanel refactored to a list of
  `ProfileCard` components with a per-environment **Details** slot. Each
  card surfaces the bound profile, `targetOS`, pinned TLS fingerprint, and
  a **Re-run wizard** entry point. Consistent UI across local / WSL /
  Docker / SSH cards.
- **Server bundle CI workflow** —
  `.github/workflows/build-server-bundle.yml` now ships server bundle
  artifacts independently of the desktop release pipeline. Three platform
  matrix entries (`linux-x64`, `linux-arm64`, `darwin-arm64`) publish
  `bat-server-<platform>-v<version>.tar.gz` per release.
- **Cross-environment overview docs** —
  `docs/remote-dev-overview.md` (decision tree, comparison table, common
  concepts) plus `docs/plan-007-release-checklist.md` (release engineer
  pre-flight checklist covering all four environments and the rollback
  contract).

### Changed
- **ProfilePanel** rewritten as a list of `ProfileCard` rows with per-env
  details slot, replacing the previous flat key/value layout. Editing flow
  routes through the matching wizard via the **Re-run wizard** button.
- **PathTranslator framework** — new abstraction with five concrete
  translators (`IdentityTranslator` for `local` and undefined-target
  profiles, plus `WslPathTranslator`, `DockerPathTranslator`, and
  `SshPathTranslator` for the remote environments). Pure functions over
  profile metadata, individually unit-tested.
- **RemoteClient middleware** — gained an SSH tunnel chain hook so the SSH
  transport can reuse the same reconnect / fingerprint-pin / health-check
  pipeline as the WSL and Docker transports.

### Changed
- **4 個 input-flavor wizard steps 統一 `kind: 'input'`**
  `configure-ssh-host`、`pick-wsl-distro`、`pick-container`、`configure-mounts` 在 runner 進場直接流轉到 `awaiting-input`，取代以往「先短暫 running 才閃成 failed」的舊路徑。
  - 例外：`configure-mounts` 採 native folder picker（`electronAPI.dialog.showOpenDialog`），不走 `requestChoice`，但仍標 `kind: 'input'` 維持視覺契約。

### Fixed
- **BUG-072** — WSL 啟用 systemd lingering 失敗時，現在會跳「我已執行 `loginctl enable-linger`，重試」的 fixed-and-retry 引導；同時新增「WSL service 啟動逾時」（含 `journalctl` 提示）與「找不到 WSL2」（含 MSFT 安裝指南連結）兩個 mapped errors。
- **BUG-073** — Docker wizard 偵測不到 daemon 時，新面板會提供「下載 Docker Desktop」連結 + 「我已啟動，重試」按鈕，不再只是丟原始 pipe error。
- **BUG-074** — SSH wizard 第一個 `configure-host` step 不再開場就閃現紅 X / Retry / Skip。空值送出時改用 `ssh-configure-host-empty` mapped error（嚴格 2-action set：`修改 SSH 設定` + `取消`，不誤導 retry）。
- **BUG-076** — `SetupWizardShell` 的 mapped error 解析改為優先採用 `WizardRunner` 在失敗瞬間 ship 的 `mappedError`，避免在 render 時重新解析時掉 `errorCode` — 修復 errorCode-only registry entries（如 `wsl-not-installed`）會 fall through 到「步驟發生錯誤」fallback 的 bug。
- **BUG-060 — YOLO chained-shell preference loss** — fixed in session 31
  (commit `fad2978`). Worker chained-shell preference no longer drops on
  successive YOLO mode workorders.

### Tests
- 17 new unit tests covering input-kind contract（T0340，4 個 input step 各自驗證 `kind: 'input'` + `awaiting-input` 流轉）。
- 16 integration tests covering transition matrix + 6 mapped error panel renders（T0338 transitions matrix + T0334 docker-daemon visual snapshot + T0341 補完 5 個 mapped error visual snapshots）。
- Total unit suite：326 tests across 26 files。

### Known issues
- **BUG-061 — `CodexAgentPanel.tsx` baseline TypeScript errors** — pre-existing
  baseline `tsc` errors in `CodexAgentPanel.tsx` are surfaced by the
  `feature/plan-007-remote-dev` branch but **do not affect runtime**. They
  are dev-only and tracked separately; PLAN-007 explicitly excludes their
  cleanup from scope.

## [0.4.1] — 2026-04-26 — PLAN-007 Patch Chain: Remote Dev Hardening

Patch release on top of v0.4.0 closing the seven follow-up BUGs (BUG-062 ~ BUG-068) raised against PLAN-007 remote-dev. All fixes preserve TypeScript baseline (36 errors, all pre-existing in `CodexAgentPanel.tsx` per BUG-061) and ship 250+ green unit tests across SSH lifecycle, path translation, wizard rollback, and remote-client middleware.

### Fixed
- **BUG-062** (F-006, T0300): `RemoteClient` `fingerprint-mismatch` handler now early-returns after emitting the failure callback so the WebSocket open path cannot still settle the connection on a pinned-but-mismatched server.
- **BUG-063** (F-007 + EC-009, T0299): SSH child processes (`ssh-tunnel`, `ssh-start-server`, `ssh-auth-probe`) now share `electron/remote/ssh-process-lifecycle.ts::shutdownSshProcess`, providing SIGTERM → SIGKILL escalation with grace + timeout windows so a wedged `ssh` cannot leak past disconnect / reconnect.
- **BUG-064** (F-008, T0301): SSH spawns inject `LANG=C LC_MESSAGES=C LC_ALL=C` via shared `buildBaseSshSpawnEnv()` so stderr matchers see English-only error strings regardless of host locale (auth-probe / tunnel / start-server / bundle-uploader).
- **BUG-065** (EC-004, T0301): `translateInvokeArgs` is now schema-driven through `PATH_ARG_SCHEMA` in `electron/remote/path-aware-channels.ts`, lifting the prior "first string only" limitation. Multi-path channels (e.g. `git:diff-files`, `fs:copy`) now translate every path argument according to the channel’s declared shape.
- **BUG-066** (EC-005, T0300): `WizardRunner.run()` resets `runPromise = null` on failure so a wizard that crashes mid-run (e.g. SSH key auth denied) can be retried without reloading the renderer.
- **BUG-067** (EC-006, T0299): `RemoteClient.disconnect()` is now `async` and awaits `tunnel.stop()` before resolving so the next `connect()` does not race a half-dead SSH forwarder.
- **BUG-068** (EC-007, T0300): `RemoteClient.invoke` freezes the translator reference at the start of the call and reuses it for both args translation and result normalisation, preventing translator swap-races across long-lived `invoke` round-trips.

### Internal
- New shared helper: `electron/remote/ssh-process-lifecycle.ts` (`shutdownSshProcess`).
- New schema table: `PATH_ARG_SCHEMA` in `electron/remote/path-aware-channels.ts` (centralises per-channel path-arg shapes).
- New / extended tests:
  - `tests/ssh-process-lifecycle.test.ts` (new, 6 cases — SIGTERM/SIGKILL/timeout matrix).
  - `tests/path-aware-channels.test.ts` (new + extended, 9 cases — schema-driven multi-path).
  - `tests/remote-client-middleware.test.ts` (extended, 21 cases — fingerprint-mismatch gate + invoke translator freeze).
  - `tests/wizard-runner.test.ts` (extended, 5 cases — failure-retry).
  - `tests/ssh-args.test.ts` (extended, 15 cases — `buildBaseSshSpawnEnv` env injection).
- TypeScript baseline drift: **0** (36 errors pre/post, all in `CodexAgentPanel.tsx` per BUG-061).
- Aggregate suite (v0.4.1 critical + neighbours): **250+ pass / 0 fail**.

### Known
- **BUG-061** — `src/components/CodexAgentPanel.tsx` baseline `tsc` errors persist (dev-only, runtime unaffected). Cleanup tracked separately; out of scope for the v0.4.x line.

## [0.3.1] — 2026-04-23 — Hotfix: Packaged Helper Bundle

Hotfix release addressing BUG-058 (v0.3.0 NSIS installer shipped without two required helper scripts) and adding a build-time guard to prevent future regressions of the same class.

### Fixed
- **BUG-058 packaged NSIS installer missing `_bat-logger.mjs` and `_bat-cert.mjs`** — `package.json` `build.extraResources[0].filter` was a strict whitelist that only included `bat-terminal.mjs` and `bat-notify.mjs`, dropping their ESM relative imports. Switched to glob whitelist `["*.mjs"]` so every top-level `scripts/*.mjs` helper is bundled (commit `a460d8b`).

### Added
- **Build-time fail-fast guard against helper bundle drift** (`scripts/verify-helper-bundle.js`) — statically parses every `scripts/*.mjs` relative `.mjs` import and checks that each target is covered by `package.json` `build.extraResources[].filter`. Missing coverage aborts the build before vite / electron-builder with a pointer to the offending helper and a suggested filter pattern. Wired into `npm run build`, `npm run build:dir`, and `npm run build:release` via `scripts/build-version.js`, plus a standalone `npm run verify:helpers` entry point. Scope is deliberately narrow (top-level `.mjs` + static imports) to keep false positives low (commits `a73a965` + `1009154`).

## [0.3.0] — 2026-04-23 — Multi-Agent Runtime, Supervisor Mode & GPU Voice Acceleration

First production release of the `gowerlin/better-agent-terminal` fork. Consolidates all pre-release work from `v0.0.x` and `v0.2.x` into a stable baseline.

### Added

#### GPU Voice Acceleration (PLAN-004 Phase 1, EXP-GPUWHIS-001)
- **Vulkan-first voice transcription acceleration on Windows and Linux** — zero-configuration GPU acceleration across NVIDIA, AMD, and Intel Arc via `@kutalia/whisper-node-addon` Vulkan backend
- **Runtime GPU detection** (`electron/gpu-detector.ts`) — auto-detects Vulkan-capable GPUs and falls back to CPU gracefully when no supported hardware is present
- **Settings UI toggle** for GPU acceleration with detected-hardware readout
- **Cross-vendor zero-config** — no CUDA SDK install required; any Vulkan 1.3+ GPU works out of the box
- **macOS Metal GPU** — already enabled in earlier pre-release via upstream `whisper-node-addon` prebuilt; unchanged in v0.3.0

#### Build Safety Net (T0243 — BUG-056 prevention)
- **Build fail-fast guard** (`scripts/verify-native-modules.js`) — `npm run build`, `npm run build:release`, and `npm run build:dir` now abort before vite build / electron-builder if required native modules (`@kutalia/whisper-node-addon`, `@lydell/node-pty`, `better-sqlite3`) are missing from `node_modules/`. Prevents the BUG-056 class of failure where a squash merge updated `package-lock.json` but stale `node_modules/` shipped a broken installer.
- **CI verify step** — `.github/workflows/pre-release.yml` runs the same guard on all three platform jobs (Windows / macOS / Linux) between `@electron/rebuild` and `build-version.js`.

#### Claude Runtime Selection (PLAN-027)
- **Choose between embedded and system Claude CLI** — BAT now ships with an embedded Claude CLI but also lets you opt in to your system-installed `claude` binary
  - **Where**: `Settings → Advanced → Claude Runtime`
  - **Why**: Use bleeding-edge Claude CLI features (new models, new effort levels) without waiting for a BAT release
  - **Safety net**: Automatic fallback to embedded if the system runtime fails health checks (toast notifies you with the degraded reason)
  - **Custom path**: Point to any absolute path to a `claude` binary instead of PATH lookup
  - **Scope**: Changes apply to new sessions and new terminals only; existing sessions continue on their original runtime
- **Windows note**: `npm install -g` produces `.cmd` / `.bat` shims that are intentionally not detected (Node 20+ spawn restrictions). Install via the Anthropic official installer so `claude.exe` lands in `%USERPROFILE%\.local\bin\`.
- **Cross-platform install + troubleshooting playbook**: `docs/plan-027-cross-platform-verification.md`

#### Multi-Agent Runtime (Phase 0 + Phase 1)
- **Universal agent registry** — Provider-based architecture supporting Claude Code, Gemini CLI, GitHub Copilot CLI, Codex CLI, and any user-defined custom CLI
- **Agent runtime module** (`electron/agent-runtime/`) with `AgentDefinition`, `AgentProvider`, and `AgentCapabilities` types
- **9 built-in agent definitions** with correct launch commands, sandbox/yolo flag handling, and capability declarations
- **Custom CLI management UI** in Settings panel — add/remove custom CLI agents with name, command, icon, color, and sandbox/yolo configuration
- **Custom CLI persistence** — saved to `{userData}/custom-clis.json`, loaded on app start
- **Dynamic "+" menu** — ThumbnailBar populates agent options from the registry instead of hardcoded list
- **Agent IPC API** — 8 `agent:*` IPC handlers for querying definitions, building launch commands, and managing custom CLIs
- **Frontend agent types** (`src/types/agent-runtime.ts`) with helper functions for capability checking

#### Supervisor Mode
- **Terminal roles** — `TerminalInstance.role` field supports `'worker'` (default) and `'supervisor'`
- **Right-click context menu** on terminal thumbnails to set/remove supervisor
- **Supervisor badge** (👁) displayed on thumbnail and main panel header
- **Golden border** visual indicator on supervisor thumbnail
- **Worker Panel** component — shows all non-supervisor terminals with:
  - Worker name, agent icon, alive/dead status indicator
  - Last few lines of worker output (auto-refreshes every 3 seconds)
  - Quick-send input field to type commands into any worker's PTY
- **PTY output ring buffer** — stores last 50 lines per terminal for supervisor queries
- **Cross-terminal IPC** — `supervisor:list-workers`, `supervisor:send-to-worker`, `supervisor:get-worker-output`
- **One supervisor per workspace** — setting a new supervisor auto-demotes the previous one

#### Launch Improvements
- **`launch.bat`** — one-click compile + launch script for Windows
- **`launch-hidden.vbs`** — VBS wrapper that runs launch.bat with a hidden console window
- **Start Menu shortcut** — launches via `wscript.exe` for a clean desktop experience

### Fixed

#### Performance Optimizations
- **Terminal flickering** — removed double nested `requestAnimationFrame` and `clearTextureAtlas()` call that forced GPU texture rebuild on every visibility toggle
- **Redundant rendering** — removed `terminal.refresh(0, rows-1)` in ResizeObserver callback that duplicated xterm's built-in re-render after `fitAddon.fit()`
- **Triple resize cascade** — removed unnecessary IntersectionObserver that fired extra `doResize()` on visibility change (already handled by `isActive` effect)
- **MutationObserver layout thrashing** — debounced IME textarea position fix with `requestAnimationFrame` instead of running synchronously on every xterm style mutation
- **PTY data flooding** — added 16ms output batching via `enqueuePtyOutput()` / `flushPtyOutputs()` to coalesce rapid PTY data chunks before IPC broadcast
- **Preview cache thrashing** — batched `stripAnsi()` processing (7+ regex patterns) via RAF so all pending data is processed once per frame instead of per-chunk
- **Activity notification storm** — changed `updateTerminalActivity` from array recreation + 500ms throttle to in-place mutation + 2s throttle

#### Bug Fixes
- **defaultAgent persistence** — fixed `settings-store.ts` `load()` method that was stripping `defaultAgent` on every app start via `delete parsed.defaultAgent`
- **BUG-056 packaged NSIS installer missing `@kutalia/whisper-node-addon`** — squash-merging the EXP-GPUWHIS-001 experiment into main updated `package.json` / `package-lock.json` but did not sync the root repo's `node_modules/`, so the NSIS installer shipped without the native module and crashed at startup with `Cannot find module '@kutalia/whisper-node-addon'`. Fixed by reinstating `npm install` + native rebuild in the release flow; combined with the new build fail-fast guard above, this class of regression is blocked going forward.
- **BUG-057 voice transcription forcibly translated to English** — a default-value change inside `@kutalia/whisper-node-addon` (`translate` flipped from `false` to `true` without changelog notice) caused Traditional Chinese (and all other source-language) voice input to be translated to English output. Voice handler now passes `translate: false` explicitly (`electron/voice-handler.ts`) to preserve source-language transcription regardless of the addon's default.

### Changed
- **WorkspaceView** — unified `handleAddAgent()` handler replaces separate per-agent handlers; resolves agent command from registry
- **MainPanel** — capability-based rendering (shows Claude-specific UI only for integrated agents)
- **TerminalThumbnail** — falls back to agent registry for icon/color when preset not found (supports custom CLIs)
- **ThumbnailBar** — props interface expanded with `onSetSupervisor` / `onClearSupervisor` callbacks
- **workspace-store** — added `setSupervisor()`, `clearSupervisor()`, `getSupervisor()`, `getWorkers()` methods
- **pty-manager** — added `getLastOutput()`, `writeToTerminal()`, `isAlive()` methods for cross-terminal communication
- **README.md** — updated with multi-agent architecture docs, supervisor mode docs, custom CLI docs, and updated architecture tree
