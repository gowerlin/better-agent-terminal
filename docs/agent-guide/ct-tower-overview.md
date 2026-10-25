# 指揮塔「總覽」：塔台狀態與 `*config`（T0701，D184）

> CLAUDE.md「指揮塔總覽（T0701，D184）」節的完整說明。CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。來源：BMad-Guide 塔台協作請求 `_request-2026-10-25-bat-overview-tower-state-config`（CT D338 / D340）。

## 用途

側欄「塔台 › 指揮塔 › 總覽」原本只認 `sprint-status.yaml`，沒有就只顯示「未找到 sprint-status.yaml」。CT v6 起只有 bmad 方法論的專案有這個檔。總覽改為依序顯示：

1. **塔台狀態**（R1）：最後更新、session、下一個編號、待辦（前 5 則）、進行中工單
2. **`*config` 參數**（R2）：每個鍵的生效值與來源層（`project` / `global` / `預設`）
3. **Sprint**（R3）：只有讀到 `sprint-status.yaml` 才顯示（內容沿用 `SprintDashboard`）；沒有時不顯示任何空狀態

## 必守規則

- 🔴 **唯讀**：總覽只讀檔，不寫 `_tower-state.md`、`_tower-config.yaml`、global config 或任何 CT 檔案；不替 `_tower-state.md` 加摘要（由 CT 塔台寫）。
- 🔴 **不切 Markdown 章節**（D184）：待辦與下一個編號只讀 frontmatter 摘要；沒有摘要就顯示提示，不用標題比對猜。「最後更新」是唯一的文字比對（見下）。
- 🔴 **遠端工作區不讀本機檔案冒充**：global / 預設兩層一律由視窗綁定的主機回答（`ct:read-config-sources` 是 proxied channel）；遠端 bat-server 沒有這個 handler 時顯示「遠端工作區無法讀取 global／預設」。
- 🔴 沒有 `status` 的工單檔不算 pending（R4，見下）。

## 唯一實作位置

| 項目 | 位置 |
|---|---|
| 解析（摘要、最後更新、預設表、config YAML、三層合併、工單分類） | `src/lib/ct-tower-overview.ts`（純函式，不讀檔） |
| 畫面 | `src/components/TowerOverview.tsx`（只在總覽分頁顯示時掛載） |
| 讀檔、監看、重新整理 | `src/components/ControlTowerPanel.tsx`（`loadTowerOverview`、`loadConfigSources`） |
| global / 預設兩層的讀檔 | `electron/handlers/ct-config.ts`（`ct:read-config-sources`，本機 main 與 headless 共用） |
| IPC 回傳型別 | `src/types/ct-config-sources.ts` |
| 無狀態工單、`PAUSED`、`TODO` 別名、引用區塊狀態 | `src/types/control-tower.ts`（`WorkOrderStatus` 的 `UNKNOWN` / `PAUSED`、`FRONTMATTER_STATUS_ALIASES`、`extractQuotedField`） |

## R1 塔台狀態

### 摘要格式（契約 v1，CT 依此寫入）

`_ct-workorders/_tower-state.md` 開頭的 YAML frontmatter（檔案第一行是 `---`）：

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

- 只在 `schema_kind == tower-state` 且 `summary_version` 是整數 ≥ 1 時採用。`summary_version` > 1 照樣讀認得的欄位（向前相容）。
- 未知鍵忽略；欄位缺少就不顯示那一項；`next_ids` 只收純量值（物件略過），`todo` 只收純量項目（空字串與物件略過）。
- YAML 以 `CORE_SCHEMA` 解析：不把未加引號的時間轉成 Date，`updated_at` 照原文顯示。
- 允許 UTF-8 BOM 與 CRLF。
- YAML 解析失敗或不符條件 → 當作沒有摘要，renderer 日誌記 `[ct-overview] _tower-state.md summary ignored: <原因>`，不丟例外。
- CT 慣例：`next_ids` 是「下一個可用編號」，`todo` 一律字串。

### 沒有摘要時

