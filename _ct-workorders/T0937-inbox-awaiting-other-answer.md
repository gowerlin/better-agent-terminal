---
schema_version: 1
schema_kind: workorder
id: T0937
title: "待辦分頁「⏸ 待你決定」有選項的題目加「其他（自由回答）」；放棄備註改成只寫原因"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-070
priority: P2
sizing: S
created_at: "2026-11-27T11:25:19+08:00"
started_at: "2026-11-27T11:27:08+08:00"
updated_at: "2026-11-27T11:34:34+08:00"
completed_at: "2026-11-27T11:34:34+08:00"
session_ids:
  - "9a20185d-18a0-441c-b1fc-56efca4503ce"
target_version: "0.8.0-pre.8"
depends_on: []
related:
  - "PLAN-070 子項 1；D393；T0908（契約 v2 清單與回答）、T0922（推薦與放棄）、T0936（同版，已在 `main`）；給 CT 的提案 `_reply-2026-11-27-ct-inbox-other-multiselect.md`"
affects_files:
  - _ct-workorders/T0937-inbox-awaiting-other-answer.md
  - src/components/inbox/InboxLists.tsx
  - src/lib/tower-inbox.ts
  - src/lib/__tests__/
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/styles/
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
  - "🔴 分支：只在 `ct/T0937` 寫檔（base = 派工當下的 `main`，已含 T0936）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 「其他」：`awaiting_user` 有 `options`（非 `optionsInvalid`）的題目，單選清單最後多一項「其他（自由回答）」（i18n 新鍵；en `Other (free answer)` / zh-TW `其他（自由回答）` / zh-CN `其他（自由回答）`）。選了它 → 在清單下方出現一行輸入框（沿用 `.inbox-free-input`、`maxLength` 900、Enter 送出、IME 組字中不送），送出 `U-n：<文字>`（trim 後非空才可送）；改選其他選項時輸入框收起、文字保留在元件狀態即可。不支援多選（PLAN-070 子項 4 另開單）。"
  - "🔴 送出路徑不變：一律經既有 `submit` → `onAnswer` → `tower-inbox:answer`（`checkInboxAnswer` 單編號行本來就接受任意文字）；不新增 IPC / channel、不改 `checkInboxAnswer` / `enqueueAnswer`。自由文字以「放棄」或「略過」開頭時，CT 會當成放棄（CT 規格的已知取捨）：輸入框下方顯示一行提示（i18n 新鍵，例「以「放棄」開頭會被當成放棄」），只在文字以這兩個詞開頭時出現，不擋送出。"
  - "🔴 推薦項：預設選取仍是 `recommended`（T0922）；「其他」永遠不是預設、不標推薦。`options: []` 的題目維持原本的自由輸入框（不重複加「其他」）。"
  - "🔴 放棄備註文字：`inbox.dismiss.dismissNote` 從「原因或新方向（一行，選填）」改成「原因（一行，選填）」（en / zh-CN 對應改）；放棄的送出格式、勾選批次、「全部放棄」不動。要給新方向改用「其他」（CT 端語意由 CT 改，見提案第 2 點；BAT 不另判斷）。"
  - "🔴 不變：⏸ 的 `waitingOrders`、推薦標記、放棄 / 批次、🙋 / ⏰ / 💬 / 📋、參考檔案連結（T0930 / T0935 / T0936）；`inbox_features` 沒有 `dismiss` 時「其他」照樣顯示（它不屬於 dismiss 能力，CT 6.1.0 起就接受 `U-n：<自由文字>`）。"
  - "🔴 測試：元件——有選項時清單最後是「其他」、選了才出現輸入框、送出 `U-n：<文字>`（經 mocked `tower-inbox:answer`）、空白不可送、IME 組字中 Enter 不送、以「放棄」開頭顯示提示仍可送、推薦項仍預設選取、`options: []` 不加「其他」、`optionsInvalid` 不加；放棄備註 placeholder 新文字。既有 T0908 / T0922 / T0929 / T0930 / T0934 / T0935 / T0936 測試斷言不改、全過（若必然衝突，問塔台）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「契約 v2 清單與回答」與「推薦項與放棄（PLAN-069）」補「其他」與放棄備註的說明（T0937）；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節補一句（小節標題不改名，T0595）；網站 `site/tower-inbox.md`〈怎麼回答〉補「其他」（`0.8.0-pre.8` 起）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態請寫 `DONE`（`FIXED` 是 BUG 用的，L177）。"
