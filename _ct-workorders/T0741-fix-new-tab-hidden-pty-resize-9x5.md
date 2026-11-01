---
schema_version: 1
schema_kind: workorder
id: T0741
title: "修 BUG-180：剛開的分頁在 initial doResize 前被切走時，不得把 0x0 容器 fit 的尺寸（9x5）送給 PTY"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T17:46:06+0800"
started_at: ""
updated_at: "2026-11-01T17:46:06+0800"
completed_at: ""
depends_on: []
related:
  - "BUG-180（T0736 回報區〈發現的問題〉1：重現、debug log 順序）"
  - "CLAUDE.md「新 PTY 的初始尺寸（T0572 / BUG-145）」節：`requestPtySizeSync`、`lastSentCols` / `lastSentRows` 去重、背景分頁不 fit；`src/lib/pty-replay.ts`"
  - "`src/components/TerminalPanel.tsx` 約 1029–1035 行（掛載時 active → 100 ms 後 initial `doResize()`，到期沒再檢查 `isActiveRef.current`；同檔 ResizeObserver debounce 有檢查）"
  - "`src/__tests__/terminal-pty-size-sync.test.tsx`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（第 433 行附近記錄『before selecting it』尺寸）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/（只在把判斷抽成純函式時；例如 resize 前的守門）"
  - "src/**/__tests__/（新增 / 擴充測試）"
  - "e2e/（新增情境或擴充既有 spec；不改既有斷言的意圖）"
  - docs/agent-guide/
  - CLAUDE.md
  - _ct-workorders/BUG-180-new-tab-switched-away-pty-resized-9x5.md
  - _ct-workorders/T0741-fix-new-tab-hidden-pty-resize-9x5.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再修：以單元測試或 debug log 確認 9x5 確實來自 initial `doResize()`（或找出真正來源）。修正規則：① initial `doResize()` 到期時分頁已不 active → 不 fit、不送 `pty.resize`；② 任何 resize 路徑在容器寬或高為 0（或 fit 結果小於合理下限）時不送 `pty.resize`，也不更新 `lastSentCols` / `lastSentRows`（否則日後同尺寸會被去重擋掉）。把判斷寫成一處（純函式或 `doResize` 內的單一守門），不要在各呼叫點複製。"
  - "🔴 行為不變（R-G003 第 3 點）：T0572 / BUG-145 的 `requestPtySizeSync`（`created: true` 與 ⏻ restart 後重送尺寸、hidden 分頁等下次 activation 送出）、active 分頁正常 resize、切回分頁時恢復正確尺寸、ResizeObserver debounce 都不變。動工前列出相關已通過案例（`src/__tests__/terminal-pty-size-sync.test.tsx`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`、`e2e/t0698` 若有、`terminal-wheel-reports` 相關），改動後逐案確認，回報區列〈相關通過案例判定〉。T0736 spec 只記錄『before selecting it』尺寸、不以 9x5 為斷言前提的話照常應綠；若它有依賴 9x5 的步驟（例如先逐一選取分頁讓尺寸恢復），保留不改，只在回報區說明修正後該步驟是否仍需要。"
  - "🔴 build 錯開（重要）：T0737 Worker 正在同一個 checkout 以 `dist/` / `dist-electron/` 跑隔離實例 e2e。🔴 在 `_ct-workorders/T0737-*.md` frontmatter `status` 變成 DONE / PARTIAL / BLOCKED / FAILED 之前，不得執行 `npx vite build`、`npm run build*`、任何 e2e，也不得刪改 `dist*`。這段期間先做查證、修正、單元測試（`npm run test:unit` 可跑）、兩個 typecheck。之後才 build 與跑 e2e；等待時用 Monitor / 間隔檢查該檔，不要忙等。"
  - "🔴 驗證：新測試涵蓋『掛載 active → 100 ms 內變 hidden → 不送 resize』、『容器 0x0 → 不送 resize、不更新去重』、『切回 → 送正確尺寸』；e2e：在 T0736 的重現方式上（連點「+」開兩個分頁）斷言前一個分頁在被選取前的 PTY 尺寸不是 9x5（維持 spawn 120x30 或先前的正常尺寸），選取後是 fit 尺寸；`e2e/t0572-new-pty-initial-size.spec.ts` 綠。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。完成後 BUG-180 改 FIXED（附 commit）。CLAUDE.md「新 PTY 的初始尺寸」節只補一句規則與唯一實作位置，細節寫 docs（遵守檔頭撰寫規則）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0741 — 修 BUG-180：剛開分頁被切走時 PTY 變 9x5

## 元資料

- **工單編號**：T0741
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T17:46:06+0800
- **預估規模**：S

## 背景

T0736（pre.8 自動驗收）發現：從「+」連續開分頁時，前一個分頁的 PTY 被 resize 成 9x5，直到切回才恢復（BUG-180）。推測 `TerminalPanel.tsx` 掛載時排的 100 ms initial `doResize()` 到期沒再檢查 active，對已隱藏的 0x0 容器 fit。使用者指示現在開單修。

## 範圍

1. 查證來源並修正（單一守門）。
2. 單元測試與 e2e。
3. BUG-180 → FIXED；CLAUDE.md 一句、docs。

## 不做

- 不改背景分頁不 fit 的既有設計、不改 T0572 的尺寸同步。
- 不處理 Terminal Server recovery 以 120x30 重建的既有已知限制。

## 驗收

- [ ] 9x5 來源查證結果
- [ ] 新測試與 e2e 綠；〈相關通過案例判定〉
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] build / e2e 在 T0737 結案後才執行（回報區記錄時間）

---

## 回報區

### 完成狀態

### 相關通過案例判定

### 遭遇問題

### 互動紀錄

### 回報時間
