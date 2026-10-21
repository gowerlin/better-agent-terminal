---
schema_version: 1
schema_kind: workorder
id: T0682
title: "BUG-168 G4：精靈 journey／e2e 測試的共用 mock 補齊現行 IPC（Docker → WSL → SSH），並加防卡死，讓缺 mock 時直接失敗而不是逾時"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
started_at: "2026-10-21T20:55:07+0800"
updated_at: "2026-10-21T21:09:23+0800"
completed_at: "2026-10-21T21:09:23+0800"
depends_on:
  - "T0679（DONE `6fb40e70`：逾時分析表）"
  - "塔台排程：第 1 波 T0680、T0681、T0683 完成後才派工（D177）"
related:
  - "D177；BUG-168；T0679 回報區「逾時分析」表（每個檔卡住的步驟、缺的 IPC、引入的 commit）"
  - "共同機制：`src/components/setup-wizard/wizard-runner.ts` 可重試步驟失敗後 `await this.waitForRetryOrSkip()`（T0274 刻意設計）；共用 mock `tests/__mocks__/electron-api.ts` 最後更新於 T0383"
affects_files:
  - tests/__mocks__/electron-api.ts
  - tests/wizard-runner.test.ts
  - tests/wizard-rollback-cross.test.ts
  - tests/docker-flow-journeys.test.ts
  - tests/docker-wizard-e2e.test.ts
  - tests/docker-wizard-runner.test.ts
  - tests/wsl-flow-journeys.test.ts
  - tests/wsl-wizard-e2e.test.ts
  - tests/ssh-flow-journeys.test.ts
  - tests/ssh-wizard-e2e.test.ts
  - "tests/__helpers__/**（新檔，若需要共用 harness）"
  - _ct-workorders/T0682-bug168-g4-wizard-mocks-and-hang-guard.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試與 mock，不改產品程式。mock 的形狀要和現行 IPC 一致（以 `electron/preload.ts` 與 `src/types/` 的型別為準），不要為了讓測試過而回傳產品不會回傳的值。"
  - "🔴 依序做三段，每段做完先跑該段的檔案：① Docker（`docker.pickServerPort`，T0649）；② WSL（`wsl.resolveHome`、`update.getVersion`、`remote.serverBundle.*`、`wsl.pickServerPort`／`keepAlive`／`snapshotUnit`、`profile.listLocal`；NAT 警告要初始化 i18n；`serverInstallPath` 的斷言依 T0378 改成絕對路徑）；③ SSH（`update.getVersion`、`ssh.openVerifyTunnel`／`verifyTunnelStatus`／`closeVerifyTunnel`，tunnel mock 回傳測試內本機 HTTPS server 的 port）。SSH 段若太大做不完，回報 PARTIAL 並寫清楚剩下什麼。"
  - "🔴 防卡死：步驟失敗後不得無限等待。在共用 harness 讓 onProgress 看到失敗就 `runner.cancel()`（或等效做法），並在跑法上帶 `--test-timeout`；目標是以後缺 mock 會直接失敗並指出缺哪個 IPC。"
  - "🔴 `wizard-rollback-cross` 的 wsl-linux 那項（T0679 標 D）：用正確的 mock 重跑並判定；若結論是產品回歸，停下來問塔台，不要改產品。"
  - "🔴 這些測試不得真的連線遠端、啟動 WSL／Docker／SSH、寫入使用者家目錄。"
  - "🔴 驗證：九個檔各用 `npx tsx --test --test-timeout=60000 <file>` 跑過，記通過／失敗數與耗時；若改到 `tests/` 以外的檔案，必跑 `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`。"
  - "🔴 不改 `package.json`、`vite.config.ts`、CI（`test:legacy` 由後續工單新增）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：`git commit --only <檔案>`；不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0682 — BUG-168 G4：精靈測試 mock 補齊與防卡死

## 目標

`tests/` 底下 9 個精靈 journey／e2e 測試會逾時：共用 mock 少了後來工單新增的 IPC，步驟失敗後精靈停在「等使用者選重試／略過／取消」，測試沒有人按，所以卡住（T0679）。本單依 Docker → WSL → SSH 的順序補齊 mock、修正過時的斷言，並加上防卡死，讓之後缺 mock 時直接失敗。

## 要做的事

1. 讀 T0679 回報區「逾時分析」表。
2. 依序做 Docker、WSL、SSH 三段，每段做完跑該段的測試。
3. 加防卡死（共用 harness 失敗即取消、跑法帶 `--test-timeout`）。
4. 重跑並判定 `wizard-rollback-cross` 的 wsl-linux 那一項。
5. 驗證、commit（不 push）。

## 驗收

