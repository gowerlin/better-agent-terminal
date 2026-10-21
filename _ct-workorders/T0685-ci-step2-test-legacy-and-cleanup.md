---
schema_version: 1
schema_kind: workorder
id: T0685
title: "CI 第二步：新增 test:legacy（tests/ 底下 tsx／node:test，帶逾時）並加進 tests.yml；刪 5 個失效 script；更新 5 處指向已刪測試的註解；wsl-systemd 錯誤訊息改 describeError；ssh-start-server 的 start-failed 補測試；CLAUDE.md 補測試位置規則"
type: feature
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T21:11:56+0800"
started_at: "2026-10-21T21:13:00+0800"
updated_at: "2026-10-21T21:33:26+0800"
completed_at: "2026-10-21T21:33:26+0800"
depends_on:
  - "T0680／T0681／T0682／T0683（皆 DONE；`tests/` 底下的失敗與逾時已處理）"
related:
  - "D177 第 2 點（CI 第二步）；使用者 2026-10-21 追加：Worker 建議的兩個小改進併入本單"
  - "盤點與跑法：T0678 回報區「tests/ 盤點」（哪些是 tsx harness、哪些是 node:test、哪些略過）；T0682 回報區（`--test-timeout=60000`、npx 啟動偶發慢，建議用專案內的 tsx）"
  - "失效 script：T0679 回報區「失效 script」（`test:claude-ctrl-o`、`diagnose:ctrl-o`、`diagnose:ctrl-o:quick`、`diagnose:ctrl-o:verbose`、`test:file-drag`）"
  - "註解：`src/components/profiles/ProfileCard.tsx:58`、`src/components/profiles/types.ts:45`（T0680）；`electron/remote/ssh-start-server.ts:109`、`:395`、`electron/remote/ssh-bundle-uploader.ts:72`（T0681）"
  - "小改進：`electron/wsl-systemd.ts:244-246`（`enableLinger` 解析使用者失敗時用 `error.message`，改成與其他失敗路徑一致的描述函式）；`electron/remote/ssh-start-server.ts:557` 的 `start-failed` 分類（`isStartIssue`）目前沒有測試（T0681 建議）"
affects_files:
  - package.json
  - package-lock.json
  - scripts/run-legacy-tests.mjs
  - .github/workflows/tests.yml
  - src/components/profiles/ProfileCard.tsx
  - src/components/profiles/types.ts
  - electron/remote/ssh-start-server.ts
  - electron/remote/ssh-bundle-uploader.ts
  - electron/wsl-systemd.ts
  - electron/__tests__/wsl-systemd.test.ts
  - electron/__tests__/ssh-start-server.test.ts
  - CLAUDE.md
  - _ct-workorders/T0685-ci-step2-test-legacy-and-cleanup.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `test:legacy`：用 `scripts/run-legacy-tests.mjs` 執行 `tests/` 底下不在 vitest `test.include` 的測試。node:test 檔（`import … from 'node:test'`）一次用 `tsx --test --test-timeout=60000` 跑；自寫 harness 檔逐一用 `tsx <file>` 跑並看結束代碼。自動找檔（新加的檔也會被跑到），排除清單寫在腳本裡並註明原因：手動 probe（`_` 開頭）、互動式（`console-test.js`）、函式庫（`console-controller.js`）、Playwright（`tests/e2e/**`）、`__mocks__`／`__helpers__`／`testworkspace`。結束時印出每檔結果與總計，有任何失敗就以非 0 結束。用專案內的 `tsx`，不用 `npx`。"
  - "🔴 `tsx` 目前不是 devDependency（現有 script 用 `npx tsx`）。可以把 `tsx` 加成 devDependency（固定版本，`npm install -D`），讓 CI 的 `npm ci` 有確定的版本；它本身沒有 install script（依賴的 esbuild 已在 `allowScripts`）。不得新增其他相依。現有 `test:node-resolver`、`test:claude-code-path` 可改用專案內的 `tsx`（行為不變）。"
  - "🔴 `tests.yml`：在 unit tests 之後加一步 `npm run test:legacy`，並讓兩步的結果都會被印出（unit tests 失敗時 legacy 仍要跑，結果一起寫進 job summary）。觸發方式維持只有 `workflow_dispatch`；**不要**改 pre-release.yml／release.yml（擋版是另一張單）。用 actionlint 檢查（若可用）。"
  - "🔴 `package.json`：刪掉 5 個失效 script（見 related）；加 `test:legacy`。不改其他 script 的行為。"
  - "🔴 註解：只改 5 處註解的文字，指向現在守住同一個契約的 vitest 檔與測試名稱；`StatusDot` 拆分等程式結構不動。"
  - "🔴 `wsl-systemd.ts`：只把 `enableLinger` 解析使用者失敗那一段改成與同檔其他失敗路徑相同的錯誤描述方式（讓 stderr 出現在訊息裡），並在 `electron/__tests__/wsl-systemd.test.ts` 補一項斷言 stderr 會出現在錯誤裡。不改其他行為。"
  - "🔴 `ssh-start-server.ts` 的 `start-failed`：只補測試（`electron/__tests__/ssh-start-server.test.ts`），涵蓋會被分類成 `start-failed` 與不會的情境；產品程式不改。若發現分類本身有錯，停下來問塔台。"
  - "🔴 `CLAUDE.md`「Frontend unit tests」節：依現行 `vite.config.ts` 更正測試檔位置那一行（含 `electron/**` 等實際收進的路徑），補 `npm run test:legacy` 的用途，並加一句「新測試一律放 vitest 收得到的位置，不要再放進 `tests/`」（D177）。遵守該檔開頭的撰寫規則（每節精簡，細節不寫進本檔）。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數）、`npm run test:legacy` 在本機全過（記每檔結果）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm ci` 能從 lock 重建（改了 lock 時）。"
  - "🔴 同時可能有 T0684（Linux 上寫死 Windows 行為的測試改跨平台）的 Worker 在跑，它只動 `electron/__tests__/` 與 `scripts/__tests__/` 裡的特定測試檔：只動本單 `affects_files`；commit 用 `git commit --only <檔案>`，不要 `git add -A`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值或 secrets。"
