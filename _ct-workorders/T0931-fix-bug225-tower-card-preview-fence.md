---
schema_version: 1
schema_kind: workorder
id: T0931
title: "BUG-225：💬 塔台訊息卡片收合摘要略過程式碼圍欄等 Markdown 結構行"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-225
priority: P3
sizing: S
created_at: "2026-11-26T20:08:02+08:00"
started_at: "2026-11-26T20:09:22+08:00"
updated_at: "2026-11-26T20:09:22+08:00"
session_ids: []
target_version: "0.8.0-pre.5"
depends_on: []
related:
  - "BUG-225；PLAN-068 W6 / T0909（卡片 UI）、W3 / T0905（資料層）；T0928 觀察"
affects_files:
  - _ct-workorders/T0931-fix-bug225-tower-card-preview-fence.md
  - src/lib/tower-card-view.ts
  - src/lib/__tests__/tower-card-view.test.ts
  - docs/agent-guide/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0931` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。與 T0929 平行：本單不碰 `src/components/inbox/InboxLists.tsx`、`src/styles/inbox.css`（若必須改 `TowerCardsSection.tsx` 先問塔台）。"
  - "🔴 範圍只有 `towerCardPreview` 的取行規則：略過純結構行 —— 程式碼圍欄（行首 ```` ``` ```` 或 `~~~`，可帶 info string）、分隔線（`---` / `***` / `___`）、表格分隔列（`|---|`）。優先取程式碼區塊**外**的第一個有字行；整則訊息只有程式碼區塊時取區塊內第一個非空行；全部都是結構行時回傳原本的第一個非空行（不得回傳空字串）。標題記號（`#`）、清單記號可去掉前綴（Worker 決定，回報理由）。"
  - "🔴 不變：`TOWER_CARD_PREVIEW_CHARS` = 120 與截斷 `…`、`towerCardFold` / `towerCardLines` / `towerCardHighlights` 的行為、加亮規則（只提示、不解析）、卡片內容只以 React 文字節點顯示（不以 HTML 解譯）、host 端 `electron/tower-cards.ts` 與 hook 規則都不改。"
  - "🔴 測試：`tower-card-view.test.ts` 新增圍欄開頭（含 info string、`~~~`）、只有程式碼區塊、分隔線與表格分隔列開頭、全部結構行等案例；既有斷言不改、全過。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0。不碰安裝版 BAT、不開會耗 token 的 claude 回合。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「回合訊息卡：UI 與面板塔台」補一句收合摘要的取行規則（BUG-225）；CLAUDE.md 不需改。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：測試資料自行編造，不寫真名、主機名、IP、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0931 — BUG-225：💬 卡片摘要略過程式碼圍欄

## 背景

待辦分頁「💬 塔台訊息」卡片收合時顯示一行摘要，由 `towerCardPreview`（`src/lib/tower-card-view.ts` 約第 53 行）取訊息第一個非空行、截到 120 字。塔台訊息以 Markdown 程式碼區塊開頭時，第一個非空行是 ```` ``` ````，摘要只剩「```」（T0928 觀察，BUG-225）。

## 驗收

- [ ] 根因確認與取行規則說明
- [ ] 新增測試（修正前失敗、修正後通過）；既有測試不改全過
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [ ] 文件一句

---

## 回報區

（Worker 填寫）
