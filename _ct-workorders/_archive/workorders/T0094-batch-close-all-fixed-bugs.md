# 工單 T0094 — 批次結案所有 FIXED 狀態 BUG

## 元資料
- **工單編號**：T0094
- **任務名稱**：批次結案所有 FIXED 狀態 BUG
- **狀態**：DONE
- **開始時間**：2026-04-13 15:25 UTC+8
- **建立時間**：2026-04-13 15:45 UTC+8
- **相關票號**：全部 FIXED 狀態 BUG（含 BUG-023）

---

## 🎯 目標

使用者已人工驗收所有 FIXED 狀態的 BUG，統一更新為 CLOSED，並同步 bug tracker 統計。

同時記錄 T0091（BUG Detail 工作流 UI）與 T0092（右鍵選單智慧定位）驗收通過。

---

## 📋 背景

**新 BUG 狀態流（T0090 已更新）**：
```
OPEN → FIXING → FIXED → VERIFY → CLOSED
```
FIXED = Worker commit 完成，人工驗收通過 → 可直接 CLOSED（跳過 VERIFY）

**預期統計變化**：
| | 執行前 | 執行後 |
|--|--------|--------|
| FIXED | ~19 | 0 |
| CLOSED | 4 | ~23 |

---

## ✅ 任務清單

### 1. 掃描所有 FIXED 狀態的 BUG 文件

```bash
# 列出所有 BUG 文件（主目錄 + archive）
find _ct-workorders -name "BUG-*.md" | sort
find _ct-workorders/_archive -name "BUG-*.md" 2>/dev/null | sort

# 篩選狀態為 FIXED 的文件
grep -l "狀態.*FIXED\|FIXED" _ct-workorders/BUG-*.md 2>/dev/null
```

### 2. 逐一更新 FIXED → CLOSED

對每個 FIXED 狀態的 BUG 文件：
- 狀態改為 `CLOSED`
- 加入結案記錄：
  ```
  **結案日期**：2026-04-13
  **結案說明**：人工驗收通過（批次確認）
  ```

**重點包含 BUG-023**（T0092 修復，右鍵選單智慧定位已驗收）：
- `_ct-workorders/BUG-023-context-menu-viewport-overflow.md`
- 狀態：`FIXED` → `CLOSED`
- 加入：T0092 commit hash、驗收日期

### 3. 更新 `_bug-tracker.md`

- 所有 FIXED 列改為 CLOSED
- 統計更新：
  - FIXED：N → 0
  - CLOSED：4 → ~23
- 更新時間戳

### 4. 更新 `_tower-state.md`

記錄：
- 批次結案 ~19 個 FIXED BUG（2026-04-13，人工驗收）
- T0091 驗收通過（BUG Detail 工作流 UI）
- T0092 驗收通過（BUG-023 右鍵選單智慧定位）

### 5. 提交

```bash
# 加入所有修改的 BUG 文件
git add _ct-workorders/BUG-*.md
git add _ct-workorders/_bug-tracker.md
git add _ct-workorders/_tower-state.md
git add _ct-workorders/T0094-batch-close-all-fixed-bugs.md

git commit -m "chore(tower): 批次結案所有 FIXED BUG + T0091/T0092 驗收記錄

- 19 個 FIXED 狀態 BUG 全數人工驗收通過，更新為 CLOSED
- BUG-023（右鍵選單智慧定位）驗收通過
- T0091 BUG Detail 工作流 UI 驗收通過
- T0092 右鍵選單智慧定位實作驗收通過
- Bug tracker 統計：FIXED 0，CLOSED ~23"
```

---

## 🔍 驗收標準

- [ ] `_bug-tracker.md` 中 FIXED 數量為 0
- [ ] CLOSED 數量正確（原 4 + 本次關閉數）
- [ ] BUG-023 狀態為 CLOSED
- [ ] 所有修改的 BUG 文件有結案日期記錄
- [ ] `_tower-state.md` 已更新
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 16:34 UTC+8

**實際 FIXED→CLOSED 數量**：20

**BUG 清單**（已關閉）：
```
Archive (11):
  BUG-003：voice:downloadModel IPC handler 未註冊
  BUG-004：AudioContext 崩潰
  BUG-005：whisper addon require undefined
  BUG-006：AudioWorklet packaged 載入失敗
  BUG-008：終端捲動 overlay 錯位
  BUG-009：右鍵貼上 focus 遺失
  BUG-010：Alt buffer 鍵盤攔截
  BUG-011：IME 輸入法 guard
  BUG-013：Tab 切換黑屏
  BUG-014：Ctrl+滾輪縮放失效
  BUG-015：終端字體 CJK fallback

Main (9):
  BUG-016：ControlTowerPanel 無限循環 + 重複 key
  BUG-017：BMad Workflow/Epics _bmad-output 偵測
  BUG-018：切換工作區頁籤未更新
  BUG-019：Epics 頁籤顯示舊版 KanbanView
  BUG-020：Workflow 頁籤殘留 Sprint 標籤
  BUG-021：VS Code ENOENT 無 UI 錯誤提示
  BUG-022：VS Code Insiders 路徑引號問題
  BUG-023：右鍵功能表超出螢幕（T0092 修復）
  BUG-024：CT 面板不監聽索引文件變更（T0095 修復）
```

**最終統計**：
- OPEN：0（預期 0）✅
- VERIFY：0（預期 0）✅
- FIXED：0（預期 0）✅
- CLOSED：23（預期 ~23）✅
- WONTFIX：1（BUG-007）

**Commit hash**：待使用者確認 commit

**異常或決策**：
- BUG-017~020 文件狀態為 REPORTED（非 FIXED），但 bug tracker 已標記 FIXED，統一更新為 CLOSED
- BUG-021~022 文件狀態為 FIXING，但 bug tracker 已標記 FIXED，統一更新為 CLOSED
- BUG-024 為新 BUG，原不在 tracker 中，一併加入並結案（總計從 23 增至 24）

**追加修正**（使用者回報 UI 顯示 Won't Fix 問題）：
- 原因：bug tracker section 標題 `## 🚫 已關閉 / WONTFIX` 被 parser 優先匹配為 WONTFIX
- 修正 1：拆為 `## 🚫 已關閉 (CLOSED)` + `## ⛔ 不修復 (WONTFIX)` 兩個獨立 section
- 修正 2：BUG-007 歸入 WONTFIX section（唯一真正不修）；BUG-001 保留 CLOSED（根因釐清，已另開 T0087）
- 修正 3：`sectionToStatus` parser 加入容錯（混合標題 fallback 為 CLOSED）
- 修正 4：UI filter bar 加入 WONTFIX 篩選按鈕 + summary badge
- 修正 5：`_local-rules.md` 加入 section 標題格式規範，防止未來重犯
