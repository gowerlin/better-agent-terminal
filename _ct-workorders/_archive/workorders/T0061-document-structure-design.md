# 工單 T0061-document-structure-design

## 元資料
- **工單編號**：T0061
- **任務名稱**：單據結構設計 — 讀 BMad-Control-Tower 風格 + 定義 BUG/PLAN/Decision 模板
- **狀態**：DONE
- **建立時間**：2026-04-12 20:42 (UTC+8)
- **開始時間**：2026-04-12 20:45 (UTC+8)
- **完成時間**：2026-04-12 20:50 (UTC+8)

## ⚠️ 本工單為研究類 — 不做程式碼修改（GP005）

產出為格式設計文件，塔台根據設計決定 T0062 遷移方案。

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需讀取 BMad-Control-Tower 參考 + 現有工單格式）

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### 背景

`_tower-state.md` 承載過多（2400+ 行），需拆分為獨立單據系統。本專案先行實驗，成功後推薦給 BMad-Control-Tower 作為候選功能。

### 目標架構

```
_ct-workorders/
├── _tower-state.md          ← 最小化：明日起手式 + 連結索引
├── _decision-log.md         ← 獨立：決策日誌
├── _bug-tracker.md          ← 索引表（指向 BUG-*.md）
├── _backlog.md              ← 索引表（指向 PLAN-*.md）
├── _local-rules.md          ← 本專案塔台附加規則（教塔台認識新單據）
├── _learnings.md            ← 學習紀錄（現有，不動）
├── BUG-###-xxx.md           ← 獨立 Bug 單
├── PLAN-###-xxx.md          ← 獨立計劃/Idea 單
├── T####-xxx.md             ← 工單（不動）
└── reports/                 ← 報告（不動）
```

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 調查步驟

#### Step 1：讀取 BMad-Control-Tower 風格

讀取 `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower` 目錄：
1. 找到工單模板（work-order-template.md 或類似）
2. 找到單據格式規範（若有）
3. 分析現有工單的 metadata 格式慣例：
   - frontmatter（YAML `---`）vs markdown metadata（`- **欄位**：值`）
   - 必要欄位 vs 可選欄位
   - 狀態值定義
4. 記錄風格要點（命名、結構、語言）

#### Step 2：分析現有工單格式

讀取本專案 2-3 張代表性工單（如 T0044、T0047、T0052），記錄：
- 現有 metadata 格式
- 共通欄位
- 回報區結構
- 成功模式和痛點

#### Step 3：設計 BUG 單模板

設計 `BUG-###-xxx.md` 格式，需包含：
- 元資料（編號、標題、嚴重度、狀態、報修時間、報修者）
- 現象描述
- 重現步驟（可選，報修時不一定知道）
- 根因（調查後填入）
- 修復工單連結（修復後填入）
- 時間線（狀態變更記錄）

**設計原則**：
- 報修時只需填最少欄位（標題 + 現象），其餘可後補
- 與工單格式風格一致（同一個 parser 能處理）
- 狀態流：📋 REPORTED → 🔍 INVESTIGATING → 🔧 FIXING → ✅ FIXED → 🚫 CLOSED/WONTFIX

#### Step 4：設計 PLAN 單模板

設計 `PLAN-###-xxx.md` 格式，需包含：
- 元資料（編號、標題、優先級、狀態、提出時間）
- 動機/背景
- 預期效益
- 預估規模
- 相關單據（依賴的 BUG 或 T 工單）
- 決策（塔台決定執行時，轉為 T 工單）

**設計原則**：
- 隨時可記（Idea 狀態），不需完整規劃
- 狀態流：💡 IDEA → 📋 PLANNED → 🔄 IN_PROGRESS（轉工單） → ✅ DONE → 🚫 DROPPED

#### Step 5：設計索引表格式

設計 `_bug-tracker.md` 和 `_backlog.md` 的格式：
- 表格結構（欄位、排序）
- 統計摘要（open/closed 數量）
- 連結到獨立單據

