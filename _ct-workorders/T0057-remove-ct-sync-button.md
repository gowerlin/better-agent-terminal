# 工單 T0057-remove-ct-sync-button

## 元資料
- **工單編號**：T0057
- **任務名稱**：移除指揮塔面板的 /ct-sync 按鈕（不存在的指令）
- **狀態**：DONE
- **建立時間**：2026-04-12 19:33 (UTC+8)
- **開始時間**：2026-04-12 19:35 (UTC+8)
- **完成時間**：2026-04-12 19:40 (UTC+8)

## 工作量預估
- **預估規模**：極小（移除 UI 元素）
- **Context Window 風險**：極低

## Session 建議
- **建議類型**：🆕 新 Session

## 任務指令

### Bug 描述

指揮塔面板標題旁有同步按鈕（⇄ icon），點擊會嘗試呼叫 `/ct-sync`。但 `/ct-sync` 不是一個存在的 skill/指令 — 實際的 `*sync` 只能在塔台 session 內部使用，不是獨立 skill。

這是一個錯誤的設計要求導致的無效 UI 元素，需要移除。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 修復方向

1. 找到指揮塔面板元件（搜尋 `control-tower`、`ControlTower`、`ct-sync`、`指揮塔`）
2. 找到同步按鈕（⇄ icon）的 JSX 和 click handler
3. **移除**同步按鈕和相關的 handler/state
4. 保留 refresh 按鈕（↻）如果它有其他功能（如重新讀取工單檔案列表）
5. 若 refresh 按鈕也是呼叫不存在的指令，一併移除

### Commit 規範
```
fix(tower-ui): remove non-functional /ct-sync button
```

### 驗收條件
- [ ] 指揮塔面板標題旁不再有 ⇄ 同步按鈕
- [ ] 無殘留的 ct-sync 相關程式碼
- [ ] `npx vite build` 通過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
修改 7 個檔案，移除 ⇄ 同步按鈕及全部相關程式碼：
- `src/components/ControlTowerPanel.tsx` — 移除 `onSyncWorkOrders` prop 介面、解構、JSX 按鈕
- `src/components/WorkspaceView.tsx` — 移除 `handleSyncWorkOrders` callback、prop 傳遞、deps array 引用
- `src/App.tsx` — 移除 `onSyncWorkOrders` 整段 async handler
- `src/styles/control-tower.css` — 移除 `.ct-sync-btn` 和 `.ct-sync-btn:hover` 樣式
- `src/locales/en.json` — 移除 `"sync": "Sync Check"`
- `src/locales/zh-TW.json` — 移除 `"sync": "同步檢查"`
- `src/locales/zh-CN.json` — 移除 `"sync": "同步检查"`

Build 驗證：`npx vite build` ✓ 通過（9.87s）

（commit 待使用者確認後執行）

### 遭遇問題
無

### 回報時間
2026-04-12 19:40 (UTC+8)
