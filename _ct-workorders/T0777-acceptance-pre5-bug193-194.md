---
schema_version: 1
schema_kind: workorder
id: T0777
title: "pre.5 自動化驗收（安裝版）：BUG-193 取回焦點的點擊不清淡化 ⚠️、BUG-194 自動開啟的對話框第一次 Esc 就關閉"
type: implementation
status: TODO
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T10:43:30+08:00"
depends_on: []
related:
  - "BUG-193（T0774 `bd59ab0f`，D216）、BUG-194（T0776 `e717c786`，D217）；T0775 `1068c5f8`（`e2e/helpers/real-focus.ts`、關 focus emulation）"
  - "既有 e2e：`e2e/t0770-unfocused-wait-missed.spec.ts`（A–E，E = BUG-193）、`e2e/t0776-auto-dialog-focus.spec.ts`（BUG-194）、`e2e/t0735-workspace-waiting-badge.spec.ts`、`e2e/t0761-detached-workspace-waiting.spec.ts`、`e2e/t0762-*`、`e2e/t0563-*`、`e2e/t0567-*`、`e2e/t0757-mouse-answer-clears-waiting.spec.ts`；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）"
  - "CLAUDE.md「Worker 分頁回收」節（T0774 / BUG-193 段）、「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節（T0776 / BUG-194 段）"
affects_files:
  - "e2e/t0777-*.spec.ts（新增，只在情境 ③ 需要新寫時）"
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/dialog-close-and-escape.md
  - _ct-workorders/T0777-acceptance-pre5-bug193-194.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.5`，塔台已確認；tag `v0.7.3-pre.5` = `478fd178`，`1068c5f8` 之後 `src` / `electron` / `scripts` / `e2e` 沒有變動），以 `BAT_E2E_EXECUTABLE` 啟動隔離實例。某 spec 無法在安裝版跑 → 寫明原因，該情境改用 source build 前先問塔台。🔴 不跑 `npx vite build`（避免覆寫現有 `dist`；真的需要時先問塔台）。🔴 不改 `e2e/fixtures/electron-isolation.ts`、`e2e/helpers/real-focus.ts`。"
  - "🔴 情境 ①（BUG-193）：跑 t0770 全部（A–E），E 是主要驗收項：視窗失焦時等待結束留淡化 → 以點擊另一個分頁的縮圖取回焦點 → 原分頁淡化保留；只恢復焦點、不點擊 → 照 D203 清除。"
  - "🔴 情境 ②（BUG-194）：跑 t0776：自動開啟的 Dialog（T0776 盤點的 4 個）開啟時焦點在 Dialog 內（或遮罩），第一次 Esc 就關閉、Esc 不進背景分頁的 PTY；關閉後焦點回到開啟前的元素。"
  - "🔴 情境 ③（作業系統真實點擊，選做但盡量做）：比照 T0774 的查證方式（user32 `mouse_event` / `SendInput`，點擊前以 HWND 確認是隔離實例的主視窗、不是使用者的 BAT），在安裝版重現 BUG-193 的步驟一次，確認淡化保留。做不到就記原因、該項 PARTIAL，不影響其他情境。需要時新增 `e2e/t0777-*.spec.ts`（或沿用 T0774 留下的腳本，先看它的回報區）。🔴 真實點擊只能落在隔離實例的視窗；HWND 對不上就不點。"
  - "🔴 不回歸：同一個對象再跑 t0735、t0761、t0762、t0563、t0567、t0757 各 1 次。t0757 曾有一次偶發失敗（③ 清除原因 `user-prompt-submit`，疑 `permission-request` hook 晚到；T0775 已加診斷）：若再失敗，同一情境最多重跑 1 次，把 T0775 加的診斷輸出原文（不含權杖與家目錄路徑）貼進回報〈發現的問題〉，標明是否為同一現象；🔴 不修、不改 spec 斷言。"
  - "🔴 隔離與安全：一律用隔離實例（獨立 userData 與 remote port），不碰使用者正在用的 BAT（不讀它的 userData、不送 IPC、不結束它的程序）。工作區 / 目錄名含 `t0777`，跑完刪除。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在〈發現的問題〉附重現步驟與證據，由塔台開 BUG。不得讀出或印出認證檔、權杖內容，不傾印整個 `process.env`。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0（新 spec 在 tsconfig 範圍外就註明並單檔檢查）。docs：`worker-tab-recycle.md` 的 BUG-193 段、`dialog-close-and-escape.md` 的 BUG-194 段各補一行安裝版 `0.7.3-pre.5` 結果。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。Playwright `--output` 指到 session 暫存目錄。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0777 — pre.5 自動化驗收（安裝版）：BUG-193 / BUG-194

## 元資料

- **工單編號**：T0777
- **類型**：implementation（驗收用 e2e，不改產品程式碼）
- **優先級**：P2
- **建立時間**：2026-11-02T10:43:30+08:00
- **預估規模**：S

## 背景

`v0.7.3-pre.5` 已發佈，內含 BUG-193（T0774）與 BUG-194（T0776）的修正，兩者都是 FIXED、待驗收。使用者指示安排自動驗收（2026-11-02 第一百零四 session 重啟（四））。通過即由塔台依 R-G003 結案（修正已進入發佈版，且在安裝版實測過）。

## 範圍

1. 情境 ①–②（必做）、③（選做）。
2. 不回歸 6 支 spec。
3. docs 各一行。

## 不做

- 不改產品程式碼、不 build、不改共用 fixture / helper。
- 不碰使用者正在用的 BAT。
- t0757 偶發失敗只記錄、不修。

## 驗收

- [ ] 情境 ①–③ 逐項結果（PASS / FAIL / PARTIAL＋原因），每項寫明驗收對象
- [ ] 不回歸 6 支結果（含 t0757 是否重現偶發失敗）
- [ ] 兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

（Worker 填寫）
