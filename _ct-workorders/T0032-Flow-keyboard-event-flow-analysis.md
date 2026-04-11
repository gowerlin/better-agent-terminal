# 工單 T0032-Flow-keyboard-event-flow-analysis

## 元資料
- **工單編號**：T0032-Flow
- **任務名稱**：BAT 完整鍵盤事件流深度調查（renderer → xterm → IPC → main → node-pty）
- **狀態**：DONE
- **建立時間**：2026-04-12 00:02 (UTC+8)
- **開始時間**：2026-04-12 00:09 (UTC+8)
- **完成時間**：2026-04-12 00:15 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔍 **Pure Investigation**（無 code 修改，無 git commit）
- **平行工單**：T0032（PARTIAL，Section 4 等人類）、T0032.5（平行派發）

## 工作量預估
- **預估規模**：中-大（1.5-2h）
- **Context Window 風險**：中（BAT 自己的源碼，範圍比 VS Code 小很多）
- **降級策略**：若 IPC 層結構比預期複雜，先完成 renderer 到 preload 的段落，main process 部分標 PARTIAL，建議塔台追加

## Session 建議
- **建議類型**：🆕 **新 Session**（必須）
- **原因**：
  1. 和 T0032.5 平行跑，各自獨立 session 避免互相污染
  2. T0032 的 PARTIAL 狀態使 T0032 工單被鎖定，不該在同一 session 延續
  3. 塔台 session 繼續待命

## 任務指令

### 前置條件

**必讀文件**（按順序）：
1. `_ct-workorders/reports/T0032-bug008-bug010-investigation.md` **Section 2 + Section 5.3**
   - Section 2 = BAT 的 xterm 層已盤點結果（本工單不重做）
   - Section 5.3 = Worker 在 T0032 主動提出本工單的動機（「renderer key event → xterm → pty IPC → main process」完整事件流）
2. `_ct-workorders/_learnings.md` **L026**（H1 關於鍵盤 freeze 的推測，line 916-985）

### 輸入上下文

#### 問題焦點

**BUG-010（Claude Code streaming 期間鍵盤完全 freeze）** 的根因尚未被 T0032 證實。

L026-H1 推測「event subscription 只綁 normal buffer」，但 T0032 Section 2 顯示：
- `onData` 和 `attachCustomKeyEventHandler` 看起來是 **buffer-agnostic**
- 沒有直接看到 normal/alt 的分流

**新假設（H2，本工單要驗證）**：
> BUG-010 的 freeze 可能**不是** xterm event routing 問題，而是**下游**（xterm → IPC → main → node-pty）某處有 **backpressure / buffer saturation / async race / main thread starvation**，導致 keyboard event 被丟棄或卡在 queue。

**候選機制**：
1. **IPC channel backpressure**：Claude Code streaming 產生大量 output → `pty.onOutput` 通道飽和 → renderer 的 `pty.write`（keyboard input）卡在同一條 IPC 等送出
2. **Main thread long task**：大量 ANSI 解析在 main process 或 renderer main thread 執行 → `pty.write` 的 IPC handler 來不及 schedule
3. **node-pty write buffer 阻塞**：PTY 的 write 因 cooked mode / flow control 被延遲
4. **Renderer 端 React re-render starvation**：每個 streaming chunk 觸發 state update → React schedule keyboard event 的 handler 延遲

### 執行步驟

#### Phase 1：鍵盤入口層（~20 min）

從 `src/components/TerminalPanel.tsx` 的兩個 handler 往下追：

1. **`onData` handler**（line 331-337）
   - 讀 handler 本體，看它呼叫什麼
   - 追到 `window.electronAPI.pty.write`（或類似）的定義
   - 問題：這個 call 是同步還是異步？有 await 嗎？有 buffer 嗎？

2. **`attachCustomKeyEventHandler`**（line 349-448）
   - 讀 handler 本體，看 ESC / Ctrl+C 的特殊處理
   - 是否有「先攔截再 dispatch」的邏輯？被攔截的事件會不會進不了 `onData`？

#### Phase 2：Preload / IPC bridge 層（~30 min）

從 `window.electronAPI.pty` 往上追：
- Grep `electronAPI.pty` 找 preload 定義（通常在 `src/preload.ts` 或 `electron/preload.ts`）
- 讀 preload 的 `pty` 物件定義，看 `write` / `onOutput` / `onExit` 各自用哪個 `ipcRenderer.xxx`
- 是否 `invoke`（雙向）還是 `send`（單向）？
- **關鍵**：`pty.write` 和 `pty.onOutput` 用的是**同一條 channel** 還是**不同 channel**？

#### Phase 3：Main process PTY 層（~30 min）

