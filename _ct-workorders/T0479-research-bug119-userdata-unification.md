---
schema_version: 1
schema_kind: workorder
id: T0479
title: "研究 BUG-119：userData 統一方案 —— 盤點所有 getPath('userData') 呼叫時序與落點、runtime 實例實測、snippets / 其他資料搬移規則設計、helper scripts 路徑假設，產出實作單規格"
type: research
status: TODO
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: M
created_at: "2026-10-13T22:20:44+08:00"
started_at: null
updated_at: "2026-10-13T22:20:44+08:00"
completed_at: null
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

（Worker 填寫）