---

# T0937 — 待你決定加「其他」

## 背景

使用者 2026-11-27：「如果選項都不在清單內，用放棄填原因，會被當新選項還是會真的放棄只記原因，如果是，應該統一要有其他選項可填」。

BAT 待辦分頁的「⏸ 待你決定」在 `options` 非空時只有單選＋送出，沒有自由輸入（`InboxLists.tsx` 約第 334–356 行；只有 `options: []` 才有輸入框）。原生選單有內建「其他」、終端可打 `U-n：<文字>`，只有待辦分頁沒有，使用者只能借「放棄…」備註欄填字，而 CT 會把放棄附的文字當新方向。使用者裁示（D393）：統一要有「其他」；放棄附的文字改成只當原因（CT 端另改，PLAN-070）。

## 範圍

- 「⏸ 待你決定」有選項的題目加「其他（自由回答）」，送出 `U-n：<文字>`。
- 放棄備註欄文字改成只寫原因。
- 不做多選（PLAN-070 子項 4，等 CT 核定契約後另開單）。

## 驗收

- [ ] 有選項的題目最後有「其他」；選了出現輸入框，送出 `U-n：<文字>`，塔台收到
- [ ] 推薦項仍預設選取；`options: []` 的題目畫面不變
- [ ] 以「放棄」開頭的文字顯示提示、仍可送
- [ ] 放棄備註 placeholder 改為「原因（一行，選填）」
- [ ] 既有 inbox 測試不改斷言全過；新增元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件三處（docs、CLAUDE.md、網站）

---

## 回報區

### 待塔台決策

#### Q-1：「其他」要放在選項清單（radiogroup）裡面，並改 t0929 的一行斷言嗎？
- **提問時間**：2026-11-27T11:28:45+08:00
- **衝突**：`src/components/__tests__/inbox-layout-t0929.test.tsx` 第 126–127 行斷言 `[data-inbox-option-list="U-3"]` 的**子元素**正好是 A / B / C（每個都是 `<label>`），第 136 行斷言清單的下一個兄弟元素就是送出列。工單要「單選清單最後多一項」，照字面放進清單就會讓第 127 行變成 `['A','B','C',null]`。（`inbox-plan069.test.tsx` 第 140 行用 `[data-inbox-option]` 查，「其他」不帶這個屬性即可不衝突。）
- **選項**：
  - A. 「其他」放進 radiogroup 的最後一項（`<label data-inbox-option-other>`，不帶 `data-inbox-option`），選了才在清單下方、送出列之前出現輸入框；t0929 第 127 行改成只比對帶 `data-inbox-option` 的子元素仍是 A / B / C，並另斷言最後一個子元素是「其他」。其餘斷言（含第 136 行，因為預設不選「其他」時輸入框不出現）不改。
  - B. 不改任何測試：「其他」與輸入框放在送出列**之後**的 DOM 位置，用 CSS `order` 讓畫面上排在送出列之前。缺點：「其他」不在 `role="radiogroup"` 內（螢幕閱讀器看到 3 選項的群組加一個落單的 radio），Tab 順序是 送出 → 放棄… → 輸入框，和畫面順序相反。
  - 其他。
- **建議**：A。結構與無障礙正確，只改一行斷言且保留原意（每個選項是清單內獨立的 `<label>`、A / B / C 順序不變）。
- **影響**：決定 `InboxLists.tsx` 的 DOM 結構與是否動 t0929 測試。
- **是否阻擋後續步驟**：是（元件實作與測試）。
- **通道**：BAT（`q-d23cf7f4-4dddda089924034e`），塔台以 choice 1（A）答覆，見〈互動紀錄〉。

### 完成狀態
- **狀態**：DONE
- **session_id**：9a20185d-18a0-441c-b1fc-56efca4503ce
- **branch**：`ct/T0937`
- **base_sha**：`1f9bdae0c6f2b4f50c0cbecc51159cbd74cc7438`
- **validated_sha**：`73d35e81a1660e64d31b1ca5ab67e1e305ba8faa`
- **head_sha**：`73d35e81a1660e64d31b1ca5ab67e1e305ba8faa`（= validated_sha）
- **產品 commit**：`73d35e81` feat(inbox): add Other (free answer) to awaiting options; dismiss note is a reason only (T0937)