---

# T0685 — CI 第二步：test:legacy 與收尾清理

## 目標

BUG-168 的測試修正已完成（T0680～T0683），`tests/` 底下的舊測試現在在 Windows 上都能跑過。本單把它們接上：新增 `npm run test:legacy`（帶逾時，缺 mock 不再卡住）並加進手動的 `tests.yml`；順便清掉失效的 script、更新指向已刪測試的註解，並做使用者同意併入的兩個小改進。把測試設成發版關卡是下一張單。

## 要做的事

1. `scripts/run-legacy-tests.mjs` + `package.json` 的 `test:legacy`（必要時加 `tsx` devDependency）。
2. `tests.yml` 加 legacy 步驟，兩步結果都寫進 job summary。
3. 刪 5 個失效 script。
4. 更新 5 處註解。
5. `wsl-systemd.ts` 錯誤描述 + 一項 vitest；`ssh-start-server` 的 `start-failed` 補測試。
6. `CLAUDE.md`「Frontend unit tests」節更新。
7. 驗證、commit（不 push）。

## 驗收

- `npm run test:legacy` 在本機全過，輸出每檔結果與總計；故意讓一個檔失敗時以非 0 結束（回報附實測）。
- `tests.yml` 兩步都會跑、結果都在 summary；actionlint 通過；未改 pre-release／release。
- 5 個失效 script 已刪；5 處註解指向現行的 vitest 測試。
- `test:unit` 全過；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

DONE。`npm run test:legacy` 在本機 33 檔 472 項全過；`tests.yml` 在 unit tests 之後跑 legacy，兩步結果都寫進 job summary；5 個失效 script 已刪、5 處註解改指向現行 vitest；`wsl-systemd` 錯誤描述 + 1 項測試；`ssh-start-server` 的 `start-failed` 分類補 11 項測試（產品程式未改，分類沒有發現錯誤，沒有問塔台）；`CLAUDE.md` 已更新。只改 `affects_files`；未 push；未改 pre-release.yml／release.yml。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`scripts/run-legacy-tests.mjs` 不存在但上層 `scripts/` 存在，其餘存在）；無 `branch` 欄位（C-2 不適用），HEAD 在 `main`。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。工單 `status` 原為 `TODO`（非 `PENDING`），照開工規則改成 `IN_PROGRESS`。

### 修改內容

