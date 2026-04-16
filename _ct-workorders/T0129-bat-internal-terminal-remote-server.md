# 工單 T0129-bat-internal-terminal-remote-server

## 元資料
- **工單編號**：T0129
- **任務名稱**：BAT 內部終端建立 — RemoteServer 自動啟動 + env vars 注入
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-16 22:39 (UTC+8)
- **開始時間**：2026-04-16 22:41 (UTC+8)
- **完成時間**：（完成時填入）
- **前置研究**：T0127（研究結論：方案 A 推薦）

## 工作量預估
- **預估規模**：中（~30 行核心改動，但跨 3-4 個關鍵檔案）
- **Context Window 風險**：中
- **降級策略**：若 Context Window 不足，先完成自動啟動 + env vars 注入，CLI helper 交後續工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：涉及 electron main process 核心邏輯，需完整 context

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0127-research-bat-internal-terminal-creation.md`（研究結論，回報區段）
- `electron/remote/remote-server.ts`（RemoteServer 實作，port 硬編碼 9876）
- `electron/remote/protocol.ts`（WebSocket 協議格式）
- `electron/remote/handler-registry.ts`（invokeHandler 機制）
- `electron/main.ts`（RemoteServer 啟動邏輯、terminal:create-with-command handler）
- `electron/pty-manager.ts`（PTY 建立，env vars 注入點）
- `electron/terminal-server/server.ts`（參考 BAT_SESSION env var 注入方式）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js）

**背景**：
目前塔台的 auto-session 使用 `wt -w 0 nt claude "/ct-exec T####"` 開外部 Windows Terminal 分頁。使用者希望在 BAT 內部統一管理終端。

T0127 研究結論確認 BAT 已有 RemoteServer WebSocket 機制可達成此目標，但有兩個障礙：
1. RemoteServer 未自動啟動（僅手動 QR tunnel lazy start）
2. PTY 子程序無法取得 port/token（無 env var、無 port file）

**方案 A 實作內容**（T0127 推薦）：

### Part 1：RemoteServer 自動啟動

修改 `electron/main.ts`，在 app ready 後自動啟動 RemoteServer：

```typescript
// 在 app.whenReady() 流程中，createWindow() 之後
// 參考現有的 remoteServer 啟動邏輯（搜尋 remote:start-server）
// 自動啟動，不需等 UI 手動觸發
```

**注意事項**：
- 確認現有的 `ipcMain.handle('remote:start-server', ...)` 邏輯
- 自動啟動要在 createWindow 之後、PTY 建立之前
- 失敗時靜默降級（log warning，不阻塞 app 啟動）
- Auto Update 場景：`before-quit` → `remoteServer.stop()` 已正確處理

### Part 2：Port + Token 注入 PTY 環境變數

修改 `electron/pty-manager.ts`，在 PTY spawn 時注入兩個環境變數：

```typescript
// 在 envWithUtf8 組合時加入
BAT_REMOTE_PORT: String(remoteServer.port)    // e.g. "9876"
BAT_REMOTE_TOKEN: remoteServer.token           // 32 字元 hex
```

**注入點參考**：搜尋 `BAT_SESSION` 的注入方式（行 389, 430, 494），用相同模式。

**取值方式**：
- Port：`remote-server.ts` 中 server 啟動後的 port（目前硬編碼 9876）
- Token：`server-token.json` 中讀取，或從 remoteServer 實例取得
- 需要讓 pty-manager 能存取 remoteServer 的 port/token（可能透過 getter、export、或傳參）

### Part 3：server-token.json 加入 port

修改 token 持久化邏輯，在 `server-token.json` 中同時儲存 port：

```json
{
  "token": "abc123...",
  "port": 9876
}
```

這讓外部工具也能透過讀取此檔案取得連線資訊（方案 B 的備用路徑）。

### Part 4（可選，加分）：CLI Helper Script

如果時間允許，建立一個簡單的 helper script（放在 `scripts/` 或 `tools/`），讓塔台可以呼叫：

```bash
# 用法：bat-terminal "claude /ct-exec T0129"
# 讀取 env vars BAT_REMOTE_PORT + BAT_REMOTE_TOKEN
# 透過 WebSocket 發送 terminal:create-with-command
```

這部分可以是 Node.js 小腳本或 shell + websocat。如果 Context Window 不足，可交後續工單。

### 預期產出
- 修改 `electron/main.ts` — RemoteServer 自動啟動
- 修改 `electron/pty-manager.ts` — 注入 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`
- 修改 `electron/remote/remote-server.ts`（或 token 相關模組） — server-token.json 含 port
- （可選）`scripts/bat-terminal.mjs` — CLI helper

### 驗收條件
- [ ] BAT 啟動後 RemoteServer 自動運行（無需手動觸發）
- [ ] 所有 BAT 內 PTY 終端都有 `BAT_REMOTE_PORT` 和 `BAT_REMOTE_TOKEN` 環境變數
- [ ] `server-token.json` 包含 port 欄位
- [ ] RemoteServer 啟動失敗時不阻塞 app 啟動（靜默降級）
- [ ] `npx vite build` 編譯通過
- [ ] （可選）CLI helper 可在 BAT 終端內成功建立新終端分頁

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 讀取 T0127 回報區的研究結論（確認技術細節）
3. 更新「開始時間」欄位
4. 讀取 `electron/main.ts` 的 RemoteServer 相關段落
5. 實作 Part 1：自動啟動
6. 讀取 `electron/pty-manager.ts` 的 env var 注入段落
7. 實作 Part 2：env vars 注入（需解決 pty-manager 存取 remoteServer 的方式）
8. 實作 Part 3：server-token.json 含 port
9. （可選）實作 Part 4：CLI helper
10. 執行 `npx vite build` 確認編譯通過
11. 啟動 app 驗證 RemoteServer 自動運行（檢查 log 或 env vars）
12. git commit
13. 填寫回報區

### 注意事項
- pty-manager 需要存取 remoteServer 的 port/token — 注意模組間的依賴方向，避免循環引用
- RemoteServer 啟動可能需要 await（async），確認 app ready 流程中的 async 處理
- 保持向下相容：RemoteServer 未啟動時，現有功能不受影響
- env vars 名稱統一大寫 + BAT_ 前綴，跟 BAT_SESSION 一致

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
完成 Part 1-3（Part 4 CLI helper 為可選，未實作）：

**修改檔案**：
- `electron/remote/remote-server.ts` — 新增 `currentToken` getter；`persistToken()` 改為同時寫入 port；`start()` 改為 server 啟動後才持久化 token+port
- `electron/main.ts` — app.whenReady 中 `remoteServer.configDir` 設定後自動呼叫 `remoteServer.start()`，失敗靜默降級；設定 `ptyManager.getRemoteServerInfo` callback
- `electron/pty-manager.ts` — 新增 `getRemoteServerInfo` callback 屬性；三處 `envWithUtf8` 組合皆注入 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（Terminal Server 代理、node-pty、child_process fallback）

**關鍵設計**：
- 使用 callback 模式（同 `onRequestNewServer`）避免模組循環引用
- env vars 僅在 RemoteServer 實際運行時注入（`getRemoteServerInfo` 回傳 null 則不注入）
- `server-token.json` 格式從 `{ token }` 擴展為 `{ token, port }`，向下相容（`loadPersistedToken` 只讀 token 欄位）
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
2026-04-16 22:47 (UTC+8)
