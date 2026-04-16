# 工單 T0133-worker-tower-auto-notify

## 元資料
- **工單編號**：T0133
- **任務名稱**：Worker→Tower 自動通知（雙管道：PTY write + Toast/Badge）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-16 23:35 (UTC+8)
- **開始時間**：2026-04-16 23:36 (UTC+8)
- **完成時間**：（完成時填入）
- **前置研究**：T0132（研究結論：方案 A 推薦）

## 工作量預估
- **預估規模**：中（~200 行，跨 7-8 個檔案）
- **Context Window 風險**：中
- **降級策略**：若 Context Window 不足，先完成 Part 1-3（基礎設施），Part 4-5（UI 通知）交後續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：跨 main process + renderer + CLI 腳本，需完整 context

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0132-research-worker-tower-auto-notify.md`（回報區 — 完整結論和流程圖）
- `electron/pty-manager.ts`（env var 注入點，搜尋 `BAT_SESSION`）
- `electron/main.ts`（handler 註冊，搜尋 `terminal:create-with-command`）
- `electron/remote/protocol.ts`（PROXIED_CHANNELS / PROXIED_EVENTS）
- `scripts/bat-terminal.mjs`（複用 MinimalWS，參考 --notify-id 擴充）
- `src/components/CtToast.tsx`（現有 toast 系統）
- `src/components/TerminalThumbnail.tsx`（tab badge 位置）
- `electron/preload.ts`（IPC channel 定義）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js）

**T0132 研究結論摘要**：
- `pty:write` 已在 handler registry + PROXIED_CHANNELS 白名單，WebSocket 可直接 invoke
- PTY ID 格式為 UUID，在 `workspace-store.ts:301` 或 `bat-terminal.mjs:53` 生成
- 不帶 `\r` 的 PTY write 安全性可接受（預填文字，不自動送出）
- 現有 `CtToast` + `ActivityIndicator` badge 可複用
- `terminal:created-externally` 廣播模式可作為 `terminal:notify` 的參考

### 完整實作流程（T0132 推薦方案 A）

```
1. pty-manager.ts: 注入 BAT_TERMINAL_ID 到每個 PTY env
2. bat-terminal.mjs: 新增 --notify-id 參數 → customEnv 傳遞
3. bat-notify.mjs: 新建 CLI 通知工具
4. main.ts: 註冊 terminal:notify handler + BrowserWindow 廣播
5. Renderer: 監聽事件 → Toast + Tab badge
```

### Part 1：注入 BAT_TERMINAL_ID（~9 行）

修改 `electron/pty-manager.ts`，在 3 處 env 組裝中加入：

```typescript
BAT_TERMINAL_ID: id  // PTY 的 UUID
```

注入點：搜尋 `BAT_SESSION` 的 3 處（行 389, 430, 494 附近），用相同模式。

### Part 2：bat-terminal.mjs 擴充（~15 行）

修改 `scripts/bat-terminal.mjs`，新增 `--notify-id <id>` 參數：

```bash
node scripts/bat-terminal.mjs --notify-id abc123 claude "/ct-exec T0133"
```

行為：將 `--notify-id` 的值作為 `BAT_TOWER_TERMINAL_ID` 傳入新終端的 customEnv。

### Part 3：新建 bat-notify.mjs（~120 行）

建立 `scripts/bat-notify.mjs`，複用 `bat-terminal.mjs` 的 MinimalWS：

```bash
# 用法
node scripts/bat-notify.mjs --target <tower-pty-id> "T0133 完成"

