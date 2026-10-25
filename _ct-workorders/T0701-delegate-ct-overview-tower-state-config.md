---
schema_version: 1
schema_kind: workorder
id: T0701
title: "DELEGATE（CT 塔台請求）：指揮塔「總覽」顯示塔台最新狀態與 `*config` 生效值＋來源，沒有 sprint-status.yaml 不擋；查證 pending 計數（D184）"
type: delegate
status: TODO
repo: better-agent-terminal
project: "Control Tower 面板＋跨專案請求"
priority: P2
sizing: M
created_at: "2026-10-25T19:17:48+0800"
started_at: ""
updated_at: "2026-10-25T19:17:48+0800"
completed_at: ""
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

## 回報區

（Worker 填寫）
