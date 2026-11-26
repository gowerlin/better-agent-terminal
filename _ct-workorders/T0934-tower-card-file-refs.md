---
schema_version: 1
schema_kind: workorder
id: T0934
title: "「💬 塔台訊息」卡片的參考檔案連結（沿用 T0930 的辨識與開檔）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P3
sizing: S
created_at: "2026-11-26T21:54:51+08:00"
updated_at: "2026-11-26T22:00:18+08:00"
started_at: "2026-11-26T21:55:47+08:00"
completed_at: "2026-11-26T22:00:18+08:00"
session_ids:
  - "53983297-8204-4925-a04b-cd92974ed8d2"
target_version: "0.8.0-pre.6"
depends_on: []
related:
  - "T0930（待辦清單的參考檔案連結，`inbox-file-refs.ts` / `InboxRefText` / `useInboxFileRefs`）、T0909（卡片 UI）、T0931 / BUG-225（收合摘要取行）；D379；使用者 2026-11-26 指示（第一百三十五 session）"
affects_files:
  - _ct-workorders/T0934-tower-card-file-refs.md
  - src/components/inbox/TowerCardsSection.tsx
  - src/components/InboxPanel.tsx
  - src/components/inbox/InboxRefText.tsx
  - src/components/inbox/useInboxFileRefs.ts
  - src/lib/inbox-file-refs.ts
  - src/lib/tower-card-view.ts
  - src/styles/inbox.css
  - src/components/__tests__/
  - src/lib/__tests__/
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
  - "🔴 分支：只在 `ct/T0934` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 沿用 T0930 的唯一實作：辨識 / 解析一律經 `src/lib/inbox-file-refs.ts`，存在檢查經 `useInboxFileRefs`（同樣只查顯示的部分、上限、不輪詢），顯示經 `InboxRefText`，開檔經 `openFileInFilesTab`；不另寫第二套規則、不新增 IPC channel、不呼叫 `shell.openExternal`。工作區根目錄由 `InboxPanel.tsx` 以 `folder={workspaceFolderPath}` 傳給 `TowerCardsSection`（與 T0930 三個清單相同）。"
  - "🔴 不得巢狀互動元素：收合時的一行摘要 `.tower-card-preview` 在 `.tower-card-toggle` 這個 `<button>` 裡面，**維持純文字、不加連結**（button 內不可再放 button）。連結只加在按鈕外的部分：收合時的加亮行（`towerCardHighlights`）與展開後的內文（`towerCardLines` / `towerCardFold` 的 head 與「顯示全部」後的全文）。點連結不得觸發卡片展開 / 收合、不改已讀 / 釘選狀態（必要時 `stopPropagation`）。"
  - "🔴 不變：卡片內容只以 React 文字節點與元素組成（不以 HTML 解譯、不用 `dangerouslySetInnerHTML`）、文字逐字不變（連結只是把片段包成 `<button>`）；加亮規則（只提示、不解析）、`towerCardPreview`（T0931）、摺疊上限、未讀 / 釘選 / 清除、host 端 `electron/tower-cards.ts` 與 hook 規則都不改；T0930 三個清單的行為與測試不改。卡片文字來自 agent 輸出，連結規則維持 T0930 的限制（工作區內、存在才連、URL / `..` / UNC / `~` 一律不連）。"
  - "🔴 測試：元件測試——展開的卡片內文中存在的路徑 / 編號成連結並觸發 `openFileInFilesTab` 的兩個事件、不存在的不成連結、收合摘要內沒有任何 `<button>` 以外的互動元素（摘要本身不含連結）、加亮行可連結、點連結不切換卡片展開狀態；既有 `inbox-tower-cards` 等測試不改斷言、全過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。實際點擊以隔離實例確認或寫〈待實機〉，不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「參考檔案連結（T0930）」節補卡片的適用範圍（哪些部分有連結、收合摘要為何沒有）；CLAUDE.md 對應的一點補一句即可（小節標題不改名，T0595；< 100k 字元）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、主機名、IP、家目錄路徑（截圖路徑寫 `<使用者資料夾>`）；測試路徑自行編造。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0934 — 「💬 塔台訊息」卡片的參考檔案連結

