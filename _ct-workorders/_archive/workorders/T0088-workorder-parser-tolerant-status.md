# 工單 T0088 — Workorder Parser 狀態解析容錯改善

## 元資料
- **工單編號**：T0088
- **任務名稱**：Workorder Parser 狀態解析容錯改善
- **狀態**：DONE
- **開始時間**：2026-04-13 14:20 UTC+8
- **建立時間**：2026-04-13 14:25 UTC+8
- **相關票號**：無

---

## 🎯 目標

改善 BAT workorder parser 的狀態欄位解析邏輯，使其：
1. **容錯**：同時支援兩種既有格式（列表格式 & 表格格式）
2. **前瞻**：狀態值後面附加註解時仍能正確萃取

---

## 📋 背景

**現象**：Tower 直接建立的工單（T0086/T0087）在 BAT UI 顯示 `⏳ Pending`，而 ct-exec 建立的工單顯示 `✅ Done`。

**根因**：兩種工單使用不同的 metadata 格式，parser 只識別其中一種。

### 格式 A — ct-exec 列表格式（目前可解析）

```markdown
## 元資料
- **工單編號**：T0063
- **狀態**：DONE
- **建立時間**：2026-04-12 21:21 (UTC+8)
```

### 格式 B — Tower 表格格式（目前無法解析）

```markdown
| **狀態** | DONE |
|----------|------|
```

或不帶 bold：

```markdown
| 狀態 | DONE |
```

### 格式 C — 未來可能出現的附加註解格式

```markdown
## 元資料
- **狀態**：DONE <!-- 人工驗收通過 2026-04-13 -->
- **狀態**：DONE（已於 v0.0.9-pre.1 驗證）
- **狀態**：DONE  # 備注：含 BUG-012 修復
```

---

## ✅ 任務清單

### 1. 定位 Parser 程式碼

```bash
# 找 workorder 狀態解析相關檔案
grep -r "狀態\|status\|DONE\|TODO\|workorder\|parseWork" \
  src/ --include="*.ts" --include="*.tsx" -l

# 找「元資料」或 metadata 區段解析
grep -r "元資料\|metadata\|parseStatus\|getStatus" \
  src/ --include="*.ts" --include="*.tsx" -l
```

### 2. 實作容錯解析函數

在 parser 裡建立或更新狀態萃取邏輯，處理多種格式：

```typescript
/**
 * 從工單 markdown 內容萃取狀態值
 * 支援多種格式，並剝離尾部註解
 */
function parseWorkorderStatus(content: string): string | null {
  // 格式 A：列表格式
  // - **狀態**：DONE
  // - **狀態**：DONE <!-- 備注 -->
  // - **狀態**：DONE（附加說明）
  const listMatch = content.match(
    /^-\s+\*{0,2}狀態\*{0,2}[：:]\s*([A-Z_]+)/m
  )
  if (listMatch) return listMatch[1].trim()

  // 格式 B：Markdown 表格格式
  // | **狀態** | DONE |
  // | 狀態     | DONE <!-- 備注 --> |
  const tableMatch = content.match(
    /\|\s*\*{0,2}狀態\*{0,2}\s*\|\s*([A-Z_]+)/m
  )
  if (tableMatch) return tableMatch[1].trim()

  return null
}
```

**正規表達式說明**：
- `\*{0,2}`：容許 0 或 2 個 `*`（即 `狀態` 或 `**狀態**` 皆可）
- `[：:]`：容許全形冒號（`：`）或半形冒號（`:`）
- `([A-Z_]+)`：只萃取大寫英文狀態值（DONE / TODO / IN_PROGRESS / BLOCKED 等）
- 尾部的 `<!-- -->` / `（）` / `#` 等自動被排除在 capture group 之外

### 3. 狀態值正規化

確認 parser 的狀態對照表包含所有預期值：

```typescript
const STATUS_MAP: Record<string, WorkorderStatus> = {
  'TODO':        'pending',
  'IN_PROGRESS': 'in-progress',
  'DONE':        'done',
  'BLOCKED':     'blocked',
  'PAUSED':      'paused',
  'URGENT':      'urgent',
  // 容錯：小寫或混合大小寫也接受
  'done':        'done',
  'todo':        'pending',
  // ... 視需要補充
}
```

### 4. 單元測試（若專案有測試框架）

加入以下測試案例：

```typescript
describe('parseWorkorderStatus', () => {
  it('解析列表格式（無 bold）', () => {
    expect(parseWorkorderStatus('- 狀態：DONE')).toBe('DONE')
  })
  it('解析列表格式（有 bold）', () => {
    expect(parseWorkorderStatus('- **狀態**：DONE')).toBe('DONE')
  })
  it('解析表格格式（有 bold）', () => {
    expect(parseWorkorderStatus('| **狀態** | DONE |')).toBe('DONE')
  })
  it('解析表格格式（無 bold）', () => {
    expect(parseWorkorderStatus('| 狀態 | DONE |')).toBe('DONE')
  })
  it('剝離 HTML 註解', () => {
    expect(parseWorkorderStatus('- **狀態**：DONE <!-- 備注 -->')).toBe('DONE')
  })
  it('剝離中文括號說明', () => {
    expect(parseWorkorderStatus('- **狀態**：DONE（已驗收）')).toBe('DONE')
  })
  it('找不到狀態時回傳 null', () => {
    expect(parseWorkorderStatus('# 無狀態欄位')).toBeNull()
  })
})
```

### 5. 建置驗證

```bash
npx vite build
# 確認無 TypeScript 錯誤
```

### 6. 手動驗證

在 BAT UI 確認：
- T0086、T0087 顯示 `✅ Done`
- 新建一個測試用表格格式工單，確認解析正確
- 現有 ct-exec 格式工單（T0063 等）仍正常顯示

### 7. 提交

```bash
git add src/   # 修改的 parser 檔案

git commit -m "fix(workorder-parser): 容錯解析兩種 metadata 格式並剝離尾部註解

- 同時支援列表格式（- **狀態**：DONE）與表格格式（| 狀態 | DONE |）
- bold 標記（**）為選用，有無皆可解析
- 支援全形/半形冒號
- 狀態值後的 HTML 註解、中文括號說明不影響解析"
```

---

## 🔍 驗證標準

- [ ] T0086 在 BAT UI 顯示 `✅ Done`
- [ ] T0087 在 BAT UI 顯示 `✅ Done`
- [ ] T0063 等既有工單顯示不受影響
- [ ] 表格格式工單（含/不含 bold）均可正確解析
- [ ] 狀態值後接 `<!-- -->` 或 `（）` 時仍解析正確
- [ ] `npx vite build` 無錯誤

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 14:22 UTC+8

**Parser 檔案位置**：`src/types/control-tower.ts` — `extractField()` 函數（line 44-59）

**是否有既有測試可擴充**：無（專案無單元測試框架）

**Build 結果**：✅ `npx vite build` 通過，零錯誤

**Commit hash**：待 commit

**異常或決策**：
- 將 `extractField()` 從單一 bold-only regex 改為三層 fallback（列表 → 表格 → bold-only）
- 此改動影響所有欄位解析（不僅限狀態），使 `工單編號`、`任務名稱`、`建立時間` 等欄位也能容錯解析表格格式
- `extractStatusKeyword()` 已有的 `^(DONE|...)` 前綴匹配自然剝離尾部註解，無需額外處理
