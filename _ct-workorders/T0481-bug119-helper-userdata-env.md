---
schema_version: 1
schema_kind: workorder
id: T0481
title: "BUG-119 修復 B：本機 PTY 注入 userData 相關 env，helper（_bat-cert / _bat-logger）改以 env 解析路徑，不再靠 app 名稱猜 runtime 目錄"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: S
created_at: "2026-10-13T22:32:56+08:00"
started_at: "2026-10-13T22:34:55+08:00"
updated_at: "2026-10-13T22:40:17+08:00"
completed_at: "2026-10-13T22:40:17+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0479
related:
  - "D138；T0479 回報區第 5 節表格 B 列、第 6 節（R5 helper 消費者表）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」：headless 的 BAT_HELPER_LOG_DIR / BAT_SERVER_CERT_PATH 行為不得改變"
affects_files:
  - electron/pty-manager.ts
  - scripts/_bat-cert.mjs
  - scripts/_bat-logger.mjs
  - electron/__tests__/pty-manager-helper-env.test.ts
  - scripts/__tests__/server-bundle-helpers.test.mjs
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `electron/main.ts`、`electron/snippet-db.ts`、新增的 bootstrap / migration 模組（T0480 並行處理）"
  - "🔴 headless（`electron/remote/headless-entry.ts`）注入的 `BAT_HELPER_LOG_DIR` / `BAT_SERVER_CERT_PATH` 語意與優先序不變；本機 PTY 新增的 env 不得把 server token 以外的權限擴大"
  - "🔴 helper 改動須同時相容 T0480 之前（userData 為 `better-agent-terminal-runtime-N` 等）與之後的目錄 —— 以 env 為準即可兩者皆對"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
---

# T0481 — helper 路徑改以 env 為準

## 背景（T0479 R5）

- `scripts/_bat-cert.mjs:20-38`、`scripts/_bat-logger.mjs:28-63` 以 `BetterAgentTerminal` + `BAT_RUNTIME` 猜目錄；以 `--runtime=N` 啟動時 PTY 沒有 `BAT_RUNTIME`，helper 讀到預設實例 cert → fail-close
- `BAT_USER_DATA` 只經 terminal-server 路徑的 PTY 繼承，main 的 fallback spawn 路徑（`electron/pty-manager.ts:668-683`、`:734-753`）沒有

## 實作

1. `electron/pty-manager.ts` 兩條 spawn 路徑都注入 userData 資訊：`BAT_USER_DATA`，或直接 `BAT_SERVER_CERT_PATH` + `BAT_HELPER_LOG_DIR`（擇一並說明；注意 headless 已用後兩者，語意須一致：cert 檔完整路徑 / log 目錄）
2. `scripts/_bat-cert.mjs`、`scripts/_bat-logger.mjs` 解析順序：明確 override（`BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR`）→ `BAT_USER_DATA` → `APP_NAME` + `BAT_RUNTIME`（舊行為 fallback）。順手修 `_bat-logger.mjs:12` Linux `logs` 小寫註解與 `:28` 過期的 `main.ts:121` 行號
3. 測試：`electron/__tests__/pty-manager-helper-env.test.ts`（`:146` 目前斷言本機 `BAT_HELPER_LOG_DIR` 為 undefined，依新設計修改）；helper 解析順序測試（`--runtime=N` 無 `BAT_RUNTIME` 但有 `BAT_USER_DATA` → 正確 cert；只有 `BAT_RUNTIME` → 舊行為；headless env → 不變）
4. 若 `verify-helper-bundle` / `extraResources` 受影響，`npm run verify:helpers` 須通過

## 驗收條件

- [ ] 本機 PTY env（兩條 spawn 路徑）帶正確 userData 資訊（單元測試）
- [ ] helper 在 `--runtime=N`（無 `BAT_RUNTIME`）與 `BAT_RUNTIME=N` 兩情境都解析到正確 `server-cert.json` / log 目錄（單元測試）
- [ ] headless env 行為不變（既有測試全綠）
- [ ] `npm run test:unit` 全綠（回報數字）；`npx vite build` exit 0；`npm run verify:helpers` ✅
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D138 + T0479 回報區第 5、6 節 + 上列 affects_files + `electron/remote/headless-entry.ts:280-300`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

