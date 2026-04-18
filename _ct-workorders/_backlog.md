# Backlog

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後更新:2026-04-18 21:50 (UTC+8)
>
> 統計:💡 Ideas: 5 | 📋 Planned: 4 | 🔄 In Progress: 0 | ✅ Done: 5 | 🚫 Dropped: 1
>
> 本 session 閉環：PLAN-018 DONE（Remote 資安加固，T0182/T0183/T0184 三張全綠）
>
> 📦 已歸檔：4 張（PLAN-006 DROPPED, PLAN-008 DONE, PLAN-010 DONE, PLAN-011 DONE → _archive/plans/）
> 本輪（2026-04-18 05:45）新歸檔：PLAN-010（upstream sync v2.1.3→v2.1.42 DONE）、PLAN-011（CT/BAT routing upstream PR DONE）
>
> Completed 熱區保留：PLAN-003 / PLAN-005 / PLAN-016（2026-04-18 當日 DONE，未滿 archive_days）+ PLAN-012（被 PLAN-014 🟡 PLANNED 引用，豁免）

## Active

| ID | 標題 | 優先級 | 狀態 | 連結 |
|----|------|--------|------|------|
| PLAN-018 | Remote 連線資安加固（TLS + fingerprint + sandbox + anti-bruteforce，T0164 Phase 2） | 🔴 High | 📋 PLANNED | [詳細](PLAN-018-remote-security-hardening.md) |
| PLAN-004 | GPU Whisper 加速（Win/Linux） | 🟡 Medium | 📋 PLANNED | [詳細](PLAN-004-gpu-whisper-acceleration-win-linux.md) |
| PLAN-009 | Sprint 儀表板 UI | 🟡 Medium | 📋 PLANNED | [詳細](PLAN-009-sprint-dashboard-ui.md) |
| PLAN-014 | BAT 內建 Git 圖形介面（方向 B，T0152 紙上否決方向 A） | 🟡 Medium | 📋 PLANNED | [詳細](PLAN-014-evaluate-vscode-extension-vs-git-gui.md) |
| PLAN-002 | Dynamic Import 衝突修復 | 🟢 Low | 💡 IDEA | [詳細](PLAN-002-dynamic-import-conflict-fix.md) |
| PLAN-007 | 遠端容器開發支援 | 🟢 Low | 💡 IDEA | [詳細](PLAN-007-remote-container-dev-support.md) |
| PLAN-013 | NSIS Installer 偵測檔案鎖定時詢問 kill Terminal Server | 🟢 Low | 💡 IDEA | [詳細](PLAN-013-installer-force-kill-on-file-lock.md) |
| PLAN-015 | Refactor：抽 renderPanelContent shared helper 消除雙 render 路徑 | 🟢 Low | 💡 IDEA | [詳細](PLAN-015-refactor-dual-render-path-shared-helper.md) |
| PLAN-019 | 清理 fork 既有 TypeScript 技術債（`tsc --noEmit` ~20 errors，T0165 發現） | 🟢 Low | 💡 IDEA | [詳細](PLAN-019-typescript-debt-cleanup.md) |

## Completed

| ID | 標題 | 完成時間 | 連結 |
|----|------|---------|------|
| PLAN-016 | Electron runtime 28.3.3 → 41.2.1 升級（三 Phase 全閉環，D047-D051/D055/D056） | 2026-04-18 05:30 | [詳細](PLAN-016-electron-runtime-upgrade-28-to-41.md) |
| PLAN-003 | npm audit 殘餘漏洞（Group A + B + C 三組全結案，D052/D053/D054/D055） | 2026-04-18 05:25 | [詳細](PLAN-003-npm-audit-remaining-vulnerabilities.md) |
| PLAN-005 | Electron Builder 升級（24.13.3 → 26.8.1，EXP worktree 模式，D054/D055） | 2026-04-18 05:25 | [詳細](PLAN-005-electron-builder-upgrade.md) |
| PLAN-012 | Quit Dialog 新增「一併結束 Terminal Server」CheckBox | 2026-04-17 17:12 | [詳細](PLAN-012-quit-dialog-terminal-server-checkbox.md) |

> PLAN-012 完成依據（D044）：T0145 情境 1-5/8/9 全綠；情境 7（installer 強制 kill）依 D033 劃出範圍，另開 PLAN-013 追蹤。

## Dropped

| ~~ID~~ | ~~標題~~ | 原因 | 連結 |
|--------|---------|------|------|
| ~~PLAN-001~~ | ~~Vite v5→v6 升級~~ | 被 PLAN-003 Group B 吸收（D052）— 將直接跨 major 升至 vite 8 | [PLAN-001](PLAN-001-vite-v5-to-v6-upgrade.md) |

> 已歸檔至 _archive/plans/：PLAN-006 / PLAN-008 / PLAN-010 / PLAN-011
