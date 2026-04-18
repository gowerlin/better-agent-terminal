# BUG-045 — `*sync` Parser 容錯不足：DONE PLAN 未歸檔 + 優先級顯示 Unknown

## 元資料
- **編號**:BUG-045
- **狀態**:OPEN
- **嚴重度**:🟢 Low
- **建立時間**:2026-04-19 00:19 (UTC+8)
- **發現來源**:使用者回報（CT Panel Backlog 畫面截圖）
- **關聯**:BUG-044（姊妹單,CT Panel 封存勾選無效）
- **可重現**:100%
- **workaround**:直接讀 `_ct-workorders/PLAN-*.md` 原始 markdown

## 現象

截圖證據（2026-04-19 00:14 使用者提供）:

| PLAN | 優先級顯示 | 狀態顯示 | 實際應該 |
|------|----------|---------|---------|
| PLAN-019 | Low | 💡 Idea | Low / IDEA（實際狀態應為 DONE,本 session 剛結案） |
| PLAN-016 | **Unknown** | ✅ Done | 應解析到正確優先級 |
| PLAN-003 | **Unknown** | ✅ Done | 應解析到正確優先級 |
| PLAN-005 | **Unknown** | ✅ Done | 應解析到正確優先級 |
| PLAN-012 | High | ✅ Done | 對 ✓ |

## 問題拆解

### 問題 1：優先級 Parser 輸出 Unknown

PLAN-003 / PLAN-005 / PLAN-016 的 markdown 檔內應該有優先級欄位,但 parser 解析失敗輸出 "Unknown"。可能原因:

- 欄位名稱不一致（`優先級` vs `Priority` vs `優先度`）
- 欄位格式不一致（`🔴 High` vs `High` vs `🔴` vs `**優先級**:High`）
- 表格語法 vs bullet list 語法差異
- emoji 前後空白問題

**實證觀察**:PLAN-012 能解析成 High → 有某個格式是支援的,只是不夠寬容。

### 問題 2：DONE PLAN 未歸檔

**使用者強線索**:「之前封存期限設一天也不會封存」→ `archive_days=1` 時 PLAN-003/005/012/016（明顯超過 1 天的 DONE）也沒被 `*archive` 歸檔。

**指向**:問題不在 `archive_days` 門檻,而在:
- **A** `*archive` 候選篩選邏輯讀不到 PLAN 的完成時間（可能因為 parser 同樣無法解析狀態/時間欄位）
- **B** PLAN 狀態被解析為 `IDEA`（見 PLAN-019 截圖顯示 💡 Idea,但本 session 已 DONE）→ archive 看不到 DONE 狀態
- **C** `*archive` 只覆蓋 BUG + T####,沒實作 PLAN（需驗證)

## 調查範圍

### 熱點文件（推測,待 grep 確認）

1. `*sync` 實作位置:解析 PLAN markdown 元資料的地方
2. `*archive` 實作位置:判定歸檔資格的地方
3. `_backlog.md` 重建邏輯:從 PLAN markdown → 表格行的 mapping
4. CT Panel Backlog 元件:從 `_backlog.md` → UI 的 mapping（BUG-044 範圍）

### 需要盤點的資料格式

**測試樣本**（需 Worker 實際讀檔比對）:
- PLAN-012（能解析成功）vs PLAN-003/005/016（解析失敗）差異在哪
- PLAN-019 的狀態欄位寫法,為何解析成 IDEA 而非 DONE

## 處理方向

修復工單預期包含:

1. **Parser 容錯強化**:
   - 正規化欄位名稱（中英文別名、有無冒號、是否粗體）
   - 正規化值格式（emoji 前後空白、只有 emoji / 只有文字 / 兩者並存）
   - 解析失敗時輸出 warn log,UI 顯示「Unknown」但保留原始字串供 debug
2. **DONE PLAN 歸檔資格判定**:
   - 確認 `*archive` 是否讀得到 PLAN 狀態與完成時間
   - 若狀態解析失敗 → 歸檔邏輯走「寬容路徑」:允許手動指定 `*archive PLAN-XXX` 強制歸檔
3. **驗收**:
   - PLAN-003/005/012/016 的 `*sync` 輸出應全部顯示正確優先級（無 Unknown）
   - PLAN-019 應顯示 DONE（而非 IDEA）
   - `*archive --dry-run` 應列出 PLAN-003/005/012/016 為候選（假設超過 `archive_days`）

## 根因假設（按優先級）

1. **PLAN metadata 格式不一致**（最可能):不同時期建立的 PLAN 採不同欄位格式,parser 剛性解析
2. **Parser 硬編碼欄位名稱**:只認一種寫法
3. **`*archive` 未處理 PLAN**:功能缺失(v4.0 新增 `*archive` 可能沒涵蓋 PLAN)

## 備註

- **L070 候選呼應**:上次 session `*sync` 摘要提到「部分工單元資料格式不一致（狀態欄位解析失敗）」,這張 BUG 正式把它升級為待修
- **姊妹單**:與 BUG-044（CT Panel UI 封存勾選）修復工單可合併
- **YOLO 觀察**:本輪修復派發走 YOLO 模式,順便觀察 BUG-043（Worker YOLO 偶發失效）是否再現
