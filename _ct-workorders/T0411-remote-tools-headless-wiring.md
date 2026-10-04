---
schema_version: 1
schema_kind: workorder
id: T0411
title: "PLAN-037 B：remote-tools 接線——共用模組 electron/handlers/remote-tools.ts + proxied remote-tools:detect + 本機 remote:detect-tools(profileId) 短連線 + preload / 型別 + parity + smoke S10"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:10:44+08:00"
started_at: "2026-10-05T03:12:12+08:00"
updated_at: "2026-10-05T03:21:53+08:00"
completed_at: "2026-10-05T03:21:53+08:00"
target_version: next
depends_on:
  - T0408
related:
  - "T0407 回報區 §4 執行模型（偵測段）；T0408 回報區「給後續工單的備註」"
  - "D133 波次；T0410（同批平行，只動 `src/components/remote-tools/*`、locales、styles）"
affects_files:
  - electron/handlers/remote-tools.ts
  - electron/main.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/__tests__/
  - electron/__tests__/
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
  - "🔴 T0410 平行中：不得碰 `src/components/`、`src/locales/`、`src/styles/`。"
  - "🔴 不得部署到 WSL、不得 restart `bat-server.service`；完成後由塔台部署並跑 smoke。"
  - "🔴 probe 子行程 env 以 headless PTY 同一套 scrub 規則清理（`isHeadlessScrubbedEnvKey`），不得把 `BAT_*` / server token 帶進 probe。"
  - "🔴 child_process 一律 `execFile` + array args + timeout（沿用 T0408 `detectRemoteTools`）；`profileId` 驗證比照 `remote:detect-arch`（`main.ts:2919`）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0411 — remote-tools 接線（PLAN-037 B）

## 元資料
- **工單編號**：T0411
- **任務名稱**：remote-tools headless / main 接線
- **狀態**：DONE
- **建立時間**：2026-10-05 03:10 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0408（`ab30fff` / `6d7daab`）完成偵測核心：`detectRemoteTools(execFileImpl, { shell })` → `RemoteToolsDetectResult`（`src/types/remote-tools.ts`）。本單把它接上：遠端 headless server 提供 proxied channel，本機視窗（精靈、設定頁）用短連線呼叫。**規格以 T0407 §4（偵測段）為準。**

## 範圍

1. `electron/handlers/remote-tools.ts`：`registerRemoteToolsHandlers(register, deps)`，註冊 `remote-tools:detect` → `detectRemoteTools(execFile, { shell })`；不 import electron
   - `shell` 來源與遠端 PTY 解析 shell 一致（`$SHELL` / `os.userInfo().shell`），交 `selectLoginShell` 驗證
   - probe env：`process.env` 經 headless scrub 規則清理後傳入
   - Windows 主機回 `{ ok: false, errorCode: 'host-platform' }`（型別已定義）
2. headless：在 `createHeadlessHandlerModules`（`headless-entry.ts:262`）加入；`remote-tools:detect` 加入 `PROXIED_CHANNELS`，parity 不需列 unsupported
3. Electron 端：`main.ts` 同樣註冊（macOS / Linux 本機可得本機結果；Windows 回 host-platform）
4. 本機短連線：local-only `ipcMain.handle('remote:detect-tools', profileId)`——`new RemoteClient()` → connect（帶 profile 的 fingerprint）→ `invoke('remote-tools:detect')` → disconnect，範式同 `remote:test-connection` / `remote:list-profiles`；舊 server 回 `No handler for channel` 時回傳可辨識的結果（例如 `{ ok: false, errorCode: 'server-too-old' }`，必要時擴充型別的 errorCode）
5. `preload.ts` / `src/types/electron.d.ts`：暴露 `remoteTools.detect(profileId)`（本機短連線）與遠端視窗內直接呼叫 `remote-tools:detect` 的 API（命名由 Worker 決定，回報區寫明，T0410 會依此接上）
6. smoke：新增 **S10** `remote-tools:detect` 回 `schemaVersion: 1`、`env.osFamily = linux`、`git` 為 `ok`；舊 server 回 `No handler` 時 FAIL 並註明「server predates T0411」；`docs/remote-dev-overview.md` 的 smoke 表補 S10

