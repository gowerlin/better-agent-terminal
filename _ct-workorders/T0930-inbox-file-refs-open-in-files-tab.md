---
schema_version: 1
schema_kind: workorder
id: T0930
title: "待辦分頁提到的參考檔案可點，點了在主畫面「檔案」頁籤開啟並定位"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: M
created_at: "2026-11-26T20:06:10+08:00"
started_at: "2026-11-26T20:15:03+08:00"
updated_at: "2026-11-26T20:24:23+08:00"
completed_at: "2026-11-26T20:24:23+08:00"
session_ids:
  - "19971aaa-1133-4c96-8f6f-c8916826d74b"
target_version: "0.8.0-pre.5"
depends_on:
  - T0929
related:
  - "T0929（同一元件的版面，先合併）；PLAN-069 / T0922；PLAN-068 W5 / T0908；BUG-048 / T0213（`openFileInFilesTab`）；使用者 2026-11-26 指示（第一百三十四 session）"
affects_files:
  - _ct-workorders/T0930-inbox-file-refs-open-in-files-tab.md
  - src/components/inbox/InboxLists.tsx
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/lib/
  - src/lib/__tests__/
  - src/styles/inbox.css
  - src/components/__tests__/
  - src/locales/
  - docs/agent-guide/tower-inbox.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0930` 寫檔（base = 派工當下的 `main`，已含 T0929）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 開啟一律經既有的 `openFileInFilesTab`（`src/state/openFileInFilesTab.ts`：`workspace-switch-tab` → `files` ＋ `file-tree-reveal`），不另寫切頁籤 / 定位的事件；不呼叫 `shell.openExternal`、不開外部編輯器、不新增 IPC channel。"
  - "🔴 只連結存在的檔：路徑解析後必須在該工作區根目錄之下（`..`、絕對路徑跑到工作區外、UNC、URL scheme 一律不連結），並以既有唯讀 `fs:*`（與 `InboxDataSource` 同一套，遠端工作區走 proxied）確認存在；不存在或確認失敗就照純文字顯示、不報錯。不得因此新增輪詢；存在檢查要快取或只在顯示的項目上做，數量有上限。"
  - "🔴 顯示：仍只以 React 文字節點與元素組成（不以 HTML 解譯、不用 `dangerouslySetInnerHTML`）；不改摘要原文、回答格式、送出路徑、`inbox_features` 判斷與 T0929 的版面；既有 `data-inbox-*` 屬性保留。日誌（若有）不記摘要內容與路徑，只記數量。"
  - "🔴 測試：解析函式（純函式，`src/lib/`）單元測試：反引號路徑、裸路徑、`T####` / `BUG-###` / `PLAN-###` / `EXP-*` 編號、工作區外路徑、`..`、URL、Windows 反斜線與正斜線、中文標點相鄰；元件測試：可點的元素觸發 `openFileInFilesTab` 的兩個事件（帶解析後路徑）、不存在的檔不成連結。既有 inbox 測試不改斷言、全過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認（`launchIsolated`）或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md` 補〈參考檔案連結〉（辨識規則、存在檢查、遠端行為、已知限制）；CLAUDE.md「待辦分頁的契約 v2 清單與回答」節加一兩句＋唯一實作位置（小節標題不改名，T0595；CLAUDE.md < 100k 字元目標，現況超過時只加一句並回報）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、主機名、IP、家目錄路徑；測試路徑自行編造。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0930 — 待辦分頁的參考檔案可點，在「檔案」頁籤開啟

## 背景

使用者希望右側欄「待辦」分頁（契約 v2）的「⏸ 待你決定」「🙋 待你執行」項目中提到的參考檔案可以點，點了切到主畫面上方的「檔案」頁籤（終端 / **檔案** / Git / Git 圖譜 / GitHub）開啟並在檔案樹定位。

CT 契約 v2 沒有專門的檔案欄位（`memory-protocol.md` § 契約 v2 欄位），參考檔案出現在：

- `awaiting_user[].workorder`（工單完整 ID，例 `T0275`）、`user_actions[].ref` / `reminders[].ref`（工單 ID、`D###`、`BUG-###`、`PLAN-###`、本地規則編號）——目前顯示成標頭列的小標籤（`.inbox-item-source`）。
- `summary` / `title` 文字中，常見寫法是反引號包住的相對路徑（例 `` `ct620-accept/results/M-9.md` ``、`` `scripts/verify-packaged-native.js` ``），或句中的工單 / BUG / PLAN 編號（例「T0275 Q-1：…」）。