### 落點檢查
- **結果**：PASS
- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`src/components/inbox/InboxLists.tsx` 等皆存在 → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位，略過；目前分支 `ct/T0937`
- `CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0937`；`BAT_WORKSPACE_ID` 有設定（只記錄、不比對）；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要
- 「⏸ 待你決定」有可用選項的題目，radiogroup（`[data-inbox-option-list]`）最後一項是「其他（自由回答）」（`<label data-inbox-option-other="<id>">`，不帶 `data-inbox-option`、永遠不是預設、不標推薦）。選了才在清單下方、按鈕列之前出現一行輸入框（`.inbox-free-input`、`maxLength` 900、`autoFocus`、`[data-inbox-other-input]`），Enter（IME 組字中不送）或「送出」送出 `U-n：<文字>`；trim 後空白不可送。改選其他選項時輸入框收起、文字留在元件狀態；送出成功後整筆回到預設（推薦項）。
- 送出路徑不變：同一個 `submit` → `awaitingAnswerText` → `onAnswer` → `sendInboxAnswer` → `tower-inbox:answer`。沒有新 IPC / channel，`checkInboxAnswer` / `enqueueAnswer` / `src/lib/tower-inbox.ts` 都沒改。
- 放棄提示：第一個詞是「放棄」/「略過」時，輸入框下方顯示 `inbox.answer.otherDismissHint`（`[data-inbox-other-hint]`，警告色、11px），不擋送出。判斷沿用既有的 `isDismissAnswer`（CT 的規則：詞後面接行尾、空白或 `，,。；;`），所以「放棄了一半」不提示；這比字面上的「以這兩個字開頭」更貼近 CT 實際判斷，記在〈偏離與備註〉。
- `options: []` 與 `optionsInvalid` 的題目維持原本的自由回答欄，不加「其他」；有沒有 `inbox_features: dismiss` 都會顯示「其他」。
- 放棄備註 placeholder：en `Reason (one line, optional)`、zh-TW `原因（一行，選填）`、zh-CN `原因（一行，选填）`；單筆與批次放棄共用這個鍵，送出格式不變。
- i18n 新鍵：`inbox.answer.other`（en `Other (free answer)` / zh-TW / zh-CN `其他（自由回答）`）、`inbox.answer.otherDismissHint`（三語系；關鍵字保留「放棄」「略過」原字，因為 CT 比對的是這兩個字）。

