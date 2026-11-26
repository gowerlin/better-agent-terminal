---
schema_version: 1
schema_kind: workorder
id: T0929
title: "待辦分頁項目版面：摘要換到下一行全寬、每個選項一行、功能按鈕獨立一行"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-26T20:03:42+08:00"
started_at: "2026-11-26T20:04:27+08:00"
updated_at: "2026-11-26T20:10:18+08:00"
completed_at: "2026-11-26T20:10:18+08:00"
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

### 完成狀態

- **狀態**：DONE
- **開始**：2026-11-26T20:04:27+08:00；**完成**：2026-11-26T20:10:18+08:00
- **session_id**：91548731-283a-4d11-9e06-a7eedc148490
- **branch**：`ct/T0929`
- **base_sha**：`17c25dd55a6340c057700a27e6a32cc57edae386`
- **validated_sha**：`365556221d79170afe39e5242a304cb17f424162`
- **head_sha**：`365556221d79170afe39e5242a304cb17f424162`

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS；C-3：`InboxLists.tsx`、`inbox.css`、`__tests__/`、`tower-inbox.md` 皆存在 → PASS；C-2：工單無 `branch` 欄位（worktree 分支 `ct/T0929`）
- 證據：`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0929`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

只改版面（DOM 結構＋CSS），每筆項目由上而下：標頭列（勾選框、id、工單、標籤）→ 摘要自成一行全寬 → 每個選項一行 → 按鈕列（送出、放棄…）自成一行 → 放棄說明欄在按鈕列下方展開。

- **⏸ 待你決定（選項）**：摘要移出 `.inbox-entry-head`，改為 `<div class="inbox-entry-summary" data-inbox-summary>`；選項放進 `.inbox-option-list`（`role="radiogroup"`，縱向 flex），每個 `label.inbox-option` 改為 `display: flex`（一個選項一行），選項文字包 `.inbox-option-label`（長字換行），「推薦」標記仍在該選項尾端（`flex-shrink: 0`）；送出＋放棄… 同在 `.inbox-actions-row.inbox-entry-buttons`（`data-inbox-entry-buttons`），位於選項清單之後，窄到放不下才換行。
- **⏸ 自由回答**：選擇「輸入框一行、按鈕一行」：輸入框全寬一行，下一行是與有選項時相同的按鈕列（送出、放棄…）。理由：有 `dismiss` 時放棄… 要與送出同列，若把送出放在輸入框同列，放棄… 就得另起一行或擠進輸入框列，與選項題的按鈕位置不一致；300 px 截圖中輸入框全寬也比較好打字。Enter 送出不變。
- **🙋 待你執行**：title 同樣換到標頭列下一行全寬；按鈕列（完成 / 失敗… / 略過…）原本就是獨立 `.inbox-actions-row`，加上 `inbox-entry-buttons` 標記；略過說明欄改到按鈕列下方（原本在按鈕列內）。
- **放棄 / 略過表單**：`DismissControl` 元件改為 `useDismissControl` hook，回傳 `{ button, form }`，按鈕放按鈕列、表單放按鈕列之後；送出文字（`dismissAnswerText`）、`data-inbox-dismiss*` 屬性、行為不變。
- **相容**：外層仍是 `.inbox-options` / `.inbox-free`（改為縱向的 `.inbox-answer-block`），e2e `t0913` 的 `.inbox-options .inbox-btn.primary`、`.inbox-free .inbox-btn.primary`、`.inbox-free-input` 仍選得到送出；所有既有 `data-inbox-*` 保留。`checkInboxAnswer` / `dismissAnswerText` / `actionAnswerText`、送出路徑、`inbox_features` 判斷、推薦預設選取、勾選批次、i18n 字串都沒改。
- **⏰ 到期提醒等其他區塊**：未改；共用 CSS 只動 `.inbox-entry-summary`（只用在 ⏸ / 🙋）與 `.inbox-option`（只用在 ⏸），新增的選擇器都限定在新 class，截圖中到期提醒 / Worker 等你標題外觀不變。

### 修改檔案

