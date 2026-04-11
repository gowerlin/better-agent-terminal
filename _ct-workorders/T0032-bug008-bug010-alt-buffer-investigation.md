# 工單 T0032-bug008-bug010-alt-buffer-investigation

## 元資料
- **工單編號**：T0032
- **任務名稱**：BUG-008 + BUG-010 深度調查（alt buffer event family hypothesis 驗證）
- **狀態**：PARTIAL
- **建立時間**：2026-04-11 23:40 (UTC+8)
- **開始時間**：2026-04-11 23:45 (UTC+8)
- **完成時間**：2026-04-11 23:54 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔍 **Pure Investigation**（無 code 修改，無 git commit）

## 工作量預估
- **預估規模**：中（60-90 min）
- **Context Window 風險**：中（讀 2-5 個原始碼檔案 + 寫一份報告）
- **降級策略**：若源碼閱讀範圍擴張到超過 context 預算，**立刻停下來寫 PARTIAL 回報，並在「遭遇問題」區建議塔台追加「讀完整事件流」後續工單**。不要硬著頭皮讀完全部。

## Session 建議
- **建議類型**：🆕 **新 Session**
- **原因**：
  1. 純 investigation 任務，context 必須乾淨才能客觀判斷證據
  2. 本塔台 session 會繼續待命，不適合切換角色
  3. Worker 要讀原始碼 + 寫報告，大量讀檔需要充裕 context 預算

## 任務指令

### BMad 工作流程
（無對應 workflow，依下方步驟手動執行）

### 前置條件

**必讀文件**（按順序）：
1. `_ct-workorders/_learnings.md` **L026 章節**（BAT Alt Buffer Event Family Hypothesis，~70 行，約 line 916-985）
   - 此為**本工單的核心假設**，所有實驗都在驗證 L026 的 H1
2. `_ct-workorders/T0028-bug008-overlay-scroll-drift.md` 的**回報區**（理解 T0028 Pattern C 的失敗點）
3. `_ct-workorders/T0029-revert-t0028-pattern-c.md`（理解為何 T0028 被 revert）

**必讀原始碼（最小驗證範圍，Q2=C 假設先行）**：
4. `src/renderer/` 或 `src/` 下的 xterm.js wrapper（terminal component / view）
   - 用 Grep 找 `@xterm/xterm` 或 `xterm` import 的檔案作為起點
5. xterm.js event subscription 的註冊處（找 `.onData`、`.onScroll`、`.onResize`、`.onKey` 等事件 API 使用）
6. `terminal.buffer.active.type` 或 `buffer.active` 相關的使用（若有 → 表示程式碼已經知道 alt buffer 存在，假設 L026-H1 需要修正）

> **重要**：Q2=C「假設先行」——只讀這 3 個範圍（xterm.js wrapper、event 註冊、buffer.active 使用）。**若讀完發現需要擴大到 PTY IPC / Electron main↔renderer event forwarding，停下來回報塔台追加工單**，不要自己擴張 scope。

### 輸入上下文

#### 專案背景
`better-agent-terminal`（BAT）是基於 Electron + xterm.js 的自訂終端，主打「為 AI CLI tool（Claude Code / Copilot CLI）優化的 terminal UX」。目前正在 dogfood 驗收階段。

#### 本調查的起因
兩個 dogfood 階段發現的 bug，症狀差很遠但**疑似同根**：

| Bug | 症狀 | 嚴重度 |
|-----|------|--------|
| **BUG-008** | Overlay（右鍵選單、popover）在 scroll 後 ghost，位置不更新 | 🟡 Medium |
| **BUG-010** | Claude Code CLI streaming 期間，BAT 鍵盤輸入（含 ESC）完全 freeze，**無法中斷失控生成** | 🔴🔴 Critical |

T0028 曾用 Pattern C「scroll event → dismiss overlay」嘗試修 BUG-008，**完全沒觸發過**（使用者 dogfood 驗證失敗）→ T0029 已 revert。

#### 核心假設（L026 H1-refined，需本工單驗證）

> **BAT 的 xterm.js 包裝層 event subscription 只訂閱 normal buffer 的事件來源**，在 alt screen buffer（`\e[?1049h`）情境下，overlay 定位 / keyboard routing 同時失靈。

