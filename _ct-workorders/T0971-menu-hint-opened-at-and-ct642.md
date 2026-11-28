---
schema_version: 1
schema_kind: workorder
id: T0971
title: "BUG-237：選單提示行改成與代按 Esc 的判斷一致（含 `opened_at`）；CT 6.4.0-pre.2 配合：`menu_open` 鍵位置不影響解析（B-1）、分次寫入時 ids 不在 awaiting_user 的安全退路寫進文件（B-2）"
type: bugfix
status: PENDING
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-28T15:22:07+0800"
updated_at: "2026-11-28T15:22:07+0800"
target_version: "下一個預覽版（`0.8.1-pre.5`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-237（T0969 H-7）；T0968（`menu_open` 讀取、`menuEscDecision`、Q-2 提示行只看 `question`）；CT T0584 判定（CT D932）與 CT T0585（6.4.0-pre.2：R1 `menu_open` 移到 `awaiting_user` 正後方）；D496 / D497 / D499"
affects_files:
  - _ct-workorders/T0971-menu-hint-opened-at-and-ct642.md
  - src/lib/tower-inbox.ts
  - src/lib/inbox-model.ts
  - src/lib/inbox-answer.ts
  - src/lib/__tests__/
  - src/components/inbox/
  - src/components/InboxPanel.tsx
  - src/components/__tests__/
  - src/types/
  - src/locales/
  - electron/notify-hold.ts
  - electron/terminal-blocked-state.ts
  - electron/pty-manager.ts
  - electron/handlers/
  - electron/preload.ts
  - electron/__tests__/
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
  - "🔴 分支：只在 `ct/T0971` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 BUG-237（現象見 `_ct-workorders/BUG-237-inbox-menu-hint-ignores-opened-at.md`）：待辦分頁「塔台正以選單詢問此題：在這裡回答會先關掉選單」只看「塔台分頁 `question`＋該題在 `menu_open.ids`」，主行程的 `menuEscDecision` 另比對 `opened_at` 與選單紀錄開始時間；殘留的 `menu_open` 遇到別的選單時提示顯示、實際判 `stale` 不關。要做：提示行只在主行程判斷「這題會代按 Esc」時顯示（同一套條件，唯一實作仍是 `menuEscDecision`，不要在 renderer 另寫一份時間比對）。做法由你選，例：proxied 的唯讀查詢 channel（帶 `terminalId` 與 renderer 已有的 `menu` 資訊，主行程回每個 id 的判斷；🔴 不進 `HELPER_CHANNEL_ROLES`、handler 拒 `ctx.helper`）或其他相加方式。🔴 若需要改 attention 的推送時機或欄位（T0968 Q-2 的 B 案）→ 停下問塔台。舊 host 沒有新 channel → 照 T0968 現行顯示（只看 `question`）。順便評估 T0968 Q-2 的已知限制（只剩選單紀錄時不顯示）能否用同一個查詢一起解決；能就做、寫進回報，不能就維持。"
  - "🔴 B-1（CT 塔台要求，確認＋測試）：CT 6.4.0-pre.2 會把 `menu_open` 從 `updated_at` 後面移到 `awaiting_user` 正後方（`user_actions`、`reminders` 之前）。確認 `parseMenuOpen` / `parseTowerStateInbox`（`src/lib/tower-inbox.ts`、`src/lib/ct-tower-overview.ts`）不受頂層鍵位置影響；新增 fixture：`menu_open` 在 `awaiting_user` 與 `user_actions` 之間 → 解析成功（放在 `src/types/__tests__/fixtures/ct-tower-state-v640/` 旁或新目錄，README 註明是 BAT 自製、對應 CT 6.4.0-pre.2 R1；CT 的正式範例檔之後由塔台另行補入，本單不等）。若現在就解析失敗 → 修，並在回報區寫明。"
  - "🔴 B-2（CT 塔台要求，文件）：`docs/agent-guide/tower-inbox.md` 的選單交接一節補一句：CT 分幾次寫檔時，可能短暫出現 `menu_open.ids` 不在 `awaiting_user` 的狀態，BAT 當作沒有 `menu_open`（`menuOpenInvalid`）、不代按 Esc，這是預期的安全退路；🔴 保留這個行為，不得改成「部分 ids 有效就採用」（加一個測試鎖住：部分 ids 不在 `awaiting_user` → 整個 `menu_open` 無效）。同節補 CT 判定的相容說明：新 BAT 搭 CT 6.3.x 時，被關掉的題可能被塔台重開，每題會多一次代按 Esc（預期行為）。"
  - "🔴 不得改變：`menuEscDecision` 的條件與常數、T0965 Esc 流程、T0964 草稿清除、T0966 計數、Worker 通知保留規則、`tower-inbox:answer` 契約與回傳形狀；非契約 2 / 舊 CT 行為不變。"
  - "🔴 不回歸（R-G003）：T0964 / T0965 / T0966 / T0968 / T0969（H-2 / H-3 / H-5 / H-6 / H-7 / H-8b / H-9 / H-14b 的提示行行為）相關案例逐一核對，回報區列〈相關通過案例〉；既有測試不改斷言（只能新增；若既有斷言記錄的正是 BUG-237 的舊行為，先問塔台）。新增測試：殘留 `menu_open`＋別的選單（`stale`）→ 不顯示提示；同一選單且時間對得上 → 顯示；舊 host 沒有新 channel → T0968 行為。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（提示行規則更新、B-2）、需要時 `notify-hold.md`；CLAUDE.md 只在需要時補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0971 — 選單提示行與代按 Esc 一致（BUG-237）＋ CT 6.4.0-pre.2 配合（B-1 / B-2）

## 背景

T0969 H-7 發現提示行與實際行為不一致（BUG-237，U-66：A 進 pre.5）。CT 判定單 T0584（CT D932）：CT 端 PASS 29 / FAIL 1（CT 條文缺漏，BAT 不用改）；分次寫入造成的中間狀態由 BAT 當作沒有 `menu_open`，是安全退路。CT 開 T0585（6.4.0-pre.2）把 `menu_open` 移到 `awaiting_user` 正後方，請 BAT 做 B-1（鍵位置不影響解析＋fixture）、B-2（文件＋鎖住整個無效的行為）。D497 決定 BUG-237 與 CT 配合項合成一張工單。

## 範圍

- 提示行改由主行程判斷（與 `menuEscDecision` 同一套）。
- B-1 解析與 fixture；B-2 文件與鎖定測試。

## 不做

- 不改 Esc / 保留 / 送出規則；不改 CT；不發版。

## 驗收

- [ ] 殘留 `menu_open`＋別的選單 → 不顯示提示；同一選單 → 顯示（測試）；舊 host → T0968 行為
- [ ] B-1：`menu_open` 在 `awaiting_user` 與 `user_actions` 之間 → 解析成功（fixture＋測試）
- [ ] B-2：文件＋「部分 ids 無效 → 整個無效」測試；CT 6.3.x 相容說明
- [ ] 〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 〈待實機〉步驟

---

## 回報區

（Worker 填寫）
