---
schema_version: 1
schema_kind: workorder
id: T0458
title: "detached workspace 視窗（與其他 BrowserWindow）套用 T0457 導航守門：setWindowOpenHandler + will-navigate 共用 navigation-guard，外部頁面不得在帶 preload 的視窗內載入"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: S
created_at: "2026-10-05T07:39:30+08:00"
started_at: "2026-10-05T07:40:08+08:00"
updated_at: "2026-10-05T07:44:59+08:00"
completed_at: "2026-10-05T07:44:59+08:00"
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

- [x] 回報區附 BrowserWindow 盤點表與風險實測結論（可觸發 / 不可觸發 + 證據）
- [x] 所有帶 preload 的視窗掛上守門；測試鎖住（單元 + e2e：detached 視窗點外部連結 → 外部瀏覽器 / 被擋，視窗 URL 不變）
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0457 回報區 + `electron/navigation-guard.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實測 → 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 抽出 `installNavigationGuards(win, { appUrl, openExternal, warn })`（T0457 純函式組成），`main.ts` 以 `guardWindowNavigation(win)` 套用到**全部兩個**帶 preload 的 BrowserWindow（主視窗、detached workspace）。風險實測**可觸發**（見下），修正後 e2e 綠燈；主視窗行為不變。

**Landing Zone**：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 `electron/main.ts`、`electron/navigation-guard.ts`、`electron/__tests__/`、`e2e/` 皆存在；C-2 無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo` / `CT_INTERACTIVE=0`。

### 產出摘要

#### BrowserWindow 盤點（`electron/` + `src/` 全掃 `new BrowserWindow(`；另查 `BrowserView` / `WebContentsView` / `<webview>` / `web-contents-created` 皆無）

| 視窗 | 位置 | preload | webPreferences | 修正前 `setWindowOpenHandler` / `will-navigate` | 修正後 |
|---|---|---|---|---|---|
| 主視窗 | `electron/main.ts` `createWindow`（`const win = new BrowserWindow(`） | ✅ `preload.js` | `contextIsolation: true` / `nodeIntegration: false` / `sandbox` 未設（Electron 41 預設 sandbox） | ✅ / ✅（T0457 inline） | `guardWindowNavigation(win)`，邏輯不變 |
| detached workspace | `electron/main.ts` `workspace:detach`（`const detachedWin = new BrowserWindow(`） | ✅ `preload.js` | 同上 | ❌ / ❌ | `guardWindowNavigation(detachedWin)` |
| setup wizard / about / 其他 | — | — | — | 非獨立視窗（`SetupWizardShell` / `AboutPanel` 為 renderer 內元件） | — |
| `window.open` 子視窗 | （修正前 detached 由 Electron 預設建立） | — | — | — | 兩視窗 `setWindowOpenHandler` 恆 `deny` ⇒ 不再產生 |

#### 風險實測（`e2e/navigation-guard.spec.ts`，HEAD `51f4fbe` 的 `npx vite build` 產物，修正前）

本機 HTTP server 模擬外部站、main process stub `shell.openExternal`：

| 探測（detached 視窗） | 修正前結果 |
|---|---|
| `location.href = http://127.0.0.1:<port>/…` | 🔴 **視窗被導航到外部頁**（`urlAfter = http://127.0.0.1:61996/detached-navigate`，server hits=1），且**該外部頁 `typeof window.electronAPI !== 'undefined'` 為 `true`** ⇒ 任意網站取得 preload bridge |
| `window.open(http…)` | 🔴 開出 Electron 新視窗載入外部頁（hits=1；該子視窗 `electronAPI` 為 false），未走 openExternal |
| `<a target=_blank>` 點擊 | 🔴 同上（新 Electron 視窗、hits=1） |
| `window.open(file:///C:/Windows/System32/drivers/etc/hosts)` | 🔴 開出 Electron 新視窗載入本機檔 |
| 主視窗同四項 | ✅ 皆已擋（T0457） |

結論：**可觸發**。觸發條件為 detached 視窗內任何導向外部 URL 的連結 / 導航（例如 Markdown 預覽中的連結被 renderer 以預設行為導航）。

#### 改動

