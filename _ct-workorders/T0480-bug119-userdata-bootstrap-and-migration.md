---
schema_version: 1
schema_kind: workorder
id: T0480
title: "BUG-119 修復 A：app-paths bootstrap（setName + runtime + ready 前同步搬移 + 顯式 setPath userData）+ snippetDb lazy + 自檢 + 單元 / 順序 / e2e 測試"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-119
priority: P1
sizing: M
created_at: "2026-10-13T22:32:56+08:00"
started_at: "2026-10-13T22:34:45+08:00"
updated_at: "2026-10-13T22:44:36+08:00"
completed_at: "2026-10-13T22:44:36+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0479
related:
  - "D138（採 T0479 推薦 (a)+(c)+(b)，拆 A / B / C）"
  - "T0479 回報區第 3 節（方案）、第 4 節（搬移規則 —— 本單 SoT）、第 5 節表格 A 列（affects / 驗收 / e2e）"
  - "BUG-119"
affects_files:
  - electron/app-paths-bootstrap.ts
  - electron/userdata-migration.ts
  - electron/main.ts
  - electron/snippet-db.ts
  - electron/__tests__/
  - e2e/
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **使用者真實資料目錄只讀**：`%APPDATA%\\BetterAgentTerminal\\`、`%APPDATA%\\better-agent-terminal\\` 不得寫入 / 搬移 / 刪除。不得以預設實例（無 `--runtime`）啟動含本單改動的 build —— 那會對真實目錄執行 migration。手動 smoke 一律用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束後只刪自己建立的目錄並回報"
  - "🔴 搬移規則以 T0479 回報區第 4 節為準；偏離須在回報區逐條說明理由。`Local State` 必須在 ready 前同步複製（不搬走、不覆蓋）—— 漏掉會讓 server-token 解不開、遠端全部重配"
  - "🔴 不改 `electron/pty-manager.ts`、`scripts/_bat-*.mjs`（T0481 並行處理）；不改 README / CLAUDE.md / docs（T0482）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`package.json` / `package-lock.json` 不動"
---

# T0480 — BUG-119 修復 A：userData 統一

## 實作（依 T0479 第 3、4 節）

1. **`electron/userdata-migration.ts`（新增）**：純 fs 函式，`appData` / `suffix` / `isServerRunning` / clock 可注入。實作 T0479 第 4 節全部規則：
   - 預設實例：marker `T/.userdata-migration.json`（已存在即略過；`L` 不存在不寫 marker）；`Local State` 缺才複製；`snippets.json` 複製 / 合併（去重鍵、id 重編、`.pre-merge-<stamp>.bak`、tmp + rename）/ 任一方解析失敗的處理；`message-archives/*.jsonl` 同名不存在才 rename；`Logs/`、`Crashes/`、`lockfile`、其他檔不碰；`L` 不刪
   - runtime 實例：`T_rt` 存在即用（`L_rt` 也在則 warn）；否則 `isServerRunning(L_rt)` 或 `renameSync` 失敗 → 本次沿用 `L_rt`、下次再試；成功 → 用 `T_rt` 寫 marker；runtime 實例 snippets 各自一份，不從預設實例複製
   - 每項 try/catch、不 throw，回傳 `migrationReport`（含最終 userData 路徑）
2. **`electron/app-paths-bootstrap.ts`（新增）**：只 import `electron` / `path` / `fs` / `./userdata-migration`（+ `isServerRunning` 若需要，確認其 import 鏈不會在 import 期呼叫 getPath）。依序：`setName('BetterAgentTerminal')` → 解析 runtime id（`--runtime=` 優先於 `BAT_RUNTIME`，沿用 `main.ts:163-164` 規則）→ `target` 計算 → 同步 migration → `app.setPath('userData', 最終路徑)` → 匯出 `resolvedUserData` / `runtimeId` / `migrationReport`
3. **`electron/main.ts`**：bootstrap 為**第一個** import；`:157-172` 改用 bootstrap 匯出值（保留 console 行但印正確路徑）；`AppUserModelId` 沿用 `runtimeId`；`logger.init` 後以 `logger.log('[userdata-migration] ...')` 寫出 report（`Local State` 複製失敗時明寫「server-token 將重生、遠端需重新配對」）；whenReady `setPath('crashDumps')` 後自檢 `getPath('userData') !== resolvedUserData` → `logger.error`
4. **`electron/snippet-db.ts`**：lazy 解析 `dataPath`（第一次使用時），對外 API 與所有 consumer 行為不變（trace 全部呼叫點）
5. `MESSAGE_ARCHIVE_DIR` 確認在 bootstrap 後求值；可順手改 lazy

