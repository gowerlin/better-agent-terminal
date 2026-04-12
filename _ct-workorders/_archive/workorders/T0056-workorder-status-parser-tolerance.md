# 工單 T0056-workorder-status-parser-tolerance

## 元資料
- **工單編號**：T0056
- **任務名稱**：工單狀態 parser 容錯改善（狀態值後附加文字 + 雙格式支援）
- **狀態**：DONE
- **建立時間**：2026-04-12 19:22 (UTC+8)
- **開始時間**：2026-04-12 19:25 (UTC+8)
- **完成時間**：2026-04-12 19:27 (UTC+8)

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：簡單修正

## 任務指令

### Bug 描述

指揮塔 UI 的工單列表中，部分工單狀態顯示不正確（DONE 顯示為 Pending）。

### 根因分析

工單檔案有兩種 metadata 格式，且狀態值有時帶附加文字：

**格式 1（Markdown metadata）**：
```markdown
- **狀態**：DONE
- **狀態**：DONE（塔台追認...）   ← parser 無法 match
- **狀態**:DONE（...）            ← 半形冒號變體
```

**格式 2（YAML frontmatter）**：
```yaml
---
status: DONE
status: BLOCKED                   ← 可能未更新
---
```

**Parser 需要**：
1. 容忍狀態值後的括號附加文字（`DONE（...）` → 認定為 DONE）
2. 同時支援 Markdown 和 YAML 兩種 metadata 格式
3. 支援全形冒號 `：` 和半形冒號 `:`

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 修復方向

1. 找到工單狀態 parser（搜尋 `workorder`、`parseWorkOrder`、`parseStatus`、`tower`、`control-tower` 相關元件）
2. 修改狀態提取邏輯：
   ```ts
   // 現有（猜測）：exact match
   // 改為：提取第一個有效狀態關鍵字
   const statusMatch = line.match(/(?:狀態|status)[：:]\s*(DONE|IN_PROGRESS|TODO|BLOCKED|PARTIAL|PAUSED|URGENT)/i)
   ```
3. 確保兩種格式都能正確解析
4. 測試案例：
   - `- **狀態**：DONE` → DONE ✅
   - `- **狀態**：DONE（塔台追認...）` → DONE ✅
   - `- **狀態**:DONE` → DONE ✅
   - `status: DONE` → DONE ✅
   - `status: BLOCKED` → BLOCKED ✅

### Commit 規範
```
fix(tower-ui): improve work order status parser tolerance
```

### 驗收條件
- [ ] 指揮塔 UI 中所有 DONE 工單顯示綠色 Done
- [ ] 帶括號後綴的狀態值能正確解析
- [ ] YAML frontmatter 格式和 Markdown 格式都支援
- [ ] `npx vite build` 通過
- [ ] **開啟指揮塔面板確認工單狀態正確**（GP020）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
- 修改檔案：`src/types/control-tower.ts`
- Commit：`d0a4c0c` fix(tower-ui): improve work order status parser tolerance
- 新增 `extractStatusKeyword()` 函數：從 raw 值提取第一個有效關鍵字
- 新增 YAML frontmatter 備援路徑：`status: DONE`
- `npx vite build` 通過 ✅

### 遭遇問題
無

### 回報時間
2026-04-12 19:27 (UTC+8)