| 檔案 | 改動 |
|---|---|
| `electron/navigation-guard.ts` | 新增 `GuardableWindow`（結構型別，BrowserWindow 可直接傳入）/ `NavigationGuardOptions` / `installNavigationGuards`：`setWindowOpenHandler` 恆 `deny`，`decideWindowOpen` 為 http(s) 才 `openExternal`；`will-navigate` 以 `decideNavigation` 判斷，非 `allow` 一律 `preventDefault`，http(s) `openExternal`、其餘 warn（log 訊息字串與 T0457 相同，只含 scheme） |
| `electron/main.ts` | import 改為 `installNavigationGuards`；新增 `guardWindowNavigation(win)`（`appUrl` 同 T0457：`VITE_DEV_SERVER_URL` 或 `pathToFileURL(dist/index.html)`；`openExternal` 以 lambda 延遲取 `shell.openExternal`）；主視窗 inline handler 改呼叫它；detached 視窗補呼叫 |
| `electron/__tests__/navigation-guard-install.test.ts`（新） | 13 cases：安裝兩個 handler；window.open http(s) → openExternal + deny；file/javascript/data/about → deny、不 openExternal、warn 不含路徑；app URL（含 `?detached=` / `?windowId=` / hash）放行；http 導航 preventDefault + openExternal；file/data 導航 preventDefault + warn。**分類守門（L140）**：掃 `electron/**/*.ts`（非測試），每個 `new BrowserWindow(` 必須指派給 `const X` 且檔內有 `guardWindowNavigation(X)`，新視窗漏掛即紅 |
| `e2e/navigation-guard.spec.ts`（新） | 主視窗 + detached 視窗各四項探測（window.open http / target=_blank 點擊 / window.open file: / location.href http）：無新 Electron 視窗、外部站 0 hit、視窗 URL 不變、http(s) 恰好一次 openExternal、file: 不進 openExternal |

#### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| e2e 紅燈（修正前） | FAILED（預期） | `detached: no Electron window for http://127.0.0.1:61996/detached-window-open`；log 見上表 |
| 單元紅燈（修正前） | FAILED（預期） | `Tests 12 failed \| 1 passed (13)`（`installNavigationGuards` 不存在；`detachedWin needs guardWindowNavigation(detachedWin)`） |
| 新單元 + T0457 單元 | PASS | `Tests 55 passed (55)`（navigation-guard-install 13 + navigation-guard 42） |
| `npm run test:unit` | PASS | `Test Files 163 passed (163)`、`Tests 2646 passed \| 1 skipped (2647)` |
| `npx tsc --noEmit` | PASS（36 ≤ 36） | 36，皆既有 |
| 補充：`npx tsc --noEmit -p tsconfig.node.json` | 本單檔案 / 改動行 0 error | 過濾 `navigation-guard` 與 `main.ts` 改動行無命中（`main.ts(997)` `app.dock` 為既有未改程式） |
| `npx vite build` | PASS | 工單允許「e2e 所需最小 build」：修正前（HEAD）一次、修正後一次；build 當下工作樹無他人未提交產品檔（僅 T0427 / T0436 工單檔） |
| e2e（只跑本單 spec） | PASS | `npx playwright test e2e/navigation-guard.spec.ts` → `1 passed (17.9s)`；主視窗四項維持 T0457 行為 |
| 實機 / 打包版 | 未做 | dev server 模式（`VITE_DEV_SERVER_URL`）與打包 asar 路徑未實機跑；`isAppUrl` 對兩者已有 T0457 單元覆蓋 |

### 遭遇問題

1. **超出 affects_files**：無（`electron/__tests__/`、`e2e/` 均在列）
2. `window.open` 子視窗修正前看不到 `electronAPI`（e2e 實測 false），真正把 bridge 交給外部頁的是 **detached 視窗本身被導航**；兩條路徑現皆封閉
3. T0457 遭遇問題 1（IPC `shell:open-external` 對 `file:///` 走 `shell.openPath`）仍為範圍外殘留，本單未動
4. `main.ts` 維持 LF（git 提示 autocrlf 為既有設定）；同工作樹 T0427 / T0436 工單檔本單未碰；未使用 stash / reset / checkout / restore

### Commit

- `git commit --only`：`electron/navigation-guard.ts`、`electron/main.ts`、`electron/__tests__/navigation-guard-install.test.ts`、`e2e/navigation-guard.spec.ts`、本工單；不 push。commit `102d8e0`

### 回報時間

2026-10-05T07:44:22+08:00