# 或從 env 自動讀取
BAT_TOWER_TERMINAL_ID=abc123 node scripts/bat-notify.mjs "T0133 完成"
```

行為：
1. 讀取 `BAT_REMOTE_PORT` + `BAT_REMOTE_TOKEN`
2. 讀取 target ID（`--target` 參數 或 `BAT_TOWER_TERMINAL_ID` env var）
3. WebSocket auth
4. invoke `terminal:notify`：`{ targetId, message, source }` → 觸發 UI toast + badge
5. invoke `pty:write`：向 target PTY 寫入 message（不帶 `\r`）
6. 支援 `--no-pty-write` 旗標關閉 PTY 寫入

### Part 4：terminal:notify handler（~15 行）

修改 `electron/main.ts`，註冊新 handler：

```typescript
registerHandler('terminal:notify', (_ctx, opts: { targetId: string, message: string, source?: string }) => {
  // 廣播到所有 BrowserWindow（參考 terminal:created-externally 模式）
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('terminal:notified', opts)
  }
  return true
})
```

修改 `electron/remote/protocol.ts`：
- `PROXIED_CHANNELS` 加入 `'terminal:notify'`（若需要）
- 或確認 invokeHandler 無白名單限制（T0132 確認無限制）

修改 `electron/preload.ts`：
```typescript
onTerminalNotified: (callback: (info: { targetId: string, message: string, source?: string }) => void) => {
  ipcRenderer.on('terminal:notified', (_event, info) => callback(info))
}
```

### Part 5：Renderer UI 通知（~30 行）

在 `src/App.tsx` 或適當位置監聯 `onTerminalNotified` 事件：

1. **Toast 彈窗**：使用現有 `CtToast` 系統，顯示「Worker 完成：T0133 完成」
2. **Tab badge**：在 target terminal 的縮圖上顯示通知 badge（閃爍或數字）
3. badge 在使用者切換到該 terminal 後自動清除

### 預期產出
- 修改 `electron/pty-manager.ts` — BAT_TERMINAL_ID 注入
- 修改 `scripts/bat-terminal.mjs` — --notify-id 參數
- 新建 `scripts/bat-notify.mjs` — CLI 通知工具
- 修改 `electron/main.ts` — terminal:notify handler
- 修改 `electron/preload.ts` — onTerminalNotified 監聯
- 修改 `src/App.tsx` 或 `src/components/` — Toast + Badge UI
- 修改 `electron/remote/protocol.ts` — PROXIED_CHANNELS（如需要）

### 驗收條件
- [ ] 所有 BAT 內 PTY 終端都有 `BAT_TERMINAL_ID` 環境變數
- [ ] `bat-terminal.mjs --notify-id` 正確傳遞 `BAT_TOWER_TERMINAL_ID` 到新終端 env
- [ ] `bat-notify.mjs` 可在 BAT 終端內執行，向目標終端發送通知
- [ ] 目標終端（Tower）的 stdin 出現預填文字（不帶 `\r`，不自動送出）
- [ ] BAT UI 顯示 Toast 通知
- [ ] 目標終端的縮圖顯示 notification badge
- [ ] badge 在切換到該終端後自動清除
- [ ] `--no-pty-write` 旗標可關閉 PTY 寫入
- [ ] `npx vite build` 編譯通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 讀取 T0132 回報區（確認技術細節和流程圖）
3. 更新「開始時間」欄位
4. 實作 Part 1：BAT_TERMINAL_ID 注入
5. 實作 Part 2：bat-terminal.mjs --notify-id
6. 實作 Part 3：bat-notify.mjs
7. 實作 Part 4：terminal:notify handler + preload
8. 實作 Part 5：Renderer Toast + Badge
9. 執行 `npx vite build` 確認編譯通過
10. git commit
11. 填寫回報區

### 注意事項
- Part 3 複用 `bat-terminal.mjs` 的 MinimalWS class — 可直接 copy 或 extract 為共用模組
- pty:write 不帶 `\r` — 確保 message 結尾沒有換行符
- Toast 和 Badge 要處理多個通知同時到達的情況
- Badge 清除時機：使用者切換到目標終端（focus 事件）
- 零外部依賴原則同 bat-terminal.mjs

## 塔台補充（Renew #1）

**時間**：2026-04-16 23:48 (UTC+8)
**補充內容**：
> 如果通知目標終端不在當前 workspace，使用者看不到終端縮圖的 badge。需要向上冒泡通知。

**新指示**：

Part 5 擴充 — **跨 workspace 通知冒泡**：

通知 badge 需要三層顯示：

```
Layer 1: 終端縮圖 badge（已規劃）
  → 目標終端的縮圖上顯示未讀數字/點

Layer 2: Workspace 頁籤 badge（新增）
  → 如果目標終端不在當前 workspace
  → 該 workspace 的頁籤上顯示未讀數字/點
  → 切換到該 workspace 後，workspace badge 清除
  → 終端 badge 仍保留，直到切換到該終端

Layer 3: Workspace 側邊欄 item badge（新增，若有側邊欄的話）
  → 同 Layer 2 邏輯
