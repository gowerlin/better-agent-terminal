# 工單 T0065-bug-verify-status-and-sync

## 元資料
- **工單編號**：T0065
- **任務名稱**：BUG 狀態流新增 VERIFY 階段 + BUG-001/002 狀態同步
- **狀態**：DONE
- **建立時間**：2026-04-12 22:10 (UTC+8)
- **開始時間**：2026-04-12 22:12 (UTC+8)
- **完成時間**：2026-04-12 22:16 (UTC+8)

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：文件修改，不涉及程式碼，快速完成

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/_local-rules.md`（修改目標）
- `_ct-workorders/_bug-tracker.md`（參照 + 確認一致性）
- `_ct-workorders/BUG-001-claude-oauth-paste-truncated.md`（狀態更新）
- `_ct-workorders/BUG-002-context-menu-offset.md`（狀態更新）

### 輸入上下文

專案 better-agent-terminal 的 BUG 報修流程原先缺少「code fix 完成但尚未真人驗收」的中間狀態。
塔台與使用者討論後決定採用方案 B：在 FIXING 和 FIXED 之間新增 🧪 VERIFY 狀態。

**決策紀錄（D029）**：
- FIXED 維持為最終態（不改語義），新增 VERIFY 為中間態
- 歸檔規則不需要修改（FIXED 仍是最終態）
- 已歸檔的 FIXED bugs 不受影響
- 驗收失敗：原問題未解 → 退回 FIXING；衍生問題 → 開新 BUG 單
- 驗收者：使用者/QA（真人）、AI sub-session（自動化測試可判斷的場景）
- E2E 或視覺化的 AI 難以正確判斷的仍需真人複驗

### 預期產出
- 修改後的 `_local-rules.md`（BUG 狀態流更新）
- 修改後的 `BUG-001-*.md`（狀態 → 🧪 VERIFY）
- 修改後的 `BUG-002-*.md`（狀態 → 🧪 VERIFY）
- 修改後的 `_bug-tracker.md`（BUG-001/002 狀態欄更新 + 備註更新）
- 更新 `_decision-log.md` 新增 D029
- 更新 `_workorder-index.md`（T0065 加入 Active）

### 驗收條件
- [ ] `_local-rules.md` BUG 狀態流更新為：📋 REPORTED → 🔍 INVESTIGATING → 🔧 FIXING → 🧪 VERIFY → ✅ FIXED → 🚫 CLOSED/WONTFIX
- [ ] `_local-rules.md` 新增驗收失敗處理規則（退回 FIXING / 開新 BUG）
- [ ] `_local-rules.md` 新增驗收者說明（真人 + AI，E2E/視覺需真人）
- [ ] BUG-001 檔案狀態更新為 🧪 VERIFY，附註：code fix by T0006，awaiting runtime verification
- [ ] BUG-002 檔案狀態更新為 🧪 VERIFY，附註：code fix by T0008+T0012，awaiting runtime verification
- [ ] `_bug-tracker.md` BUG-001/002 狀態欄同步更新
- [ ] `_decision-log.md` 新增 D029 條目
- [ ] `_workorder-index.md` 加入 T0065
- [ ] 所有修改 commit（atomic commit）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 修改 `_local-rules.md`：
   - BUG 狀態流加入 🧪 VERIFY
   - 新增「驗收失敗處理」段落
   - 新增「驗收者」說明段落
4. 修改 BUG-001 檔案：狀態 → 🧪 VERIFY
5. 修改 BUG-002 檔案：狀態 → 🧪 VERIFY
6. 修改 `_bug-tracker.md`：同步 BUG-001/002 狀態欄
7. 更新 `_decision-log.md`：新增 D029
8. 更新 `_workorder-index.md`：加入 T0065
9. Atomic commit
10. 填寫回報區，更新狀態和完成時間

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改 7 個檔案：

| 檔案 | 變更內容 |
|------|---------|
| `_local-rules.md` | BUG 狀態流加入 🧪 VERIFY；新增「VERIFY 狀態說明」、「驗收者」、「驗收失敗處理」三個子節 |
| `BUG-001-claude-oauth-paste-truncated.md` | 狀態 → 🧪 VERIFY（code fix by T0006，awaiting runtime verification） |
| `BUG-002-context-menu-offset.md` | 狀態 → 🧪 VERIFY（code fix by T0008+T0012，awaiting runtime verification） |
| `_bug-tracker.md` | 新增「🧪 驗收中 (VERIFY)」區塊；BUG-001/002 從「已修復」移入該區塊；統計更新 |
| `_decision-log.md` | 新增 D029 條目（索引 + 完整紀錄）；更新最後更新時間 |
| `_workorder-index.md` | T0065 狀態 PENDING → IN_PROGRESS（commit 後塔台更新為 DONE） |
| `T0065-bug-verify-status-and-sync.md` | 本工單狀態 → DONE，填入完成時間與回報區 |

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-12 22:16 (UTC+8)