1. **`scripts/run-legacy-tests.mjs`（新）+ `npm run test:legacy`**
   - 自動找 `tests/` 底下所有腳本檔（`.js/.mjs/.cjs/.ts/.mts/.cts/.tsx`），扣掉 vitest 已收的（直接讀 `vite.config.ts` 裡 `tests/…` 字串，用 `path.matchesGlob` 比對，與 `test.include` 同步）與 `EXCLUDED`（每項附原因）：`tests/e2e/**`（Playwright）、`__mocks__/**`、`__helpers__/**`、`testworkspace/**`、`tests/**/_*`（手動 probe）、`console-test.js`（互動式）、`console-controller.js`（函式庫）。結束時印「not run」清單與原因。
   - 分類：原始碼有 `from 'node:test'`（或 `require('node:test')`）→ 一次 `tsx --test --test-timeout=60000 <全部 node:test 檔>`；其餘 → 逐檔 `tsx <file>`，以結束代碼判定，另從輸出抓 `N passed, M failed` 顯示。
   - 逾時：node:test 每項 60 s（`--test-timeout`），整個 node:test run 15 min、每個 harness 檔 180 s（程序層級；逾時以 `taskkill /F /T`（Windows）／`SIGKILL` 結束整個程序樹）。
   - 每檔結果：同一檔同時當 node:test 的自訂 reporter（default export），輸出每檔通過／失敗／略過／取消數與失敗項目，不解析 spec 文字。結束印每檔 PASS/FAIL 與總計；任一檔失敗（或 0 檔）exit 1。`--json <file>` 另寫 JSON（給 tests.yml summary）；可帶檔名只跑指定檔。
   - `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 未設定時自動指到 `os.tmpdir()` 下的新目錄（不寫真的 userData）。
   - 用專案內的 `tsx`（`process.execPath` + `node_modules/tsx` 的 bin），不經 `npx`。
2. **`tsx` devDependency**：`npm install -D --save-exact tsx@4.23.15`（`"tsx": "4.23.15"`，2026-09-20 發佈）。依賴只有 `esbuild ~0.28.0`（巢狀 `node_modules/tsx/node_modules/esbuild` 0.28.2 + 26 個 `@esbuild/*` 平台套件）與 optional `fsevents`；esbuild 已在 `allowScripts`，tsx 本身無 install script。沒有新增其他相依。
   - lock：npm 12.2.0 的 `npm install` 另外把 21 個既有套件（`@babel/core`、`react`、`vite`、`typescript` 等）的 `"peer": true` 刪掉（npm 版本差異造成的 metadata 變動，與 tsx 無關）。為了不讓 lock 在 npm 11（CI）／12 之間來回變動，我以 HEAD 的 lock 為底、只加入 npm 產生的 `node_modules/tsx/**` 項目與根 `devDependencies.tsx`（保留 npm 的 key 順序）。最終 diff 為純新增 519 行，無刪除。
   - `test:node-resolver`、`test:claude-code-path` 改成 `tsx …`（原 `npx tsx …`，行為不變）。
3. **`.github/workflows/tests.yml`**：unit tests 步驟加 `id: unit`；新增「Legacy tests (tests/, outside vitest)」步驟（`id: legacy`、`if: ${{ !cancelled() }}`，所以 unit tests 失敗仍會跑；同樣的 `BAT_HELPER_LOG_DIR`／`BAT_USER_DATA`；`npm run test:legacy -- --json "$RUNNER_TEMP/legacy-results.json"`）；Summary 步驟（`if: always()`）同時讀兩個結果檔，每段標題帶步驟 outcome，legacy 失敗時列出失敗的檔案與項目，結果檔不存在時寫「the test step did not finish」。觸發仍只有 `workflow_dispatch`；pre-release.yml／release.yml 未動。
4. **`package.json` 刪 5 個失效 script**：`test:claude-ctrl-o`、`diagnose:ctrl-o`、`diagnose:ctrl-o:quick`、`diagnose:ctrl-o:verbose`、`test:file-drag`（指向的 `tests/test-claude-ctrl-o.js`、`tests/diagnose-ctrl-o.js`、`tests/file-drag-to-chat.test.ts` 都不存在；全 repo（`_ct-workorders/` 以外）沒有其他引用）。加 `test:legacy`。其他 script 行為不變。
5. **5 處註解**（只改文字）：
   - `src/components/profiles/ProfileCard.tsx` StatusDot 註解：說明是為舊 `tests/profile-card.test.ts` 而拆，現由 `src/components/profiles/__tests__/ProfileCard.test.tsx` 的「status light: idle / connected from isRunning, an explicit status and title win (T0513)」守住。`StatusDot` 拆分未動。
   - `src/components/profiles/types.ts` `selectDetailsVariant`：→ `ProfileCard.test.tsx`（describe `selectDetailsVariant`）。
   - `electron/remote/ssh-start-server.ts` `escapeSingleQuotes`：`/forbidden newline/` → `electron/__tests__/ssh-start-server.test.ts`「escapeSingleQuotes escapes apostrophes and rejects newline / control chars (T0296 EC-002)」。
   - `electron/remote/ssh-start-server.ts` `buildSshConnectArgs`：舊 test7 其實沒有測 `@` 這條（test7 只測 escapeSingleQuotes 與 installPath 引號）；改寫成「`@` 檢查沒有自己的測試；validateSshIdentifier 的規則由 … 『an sshHost starting with - is rejected before any ssh exec (T0296 F-004)』守住」，如實寫明缺口（見後續建議 1）。
   - `electron/remote/ssh-bundle-uploader.ts` `buildSshArgs`：→ `electron/remote/__tests__/ssh-bundle-uploader.test.ts`「rejects a single quote in installPath before spawning ssh」（訊息 `/installPath contains forbidden character/`）。
6. **`electron/wsl-systemd.ts` `enableLinger`**：解析使用者失敗時改用同檔的 `describeError(error)`（原 `error instanceof Error ? error.message : String(error)`）。測試 `electron/__tests__/wsl-systemd.test.ts`「puts the stderr of a failed user lookup into the error, like the other failure paths (T0685)」：`id -un` exit 1 + stderr → `error` 為 `Command failed: id -un: id: cannot find name for user ID 1000`，且沒有跑 loginctl。反向實測：暫時改回舊寫法，此項失敗（Received `"Command failed: id -un"`），改回後通過。
7. **`ssh-start-server` 的 `start-failed`**：`electron/__tests__/ssh-start-server.test.ts` 新增 describe「stage 2 classification: start-failed vs enable-failed (T0685)」（放在 T0681 的 describe 內以共用 `scriptedSpawn`）：
   - start-failed ×5：systemd `Job for … failed`、`Main process exited`、`Active: failed`、`ExecStart=` 問題、launchd 的 `crashed`；斷言 `errorCode: 'start-failed'`、錯誤含 stderr、只有 2 次 ssh exec（不跑 verify）。
   - enable-failed ×6：unit 檔不存在（`Failed to enable unit`）、linger 權限、沒有 user bus、`launchctl` `Load failed`、空 stderr、標記只出現在 stdout（只看 stderr）。
   - 分類判讀：regex 與程式內註解描述的設計一致（systemd 的 `Job for` / `exited with` / `ExecStart` 等 → start；一般 `Failed to …` → enable），沒有發現錯誤，所以沒有停下來問塔台。
8. **`CLAUDE.md`「Frontend unit tests」節**：測試檔位置改依 `vite.config.ts` `test.include`（含 `electron/__tests__`、`electron/remote/__tests__`、`electron/remote-tools/__tests__`、`scripts/__tests__`、`tests/` 的 5 個 `bat-*.test.mjs`）；加 🔴「新測試一律放 vitest 收得到的位置，不要再放進 `tests/`（D177）」；加 `npm run test:legacy` 一行（用途、跑法、`EXCLUDED`、tests.yml）。該節由 5 條變 7 條，未加 docs 細節。

### 驗證結果

Node v24.22.0、npm 12.2.0、Windows。`BAT_HELPER_LOG_DIR`／`BAT_USER_DATA` 指到 scratchpad。驗證時間 2026-10-21T21:28:41+0800 – 21:30:59+0800。

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | ✅ exit 0：Test Files 326 passed (326)；Tests 5763 passed、3 skipped (5766) |
| `npm run test:legacy` | ✅ exit 0：files 33 passed, 0 failed / 33 total；tests 472 passed, 0 failed（每檔見下表），wall 約 8 s |
| `npm run typecheck` | ✅ exit 0（0 錯誤） |
| `npm run typecheck:electron` | ✅ exit 0（0 錯誤） |
| `npx vite build` | ✅ exit 0 |
| `npm ci` 從 lock 重建 | ✅ 把 `package.json` + `package-lock.json` 複製到 scratchpad 的空目錄跑 `npm ci --ignore-scripts`（與 CI 相同）：exit 0，added 856 packages（26 s），tsx 4.23.15 / 巢狀 esbuild 0.28.2，lock 未被改動。沒有在主目錄跑（避免刪掉主目錄 node_modules，影響可能同時在跑的 T0684 Worker）。 |
| actionlint | ✅ `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7`（本機沒有 actionlint，用 Go 1.27.3 臨時編譯、未安裝到系統）：新 `tests.yml` 與整個 `.github/workflows/` 都是 exit 0、無訊息。本機沒有 shellcheck，所以 `run:` 內的 shell 沒有被 shellcheck 檢查。 |
| Summary 步驟腳本 | ✅ 從 `tests.yml` 抽出 `node -e` 內容，以真實的 vitest JSON + 一份含失敗的 legacy JSON 執行：產出「### Unit tests (success)」與「### Legacy tests (failure)」兩段，失敗檔列出 `tests/zz-t0685-demo-fail.test.ts (node:test): demo fails on purpose: …`；兩個結果檔都不存在時印「no … results (the test step did not finish)」，exit 0。 |
| `scripts/__tests__`（vitest） | ✅ 17 檔 402 項（最後一次修改 runner 後重跑） |

`test:legacy` 每檔結果（最後一輪）：

| 檔案 | 跑法 | 結果 |
|---|---|---|
| `tests/backlog-priority-parser.test.ts` | harness | 8 / 0 |
| `tests/claude-code-path.test.ts` | harness | 4 / 0 |
| `tests/claude-resolver.test.ts` | harness | 20 / 0 |
| `tests/docker-flow-journeys.test.ts` | node:test | 3 / 0 |
| `tests/docker-path.test.ts` | harness | 42 / 0 |
| `tests/docker-wizard-e2e.test.ts` | node:test | 5 / 0 |
| `tests/docker-wizard-runner.test.ts` | node:test | 5 / 0 |
| `tests/gpu-detector.test.ts` | harness | 13 / 0 |
| `tests/node-resolver.test.ts` | harness | 19 / 0 |
| `tests/path-aware-channels.test.ts` | node:test | 9 / 0 |
| `tests/path-guard.test.ts` | harness | 12 / 0 |
| `tests/path-translator.contract.test.ts` | harness | 136 / 0 |
| `tests/plan-007-cross-env-smoke.test.ts` | harness | 16 / 0 |
| `tests/profile-manager-migration.test.ts` | harness | 13 / 0 |
| `tests/profile-schema-migration.test.ts` | harness | 18 / 0 |
| `tests/remote-client-middleware.test.ts` | harness | 21 / 0 |
| `tests/remote-throttle.test.ts` | harness | 15 / 0 |
| `tests/shell-path-resolver.test.ts` | harness | 7 / 0 |
| `tests/ssh-args.test.ts` | node:test | 15 / 0 |
| `tests/ssh-auth-probe.test.ts` | node:test | 10 / 0 |
| `tests/ssh-config-parser.test.ts` | node:test | 8 / 0 |
| `tests/ssh-flow-journeys.test.ts` | node:test | 3 / 0 |
| `tests/ssh-flow.test.ts` | node:test | 5 / 0 |
| `tests/ssh-process-lifecycle.test.ts` | node:test | 6 / 0 |
| `tests/ssh-tunnel.test.ts` | node:test | 11 / 0 |
| `tests/ssh-wizard-e2e.test.ts` | node:test | 5 / 0 |
| `tests/terminal-create-agent-command.integration.test.ts` | harness | exit 0（無計數輸出） |
| `tests/wizard-rollback-cross.test.ts` | node:test | 3 / 0 |
| `tests/wizard-rollback.test.ts` | node:test | 6 / 0 |
| `tests/wizard-runner.test.ts` | node:test | 5 / 0 |
| `tests/wsl-flow-journeys.test.ts` | node:test | 3 / 0 |
| `tests/wsl-path.test.ts` | node:test | 21 / 0 |
| `tests/wsl-wizard-e2e.test.ts` | node:test | 5 / 0 |

不跑（11）：`__helpers__/wizard-harness.ts`、`__mocks__/electron-api.ts`、`_windows-probe.ts`、`console-controller.js`、`console-test.js`、`e2e/bug075-bat-auto-session.test.ts`、5 個 vitest 已收的 `bat-*.test.mjs`。T0678 時的 41 檔現在是 33 檔：T0680／T0681 已把其餘的搬進 vitest 或刪掉。

**故意失敗的實測**（暫時放在 `tests/` 的 `zz-t0685-demo-*.test.ts`，未追蹤、跑完即刪，`ls tests | grep zz` 為空）：

| 情境 | 結果 |
|---|---|
| 完整 `npm run test:legacy` 加 1 個 assert 失敗的 node:test 檔 | exit **1**；`FAIL node:test tests/zz-t0685-demo-fail.test.ts 0 passed, 1 failed`、`✖ demo fails on purpose: Expected values to be strictly equal:`；總計 `files 33 passed, 1 failed / 34 total; tests 472 passed, 1 failed` |
| node:test 檔頂層 throw | FAIL，`0 passed, 1 failed`（node:test 把整檔記成一項失敗） |
| node:test 測試永遠不 resolve | 60.0 s 後 FAIL，`1 cancelled (timeout)`、`✖ demo hangs (testTimeoutFailure)` |
| harness 檔 `exit 1` | FAIL（`exit 1`），仍顯示它印出的 `1 passed, 1 failed` |
| harness 檔永遠不結束（`setInterval`） | 180.1 s 後 FAIL（`timed out after 180 s`）；事後查 `Win32_Process` 沒有殘留的 node 程序（`taskkill /T` 有收掉 tsx 的子程序） |

`validated_sha` 說明：上面的 test:unit／typecheck／build 跑在 commit 前的工作目錄；之後只再改了 `scripts/run-legacy-tests.mjs` 兩處（Windows 路徑比對改成不分大小寫的 `fileKey`、讀完結果檔後刪掉暫存目錄），改完重跑了 `test:legacy`（全過 + 故意失敗各一次）與 `scripts/__tests__`；這個檔不在兩個 tsconfig 與 vite build 內，不影響其他 gate。commit 內容 = 最後一輪 `test:legacy` 的內容。

### 給塔台的試跑指令

```bash
npm run test:legacy                                   # 全部；每檔結果 + 總計，有失敗 exit 1
npm run test:legacy -- tests/ssh-args.test.ts         # 只跑指定檔
npm run test:legacy -- --json /tmp/legacy.json        # 另寫 JSON（tests.yml 用）
npx vitest run electron/__tests__/wsl-systemd.test.ts electron/__tests__/ssh-start-server.test.ts
gh workflow run tests.yml -R gowerlin/better-agent-terminal --ref main   # 需先 push；ubuntu 試跑
```

### Commit

- `063c4efb`（`063c4efb6554ca71c29a20ed86ecb9ded29e298d`）`test(ci): T0685 BUG-168 test:legacy runs tests/ outside vitest, tests.yml runs it after unit tests`：12 檔，+903 / −26（`package.json`、`package-lock.json`、`scripts/run-legacy-tests.mjs`、`.github/workflows/tests.yml`、5 處註解所在的 4 個檔、`electron/wsl-systemd.ts`、2 個 vitest 檔、`CLAUDE.md`）。`git commit --only`（新檔先單獨 `git add`），index 全為 LF，`git diff --check` 無誤。
- 工單本身另一個 commit（收尾）。未 push。
- 去識別化：對本單改的檔案跑 `.private/` 對照表的檢查樣式與常見金鑰樣式，0 筆。

### 互動紀錄

無（yolo；沒有問塔台，執行期間沒有使用者輸入）。

### 遭遇問題

1. 無阻擋，沒有問塔台。
2. npm 12 的 `npm install` 會刪掉 lock 裡 21 個 `"peer": true`（見修改內容 2）；我只保留 tsx 相關的新增。日後若有人用 npm 12 跑 `npm install`，這些行可能再被刪；與本單無關，不影響 `npm ci`。
3. `tests.yml` 只在本機以 actionlint 與抽出的 summary 腳本驗證，**還沒在 ubuntu 上實跑**；`tests/` 的舊測試先前只在 Windows 驗過（T0678–T0682），Linux 上是否全過要等塔台觸發 workflow 才知道。
4. `scripts/*.mjs` 會被 `extraResources` 的 `*.mjs` filter 打進安裝檔的 `resources/scripts/`，所以 `run-legacy-tests.mjs` 也會被打包（與 `build-server-bundle.mjs`、`dev-deploy-headless.mjs` 等既有開發腳本相同）。檔名由工單指定，沒有改。它只 import `node:` 模組，不影響 `verify-helper-bundle`。
5. 時間戳依 R-G001 都由 `date` 取得。

### 後續建議（不在本單範圍）

1. `ssh-start-server.ts` `buildSshConnectArgs` 的 `@` 拒絕（`Invalid sshUser`）沒有任何測試，可補一項。
2. `start-failed` 時錯誤字串仍以 `enable-failed:` 開頭（`summariseFailure('enable-failed', …)`，`errorCode` 正確）；新測試沒有鎖這個前綴。若 UI 會顯示這段字串，可考慮依 `errorCode` 改前綴。

### 回報時間

2026-10-21T21:33:26+0800
