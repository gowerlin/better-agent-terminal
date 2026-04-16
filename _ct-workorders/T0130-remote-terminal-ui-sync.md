# 工單 T0130-remote-terminal-ui-sync

## 元資料
- **工單編號**：T0130
- **任務名稱**：外部建立終端的 UI 同步（縮圖 + xterm 綁定）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-16 22:43 (UTC+8)
- **開始時間**：2026-04-16 22:51 (UTC+8)
- **完成時間**：（完成時填入）
- **前置工單**：T0129（RemoteServer 自動啟動 + env vars 注入）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（跨 main process + renderer）
- **降級策略**：若 Context Window 不足，先完成 main→renderer 事件通知，UI 渲染交後續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要理解 renderer 的終端管理 state 結構

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0129-bat-internal-terminal-remote-server.md`（回報區，了解基礎設施實作結果）
- `electron/main.ts`（`terminal:create-with-command` handler，行 1308-1324）
- `electron/pty-manager.ts`（PTY 建立事件、data 事件綁定）
- `src/App.tsx` 或 `src/components/WorkspaceView.tsx`（終端列表 state 管理、xterm 綁定邏輯）
- `electron/preload.ts`（IPC channel 定義）
- `src/types/index.ts`（Terminal 型別定義）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js）

**問題描述**：
T0129 實作了 RemoteServer 自動啟動 + env vars 注入，使外部 CLI 可透過 WebSocket 呼叫 `terminal:create-with-command` 在 BAT 內建立 PTY 終端。

但目前 `terminal:create-with-command` handler 只在 **main process** 建立 PTY，**renderer（React UI）不知道新終端的存在**：
- 終端縮圖列不會出現新項目
- 沒有 xterm.js 實例綁定 PTY output
- 使用者看不到也操作不了這個終端

**需要的流程**：

```
RemoteServer WebSocket invoke
  → invokeHandler('terminal:create-with-command', opts)
  → ptyManager.create() ← 已有
  → ptyManager.write(command) ← 已有
  → 🆕 mainWindow.webContents.send('terminal:created-externally', terminalInfo)
  → 🆕 Renderer 收到事件
  → 🆕 加入 terminal list state
  → 🆕 建立 xterm.js 實例
  → 🆕 綁定 PTY data 事件
  → 🆕 終端縮圖出現
  → 🆕 （可選）自動切換到新終端
```

### 實作方向

#### Step 1：Main Process 發送通知

修改 `electron/main.ts` 的 `terminal:create-with-command` handler，在 PTY 建立成功後通知 renderer：

```typescript
registerHandler('terminal:create-with-command', (_ctx, opts) => {
  if (!ptyManager) return false
  const created = ptyManager.create({ id: opts.id, cwd: opts.cwd, ... })
  if (created && opts.command) {
    setTimeout(() => { ptyManager!.write(opts.id, opts.command + '\r') }, 500)
  }
  if (created) {
    // 🆕 通知 renderer
    mainWindow?.webContents.send('terminal:created-externally', {
      id: opts.id,
      cwd: opts.cwd,
      command: opts.command,
      // 其他 renderer 需要的資訊（agent preset、workspace 等）
    })
  }
  return created
})
```

#### Step 2：Preload 暴露監聽 API

在 `electron/preload.ts` 暴露 `onTerminalCreatedExternally` 監聽：

```typescript
onTerminalCreatedExternally: (callback: (info: {...}) => void) => {
  ipcRenderer.on('terminal:created-externally', (_event, info) => callback(info))
}
```

#### Step 3：Renderer 處理新終端

在 App.tsx 或 WorkspaceView.tsx 中監聽事件，執行與 UI 手動建立終端相同的流程：
- 加入 terminal list state
- 建立 xterm.js 實例
- 綁定 PTY data channel
- 更新終端縮圖列
- （可選）自動聚焦到新終端

**關鍵**：需要研究現有「手動建立終端」的流程，找到 state 更新 + xterm 綁定的入口函數，在事件 handler 中複用。

#### Step 4：ID 生成和 Workspace 關聯

外部 CLI 呼叫時需要傳入正確的資訊：
- `id`：terminal ID（需要 UUID 或自增邏輯）
- `cwd`：工作目錄（當前 workspace 的 folderPath）
- workspace 關聯（terminal 歸屬哪個 workspace tab）

可能需要在 WebSocket invoke 時包含 workspace 資訊，或預設歸入 active workspace。

### 預期產出
- 修改 `electron/main.ts` — handler 發送通知事件
- 修改 `electron/preload.ts` — 暴露監聽 API
- 修改 `src/App.tsx` 或 `src/components/WorkspaceView.tsx` — 處理外部建立的終端
- 可能修改 `src/types/index.ts` — 事件 payload 型別

### 驗收條件
- [ ] 透過 RemoteServer WebSocket 建立的終端在 BAT UI 底部終端縮圖列中出現
- [ ] 新終端的 xterm.js 正確綁定 PTY output（可看到命令輸出）
- [ ] 新終端可互動（鍵盤輸入正常傳遞到 PTY）
- [ ] 不影響現有 UI 手動建立終端的流程
- [ ] `npx vite build` 編譯通過
- [ ] （加分）新終端建立後自動切換聚焦

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 讀取 T0129 回報區（確認基礎設施實作結果）
3. 更新「開始時間」欄位
4. 研究現有「手動建立終端」的完整流程（UI → state → xterm → PTY 綁定）
5. 找到可複用的入口函數
6. 實作 Step 1：main process 通知
7. 實作 Step 2：preload 監聽 API
8. 實作 Step 3：renderer 處理（複用現有建立流程）
9. 處理 Step 4：ID 生成和 workspace 關聯
10. 執行 `npx vite build` 確認編譯通過
11. git commit
12. 填寫回報區

### 注意事項
- 複用現有邏輯是關鍵 — 不要從零建立 xterm 綁定，找到現有的函數重用
- 注意 React state 更新時機 — 確保 xterm 實例在 DOM mount 後才建立
- workspace 歸屬邏輯要合理（預設 active workspace 或 cwd 匹配）
- 清理邏輯：外部建立的終端關閉時也要正確清理（PTY kill + state 移除）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
完成 Step 1-4（外部建立終端的完整 UI 同步鏈路）：

**修改檔案**：
- `electron/main.ts` — `terminal:create-with-command` handler 在 PTY 建立成功且來源為非 renderer（`!ctx.windowId`，即 RemoteServer WebSocket）時，向所有 BrowserWindow 發送 `terminal:created-externally` 事件
- `electron/preload.ts` — `pty` 區段新增 `onCreatedExternally` 監聯 API，暴露 `terminal:created-externally` IPC channel
- `src/stores/workspace-store.ts` — 新增 `addExternalTerminal(info)` 方法，接受預設 ID（避免重複）、按 cwd 匹配 workspace（fallback 到 active workspace）、自動聚焦新終端
- `src/App.tsx` — 頂層 useEffect 監聽 `onCreatedExternally`，呼叫 `addExternalTerminal` 並 save，附帶 cleanup

**關鍵設計**：
- 使用 `!_ctx.windowId` 判斷是否為外部來源，避免 renderer 自己建立的終端觸發重複通知
- xterm.js 綁定無需額外程式碼 — TerminalPanel 的 `pty.onOutput` 全域監聽已按 ID 過濾，新終端進入 state 後 React 渲染自動完成綁定
- workspace 關聯：先按 cwd 前綴匹配，fallback 到 active workspace
- 終端標題顯示 `Remote: <command>` 方便辨識來源
- `npx vite build` ✅ 編譯通過

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 22:59 (UTC+8)