## 驗收條件

- [ ] headless harness：`remote-tools:detect` 經 WS 回傳合法 report（可注入 fake execFile）；probe env 不含 `BAT_*`
- [ ] parity / electron-free / proxied-binding 守門綠
- [ ] `remote:detect-tools`：profileId 驗證、連線失敗 / 舊 server / 成功三種結果的單元測試（mock RemoteClient）
- [ ] smoke 單元測試含 S10（新 / 舊 server）
- [ ] `npm run test:unit` 全綠（基線 1442）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區寫明 preload API 名稱與回傳形狀（給 T0410 / T0412）

## Sub-session 執行指示
1. 讀本工單 + T0407 §4 + T0408 回報區 + `electron/handlers/claude.ts`（共用模組範本）+ `main.ts` `remote:detect-arch` / `remote:test-connection` 段
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 6 項驗收全部通過（commit `49b1ca5`）。未部署到 WSL、未 restart `bat-server.service`；真機 S10 由塔台部署後跑。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3：前 5 項可測 entry 皆 present（`electron/handlers/remote-tools.ts` 為新檔 → 最近祖先 `electron/handlers/`；其餘檔案本身存在）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收**

| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | headless harness | ✅ PASS | `electron/remote/__tests__/headless-remote-tools.test.ts`（4 tests）：經 WS 拿到 schema v1 report（fake execFile + `platform: 'linux'`，經 `HeadlessServerOptions.remoteTools` 注入）；server process 先設 `BAT_REMOTE_TOKEN` / `BAT_HELPER_DIR` / `BAT_TOWER_TERMINAL_ID` / 小寫 `bat_*`，兩個 probe 的 `options.env` 都不含任何 `BAT_*` 也不含其值；Windows host 回 `host-platform` 且不 spawn |
| 2 | parity / electron-free / proxied-binding | ✅ PASS | `headless-parity` / `headless-electron-free` / `proxied-channels-binding` 皆綠。`remote-tools:detect` 已在 headless 註冊，不進 `HEADLESS_UNSUPPORTED`；`remote:detect-tools` 是 `ipcMain.handle`；preload 兩個 invoke channel 都有 binding |
| 3 | `remote:detect-tools` 單元測試 | ✅ PASS | `electron/__tests__/remote-tools-handlers.test.ts`（19 tests，mock `RemoteToolsDetectClient`）：profileId 驗證（`undefined` / 數字 / 空字串 / `../etc` / 空白 / `;`，皆不查 profile）、找不到、缺 fingerprint 不連線、local profile 走本機偵測、成功（連線參數取自 profile、預設 port 9876）、server 端錯誤原樣回傳、連線失敗 / connect throw → `connect-failed`、舊 server → `server-too-old`、其他錯誤與形狀不符 → `invoke-failed`；每條路徑都 disconnect，disconnect 拋錯不影響結果 |
| 4 | smoke 單元測試 S10 | ✅ PASS | `scripts/__tests__/smoke-remote-headless.test.mjs` 68 tests（+4）：新 server S1-S10 全 PASS，S10 用 30 s timeout；舊 server S10 FAIL 並寫明 `server predates T0411`；error / schema 2 / darwin / git missing 都 FAIL；`checkRemoteToolsAnswer` 單元測試 |
| 5 | 全套 | ✅ PASS | • `npm run test:unit`：100 files、**1514 passed**、1 skipped（含 T0410 平行中的未 commit 測試；本單新增 27）<br>• `npx tsc --noEmit`：**40**（= 基線；本單觸及的檔案 0 筆）<br>• `npx vite build`：exit 0；`dist-electron/main-*.js` 含 `remote:detect-tools` / `remote-tools:detect`，`preload.js` 含 `remote-tools:detect`<br>• `npm run test:e2e`：**6 passed、8 skipped、0 failed** |
| 6 | 回報區寫明 preload API | ✅ PASS | 見下方「preload API」 |

### 產出摘要

