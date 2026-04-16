# 工單 T0126-fix-ct-exec-done-button-command

## 元資料
- **工單編號**：T0126
- **任務名稱**：修復工單按鈕 ct-exec / ct-done 命令格式（shell → claude session）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-16 22:02 (UTC+8)
- **開始時間**：2026-04-16 22:03 (UTC+8)
- **完成時間**：（完成時填入）

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：不適用

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立修復，不影響其他功能

## 任務指令

### 前置條件
需載入的文件清單：
- `src/App.tsx`（行 720-753 附近，`onExecWorkOrder` / `onDoneWorkOrder`）
- `src/components/WorkspaceView.tsx`（行 580-613 附近，同上兩個 handler）
- `electron/main.ts`（行 1308-1324，`terminal:create-with-command` IPC handler）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js 終端模擬器）

**問題描述**：
CT 面板工單列表中的 ▶ Execute 和 🔧 Done 按鈕點擊後，會開一個新終端但**沒有任何動作**。

**根因分析**：
按鈕觸發的命令格式錯誤。目前的執行鏈：

```
按鈕 click → onExecWorkOrder(id) / onDoneWorkOrder(id)
  → command = `/ct-exec ${id}` 或 `/ct-done ${id}`
  → pty.createWithCommand({ command })
  → main.ts: ptyManager.create() + setTimeout 500ms + ptyManager.write(command + '\r')
  → 結果："/ct-exec T0125" 被寫入裸 shell（bash/powershell）
  → shell 不認識 /ct-exec → 無動作或 command not found
```

`/ct-exec` 和 `/ct-done` 是 **Claude Code 的 skill 指令**，只在 Claude Code session 內有效。直接丟進 shell 是無效的。

**正確的做法**：
command 應該是 `claude "/ct-exec ${id}"` 而非 `/ct-exec ${id}`。這樣：
1. shell 先啟動 `claude`（互動式 Claude Code session）
2. `"/ct-exec ${id}"` 作為初始訊息傳入
3. Claude Code 載入 ct-exec skill，Worker 開始執行工單
4. 使用者可在終端中與 Worker 互動

### 預期產出
- 修改 `src/App.tsx` 中 `onExecWorkOrder` 和 `onDoneWorkOrder` 的 command 生成邏輯
- 修改 `src/components/WorkspaceView.tsx` 中同樣的兩個 handler

### 驗收條件
- [ ] `onExecWorkOrder` 生成的 command 格式為 `claude "/ct-exec T####"`
- [ ] `onDoneWorkOrder` 生成的 command 格式為 `claude "/ct-done T####"`
- [ ] 兩個檔案（App.tsx、WorkspaceView.tsx）都已修改
- [ ] `npx vite build` 編譯通過
- [ ] 不影響其他終端功能（一般終端建立不受影響）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `src/App.tsx`，找到 `onExecWorkOrder` 和 `onDoneWorkOrder`
4. 將 command 從 `` `/ct-exec ${workOrderId}` `` 改為 `` `claude "/ct-exec ${workOrderId}"` ``
5. 將 command 從 `` `/ct-done ${workOrderId}` `` 改為 `` `claude "/ct-done ${workOrderId}"` ``
6. 讀取 `src/components/WorkspaceView.tsx`，找到同樣的兩個 handler，做相同修改
7. 執行 `npx vite build` 確認編譯通過
8. git commit
9. 填寫回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改 2 個檔案，共 4 處 command 格式修正：
- `src/App.tsx`：`onExecWorkOrder` command `/ct-exec ${id}` → `claude "/ct-exec ${id}"`
- `src/App.tsx`：`onDoneWorkOrder` command `/ct-done ${id}` → `claude "/ct-done ${id}"`
- `src/components/WorkspaceView.tsx`：`handleExecWorkOrder` 同上修正
- `src/components/WorkspaceView.tsx`：`handleDoneWorkOrder` 同上修正
- `npx vite build` 編譯通過

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 22:05 (UTC+8)
