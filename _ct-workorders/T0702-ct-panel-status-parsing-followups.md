---
schema_version: 1
schema_kind: workorder
id: T0702
title: "指揮塔工單狀態解析後續（T0701）：讀引用區塊形式的狀態、加入 PAUSED、TODO 當 PENDING 別名（D185）"
type: fix
status: DONE
repo: better-agent-terminal
project: "Control Tower 面板"
priority: P2
sizing: S
created_at: "2026-10-25T19:49:22+0800"
started_at: "2026-10-25T19:51:08+0800"
updated_at: "2026-10-25T20:04:35+0800"
completed_at: "2026-10-25T20:04:35+0800"
depends_on: [T0701]
related:
  - "T0701 回報區「後續建議」1、2；D185；`docs/agent-guide/ct-tower-overview.md`（T0701 的分類表）"
  - "CT 狀態定義（只讀）：`<使用者資料夾>\\.claude\\skills\\control-tower\\references\\work-order-system.md`、`interrupt-protocol.md`（`PAUSED`）、`work-order-template.md`（`status: PENDING`）"
affects_files:
  - src/types/control-tower.ts
  - src/lib/ct-tower-overview.ts
  - "src/components/ControlTowerPanel.tsx（只在狀態徽章 / 計數 / 按鈕需要對應新狀態時）"
  - "src/components/**（同上，顯示狀態的元件）"
  - "src/types/__tests__/**、src/lib/__tests__/ct-tower-overview.test.ts、src/components/__tests__/**（測試）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（新狀態的顯示文字）"
  - "src/styles/control-tower.css（只在需要新徽章顏色時）"
  - docs/agent-guide/ct-tower-overview.md
  - "CLAUDE.md（只在「指揮塔總覽（T0701，D184）」節需要改一句時）"
  - _ct-workorders/T0702-ct-panel-status-parsing-followups.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 唯讀：只改 BAT 的解析與顯示，不得修改任何工單檔（BAT 或 BMad-Guide 的 `_ct-workorders/`）來配合解析；BMad-Guide repo 只讀。"
  - "🔴 Worker 不 push。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。回報寫路徑時家目錄寫 `<使用者資料夾>`、截圖路徑寫 `<scratchpad>/…`（D176 / L175）。"
  - "🔴 renderer 日誌用 `window.electronAPI.debug.log`（CLAUDE.md「Logging」）。改共用型別 / parser 時追蹤所有 consumer（No Regressions Policy）。"
  - "🔴 yolo Worker：不得問使用者；範圍內的細節自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0702 — 指揮塔工單狀態解析後續

## 目標

T0701 修正了總覽與計數，Worker 留下兩個解析缺口，本單補上，之後與 T0701 一起發 `v0.7.1-pre.7`（D185）。

## 要做的事

1. **引用區塊形式的狀態**：legacy parser（沒有 frontmatter 的工單）目前讀不到寫在 Markdown 引用區塊裡的狀態，例如 BMad-Guide `T0098` 的 `> 狀態:✅ DONE`。補上這種格式：允許行首 `>`、全形 / 半形冒號、狀態前的 emoji 或符號。先唯讀盤點 BMad-Guide 與 BAT `_ct-workorders/` 熱區裡沒有 frontmatter 的檔案實際用了哪些狀態寫法，只補實際出現的格式，回報列出盤點結果。🔴 不得因此讓報告檔（真的沒有狀態的檔）被誤判出狀態。
2. **`PAUSED`**：CT 的中斷協定會把工單改成 `PAUSED`（`interrupt-protocol.md`）。加入 BAT 狀態列舉，分類為「進行中」（open，列在總覽、不算 done），給顯示文字與徽章；計數歸在哪一格由你決定並說明（建議不算 pending）。
3. **`TODO` 當 `PENDING` 的別名**：frontmatter `status: TODO` 視同 `PENDING`（顯示、計數、可執行按鈕都和 PENDING 一樣），不再標 ⚠️ Invalid。CT 範本是 `PENDING`，塔台之後開單一律用 `PENDING`；別名只為了相容已經寫成 `TODO` 的舊單。
4. 同步更新 `docs/agent-guide/ct-tower-overview.md` 的分類表；`CLAUDE.md` 該節若有受影響的句子才改。

