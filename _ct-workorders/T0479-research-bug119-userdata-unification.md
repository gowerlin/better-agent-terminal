---
schema_version: 1
schema_kind: workorder
id: T0479
title: "研究 BUG-119：userData 統一方案 —— 盤點所有 getPath('userData') 呼叫時序與落點、runtime 實例實測、snippets / 其他資料搬移規則設計、helper scripts 路徑假設，產出實作單規格"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: M
created_at: "2026-10-13T22:20:44+08:00"
started_at: "2026-10-13T22:21:49+08:00"
updated_at: "2026-10-13T22:32:39+08:00"
completed_at: "2026-10-13T22:32:39+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0478
related:
  - "BUG-119 全文；T0478 回報區 A 段（PathService 快取機制 probe、本機兩目錄實證）與「偏離 / 範圍外發現」1-3、5"
  - "CLAUDE.md「Logging」（T0478 已改寫為兩目錄實況）"
affects_files: []
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改產品程式碼**（`electron/` / `src/` / `scripts/` / `package.json`），只寫本工單回報區；probe / 實驗程式一律放 scratchpad，完成後刪除並在回報區記錄"
  - "🔴 **不得動使用者真實資料目錄**：`%APPDATA%\\BetterAgentTerminal\\`、`%APPDATA%\\better-agent-terminal\\` 只讀（列目錄、讀時間戳 / 大小），不寫、不搬、不刪。需要實測 runtime 實例或搬移時，用 `--runtime=<高號碼>` 或 isolated userData（如 e2e fixtures 的隔離方式）在 scratchpad 進行，結束後清除自己建立的目錄並回報"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
---

# T0479 — 研究 BUG-119：userData 統一方案

## 目標

產出可直接開實作單的規格：統一到哪個目錄、怎麼讓時序正確、哪些資料要搬、怎麼搬、怎麼驗收。

## 研究項目

### R1. `getPath('userData')` 呼叫盤點與時序

- 全 repo（`electron/`、`src/` 經 IPC、`scripts/`）列出所有 `app.getPath('userData')` / `getPath('logs')` / `getPath('crashDumps')` / `setPath` 呼叫，標明**在 import 時 / 模組頂層 / whenReady 前 / whenReady 後**執行，以及 `setPath('crashDumps')` 前或後
- 依時序推算各自落在 `better-agent-terminal/` 或 `BetterAgentTerminal/`，與本機兩目錄的實際內容（只讀列目錄）對帳；對不上的列出
- 確認 dev（`npm run dev`，exe 為 `electron.exe`）與打包版是否不同（T0478 對照組：打包模式 import 時不呼叫 getPath 時全程大寫——請核對 `snippetDb` 在打包版是否仍於 import 時呼叫）
- Chromium 自己寫的檔（`Local State`、`lockfile`、`Preferences`、`Local Storage`、`IndexedDB` 等）分別在哪個目錄、由何時的 userData 決定；`requestSingleInstanceLock` 的鎖在哪

### R2. runtime 實例實測

- 以 `--runtime=<高號碼，如 97>` 啟動 source build（或 isolated 方式），實測其 userData / Logs / snippets / lockfile 實際落點；驗證 T0478 推導的「runtime 實例共用預設 snippets」「目錄名為 `better-agent-terminal-runtime-<N>`」是否成立
- 測完清除該 runtime 建立的目錄（只刪自己建立的）

### R3. 統一方案比較

至少比較：
- (a) `setName` 移到最早的入口（所有 import 之前，例如獨立 bootstrap 模組）
- (b) `snippetDb` 等改 lazy 初始化，`setName` 位置不變
- (c) 啟動時顯式 `app.setPath('userData', <getPath('appData')>/BetterAgentTerminal)`
- 各方案對 dev / 打包、runtime 實例、Chromium 檔案（`Local State` / `Local Storage` 等 renderer 資料）、單一實例鎖的影響；**是否會讓 renderer 的 localStorage 等「消失」**
- 推薦一個，並說明為何統一到大寫 `BetterAgentTerminal/`（設定已在此）或其他

### R4. 搬移規則設計

- 需搬移的檔案清單（至少 `snippets.json`；評估 `Logs/`、`Crashes/`、Chromium 檔案是否需要 / 是否安全搬移）
- 規則：只搬一次、目的地已存在時的處理（不覆蓋？合併？snippets 為陣列 / 物件結構時如何合併——讀 `electron/snippet-db.ts` 確認結構）、搬移失敗不阻擋啟動、留 log 與 marker、舊檔保留或改名
- runtime 實例的 snippets 共用問題：統一後每個 runtime 應各自一份？既有共用資料怎麼分配？
- 降級 / 回滾：使用者降回舊版時的行為

### R5. helper scripts 與其他路徑消費者

