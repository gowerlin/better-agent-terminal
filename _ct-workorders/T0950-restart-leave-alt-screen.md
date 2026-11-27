---
schema_version: 1
schema_kind: workorder
id: T0950
title: "⏻ 重啟時一併離開舊程式留下的替代畫面（alt screen），新 shell 畫在一般畫面、保有 scrollback"
type: feature
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:13:26+08:00"
updated_at: "2026-11-27T21:13:26+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 BUG-228 / 229 / 230 同一批"
depends_on: []
related:
  - "D438（使用者：T0947 的兩項建議開單）；T0947 回報區〈後續建議〉1；BUG-229；T0672 / BUG-166（「離開替代畫面」選單、不自動離開 alt screen 的規則）"
affects_files:
  - _ct-workorders/T0950-restart-leave-alt-screen.md
  - src/lib/mouse-tracking-reset.ts
  - src/lib/__tests__/
  - src/lib/pty-replay.ts
  - src/components/TerminalPanel.tsx
  - src/components/WorkspaceView.tsx
  - src/__tests__/
  - docs/agent-guide/terminal-context-menu.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0950` 寫檔（base = 派工當下的 `main`，已含 T0946 / T0947）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時在跑：T0949（BUG-230，electron 端）、T0951（BUG-231，⏻ 啟動命令的輸入保護，可能也動 `pty-replay.ts` / `WorkspaceView.tsx`）；之後依序合併。"
  - "🔴 背景：T0947 查證時發現，⏻ 時 claude 留下的 alt screen（DECSET 1049）不會離開，新 shell 畫在 alt buffer 上、沒有 scrollback。T0672 的規則是「不自動離開 alt screen」，理由是程式可能還在跑；⏻ 時舊程式必然已結束，理由不成立。"
  - "🔴 範圍：沿用 T0947 的時機與呼叫點（`resetLeftoverMouseTracking` 的 `before-new-pty` / `new-pty-spawned`，或同一處的共用函式），新 PTY 在同一個 xterm 開始前，xterm 仍在 alt buffer 就在本機 xterm 離開（同既有「離開替代畫面」選單的做法）。🔴 只寫本機 xterm、不寫 PTY；只在 ⏻ / 被中斷分頁恢復這類「舊程式已結束、同一個 xterm 開新 PTY」的路徑；`created: false`（PTY 還在跑）、程式執行中、T0672 的回顯偵測、右鍵選單一律不變。查證「離開 alt screen」是否也要一併重設其他舊程式留下的模式（例：bracketed paste、游標隱藏），只做與本單直接相關且查證有問題的，其他寫進回報區建議。"
  - "🔴 CLAUDE.md：「終端分頁右鍵選單與滑鼠追蹤」節 T0672 那句「不自動離開 alt screen」補上例外（⏻ / 恢復時舊程式已結束），小節標題不改名（T0595）；docs `terminal-context-menu.md` 的 T0947 節同步。"
  - "🔴 唯一實作：寫在 `src/lib/mouse-tracking-reset.ts`（或同檔附近的共用函式），consumer 只接線。"
  - "🔴 測試：真 xterm 實例：進 alt screen → ⏻ → 新 PTY → `buffer.active.type === 'normal'`；沒有進 alt screen 的分頁 ⏻ 不寫 xterm；程式執行中不動；`created: false` 不動；T0947 / T0672 既有測試不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0950 — ⏻ 重啟時離開殘留的 alt screen

## 背景

T0947（BUG-229）查證時發現：⏻ 重啟 claude 分頁時，claude 留下的替代畫面（alt screen）不會離開，新 shell 畫在 alt buffer 上、沒有 scrollback。T0672 不自動離開 alt screen 的理由（程式可能還在跑）在 ⏻ 時不成立。使用者裁示開單（D438）。

## 範圍

- ⏻ / 被中斷分頁恢復時，新 PTY 開始前在本機 xterm 離開殘留的 alt screen。
- 共用實作、只寫本機 xterm；其他路徑與程式執行中的行為不變。

## 不做

- 不寫 PTY、不改右鍵選單與 T0672 回顯偵測、不改程式執行中的 alt screen 行為。

## 驗收

- [ ] 真 xterm 測試：alt screen → ⏻ → 新 PTY 在一般畫面；其他情況不動
- [ ] T0947 / T0672 既有測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟；CLAUDE.md 例外與 docs 更新

---

## 回報區

（Worker 填寫）
