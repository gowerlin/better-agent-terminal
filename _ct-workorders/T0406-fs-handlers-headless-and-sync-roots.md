---
schema_version: 1
schema_kind: workorder
id: T0406
title: "PLAN-036 P2-I：fs:* / image:read-as-data-url 搬入共用模組並上線 headless + workspace:sync-roots（client 推送轉換後 roots，fail-closed）+ PROXIED_EVENTS 路徑分類守門"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: L
created_at: "2026-10-05T04:50:19+08:00"
target_version: next
depends_on:
  - T0405
  - T0416
related:
  - "PLAN-036 最後一張（D130）；T0386 回報區 §1（fs 類）、§4 path sandbox（使用者裁決 Q2：client 推送 roots）、§5 安全、建議清單 I"
  - "T0416 回報區「遭遇問題」1（`PROXIED_EVENTS` 路徑分類無守門）、5（`workspace:sync-roots` 須自行分類）"
affects_files:
  - electron/handlers/fs.ts
  - electron/handlers/types.ts
  - electron/main.ts
  - electron/path-guard.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/remote-client.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - docs/remote-dev-overview.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **本機 fs 行為不得改變**：本機 path guard 白名單仍由 window registry 重建（`rebuildWorkspaceAllowlist`）；`fs:*` handler 內部邏輯逐字搬移，含所有 `isPathAllowed` 檢查。e2e 0 failed。"
  - "🔴 **headless fail-closed**：未收到 roots 前，所有 fs / image channel 一律拒絕；roots 只接受絕對 server 路徑，拒絕 `/`（整個檔案系統）與含 `..` 段者；以**每條連線**記錄 roots、取所有連線聯集，連線關閉即移除該連線的 roots。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。smoke 不得讀寫使用者既有檔案（用 `/tmp` 暫存目錄）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0406 — fs 上遠端 + workspace:sync-roots（PLAN-036 P2-I）

## 元資料
- **工單編號**：T0406
- **任務名稱**：fs / image 共用註冊 + headless 上線 + roots 同步
- **狀態**：PENDING
- **建立時間**：2026-10-05 04:50 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「1. 搬移（Electron 行為不變）」並 commit，回報 PARTIAL

## 背景

- PLAN-036 最後一塊：遠端視窗的檔案樹 / 檔案預覽 / 搜尋 / 圖片預覽（`fs:*` 7 個 + `image:read-as-data-url`，`main.ts` 8 個註冊）在 headless 仍不支援
- 本機 fs handler 以 `electron/path-guard.ts` 的 `isPathAllowed` 限制在已註冊工作區內；白名單來自本機 window registry，headless 沒有 registry ⇒ 使用者裁決（T0386 Q2）：**client 推送轉換後的 workspace roots**，未推送前 fail-closed
- T0416 已把 fs 類的路徑轉換（client → server）與 `PATH_FREE_CHANNELS` / `PATH_ARG_SCHEMA` 守門建好；新 channel 必須在其中分類

## 範圍

1. **搬移**：`electron/handlers/fs.ts` 的 `registerFsHandlers(register, deps)`，逐字搬入 8 個 handler；path guard 以 deps 注入（本機 = 既有 `isPathAllowed`；headless = 依 synced roots 判斷的實例）；`fs:watch` 的事件改走 `deps.emit`；`electron/handlers/` 不得 import electron（image 若用到 `nativeImage`，改為不依賴 electron 的實作或以 deps 注入，回報說明）
2. **`workspace:sync-roots`**（新 proxied channel）：
   - client 端：遠端視窗連線完成後、以及每次該視窗 `workspace:save` 後，由 main 把該視窗的 workspace roots 經 `PathTranslator.toServer` 轉換後送出
   - server 端：驗證（見 memory_overrides）、記錄於該連線、重建聯集白名單
   - 在 T0416 的分類表登錄（請求參數是否 path-aware：roots 已在 main 端轉好，請說明採用哪種分類並避免重複轉換）
3. **headless 上線**：`createHeadlessHandlerModules` 加入；fs / image 自 `HEADLESS_UNSUPPORTED` 移除；`fs:changed` 事件經 broadcastHub 送回 client 並由既有 `translateRemoteEventArgs` 轉回 client 形式
4. **PROXIED_EVENTS 路徑分類守門**（T0416 遭遇問題 1）：每個 `PROXIED_EVENTS` 必須明確分類為「含路徑需轉回 client」或「不轉（附理由，例如 `claude:worktree-info` 維持 server 形式）」，新增 event 未分類即 CI 紅
5. **smoke**：新增 **S12**：`/tmp` 建暫存目錄與檔案 → 未同步 roots 時 `fs:readdir` 被拒 → `workspace:sync-roots([暫存目錄])` → `fs:readdir` / `fs:readFile` / `fs:stat` 成功、暫存目錄外的路徑（例如 `/etc`）仍被拒 → 清理；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0406」；`docs/remote-dev-overview.md` 補 S12

## 驗收條件

- [ ] `main.ts` 不再有 `registerHandler('fs:` / `registerHandler('image:`；`electron/handlers/fs.ts` 不 import electron
- [ ] parity / electron-free / proxied-binding / T0416 path 分類守門綠；新增 events 分類守門
- [ ] headless harness：未同步 → 拒絕；同步後 root 內允許、root 外拒絕；`/` 與 `..` 被拒；兩條連線 roots 聯集、其一斷線後只剩另一條的 roots；`fs:watch` → 修改檔案 → client 收到 `fs:changed`
- [ ] client 端：連線後與 `workspace:save` 後送出轉換後 roots（以 WSL translator 斷言 `\\wsl.localhost\Ubuntu-24.04\home\x` → `/home/x`）；本機視窗不送
- [ ] `npm run test:unit` 全綠（基線 1825）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附「塔台部署後 smoke 預期」與使用者實機步驟（WSL 遠端視窗開檔案樹 / 預覽 / 搜尋 / 圖片）

## 不在範圍
- 自由文字（prompt / 拖檔插入）中的路徑轉換（T0416 遭遇問題 2，另案）
- BUG-106

## Sub-session 執行指示
1. 讀本工單 + T0386 回報區 §1 / §4 / §5 + T0416 回報區 + `electron/handlers/git.ts`（最新共用模組範本）+ `main.ts` fs / image 段 + `electron/path-guard.ts` + `electron/remote/path-aware-channels.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 依 1 → 5 實作；第 1 步完成即可先 commit（降級策略）
4. 填回報區；完成寫 **`DONE`**（只完成第 1 步寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 塔台部署後 smoke 預期

### 使用者實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