#### Smoking gun 證據鏈（使用者提供）
1. Claude Code CLI 是 Ink TUI → 預設使用 alt screen buffer
2. Copilot CLI **不用 alt buffer**（線性輸出）→ 無 BUG-008 / BUG-010
3. **Windows Terminal** 中 Claude Code streaming 時 ESC 可中斷 → **BAT 中不能**（差分證據）
4. BAT 中 Claude Code CLI「有滿滿內容但無 scrollbar，wheel 可捲」→ alt buffer 經典特徵（scrollback=0，wheel 被 xterm.js 轉給 alt buffer 內部）

#### ⚠️ META 注意事項（Worker 必讀）

**本工單的調查對象就是你現在執行所在的終端**（`better-agent-terminal`）。
- Experiment 1 的 `vim/less/htop` 測試**必須由人類在 BAT 的 GUI 中執行**（Worker 沒有 GUI）
- Experiment 2 的 Chrome DevTools Performance trace**必須由人類執行**
- Experiment 3 的 Claude vs Copilot ANSI 比對**必須由人類執行**
- **Worker 只能做**：讀原始碼（Experiment 4 最小範圍）+ 寫 playbook + 寫報告分析

### 本工單的實際工作分工

#### 👷 Worker 要做（Q3=A 分工）

**Task W1：Experiment 4 最小範圍源碼閱讀**（重點）
- 找到 BAT 的 xterm.js wrapper 位置
- 列出所有 event subscription（`.onData`, `.onScroll`, `.onResize`, `.onKey`, `.onBell`, `.onLineFeed` 等）
- 找 `buffer.active.type` 或 `buffer.active` 相關使用
- **分析**：這些 event 在 alt buffer 模式下是否被呼叫？有沒有 buffer-agnostic 處理？
- 產出：**源碼分析章節**，帶檔案路徑 + line number 引用

**Task W2：為 Experiment 1 / 2 / 3 撰寫 Playbook**
- 為「人類操作」產出精確的步驟腳本：
  - **Experiment 1**：`vim /tmp/test.txt` → 點擊「開啟 overlay（例：右鍵）」→ 滾動 → 觀察 ghost？按 ESC → 會 freeze？每步記錄 ✅/❌
  - **Experiment 1 延伸**：`less /path/to/bigfile` 和 `htop` 各做同樣測試
  - **Experiment 2**：開啟 Chrome DevTools → Performance tab → 錄製 5 秒 Claude Code streaming → 保存 trace → 標註 main thread long task
  - **Experiment 3**：用 `script -q typescript.log claude chat`（或等效工具）抓 raw ANSI stream → `grep -E '\x1b\[\?1049[hl]'` 確認 alt buffer 進入/離開；對 Copilot CLI 做同樣抓取比對
- 產出：**實驗腳本章節**，每個實驗一個可複製貼上的步驟清單 + 驗收判準表格

**Task W3：初步假設驗證與修法候選分析**
- 根據 Task W1 的源碼發現，判斷 L026-H1 假設是「證實 / 部分證實 / 需要更多證據 / 推翻」
- 若證實：列出 L026 四個修法候選中，**哪個最適合 BAT 現有架構**（帶原因）
- 若推翻：產出**新假設**並說明
- 產出：**結論與下一步建議章節**

#### 🧑 人類（使用者）要做

**使用者執行 Experiment 1 / 2 / 3（由 Worker 的 playbook 引導）**
- 不需要在本工單的 Worker session 內完成
- Worker 寫完 playbook + 源碼分析後，工單進入 `PARTIAL` 狀態，使用者離線跑實驗，把結果**直接填入報告的「人類實驗結果」區段**

**使用者填回實驗結果後的處置**
- 塔台會根據完整結果派下一張工單（T0033-修法 或 T0033-擴大調查）

### 預期產出

**單一檔案**：`reports/T0032-bug008-bug010-investigation.md`

結構如下：

```markdown
# T0032 — BUG-008 + BUG-010 Alt Buffer Investigation

## 1. 假設摘要
（L026-H1 + 本工單的關鍵問題）

## 2. 源碼分析（Experiment 4 最小範圍）
### 2.1 xterm.js wrapper 定位
### 2.2 Event subscription 盤點
### 2.3 buffer.active.type 使用情況
### 2.4 初步判斷（假設證實 / 推翻 / 不確定）

## 3. 實驗 Playbook（人類執行）
### 3.1 Experiment 1 — vim/less/htop alt buffer 家族測試
### 3.2 Experiment 2 — Chrome DevTools Performance trace
### 3.3 Experiment 3 — Claude vs Copilot raw ANSI 比對

## 4. 人類實驗結果（使用者填）
### 4.1 Experiment 1 觀察
### 4.2 Experiment 2 觀察
### 4.3 Experiment 3 觀察

## 5. 結論與下一步建議
### 5.1 L026-H1 假設狀態
### 5.2 推薦修法候選
### 5.3 是否需要追加「完整事件流」調查工單
```

