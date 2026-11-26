---
schema_version: 1
schema_kind: workorder
id: T0934
title: "「💬 塔台訊息」卡片的參考檔案連結（沿用 T0930 的辨識與開檔）"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-068
priority: P3
sizing: S
created_at: "2026-11-26T21:54:51+08:00"
updated_at: "2026-11-26T21:54:51+08:00"
session_ids: []
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

- [ ] 展開的卡片內文與加亮行：存在的路徑 / 編號可點，點了切到「檔案」頁籤並在檔案樹定位；不存在、工作區外、URL 照純文字
- [ ] 收合摘要沒有連結、toggle 行為不變；點連結不切換卡片展開狀態、不改已讀 / 釘選
- [ ] 元件測試新增；既有 inbox / tower-cards 測試不改斷言全過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 隔離實例點擊確認或〈待實機〉步驟
- [ ] 文件兩處

---

## 回報區

（Worker 填寫）
