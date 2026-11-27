---
schema_version: 1
schema_kind: workorder
id: T0936
title: "待辦分頁「🙋 待你執行」的指令欄：檔案路徑可點；整個指令就是一個存在的檔案時按鈕改成「開啟」"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-27T11:11:38+08:00"
started_at: "2026-11-27T11:13:15+08:00"
updated_at: "2026-11-27T11:19:00+08:00"
completed_at: "2026-11-27T11:19:00+08:00"
session_ids:
  - "93924d66-22f9-4eb1-9565-d132fe7b7734"
target_version: "0.8.0-pre.8"
depends_on: []
related:
  - "BUG-226；T0930（參考檔案連結唯一實作）、T0935（只寫檔名）、T0908（契約 v2 清單）；D390；使用者 2026-11-27 截圖（另一個專案的待辦分頁：`🙋 待你執行` 的 `command` 是 `_ct-workorders/_reply-<日期>-<主題>.md`，沒有連結，只有「複製指令」）"
affects_files:
  - _ct-workorders/T0936-inbox-command-file-link.md
  - src/components/inbox/InboxLists.tsx
  - src/components/inbox/InboxRefText.tsx
  - src/components/inbox/useInboxFileRefs.ts
  - src/lib/inbox-file-refs.ts
  - src/lib/__tests__/inbox-file-refs.test.ts
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
  - "🔴 分支：只在 `ct/T0936` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 沿用唯一實作：辨識 `splitFileRefs` / `refLookups`（`src/lib/inbox-file-refs.ts`）、存在檢查 `useInboxFileRefs` / `itemFileRefs`、顯示 `InboxRefText`、開檔 `openFileInFilesTab`。不另寫第二套辨識、不新增 IPC / 事件、不輪詢。`UserActionsList` 的 `useInboxFileRefs` 收集要把 `item.command` 加進 texts（目前只有 `[item.ref]` / `[item.title]`）。"
  - "🔴 行為 A（指令中含路徑 / 檔名 / 編號）：`command` 仍以 `<code className=\"inbox-command-text\">` 顯示，內容改經 `InboxRefText`（存在才連結，文字逐字不變、不以 HTML 解譯）；「複製指令」保留，複製的仍是原始 `command` 全文。"
  - "🔴 行為 B（整個 `command` 就是一個檔案參照）：`command` trim 後（可去掉外層一對反引號或引號）`splitFileRefs` 只得到一個 `ref` part、沒有其他非空白文字，而且該參照存在（已解析到目標）→ 顯示為連結，按鈕改成「開啟」（i18n 新鍵，en `Open` / zh-TW `開啟` / zh-CN `打开`），點了經 `openFileInFilesTab` 在「檔案」頁籤開啟，不顯示「複製指令」；`title` 提示改成新鍵（例「在檔案頁籤開啟」），不再顯示「BAT 不會執行此指令」。存在檢查尚未完成或找不到 → 照行為 A（純文字＋複製）。判斷寫成純函式（建議放 `src/lib/inbox-file-refs.ts`，例 `soleFileRef(text)`），不在元件內聯。"
  - "🔴 不變：BAT 永遠不執行 `command`（不送進終端、不 shell open 非檔案）；開檔只走 `openFileInFilesTab`（工作區外 / URL / `..` 一律不連，沿用 T0930）；「完成」「失敗…」「略過…」與回答格式、勾選批次、`checkInboxAnswer` 不動；其他清單（⏸ / ⏰ / 💬）行為不動；`INBOX_FILE_REF_MAX` 不改（若因 `command` 多佔名額需要調整，問塔台）。"
  - "🔴 測試：純函式——`_ct-workorders/_reply-2026-11-27-topic.md`、`` `README.md` ``、`\"docs/a b.md\"` 這類引號包住的、`T0936` 編號是單一參照；`pwsh -File e2e/manual/x.ps1`、`npm run build`、空字串、兩個路徑不是。元件——command 為存在的檔案：連結＋「開啟」、點擊送出 `workspace-switch-tab` + `file-tree-reveal`（解析後路徑）、沒有「複製指令」；不存在：純文字＋「複製指令」；指令含存在的路徑：路徑是連結、「複製指令」複製原文全文。既有 T0908 / T0922 / T0930 / T0934 / T0935 測試斷言不改、全過（若某斷言必然衝突，問塔台，不自行改）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「參考檔案連結（T0930）」與「契約 v2 清單與回答」中 `command` 的描述補 T0936 規則；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節 `command` 只有「複製」那句改寫（小節標題不改名，T0595）；網站 `site/tower-inbox.md` 對應說明（版號寫 `0.8.0-pre.8` 起）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑；測試檔名自行編造（例 `_reply-2026-11-27-topic.md`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0936 — 待辦分頁指令欄的檔案可點

