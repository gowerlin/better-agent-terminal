---
schema_version: 1
schema_kind: workorder
id: T0701
title: "DELEGATE（CT 塔台請求）：指揮塔「總覽」顯示塔台最新狀態與 `*config` 生效值＋來源，沒有 sprint-status.yaml 不擋；查證 pending 計數（D184）"
type: delegate
status: DONE
repo: better-agent-terminal
project: "Control Tower 面板＋跨專案請求"
priority: P2
sizing: M
created_at: "2026-10-25T19:17:48+0800"
started_at: "2026-10-25T19:19:16+0800"
updated_at: "2026-10-25T19:41:16+0800"
completed_at: "2026-10-25T19:41:16+0800"
depends_on: []
coordination:
  type: DELEGATE
  source:
    project: BMad-Guide
    prefix: ""
    workorder: _request-2026-10-25-bat-overview-tower-state-config
    task-ref: "R1 塔台最新狀態；R2 *config 生效值與來源；R3 沒有 sprint-status.yaml 不擋；§ 5 pending 計數"
related:
  - "來源請求（只讀，不得修改）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_request-2026-10-25-bat-overview-tower-state-config.md`"
  - "D184（本單決策）；CT 格式權威（只讀）：`<使用者資料夾>\\.claude\\skills\\control-tower\\references\\tower-config.md`（§ 可用選項、§ 三層設定架構、§ 持久化檔案格式）、`memory-protocol.md`、`work-order-system.md`"
affects_files:
  - src/components/ControlTowerPanel.tsx
  - src/components/SprintDashboard.tsx
  - "src/components/**（總覽新元件，例 `TowerOverview.tsx`）"
  - "src/lib/ct-tower-overview.ts（新增：純函式解析，名稱可調）"
  - "src/lib/__tests__/ct-tower-overview.test.ts（新增）"
  - "src/components/__tests__/**（總覽元件測試，視需要）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/styles/** 或元件既有樣式檔（只在需要時）"
  - "electron/**（只在 renderer 讀不到 global config / 已安裝 CT 檔案、需要新增唯讀 IPC 時；沿用既有讀檔 handler 優先）"
  - "docs/agent-guide/ct-tower-overview.md（新增）、docs/agent-guide/README.md（索引）"
  - "CLAUDE.md（新增一節，3–12 行，依檔頭撰寫規則）"
  - _ct-workorders/T0701-delegate-ct-overview-tower-state-config.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 唯讀：總覽只讀檔，不得寫入 `_tower-state.md`、`_tower-config.yaml`、global config 或任何 CT 檔案；不得替 BAT 自己的 `_tower-state.md` 加摘要（那由 CT 塔台寫）。"
  - "🔴 不切 Markdown 章節（D184）：待辦與下一個編號只讀 frontmatter 摘要；沒有摘要就顯示提示，不得用標題比對去猜。「最後更新」是唯一例外（見要做的事 R1-2）。"
  - "🔴 Worker 不 push。非隔離工單，目前沒有其他 Worker。`Claude outputs/` 未追蹤資料夾不是你的，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。來源請求與 BMad-Guide repo、`~/.claude/skills/**` 只讀。回報與文件寫路徑時家目錄寫 `<使用者資料夾>`、截圖路徑寫 `<scratchpad>/…`（D176 / L175）。"
  - "🔴 renderer 日誌用 `window.electronAPI.debug.log`，electron 用 `logger`（CLAUDE.md「Logging」）；新 child_process 不需要（純讀檔）。新增 IPC 時遵守 CLAUDE.md「No Regressions Policy」並追蹤所有 consumer；遠端工作區（WSL / SSH / Docker）走既有的 proxied 讀檔路徑，不 fallback 本機。"
  - "🔴 yolo Worker：不得問使用者；範圍內的版面、文案、細節自己決定並在回報說明；真正需要決定的事依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。不得在任何地方寫出權杖值。"
---

# T0701 — DELEGATE：指揮塔「總覽」改成塔台狀態＋`*config`

## 目標

CT 塔台（BMad-Guide）請求：側欄「塔台 › 指揮塔 › 總覽」目前只認 `_ct-workorders/sprint-status.yaml`（`SprintDashboard.tsx`），沒有就只顯示「未找到 sprint-status.yaml」。CT v6 起只有 bmad 方法論的專案才有這個檔。改成：

