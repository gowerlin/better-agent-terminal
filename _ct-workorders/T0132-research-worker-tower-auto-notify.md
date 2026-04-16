# 工單 T0132-research-worker-tower-auto-notify

## 元資料
- **工單編號**：T0132
- **任務名稱**：研究：Worker 完成後自動通知 Tower session（跨終端 IPC）
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-16 23:17 (UTC+8)
- **開始時間**：2026-04-16 23:18 (UTC+8)
- **完成時間**：2026-04-16 23:30 (UTC+8)
- **前置工單**：T0129（env vars）+ T0130（UI 同步）+ T0131（bat-terminal.mjs）

## 研究目標

調查如何讓 Worker session（BAT 內終端）完成工單後，自動通知 Tower session（另一個 BAT 內終端），取代使用者手動切換 tab + 貼上「T#### 完成」的操作。

**核心問題**：
1. Worker 如何取得 Tower 終端的 PTY ID？
2. 如何透過 WebSocket 寫入 Tower 終端的 stdin（模擬使用者輸入）？
3. 寫入時機和安全性如何保障？

## 已知資訊

1. **RemoteServer WebSocket**：所有 BAT 內終端都可透過 `BAT_REMOTE_PORT` + `BAT_REMOTE_TOKEN` 連線
2. **pty:write channel**：`electron/pty-manager.ts` 有 `write(id, data)` 方法，可向指定 PTY 寫入數據
3. **handler-registry**：`pty:write` 是否在 handler registry 中可用需確認
4. **bat-terminal.mjs**：T0131 已實作 WebSocket auth + invoke 的基礎，可作為 `bat-notify.mjs` 的參考
5. **BAT_SESSION=1**：所有 BAT 內終端都有此 env var

## 調查範圍

### 必須釐清

1. **PTY ID 傳遞機制**
   - BAT 內的終端是否有方式取得自己的 PTY ID？（env var? 命令?）
   - 搜尋 PTY 建立流程：ID 是如何生成的？（UUID? 自增?）
   - 是否可在 `pty-manager.ts` spawn 時注入 `BAT_TERMINAL_ID` env var？
   - Tower 塔台派發時，能否把自己的 terminal ID 傳給 Worker？

2. **pty:write 可用性**
   - `pty:write` 是否在 handler-registry 中註冊？
   - 能否透過 RemoteServer WebSocket invoke `pty:write`？
   - 若不在 registry 中，是否可新增？
   - 是否有 `PROXIED_CHANNELS` 白名單限制？

3. **寫入時機與安全性**
   - Claude Code CLI 在等待 user input 時，stdin 寫入是否等同使用者打字？
   - 如果 Tower 的 Claude Code 正在「思考中」或「執行工具中」，此時寫入 stdin 會怎樣？
     - 會被 buffer 住等執行完？
     - 會被丟棄？
     - 會中斷當前操作？
   - 是否需要檢查 Tower 的 Claude Code 狀態後再寫入？

4. **完整流程設計**
   - 塔台派發工單時如何傳遞 `BAT_TOWER_ID`？
     - 方案 A：`bat-terminal.mjs` 額外參數 `--notify-id <id>`
     - 方案 B：env var 注入到 Worker PTY
     - 方案 C：寫入工單檔案的元資料
   - Worker（ct-exec skill）完成後如何觸發通知？
     - 方案 A：ct-exec/ct-done skill 收尾步驟自動呼叫 `bat-notify.mjs`
     - 方案 B：BAT 的 PTY close 事件觸發通知
     - 方案 C：Worker 手動呼叫

5. **替代方案評估**
   - BAT 內建通知系統（toast / 狀態列提示）vs PTY write
   - 檔案 watch（Tower 輪詢工單檔案狀態）
   - Electron IPC 全域事件（main process 廣播）

### 加分項

6. **多 Worker 並行場景**
   - 多個 Worker 同時完成時，連續寫入 Tower stdin 是否安全？
   - 是否需要排隊機制？

7. **通知格式**
   - 純文字「T0132 完成」？
   - 還是更結構化的格式讓 Tower 能 parse？

## 研究指引