- 「最後更新」：檔案內第一個符合 `最後更新\s*[:：]\s*(.+)` 的行，取出原文（含 markdown 符號）；取不到 → 顯示檔案修改時間並加註「（檔案修改時間）」。
- 不顯示待辦與編號，改顯示「塔台狀態檔沒有機器可讀摘要，待辦與編號請開檔查看。」與「📄 瀏覽檔案」（`openFileInFilesTab`，同工單卡片的開檔行為）。
- 沒有 `_tower-state.md` → 「沒有塔台狀態檔」。讀不到（例如 > 512 KiB，`fs:readFile` 上限）→ 顯示讀取錯誤。

### 進行中工單

沿用面板已載入的 `workOrders`（與上方計數同一份資料，不另外掃描）。分類唯一實作 `workOrderPhase`：

| 狀態 | 分類 | 總覽列出 |
|---|---|---|
| `PENDING` `URGENT` `IN_PROGRESS` `BLOCKED` `PARTIAL` `INTERRUPTED` `PAUSED` `FAILED` | open | ✅ |
| `DONE` `FIXED` `ABANDONED` | closed（= 面板既有「完成」toast 的三種） | — |
| `INVALID`（frontmatter 狀態不認得，例 `CLOSED`） | unknown | ✅（不默默藏起來） |
| `UNKNOWN`（完全沒有狀態，報告檔） | unknown | —（只在上方計數顯示 `N no status`） |

`FAILED` / `PARTIAL` / `BLOCKED` 列為 open：CT 的封存最終態雖含 `FAILED` / `PARTIAL`，但它們仍需塔台覆核（重派或補正為 `DONE`），總覽的用途是提醒，所以列出。

### 狀態的讀法（T0702，D185）

唯一實作 `parseWorkOrder`（`src/types/control-tower.ts`）。

- **`PAUSED`**：CT `*pause` 把進行中的工單改成 `⏸ PAUSED`（`interrupt-protocol.md`），`*resume` 改回 `IN_PROGRESS`。BAT 列舉有這個狀態：徽章 `⏸ Paused`（`ct-status-paused`，與 `INTERRUPTED` 同色）、open、總覽列出；工單卡片有「🔧 補救結案」、沒有「▶ 執行」（同 `INTERRUPTED`）；看板歸 `BLOCKED` 欄；排序同 `INTERRUPTED`。上方計數**不算** `active` / `pending`（`active` 只算 `IN_PROGRESS` / `URGENT`，`pending` 只算 `PENDING`）：暫停的工單在等緊急工單做完，不是待派、也不是正在跑，與 `INTERRUPTED` / `BLOCKED` 一樣只出現在總覽與 `N total`。
- **`TODO` = `PENDING`**：frontmatter `status: TODO`（不分大小寫）讀成 `PENDING`，顯示、計數、「▶ 執行」都與 `PENDING` 相同，沒有 `unknown_status` 警告；body 寫 `PENDING` 不算 drift。別名表 `FRONTMATTER_STATUS_ALIASES`，只為相容已經寫成 `TODO` 的舊單，CT 範本與塔台開單一律寫 `PENDING`。legacy（無 frontmatter）檔不套用別名。
- **引用區塊形式的狀態**（legacy parser）：`> 狀態:✅ DONE`、`> 狀態：DONE`（行首一個或多個 `>`、半形 / 全形冒號、值前的 emoji 照舊由 `extractStatusKeyword` 略過）。實作 `extractQuotedField`，**只用於狀態**（工單編號、標題、時間欄位不讀引用區塊）。順序：列表 / 表格 / 粗體三種讀到的值有狀態關鍵字就用它；沒有（含被 `| AC | 狀態 | 落地位置 |` 這類表頭搶先匹配）才試引用區塊，再來才是 `status:` 行。`> 本報告的狀態:…`（`狀態` 不在引號後第一個字）、`> 狀態:草稿`（沒有關鍵字）、沒有 `>` 的 `狀態:DONE` 都不採用，所以報告檔維持 `UNKNOWN`。
- 盤點（2026-10-25，唯讀）：BAT `_ct-workorders/` 223 檔全部有 frontmatter；BMad-Guide `_ct-workorders/` 188 檔中 12 檔沒有 frontmatter，狀態寫法只有 `- **狀態**：✅ DONE`（既有支援）與 `> 狀態:✅ DONE`（`T0098`）；兩邊 frontmatter 都沒有 `TODO` / `PAUSED`。BMad-Guide 封存區另有 11 檔：10 檔 `> 狀態:✅ DONE`、1 檔 `> 狀態：DONE`（全形冒號）。

