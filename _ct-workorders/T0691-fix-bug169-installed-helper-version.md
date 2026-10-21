---
schema_version: 1
schema_kind: workorder
id: T0691
title: "BUG-169 修正：安裝版 helper 的 `--version` 與 BAT MCP `serverInfo.version` 回報實際版號（打包時在 resources 放只含 name / version 的 package.json）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-169
priority: P3
sizing: S
created_at: "2026-10-21T23:29:38+0800"
updated_at: "2026-10-21T23:29:38+0800"
depends_on: []
related:
  - "BUG-169（OPEN low）：helper 以 `join(<helper 目錄>, '..', 'package.json')` 讀版號，安裝版 `resources/` 沒有這個檔 → fallback `0.0.0`（`scripts/bat-terminal.mjs:72`、`scripts/bat-notify.mjs:85`、`scripts/bat-mcp.mjs:83`）"
  - "T0689 / D179：`build.extraResources` 的 scripts filter 只收 6 個執行期 helper；`verify-packaged-native.js` 的 `helper-scripts` 檢查擋 `resources/scripts` 底下多出的任何檔案 → 版號檔不能放進 `resources/scripts`"
  - "server bundle 的先例：`scripts/build-server-bundle.mjs` 在 bundle 根目錄寫只含 `name` / `version` 的 `package.json`（約第 412 行），helper 走同一條 `../package.json` 讀得到"
  - "版號來源：`scripts/build-version.js`（VERSION env > package.json，T0451 規則）；CI（`pre-release.yml:222` 起）先跑 `node scripts/build-version.js` 再分別 `npx electron-builder --win|--mac|--linux`"
