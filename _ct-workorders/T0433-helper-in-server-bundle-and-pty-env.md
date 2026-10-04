---
schema_version: 1
schema_kind: workorder
id: T0433
title: "PLAN-036 P3 / K 工單 3：helper（bat-terminal / bat-notify / _bat-cert / _bat-logger）隨 server bundle 出貨 + headless PTY 注入範圍權杖 env"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: "2026-10-05T06:23:04+08:00"
updated_at: "2026-10-05T06:37:49+08:00"
completed_at: "2026-10-05T06:37:49+08:00"
target_version: next
depends_on:
  - T0432
related:
  - "T0420 研究回報區「各單內容」工單 3；方案 A'"
  - "CLAUDE.md「Packaging / Release 前置檢查」：`verify-helper-bundle.js`（BUG-058 / T0247 / T0248）、server bundle（PLAN-031）"
  - "D134 追加（K 實作）"
affects_files:
  - scripts/build-server-bundle.mjs
  - scripts/verify-helper-bundle.js
  - scripts/_bat-logger.mjs
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - electron/handlers/pty.ts
  - scripts/__tests__/
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 遠端 PTY env **只**注入範圍權杖（`BAT_REMOTE_TOKEN=<capability>`）與 `BAT_REMOTE_PORT` / `BAT_SERVER_CERT_PATH` / `BAT_HELPER_DIR` / log 目錄覆寫；**server token 絕不進 env**——加 unit test 斷言 env 中不含 server token 值。`isHeadlessScrubbedEnvKey` 的規則不變（scrub 繼承的 `BAT_*`，再由 helperEnv 顯式注入）。"
  - "🔴 helper `.mjs` 修改需相容本機（本機 BAT 同一份 helper）：本機行為不變，以既有 helper 測試鎖住。`_bat-logger.mjs` 的 log 目錄在遠端改由 env 覆寫，不得寫到不存在或無權限的路徑。"
  - "🔴 bundle：`verify-helper-bundle.js` 擴充後，`npm run verify:helpers` 必須綠；只能用 Windows 可跑的方式驗證 build 腳本（T0391 備註：Windows 上 schema-only `build-server-bundle` 停在 `pruneAnthropicPackages` 是既有狀況，不要修，回報區註明你如何驗證複製步驟）。"
  - "🔴 **塔台 06:08 追加（T0431 遭遇問題 4）**：headless `terminal:create-agent-command` 指定 codex（或其他 server bundle 未附帶、且遠端偵測不到的 agent）時，回傳明確錯誤（結構化 code，renderer 顯示 i18n 提示），而不是組出 `codex …` 打進 shell 得到 command not found。判斷依據沿用 PLAN-037 遠端工具偵測（`remote-tools:detect` 的結果或同等 server 端檢查），不要新寫偵測。"
  - "🔴 依賴 T0432。開工前 `git log --oneline -8` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit` + `npm run verify:helpers`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0433 — helper 出貨 + PTY env 注入（K 工單 3）

## 範圍

依 T0420「各單內容」工單 3：
1. `build-server-bundle.mjs` 把 `bat-terminal.mjs`、`bat-notify.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs` 複製到 `<installRoot>/scripts/`；`verify-helper-bundle.js` 擴充檢查
2. `createHeadlessPtyModule` 傳 `helperDir` 與 headless 專用 `helperEnv(id, customEnv)`：向 T0432 registry 簽發該 PTY 的權杖並注入
3. 測試：env 不含 server token；PTY exit 後權杖撤銷（與 T0432 hook 串接）；bundle 檢查涵蓋新檔

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40；`npm run verify:helpers` 綠
- [ ] 回報區附遠端分頁內補驗指令：`env | grep ^BAT_ | cut -d= -f1`（只列 key）

## Sub-session 執行指示
1. 讀本工單 + T0420 回報區 + T0432 回報區 + CLAUDE.md「Packaging / Release 前置檢查」
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 `affects_files` 皆存在或有既存祖先（present）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 依賴確認：開工時 `git log --oneline -8` 含 `aec20c0`（T0432）、`89acad3`（T0445 安全 review / T0432 verified）
- 驗收條件：
  - [x] `npm run test:unit`：**144 files / 2301 passed / 1 skipped / 0 failed**
  - [x] `npx tsc --noEmit` = **39**（≤ 40；本單檔案 0 筆）
  - [x] `npm run verify:helpers`：`OK — all 15 helper .mjs files in extraResources are reachable via filter; server bundle ships 4 helper(s) with a closed import set`
  - [x] 遠端分頁補驗指令（只列 key）：`env | grep ^BAT_ | cut -d= -f1`。預期（新版 bundle 部署後）恰為：`BAT_HELPER_DIR`、`BAT_HELPER_LOG_DIR`、`BAT_REMOTE_PORT`、`BAT_REMOTE_TOKEN`、`BAT_SERVER_CERT_PATH`、`BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_WORKSPACE_ID`（Worker 分頁另有 `BAT_TOWER_TERMINAL_ID`）。此集合已由 `headless-helper-env.test.ts` 在真 PTY 內斷言

