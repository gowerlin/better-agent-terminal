---
schema_version: 1
schema_kind: workorder
id: T0942
title: "待辦分頁：送出回答後明確顯示「已送出」（內容與時間）並保留送出時的選擇，可改選後重新送出"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-070
priority: P2
sizing: S
created_at: "2026-11-27T15:07:17+08:00"
started_at: "2026-11-27T15:08:14+08:00"
updated_at: "2026-11-27T15:08:14+08:00"
session_ids: []
target_version: "0.8.0-pre.9"
depends_on: []
related:
  - "D412；使用者 2026-11-27：「回答送出過，UI 看不出來（會被 RESET 為未選取狀態），容易誤判被重複送，但是我又考慮到可能選錯要重選，所以是否只要提醒已送出，且要保留送出選項」；T0908（回答）、T0922（放棄 / 批次）、T0937（其他）、T0938（多選）"
affects_files:
  - _ct-workorders/T0942-inbox-answer-sent-marker.md
  - src/components/inbox/InboxLists.tsx
  - src/components/InboxPanel.tsx
  - src/stores/
  - src/lib/tower-inbox.ts
  - src/lib/__tests__/
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/styles/inbox.css
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
  - site/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0942` 寫檔（base = 派工當下的 `main`，已含 T0940）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 問題（現況，`src/components/inbox/InboxLists.tsx`）：送出成功後 `sendLine` 把選擇重設（`setChoice(null)` / `setChecks(null)` / `setFree('')` / `setOther(false)`，回到推薦預設），只剩一行小的 `StatusLine`；而且狀態存在元件 state，切換分頁或重新掛載就消失。項目要等塔台寫回 `_tower-state.md` 才從清單移除，這段期間看起來像沒送過，使用者容易重複送出。"
  - "🔴 規格（使用者裁示：只提醒、不擋；保留送出的選項）：① 每筆送出成功（`sent` 或 `held` 進「📨 待送」）後，該筆顯示明顯的「✓ 已送出：<送出的整行文字>（HH:MM）」（`held` 時寫「已排入待送」），樣式比現在的狀態行醒目；② 不重設：選項 / 勾選 / 「其他」文字 / 自由回答欄維持送出時的內容；③ 送出鈕仍可按，文字改「重新送出」（i18n 新鍵），使用者改選後再送就是送新的一行（不攔、不跳確認）；④ 「已送出」記錄跨分頁切換與元件重新掛載都保留（放在 renderer store，key = 塔台 / 工作區 + 項目 id；🔴 只在記憶體、不持久化、不寫任何 CT 檔），項目從清單消失（塔台已處理）時一併忘掉；⑤ 適用所有待辦回答：⏸ 單選 / 多選 / 其他 / 自由回答、🙋「完成」「失敗…」、單筆放棄 / 略過；批次放棄 / 略過與「全部」的工具列顯示同樣的已送出提示（每筆也標已送出）。失敗（`failed` / `no-target`）照現行顯示、不標已送出。"
  - "🔴 不變：送出路徑一律經既有 `useAnswerSender` → `sendInboxAnswer` → `tower-inbox:answer`（不新增 IPC、不改 `checkInboxAnswer` / `enqueueAnswer`）；回答格式（`U-n：…`、`A-n：完成`、多選依 options 順序、放棄 / 略過批次）不變；BAT 不寫 CT 檔、不自己把項目移出清單；日誌不記回答內容（現行規則）。推薦預設只在「從未送出」時套用。"
  - "🔴 測試：元件——送出後保留選擇＋「已送出：<文字>（時間）」＋鈕變「重新送出」；改選後重新送出送的是新行；`held` 顯示「已排入待送」；重新掛載（模擬切分頁）仍顯示已送出；項目從清單移除後記錄清掉；失敗不標已送出；多選 / 其他 / 自由回答 / 🙋 完成 / 失敗 / 放棄 / 批次各至少一例。既有 inbox 測試（T0908 / T0922 / T0929 / T0930 / T0934–T0938）若有斷言「送出後重設」必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊寫〈待實機〉（不碰安裝版 BAT、不開 claude 回合）。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」補「已送出」規則（T0942）；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節補一句（小節標題不改名，T0595）；網站 `site/tower-inbox.md`〈怎麼回答〉補一句（`0.8.0-pre.9` 起）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0942 — 送出後顯示「已送出」並保留選擇

## 背景

使用者 2026-11-27：待辦分頁回答送出後，選項被重設成未選取（實際回到推薦預設），只剩一行小字狀態；切換分頁後連那行也消失。項目要等塔台處理完才會從清單移除，中間看起來像沒送過，容易重複送出。但使用者也可能選錯要重選，所以**只提醒、不阻擋**，並保留送出時的選擇（D412）。

## 範圍

- 送出成功後：明顯的「已送出：<內容>（時間）」、不重設選擇、鈕改「重新送出」。
- 記錄跨分頁切換保留（只在記憶體），項目消失即清除。
- 所有待辦回答（⏸ / 🙋 / 放棄 / 略過 / 批次）。

## 驗收

- [ ] 送出後選擇保留、顯示已送出內容與時間、鈕為「重新送出」
- [ ] 改選後可再送；不跳確認
- [ ] 切換分頁後仍顯示；項目被塔台移除後清除
- [ ] 既有 inbox 測試不改斷言全過（衝突問塔台）；新增元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 〈待實機〉步驟；文件三處

---

## 回報區

（Worker 填寫）
