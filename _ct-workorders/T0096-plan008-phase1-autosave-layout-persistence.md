# 工單 T0096 — PLAN-008 Phase 1：定時保底儲存 + UI 佈局持久化

## 元資料
- **工單編號**：T0096
- **任務名稱**：PLAN-008 Phase 1：定時保底儲存 + UI 佈局持久化
- **狀態**：DONE
- **開始時間**：2026-04-13 16:38 UTC+8
- **建立時間**：2026-04-13 16:10 UTC+8
- **相關票號**：PLAN-008

---

## 🎯 目標

**Phase 1 獨立可交付**，不依賴 Terminal Server（Phase 2+）。

改善項目：
1. **定時保底儲存**：每 30 秒 auto-save 狀態，防止 crash 遺失最後修改
2. **UI 佈局持久化**：分割方向、比例、當前 active workspace 存入現有 schema
3. **關閉前強制儲存**：確認 `app.on('before-quit')` 有完整執行

完成後重啟 BAT，工作區佈局會自動恢復（無需 Terminal Server 支援）。

---

## 📋 架構決策（來自 T0093 + 使用者確認）

- **Schema**：擴充現有 `windows.json` / `profiles/*.json`，不新增檔案
- **不包含**：PTY 進程保活（Phase 2）、scroll buffer 持久化（Phase 4）、Agent 會話遷移（Agent 留在主進程，sdkSessionId resume 現有機制已足夠）

---

## ✅ 任務清單

### 1. 確認現有狀態儲存機制

```bash
# 找 windows.json / profiles 的讀寫位置
grep -rn "windows\.json\|profiles\|window-registry\|saveState\|loadState\|writeFile\|electron-store" \
  electron/ src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | head -30

# 找 before-quit 處理
grep -n "before-quit\|will-quit\|app\.on" electron/main.ts | head -20

# 找現有 layout 狀態（分割、比例）
grep -rn "splitRatio\|splitDirection\|layout\|panelSize\|flexBasis" \
  src/ --include="*.tsx" --include="*.ts" | head -20
```

確認：
- [ ] `windows.json` 目前儲存哪些欄位？
- [ ] `window-registry.ts`（或類似檔案）的 schema 定義在哪？
- [ ] `before-quit` 目前是否已有儲存邏輯？
- [ ] UI 佈局（分割方向/比例）目前是否已有任何持久化？

### 2. 擴充 WindowEntry Schema

在 `window-registry.ts`（或對應 schema 定義檔）加入：

```typescript
interface TerminalEntry {
  id: string
  workspaceId: string
  type: 'terminal' | 'agent' | 'panel'
  shell?: string
  cwd?: string
  title?: string
  sdkSessionId?: string  // 已有，Agent resume 用
  // Phase 1 新增：
  // ptyServerId 留空，Phase 2 填入
  ptyServerId?: string
}

interface WindowEntry {
  // 既有欄位...
  // Phase 1 新增：
  layout?: {
    type: 'split' | 'tabs' | 'single'
    direction?: 'horizontal' | 'vertical'
    ratio?: number          // 0.0-1.0，左側/上方比例
    activeWorkspaceId?: string
    activePanelId?: string
  }
}
```

> **注意**：所有新欄位設為 optional，確保舊版本讀到新格式不崩潰（向後相容）

### 3. 實作定時保底儲存

在主進程或狀態管理層加入 30 秒 auto-save：

```typescript
// electron/main.ts 或 state-manager.ts
const AUTO_SAVE_INTERVAL_MS = 30_000

let autoSaveTimer: NodeJS.Timeout | null = null

function startAutoSave() {
  autoSaveTimer = setInterval(() => {
    saveCurrentState()
      .catch(err => logger.error('Auto-save failed:', err))
  }, AUTO_SAVE_INTERVAL_MS)
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

// 啟動時開始
app.on('ready', () => {
  startAutoSave()
})

// 關閉時停止並強制最後儲存
app.on('before-quit', async () => {
  stopAutoSave()
  await saveCurrentState()
})
```