affects_files:
  - package.json
  - scripts/build-version.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/build-server-bundle.mjs
  - scripts/__tests__/**
  - scripts/<新增的 electron-builder hook 或產生器，若採用>
  - .gitignore
  - docs/agent-guide/packaging-release-checks.md
  - CLAUDE.md
  - _ct-workorders/BUG-169-installed-helpers-report-version-0.0.0.md
  - _ct-workorders/T0691-fix-bug169-installed-helper-version.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 方向（塔台決定，BUG-169 修正方向 ①）：打包時在 `<resources>/package.json` 放一個**只含 `name` 與 `version`** 的檔（與 server bundle 根目錄的 `package.json` 同格式），helper 現有的 `../package.json` 讀法不改就能讀到。不採方向 ②（PTY env 帶版號）：helper 在 BAT 外手動執行時也要報對版號，且不必動 `buildPtyEnv()` 與 codex `env_vars` 白名單。若你查到 ① 有實際障礙（例如 Electron 會把 `resources/package.json` 當成 app 載入、某平台的 resources 目錄寫不進去），**先停，用 BAT 通道問塔台**，不要自行改走 ②。"
  - "🔴 版號必須是**實際打包的版號**，不是 repo `package.json` 的字面值：CI 以 `VERSION` env 經 `scripts/build-version.js` 決定版號後才跑 `electron-builder`；本機 `build` / `build:dir` 也經同一套規則。實作方式由你選（electron-builder `afterPack` hook 取 packager 的 app 版號寫進 `appOutDir` 的 resources、或建置前產生檔案再以 `extraResources` 複製），選擇與理由寫進回報。產生的中間檔若落在 repo 內須加進 `.gitignore`。三個平台的 resources 位置都要對：win / linux `resources/`、mac `<App>.app/Contents/Resources/`。🔴 不得使用 `build.<platform>.files` / `build.<platform>.extraResources`（CLAUDE.md 🔴，T0546）；`resources/scripts` 仍只放 6 個執行期 helper（T0689），不得放版號檔。"
  - "🔴 先查證再改：Electron 41 的 app 搜尋路徑（`resources/app.asar`、`resources/app`、`default_app.asar`）是否會讀 `resources/package.json`，附證據（Electron 原始碼或官方文件的出處）。不要為了驗證而啟動打包版 app；真的要啟動只能用 e2e 的隔離實例方式，且不得碰已安裝的 BAT（`C:\\Program Files\\BetterAgentTerminal`）與使用者的 userData。"
  - "🔴 若 server bundle 已有寫 `{ name, version }` 的邏輯，能共用就抽一個小函式給兩邊用（不要複製一份格式）；不能共用就說明原因。helper 的版號讀法（`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs`）原則上不改；若必須改，三個一起改且行為一致，並更新它們的測試。"
  - "🔴 守門：`scripts/verify-packaged-native.js` 新增一項打包產物檢查（問題 id 建議 `helper-version`）：`<resources>/package.json` 存在、可解析、只有 `name` / `version`、`version` 非空且不是 `0.0.0`；可取得預期版號時（例如由呼叫端或 app 的 `package.json` 取得）必須相等。三平台 fixture 在 `scripts/__tests__/verify-packaged-native.test.mjs` 測綠與紅（缺檔、`0.0.0`、多出欄位、版號不符）。既有 `helper-scripts` 等檢查不得改壞。"
  - "🔴 實測：`npm run verify:helpers` 綠；`npm run build:dir`（會清掉並重建 `dist-electron`）；`release/win-unpacked/resources/package.json` 內容；以 CI 的方式跑 `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠；清掉 `BAT_*` 連線 env、cwd = `release/win-unpacked/resources/scripts`，執行 `bat-terminal.mjs --version`、`bat-notify.mjs --version`、`bat-mcp.mjs --version`，三者都印實際版號（不是 `v0.0.0`）；BAT MCP `initialize` 的 `serverInfo.version`：能不連線取得 initialize 回應就實測，不能就以單元測試證明它與 `--version` 同一來源。CI 的 VERSION env 路徑以單元測試或可還原的本機演練證明；演練後 `git diff -- package.json package-lock.json` 必須為空。只碰 `release/` 的產物。"
  - "🔴 測試：相關檔案的 vitest（`scripts/__tests__/verify-packaged-native.test.mjs`、`server-bundle-helpers.test.mjs`、`asar-runtime-deps.test.mjs`、server bundle 相關測試，以及你新增的測試）全綠；最後跑一次整包 `npm run test:unit`（基線 5779 passed / 326 files / 3 skipped，只能增加）。本單不改 `src/` / `electron/`，typecheck 不必跑；若意外改到，對應的 typecheck 要 = 0。"
  - "🔴 文件：`docs/agent-guide/packaging-release-checks.md`（打包產物檢查項目、Helper bundle 段說明版號來源）；CLAUDE.md「Packaging / Release 前置檢查」節只在必守規則有變時加一句（遵守 CLAUDE.md 開頭的撰寫規則，`##` 標題不改名）。BUG-169：狀態改 `FIXED`、`updated_at`（取系統時間）、補「修復紀錄」（commit、方式、實測）。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0691 — BUG-169 修正：安裝版 helper 回報實際版號

## 元資料

- **工單編號**：T0691
- **類型**：bugfix（BUG-169，low）
- **優先級**：P3
- **建立時間**：2026-10-21T23:29:38+0800
- **預估規模**：S

## 目標

安裝版的 `bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs --version` 與 BAT MCP `initialize` 的 `serverInfo.version` 目前都是 `0.0.0`，因為 helper 讀 `<resources>/package.json`，而安裝目錄沒有這個檔。打包時補上一個只含 `name` / `version` 的 `package.json`（與 server bundle 同格式），版號 = 實際打包的版號，並由打包產物檢查守住。只影響顯示，塔台判讀 helper 一律看 exit code。

## 要做的事

1. 查證 Electron 41 不會把 `resources/package.json` 當 app 載入（附出處）。
2. 選定產生方式（afterPack hook 或建置前產生 + extraResources），版號取實際打包版號，三平台位置正確。
3. 能共用就與 server bundle 共用 `{ name, version }` 的寫法。
4. `verify-packaged-native.js` 加 `helper-version` 檢查與三平台 fixture 測試。
5. `verify:helpers`、`build:dir`、打包產物檢查、三個 helper `--version`、MCP `serverInfo.version`。
6. 文件、BUG-169 狀態與修復紀錄。

## 驗收

- `release/win-unpacked/resources/package.json` 只有 `name` / `version`，版號 = 本次打包版號；`resources/scripts` 仍正好 6 個 helper。
- 三個 helper 的 `--version` 在打包目錄印實際版號；MCP `serverInfo.version` 同一來源（實測或測試證明）。
- `verify-packaged-native.js` 對 `release/` 綠；缺檔、`0.0.0`、多出欄位、版號不符都有紅燈測試（三平台 fixture）。
- VERSION env 路徑有測試或可還原演練，演練後 `package.json` / lock 無 diff。
- 整包 `test:unit` ≥ 5779 passed、0 failed。
- 只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
