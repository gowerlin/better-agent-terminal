---
schema_version: 1
schema_kind: workorder
id: T0917
title: "修 BUG-221：claude 全螢幕（alt screen）塔台往上捲之後維持閱讀保護，不在停手 10 秒後就放行 Worker 通知"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T12:19:45+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-221；D337；PLAN-068 W2（T0904 通知保護）；T0902 待實機 T-3；T0915 回報區〈建議開 BUG〉第 2 點；CT checklist M-C2-b（預期：通知最多等 60 秒、畫面不被拉回底部）"
affects_files:
  - _ct-workorders/T0917-fix-bug221-fullscreen-tower-reading-hold.md
  - src/lib/tower-reading-state.ts
  - src/lib/__tests__/tower-reading-state.test.ts
  - src/components/TerminalPanel.tsx
  - src/__tests__/
  - e2e/t0904-tower-notify-protection.spec.ts
  - e2e/fixtures/
  - docs/agent-guide/tower-inbox.md
  - site/tower-inbox.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0917（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0917`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支：只在 `ct/T0917` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 塔台決定的方向（D337）：只改契約 2 塔台分頁、**alt buffer** 時的閱讀信號：往上捲（滾輪向上 / PageUp / Shift+PageUp）之後維持「閱讀中」，直到下列任一發生才開始既有的 10 s linger 或直接結束：使用者在該分頁有鍵盤輸入（送進 PTY 的使用者輸入）、在終端內點擊、滾輪向下累計抵銷向上累計（能判斷「捲回底部」就用；不能精確判斷就以累計量近似，並在回報說明）、分頁不再是 active / 失去焦點（擇一，說明理由）、alt buffer 切回 normal。上限仍由主行程既有的 `reading` 60 s 決定（從擋住佇列起算），🔴 不改 60 s、不改主行程 notify-hold 規則與常數。🔴 normal buffer 的判斷（`viewportY < baseY`、選取、滾輪＋10 s linger）完全不變。"
  - "🔴 唯一實作仍是 `src/lib/tower-reading-state.ts` `TowerReadingTracker`（純邏輯）；`TerminalPanel.tsx` 只接線。不改 xterm 寫進 PTY 的滑鼠回報、不攔截滾輪（T0698 codex 滾輪回報、T0672 不受影響）。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0915 M-C2-a、M-C3、M-C4、M-C5 的 PASS 項、`e2e/t0904-tower-notify-protection.spec.ts` ①–⑤（⑤「停手 10 s 放行」若用 normal buffer 的假 TUI 應不變；若它跑在 alt screen 而預期改變，說明並更新斷言，不得刪測試）。"
  - "🔴 驗證：單元測試涵蓋 alt buffer 往上捲後超過 10 s 仍閱讀中、各結束條件、normal buffer 不變；`npx vite build` exit 0；兩個 typecheck = 0；`npm run test:unit` 第一次完整執行即綠（附數字）；e2e `e2e/t0904-tower-notify-protection.spec.ts` 跑 1 次，並新增一段 alt screen 情境（假 TUI 進 alt screen＋滾輪向上＋停 15 s → 通知仍保留；按鍵後才送出）。隔離實例、需先 `npx vite build`、不開會耗 token 的 claude 回合；程序清理照 D308。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「閱讀信號」節與 `site/tower-inbox.md`（若有提到 10 秒）同步更新；CLAUDE.md 相關節若寫了 10 s 規則也一起改。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0917): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）。yolo：不得問使用者，判讀問題問塔台。"
---

# T0917 — 修 BUG-221：全螢幕塔台的閱讀保護

見 [BUG-221](BUG-221-fullscreen-tower-reading-linger-10s.md)。

## 驗收

- [ ] alt buffer 往上捲並停住超過 10 s，Worker 通知仍保留（上限 60 s）；使用者按鍵 / 點擊 / 捲回後照規則放行
- [ ] normal buffer 行為不變
- [ ] 單元、e2e（含新 alt screen 情境）、vite build、兩個 typecheck、`test:unit` 第一次即綠
- [ ] 〈相關通過案例〉逐案判定
- [ ] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）
