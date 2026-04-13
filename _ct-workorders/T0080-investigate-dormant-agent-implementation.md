# 工單 T0080-investigate-dormant-agent-implementation

## 元資料
- **工單編號**：T0080
- **任務名稱**：調查「休眠 Agent」功能實作狀態
- **狀態**：DONE
- **建立時間**：2026-04-13 11:18 (UTC+8)
- **開始時間**：2026-04-13 11:17 (UTC+8)
- **完成時間**：2026-04-13 11:19 (UTC+8)
- **相關單據**：（無）

---

## 工作量預估
- **預估規模**：極小（純調查，不修改程式碼）
- **Context Window 風險**：極低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：輕量調查，快速完成

---

## 任務指令

### 背景說明

BAT 的 Sidebar 右鍵選單中已有「休眠 Agent」選項（UI 可見），但不確定後端邏輯是否真正實作，或只是 UI stub（按了沒反應 / TODO 佔位）。

**休眠 Agent 預期功能**：暫停 Claude Agent session 並保存狀態，之後可恢復繼續執行（類似 pause/resume）。

---

### 調查步驟

1. **讀 `src/components/Sidebar.tsx`**
   - 找「休眠 Agent」選單項目
   - 確認點擊後呼叫哪個 function 或 IPC channel

2. **根據 step 1 找到的呼叫點，往下追蹤**：
   - 若呼叫 IPC → 讀 `electron/main.ts` 找對應 handler
   - 若呼叫 store function → 讀對應 store 檔案
   - 若呼叫 window.electronAPI.xxx → 讀 `electron/preload.ts`

3. **判斷實作狀態**（三選一）：
   - ✅ **已實作**：功能完整，說明實作方式
   - ⚠️ **部分實作**：UI 有接線但後端不完整，說明缺哪部分
   - ❌ **僅 UI stub**：handler 不存在、空函式、`// TODO`、或 `console.log` 佔位

---

### 預期產出（回報區填寫）

1. 點擊「休眠 Agent」後的呼叫鏈（function → IPC → handler）
2. 實作狀態判斷（✅ / ⚠️ / ❌）
3. 若已實作：說明 session 如何被暫停/保存（session ID? state snapshot?）
4. 若未實作或部分實作：缺少哪些部分，估計實作難度

**不需要修改任何程式碼。**

---

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 呼叫鏈

```
Sidebar.tsx (UI)
  ├─ contextMenu open → window.electronAPI.claude.isResting(agent.id) → 取得休眠狀態
  └─ click handler:
       ├─ agentResting=true  → window.electronAPI.claude.wakeSession(agent.id)
       └─ agentResting=false → window.electronAPI.claude.restSession(agent.id)

preload.ts (IPC Bridge, L214-219)
  ├─ restSession  → ipcRenderer.invoke('claude:rest-session')
  ├─ wakeSession  → ipcRenderer.invoke('claude:wake-session')
  └─ isResting    → ipcRenderer.invoke('claude:is-resting')

main.ts (Handler Registration, L1440-1442)
  ├─ 'claude:rest-session' → claudeManager.restSession(sessionId)
  ├─ 'claude:wake-session' → claudeManager.wakeSession(sessionId)
  └─ 'claude:is-resting'   → claudeManager.isResting(sessionId)

claude-agent-manager.ts (Backend Implementation)
  ├─ restSession() (L1963): kill subprocess → set isResting=true → send system message
  ├─ wakeSession() (L2023): set isResting=false（下次 sendMessage 自動重連）
  ├─ isResting()   (L2030): return session.isResting ?? false
  └─ sendMessage()  (L443): auto-wake — if (session.isResting) session.isResting = false
```

### 實作狀態
✅ 已實作 — 功能完整，前後端均有實作

### 詳細說明

**休眠機制（Rest）**：
1. 呼叫 `restSession(sessionId)` 時，先 kill Claude SDK subprocess（`queryInstance.close()`）
2. 清除 `queryInstance = undefined`，釋放記憶體與 CPU
3. 設定 `session.isResting = true` 作為狀態旗標
4. 保留 `sdkSessionId` 以供後續 resume 使用
5. 向前端發送系統訊息通知使用者 session 已進入休眠

**喚醒機制（Wake）**：
1. `wakeSession()` 僅設定 `isResting = false`
2. **不會**立即重啟 subprocess — 採用 lazy 策略
3. 使用者下次在該 session 發送訊息時，`sendMessage()` 會自動偵測並重新連接（auto-wake at L443）
4. 使用保留的 `sdkSessionId` 進行 resume，恢復先前的對話上下文

**UI 層**：
- Sidebar 右鍵選單根據 `agentResting` 狀態切換顯示「休眠 Agent」或「喚醒 Agent」
- 每次開啟 context menu 都會即時查詢 `isResting` 狀態
- i18n 三語言完備（en/zh-TW/zh-CN）

**注意事項**：
- `electron.d.ts` 型別定義中**未宣告**這三個方法（`restSession`/`wakeSession`/`isResting`），不影響執行但 TypeScript 型別不完整

### 若未完整實作：缺少部分與難度估計
功能已完整實作。唯一小缺漏是 `electron.d.ts` 缺少對應型別宣告，屬於極小修補（5 分鐘）。
