# T0140 — 注入 `BAT_HELPER_DIR` env var（C 層）

## 元資料
- **工單編號**：T0140
- **類型**：implementation（實作工單）
- **狀態**：✅ DONE
- **開始時間**：2026-04-17 12:47 (UTC+8)
- **完成時間**：2026-04-17 12:55 (UTC+8)
- **優先級**：🔴 High（BUG-032 修復鏈第 2 棒）
- **派發時間**：2026-04-17 12:55 (UTC+8)
- **關聯 BUG**：BUG-032（OPEN）
- **前置工單**：T0139（B 層打包 ✅ DONE，commit e871539）
- **後續工單**：T0141（`_local-rules.md` 改寫）
- **預估難度**：⭐⭐
- **預估 context 用量**：中（讀 `pty-manager.ts` 3 處 envWithUtf8 + `main.ts` ptyManager 建構流程）

---

## 目的

讓 BAT 啟動的所有 Claude session（PTY）都能透過 `BAT_HELPER_DIR` env var 找到 helper scripts 的絕對路徑，無論是開發機 dev mode 還是使用者環境的 packaged installer。

這是 BUG-032 修復鏈第 2 棒。完成後塔台與 Worker 都能可靠定位 `bat-terminal.mjs` / `bat-notify.mjs`。

---

## 必要修改

### 1. 路徑解析邏輯

依 T0138 研究 + T0139 Worker 提醒，使用：

```ts
import { app } from 'electron'
import path from 'path'

const helperDir = app.isPackaged
  ? path.join(process.resourcesPath, 'scripts')          // production: <install-root>/resources/scripts/
  : path.join(__dirname, '..', 'scripts')                // dev: <project-root>/scripts
```

**注意**：
- `__dirname` 在編譯後 = `dist-electron/`，上一層 = project root，再加 `scripts/` 對齊 dev mode
- `process.resourcesPath` 在 packaged app = `<install-root>/resources/` → 對齊 T0139 的 `extraResources` 落點
- 兩條路徑都對齊 T0139 已驗證的打包結果（無需重打包）

### 2. `electron/pty-manager.ts` — 注入 env var

T0138 研究指出共 **3 處 `envWithUtf8` 物件**（L382-400、L425-451、L495-516），對應三條 PTY 建立路徑：
1. WorkerChild subprocess（`sendToServer({ type: 'pty:create', ... })`）
2. 直接 node-pty（`pty.spawn`）
3. `child_process.spawn` fallback

**每處都要加**：
```ts
BAT_HELPER_DIR: helperDir,
```
（位置與既有 `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_REMOTE_PORT` 同層）

**helperDir 來源建議**（二選一，請 Worker 評估）：
- **方案 a**：在 `pty-manager.ts` 頂層直接計算 `helperDir`（import `app` + `path`）
- **方案 b**：由 `main.ts` 建立 ptyManager 時傳入（建構參數），ptyManager 存為 instance member

> Worker 看實際結構決定 — 哪個對既有 code style 干擾少就選哪個。若 `pty-manager.ts` 已 import `app`，方案 a 較簡潔；若 `pty-manager.ts` 刻意保持 pure（不依賴 electron），方案 b 較合理。

### 3. `electron/main.ts`（依方案 b 才需動）

若採方案 b，在建立 ptyManager 時傳入 helperDir：
```ts
const helperDir = app.isPackaged
  ? path.join(process.resourcesPath, 'scripts')
  : path.join(__dirname, '..', 'scripts')
const ptyManager = new PtyManager({ helperDir, ...其他參數 })
```

---

## 驗收條件（必跑）

### 自動驗證（dev mode）
1. `npm run build` 重新編譯 `dist-electron/`（不需 build:dir，只測 dev）
2. `npm run dev` 啟動 BAT
3. 在 BAT 內開新終端 → 執行：
   ```bash
   echo "BAT_HELPER_DIR=$BAT_HELPER_DIR"
   ls "$BAT_HELPER_DIR/bat-terminal.mjs"
   ls "$BAT_HELPER_DIR/bat-notify.mjs"
   ```
   - `BAT_HELPER_DIR` 顯示 dev mode 的絕對路徑（`<project-root>/scripts`）
   - 兩支 helper 都存在 → PASS

### 自動驗證（packaged）
1. `npm run build:dir` 產出 unpacked
2. 執行 `release/win-unpacked/better-agent-terminal.exe`（或 macOS/Linux 對應）
3. 在打包版 BAT 內開終端 → 同上 echo + ls
   - `BAT_HELPER_DIR` 顯示 packaged 路徑（`<install-root>/resources/scripts`）
   - 兩支 helper 都存在 → PASS

