---
schema_version: 1
schema_kind: workorder
id: T0942
title: "待辦分頁：送出回答後明確顯示「已送出」（內容與時間）並保留送出時的選擇，可改選後重新送出"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-070
priority: P2
sizing: S
created_at: "2026-11-27T15:07:17+08:00"
started_at: "2026-11-27T15:08:14+08:00"
updated_at: "2026-11-27T15:19:09+08:00"
completed_at: "2026-11-27T15:19:09+08:00"
session_ids:
  - "a5336673-74c7-46c0-87b3-e1320bcf1402"
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

- [x] 送出後選擇保留、顯示已送出內容與時間、鈕為「重新送出」
- [x] 改選後可再送；不跳確認
- [x] 切換分頁後仍顯示；項目被塔台移除後清除
- [x] 既有 inbox 測試不改斷言全過（衝突問塔台）；新增元件測試
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [x] 〈待實機〉步驟；文件三處

---

## 回報區

### 待塔台決策

#### Q-1：既有 inbox 測試有 5 處與 T0942 規格衝突（斷言送出後重設、或送出後仍以「Send」文字找按鈕），要怎麼處理？
- 提問時間：2026-11-27T15:15:01+0800
- 衝突清單（產品已實作並 commit `dd4969ee`，新測試 17 項全過；只有下列既有斷言失敗）：
  1. `src/components/__tests__/inbox-plan069.test.tsx:148-152`：第一次送出後以 `en.inbox.answer.send`（"Send"）文字找按鈕再送；T0942 送出後按鈕改「重新送出」（"Send again"），找不到按鈕。
  2. `src/components/__tests__/inbox-multi-t0938.test.tsx:174-177`：註解「sent → reset to the default」斷言送出後全部未勾選，再以 "Send" 文字找按鈕。
  3. `src/components/__tests__/inbox-multi-t0938.test.tsx:218-219`：「sent → the default checks are back」斷言送出「其他」後推薦預設 A、C 恢復勾選。
  4. `src/components/__tests__/inbox-other-t0937.test.tsx:173-175`：「sent → back to the default selection, the box closed」斷言送出「其他」後輸入框關閉、推薦 A 被選。
  5. `src/components/__tests__/inbox-other-t0937.test.tsx:227`：「a sent answer resets the row」斷言送出 B 後再選「其他」，輸入框是空的（T0942 保留原文字）。
- 選項：[A] 照 T0942 規格改這 5 處斷言（改成斷言保留選擇／「其他」文字、按鈕改用 `en.inbox.answer.resend` 或 `.inbox-entry-buttons .inbox-btn.primary` 定位；測試意圖（送出的行格式、互斥、預設）其餘不動，每處加 T0942 註解）/ [B] 不改測試，改產品行為讓這些斷言成立（等於撤回規格 ②③）/ [C] 其他：________
- Worker 建議：[A]，因為這 5 處斷言的就是 T0942 要改掉的舊行為（D412 使用者裁示保留選擇、按鈕改「重新送出」），只改「送出後」那幾行，送出內容的斷言（`U-3：A、C` 順序、`U-n：<文字>`、互斥）全部保留。
- 影響範圍：上列 3 個測試檔，只改送出後的斷言與按鈕定位；不動產品程式。
- 阻塞：是（收單前要等答覆；其餘步驟（文件、驗證）先做）
- **通道**：BAT（`q-80274f08-fb36c20173eae1fe`，`answered` choice 1 = A，見〈互動紀錄〉）

### 完成狀態

- **狀態**：DONE
- **session_id**：a5336673-74c7-46c0-87b3-e1320bcf1402
- **branch**：`ct/T0942`
- **base_sha**：`9c14fb7a126f91865cfbab98dc4c2a84421f3325`
- **validated_sha**：`49096cd7ff0301132b72fe538b0cc6e417a59bdb`
- **head_sha**：`49096cd7ff0301132b72fe538b0cc6e417a59bdb`（= validated_sha）
- 產品 commit：`dd4969ee` feat(inbox): mark sent answers and keep the sent selection (T0942)；`49096cd7` test/docs(inbox): keep-after-send assertions and sent marker docs (T0942)
- worktree `git status --porcelain`：空

### 落點檢查

