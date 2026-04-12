# 工單 T0037-ux003-terminal-status-indicator-tooltip

## 元資料
- **工單編號**：T0037
- **任務名稱**：UX-003 終端工具列狀態燈號：調查狀態規則 + 加 Tooltip
- **狀態**：DONE
- **建立時間**：2026-04-12 11:52 (UTC+8)
- **開始時間**：2026-04-12 11:57 (UTC+8)
- **完成時間**：2026-04-12 12:05 (UTC+8)
- **目標子專案**：（單一專案）
- **工單類型**：🔍 **Investigation + Feature**

## 工作量預估
- **預估規模**：小（20-40 min）
- **Context Window 風險**：低
- **降級策略**：若狀態規則複雜難懂，先回報調查結果，塔台決定 tooltip 文字

## Session 建議
- **建議類型**：🆕 新 Session
- **等待條件**：T0036 執行中，本工單可立即並行或 T0036 完成後再跑

---

## 背景

終端工具列上有一個彩色燈號（目前觀察到綠色）。開發者不確定：
1. 它代表什麼意義
2. 有幾種狀態（顏色）
3. 各狀態的切換時機

使用者看到這個燈號沒有任何說明文字，完全無法理解其含義。本工單目標：**先搞清楚它是什麼，再加 tooltip 讓使用者看得懂。**

---

## 任務指令

### Step 1：定位燈號元件

在 `src/components/TerminalPanel.tsx` 中搜尋燈號相關程式碼：

```bash
grep -n "green\|indicator\|status\|dot\|circle\|●\|•\|連線\|connected\|alive\|active" src/components/TerminalPanel.tsx | head -30
```

也搜尋 CSS class 名稱或 inline style 中的顏色定義：
```bash
grep -n "bg-green\|bg-red\|bg-yellow\|#00\|rgba\|status.*color\|color.*status" src/components/TerminalPanel.tsx | head -20
```

### Step 2：調查所有狀態

找到燈號的渲染邏輯後，整理：

| 狀態名稱 | 顏色 | 觸發條件 | 說明 |
|---------|------|---------|------|
| （待調查） | 綠色 | ？ | ？ |
| （待調查） | ？色 | ？ | ？ |

記錄：
- 有幾種顏色/狀態？
- 狀態由哪個變數或 store 控制？
- 是否有現成的狀態描述文字（或只有顏色）？

### Step 3：加 Tooltip

為每個狀態加上對應的 tooltip 文字。

**Tooltip 文字建議**（根據調查結果填入，以下為假設範例）：

| 狀態 | 建議 Tooltip 文字 |
|------|-----------------|
| 連線中（綠） | `終端已連線` |
| 忙碌中（黃） | `終端執行中` |
| 已斷線（紅） | `終端已斷線，點擊重新啟動` |
| 未知（灰） | `終端狀態未知` |

> **實際文字由 sub-session 根據程式碼語意決定**，上面只是參考。

**實作方式**：
- 優先使用 `title` attribute（最簡單）：
  ```tsx
  <span title={statusTooltip} className="...">●</span>
  ```
- 若專案已有 Tooltip 元件，使用現有元件保持一致性

### Step 4：驗證

- [ ] 確認燈號的所有狀態都有對應 tooltip
- [ ] 滑鼠 hover 燈號時顯示正確說明文字
- [ ] 不影響燈號原本的功能和顏色邏輯
- [ ] build 通過（`npx vite build`）

### 預期產出
- `src/components/TerminalPanel.tsx` 修改（tooltip 加入）
- 調查結果記錄在回報區（狀態表）
- git commit：`feat(terminal): add tooltip to terminal status indicator (UX-003)`
- 更新本工單回報區

### 執行注意事項
- **只加 tooltip，不改燈號邏輯**
- **tooltip 文字用繁體中文**（與 UI 語言一致）
- **日誌**：使用 `window.electronAPI.debug.log()` 而非 `console.log()`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 燈號狀態調查結果

燈號元件：`ActivityIndicator`（`src/components/ActivityIndicator.tsx`）
使用位置：`TerminalThumbnail.tsx` 第 206 行

| 狀態名稱 | 顏色 | 觸發條件 | CSS Class | Tooltip 文字 |
|---------|------|---------|-----------|-------------|
| 活躍中  | 綠色 `#10b981`，呼吸動畫 | 10 秒內有終端輸出（`lastActivityTime`） | `active` | 終端活躍中 |
| 閒置    | 灰白半透明，dim | 超過 10 秒無輸出 | `inactive` | 終端閒置 |
| 等待操作 | 紅色 `#ef4444`，`?` 角標，快速呼吸 | `terminal.hasPendingAction === true` | `pending`（疊加在 active/inactive 上） | 等待操作 |

狀態優先級：`pending` > `active` > `inactive`

### Git 摘要
commit `82717d3`
`feat(terminal): add tooltip to terminal status indicator (UX-003)`

修改檔案：
- `src/components/ActivityIndicator.tsx`：新增 `useTranslation`、計算 `tooltipText`、`div` 加 `title` attribute
- `src/locales/en.json`：新增 `terminal.statusActive/statusIdle/statusPending`
- `src/locales/zh-TW.json`：新增繁體中文對應 key
- `src/locales/zh-CN.json`：新增簡體中文對應 key

### 遭遇問題
無

### 互動紀錄
無

### 回報時間
2026-04-12 12:05 (UTC+8)