- `src/components/inbox/InboxLists.tsx`：`AwaitingRow` / `ActionRow` 結構、`useDismissControl`、檔頭註解
- `src/styles/inbox.css`：`.inbox-entry-summary`、`.inbox-answer-block`、`.inbox-option-list`、`.inbox-option`（flex 一行）、`.inbox-option-label`、推薦標記 `flex-shrink: 0`
- `src/components/__tests__/inbox-layout-t0929.test.tsx`（新增，5 個結構測試）
- `docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」〈畫面〉補一條版面規則（CLAUDE.md 未改）

### 驗證

| 項目 | 結果 |
|---|---|
| 依賴 | worktree `npm ci` exit 0 |
| 結構測試＋既有 inbox 測試 | `npx vitest run src/components/__tests__/inbox-` → 5 檔 / 79 通過（既有 4 檔未改斷言） |
| `npm run test:unit` | 第一次完整執行即全綠：Test Files 499 passed / 3 skipped (502)；Tests 9051 passed / 47 skipped (9098)；exit 0。註：此次執行開始時尚未 commit（HEAD 仍是 base），執行期間把同一份工作樹 commit 成 `36555622`，前後檔案內容沒有任何變動，所以結果即 head 的結果 |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 錯誤（exit 0） |
| 隔離實例截圖 | 以 `launchIsolated` 起隔離實例（runtime `e2e-t0929-*`，結束後 userData 已刪、Terminal Server 已結束），工作區只有 `_ct-workorders/_tower-state.md`（`bat_contract: 2`、`inbox_features: ["recommended", "dismiss"]`、自編的 U-3 / U-4 / U-5 / A-2），沒有開任何 claude 回合、沒碰安裝版 BAT。面板寬度以注入樣式固定成 300 px / 560 px（固定定位在視窗左上，避免被視窗右緣裁切）並展開 U-4 的放棄表單。截圖：`<使用者資料夾>\AppData\Local\Temp\claude\…\scratchpad\shots\t0929-inbox-narrow-300.png`（塔台去識別化，D176）、`…\shots\t0929-inbox-wide-560.png`（同目錄 `.json` 為各元素位置量測）。兩張皆確認：摘要在標頭列下一行全寬、每個選項一行、推薦標記在 A 選項尾端且預設選取、送出 / 放棄… 同一行在選項之後、放棄說明欄在按鈕列下方、自由回答輸入框全寬、🙋 title 換行且按鈕列不變。截圖用的臨時 spec（`e2e/zz-t0929-shot.spec.ts`）跑完已刪除、未提交 |

### 驗收對照

- [x] 窄（300 px）/ 寬（560 px）：摘要下一行全寬、每選項一行、送出 / 放棄… 同一行在選項之後
- [x] 推薦標記在該選項尾端；預設選取推薦項不變
- [x] 沒有 `dismiss` 時只有送出，位置規則相同（結構測試 `dismiss: false` 案例）
- [x] 🙋 摘要換行；按鈕列不變
- [x] 結構測試新增；既有 inbox 測試不改斷言全過
- [x] `npm run test:unit` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [x] 隔離實例截圖窄 / 寬各一張（路徑如上）
- [x] `docs/agent-guide/tower-inbox.md` 補版面規則

### Commit

- worktree `ct/T0929`：`36555622` feat(inbox): T0929 entry layout — summary, options and buttons on their own lines
- 主 checkout：`9b514a44`（開工）＋本次收單 commit
- 未 push、未觸發 workflow、未建 tag；收單前 `git -C "$CT_WORKTREE" status --porcelain` 為空

### 遭遇問題

- 第一次截圖時面板被強制加寬後超出視窗右緣被裁切，改成固定定位到視窗左上重拍；不影響產品程式。
- 小觀察（未改）：選項的 radio 以 baseline 對齊，視覺上比文字略高一點；長選項換行時 baseline 對齊讓 radio 對第一行，屬預期取捨。時間列 `.inbox-entry-time` 沿用 `.inbox-muted` 的 12 px 左內距（既有樣式，本單未動）。

### 互動紀錄

- 無（yolo，未向塔台提問）

### 後續建議

- 無必要後續；若塔台要實機確認，可在安裝新版後開契約 v2 塔台的待辦分頁看一筆有選項的「⏸ 待你決定」。
