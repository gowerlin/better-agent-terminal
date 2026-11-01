---
schema_version: 1
schema_kind: workorder
id: T0774
title: "BUG-193：視窗失焦時留下的淡化 ⚠️，點另一個分頁取回焦點時不得當成看過 —— 先確認事件順序再修"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:24:41+0800"
depends_on: [T0772, T0773]
related:
  - "BUG-193；T0770 回報〈發現的問題〉觀察 2 與 `e2e/t0770-unfocused-wait-missed.spec.ts`（C / D 情境、CDP 關 focus emulation 的作法）；T0735（D200–D203）；D216"
  - "CLAUDE.md「Worker 分頁回收」節（等待使用者提示 T0735 段）；`docs/agent-guide/worker-tab-recycle.md`；判斷唯一實作 `waitingForUser` / `waitingSummary` / `nextWaitMemory`（`src/lib/terminal-attention.ts`），淡化狀態 `src/stores/terminal-attention-store.ts`，看著哪個分頁的來源 `src/App.tsx`（T0735 D203 ③ 的 `setViewingState` effect）"
affects_files:
  - src/App.tsx
  - src/stores/terminal-attention-store.ts
  - src/lib/terminal-attention.ts
  - "src/**/__tests__/*（相關單元測試）"
  - e2e/t0770-unfocused-wait-missed.spec.ts
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
  - _ct-workorders/T0774-fix-bug193-focus-regain-click-missed-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0772 / T0773 收單後才派（本單要 `npx vite build`，那兩張可能用現有 `dist` 當驗收對象）。"
  - "🔴 先查證：在隔離實例（source build）確認視窗取回焦點時 `focus` / `pointerdown` / `mousedown` / `click` 與分頁切換的先後，以及現行 `setViewingState` 在哪一刻把 active 分頁當成看過；Playwright 點擊用 CDP，與實體滑鼠不一定相同，要在回報說明你依據什麼判斷（例：Chromium / Electron 對失焦視窗第一次點擊的事件順序的文件或原始碼、實測紀錄）。查證結果和 BUG-193 的推論不同就照實寫，修正依查證結果。"
  - "🔴 修正規格（D216）：取回焦點的那次點擊若切到別的分頁，原 active 分頁的淡化 ⚠️ 保留；焦點回來後仍停在原分頁（例：短暫延後到該次點擊處理完再判斷）才算看過。只恢復焦點、不點擊（Alt+Tab 回來、`focus()`）且 active 是那個分頁 → 照 D203 清除。🔴 其他 D200–D203 規則不變：有焦點且看著分頁時等待結束不留淡化、切到該分頁且有焦點時清除、分頁關閉時忘掉、detached 視窗（T0761）與 Claude 面板（T0762）同樣適用。判斷規則改在唯一實作（`nextWaitMemory` / store / `App.tsx` effect），不得在元件內另寫。延後判斷若用計時器，時間常數集中、寫明理由，並確認不會讓「看著分頁時等待結束」多出一閃而過的淡化。"
  - "🔴 驗證：單元測試涵蓋新規則（取回焦點＋同時切到別的分頁 → 保留；取回焦點不切 → 清除），並做突變檢查（拿掉修正會失敗）。e2e：`e2e/t0770-unfocused-wait-missed.spec.ts` 加情境 E（失焦 → X 結束淡化 → 用 Playwright 滑鼠點 Y 的縮圖 → X 淡化保留；再切回 X → 清除），修正前 E 失敗、修正後通過；A–D 照舊通過；`t0735-workspace-waiting-badge`、`t0761-detached-workspace-waiting`、`t0762-claude-panel-waiting` 不回歸。`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功。"
  - "🔴 文件：`worker-tab-recycle.md` 的 D203 規則補一句（取回焦點的點擊）與驗證清單；CLAUDE.md「Worker 分頁回收」節的 T0735 段只在規則原文有變時補一句（≤ 1 行）。"
  - "🔴 不改主行程、hook、helper / MCP 契約、⚠️ 的視覺樣式。隔離實例、不碰使用者正在用的 BAT。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0774 — BUG-193：取回焦點的點擊不得把淡化 ⚠️ 當成看過

## 元資料

- **工單編號**：T0774
- **類型**：implementation（修正）
- **優先級**：P2
- **建立時間**：2026-11-02T05:24:41+0800
- **預估規模**：S

## 背景

T0770 在 `v0.7.3-pre.4` 安裝版發現：視窗沒有焦點時，active 分頁 X 的等待結束留下淡化 ⚠️；這時用滑鼠點另一個分頁 Y，X 的淡化會消失，使用者其實沒看到 X。推論是點擊先觸發視窗 `focus`，`App.tsx` 依 D203 把當下 active 的 X 當成看過，之後才切到 Y。使用者裁示開 BUG 修正（D216）。

## 範圍

1. 查證事件順序。
2. 依查證結果修正（規格見 frontmatter）。
3. 單元測試＋突變、t0770 情境 E、不回歸 e2e。
4. docs / CLAUDE.md。

## 不做

- 不改主行程、hook、helper / MCP 契約、視覺樣式；不改其他 D200–D203 規則。

## 驗收

- [ ] 查證結果（事件順序與依據）
- [ ] 修正與單元測試、突變檢查
- [ ] t0770 E 修正前失敗、修正後通過；A–D、t0735、t0761、t0762 綠
- [ ] typecheck 0 / 0、`test:unit` 全綠、`vite build`

---

## 回報區
