# 🐛 BUG-002:右鍵功能表位置嚴重位移(除終端縮圖區外全部 UI)

## 基本資訊

| 欄位 | 內容 |
|------|------|
| **報修編號** | BUG-002 |
| **狀態** | 🚫 CLOSED |
| **結案日期** | 2026-04-13 |
| **結案說明** | 人工驗收通過（運行時驗證確認） |
| **報修人** | 使用者(口頭報修) |
| **報修時間** | 2026-04-11 00:40 (UTC+8) |
| **細節補充時間** | 2026-04-11 00:55 (UTC+8) |
| **嚴重度** | 🟡 Medium(塔台評估後維持,理由:有 workaround — 避開右鍵) |
| **影響範圍** | **所有**有右鍵功能表的 UI 區塊(僅終端縮圖區正常) |
| **重現率** | 100%(使用者說「每次都位移」) |
| **阻斷程度** | 不阻斷主流程,但大幅影響使用體驗 |
| **相關專案里程碑** | Phase 1 收尾前應修掉 |

---

## 症狀描述

### 使用者報修原文
> 「除了終端縮圖區我們修過後正常,其餘 UI 只要有右鍵功能表的地方,功能表都位移很嚴重」

### 細節問卷回答(使用者填寫)

| # | 問題 | 使用者回答 |
|---|------|-----------|
| Q1 | 哪些 UI 區塊有問題 | **全部**(所有有右鍵功能表的地方,除終端縮圖區) |
| Q2 | 位移方向與距離 | **有偏移且方向固定**,大約 **x=+250, y=-50 px**(偏右上) |
| Q3 | Windows DPI 縮放 | **150%** |
| Q4 | 特殊條件 | **無特殊條件**(每次都位移) |
| Q5 | 終端縮圖區的修復方式 | **完全不記得**(塔台需自行 git log 翻查) |

---

## 塔台的初步診斷假說(待驗證)

> ⚠️ **這些是假說,不是結論**。調研工單必須實際驗證或推翻。

**線索組合**:
- 方向固定(x=+250, y=-50)
- Windows 150% DPI
- **只有終端縮圖區正常**(其他全壞)
- 無特殊條件

### 假說 A:DPI 縮放補償錯誤(高可能性 ⭐⭐⭐)

Electron + Windows 150% DPI 情境常見陷阱:
- `MouseEvent.clientX/Y` 回傳 **CSS pixels**(已除以 DPI scaling)
- `window.screen.availLeft` 和部分 screen API 回傳 **physical pixels**(未除)
- 若程式碼混用兩者,會得到 1.5 倍的位置錯誤

**推算**:
- 假設 click 發生在 CSS 座標 (500, 300)
- 若程式碼誤把 CSS 座標乘以 devicePixelRatio(1.5),會得到 (750, 450)
- 偏移 (+250, +150)— x 對得上 +250!y 不完全對,但方向可能反向

**這個假說對得上 x=+250,但 y=-50 反方向**。需要實測 click 位置驗證。

### 假說 B:Window Chrome / Title Bar 高度沒扣掉(中可能性 ⭐⭐)

Electron 自訂 title bar 或 custom frame 在 150% DPI 高度約:
- 預設標題列 30px × 1.5 = 45~48px
- 若有自訂工具列會更高

**推算**:
- `MouseEvent.screenY` 包含 title bar 高度
- `MouseEvent.clientY` 不包含
- 若 context menu 計算時該扣沒扣 → y 軸常態偏差 ~50px
- **這對得上 y=-50** ✅

但 x=+250 解釋不了(title bar 不會影響 x)— 除非有**左側固定 sidebar** 寬度約 250px 也被誤算。

### 假說 C:Scale Transform on Parent(中可能性 ⭐⭐)

若某個父容器用 `transform: scale()`:
- `getBoundingClientRect()` 的回傳值**已經**乘過 transform
- 但若程式碼自己又套用 transform 計算,會雙重計算
- Electron 某些情況會有隱含 zoom factor

**如何驗證**:DevTools inspect context menu 的 parent chain,看有沒有 `transform` / `zoom` / `scale`。

### 假說 D:Multi-monitor + primary display offset(低可能性 ⭐)

