# BUG-031 — bat-terminal.mjs 建立的 PTY 被分配到錯的 workspace

## 元資料
- **BUG 編號**：BUG-031
- **標題**：外部 (`bat-terminal.mjs`) 建立的 PTY 沒有跟著 active workspace，被加到其他 workspace 的 tab 列表，導致使用者看不到（在當前 active workspace）但 Worker 確實有執行
- **狀態**：⏳ FIXING
- **嚴重度**：🟡 Medium（功能可用但 UX 嚴重受損 — 使用者得切 workspace 才能找到 Worker；非 critical fault）
- **修復工單**：T0137（派發於 2026-04-17 02:48）

## 根因修正紀錄
- 02:23 初版：誤判為「UI 完全沒新增 tab」+「孤兒 PTY」
- 02:35 修正：使用者親眼確認 PTY 真的有開，但被加到**其他 workspace** 的 tab 列表
- T0135 Item 5.2 PASS（`addExternalTerminal` 程式碼存在）+ 5.3 MANUAL 證明：**廣播 + 接收都 OK，問題在 workspace 分配邏輯**
- **可重現**：100%（每次 `bat-terminal.mjs` invoke 都重現）
- **建立時間**：2026-04-17 02:23 (UTC+8)
- **發現於**：T0135 派發 + 重派過程
- **關聯工單**：T0135（IN_PROGRESS — 將記錄此 BUG 為 Item 5.2 / 5.3 / 7.5 / 7.6 / 8.5 的 FAIL 根因）
- **關聯 BUG**：BUG-030（VERIFY — 路徑污染已修，但本 BUG 是更深層次的 UI 同步問題）

---

## 現象描述

### 預期行為（依 T0130 / T0131 設計）
1. `node scripts/bat-terminal.mjs claude "/ct-exec T0135"` 透過 WebSocket 呼叫 RemoteServer
2. RemoteServer 在 main process 建立新 PTY（spawn Claude Code with command）
3. main process 廣播 `terminal:created-externally` 事件
4. renderer 監聽該事件 → 在 UI tab 列表新增 tab + 縮圖 + 自動聚焦
5. 使用者看到新 tab，可以切換進去觀察 Worker 進度

### 實際行為
- Step 1-2 OK：`bat-terminal.mjs` 回傳 `✓ Terminal created`，且**確實有 Worker 進程啟動**（證據：T0135 工單檔案被該 Worker 修改為 IN_PROGRESS + 加入 Item 8.1 / 4.2 證據）
- Step 3-5 FAIL：BAT UI tab 列表**完全沒新增任何 tab**

### 證據
- 截圖：BAT 視窗只有 Tower 自己的 1 個 PTY tab，紅框位置標示「沒增加 Worker 終端」（使用者於 02:22 提供）
- 連續 3 次 invoke (02:08, 02:19, 02:21) — UI tab 數量始終為 1
- 工單 T0135 的回報區存在 Item 8.1 + 4.2 證據（Worker 真的有啟動 + 寫檔）

### 影響範圍
- **環境**：所有平台（不限 Git Bash）— 純 IPC / renderer 同步問題
- **影響功能**：
  - 塔台 auto-session BAT 路由實質失效（Worker 跑了但無人能看）
  - T0130 外部建立終端機制（Item 5.2 / 5.3）
  - T0133 Toast / Badge 通知（Item 7.5 / 7.6）— 連 tab 都沒就更別提 badge
  - 端到端使用者體驗（Item 8.5）
- **副作用**：每次 invoke 都產生**孤兒 PTY 進程**，使用者無法用 UI 關閉，需透過 OS 工具 (Task Manager / `taskkill`) 手動殺

---

## 根因分析（待 FIXING 工單調查）

可能位置：
1. `electron/main.ts` — `terminal:create-with-command` handler 是否有廣播 `terminal:created-externally`？
2. `electron/preload.ts` — `terminal:created-externally` channel 是否在 PROXIED_EVENTS / preload bridge 中？
3. `src/components/`（renderer）— 是否有 `ipcRenderer.on('terminal:created-externally', ...)` 監聽器？
4. `src/stores/workspace-store.ts` — 收到事件後是否正確建立 tab 物件 + 觸發 UI 更新？

需 grep + 對照 T0130 commit 找出實際的廣播鏈斷點。

---

## 孤兒 PTY 清理（緊急）

當前可能有 3 個孤兒 Worker PTY 還在 background 跑（02:08 / 02:19 / 02:21 各一）。建議使用者：

```powershell
# 列出所有 claude 進程
pwsh -Command "Get-Process | Where-Object { $_.ProcessName -like '*claude*' -or $_.ProcessName -like '*node*' } | Format-Table Id, ProcessName, StartTime, Path"

# 找出非當前 Tower session 的 claude 進程，逐個 kill
# (需小心，不要殺到 Tower 自己)
```

或在 BAT 中：File → Restart（會清理所有 PTY）

---

## 建議修復順序

1. **先清理孤兒 PTY**（避免資源浪費）
2. **修 BUG-031**（最深層問題）— 開 T0137 修復工單
3. T0137 完成後，再 resume T0135 全鏈路驗收

---

## 工單回報區（修復 Worker 填寫）

（待修復工單建立後填入）