- 從 `electron/pty-manager.ts` 開始，追蹤 PTY ID 生成和 write 方法
- 查看 `electron/remote/handler-registry.ts` 的 registered channels
- 查看 `electron/main.ts` 中 `pty:write` 相關的 handler 註冊
- 測試：在 BAT 終端 A 中，用 WebSocket 向終端 B 寫入文字，看 xterm 是否顯示
- 最終產出需包含：推薦方案 + 完整流程圖 + 預估改動量

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
- [23:22] Q: 通知行為/派發方式/功能範圍 → A: Q1=C(toast+stdin但不自動送出), Q2=B(塔台自動派發), Q3=A(最小可用) → Action: 確認安全性分析方向，PTY write 不帶 \r 可接受
- [23:24] Q: UI通知方式/格式/handler命名 → A: Q1=C(toast+tab badge), Q2=A+C(簡單文字+接受任意參數), Q3=我決定(穩定優先) → Action: 確定 `terminal:notify` 命名，整理最終結論

### 調查結論

**技術可行性：完全可行，基礎設施已齊備。**

#### 現有基礎（無需修改即可使用）

| 元件 | 位置 | 用途 |
|------|------|------|
| `pty:write` handler | `main.ts:1314` | 向指定 PTY 寫入 stdin 數據 |
| `pty:write` in PROXIED_CHANNELS | `protocol.ts:16` | WebSocket 可直接 invoke |
| RemoteServer 無 invoke 白名單 | `remote-server.ts:128-142` | 任何已註冊 handler 皆可呼叫 |
| `BAT_REMOTE_PORT` + `BAT_REMOTE_TOKEN` | `pty-manager.ts:398` | 每個 PTY 已注入 |
| `bat-terminal.mjs` MinimalWS | `scripts/bat-terminal.mjs` | 0 依賴 WebSocket 實作可複用 |
| `CtToast` 元件 + `useCtToast` hook | `src/components/CtToast.tsx` | 已有 toast 通知系統 |
| `ActivityIndicator` badge | `src/components/ActivityIndicator.tsx` | 已有 badge 模式 |
| `terminal:created-externally` 廣播模式 | `main.ts:1342-1351` | 已有 BrowserWindow 廣播先例 |
| `writeToTerminal(id, data)` | `pty-manager.ts:302-316` | 專用跨終端寫入方法 |

#### 缺少的環節

| 缺少項 | 解法 | 改動量 |
|--------|------|--------|
| PTY 不知道自己的 ID | 注入 `BAT_TERMINAL_ID` env var | 3 行 × 3 處 |
| Worker 不知道 Tower 的 PTY ID | `bat-terminal.mjs` 加 `--notify-id` 傳入 customEnv | ~15 行 |
| 跨終端通知 CLI 工具 | 新建 `bat-notify.mjs` | ~100 行 |
| UI 通知 handler | 新增 `terminal:notify` handler + 廣播事件 | ~15 行 |
| Toast + Tab badge 觸發 | Renderer 監聽 `terminal:notify` 事件 | ~30 行 |

#### PTY ID 機制分析

- **ID 格式**：UUID（renderer `uuidv4()`）或 hex random（CLI `randomBytes(16)`）
- **生成位置**：`workspace-store.ts:301`（UI 建立）或 `bat-terminal.mjs:53`（CLI 建立）
- **注入方式**：在 `pty-manager.ts` create() 的 3 處 env 組裝中加入 `BAT_TERMINAL_ID: id`

#### PTY stdin 寫入安全性分析

| 場景 | 不帶 `\r` 寫入結果 | 嚴重性 |
|------|-------------------|--------|
| Tower Claude 在 `>` prompt 閒置 | 文字出現在輸入行，使用者按 Enter 送出 | ✅ 理想 |
| Tower 使用者正在打字 | 注入文字混入使用者輸入 | ⚠️ 煩人但可清除 |
| Tower 在權限對話框 (Y/N) | 文字出現在權限輸入但不送出 | ⚠️ 干擾但無害 |
| Tower Claude 正在思考/執行 | 文字 buffer 住，返回 prompt 後出現 | ✅ 可接受 |

**結論**：不帶 `\r` 的 PTY write 安全性可接受，最壞情況只是文字汙染（可清除），不會造成意外操作。