## 驗證

- 單元測試涵蓋：引用區塊狀態（含 emoji、全形冒號）、報告檔仍是 `UNKNOWN`、`PAUSED`、`TODO` → PENDING
- `npm run test:unit` 全過；`npm run typecheck` = 0；`npx vite build` 成功
- 唯讀實測：BMad-Guide 與 BAT `_ct-workorders/` 的計數修正前後數字（`T0098` 應變成 done）；方法自選（單元測試以真實檔案內容快照，或隔離實例畫面），不跑 Playwright e2e 套件

## 驗收

- 三項都完成，計數前後數字附在回報
- 測試、typecheck、build 全過；docs 已更新
- commit（不 push），回報區附 SHA

## 回報區

### 結果摘要

**DONE**。三項都完成：legacy parser 讀得到引用區塊形式的狀態（BMad-Guide `T0098` → `DONE`，報告檔仍是 `UNKNOWN`）；`PAUSED` 加入 BAT 狀態列舉（open、總覽列出、`⏸ Paused` 徽章）；frontmatter `status: TODO` 視同 `PENDING`。docs 分類表已更新。測試、typecheck、build 全過。產品 commit `33d77c4f`、`5388ed65`（未 push）。

### 落點檢查

- `PASS`。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS。C-3：`src/types/control-tower.ts`、`src/lib/ct-tower-overview.ts`、`docs/agent-guide/ct-tower-overview.md` 都存在 → PASS（資訊性）。C-2：工單沒有 `branch` 欄位，略過（目前 `main`）。
- `CT_HOME` 未設定（非隔離工單）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 盤點（唯讀，2026-10-25）

熱區＝`_ct-workorders/` 頂層的工單檔（`isWorkOrderFile`）。

| 位置 | 工單檔 | 沒有 frontmatter | 狀態寫法 |
|---|---|---|---|
| BAT `_ct-workorders/` | 223 | 0 | 全部 frontmatter：`DONE` 201、`FIXED` 5、`ABANDONED` 2、`IN_PROGRESS` 1 |
| BMad-Guide `_ct-workorders/` | 188 | 12 | 有 frontmatter 的：`DONE` 169、`IN_PROGRESS` 3、`PARTIAL` 1。沒有 frontmatter 的 12 檔：`- **狀態**：✅ DONE`（`T0042`、`T0045`，既有支援）、`> 狀態:✅ DONE（原 💡 IDEA …）`（`T0098`，本單補上）、其餘 9 檔是報告（`T0022`、`T0099/T0100-audit-report`、`T0182/T0189/T0191/T0196/T0234/T0263-report-*`），沒有狀態欄位 |

- 兩邊 frontmatter 都沒有 `TODO` / `PAUSED`（別名與新狀態目前只是相容用）。
- 封存區（參考，面板勾「含封存」時才載入）：BMad-Guide 有 11 檔：10 檔 `> 狀態:✅ DONE`、1 檔 `> 狀態：DONE`（全形冒號）；BAT 封存區另有 3 檔 frontmatter `status: CLOSED`（不在本單範圍，仍是 `⚠️ Invalid`，見後續建議）。
- 實際出現的引用區塊格式只有「`>` + 空白 + `狀態` + 半形／全形冒號 + 可選 emoji + 狀態字」，本單只補這一種（不含 `> **狀態**：`，那是既有粗體規則就讀得到的）。

### 實作與決定

