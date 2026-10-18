# docs/agent-guide 索引

> T0595 從 CLAUDE.md 搬出的各功能完整原文（契約、欄位表、exit code、日誌格式、實測數據、已知限制、驗證清單、歷史原因）。CLAUDE.md 對應小節保留用途、必守規則、唯一實作位置與連結；改功能時兩邊一起更新。

| 檔案 | 主題 | 對應 CLAUDE.md 小節 |
|---|---|---|
| [bat-mcp-shim.md](bat-mcp-shim.md) | BAT MCP shim（`scripts/bat-mcp.mjs`）與 claude / codex 注入 | BAT MCP shim（PLAN-047 M1 / T0584） |
| [blocked-state.md](blocked-state.md) | blocked 狀態偵測（claude hooks、`terminal:report-hook`、`scripts/bat-hook.mjs`） | blocked 狀態偵測（PLAN-047 M1b / T0590） |
| [build-toolchain.md](build-toolchain.md) | Vite 7 toolchain、electron-builder 26 migration notes | Build Toolchain |
| [claude-session-name.md](claude-session-name.md) | claude-cli 分頁的 `--name`（命名格式、注入點、降級、版本門檻、編碼實測） | Claude 分頁的 session 名稱（PLAN-050 / T0641，D167） |
| [claude-agent-sdk-cli.md](claude-agent-sdk-cli.md) | Claude SDK / CLI 版本、模型、計價、effort、Runtime Selection、auto-update 停用 | Claude Agent SDK / CLI |
| [detached-workspace.md](detached-workspace.md) | detached 視窗的 registry 合併、所有權、關窗 flush、quit 互動、Settings 入口 | Detached workspace 視窗的持久化（T0453 / T0491） |
| [dialog-close-and-escape.md](dialog-close-and-escape.md) | Dialog 不因點擊外部關閉、`ModalOverlay`、Esc 統一 | Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567） |
| [helper-query-channels.md](helper-query-channels.md) | helper 唯讀查詢 channel（whoami / list / get-state / read-output / wait） | helper 唯讀查詢 channel（PLAN-047 M1 / T0582） |
| [logging.md](logging.md) | 日誌、啟動期 crash capture、`[gpu]`、單一 userData、helper userData、PTY env 組裝點、塔台派工落點 | Logging |
| [multi-remote-profiles.md](multi-remote-profiles.md) | 多 remote profile 同時連線、上限、profile index 序列化 | 多 remote profile 同時連線（PLAN-039） |
| [npm12-install-scripts.md](npm12-install-scripts.md) | npm 12 `allowScripts`、手動補跑、本機打包、CI 與 actions / runner 版本 | 本機開發：npm 12 install scripts（T0471 / T0473） |
| [packaging-release-checks.md](packaging-release-checks.md) | 打包前置檢查、產物檢查、安裝檔瘦身、CI pipeline、Server bundle baseline | Packaging / Release 前置檢查 |
| [pty-process-tree.md](pty-process-tree.md) | 關閉分頁時的程序樹（taskkill / server shutdown / quit） | 關閉分頁時的程序樹（T0540 / PLAN-042） |
| [recovery-create-hold.md](recovery-create-hold.md) | Recovery 提示期間的 create hold（`pty:create`、helper 派工、`pty:restart`） | Recovery 提示期間的 `pty:create`（T0578 / BUG-146） |
| [release.md](release.md) | 正式版 / 預覽版 workflow、prerelease 標記與下游發佈、Server bundle tag 線 | Release |
| [remote-security.md](remote-security.md) | Remote TLS / fingerprint / bind / token、SSH target、SSH / WSL bundle 安裝與 rollback | Remote 資安（PLAN-018 T0182） |
| [remote-tower-notify.md](remote-tower-notify.md) | 遠端與本機 PTY 範圍權杖、權限表、跨重開保留、helper frame id 規則 | 遠端 Tower 通知（PLAN-036 K） |
| [terminal-context-menu.md](terminal-context-menu.md) | 終端右鍵選單與滑鼠追蹤、Esc、Shift + 拖曳選取 | 終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142） |
| [tower-questions.md](tower-questions.md) | Worker 問塔台（`question:*` channel、記憶體 store、`blocked` / `tower`、`pendingQuestions`） | Worker 問塔台（PLAN-048 / T0607） |
| [tower-tab-title.md](tower-tab-title.md) | `--set-role tower`、yolo 判定、Tower 標題 | 塔台分頁標題（T0562，D147） |
| [usage-limit-continue.md](usage-limit-continue.md) | 用量限制自動繼續（codex 送文字、claude 只提示 / 只送 Enter） | 用量限制自動繼續（PLAN-044 / T0566，D148） |
| [worker-launch-confirmation.md](worker-launch-confirmation.md) | Worker 啟動確認（`SessionStart` hook、`agentStarted`、`--wait-started` / exit 8） | Worker 啟動確認（T0600，D154） |
| [worker-tab-recycle.md](worker-tab-recycle.md) | `--close-worker` 契約、等安靜、歸屬、Worker 標示 / 批次關閉、外部分頁標題 | Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145） |
| [workspace-agent-launch.md](workspace-agent-launch.md) | 工作區層級預設 agent 與啟動參數 | 工作區層級 Agent / 啟動參數（PLAN-040 / T0529，D142） |
| [worktree-isolated-dispatch.md](worktree-isolated-dispatch.md) | `--isolation worktree` 派工與 `--worktree` 回收清理 | worktree 隔離派工（PLAN-047 W1 / T0583，D150 / D152） |
| [worktree-status.md](worktree-status.md) | `worktree:terminal-status` / `--worktree-status` 唯讀合併信號 | worktree 狀態查詢（PLAN-047 W1 / T0585） |

仍完整保留在 CLAUDE.md、未搬出的小節：No Regressions Policy、Frontend unit tests、Type check、新 PTY 的初始尺寸（T0572 / BUG-145）、Child Process Spawning、Sub-agent / Active Tasks Tracking、React Rendering、Status Line、Electron Runtime、Control Tower 本專案規則。
