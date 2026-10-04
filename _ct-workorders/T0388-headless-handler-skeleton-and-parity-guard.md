---
schema_version: 1
schema_kind: workorder
id: T0388
title: "PLAN-036 P0-A：headless handler 共用骨架 + 防漂移守門（channel parity test / electron-free guard / vitest headless harness）"
type: implementation
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:13:51+08:00"
started_at: "2026-10-05T00:02:12+08:00"
completed_at: "2026-10-05T00:13:51+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §1、§3、§6、建議工單清單 A"
  - "T0392（BUG-095，平行；會把 `claude:abort-session` 加進 `PROXIED_CHANNELS`）"
affects_files:
  - electron/handlers/types.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/remote/__tests__/headless-parity.test.ts
  - electron/remote/__tests__/helpers/headless-harness.ts
  - electron/remote/__tests__/
  - scripts/build-server-bundle.mjs
  - tests/headless-server.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`** 等會動到工作區他人未提交修改的 git 操作（L138：本專案常有多個 Worker 平行，曾因 stash 還原他單的工單編輯）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add` 到 scratchpad。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`；本機 headless 實驗用 scratchpad + port 0 或非 9876 / 9877 埠。"
  - "🔴 本單**不改** `electron/main.ts`（T0387 執行中、T0389 排隊中）與 `electron/remote/protocol.ts`（T0392 平行中）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設。不 push。"
---

# T0388 — headless handler 骨架 + 防漂移守門

## 背景

PLAN-036（T0386 研究、D129）：headless bat-server 需與 Electron main **共用同一份 handler 註冊模組**（`registerXxxHandlers(register, deps)` + DI）。本單建立骨架與守門，**不搬任何既有 handler**（P0-B / C 做）。

## 範圍

1. `electron/handlers/types.ts`（新）：`HandlerRegistrar = (channel, fn) => void`、`HostDeps` 介面（`emit` / `dataDir` / `homeDir` / `helperDir?` / `getSettings` / `notifier?` / `onSettingsSaved?` / `pathGuard?`，依 T0386 §3；欄位可先宣告、後續單填實作）。不得 import `electron`
2. **channel parity test**（`electron/remote/__tests__/headless-parity.test.ts`）：對 `PROXIED_CHANNELS` 每個 channel，斷言 headless registry `hasHandler`，**或**列在明確清單 `HEADLESS_UNSUPPORTED`（暫時未支援，附階段標記 P0/P1/P2/P3）或 `ALWAYS_LOCAL_CHANNELS`。清單放在可被產品程式碼引用的模組（例如 `electron/remote/headless-channel-status.ts`），初始把目前 headless 沒有的 channel 全列入，日後每張上線單從清單移除
   - ⚠️ T0392 平行把 `claude:abort-session` 加入 `PROXIED_CHANNELS`：若 T0392 先 commit，本單清單需含它（P1）；若本單先 commit，回報區註明，由 T0392 補
3. **electron-free guard**：以 esbuild 打包 `server-entry.ts`（設定從 `scripts/build-server-bundle.mjs` 讀，**不要手抄 externals**——塔台 23:33 實測手抄會漏 6 項），攔截 `electron` 的 import：只允許既有 lazy try/catch 點（T0386 指 `remote-server.ts` / `secrets.ts`，請複核），其他來源 fail
4. **vitest headless harness**（`electron/remote/__tests__/helpers/headless-harness.ts`）：檔頭 `// @vitest-environment node`；in-process `createHeadlessServer` + `ws` client，port 0、`mkdtemp` dataDir；提供 `invoke(channel, ...args)`。把 `tests/headless-server.test.ts`（tsx 腳本）的案例併入 vitest，原檔移除
5. `scripts/build-server-bundle.mjs:358-367` 的 `electron/handlers/` 複製步驟：esbuild 從 import 圖打包即可，移除該步驟（或改為只在目錄非空時警告），避免「目錄不存在靜默略過」的假象；確認 `build-server-bundle` 仍可跑（`BAT_SERVER_ALLOW_MISSING_NATIVE=1` schema-only 即可）