#### Step 6：設計 _tower-state.md 瘦身版

定義瘦身後的 `_tower-state.md` 結構：
- 明日起手式（快速恢復區）
- 連結索引（指向各獨立檔案）
- 管理筆記（自由格式，塔台自用）

#### Step 7：設計 _local-rules.md

定義本專案的塔台附加規則，教塔台認識：
- 新單據類型和前綴
- `*sync` 擴展掃描範圍
- Bug 報修流程（建檔 + 更新索引）
- PLAN 記錄流程（建檔 + 更新索引）

#### Step 8：設計 _decision-log.md

定義決策日誌格式：
- 決策編號（D###）
- 日期、背景、選項、決定、理由
- 從 _tower-state.md 搬移現有決策

### 預期產出

調查報告（寫入回報區），包含：
1. BMad-Control-Tower 風格摘要
2. BUG 單模板（完整）
3. PLAN 單模板（完整）
4. 索引表模板（_bug-tracker.md、_backlog.md）
5. _tower-state.md 瘦身版結構
6. _local-rules.md 內容
7. _decision-log.md 格式
8. 與現有工單格式的一致性確認

### 驗收條件
- [x] BMad-Control-Tower 風格已參考
- [x] BUG 單模板已設計（含最少必填欄位）
- [x] PLAN 單模板已設計
- [x] 索引表格式已設計
- [x] _tower-state.md 瘦身結構已設計
- [x] _local-rules.md 已草擬
- [x] _decision-log.md 格式已設計
- [x] 所有模板風格與 BMad-Control-Tower 一致
- [x] **沒有修改任何檔案**（GP005 — 純設計）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

---

### BMad-Control-Tower 風格摘要

**調查來源**：`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\control-tower\references\`

#### 核心風格要點

1. **Metadata 格式**：Markdown 列表 `- **欄位**：值`，**不用 YAML frontmatter**
2. **狀態值**：`PENDING / IN_PROGRESS / DONE / PARTIAL / FAILED / BLOCKED / URGENT`
3. **語言**：中文介面 + 英文技術術語並存
4. **章節層次**：`##` 為主要區段，`###` 為子區段
5. **工單目錄慣例**：`_ct-workorders/` 根目錄放全部單據
6. **支援的系統檔案**：
   - `_tower-state.md`：塔台記憶（主控）
   - `_decisions.md`：決策日誌（BMad 官方命名是 `_decisions.md`，本專案用 `_decision-log.md`）
   - `_learnings.md`：學習紀錄
   - `_local-rules.md`：專案附加規則
   - `_tower-config.yaml`：設定
7. **工單模板關鍵區段**：元資料 → 工作量預估 → Session 建議 → 任務指令 → 回報區
8. **回報區欄位**：完成狀態、產出摘要、互動紀錄、遭遇問題、sprint-status 更新、回報時間
9. **三層資料架構**：Core Skills（唯讀）→ Global Learning（跨專案）→ Project Learning（本專案）
10. **本專案現況**：已有 2 個 BUG 獨立檔（BUG-001/002），風格為大表格 + 詳細 Q&A，本次設計採輕量化方向

---

### BUG 單模板

**檔名格式**：`BUG-###-<kebab-case-title>.md`
**最少必填欄位**：標題 + 現象描述（報修當下即可建檔）

```markdown
# 🐛 BUG-###：<標題>

## 元資料

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-### |
| **狀態** | 📋 REPORTED |
| **嚴重度** | 🔴 High |
| **報修時間** | YYYY-MM-DD HH:MM (UTC+8) |
| **報修人** | 使用者 |
| **影響範圍** | （簡述影響的功能或使用者） |
| **重現率** | （100% / 偶發 / 待確認） |

---

## 現象描述

（必填）清楚描述使用者看到的症狀：
- **預期行為**：
- **實際行為**：

## 重現步驟

（選填，調查前不一定知道）

1. 
2. 
3. 

## 根因分析

（調查後填入）

## 修復記錄

（修復後填入）
- **修復工單**：T####-xxx
- **commit**：xxxxxxx
- **runtime 驗收**：（通過 / 待驗 / 失敗）

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| YYYY-MM-DD HH:MM | 📋 REPORTED | 初始報修 |

---

## 塔台處理區

- [ ] 已確認症狀
- [ ] 已分類（嚴重度確認）
- [ ] 已派發修復工單
- [ ] runtime 驗收通過
- **備註**：
```