- **R1 塔台最新狀態**
- **R2 `*config` 參數清單**：每個鍵的生效值與來源層
- **R3** 沒有 `sprint-status.yaml` 不擋總覽；有就另外顯示（現有 sprint 內容保留）
- **R4（附帶）** 查證並修正上方 `pending` 計數

## 規格層級自問（塔台）

- 中型 UI 功能，跨 renderer（可能加唯讀 IPC）。需求、資料來源、格式都已在本單與來源請求寫明，不另寫 spec；版面沿用 Control Tower 面板既有樣式。

## 要做的事

### R1 塔台最新狀態

1. **摘要（主要來源）**：讀 `_ct-workorders/_tower-state.md` 的 YAML frontmatter（檔案第一行是 `---`）。格式由 BAT 訂（D184），CT 之後會寫入：

   ```yaml
   ---
   schema_kind: tower-state
   summary_version: 1
   updated_at: "2026-10-25T19:17:48+0800"   # ISO 8601，含時區
   session: "第九十二 session"               # 選填，自由文字
   next_ids:                                 # 選填，開放 map：鍵與值都照原樣顯示
     workorder: T0701
     decision: D184
     bug: BUG-171
   todo:                                     # 選填，字串陣列，顯示前 5 則
     - "外部測試者A 驗收 BUG-165"
   ---
   ```

   - 只在 `schema_kind == tower-state` 且 `summary_version` 是整數 ≥ 1 時採用；未知鍵忽略；欄位缺少就不顯示那一項；YAML 解析失敗當作沒有摘要（記日誌，不丟例外）。
   - `summary_version` > 1 時照樣讀認得的欄位（向前相容）。
2. **沒有摘要時**：「最後更新」從檔案內第一個符合 `最後更新\s*[:：]\s*(.+)` 的行取出原文顯示（這是唯一允許的文字比對，取不到就顯示檔案修改時間並標明）；待辦與編號不顯示，改顯示一行提示「塔台狀態檔沒有機器可讀摘要，待辦與編號請開檔查看」（附開檔方式，沿用面板既有的開檔行為）。沒有 `_tower-state.md` → 這一區顯示「沒有塔台狀態檔」。
3. **進行中工單**：讀 `_ct-workorders/T*.md`（與既有計數同一份資料，不重複掃描）的 frontmatter，列 ID、標題、狀態。終態與非終態的分類以既有 BAT 程式碼為準；若沒有統一定義，依 CT `work-order-system.md` 定義一個共用函式並在回報列出分類表。

### R2 `*config` 參數清單

1. 三層，疊加順序 預設 → global → project（後者覆蓋前者）：
   - **預設**：已安裝 CT skill 的 `tower-config.md` § 可用選項 表（欄位：選項、有效值、預設、說明）。依序找 `~/.claude/skills/control-tower/references/tower-config.md`、`~/.codex/skills/control-tower/references/tower-config.md`；都沒有 → 預設層空白，畫面標示「找不到已安裝的 Control Tower，預設值未知」。鍵名去掉反引號。
   - **global**：`~/.claude/control-tower-data/config.yaml`，沒有時讀舊路徑 `~/.claude/control-tower-config.yaml`（新路徑優先）；兩個都沒有 → 該層空白。
   - **project**：`<工作區>/_ct-workorders/_tower-config.yaml`。
2. 列出三層讀到的**所有鍵的聯集**（不寫死清單；CT v6 預覽版會多 `methodology*` 等鍵），每列：鍵、生效值、來源（`project` / `global` / `預設`），可選擇顯示被覆蓋的下層值。只在 project / global 出現、預設表沒有的鍵照樣列出。
3. 畫面註明「不含塔台本次對話裡的臨時設定（session 層）」。
4. 重新整理：沿用面板既有的重新整理 / 檔案監看機制；驗收是改 `_tower-config.yaml` 某個值後重新整理，生效值與來源跟著變。
5. 遠端工作區：project 層照既有遠端讀檔路徑；global 與預設層讀「工作區所在主機」的家目錄做得到就做，做不到就標示「遠端工作區無法讀取 global／預設」，不得讀本機檔案冒充。回報說明實際行為。

### R3 sprint-status.yaml

- 總覽改為：塔台狀態 → `*config` →（有 `sprint-status.yaml` 才有的）sprint 區塊。沒有這個檔時不顯示「未找到 sprint-status.yaml」空狀態。
- 現有 sprint / Kanban / epic 功能在 bmad 專案的行為不變（No Regressions）。

