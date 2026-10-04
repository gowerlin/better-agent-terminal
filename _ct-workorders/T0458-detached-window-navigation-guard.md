---
schema_version: 1
schema_kind: workorder
id: T0458
title: "detached workspace 視窗（與其他 BrowserWindow）套用 T0457 導航守門：setWindowOpenHandler + will-navigate 共用 navigation-guard，外部頁面不得在帶 preload 的視窗內載入"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: S
created_at: "2026-10-05T07:39:30+08:00"
started_at: null
updated_at: "2026-10-05T07:39:30+08:00"
completed_at: null
target_version: next
depends_on:
  - T0457
related:
  - "T0457（`443ba4e`）回報區「遭遇問題」2：detached workspace 視窗無 `setWindowOpenHandler` / `will-navigate`；`electron/navigation-guard.ts`（`decideNavigation` / `decideWindowOpen`）"
  - "D134 追加（塔台 07:39 依授權直接決定：外部頁面在帶 preload 的視窗載入 = 任意網站取得 `window.electronAPI`）"
affects_files:
  - electron/main.ts
  - electron/navigation-guard.ts
  - electron/__tests__/
  - e2e/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點**全專案 `new BrowserWindow(` 建立點（主視窗、detached workspace、setup wizard、about / 其他），逐一列出：是否有 preload、`webPreferences`（contextIsolation / sandbox / nodeIntegration）、是否已掛 `setWindowOpenHandler` / `will-navigate`。回報區附表。"
  - "🔴 **確認風險是否可觸發**：在 detached 視窗（或任一缺 handler 的視窗）點外部連結 / `target=_blank` / Markdown 預覽連結時，是否會在該視窗或新開的 Electron 視窗載入外部頁面、且該頁面能否看到 `window.electronAPI`。可用 Playwright e2e（T0453 的 `e2e/detached-workspace.spec.ts` fixture）實測；**只跑本單新 spec**（L141），若需 build 只做 e2e 所需最小 build 並說明。"
  - "🔴 修法：抽一個 `installNavigationGuards(win, { appUrl })`（用 T0457 的純函式），所有帶 preload 的 BrowserWindow 一律套用（含 detached）；`setWindowOpenHandler` 恆 `deny`、http(s) 才 `openExternal`。主視窗行為不得改變（既有 T0457 測試鎖住）。"
  - "🔴 `main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit` + 本單 e2e spec**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0458 — 所有視窗套用導航守門

## 驗收條件

- [ ] 回報區附 BrowserWindow 盤點表與風險實測結論（可觸發 / 不可觸發 + 證據）
- [ ] 所有帶 preload 的視窗掛上守門；測試鎖住（單元 + e2e：detached 視窗點外部連結 → 外部瀏覽器 / 被擋，視窗 URL 不變）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0457 回報區 + `electron/navigation-guard.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實測 → 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
