# 工單 T0038-ux004-close-terminal-warning-consistency

## 元資料
- **工單編號**：T0038
- **任務名稱**：UX-004 關閉終端警告一致性：調查觸發邏輯 + 修正為「有 process 必警告」
- **狀態**：DONE
- **建立時間**：2026-04-12 12:08 (UTC+8)
- **開始時間**：2026-04-12 12:14 (UTC+8)
- **完成時間**：2026-04-12 12:20 (UTC+8)
- **目標子專案**：（單一專案）
- **工單類型**：🔍 **Investigation + Bug Fix**

## 工作量預估
- **預估規模**：小～中（30-60 min）
- **Context Window 風險**：低
- **降級策略**：若邏輯複雜，先回報調查結果，塔台決定修正策略

## Session 建議
- **建議類型**：🆕 新 Session
- **前置工單**：T0037（已完成，ActivityIndicator 狀態邏輯已清楚）

---

## 背景與問題

### 使用者觀察
點擊「關閉終端」有時出現警告：
> 任何正在執行的程序將被終止

有時不出現，行為不一致，感覺像隨機。

### 特別觀察
- 在 Claude Code TUI（alt buffer）內，有時能直接關（無警告），有時有警告
- 使用者原本以為「shell 層 idle = 不警告」，但 TUI 情境打破了這個假設

### 期望行為（已確認）
**只要有任何 process 在執行中（含 Claude Code TUI 本身），關閉終端一律顯示警告。**
- Alt buffer 模式（vim、Claude Code TUI 等）= 一律視為「有 process 在跑」→ 必警告
- Shell idle（無 foreground process，無 alt buffer）= 不警告

---

## 任務指令

### Step 1：定位警告觸發邏輯

搜尋警告 dialog 的觸發點：
```bash
grep -rn "將被終止\|will be terminated\|程序將\|closeConfirm\|onClose\|handleClose\|confirmClose" src/ --include="*.tsx" --include="*.ts" | head -30
```

找到後確認：
- 警告在哪個元件觸發（`MainPanel.tsx`？`TerminalPanel.tsx`？其他？）
- 觸發條件是什麼（哪個 state / flag / 函式決定是否顯示警告）
- 這個條件為何會不一致（race condition？事件時序？）

### Step 2：調查不一致的根本原因

**常見嫌疑**：

1. **基於 `hasPendingAction`**（從 T0037 得知此 flag 存在）
   - 若是這個：`hasPendingAction` 的更新是否有 race condition 或延遲？
   - Claude Code TUI 啟動/運作時，`hasPendingAction` 是否正確設為 `true`？

2. **基於 process detection（IPC）**
   - 是否透過 Electron IPC 詢問 shell 是否有 foreground process？
   - Alt buffer app（Claude Code TUI）是否被這個偵測機制認定為「有 process」？

3. **基於 alt buffer 狀態**（從 T0033-A 得知 `isAltBuffer` flag 存在）
   - 關閉時是否有讀取 `isAltBuffer` 決定是否警告？
   - 若有，為何有時沒讀到？

4. **Activity timing**（從 T0037 得知 `lastActivityTime` 存在）
   - 若基於「最近有輸出 = 有 process」，10 秒 timeout 會造成不一致

記錄根本原因，**選出最可能的機制**。

### Step 3：修正為「有 process 必警告」

根據 Step 2 的調查，修正邏輯使其滿足以下規則：

```
shouldWarn =
  isAltBuffer       // alt buffer 模式 = 一定有外部 process（TUI app）
  || hasPendingAction  // 有待處理操作
  || <其他可靠的 process 偵測條件>
```

**修正原則**：
- **寧可多警告，不要少警告**（false positive 可接受，false negative 不可接受）
- 不要依賴有 timing 問題的條件（如 `lastActivityTime` 的 10 秒 window）
- Alt buffer = 必警告，這是最明確的條件

### Step 4：連帶檢查（若有時間）

T0036 加入了「重新啟動終端」的確認框，確認：
- 「關閉終端」和「重新啟動終端」的警告邏輯是否用同一套 `shouldWarn` 判斷？
- 若是，修正後兩者都會受益
- 若不是，評估是否需要統一

### Step 5：驗證

手動測試以下情境：

| 情境 | 期望行為 |
|------|---------|
| Shell idle，無任何 process | 直接關閉，不警告 |
| Shell 有 foreground process（如 `sleep 100`） | 顯示警告 |
| Claude Code TUI 執行中（alt buffer） | 顯示警告 |
| Claude Code TUI idle（等待輸入，alt buffer） | 顯示警告 |
| vim / less 等 alt buffer app | 顯示警告 |

- [ ] 以上 5 種情境行為符合期望
- [ ] build 通過（`npx vite build`）
- [ ] 無 regression（正常 shell 操作不受影響）

### 預期產出
- 修正警告觸發邏輯的相關檔案
- git commit：`fix(terminal): ensure close warning appears for any running process (UX-004)`
- 更新本工單回報區（含根本原因說明）

### 執行注意事項
- **日誌**：使用 `window.electronAPI.debug.log()` 而非 `console.log()`
- **參考 T0037**：`ActivityIndicator.tsx` 的三種狀態（active/idle/pending）和 `hasPendingAction` 邏輯已調查清楚，可直接參考
- **參考 T0033-A**：`isAltBuffer` flag 已在 T0033-A 實作，確認可用

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 根本原因
`handleCloseTerminal`（WorkspaceView.tsx）警告邏輯只判斷 `agentPreset` 類型：
- Agent terminal（`agentPreset !== 'none'`）→ 永遠顯示警告
- 普通 PTY shell（無 agentPreset）→ 永遠不顯示警告

`isAltBuffer` 只是 `TerminalPanel.tsx` 的 local state（`altBufferRef.current`），無法被 `WorkspaceView` 的關閉邏輯讀取。因此，在普通 shell 中執行 Claude Code CLI / vim / less 等 alt buffer app 時，關閉終端不會觸發警告。

### 修正方式
四個檔案修改：

1. **`src/types/index.ts`** — `TerminalInstance` 新增 `isAltBuffer?: boolean` 欄位
2. **`src/stores/workspace-store.ts`** — 新增 `setTerminalAltBuffer(id, isAlt)` 方法
3. **`src/components/TerminalPanel.tsx`** — buffer change handler 中加入 `workspaceStore.setTerminalAltBuffer(terminalId, isAlt)`，將 alt buffer 狀態同步到 store
4. **`src/components/WorkspaceView.tsx`** — `handleCloseTerminal` 改為：
   ```
   shouldWarn = isAgentTerminal || isAltBuffer || hasPendingAction
   ```
   → 「寧可多警告」原則，任一條件成立即顯示警告

連帶確認：重新啟動確認（`MainPanel.tsx`）已是無條件顯示，行為正確，無需修改。

### Git 摘要
- commit `6b0855f`：`fix(terminal): ensure close warning appears for any running process (UX-004)`
- 修改 4 個檔案，18 insertions / 3 deletions

### 遭遇問題
無

### 回報時間
2026-04-12 12:20 (UTC+8)