- 結論：**PASS**
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：C-0 已 PASS，僅記錄；`src/components/inbox/InboxLists.tsx` 等存在 → PASS
- C-2：工單無 `branch` 欄位；HEAD = `ct/T0942`
- `CT_HOME` = `<repo 主 checkout>`（better-agent-terminal）、`CT_WORKTREE_BRANCH` = `ct/T0942`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = yolo

### 實作摘要

1. **紀錄 store**（新）`src/stores/inbox-sent-store.ts`：`recordInboxSent` / `useInboxSentMap` / `getInboxSentMap` / `pruneInboxSent` / `batchSentKey` / `resetInboxSentStore`。key = 工作區資料夾（`_tower-state.md` 所在）＋項目 id（`U-n` / `A-n`；批次另存 `__batch__:awaiting|action`）。紀錄 = `{ text, at, status: sent|held, ids, selection? }`，⏸ 的紀錄含送出時的選擇（`choice` / `checks` / `other` / `otherText` / `free`）。只在記憶體、不持久化、不寫 CT 檔、不記日誌。
2. **清除**：`setInboxFiles`（`src/stores/inbox-store.ts`）讀到清單時呼叫 `pruneInboxSent`，所有 id 都不在清單的紀錄刪掉（批次紀錄要它的 id 全部離開才刪）；`lists` 為 null（讀不到）不動。`resetInboxStore` 一併清空（測試隔離）。
3. **畫面**（`src/components/inbox/InboxLists.tsx`）：
   - `useAnswerSender(targets, scope)`：成功（`sent` / `held`）才記錄；批次行另記每一筆。送出路徑仍是 `sendInboxAnswer` → `tower-inbox:answer`，未改 `checkInboxAnswer` / `enqueueAnswer`、回答格式、IPC。
   - `AnswerStatus`：有紀錄時顯示「✓ 已送出：<整行>（HH:MM）」/「✓ 已排入待送：…」（`.inbox-sent-marker`、`[data-inbox-sent]`、`[data-inbox-sent-status]`，並帶 `data-inbox-answer-status` 取代原本的小狀態行）；送出中 / 失敗時原狀態行在上、先前標記在下（不帶 `data-inbox-answer-status`）。失敗不記錄、不標。
   - `AwaitingRow`：送出後不重設；送出前把畫面上的推薦預設固定成實際選擇；重新掛載時從紀錄的選擇開始；推薦預設只在從未送出時套用；送出鈕「重新送出」（`inbox.answer.resend`）。
   - `ActionRow`：完成 / 失敗 / 略過都標記；「失敗…」表單送出鈕在已送出後為「重新送出」。
   - `DismissToolbar`：`onSend(text, ids)`，工具列顯示批次的已送出標記；批次那一行的每一筆也標記。
4. `formatSentClock`（`src/lib/tower-inbox.ts`）：本機 `HH:MM`。
5. 三語系 `inbox.answer.resend` / `sentMarker` / `heldMarker`；`src/styles/inbox.css` `.inbox-sent-marker` / `.inbox-sent-held`。
6. 文件：`docs/agent-guide/tower-inbox.md` 新增〈已送出（T0942）〉並更新 T0937 / T0938 兩處「送出後回到預設」敘述；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節補一點（標題未改）；`site/tower-inbox.md`〈怎麼回答〉補「送出之後」一點（`0.8.0-pre.9` 起）。

### 驗證

| 關卡 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0（結尾 install-scripts 警告屬預期） |
| `npm run test:unit`（head `49096cd7`，第一次完整執行） | exit 0：Test Files 511 passed / 3 skipped（514）；Tests 9243 passed / 47 skipped（9290） |
| `npx vite build` | exit 0 |
| `npm run typecheck` | exit 0，0 個錯誤 |

新測試：`src/components/__tests__/inbox-sent-t0942.test.tsx` 13 項（單選保留＋已送出內容與時間＋「重新送出」；改選重送新行；`held`；重新掛載；項目移除後清掉、再出現回到未送出；失敗不標＋送過後失敗保留舊標記；`no-target`；多選 / 其他 / 自由回答保留並跨重新掛載；🙋 完成 / 失敗；單筆放棄 / 略過；批次工具列＋每筆＋跨重新掛載＋隨項目清掉；三語系；日誌不含回答文字），`src/stores/__tests__/inbox-sent-store.test.ts` 4 項。

### 偏離與備註

依塔台 Q-1 答覆 A 改的 5 處既有斷言（只改送出後的斷言與按鈕定位，送出內容斷言不動；每處加 T0942 註解）：

