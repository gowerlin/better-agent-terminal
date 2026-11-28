---
schema_version: 1
schema_kind: workorder
id: T0980
title: "待辦分頁參考檔案連結：`useInboxFileRefs` 在 `_ct-workorders/` 收到 `fs:changed` 時重查存在與否（檔案事後出現、被歸檔或刪除時連結跟著更新；仍不輪詢）"
type: feature
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
updated_at: "2026-11-28T18:01:29+08:00"
session_ids: []
target_version: "下一個預覽版（`0.8.1-pre.6`，發版前與使用者確認）"
depends_on: []
related:
  - "T0930（`useInboxFileRefs`，回報區〈後續建議〉）；T0934（💬 卡片連結）；T0935（只寫檔名）；T0916 / BUG-220（`acquireDirWatch`、`recreate`）；D516（U-72：D）"
affects_files:
  - _ct-workorders/T0980-inbox-file-refs-recheck-on-change.md
  - src/components/inbox/useInboxFileRefs.ts
  - src/components/inbox/
  - src/components/__tests__/
  - src/stores/ct-dir-watch.ts
  - docs/agent-guide/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0980` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 現況（T0930 回報區）：`src/components/inbox/useInboxFileRefs.ts` 以既有唯讀 `fs:stat` / `fs:readdir` 檢查清單顯示的參照，去重後上限 `INBOX_FILE_REF_MAX` = 40、每次檢查每資料夾列一次；只在參照集合或根目錄改變時重查，不輪詢、不記日誌。所以參照的檔案在畫面出現之後才建立、被搬到 `_archive/`、或被刪除時，連結不會更新（直到參照集合變了）。"
  - "🔴 修法：讓 `useInboxFileRefs`（以及 T0934 的 💬 卡片、T0935 只寫檔名的同一套）在 `_ct-workorders/` 的 `fs:changed` 時重查。🔴 監看一律經 `acquireDirWatch`（`src/stores/ct-dir-watch.ts`，主行程 watcher 沒有計數，不得直接 `fs.watch` / `fs.unwatch` 這個目錄；CLAUDE.md「右側欄「待辦」分頁」節）；優先沿用 `InboxDataSource` 已有的訂閱（每視窗一個），不要多開 watcher。連續事件要合併（debounce，例 ≤ 500 ms，值放常數）；重查仍受上限 40、每資料夾列一次的規則；🔴 不輪詢、不新增 IPC / 事件 channel、不記日誌。根目錄之外（參照在 `_ct-workorders/` 以外的路徑）的檔案：照舊只在參照集合改變時查（不為它另外監看），回報區寫明此限制。"
  - "🔴 不得改變：連結判定（`src/lib/inbox-file-refs.ts` 的拆字、編號 / 路徑 / 只寫檔名規則、在工作區根目錄之下才連結）、文字內容（只用文字節點與 `<button>`）、點擊經 `openFileInFilesTab`、💬 卡片收合摘要維持純文字（T0934）；`acquireDirWatch` 的計數與 `recreate` 行為（T0916），以及它其他呼叫者（ControlTowerPanel、InboxDataSource）的行為。"
  - "🔴 測試：新增 ① 參照的檔案原本不存在 → 收到 `_ct-workorders/` 的 `fs:changed` 後出現 → 變成連結；② 存在的檔被移走 → 事件後不再是連結；③ 連續多個事件只重查一次（debounce）；④ 沒有事件時不重查（不輪詢）；⑤ 卸載後不再重查、watch 釋放（計數正確）。T0930 / T0934 / T0935 既有斷言不改。"
  - "🔴 不回歸（R-G003）：T0906 / T0908 / T0922 / T0930 / T0934 / T0935 / T0936 / T0937 / T0938 / T0942 / T0916 相關案例逐一核對，回報區列〈相關通過案例〉。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「參考檔案連結（T0930）」一節補重查時機與限制；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節的 T0930 句只在需要時改（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0980 — 參考檔案連結跟 `fs:changed` 重查

## 背景

T0930 讓待辦分頁裡提到的工單 / BUG / PLAN / 路徑可以點，但存在與否只在參照集合改變時檢查：檔案事後才建立、被歸檔或刪除時，連結不會跟著變。使用者 2026-11-28 裁示處理（U-72：D，D516）。

## 範圍

- `useInboxFileRefs` 在 `_ct-workorders/` 的 `fs:changed` 時重查（合併連續事件、沿用既有監看）。
- 測試、文件。

## 不做

- 不改連結判定與畫面；不輪詢；不新增 IPC；不監看 `_ct-workorders/` 以外的目錄；不發版。

## 驗收

- [ ] 檔案出現 / 移走後連結跟著變；連續事件只重查一次；無事件不重查；卸載釋放
- [ ] 既有斷言未改；〈相關通過案例〉判定
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] docs 更新

---

## 回報區

（Worker 填寫）