## 驗收

- parity test、electron-free guard、harness 案例皆在 `npm run test:unit` 內通過；故意在 parity 清單外加一個假 channel 會紅（回報區附一次負向驗證輸出，驗完還原）
- `npm run test:unit` 全綠（基線 **920**，若 T0387 / T0392 先 commit 以 HEAD 為準；回報新數字）
- `npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 回報區列出 `HEADLESS_UNSUPPORTED` 初始清單統計（各階段幾個）

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + **T0386 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- **開始**：2026-10-05T00:02:12+08:00（Worker，`CT_MODE=on`、`CT_INTERACTIVE=0`）
- **落點檢查**：WARN —— C-0 無法判定（frontmatter **無 `repo` 欄位**；`basename(REPO_ROOT)` = `better-agent-terminal`）；C-1 PASS（工單在 REPO_ROOT 下）；C-3 部分存在（`electron/handlers/types.ts` 及 `electron/handlers/` 不存在 = 本單新建；其餘 `headless-entry.ts` / `headless-handlers.ts` / `__tests__/` / `build-server-bundle.mjs` / `tests/headless-server.test.ts` 存在）→ 繼續；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **結果**：DONE。5 項範圍全部落地；parity / electron-free 兩道守門各做一次真實負向驗證（紅燈後還原）

### 實作內容

1. **`electron/handlers/types.ts`（新）**：`SharedHandler`、`HandlerRegistrar`、`HostEmit`、`HostNotifier`、`HostPathGuard`、`HostDeps`（`emit` / `dataDir` / `homeDir` / `helperDir?` / `getSettings` / `notifier?` / `onSettingsSaved?` / `pathGuard?`）、`HandlerModule = (register, deps) => void`。只 `import type` 自 `../remote/handler-registry`，無 electron
2. **channel ledger `electron/remote/headless-channel-status.ts`（新，產品程式碼可引用）**：
   - `ALWAYS_LOCAL_CHANNELS`（main.ts 同名常數的鏡像；本單不得改 main.ts，所以由 parity test **讀 main.ts 原始碼比對**兩邊一致，日後可改由 main.ts 直接 import 這份）
   - `HEADLESS_UNSUPPORTED: Record<channel, 'P0'|'P1'|'P2'|'P3'>`，逐行列出；T0386 的重新分類建議（always-local 候選 / remote 不支援）以行尾註解標記，不在本單決定
   - 純函式 `checkHeadlessParity()`：5 種違規 `unclassified` / `registered-but-listed-unsupported`（上線了卻沒刪清單）/ `listed-twice` / `stale-unsupported` / `stale-always-local`
3. **headless 註冊點**（`headless-entry.ts`）：`HEADLESS_HANDLER_MODULES: HandlerModule[] = []`（T0390 起往這裡掛 domain module）+ `createHeadlessHostDeps(dataDir)`（emit = `broadcastHub.broadcast`、`homeDir = os.homedir()`、`getSettings` 讀 `<dataDir>/settings.json`；無 helperDir / notifier / pathGuard）。註冊順序：內建 → shared modules → 呼叫端提供的 `handlers`（呼叫端仍可覆寫）。`headless-handlers.ts` 補 `headlessSettingsPath()` / `readHeadlessSettings()`，和 `settings:load/save` 共用同一個路徑
4. **electron-free guard**（`__tests__/headless-electron-free.test.ts`）：esbuild 打包 `build-server-bundle.mjs` 的**實際 4 個 entryPoints**；externals / platform / target / format 都從腳本原始碼解析（`__tests__/helpers/server-bundle-config.ts`，不手抄，腳本形狀變了就直接 throw）。onResolve 攔截 `electron`，只允許 `remote-server.ts` / `secrets.ts` 的 `require-call`（已複核：兩處都是 try/catch 內的 lazy require，另加原始碼檢查確認仍在 `try {` 內）；任何 `import-statement` 或其他來源都 fail。另附 fixture 自我負向測試
5. **vitest headless harness**（`__tests__/helpers/headless-harness.ts`）：`startHeadlessHarness()` = in-process `createHeadlessServer`（port 0、`mkdtemp` dataDir、隨機 token）+ `ws` client（和 RemoteClient 同樣的 fingerprint pinning）+ auth；提供 `invoke(channel, ...args)`、`events` / `waitForEvent()`、`connect()`（多 client）、`dispose()`。`tests/headless-server.test.ts` 的 6 個案例搬到 `__tests__/headless-server.test.ts`，另加 6 個 wire-level 案例（內建 channel、settings round-trip、未註冊 channel 錯誤字串、覆寫、錯 token、fingerprint 不符）；原檔已 `git rm`
6. **`scripts/build-server-bundle.mjs`**：移除 `electron/handlers/` → `staging/handlers` 的複製步驟（含 `handlersDir`、`ensureDir`、summary 的 `handlersCopied`），改成註解說明 handler 經 esbuild import 圖進 bundle。⚠️ 本單建立 `electron/handlers/` 之後，若沒移除這一步，舊邏輯會把 TS 原始碼複製進 tarball

### `HEADLESS_UNSUPPORTED` 初始清單統計

| 階段 | 數量 | 內容 |
|---|---|---|
| P0 | 7 | `pty:*` 6 + `settings:get-shell-path` |
| P1 | 43 | `claude:*` 全部（含 codex 2、stub 5、archive 3、**`claude:abort-session`**） |
| P2 | 30 | `worktree:*` 5、`github:*` 7、`git:*` 7、`git-scaffold:*` 3、`fs:*` 7、`image:read-as-data-url` |
| P3 | 16 | `snippet:*` 10、`settings:get-logging-info` / `cleanup-logs`、`terminal:*` 4 |
| **合計** | **96** | + headless 已支援 8（T0385）+ ALWAYS_LOCAL 2 = `PROXIED_CHANNELS` 106 |

- **T0392 協調**：T0392 先 commit（`f72e177`，`claude:abort-session` 進 `PROXIED_CHANNELS`），依工單規則本單清單已含它（P1，比照 `claude:stop-session`）。T0392 回報區第 127 行的轉知事項已處理

### 驗證

| 閘門 | 結果 | 證據 |
|---|---|---|
| 新測試 | ✅ PASS | `headless-parity` 8 + `headless-electron-free` 4 + `headless-server` 12 = **24 tests / 3 files** 全過 |
| parity 負向驗證 | ✅ 紅燈正確 | 暫時在 test 內 `PROXIED_CHANNELS.add('t0388:fake-channel')` → `AssertionError: headless parity broken ... t0388:fake-channel: unclassified`（1 failed / 7 passed）；已還原（grep `TEMP negative` = 0） |
| electron-free 負向驗證 | ✅ 紅燈正確 | 暫時在 `headless-handlers.ts` 加 `import { app } from 'electron'` → `electron/remote/headless-handlers.ts: import-statement 'electron' — importer is not an allowed lazy electron call site`；已還原（備份檔覆回，grep = 0） |
| `npm run test:unit` | ✅ PASS（本單範圍） | 排除 T0389 執行中的未 commit 測試後 **72 files / 1021 tests passed**。完整跑一次是 73 files / 1 failed：失敗的是 T0389 的 `electron/__tests__/pty-manager-deps.test.ts`（`expected null not to be null`）和暫存檔 `zz-debug-t0389.test.ts`，兩支都屬 T0389 平行工作、不是本單改動 |
| `npx vite build` | ✅ exit 0 | — |
| `npx tsc --noEmit` | ✅ 40（≤ 40） | 新檔 / 改檔 0 錯 |
| `build-server-bundle`（schema-only） | ⚠️ PARTIAL | `BAT_SERVER_ALLOW_MISSING_NATIVE=1 BAT_SERVER_NODE_BINARY=<node.exe>` 在 Windows host 停在 step 4 `pruneAnthropicPackages`：`Expected @anthropic-ai/claude-code-linux-x64/claude after pruning`。這是**既有限制**（Windows 沒有 linux claude 二進位，`ALLOW_MISSING` 不涵蓋這個檢查，而且它在本單修改的 step 5 之前）。為了實際跑到 step 5-7，用暫時 probe 副本（`scripts/.t0388-bundle-probe.mjs`，只把該 throw 換成 warn，跑完已刪）跑完 → `✅ Bundle created`，tarball `staging/handlers` 項目數 = 0 |
| bundle 載入 smoke | ✅ PASS | plain node `require('dist-server/staging/electron/remote/server-entry.js')` → `createHeadlessServer` port 0 start → `started port>0: true bind: 127.0.0.1` → stop。之後清掉 `dist-server/staging` 和 tarball（`dist-server/dev-deploy-headless/` 屬 T0391，沒動） |

### 偏差 / 風險 / 後續

- **ALWAYS_LOCAL 雙份**：本單不得改 `main.ts`，所以 `ALWAYS_LOCAL_CHANNELS` 暫時兩份並存，靠 parity test 比對 main.ts 原始碼擋漂移。建議下一張可動 main.ts 的單（T0389 / T0390 / J）改成 `import { ALWAYS_LOCAL_CHANNELS } from './remote/headless-channel-status'`
- **build 腳本解析器兩份**：T0391 的 `scripts/dev-deploy-headless.mjs` `parseBuildConfig()` 和本單 `__tests__/helpers/server-bundle-config.ts` 解析同一份原始碼。本單執行時 T0391 還沒 commit，為避免 commit 順序耦合各自實作；日後任一方重構時建議合併（例如把 esbuild 設定抽成 `scripts/_bat-server-esbuild-config.mjs` 由兩邊 import）
- **schema-only build 在 Windows 跑不完**（既有，見上表）：`pruneAnthropicPackages` 的 claude 二進位檢查不受 `BAT_SERVER_ALLOW_MISSING_NATIVE` 豁免。建議另案讓它在 ALLOW_MISSING 下降級成 warn（非本單範圍，沒改）
- 既有觀察（沒改）：`copyServerSources()` 會把 `electron/remote/*.ts` 原始碼整包複製到 bundle 好的 `staging/electron/remote/` 之上，tarball 內含 TS 原始碼。不影響執行，但屬無用負載，可另案評估
- `esbuild` 不是 `package.json` 直接依賴（經 `vite@7.3.2` 間接安裝 0.27.7）；`build-server-bundle.mjs` 本來就這樣用，守門測試沿用。vite 若換掉 esbuild，兩者會一起失效
- harness 的 `// @vitest-environment node` directive 只在測試檔生效（全域為 jsdom），所以 harness 檔頭註明 import 它的測試檔也要加這行

### 變更檔案

- 新增：`electron/handlers/types.ts`、`electron/remote/headless-channel-status.ts`、`electron/remote/__tests__/headless-parity.test.ts`、`electron/remote/__tests__/headless-electron-free.test.ts`、`electron/remote/__tests__/headless-server.test.ts`、`electron/remote/__tests__/helpers/headless-harness.ts`、`electron/remote/__tests__/helpers/server-bundle-config.ts`
- 修改：`electron/remote/headless-entry.ts`、`electron/remote/headless-handlers.ts`、`scripts/build-server-bundle.mjs`、本工單
- 刪除：`tests/headless-server.test.ts`
- 沒動：`electron/main.ts`、`electron/remote/protocol.ts`、T0389 的 `pty-manager.ts` / `claude-runtime-router.ts` / `claude-agent-manager.ts` 等平行改動；沒用 stash / reset / checkout / restore；沒碰 WSL `bat-server.service` / `~/.local/bat-server`

### Commit

- 單一 commit，`git commit --only` 只含上列檔案 + 本工單；沒 push。hash 見 `git log`（回報區在 commit 前寫入，不自我引用）