雖然使用者 Q4 說「無特殊條件」,但若**曾經**接過多螢幕,primary display 的 `screen.availLeft/Top` 可能非零,影響 `screenX/Y` 計算。

**如何驗證**:重啟 app 或拔掉外接螢幕測試。

### 假說 E:Fixed 250px sidebar + 50px titlebar 的組合錯算(高可能性 ⭐⭐⭐)

這個最對得上:
- **+250 x**:可能是左側 sidebar(檔案列表 / 工作區樹)的寬度
- **-50 y**:可能是上方 title bar 高度
- 意思是 context menu 的座標計算**多加了 sidebar 的寬度 + 多減了 title bar 高度**
- 或者相反:某處算 menu 位置時用的是 **document-relative**,但定位時卻用 **window-relative**,結果 offset 就是 sidebar + title bar 的大小

這個假說的**關鍵證據**:+250 和 -50 是**具體的 UI 尺寸**,不是隨機的 DPI 倍數錯誤。

---

## 調研方向優先順序

調研工單應依以下順序檢查,命中即可短路:

1. **§1 Git log 考古**(最高優先):
   - `git log --all --oneline -- '*contextmenu*' '*context-menu*' '*ContextMenu*'`
   - `git log --all --oneline -S 'getBoundingClientRect'`
   - 找出終端縮圖區 context menu 的歷史修復 commit
   - **這是最關鍵的線索 — 如果找到 commit,其他假說都可以短路**

2. **§2 終端縮圖區 vs 其他區塊的程式碼差異**:
   - 找到終端縮圖區的 context menu 元件
   - 對比其他區塊的 context menu 實作
   - 找 diff 中「座標計算」的差異
   - 可能是一個 hook(`useContextMenu`)還是各自實作?

3. **§3 驗證假說 E(sidebar 寬 + titlebar 高組合錯算)**:
   - 測量 app 的 sidebar 寬度(DevTools)和 titlebar 高度
   - 若 sidebar 寬 ≈ 250px,titlebar ≈ 50px → 假說 E 確認
   - 找程式碼中有沒有 hard-code `250` 或類似的數字

4. **§4 驗證假說 A(DPI 縮放)**:
   - 暫時把 Windows DPI 設 100% → 位移還在嗎?
   - 位移消失 → 假說 A 確認
   - 位移還在 → 假說 A 否定

5. **§5 驗證假說 B(Title bar 沒扣)**:
   - 檢查 `MouseEvent` 相關的 `screenX/Y` vs `clientX/Y` 混用
   - 特別看 `ContextMenu` 元件內部的座標 prop

---

## 修復方向建議(待調研後才能決定)

視調研結論而定:

**情境 1:找到了終端縮圖區的舊 commit**
- 把當初的修法複製到其他區塊
- 若有公用 hook(`useContextMenu`)則修 hook
- 預估:S~M

**情境 2:公用 hook 問題(一處改動全部修好)**
- 直接改 hook
- 全部 UI 自動修好
- 預估:S

**情境 3:每個區塊各自實作 context menu**
- 需要逐個修
- 預估:L(工單量多)
- 可能需要拆多張工單

**情境 4:DPI 縮放問題**
- 需要統一 DPI 處理邏輯
- 預估:M
- 可能需要引入 util function

---

## 給調研工單的附帶資訊

**使用者環境**:
- Windows DPI: 150%
- 無特殊條件觸發
- 偏移方向固定:x=+250, y=-50

**已知正常的對照組**:
- 終端縮圖區 context menu(在某個時間點被修過,塔台記憶裡沒有 commit hash)

**可能相關的檔案**(猜測,調研工單自己確認):
- `src/components/*ContextMenu*`
- `src/hooks/useContextMenu*`(若存在)
- 各個 UI 區塊內的 right-click handler 實作

---

## 塔台處理區

- [ ] 已確認症狀
- [ ] 已收集細節
- [ ] 假說已列出(5 個)
- [ ] 決定派調研工單(T0008)
- [ ] 調研工單編號:T0008
- [ ] 調研結果 → 修復工單編號(TBD)
- [ ] 處理決策日誌編號:D015(待寫)

---

**報修細節已收集完畢。等 T0006(BUG-001 fix)+ T0007(預覽框)完成後,塔台派發 T0008 調研工單。**
