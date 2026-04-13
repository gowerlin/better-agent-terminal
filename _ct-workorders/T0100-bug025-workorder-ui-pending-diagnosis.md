# 工單 T0100 — BUG-025 診斷：CT 面板新建工單 Pending 問題

## 元資料
- **工單編號**：T0100
- **任務名稱**：BUG-025 診斷 — CT 面板新建工單持續 Pending 根因分析
- **關聯 BUG**：BUG-025
- **優先級**：高（影響日常使用 CT 面板）
- **估時**：30~45 分鐘
- **狀態**：📋 TODO

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

**執行人**：  
**開始時間**：  
**完成時間**：  

### 完成成果
- [ ] 確認 BUG-024 修復方式（一次性 vs. 動態 watch）
- [ ] 確認 file watch 的監聽範圍（目錄 vs. 文件列表）
- [ ] 確認 Pending 的具體含義（loading / 解析失敗 / 未發現）
- [ ] 確認 T0093/T0097/T0098 是否在 workorder index 中
- [ ] 根因初步確認

### 根因結論
[填寫診斷結果]

### 建議修復方向
[填寫具體修復方案，塔台收到後開修復工單]

### 遇到的問題
[無 / 具體描述]