## 範圍外（不做）

- T0479 選配 D（提早 `logger.init` / early `uncaughtException`）—— 另案
- T0479 範圍外發現 4（macOS PATH 修正實際晚於 import）—— 另案

## 驗收條件

- [ ] 單元測試涵蓋 T0479 第 4 節每條規則（Local State 只缺才複製；snippets 複製 / 合併 / 去重 / id 重編 / 雙方解析失敗；marker 只跑一次；runtime 改名 / server 執行中沿用舊目錄 / 兩邊都存在 / rename 失敗；所有失敗不 throw）
- [ ] 靜態測試：`main.ts` 第一個 import 是 bootstrap；bootstrap 不 import 其他 `electron/` 模組（migration 模組除外）
- [ ] `npx vite build` 後產物順序：bootstrap `setPath("userData"` offset < snippet-db 單例 offset（回報區附數字）
- [ ] e2e（isolated runtime）：(i) 全新 runtime 只有 `BetterAgentTerminal-runtime-<id>`（含 `Logs` / `Crashes` / `Local State` / `lockfile`），沒有 `better-agent-terminal-runtime-<id>`；(ii) 預置舊 `better-agent-terminal-runtime-<id>`（`settings.json` 標記值 + `snippets.json`）→ 啟動後已改名、標記值保留、`snippet:getAll` 讀得到
- [ ] `npm run test:unit` 全綠（回報 files / passed / skipped）；`npx vite build` exit 0；`npx tsc --noEmit -p .` 錯誤數不高於基線 36
- [ ] 回報區列出「需使用者實機驗收」項目（T0479 第 5 節人工驗收：Windows server-token 不變、新 Logs 位置、舊目錄不變、關閉日誌重啟後有效；mac safeStorage / Keychain 殘餘風險）

## Sub-session 執行指示

1. 讀本工單 + D138 + BUG-119 + **T0479 回報區全文** + `electron/main.ts`（`:1-220`、`:540-560`、`:1395-1405`、`:2077`）+ `electron/snippet-db.ts` + `electron/logger.ts` + `electron/terminal-server/pid-manager.ts` + `e2e/fixtures/electron-isolation.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。BUG-119 修復 A 已實作，全部驗收條件通過：

- 新增 `electron/app-paths-bootstrap.ts`，作為 `main.ts` 的第一個 import，依序執行：
  1. `setName('BetterAgentTerminal')`
  2. 解析 runtime id
  3. 同步 migration
  4. `app.setPath('userData', …)`
- 新增 `electron/userdata-migration.ts`，實作 T0479 第 4 節的搬移規則；此模組不 import electron
- `snippetDb` 改為 lazy：第一次使用時才解析 `snippets.json` 的路徑
- `main.ts` 在 `logger.init` 之後寫出 migration report；`setPath('crashDumps')` 之後自檢 userData

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/`，PASS
- C-3（C-0 已 PASS，僅記錄）：
  - `electron/app-paths-bootstrap.ts`、`electron/userdata-migration.ts` 原本不存在，最近的既有上層目錄是 `electron/`
  - `electron/main.ts`、`electron/snippet-db.ts`、`electron/__tests__/`、`e2e/` 都存在
  - 判定：present
