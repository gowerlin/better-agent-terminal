# docs/agent-guide 索引

> T0595 從 CLAUDE.md 搬出的各功能完整原文（契約、欄位表、exit code、日誌格式、實測數據、已知限制、驗證清單、歷史原因）。CLAUDE.md 對應小節保留用途、必守規則、唯一實作位置與連結；改功能時兩邊一起更新。

| 檔案 | 主題 | 對應 CLAUDE.md 小節 |
|---|---|---|
| [bat-mcp-shim.md](bat-mcp-shim.md) | BAT MCP shim（`scripts/bat-mcp.mjs`）與 claude / codex 注入 | BAT MCP shim（PLAN-047 M1 / T0584） |
| [blocked-state.md](blocked-state.md) | blocked 狀態偵測（claude hooks、`terminal:report-hook`、`scripts/bat-hook.mjs`） | blocked 狀態偵測（PLAN-047 M1b / T0590） |
| [build-toolchain.md](build-toolchain.md) | Vite 7 toolchain、electron-builder 26 migration notes | Build Toolchain |
| [claude-session-name.md](claude-session-name.md) | claude-cli 分頁的 `--name`（命名格式、注入點、降級、版本門檻、編碼實測） | Claude 分頁的 session 名稱（PLAN-050 / T0641，D167） |
| [claude-agent-sdk-cli.md](claude-agent-sdk-cli.md) | Claude SDK / CLI 版本、模型、計價、effort、Runtime Selection、auto-update 停用 | Claude Agent SDK / CLI |
| [ct-plugin-install.md](ct-plugin-install.md) | CT zip / plugin 安裝判斷：Codex 派工送 `$ct-exec` / `$ct:ct-exec`、`terminal:control-tower-prompt`、ct-config 預設值層與 skill 面板認得 `ct@*` plugin | CT plugin 安裝（T0710） |
| [ct-tower-overview.md](ct-tower-overview.md) | 指揮塔「總覽」：`_tower-state.md` 摘要契約 v1、`*config` 三層生效值與來源、`ct:read-config-sources`、無狀態工單計數、自動更新 | 指揮塔總覽（T0701，D184） |
| [detached-workspace.md](detached-workspace.md) | detached 視窗的 registry 合併、所有權、關窗 flush、quit 互動、Settings 入口 | Detached workspace 視窗的持久化（T0453 / T0491） |
| [dialog-close-and-escape.md](dialog-close-and-escape.md) | Dialog 不因點擊外部關閉、`ModalOverlay`、Esc 統一 | Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567） |
| [headless-login-shell-path.md](headless-login-shell-path.md) | headless bat-server 啟動時以登入 shell 取得 PATH（`-l -i` + 隨機標記、detached + 逾時砍程序群組、合併規則、`headlessLoginShellPath` 開關、套用點、影響、實測） | headless server 的登入 shell PATH（PLAN-057 / T0755，D206 / D207） |
| [helper-query-channels.md](helper-query-channels.md) | helper 唯讀查詢 channel（whoami / list / get-state / read-output / wait） | helper 唯讀查詢 channel（PLAN-047 M1 / T0582） |
| [linux-ci-acceptance.md](linux-ci-acceptance.md) | GitHub Actions ubuntu-22.04 / 24.04 runner 啟動發佈的 AppImage（`linux-acceptance.yml` 只能手動觸發、FUSE / sandbox 處理、L1 / L2 / L1b / W1（whisper 載入，T0800）/ V1（語音可用性檢查，T0802）與 PASS / WARN / FAIL 判讀、AppImage 靜態檢查、本機 WSL 實測） | Release（T0797 一行） |
| [linux-appimage-sandbox.md](linux-appimage-sandbox.md) | Linux AppImage 啟動器：userns 受限且 `chrome-sandbox` 不是 root 4755 時自動加 `--no-sandbox`（注入點查證、判斷條件、stderr / debug log、安全取捨、AppArmor profile 範例、已知限制、驗證清單） | Linux AppImage 的 sandbox 自動降級（T0799 / BUG-202，D244） |
| [logging.md](logging.md) | 日誌、啟動期 crash capture、`[gpu]`、單一 userData、helper userData、PTY env 組裝點、塔台派工落點 | Logging |
| [macos-ci-acceptance.md](macos-ci-acceptance.md) | GitHub Actions macOS runner 對發佈 dmg 驗 BUG-128 / 130（`macos-acceptance.yml` 只能手動觸發、可行性表 P1–P5、情境 ①–⑧、與真人 Mac 的差異） | （無；T0778 新增，是否補 CLAUDE.md 小節由塔台決定） |
| [multi-remote-profiles.md](multi-remote-profiles.md) | 多 remote profile 同時連線、上限、profile index 序列化 | 多 remote profile 同時連線（PLAN-039） |
| [notify-hold.md](notify-hold.md) | 塔台等使用者回答（權限 / AskUserQuestion / codex 審批）時保留 helper 送來的文字＋Enter、安靜 1 s 後送出（契約 10 點、常數、日誌、待送 N 與取消、已知限制、驗證清單） | 塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227） |
| [npm12-install-scripts.md](npm12-install-scripts.md) | npm 12 `allowScripts`、手動補跑、本機打包、CI 與 actions / runner 版本 | 本機開發：npm 12 install scripts（T0471 / T0473） |
| [packaging-release-checks.md](packaging-release-checks.md) | 打包前置檢查、產物檢查、安裝檔瘦身、Linux whisper 函式庫搜尋路徑（patchelf `$ORIGIN`，T0800）、CI pipeline、Server bundle baseline | Packaging / Release 前置檢查 |
| [new-pty-initial-size.md](new-pty-initial-size.md) | 隱藏分頁不 fit 的守門（`canFitTerminalContainer`）、9x5 的來源、initial resize 到期再檢查 active、驗證清單 | 新 PTY 的初始尺寸（T0572 / BUG-145）（T0741 / BUG-180 的部分；T0572 本身仍完整留在 CLAUDE.md） |
| [pty-process-tree.md](pty-process-tree.md) | 關閉分頁時的程序樹（taskkill / server shutdown / quit） | 關閉分頁時的程序樹（T0540 / PLAN-042） |
| [recovery-create-hold.md](recovery-create-hold.md) | Recovery 提示期間的 create hold（`pty:create`、helper 派工、`pty:restart`） | Recovery 提示期間的 `pty:create`（T0578 / BUG-146） |
| [release.md](release.md) | 正式版 / 預覽版 workflow、prerelease 標記與下游發佈、Server bundle tag 線 | Release |
| [remote-security.md](remote-security.md) | Remote TLS / fingerprint / bind / token、SSH target、SSH / WSL bundle 安裝與 rollback | Remote 資安（PLAN-018 T0182） |
| [remote-tower-notify.md](remote-tower-notify.md) | 遠端與本機 PTY 範圍權杖、權限表、跨重開保留、helper frame id 規則 | 遠端 Tower 通知（PLAN-036 K） |
| [terminal-context-menu.md](terminal-context-menu.md) | 終端右鍵選單與滑鼠追蹤、Esc、Shift + 拖曳選取 | 終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142） |
| [terminal-links.md](terminal-links.md) | 終端 `file:///` 連結的格子欄位範圍（全形字）、跨行串接、OSC 8 `linkHandler`（scheme 限制、hover 顯示目標） | 終端連結：`file:///` 範圍與 OSC 8（T0713 / BUG-174） |
| [terminal-server-recovery.md](terminal-server-recovery.md) | Terminal Server 存活判定（單調時鐘 heartbeat、連續 3 次、程序 + IPC 確認）與 recovery（切斷 / 結束舊 server、generation、孤兒先殺樹） | Terminal Server 存活判定與 recovery（T0704 / BUG-171） |
| [terminal-wheel-reports.md](terminal-wheel-reports.md) | Codex 分頁在 alt screen + 滑鼠追蹤時依累積行數送多個滾輪回報 | Codex 分頁的滾輪回報（T0698 / BUG-165） |
| [thumbnail-preview.md](thumbnail-preview.md) | 終端縮圖預覽：T0667 上限、游標換列當成換行 / 原地更新 / 清畫面重新開始、stripAnsi 完整 CSI 語法、ConPTY 對照 | 終端縮圖預覽（T0667 / T0714，BUG-175） |
| [tower-questions.md](tower-questions.md) | Worker 問塔台（`question:*` channel、記憶體 store、`blocked` / `tower`、`pendingQuestions`） | Worker 問塔台（PLAN-048 / T0607） |
| [tower-tab-title.md](tower-tab-title.md) | `--set-role tower`、yolo 判定、Tower 標題 | 塔台分頁標題（T0562，D147） |
| [usage-limit-continue.md](usage-limit-continue.md) | 用量限制自動繼續（codex 送文字、claude 只提示 / 只送 Enter） | 用量限制自動繼續（PLAN-044 / T0566，D148） |
| [voice-availability.md](voice-availability.md) | 語音輸入可用性事先檢查：啟動後以短命子程序（`ELECTRON_RUN_AS_NODE`）試載 whisper、三態與原因代碼、麥克風停用與安裝提示、Alt+M、Settings 重新檢查、日誌、遠端 / detached 行為、已知限制 | 語音輸入可用性事先檢查（T0802，D247） |
| [worker-launch-confirmation.md](worker-launch-confirmation.md) | Worker 啟動確認（`SessionStart` hook、`agentStarted`、`--wait-started` / exit 8） | Worker 啟動確認（T0600，D154） |
| [worker-tab-recycle.md](worker-tab-recycle.md) | `--close-worker` 契約、等安靜、歸屬、Worker 標示 / 批次關閉、外部分頁標題 | Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145） |
| [workspace-agent-launch.md](workspace-agent-launch.md) | 工作區層級預設 agent 與啟動參數 | 工作區層級 Agent / 啟動參數（PLAN-040 / T0529，D142） |
| [worktree-isolated-dispatch.md](worktree-isolated-dispatch.md) | `--isolation worktree` 派工與 `--worktree` 回收清理 | worktree 隔離派工（PLAN-047 W1 / T0583，D150 / D152） |
| [worktree-status.md](worktree-status.md) | `worktree:terminal-status` / `--worktree-status` 唯讀合併信號 | worktree 狀態查詢（PLAN-047 W1 / T0585） |

仍完整保留在 CLAUDE.md、未搬出的小節：No Regressions Policy、Frontend unit tests、Type check、新 PTY 的初始尺寸（T0572 / BUG-145）、Child Process Spawning、Sub-agent / Active Tasks Tracking、React Rendering、Status Line、Electron Runtime、Control Tower 本專案規則。