### 建議方向

- [A] **雙管道通知（PTY write + UI 通知）**：`bat-notify.mjs` 同時 invoke `terminal:notify`（觸發 toast + tab badge）和 `pty:write`（預填文字不送出）。優點：使用者在 Tower tab 直接按 Enter 即可，同時有視覺提醒。缺點：PTY write 在使用者打字時會混入文字。
- [B] **純 UI 通知**：只做 toast + tab badge，不寫 PTY stdin。優點：零干擾。缺點：使用者必須手動打字或貼上。
- [C] **純 PTY write**：只寫 stdin 不做 UI 通知。優點：最小改動。缺點：如果 Tower 不在前景看不到。
- **推薦**：**方案 A**。理由：UI 通知是主要信號（100% 安全），PTY write 是便利功能（可接受的低風險）。兩者互補，穩定性高。`bat-notify.mjs` 可加 `--no-pty-write` 旗標在需要時關閉 PTY 寫入。

#### 推薦方案完整流程

```
┌─────────────────────────────────────────────────────┐
│  1. pty-manager.ts create()                         │
│     注入 BAT_TERMINAL_ID=<uuid> 到每個 PTY env     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. Tower 塔台派發 Worker                            │
│     bat-terminal.mjs --notify-id $BAT_TERMINAL_ID   │
│     → customEnv: BAT_TOWER_TERMINAL_ID=<tower-uuid> │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  3. Worker PTY 建立，env 中有：                      │
│     BAT_TERMINAL_ID=<worker-uuid>                    │
│     BAT_TOWER_TERMINAL_ID=<tower-uuid>               │
│     BAT_REMOTE_PORT / BAT_REMOTE_TOKEN               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  4. Worker ct-exec 收尾 Step 11                      │
│     偵測 $BAT_TOWER_TERMINAL_ID 存在                 │
│     → node bat-notify.mjs                            │
│         --target $BAT_TOWER_TERMINAL_ID              │
│         "T0132 完成"                                 │
└──────────┬─────────────────────┬────────────────────┘
           ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────┐
│ terminal:notify  │  │ pty:write                     │
│ → BrowserWindow  │  │ → Tower PTY stdin             │
│   broadcast      │  │   "T0132 完成"（不帶 \r）    │
│ → Toast 彈窗     │  │ → 文字出現在輸入行            │
│ → Tab badge 閃爍 │  │ → 使用者按 Enter 送出         │
└──────────────────┘  └──────────────────────────────┘
```

#### 預估改動量

| 檔案 | 改動 | 行數 |
|------|------|------|
| `electron/pty-manager.ts` | 注入 `BAT_TERMINAL_ID` env（3 處） | ~9 |
| `scripts/bat-terminal.mjs` | 新增 `--notify-id` 參數 + customEnv 傳遞 | ~15 |
| `scripts/bat-notify.mjs` | **新檔**：WebSocket CLI 通知工具（複用 MinimalWS） | ~120 |
| `electron/main.ts` | 註冊 `terminal:notify` handler + BrowserWindow 廣播 | ~15 |
| `electron/remote/protocol.ts` | PROXIED_CHANNELS 加 `terminal:notify`、PROXIED_EVENTS 加 `terminal:notified` | ~2 |
| `src/components/TerminalThumbnail.tsx` | 監聽事件 + 顯示 notification badge | ~20 |
| `src/App.tsx` 或頂層元件 | 監聽 `terminal:notified` + 觸發 CtToast | ~15 |
| **合計** | | **~196 行** |

#### 建議工單拆分（3 張）

1. **T0133 — BAT_TERMINAL_ID env var 注入**：pty-manager.ts 3 處 + bat-terminal.mjs --notify-id（~24 行）
2. **T0134 — bat-notify.mjs CLI 工具 + terminal:notify handler**：核心通知管道（~137 行）
3. **T0135 — Renderer 通知 UI**：Toast 觸發 + Tab badge（~35 行）

### 建議下一步
- [x] 開實作工單（建議方案 A：雙管道通知，3 張工單 T0133/T0134/T0135）

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 23:30 (UTC+8)