### 產出摘要

**1. Bundle 出貨（`scripts/build-server-bundle.mjs`）**
- 新增 `serverBundleHelperScripts = ['bat-terminal.mjs', 'bat-notify.mjs', '_bat-cert.mjs', '_bat-logger.mjs']` 與 `copyHelperScripts()`（在 `copyServerSources()` 尾端呼叫）→ `<installRoot>/scripts/`（= tarball 的 `staging/scripts/`）。缺檔即 throw，不靜默略過（BUG-058 / BUG-094 教訓）
- **複製步驟的驗證方式**（Windows 上 schema-only build 停在 `pruneAnthropicPackages` 為既有狀況，未修）：`scripts/__tests__/server-bundle-helpers.test.mjs` 從 build script 原始碼解析出清單，把**恰好這些檔**複製到隔離的 `<tmp>/scripts/`（+ `<tmp>/package.json`，即 staging 版型），再從那裡執行 `node bat-terminal.mjs --version` / `node bat-notify.mjs --version`（ESM 會在執行前解析所有靜態 import）→ 兩者 exit 0、版本取自 staging 的 `package.json`；負向對照：少 `_bat-cert.mjs` → `ERR_MODULE_NOT_FOUND`。另斷言 `copyServerSources()` 內確實 `await copyHelperScripts()`、目的地為 `path.join(stagingRoot, 'scripts')`

**2. `scripts/verify-helper-bundle.js`**：新增 T0433 檢查（原始碼解析，與既有 T0388 / T0391 parser 同法）——清單存在且含 `bat-terminal.mjs` + `bat-notify.mjs`、每個檔存在於 `scripts/`、清單對靜態相對 `.mjs` import **封閉**、build 仍呼叫 `copyHelperScripts()`。失敗訊息指出漏哪個檔。fixture 負向測試 4 種皆 exit 1 且訊息正確

**3. `scripts/_bat-logger.mjs`**：`BAT_HELPER_LOG_DIR` 為**絕對路徑**時 log 寫到 `$BAT_HELPER_LOG_DIR/bat-scripts.log`；未設或相對路徑 → 原 userData 路徑（本機行為不變，測試鎖住）。headless 設為 `<dataDir>/Logs`（dataDir 必存在、server 可寫）

**4. headless PTY env 注入**
- `electron/pty-manager.ts`：`PtyManagerDeps.helperEnv?(id, customEnv)`——三條 spawn 路徑都在 env **最後**展開（`customEnv` / 繼承 env 都蓋不掉）；只在**真的 spawn** 時呼叫一次（冪等 re-create 不呼叫——否則重簽會撤銷執行中 shell 手上的權杖）；host 拋錯 → 照常建 PTY、不帶 helper env；整個 spawn 失敗 → `onPtyExit(id)` 撤銷已簽發者。Electron 不傳 ⇒ 行為不變（`getRemoteServerInfo` 路徑未動）
- `electron/remote/headless-entry.ts`：
  - `buildHeadlessHelperEnv()`：向 T0432 registry `issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID })`，回傳 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（**= 權杖**）/ `BAT_SERVER_CERT_PATH`（`<dataDir>/server-cert.json`）/ `BAT_HELPER_DIR`（`<installRoot>/scripts`）/ `BAT_HELPER_LOG_DIR`（`<dataDir>/Logs`）。server token 不是輸入，不可能進 env。以下情況**不簽發、回 `{}`**：server 尚未 listen、無 helperDir、helperDir 內缺 `bat-terminal.mjs` / `bat-notify.mjs`（T0433 前的舊 bundle）、registry 拒絕的 id ⇒ 回到 T0433 前狀態（skill 既有降級鏈）
  - `createHeadlessPtyModule({ helperDir, helperEndpoint })`；`BAT_HELPER_DIR` 只來自 bundle，不取 `host.helperDir`。`createHeadlessServer` 以 `remoteServer.port` 提供 endpoint
  - `isHeadlessScrubbedEnvKey` **規則不變**（只更新註解）；繼承的 `BAT_*` 仍全丟，helper env 於 scrub 之後由 PtyManager 注入