1. `src/components/__tests__/inbox-plan069.test.tsx:150`（第二次送出）：改前 `fireEvent.click(sendButton(row))`（以 "Send" 找鈕）→ 改後 `fireEvent.click(resendButton(row))`（新增 helper，以 `en.inbox.answer.resend` 找鈕）；`U-3：C` 斷言不變。
2. `src/components/__tests__/inbox-multi-t0938.test.tsx:176-179`：改前「sent → reset to the default」斷言 `[false, false, false]`、再勾 A、`sendButton` 送 → 改後斷言保留 `[true, false, true]`、取消勾 C、`resendButton` 送；`U-4：A、C` 與 `U-4：A` 兩個送出斷言不變。
3. `src/components/__tests__/inbox-multi-t0938.test.tsx:220-223`：改前「sent → the default checks are back」斷言 A、C 勾選 → 改後斷言「其他」仍勾選、文字 `both, but later` 保留、A、C 未勾。
4. `src/components/__tests__/inbox-other-t0937.test.tsx:173-176`：改前「sent → back to the default selection, the box closed」斷言輸入框關閉、A 被選 → 改後斷言「其他」仍選、輸入框值保留、A 未選。
5. `src/components/__tests__/inbox-other-t0937.test.tsx:227`：改前 `toBe('')`（a sent answer resets the row）→ 改後 `toBe('kept text')`（T0942: a sent answer no longer resets the row）；其後「文字保留到再選其他」的斷言不變。

其他判斷（工單內可自行決定，記錄理由）：

- 紀錄 key 用「工作區資料夾＋項目 id」：項目來自該資料夾的 `_tower-state.md`，塔台選擇器切換塔台時清單相同，記錄應保留。
- 單筆「放棄…」/「略過…」與「失敗…」的備註表單送出後照舊收起（T0922 / T0908 既有行為與測試；它們是備註不是選擇，規格 ② 列的是選項 / 勾選 / 其他文字 / 自由回答欄），標記寫送出的那一行。
- 批次的勾選框照 T0922 送出後清掉（plan069 既有斷言），已送出改由工具列與每筆標記表達。
- 🙋「完成」鈕文字不變（它是動作不是「送出」），已送出後由標記提示；「失敗…」表單的送出鈕改「重新送出」。
- 被批次放棄標記的 ⏸ 列不保存選擇（送出的不是該列的選擇）；重新掛載時不套推薦預設（已送出過）。

### 待實機

（不碰安裝版 BAT、不開 claude 回合；以下給使用者 / 塔台實機時點）

1. 契約 2 塔台＋CT 6.3.x 的待辦分頁，挑一題有推薦的單選直接按「送出」：下方出現綠色「✓ 已送出：U-n：A（HH:MM）」，A 仍選取，按鈕變「重新送出」。
2. 改選 B 按「重新送出」：不跳確認，塔台收到 `U-n：B`，標記改成 B 那一行與新時間。
3. 切到「指揮塔」分頁再切回「待辦」、或切工作區再切回：標記與選擇都還在。
4. 塔台在對話框中（排進「📨 待送」）時送出：顯示「✓ 已排入待送：…」（藍色）。
5. 多選、「其他」文字、自由回答欄、🙋 完成 / 失敗…、單筆放棄 / 略過、批次「全部放棄」各試一次：每筆（批次另加工具列）都有標記，選擇 / 文字保留。
6. 塔台處理完、項目從清單消失後再出現同編號：沒有舊標記。
7. 沒有塔台時送出：顯示「沒有可送的塔台」，沒有已送出標記。

### 遭遇問題

- 無（既有測試衝突已經 Q-1 由塔台裁示）。

### 互動紀錄

- [15:08] 開工；落點 PASS；`npm ci` 背景執行。
- [15:13] 實作完成後跑 inbox 測試，既有 5 處斷言與規格衝突（送出後重設 / 以 "Send" 找鈕）→ 依工單「衝突問塔台」先 commit 產品（`dd4969ee`），寫 Q-1。
- [15:15] Q-1: 既有 5 處「送出後重設」斷言怎麼處理 → A（塔台，經 BAT `--ask`，`q-80274f08-fb36c20173eae1fe`）: 照 T0942 規格改送出後斷言與按鈕定位，送出內容斷言不動，每處加 T0942 註解，回報區逐條列改前 / 改後 → Action: 照改 5 處，列於〈偏離與備註〉。
