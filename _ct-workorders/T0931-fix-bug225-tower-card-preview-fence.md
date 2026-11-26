---
schema_version: 1
schema_kind: workorder
id: T0931
title: "BUG-225：💬 塔台訊息卡片收合摘要略過程式碼圍欄等 Markdown 結構行"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-225
priority: P3
sizing: S
created_at: "2026-11-26T20:08:02+08:00"
started_at: "2026-11-26T20:09:22+08:00"
updated_at: "2026-11-26T20:12:18+08:00"
completed_at: "2026-11-26T20:12:18+08:00"
session_ids:
  - "730ffa23-ce95-4084-9ec6-9df8a3f2a6d8"
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

- [x] 根因確認與取行規則說明
- [x] 新增測試（修正前失敗、修正後通過）；既有測試不改全過
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [x] 文件一句

---

## 回報區

### 完成狀態

- **狀態**：DONE（範圍內驗收全數通過）
- **完成時間**：2026-11-26T20:12:18+08:00
- **session_id**：730ffa23-ce95-4084-9ec6-9df8a3f2a6d8

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`（worktree 模式）。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：`affects_files` 三個產品路徑都存在（informational）。C-2：工單無 `branch` 欄位，不適用。
- `CT_HOME` = 主 checkout；`CT_WORKTREE_BRANCH` = `ct/T0931`；`BAT_WORKSPACE_ID` 已設定（只記錄、不比對）。

### worktree SHA

- **branch**：`ct/T0931`
- **base_sha**：`a26ceaacd14effacdc39a2be2e00444fa10f1ca0`
- **validated_sha**：`bfc83d1ba54597e37cae2ac1e141045737d306a6`
- **head_sha**：`bfc83d1ba54597e37cae2ac1e141045737d306a6`（與 validated_sha 相同）

### 根因確認

塔台判讀正確：`towerCardPreview`（`src/lib/tower-card-view.ts`）原本是 `text.split(/\r?\n/).find(line => line.trim() !== '')`，只要非空就取，沒有任何 Markdown 結構判斷；訊息第一行是 ```` ```bash ```` 時摘要就是「```bash」。唯一呼叫點 `TowerCardsSection.tsx:147`（收合時的 `.tower-card-preview`），本單沒有動它。

### 取行規則（修正後）

1. 逐行掃描並追蹤程式碼區塊：開頭圍欄 = 3 個以上反引號（info string 不得含反引號，否則是行內 code span，例 ```` ```npm ci``` passed ```` 不算圍欄）或 3 個以上 `~`（可帶任意 info string，可前置空白）；收尾圍欄須同字元、長度不短於開頭、後面只有空白。未收尾的區塊延續到訊息結尾。
2. 區塊外的行：空白行、分隔線（`---` / `***` / `___`，記號間可有空白）、表格分隔列（只含 `|` `-` `:` 與空白、且至少有一個 `|` 和一個 `-`）略過；ATX 標題去掉開頭 `#`（1–6 個，後接空白或行尾）與結尾的 `#` 串，去完是空的（例單獨一個 `#`）也略過。第一個剩下有字的行就是摘要。
3. 區塊外沒有任何有字的行 → 程式碼區塊內第一個非空行（trim）。
4. 都沒有（只有圍欄 / 分隔線等結構行）→ 原本的第一個非空行（trim），不回傳空字串；空訊息照舊回 `''`。
5. 之後照舊以字元（code point）截到 120 字＋`…`。

標題 / 清單記號的決定（工單交 Worker 決定）：
- **去掉標題 `#`**：`#` 是純排版記號，`## T0931 結果` 顯示成「T0931 結果」較易讀，不失資訊；`#hashtag`（# 後沒空白）依 CommonMark 不是標題，保留。
- **保留清單 / 引用記號**（`- ` / `1. ` / `> `）：編號步驟的「1.」帶有順序資訊，且去掉後與一般句子難以區分；同時避免和 `isTowerCardHighlightLine` 的 `LINE_LEAD` 規則產生兩套不同的前綴處理。

### 變更檔案

- `src/lib/tower-card-view.ts`：新增 `FENCE_OPEN` / `FENCE_CLOSE` / `THEMATIC_BREAK` / `TABLE_SEPARATOR` / `HEADING_MARK` / `HEADING_CLOSE` 與內部函式 `previewWords`；`towerCardPreview` 改為上述規則。`TOWER_CARD_PREVIEW_CHARS`、截斷、`towerCardFold` / `towerCardLines` / `towerCardHighlights` / `isTowerCardHighlightLine` 未改。
- `src/lib/__tests__/tower-card-view.test.ts`：「preview and folding」新增 7 個 `it`（圍欄含 info string、`~~~`、較長圍欄與異種圍欄不收尾；只有程式碼區塊（含未收尾）；分隔線與表格分隔列；標題記號 / 清單 / 引用；行內 code span 不是圍欄；全部結構行回原第一行；略過後仍截斷）。既有斷言未改。
- `docs/agent-guide/tower-inbox.md`：「回合訊息卡：UI 與面板塔台」節卡片收合那條後面補一條取行規則（BUG-225 / T0931）。
- 未動：`TowerCardsSection.tsx`、`InboxLists.tsx`、`inbox.css`、`electron/tower-cards.ts`、hook、CLAUDE.md。

### 驗證

| 關卡 | 結果 |
|---|---|
| 修正前跑新測試 | `tower-card-view.test.ts` 33 個中 5 個失敗（圍欄、只有程式碼區塊、分隔線 / 表格分隔列、標題記號、略過後截斷）；另 2 個（行內 code span、全部結構行）在舊實作就成立，作為不回歸守門 |
| 修正後單檔 | 33 / 33 通過 |
| worktree `npm ci` | exit 0（結尾 `electron-winstaller` install-scripts 警告屬預期，見 CLAUDE.md「npm 12 install scripts」） |
| `npm run test:unit`（head `bfc83d1`，第一次完整執行） | exit 0：Test Files 498 passed / 3 skipped（501）；Tests 9053 passed / 47 skipped（9100）；61.74 s |
| `npm run typecheck` | exit 0（0 錯誤） |
| `npx vite build` | exit 0 |

未碰安裝版 BAT、未開 claude 回合。

### Commit

- 產品（worktree `ct/T0931`）：`bfc83d1` fix(inbox): tower card preview skips Markdown structure lines (BUG-225, T0931)
- 工單（主 checkout）：開工 `b6f5cddd`；收單 commit 見本檔下一個 commit。
- `git -C "$CT_WORKTREE" status --porcelain` 收單時為空。未 push、未觸發 workflow、未建 tag；未用 stash / reset / restore。

### 遭遇問題

- 無。

### 偏離與備註

- 產品 commit 在跑驗證關卡**之前**提交（驗證就在該 commit 上跑，所以 validated_sha = head_sha）；節點 2 的塔台補充檢查因此實際在 commit 之後、驗證之前執行（無新段落）。
- 已知小限制（刻意不處理，P3 範圍外）：清單項目內只有 `- |` 這類由 `|` `-` 組成的行會被當成表格分隔列略過；縮排式程式碼區塊（4 格空白）不辨識。兩者都只影響收合摘要的一行。

### 後續建議

- BUG-225 可在塔台合併 `ct/T0931` 後改 `FIXED`，下一個預覽版待驗收清單列入（實機：送一則以 ```` ```bash ```` 開頭的塔台訊息，看收合摘要）。

### 互動紀錄

- [20:09] 開工；yolo、`CT_INTERACTIVE` 依工單，無需向塔台提問。
- [20:12] 驗證完成，收單。
