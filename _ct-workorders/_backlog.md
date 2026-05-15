---
schema_version: 1
schema_kind: index
id: _backlog
index_kind: plans
generated_at: "2026-05-15T13:00:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/PLAN-*.md
exclude_globs:
  - _ct-workorders/_archive/**
total: 14
breakdown:
  IDEA: 2
  PLANNED: 2
  IN_PROGRESS: 2
  DONE: 7
  DROPPED: 1
---
# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-05-15 13:00 (UTC+8) — Session 43 BUG-080 series 收尾，PLAN 無變化

## 統計
- 💡 Ideas: 2 | 📋 Planned: 2 | 🔄 In Progress: 2 | ✅ Done: 7 | 🚫 Dropped: 1 | **Total: 14**

> 已歸檔 PLAN（`_archive/plans/`）：19 張

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux 支援） | - | 🔄 IN_PROGRESS | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-032 | Setup Wizard Error UX Overhaul（含 Stepper `awaiting-input` 擴充 + 通用 error mapping framework） | - | 🔄 IN_PROGRESS | [PLAN-032](PLAN-032-wizard-error-ux-overhaul.md) |
| PLAN-014 | evaluate-vscode-extension-vs-git-gui | - | 📋 PLANNED | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-033 | Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR） | - | 📋 PLANNED | [PLAN-033](PLAN-033-tower-state-snapshot-archive-architecture.md) |
| PLAN-015 | refactor-dual-render-path-shared-helper | - | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts 整理 + R5 setup-wizard chunk 切分（BUG-069 audit 衍生） | - | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-034 | Workorder/Index 檔 YAML frontmatter metadata schema 強制化（BAT + CT 雙端） | 2026-04-28 | [PLAN-034](PLAN-034-yaml-frontmatter-metadata-schema-bat-ct.md) |
| PLAN-030 | ProfilePanel + Setup Wizard UI 整體改善（套用 BUG Report stepper 視覺語言） | 2026-04-27 | [PLAN-030](PLAN-030-profile-panel-setup-wizard-ui-overhaul.md) |
| PLAN-028 | BAT dogfood 驗證 CT v4.4.x(CLT 對齊 6 項改良) | 2026-04-26 | [PLAN-028](PLAN-028-bat-dogfood-verify-ct-v44-clt-alignment.md) |
| PLAN-026 | JetBrains Gateway Dev Container 剪貼簿 proxy(HTTP daemon via host.docker.internal) | - | [PLAN-026](PLAN-026-jetbrains-gateway-clipboard-proxy.md) |
| PLAN-021 | remote-server-port-settings-ui | - | [PLAN-021](PLAN-021-remote-server-port-settings-ui.md) |
| PLAN-007 | Remote Dev Support（BAT terminal client/server 跨環境部署） | 2026-04-27 | [PLAN-007](PLAN-007-remote-container-dev-support.md) |
| PLAN-004 | 💡 PLAN-004：GPU/MLX Whisper 加速（Windows/Linux CUDA、Vulkan） | - | [PLAN-004](PLAN-004-gpu-whisper-acceleration-win-linux.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| ~~PLAN-002~~ | ~~💡 PLAN-002：Dynamic Import 衝突修正~~ | dropped | [PLAN-002](PLAN-002-dynamic-import-conflict-fix.md) |

## 🧪 EXP 實驗分支

| ID | 標題 | 狀態 |
|----|------|------|
| EXP-HEADLESS-001 | BAT Remote Server Headless Spike | 📊 CONCLUDED |
