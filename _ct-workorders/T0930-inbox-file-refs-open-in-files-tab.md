---
schema_version: 1
schema_kind: workorder
id: T0930
title: "待辦分頁提到的參考檔案可點，點了在主畫面「檔案」頁籤開啟並定位"
type: feature
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-069
priority: P2
sizing: M
created_at: "2026-11-26T20:06:10+08:00"
started_at: "2026-11-26T20:15:03+08:00"
updated_at: "2026-11-26T20:15:03+08:00"
session_ids: []
target_version: "0.8.0-pre.5"
depends_on:
  - T0929
related:
  - "T0929（同一元件的版面，先合併）；PLAN-069 / T0922；PLAN-068 W5 / T0908；BUG-048 / T0213（`openFileInFilesTab`）；使用者 2026-11-26 指示（第一百三十四 session）"
affects_files:
  - _ct-workorders/T0930-inbox-file-refs-open-in-files-tab.md
  - src/components/inbox/InboxLists.tsx
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
tower_question: open
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