- **引用區塊狀態**：新增 `extractQuotedField`（`src/types/control-tower.ts`），規則 `^(?:>[ \t]*)+狀態[ \t]*[：:][ \t]*(.+)`。**只用於 legacy 的狀態**，工單編號 / 標題 / 時間欄位不讀引用區塊（避免改變既有 id 與標題的解析；`T0098` 的 `> 開始時間:(待 …)` 也因此不會被讀成時間）。順序：列表 / 表格 / 粗體讀到的值有狀態關鍵字就用它；沒有（含被表頭 `| AC | 狀態 | 落地位置 |` 搶先匹配，實測於封存區 `T0104`）才試引用區塊，再來才是 `status:` 行。報告不會誤判：`> 本報告的狀態:…`、`> 狀態:草稿`、沒有 `>` 的 `狀態:DONE` 都不採用（單元測試涵蓋）。
- **`PAUSED`**：`WorkOrderStatus` / 兩個狀態集合 / legacy 關鍵字 regex / `CtWorkorderFrontmatterV1.status` 都加上；`workOrderPhase` = open（總覽列出、不算 done）；徽章 `⏸ Paused`（`ct-status-paused`，與 `INTERRUPTED` 同紫色，`control-tower.css` 加兩行）；工單卡片與看板的「🔧 補救結案」可用（`DONE_ELIGIBLE` 加入，同 `INTERRUPTED`），沒有「▶ 執行」；看板歸 `BLOCKED` 欄；排序與 `INTERRUPTED` 同級。
  - **計數**：不算 `active`、也不算 `pending`。理由：`active` 只算 `IN_PROGRESS` / `URGENT`、`pending` 只算 `PENDING`；暫停的工單在等緊急工單做完，不是待派也不是正在跑，比照 `INTERRUPTED` / `BLOCKED` 只出現在總覽「進行中工單」與 `N total`。沒有新增計數徽章（新增會連帶改 `INTERRUPTED` / `BLOCKED` 的呈現，超出本單）。
- **`TODO` → `PENDING`**：別名表 `FRONTMATTER_STATUS_ALIASES`（不分大小寫），只套用在 frontmatter；解析後就是 `PENDING`，所以顯示、計數、「▶ 執行」與 `PENDING` 完全相同，不產生 `unknown_status`。frontmatter `TODO` 配 body `PENDING` 不算 drift；body 寫其他狀態（例 `DONE`）仍回報 drift。legacy 檔不套用別名（盤點沒有出現，避免報告裡的 TODO 字樣被誤判）。
- **i18n**：工單狀態徽章文字本來就是 `statusLabel` 的固定英文（`⏳ Pending`、`⏸️ Interrupted`…），沒有 locale 鍵，所以 `src/locales/*.json` 不用改。
- **CLAUDE.md**：「指揮塔總覽（T0701，D184）」節只寫「沒有狀態欄位的工單檔 = `UNKNOWN`，不算 pending」，沒有受影響的句子，未修改。
- 寫檔 LF：`src/types/control-tower.ts` 的工作目錄副本原本是 CRLF（index 是 LF、`eol=lf`），編輯時轉成 LF，`git diff` 只含實際修改。

### 計數前後（唯讀實測）

方法：scratchpad 腳本以 `tsx` 匯入本 repo 的 `parseWorkOrder` / `isWorkOrderFile`，套用與 `ControlTowerPanel.loadWorkOrders` 相同的同編號去重，算面板上方徽章的數字（`active` = `IN_PROGRESS`+`URGENT`、`pending`、`done`、`inactive` = `ABANDONED`、`no status` = `UNKNOWN`），修正前（HEAD 的 parser）與修正後各跑一次，逐檔比對差異。只讀檔、不寫任何工單檔。

| 位置 | 修正前 | 修正後 | 改變的檔 |
|---|---|---|---|
| BMad-Guide `_ct-workorders/` | active 3、pending 0、done 171、no status 4（180 張） | active 3、pending 0、**done 172、no status 3** | `T0098` `UNKNOWN` → `DONE` |
| BAT `_ct-workorders/` | active 1、pending 0、done 215、inactive 2（223 張） | 相同 | 無 |
| BMad-Guide 封存區（參考） | done 129、no status 11 | **done 140、no status 0** | 11 檔 `UNKNOWN` → `DONE`（`T0097`、`T0099`–`T0107`、`T0109`，含 `T0104` 表頭案例） |
| BAT 封存區（參考） | done 473、no status 3、invalid 3 | 相同 | 無 |

報告檔全部維持 `UNKNOWN`（BMad-Guide 熱區 11 個報告檔、BAT 封存區 7 個逐一列在修正後輸出中，前後相同）。

### 驗證