### R4 pending 計數

- 查出上方 `active` / `pending` / `done` / `total` 的分類規則。CT 觀察：BMad-Guide 熱區沒有 `status: PENDING`，但有 10 份沒有 frontmatter `status` 的報告或舊格式檔（例 `T0022-research-report.md`）被算成 pending。
- 若屬實：沒有 `status` 的檔案不算 pending（另歸「無狀態」或排除，自己決定並說明）。修正後用 BMad-Guide `_ct-workorders/` 唯讀實測，回報修正前後的數字。

### 文件

- `docs/agent-guide/ct-tower-overview.md`：資料來源、摘要格式（上面的 YAML 是契約，CT 依此實作）、三層合併規則、遠端行為、已知限制、驗證清單；`docs/agent-guide/README.md` 加索引。
- `CLAUDE.md` 新增一節（3–12 行，依檔頭撰寫規則：用途、必守規則、唯一實作位置、連到 docs）。

## 驗證

- 解析邏輯寫成純函式（frontmatter 摘要、最後更新 fallback、config 三層合併、預設表解析、工單狀態分類），單元測試涵蓋：有 / 無 / 壞掉的摘要、`summary_version` 2、三層缺任一層、只在上層出現的鍵、無 `status` 的工單檔
- `npm run test:unit` 全過；`npm run typecheck` = 0；若改 `electron/**`，`npm run typecheck:electron` = 0；`npx vite build` 成功
- 實機（本機開發版或 build 後的 app，方法自選，不跑 Playwright e2e 套件）：
  - BAT 自己的工作區（有 `_tower-config.yaml`，`_tower-state.md` 沒有摘要）
  - BMad-Guide 工作區（唯讀；沒有 `sprint-status.yaml`）：不再出現「未找到 sprint-status.yaml」，pending 數字正確
  - 暫時在 scratchpad 複製一份含摘要的 `_tower-state.md` 驗證 R1 顯示（或用測試覆蓋，說明方式）；不得改真正的塔台檔案
  - 改 BAT `_tower-config.yaml` 一個值 → 重新整理 → 變化正確 → **改回原值**（確認 `git diff` 乾淨）
- 截圖（淺色 / 深色）放 scratchpad，回報附 `<scratchpad>/…` 路徑

## 驗收

- R1：有摘要時顯示最後更新、進行中工單、下一個編號、待辦（≤ 5）；沒有摘要時顯示最後更新、進行中工單與提示
- R2：所有鍵的生效值與來源正確，改值後重新整理會變
- R3：BMad-Guide 總覽不再出現「未找到 sprint-status.yaml」；bmad 專案 sprint 區塊照舊
- R4：pending 計數規則有結論，修正前後數字
- 測試、typecheck、build 全過；docs 與 CLAUDE.md 已更新
- commit（不 push），回報區附 SHA

## 塔台補充（2026-10-25 派工後，使用者要求）

### R5 資訊要跟著變化更新，不能停在第一次進入時

- 總覽所有區塊（R1 塔台狀態、R1 進行中工單、R2 config、R3 sprint、R4 計數）都要接到 `ControlTowerPanel.tsx` 既有的監看 / 重讀流程（`fs.watch(ctDirPath)` 觸發的重讀、`forceRefresh`）：`_tower-state.md`、`_tower-config.yaml`、`T*.md`、`sprint-status.yaml` 改了，總覽要自動更新，不必重新進入專案或切換工作區。不得只在掛載時讀一次。
- `_ct-workorders/` 以外的兩個來源（global config `~/.claude/control-tower-data/config.yaml` 與舊路徑、已安裝 CT 的 `tower-config.md`）不在既有監看範圍內：至少在「總覽變成可見時」與「按重新整理時」重讀；要另外監看這兩個檔案也可以，但不得為此監看整個 `~/.claude/`，也不得輪詢。實際做法寫在回報。
- 驗證加一項：BAT 開著總覽，用外部編輯器改 `_tower-config.yaml` 一個值（以及在 scratchpad 的含摘要 `_tower-state.md` 上改 `todo`，或以測試覆蓋）→ 不按任何按鈕，總覽在幾秒內更新 → 改回原值，`git diff` 乾淨。
- 收單時塔台會用 BMad-Guide 工作區驗 R1：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_tower-state.md` 已有 CT 寫入的真實摘要（契約 v1，CT D340），可直接拿來實測（唯讀）。CT 的慣例：`next_ids` 是「下一個可用編號」，`todo` 一律字串。

## 回報區

### 結果摘要

**DONE**。總覽改為「塔台狀態 → `*config` →（有 `sprint-status.yaml` 才有的）Sprint」，R1–R5 全部完成；測試、兩個 typecheck、build 全過；隔離實例實機驗證三個工作區（BAT、BMad-Guide、scratchpad）。

- product commit：`e7b20593`（不 push）
- 驗證時的程式碼與 `e7b20593` 內容相同（驗證跑在未提交的工作樹上，HEAD 當時為 `babab5d2`，提交後未再改產品檔）

### 落點檢查

- C-0 PASS：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`
- C-1 PASS（工單在 REPO_ROOT 下）；C-3 informational：`affects_files` 可測項目皆有既存祖先；C-2 無 `branch` 欄位
- 非隔離（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 做法與決定（範圍內自行決定）

