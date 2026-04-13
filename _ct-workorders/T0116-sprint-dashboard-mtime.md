# T0116 — Sprint Dashboard lastUpdated 改讀 file mtime

## 元資料

| 欄位 | 內容 |
|------|------|
| **工單編號** | T0116 |
| **標題** | Sprint Dashboard「最後更新」改為讀 sprint-status.yaml 的 file mtime |
| **類型** | UX 改善 |
| **狀態** | ✅ DONE |
| **開始時間** | 2026-04-13 23:16 UTC+8 |
| **優先級** | 低 |
| **建立時間** | 2026-04-13 23:15 UTC+8 |
| **相關** | T0114（Sprint Dashboard）/ PLAN-009 |

---

## 需求

SprintDashboard 的「最後更新」目前讀 yaml 裡的 `last_updated` 欄位。
每次改 yaml 內容都要手動更新這個時間欄位，容易遺漏。

**改為讀 sprint-status.yaml 的檔案修改時間（mtime）**——更準確、零維護。

---

## 建議實作

**新增 `fs:stat` IPC handler**（影響最小）：

```typescript
// electron/main.ts
registerHandler('fs:stat', async (_ctx, filePath: string) => {
  try {
    const stat = await fs.stat(filePath)
    return { mtimeMs: stat.mtimeMs, size: stat.size }
  } catch {
    return null
  }
})
```

```typescript
// electron/preload.ts — fs namespace 擴充
stat: (path: string) => ipcRenderer.invoke('fs:stat', path)
```

**ControlTowerPanel 的 loadSprintStatus 擴充**：
載入 yaml 後，額外呼叫 `fs:stat` 取得 mtime，塞入 sprintStatus 或作為獨立 state。

**SprintDashboard**：
`lastUpdated` 優先用 mtime，yaml 欄位作為 fallback。

---

## 驗收條件

1. Sprint Dashboard「最後更新」顯示 file mtime（非 yaml 欄位）
2. yaml 的 `last_updated` 欄位不再需要手動維護
3. Build 通過

---

## 回報區（Worker 填寫）

### Commit Hash
（待 commit）

### 完成時間
2026-04-13 23:25 UTC+8

### 產出摘要
- `electron/main.ts` — 新增 `fs:stat` IPC handler（回傳 mtimeMs + size）
- `electron/preload.ts` — fs namespace 新增 `stat()` 方法
- `electron/remote/protocol.ts` — PROXIED_CHANNELS 加入 `fs:stat`
- `src/components/ControlTowerPanel.tsx` — loadSprintStatus 載入 yaml 後取 file mtime 覆蓋 lastUpdated

### 遭遇問題
無

### 互動紀錄
無