| 關卡 | 結果 | 證據 |
|---|---|---|
| 單元測試（新增） | PASS | `src/lib/__tests__/ct-tower-overview.test.ts`：BMad-Guide `T0098` 檔頭原文（半形冒號 + emoji）→ DONE、`> 狀態：DONE`（全形）等 5 種寫法、`T0099-audit-report` 檔頭原文與 3 種非狀態寫法仍 `UNKNOWN`、表頭搶先匹配、列表優先於引用區塊、`PAUSED`（frontmatter / legacy 表格 / 徽章 / class / phase）、`TODO` / `todo` → `PENDING` 無警告、body `PENDING` 不算 drift、body `DONE` 仍算 drift、`CLOSED` 仍 `INVALID`。`src/components/__tests__/tower-overview.test.tsx`：徽章 `['1 pending', '1 done', '1 no status', '4 total']`、TODO 卡片 `⏳ Pending` + ▶ 執行、PAUSED 卡片 `⏸ Paused` + `ct-status-paused` + 🔧 補救結案且無 ▶、總覽列出 TODO 與 PAUSED、不列引用區塊 DONE |
| `npm run test:unit` | PASS | 第二次完整執行：`Test Files 334 passed (334)`、`Tests 5972 passed | 3 skipped (5975)`。第一次完整執行有 1 個失敗：`electron/__tests__/worktree-status-after-close.test.ts`「live → exited → git … NOT_FOUND」`Test timed out in 5000ms`（真 git + PTY，平行負載下逾時；本單沒有改 `electron/`），單獨重跑 3/3 通過，第二次完整執行全過 |
| `npm run typecheck` | PASS | exit 0（= 0 錯誤） |
| `npx vite build` | PASS | exit 0，四段 `✓ built in …` |
| 唯讀實測 | PASS | 見上表（`T0098` 變成 done） |
| Playwright e2e | 未跑 | 工單指定不跑 |

### 變更檔案（`33d77c4f`）

- `src/types/control-tower.ts`：`PAUSED`、`FRONTMATTER_STATUS_ALIASES` / `resolveFrontmatterStatus`、別名不算 drift、`extractQuotedField`、legacy 狀態順序、徽章文字與 class
- `src/utils/ct-frontmatter.ts`：`CtWorkorderFrontmatterV1.status` 加 `PAUSED`、`TODO`
- `src/lib/ct-tower-overview.ts`：`workOrderPhase` 的 `PAUSED` = open
- `src/components/ControlTowerPanel.tsx`：`DONE_ELIGIBLE`、排序加 `PAUSED`
- `src/components/KanbanView.tsx`：`PAUSED` → `BLOCKED` 欄、`DONE_ELIGIBLE`
- `src/styles/control-tower.css`：`ct-status-paused`
- `src/lib/__tests__/ct-tower-overview.test.ts`、`src/components/__tests__/tower-overview.test.tsx`（`setup` 多一個可選的 actions 參數）
- `docs/agent-guide/ct-tower-overview.md`：分類表、「狀態的讀法（T0702）」、R4 實測、已知限制、驗證清單、唯一實作位置表

### Commit

- 產品：`33d77c4f` fix(ct-panel): read blockquote status lines, add PAUSED, TODO as PENDING alias (T0702)
- 產品：`5388ed65` docs(ct-overview): correct archived blockquote status count (T0702)（只改 docs 一句數字，不影響驗證結果）
- 工單檔：另一個 commit（本回報之後）
- 未 push。執行期間 HEAD 由 `f41e64b2` 前進到 `a5ba5dd5`（塔台的 `chore: cross-reference T0701 done (ct)`），產品 commit 建在其上；驗證時的工作目錄內容即 `33d77c4f`。

### 偏離與注意

- BMad-Guide repo 工作目錄有別人的未提交修改（`_ct-workorders/T0307-…`、`T0308-…`），本單只讀，未碰。
- `Claude outputs/` 未碰。沒有使用 `git stash` / `reset` / `checkout --` / `restore`。

### 互動紀錄

無（沒有向使用者或塔台提問）。

### 後續建議

1. BAT 封存區 3 檔 frontmatter `status: CLOSED`（BUG 單的狀態寫進了工單）顯示為 `⚠️ Invalid`，只在勾「含封存」時看得到。要不要把 `CLOSED` 當 `DONE` 的別名，或請 CT 補正那 3 檔，由塔台決定。
2. `PAUSED` / `INTERRUPTED` / `BLOCKED` / `PARTIAL` / `FAILED` 都不在上方計數徽章；如果需要一眼看到「需要處理」的數量，可另開單加一個 `N attention` 類的徽章。
