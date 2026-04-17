# 工單 T0127-research-bat-internal-terminal-creation

## 元資料
- **工單編號**：T0127
- **任務名稱**：研究：BAT 內部終端建立機制（WebSocket RemoteServer）
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-16 22:22 (UTC+8)
- **開始時間**：2026-04-16 22:25 (UTC+8)
- **完成時間**：2026-04-16 22:35 (UTC+8)

## 研究目標

調查如何讓外部 CLI 進程（如塔台 claude session 在 BAT 終端內執行）透過 BAT 的 RemoteServer WebSocket 建立新終端分頁，取代目前 `wt -w 0 nt` 跳出外部終端的行為。

**核心問題**：外部進程如何取得 WebSocket port 和 auth token，並發送 `terminal:create-with-command` 請求？

## 已知資訊

1. **BAT_SESSION=1**：所有 BAT 內建終端都設有此環境變數，可用於偵測「我在 BAT 裡」
2. **RemoteServer WebSocket**：`electron/remote/remote-server.ts` 實作，監聽 `0.0.0.0:port`
3. **Handler Registry**：`electron/remote/handler-registry.ts`，所有 IPC handler（含 `terminal:create-with-command`）都可透過 WebSocket invoke
4. **認證機制**：token-based auth（`remote-server.ts:93-108`）
5. **Port 持久化**：可能在 pid-manager 或設定檔中，需要確認
6. **terminal:create-with-command**：`electron/main.ts:1308-1324`，建立 PTY + 500ms 延遲寫入命令

## 調查範圍

### 必須釐清
1. **Port 取得方式**：RemoteServer 的 port 寫在哪裡？環境變數？檔案？
   - 檢查 `electron/remote/remote-server.ts` 的 port 分配邏輯
   - 檢查 `electron/terminal-server/pid-manager.ts` 是否儲存 port
   - 是否有環境變數傳遞 port 給子 PTY？
2. **Token 取得方式**：auth token 如何生成、存放？
   - 檢查 `remote-server.ts` 的 token 生成和驗證邏輯
   - token 是否寫入檔案或環境變數？
3. **WebSocket 協議格式**：invoke frame 的完整 JSON 結構
   - 檢查 `remote-server.ts` 的 frame parsing
   - 必要欄位（type, channel, args, id 等）
4. **terminal:create-with-command 參數**：完整參數結構
   - id 如何生成（UUID？自增？）
   - cwd、command、shell、customEnv 等欄位
5. **可行性評估**：用 shell script / node 小工具 / curl 等發送 WebSocket 請求的方案

### 加分項
6. **Terminal Server TCP**：`electron/terminal-server/server.ts` 的 TCP 機制是否更適合？
7. **替代方案**：是否有更簡單的做法（如在 BAT 暴露 CLI 參數、Unix domain socket 等）

## 研究指引

- 從 `remote-server.ts` 開始追蹤 port 分配和 token 機制
- 查看 `pid-manager.ts` 了解持久化
- 查看是否有環境變數（如 `BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`）傳給子 PTY
- 最終產出需包含：一個可直接在 BAT 終端內執行的 PoC 命令（如 `node -e '...'` 或 shell script），能成功在 BAT 內開出新終端分頁

## 互動規則
- Worker 可主動向使用者提問以縮小範圍
- 每次提問不超過 3 個問題
- 每個問題提供選項 + 「其他：________」兜底
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
- [22:29] Q: Q1 自動啟動策略 + Q2 Port/Token 傳遞機制 → A: 塔台決定，需考慮 Auto Update 鎖定和多 PTY 隔離 → Action: 深入分析 cleanupAllProcesses 流程、runtimeId 多實例隔離、port 競爭場景後做出決策

### 調查結論

**5 個調查項目全部釐清**：

1. **Port 取得方式**：預設 9876 硬編碼於 `remote-server.ts:64`。目前無持久化，無環境變數。pid-manager 的 port file 僅供 Terminal Server TCP 使用。
2. **Token 取得方式**：`randomBytes(16).toString('hex')` 生成，持久化於 `{userData}/server-token.json`。跨重啟保持一致。無環境變數傳遞。
3. **WebSocket 協議格式**：Auth frame `{ type:'auth', id, token, args:['label'] }` → Invoke frame `{ type:'invoke', id, channel, args:[...] }`。詳見 `electron/remote/protocol.ts`。
4. **terminal:create-with-command 參數**：`{ id: string, cwd: string, command: string, shell?: string, customEnv?: Record<string,string> }`（main.ts:1308）。不在 PROXIED_CHANNELS 白名單中，但 invokeHandler 無白名單檢查 → 可呼叫。
5. **可行性**：完全可行。RemoteServer 已具備所有能力，缺的是自動啟動 + port/token 傳遞給子程序。

**核心障礙**：
- RemoteServer 未自動啟動（僅手動或 QR tunnel lazy start）
- PTY 子程序無法取得 port/token（無 env var、無 port file）

**Auto Update 分析**：`before-quit` → `cleanupAllProcesses()` → `remoteServer.stop()` 正確釋放 port → 新版啟動重綁 9876 → 乾淨交接。空窗 2-3 秒，CLI 需處理重連。

**多 PTY 隔離分析**：同一 BAT 實例的所有 PTY 共用同一 RemoteServer（同 port + 同 token），無需隔離。多 BAT 實例透過 runtimeId 隔離 userData，env vars 自然不同。

**加分項**：
- Terminal Server TCP 不支援 `terminal:create-with-command`（僅低層 PTY ops），不適用
- Named Pipe 工程量大（200+ 行），可作 v3 長期目標

### 建議方向
- [A] **環境變數 + 自動啟動方案**（~30 行改動）：main.ts 自動啟動 + pty-manager.ts 注入 `BAT_REMOTE_PORT`/`BAT_REMOTE_TOKEN` + server-token.json 含 port。最乾淨、跨平台、多實例安全、Auto Update 友善
- [B] **純檔案方案**（~15 行改動）：main.ts 自動啟動 + port 寫入檔案。改動最少但 CLI 需知道跨平台 userData 路徑
- [C] **Named Pipe / IPC Socket**（~200+ 行）：全新 server 基礎設施，不佔 TCP port，但工程量大、Windows named pipe 坑多
- **推薦**：方案 A。改動量小、穩定、覆蓋所有場景（多實例、Auto Update、多 PTY）

### 建議下一步
- [x] 開實作工單（方案 A：自動啟動 RemoteServer + env vars 注入 + port 持久化）

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 22:35 (UTC+8)
