# T0146 — 研究：托盤 Quit 為何 bypass Dialog（BUG-033 根因調查）

## 元資料
- **工單編號**：T0146
- **任務名稱**：研究：托盤 Quit 路徑為何沒觸發 Quit Dialog，Server 為何未結束
- **類型**：**research**（研究工單，允許 Worker 與使用者互動）
- **互動模式**：enabled
- **Renew 次數**：0
- **狀態**：✅ DONE
- **建立時間**：2026-04-17 14:35 (UTC+8)
- **開始時間**:2026-04-17 14:49 (UTC+8)
- **完成時間**：2026-04-17 14:55 (UTC+8)
- **優先級**：🔴 High（阻擋 PLAN-012 驗收 + next release）
- **關聯 BUG**：BUG-033（托盤 Quit 無 Dialog）
- **關聯 PLAN**：PLAN-012（Quit Dialog + Terminal Server CheckBox）
- **前置工單**：T0144（PLAN-012 實作，commit `412d52c`，疑似產生 regression）
- **預估難度**：⭐⭐⭐（多路徑 flow 比對 + 可能需要 trace log 配合重測）
- **預估耗時**：45-90 分鐘（視是否需要加 trace log 重測）

---

## 研究目標

T0144 實作了 PLAN-012（Electron 原生 `dialog.showMessageBox` + CheckBox + SIGTERM fallback），但使用者實測**從系統托盤 Quit 時**：
1. Dialog **完全沒出現**
2. BAT 直接退出
3. Terminal Server 仍在背景殘留

**要回答的核心問題**：
1. **Q1**：托盤 Quit 走的是哪條 quit 路徑？為什麼 bypass 掉 `before-quit` handler（或 bypass 掉 Dialog 顯示）？
2. **Q2**：其他 Quit 路徑（File 選單、Cmd/Ctrl+Q、視窗 X）是否也有同樣問題，還是只有托盤路徑壞？
3. **Q3**：根因是 code bug、事件時序、Electron 行為，還是 rebuild/packaging 問題？
4. **Q4**：修復方案推薦（多個候選，帶優缺點）

---

## 已知資訊

