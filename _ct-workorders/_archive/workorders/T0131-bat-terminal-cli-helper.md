# 工單 T0131-bat-terminal-cli-helper

## 元資料
- **工單編號**：T0131
- **任務名稱**：CLI Helper — BAT 內部終端建立腳本（WebSocket invoke）
- **狀態**：DONE
- **建立時間**：2026-04-16 23:03 (UTC+8)
- **開始時間**：2026-04-16 23:04 (UTC+8)
- **完成時間**：2026-04-16 23:11 (UTC+8)
- **前置工單**：T0129（env vars）+ T0130（UI 同步）

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低
- **降級策略**：不適用

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立腳本，不影響主程式

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/T0127-research-bat-internal-terminal-creation.md`（回報區 — WebSocket 協議格式）
- `_ct-workorders/T0129-bat-internal-terminal-remote-server.md`（回報區 — env vars 設計）
- `electron/remote/protocol.ts`（frame 格式定義）
- `electron/remote/remote-server.ts`（auth 驗證邏輯，確認 frame 細節）
- `electron/main.ts`（`terminal:create-with-command` handler 參數結構）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + xterm.js）

**背景**：
T0129 已在所有 BAT 內 PTY 終端注入兩個環境變數：
- `BAT_REMOTE_PORT`：RemoteServer WebSocket 端口（預設 9876）
- `BAT_REMOTE_TOKEN`：32 字元 hex 認證 token

T0130 已實作 UI 同步：透過 WebSocket 建立的終端會自動出現在 BAT 終端縮圖列。

**缺少的最後一環**：一個可在 BAT 終端內執行的 CLI 腳本，讀取 env vars 並透過 WebSocket 發送 `terminal:create-with-command` 請求。

**用法場景**（塔台 auto-session）：
```bash
# 取代目前的：
wt -w 0 nt claude "/ct-exec T0131"

# 改為：
bat-terminal claude "/ct-exec T0131"
# 或
node scripts/bat-terminal.mjs claude "/ct-exec T0131"
```

### WebSocket 協議（T0127 研究結論）

**連線流程**：
1. WebSocket 連線到 `ws://localhost:${BAT_REMOTE_PORT}`
2. 發送 auth frame：
   ```json
   { "type": "auth", "id": "<uuid>", "token": "<BAT_REMOTE_TOKEN>", "args": ["bat-terminal-cli"] }
   ```
3. 等待 auth 成功回應
4. 發送 invoke frame：
   ```json
   {
     "type": "invoke",
     "id": "<uuid>",
     "channel": "terminal:create-with-command",
     "args": [{
       "id": "<uuid>",
       "cwd": "<current working directory>",
       "command": "<完整命令字串>"
     }]
   }
   ```
5. 等待 invoke-result 回應
6. 關閉連線

### 預期產出

建立 `scripts/bat-terminal.mjs`（或 `.js`），單檔、零依賴（使用 Node.js 內建 `ws` 或 raw WebSocket）。

**功能需求**：
- 讀取 `BAT_REMOTE_PORT` 和 `BAT_REMOTE_TOKEN` 環境變數
- 未設定時清楚報錯：`Error: Not running inside BAT terminal (BAT_REMOTE_PORT not set)`
- 將所有命令列參數組合為 command 字串
- 透過 WebSocket 發送 auth → invoke
- 成功後輸出確認訊息並退出（exit 0）
- 失敗時輸出錯誤並退出（exit 1）
- 連線 timeout 3 秒

**用法範例**：
```bash
# 基本用法
node scripts/bat-terminal.mjs claude "/ct-exec T0131"

# 帶自訂參數
node scripts/bat-terminal.mjs claude "/ct-exec T0131" --dangerously-skip-permissions

# 非 claude 也行
node scripts/bat-terminal.mjs gemini

# 不帶參數：只開空終端
node scripts/bat-terminal.mjs
```

**可選加分**：
- 在 `package.json` 加 `bin` 或 `scripts` 入口，讓 `npx bat-terminal` 或 `npm run bat-terminal` 可用
- 支援 `--cwd <path>` 參數覆蓋工作目錄

### 驗收條件
- [ ] `scripts/bat-terminal.mjs` 存在且可執行
- [ ] 在 BAT 終端內執行 `node scripts/bat-terminal.mjs echo hello` 成功建立新終端
- [ ] 新終端出現在 BAT 縮圖列（T0130 的 UI 同步生效）
- [ ] `BAT_REMOTE_PORT` 未設定時清楚報錯
- [ ] 連線失敗時 3 秒 timeout 後退出
- [ ] 零外部依賴（僅 Node.js 內建模組）
- [ ] `npx vite build` 不受影響（腳本不參與 build）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 讀取 T0127 回報區（WebSocket 協議細節）
3. 讀取 `electron/remote/protocol.ts`（確認 frame 格式）
4. 讀取 `electron/remote/remote-server.ts`（確認 auth 驗證邏輯）
5. 更新「開始時間」欄位
6. 建立 `scripts/bat-terminal.mjs`
7. 在 BAT 終端內手動測試（若 BAT 已運行）
8. git commit
9. 填寫回報區

### 注意事項
- Node.js 18+ 內建 WebSocket（`globalThis.WebSocket`）或使用 `http` + raw upgrade — 確認 BAT 使用的 Node 版本
- 若 Node.js 版本不支援內建 WebSocket，改用 `net.Socket` 手動 WebSocket handshake，或使用 `ws` package（但要避免外部依賴）
- Electron 打包的 Node.js 通常較新（18+），但腳本在 shell 的 system Node 執行，需考慮相容性
- frame 是 JSON string，每個 frame 一條 JSON — 參考 `protocol.ts` 的序列化方式
- UUID 生成：可用 `crypto.randomUUID()`（Node 19+）或 `crypto.randomBytes(16).toString('hex')`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- **新增** `scripts/bat-terminal.mjs`：零依賴 CLI 腳本，使用 Node.js 內建 `net` + `crypto` 模組實作最小化 WebSocket client
  - 讀取 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 環境變數
  - Auth → Invoke `terminal:create-with-command` 完整流程
  - Shell quoting 處理含空格的參數（如 `"/ct-exec T0131"` → `'/ct-exec T0131'`）
  - 支援 `--cwd <path>` 可選參數
  - 3 秒連線 timeout
  - 環境變數缺失時清楚報錯
- **修改** `package.json`：新增 `"bat-terminal"` script 入口（`npm run bat-terminal -- claude /ct-exec T0131`）
- **Build 驗證**：`npx vite build` 通過，腳本不參與 build

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 23:11 (UTC+8)
