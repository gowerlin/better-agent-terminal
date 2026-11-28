---
schema_version: 1
schema_kind: workorder
id: T0980
title: "待辦分頁參考檔案連結：`useInboxFileRefs` 在 `_ct-workorders/` 收到 `fs:changed` 時重查存在與否（檔案事後出現、被歸檔或刪除時連結跟著更新；仍不輪詢）"
type: feature
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-28T18:01:29+08:00"
started_at: "2026-11-28T18:22:10+08:00"
updated_at: "2026-11-28T18:26:27+08:00"
completed_at: "2026-11-28T18:26:27+08:00"
session_ids:
  - "e4b30f9f-a5c9-4d7f-97c1-c1e77bd2c105"
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

- [x] 檔案出現 / 移走後連結跟著變；連續事件只重查一次；無事件不重查；卸載釋放
- [x] 既有斷言未改；〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-28T18:26+08:00
- **session_id**：e4b30f9f-a5c9-4d7f-97c1-c1e77bd2c105

### 落點檢查

- 結果：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 之下 → PASS
- C-3：`src/components/inbox/useInboxFileRefs.ts`、`src/stores/ct-dir-watch.ts`、`docs/agent-guide/tower-inbox.md` 皆存在 → PASS
- C-2：工單沒有 `branch` 欄位 → 不適用
- `CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`；`CT_WORKTREE_BRANCH` = `ct/T0980`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = `yolo`

### 結果摘要

`useInboxFileRefs` 多一個 effect：有參照要檢查時，以 `acquireDirWatch` 對 `<folder>/_ct-workorders` 加入視窗共用的監看（路徑字串與 `InboxDataSource` 相同，計數共用、主行程仍只有一個 watcher），訂閱既有 `fs:changed`；只認該目錄的事件，連續事件合併成最後一個事件之後 `INBOX_FILE_REF_RECHECK_DEBOUNCE_MS` = 300 ms 的一次重查（遞增 `recheck` 狀態，觸發既有的檢查 effect）。重查沿用上限 40、每資料夾列一次；重查期間保留上一次結果（不閃爍）。卸載時清掉待做的重查、退訂、釋放計數；沒有參照時不加入監看。不輪詢、不新增 IPC / 事件 channel、不記日誌。三個清單（⏸ / 🙋 / ⏰）與 💬 卡片都經同一個 hook，所以一起生效；T0935 只寫檔名的參照同樣受益（只要檔在 `_ct-workorders/` 下變動）。

### 修改檔案

- `src/components/inbox/useInboxFileRefs.ts`：重查 effect、常數 `INBOX_FILE_REF_RECHECK_DEBOUNCE_MS`、檔頭註解
- `src/components/__tests__/inbox-file-refs-recheck-t0980.test.tsx`（新增，6 個測試：①–⑤ 與「沒有參照不加入監看」）
- `docs/agent-guide/tower-inbox.md`「參考檔案連結（T0930）」：〈存在檢查〉的時機＋重查規則、〈已知限制〉改寫、〈驗證〉加測試檔
- 未改：`src/stores/ct-dir-watch.ts`（計數與 `recreate` 行為不變）、`src/lib/inbox-file-refs.ts`、`InboxRefText.tsx`、`InboxLists.tsx`、`TowerCardsSection.tsx`、CLAUDE.md（T0930 句「不新增事件 / IPC、不輪詢」仍成立，不需改）

### 驗證

- `npm ci`（worktree）：exit 0（結尾 install-scripts 警告屬預期）
- `npm run test:unit`（head `887d49c8` 第一次完整執行）：exit 0，Test Files 535 passed | 3 skipped（538），Tests 9662 passed | 47 skipped（9709）
- `npm run typecheck`：exit 0，0 個 `error TS`
- `npm run typecheck:electron`：exit 0，0 個 `error TS`
- `npx vite build`：exit 0
- 新測試涵蓋：① 事後建立的 `T0901-….md` 在事件＋debounce 後成連結（debounce 前仍不是）；② 存在的工單與 `docs/notes.md` 移走 / 刪除後不再是連結；③ 5 個間隔 < debounce 的事件＋`_bmad-output` / `.git` 事件 → 只多一次完整檢查；④ 推進 60 s 沒有事件 → 不重查；⑤ 有待做重查時卸載 → 不重查、listener 移除、計數 2 → 1 → 0、最後一個釋放才 `unwatch`、`watch` 只呼叫一次且帶 `{ recreate: true }`

### 相關通過案例判定

| 案例 | 判定 | 依據 |
|---|---|---|
| T0906 待辦分頁 / 監看共用（`acquireDirWatch`） | 不變 | `ct-dir-watch.ts` 未改；`inbox-panel.test.tsx`〈one fs:watch per directory〉〈data source … reloads on a change〉通過；hook 只多加計數，主行程 watcher 仍一個 |
| T0916 / BUG-220 `recreate` | 不變 | 監看仍經 `acquireDirWatch`（唯一帶 `recreate` 的模組），新測試斷言 `watch(CT, { recreate: true })` |
| T0908 / T0922 / T0937 / T0938 / T0942 清單、回答、推薦 / 放棄、其他、多選、已送出 | 不變 | 未動 `InboxLists.tsx` 與回答路徑；各自測試檔通過 |
| T0930 連結判定、文字、`openFileInFilesTab` | 不變 | 只改存在檢查的時機；`inbox-file-refs-t0930.test.tsx` 斷言未改、通過 |
| T0934 💬 卡片（收合摘要純文字） | 不變 | `TowerCardsSection.tsx` 未改；`inbox-tower-card-file-refs-t0934.test.tsx` 通過 |
| T0935 只寫檔名 | 不變 | `inbox-bare-filename-refs-t0935.test.tsx` 通過 |
| T0936 🙋 指令欄 | 不變 | `inbox-command-file-t0936.test.tsx` 通過 |
| ControlTowerPanel / InboxDataSource 的監看行為 | 不變 | 兩者程式未改；計數共用，任一方卸載不會關掉另一方的 watcher |

既有測試斷言一行都沒有改。

### 已知限制

- `_ct-workorders/` 以外的檔（工作區根目錄、`docs/` 等）不另外監看：之後才建立 / 刪除的這類檔，要等參照集合改變、`_ct-workorders/` 有任何變更（主行程 watcher 是遞迴的，含 `_archive/`）、切換工作區或重開分頁才更新。
- 舊 bat-server（T0916 前）不監看事後才建立的 `_ct-workorders/`，那時也不會重查。
- 主行程對同一目錄已有 500 ms 合併，再加 renderer 300 ms，所以檔案變動到連結更新最多約 0.8 s 加上檢查時間。
- 實機（Electron 視窗）未操作，只有單元測試。

### Git

- `branch`：`ct/T0980`
- `base_sha`：`330b62036994e255d28b4dc2d3d23586c5fbe62c`
- `validated_sha`：`887d49c89c6d1db5820866326ac57be439c369ea`
- `head_sha`：`887d49c89c6d1db5820866326ac57be439c369ea`
- 產品 commit：`887d49c8` feat(inbox): T0980 re-check file refs on _ct-workorders/ fs:changed
- 工單 commit（主 checkout）：`736b1c1b`（IN_PROGRESS）＋本次收單 commit
- worktree `git status --porcelain`：空；未 push、未觸發 workflow、未建 tag

### 遭遇問題

無。

### 互動紀錄

- [18:21] 開工；yolo，未向塔台提問。

### 後續建議

- 若日後要讓 `docs/` 等根目錄下的參照也即時更新，需另開工單評估是否監看更多目錄（本單依工單不做）。