## R2 `*config` 三層

| 層 | 來源（依序找第一個存在的檔） | 讀取方式 |
|---|---|---|
| 預設（Layer 1） | `~/.claude/skills/control-tower/references/tower-config.md` → `~/.codex/skills/control-tower/references/tower-config.md` 的 § 可用選項 表 | `ct:read-config-sources` |
| global（Layer 2） | `~/.claude/control-tower-data/config.yaml` → 舊路徑 `~/.claude/control-tower-config.yaml`（新路徑優先） | `ct:read-config-sources` |
| project（Layer 3） | `<工作區>/_ct-workorders/_tower-config.yaml` | `fs:readFile`（既有沙盒與遠端路徑） |

- 疊加順序 預設 → global → project（後者覆蓋前者）；列出三層讀到的**所有鍵的聯集**（不寫死清單）。排序：預設表的順序，再接只在檔案出現的鍵（字母序）。每列：鍵、生效值、來源；勾「顯示被覆蓋的值」另列下層的值。滑鼠移到列上顯示預設表的說明與有效值。
- 預設表：只讀 `可用選項` 標題之後的第一張表，到下一個標題為止；鍵與值去掉反引號（`` `"chore: …"` `` → `"chore: …"`，`空` 照原文）。
- config YAML：CT 格式把鍵放在 `control-tower:` map 底下（`tower-config.md` § 持久化檔案格式），本 repo 的舊檔是平的。兩種都讀：先頂層鍵，再 `control-tower` map 的鍵（同名時 map 優先）。值的顯示：字串照原文、空字串 `""`、布林 / 數字照字面、map / list 以 JSON。
- 某層的檔案 YAML 錯誤 → 該層略過並在層狀態列顯示錯誤。
- 畫面註明「不含塔台本次對話裡的臨時設定（session 層）」：session 層只在塔台對話裡，磁碟上看不到。
- `ct:read-config-sources` 回傳 `{ homeDir, global, defaults }`，每層 `found`（`path` + `content`）/ `missing`（`tried`）/ `error`（`path` + `error`）。檔案不存在 → 試下一個；存在但讀不了（> 512 KiB、權限）→ 回 `error`，不退到下一個候選。不帶參數，路徑固定在 `homeDir` 底下，無法被指到別處。

## R3 sprint-status.yaml

`loadSprintStatus` 照舊（`getSprintYamlPaths` 的五個位置）。讀到 → 總覽最後一區顯示 `📊 Sprint` + `SprintDashboard`；讀不到 → 不顯示。Kanban / Epics / Workflow 分頁不變。

## R4 pending 計數

- 原因（查證屬實）：legacy parser（沒有 frontmatter 的檔）找不到任何狀態欄位時預設回 `PENDING`，報告檔（`T0022-research-report.md` 等）因此被算成 pending。
- 修正：找不到狀態 → `UNKNOWN`（`❔ No status`），上方計數另列 `N no status`，`pending` 只算 `PENDING`。工單卡片沒有「▶ 執行」按鈕（只給 `PENDING` / `URGENT`）。
- 同編號去重：`T0177-report-….md` 與 `T0177-….md` 同時存在時，既有去重保留檔名排序在前的檔，報告可能把真正的工單藏起來。修正：同 ID 時有狀態的檔優先於 `UNKNOWN`。
- BMad-Guide 實測（2026-10-25，唯讀）：修正前 `9 pending`（報告檔；另有 5 張工單被同編號報告藏起來）；修正後 `0 pending`、`9 no status` → 去重修正後 `4 no status`，`done` 多 5。
- T0702 實測（2026-10-25，唯讀，以面板同一套 parser + 去重計數）：BMad-Guide `_ct-workorders/` `done 171 / no status 4` → `done 172 / no status 3`（`T0098` `UNKNOWN` → `DONE`，其餘 `active 3`、`pending 0` 不變）；BAT `_ct-workorders/` 前後相同（`active 1`、`done 215`、`inactive 2`）。封存區（勾「含封存」時）BMad-Guide `done 129 / no status 11` → `done 140 / no status 0`；BAT 封存區不變。改變的只有寫成引用區塊狀態的 12 檔，報告檔全部維持 `UNKNOWN`。

