---
schema_version: 1
schema_kind: workorder
id: T0480
title: "BUG-119 修復 A：app-paths bootstrap（setName + runtime + ready 前同步搬移 + 顯式 setPath userData）+ snippetDb lazy + 自檢 + 單元 / 順序 / e2e 測試"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-119
priority: P1
sizing: M
created_at: "2026-10-13T22:32:56+08:00"
started_at: null
updated_at: "2026-10-13T22:32:56+08:00"
completed_at: null
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

（Worker 填寫）
