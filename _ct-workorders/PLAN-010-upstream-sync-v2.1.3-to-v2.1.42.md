# PLAN-010-upstream-sync-v2.1.3-to-v2.1.42

## 元資料
- **編號**：PLAN-010
- **標題**：上游同步 v2.1.3 → v2.1.42（分階段 cherry-pick）
- **狀態**：DONE
- **優先級**：🔴 High
- **建立時間**：2026-04-16 14:10 (UTC+8)
- **完成時間**：2026-04-16 17:30 (UTC+8)

## 描述

上游 tony1223/better-agent-terminal 自我們最後同步（v2.1.3, 2026-04-09）以來累積 188 個 commits，推進到 v2.1.42-pre.2。涵蓋 SDK 升級、核心功能新增、Bug 修復、架構重構等。

採用分階段移植策略，每階段獨立工單，低風險先行。

### 四階段計畫

| 階段 | 內容 | 預估工時 | 風險 | 狀態 |
|------|------|---------|------|------|
| **Phase 1** | Quick Wins（brand rename + bug fixes + UX，~18 commits） | 1-2h | Low | ✅ T0123 — 大多數已存在，4 個成功 cherry-pick |
| **Phase 2** | Core Upgrades（Cache History UI + /abort） | 0.5h | Medium | ✅ T0125 — 唯一缺少的功能已移植 |
| **Phase 3** | New Features（V2 session / worktree / GitHub Panel / Snippet） | — | — | ⏭️ SKIP — T0124 盤點確認全部已有 |
| **Phase 4** | Multi-window 架構 | — | Critical | ⏭️ SKIP — 與 Terminal Server 架構衝突，不移植 |

### 關鍵風險
- 3 個 Critical 衝突檔案：main.ts / claude-agent-manager.ts / ClaudeAgentPanel.tsx
- 我們的 Terminal Server 架構與上游 Multi-window 架構在 main.ts 嚴重衝突
- Status Line 整合需特別注意（上游新增 cacheEff / usage% / TTL countdown）

## 相關工單
- T0122（研究）：DONE — 188 commits 分析，產出結構化報告
- T0123（Phase 1）：DONE — 21 commits 中 4 個 cherry-pick，17 個 skip（已存在）
- T0124（盤點）：DONE — Phase 2-3 功能差異確認，僅 Cache History UI 缺少
- T0125（Phase 2）：DONE — Cache History UI + /abort command 移植完成

## 結案決策紀錄

### 不移植項目 + 理由

| # | 功能群 | 決策 | 理由 |
|---|--------|------|------|
| 26 | Plan file bar（sticky bar） | SKIP | 我們已有 statusline `planLabel` + ExitPlanMode modal，功能等價，僅 UI 位置不同（上游：輸入框上方常駐；我們：status line） |
| 27 | Multi-window 單進程架構 | SKIP | 與我們的 Terminal Server 架構（PTY 持久化 + ring buffer replay）在 main.ts 嚴重衝突（雙方各 1300-2300 行 diff）。兩者解決不同問題：上游=多視窗管理，我們=PTY 存活。共存理論可行但移植成本極高 |
| 28 | Bundle size 優化 | SKIP | devDependencies 搬移 + selective unpacking，影響 package.json 和 build config，與我們的語音依賴（whisper）衝突風險高，收益低 |
| 29 | Codex SDK integration | SKIP | debug-only 功能，非必要 |

### 架構差異摘要（fork vs upstream）

| 面向 | 上游 | 我們的 fork | 備註 |
|------|------|------------|------|
| 視窗管理 | Multi-window + window registry | 單視窗 + Terminal Server | 不同設計目標 |
| PTY 生命週期 | 跟隨 Electron 主進程 | 獨立 Terminal Server + heartbeat | 我們獨有 |
| Plan 顯示 | Sticky bar（輸入框上方） | Status line `planLabel` | 功能等價 |
| 語音輸入 | ❌ 無 | Whisper CPU + Metal GPU | 我們獨有 |
| Control Tower | ❌ 無 | CT 面板 + Sprint Dashboard | 我們獨有 |
| Status Line | 基本項目 | 13 項可配置 + 三區對齊 | 我們更完整 |

## 備註
- 研究報告：`_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`
- 上游 remote 已修正：`upstream` → `https://github.com/tony1223/better-agent-terminal.git`
- version.json 已更新同步版本至 v2.1.42-pre.2
