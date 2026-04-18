# T0194 — BUG-044/045 CT Panel 封存 + Sync Parser 盤點（研究型）

## 元資料
- **編號**:T0194
- **類型**:research（研究型工單）
- **狀態**:DONE
- **開始時間**:2026-04-19 00:41 (UTC+8)
- **完成時間**:2026-04-19 00:52 (UTC+8)
- **commit**:de40ecf
- **優先級**:🟢 Low
- **關聯**:BUG-044、BUG-045（姊妹單,本張研究產出 T0195 實作單）
- **派發時間**:2026-04-19 00:19 (UTC+8)
- **預估工時**:30-45 min（純盤點 + 讀檔,不改 code）
- **Renew 次數**:0
- **互動規則**:**降級為不互動**（原為 `research_interaction: true` 允許,但 BUG-046 阻擋 `--interactive` 派發,改 `--no-interactive`。Worker 若需要釐清請 `*pause` 回報塔台）
- **YOLO mode**:on（`--mode yolo`,Worker 自動送出完成訊息；塔台自主決策下一張）
- **降級紀錄**:首次 `--interactive` 派發 16:24:48 / 16:27:42 兩次失敗 → 觸發建立 BUG-046 → 改 `--no-interactive` 仍失敗 → BUG-046 升 🔴 + 改用「使用者手動開新終端」派發

## 塔台決策背景（對齊結論）

- **Q1.A**:BUG-044 + BUG-045 拆兩張 BUG,但修復路徑共用（本張統一研究,T0195 可能合併實作）
- **Q4.C**:根因不明,塔台順便調查 — 使用者補充「`archive_days=1` 也不會封存」,強烈指向 parser/archive 邏輯 bug 而非天數閾值
- **Q5.A**:立即派,YOLO 順便觀察 BUG-043（Worker YOLO 偶發失效）是否再現

## 目標

產出 BUG-044 + BUG-045 根因的**精確定位報告**,讓塔台能決定 T0195 是單張實作或拆多張。

## 四個子問題（必須全部回答）

### Q1：CT Panel「包含封存」toggle 接線盤點（BUG-044）

- Bug Tracker tab 與 Backlog tab 的「包含封存」checkbox 實作在哪個檔案?
- State 名稱?（如 `includeArchived` / `showArchived` / `includeCold`）
- State 從 checkbox → 讀檔函式的傳遞鏈是否完整?
- 讀檔函式是否接受該 param?行為是什麼?
- `_archive/bugs/**` 與 `_archive/plans/**` 是否有被 Glob?

**交付**:
- 檔案路徑 + 行號(精確)
- 接線鏈路圖(文字 ASCII 或條列)
- 斷點定位(哪一環沒接上)

### Q2：PLAN metadata 格式差異盤點(BUG-045 核心)

**對照樣本**(使用者截圖證據):
| PLAN | CT Panel 顯示 | 期望 |
|------|-------------|------|
| PLAN-012 | High / Done ✓ | parser OK |
| PLAN-003 | **Unknown** / Done | parser 失敗 |
| PLAN-005 | **Unknown** / Done | parser 失敗 |
| PLAN-016 | **Unknown** / Done | parser 失敗 |
| PLAN-019 | Low / 💡 **Idea** | 狀態解析錯誤(本 session 剛 DONE) |

**交付**:
- Worker 必須 `Read` PLAN-003 / PLAN-005 / PLAN-012 / PLAN-016 / PLAN-019 五個檔案的元資料區(通常是 metadata 表或 frontmatter)
- 以表格對比「欄位名稱」「值格式」「語法結構」三個維度的差異
- 指出為何 PLAN-012 能解析、為何其他三張解析成 Unknown
- 指出為何 PLAN-019 剛 DONE 還被 UI 顯示成 IDEA(本 session 剛改,`*sync` 有沒有執行過?重建 `_backlog.md` 的時機?)

### Q3：Parser 實作位置與容錯度

- `*sync` 重建 `_backlog.md` 的 parser 在哪?(推測:`~/.claude/skills/control-tower/references/` 或專案內 CT Panel 元件內有獨立一份)
- Parser 如何抽取「優先級」「狀態」欄位?(regex / markdown AST / 字串比對)
- 遇到不認識的格式時,行為是什麼?(silent fail 成 Unknown / throw / warn log)
- 是否有 warn log 可以幫 debug?

