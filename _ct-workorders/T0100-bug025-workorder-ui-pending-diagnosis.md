# 工單 T0100 — BUG-025 診斷：CT 面板新建工單 Pending 問題

## 元資料
- **工單編號**：T0100
- **任務名稱**：BUG-025 診斷 — CT 面板新建工單持續 Pending 根因分析
- **關聯 BUG**：BUG-025
- **優先級**：高（影響日常使用 CT 面板）
- **估時**：30~45 分鐘
- **狀態**：✅ DONE

---

## 任務描述

診斷 Control Tower 面板中新建工單持續 Pending、修改 .md 後 UI 不更新的根因。

重點調查：**file watch 機制是否對後來新建的文件感知**。

---

## 診斷步驟

### Step 1：確認 BUG-024 的修復方式

```bash
# 查看 T0095 的 commit
git log --all --oneline | grep -i "bug.024\|BUG.024\|watch\|file.watch"
git show <commit-hash> --stat
```

重點：
- BUG-024 修復是怎麼實作的？
- 是「一次性掃描」還是「動態 watch」？
- 修復的是哪個檔案？（`src/components/` 下的 CT 相關組件）

### Step 2：找到 CT 面板的 file watch 實作

```bash
# 找 file watch 相關程式碼
grep -r "fs.watch\|chokidar\|watch\|watcher" src/ --include="*.ts" --include="*.tsx" -l
grep -r "workorder\|_ct-workorders" src/ --include="*.ts" --include="*.tsx" -l
```

確認：
- 目前使用哪個 watch 函式庫（fs.watch / chokidar / custom）？
- watch 的路徑是什麼（整個目錄 / 特定文件）？
- watch 初始化在哪個 lifecycle（啟動時 / 每次切換 tab）？

### Step 3：重現問題

1. 在 app 執行時，新建一個測試工單 `.md`
2. 觀察 CT 面板是否感知到新文件
3. 修改該工單狀態，觀察 UI 更新

**關鍵問題**：
- 新建文件後 CT 面板有沒有顯示（即使 Pending）？
- 還是連新工單都不出現？

### Step 4：對比受影響 vs. 正常工單

確認 T0093 / T0097 / T0098 vs. 其他工單的差異：

| 屬性 | 受影響工單 | 正常工單 |
|------|-----------|---------|
| 建立時間 | 本 session | 之前 session |
| 格式 | 新模板 | 舊模板 |
| 是否在 index | 確認 | 確認 |

```bash
# 確認這幾張工單是否在 index 中
grep -n "T0093\|T0097\|T0098" _ct-workorders/_workorder-index.md
```

### Step 5：確認 parser 容錯邏輯

找到 CT 面板的工單 parser：
```bash
grep -r "parser\|parse\|pending\|Pending" src/ --include="*.ts" --include="*.tsx" -n | grep -i "workorder\|tower\|ct"
```

確認：
- "Pending" 是什麼意思？（loading 中 / 解析失敗 / 文件不存在）
- Parser 是否有容錯邏輯導致格式不符的工單被跳過？

---

## 根因假設（按可能性排序）

1. **High**：file watch 是對特定文件 list 的 watch，不是對目錄的 watch。新建文件不會自動加入。
2. **Medium**：工單未列入 `_workorder-index.md`（T0099 清理步驟會確認）
3. **Low**：Parser 格式容錯過濾了某些新模板欄位

---

## 工單回報區

**執行人**：Claude  
**開始時間**：2026-04-13 17:31  
**完成時間**：2026-04-13 17:36  

### 完成成果
- [x] 確認 BUG-024 修復方式（一次性 vs. 動態 watch）
- [x] 確認 file watch 的監聽範圍（目錄 vs. 文件列表）
- [x] 確認 Pending 的具體含義（loading / 解析失敗 / 未發現）
- [x] 確認 T0093/T0097/T0098 是否在 workorder index 中
- [x] 根因初步確認

### 根因結論

**BUG-025 根因：`extractStatusKeyword` regex 無法解析 emoji 前綴的狀態值**

**位置**：`src/types/control-tower.ts` → `parseWorkOrder()` → `extractStatusKeyword()`

**問題程式碼**（第 64 行）：
```typescript
const keyword = raw.toUpperCase().match(/^(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
```

**根因**：regex 使用 `^` 錨點要求狀態關鍵字在字串**最開頭**。但工單模板使用 emoji 前綴格式（如 `✅ DONE`、`🔄 IN_PROGRESS`），emoji 在最開頭導致 regex 無法匹配，fallback 到 `'PENDING'`。

**受影響工單**：
- `T0097`：`✅ DONE` → 解析為 PENDING ❌
- `T0098`：`✅ DONE` → 解析為 PENDING ❌
- T0100 本身（診斷過程中）：`🔄 IN_PROGRESS` → 解析為 PENDING ❌

**T0093 不受影響**（狀態格式為 `DONE`，無 emoji 前綴）✅

**附：BUG-024 / file watch 診斷**
- BUG-024 修復方式：在 IPC handler `fs:watch` 中加入 `BrowserWindow.getAllWindows()` 廣播，解決 `broadcastHub` 只送遠端的問題
- File watch 是**目錄級 recursive watch**（`fsSync.watch(_dirPath, { recursive: true })`），**不是**文件列表 watch，新建文件 **會**被感知
- 所以 BUG-025 的根因不是 file watch，而是 **parser 無法處理 emoji 前綴狀態**

### 建議修復方向

**一行修復**（`src/types/control-tower.ts:64`）：

將：
```typescript
const keyword = raw.toUpperCase().match(/^(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
```

改為：
```typescript
const keyword = raw.toUpperCase().match(/^[^A-Z]*(DONE|IN_PROGRESS|PENDING|BLOCKED|PARTIAL|INTERRUPTED|FAILED|URGENT)/)?.[1]
```

**說明**：`^[^A-Z]*` 允許字串開頭有任意數量的非大寫英文字元（包含 emoji、空格、符號），再匹配狀態關鍵字。

**已驗證**：
- `✅ DONE` → `DONE` ✅
- `🔄 IN_PROGRESS` → `IN_PROGRESS` ✅
- `📋 TODO` → `PENDING` (正確 fallback，TODO 不是有效狀態) ✅
- `DONE` → `DONE` ✅（向後相容）

### 遇到的問題
無。根因定位比假設更簡單（parser 而非 file watch），5 分鐘內確認。