BAT 已有開檔機制：`openFileInFilesTab`（BUG-048 / T0213），指揮塔工單列表的「📄 檢視檔案」與總覽都用它。

## 範圍

1. **編號標籤**：`workorder` / `ref` 的值若是 `T####`（含前綴的工單完整 ID）、`BUG-###`、`PLAN-###`、`EXP-<TOPIC>-###`，對應到 `_ct-workorders/` 的檔（熱區優先，找不到再看 `_archive/workorders|bugs|plans/`；檔名以 `<ID>-` 開頭）→ 標籤可點。`D###` → `_decision-log.md`（只開檔，不要求定位到該條；封存在 `_archive/decisions/` 的不處理也可，回報）。其他值（本地規則編號等）維持純文字。
2. **摘要 / 標題文字**：反引號內或句中看起來是檔案路徑的片段（含 `/` 或 `\` 且有副檔名，或第 1 點的編號）→ 存在才成連結。相對路徑依序以「工作區根目錄」與「`_ct-workorders/`」解析；工作區內的絕對路徑可連結。
3. **點擊**：`openFileInFilesTab(<解析後的路徑>)`。連結外觀與指揮塔既有連結一致（Worker 選既有樣式，回報）；鍵盤可操作（`button` 或有 `role` / `tabIndex`）；`title` 顯示相對路徑。
4. 適用「⏸ 待你決定」「🙋 待你執行」「⏰ 到期提醒」；「💬 塔台訊息」卡片不在本單範圍（另有候選）。

唯一實作請放在 `src/lib/` 的純函式（辨識與解析）＋一個小元件（把文字拆成文字節點與連結），由 `InboxLists.tsx` 使用。

## 驗收

- [ ] 編號標籤與文字中的路徑 / 編號：存在的檔可點，點了切到「檔案」頁籤並在檔案樹定位；不存在、工作區外、URL 一律純文字
- [ ] 遠端工作區與 detached 視窗：行為說明（可用就驗，不能驗寫〈已知限制〉）
- [ ] 解析純函式與元件測試；既有 inbox 測試不改斷言全過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件兩處

---

## 回報區

### 待塔台決策

#### Q-1：清單元件拿不到工作區根目錄，可否改 `src/components/InboxPanel.tsx`（不在 affects_files）把 `workspaceFolderPath` 傳給三個清單？
- 提問時間：2026-11-26T20:16:35+0800
- 選項：[A] 准許：`InboxPanel.tsx` 只在 `AwaitingList` / `ActionList` / `ReminderList` 三處加 `folder={workspaceFolderPath}`（3 行，不改其他）/ [B] 不准：改在 `src/components/inbox/` 內另建模組層「目前資料夾」狀態，由 `InboxDataSource`（每視窗一個、與 InboxPanel 同一個工作區）寫入、清單讀取 / [C] 其他：________
- Worker 建議：[A]，因為解析路徑需要工作區根目錄，而 `InboxPanel` 已有 `workspaceFolderPath`；[B] 依賴「兩個元件剛好看同一個工作區」的隱含前提，較脆弱。
- 影響範圍：`src/components/InboxPanel.tsx`（3 處 prop）；其餘仍在 affects_files 內
- 阻塞：否（先做純函式、元件與測試；只差最後接線）
- **通道**：BAT（`q-f95482bc-…`，`answered`，choice 1＝[A]；答覆記在〈互動紀錄〉）

### 完成狀態

- **狀態**：DONE
- **摘要**：待辦分頁「⏸ 待你決定」「🙋 待你執行」「⏰ 到期提醒」的 `workorder` / `ref` 標籤與 `summary` / `title` 文字中的工單 / BUG / PLAN / EXP / `D###` 編號與路徑，存在且在工作區根目錄之下才成連結；點擊經既有 `openFileInFilesTab` 切到「檔案」頁籤並在檔案樹定位。其他一律純文字、文字逐字不變。
- **session_id**：19971aaa-1133-4c96-8f6f-c8916826d74b

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`src/components/inbox/InboxLists.tsx` 等存在 → PASS
- C-2：工單無 `branch` 欄位；worktree 分支 `ct/T0930`
- `CT_HOME` 已設定；`CT_WORKTREE_BRANCH` = `ct/T0930`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`；`BAT_REMOTE_TOKEN` 已設定

### Worktree 證據

- **branch**：`ct/T0930`
- **base_sha**：`78f4ecf6f127a449123a770d8ba101eea6a1e713`
- **validated_sha**：`a9254f556b617adb04462b650b72c97055e670b2`
- **head_sha**：`a9254f556b617adb04462b650b72c97055e670b2`（與 validated_sha 相同）
- 產品 commit：`a9254f55 feat(inbox): file references in the Inbox open in the Files tab (T0930)`（只有這一個）
- 收單前 `git -C "$CT_WORKTREE" status --porcelain`：空

### 修改檔案

| 檔案 | 變更 |
|---|---|
| `src/lib/inbox-file-refs.ts`（新） | 唯一實作（純函式）：`parseCtId`、`splitFileRefs`、`fileRefsOf`、`resolveRefPath`、`refLookups`、`matchIdFile`、`joinRoot`；常數 `INBOX_FILE_REF_MAX` = 40 |
| `src/components/inbox/useInboxFileRefs.ts`（新） | 存在檢查 hook：既有唯讀 `fs:stat` / `fs:readdir`，只檢查清單顯示的項目、去重後上限 40、每次檢查每資料夾列一次；參照集合或根目錄改變時才重查，不輪詢、不記日誌 |
| `src/components/inbox/InboxRefText.tsx`（新） | `InboxRefText`（文字拆成文字節點與 `<button>`）、`InboxRefTag`（標頭標籤）；點擊 `openFileInFilesTab(abs)` |
| `src/components/inbox/InboxLists.tsx` | 三個清單多 `folder?` prop、各呼叫一次 `useInboxFileRefs`；`workorder` / `ref` 標籤改 `InboxRefTag`、`summary` / `title` 改 `InboxRefText`；版面、`data-inbox-*`、回答與送出不變 |
| `src/components/InboxPanel.tsx`（Q-1 [A] 准許追加） | 只在 `AwaitingList` / `ActionList` / `ReminderList` 三處加 `folder={workspaceFolderPath}` |
| `src/styles/inbox.css` | `.inbox-file-link`（同指揮塔總覽 `.ct-overview-link`）、`.inbox-file-tag`（沿用 `.inbox-item-source` 外框＋accent 色）、`:focus-visible` 外框 |
| `src/lib/__tests__/inbox-file-refs.test.ts`（新） | 20 項 |
| `src/components/__tests__/inbox-file-refs-t0930.test.tsx`（新） | 7 項 |
| `docs/agent-guide/tower-inbox.md` | 新增「參考檔案連結（T0930）」節（辨識規則、存在檢查、外觀、遠端與 detached、已知限制、驗證）＋對應表一列 |
| `CLAUDE.md` | 「待辦分頁的契約 v2 清單與回答」節加一點（用途、🔴 規則、唯一實作位置、docs 連結）；小節標題未改；加後 95,037 → 95,355 字元（< 100k） |

`src/locales/` 未改（沒有新增使用者可見字串）。

### 實作重點

- **辨識**：工單 `(?:[A-Z]{2,4}-)?T\d{4,}`（與 `WORKORDER_ID_PREFIX` 相同的前綴）、`BUG-\d{3,}`、`PLAN-\d{3,}`、`EXP-[A-Z0-9]+-\d{3,}`、`D\d{3,}`；路徑 = 含 `/` 或 `\` 且最後一段有副檔名。反引號內整段是一個參照才成連結（反引號留在文字裡）；句中找編號與路徑時前後不得是英數、`_ . - / \ : @ ~`（中文與中文標點相鄰可以）。路徑尾端的句點 / 連字號不算、`:行[:欄]` 後綴解析時去掉。
- **解析**：相對路徑依序試「工作區根目錄」、「`_ct-workorders/`」；絕對路徑只在根目錄之下（磁碟路徑不分大小寫）；URL（任何 `scheme:`）、UNC、`~`、任何 `..`、`C:foo` 一律不連結，也不會去 `stat`。編號：熱區 `_ct-workorders/` 檔名 `<ID>-….md`／`<ID>.md`，找不到再看 `_archive/workorders|bugs|plans`（EXP 依實際位置用 `_archive/workorders`）；`D###` → `_decision-log.md`（只開檔）；`_archive/decisions/` 不處理。
- **外觀選擇**：文字連結選指揮塔總覽的 `.ct-overview-link`（accent 色、滑過底線、`overflow-wrap: anywhere`），在 `inbox.css` 另寫同值的 `.inbox-file-link`（不依賴 control-tower.css）；標籤保留 `.inbox-item-source` 外框、改 accent 色。兩者都是 `<button type="button">`（Tab 可聚焦、Enter / 空白鍵開啟），`title` = 相對路徑。
- **與工單文字的差異**：範圍第 2 點「含 `/` 或 `\` 且有副檔名」照字面做，所以反引號內的單一檔名（如 `` `package.json` ``）不連結；中文檔名只在反引號內辨識（句中只認 ASCII 路徑字元）。

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0（結尾列出 `electron-winstaller` / `fsevents` install script 未放行，屬預期） |
| `npm run test:unit`（head `a9254f55` 第一次完整執行） | exit 0：Test Files 501 passed / 3 skipped（504），Tests 9079 passed / 46 skipped（9125） |
| 新測試 | `inbox-file-refs.test.ts` 20 項、`inbox-file-refs-t0930.test.tsx` 7 項全過（皆含在上列數字內） |
| 既有 inbox 測試 | 未改任何斷言，全過（`inbox-layout-t0929` / `inbox-panel` / `inbox-plan069` / `inbox-tower-cards` / `inbox-w5` 等；它們的 fs mock `stat` → null、`readdir` → []，所以不出現連結） |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| 隔離實例點擊 | 未執行 → 〈待實機〉（要有契約 2 的已宣告塔台分頁與 CT 狀態檔，隔離實例建置成本高；元件測試已驗兩個事件與路徑） |

### 相關通過案例判定

- 工單沒有〈相關通過案例〉段落；既有 inbox 元件測試（T0908 / T0922 / T0929）不改斷言全過，版面、回答與送出路徑不變。

### 待實機

1. 開一個有 `_ct-workorders/`、`_tower-state.md` `bat_contract: 2` 的工作區，以「以塔台開啟 Claude」開塔台並 `--set-role tower --bat-contract 2`。
2. 在 `awaiting_user` 放一筆 `workorder` 為現有工單 ID、`summary` 含 `` `docs/…/<存在的檔>.md` ``、一個不存在的路徑、`BUG-###`、`D###`、一個 URL、`` `../x.md` ``。
3. 待辦分頁：存在的標籤 / 路徑 / 編號顯示為 accent 色、滑過底線、`title` 為相對路徑；不存在、URL、`..` 為一般文字，整段文字與狀態檔相同。
4. 點連結 → 主畫面切到「檔案」頁籤，檔案樹展開並選取該檔；Tab 移到連結按 Enter 同樣開啟。
5. 「🙋 待你執行」的 `ref` 與 `title`、「⏰ 到期提醒」的 `ref` 與 `title` 同樣檢查。
6. 遠端工作區（WSL / SSH）與 detached 視窗各點一次：遠端應開 host 上的檔；detached 應切 detached 視窗自己的「檔案」頁籤。