### 變更檔案
- `src/components/inbox/InboxLists.tsx`：`AwaitingRow` 加「其他」選項、輸入框、提示；檔頭註解補 T0937
- `src/styles/inbox.css`：`.inbox-other-hint`
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`：兩個新鍵、`dismissNote` 改文字
- `src/components/__tests__/inbox-other-t0937.test.tsx`（新增，9 個測試）
- `src/components/__tests__/inbox-layout-t0929.test.tsx`：第 127 行斷言調整（Q-1 A，見〈偏離與備註〉）
- `docs/agent-guide/tower-inbox.md`：〈畫面〉表格的 ⏸ 列、新小節「「其他（自由回答）」（T0937）」、〈控制項出現條件〉放棄備註改寫
- `CLAUDE.md`「待辦分頁的契約 v2 清單與回答」節加一點（小節標題沒改）
- `site/tower-inbox.md`〈怎麼回答〉加「其他（自由回答）」（`0.8.0-pre.8` 起）；〈推薦選項與放棄〉的放棄說明改成只寫原因，要給新方向就用「其他」

### 驗證
| 項目 | 結果 |
|---|---|
| worktree `npm ci` | PASS（exit 0；結尾 install-scripts 警告是預期，CLAUDE.md「npm 12 install scripts」節） |
| `npm run test:unit`（head `73d35e81`，第一次完整執行） | PASS：Test Files 505 passed / 3 skipped（508），Tests 9123 passed / 47 skipped（9170），62.7 s |
| 新測試 `inbox-other-t0937.test.tsx` | PASS 9 / 9（「其他」是清單最後一項且不是預設、不帶 `data-inbox-option`、沒有推薦標記；選了才有輸入框，位置在清單之後、按鈕列之前；空白不可送；送出 `U-3：a third way please`（tab 改空白）；IME 組字中 Enter 不送、之後 Enter 送 `U-4：自訂答案`；以放棄 / 略過開頭顯示提示且可送、「放棄了一半」不提示；改選選項收起、文字保留；`options: []` / 選項格式不對不加；dismiss 有無都顯示；放棄備註 placeholder 與三語系字串） |
| 既有 inbox 測試（T0908 / T0922 / T0929 / T0930 / T0934 / T0935 / T0936） | PASS；斷言只改 t0929 第 127 行（塔台核可） |
| `npx vite build` | PASS（exit 0） |
| `npm run typecheck` | PASS（0） |
| 隔離實例點擊 | 未做，見〈待實機〉 |

### 待實機
以開發版或 `0.8.0-pre.8` 以上、CT 6.1.0+ 契約 v2 塔台：
1. 讓塔台在 `_tower-state.md` 寫一筆有 `options` 的 `awaiting_user`（有 / 沒有 `recommended` 各一筆）。待辦分頁「⏸ 待你決定」的選項最後一項是「其他（自由回答）」，預設仍選推薦項、「其他」沒有「推薦」標記。
2. 點「其他」→ 清單下方出現輸入框並取得焦點；空白時「送出」停用。用注音輸入中文、組字中按 Enter 不會送出；確定後 Enter → 塔台輸入框收到 `U-n：<文字>` 並送出。
3. 輸入「放棄 這題不需要了」→ 下方出現提示，仍可送出；塔台當成放棄處理。
4. 點回其他選項 → 輸入框收起；再點「其他」→ 原文字還在。
5. 「放棄…」展開的欄位 placeholder 是「原因（一行，選填）」。
6. `options: []` 的題目畫面與之前相同（只有一個自由回答欄）。

### 偏離與備註
- **t0929 第 127 行斷言調整**（塔台 Q-1 答 A）：工單要求「其他」在單選清單內，原斷言測的是清單子元素只有 A / B / C，必然衝突。改成只比對帶 `data-inbox-option` 的子元素仍是 A / B / C，另加一行斷言最後一個子元素是「其他」；t0929 其他斷言（含清單的下一個兄弟元素是按鈕列）與 T0908 / T0922 / T0930 / T0934 / T0935 / T0936 的測試都沒改。
- **放棄提示的判斷**：工單寫「只在文字以這兩個詞開頭時出現」。實作用既有的 `isDismissAnswer`（與 CT 6.2.0 的規則、`checkInboxAnswer` 同一個判斷），詞後面要接行尾、空白或 `，,。；;` 才算；「放棄了一半」這類 CT 不會當成放棄的文字不提示。
- `options: []` 的自由回答欄沒有加放棄提示（工單要求那個畫面不變）；它同樣會被 CT 當成放棄，要不要也提示可以另外決定。
- `src/lib/tower-inbox.ts`、`src/lib/__tests__/` 列在 `affects_files`，但不需要改。

### 遭遇問題
- 新測試的「選項格式不對」範例原本寫 `"no code here"`，會被 `OPTION_PATTERN` 當成代號 `no` 的合法選項；改成 `"沒有代號"`。

### 後續建議
- PLAN-070 子項 4（多選）等 CT 核定契約後另開單（工單已排除）。
- 可考慮在 `options: []` 的自由回答欄也加同樣的放棄提示（見〈偏離與備註〉）。

### 互動紀錄
- [11:27] 開工：Startup 讀完工單、`_local-rules.md`、CLAUDE.md；`CT_MODE=yolo`、`CT_INTERACTIVE=0`、worktree 模式。
- [11:28] Q-1：「其他」要放進 radiogroup 並改 t0929 一行斷言（A），還是不改測試、用 CSS `order`（B）？→ A（塔台，BAT 通道 choice 1，`waitedMs` 12284）：放進 radiogroup 最後一項、只改 t0929 第 127 行，回報區寫明理由 → Action：照 A 實作，第 127 行改寫並加一行「最後是其他」的斷言。