## R5 自動更新

| 來源 | 什麼時候重讀 |
|---|---|
| `_tower-state.md`、`_tower-config.yaml`、`T*.md`、`sprint-status.yaml`（`_ct-workorders/` 內） | 既有 `fs.watch(ctDirPath)`（recursive，500 ms debounce）觸發的 `reloadAll`；`.git` 監看觸發的 `reloadAll`；↻ 重新整理 |
| global config、已安裝 CT 的 `tower-config.md`（`_ct-workorders/` 外） | 總覽變成可見時（切到總覽分頁、面板顯示、切換工作區）與 ↻ 重新整理。不另外監看、不輪詢、不監看整個 `~/.claude/` |

切換工作區時清空上一個工作區的總覽資料；非同步讀取結果屬於已離開的工作區時丟棄（`isStale`，同 BUG-127）。

## 遠端工作區（WSL / SSH / Docker）

- project 層：既有 `fs:readFile` proxied 路徑（遠端主機的檔案）。
- global / 預設：`ct:read-config-sources` proxied 到視窗綁定的 bat-server，讀**遠端使用者**的家目錄（headless `createHeadlessCtConfigModule`，`host.homeDir` = `os.homedir()`）。遠端沒有安裝 CT → 「找不到已安裝的 Control Tower，預設值未知」。
- 遠端 bat-server 早於 T0701（沒有 handler，`No handler for channel: ct:read-config-sources`）→ 兩層都顯示「遠端工作區無法讀取 global／預設（遠端主機的 BAT 版本較舊）」，不 fallback 本機。沒有 live 連線 → proxied IPC 照既有規則拒絕，顯示讀取錯誤。
- channel 分類：`PROXIED_CHANNELS`、`PATH_FREE_CHANNELS`（無參數）、`SERVER_PATH_RESULT_CHANNELS`（回傳的檔案路徑只供顯示，維持 server 形式）。

## 已知限制

- global / 預設兩層不監看：在 BAT 外改 global config 或升級 CT 後，要切回總覽或按 ↻ 才會更新。
- 引用區塊狀態（T0702）只支援盤點到的格式：引號後直接是 `狀態`（不含粗體，粗體 `> **狀態**：` 原本就由粗體規則讀到）；legacy 檔的其他欄位（工單編號、時間）寫在引用區塊時仍讀不到。
- 不在 BAT frontmatter 列舉內、也不是別名的狀態（例 BAT 封存區 3 檔的 `CLOSED`）仍顯示為 `⚠️ Invalid`（列在進行中工單，勾「含封存」才會看到封存的）。
- BAT 介面目前只有深色主題（`settings.theme` 沒有 UI 效果），沒有淺色畫面可驗。

## 驗證清單

- 單元測試：`src/lib/__tests__/ct-tower-overview.test.ts`（摘要有 / 無 / 壞掉、`summary_version` 2、各種不合格的版本與 kind、最後更新 fallback、預設表、config 平 / 巢狀 / 壞掉、三層缺任一層、只在上層出現的鍵、工單分類、無 `status` 的工單檔；T0702：BMad-Guide `T0098` / `T0099-audit-report` 檔頭原文、引用區塊各寫法、報告檔仍 `UNKNOWN`、表頭搶先匹配、`PAUSED`、`TODO` 別名與 drift）；`src/components/__tests__/tower-overview.test.tsx`（畫面各狀態、R4 計數與同編號去重、T0702 計數 / 徽章 / 按鈕 / 總覽列出、R2 來源與被覆蓋值、遠端不支援、R3 sprint 區塊、R5 監看觸發更新與可見 / 重新整理重讀）；`electron/__tests__/ct-config-sources.test.ts`（候選順序、新路徑優先、過大檔案、註冊）；`electron/remote/__tests__/path-aware-channels-coverage.test.ts`、`headless-parity.test.ts`（channel 分類與 headless 註冊）。
- 實機（T0701 以隔離實例執行，見工單回報區）：BAT 工作區（沒有摘要）、BMad-Guide（有摘要、沒有 sprint-status.yaml）、scratchpad 工作區（摘要 + 巢狀 config）；外部改 `_tower-config.yaml` / 摘要 `todo` → 不按按鈕約 0.6 s 內更新 → 改回原值，`git diff` 乾淨。