**狀態流**：
```
📋 REPORTED → 🔍 INVESTIGATING → 🔧 FIXING → ✅ FIXED → 🚫 CLOSED
                                                        ↘ 🚫 WONTFIX
```

**嚴重度定義**：
| 符號 | 等級 | 定義 |
|------|------|------|
| 🔴 | Critical | 主流程無法使用，阻塞所有使用者 |
| 🔴 | High | 重要功能無法使用，影響大部分使用者 |
| 🟡 | Medium | 功能受損但有 workaround，影響部分使用者 |
| 🟢 | Low | 視覺/UX 瑕疵，不阻斷功能 |

---

### PLAN 單模板

**檔名格式**：`PLAN-###-<kebab-case-title>.md`
**最少必填欄位**：標題 + 動機/背景（Idea 狀態即可建檔）

```markdown
# 💡 PLAN-###：<標題>

## 元資料

| 欄位 | 內容 |
|------|------|
| **計劃編號** | PLAN-### |
| **狀態** | 💡 IDEA |
| **優先級** | 🟡 Medium |
| **提出時間** | YYYY-MM-DD HH:MM (UTC+8) |
| **提出人** | 使用者 |
| **預估規模** | 大 / 中 / 小 |
| **類型** | 功能 / 改善 / 技術債 / 研究 |

---

## 動機 / 背景

（必填）為什麼需要這個功能或改善？

## 預期效益

（選填）
- 

## 詳細描述

（選填，初期可留空）

## 相關單據

（選填）
- **依賴 BUG**：
- **依賴工單**：
- **相關討論**：

## 塔台決策

（塔台決定時填入）
- **決定**：執行 / 延後 / 放棄
- **轉工單**：T####-xxx
- **決定時間**：YYYY-MM-DD
- **理由**：

## 時間線

| 時間 | 狀態 | 備註 |
|------|------|------|
| YYYY-MM-DD HH:MM | 💡 IDEA | 初始記錄 |
```

**狀態流**：
```
💡 IDEA → 📋 PLANNED → 🔄 IN_PROGRESS（已轉工單）→ ✅ DONE
                                                   ↘ 🚫 DROPPED
```

**優先級定義**：
| 符號 | 等級 | 定義 |
|------|------|------|
| 🔴 | High | 對核心功能或使用者體驗影響重大 |
| 🟡 | Medium | 有價值但非緊急 |
| 🟢 | Low | Nice to have，有時間再做 |

---

### 索引表模板

#### _bug-tracker.md

```markdown
# Bug Tracker

> 最後更新：YYYY-MM-DD HH:MM (UTC+8)
>
> 統計：🔴 Open: X | ✅ Fixed: Y | 🚫 Closed: Z | 總計: N

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 狀態 | 報修時間 | 連結 |
|----|------|--------|------|---------|------|
| BUG-001 | <標題> | 🔴 High | 📋 REPORTED | YYYY-MM-DD | [詳細](BUG-001-xxx.md) |

## ✅ 已修復 / 已關閉

| ID | 標題 | 嚴重度 | 狀態 | 修復工單 | 連結 |
|----|------|--------|------|---------|------|
| BUG-001 | <標題> | 🔴 High | ✅ FIXED (T####) | T#### | [詳細](BUG-001-xxx.md) |
```

#### _backlog.md

