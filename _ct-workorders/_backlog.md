---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-10-05T07:46:34+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 11
breakdown:
  IDEA: 3
  PLANNED: 3
  IN_PROGRESS: 4
  DONE: 1
  DROPPED: 0
---

# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-05 07:46 (UTC+8) — 第五十五 session：新增 PLAN-038（IDEA）/ PLAN-039（PLANNED，排在 D134 之後）

## 統計
- 💡 Ideas: 3 | 📋 Planned: 3 | 🔄 In Progress: 4 | ✅ Done: 1 | 🚫 Dropped: 0

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-036 | headless bat-server 功能 handler 層（終端 / Agent / git / fs），讓 WSL / SSH / Docker 遠端 profile 真正可用 | 🔴 high | 🔄 IN_PROGRESS | [PLAN-036](PLAN-036-headless-server-functional-handlers.md) |
| PLAN-035 | WSL 環境全自動化（從未安裝 WSL 到可用的 BAT 伺服器，含環境不符時自動修正） | 🔴 high | 🔄 IN_PROGRESS | [PLAN-035](PLAN-035-wsl-environment-full-automation.md) |
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | 🔴 high | 🔄 IN_PROGRESS | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-037 | 遠端（WSL / SSH / Docker）AI 工具套件檢查與一鍵安裝（claude / codex CLI、git、gh 等） | 🟡 medium | 🔄 IN_PROGRESS | [PLAN-037](PLAN-037-remote-ai-toolchain-check-and-install.md) |
| PLAN-039 | 多個 remote profile 同時連線（per-profile RemoteClient 取代單一槽位） | 🟡 medium | 📋 PLANNED | [PLAN-039](PLAN-039-multi-remote-profile-concurrent-clients.md) |
| PLAN-033 | Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR） | 🔴 high | 📋 PLANNED | [PLAN-033](PLAN-033-tower-state-snapshot-archive-architecture.md) |
| PLAN-014 | evaluate-vscode-extension-vs-git-gui | 🟡 medium | 📋 PLANNED | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-038 | 本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖） | 🟢 low | 💡 IDEA | [PLAN-038](PLAN-038-remote-file-upload-staging.md) |
| PLAN-015 | refactor-dual-render-path-shared-helper | 🟢 low | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts + R5 setup-wizard chunk 切分（BUG-069 衍生） | 🟢 low | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-032 | Setup Wizard Error UX Overhaul（Stepper awaiting-input + error mapping framework） | 2026-09-02 | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| _（無）_ | | | |
