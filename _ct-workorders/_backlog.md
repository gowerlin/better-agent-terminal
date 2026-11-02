---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-11-02T18:24:49+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 26
breakdown:
  IDEA: 8
  PLANNED: 1
  IN_PROGRESS: 0
  DONE: 15
  DROPPED: 2
---

# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-11-02 18:24 (UTC+8) — 開 PLAN-061（IDEA，PLAN-059 子項 B，OSC 7501 白名單，D227；前置 T0789）。前次 2026-11-02 17:10 (UTC+8) — PLAN-053 DONE（T0785 safeStorage async 完成）。前次 2026-11-02 16:56 (UTC+8) — 開 PLAN-060（IDEA，macOS 簽章，D224）；PLAN-053 的 Electron 45 已合回 main（T0784，`9f2ed99c`）。前次 2026-11-02 14:46 (UTC+8) — PLAN-053 IN_PROGRESS（目標 Electron 45，T0783 / T0784 / T0785，D223）。前次 2026-11-02 14:16 (UTC+8) — PLAN-029 DONE（T0780 刪除 `git-poc`，`16a3a326`）。前次 2026-11-02 14:07 (UTC+8) — PLAN-053 調 high（開 T0779）；PLAN-029 開 T0780（R3 刪除 `git-poc`）；PLAN-015 / 038 / 043 / 051 / 052 核對後維持 IDEA（D221）。前次 2026-11-02 14:00 (UTC+8) — PLAN-054 DONE（B4 / B8 已交付；B6 等 CT 契約另開新 PLAN，D220）。前次 2026-11-02 13:23 (UTC+8) — 開 PLAN-059（PLANNED，主 PLAN，D219）。前次 2026-11-02 05:26 (UTC+8) — PLAN-055 DONE（交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0773，D215）。前次 2026-11-02 04:59 (UTC+8) — 第一百零四 session 塔台重啟（三）`*sync`：區段與 23 張 PLAN 檔一致，只修正 frontmatter 統計（total 22 → 23、DONE 10 → 11）；PLAN-055 B1（T0766）/ B2（T0767）皆 DONE、已隨 `v0.7.3-pre.4` 發佈，維持 IN_PROGRESS 等實機驗收。前次 2026-11-02 03:49 (UTC+8) — PLAN-055 IN_PROGRESS（T0766 B1 DONE，T0767 B2 進行中）；開 PLAN-058（IDEA，D214）；PLAN-057 DONE