- PTY exit / kill 撤銷：沿用 T0432 hook（測試以「env 裡的那顆權杖」驗證 kill 後 `verify` → null）

**5. 塔台 06:08 追加：headless 指定 codex（或其他未附帶且偵測不到的 agent）回結構化錯誤**
- `electron/terminal-command-handlers.ts`：`AGENT_UNAVAILABLE` / `AGENT_CHECK_PENDING` 常數與 `AgentUnavailableResult { ok:false, code, agentId, tool?, status?, error }`；`TerminalCommandHandlerDeps.checkAgentAvailable?`——`create-agent-command` 解析出 agentId 後檢查，拒絕時**不建 PTY**、原樣回傳結果、mirror `ipc-result reason=<code>`。Electron 不傳 ⇒ 不檢查（行為不變）。`electron/handlers/terminal.ts` 透傳
- headless 判斷**沿用 PLAN-037 `remote-tools:detect`**（未新寫偵測）：`HeadlessRemoteToolsCache` 讓 `remote-tools:detect` handler 與檢查共用同一份結果與 in-flight probe；`HEADLESS_AGENT_TOOLS = { 'codex-cli': 'codex' }`；status `ok` / `error` 視為可跑，`missing` / `not-on-path` / `interop-only` → `AGENT_UNAVAILABLE`。快取：可跑結果 10 min、不可跑 30 s（剛裝好 codex 30 秒後即放行）。無新鮮快取時跑一次偵測、最多等 2 s（bat-terminal invoke timeout 為 3 s）：逾時且有舊結果 → 用舊結果；無任何結果 → `AGENT_CHECK_PENDING`（附「稍後重試」，偵測在背景繼續並填快取）。偵測失敗（Windows host / probe 例外）或偵測無條目的 agent → 不判斷（照舊啟動）
- `scripts/bat-terminal.mjs`：invoke 結果為 `{ ok: false }` 物件時印 `Error: Failed to create terminal (<code>): <error>`、exit 1、log `terminal-create-refused`（不印權杖）。本機 BAT 回 boolean，路徑不變

**6. 測試**（新增 4 檔、改 1 檔）

| 檔案 | 內容 | 結果 |
|---|---|---|
| `electron/remote/__tests__/headless-helper-env.test.ts` | unit：`buildHeadlessHelperEnv` key 集合、tower / worker 綁定、5 種不簽發情境（registry 保持空）。wire（真 headless + 真 node-pty）：PTY 內 node 把**真實 env** 寫檔 → BAT key 集合精確、**無任何值含 server token**、繼承的 `BAT_REMOTE_TOKEN` 已 scrub、權杖可 verify 為 tower；**真 `bat-terminal.mjs` 用該 env** 建 worker（BAT client 收到 `created-externally`）→ worker env 的權杖為綁該 tower 的 worker；**真 `bat-notify.mjs`** 用 worker env 通知成功；kill → 該權杖撤銷；codex 未偵測到 → bat-terminal exit 1 + `AGENT_UNAVAILABLE`、無分頁建立；helper log 落在 `<dataDir>/Logs` 且不含權杖 / server token | 8/8 |
| `electron/remote/__tests__/headless-agent-availability.test.ts` | 3 種不可跑 status 拒絕、2 種可跑放行、claude / gemini / copilot / 自訂不判斷且不跑 probe、偵測失敗不判斷、TTL 10 min / 30 s、共用 `remote-tools:detect` 結果、慢 probe → PENDING 後填快取、慢 probe 用舊結果、probe 例外不判斷、並行共用一次 probe；handler：拒絕不建 PTY 並原樣回傳、null / 無檢查照常建立 | 15/15 |
| `electron/__tests__/pty-manager-helper-env.test.ts` | 最後展開蓋過 customEnv / 繼承；冪等 re-create 不重簽；host 拋錯照建；Electron 路徑不變；spawn 全失敗 → `onPtyExit` | 5/5 |
| `scripts/__tests__/server-bundle-helpers.test.mjs` | 複製步驟隔離執行 + 負向對照；verify 正向（真 build script）+ 4 種負向；logger 覆寫 / 未設 / 相對路徑 | 11/11 |
| `electron/remote/__tests__/headless-pty.test.ts`（改） | T0390 原斷言「headless PTY 無 `BAT_REMOTE_*` / `BAT_HELPER_DIR`」依本單規格更新為：存在且為本 server 的值（port = harness port、非繼承的 9876 / `/inherited/helper/dir`）；token / 繼承值 / `BAT_TOWER_TERMINAL_ID` 斷言保留 | 12/12 |

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PASS | 144 files / 2301 passed / 1 skipped |
| `npx tsc --noEmit` | PASS | 39（本單 0） |
| `npm run verify:helpers` | PASS | 見上 |
| 真 helper 子行程 × 真 headless（in-process） | PASS | `headless-helper-env.test.ts` |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| WSL 部署 / 實機遠端分頁 | 未做 | 依工單不部署；補驗指令見上，端到端屬 T0434 |