**檔案**
- `electron/handlers/remote-tools.ts`（新）—— 共用模組，不 import electron
  - `registerRemoteToolsHandlers(register, deps)`：註冊 `remote-tools:detect` → `runRemoteToolsDetect(deps)`
  - `runRemoteToolsDetect`：`platform === 'win32'` → `host-platform`；否則 probe env = host env 經 `deps.isScrubbedEnvKey` 清理（`buildProbeEnv`），包一層 execFile 把 env 塞進兩個 probe 的 options，再呼叫 T0408 的 `detectRemoteTools(execFile, { shell })`
  - `resolveProbeShell`：`$SHELL` → `os.userInfo().shell`，交 `selectLoginShell` 驗證
  - `detectRemoteToolsForProfile(profileId, { getProfile, createClient, detectLocal })`：本機短連線邏輯（connect → invoke → disconnect），可注入 client，供 main.ts 與單元測試共用；不 throw
  - `asRemoteToolsDetectResult`：檢查 server 回應形狀（`ok: true` 必須 `schemaVersion === 1`）
- `electron/remote/headless-entry.ts`：`createHeadlessRemoteToolsModule()` 加入 `createHeadlessHandlerModules`；`isScrubbedEnvKey` 固定為 `isHeadlessScrubbedEnvKey`；`HeadlessServerOptions.remoteTools`（測試注入 execFile / platform / env）
- `electron/remote/protocol.ts`：`remote-tools:detect` 加入 `PROXIED_CHANNELS`
- `electron/main.ts`：`registerRemoteToolsHandlers(registerHandler, { isScrubbedEnvKey: isHeadlessScrubbedEnvKey })`；local-only `ipcMain.handle('remote:detect-tools', profileId)`，`createClient` 為 `new RemoteClient(() => [], profile)`（帶 profile ⇒ ssh profile 的 tunnel 由 RemoteClient 自行建立；`() => []` ⇒ 不轉發事件到任何視窗）
- `electron/preload.ts` / `src/types/electron.d.ts`：新 namespace `remoteTools`
- `src/types/remote-tools.ts`：`REMOTE_TOOLS_DETECT_ERROR_CODES` 擴充 4 個只由短連線產生的 code（工單範圍 4「必要時擴充型別的 errorCode」）
- `scripts/smoke-remote-headless.mjs`：S10 + `checkRemoteToolsAnswer` + `SmokeClient.invokeWithTimeout`（S10 至少等 30 s）
- `docs/remote-dev-overview.md`：smoke 表補 S10、`--timeout-ms` 註明 S10 例外
- 測試：`electron/__tests__/remote-tools-handlers.test.ts`（新）、`electron/remote/__tests__/headless-remote-tools.test.ts`（新）、`scripts/__tests__/smoke-remote-headless.test.mjs`

> `headless-channel-status.ts` 列在 affects_files，但不需修改：channel 已在 headless 註冊，parity 自動通過。

**設計決策**
1. **Electron 端 probe 也套 scrub**：`isScrubbedEnvKey` 是必填 dep，兩邊都傳 `isHeadlessScrubbedEnvKey`。Electron main 若從 BAT 終端啟動也帶 `BAT_*`，一併清掉。為了不讓 `electron/handlers/` 反向 import `headless-entry`（循環），scrub 規則由 host 注入；main.ts 因此新增 `import { isHeadlessScrubbedEnvKey } from './remote/headless-entry'`（該模組無 top-level 副作用）。
2. **`remote:detect-tools` 對 local profile**：不回錯，直接跑本機偵測（Windows 即 `host-platform`）。精靈建立的都是 remote profile，這條只是讓 API 對任何 profileId 都有合理答案。
3. **缺 pinned fingerprint 不連線**：比照 `loadProfileSnapshotDetailed`，回 `invalid-profile`。
4. **舊 server 判定**：沿用 `src/lib/remote-unsupported.ts` 的 `unsupportedRemoteChannel()`，且只在 channel 正好是 `remote-tools:detect` 時判 `server-too-old`；別的 channel 的 No handler 歸 `invoke-failed`。
5. **invoke timeout**：短連線 30 s（login probe 20 s ∥ server probe 5 s）；`RemoteClient` 預設也是 30 s，這裡明確傳入。

