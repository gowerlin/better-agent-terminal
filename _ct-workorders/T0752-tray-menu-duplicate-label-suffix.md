---
schema_version: 1
schema_kind: workorder
id: T0752
title: "系統匣選單：視窗標籤重複時依序加 ` (2)`、` (3)`（D205，T0750 提案 (b)）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: XS
created_at: "2026-11-01T22:26:23+0800"
updated_at: "2026-11-01T22:26:23+0800"
depends_on: []
related:
  - "D205（使用者選 (b)）；T0750 回報區〈發現的問題〉2（提案 (a) / (b)）；BUG-184（`8a432d40` 已修殘留，本單只處理同名標籤）"
  - "CLAUDE.md「多 remote profile 同時連線（PLAN-039）」；`docs/agent-guide/multi-remote-profiles.md`"
affects_files:
  - "electron/main.ts（`rebuildTrayMenu` 約 816 行：只改標籤組法）"
  - "src/lib/（新增純函式或併入 `src/lib/profile-window-front.ts`；不 import electron / DOM）"
  - "對應的 unit test"
  - docs/agent-guide/multi-remote-profiles.md
  - _ct-workorders/T0752-tray-menu-duplicate-label-suffix.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（D205 (b)）：系統匣選單的每個視窗項目，標籤（`win.getTitle()` 或 `Window <id 前 8 碼>`）在同一次選單內重複時，第一個維持原樣，之後依序加 ` (2)`、` (3)`…；不重複的標籤完全不變。順序以選單本來的列出順序（`windowMap` 迭代順序）為準。標籤組法抽成純函式（不 import electron / DOM），`rebuildTrayMenu` 只接線。"
  - "🔴 行為不變：匣選單的項目數、Show All Windows、每個視窗的子選單（Show / Remove from profile）與其動作、選單重建時機都不改；不改視窗標題本身（`setTitle` / renderer 的標題）；不加「（hidden）」（D205 未採 (a)）。標籤不得含使用者路徑、帳號或 profile id。"
  - "🔴 不回歸（R-G003）：T0750 的修正（`bringWindowToFront`、`closeWindowsOfDeletedProfile`、`profileOpenNotice`）與其 unit / e2e 不受影響；detached 視窗、PLAN-039 不受影響。回報區列〈相關通過案例〉判定。"
  - "🔴 build 順序（D205，與 T0751 並行）：先做程式、unit test、兩個 typecheck；`npx vite build` 與 e2e 要等 T0751 commit（`git log --oneline -5` 看得到 T0751 的 commit）後才跑，避免同時 build。"
  - "🔴 驗證：unit 涵蓋：無重複 → 不變、兩個同名 → 第二個加 ` (2)`、三個同名 → ` (2)` / ` (3)`、多組重複互不影響、`Window <id>` 後備標籤；`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；重跑 `e2e/t0750-profile-window-reopen.spec.ts` 綠。匣選單 e2e 讀不到，以 unit + main.ts 接線 source guard 證明。docs 補一句；CLAUDE.md 不改（非必守規則）。不發版、不 push、不改 CHANGELOG。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 範圍：只做同名標籤；發現其他缺陷記在回報區〈發現的問題〉。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0752 — 系統匣選單同名標籤加序號

## 元資料

- **工單編號**：T0752
- **類型**：implementation（enhancement）
- **優先級**：P3
- **建立時間**：2026-11-01T22:26:23+0800
- **預估規模**：XS

## 背景

T0750 修好 BUG-184 的殘留後，兩個 profile 同名時，系統匣選單的視窗標籤仍一模一樣（`Better Agent Terminal - <名稱>:1`），無法分辨。使用者選 (b)：選單內標籤重複時依序加 ` (2)`、` (3)`（D205），與 T0750 / T0751 一起發版。

## 範圍

1. 標籤組法抽成純函式並接到 `rebuildTrayMenu`。
2. unit test、typecheck、build（等 T0751 commit）、T0750 e2e 重跑。
3. docs 一句。

## 不做

- 不加「（hidden）」、不改視窗標題、不改選單結構與動作。

## 驗收

- [ ] 重複標籤依序加 ` (2)`、` (3)`；不重複的不變
- [ ] 〈相關通過案例〉判定
- [ ] unit / typecheck 0 / 0 / build / t0750 e2e

## 回報區

（Worker 填寫）