**R1 塔台狀態**（`src/lib/ct-tower-overview.ts` `parseTowerState`）
- 摘要依契約 v1 讀 frontmatter；`schema_kind` 不是 `tower-state` 或 `summary_version` 不是整數 ≥ 1 → 當作沒有摘要；YAML 錯誤 → renderer 日誌 `[ct-overview] _tower-state.md summary ignored: …`，不丟例外。以 `CORE_SCHEMA` 解析，未加引號的時間不會被轉成 Date。
- 沒有摘要：「最後更新」取第一個 `最後更新\s*[:：]\s*(.+)` 行原文；取不到顯示檔案修改時間並加註；顯示「塔台狀態檔沒有機器可讀摘要，待辦與編號請開檔查看。」＋「📄 瀏覽檔案」（`openFileInFilesTab`）。沒有檔 →「沒有塔台狀態檔」。
- 待辦顯示前 5 則，多的顯示「還有 N 則，請開檔查看」。
- 進行中工單：沿用面板已載入的 `workOrders`。BAT 原本沒有統一的終態定義，新增共用函式 `workOrderPhase`：

| 狀態 | 分類 | 列在總覽 |
|---|---|---|
| PENDING / URGENT / IN_PROGRESS / BLOCKED / PARTIAL / INTERRUPTED / FAILED | open | ✅ |
| DONE / FIXED / ABANDONED（= 面板既有「完成」toast 的三種） | closed | — |
| INVALID（frontmatter 狀態不認得，例 `TODO`） | unknown | ✅（不默默藏起來） |
| UNKNOWN（完全沒有狀態的報告檔） | unknown | —（只計數） |

  FAILED / PARTIAL 列為 open：CT 封存最終態雖含這兩個，但仍需塔台覆核，總覽用途是提醒。

**R2 `*config`**（`parseTowerConfigDefaults` / `parseTowerConfigYaml` / `mergeTowerConfig`）
- 預設層：已安裝 CT `tower-config.md` § 可用選項 第一張表；global：新路徑優先、舊路徑備援；project：`_tower-config.yaml`。三層鍵的聯集，每列鍵 / 生效值 / 來源，勾「顯示被覆蓋的值」另列下層值；滑鼠停留顯示預設表的說明與有效值。
- CT 格式把鍵放在 `control-tower:` map 底下，BAT 自己的檔是平的 → 兩種都讀（同名時 map 優先）。
- global / 預設兩層在 renderer 的 `fs:readFile` 沙盒外，新增唯讀 proxied channel `ct:read-config-sources`（`electron/handlers/ct-config.ts`，main 與 headless 共用，不帶參數、路徑固定在回答主機的家目錄、512 KiB 上限）。已加入 `PROXIED_CHANNELS`、`PATH_FREE_CHANNELS`、`SERVER_PATH_RESULT_CHANNELS`；headless 由 `createHeadlessCtConfigModule` 註冊；preload `electronAPI.ctConfig.readSources`。helper 權杖預設拒絕（未加入 `HELPER_CHANNEL_ROLES`）。
- 畫面註明「磁碟上的生效值，不含塔台本次對話裡的臨時設定（session 層）。」

**R2-5 遠端工作區實際行為**：project 層走既有 `fs:readFile` proxied 路徑；global / 預設由視窗綁定的 bat-server 讀**遠端使用者**家目錄；遠端 bat-server 早於本單（`No handler for channel`）→ 兩層顯示「遠端工作區無法讀取 global／預設（遠端主機的 BAT 版本較舊）」，不 fallback 本機。遠端行為以單元測試（unsupported 訊息）與 headless parity 測試覆蓋，**未在真實遠端主機實測**。

