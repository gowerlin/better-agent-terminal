# 工單 T0033-Obs-output-listener-fanout-analysis

## 元資料
- **工單編號**：T0033-Obs
- **任務名稱**：BAT output listener fan-out 成本量化（BUG-010 根因最後驗證）
- **狀態**：DONE
- **建立時間**：2026-04-12 01:20 (UTC+8)
- **開始時間**：2026-04-12 01:23 (UTC+8)
- **完成時間**：2026-04-12 01:28 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔍 **Pure Investigation**（無 code 修改，無 git commit，**不加測點**）

## 工作量預估
- **預估規模**：中（20-30 min）
- **Context Window 風險**：中（讀 4-5 個檔案）
- **降級策略**：若某個 listener 的上下游過大，先完成 3 個主要 listener 的分析，回報 PARTIAL

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：
  1. 和 T0032-ESC 平行跑，各自獨立 session
  2. 需要專注讀多個檔案分析成本，context 要乾淨
  3. 塔台 session 繼續待命

## 任務指令

### 前置條件

**必讀文件**（按順序）：
1. `_ct-workorders/reports/T0032-bug008-bug010-investigation.md` Section 2（BAT xterm 盤點 ground truth）
2. `_ct-workorders/reports/T0032-Flow-keyboard-event-flow-analysis.md` Section 3.1.3 + Section 4 H2d/H2e 候選
3. `_ct-workorders/_learnings.md` L026（line 916-985）

### 輸入上下文

#### 本工單的問題焦點

**BUG-010「intermittent freeze during streaming」** 經過三線調查後，最可能的根因是 **H2e：output listener fan-out 造成 renderer rendering 壓力**。

**Experiment 2 Trace 證據（截圖已分析）**：
- Range 6.02s 錄製中，Rendering **768ms**（61% of active CPU）
- Scripting **186ms**（15% of active CPU）
- Rendering : Scripting = **4 : 1**，代表 DOM 操作成本遠大於 JS 執行
- Main thread 有 long task markers，不連續但 peak burst 會卡
- Heap 17.4 MB → 28.4 MB（正常成長）

**T0032-Flow 指出的 fan-out 成員**（已定位）：

| Listener | 位置 | 目前已知行為 |
|----------|------|------------|
| TerminalPanel | `src/components/TerminalPanel.tsx:476-492` | `terminal.write(filteredData)` — xterm DOM 更新 |
| App（全域） | `src/App.tsx:416-418` | 更新 activity state |
| TerminalThumbnail | `src/components/TerminalThumbnail.tsx:63-77,95-97` | 預覽清理 + 切分 |
| workspaceStore | `src/stores/workspace-store.ts:488-500` | `updateTerminalActivity` — 有 2 秒節流，但仍要 `terminals.map` |
| PTY output batching | `electron/pty-manager.ts:34-37,61-77` | 16ms flush（已有 batching） |

#### 本工單目標

**量化每個 listener 的單次成本、總成本、可合併性，產出明確的「哪個 listener 最該優化 / 合併 / throttle」建議**，作為 T0033 BUG-010 修法工單的**直接依據**。

### 執行步驟

#### Step 1：讀取 5 個檔案的 listener 邏輯（~10 min）

逐一讀：
- `src/components/TerminalPanel.tsx` 的 `pty:output` handler（476-492）
- `src/App.tsx` 的 activity listener（416-418 附近）
- `src/components/TerminalThumbnail.tsx` 的 preview listener（63-77, 95-97）
- `src/stores/workspace-store.ts` 的 `updateTerminalActivity`（488-500）和 notify 節流（496-500）
- `electron/pty-manager.ts` 的 batching 邏輯（34-37, 61-77）

記錄每個 listener：
- Input（chunk 資料 + 其他參數）
- 執行路徑（同步/異步、是否呼叫其他 function、是否觸發 React re-render、是否 mutation store）
- DOM 操作次數估計
- React re-render 波及範圍（哪些 component 會重繪）

#### Step 2：建立成本估算表（~5 min）

| Listener | 每 chunk 成本 | 觸發 DOM 操作？ | 觸發 React re-render？ | Store mutation？ | 可合併？ |
|---------|--------------|---------------|--------------------|-----------------|---------|
| TerminalPanel → `terminal.write` | ??? | ??? | ??? | ??? | ??? |
| App → activity listener | ??? | ??? | ??? | ??? | ??? |
| TerminalThumbnail → preview | ??? | ??? | ??? | ??? | ??? |
| workspaceStore → `updateTerminalActivity` | ??? | ??? | ??? | ??? | ??? |