- C-2：沒有 `branch` 欄位；實際在 `main` 上執行
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`（沒有互動 Q/A）

### 實作內容

**`electron/userdata-migration.ts`（新增）**

純 fs 實作。可注入的依賴：
- `appData`、`suffix`
- `isServerRunning`：預設用 `terminal-server/pid-manager` 的版本（該模組只 import `fs` / `path`）
- `now`、`renameSync`

匯出：
- `parseRuntimeId`：沿用原 `main.ts:163-164` 的規則，`--runtime=` 優先於 `BAT_RUNTIME`
- `runtimeSuffix`、`legacyUserDataDir`、`targetUserDataDir`
- `migrateUserData`、`describeMigrationReport`

預設實例：
- `L` 不存在 → `skipped: no-legacy`，不寫 marker
- marker 已存在 → `skipped: marker-exists`
- 其餘情況依序處理：
  - `Local State`：只在目標沒有時複製，用 `COPYFILE_EXCL`
  - `snippets.json`：
    - 目標沒有 → 複製
    - 兩邊都有 → 合併：去重、id 重編、寫 `.pre-merge-<stamp>.bak` 備份、以 tmp + rename 寫入
    - 任一方解析失敗 → 依 T0479 規則 ③ / ④ 處理
  - `message-archives/*.jsonl`：目標沒有同名檔才 rename
  - `Logs` / `Crashes`：不搬，只記錄 `legacy … remain at <L>/…`
  - 最後寫 marker：`{ v, from, at, items }`

runtime 實例：
- `T_rt` 已存在 → 直接用 `T_rt`；`L_rt` 也存在時記 warn `both-exist`
- `L_rt` 不存在 → 用 `T_rt`
- `isServerRunning(L_rt)` 為真 → 這次沿用 `L_rt`，下次再試
- `renameSync` 失敗 → 這次沿用 `L_rt`
- 改名成功 → 寫 marker
- 不從預設實例複製 snippets

錯誤處理：每一項都包在 try/catch 裡，最外層再包一層，整個函式不會 throw。回傳的 `MigrationReport.userData` 是最終要用的路徑。

新增的防護：runtime id 不符合 `/^[a-zA-Z0-9._-]+$/` 時不搬移任何東西（`skipped: invalid-runtime-id`，記 warn），userData 仍是 `BetterAgentTerminal-runtime-<id>`。理由見「偏離 / 補充」第 3 條。

**`electron/app-paths-bootstrap.ts`（新增）**

- 只 import `electron`、`path`、`./userdata-migration`
- 依序執行：`app.setName` → `parseRuntimeId(process.argv, process.env)` → `migrateUserData({ appData: app.getPath('appData'), suffix })` → `app.setPath('userData', report.userData)`
- 匯出 `runtimeId`、`migrationReport`、`resolvedUserData`
- fallback 只在 `getPath('appData')` 拋錯時使用，路徑為 `<dirname(getPath('userData'))>/BetterAgentTerminal<suffix>`

**`electron/main.ts`**

- 第 1-3 行：第一個 import 是 bootstrap，旁邊附註解說明為什麼必須排第一
- 原 `:157-172`（setName、runtime 解析、setPath）改成使用 bootstrap 匯出的值；兩行 console 保留，印出正確的 `resolvedUserData`
- `AppUserModelId` 沿用 bootstrap 匯出的 `runtimeId`，該段程式碼不變
- `logger.init` 之後逐行輸出 `[userdata-migration] …`，error / warn / info 分別對應 `logger.error` / `warn` / `log`
- `Local State` 複製失敗時，detail 會寫明「server-token.json will be regenerated and remote clients must be paired again」
- `setPath('crashDumps')` 與 crashDumps log 之後加自檢：`getPath('userData') !== resolvedUserData` 時 `logger.error`

**`electron/snippet-db.ts`**

- `dataPath` 改為 lazy getter
- 新增 `ensureLoaded()`，11 個 public method 的開頭都會呼叫；`close` 是 no-op，不需要
- 對外 API 不變。consumer 只有 `main.ts:2204-2213` 的 10 個 `snippet:*` handler，已逐一 trace；`src/lib/snippet-context.ts` 只在註解裡提到

**`MESSAGE_ARCHIVE_DIR`（不改）**

`registerProxiedHandlers()` 在 `main.ts` 主體執行，此時 bootstrap 已經跑完，所以它已經落在正確目錄。它以字串形式傳給 `registerClaudeHandlers` 的 deps，改成 lazy 必須改 handler 簽章，因此維持原樣。

**`e2e/fixtures/electron-isolation.ts`**

`launchIsolated` 的 `opts` 新增可選的 `beforeLaunch(runtimeId)`，用來預先放好舊目錄。既有呼叫點不受影響。

### 驗證

**單元測試（新增 3 檔，共 36 個測試）：PASS**

`electron/__tests__/userdata-migration.test.ts`（26 個）：
- `Local State`：只在目標沒有時複製；不覆蓋既有檔；複製失敗時記 error，並寫出後果
- `snippets.json`：
  - 複製
  - 合併：去重鍵含 `workspaceId`；id 從 6 開始重編；`nextId` = 9；產生 `.pre-merge-20261013-224005.bak`；沒有 tmp 檔殘留
  - 沒有新項目時不重寫
  - `L` 解析失敗、`T` 解析失敗
- `message-archives`：同名檔保留在 `L`；rename 失敗時留在 `L`
- Logs、Crashes、lockfile、未知檔都不碰；`L` 不刪除
- marker 只執行一次
- runtime 實例：
  - 兩邊都不存在
  - 改名成功
  - terminal server 執行中
  - rename 回傳 EPERM
  - `isServerRunning` 拋錯
  - 兩邊都存在
  - 不從預設實例帶入 snippets
  - 不安全的 runtime id
- appData 是一般檔案、target 無法建立時都不 throw

`app-paths-bootstrap-order.test.ts`（7 個）：
- 靜態檢查：`main.ts` 的第一個 import；bootstrap、migration、pid-manager 各自的 import 白名單；`main.ts` 不再呼叫 `setName` 與 `setPath('userData'`
- mock electron：呼叫順序為 `setName → getPath(appData) → setPath(userData)`；`--runtime=` 優先；沒有 `--runtime=` 時用 `BAT_RUNTIME`；runtime 目錄改名

`snippet-db-lazy.test.ts`（3 個）：
- import 時不呼叫 getPath
- 第一次使用時呼叫一次
- 每條讀取路徑都會先載入資料

**`npm run test:unit`：PASS**

176 files / 3009 passed / 1 skipped（共 3010）

**`npx vite build`：PASS**

exit 0

**產物順序：PASS**

`dist-electron/main-Dusxksyl.js`（693107 bytes）中的 offset：

| 位置 | offset |
|---|---|
| `setName(` | 8085 |
| bootstrap 的 `getPath("appData")` | 8193 |
| `setPath("userData"`（全檔只有這一處） | 8451 |
| snippet-db 的 `getPath("userData")`（在 lazy getter 內，import 時不執行） | 269971 |
| snippet-db 單例 `new QR` | 272622 |
| `requestSingleInstanceLock()` | 638075 |

- `--runtime=` 在 2078，位於 migration 模組內
- 結論：`setPath("userData"` 8451 < snippet-db 單例 272622
- 修改前（T0479 實測）：snippetDb 實例化 264994 < setName 630361，順序相反

**`npx tsc --noEmit -p .`：PASS**

36，與基線 36 相同。錯誤全部在 `src/`；這個 tsconfig 不涵蓋 `electron/`。

**electron 檔案型別檢查（補充）：PASS**

- 以 `tsc --strict` 單獨檢查 `userdata-migration.ts`、`app-paths-bootstrap.ts`、`snippet-db.ts`：0 錯誤
- `-p tsconfig.node.json` 回報的 `main.ts` 錯誤（TS6307 / TS2802 / `:197` ShortcutDetails）都是既有的，本單沒有新增

**e2e `e2e/bug119-userdata-unification.spec.ts`：PASS（2/2）**

(i) 全新 runtime：
- userData = `%APPDATA%\BetterAgentTerminal-runtime-e2e-bug119-fresh-…`
- 目錄內有 `Logs`、`Crashes`、`Local State`、`lockfile`，另有設定類檔案與 `server-token.json` 等
- `getLoggingInfo()` 回報的 logsDir、crashesDir 都在這個目錄下
- 沒有產生 `better-agent-terminal-runtime-<id>`

(ii) 預先放好舊目錄 `better-agent-terminal-runtime-<id>`，內含 `settings.json`（`logLevel: warn`）、`snippets.json` 與一個 sentinel 檔，啟動後：
- 舊目錄已不存在，sentinel 檔出現在新目錄
- marker 記錄 `runtime-dir: renamed`
- `getLoggingInfo().logLevel === 'warn'`。這同時證明啟動時是從正確目錄讀取日誌設定，即 R1 #9 已修好
- `snippet.getAll()` 包含 `[7, 'bug119-e2e-snippet']`

**e2e 回歸：PASS**

- `smoke`、`navigation-guard`、`detached-workspace`：3 passed
- `plan039-multi-remote`：4 passed

**真實目錄未受影響：PASS**

- `%APPDATA%\better-agent-terminal\` 的時間戳與 T0479 記錄的一致：`Local State` 05-26 20:58，`lockfile` / `Logs` 10-13 14:49
- `%APPDATA%\BetterAgentTerminal\.userdata-migration.json` 不存在，代表預設實例的 migration 從未執行
- 測試結束後沒有殘留任何 `*-runtime-e2e-*` 目錄

**部署 / release / 實機：不適用**

本單沒有打包，也沒有以預設實例啟動（依 memory_overrides）。

### 需使用者實機驗收（AI 無法代驗）

1. **Windows，用現有的使用者環境**：安裝含本單的版本後確認
   - `server-token.json` 的 token 沒變，遠端 client 不需要重新配對
   - `%APPDATA%\BetterAgentTerminal\Logs\` 出現新日誌，開頭有 `[userdata-migration] Local State: copied`
   - `%APPDATA%\better-agent-terminal\` 維持原樣，只有 `message-archives/*.jsonl` 會被移走
   - 在 Settings 關閉日誌或調整等級，重啟後設定仍有效
2. **macOS 🔴 殘餘風險**：safeStorage 在 mac 上改用 Keychain 的「`<app name> Safe Storage`」，它和 `Local State` 的關係沒有驗證過。`setName` 雖然提早執行，但仍在 ready 之前，理論上 Keychain 名稱不會變；仍須在實機確認升版後 server-token 不變
3. **Linux**：使用 libsecret，狀況同 macOS，未驗證
4. **runtime 實例（若使用者有在用）**：升版後 `better-agent-terminal-runtime-<N>` 會改名為 `BetterAgentTerminal-runtime-<N>`。如果該 runtime 的 terminal server 還在執行，改名會延到下一次啟動

### 偏離 / 補充（相對 T0479 第 4 節）

1. **snippets：先確認 `L` 能解析，再決定是否複製**。T0479 情況 ① 原文是「`T` 沒有、`L` 有 → 複製」。實作改為 `L` 解析成功後才以 `COPYFILE_EXCL` 複製，讓規則 ③（`L` 解析失敗 → 略過並記錄）也涵蓋情況 ①，避免把壞檔帶進 `T`
2. **合併時的 id 與 `nextId`**：從 `L` 附加過來的項目，id 從 `max(T.nextId, max(T.id) + 1)` 開始編；最後 `nextId = max(id) + 1`。沒有新項目時不備份、也不重寫（`merged-nothing-new`）
3. **新增 runtime id 白名單** `/^[a-zA-Z0-9._-]+$/`。白名單只決定要不要搬移（rename / marker），userData 的路徑規則與舊版相同。理由：舊版對 `--runtime=` 不做驗證；本單新增了「整個目錄改名」，用外部輸入組出的路徑去 rename 之前應先過白名單，這與 CLAUDE.md child_process 一節的原則相同
4. **marker 一律寫入**：個別項目失敗也照寫，符合「只執行一次」。marker 本身寫入失敗時記 warn，下次啟動會再執行一次；各條規則本身是冪等的（只在缺少時複製、去重、同名不搬）
5. **runtime 實例中 `isServerRunning` 拋錯時，視為未執行**。`pid-manager` 本身不會拋錯，這只是防禦性處理
6. **e2e 檢查的鎖檔名**：Windows 檢查 `lockfile`，其他平台檢查 `SingletonLock`（Chromium 在 posix 上的鎖名）。本次只在 Windows 上實際執行

### 範圍外發現

無新增。T0479 的選配 D（提早 `logger.init`）與 macOS PATH 修正的時序問題，依工單維持另案處理。

### 本單建立與清除的暫存物

- scratchpad：`tsc-baseline.txt`、`tsc-after.txt`、`vite-build.log`、`report.md`。位於 session scratchpad，不在 repo 內
- `%APPDATA%`：以下目錄都已由 fixture / spec 刪除，確認沒有任何 `*-runtime-e2e-*` 殘留
  - e2e 建立的 `BetterAgentTerminal-runtime-e2e-bug119-*`、`better-agent-terminal-runtime-e2e-bug119-legacy-*`
  - 回歸 e2e 的 runtime 目錄
- 沒有以預設實例啟動含本單改動的 build

### Commit

依工單 commit 本單檔案與改動。只精準 stage 本單相關檔案，不含其他檔案；未 push。commit `95739d0`（程式與回報）；狀態收尾另一個 commit。
