# PLAN-010-upstream-sync-v2.1.3-to-v2.1.42

## 元資料
- **編號**：PLAN-010
- **標題**：上游同步 v2.1.3 → v2.1.42（分階段 cherry-pick）
- **狀態**：PLANNED
- **優先級**：🔴 High
- **建立時間**：2026-04-16 14:10 (UTC+8)
- **完成時間**：（完成時填入）

## 描述

上游 tony1223/better-agent-terminal 自我們最後同步（v2.1.3, 2026-04-09）以來累積 188 個 commits，推進到 v2.1.42-pre.2。涵蓋 SDK 升級、核心功能新增、Bug 修復、架構重構等。

採用分階段移植策略，每階段獨立工單，低風險先行。

### 四階段計畫

| 階段 | 內容 | 預估工時 | 風險 | 狀態 |
|------|------|---------|------|------|
| **Phase 1** | Quick Wins（brand rename + bug fixes + UX，~18 commits） | 1-2h | Low | 📋 TODO |
| **Phase 2** | Core Upgrades（CLI 升級 + cache history + image + account） | 3-5h | Medium | 📋 TODO |
| **Phase 3** | New Features（V2 session / worktree / GitHub Panel / Snippet） | 5-8h/功能 | High | 📋 TODO |
| **Phase 4** | Multi-window 架構（Defer） | TBD | Critical | ⏸ DEFER |

### 關鍵風險
- 3 個 Critical 衝突檔案：main.ts / claude-agent-manager.ts / ClaudeAgentPanel.tsx
- 我們的 Terminal Server 架構與上游 Multi-window 架構在 main.ts 嚴重衝突
- Status Line 整合需特別注意（上游新增 cacheEff / usage% / TTL countdown）

## 相關工單
- T0122（研究）：完成，產出分析報告
- T0123：Phase 1 Quick Wins（待建立）

## 備註
- 研究報告：`_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`
- 上游 remote 已修正：`upstream` → `https://github.com/tony1223/better-agent-terminal.git`
