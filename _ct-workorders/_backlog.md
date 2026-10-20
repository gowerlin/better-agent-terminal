---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-10-19T12:41:35+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 24
breakdown:
  IDEA: 7
  PLANNED: 0
  IN_PROGRESS: 0
  DONE: 16
  DROPPED: 1
---

# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-20 17:29 (UTC+8) — PLAN-054 PLANNED（CT Workflow 智能的 BAT 側事項，EXP-WFMINE-001）

## 統計
- 💡 Ideas: 7 | 📋 Planned: 1 | 🔄 In Progress: 0 | ✅ Done: 16 | 🚫 Dropped: 1

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-015 | refactor-dual-render-path-shared-helper | 🟢 low | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts + R5 setup-wizard chunk 切分（BUG-069 衍生） | 🟢 low | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |
| PLAN-038 | 本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖） | 🟢 low | 💡 IDEA | [PLAN-038](PLAN-038-remote-file-upload-staging.md) |
| PLAN-043 | WSL 環境自動化 Phase 2 / 3（由 PLAN-035 移出）：已安裝環境自動修正、從零安裝與重開機接續 | 🟢 low | 💡 IDEA | [PLAN-043](PLAN-043-wsl-automation-phase2-3.md) |
| PLAN-051 | BAT 跨塔台傳訊通道：不同專案的塔台（含 codex 塔台）經 BAT 互相送訊息，不依賴 SendMessage | 🟢 low | 💡 IDEA | [PLAN-051](PLAN-051-cross-tower-messaging-channel.md) |
| PLAN-052 | Docker 遠端路線可用性：發佈 `bat-server` 映像或裝進任意容器、「Use existing」可選容器、重跑精靈更新既有設定 | 🟢 low | 💡 IDEA | [PLAN-052](PLAN-052-docker-remote-usability.md) |
| PLAN-053 | 升級 Electron 42+（Chromium 148+）：Electron 41 已停止更新；Graphite out-of-order CHECK 改為 GPU 程序重啟（BUG-164） | 🟢 low | 💡 IDEA | [PLAN-053](PLAN-053-electron-42-upgrade.md) |
| PLAN-054 | CT Workflow 智能的 BAT 側事項：B4 MCP 政策文件、B6 CT 面板讀 workflow 欄位（等 CT v5.11.0）；B1 不做 | 🟢 low | 📋 PLANNED | [PLAN-054](PLAN-054-ct-workflow-intelligence-bat-side.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-049 | GitHub Pages 專案站：介紹 BAT + Control Tower（W1–W4、案例、遠端、CT 功能導覽與演進史；手動素材另開工單，D172） | 2026-10-18 | [PLAN-049](PLAN-049-github-pages-bat-ct-site.md) |
| PLAN-047 | BAT MCP Server 與 Worktree 合併（路線 [A]：本機範圍權杖、唯讀 MCP、blocked 偵測、worktree 隔離派工；M2 / M3 不續做，D171） | 2026-10-18 | [PLAN-047](PLAN-047-bat-mcp-server-and-worktree-merge.md) |
| PLAN-050 | 跨 session 傳訊時辨識塔台 / Worker（Claude 分頁 session 命名與對應查詢，CT D067 需求；T0641–T0644，0.7.1-pre.1 T0645 實機） | 2026-10-18 | [PLAN-050](PLAN-050-claude-session-identity-for-cross-session.md) |
| PLAN-048 | Worker 問塔台 / 塔台答覆的結構化通道（CT-to-BAT 需求，BMad-Guide D036） | 2026-10-18 | [PLAN-048](PLAN-048-worker-ask-tower-channel.md) |
| PLAN-045 | 塔台分頁標題：`/control-tower` 啟動後 BAT 分頁改為 `<Agent 顯示名> · Tower`（D147） | 2026-10-16 | [PLAN-045](PLAN-045-tower-tab-title.md) |
| PLAN-044 | yolo 分頁遇到 claude / codex 5 小時用量限制時，BAT 在解鎖時間（+ 可設延遲）自動輸入「繼續」 | 2026-10-16 | [PLAN-044](PLAN-044-auto-continue-after-usage-limit.md) |
| PLAN-046 | Dialog 不因點擊外部而關閉：只能經 [X] / [確認] / [取消]（與 Esc） | 2026-10-16 | [PLAN-046](PLAN-046-dialog-no-close-on-outside-click.md) |
| PLAN-036 | headless bat-server 功能 handler 層（終端 / Agent / git / fs），讓 WSL / SSH / Docker 遠端 profile 真正可用 | 2026-10-16 | [PLAN-036](PLAN-036-headless-server-functional-handlers.md) |
| PLAN-037 | 遠端（WSL / SSH / Docker）AI 工具套件檢查與一鍵安裝（claude / codex CLI、git、gh 等） | 2026-10-16 | [PLAN-037](PLAN-037-remote-ai-toolchain-check-and-install.md) |
| PLAN-041 | 塔台收單後自動回收 Worker 分頁（BAT `--close-worker` + CT `*config`；T0535–T0538、T0545、CT-T011；pre.4 實機重驗 T0549） | 2026-10-16 | [PLAN-041](PLAN-041-auto-close-worker-terminal.md) |
| PLAN-035 | WSL 環境全自動化（從未安裝 WSL 到可用的 BAT 伺服器，含環境不符時自動修正） | 2026-10-16 | [PLAN-035](PLAN-035-wsl-environment-full-automation.md) |
| PLAN-033 | Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR） | 2026-10-16 | [PLAN-033](PLAN-033-tower-state-snapshot-archive-architecture.md) |
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | 2026-10-16 | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-042 | T0534 衍生修正：已結束分頁 ⏻ 無效（BUG-137）、Windows 關閉分頁子程序樹、派工日誌欄位、CT 文件落差（T0539 / T0540 / CT-T012） | 2026-10-15 | [PLAN-042](PLAN-042-t0534-side-findings.md) |
| PLAN-040 | 工作區層級預設 Agent ＋ Agent 啟動參數設定（T0529） | 2026-10-14 | [PLAN-040](PLAN-040-workspace-default-agent-setting.md) |
| PLAN-032 | Setup Wizard Error UX Overhaul（Stepper awaiting-input + error mapping framework） | 2026-09-02 | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| ~~PLAN-014~~ | ~~evaluate-vscode-extension-vs-git-gui（2026-10-16 擱置；T0153 ABANDONED）~~ | 2026-10-16 使用者決定擱置 | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
