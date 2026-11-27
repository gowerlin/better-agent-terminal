---
schema_version: 1
schema_kind: workorder
id: T0936
title: "待辦分頁「🙋 待你執行」的指令欄：檔案路徑可點；整個指令就是一個存在的檔案時按鈕改成「開啟」"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: S
created_at: "2026-11-27T11:11:38+08:00"
updated_at: "2026-11-27T11:11:38+08:00"
session_ids: []
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

（Worker 填寫）