**R3**：讀到 `sprint-status.yaml` 才在最後一區顯示 `📊 Sprint` + 原 `SprintDashboard`（內容不變）；沒有就不顯示任何空狀態。`SprintDashboard.tsx` 未改。

**R4 pending 計數（查證屬實）**
- 規則：上方計數 `active` = IN_PROGRESS + URGENT、`pending` = PENDING、`done` = DONE、`inactive` = ABANDONED、`total` = 熱區去重後的筆數。原因：legacy parser（沒有 frontmatter 的檔）找不到狀態時預設回 `PENDING`。
- 修正 1：找不到狀態 → 新狀態 `UNKNOWN`（`❔ No status`），計數另列 `N no status`，不算 pending、沒有「▶ 執行」按鈕。
- 修正 2（實測時發現）：BMad-Guide 有 8 組「工單＋同編號報告」（例 `T0177-report-workflow-fit-rules.md` 與 `T0177-workflow-fit-rules-p1.md`），既有同 ID 去重保留檔名排序在前的檔，5 張真正的工單被報告藏起來。改為同 ID 時有狀態的檔優先於 `UNKNOWN`。
- BMad-Guide `_ct-workorders/` 唯讀實測（隔離實例畫面）：

| | active | pending | done | no status | total |
|---|---|---|---|---|---|
| 修正前 | 4 | **9** | 165 | — | 180 |
| 修正後 | 4 | **0** | **170** | **4**（T0022、T0098、T0099、T0100） | 180 |

  修正前的數字以舊規則推得（無狀態檔被算成 pending，與 CT 截圖的 `9 pending` 一致）；`T0098` 的狀態寫在 blockquote（`> 狀態:✅ DONE`），legacy parser 讀不到，列為 no status（見後續建議）。

**R5 自動更新**
- `_tower-state.md`、`_tower-config.yaml` 由 `loadTowerOverview` 讀，接進既有 `reloadAll`（`fs.watch(ctDirPath)`、`.git` 監看、↻ 重新整理都會觸發）；`T*.md`、`sprint-status.yaml` 本來就在 `reloadAll`。
- global 與 `tower-config.md`：總覽變成可見時（切到總覽分頁、面板顯示、切換工作區）與按 ↻ 時重讀；不另外監看、不輪詢、不監看 `~/.claude/`。
- 切換工作區清空上一個工作區的總覽資料；過期的非同步結果丟棄（`isStale`）。
- 總覽元件只在總覽分頁顯示時掛載（它會重複列出工單標題，常駐掛載會讓既有測試的 `getByText` 找到兩個）。

**其他**：en 分頁名稱 `Sprint` → `Overview`（zh-TW / zh-CN 原本就是「總覽 / 总览」）；三個語系都加 `controlTower.overview.*`。

### 變更檔案（`e7b20593`）