```markdown
# Backlog / Planning

> 最後更新：YYYY-MM-DD HH:MM (UTC+8)
>
> 統計：💡 Ideas: X | 📋 Planned: Y | ✅ Done: Z | 🚫 Dropped: N

## 🔄 Active（Ideas & Plans）

| ID | 標題 | 優先級 | 狀態 | 提出時間 | 連結 |
|----|------|--------|------|---------|------|
| PLAN-001 | <標題> | 🟡 Medium | 💡 IDEA | YYYY-MM-DD | [詳細](PLAN-001-xxx.md) |

## 🗂️ 已完成 / 已放棄

| ID | 標題 | 優先級 | 狀態 | 轉工單 | 連結 |
|----|------|--------|------|--------|------|
| PLAN-001 | <標題> | 🟡 Medium | ✅ DONE | T#### | [詳細](PLAN-001-xxx.md) |
```

---

### _tower-state.md 瘦身版結構

**目標行數**：< 200 行（目前 2514 行）

```markdown
# Tower State — better-agent-terminal

> 最後更新：YYYY-MM-DD HH:MM (UTC+8)

---

## 🌅 明日起手式（Quick Recovery）

**目前進度**：<一句話描述當前狀態>
**最後完成工單**：T####-xxx（DONE / PARTIAL）
**下一步**：<立即可採取的行動>

**快速連結**：
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: X）
- Backlog → [_backlog.md](_backlog.md)（Active: Y）
- 決策日誌 → [_decision-log.md](_decision-log.md)（最新：D###）
- 學習紀錄 → [_learnings.md](_learnings.md)

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| 專案 | better-agent-terminal |
| 目前里程碑 | Phase 1 — Voice Input |
| 工單最大編號 | T#### |
| BUG 最大編號 | BUG-### |
| PLAN 最大編號 | PLAN-### |
| 塔台版本 | Control Tower v3.x |

---

## 📊 進度快照

（簡短 2-5 行：當前 Sprint 進展、關鍵里程碑狀態）

---

## 📝 管理筆記（自由格式）

（塔台工作區：當前 session 的思考、觀察、暫存決策）

---

## 🔗 歸檔索引

所有超過 2 週的 Checkpoint 已移至 `reports/` 目錄歸檔。
歷史 Checkpoint 搜尋：`reports/checkpoint-archive-YYYY-MM.md`
```

**遷移策略**：
1. 決策日誌（D013-D017）→ 複製到 `_decision-log.md`
2. Bug Tracker 表格 → 複製到 `_bug-tracker.md`（各 BUG 獨立檔已存在）
3. 待處理事項 backlog → 按格式建立 `PLAN-###.md` + `_backlog.md`
4. 歷史 Checkpoint（2400+ 行）→ 可選：保留最近 3 個、其餘歸檔或截斷
5. 學習紀錄（L001-L022）→ 保持在 `_learnings.md`（現已獨立）

---

### _local-rules.md 草稿

```markdown
# Local Rules — better-agent-terminal

> 本文件為本專案塔台附加規則，覆蓋 Core Skills 的預設行為。
> 載入優先級：Layer 3（最高優先）。
> 更新時間：YYYY-MM-DD (UTC+8)

---

## 擴充單據類型

本專案除標準工單（T####）外，額外使用以下單據：

| 前綴 | 用途 | 狀態流 |
|------|------|--------|
| `BUG-###-xxx.md` | 獨立 Bug 報修單 | 📋 REPORTED → 🔍 INVESTIGATING → 🔧 FIXING → ✅ FIXED → 🚫 CLOSED/WONTFIX |
| `PLAN-###-xxx.md` | 計劃 / Idea 記錄單 | 💡 IDEA → 📋 PLANNED → 🔄 IN_PROGRESS → ✅ DONE → 🚫 DROPPED |

---

## *sync 擴充掃描範圍

執行 `*sync` 時，除工單（T####）外，額外掃描以下文件：

| 檔案 | 掃描目的 |
|------|---------|
| `BUG-###-*.md` | Bug 單目前狀態（REPORTED / FIXED 等） |
| `PLAN-###-*.md` | 計劃單目前狀態（IDEA / DONE 等） |
| `_bug-tracker.md` | Open Bug 數量摘要 |
| `_backlog.md` | Active Idea / Plan 數量摘要 |
| `_decision-log.md` | 最新決策條目 |

