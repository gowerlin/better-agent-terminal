---
schema_version: 1
schema_kind: workorder
id: T0949
title: "BUG-230：BAT 重開、同一個 PTY 接回後，還原塔台分頁的 `--set-role` 宣告（角色、模式、契約 v2）"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-27T21:05:49+08:00"
started_at: "2026-11-27T21:07:06+08:00"
updated_at: "2026-11-27T21:07:06+08:00"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 T0946 / T0947 同一版"
depends_on: []
related:
  - "BUG-230；D434 / D435（U-39：A）；T0562（`terminal:set-role`，`electron/terminal-role.ts`）；T0903（`--bat-contract`，`towerContract`）；T0537（`withSavedWorkerOwnership`：BAT 重開後以已存分頁判斷 Worker 歸屬）；T0578 / T0861（Recovery「保留」與 holder 自動接回 `reconnectKeptTerminalServer`）；PLAN-065"
affects_files:
  - _ct-workorders/T0949-restore-tower-role-on-reattach.md
  - electron/terminal-role.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/terminal-server/
  - electron/worker-ownership.ts
  - electron/__tests__/
  - src/stores/workspace-store.ts
  - src/types/index.ts
  - src/stores/__tests__/
  - src/lib/
  - docs/agent-guide/tower-tab-title.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0949` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時有合併工單 T0948（`ct/T0947` → `main`，含 `CLAUDE.md`）在跑，之後合併時再處理。"
  - "🔴 現象（BUG-230，使用者實機，BAT `0.8.0`、Windows）：塔台分頁開著時關掉 BAT 再開，終端分頁接回（claude 程序存活、對話不中斷），但塔台分頁的 `--set-role` 宣告消失：待辦分頁顯示「沒有已宣告的塔台分頁」、回答送不出去，使用者必須在塔台分頁再執行 `/control-tower`。塔台重送 `--set-role tower --bat-contract 2 --mode on` exit 0 後恢復。塔台推測：`role` / `towerMode` / `towerContract` 只記在主行程 `PtyInstance`、不持久化（CLAUDE.md「塔台分頁標題」節），新主行程接回同一個 PTY 時沒有這些欄位。先查證（接回路徑：Recovery「保留」`releaseCreatesOnReplayList` 與 holder 自動接回 `reconnectKeptTerminalServer`），推測不成立 → 問塔台。"
  - "🔴 範圍：同一個 PTY 程序接回（Terminal Server 存活、PTY 沒換）時，還原該分頁在 BAT 關閉前最後一次的宣告（`role`、`towerMode`、`towerContract`），並照常送 `terminal:role-changed`，讓分頁標題、縮圖 `CT↑` / `BAT↑`、待辦分頁、通知保護與 💬 卡片都恢復，不需要塔台重新宣告。存在哪裡由 Worker 查證後選（例：已存的分頁資料，比照 T0537 `withSavedWorkerOwnership`；或 Terminal Server 端的 PTY metadata），回報區寫理由。"
  - "🔴 不變式：① 宣告只來自 BAT 自己存的資料，不接受請求參數或 PTY 輸出宣告（比照 T0537）；② 只在同一個 PTY 程序接回時還原：⏻ 重啟、新 PTY、Recovery「重新開始」、Terminal Server recovery 重建 shell（T0704）、分頁關閉，一律照舊清除（新的 claude 會自己宣告）；查證「同一個程序」的依據寫進回報區；③ `--set-role` 的參數、stdout（含 `bat-contract:` / `hooks:` 行）、exit code 逐字不變，之後再宣告照舊覆寫；④ 還原的 `towerMode` 會影響 `isYoloTerminal`（用量限制自動繼續等），只因程序本來就是 yolo 而延續，回報區寫明；⑤ hooks 狀態不還原（由 hook 回報重新判定）；⑥ 不寫權杖、不寫日誌內容以外的資料，日誌只記 terminal id 前 8 碼、角色、模式、契約數字；⑦ headless bat-server 沒有 Terminal Server 接回，行為不變。"
  - "🔴 唯一實作：還原的判斷與資料寫在一個共用位置（例 `electron/terminal-role.ts` 新函式），接回路徑只接線；不在 consumer 內聯。"
  - "🔴 測試：接回同一 PTY → 角色 / 模式 / 契約還原且送 `role-changed`；⏻ / 重新開始 / recovery / 新 PTY → 不還原；沒有宣告過的分頁 → 不動；之後再 `--set-role` → 覆寫；既有 `--set-role` 測試（含 T0903 舊呼叫逐字不變）、`workspace-store.towerRole.test.ts` source guard 不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；`npm run typecheck:electron` = 0。實機（安裝版關 BAT 再開、接回後待辦分頁看得到塔台）寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合；🔴 不跑 NSIS / W6 升級驗收。"
  - "🔴 文件：`docs/agent-guide/tower-tab-title.md` 補「接回後還原宣告」一節（含不還原的情況）；CLAUDE.md「塔台分頁標題（T0562，D147）」節把「不持久化」改寫成正確描述並寫唯一實作函式名，小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0949 — 接回同一個 PTY 後還原塔台宣告（BUG-230）

## 背景

`v0.8.0` 實機驗收 A-18：關掉 BAT 再開，終端分頁接回、塔台的 claude 仍在跑，但塔台分頁的 `--set-role` 宣告消失，待辦分頁找不到塔台、回答送不出去，使用者得自己再執行 `/control-tower`（BUG-230）。使用者裁示 U-39：A（併進這一批修，與 BUG-228 / 229 一起發版）。

## 範圍

- 查證宣告在接回時消失的原因與接回路徑。
- 同一個 PTY 程序接回時還原最後一次宣告並送 `role-changed`；其他情況照舊清除。
- 共用實作；`--set-role` 契約逐字不變。

## 不做

- 不改 `--set-role` 契約、不改 CT、不還原 hooks 狀態、不改 headless、不改 Worker 歸屬邏輯（T0537）。

## 驗收

- [ ] 回報區有根因查證、存放位置與「同一個程序」判斷依據的理由
- [ ] 接回後還原（測試）；⏻ / 重新開始 / recovery / 新 PTY 不還原（測試）
- [ ] 既有 `--set-role` / T0903 / source guard 測試不改且通過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0；`npm run typecheck:electron` = 0
- [ ] 〈待實機〉步驟；docs 更新

---

## 回報區

（Worker 填寫）