## 背景

T0930（`v0.8.0-pre.5`，使用者已驗收）讓待辦分頁「⏸ 待你決定」「🙋 待你執行」「⏰ 到期提醒」中提到的工單 / BUG / PLAN / EXP / `D###` 編號與檔案路徑可以點，在主畫面「檔案」頁籤開啟。T0930 回報建議「💬 塔台訊息」卡片沿用同一套；使用者 2026-11-26 指示開單。

塔台每回合的最後一則訊息常提到工單、報告與檔案路徑，卡片是最常看到這些參考的地方。

## 範圍

1. `InboxPanel.tsx` 把 `workspaceFolderPath` 傳給 `TowerCardsSection`。
2. 卡片中**按鈕以外**的文字（收合時的加亮行、展開後的內文）經 `InboxRefText` 顯示；存在檢查經 `useInboxFileRefs`，只查目前顯示的卡片部分（收合的卡只查加亮行；展開的卡查顯示中的 head / 全文），沿用上限。
3. 收合摘要（`.tower-card-preview`，在 toggle 按鈕內）維持純文字。
4. 點連結 → `openFileInFilesTab`，不改卡片展開、已讀、釘選。

## 驗收

- [x] 展開的卡片內文與加亮行：存在的路徑 / 編號可點，點了切到「檔案」頁籤並在檔案樹定位；不存在、工作區外、URL 照純文字
- [x] 收合摘要沒有連結、toggle 行為不變；點連結不切換卡片展開狀態、不改已讀 / 釘選
- [x] 元件測試新增；既有 inbox / tower-cards 測試不改斷言全過
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [x] 隔離實例點擊確認或〈待實機〉步驟（寫〈待實機〉）
- [x] 文件兩處

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-26T22:00:18+08:00
- **session_id**：53983297-8204-4925-a04b-cd92974ed8d2
- **branch**：`ct/T0934`
- **base_sha**：`5416f42e5c5839454de44cc2e51d78707c05a890`
- **validated_sha**：`15ded3681196dbffca8bfd8cd3e5e5fabc1daa7f`
- **head_sha**：`15ded3681196dbffca8bfd8cd3e5e5fabc1daa7f`（與 validated_sha 相同）

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：抽查 `src/components/inbox/TowerCardsSection.tsx` 等皆存在 → PASS
- C-2：工單無 `branch` 欄位；worktree 分支 `ct/T0934`
- 證據：`CT_HOME` 已設定（主 checkout）、`CT_WORKTREE_BRANCH` = `ct/T0934`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定、`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 結果摘要

「💬 塔台訊息」卡片沿用 T0930 的唯一實作（`inbox-file-refs.ts` 辨識、`useInboxFileRefs` 存在檢查、`InboxRefText` 顯示、`openFileInFilesTab` 開檔），沒有第二套規則、沒有新 IPC / 事件。

- `InboxPanel.tsx`：`<TowerCardsSection … folder={workspaceFolderPath} />`。
- `TowerCardsSection.tsx`：新增選用 prop `folder`（預設 `null` → 純文字、不檢查）。每張卡先算「按鈕以外顯示的部分」：收合 → `towerCardHighlights`；展開 → `towerCardLines(body)`（body = 摺疊時的 head 或「顯示全部」後的全文）。全部卡片這些行的參照合併給一個 `useInboxFileRefs`（沿用去重與上限 `INBOX_FILE_REF_MAX` = 40、不輪詢），每行以 `InboxRefText` 顯示；空行照舊顯示原本的 NBSP。
- 收合摘要 `.tower-card-preview`（在 `.tower-card-toggle` `<button>` 內）維持純文字，`towerCardPreview` 不變。
- 點連結：`RefLink` 既有的 `stopPropagation`，且連結不在 toggle 按鈕內 → 不切換展開、不呼叫 `markRead` / `pin`（測試斷言）。
- `inbox.css`：`.tower-card-line .inbox-file-link { white-space: inherit; }`，連結在卡片行內保留 `pre-wrap`。
- 未改：`tower-card-view.ts`、`inbox-file-refs.ts`、`InboxRefText.tsx`、`useInboxFileRefs.ts`（工單列為可改，但沿用即可，不需改）、host `electron/tower-cards.ts`、hook 規則、加亮規則、摺疊上限、T0930 三個清單。

### 變更檔案（`ct/T0934`，commit `15ded368`）

- `src/components/InboxPanel.tsx`
- `src/components/inbox/TowerCardsSection.tsx`
- `src/styles/inbox.css`
- `src/components/__tests__/inbox-tower-card-file-refs-t0934.test.tsx`（新增）
- `docs/agent-guide/tower-inbox.md`：「參考檔案連結（T0930）」節的用途句改為卡片也適用，新增〈塔台訊息卡片（T0934）〉小節（範圍、收合摘要為何沒有連結、點擊不改狀態、只查顯示部分、驗證）
- `CLAUDE.md`：「待辦分頁的契約 v2 清單與回答」節 T0930 那一點補一句（小節標題不改；95,231 字元 < 100k）

### 驗證

| 項目 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0 |
| 新元件測試 + `inbox-tower-cards` + `inbox-file-refs-t0930` | 3 檔 30 tests 全過（既有測試未改斷言） |
| `npm run test:unit`（head `15ded368` 第一次完整執行） | exit 0：Test Files 502 passed / 3 skipped（505）；Tests 9091 passed / 47 skipped（9138） |
| `npm run typecheck` | 0 errors（exit 0） |
| `npx vite build` | exit 0 |
| 隔離實例點擊 | 未執行 → 見〈待實機〉 |

新測試 `inbox-tower-card-file-refs-t0934.test.tsx`（6 tests）：收合卡加亮行的路徑 / 編號成連結且文字不變、toggle 按鈕內沒有 `button` / `a` / `[data-inbox-file-ref]`、收合時不查展開才顯示的參照；點加亮行連結送出 `workspace-switch-tab` + `file-tree-reveal`、卡片維持收合、`markRead` / `pin` 未呼叫；展開卡內文：存在的路徑 / `T0901` / `D370` 成連結，`missing.md`、URL、`../outside`、工作區外絕對路徑、`T0999` 為純文字、各行文字逐字不變、只 `stat` 工作區內路徑；點內文連結後卡片仍展開、`markRead` 只有展開那次 1 次、`pin` 未呼叫；摺疊卡只查 head，「顯示全部」後尾端路徑才檢查並成連結；沒有 `folder` 時不呼叫 `stat` / `readdir`、沒有連結。

### 待實機

不碰安裝版 BAT；在隔離實例或下一個預覽版確認：

1. 契約 v2 塔台的工作區開「待辦」分頁，「💬 塔台訊息」有一張卡片提到存在的檔案路徑（如 `docs/agent-guide/tower-inbox.md`）與工單編號，且含 `⏸ 待你決定：…` 加亮行。
2. 收合時：加亮行中的路徑 / 編號顯示為連結色；一行摘要沒有連結色。點加亮行的連結 → 主畫面切到「檔案」頁籤、檔案樹定位到該檔；卡片仍收合、● 未讀仍在。
3. 點卡片展開 → 內文中存在的路徑 / 編號是連結；不存在的檔名與 URL 為一般文字。點連結 → 同上開檔，卡片仍展開、📌 狀態不變。
4. 長卡片按「顯示全部」→ 尾段的路徑才變連結。
5. 連結文字換行時與相鄰文字一致（`pre-wrap`）。

### 遭遇問題

- 卡片空行的占位字元是 NBSP（U+00A0），批次字串比對失敗一次；改用 Edit / `sed` 保留原字元，diff 確認未改動該字元。
- Write 工具寫出的新測試檔是 CRLF，提交前已轉 LF（`git ls-files --eol` 其他檔皆 `i/lf w/lf`）。

### 後續建議

- 無必要後續。若之後要讓收合摘要也可點，需把摘要移出 toggle 按鈕（版面變動，另開單）。

### 互動紀錄

- [21:55] 開工；yolo、`CT_INTERACTIVE=0`，未向塔台提問。
