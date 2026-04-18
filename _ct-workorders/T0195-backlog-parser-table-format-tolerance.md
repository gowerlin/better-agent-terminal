# T0195 — Backlog Parser 容錯：支援 Markdown Table 優先級格式

## 元資料
- **編號**:T0195
- **類型**:implementation（實作工單）
- **狀態**:DONE
- **優先級**:🟢 Low
- **關聯**:BUG-045（parser 面，半閉環 — archive 面交 skill 演進）· T0194（研究工單,根因報告）
- **前置工單**:T0194 ✅ DONE
- **派發時間**:2026-04-19 00:55 (UTC+8)
- **開始時間**:2026-04-19 00:55 (UTC+8)
- **完成時間**:2026-04-19 01:00 (UTC+8)
- **預估工時**:20-30 min（純 regex + 單測）
- **派發方式**:⚠️ **BUG-046 阻擋 yolo dispatcher** → **使用者手動開新終端派發**
- **YOLO mode**:on（Worker 端自動送出完成訊息;BAT 派發失效不影響 Worker 行為）

## 背景

T0194 研究結論（見 `T0194 § B. 根因結論`）：

`src/types/backlog.ts:58-62` 的 `extractPriorityFromPlanContent()` regex：
```ts
/(?:優先級|Priority)[^\n]*?[:：]\s*([^\n]+)/i
```
**只認 `：` 或 `:` 作為 key-value 分隔符**,完全不處理 Markdown table 格式的 `|` 分隔符。

導致 PLAN-003 / PLAN-005 / PLAN-016 等 table 格式 PLAN 的優先級**永遠解析為 Unknown**（見 T0194 § A. PLAN metadata 差異表 row 1-5）。

## 目標

修改 `extractPriorityFromPlanContent()` 讓它**同時支援 bullet list 與 Markdown table 兩種格式**,且附上單元測試保證未來格式再漂移時不會靜默失敗。

## 範圍

- **僅改**:`src/types/backlog.ts` 的 `extractPriorityFromPlanContent()` 函式 + 對應單測
- **不動**:其他 parser（`extractPriority` cell 版本保持不變）、UI 元件、`*sync` 邏輯、archive 邏輯
- **不動**:PLAN-### 檔案本身（即使有格式漂移,修 parser 不修資料源）

## 執行步驟

### Step 1：建立 baseline 測試（5-10 min）

為 `extractPriorityFromPlanContent` 寫 5 張 PLAN 的 sample case（用現有 PLAN 檔內容或 inline 樣本）:

| 測資 | 格式 | 輸入片段 | 期望輸出 |
|------|------|---------|---------|
| PLAN-012 style | bullet list | `- **優先級**：🔴 High` | `'High'` |
| PLAN-019 style | bullet list | `- **優先級**：🟢 Low` | `'Low'` |
| PLAN-003 style | table | `\| **優先級** \| 🟢 Low（13 漏洞...） \|` | `'Low'` |
| PLAN-016 style | table | `\| **優先級** \| 🔴 High \|` | `'High'` |
| 英文 table | table | `\| **Priority** \| Medium \|` | `'Medium'` |

**預期結果**：PLAN-012/019 通過,PLAN-003/016/英文 table 失敗（驗證 BUG-045 parser 面的存在）。

### Step 2：改 regex（5 min）

策略：**兩段式嘗試**,第一段保持舊 regex 向下相容,第二段新增 table 格式。

```ts
export function extractPriorityFromPlanContent(content: string): Priority {
  // Bullet list: `- **優先級**：🔴 High` or `**Priority**: Medium`
  const bulletMatch = content.match(/(?:優先級|Priority)[^\n]*?[:：]\s*([^\n|]+)/i)
  if (bulletMatch) {
    const p = extractPriority(bulletMatch[1])
    if (p !== 'Unknown') return p
  }

  // Markdown table: `| **優先級** | 🔴 High |` or `| **Priority** | Medium |`
  const tableMatch = content.match(/\|\s*\*?\*?(?:優先級|Priority)\*?\*?\s*\|\s*([^|\n]+?)\s*\|/i)
  if (tableMatch) {
    const p = extractPriority(tableMatch[1])
    if (p !== 'Unknown') return p
  }

  return 'Unknown'
}
```

**關鍵點**：
- Bullet 版本加 `|` 到 `[^\n|]` 避免誤吃 table 行
- Table 版本允許 `**粗體**` 可選（`\*?\*?`）
- 兩段都走 `extractPriority()` 最後過濾（keyword match `HIGH|MEDIUM|LOW`）

### Step 3：測試通過（5 min）

跑單測,5 張 sample 全綠。額外邊界：
- 兩種格式同時存在（正文先 bullet 後 table 或反之）→ 應取第一個匹配成功
- 只有 emoji 沒有文字（`🔴`）→ 應走 `extractPriority()` fallback（emoji 轉 keyword）
- 中間多餘空白 → 應容錯

### Step 4：手動驗收（5 min）