從 preload 定位的 IPC channel 名往 main process 追：
- Grep `ipcMain.handle` 或 `ipcMain.on` 找 PTY 相關 handler
- 讀 PTY 的建構處（`new Pty(...)` 或 `pty.spawn`）
- 看 PTY output → renderer 的 forwarding 邏輯
- **關鍵**：PTY output 是同步 flush 給 renderer 還是有 buffer / debounce？

#### Phase 4：寫回報（~20 min）

產出核心是**事件流圖**（ASCII 或 Mermaid）+ 每一跳的**阻塞風險評估**。

### 預期產出

**單一檔案**：`_ct-workorders/reports/T0032-Flow-keyboard-event-flow-analysis.md`

```markdown
# T0032-Flow — BAT 鍵盤事件流深度分析

## 1. 摘要與本工單焦點
## 2. 事件流全貌（圖）
（Mermaid 或 ASCII 圖：鍵盤按下 → TerminalPanel onData → preload electronAPI.pty.write → IPC → main ipcMain handler → node-pty write → child process）

## 3. 逐跳分析

### 3.1 Renderer 層
#### 3.1.1 onData handler
#### 3.1.2 attachCustomKeyEventHandler
#### 3.1.3 同步/異步 / buffer 行為

### 3.2 Preload / IPC bridge 層
#### 3.2.1 electronAPI.pty.* 定義
#### 3.2.2 Channel 設計（單向/雙向、共用/分離）
#### 3.2.3 Backpressure 風險點

### 3.3 Main process 層
#### 3.3.1 IPC handler 定位
#### 3.3.2 node-pty 封裝方式
#### 3.3.3 Output forwarding 機制

## 4. 阻塞點假設驗證

| 候選 | 是否成立 | 證據 | 影響範圍 |
|------|--------|------|---------|
| H2a：IPC channel backpressure | ??? | ??? | ??? |
| H2b：Main thread long task | ??? | ??? | ??? |
| H2c：node-pty write buffer 阻塞 | ??? | ??? | ??? |
| H2d：Renderer React starvation | ??? | ??? | ??? |

## 5. 與 Experiment 2 的關聯
（若人類跑 Exp 2 看到 main thread long task，對照本分析哪個候選是主因）

## 6. T0033 修法建議
### 6.1 低成本修補（只修最有嫌疑的單點）
### 6.2 中成本重構（分離 IPC channel / 加 flow control）
### 6.3 結構性治本（若 L026 + H2 都部分成立，建議什麼樣的架構）

## 7. 和 T0032.5 對照結果的整合策略
（本工單完成時 T0032.5 可能也完成了，建議塔台如何合併兩份建議）
```

### 驗收條件
- [ ] 產出 `_ct-workorders/reports/T0032-Flow-keyboard-event-flow-analysis.md`
- [ ] Section 2 有清楚的事件流圖（Mermaid 或 ASCII），涵蓋 renderer → preload → main → node-pty
- [ ] Section 3 每一跳都有具體檔案路徑 + line number 引用
- [ ] Section 4 對四個候選（H2a/b/c/d）每個都給出「成立/不成立/需 Exp2 結果」判斷
- [ ] Section 6 給出至少 2 種修法候選，帶預估改動範圍
- [ ] **無任何 source code 修改**
- [ ] **無任何 git commit**

### 執行注意事項
- **範圍界定**：只追「鍵盤 input」這條路徑（TerminalPanel → pty.write → main）。**不要**同時追 output 方向（`pty.onOutput` → terminal.write），除非它和 backpressure 直接相關
- **T0032 Section 2 是 ground truth**：不要重新 grep `@xterm/xterm`，直接從 `TerminalPanel.tsx:331` 往下追
- **和 T0032.5 分工清楚**：T0032.5 看 VS Code 對照，本工單看 BAT 內部。**不要查 VS Code 源碼**（那是 T0032.5 的工作）
- **不要越權改 code**：即使看到明顯 bug 也只能記錄在報告中，不能直接 fix
- **Async chain 要講清楚**：每個跨 process/channel 的 call 都要標明是 `invoke`/`send`/`post`，有無 `await`，有無 queue

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 產出報告：`_ct-workorders/reports/T0032-Flow-keyboard-event-flow-analysis.md`
- 更新工單：`_ct-workorders/T0032-Flow-keyboard-event-flow-analysis.md`（狀態、時間、回報區）
- 關鍵內容：完成 renderer → preload → main → node-pty 事件流圖、逐跳路徑與 H2a/H2b/H2c/H2d 判斷
- 限制遵循：無任何 source code 修改、無 git commit

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
（不適用）

### 回報時間
2026-04-12 00:15 (UTC+8)