### 驗收條件
- [ ] `reports/T0032-bug008-bug010-investigation.md` 已建立
- [ ] Section 2（源碼分析）至少定位到 xterm.js wrapper 檔案路徑 + event subscription 列表（帶 line number）
- [ ] Section 2.4 對 L026-H1 給出明確判斷（證實 / 部分證實 / 推翻 / 不確定）
- [ ] Section 3（playbook）每個實驗都是**可直接執行的步驟清單**，非抽象描述
- [ ] Section 3 每個實驗都有驗收判準（要看到什麼才算 pass / fail）
- [ ] Section 5 即使在資料不完整情況下，也給出「下一步建議」（可以是「等使用者跑完 Exp1-3 再決定」）
- [ ] **無任何 source code 修改**（本工單禁止改 code）
- [ ] **無任何 git commit**（本工單禁止 commit）
- [ ] 工單狀態：成功寫完 Section 2 + 3 → `PARTIAL`（等人類跑實驗）；若 Section 5 能給出完整修法建議 → `DONE`

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀 `_learnings.md` line 916-985（L026）
4. 讀 `T0028` 和 `T0029` 工單的回報區
5. 用 Grep 定位 BAT 的 xterm.js wrapper（`grep -rn "@xterm/xterm" src/` 或 `grep -rn "new Terminal" src/`）
6. 讀 wrapper 檔案，列出所有 event subscription
7. Grep `buffer.active` 在 src/ 下的使用
8. 建立 `reports/T0032-bug008-bug010-investigation.md`，按上述結構填寫 Section 1, 2, 3, 5
9. **Section 4 留空**給使用者填（可放 `（等使用者執行 Experiment 1-3 後填入）` 佔位符）
10. 填回報區
11. 更新工單「狀態」為 `PARTIAL`（因為 Exp 1-3 還沒跑）
12. 更新「完成時間」

### 執行注意事項
- **禁止越權**：不要改 BAT 的任何 source code；不要 git commit；不要 git push
- **禁止範圍爆炸**：Section 2 只做「最小範圍」（Q2=C），若需要擴大 → 寫在「遭遇問題」區請塔台追加工單
- **寫給人類看**：playbook 要精確到「打什麼指令、按什麼鍵、看畫面哪裡」，不要寫抽象步驟
- **L026-H1 可能是錯的**：若源碼閱讀顯示 BAT 已經處理 alt buffer（例如有 `if (buffer.active.type === 'alt')` 分支），**立刻在 Section 2.4 標記「假設需修正」**，並在 Section 5 提出新假設
- **Dogfood meta**：這個工單的 Worker 很可能跑在 BAT 自己裡，這完全沒問題——但要注意，Worker 讀源碼時不要把自己當成「使用者」去執行任何 UI 操作

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
PARTIAL

### 產出摘要
- 新增報告：`_ct-workorders/reports/T0032-bug008-bug010-investigation.md`
- 更新工單：`_ct-workorders/T0032-bug008-bug010-alt-buffer-investigation.md`（開始時間、完成時間、狀態、回報區）
- 調查範圍：完成 Experiment 4 最小範圍（xterm wrapper/event subscription/`buffer.active` 使用）與 Experiment 1-3 人類操作 playbook
- source code 變更：無（符合 Pure Investigation 限制）

### 互動紀錄
無

### 遭遇問題
在最小範圍源碼閱讀內，已能支持 BUG-008 方向（缺少 scroll/render 類同步路徑），但尚無法直接證實 BUG-010 的主因即為 normal/alt 訂閱差異。需先由使用者執行 Experiment 1-3；若結果仍指向輸入路徑阻塞，建議塔台追加「renderer key event → xterm → pty IPC → main process」完整事件流調查工單。

### sprint-status.yaml 已更新
不適用（根目錄、`_bmad-output/`、`docs/` 皆未找到 `sprint-status.yaml`）

### 回報時間
2026-04-11 23:54 (UTC+8)
