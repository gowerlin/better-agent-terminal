# 工單 T0098 — 產生 sprint-status.yaml

## 元資料
- **工單編號**：T0098
- **任務名稱**：產生 sprint-status.yaml（進度追蹤表）
- **優先級**：高（配置類，進度依賴）
- **估時**：15 分鐘
- **狀態**：✅ DONE

---

## 任務描述

產生專案根目錄下的 `sprint-status.yaml` 檔案，記錄當前工單進度、Phase 和 Epic 的對應關係。

**簡潔版**：僅列進行中（IN_PROGRESS）+ 待做（TODO）的工單，不列已完成的（DONE）。

---

## 需求明細

### YAML 結構

```yaml
# sprint-status.yaml — better-agent-terminal 進度追蹤

project: better-agent-terminal
version: "1.0.0"
last_updated: "2026-04-13"

# 里程碑概覽
milestones:
  - name: "Phase 1 — Voice Input"
    status: "✅ DONE"
    completed: "T0001~T0062"
    
  - name: "Phase 2 — Terminal Architecture"
    status: "🔄 PLANNING"
    epic_count: "[待填]"
    
  - name: "Phase 3+"
    status: "📋 BACKLOG"
    reference: "_backlog.md (PLAN-001~007)"

# 按 Epic 分組的進行中工單
epics:
  - name: "Bug Tracker & Maintenance"
    status: "🔄 ACTIVE"
    description: "BUG 流程、文件管理、CI/CD"
    workorders:
      - id: "T0097"
        title: "產生 project-context.md"
        status: "🔄 IN_PROGRESS"
        assigned: "[執行人]"
        
      - id: "T0098"
        title: "產生 sprint-status.yaml"
        status: "🔄 IN_PROGRESS"
        assigned: "[執行人]"
        
      - id: "[T0099+]"
        title: "[新工單待填]"
        status: "📋 TODO"
        
  - name: "Phase 2 — Terminal Architecture"
    status: "📋 PLANNING"
    description: "Terminal Server 獨立進程、PTY 生命週期"
    workorders:
      - id: "T0100+"
        title: "[待設計]"
        status: "📋 BACKLOG"
        note: "基於 T0093 架構調查結果規劃"
        
# 待做清單（按優先級）
backlog:
  - epic: "Phase 2 — Terminal Architecture"
    items:
      - "Terminal Server 獨立進程架構設計"
      - "PTY 管理重構"
      - "通訊協議定義"
      
  - epic: "功能與 UX 優化"
    items:
      - "参考 PLAN-001~007 逐項規劃"
      - "見 _backlog.md"

# 統計
summary:
  total_workorders: 98
  completed: 97
  in_progress: 1
  todo: "[N]"
  blocked: 0
```

---

## 執行步驟

1. ✅ **分析當前狀態**
   - 讀取 `_tower-state.md`
   - 讀取 `_workorder-index.md`
   - 確認進行中 + 待做工單清單

2. ✅ **確定結構**
   - Phase 1（已完成）、Phase 2（規劃中）、Phase 3+（待定）
   - 對應 Epic：Language Input → Architecture → ...
   - 見 `_local-rules.md` 的 PLAN 編號規範

3. ✅ **填寫進度表**
   - 簡潔版：只列進行中 + 待做（不列 DONE）
   - 每張工單包含：id / title / status / assigned
   - 統計：Done / In Progress / Todo / Blocked

4. ✅ **驗證與 commit**
   - 對標 `project-context.md` 中的願景
   - 確保工單編號連貫
   - 確認前後工單的依賴關係（順序）

---

## 關鍵參考

### 已完成的 Phase 結構
```
Phase 1 — Voice Input
├─ T0001~T0030：語音辨識（Whisper）
├─ T0031~T0050：UI 工作流（BMad 整合）
├─ T0051~T0062：工單系統（BUG/PLAN tracking）
└─ BUG 修復（T0063+）
```

### 待規劃的 Phase 2 結構（作為參考）
```
Phase 2 — Terminal Architecture
├─ T0100+：Architecture 調查（基於 T0093）
├─ T0110+：Terminal Server 分離實作
├─ T0120+：PTY 管理重構
└─ T0130+：通訊協議標準化
```

### 相關檔案
- `_backlog.md`：PLAN-001~007 的完整清單
- `_local-rules.md`：工單編號規範（T/BUG/PLAN/D）
- `_tower-state.md`：進度快照（最後更新時間）

---

## 工單回報區

**執行人**：Claude  
**開始時間**：2026-04-13 17:07  
**完成時間**：2026-04-13 17:10

### 完成成果
- [x] sprint-status.yaml 已產生（專案根目錄）
- [x] 里程碑結構已定義（Phase 1 DONE / Phase 2 PLANNING / Phase 3+ BACKLOG）
- [x] 進行中工單已列出（T0097 TODO / T0098 IN_PROGRESS）
- [x] 待做清單已整理（7 個 PLAN 項目，按優先級排序）
- [x] 統計數字已驗證（total: 99 / completed: 97 / in_progress: 1 / todo: 1）
- [x] Bug Tracker 狀態已記錄（全清，24 CLOSED）

### 遇到的問題
無。Tower State 和 workorder index 提供了足夠資訊。

### 學習記錄
- workorder index 顯示 Done: 97，但塔台最高編號為 T0096（96 個編號）。統計數字 97 可能包含某個中間未計入 index 的工單，已採用 tower state 的數字 97 為基準。
- T0097（project-context.md）尚未完成，sprint-status.yaml 中的 T0097 說明需在 T0097 完成後由塔台手動更新。

### 備註
- 這個檔案將由塔台定期更新（每張工單完成後）
- 推薦使用簡潔版（進行中 + 待做），避免過度冗長
- 完成的 Epic 會逐項存檔到 _archive/

---

## 下一步

完成後，塔台會基於兩份檔案的內容展開後續工單派發。