- 新增：`src/lib/ct-tower-overview.ts`、`src/components/TowerOverview.tsx`、`src/types/ct-config-sources.ts`、`electron/handlers/ct-config.ts`、`docs/agent-guide/ct-tower-overview.md`、`src/lib/__tests__/ct-tower-overview.test.ts`、`src/components/__tests__/tower-overview.test.tsx`、`electron/__tests__/ct-config-sources.test.ts`
- 修改：`src/components/ControlTowerPanel.tsx`、`src/types/control-tower.ts`、`src/types/electron.d.ts`、`src/styles/control-tower.css`、`src/locales/{en,zh-TW,zh-CN}.json`、`electron/main.ts`、`electron/preload.ts`、`electron/remote/headless-entry.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`electron/remote/__tests__/path-aware-channels-coverage.test.ts`、`docs/agent-guide/README.md`、`CLAUDE.md`（新增「指揮塔總覽（T0701，D184）」節，6 行）

### 驗證

| 關卡 | 結果 |
|---|---|
| `npm run test:unit` | PASS：334 files、5953 passed / 3 skipped |
| 新測試 | `ct-tower-overview.test.ts` 43、`tower-overview.test.tsx` 14、`ct-config-sources.test.ts` 5（涵蓋：有 / 無 / 壞掉的摘要、`summary_version` 2、三層缺任一層、只在上層出現的鍵、無 `status` 的工單檔、同編號去重、遠端不支援、sprint 區塊有無、R5 監看觸發更新、可見 / 重新整理重讀） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | PASS（exit 0） |
| `npm run test:legacy` | 未跑（本單未列為關卡） |

**實機**（隔離實例：`npx vite build` 後以 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 啟動原始碼 build、獨立 userData，腳本在 scratchpad，未跑 e2e 套件；各工作區只開一般 shell 分頁）：
- BAT 工作區（`_tower-state.md` 無摘要）：最後更新取自正文那一行、提示與「瀏覽檔案」出現；進行中工單 T0701；config 列出 project 層的值（global：沒有檔案；預設：`<使用者資料夾>\.claude\skills\control-tower\references\tower-config.md`）；計數 `1 active / 214 done / 2 inactive / 222 total`。
- BMad-Guide 工作區（唯讀、沒有 `sprint-status.yaml`）：顯示 CT 寫入的真實摘要（最後更新、session、`workorder T0309` / `decision D344`、5 則待辦）、進行中 6 張（4 IN_PROGRESS + 2 PARTIAL）；不再出現「未找到 sprint-status.yaml」；計數見 R4 表。
- scratchpad 工作區（BMad-Guide 摘要複本 + CT 巢狀格式 config + 3 張假工單）：摘要、`auto-session: yolo` 來源 project、勾選後顯示「預設: ask」。
- R5：總覽開著，外部改 BAT `_tower-config.yaml` `verbose: on → off` → 不按按鈕 **621 ms** 內畫面變 `off`（來源 project）→ 寫回原內容 → 630 ms 內變回 `on`；改 scratchpad 摘要的 `todo` → 624 ms 內出現。之後 `git status` / `git diff -- _ct-workorders/_tower-config.yaml` 皆空。
- 截圖（深色）：`<scratchpad>/t0701-shots/bat-overview-dark.png`、`bmad-guide-overview-dark.png`、`bmad-guide-window-dark.png`、`scratch-overview-dark.png`、`bat-r5-verbose-off.png`、`scratch-r5-todo.png`、`scratch-overridden.png`
- **淺色截圖沒有**：BAT 介面目前只有深色主題（`settings.theme` 沒有任何 UI 效果，`setTheme` 無呼叫者、CSS 無淺色變數），無淺色畫面可截。
- bmad 專案 sprint 區塊：沒有可用的真實 bmad 工作區，以元件測試覆蓋（有 `sprint-status.yaml` → 顯示 `📊 Sprint` 與里程碑），未實機。

### 遭遇問題

- 無阻斷。實機腳本首次直接用 e2e 的 `testLogger`（需在 test runner 內）失敗，改用一般 console 記錄；第一次失敗留下的隔離 userData（`BetterAgentTerminal-runtime-e2e-t0701-…`，本單建立）已刪除。

### 偏離與範圍說明

- `src/types/control-tower.ts`（`UNKNOWN` 狀態）不在 `affects_files`，但 R4 修正必須改 parser；`electron/remote/{protocol,path-aware-channels,headless-entry}.ts`、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts` 屬「新增唯讀 IPC」的必要接線，`electron/remote/__tests__/path-aware-channels-coverage.test.ts` 為新 channel 的分類樣本。
- 同編號去重修正（R4 修正 2）是實測發現、直接影響本單計數，一併處理。
- `SprintDashboard.tsx` 未改（總覽只在有資料時渲染它）。

### 後續建議（給塔台）

1. legacy parser 讀不到 blockquote 形式的狀態（`> 狀態:✅ DONE`，BMad-Guide `T0098`），可補一種格式。
2. BAT frontmatter 狀態列舉沒有 CT 的 `PAUSED`；本單派工時的 `status: TODO` 也被判為 `INVALID`（會列在進行中、標 ⚠️ Invalid）。是否擴列舉或請 CT 塔台統一用 `PENDING`，由塔台決定。
3. 回覆 CT 塔台：契約 v1 已依格式實作；BMad-Guide 的真實摘要顯示正常；R4 結論（無狀態報告檔 + 同編號報告遮蔽工單）可轉告。

### 互動紀錄

- [--:--]（收到時間未記錄）塔台跨 session 訊息：新增「## 塔台補充」R5（總覽自動更新、外部兩層至少在可見與重新整理時重讀、驗證加一項、可用 BMad-Guide 真實摘要實測）→ Action：已重讀該節並照做（見 R5）。
- 無提問（未使用 `--ask`）。
