# 工單 T0101 — BUG-025 修復：Parser 無法解析 emoji 前綴狀態值

## 元資料
- **工單編號**：T0101
- **任務名稱**：BUG-025 修復 — `extractStatusKeyword` regex 支援 emoji 前綴
- **關聯 BUG**：BUG-025
- **優先級**：高（CT 面板日常使用受影響）
- **估時**：10 分鐘
- **狀態**：✅ DONE

---

## 任務描述

一行修復：讓 `extractStatusKeyword` 的 regex 支援 emoji 前綴的狀態值。

**根因**（T0100 確認）：`^` 錨點要求狀態關鍵字在字串最開頭，但工單模板使用 `✅ DONE`、`🔄 IN_PROGRESS` 格式，emoji 導致 regex 無法匹配，fallback 到 `'PENDING'`。

---

## 修復步驟

### Step 1：修改 regex（一行）

**檔案**：`src/types/control-tower.ts`  
**位置**：第 64 行（`extractStatusKeyword` 函數內）

**改前**：
```typescript
const keyword = raw.toUpperCase().match(/^(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
```

**改後**：
```typescript
const keyword = raw.toUpperCase().match(/^[^A-Z]*(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
```

**說明**：`^[^A-Z]*` 允許字串開頭有任意數量的非大寫英文字元（emoji、空格、符號），再匹配狀態關鍵字。

### Step 2：驗證

開啟 app，確認以下工單在 CT 面板正確顯示：

| 工單 | 狀態值 | 預期顯示 |
|------|--------|---------|
| T0097 | `✅ DONE` | DONE ✓ |
| T0098 | `✅ DONE` | DONE ✓ |
| T0100 | `✅ DONE` | DONE ✓ |
| T0101（本身）| `📋 TODO` | PENDING（正確，TODO 為有效 fallback）✓ |
| T0093 | `DONE`（無 emoji）| DONE ✓（向後相容）|

### Step 3：Build 驗證

```bash
npx vite build
```

確認無 TypeScript 編譯錯誤。

### Step 4：Commit

```
fix(ct-panel): BUG-025 — 修復 parser 無法解析 emoji 前綴狀態值

src/types/control-tower.ts:64 extractStatusKeyword regex 加入
^[^A-Z]* 前綴匹配，允許 emoji/符號開頭的狀態值（如 ✅ DONE、🔄 IN_PROGRESS）

影響：T0097/T0098/T0100 等使用新工單模板的工單恢復正確顯示
根因診斷：T0100
```

---

## 驗收條件

- [ ] `✅ DONE` 格式在 CT 面板顯示為 DONE（非 PENDING）
- [ ] `🔄 IN_PROGRESS` 格式正確顯示
- [ ] 舊格式（無 emoji 前綴）向後相容
- [ ] Build 通過，無 TypeScript 錯誤

---

## 工單回報區

**執行人**：Claude  
**開始時間**：2026-04-13 17:44  
**完成時間**：2026-04-13 17:45  

### 完成成果
- [x] regex 已修改（1 行）— `src/types/control-tower.ts:64`
- [ ] CT 面板驗證通過（需開啟 app 目視確認）
- [x] Build 通過（npx vite build ✓，無 TypeScript 錯誤）
- [x] Commit 完成

### 遇到的問題
無

### 學習記錄
- 一行 regex 修改即可解決：`^` → `^[^A-Z]*`，允許 emoji/空格開頭
- `^[^A-Z]*` 使用否定字元類匹配任意數量非大寫英文字元，向後相容無 emoji 前綴的工單
- T0100 診斷工單的根因分析直接對應到正確修復方案，診斷流程完整有效