```

**清除邏輯**：
- Workspace badge：使用者切換到該 workspace 時清除
- 終端 badge：使用者切換到該終端時清除
- Toast：自動消失（3-5 秒）

**驗收條件追加**：
- [ ] 通知目標在非當前 workspace 時，workspace 頁籤顯示 badge
- [ ] 切換到該 workspace 後，workspace badge 清除，終端 badge 仍在
- [ ] 切換到目標終端後，終端 badge 清除

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新建檔案（2）**：
- `scripts/bat-notify.mjs`（~260 行）：WebSocket 通知 CLI，雙管道（`terminal:notify` + `pty:write`），支援 `--target` / `--source` / `--no-pty-write` 旗標，複用 `bat-terminal.mjs` 的 MinimalWS 實作（零外部依賴）
- `src/stores/terminal-notifications.ts`（~85 行）：雙層通知 pub/sub store（terminal + workspace），模組級 Set + 訂閱模式（參考 `previewCache` 設計）

**修改檔案（9）**：
- `electron/pty-manager.ts`：3 處 env 組裝加入 `BAT_TERMINAL_ID: id`（Terminal Server 路徑、node-pty 路徑、child_process fallback 路徑）
- `scripts/bat-terminal.mjs`：新增 `--notify-id <id>` 參數，將 `BAT_TOWER_TERMINAL_ID` 注入新終端 customEnv
- `electron/main.ts`：新註冊 `terminal:notify` handler，廣播 `terminal:notified` 事件到所有 BrowserWindow
- `electron/remote/protocol.ts`：`PROXIED_CHANNELS` 加入 `terminal:notify`，`PROXIED_EVENTS` 加入 `terminal:notified`
- `electron/preload.ts`：新增 `onTerminalNotified` 監聽 API
- `src/App.tsx`：
  - import `markNotified` / `markWorkspaceNotified` / `clearWorkspaceNotification`
  - 訂閱 `onTerminalNotified`：顯示 toast、標記 terminal badge、若目標不在當前 workspace 則標記 workspace badge（Renew#1 冒泡）
  - `activeWorkspaceId` 變更時清除 workspace badge（保留 terminal badge）
  - JSX 加入 `.bat-notify-toast-stack` 右上角 toast 渲染
- `src/components/TerminalThumbnail.tsx`：
  - 訂閱 `subscribeNotification`，加 `.notification-badge` UI（紅色脈動 ●）
  - `isActive` 變 true 時自動 `clearNotification()`
- `src/components/Sidebar.tsx`：
  - 新增 `WorkspaceNotifyBadge` 子元件，訂閱 `subscribeWorkspaceNotification`
  - 插入到 `.workspace-alias` 內，動態顯示 workspace-level badge
- `src/styles/panels.css`：`.notification-badge` + `.workspace-notification-badge` 紅色脈動樣式（共用 `bat-notify-pulse` 動畫）
- `src/styles/notifications.css`：`.bat-notify-toast-stack` + `.bat-notify-toast` 右上角堆疊 toast，`batNotifySlideIn` 動畫

**三層通知冒泡架構**：
```
Worker (BAT internal terminal)
  ↓ bat-notify.mjs [dual-channel via WebSocket]
  ├─→ invoke terminal:notify → BrowserWindow broadcast → onTerminalNotified
  │     ├─ Layer 0 Toast（右上角，6s 自動消失）
  │     ├─ Layer 1 Terminal badge（目標縮圖上紅色脈動 ●，切換到該終端清除）
  │     └─ Layer 2 Workspace badge（目標所屬 workspace 不在當前時，側邊欄 item 顯示紅色脈動 ●，切換到該 workspace 清除）
  └─→ invoke pty:write（不帶 \r）→ 目標 Tower 終端 stdin 預填文字
```

### 互動紀錄
無（工單任務指令明確，T0132 研究已覆蓋所有技術細節，直接執行推薦方案 A；Renew#1 追加冒泡後亦無阻塞性問題）

### Renew 歷程
- **Renew #1**（2026-04-16 23:48）：追加跨 workspace badge 冒泡需求 → 實作 workspace-level notification store、Sidebar `WorkspaceNotifyBadge` 子元件、App.tsx 切換 workspace 時清除 workspace badge；`.workspace-notification-badge` CSS 共用脈動動畫。建置仍綠。

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 驗收條件檢查
原始驗收：
- [x] 所有 BAT 內 PTY 終端都有 `BAT_TERMINAL_ID` 環境變數（3 處 env 組裝）
- [x] `bat-terminal.mjs --notify-id` 正確傳遞 `BAT_TOWER_TERMINAL_ID` 到新終端 env
- [x] `bat-notify.mjs` 可在 BAT 終端內執行，向目標終端發送通知（雙管道）
- [x] 目標終端 stdin 預填文字（不帶 `\r`）— 透過 `pty:write` 不含換行
- [x] BAT UI 顯示 Toast 通知（`.bat-notify-toast-stack` 右上角）
- [x] 目標終端縮圖顯示 notification badge（`.notification-badge` 紅色脈動）
- [x] badge 在切換到該終端後自動清除（`isActive` useEffect）
- [x] `--no-pty-write` 旗標可關閉 PTY 寫入
- [x] `npx vite build` 編譯通過

Renew#1 追加驗收：
- [x] 通知目標在非當前 workspace 時，workspace 頁籤顯示 badge（`WorkspaceNotifyBadge` 在 Sidebar workspace-alias 旁）
- [x] 切換到該 workspace 後，workspace badge 清除，終端 badge 仍在（`activeWorkspaceId` useEffect 只清 workspace，不清 terminal）
- [x] 切換到目標終端後，終端 badge 清除（TerminalThumbnail `isActive` useEffect）

### 回報時間
2026-04-16 23:52 (UTC+8)
