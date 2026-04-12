# 工單 T0039-ux005-restart-button-icon-and-danger-style

## 元資料
- **工單編號**：T0039
- **任務名稱**：UX-005 重啟按鈕圖示區隔 + hover 變紅（與關閉一致）
- **狀態**：DONE
- **建立時間**：2026-04-12 12:21 (UTC+8)
- **開始時間**：2026-04-12 12:21 (UTC+8)
- **完成時間**：2026-04-12 12:24 (UTC+8)
- **目標子專案**：（單一專案）
- **工單類型**：🎨 UI Polish

## 工作量預估
- **預估規模**：極小（10-20 min）
- **Context Window 風險**：極低
- **降級策略**：N/A

## Session 建議
- **建議類型**：🔄 可接續當前 Session
- **前置工單**：T0038（已完成，close 按鈕 danger 樣式已確認可用）

---

## 背景與問題

### 使用者觀察
工具列三個按鈕（Redraw / Restart / Close）：
- Redraw：`↺`（`action-btn`）
- Restart：`⟳`（`action-btn`）
- Close：`×`（`action-btn danger`）

**問題 1**：`↺` 和 `⟳` 都是旋轉箭頭，放在一起識別度極差，容易誤按。

**問題 2**：Restart 會終止所有 process、行為具破壞性，應與 Close 同等對待，
hover 時顯示紅色（`danger` 樣式），給予視覺警示。

### 期望行為
- Restart 按鈕換成與 Redraw 明顯不同的圖示（如 `⏻` 電源符號）
- Restart 按鈕加上 `danger` class，hover 時變紅色（與 Close 一致）
- Redraw 按鈕保持原樣（`↺`，hover 白色）
- Close 按鈕保持原樣（`×`，hover 紅色）

---

## 任務指令

### Step 1：確認目標檔案

相關檔案：
- `src/components/MainPanel.tsx` — 三個按鈕的 JSX（約 L173-L193）
- `src/styles/panels.css` — `.action-btn.danger:hover` 樣式（約 L91-L93）

CSS 樣式**不需修改**，只需在按鈕加 class。

### Step 2：修改 Restart 按鈕

在 `MainPanel.tsx` 中找到 Restart 按鈕：

```tsx
<button
  className="action-btn"
  onClick={() => setShowRestartConfirm(true)}
  title={t('terminal.restartTerminal')}
>
  ⟳
</button>
```

修改為：

```tsx
<button
  className="action-btn danger"
  onClick={() => setShowRestartConfirm(true)}
  title={t('terminal.restartTerminal')}
>
  ⏻
</button>
```

**圖示說明**：`⏻`（U+23FB，POWER SYMBOL）
- 語意清晰：「重啟 = 關掉再開」，與電源按鈕直覺一致
- 外型與 `↺`（Redraw）明顯不同，不會混淆
- 若使用者或 reviewer 偏好其他圖示，可改用：
  - `↻`（U+21BB）— 順時針箭頭，但仍與 ↺ 相似度偏高
  - `⚡` — 閃電，語意較強烈
  - `⏏` — Eject，語意稍差
  - **建議優先選 `⏻`**

### Step 3：Build 驗證

```bash
npx vite build
```

確認無 TypeScript 錯誤，build 成功。

### Step 4：視覺確認

目視確認三個按鈕的外觀差異：

| 按鈕 | 圖示 | Hover 顏色 |
|------|------|-----------|
| Redraw | `↺` | 白色（正常 hover）|
| Restart | `⏻` | **紅色**（danger hover）|
| Close | `×` | 紅色（danger hover）|

### 預期產出
- 修改 `src/components/MainPanel.tsx`（1 行 class + 1 個字元圖示）
- git commit：`fix(ui): change restart icon and add danger hover style (UX-005)`
- 更新本工單回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 修改內容
`src/components/MainPanel.tsx`：
- Restart 按鈕圖示 `⟳` → `⏻`（U+23FB，電源符號）
- Restart 按鈕 class `action-btn` → `action-btn danger`

結果：
| 按鈕 | 圖示 | Hover |
|------|------|-------|
| Redraw | `↺` | 白色 |
| Restart | `⏻` | **紅色** |
| Close | `×` | 紅色 |

### Git 摘要
- commit `9053cfc`：`fix(ui): change restart icon and add danger hover style (UX-005)`
- 1 檔案，2 insertions / 2 deletions

### 遭遇問題
無

### 回報時間
2026-04-12 12:24 (UTC+8)