不跑 Electron app（成本高）,改：
```bash
# 建立小 script 驗證
node -e "
  const { extractPriorityFromPlanContent } = require('./src/types/backlog')
  const fs = require('fs')
  for (const f of ['PLAN-003', 'PLAN-005', 'PLAN-012', 'PLAN-016', 'PLAN-019']) {
    const content = fs.readFileSync('_ct-workorders/' + f + '-*.md', 'utf-8')
    console.log(f, extractPriorityFromPlanContent(content))
  }
"
```
（或直接在單測裡讀真實 PLAN 檔 assert）

**驗收標準**：5 張 PLAN 都回傳正確優先級（Low/Low/High/High/Low）,無 Unknown。

### Step 5：commit（5 min）

格式：
```
fix(backlog): parser tolerate markdown table priority format (T0195, BUG-045 parser face)

T0194 identified that extractPriorityFromPlanContent() only matches bullet list format (`- **優先級**：X`), causing PLAN-003/005/016 (markdown table format) to always resolve as Unknown.

Add fallback regex for `| **優先級** | X |` table cells. Both formats tested with 5 real PLAN samples.

BUG-045 parser face: closed. Archive face (PLAN scanning in *archive skill): remains open, deferred to skill evolution.

工單：T0195
```

## 驗收標準（Worker 自檢清單）

- [ ] `src/types/backlog.ts` 的 `extractPriorityFromPlanContent()` 改動保持向下相容（bullet list 原有測資仍通過）
- [ ] 新增 table 格式支援,PLAN-003/005/016 不再回傳 Unknown
- [ ] 單元測試覆蓋 5 張 sample case（bullet list ×2 + table ×2 + 英文 table ×1）
- [ ] `npx tsc --noEmit src/types/backlog.ts` 無新 error
- [ ] commit 訊息含「BUG-045 parser face: closed」明確標註
- [ ] **不動** `extractPriority`、`parseBacklog`、UI 元件、`*sync` 邏輯、archive skill
- [ ] **不改** PLAN-### 檔案本身的格式

## 不在範圍

- **BUG-045 archive 面**：`*archive` skill 層 PLAN 分支未實作 — 交塔台 skill v4.4 演進,本張不處理
- **BUG-044 UI 封存 toggle 接線**：獨立工單 T0196 處理
- **`extractStatusFromPlanContent`** 對稱補齊：UI 顯示狀態問題由 `*sync` 重建 `_backlog.md` 修復（T0194 § B 證實）,本張不做
- **PLAN-### 檔案格式統一**：格式漂移是歷史產物,只修 parser 不動資料

## 回報區（Worker 填寫）

### A. 執行結果
- 修改檔案清單：
  - `src/types/backlog.ts`（`extractPriorityFromPlanContent` 雙 regex：bullet + table）
  - `tests/backlog-priority-parser.test.ts`（新增，13 張測資）
- commit hash：b6469ba
- 單測通過數 / 總數：13 / 13（8 inline case + 5 真實 PLAN 檔）
- 真實 PLAN 驗收結果（5 張）：PLAN-003 Low ✅、PLAN-005 Low ✅、PLAN-012 High ✅、PLAN-016 High ✅、PLAN-019 Low ✅

### B. 遭遇問題
（無）

備註：`npx tsc --noEmit`（全專案）輸出 2 個既有 error 位於 `src/components/TerminalPanel.tsx:210/385`（`markAgentCommandSent` / `markHasUserInput` 缺失），與本工單無關，屬 PLAN-019 TypeScript debt cleanup 範疇；針對 `src/types/backlog.ts` 單檔 tsc 無 error。

### C. 交付物清單（自檢）
- [x] Parser 兩格式皆支援
- [x] 5 張 sample 單測綠（含 8 張 inline edge case，共 13 張）
- [x] 向下相容驗證（bullet list PLAN-012/019 仍正確回傳 High/Low）
- [x] tsc 無新 error（單檔 tsc 乾淨；全專案 2 個 error 為既有 debt）
- [x] commit 含 BUG-045 標註

### D. YOLO 觀察（BUG-043 追蹤樣本）
- Step 0 **未顯示** 🚨 YOLO MODE ACTIVE banner — 因 `CT_MODE` env 未設（僅 `BAT_SESSION=1 BAT_REMOTE_PORT=9876`）。
- 行為符合 v4.3.0 規格：Step 0 顯示降級提示「塔台未傳 `--mode` flag，降級為 ask 模式」，Step 8.5 因 `BAT_TOWER_TERMINAL_ID` 空而跳過，Step 11 剪貼簿 fallback 將接手。
- **BUG-043 再現判定**：視你的定義為「CT_MODE 未傳=再現」則本次是 N+1 次；若為「yolo banner 缺失=再現」則同樣算 N+1 次（本張派發即期望 yolo）。
- T0192/T0193 log grep 建議交使用者於塔台端執行（Worker 無塔台 terminal id 無法 ping）。

### E. 回報時間
2026-04-19 01:00 (UTC+8)

## 備註

- **BUG-045 半閉環**:本張只修 parser 面,archive 面留 BUG-045 OPEN 標註「archive 面交 skill 演進」。BUG-045 暫不 CLOSED
- **派發方式**:BUG-046 阻擋 dispatcher,使用者手動開新 BAT 終端分頁執行 `claude "/ct-exec T0195"`
- **完成後下一張**:根據 T0194 § D,接派 T0196（UI archive 整合,low-med 2-2.5h）