---

## Bug 報修流程

**觸發**：發現新 Bug 需記錄時

**步驟**：
1. 分配下一個 BUG 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/BUG-###-<title>.md`（複製模板，最少填：標題 + 現象描述）
3. 更新 `_ct-workorders/_bug-tracker.md` Open Bugs 表格
4. 更新 `_tower-state.md` 中 BUG 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題（BUG-### 標題）
- 嚴重度
- 現象描述（預期 vs 實際）

---

## PLAN 記錄流程

**觸發**：有新 Idea 或功能需求需記錄時

**步驟**：
1. 分配下一個 PLAN 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/PLAN-###-<title>.md`（複製模板，最少填：標題 + 動機）
3. 更新 `_ct-workorders/_backlog.md` Active 表格
4. 更新 `_tower-state.md` 中 PLAN 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題
- 動機 / 背景（一句話）

---

## 索引同步原則

**規則**：凡修改任何 BUG / PLAN 單據的狀態，**必須同步更新對應索引**。

| 修改的文件 | 必須同步更新 |
|-----------|------------|
| BUG-###.md 狀態變更 | `_bug-tracker.md` 對應列 |
| PLAN-###.md 狀態變更 | `_backlog.md` 對應列 |
| 任何上述變更 | `_tower-state.md` 明日起手式中的統計數字 |

---

## 編號規則

| 類型 | 格式 | 起始 | 範例 |
|------|------|------|------|
| 工單 | T#### | T0001 | T0062-migrate-documents |
| Bug | BUG-### | BUG-001 | BUG-016-font-rendering |
| PLAN | PLAN-### | PLAN-001 | PLAN-001-agent-orchestration |
| 決策 | D### | D001 | D018-adopt-new-doc-structure |

塔台在 `_tower-state.md` 的「基本資訊」中維護各類型的最大編號。

---

## 優先援引既有模板

當產生新 BUG / PLAN 單時，優先複製以下參考模板：
- BUG 模板：（T0062 遷移後建立）`_ct-workorders/BUG-TEMPLATE.md`
- PLAN 模板：（T0062 遷移後建立）`_ct-workorders/PLAN-TEMPLATE.md`
```

---

### _decision-log.md 格式

```markdown
# 決策日誌 — better-agent-terminal

> 記錄所有影響專案方向的重要決策。
> 格式：D### 編號 + 日期 + 背景 + 選項 + 決定 + 理由
>
> 最後更新：YYYY-MM-DD (UTC+8)

---

## 模板

### D### YYYY-MM-DD — <決策標題>

- **背景**：<為什麼需要做這個決策>
- **選項**：
  - 選項 A：<描述>
  - 選項 B：<描述>
- **決定**：選項 X
- **理由**：<採用這個選項的原因>
- **相關工單**：T####
- **影響**：<決策的後果或限制>

---

## 決策索引

| ID | 日期 | 標題 | 相關工單 |
|----|------|------|---------|
| D001 | 2026-04-11 | <標題> | T#### |

---

## 決策紀錄

（依 D### 降序排列，最新在上）

### D### YYYY-MM-DD — <標題>

...（各決策條目）
```

**從 _tower-state.md 搬移的現有決策（D013-D017）範例**：

```markdown
### D017 2026-04-11 — BAT agent orchestration 記入 Backlog

- **背景**：使用者要求 auto-session 能整合 BAT 做雙向自動化閉環，且支援所有 AI agent（不限 Claude Code）
- **選項**：
  - 選項 A：立即開工單開發
  - 選項 B：暫記 Backlog，等使用者 review 技術文件後決定
- **決定**：選項 B
- **理由**：需要 D1-D8 八題決策確認後才適合開工，現在條件未成熟
- **相關工單**：reports/bat-agent-orchestration-research.md
- **影響**：PLAN-001（待建立）追蹤此議題
```

---

### 遭遇問題
無

### 回報時間
2026-04-12 20:50 (UTC+8)