## 背景

BUG-226：使用者 2026-11-27 在另一個專案的待辦分頁截圖。「🙋 待你執行」兩筆的 `command` 寫的是要使用者審閱的回覆稿 `_ct-workorders/_reply-<日期>-<主題>.md`，畫面以 `<code>` 原文顯示、沒有連結，旁邊只有「複製指令」。使用者：「檔案仍然沒有連結，複製指令對檔案連結無用，也不知貼哪裡，直接貼終端並不能開檔」。

T0930 / T0935 的參考檔案連結只接在 `ref` 標籤與 `summary` / `title`，`command`（`InboxLists.tsx` `UserActionItem` 約第 424–431 行）沒有經 `InboxRefText`。CT 契約的 `command` 原意是「使用者要執行的指令」，但塔台實際會把要看的檔案寫在這裡，BAT 端要能處理。

## 範圍

- `command` 中的參照可點（行為 A），整個 `command` 是一個存在的檔案時改成連結＋「開啟」（行為 B）；規則見 memory_overrides。
- 只動「🙋 待你執行」的 `command` 顯示；其他欄位與清單不動。

## 驗收

- [ ] `command` = 存在的 `_ct-workorders/_reply-….md`：連結＋「開啟」，點了在「檔案」頁籤開啟並定位；沒有「複製指令」
- [ ] `command` = 不存在的檔：純文字＋「複製指令」（與修正前相同）
- [ ] `command` = 真的指令且含存在的路徑：路徑可點、「複製指令」複製原文全文
- [ ] 既有 inbox 測試不改斷言全過；新增純函式與元件測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件三處（docs、CLAUDE.md、網站）

---

## 回報區

### 完成狀態

- **狀態**：FIXED（實作與自動化驗證完成；實際點擊待實機，見〈待實機〉）
- **completed_at**：2026-11-27T11:19:00+08:00
- **session_id**：93924d66-22f9-4eb1-9565-d132fe7b7734

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：`affects_files` 前 5 項（排除 `_ct-workorders/`）在 worktree 都存在 → PASS（C-0 已 PASS，僅記錄）
- C-2：工單無 `branch` 欄位；目前分支 `ct/T0936`
- 證據：`CT_HOME` = 主 checkout（`…/better-agent-terminal/better-agent-terminal`）、`CT_WORKTREE_BRANCH` = `ct/T0936`、`BAT_WORKSPACE_ID` 已設定（只作記錄）、`CT_MODE` = `yolo`

### Worktree SHA

- **branch**：`ct/T0936`
- **base_sha**：`7f02b0b7aeb5deef667101a1f79cd85b695d66a4`
- **validated_sha**：`31dd9768d97b7fc443eb6e8763398071077a155e`
- **head_sha**：`31dd9768d97b7fc443eb6e8763398071077a155e`（= validated_sha）

### 結果摘要

- **行為 A**：`command` 仍以 `<code class="inbox-command-text">` 顯示，內容改經 `InboxRefText`（存在的路徑 / 檔名 / 編號成連結，文字逐字不變）；「複製指令」保留、複製原始全文；`title` 照舊 `inbox.action.commandNote`。
- **行為 B**：新純函式 `soleFileRef(text)`（`src/lib/inbox-file-refs.ts`）：trim 後可去掉外層一對 `` ` `` / `"` / `'`（內容不含同種引號、不跨行），引號內整段可為編號、路徑、檔名或含空白的路徑；否則 `splitFileRefs` 必須只有一個 ref、其餘只有空白。解析到存在的檔 → 指令文字整段為連結（`data-inbox-command-file`）＋「開啟」按鈕（`data-inbox-open`，i18n `inbox.action.open`：en `Open` / zh-TW `開啟` / zh-CN `打开`），兩者經 `openFileInFilesTab` 開解析後的路徑；不顯示「複製指令」；`title` = 新鍵 `inbox.action.openNote`。尚未檢查完或找不到 → 行為 A。
- 存在檢查：`ActionList` 的 `useInboxFileRefs` 收集加上 `commandFileRefs(item.command)`（`useInboxFileRefs.ts` 新增；整個指令的參照在前，再加指令中的參照）。`INBOX_FILE_REF_MAX` 未改。
- `RefLink`（`InboxRefText.tsx`）改為 export，供行為 B 重用；未另寫辨識、未新增 IPC / 事件、不輪詢。
- 為支援 `"docs/a b.md"`，內部 `asPath` 加選用參數 `spaces`（只在 `soleFileRef` 的引號內整段使用）；`splitFileRefs` 行為不變（含空白的路徑在句中照舊不辨識）。

### 修改檔案

