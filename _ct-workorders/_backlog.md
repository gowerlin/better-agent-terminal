---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-11-02T05:26:29+0800"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 23
breakdown:
  IDEA: 8
  PLANNED: 1
  IN_PROGRESS: 0
  DONE: 12
  DROPPED: 2
---

# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-11-02 05:26 (UTC+8) — PLAN-055 DONE（交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0773，D215）。前次 2026-11-02 04:59 (UTC+8) — 第一百零四 session 塔台重啟（三）`*sync`：區段與 23 張 PLAN 檔一致，只修正 frontmatter 統計（total 22 → 23、DONE 10 → 11）；PLAN-055 B1（T0766）/ B2（T0767）皆 DONE、已隨 `v0.7.3-pre.4` 發佈，維持 IN_PROGRESS 等實機驗收。前次 2026-11-02 03:49 (UTC+8) — PLAN-055 IN_PROGRESS（T0766 B1 DONE，T0767 B2 進行中）；開 PLAN-058（IDEA，D214）；PLAN-057 DONE

## 統計
- 💡 Ideas: 8 | 📋 Planned: 1 | 🔄 In Progress: 0 | ✅ Done: 12 | 🚫 Dropped: 2

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
| PLAN-054 | CT Workflow 智能的 BAT 側事項：B4 MCP 政策文件（併下次發版）、B6 CT 面板讀 workflow 欄位（延後：CT D090）；B1 不做 | 🟢 low | 📋 PLANNED | [PLAN-054](PLAN-054-ct-workflow-intelligence-bat-side.md) |
| PLAN-058 | Claude 面板改用常駐串流輸入：每個面板一個常駐 query，主回合進行中送出也能排隊、不中斷（T0768 方案 B，D214） | 🟢 low | 💡 IDEA | [PLAN-058](PLAN-058-claude-panel-persistent-streaming-input.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
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
