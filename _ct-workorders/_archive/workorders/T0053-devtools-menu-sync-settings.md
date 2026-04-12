# 工單 T0053-devtools-menu-sync-settings

## 元資料
- **工單編號**：T0053
- **任務名稱**：Main Menu DevTools 選項與 Settings 狀態同步
- **狀態**：DONE
- **建立時間**：2026-04-12 17:50 (UTC+8)
- **開始時間**：2026-04-12 17:52 (UTC+8)
- **完成時間**：2026-04-12 18:10 (UTC+8)

## 工作量預估
- **預估規模**：小
- **Context Window 風險**：低

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：簡單修正，乾淨 context 最快

## 任務指令

### Bug 描述

Settings 關閉 「Enable DevTools」後，Main Menu → View 仍顯示「Toggle Developer Tools」選項。應該在設定變更後同步更新 menu。

### 前置條件
- 本工單（完整閱讀）
- `CLAUDE.md`（專案規範）

### 已知線索（塔台已盤點）

`electron/main.ts` 中：
- **L211**：`isDevToolsEnabled()` — 讀取持久化設定，判斷是否啟用
- **L384**：`...(isDevToolsEnabled() ? [{ role: 'toggleDevTools' as const }] : [])` — 建構 menu 時條件包含
- **L1053**：`// Rebuild menu to reflect devtools toggle change` — 已有重建 menu 的意圖

### 修復方向

1. 檢查 L1053 附近的 menu rebuild 邏輯是否正確觸發
2. 確認 settings 變更的 IPC 事件（`settings:update` 或類似）是否觸發 `Menu.setApplicationMenu()` 重建
3. 修復流程：Settings 面板切換 DevTools → IPC 通知 main process → 重建 application menu → View 選項同步更新

### Commit 規範
```
fix(menu): sync DevTools menu visibility with settings toggle
```

### 驗收條件
- [ ] Settings 關閉 DevTools → View menu **不顯示** Toggle Developer Tools
- [ ] Settings 開啟 DevTools → View menu **顯示** Toggle Developer Tools
- [ ] 切換後不需重啟 app 即時生效
- [ ] `npx vite build` 通過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
DONE

### 產出摘要
修改 `electron/main.ts`：`isDevToolsEnabled()` 函式

**根本原因**：Dev mode 下 `VITE_DEV_SERVER_URL` 存在時，函式直接 return `true`，完全跳過 settings 讀取，導致切換設定後選單不同步。

**修復前**：
```javascript
if (VITE_DEV_SERVER_URL) return true  // 完全忽略設定
```

**修復後**：
```javascript
const persisted = readPersistedSettingsSync()
if (VITE_DEV_SERVER_URL) return persisted?.enableDevTools !== false  // 尊重明確的 false
return persisted?.enableDevTools === true
```

**驗收條件核對**：
- [x] Settings 關閉 DevTools → View menu 不顯示 Toggle Developer Tools ✅ 用戶確認
- [x] Settings 開啟 DevTools → View menu 顯示 Toggle Developer Tools ✅
- [x] 切換後不需重啟 app 即時生效 ✅
- [x] `npx vite build` 通過 ✅

### 遭遇問題
初次程式碼審查誤判為「無 Bug」，未能識別 dev mode 強制覆蓋的問題。截圖確認後才找到根本原因。

### 回報時間
2026-04-12 18:10 (UTC+8)
