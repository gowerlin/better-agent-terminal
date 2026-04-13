# T0109 — 孤兒回收 + Config Settings UI + ASAR Unpack

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0109 |
| **標題** | PLAN-008 Phase 5：孤兒回收 + 可配置參數 Settings UI + ASAR 打包修正 |
| **類型** | 功能開發 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 20:26 UTC+8 |
| **完成時間** | 2026-04-13 20:36 UTC+8 |
| **優先級** | 中 |
| **建立時間** | 2026-04-13 20:20 UTC+8 |
| **相關** | PLAN-008 / D031（參數決策）/ T0106（Server） |
| **前置** | T0106 ✅ |
| **後續** | T0110（復原提示 UI） |

---

## 背景

三件獨立但都屬於 Terminal Server 收尾的工作：

1. **孤兒回收**：Terminal Server idle timeout 到期後，清理殘留 PTY 進程 + PID/port 文件
2. **Config Settings UI**：D031 決定 scroll buffer 和 idle timeout 可在設定面板調整
3. **ASAR Unpack**：T0106 回報的打包問題——`terminal-server.js` 需從 ASAR 解包才能被 `fork()` 載入

---

## 任務清單

### Step 1：孤兒回收機制

修改 `electron/terminal-server/server.ts`：

**Idle Timeout 行為強化**：
- disconnect 事件（fork IPC 斷開）+ 所有 TCP client 斷開 → 開始倒計時
- 倒計時到期 → 逐一 kill 所有 PTY → 關閉 TCP server → 移除 PID file + port file → `process.exit(0)`
- 任何新連線進來 → 重置 timer

**啟動時孤兒掃描**（修改 `electron/main.ts`）：
- `startTerminalServer()` 偵測到殭屍 PID（`isServerRunning()` 回 false 但 PID file 存在）
- 清理 PID file + port file
- 嘗試 `process.kill(pid, 'SIGTERM')` 做最後清理（忽略錯誤）

### Step 2：Config 設定項讀取

新增兩個設定項到 `settings.json`：

```typescript
// 設定 key
'terminalServer.scrollBufferLines': number   // 預設 1000，上限 5000
'terminalServer.idleTimeoutMinutes': number  // 預設 30，0 = 永不關閉
```

**讀取路徑**：
- `main.ts` 啟動 Server 時，從 settings.json 讀取設定值
- 透過 fork 的 env 變數或 IPC 訊息傳給 Server：
  ```typescript
  // 方案 A：env 變數（簡單，fork 時帶入）
  fork(serverScript, [], {
    env: {
      ...process.env,
      BAT_SCROLL_BUFFER_LINES: String(scrollBufferLines),
      BAT_IDLE_TIMEOUT_MS: String(idleTimeoutMinutes * 60000)
    }
  })
  ```
- Server 端 `server.ts` 從 `process.env` 讀取，套用到 RingBuffer maxLines 和 idle timeout

### Step 3：Settings UI 面板

修改 `src/components/SettingsPanel.tsx`，在適當的 section（建議放在 Terminal 相關設定區塊）加入：

**Scroll Buffer 設定**：
```
Terminal Server — Scroll Buffer Lines
[input: number] 預設 1000，範圍 100-5000
說明：重連後可恢復的終端輸出行數
```

**Idle Timeout 設定**：
```
Terminal Server — Idle Timeout
[select: 15 min / 30 min / 60 min / 永不關閉] 預設 30 min
說明：BAT 關閉後 Terminal Server 保持存活的時間
```

**設定值儲存**：透過現有 `settings:set` IPC handler 寫入 `settings.json`

> ⚠️ 設定變更後，需要重啟 Terminal Server 才生效。UI 上標示「重啟後生效」即可，不需要即時熱更新。

### Step 4：ASAR Unpack 設定

修改 `package.json` 的 `build` 區段：

```json
{
  "build": {
    "asarUnpack": [
      "dist-electron/terminal-server.js"
    ]
  }
}
```

> T0106 回報：`child_process.fork()` 無法讀取 ASAR 內的檔案，需要 unpack。
> 同時確認 `main.ts` 中 `fork()` 的路徑在 packaged mode 下解析正確（`app.isPackaged` → `process.resourcesPath + '/app.asar.unpacked/...'`）。

### Step 5：Build 驗證

```bash
npx vite build
```

---

## 不在範圍

- ❌ 復原提示 UI dialog（T0110）
- ❌ TCP 重連邏輯修改（T0108 已完成）

---

## 驗收條件

1. Server idle timeout 到期後正確 shutdown（kill PTY + 移除 PID/port file）
2. 殭屍 PID 偵測 + 自動清理
3. Settings UI 可調整 scroll buffer lines（100-5000）
4. Settings UI 可調整 idle timeout（15/30/60/永不）
5. 設定值正確傳入 Terminal Server
6. `package.json` ASAR unpack 設定正確
7. Packaged mode 下 `fork()` 路徑正確（若可測試）
8. Build 通過

---

## 交付物

- `electron/terminal-server/server.ts` 修改（idle shutdown 強化 + env 讀取）
- `electron/main.ts` 修改（殭屍清理 + 設定讀取 + fork env）
- `src/components/SettingsPanel.tsx` 修改（新增 2 個設定項）
- `package.json` 修改（asarUnpack）
- Git commit

---

## 回報區（Worker 填寫）

### 執行摘要
完成 4 個 Steps，共修改 7 個檔案，build 通過。

Step 1（孤兒回收）：`server.ts` 新增 `removePidFile` import，`shutdown()` 在 idle timeout 到期後同時清除 PID file 和 port file。`main.ts` 加入孤兒偵測（PID file 存在但 process 已死 → 清理文件 + 嘗試 SIGTERM）。

Step 2（Config 讀取）：`terminal-server.ts` 從 `process.env.BAT_SCROLL_BUFFER_LINES` / `BAT_IDLE_TIMEOUT_MS` 讀取並傳入 `TerminalServer` constructor。

Step 3（Settings UI）：Advanced tab 新增「Terminal Server」section，scroll buffer lines（number input 100-5000）+ idle timeout（select 15/30/60/永不）。

Step 4（ASAR）：`package.json` asarUnpack 加入 `dist-electron/terminal-server.js`。

### Config 傳遞方式
env 變數（方案 A）：`BAT_SCROLL_BUFFER_LINES` + `BAT_IDLE_TIMEOUT_MS`，main.ts fork 時帶入

### Settings UI 位置
Advanced tab，debugLogging section 之前，獨立「Terminal Server」section

### ASAR 路徑處理
asarUnpack 方式，不需修改 fork() 路徑（electron-builder 自動放入 app.asar.unpacked/）

### Commit Hash
ab98120

### 問題 / 卡點
無

### 完成時間
2026-04-13 20:36 UTC+8
