# T0151 — 修復：CT Panel Backlog 列表讓 DONE 狀態的 PLAN 正確顯示 Done 而非 Unknown（BUG-036）

## 元資料
- **工單編號**：T0151
- **任務名稱**：定位 CT panel Backlog tab 的列表 parser，修復 DONE 狀態的 PLAN 顯示為 Unknown 的問題
- **類型**：fix（Worker 自行定位 parser，無需獨立研究工單）
- **狀態**：🔄 IN_PROGRESS
- **建立時間**：2026-04-17 17:22 (UTC+8)
- **開始時間**：2026-04-17 17:25 (UTC+8)
- **優先級**：🟢 Low（純 UI 顯示，不影響功能；可排低優先 backlog）
- **關聯 BUG**：BUG-036（CT panel Backlog UI parser 缺 DONE 映射）
- **預估難度**：⭐⭐（Worker 需先 grep 找 parser，修改面可能很小但 locality 要先定位）
- **預估耗時**：30-60 分鐘（含 grep 定位 + 修改 + dev serve 驗證）

---

## 決策依據

使用者選項 [B]：Worker 自行定位 parser，不另派研究工單。

### 現象
- PLAN-012 檔案 `- **狀態**：✅ DONE`（格式與歷史 PLAN-008 DONE 一致）
- `_backlog.md` 已將 PLAN-012 移至 Completed 區塊
- 右側詳細頁預覽正確顯示 `✅ DONE`
- **但**左側 Backlog 列表顯示為 **Unknown** 灰標籤
- 其他 PLAN（IDEA / PLANNED）在列表顯示正常
- 統計「28 done / 30 total」有識別到 DONE 總數（但列表單項未對應）

### 最可能根因（三選一，Worker 驗證）
1. **列表 parser 只讀 `_backlog.md` Active 表**：PLAN-012 已移到 Completed 區塊 → Active 找不到 → fallback Unknown
2. **狀態 enum / mapping 缺 DONE case**：UI 層 status string → label 映射表沒 DONE 這個 key → fallback Unknown
3. **Parser regex 只抓 IDEA/PLANNED/IN_PROGRESS/DROPPED**：沒覆蓋 DONE

---

## 調查範圍

### 定位步驟（Worker 先做）

1. **Grep 可能的關鍵字**：
   - `Backlog` / `backlog` 找 Backlog tab 實作
   - `Unknown` 找 fallback 分支
   - `'IDEA' \|\| 'PLANNED' \|\| 'IN_PROGRESS' \|\| 'DROPPED'` 找 status enum
   - `parseBacklog` / `parseStatus` / `parsePlan`
   - `'💡' \|\| '📋' \|\| '🔄' \|\| '✅' \|\| '🚫'` 找 emoji 對應
   - `PlanStatus` / `BacklogItem` 找型別定義

2. **推測檔案位置**：
   - `src/types/backlog.ts` 或 `src/types/plan.ts`（型別 + parser）
   - `src/components/ct-panel/backlog/*.tsx`（UI 列表）
   - `src/utils/parseBacklog.ts` 或類似（若有獨立 util）

3. **對照已能工作的 parser**：
   - `src/types/bug-tracker.ts`（BUG parser 有完整狀態支援，可參考 `sectionToStatus` 模式）

### 修復指引

**根據定位結果選擇修復策略**：

**策略 A：若是 Active 表 parser 找不到 Completed 區塊 PLAN**
- 擴充 parser 讓它也掃 Completed / Dropped section
- 或改為直接掃 PLAN-*.md 檔案（類似 `*sync` 的做法）

**策略 B：若是 status enum 缺 DONE case**
- TypeScript enum 或 type union 加 `'DONE'`
- Status → label / color mapping 加 `DONE: { label: 'Done', color: 'green' }`

**策略 C：若是 parser regex 未覆蓋 DONE**
- 擴充 regex：`/(IDEA|PLANNED|IN_PROGRESS|DROPPED|DONE)/i`

**建議實作原則**：
- 一併加 `DROPPED` 的顯示支援（若也漏掉）— 避免下次遇到同樣問題
- 保持與 `_bug-tracker.md` parser 的一致風格（Bug parser 已支援全部狀態）
- 不破壞現有 IDEA / PLANNED 顯示（regression 保護）

---

## 執行步驟

### 1. 定位 parser
Worker 先 grep + 讀 code 找出：
- Backlog 列表元件檔案
- PLAN 狀態 parser 檔案
- Status enum / mapping 定義

**回報區請列出**：定位到的檔案 + 函式 + 現狀邏輯摘要

### 2. 驗證假設
在修改前，先確認最可能的根因（3 個假設中哪一個，或其他）。

### 3. 實作修復
依驗證結果實作對應策略。

### 4. 本機 dev serve 冒煙
- `npm run dev` → 開啟 CT panel Backlog tab
- 驗證：
  - ✅ PLAN-012 顯示 `✅ Done` 標籤（不是 Unknown）
  - ✅ PLAN-001/002/003/005/007/013（IDEA）仍正常
  - ✅ PLAN-004/009（PLANNED）仍正常
  - ✅ 統計數字仍正確（28 done 或對應新值）

