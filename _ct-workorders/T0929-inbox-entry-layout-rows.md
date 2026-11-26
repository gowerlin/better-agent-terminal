---
schema_version: 1
schema_kind: workorder
id: T0929
title: "待辦分頁項目版面：摘要換到下一行全寬、每個選項一行、功能按鈕獨立一行"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-26T20:03:42+08:00"
started_at: "2026-11-26T20:04:27+08:00"
updated_at: "2026-11-26T20:04:27+08:00"
session_ids:
  - "91548731-283a-4d11-9e06-a7eedc148490"
target_version: "0.8.0-pre.5"
depends_on: []
related:
  - "PLAN-069 / T0922（推薦標記、放棄 / 略過）；PLAN-068 W5 / T0908（契約 v2 清單與回答）；使用者 2026-11-26 截圖（第一百三十四 session）"
affects_files:
  - _ct-workorders/T0929-inbox-entry-layout-rows.md
  - src/components/inbox/InboxLists.tsx
  - src/styles/inbox.css
  - src/components/__tests__/
  - docs/agent-guide/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0929` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 範圍只有版面（DOM 結構與 CSS）：不改回答文字格式（`checkInboxAnswer`、`dismissAnswerText`、`actionAnswerText`）、送出路徑、`inbox_features` 判斷、推薦項預設選取、勾選批次邏輯、i18n 字串內容；沒有 `dismiss` 時除了版面以外與現況相同（T0922 規則）。既有 `data-inbox-*` 屬性一律保留（測試與 e2e 依賴）。"
  - "🔴 測試：既有 inbox 測試（`inbox-panel` / `inbox-plan069` / `inbox-w5` / `inbox-tower-cards`）不改斷言、全過；新增測試只守結構（摘要不在標頭列容器內、每個選項是獨立的區塊元素、送出與放棄按鈕在選項容器之外的同一列容器內）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。版面以隔離實例截圖確認（`launchIsolated` 或 vitest 無法截圖時寫〈待實機〉，塔台另排），不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、主機名、IP；測試用的摘要與選項文字自行編造。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0929 — 待辦分頁項目版面：摘要、選項、按鈕各自成行

## 背景

使用者在右側欄「待辦」分頁（契約 v2）看到「⏸ 待你決定」項目的版面不易閱讀（2026-11-26 截圖，窄側欄）：

1. **摘要被擠到標頭列右側**：`U-n`、工單編號、來源（Worker 提問 / 塔台提問）、類型（decision）與摘要放在同一個 `flex-wrap` 列（`.inbox-entry-head`），摘要只剩右側很窄的一欄，長句被切成很多行。
2. **選項短時會併在同一行**：`.inbox-options` 是 `flex-wrap` 列、`.inbox-option` 是 `inline-flex`，選項字少時兩個選項、或最後一個選項與「送出」擠在同一行。
3. **功能按鈕位置不固定**：「送出」在選項容器裡（`InboxLists.tsx` 約第 321 行），「放棄…」在另一處；選項長時兩顆按鈕各占一行上下疊，選項短時「送出」跟在最後一個選項右邊、「放棄…」掉到下一行左邊。

使用者要的版面：

- (1) 摘要獨立一個區塊：換到標頭列的下一行、全寬。
- 每個選項獨立一行（不論字數）。
- (2) 功能按鈕（送出、放棄…）放在獨立的一行，位於選項之後。

## 範圍

- 「⏸ 待你決定」（`awaiting_user` 項目，`InboxLists.tsx` 約第 296–353 行）：上述三項都做。自由回答（`options` 空，`.inbox-free`）照同樣原則：輸入框一行、按鈕一行（或與輸入框同列但不和其他元素混排，Worker 依窄寬度實測選一種，回報理由）。
- 「🙋 待你執行」（`user_actions`，約第 385–434 行）：標頭的摘要（title）一樣換到下一行全寬，維持一致；按鈕列（完成 / 失敗 / 略過）已是獨立的 `.inbox-actions-row`，確認它不與其他元素混排即可。
- 「⏰ 到期提醒」與其他區塊不動，除非共用的 CSS 改動影響到它們（影響時確認畫面不變或一致變好，回報）。
- 放棄的展開表單（`.inbox-dismiss-form`）展開時出現在按鈕列下方，不擠進按鈕列。
- 勾選框（`.inbox-check`）留在標頭列。

## 驗收

- [ ] 窄側欄（約 280–320 px）與寬側欄下：摘要在標頭列下一行全寬；每個選項一行；送出 / 放棄… 同在選項之後的一行（窄到放不下才換行）
- [ ] 推薦標記仍在該選項同一行的尾端；預設選取推薦項不變
- [ ] 沒有 `dismiss` 時只有送出按鈕，位置規則相同
- [ ] 「🙋 待你執行」摘要同樣換行；按鈕列不變
- [ ] 結構測試新增；既有 inbox 測試不改斷言全過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例截圖（窄 / 寬各一張，存 worktree 外的暫存目錄並在回報區寫路徑）或〈待實機〉步驟
- [ ] `docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」或「推薦項與放棄」補一句版面規則（CLAUDE.md 不需改）

---

## 回報區

（Worker 填寫）