### 使用者測試環境
- **BAT 版本**：rebuild + 重裝後的新版（使用者已確認 Q1.A）
- **Quit 進入點**：系統托盤 Quit 選單項（使用者明確回報 Q2.D）
- **Log 目錄**：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`

### T0144 實作範圍（參考）
基於 T0143 研究結論（D035/D037）採方案 B：
- Electron 原生 `dialog.showMessageBox` + `checkboxLabel`
- `before-quit` event 攔截 + `event.preventDefault()`
- Dialog 回傳後決定是否 `app.exit()` + SIGTERM Terminal Server（帶 timeout fallback）
- i18n 訊息文案（zh-TW / en）
- Commit：`412d52c`（由 Worker）
- 修改範圍：`main.ts` ~60-80 行 + i18n 6 行，零 React 改動

### 使用者主動提議
「如果資訊不足建議加 Trace Log 我再重測」→ **Worker 允許採取「加 trace log → 請使用者重測」策略**。

---

## 調查範圍

### 必讀檔案
1. **Electron main process 入口**（`main.ts` 或 `electron/main.ts` 或 `src/main/index.ts`）
   - `before-quit` handler
   - `will-quit` handler
   - `window-all-closed` handler
   - Dialog 呼叫處
2. **Tray 實作檔**（搜尋 `Tray` / `setContextMenu` / `new Menu` 托盤選單建立處）
   - 托盤 Quit menu item 的 click handler
   - 確認是否呼叫 `app.quit()` / `app.exit()` / `app.isQuitting = true`
3. **T0144 commit 412d52c 的 diff**（`git show 412d52c`）
   - 確認修改範圍是否涵蓋托盤路徑
   - 有沒有漏掉 Tray handler 的 preventDefault
4. **Log 檔案**（`%APPDATA%/better-agent-terminal/Logs`）
   - 使用者最後一次托盤 Quit 前後 30 行
   - 搜尋 `before-quit` / `will-quit` / `dialog` / `quit` 關鍵字

### 調查維度

| 維度 | 問題 |
|------|------|
| 事件路徑 | 托盤 Quit click → 觸發了哪些 Electron 事件？是否經過 `before-quit`？ |
| Handler 綁定 | `before-quit` handler 實際綁了嗎？何時綁？`app.isReady()` 前後？ |
| Flag 狀態 | `app.isQuitting` / 自訂 flag 是否提早被設 true 導致 Dialog 被跳過？ |
| Dialog 時序 | Dialog 是 async 呼叫？是否在 `will-quit` 前 race condition 被 resolve？ |
| Packaging | T0144 的修改是否真的進入 packaged binary？（排除 rebuild 沒把新 main.ts 打進去） |
| Server 清理 | SIGTERM 是否只在 CheckBox 勾選路徑呼叫？Dialog 沒跳出→ 沒有機會走到清理邏輯 |

---

## 研究指引

### 建議執行順序
1. **先讀 T0144 commit diff**（`git show 412d52c`）→ 建立對實作範圍的準確認知
2. **檢查 Tray menu Quit handler**（很可能是元兇 — 托盤 menu role='quit' 或直接 `app.exit()` bypass event）
3. **讀 Log**（使用者實測的那次，確認實際事件序）
4. **交叉比對** `before-quit` / `will-quit` / Tray handler 之間的關係
5. **若 log 資訊不足** → 加 trace log（至少在 `before-quit` 進入點、Dialog 呼叫前、Tray click handler）→ **請使用者重測**
6. **產出可決策結論**：根因 + 至少 2-3 個修復候選

### Electron 托盤 Quit 常見陷阱（參考）
- **陷阱 A**：托盤選單用 `role: 'quit'` → 直接呼叫 `app.quit()`，**但 `before-quit` 仍會觸發**（通常不是這個）
- **陷阱 B**：托盤選單 click 直接呼叫 `app.exit(0)` → **完全 bypass** `before-quit` 事件
- **陷阱 C**：托盤選單提早設 `app.isQuitting = true` 然後走原本的 Quit flow，但自訂 flag 判斷被跳過
- **陷阱 D**：`before-quit` 被觸發但 Dialog 是 async，尚未 await 完成 `app` 就進入下一階段
- **陷阱 E**：Windows 特定 — 托盤走的是 `window-all-closed` → `app.quit()`，若 handler 沒 preventDefault 就直接退

---

## 互動規則

- Worker 可主動向使用者提問（`research_interaction: true`，`research_max_questions: 3`）
- 允許提出「加 trace log → 重測」的請求，使用者已明確表示配合
- 每次提問提供選項式格式 `[A] [B] [C] 其他：________`
- 互動紀錄寫入回報區

### 加 Trace Log 建議守則
若決定加 trace log：
1. **明確告知使用者**加哪些 log、加在哪個檔案、觸發條件
2. **提供重測 checklist**：托盤 Quit / File 選單 Quit / Cmd+Q / 視窗 X — 讓使用者一次測完多條路徑
3. **使用者重測後提供 log** → Worker 讀 log 診斷
4. trace log **不要 commit**（Worker 自行在 session 內加、驗證、拿掉）
5. 若確認要保留 log 作為診斷工具 → 在結論中建議，由後續實作工單決定

---

## 塔台補充（Renew #N）
（若需要 Renew 時由塔台補充）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無（根因從程式碼靜態分析已 100% 確定，log 完全佐證 — 不需提問或重測）

### 調查結論

**根因：Tray Quit menu item 的 click handler 在呼叫 `app.quit()` 前手動設 `isAppQuitting = true`，而 `before-quit` handler 以 `if (!isAppQuitting)` 作為守護條件，導致整個 Dialog / cleanup / server-stop 邏輯被完整跳過。**

**程式碼證據鏈**（`electron/main.ts`）：

1. **Tray Quit handler** — 第 540-546 行（T0144 前就存在，非 T0144 引入）：
   ```typescript
   entries.push({
     label: 'Quit',
     click: () => {
       isAppQuitting = true    // ← 問題源頭
       app.quit()
     }
   })
   ```

2. **before-quit handler** — 第 1334-1339 行（T0144 實作）：
   ```typescript
   app.on('before-quit', async (e) => {
     if (_quitConfirmed) return
     if (!isAppQuitting) {      // ← Tray 已設 true，此條件為 false
       e.preventDefault()
       // ... Dialog 顯示、flush renderer、save profiles、
       //     stopTerminalServerGracefully、runCleanupOnce 全在這個 if 內
     }
   })
   ```

3. **Terminal Server 是 `detached: true` 子 process**（第 323、380 行）：主 process 結束後 Windows 視為獨立 process 繼續活著 — 解釋了「Server 殘留」現象。

**根因性質分類**：
- ❌ 不是 T0144 新增的 bug — Tray handler 的 `isAppQuitting = true` 在 `d09c45e` commit 就存在
- ✅ 但 T0144 才「顯現」出這個 pre-existing bug — 因為 T0144 前沒 Dialog，使用者察覺不到差異；T0144 後 Dialog 該出現但沒出現，regression 可見化
- ❌ 不是 rebuild/packaging 問題
- ❌ 不是 Electron async race — 根本沒進入 Dialog 呼叫點
- ✅ 是 **Tray handler 多此一舉設 flag + before-quit 守護條件不相容** 的設計 bug

**Log 佐證**（`debug-20260417-143321.log`）：最後一條 log 為 `06:53:07` renderer 的 `MutationObserver` render，之後**完全沒有任何 `[quit]` prefix log**（正常 quit 應該要有 `[quit] user confirmed quit`、`[quit] flushed N renderer(s)`、`[quit] saved N profile snapshot(s)`、`[quit] terminal server stopped`）。確認 `before-quit` 內部 if block 整體被跳過，runCleanupOnce 也沒執行。

**Q1-Q4 直接回答**：
- **Q1**：托盤 Quit 有觸發 `before-quit` 事件，但因 `isAppQuitting` 已被 Tray handler 提前設為 true，守護條件 `if (!isAppQuitting)` 為 false，整個 Dialog 區塊被跳過
- **Q2**：只有托盤 Quit 壞。File 選單 / Cmd/Ctrl+Q 用 `role: 'quit'`（不手動設 flag），視窗 X 走 `window-all-closed` → `app.quit()`（也不設 flag），都會正常走完 before-quit flow 並顯示 Dialog
- **Q3**：**Code bug**（Tray handler 與 before-quit 守護條件不相容），非 Electron 行為、非 rebuild 問題、非事件時序
- **Q4**：見「建議方向」，推薦方案 A

### 建議方向

- **[A] 移除 Tray handler 的 `isAppQuitting = true`**（單行改動）
  - 改動：`electron/main.ts:543` 刪除 `isAppQuitting = true` 這一行，只保留 `app.quit()`
  - 優點：1 行改動；讓 Tray Quit 與 File/Cmd+Q 走完全相同 flow；統一 quit 語意
  - 缺點：無
  - 風險：🟢 極低 — `isAppQuitting` 的其他用途（`window-all-closed` 第 1439 行、視窗 close 邏輯第 775 行）都是**讀取**此 flag，Tray handler 不寫並不會破壞任何讀取路徑（before-quit 內部自己會設 true）
  - 改動範圍：1 行

- **[B] 保留 Tray flag，在 before-quit 改用 `_quitConfirmed` 作為唯一守護**
  - 改動：`before-quit` handler 移除 `if (!isAppQuitting)`，僅保留 `if (_quitConfirmed) return`
  - 優點：handler 行為不依賴呼叫端是否事先設 flag
  - 缺點：需同步確認 `isAppQuitting` 的語意變化對 `window-all-closed` 等路徑無影響；改動邏輯面積較大
  - 風險：🟡 中 — 其他路徑讀取 `isAppQuitting` 的語意可能改變
  - 改動範圍：~5 行 + 需跨路徑驗證

- **[C] 把 Dialog 邏輯抽出獨立 `showQuitConfirmDialog()` 函式，Tray handler 直接呼叫**
  - 改動：重構 before-quit，提取 Dialog + cleanup + server stop 為獨立函式，Tray handler 直接 await 該函式
  - 優點：Tray 有獨立進入點，未來可加 Tray 專屬邏輯；明確的控制流
  - 缺點：重構面積大（~80 行）；同一份邏輯兩個進入點容易不一致；對當前問題 overkill
  - 風險：🟠 中高 — 重構引入新 bug 的機會；測試矩陣變大
  - 改動範圍：~80 行

- **推薦：[A]** — 以最小改動精準解決根因。`isAppQuitting` 在 Tray handler 內本來就是冗餘（before-quit 會自己設），刪除它剛好讓所有 quit 路徑行為一致。風險最低、審閱最容易、回歸測試範圍明確。

### 受影響的 Quit 路徑

| 路徑 | 實際行為 | 是否觸發 `before-quit` | 是否顯示 Dialog | 是否清 Server |
|------|---------|----------------------|----------------|--------------|
| 托盤 Quit | ❌ 直接退出（bypass Dialog、bypass cleanup） | ✅ 有觸發，但 `if (!isAppQuitting)` 為 false 整個 skip | ❌ 否 | ❌ 否（detached child 殘留） |
| File 選單 Quit | ✅ 應顯示 Dialog（role:'quit' 正常走 before-quit） | ✅ | ✅ | ✅（勾選時）/ ❌（不勾選時，符合預期） |
| Cmd/Ctrl+Q | ✅ 同上（File→Quit 的 accelerator） | ✅ | ✅ | ✅/❌ |
| 視窗 X（最後視窗）| 走 `window-all-closed` → `runCleanupOnce()` → `app.quit()` → before-quit | ✅ | ✅ | ✅/❌ |

> 註：File 選單 / Cmd+Q / 視窗 X 為**程式碼路徑分析推導**（未實測，因根因明確且這些路徑不涉及 `isAppQuitting = true` 的手動寫入）。建議修復後一併實測驗收四條路徑。

### Trace Log 建議
無。根因從程式碼靜態分析已 100% 確定，log 完全符合（無任何 `[quit]` log），不需再加 trace log 或重測。若塔台希望 regression 防護，可在實作工單中建議保留現有 `[quit]` log 作為長期診斷。

### 建議下一步
- [x] 開實作工單（建議方案：**[A] 移除 `electron/main.ts:543` 的 `isAppQuitting = true` 一行**；驗收：實測四條 Quit 路徑皆顯示 Dialog，勾選時 server 消失、不勾選時 server 保留）
- [ ] 繼續研究（不需要，根因已完整）
- [ ] 放棄

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用 — 研究工單

### 回報時間
2026-04-17 14:55 (UTC+8)

### Commit
4bc8d26