**變更檔案**：`scripts/build-server-bundle.mjs`、`scripts/verify-helper-bundle.js`、`scripts/_bat-logger.mjs`、`scripts/bat-terminal.mjs`、`electron/pty-manager.ts`、`electron/remote/headless-entry.ts`、`electron/terminal-command-handlers.ts`、`electron/handlers/terminal.ts`、`electron/remote/__tests__/headless-pty.test.ts`、上表 4 個新測試檔、本工單。`electron/handlers/pty.ts` 未改（注入點在 PtyManager deps）。

### 遭遇問題

1. **範圍外檔案（因塔台 06:08 追加與規格行為變更）**：`electron/terminal-command-handlers.ts`、`electron/handlers/terminal.ts`、`scripts/bat-terminal.mjs`（codex 結構化錯誤需經 handler 回傳、helper 才能印出）；`electron/remote/__tests__/headless-pty.test.ts`（T0390 斷言與本單規格直接衝突，已依規格更新）；`electron/__tests__/pty-manager-helper-env.test.ts`（沿用 T0432 放 PtyManager 測試的位置）。皆為最小必要
2. **與追加指示的偏離：未做 renderer i18n 提示**。`terminal:create-agent-command` 在 renderer 端**沒有呼叫者**（`grep` src 無結果；唯一呼叫者是 Tower PTY 內的 `bat-terminal.mjs`），結構化錯誤因此由 bat-terminal 印在 Tower 分頁（使用者在 xterm 看得到、Tower agent 也讀得到 exit 1 + code），而非 renderer toast。若要 toast，需新增事件（如 `terminal:agent-unavailable`）+ `PROXIED_EVENTS` + preload / `electron.d.ts` / `App.tsx` + 三語 locale——後四檔目前正被其他 Worker 修改中，未併入。**建議塔台裁決是否另開小單**
3. **未判斷的 agent**：`gemini-cli` / `copilot-cli` / 自訂 CLI 不在 PLAN-037 偵測清單內，依「不要新寫偵測」維持照常啟動（遠端視窗 UI 也未禁用它們）。若要擋，需先擴充 probe（PLAN-037 範圍）
4. **⚠️ T0434 前置：`scripts/dev-deploy-headless.mjs` 只替換 esbuild 產物，不會部署 `scripts/` helper**。以 `deploy:headless:dev` 部署到 WSL 時，`<installRoot>/scripts/` 不存在 → 本單設計會**不注入** helper env（安全降級），遠端分頁看起來與 T0433 前相同。T0434 實機驗收需：完整 bundle 重裝，或擴充 dev-deploy 一併複製 `serverBundleHelperScripts`（建議併入 T0434 或另開小單）
5. **AGENT_CHECK_PENDING 的取捨**：偵測（login shell + 版本 / 登入檢查）可能超過 bat-terminal 的 3 s invoke timeout；冷快取時第一次派 codex 可能得到 PENDING，需幾秒後重派。選擇「明確要求重試」而非「盲目啟動得到 command not found」；開過遠端工具面板（`remote-tools:detect`）後快取即熱
6. **測試輸出曾印出臨時權杖**：`headless-pty.test.ts` 更新前的一次失敗輸出含 harness 的臨時權杖（tmp dataDir、server 已停止、registry 已清空），無實害

**Commit**：`git add` 新測試檔 + `git commit --only` 本單路徑（工作樹另有 T0436 / T0443 / T0444 / T0446 / T0447 等他單改動，未帶入）。未 push、未部署 WSL。hash 見 `git log`（回報區於 commit 前寫入，不自我引用）。

### 回報時間

2026-10-05T06:36:33+08:00