### preload API（給 T0410 / T0412）

```ts
window.electronAPI.remoteTools.detect(profileId: string): Promise<RemoteToolsDetectResult>
window.electronAPI.remoteTools.detectHere(): Promise<RemoteToolsDetectResult>
```

| API | IPC channel | 用途 | 失敗方式 |
|-----|-------------|------|---------|
| `remoteTools.detect(profileId)` | `remote:detect-tools`（local-only） | 精靈、設定頁等**未綁定該 profile** 的本機視窗。main 以 profile 的 host / port / token / fingerprint 短連線到 bat-server → `remote-tools:detect` → 斷線。local profile ⇒ 本機偵測 | **永不 reject**，一律 `{ ok: false, errorCode, error }` |
| `remoteTools.detectHere()` | `remote-tools:detect`（proxied） | **遠端 profile 視窗內**直接問自己的 bat-server。本機視窗呼叫則偵測本機（Windows ⇒ `host-platform`） | 舊 server **reject**：`No handler for channel: remote-tools:detect`（Electron IPC 會包成 `Error invoking remote method ...`），用 `unsupportedRemoteChannel(err) === 'remote-tools:detect'` 辨識 |

回傳型別 `RemoteToolsDetectResult`（`src/types/remote-tools.ts`）：
- `{ ok: true, report: RemoteToolsReport }`（`schemaVersion: 1`）
- `{ ok: false, errorCode, error: string }`，`errorCode` 為 `REMOTE_TOOLS_DETECT_ERROR_CODES` 之一：
  - server / 本機偵測：`host-platform` / `spawn-failed` / `timeout` / `no-markers`
  - **T0411 新增，只來自 `detect(profileId)`**：`invalid-profile`（profileId 不合法、找不到、remote profile 缺 host / token / fingerprint）、`connect-failed`（連不上、auth、fingerprint mismatch；`error` 尾端附 `[<RemoteClient errorCode>]`）、`server-too-old`（server 早於 T0411 → UI 顯示「遠端伺服器版本過舊，請重新部署」）、`invoke-failed`（呼叫失敗、逾時或回應不是 schema v1）

ℹ️ **給 T0410 / T0412**：T0410（`8a17984`）已涵蓋上面新增的 4 個 code —— `RemoteToolsPanel` 以 `REMOTE_TOOLS_DETECT_ERROR_CODES` 映射 `remoteTools.error.<code>`，三語 locale 皆有，`i18n-completeness` 依此 const 列舉並通過（本單 commit 後複跑 `src/locales` + `remote-tools-panel.test.tsx`：67 passed）。本單未碰 `src/components/` / `src/locales/`。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **`tsc --noEmit` 輸出含 T0410 平行中的檔案**：執行期間一度看到 `src/components/remote-tools/RemoteToolsPanel.tsx(46,56): Cannot find name 'REMOTE_TOOLS_DETECT_ERROR_CODES'`（T0410 編輯中的中間狀態），之後的完整執行總數為 40（= 基線）。本單觸及的檔案 0 筆錯誤。
2. **Bash heredoc 解析失敗**：一次用 heredoc 內嵌 Python 修改 smoke 測試時，bash 回 `unexpected EOF while looking for matching '`，檔案未被修改；改以 scratchpad 的 `.py` 腳本執行後正常。
3. 工作樹內有 T0410 的未 commit 改動（`src/components/remote-tools/`、`src/locales/*`、`src/styles/remote-tools.css`、`src/components/__tests__/remote-tools-panel.test.tsx`、`_ct-workorders/T0410-*.md`）—— 本單未觸碰，commit 以 `--only` 排除。

**給塔台**
- 部署新 server bundle 後跑 `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`，預期 S10 PASS（WSL Ubuntu 有 git 2.43.0）；未重新部署的 server 預期 S10 FAIL `server predates T0411`。

**Commit**
- `49b1ca5` feat(remote-tools): wire remote-tools:detect on headless + main（12 檔，`git commit --only`；未 push）

### 回報時間
2026-10-05T03:21:53+08:00