### 4. 佈局變化時即時儲存

在 UI 佈局發生變化時觸發儲存（即時 + 定時雙保險）：

```typescript
// 觸發儲存的事件（在對應元件的 handler 中加入）：
// - workspace 切換（activeWorkspaceId 變化）
// - 分割面板 resize（ratio 變化，加 debounce 避免頻繁寫入）
// - 分割方向變更

// resize debounce 建議 500ms
const debouncedSaveLayout = debounce(saveCurrentState, 500)
```

### 5. 啟動時讀取並恢復佈局

```typescript
// app ready 後，讀取儲存的 layout 並套用
const savedState = await loadCurrentState()
if (savedState?.layout) {
  applyLayout(savedState.layout)
}
```

**恢復行為**（Phase 1 範圍）：
- ✅ 恢復 workspace 佈局（分割方向、比例）
- ✅ 恢復 active workspace / panel
- ✅ 恢復 terminal 工作目錄清單（顯示舊終端的目錄，但 PTY 進程為新開）
- ❌ PTY 進程重連（Phase 2+）
- ❌ scroll buffer 重播（Phase 4+）

> 啟動復原提示 UI（「是否恢復上次工作區？」）屬 Phase 6，本工單直接靜默恢復佈局即可

### 6. Build 驗證

```bash
npx vite build
```

### 7. 手動驗證

- [ ] 開啟 BAT，調整分割比例 → 強制關閉 BAT → 重啟 → 佈局與上次一致
- [ ] 切換 workspace → 關閉 BAT → 重啟 → active workspace 正確
- [ ] 等待 31 秒（觸發 auto-save）→ 強制 kill BAT 進程 → 重啟 → 狀態已保存
- [ ] 全新安裝（無 `windows.json`）→ BAT 正常啟動（向後相容）

### 8. 提交

```bash
git add electron/   # schema + auto-save 邏輯
git add src/        # 佈局變化觸發儲存
git add _ct-workorders/T0096-plan008-phase1-autosave-layout-persistence.md
git add _ct-workorders/PLAN-008-persistent-state-and-detached-pty.md

git commit -m "feat(state): PLAN-008 Phase 1 — 定時保底儲存 + UI 佈局持久化

- 每 30 秒 auto-save 防止 crash 遺失狀態
- before-quit 強制最後儲存
- UI 佈局（分割方向/比例/active workspace）持久化
- 擴充 WindowEntry schema（ptyServerId/layout，Phase 2 預留）
- 啟動時靜默恢復上次佈局"
```

---

## 🔍 驗收標準

- [ ] 重啟 BAT 後工作區佈局與上次一致
- [ ] Active workspace 正確恢復
- [ ] 強制 kill 進程後重啟，30 秒內的狀態已保存
- [ ] 全新安裝相容（無 crash）
- [ ] `npx vite build` 無錯誤
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 16:47 UTC+8

**現有 schema 位置**：`electron/window-registry.ts` WindowEntry interface（windows.json）

**before-quit 原有邏輯**：僅 save profile snapshots，未觸發 renderer 儲存最新 workspace 狀態

**佈局狀態儲存位置**：`electron/window-registry.ts` 新增 `WindowLayout` interface + `WindowEntry.layout` 欄位

**Auto-save 實作位置**：`src/stores/workspace-store.ts` — `startAutoSave()`/`stopAutoSave()` 30 秒定時器

**Build 結果**：✅ 通過（renderer + main + preload 三段建置成功）

**Commit hash**：待使用者確認後 commit

**異常或決策**：
- UI 佈局原本分散在 6 個 localStorage key，新增 `collectLayoutSnapshot()` / `restoreLayoutSnapshot()` 統一收集寫入 windows.json
- before-quit 新增 IPC 雙向握手（`workspace:flush-save` → renderer save → `workspace:flush-save-done`），2 秒超時保底
- 所有新欄位 optional，向後相容舊版 windows.json