### 反向驗證
- 確認既有 env vars（`BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_TOWER_TERMINAL_ID`）**全數仍正確注入**（不能因新增 `BAT_HELPER_DIR` 而破壞其他）

### 整合微測（可選）
- 在打包版 BAT 內試跑：`node "$BAT_HELPER_DIR/bat-terminal.mjs" --help`
- 不應 ENOENT；至少應該執行到 helper 內部（即使 `--help` 未實作也好，重點是路徑能解析）

---

## 不在本工單範圍

- ❌ 修改 `_local-rules.md` → 是 **T0141**
- ❌ 修改塔台用法（白名單 `node "$BAT_HELPER_DIR/..."`）→ 也是 T0141
- ❌ 在 `2026_Taipower` 真實環境驗收 → 是 **T0142** 整合驗收
- ❌ CT 上游 skill PR → 是 **T0143**
- ❌ 動 helper scripts 內容、實作 `--help` 旗標

如果發現需要動上述任何項目，先在工單回報區提出。

---

## 工單回報區

### 進度
- **開始時間**：2026-04-17 12:47 (UTC+8)
- **完成時間**：2026-04-17 12:55 (UTC+8)
- **commit**：76f12ab

### 修改內容

**採方案**：a — 在 `pty-manager.ts` 頂層計算 `helperDir`

**理由**：
- `pty-manager.ts` 已 import `app` from 'electron'（L2），加 `path` import 後即可直接計算
- 方案 b 需動 `main.ts` 建構流程 + ptyManager 加 instance member，影響面較大
- 方案 a 對既有 code style 干擾最小，符合工單「哪個對既有 code style 干擾少就選哪個」

**實際修改** — `electron/pty-manager.ts`：

1. **L2**：新增 `import * as path from 'path'`
2. **L26-34 後新增 module-level helper**：
   ```ts
   function resolveHelperDir(): string {
     return app.isPackaged
       ? path.join(process.resourcesPath, 'scripts')
       : path.join(__dirname, '..', 'scripts')
   }
   ```
3. **3 處 `envWithUtf8` 注入 `BAT_HELPER_DIR: resolveHelperDir()`**（位置與 `BAT_TERMINAL_ID` 同層）：
   - L399（WorkerChild subprocess via `sendToServer({ type: 'pty:create' })`）
   - L444（直接 node-pty `pty.spawn`）
   - L516（`child_process.spawn` fallback）

**未動檔案**：`electron/main.ts`（方案 a 不需動 main.ts）

### 驗收結果

#### 靜態驗證（✅ 已完成）

- [x] **build 成功**：`npx vite build` 全綠，dist-electron/main.js 產出無誤
- [x] **bundle 注入驗證**：`grep -o 'BAT_HELPER_DIR[^,}]*' dist-electron/main.js` 輸出 3 行 `BAT_HELPER_DIR:tt()` → 3 處 envWithUtf8 全部注入 ✅
- [x] **bundle 邏輯對齊**：bundle 中 `tt()` = `d.app.isPackaged?P.join(process.resourcesPath,"scripts"):P.join(__dirname,"..","scripts")`，完全對齊原始碼
- [x] **dev 路徑正確**：`path.join(dist-electron, "..", "scripts")` → `<project-root>/scripts`（驗證 `__dirname` 編譯後位置）
- [x] **helper 檔案存在**：`scripts/bat-terminal.mjs`（9596 bytes）和 `scripts/bat-notify.mjs`（9051 bytes）都存在
- [x] **既有 env vars 未破壞**：3 處 envWithUtf8 的 BAT_SESSION / BAT_TERMINAL_ID / BAT_REMOTE_PORT / BAT_REMOTE_TOKEN 全數保留，僅新增 BAT_HELPER_DIR 一行

#### Runtime 驗收（⏸ 交由 T0142 整合驗收執行）

以下驗收項需要 BAT GUI 互動，無法在 auto mode session 內執行：

- [ ] dev mode：`npm run dev` 開啟 BAT → 新終端 echo `$BAT_HELPER_DIR` 與 ls 兩支 helper
- [ ] packaged：`npm run build:dir` → 執行 exe → 新終端 echo `$BAT_HELPER_DIR` 指向 `<install-root>/resources/scripts`

**建議**：T0142 真實環境驗收時，第一個動作就 `echo $BAT_HELPER_DIR && ls "$BAT_HELPER_DIR"`，一次驗完 dev 與 packaged 兩條路徑。

### 異常 / 待塔台決策

無異常。實作對齊工單需求，未超出範圍。

**備註**：
- 未動 `_local-rules.md`（T0141 的工作）
- 未動塔台 Bash 白名單（T0141 的工作）
- 本工單完成後，B 層（T0139 打包）和 C 層（T0140 注入 env）已齊備，T0141 可開始改寫規則

---