#### Step 3：回答六個關鍵問題（~10 min）

1. **TerminalPanel 和 App 是否訂閱同一個 event？** 兩個 listener 是否做重複工作？
2. **TerminalThumbnail 的 preview 在 streaming 高頻時的成本是多少？** 是否該 throttle？
3. **`workspaceStore.updateTerminalActivity` 的 `terminals.map` 是 O(n)，在 n 個 terminal 時每次 flush 的成本？**
4. **16ms batching 是否足夠？** 考慮 react re-render + DOM churn，flush 頻率是否該降低？
5. **有哪些 listener 可以合併？**（例如 App 的 activity 可以從 TerminalPanel 本地延伸出去，不用獨立訂閱）
6. **哪個 listener 是 rendering 768ms 的主要貢獻者？**（根據邏輯分析推測，trace 截圖不足以直接鎖定）

#### Step 4：產出報告 + 建議（~5 min）

### 預期產出

**單一檔案**：`_ct-workorders/reports/T0033-Obs-output-listener-fanout-analysis.md`

結構：

```markdown
# T0033-Obs — Output Listener Fan-out 成本分析

## 1. 摘要
（核心結論：哪個 listener 最該優化 / 合併，改了後預期的 latency 改善）

## 2. 五個 listener 的完整分析

### 2.1 TerminalPanel `pty:output` handler
（完整程式碼片段 + 逐行分析）

### 2.2 App 全域 activity listener
（完整程式碼片段 + 逐行分析）

### 2.3 TerminalThumbnail preview handler
（完整程式碼片段 + 逐行分析）

### 2.4 workspaceStore.updateTerminalActivity
（完整程式碼片段 + 逐行分析）

### 2.5 PTY batching flush 邏輯
（完整程式碼片段 + 目前 flush 時機 + 實際負擔估計）

## 3. 成本估算表
（Step 2 的表格，填完每一格）

## 4. 六個關鍵問題的答案
（Step 3 的回答）

## 5. 修法建議排序

### 5.1 零風險優化（先做）
- 可立刻合併的重複工作
- 可立刻 throttle 的昂貴操作

### 5.2 需小幅重構（中期）
- 需要 API 變更或 listener 重組

### 5.3 結構性（長期，可能不做）
- 需要改架構的改動

## 6. T0033 BUG-010 修法工單建議
（本工單產出的「下一張工單應該做什麼」明確清單，塔台會根據這個派正式 T0033）
```

### 驗收條件
- [x] 產出 `_ct-workorders/reports/T0033-Obs-output-listener-fanout-analysis.md`
- [x] Section 2 涵蓋 5 個 listener，每個都有程式碼片段 + 分析
- [x] Section 3 成本估算表每格都有答案（「未知」也要標出）
- [x] Section 4 回答 6 個關鍵問題
- [x] Section 5 給出至少 3 個「零風險優化」建議
- [x] Section 6 給出可以直接變成 T0033 工單的明確清單
- [x] **無任何 source code 修改**
- [x] **無任何 git commit**

### 執行注意事項
- **不要加測點**：本工單是 pure analysis，不要碰 code 加 `console.log` 或 `performance.mark`
- **T0032 Section 2 是 ground truth**：引用即可，不重新 grep
- **和 T0032-ESC 分工**：本工單**不看 keyboard input 路徑**，只看 `pty:output` → renderer 方向
- **成本估算可以是「高/中/低」**：不要求準確 ms 數，邏輯分析即可
- **React re-render 判斷**：看 handler 是否呼叫 `setState` / Zustand mutation / `dispatch`，呼叫哪個 store
- **時間盒 30 分鐘**：超過就停，PARTIAL 回報 + 建議擴大工單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 新增報告：`_ct-workorders/reports/T0033-Obs-output-listener-fanout-analysis.md`
- 完成 5 個 listener 程式碼片段 + 成本分析，回答 6 個關鍵問題，並提供修法優先級與下一張 T0033 工單清單
- 本工單符合 pure investigation 約束：**無任何 source code 修改、無 git commit**

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用（未找到 sprint-status.yaml）

### 回報時間
2026-04-12 01:28 (UTC+8)