本機 PTY 的三個 env 組裝點（Terminal Server `pty:create`、node-pty、child_process fallback）都注入 `BAT_USER_DATA = deps.dataDir`（Electron 即 `app.getPath('userData')`）；`_bat-cert.mjs` / `_bat-logger.mjs` 解析順序改為「明確 override → `BAT_USER_DATA`（絕對路徑）→ `APP_NAME` + `BAT_RUNTIME`（舊行為）」。`--runtime=N`（PTY 無 `BAT_RUNTIME`）時 helper 讀到該實例自己的 `server-cert.json` / `Logs`，不再落到預設實例而 fail-close。`electron/main.ts` 未改。

### 設計選擇（工單步驟 1「擇一並說明」）：注入 `BAT_USER_DATA`，不注入 `BAT_SERVER_CERT_PATH` + `BAT_HELPER_LOG_DIR`

1. **與既有契約同名同值**：Terminal Server 路徑的 PTY 本來就從 server 行程繼承 `BAT_USER_DATA`（`main.ts` fork env）；現在 main 在 `pty:create` env 裡也帶，三條路徑一致。順帶修掉一個潛在問題：detached 的 Terminal Server 跨 BAT 重啟存活，T0480 搬移 userData 後它繼承的值會過期，而 `req.env` 會覆蓋 server 的 `process.env`。
2. **檔案配置留在 helper**：`server-cert.json` / `Logs` 這兩個名字 helper 原本就擁有；pty-manager 只傳目錄，不必知道 cert 檔名與 log 目錄名（也不必 import `certificate.ts` / `logger.ts`）。
3. **不改 `main.ts`**（memory_overrides）：`deps` 現有欄位只有 `dataDir`，要注入完整 cert 路徑 / log 目錄就得在 pty-manager 重複配置規則，或改 `createElectronPtyDeps`。
4. **兩個明確 override 維持 headless / smoke 專用語意**，優先序最高、行為不變。

**注入條件**：只在 host 提供 `deps.helperDir` 時注入（與 `BAT_HELPER_DIR` 同條件，`helperDirEnv()` 更名 `localHelperEnv()`）。headless 的 `PtyManagerDeps` 不設 `helperDir`（helper 路徑由 `helperEnv` 提供），所以 headless PTY env 完全不變；headless 的 `dropInheritedEnv` 本就 scrub 全部 `BAT_*`，從本機 BAT 終端啟動 bat-server 也不會把本機 `BAT_USER_DATA` 帶進遠端 PTY。位置在 `customEnv` 與繼承 env 之後，client 傳入或從父 BAT 繼承的 `BAT_USER_DATA` 都會被覆蓋。只是路徑資訊，不是 credential，權限沒有擴大（測試斷言 `BAT_REMOTE_TOKEN` 仍只有原本的本機 server token）。

### 改動檔案

- `electron/pty-manager.ts`：`localHelperEnv()`（`BAT_HELPER_DIR` + `BAT_USER_DATA`），三個 env builder 套用；`helperDir` doc 補 T0481 說明
- `scripts/_bat-cert.mjs`：`resolveUserDataDir()` 先看 `BAT_USER_DATA`（絕對路徑）；`loadTrustedFingerprint` doc 改為完整解析順序
- `scripts/_bat-logger.mjs`：同上；檔頭改成三段優先序說明；修 Linux `logs` → `Logs`、移除過期的 `main.ts:121` / `lines 120-135` / `logger.ts:160` 行號、移除 Linux「product name lowercased」的誤導註解；`ENV_WHITELIST` 加 `BAT_USER_DATA`（路徑非 secret，診斷本 BUG 類問題用）
- `electron/__tests__/pty-manager-helper-env.test.ts`：+4 測試（node-pty / Terminal Server / child_process 三路徑帶 `BAT_USER_DATA` 且覆蓋繼承與 customEnv；無 `helperDir`（headless）不注入、`helperEnv` 路徑不變）。`:146` 原斷言（無 `helperDir` 的 Electron manager 沒有 `BAT_SERVER_CERT_PATH` / `BAT_HELPER_LOG_DIR`）在新設計下仍然成立，**保留未改**；新設計的正向斷言放在新增的 describe
- `scripts/__tests__/server-bundle-helpers.test.mjs`：+4 測試（`--runtime=N` 只有 `BAT_USER_DATA` → 該實例 cert 與 log；只有 `BAT_RUNTIME` → 舊行為；`BAT_USER_DATA` 優先於 `BAT_RUNTIME`、相對路徑忽略；headless 的兩個 override 優先於 `BAT_USER_DATA`）

