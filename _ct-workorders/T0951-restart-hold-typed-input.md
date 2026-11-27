---
schema_version: 1
schema_kind: workorder
id: T0951
title: "BUG-231：⏻ 重啟 agent 分頁時，啟動命令寫入前使用者打的字移到命令之後（比照 BUG-151 的派工保護）"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:13:26+08:00"
updated_at: "2026-11-27T21:13:26+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 BUG-228 / 229 / 230 同一批"
depends_on: []
related:
  - "BUG-231；D438（使用者：T0947 的兩項建議開單）；T0947 回報區〈後續建議〉2；BUG-229；BUG-151 / T0598（`PtyManager.holdInputForDispatch` / `writeDispatchCommand`）"
affects_files:
  - _ct-workorders/T0951-restart-hold-typed-input.md
  - src/components/WorkspaceView.tsx
  - src/lib/pty-replay.ts
  - src/lib/
  - src/__tests__/
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - electron/preload.ts
  - electron/__tests__/
  - docs/agent-guide/
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0951` 寫檔（base = 派工當下的 `main`，已含 T0946 / T0947）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時在跑：T0949（BUG-230，可能動 `electron/pty-manager.ts`）、T0950（⏻ 離開 alt screen，可能動 `pty-replay.ts` / `WorkspaceView.tsx`）；之後依序合併，盡量不動 T0946 的命令組裝（`towerLaunchCommandPrefix`）與 T0947 的 `resetLeftoverMouseTracking` 呼叫。"
  - "🔴 現象（BUG-231，T0947 查證時發現）：`createPtyThenLaunch`（`src/components/WorkspaceView.tsx`）在 `pty:create` 回來後 `setTimeout(500)` 才寫啟動命令；這段時間使用者打的字先進新 shell 的輸入列，啟動命令接在後面 → 命令被破壞。先查證（有哪些路徑以這種方式寫啟動命令：claude-cli ⏻ / 新開 / 恢復、codex 分頁等），確認後再改；推測不成立 → 問塔台。"
  - "🔴 範圍：renderer 寫啟動命令的路徑，在命令寫入前打進新分頁的使用者輸入移到命令之後，語意比照 helper 派工的 `holdInputForDispatch` / `writeDispatchCommand`（BUG-151）；能共用就共用既有實作（例：讓這條路徑也經主行程同一套保留機制），不另寫一套語意不同的。🔴 使用者輸入不得遺失、順序不變、只延後到命令之後；保留有上限與逾時（沿用 BUG-151 的值或寫明理由），命令寫入失敗 / PTY 結束時照舊送出或丟棄的規則與 BUG-151 一致。"
  - "🔴 不變：沒有啟動命令的一般 shell 分頁、命令寫入之後的輸入、helper 派工路徑、`{ auto: true }` 的寫入、T0788 / T0904 的通知保護、T0946 的 `MSYS2_ARG_CONV_EXCL` 前置變數、T0947 的滑鼠追蹤重設，一律逐字不變（測試斷言）。🔴 不改 PTY env。若要新增 IPC channel：不進 `HELPER_CHANNEL_ROLES`、handler 另拒 `ctx.helper`；proxied 與否依查證寫明。"
  - "🔴 唯一實作：保留與送出的邏輯在一個位置（優先沿用 `PtyManager` 既有的），consumer 只接線。"
  - "🔴 測試：⏻ 後命令寫入前打字 → PTY 收到「命令＋輸入」且命令完整；沒有打字 → 只有命令；一般 shell 分頁輸入不延後；BUG-151 既有測試不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 文件：相關 docs（例 `docs/agent-guide/new-pty-initial-size.md` 或派工輸入保護所在的 docs）補一段；CLAUDE.md 只在需要時於既有小節補一句（唯一實作函式名），小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0951 — ⏻ 期間打的字移到啟動命令之後（BUG-231）

## 背景

T0947（BUG-229）查證時發現：⏻ 後新 shell 起來到啟動命令寫入前約 500 ms，使用者打的字會先進輸入列，啟動命令接在後面而被破壞（BUG-231）。helper 派工已有同類保護（BUG-151），⏻ 路徑沒有。使用者裁示開單（D438）。

## 範圍

- 查證以 renderer 寫啟動命令的路徑。
- 命令寫入前的使用者輸入移到命令之後，語意比照 BUG-151，盡量共用既有實作。

## 不做

- 不改 helper 派工、一般 shell 分頁、PTY env、T0946 / T0947 的改動。

## 驗收

- [ ] 回報區有查證與做法理由
- [ ] 測試：打字不破壞命令、輸入不遺失且在命令之後；一般 shell 不延後；BUG-151 測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0（改 electron 時 `typecheck:electron` = 0）
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
