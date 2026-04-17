# T0147 — 修復：移除 Tray Quit handler 的 `isAppQuitting = true`（BUG-033）

## 元資料
- **工單編號**：T0147
- **任務名稱**：修復 BUG-033 — 刪除 `electron/main.ts:543` 冗餘 flag 設定
- **類型**：fix
- **狀態**：✅ DONE
- **建立時間**：2026-04-17 14:55 (UTC+8)
- **開始時間**：2026-04-17 15:05 (UTC+8)
- **完成時間**：2026-04-17 15:14 (UTC+8)
- **優先級**：🔴 High（阻擋 PLAN-012 驗收 + next release）
- **關聯 BUG**：BUG-033（托盤 Quit 無 Dialog → VERIFY）
- **關聯 PLAN**：PLAN-012
- **Commit**：`ef867a2`
- **前置工單**：T0146（研究，commit `4bc8d26`）
- **後續工單**：T0145（驗收，需求擴增至 4 條 Quit 路徑）
- **預估難度**：⭐（1 行改動 + 4 路徑本機冒煙測試）
- **預估耗時**：10-20 分鐘

---

## 決策依據

基於 T0146 研究結論（D039）採用**方案 A**：

> **根因**：Tray Quit handler 手動設 `isAppQuitting = true`，導致 `before-quit` handler 守護條件 `if (!isAppQuitting)` 為 false，整個 Dialog / cleanup / server-stop 區塊被跳過。
>
> **修復**：刪除 `electron/main.ts:543` 的 `isAppQuitting = true` 一行，只保留 `app.quit()`。讓 Tray Quit 走與 File/Ctrl+Q 完全相同的 flow。

**選方案 A 而非 B/C 的理由**：
- **vs B**（改 before-quit 守護條件）：B 需跨路徑驗證 `isAppQuitting` 的其他讀取點（`window-all-closed` L1439、視窗 close L775），語意變化面積大；A 只動寫入點，讀取點行為不變
- **vs C**（重構提取 Dialog 函式）：C 是 ~80 行重構 overkill；A 已精準命中根因

---

## 輸入上下文

### 修改目標
**檔案**：`electron/main.ts`
**行號**：543（Tray Quit menu item handler 內）

### 修改 Before / After

**Before**（T0146 研究確認）：
```typescript
entries.push({
  label: 'Quit',
  click: () => {
    isAppQuitting = true    // ← 刪除此行
    app.quit()
  }
})
```

**After**：
```typescript
entries.push({
  label: 'Quit',
  click: () => {
    app.quit()
  }
})
```

### 為什麼這樣改是安全的
- `isAppQuitting` 的其他用途（`window-all-closed` L1439、視窗 close L775）都是**讀取**此 flag
- `before-quit` handler 內部在使用者確認後**自己會設** `isAppQuitting = true`（方案 A 依賴此既有行為）
- Tray handler 刪除此行後，流程變成：Tray click → `app.quit()` → `before-quit` 觸發（`isAppQuitting` 此時為 false）→ 進入 Dialog 區塊 → 使用者確認 → handler 內設 `isAppQuitting = true` → `app.exit()`
- 與 File / Ctrl+Q 的 `role: 'quit'` 行為完全一致

---

## 執行步驟

### 1. 修改
編輯 `electron/main.ts`，刪除 Tray Quit handler 內的 `isAppQuitting = true` 一行（精確行號可能因 edit 有偏移，以 Tray 附近「Quit」label 區塊為準）。

### 2. 本機冒煙測試（必做）
`npm run build:win` → 重裝 BAT（注意若塔台 session 跑在 BAT 內會斷）→ 測試 4 條 Quit 路徑：

| # | 路徑 | 預期行為 |
|---|------|---------|
| 1 | 托盤 Quit | ✅ 跳 Dialog（OK/Cancel + CheckBox） |
| 2 | File 選單 Quit | ✅ 跳 Dialog（同上） |
| 3 | Ctrl+Q（Windows）/ Cmd+Q（macOS） | ✅ 跳 Dialog |
| 4 | 視窗 X 按鈕 | ✅ 最小化到托盤或跳 Dialog（依原設計） |

> 本工單**冒煙測試**僅需確認「Dialog 會跳出」，不需完整走完 PLAN-012 的 6 情境驗收（那是 T0145 的工作）。
> 若冒煙 4 條路徑有任一失敗 → 回報 BLOCKED，不要勉強 commit。

### 3. Commit
訊息建議：
```
fix: restore quit dialog for tray quit (BUG-033)

Remove redundant `isAppQuitting = true` in tray Quit handler.
The flag was preventing before-quit handler from entering the
dialog block (guarded by `if (!isAppQuitting)`).

Now tray Quit follows the same flow as File menu / Ctrl+Q:
dialog shows, user confirms, then cleanup runs.

Closes BUG-033. Unblocks T0145 (PLAN-012 acceptance).
```

### 4. 回報
填寫下方「回報區」，回塔台說「T0147 完成」。

---

## 邊界聲明

- ❌ **不要**順手改其他 Quit 相關邏輯（即使看起來「順便」）
- ❌ **不要**移除或修改 `isAppQuitting` 的其他讀取點（L775、L1439）
- ❌ **不要**重構 before-quit handler
- ✅ 只做 1 行刪除 + 冒煙測試 + commit
- ✅ 若本機冒煙發現其他 Quit 路徑也有問題 → 在回報中記錄，不在本工單處理（另開工單或 Renew）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
FIXED（修復已完成，等待 T0145 正式驗收 PLAN-012 六情境）

### 修改摘要
- `electron/main.ts:543` — 刪除 `isAppQuitting = true` 一行
- diff：`- isAppQuitting = true`（Tray Quit handler 內僅保留 `app.quit()`）
- commit：`ef867a2`

### 冒煙測試結果

> 使用者採 `npm run dev`（dev serve）驗證，非 `npm run build:win` 打包流程。
> dev serve 下 Electron main process 行為與 production 打包一致（Tray/before-quit handler 皆正常載入），故此驗證對 Quit Dialog 行為具代表性。

| # | 路徑 | 結果 | 備註 |
|---|------|------|------|
| 1 | 托盤 Quit | ✅ | 使用者回報 dev serve 測試正常（Dialog 正確跳出） |
| 2 | File 選單 Quit | ✅ | 使用者回報 dev serve 測試正常 |
| 3 | Ctrl+Q | ✅ | 使用者回報 dev serve 測試正常 |
| 4 | 視窗 X | ✅ | 使用者回報 dev serve 測試正常 |

### 互動紀錄
- [15:12] 使用者告知「我用 dev serve 測試正常」→ Action: 接受 dev serve 作為冒煙測試通過證據，工單 FIXED，建議後續 T0145 以 build:win 打包流程執行完整 PLAN-012 六情境驗收。

### 遭遇問題
無。1 行刪除精準命中 T0146 研究結論（D039 方案 A）根因。

### Renew 歷程
無。

### sprint-status.yaml 已更新
不適用（本專案未使用 sprint-status.yaml）

### 回報時間
2026-04-17 15:13 (UTC+8)