```
$ git diff --stat -- <本單 5 檔>
 electron/__tests__/pty-manager-helper-env.test.ts | 86 ++++++++++++++++++++++-
 electron/pty-manager.ts                           | 30 +++++---
 scripts/__tests__/server-bundle-helpers.test.mjs  | 85 ++++++++++++++++++++++
 scripts/_bat-cert.mjs                             | 17 ++++-
 scripts/_bat-logger.mjs                           | 38 ++++++----
 5 files changed, 228 insertions(+), 28 deletions(-)
```

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| 本機 PTY env（兩條 spawn 路徑，實作涵蓋 server / node-pty / child_process 三處）帶正確 userData | ✅ PASS | `pty-manager-helper-env.test.ts` 12/12 |
| helper 在 `--runtime=N`（無 `BAT_RUNTIME`）與 `BAT_RUNTIME=N` 都解析到正確 cert / log 目錄 | ✅ PASS | `server-bundle-helpers.test.mjs` 15/15 |
| headless env 行為不變 | ✅ PASS | 既有 T0433 / T0448 headless 測試全綠 + 新增 headless 不注入 / override 優先測試 |
| `npm run test:unit` | ✅ PASS | **173 files / 2973 passed / 1 skipped**（stderr 的 `AttachConsole failed` 是 Windows conpty 真 PTY 測試的既有雜訊） |
| `npx vite build` | ✅ exit 0 | |
| `npm run verify:helpers` | ✅ | `OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set`（沒有新增 helper 檔，extraResources 不受影響） |
| `npx tsc --noEmit -p tsconfig.json`（額外） | ℹ️ | 36 個 error，**都不在本單檔案**（grep `pty-manager` 0 筆）；沒有 baseline 可比（禁止 stash），只記錄現況 |

⚠️ 執行時 working tree 有 T0480 並行中的未 commit 改動（`electron/main.ts`、`electron/snippet-db.ts`、`electron/app-paths-bootstrap.ts`、`electron/userdata-migration.ts` 及其測試），上面的全套測試數字與 build **包含 T0480 的 WIP**。本單 commit 不包含它們。

### Landing Zone Check

- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → **PASS**
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：5 個 affects_files 都存在 → PASS
- C-2：無 `branch` 欄位 → N/A（實際在 `main`）
- 觀察到的 `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 結論：**PASS**

### 偏離 / 範圍外發現

- 無偏離。`_bat-logger.mjs` 的 `ENV_WHITELIST` 加 `BAT_USER_DATA` 是在本單檔案內順手做的小改，用於診斷。
- 給 T0482（文件）參考：CLAUDE.md「遠端 Tower 通知」與 Logging 段落如果要提本機 PTY env，現在本機 PTY 帶 `BAT_USER_DATA`；helper 解析順序見 `_bat-logger.mjs` 檔頭。
- 舊行為 fallback 對 T0480 之前的 runtime 實例仍然猜錯（實際目錄是 `better-agent-terminal-runtime-N`）；只會發生在「BAT 本體早於 T0481」的 PTY，T0480 改名後也會吻合。

### Commit

見下方 commit（本單工單檔 + 5 個 affects_files，`git commit --only` 排除 T0480 改動）；不 push。