### 已知限制

- 檢查結果在參照集合不變時沿用：之後才建立 / 刪除的檔，要等清單內容改變、切換工作區或重開分頁才更新（不輪詢的取捨）。
- `D###` 只開 `_decision-log.md`、不定位到該條；封存在 `_archive/decisions/` 的不處理。
- 熱區與封存區都有同編號時開熱區；同資料夾多個 `<ID>-….md` 時開檔名排序第一個。
- 遠端工作區、detached 視窗未實機（行為說明見 docs「參考檔案連結（T0930）」〈遠端與 detached〉）。

### 遭遇問題

- 清單元件拿不到工作區根目錄，接線需改 affects_files 外的 `src/components/InboxPanel.tsx` → Q-1 問塔台，答 [A] 准許（只加三處 prop）。

### 後續建議

- 「💬 塔台訊息」卡片可用同一套 `InboxRefText` 加連結（工單已註明另有候選）。
- 若要在檔案出現 / 消失時即時更新，可讓 `useInboxFileRefs` 也跟 `_ct-workorders/` 的 `fs:changed` 重查（仍不輪詢）。

### 互動紀錄

- [20:15] 開工；落點檢查 PASS。
- [20:16] Q-1：可否改 `InboxPanel.tsx` 傳 `workspaceFolderPath` → A（塔台，BAT 通道）：「A 准許。只在三處加 `folder={workspaceFolderPath}`，不改其他；視為 affects_files 追加，回報區〈修改檔案〉列出。`workspaceFolderPath` 為空時清單照舊顯示純文字、不建連結。」→ Action：照 [A] 接線；沒有根目錄時 `useInboxFileRefs` 不檢查、全部純文字（元件測試涵蓋）。
