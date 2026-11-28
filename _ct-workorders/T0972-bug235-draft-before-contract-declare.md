---
schema_version: 1
schema_kind: workorder
id: T0972
title: "BUG-235 重修：啟動參數回合（`/control-tower`）送出前的草稿沒被清掉——`user-prompt-submit` 早於塔台 `--set-role --bat-contract 2`，T0964 的清除條件 `isContractTower` 不成立"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: S
created_at: "2026-11-28T15:42:36+0800"
updated_at: "2026-11-28T15:42:36+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-235；T0964（`onPromptSubmitted`，`electron/notify-hold.ts`）；T0970（交付版驗收 R2 FAIL：B3 時序）；D503"
affects_files:
  - _ct-workorders/T0972-bug235-draft-before-contract-declare.md
  - electron/notify-hold.ts
  - electron/pty-manager.ts
  - electron/terminal-role.ts
  - electron/handlers/
  - electron/__tests__/
  - src/lib/tower-input-draft.ts
  - src/lib/__tests__/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0972` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 已查證的原因（T0970 回報區〈R2 判讀〉，交付版 `v0.8.1-pre.4` 實測）：`NotifyHoldController.onPromptSubmitted`（`electron/notify-hold.ts:553` 附近）第一個條件 `!state?.draft || state.inPaste || !this.isContractTower(id)` 就 return。啟動參數 `/control-tower` 那個回合的 `user-prompt-submit` 一定比塔台同一回合的 `--set-role tower --bat-contract 2` 早（實測 64–65 s；BUG-235 原始日誌 03:59:16.9 vs 03:59:37），當下分頁不是契約 2 塔台 → 草稿不清 → 回合結束後第一筆待辦分頁回答 `held … reason=draft`（pre.4 與 pre.3 相同）。T0970 B3 時序：草稿（F12 `csi~:24`）→ 357 ms → `user-prompt-submit` → `set-role … contract=2` → 回答 `held`。"
  - "🔴 修法（塔台裁示，D503；依序評估，選第一個成立的）：① 若 `draft` 狀態只在契約 2 塔台被讀取（保留、原因顯示、立即送出等所有讀者；請逐一核對並在回報區列出），`onPromptSubmitted` 的清除不再以 `isContractTower` 為前提（其餘條件：有草稿、不在括號貼上、hook 前 300 ms 無輸入、2 s 內無 Enter，全部不變）——非塔台分頁清掉草稿不影響任何行為。② 若 ① 不成立（有非契約 2 的讀者），改為：`user-prompt-submit` 時不論契約記下「送出前的草稿可清」（同一套 300 ms / 2 s 條件），之後該分頁經 `--set-role --bat-contract 2` 成為契約 2 塔台時，若記下之後沒有新的使用者輸入，就清掉草稿。🔴 兩種都不得放寬：送出後才打的字仍保留；括號貼上中不清。修法需要動 `--set-role` 契約或 helper 輸出 → 停下問塔台。"
  - "🔴 回歸測試：以 T0970 B3 時序為案例（草稿 → 357 ms → submit（尚未宣告契約）→ 宣告契約 2 → 待辦分頁回答 → 立即送出，修正前失敗）；另加：宣告前的 submit 之後又打字 → 宣告後回答仍保留；括號貼上中 submit → 不清；T0964 既有案例（已宣告契約 2 的分頁）照舊。既有測試不改斷言（只能新增；若既有斷言記錄的正是「非契約 2 不清」且屬讀者行為以外的純實作細節，先問塔台）。"
  - "🔴 不得改變：`draft` 的判定（`trackDraft`、單鍵例外、提示期間按鍵）、`enqueueAnswer` 的保留規則、T0965 / T0968 / T0971 的選單與 Esc 流程、T0966 計數、Worker 通知保留、`tower-inbox:answer` / `tower-inbox:menu-hint` 契約；日誌只記類別、長度、id，不記內容。"
  - "🔴 不回歸（R-G003）：T0904 / T0940 / T0964 / T0965 / T0966 / T0968 / T0971 相關案例與 T0970 R1 / R3 / R4 / R5（已 PASS）逐一核對，回報區列〈相關通過案例〉。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。可選：用 T0970 的驅動（`e2e/manual/ct-accept-act.mjs input`、`ct610-driver.ts`，見 `e2e/manual/README.md` T0970 段）以本分支打包的隔離實例重跑 R2；做不到就列〈待實機〉。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（「claude 取走輸入框時清掉草稿」一節補宣告前送出的情況）、`notify-hold.md`；CLAUDE.md 只在需要時補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0972 — BUG-235 重修：宣告契約前送出的草稿也要清

## 背景

T0970 以交付版 `v0.8.1-pre.4` 驗收 A-26：R1（閒置時回答）、R3 / R4 / R5 PASS，但 R2 FAIL——「以塔台開啟 Claude」後、啟動參數回合送出前按過鍵，回合結束後第一筆回答仍卡在待送，與 pre.3 相同，正好是 BUG-235 原始情境的時段。原因：T0964 的清除只對已宣告契約 2 的塔台，而啟動參數回合的 `user-prompt-submit` 比塔台宣告早約 1 分鐘。依 `_local-rules.md`〈驗收失敗處理〉「原問題未解」，BUG-235 退回 FIXING、派本單。

## 範圍

- 依 frontmatter 的 ① / ② 修 `onPromptSubmitted`（或宣告時補清）。
- 回歸測試（B3 時序）、文件。

## 不做

- 不改草稿判定與保留規則；不改契約；不發版。

## 驗收

- [ ] 回報區列出 `draft` 的所有讀者與採用 ① 或 ② 的理由
- [ ] B3 時序回歸測試（修正前失敗、修正後通過）；送出後打的字仍保留；括號貼上不清
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟（或隔離實例重跑 R2 的結果）；docs 更新

---

## 回報區

（Worker 填寫）