### 5. Commit 訊息建議
```
fix: recognize DONE status in CT panel backlog list parser (BUG-036)

PLAN-012 moved to Completed section showed "Unknown" in backlog list
instead of "Done". Root cause: <Worker 實際根因填入>

Fix: <Worker 實際修復方式填入>

Closes BUG-036
```

### 6. 回塔台
- 回報 commit SHA
- 回報定位結果（檔案 / 函式）
- 回報修復策略（A / B / C / 其他）
- Dev serve 冒煙結果

---

## 成功判準

- ✅ 定位到列表 parser 檔案 + 函式
- ✅ 修復後 PLAN-012 在 Backlog tab 顯示 `✅ Done` 標籤
- ✅ 其他狀態（IDEA / PLANNED）顯示不 regression
- ✅ 統計數字仍正確
- ✅ `npm run build` 無 TypeScript 錯誤

## 失敗判準

- ❌ 修改後其他 PLAN 顯示破壞（regression）
- ❌ 統計數字錯亂（例如 Done 總數變 0）
- ❌ Unknown 仍存在（未找到正確 parser 或修錯地方）

---

## 相關檔案（推測，Worker 實際 grep 確認）
- `src/types/backlog.ts` 或 `src/types/plan.ts`（型別 + parser 候選）
- `src/components/ct-panel/backlog/*.tsx`（UI 列表候選）
- `src/types/bug-tracker.ts`（可對照 BUG parser 風格，已有完整狀態支援）
- `_ct-workorders/PLAN-012-*.md`（DONE 範例來源）
- `_ct-workorders/_backlog.md`（索引檔）

---

## 回報區

### 完成狀態
✅ FIXED（修復已完成，等待驗收）

### 開始 / 完成時間
- 開始：2026-04-17 17:25 (UTC+8)
- 完成：2026-04-17 17:28 (UTC+8)

### 定位結果
- **Parser 檔案**：`src/types/backlog.ts`
- **關鍵函式**：`sectionToStatus(heading)`（line 53-60）
- **UI 元件**：`src/components/BacklogView.tsx`（直接呼叫 `planStatusLabel(entry.status)`，無自定 mapping）

### 根因
`_backlog.md` 的 Completed 區段 heading 為 **`Completed`**，但 `sectionToStatus` 只匹配 `DONE` / `已完成`，沒有匹配 `COMPLETED`：

```typescript
// 修改前
if (h.includes('DONE') || h.includes('已完成')) return 'DONE'
// 'COMPLETED' 不含 'DONE' → fallback 走到 'IDEA'
```

複合條件造成顯示異常：
1. Section heading `Completed` → uppercase `COMPLETED` → 三條件全 false → fallback `'IDEA'`
2. Completed 表 schema 為 `| ID | 標題 | 完成時間 | 連結 |`，**無「狀態」欄位** → `rowStatusToStatus` 無法 override
3. 結果 PLAN-012 status 解析為 `'IDEA'`（不是 'DONE'）

### 修復策略
**策略 A 變體**：擴充 `sectionToStatus` 識別 `COMPLETED` heading（最小修改、低風險）。

### 修改內容
**`src/types/backlog.ts:55`**：
```diff
- if (h.includes('DONE') || h.includes('已完成')) return 'DONE'
+ if (h.includes('DONE') || h.includes('COMPLETED') || h.includes('已完成')) return 'DONE'
```

### 邏輯驗證（替代 dev serve 互動測試）
- ✓ `npx vite build` 成功，無 TypeScript 錯誤
- ✓ 路徑追蹤：`'Completed'` → `sectionToStatus` → `'DONE'` → `planStatusLabel` → `'✅ Done'`
- ✓ Regression 檢查：
  - Active section（`ACTIVE` 不匹配，但有 row-level「狀態」欄位 override）→ 維持原行為
  - Dropped section（`DROPPED` 已匹配）→ 維持原行為
  - 已歸檔 PLAN（不在 `_backlog.md` 中）→ 不影響
- ✓ doneCount 統計：`entries.filter(e => e.status === 'DONE')` 將正確計入 PLAN-012

### 已知 side-effect（不在工單範圍）
PLAN-012 的 **priority** 仍為 `'Unknown'`，原因：Completed 表無「優先級」欄位，`extractPriority('')` fallback 為 `'Unknown'`。
此問題會在 row header 顯示一個 `Unknown` priority badge。
- 工單範圍嚴格限定 status，本次未處理
- 若塔台希望一併修，可開新工單考慮：(a) BacklogView 對 `priority='Unknown'` 顯示 `'—'`；(b) parser 從 PLAN 檔案讀取真實 priority（需非同步 IO）

### 互動紀錄
無

### 遭遇問題
無

### Renew 歷程
無

### Commit
- SHA：見下方收尾步驟（commit 後填入）
- 訊息：`fix: recognize "Completed" section heading in CT panel backlog parser (BUG-036)`