**交付**:
- Parser 函式 + 檔案路徑 + 行號
- 解析邏輯摘要(10 行內)
- 容錯度評估(僵 / 中 / 寬容)

### Q4：`*archive` 是否涵蓋 PLAN + 判定邏輯

- `*archive` 命令是否有 PLAN 的歸檔分支?(vs BUG-### / T####)
- 候選篩選條件是什麼?(狀態 = DONE or DROPPED?時間超過 `archive_days`?活躍引用豁免?)
- 使用者關鍵線索:`archive_days=1` 時 PLAN-003/005/012/016(明顯超過 1 天的 DONE)沒被歸檔 → 候選篩選是否讀得到狀態?
- 可能假設:狀態解析失敗 → 歸檔邏輯看不到 DONE → 跳過候選

**交付**:
- `*archive` 的 PLAN 分支實作位置(若有)或確認「未涵蓋 PLAN」
- 候選篩選條件的具體實作(程式碼片段)
- 判定為何 PLAN-003/005/012/016 沒被列為候選(基於 Q2/Q3 結論推論)

## 執行步驟建議

### Step 1:盤點熱點檔案(<10 min)

```bash
# 找 CT Panel 元件
grep -r "includeArchived\|showArchived" src/components/ --include="*.tsx"

# 找 *sync 相關檔案
grep -r "rebuild.*backlog\|parse.*PLAN\|priority.*unknown" src/ electron/ --include="*.ts" -i

# 找 archive 實作
grep -r "archive_days\|archive.*candidate" src/ electron/ --include="*.ts"
```

### Step 2:讀 PLAN metadata 樣本(<10 min)

Read 下列五個檔案的**前 30 行**(通常包含元資料區):
- `_ct-workorders/PLAN-003-npm-audit-remaining-vulnerabilities.md`
- `_ct-workorders/PLAN-005-electron-builder-upgrade.md`
- `_ct-workorders/PLAN-012-quit-dialog-terminal-server-checkbox.md`
- `_ct-workorders/PLAN-016-electron-runtime-upgrade-28-to-41.md`
- `_ct-workorders/PLAN-019-typescript-debt-cleanup.md`

對比差異表格產出。

### Step 3:讀 parser + archive 實作(<15 min)

從 Step 1 的 grep 結果切入,追蹤呼叫鏈。

### Step 4:產出拆單建議(<10 min)

寫入**區段 D**(下方),提出 T0195 實作工單的拆法:
- `[A]` 單張 T0195:parser 容錯 + archive PLAN 支援 + UI toggle(若三個範圍都 trivial)
- `[B]` 拆兩張:T0195 parser+archive(BUG-045)、T0196 UI toggle(BUG-044)
- `[C]` 拆三張:parser / archive / UI 各一張

## 回報區(Worker 填寫)

### A. 盤點結果

**CT Panel toggle 接線**（BUG-044）：

*UI 元件（toggle 視覺層）*：
- `src/components/BugTrackerView.tsx:24,31,85` — state `showArchived`, filter `if (!showArchived && b.isArchived) return false`
- `src/components/BacklogView.tsx:22,27,88` — state `showArchived`, filter `if (!showArchived && e.isArchived) return false`

*資料載入層*：
- `src/components/ControlTowerPanel.tsx:167-177` `loadBugs()` — 只讀 `${ctDirPath}/_bug-tracker.md`，丟給 `parseBugTracker()`
- `src/components/ControlTowerPanel.tsx:180-208` `loadBacklog()` — 只讀 `${ctDirPath}/_backlog.md`，丟給 `parseBacklog()`
- `src/components/ControlTowerPanel.tsx:656,660` — `<BugTrackerView bugs={bugEntries} ... />` / `<BacklogView entries={backlogEntries} ... />`

*Parser 判斷 isArchived*：
- `src/types/bug-tracker.ts:127` `isArchived = linkPath.includes('_archive/')`
- `src/types/backlog.ts:117` `isArchived = linkPath.includes('_archive/')`

*對照：Workorder tab 的正確實作（可當 fix 範本）*：
- `ControlTowerPanel.tsx:63` state `showArchivedOrders`
- `ControlTowerPanel.tsx:226-244` `loadArchivedOrders()` — 讀 `${workspaceFolderPath}/_ct-workorders/_archive/workorders/` 全部 .md，set `isArchived: true`
- `ControlTowerPanel.tsx:349,417` — 當 `showArchivedOrders` toggle ON，合併 `[...workOrders, ...archivedOrders]`

*接線鏈路圖*：
```
[User checks 「包含封存」]
     ↓
[BugTrackerView/BacklogView setShowArchived(true)]
     ↓
[filter: if (!showArchived && isArchived) return false]  ← filter OK
     ↓
[但 bugs/entries 陣列來自 loadBugs/loadBacklog，只讀 _bug-tracker.md / _backlog.md]
     ↓
[_bug-tracker.md / _backlog.md 只列熱區單據（歸檔已 git mv 到 _archive/bugs|plans/），linkPath 絕不含 '_archive/']
     ↓
[parser 產出的 entries 裡 isArchived 永遠 false]
     ↓
[filter 永遠不會丟掉任何東西 → toggle 無視覺變化 = NO-OP]
```

*斷點定位*：`loadBugs()` 與 `loadBacklog()` **沒有對應 `loadArchivedBugs()` / `loadArchivedBacklog()`**，即沒讀 `_archive/bugs/**.md` 與 `_archive/plans/**.md`。Workorder tab 有這個機制（`loadArchivedOrders`），Bug/Backlog 兩 tab 漏做。

**PLAN metadata 差異表**（BUG-045 核心）：

| PLAN | 元資料結構 | 「優先級」格式（實際內容） | 「狀態」格式 | parser 解析結果 |
|------|---------|------------------------|-------------|--------------|
| PLAN-003 | Markdown table (`\| 欄位 \| 內容 \|`) | `\| **優先級** \| 🟢 Low（13 漏洞...） \|` | `\| **狀態** \| ✅ DONE（...） \|` | ✗ Unknown（regex 不認 `\|`） |
| PLAN-005 | Markdown table | `\| **優先級** \| 🟢 Low \|` | `\| **狀態** \| ✅ DONE（...） \|` | ✗ Unknown |
| PLAN-012 | **Bullet list** (`- **key**：val`) | `- **優先級**：🔴 High` | `- **狀態**：✅ DONE` | ✓ High |
| PLAN-016 | Markdown table | `\| **優先級** \| 🔴 High \|` | `\| **狀態** \| ✅ DONE（...） \|` | ✗ Unknown |
| PLAN-019 | **Bullet list** | `- **優先級**：🟢 Low` | `- **狀態**：DONE` | ✓ Low（但 UI 顯 IDEA — 見下） |

*PLAN-019 顯示 IDEA 原因*：`_backlog.md` 檔頭「最後更新:2026-04-18 21:50」早於 PLAN-019 DONE 時間 23:30（見 PLAN-019 元資料）。`_backlog.md:27` 仍標 `| PLAN-019 | ... | 🟢 Low | 💡 IDEA | [詳細](...) |`。`parseBacklog` 的 `rowStatusToStatus` 讀 Active section row 內「狀態」cell `💡 IDEA`，優先於 section heading，正確輸出 IDEA。**這不是 parser bug，是 `_backlog.md` 資料過期（`*sync` 未於本 session 跑）**。

**Parser 實作**：

*位置*：
- `src/types/backlog.ts:58-62` `extractPriorityFromPlanContent(content)` — fallback 用，讀 PLAN 檔內文
- `src/types/backlog.ts:45-51` `extractPriority(cell)` — 給 `_backlog.md` 表格 cell 用
- `src/types/backlog.ts:90-141` `parseBacklog(content)` — 主入口
- `src/types/backlog.ts:74-83` `rowStatusToStatus(cell)` — row 層狀態解析
- `src/types/backlog.ts:64-71` `sectionToStatus(heading)` — section heading 狀態解析

*邏輯摘要*（兩層 fallback）：
1. 先從 `_backlog.md` row 取 `優先級` cell → `extractPriority()` regex match `HIGH|MEDIUM|LOW`
2. 若 cell 為空或不含關鍵字 → `Unknown`
3. ControlTowerPanel `loadBacklog()` 發現 priority==='Unknown' 且有 linkPath → 讀 PLAN 檔內文 → `extractPriorityFromPlanContent()` 用 regex `/(?:優先級|Priority)[^\n]*?[:：]\s*([^\n]+)/i` → 再 `extractPriority()`

*容錯度評估*：**中度偏僵**。`extractPriorityFromPlanContent` 的 regex **只認 `：` 或 `:` 作為 key-value 分隔符，完全不處理 Markdown table 的 `|` 分隔符**。這直接解釋 PLAN-003/005/016（table 格式）為何 fallback 失敗，而 PLAN-012/019（bullet list）為何 OK。

**`*archive` PLAN 支援**：

*是否有*：`*archive` 是 CT **skill 指令**（塔台 AI 執行），非程式碼邏輯。`~/.claude/skills/control-tower/references/archive-system.md:54, 232` 明文「PLAN-### 支援 DONE/DROPPED 歸檔」+「`_backlog.md` ✅ 掃描（若啟用）」。

*候選篩選條件*（依 `archive-system.md`）：
1. 狀態為最終態（PLAN: DONE/DROPPED；BUG: CLOSED/WONTFIX；工單: DONE/FIXED/BLOCKED/INTERRUPTED/FAILED）
2. 最後變更時間超過 `archive_days` 天
3. 活躍單據不引用此候選（grep 豁免）

*為何 PLAN-003/005/016 沒被列為候選*：

證據鏈：
- `_tower-state.md:1128` 明確記錄 2026-04-18 16:45 `*archive --dry-run` 測試結果「**3 張候選（T0149/T0150/BUG-034）**→ 執行 → 全數觸發活躍引用豁免還原」——**零 PLAN 候選**。
- 當時 `archive_days=1`，PLAN-003/005/016（05:25-05:30 DONE，至 16:45 已 ~11 小時）**已超過 1 天門檻**（1 天 ≈ 24h，但記錄中塔台實際挑了 T0149/T0150 為候選，那兩張也在同日稍早完成，代表塔台用的門檻可能 ≤ 12h 或以「過夜」為判斷基準）。
- 即使以寬鬆「過夜」門檻判斷，也不應讓 PLAN-003/005/016 免於至少 dry-run 列入候選。

根因（高信心推論，需 T0195 塔台驗證）：
- **塔台 skill 實務沒掃 PLAN 歸檔分支**，或讀 `_backlog.md` 的 Completed 表時因其缺「狀態」欄位（`_backlog.md:31-36` 只有 `ID/標題/完成時間/連結` 4 欄，沒有「狀態」欄）而無法判定最終態。
- 次因：`archive-system.md:232` 寫「若啟用」— 可能塔台 skill 有 feature flag / 條件式分支，目前關閉。
- PLAN-012 同時被 PLAN-014 🟡 PLANNED 引用（`_backlog.md:13` 明確記載），即使掃到也會觸發活躍引用豁免。但這不解釋 003/005/016。

### B. 根因結論

- **BUG-044 根因**：`ControlTowerPanel.tsx` 的 `loadBugs()` / `loadBacklog()` **沒有讀取 `_archive/bugs/**` 與 `_archive/plans/**`**。資料源從未注入歸檔項目 → `isArchived` 恆 false → toggle UI 可打勾但 filter 永遠沒東西要 filter → no-op。
- **BUG-045 根因 (parser)**：`extractPriorityFromPlanContent()` 的 regex (`/(?:優先級|Priority)[^\n]*?[:：]\s*([^\n]+)/i`) **只匹配 bullet list 冒號格式**，Markdown table 格式（PLAN-003/005/016 使用的 `| **優先級** | 🟢 Low |`）的 pipe 分隔符不含冒號 → regex 無法捕獲 → 永遠 Unknown。
- **BUG-045 根因 (archive)**：`*archive` 是塔台 skill 行為，無 code 證據但 `_tower-state.md:1128` 實測證據顯示 **PLAN 從未被列入候選**。推測塔台 skill 掃描邏輯未實作 PLAN 分支 / 未讀各 PLAN 檔案 metadata，或讀 `_backlog.md` Completed 表時因缺「狀態」欄位無法判定。
- **PLAN-019 顯示 IDEA**（非 bug）：`_backlog.md` 尚未 `*sync` 重建，Active 表格 row 的「狀態」cell 仍為 `💡 IDEA`，parser 正確讀出 IDEA。跑一次 `*sync` 即可修復。

### C. 修復範圍評估

- **Parser 容錯修改**（`extractPriorityFromPlanContent`）：~10-15 行，**複雜度 trivial**。只要在現有 regex 之外再加一個 table 格式 regex（如 `/\|\s*\*\*(?:優先級|Priority)\*\*\s*\|\s*([^\|\n]+?)\s*\|/i`）或改 regex 允許 `|` 分隔符。順便建議對 `extractStatusFromPlanContent`（目前 parser 沒實作此 fallback，PLAN-019 IDEA 問題自然由 `*sync` 修復，暫可不做）評估是否需要對稱補齊。
- **UI toggle 接線**（BUG-044 fix）：~40-60 行，**複雜度 low**。照抄 `loadArchivedOrders` 模式（`ControlTowerPanel.tsx:226-244`）寫 `loadArchivedBugs` / `loadArchivedBacklog`，useEffect 在 toggle ON 時觸發，把結果併入 bugs/entries 傳給子元件；子元件 filter 已就緒（`b.isArchived`/`e.isArchived` filter 已存在）。需注意：
  - Bug/Backlog 目前是從 `_bug-tracker.md` / `_backlog.md` 讀表格，歸檔後單據**不在這兩份索引內**，得改 glob `_archive/bugs/*.md` 與 `_archive/plans/*.md` 逐檔 parse。
  - 缺少 `parseBugFile(content)` / `parsePlanFile(content)` 類的單檔 parser（只有 `parseBugTracker`/`parseBacklog` 吃表格索引）。所以除了 loader，要新增單檔 parser（~20-30 行）。
  - 或改為：歸檔時保留一份 `_archive/_bugs-archive.md` / `_archive/_plans-archive.md` 索引表（塔台 skill 端產出），UI 直接讀表 — 但這屬於 `*archive` skill 修改，不是 UI 修改。
- **`*archive` PLAN 支援補齊**：**不是 code 工單**，是塔台 skill 修改。`~/.claude/skills/control-tower/` 可能需補 PLAN 分支處理或「歸檔時更新 `_backlog.md` Completed 表為 `_archive/` 連結」（維持 UI linkPath 含 `_archive/` 判定）。複雜度：**med**，需規格演進。不建議併入 T0195 程式碼工單。

### D. T0195 拆單建議

**建議選項**：**[B] 拆兩張**

**理由**：
1. **Parser 容錯（BUG-045 parser 面）**：純 TypeScript，trivial，~15 行 regex 補強。可獨立測試（喂 5 張 PLAN 字串斷言 priority）。
2. **UI toggle 接線（BUG-044）**：React + Electron fs API，low-med 複雜度（含新 loader + 單檔 parser + useEffect 觸發）。獨立於 parser 修復，可平行開發但測試面更大（需 E2E 或手動驗收 UI）。
3. **Archive PLAN 支援（BUG-045 archive 面）**：**非 code 工單**，屬塔台 skill 演進，應另走 skill 工單流程（開 Global Learning / skill RFC），不併入 BAT 程式碼 PR。建議本 BUG-045 closed 時記錄「archive 面留待 CT skill v4.4 / v5.0 規格演進」。
4. **原則**：避免把 UI loader（I/O 驅動，需驗收）和純函數 parser（可單測）綁在一張工單，降低 commit 原子性與回滾粒度。

**各子任務估時**：

| 子任務 | 工單 | 預估 | 複雜度 | 依賴 |
|-------|------|------|-------|------|
| Parser regex 補 table 格式 + 單元測試 | T0195 | 20-30 min | trivial | 無（純 ts） |
| 新增 `parseBugFile` / `parsePlanFile` 單檔 parser | T0196 | 30-45 min | low | 無 |
| 新增 `loadArchivedBugs` / `loadArchivedBacklog` + useEffect | T0196 | 45-60 min | low | 單檔 parser |
| UI 整合（合併 bugs + archivedBugs，entries + archivedEntries） | T0196 | 30 min | low | loader |
| 手動驗收（勾 toggle 看到 BUG-001..26 / PLAN-006/008/010/011） | T0196 | 15 min | trivial | 全部整合完 |
| **Archive PLAN 支援（skill 面，塔台規格演進）** | 獨立 | — | med（非 code） | T0195 完成後再議 |

**合併 T0195 總估時**：20-30 min（parser only）
**T0196 總估時**：2-2.5h（UI archive 整合）

### E. YOLO 觀察（BUG-043 追蹤樣本）

- **Step 0 banner**：**未顯示 🚨 YOLO MODE ACTIVE banner**。偵測到 `BAT_SESSION=1` 但 `CT_MODE` env 未設 → 顯示**降級為 ask 模式提示**（符合 ct-exec v4.3.0 規格 Step 0 的「BAT + CT_MODE 未設/不合法」分支）。
- **工單頭部 `YOLO mode: on` vs env `CT_MODE` 未設矛盾**：工單元資料聲稱 `YOLO mode: on` 且由 `--mode yolo` 派發，但 Worker 收到的 env **沒有 `CT_MODE`**。這**再現 BUG-043 現象**：塔台派發（`bat-terminal.mjs`）未正確注入 `CT_MODE` env 變數。BUG-041 Phase 2.3 已指出 env 應由塔台顯式傳遞，此次派發疑似在 shell 引號／spawn args 處理環節失落。
- **互動分支**：工單元資料第 12 行「降級為不互動」（且 `CT_INTERACTIVE` env 亦未設，BUG-046 連鎖效應），執行全程純研究無 AskUserQuestion 互動 → 研究模式互動分支未被觸發，無法驗證 `--interactive` flag 是否生效。
- **建議**：BUG-043 根因再現樣本已齊備，需配合 T0192/T0193 的 `bat-scripts.log` 診斷輸出比對「派發時 spawn 呼叫 args」是否含 `CT_MODE=yolo` env 注入。本樣本可 grep `reusedExisting` 關鍵字對照先前 T0192 假說。

### F. 交付物清單(自檢)

- [x] Q1 CT Panel toggle 接線 — 完整回答（UI / loader / parser 三層鏈路 + 對照 Workorder tab 正確實作）
- [x] Q2 PLAN metadata 差異表 — 5 張 PLAN 全部對比（含為何 012/019 通過、003/005/016 失敗）
- [x] Q3 Parser 實作位置 + 容錯度評估（`src/types/backlog.ts` 五個函式、regex 僵於 `：` 分隔符）
- [x] Q4 `*archive` PLAN 支援判定（skill 層，非 code；`_tower-state.md:1128` 證據）
- [x] 區段 D 拆單建議含理由 + 估時（建議 [B] 拆兩張，archive 面另走 skill 演進）
- [x] 區段 E YOLO banner 觀察（未顯示 banner，降級 ask + BUG-043 再現確認）
- [x] 無任何 code 修改（本張純研究，僅 Edit 本工單回報區與元資料區）

### G. 產出摘要

- **檔案修改**：僅 `_ct-workorders/T0194-research-bug-044-045-ct-panel-archive-parser.md`（元資料區 + 回報區）
- **commit**：待 Step 8 反序寫入後 commit（type: `docs`，scope: `ct`）
- **新工單建議**：T0195（parser 容錯，trivial，20-30 min）、T0196（UI archive 整合，low，2-2.5h）；archive skill 面留 BUG-045 半閉環 + skill 演進記錄

### H. 互動紀錄

無（研究模式降級為不互動，執行全程未向使用者提問）

### I. 遭遇問題

無

### J. Renew 歷程

無

### K. 回報時間

2026-04-19 00:52 (UTC+8)

## 備註

- **研究工單規模爆擊警示**(L070 呼應):若 grep 結果超乎預期龐大,立即 `*pause` 回報,不要硬吃
- **互動許可**:允許一次最多 3 個澄清問題,優先用於格式確認或實作位置找不到時
- **禁止修改**:本張不動任何 code,不跑 `*sync` / `*archive`
- **預計後續**:基於本張 D 區段,塔台 YOLO 派發 T0195(實作)。若 BUG-043 再現 → 立即 grep `reusedExisting` 樣本