- `scripts/_bat-logger.mjs:10-12`、`scripts/_bat-cert.mjs:20` 及其他 helper / 外部工具（`BAT_USER_DATA`、`BAT_HELPER_LOG_DIR`、server bundle `dataDir`）的目錄假設；統一後是否正確、是否需同步改
- 文件（README / CLAUDE.md / `docs/`）需同步的位置

### R6. BUG-116 關聯（低優先，可簡述）

- mac 上 `better-agent-terminal/Logs/` 不存在：依 R1 時序，主程序在 `logger.init` 之前崩潰時是否就不會產生 Logs 目錄；是否值得讓 logger 更早初始化（建議即可，不展開）

## 產出

回報區包含：
1. R1 盤點表（呼叫點 檔案:行 / 時機 / 落點 / 本機對帳）
2. R2 實測輸出
3. R3 方案比較表 + 推薦
4. R4 搬移規則（可直接貼進實作單）
5. 建議的實作單拆分（張數、affects_files、驗收條件、是否需要 e2e）

## Sub-session 執行指示

1. 讀本工單 + BUG-119 + T0478 回報區 + `electron/main.ts`（啟動段）+ `electron/snippet-db.ts` + `electron/logger.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 研究 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。R1–R6 都已完成，實作單規格見第 4、5 節。

結論：統一到大寫的 `<appData>/BetterAgentTerminal[-runtime-<N>]/`。做法是新增一個 bootstrap 模組，放在 `main.ts` 的第一個 import，在其中依序執行 `setName`、計算 runtime 路徑、**同步搬移**、顯式 `setPath('userData')`。`snippetDb` 另外改成 lazy 初始化，作為第二道防護。

研究中發現兩件 BUG-119 原本沒有寫到、影響實作設計的事：

1. 🔴 **`Local State` 必須搬，而且必須在 app ready 之前搬**。safeStorage 的金鑰存在 Windows 小寫目錄的 `Local State`（`os_crypt.encrypted_key`），`server-token.json` 是用這把金鑰加密的。如果只統一目錄、沒有先搬 `Local State`，新目錄會產生新金鑰，`server-token.json` 就解不開。`readSecretFile` 解密失敗時回傳 `null`，接著會重新產生並覆寫 token，結果是所有已配對的遠端 client 都要重新配對。probe 實測如下：不搬，解密 FAIL；在 main 頂層同步複製，解密 ok；在 whenReady 時才複製，仍然 FAIL。
2. 除了 snippets，還有三樣東西同樣受分裂影響：
   - **使用者的日誌設定在啟動時被忽略**：`readLoggingConfigSync()` 會去小寫目錄讀 `settings.json`，但那裡沒有這個檔
   - **`message-archives/` 落在小寫目錄**
   - **`bat-scripts.log` 被拆成兩份**：main 的 remote-logger mirror 寫到小寫目錄，helper 寫到大寫目錄

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/`，PASS
- C-3：`affects_files` 為空，不適用
- C-2：沒有 `branch` 欄位，不適用；實際在 `main` 上執行
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`（沒有互動 Q/A）

---

### 1. R1 盤點表

**啟動順序（依 build 產物實測）**：`npx vite build`（本單執行，exit 0）產出的 `dist-electron/main-Dilh7lfF.js` 中，`const hr=new CR`（snippetDb 實例化）位於 offset **264994**，`setName("BetterAgentTerminal")` 位於 **630361**，`--runtime=` 位於 **630436**，`requestSingleInstanceLock()` 位於 **631369**。rollup 把所有 import 的模組主體排在 `main.ts` 主體之前，所以 `main.ts` 裡「寫在 import 之上的程式碼」實際上**不會**先於 import 的模組執行。

**dev 與打包版相同**：打包版用的就是同一份 `dist-electron`，初始 app name 都是 `package.json` 的 `name`（`better-agent-terminal`，asar 內沒有 `productName`，見 T0478）。T0478 提到的已安裝 0.6.0-pre.2 bundle 順序（`new mR` 263870 < `setName` 626466）與這次結果一致。T0478 的「對照組：打包模式全程大寫」只是 probe 的假設情境，**BAT 打包版本身仍然會在 import 時呼叫 getPath**。

時機欄的簡稱：「import」= 模組載入期；「頂層」= `main.ts` 主體，在 setName 之後、whenReady 之前；「wR 前段」= whenReady 中、`setPath('crashDumps')` 之前；「wR 後」= `setPath` 之後，或 handler 被呼叫時。

| # | 呼叫點 | 時機 | 預設實例落點 | `--runtime=N` 落點 | 本機對帳（只讀） |
|---|---|---|---|---|---|
| 1 | `electron/snippet-db.ts:45`（`:189` 單例） | import（PathService 第一次計算，把**小寫**寫進快取） | 小寫 `snippets.json` | **預設**小寫目錄，runtime 覆寫發生在它之後 → 所有實例共用 | ⚠️ 兩個目錄都**沒有** `snippets.json`：`load()` 不會建檔，使用者也沒有建過 snippet。T0478/BUG-119 寫的「snippets.json 在小寫目錄」是從程式碼推導的，本機無實體 |
| 2 | `electron/main.ts:149` `getPath('temp')` | 頂層 | `%TEMP%/bat-gpu-cache`，與 userData 無關 | 同左 | — |
| 3 | `electron/main.ts:166` runtime `basePath` | 頂層 | — | 讀到快取的小寫值 → `better-agent-terminal-runtime-N`，**R2 實測證實** | — |
| 4 | `electron/main.ts:171` console.log | 頂層 | 印出小寫路徑（只是 console 字串，會誤導） | — | — |
| 5 | `electron/main.ts:177` `configureRuntimeRouter.getDataDir` | lazy getter，wR 後 | 大寫 | runtime 目錄 | — |
| 6 | `electron/main.ts:211` `requestSingleInstanceLock` | 頂層 | 小寫 `lockfile` | runtime 目錄 | ✅ `lockfile` 在小寫目錄 |
| 7 | Chromium `Local State`（browser 初始化，早於 ready） | 頂層之後、ready 之前 | 小寫，**內含 `os_crypt.encrypted_key`**（只列 key 名稱，沒有讀值） | runtime 目錄 | ✅ 小寫目錄有 `Local State`（490 B）；大寫目錄**沒有** |
| 8 | `electron/main.ts:1399` `logger.init(getPath)` | wR 前段 | 小寫 `Logs/` | runtime 目錄 | ✅ 小寫 `Logs/debug-*.log` ×11 |
| 9 | `electron/main.ts:1399` → `:546` `readLoggingConfigSync()` | wR 前段 | 讀小寫 `settings.json`，**檔案不存在 → 回傳預設值** | runtime 目錄（不受影響） | 🆕 本機目前的 log 中 `[logging] config updated` 出現 0 次 ⇒ 使用者在設定中「關閉日誌 / 調整等級」重啟後不會生效，要等下一次 `settings:save`（`:2138`）才會套用 |
| 10 | `electron/main.ts:1402` `getCrashesDir()`（`:621`） | wR 前段（參數先求值，之後才 setPath） | 小寫 `Crashes/` | runtime 目錄 | ✅ |
| 11 | `electron/main.ts:2077` `MESSAGE_ARCHIVE_DIR` | `registerProxiedHandlers()` 在 `:3414` 於**頂層**呼叫，屬於 import 期常數 | 🆕 小寫 `message-archives/` | runtime 目錄 | 兩個目錄都還沒有（只有 renderer overflow 時才建） |
| 12 | `electron/remote/remote-logger.ts:58` `logger.getLogsDir()` | wR 後 | 🆕 小寫 `Logs/bat-scripts.log` | runtime 目錄 | ✅ 小寫 `Logs/bat-scripts.log` 3.5 MB，大寫 `Logs/bat-scripts.log` 11.5 MB（helper 寫的），設計上本應是同一個檔，現在拆成兩份 |
| 13 | sessionData（`Preferences`、`Local Storage`、`Session Storage`、`Network`、`Cache`、`blob_storage`、`DIPS`、`Shared Dictionary`、`SharedStorage` …） | default session 在 setPath 之後才 lazy 建立 | 大寫 | runtime 目錄 | ✅ 全部在大寫目錄（probe `getStoragePath()` 也確認） |
| 14 | `main.ts:303`、`:417`（`BAT_USER_DATA` → terminal-server `pid`/`port`/`registry`）、`:760`、`:779`、`:1460`、`:1601`（`remoteServer.configDir` → `server-cert.json` / `server-token.json`）、`:1644`、`:1742`、`:1838`、`:2138`/`:2154`（settings）、`:2717`（`bat-server-bundles`）、`:3003`/`:3007`（`ct-drift.log`）、`:3043`（`app:get-user-data-path`，renderer 端沒有呼叫者）、`:3316`/`:3327`（`custom-clis.json`）、`:3386`/`:3402`；`profile-manager.ts:226`/`:388`；`window-registry.ts:33`/`:37`/`:140`/`:180`；`voice-handler.ts:46`/`:55`；`remote/server-bundle-distributor.ts:251` | wR 後 | 大寫 | runtime 目錄 | ✅ 全部在大寫目錄 |

macOS / Linux 走同一條 Electron PathService 路徑，以上是推導，**未實機驗證**。

### 2. R2 實測輸出

**(A) 實際 BAT source build**：`npx vite build` 後執行 `electron.exe <repo> --runtime=97`，等待 25 秒。

```
[runtime] BAT_RUNTIME=97, userData=C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-97
[startup] crashDumps path: C:\Users\Gower\AppData\Roaming\better-agent-terminal-runtime-97\Crashes
== better-agent-terminal-runtime-97
bat-pty-registry.json, bat-pty-server.pid, bat-pty-server.port, blob_storage, Cache, Code Cache, Crashes, DIPS, DIPS-wal,
Local State, Local Storage, lockfile, Logs, Network, Preferences, profiles, server-cert.json, Shared Dictionary, windows.json
Test-Path %APPDATA%\BetterAgentTerminal-runtime-97 → False
預設小寫目錄啟動前後時間戳不變（Crashes 05-26 / Logs 14:49 / Local State 05-26 / lockfile 14:49）
```

- ✅ T0478 的推導「runtime 目錄名為 `better-agent-terminal-runtime-<N>`」**成立**，而且 runtime 實例的資料（設定、Local State、lock、Logs、Crashes、cert）**全都**在這個目錄，不分裂
- ⚠️ 「runtime 實例共用預設 snippets」**未直接觀察**：要證實就得建立一筆 snippet，這會寫入使用者真實的 `%APPDATA%\better-agent-terminal\`，違反本單的 memory_overrides。改用兩項證據支持：(1) bundle 順序（snippetDb 實例化 264994 < runtime 覆寫 630436）；(2) 下方 probe 8 以相同順序重現：import 期的 userData 是預設小寫目錄，之後才被 runtime 覆寫

**(B) Electron 41.2.1 probe**：在 scratchpad 建一個最小 app，`package.json` name 用 `bat-t0479-lower`，`setName('BatT0479Upper')`，依序模擬 import getPath → setName →（runtime）→ lock → whenReady → setPath(crashDumps)。每次執行都做 safeStorage 加解密，並讀寫 `localStorage`。

| run | 變體 | 結果 |
|---|---|---|
| 1 | 現況 | 小寫目錄：`Crashes`、`Local State`；大寫目錄：sessionData 全部。safeStorage 寫入密文 C1 |
| 2 | (a) setName 最先 | 全部落在大寫。**C1 解密 FAIL**（`Error while decrypting the ciphertext provided to safeStorage.decryptString.`）。`localStorage` 讀到 run 1 寫入的值（**沒有消失**） |
| 3 | (c) 顯式 setPath(userData) | 同 run 2：全部大寫，解密 FAIL，`localStorage` 保留 |
| 4 | (a)，啟動前把小寫 `Local State` 複製到大寫 | **解密 ok:secret-from-current** |
| 5 | (a)，在 main 頂層（同步、ready 之前）複製 `Local State` | `migrate=copied`，**解密 ok** |
| 6 | (a)，在 whenReady 時才複製 | `dst-missing`（Chromium 已在記憶體中建立新的 Local State），**解密 FAIL** ⇒ 搬移一定要在 ready 之前 |
| 7 | 回到現況順序（模擬降版） | 小寫 `Local State` 沒被動過，**解密 ok**；`localStorage` 保留 ⇒ 採「複製、不搬走」時，降版安全 |
| 8 | 現況 + runtime 97 | 全部落在 `bat-t0479-lower-runtime-97`，與 (A) 的實機結果一致 |
| 9 | (a) + runtime 97 | 全部落在 `BatT0479Upper-runtime-97`，舊的 runtime 目錄不會被沿用（runtime 實例需要整個目錄搬移） |

**清理**：已 `taskkill` runtime-97 主程序樹（PID 35352，terminal server 21408 已隨之結束）；確認沒有殘留 `runtime=97` / `terminal-server.js` 程序。已刪除本單建立的 5 個目錄：`better-agent-terminal-runtime-97`、`bat-t0479-lower`、`bat-t0479-lower-runtime-97`、`BatT0479Upper`、`BatT0479Upper-runtime-97`。scratchpad 中的 probe 與 log 也已刪除（見第 6 節）。

### 3. R3 方案比較 + 推薦

| | (a) bootstrap 模組最先執行 setName | (b) snippetDb lazy，setName 位置不變 | (c) 顯式 `setPath('userData', <appData>/BetterAgentTerminal)` |
|---|---|---|---|
| 修好 snippets | ✅ | ✅ | ❌ **單獨使用時修不好**：寫在 `main.ts` 主體裡的 setPath 仍晚於 snippet-db 的 import 期取值，必須搭配 (a) 或 (b) |
| 修好 Logs / Crashes / lock / Local State / message-archives / mirror log | ✅ | ✅（前提是目前沒有其他 import 期的 getPath，R1 已確認） | ✅（override 優先於快取，不受快取狀態影響） |
| 防止回歸 | 中：需要測試確保 bootstrap 是第一個 import | **弱**：約 50 個被 import 的模組中，日後只要有任何一處在 import 期呼叫 getPath，就會靜默地再次分裂 | **強**：路徑不再依賴 app name 與 PathService 快取 |
| dev / 打包 | 相同（rollup 保留 side-effect import 的順序） | 相同 | 相同 |
| runtime 實例 | 變成 `BetterAgentTerminal-runtime-N`，需要整個目錄搬移 | 同左 | 同左 |
| Chromium `Local State` / safeStorage | 改落大寫 → **必須在 ready 之前複製 `Local State`**，否則 server-token 失效 | 同左 | 同左 |
| renderer `localStorage` 等 | **不會消失**（本來就在大寫，probe 2/3/4 實證） | 同左 | 同左 |
| 單一實例鎖 | 移到大寫。新舊版本同時執行時看不到對方的鎖（僅限過渡期；NSIS 升級會先關閉舊版） | 同左 | 同左 |
| 搬移邏輯放置處 | bootstrap 內（ready 之前，天然合適） | `main.ts` 主體頂層 | 同 (a) |

**推薦：(a) + (c)，再加上 (b) 作為第二道防護。**

- 新增 `electron/app-paths-bootstrap.ts`，作為 `main.ts` 的**第一個** import，只依賴 `electron` / `path` / `fs` 與新的 migration 模組
- 在 bootstrap 內依序執行：
  1. `app.setName('BetterAgentTerminal')`
  2. 解析 runtime id，沿用 `main.ts:163-164` 的規則（`--runtime=` 優先於 `BAT_RUNTIME`）
  3. 計算 `target = join(app.getPath('appData'), 'BetterAgentTerminal' + suffix)`。`appData` 不依賴 app name
  4. 同步執行 migration（第 4 節）
  5. `app.setPath('userData', target)`
  6. 匯出 `resolvedUserData`、`runtimeId`、`migrationReport`
- `main.ts:157-172` 改用 bootstrap 匯出的值；`AppUserModelId`（`:185`）沿用 `runtimeId`
- `snippetDb` 改成 lazy（例如 `getSnippetDb()`，或在第一次存取時才解析 `dataPath`）
- whenReady 中 `setPath('crashDumps')` 之後加自檢：`getPath('userData') !== resolvedUserData` 時 `logger.error`
- `MESSAGE_ARCHIVE_DIR` 在 bootstrap 之後求值，自動落在正確位置（不需另外修改，可順手改成 lazy）

**為何統一到大寫 `BetterAgentTerminal/`**：
- 有價值、而且體積大的資料都已經在大寫目錄：settings、windows、profiles、server-cert/token、`whisper-models/`、sessionData（localStorage）、terminal-server 檔、`bat-server-bundles`、`ct-drift.log`
- helper（`_bat-cert.mjs` / `_bat-logger.mjs`）、`BAT_USER_DATA`、`README` 原本的語意都假設大寫
- 小寫目錄只有 `Local State`（490 B）、`lockfile`、`Logs`、`Crashes`，以及可能存在的 `snippets.json` / `message-archives`
- 反過來統一到小寫，就要搬移數 GB 的 whisper 模型與整個 Chromium session

### 4. R4 搬移規則（可直接貼進實作單）

符號：`appData` = `app.getPath('appData')`；`suffix` = `''` 或 `-runtime-<N>`；`L` = `join(appData, 'better-agent-terminal' + suffix)`（舊）；`T` = `join(appData, 'BetterAgentTerminal' + suffix)`（新）。兩者在 Windows / macOS（大小寫不敏感）也是不同目錄，因為連字號不同。

**通則**
- 全部在 bootstrap 中**同步**執行，時間點早於 `app.setPath('userData')`、`requestSingleInstanceLock` 與 app ready
- 每一項各自 `try/catch`，**任何失敗都不阻擋啟動**
- 結果累積在記憶體中的 `migrationReport`。logger 還沒初始化，所以由 `main.ts` 在 `logger.init` 之後統一以 `logger.log('[userdata-migration] ...')` 寫出
- 只搬小檔，不複製 `Logs/`、`Crashes/` 或整個 Chromium profile
- **一律「複製」，不刪除也不改名 `L` 的內容**（降版安全）。`message-archives` 的單檔例外，見下
- **marker**：`T/.userdata-migration.json`，內容為 `{ v: 1, from: L, at: <ISO>, items: {...} }`。marker 已存在就整段略過（只執行一次）；`L` 不存在時不寫 marker，什麼都不做

**預設實例（`suffix = ''`）**

| 項目 | 規則 |
|---|---|
| `Local State` 🔴 必要 | `T/Local State` 不存在、`L/Local State` 存在 → `copyFileSync`；`T` 已存在 → 略過並記錄（不覆蓋）。失敗時記錄 error，後果是 server-token 重新產生、遠端 client 需重新配對。實作單須在 log 中明確寫出這個後果 |
| `snippets.json` | 結構為 `{ snippets: Snippet[], nextId: number }`（`snippet-db.ts:35-38`）。① `T` 沒有、`L` 有 → 複製。② 兩邊都有 → 合併：以 `T` 為主；`L` 中**不重複**的項目（以 `title + content + workspaceId + createdAt` 判斷）附加到後面，並從 `T.nextId` 起重新編 `id`；`nextId = max(id) + 1`；先把 `T` 備份成 `snippets.json.pre-merge-<stamp>.bak`，再以 tmp + rename 原子寫入。③ `L` 解析失敗 → 略過並記錄，`L` 保持原樣。④ `T` 解析失敗 → 不合併，不覆蓋 `T` |
| `message-archives/*.jsonl` | 這是 renderer 的 overflow cache。`T` 中沒有同名檔才 `renameSync` 單檔（同磁碟區，成本低）；同名或失敗時留在 `L`。降版時只會造成 cache miss |
| `Logs/` | **不搬**。新日誌寫到 `T/Logs/`（helper 的 `bat-scripts.log` 已經在這裡，兩邊從此合流）。在 report 中記一行「legacy logs remain at `L/Logs`」。舊日誌不會被 logger 的 10 檔輪替清掉，交由文件說明 |
| `Crashes/` | **不搬**（Crashpad 資料庫各自獨立）。新的 crash dump 寫到 `T/Crashes/` |
| `lockfile`、其他未知檔 | 不碰 |
| `L` 目錄本身 | 不刪除。是否在之後的版本提供清理，另案處理 |

**runtime 實例（`suffix = -runtime-<N>`）**

現況是 `L_rt` 保存了該 runtime 的**全部**資料（只有 snippets 用的是預設小寫目錄），所以採用「整個目錄改名」：

1. `T_rt` 已存在 → 直接使用 `T_rt`；若 `L_rt` 也存在，記 warn，不合併
2. `T_rt` 不存在、`L_rt` 存在：
   - 先以 `isServerRunning(L_rt)`（`electron/terminal-server/pid-manager.ts`）檢查。terminal server 會比 BAT 活得久，若它仍在執行，改名後它還會往舊路徑寫 registry
   - server 仍在執行，或 `renameSync(L_rt, T_rt)` 失敗（EBUSY / EPERM，例如同一個 runtime 的舊版仍開著）→ **這次啟動沿用 `L_rt` 作為 userData**，記 warn，下次啟動再試
   - 改名成功 → 使用 `T_rt`，寫 marker
3. **snippets 在 runtime 實例中改為各自一份**（`T_rt/snippets.json`）。預設實例共用的 snippets **只搬到預設的 `T`**，不複製到 runtime。原因：
   - runtime 的本意是「資料獨立的實例」（`main.ts:160-161` 註解）
   - e2e fixture 每次都會建立全新的 runtime，若複製，user snippets 會被帶進測試實例

   以前依賴 runtime 實例看見共用 snippets 的使用者，升版後會失去這個行為，需要在 release note 說明
4. e2e fixture（`e2e/fixtures/electron-isolation.ts:98`）以 `basename.includes('-runtime-<id>')` 判斷，新名稱同樣適用，不需修改

**降版 / 回滾**

| 情境 | 結果 |
|---|---|
| 降回舊版（預設實例） | 舊版照常使用 `L`（Local State / lock / Logs / snippets）與 `T`（設定等），與升版前完全相同。`T/Local State` 是同一把金鑰的複本，所以新版寫入的 `server-token.json` 舊版也解得開（probe 7 實證） |
| 新版新增 / 修改的 snippets | 舊版看不到（舊版讀 `L`） |
| 降版期間在舊版修改的 snippets | 再次升版時**不會**重新搬移（marker 已存在），需在文件中說明。若要支援，可以改成比較 mtime，但不建議，會增加複雜度 |
| runtime 實例降版 | `L_rt` 已改名，舊版會建立全新的空目錄；資料仍在 `T_rt`，可手動改名回去 |
| 新舊版同時執行（預設實例） | 鎖檔分別在不同目錄，無法互斥，兩者會同時寫 `T/settings.json`。屬過渡期風險，文件提醒「不要同時執行兩個版本」 |

### 5. 建議的實作單拆分

| 單 | 內容 | affects_files | 驗收條件 | e2e |
|---|---|---|---|---|
| **A**（核心，M，P1） | bootstrap + migration + snippetDb lazy + 自檢 | `electron/app-paths-bootstrap.ts`（新增）、`electron/userdata-migration.ts`（新增，純 fs 函式，`appData` 可注入，方便單元測試）、`electron/main.ts`（第一個 import；`:157-172` 改用 bootstrap 的值；`logger.init` 之後輸出 `migrationReport`；whenReady 自檢）、`electron/snippet-db.ts`（lazy）、`electron/__tests__/userdata-migration.test.ts`（新增）、`electron/__tests__/app-paths-bootstrap-order.test.ts`（新增） | ① 單元測試涵蓋第 4 節的每條規則：Local State 只在缺少時複製、snippets 複製 / 合併 / 去重 / id 重編 / 雙方解析失敗、marker 只執行一次、runtime 改名 / server 執行中時沿用舊目錄 / 兩邊都存在 / rename 失敗、所有失敗都不 throw。② 靜態測試：`main.ts` 的第一個 import 是 bootstrap，且 bootstrap 不 import 其他 electron/ 模組。③ `npx vite build` 後檢查產物順序：bootstrap 的 `setPath("userData"` offset < snippet-db 單例 offset。④ `npm run test:unit` 全部通過 | **需要**：用 isolated runtime 跑一支 spec。(i) 全新 runtime → 只有 `BetterAgentTerminal-runtime-<id>`，其中含 `Logs`、`Crashes`、`Local State`、`lockfile`，且沒有建立 `better-agent-terminal-runtime-<id>`。(ii) 預先放好舊版 `better-agent-terminal-runtime-<id>`（內含 `settings.json` 標記值、`snippets.json`）→ 啟動後目錄已改名，設定標記值保留，`snippet:getAll` 讀得到 |
| **B**（S，P2，可與 A 並行） | helper 路徑不再靠名稱猜測 | `electron/pty-manager.ts`（`:668-683`、`:734-753` 兩條 spawn 路徑注入 `BAT_USER_DATA`，或直接注入 `BAT_SERVER_CERT_PATH` + `BAT_HELPER_LOG_DIR`）、`scripts/_bat-cert.mjs`、`scripts/_bat-logger.mjs`（解析順序：明確的 override → `BAT_USER_DATA` → `APP_NAME` + `BAT_RUNTIME`；順手修正 `:12` 的 Linux `logs` 小寫註解與 `:28` 過期的 `main.ts:121` 行號）、`electron/__tests__/pty-manager-helper-env.test.ts`（`:146` 目前斷言本機 `BAT_HELPER_LOG_DIR` 為 undefined，需要改）、`scripts/__tests__/server-bundle-helpers.test.mjs` | 本機 PTY env 中帶有正確的 userData；helper 在 `--runtime=N`（PTY 沒有 `BAT_RUNTIME`）與 `BAT_RUNTIME=N` 兩種情況下都能找到正確的 `server-cert.json`；headless（`BAT_HELPER_LOG_DIR` / `BAT_SERVER_CERT_PATH`）行為不變 | 不需要（單元測試已足夠） |
| **C**（S，文件，排在 A 之後） | 文件改回單一目錄並加入搬移說明 | `README.md:240-256`（T0478 寫成兩個目錄）、`CLAUDE.md:23-24`（Logging + 「不在同一目錄」段落）、`docs/plan-027-cross-platform-verification.md:50`、`:92`（過期的 `debug.log` 路徑） | 路徑與 A 的實作一致；寫明舊目錄保留、不會自動清理、降版行為 | — |
| （選配）D | BUG-116 相關：提早初始化 logger，見第 7 節 | `electron/app-paths-bootstrap.ts`、`electron/logger.ts` | — | — |

**人工驗收（AI 無法代驗，需使用者在實機進行）**：
- **Windows**：在現有使用者環境安裝含 A 的版本後確認：
  - `server-token.json` 的 token 沒有變（遠端 client 不需重新配對）
  - `%APPDATA%\BetterAgentTerminal\Logs\` 出現新日誌
  - 舊 `better-agent-terminal\` 保持不變
  - Settings 中關閉日誌後重啟仍然有效（第 1 節表格 #9 的副作用一併修正）
- **macOS / Linux 🔴 殘餘風險**：mac 的 safeStorage 改用 Keychain「`<app name> Safe Storage`」，Linux 用 libsecret，與 `Local State` 的關係本單**未驗證**。A 的 bootstrap 讓 `setName` 更早執行，但仍在 ready 之前，理論上不影響 Keychain 名稱；仍須在 mac 上驗證「升版後 server-token 不變」

### 6. R5 helper scripts 與其他路徑消費者

| 消費者 | 現況 | 統一（A）之後 |
|---|---|---|
| `scripts/_bat-cert.mjs:20-38`、`scripts/_bat-logger.mjs:28-63`（`BetterAgentTerminal` + `BAT_RUNTIME`） | 預設實例正確。runtime 實例**錯誤**：實際目錄是 `better-agent-terminal-runtime-N`（R2 實證）。以 `--runtime=N` 啟動時 PTY 沒有 `BAT_RUNTIME`（`electron/` 中沒有任何地方注入它），helper 會讀到預設實例的 cert，fail-close | 帶 `BAT_RUNTIME` 時名稱正確；`--runtime=` 的情況仍然錯誤 ⇒ 需要 B |
| `BAT_USER_DATA`（`main.ts:380`、`:437` → `terminal-server.ts:15`） | 在 setPath 之後取得，是大寫 / runtime 目錄，正確。經 terminal server 產生的 PTY 會繼承（本單 PTY 中可見 `BAT_USER_DATA=...\BetterAgentTerminal`），但 main 的 fallback spawn 路徑沒有 | 自動跟著改。B 會讓兩條路徑都帶上 |
| `electron/remote/remote-logger.ts:58`（mirror `bat-scripts.log`） | 小寫 `Logs`，與 helper 分成兩份 | 自動合流到 `T/Logs` |
| headless bat-server（`dataDir`、`BAT_HELPER_LOG_DIR`、`BAT_SERVER_CERT_PATH`，`electron/remote/headless-entry.ts:286-288`） | 不經過 Electron getPath | 不受影響 |
| `scripts/bat-terminal.mjs:695-696`（提示文字 `%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`） | 正確 | 正確 |
| `e2e/fixtures/electron-isolation.ts:98`、`:117-119` | 以 basename 包含 `-runtime-<id>` 判斷 | 不需修改 |
| 文件 | README `:240-256`、CLAUDE.md `:23-24`、`docs/plan-027-cross-platform-verification.md:50`、`:92` | 由 C 同步 |

### 7. R6 BUG-116 關聯（簡述）

- `logger.init` 只在 whenReady 中執行（`main.ts:1399`）
- init 之前的 `logger.*` 呼叫，`writeToFile` 會因 `logFilePath` 為空直接 return，只輸出到 console（`electron/logger.ts:131-134`）
- `Logs/` 只在 `init` 中 `mkdirSync`（`:160-162`）
- `process.on('uncaughtException')` 在 `main.ts` 主體才註冊（`:137`），晚於所有 import 的模組主體

⇒ 如果主程序在 import 期或 whenReady 之前崩潰（例如 native addon 載入失敗），**不會產生** `Logs/` 目錄，與 BUG-116 回報者在 mac 上「`better-agent-terminal/Logs/` 不存在」的觀察一致（推導，未驗證）。

建議（選配 D，不展開）：A 的 bootstrap 在 `setPath('userData')` 之後就能 `logger.init`（只用到 fs，設定也從正確目錄讀取），並在 bootstrap 中先註冊 early `uncaughtException`，把 import 期的崩潰寫進磁碟日誌。

### 驗證

- **source / docs**：R1 以 Grep 全面盤點（`electron/`、`src/`、`scripts/`），逐點標註所在函式與時機；兩個目錄只讀（列目錄、時間戳、大小；`Local State` 只列 key 名稱）
- **build**：`npx vite build` exit 0（為了 R2 用 HEAD 重建 `dist-electron`，產物雜湊與先前相同）
- **runtime smoke**：R2 (A) 實際啟動 BAT `--runtime=97`：PASS（結果見上）；R2 (B) probe 9 個 run：PASS
- **tests**：未執行 `npm run test:unit`。本單沒有修改產品程式碼
- **deployment / release / 外部 SIT**：不適用

### 本單建立與清除的暫存物

- scratchpad：`probe-app/`（`main.js`、`package.json`、`page.html`）、`probe-runner/run.sh`、`out-*.json`、`stdout-*.log`、`cipher*.txt`、`rt97-*.log`、`vite-build.log`。完成後已刪除
- `%APPDATA%`：5 個測試目錄已刪除（見 R2）。使用者的兩個真實目錄**沒有任何寫入**

### 偏離 / 範圍外發現（交塔台決策）

1. 🔴 **safeStorage / `Local State` 依賴**（第 3、4 節）：BUG-119 原本的修正方向沒有提到這點。實作單 A 必須把「ready 之前複製 `Local State`」列為必要項目，否則升版會讓所有遠端配對失效
2. 🆕 **日誌設定在啟動時被忽略**（R1 #9）：屬於 BUG-119 的衍生症狀，A 會一併修好。建議塔台在 BUG-119 的「衍生」段落補記
3. 🆕 **`message-archives/` 與 `bat-scripts.log` 也分裂**（R1 #11、#12），已納入 A 的搬移規則
4. 範圍外：`main.ts:17-61` 的 macOS PATH 修正寫在 import 之上，註解（`:43-45`）認為它「runs at the top level before any ES module imports」，但 bundle 中它實際上晚於所有 import 的模組主體執行（與 snippetDb 早於 setName 是同一個機制）。在 import 期讀取 `PATH` 的模組看到的是還沒修正的 PATH。只列出，未驗證是否已造成實際影響
5. T0478 回報區寫的「本機 `%APPDATA%\better-agent-terminal\` 有 `snippets.json`」與本機現況不符：兩個目錄都沒有這個檔，原因是使用者沒有建過 snippet。不影響結論

### Commit

只 commit 本單檔案。未 push。