- `src/lib/inbox-file-refs.ts`：`soleFileRef`、`asPath(raw, spaces)`、檔頭說明
- `src/components/inbox/useInboxFileRefs.ts`：`commandFileRefs`
- `src/components/inbox/InboxRefText.tsx`：export `RefLink`
- `src/components/inbox/InboxLists.tsx`：`ActionRow` 指令欄 A / B、`ActionList` 收集、檔頭說明
- `src/locales/en.json` / `zh-TW.json` / `zh-CN.json`：`inbox.action.open` / `openNote`
- `src/lib/__tests__/inbox-file-refs.test.ts`：〈soleFileRef (T0936)〉3 項
- `src/components/__tests__/inbox-command-file-t0936.test.tsx`（新增，4 項）
- `docs/agent-guide/tower-inbox.md`：〈契約 v2 清單與回答〉欄位表 `command` 列、〈參考檔案連結（T0930）〉用途句、新小節〈🙋 的指令欄（T0936）〉
- `CLAUDE.md`：「待辦分頁的契約 v2 清單與回答」節 `command` 那句改寫（標題未改）
- `site/tower-inbox.md`：區塊表 🙋 列、〈怎麼回答〉的「指令」（`0.8.0-pre.8` 起）
- `src/styles/`：未改（沿用 `.inbox-file-link` / `.inbox-command-text`）

### 驗證

- `npm ci`（worktree）：exit 0
- `npm run test:unit`（head `31dd9768` 第一次完整執行）：exit 0，Test Files 504 passed | 3 skipped (507)，Tests 9114 passed | 47 skipped (9161)
- `npm run typecheck`：exit 0（= 0 錯誤）
- `npx vite build`：exit 0
- 既有 T0908（`inbox-w5`）/ T0922（`inbox-plan069`）/ T0929 / T0930 / T0934 / T0935 測試未改斷言、全過
- 純函式測試涵蓋：`_ct-workorders/_reply-2026-11-27-topic.md`、`` `README.md` ``、`"docs/a b.md"`、`'docs/notes.md'`、反斜線路徑、`T0936`、`` `BUG-226` `` 為單一參照；`pwsh -File e2e/manual/x.ps1`、`npm run build`、空字串 / 空白 / undefined、兩個路徑、兩個引號字串、兩個編號、句尾帶 `.`、URL、引號內跨行、`"npm run build"`、`` `docs/a.md` --check `` 不是；`"../outside/a b.md"` 解析後不連結
- 元件測試涵蓋：存在的檔 → 連結＋「開啟」、`title` = openNote、沒有「複製指令」、按鈕與連結各送出 `workspace-switch-tab` + `file-tree-reveal`（解析後路徑）、不送回答 / 不複製；不存在 → 純文字＋「複製指令」複製原文；真的指令含存在路徑 → 路徑連結可開、「複製指令」複製全文；含空白的引號路徑與工單編號 → 「開啟」開對應檔

### 待實機

隔離實例點擊未做（不碰安裝版 BAT）。驗收步驟：
1. 以隔離實例（或 `0.8.0-pre.8` 預覽版）開一個契約 v2 工作區，在 `_tower-state.md` 的 `user_actions` 加三筆：`command: "_ct-workorders/_reply-<日期>-sample.md"`（先建立此檔）、`command: "_ct-workorders/_reply-<日期>-none.md"`（不建立）、`command: "pwsh -File e2e/manual/<存在的>.ps1"`。
2. 待辦分頁「🙋 待你執行」：第一筆指令為連結、按鈕是「開啟」、沒有「複製指令」；點連結與「開啟」都切到「檔案」頁籤並在檔案樹選取該檔。
3. 第二筆：純文字＋「複製指令」（與修正前相同）。
4. 第三筆：`.ps1` 路徑可點；「複製指令」貼出的是整行原文；BAT 沒有執行任何指令。

### 相關通過案例判定

工單無〈相關通過案例〉節，不適用。

### 遭遇問題

- 無。工單 `status` 原為 `TODO`（非 `PENDING`），直接改為 `IN_PROGRESS`。

### 互動紀錄

- [11:13] 開工；落點檢查 PASS；`npm ci` 背景執行
- 無塔台提問、無使用者指示變更；三個補充檢查節點都沒有新段落

### 後續建議

- 無必要的後續工單。若之後要讓句中（非整個指令）含空白的路徑也可點，需另訂規則（目前只在整個指令被引號包住時辨識）。

### Commit

- 產品：`31dd9768`（`ct/T0936`）`fix(inbox): file references in the 待你執行 command; a command that is one file opens it (T0936, BUG-226)`
- 工單：主 checkout `git commit --only _ct-workorders/T0936-inbox-command-file-link.md`
- 未 push、未觸發 workflow、未建 tag
