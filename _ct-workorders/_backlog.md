# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-04-27 11:13 (UTC+8) — Session 35 PLAN-031 開立 + 主體實作 11 工單一氣呵成（Sprint 1-5，~113 min Worker wall）；剩 T0324（user dogfood）+ T0326（外部依賴）待下個 session。

## 統計
- 💡 Ideas: 2 | 📋 Planned: 1 | 🔄 In Progress: 1 | ✅ Done: 6 | 🚫 Dropped: 1 | **Total: 11**

> 已歸檔 PLAN（`_archive/plans/`）：19 張

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-031 | Server Bundle Distribution（含 ARM64 Linux）— Sprint 1-5 主體 11 工單已 DONE，剩 T0324 dogfood + T0326 升級 UI | 🔴 High | 🔄 IN_PROGRESS | [PLAN-031](PLAN-031-server-bundle-distribution.md) |
| PLAN-014 | BAT 內建 Git 圖形介面（方向 B） | 🟡 Medium | 📋 PLANNED | [PLAN-014](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-015 | Refactor：抽取 renderPanelContent shared helper（消除 App.tsx/WorkspaceView.tsx 雙 render 路徑） | 🟢 Low | 💡 IDEA | [PLAN-015](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-029 | Renderer hardening：R3 indexBench.ts misplaced require（R5 已由 T0309 合併落地） | 🟢 Low | 💡 IDEA | [PLAN-029](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-030 | ProfilePanel + Setup Wizard UI 整體改善（6 工單 + 1 補丁，~50 min Worker wall，47 unit tests，收斂 BUG-070 → VERIFY） | 2026-04-27 00:04 | [PLAN-030](PLAN-030-profile-panel-setup-wizard-ui-overhaul.md) |
| PLAN-007 | BAT terminal client/server 拆分 + 跨環境 server 部署（local/WSL/Docker/SSH）— 23 工單全收 | 2026-04-26 16:34 | [PLAN-007](PLAN-007-remote-container-dev-support.md) |
| PLAN-021 | Settings UI 支援自訂 RemoteServer port — 由 PLAN-007 整體收斂 | 2026-04-26 | [PLAN-021](PLAN-021-remote-server-port-settings-ui.md) |
| PLAN-026 | JetBrains Gateway 剪貼簿 proxy — 由 PLAN-007 多 deployment 替代路徑收斂 | 2026-04-26 | [PLAN-026](PLAN-026-jetbrains-gateway-clipboard-proxy.md) |
| PLAN-004 | GPU Whisper acceleration — Phase 1 Vulkan 交付，Phase 2 CUDA 結案不續做 | 2026-04-26 | [PLAN-004](PLAN-004-gpu-whisper-acceleration-win-linux.md) |
| PLAN-028 | BAT dogfood verify CT v4.4.x — sessions 26-31 大規模實戰驗證 | 2026-04-26 | [PLAN-028](PLAN-028-bat-dogfood-verify-ct-v44-clt-alignment.md) |

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| ~~PLAN-002~~ | ~~Dynamic import 衝突修正~~ | Vite 7.x 升級觸發點已錯過（PLAN-003/T0163）+ 純預防性無實證痛點 + hybrid 策略合理 | [PLAN-002](PLAN-002-dynamic-import-conflict-fix.md) |