## 統計
- 💡 Ideas: 8 | 📋 Planned: 1 | 🔄 In Progress: 0 | ✅ Done: 15 | 🚫 Dropped: 2

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-015 | refactor-dual-render-path-shared-helper | 🟢 low | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-038 | 本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖） | 🟢 low | 💡 IDEA | [PLAN-038](PLAN-038-remote-file-upload-staging.md) |
| PLAN-043 | WSL 環境自動化 Phase 2 / 3（由 PLAN-035 移出）：已安裝環境自動修正、從零安裝與重開機接續 | 🟢 low | 💡 IDEA | [PLAN-043](PLAN-043-wsl-automation-phase2-3.md) |
| PLAN-051 | BAT 跨塔台傳訊通道：不同專案的塔台（含 codex 塔台）經 BAT 互相送訊息，不依賴 SendMessage | 🟢 low | 💡 IDEA | [PLAN-051](PLAN-051-cross-tower-messaging-channel.md) |
| PLAN-052 | Docker 遠端路線可用性：發佈 `bat-server` 映像或裝進任意容器、「Use existing」可選容器、重跑精靈更新既有設定 | 🟢 low | 💡 IDEA | [PLAN-052](PLAN-052-docker-remote-usability.md) |
| PLAN-058 | Claude 面板改用常駐串流輸入：每個面板一個常駐 query，主回合進行中送出也能排隊、不中斷（T0768 方案 B，D214） | 🟢 low | 💡 IDEA | [PLAN-058](PLAN-058-claude-panel-persistent-streaming-input.md) |
| PLAN-059 | Herdr 對照研究的借鏡項目（主 PLAN）：送文字前先看目標狀態、OSC 7501 不限 codex、等任一 Worker、holder 模型、SSH stdio 遠端（D219，待拆子 PLAN） | 🟡 medium | 📋 PLANNED | [PLAN-059](PLAN-059-herdr-comparison-borrowings.md) |
| PLAN-060 | macOS 安裝檔改用 Apple Developer ID 簽章與公證（Electron 42 起未簽章 app 不顯示系統通知；本 fork 目前全為 ad-hoc；D224） | 🟢 low | 💡 IDEA | [PLAN-060](PLAN-060-macos-developer-id-signing.md) |
| PLAN-061 | OSC 7501 狀態回報不限 codex：白名單 `codex` / `claude-code`、放寬解析長度（PLAN-059 子項 B；前置研究 T0789；D227） | 🟡 medium | 💡 IDEA | [PLAN-061](PLAN-061-osc7501-allowlist.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-053 | Electron 41.2.1 → 41.10.7 → 45.2.1（T0779 / T0781 / T0783 / T0784 / T0785；macOS 簽章另見 PLAN-060） | 2026-11-02 | [PLAN-053](PLAN-053-electron-42-upgrade.md) |
| PLAN-029 | Renderer hardening：R5 setup-wizard chunk（T0309）、R3 刪除未引用的 `git-poc` benchmark（T0780） | 2026-11-02 | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |
| PLAN-054 | CT Workflow 智能的 BAT 側事項：B4 MCP 政策文件（T0687）、B8 試點（T0673）已交付；B6 等 CT 定義欄位與契約後另開新 PLAN（D220） | 2026-11-02 | [PLAN-054](PLAN-054-ct-workflow-intelligence-bat-side.md) |
| PLAN-055 | Terminal Server recovery 後列出被中斷的 agent 分頁、claude 一鍵 `--resume`、codex `resume` 選單（T0766 / T0767；`v0.7.3-pre.4` 安裝版 T0773 實測） | 2026-11-02 | [PLAN-055](PLAN-055-agent-tabs-after-terminal-server-recovery.md) |
| PLAN-057 | bat-server（headless）啟動時以登入 shell 取得 PATH（預設開、可關；T0754 量測、T0755 實作；`0.7.3-pre.3` WSL 實機 `applied`） | 2026-11-02 | [PLAN-057](PLAN-057-headless-server-login-shell-path.md) |
| PLAN-047 | BAT MCP Server 與 Worktree 合併（路線 [A]：本機範圍權杖、唯讀 MCP、blocked 偵測、worktree 隔離派工；M2 / M3 不續做，D171） | 2026-10-18 | [PLAN-047](PLAN-047-bat-mcp-server-and-worktree-merge.md) |
| PLAN-050 | 跨 session 傳訊時辨識塔台 / Worker（Claude 分頁 session 命名與對應查詢，CT D067 需求；T0641–T0644，0.7.1-pre.1 T0645 實機） | 2026-10-18 | [PLAN-050](PLAN-050-claude-session-identity-for-cross-session.md) |
| PLAN-048 | Worker 問塔台 / 塔台答覆的結構化通道（CT-to-BAT 需求，BMad-Guide D036） | 2026-10-18 | [PLAN-048](PLAN-048-worker-ask-tower-channel.md) |
| PLAN-036 | headless bat-server 功能 handler 層（終端 / Agent / git / fs），讓 WSL / SSH / Docker 遠端 profile 真正可用 | 2026-10-16 | [PLAN-036](PLAN-036-headless-server-functional-handlers.md) |
| PLAN-041 | 塔台收單後自動回收 Worker 分頁（BAT `--close-worker` + CT `*config`；T0535–T0538、T0545、CT-T011；pre.4 實機重驗 T0549） | 2026-10-16 | [PLAN-041](PLAN-041-auto-close-worker-terminal.md) |
| PLAN-035 | WSL 環境全自動化（從未安裝 WSL 到可用的 BAT 伺服器，含環境不符時自動修正） | 2026-10-16 | [PLAN-035](PLAN-035-wsl-environment-full-automation.md) |
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | 2026-10-16 | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-042 | T0534 衍生修正：已結束分頁 ⏻ 無效（BUG-137）、Windows 關閉分頁子程序樹、派工日誌欄位、CT 文件落差（T0539 / T0540 / CT-T012） | 2026-10-15 | [PLAN-042](PLAN-042-t0534-side-findings.md) |
| PLAN-040 | 工作區層級預設 Agent ＋ Agent 啟動參數設定（T0529） | 2026-10-14 | [PLAN-040](PLAN-040-workspace-default-agent-setting.md) |
| PLAN-032 | Setup Wizard Error UX Overhaul（Stepper awaiting-input + error mapping framework） | 2026-09-02 | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| ~~PLAN-056~~ | ~~一個塔台統籌多個獨立 repo 時，指揮塔面板看不到子 repo 的工單（GitHub #21）~~ | 2026-10-30 D189：不改程式，改走 CT 推薦的目錄配置（工單集中上層塔台 repo） | [PLAN-056](PLAN-056-multi-repo-tower-workorder-visibility.md) |
| ~~PLAN-014~~ | ~~evaluate-vscode-extension-vs-git-gui（2026-10-16 擱置；T0153 ABANDONED）~~ | 2026-10-16 使用者決定擱置 | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