- 九個檔都在時限內結束；全部通過，或回報 PARTIAL 並列出剩下的項目與原因。
- 故意拿掉一個 IPC 時，測試會直接失敗並指出缺哪個 IPC（回報區附實測）。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

DONE。九個檔 37 項全部通過，每檔 0.9–1.4 s 結束（帶 `--test-timeout=60000`）。只改 `tests/`（共用 mock、9 個測試檔、新增 `tests/__helpers__/wizard-harness.ts`），沒有改產品程式、`package.json`、`vite.config.ts`、CI；未 push。`wizard-rollback-cross` 的 wsl-linux 那項判定為 (A) 測試過時，不是產品回歸，所以沒有問塔台。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 PASS（`affects_files` 前 5 項都存在）；無 `branch` 欄位（C-2 不適用），HEAD 在 `main`。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。工單 `status` 原為 `TODO`（非 `PENDING`），照開工規則改成 `IN_PROGRESS`。

跑法：Node v24.22.0；`npx tsx --test --test-timeout=60000 <file>`，`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 `%TEMP%`。沒有連線遠端、沒有啟動 WSL／Docker／SSH、沒有寫入使用者家目錄：精靈只經 mock IPC；唯一的真網路是 SSH 兩檔原本就有的測試內 `127.0.0.1` HTTPS server（見下方 fetchFingerprint）。

**做法**

1. 共用 mock `tests/__mocks__/electron-api.ts`（形狀照 `electron/preload.ts`）：
   - Docker：`docker.pickServerPort`（T0649；新容器回 override／前次／harness port，`container` 模式回 `reusedExistingPort: true`）。
   - WSL：`wsl.resolveHome`（預設 `/home/test`）、`wsl.pickServerPort` / `keepAlive` / `releaseKeepAlive` / `restoreBundle` / `discardPreviousBundle`、`wsl.installBundle` 回 `previous`（T0554，預設 `none`）、`wslSystemd.snapshotUnit`（預設「原本沒有 unit」：`content: null, active: false, enabled: false`）/ `restoreUnit` / `restartService`、`wslSystemd.writeUnit` 記錄 unit 內容。
   - 共用：`update.getVersion`、`remote.serverBundle.distribute`（回第一個 bundle entry、`source: 'cache'`）/ `onDistributeProgress`。`profile.listLocal` 原本就有。
   - SSH：`ssh.openVerifyTunnel`（local port 預設 = harness `serverPort`，SSH 測試設成測試內 HTTPS server 的 port）/ `closeVerifyTunnel` / `verifyTunnelStatus`（預設 `forwardingDenied: false`）/ `readServerIdentity`（預設回 handshake 讀到的同一個 fingerprint + token，即「remote server-cert.json 屬於連到的那台」）。
   - fetchFingerprint：`wsl.fetchFingerprint` 直接呼叫 main 的 `fetchTlsFingerprint`（`electron/tls-fingerprint.ts`，只 import `tls`），**只對 mock 自己發出的 tunnel local port 做 handshake**；其他 port（例如本機 BAT 可能在聽的 9876）一律回 `fingerprint-unreachable`，避免測試連到本機的 BAT。
   - 每個新 IPC 都有 `operationLog` 紀錄；新選項：`wslHome`、`wslInstallPrevious`、`wslUnitSnapshot`、`appVersion`、`bundleDistributeSource`、`sshVerifyTunnelLocalPort`、`sshForwardingDenied`、`sshServerIdentity`。
2. 防卡死 `tests/__helpers__/wizard-harness.ts` `createTestWizardRunner(steps, ctx, { onProgress?, expectFailure? })`：onProgress 看到 `retryable` 步驟 `Failed` 且測試沒宣告 `expectFailure` 就 `runner.cancel()`。失敗的 emit 發生在 `waitForRetryOrSkip()` 之前，`cancelRequested` 已為 true，runner 走「不可重試」路徑：rollback 後丟出**步驟自己的錯誤**（例如 `TypeError: window.electronAPI.docker.pickServerPort is not a function`），而不是 `Wizard cancelled`。同檔 `import '../../src/i18n'`（與 renderer 同一份初始化），NAT 等警告不再是 `undefined`。
3. 9 檔的精靈 run 都改用 `createTestWizardRunner`。例外：`wizard-runner.test.ts` 第 1、4、5 項測 runner 自身語意（不可重試的合成步驟、同一 instance 重跑），保留 `new WizardRunner`：步驟 `retryable: false` 不會等待，且 harness 的 cancel 會讓第二次 `run()` 直接 `Wizard cancelled`，不適用。
4. 過時斷言（都對照產品現行行為與當時工單）：
   - `wizard-runner.test.ts` 第 2、3 項：刪掉兩份內嵌 mock 改用共用 mock；`serverInstallPath` 依 T0378 改成 `/home/test/.local/bat-server`，另斷言 `wslHome` 與 unit 的 `ExecStart`；`createdProfileId` 隨共用 mock 的 slug 改成 `ubuntu-dev`（原內嵌 mock 寫死 `wsl-ubuntu`）。
   - `wsl-flow-journeys` Journey 2：原斷言 `'mirrored mode'`；T0383 起 NAT 只是說明（localhostForwarding），改成斷言 `wizard.wsl.warning.networkNat` 的文字。
   - `wsl-wizard-e2e` NAT 那項：原斷言含 `'connect-test'` 的警告；T0383 起 `connectFailedNat` 只在 connect-test 失敗時加，這裡連線成功，改成斷言它**不存在**（`NAT networking` 那條保留）。
   - `wizard-rollback-cross` wsl-linux：`uninstallBundle` 的安裝路徑依 T0378 改成 `/home/test/.local/bat-server`（見判定節）。
   - `ssh-wizard-e2e` AC2.1：原期望 `/fingerprint` HTTP 回應 `FP:11:22:33:44`；T0381 起 fingerprint 取自 TLS handshake（bat-server 沒有 HTTP handler），改成測試 server 憑證的 `X509Certificate.fingerprint256`，另斷言 tunnel 的 remotePort、fingerprint 經 `127.0.0.1:<tunnel>`、connect-test 打 `127.0.0.1`、tunnel 有關、`readServerIdentity` 呼叫一次。兩個 SSH 檔的 `/fingerprint` 路由刪掉（不再有人打）。
   - `ssh-flow-journeys` Journey B：原本自己掛 onProgress 按重試，改用 harness 的 `onProgress` + `expectFailure`（只放行第一次 probe 失敗；第二次再失敗會 fail-fast，不會卡）。`ssh-wizard-e2e` AC2.4 原本自己 cancel，改由 harness 做。

### 各段結果（檔案、通過／失敗、耗時）

最終一輪（commit `5bd04ef4` 的內容，每檔各自 `npx tsx --test --test-timeout=60000 <file>`；wall 含 npx + tsx 啟動）：

| 段 | 檔案 | 通過／失敗 | node:test `duration_ms` | wall |
|---|---|---|---|---|
| ① Docker | `tests/docker-flow-journeys.test.ts` | 3 / 0 | 653 | 1.4 s |
| ① Docker | `tests/docker-wizard-e2e.test.ts` | 5 / 0 | 148 | 0.9 s |
| ① Docker | `tests/docker-wizard-runner.test.ts` | 5 / 0 | 147 | 0.9 s |
| ② WSL | `tests/wizard-runner.test.ts` | 5 / 0 | 146 | 0.9 s |
| ② WSL | `tests/wsl-flow-journeys.test.ts` | 3 / 0 | 149 | 0.9 s |
| ② WSL | `tests/wsl-wizard-e2e.test.ts` | 5 / 0 | 148 | 0.9 s |
| ②③ 跨三種 | `tests/wizard-rollback-cross.test.ts` | 3 / 0 | 156 | 0.9 s |
| ③ SSH | `tests/ssh-flow-journeys.test.ts` | 3 / 0 | 279 | 1.0 s |
| ③ SSH | `tests/ssh-wizard-e2e.test.ts` | 5 / 0 | 255 | 1.0 s |

合計 37 / 0，`cancelled` 全部 0。各段當下的過程：

- ① Docker：只補 `pickServerPort` + 換 harness 即 3/3、5/5、5/5（與 T0679 推估一致）。
- ② WSL：補完 mock + i18n 後，`wsl-flow-journeys` 2/3、`wsl-wizard-e2e` 4/5，剩的都是 NAT 斷言（上面第 4 點）；改後 3/3、5/5。`wizard-runner.test.ts` 改前跑一次是 3 過 + 2 項 `cancelled`，各卡滿 60,010 ms（`--test-timeout` 生效的對照），改後 5/5。
- ③ SSH：補 tunnel / identity / fetchFingerprint 後 `ssh-flow-journeys` 3/3、`ssh-wizard-e2e` 4/5（AC2.1 fingerprint 期望值過時），改後 5/5。`wizard-rollback-cross` 的 ssh-linux 項只要 `update.getVersion` + `serverBundle` 就過。
- 輸出掃描：9 檔輸出裡沒有 `is not a function`、`undefined`、`Could not …`、`fingerprint only` 等降級路徑訊息；唯一的 `cancelling` 是 AC2.4 依劇本的 start-server 失敗。

型別：這些檔不在任何 tsconfig 的 include（`npm run typecheck` 只含 `src/`），另用暫時的 tsconfig（extends 根 tsconfig、只 include 這 11 個檔，跑完即刪）檢查：13 個錯誤全是既有寫法（`delete globalThis.window` 的 TS2790 ×9、`selfsigned` 的 `days` ×2、`installMockWindow` 的 `unknown` ×1、`docker-flow-journeys.test.ts:70` 未動的 `profileDraft` 索引 ×1），本單新增的程式沒有型別錯誤。沒有改 `tests/` 以外的檔，所以依工單不需跑 `test:unit` / `typecheck` / `typecheck:electron` / `vite build`（沒有跑）。

### 防卡死實測

Scratchpad 測試（不在 repo）以共用 mock + harness，從 mock 刪掉一個 IPC 再跑完整精靈，`npx tsx --test --test-timeout=60000`：

| 拿掉的 IPC | 跑法 | 結果 | 耗時 |
|---|---|---|---|
| `docker.pickServerPort` | `createTestWizardRunner` | ✖ 直接 reject：`TypeError: window.electronAPI.docker.pickServerPort is not a function`；log `[docker-wizard] [test] step start-server failed, cancelling: …` | 2 ms |
| `wsl.resolveHome` | `createTestWizardRunner` | ✖ 直接 reject：`TypeError: window.electronAPI.wsl.resolveHome is not a function`（步驟 `install-server-bundle`） | < 1 ms |
| `ssh.openVerifyTunnel` | `createTestWizardRunner` | ✖ 直接 reject：`TypeError: window.electronAPI.ssh.openVerifyTunnel is not a function`（步驟 `fetch-fingerprint`） | 2 ms |
| `docker.pickServerPort` | 原本的 `new WizardRunner(...)`（對照，test `timeout: 3000`） | 卡在等重試／略過／取消，`test timed out after 3000ms`（cancelled） | 3,003 ms |

錯誤訊息直接帶出缺的 IPC 名稱與卡住的步驟。`--test-timeout` 是 node:test 的命令列旗標，本單不改 `package.json` / CI，請後續 `test:legacy` 工單帶上（建議 `--test-timeout=60000`；現在每檔 < 1 s，`60000` 只是保險）。

### wizard-rollback-cross wsl-linux 判定

**(A) 測試過時，不是產品回歸。** 用本單的正確 mock（`snapshotUnit` 回「原本沒有 unit」、`installBundle` 回 `previous: 'none'`）重跑，唯一失敗的斷言是 `wsl.uninstallBundle should be invoked with the install path`：測試期望 `installPath === '~/.local/bat-server'`，實際呼叫是 `/home/test/.local/bat-server`。這正是 T0378（`4d814e9b`，BUG-087 B：systemd 不展開 `~`，安裝根目錄改由 `wsl.resolveHome` 的絕對 $HOME 組成）的設計；T0554 的 rollback 對 `previous: 'none'` 以記錄的 root 呼叫 `uninstallBundle`（`steps/wsl/install-server-bundle.ts` rollback），`removeUnit('bat-server.service')` 也有呼叫（`snapshot.content === null` 分支）。T0679 推測的「假造 `snapshotUnit` 回傳」不是原因。改斷言後 3/3。

### Commit

- `5bd04ef4`（`5bd04ef4554a6168ccfa426bc3b69450a64068ee`）`test(wizard): T0682 BUG-168 G4 wizard mocks follow current IPC, fail fast on missing mock`：11 檔，+338 / −197（`tests/__mocks__/electron-api.ts`、新增 `tests/__helpers__/wizard-harness.ts`、9 個測試檔）。`git commit --only`，index 為 LF，`git diff --check` 無誤。驗證跑在與 `5bd04ef4` 相同的內容上（之後沒有再改測試檔）。
- 工單本身另一個 commit（收尾）。未 push。

### 遭遇問題

1. 無阻擋，沒有問塔台。
2. 工作目錄是 CRLF（`core.autocrlf=true`），index 是 LF（`.gitattributes` `eol=lf`）。改檔後 working copy 有的變 LF、有的維持 CRLF，commit 時都正規化成 LF，不影響內容。
3. 偶發的 wall time 異常：兩次單檔跑的 wall 是 26 s，但 node:test `duration_ms` 只有 0.2–0.4 s，同檔重跑都回到約 1 s。時間花在 node:test 之外（`npx` 啟動，輸出有 `npm notice run …`），與測試無關；`test:legacy` 用 npm script 內的 `tsx` 可避開 npx。
4. 留意（不在範圍）：共用 mock 仍有 T0321 以前的 `app.getUserDataPath` / `fs.readdir`（舊的 bundle 查找），現在的步驟不再呼叫，沒有刪；SSH 測試資料沿用既有的 `alice` / `bob` / `C:\Users\Alice` 這類虛構名稱，本單新增的資料只用 `test` / `tester` / `Demo`。
5. 時間戳依 R-G001 都由 `date` 取得。

### 回報時間

2026-10-21T21:07:31+0800
