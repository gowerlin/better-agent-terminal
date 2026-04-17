# BUG-033 — 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景

## 元資料
- **BUG 編號**：BUG-033
- **標題**：PLAN-012 實作後 regression — 從系統托盤 Quit 時，沒有出現 Dialog（原版會問），直接退出；Terminal Server 仍殘留在背景
- **狀態**：🚫 CLOSED
- **修復 commit**：`ef867a2`（T0147）
- **FIXED 時間**：2026-04-17 15:14 (UTC+8)
- **CLOSED 時間**：2026-04-17 17:12 (UTC+8)（使用者驗收通過 — D044）
- **驗證狀態**：dev serve 四路徑通過 + 打包 T0145 情境 8.1-8.4 全綠
- **嚴重度**：🔴 High（regression — 破壞原有 Quit Dialog 行為，且 Server leak 無從選擇是否結束）
- **建立時間**：2026-04-17 14:35 (UTC+8)
- **發現於**：PLAN-012 T0144 實作後使用者實測（新版 BAT 已 rebuild + 重裝確認）
- **關聯 PLAN**：PLAN-012（Quit Dialog + Terminal Server CheckBox）
- **關聯工單**：T0144（實作，commit `412d52c`）、T0145（待執行驗收）
- **研究工單**：T0146（根因調查，本 BUG 建立同時派發）

---

## 現象描述

### 預期行為（PLAN-012 設計 + 原版 Dialog 行為）
1. 使用者從系統托盤選 Quit
2. 跳出 Electron 原生 Dialog：
   - 訊息：「是否退出 BAT？」
   - CheckBox：「一併結束 Terminal Server」（預設不勾）
   - 按鈕：OK / Cancel
3. 點 Cancel → 不退出
4. 點 OK（不勾 CheckBox）→ 退出 BAT，Server 留在背景
5. 點 OK（勾 CheckBox）→ 退出 BAT + SIGTERM Terminal Server（含 fallback timeout）

### 實際行為
1. 從系統托盤選 Quit
2. **完全沒有 Dialog**
3. BAT 直接退出
4. Terminal Server 仍在背景運行（沒被結束）

### Quit 路徑（使用者回報 Q2.D）
- 進入點：**系統托盤 Quit 選單項**
- 其他路徑（File 選單 / Ctrl+Q / 視窗 X）：尚未驗證，留待 T0146 調查範圍

### 影響範圍
- **功能 regression**：原版（PLAN-012 前）有 Quit Dialog，現在消失 → T0144 破壞原有行為
- **Server leak**：使用者無從決定是否結束 Server，只能手動到工作管理員殺
- **PLAN-012 設計失效**：CheckBox 永遠沒機會顯示，整個 feature 形同無效
- **阻擋**：v2.x next release（T0145 驗收前提是 Dialog 能跳出）

### 可能假設（未驗證，交給 T0146 確認）
1. 托盤 Quit 走 `app.quit()` 但跳過 `before-quit` 攔截
2. 托盤 menu click handler 直接呼叫 `app.exit()`（硬退，不走事件）
3. `before-quit` handler 中的 `event.preventDefault()` 條件判斷有誤
4. i18n / Dialog 初始化錯誤 → Dialog 呼叫 throw 被 silently catch
5. Tray 實例沒綁 handler 或綁到舊 handler

---

## 使用者測試資訊
- **BAT 版本**：已 rebuild + 重裝確認（使用者 Q1.A 確認）
- **Quit 方式**：系統托盤（Q2.D）
- **Log 目錄**：`C:\Users\Gower\AppData\Roaming\better-agent-terminal\Logs`
- **使用者主動提議**：若資訊不足可加 trace log，可配合重測

---

## 修復策略（暫定，待 T0146 結論）

- [ ] T0146 研究：釐清托盤 Quit flow + 為何 bypass Dialog
- [ ] （依 T0146 結論）派實作工單修復
- [ ] T0145 驗收（含托盤路徑 + 視窗關閉路徑 + Cmd/Ctrl+Q 路徑全綠）
- [ ] PLAN-012 → DONE（納入 next release）

---

## 回報區

> 此 BUG 的修復紀錄在對應修復工單回報，此處僅記錄狀態變更與驗收結論。

### 狀態變更歷程
- 2026-04-17 14:35：OPEN（使用者實測發現 regression）
- （待 T0146 研究完成）→ 預期進入 FIXING
