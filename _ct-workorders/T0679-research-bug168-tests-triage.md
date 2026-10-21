---
schema_version: 1
schema_kind: workorder
id: T0679
title: "研究：BUG-168 — tests/ 底下 8 檔失敗、9 檔逾時逐項分類（測試過時／產品回歸／測試本身壞），查失效 script，提出修正分組與納入 CI 的建議（只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:15:54+0800"
started_at: "2026-10-21T20:17:45+0800"
updated_at: "2026-10-21T20:28:00+0800"
completed_at: "2026-10-21T20:28:00+0800"
depends_on: []
related:
  - "BUG-168（現象、失敗項目與逾時清單）；BUG-167 / T0678（同類問題的處理方式與盤點表、跑法）"
  - "可能相關：T0552 / T0554（`electron/server-bundle-install-script.ts` 乾淨覆蓋與精靈 rollback）、T0378（linger、systemd unit 絕對路徑）、PLAN-032（精靈 runner）、PLAN-027（Claude runtime router）、T0505（`buildBaseSshArgs`）；CLAUDE.md「Remote 資安」「Claude Runtime Selection」節與 `docs/agent-guide/`"
affects_files:
  - _ct-workorders/T0679-research-bug168-tests-triage.md
  - "_ct-workorders/_report-T0679-tests-triage.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json`、CI 設定。暫存檔與除錯輸出一律放 Worker 的 scratchpad。"
  - "🔴 分類要有證據：每一項失敗都歸到 (A) 測試過時（產品行為依某工單／決策改變；附 commit 與工單編號）、(B) 產品回歸（測試期望才是正確行為；附證據與受影響的使用情境）、(C) 測試本身壞（環境依賴、mock 不全、平台限定）、(D) 無法判定（寫明缺什麼）。不確定時寫 (D)，不要硬歸類。"
  - "🔴 判斷 (A) 或 (B) 時，以工單、決策紀錄與 `docs/agent-guide/` 的現行規則為準，不以「現在的程式碼就是對的」為準。SSH／WSL 的 systemd unit、launchd plist、linger、安裝腳本相關的項目要特別仔細。"
  - "🔴 逾時：找出卡在哪個步驟、等的是什麼（mock 沒回應的步驟、真的啟動外部程序、等待使用者輸入等），可以加大逾時或開除錯輸出重跑；每檔單次執行不超過 5 分鐘，全程不要真的連線遠端、不要啟動真的 WSL／Docker／SSH 服務。若測試會真的動到本機環境（寫檔到家目錄、啟動服務），先停，寫進回報，不執行。"
  - "🔴 跑 helper 相關測試時，`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 scratchpad（CLAUDE.md 規則）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼與工單；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報只用代稱，不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0679 — 研究：BUG-168 測試失敗與逾時分類

## 研究目標

`tests/` 底下 41 個不在 `test:unit` 的測試裡，有 8 檔失敗（29 項）、9 檔逾時，另有 2 組 `package.json` script 指向不存在的檔案（清單見 BUG-168）。要回答：

1. 每一項失敗是測試過時、產品回歸、測試本身壞，還是無法判定？
2. 每一個逾時卡在哪一步、為什麼？
3. 兩組失效 script 的檔案是什麼時候、為什麼不見的？該刪 script 還是補檔？
4. 修好之後，怎麼讓這些測試不再沒人跑？

## 已知資訊

- 跑法（T0678 實測）：自寫 harness 的用 `npx tsx <file>`；`import … from 'node:test'` 的用 `npx tsx --test <file>`；Node v24.22.0。
- 同類先例 BUG-167：失敗原因是 T0277／T0282 依工單加了欄位，測試沒跟上，屬 (A)。
- 這些測試多數集中在遠端開發（SSH／WSL／Docker 精靈與安裝腳本）、Claude runtime router、Profile 卡片。

## 調查範圍

- 8 個失敗檔的每一個失敗項目：期望值與實際值的差異、相關產品程式、改動它的 commit 與工單。
- 9 個逾時檔：卡住的步驟與原因。
- `package.json` 的 `test:claude-ctrl-o`、`diagnose:ctrl-o*`：檔案刪除的 commit 與原因。
- 納入 CI 的做法：改成 vitest 收進 `test.include`、新增一個跑 tsx／node:test 的 script 並在 CI 執行，或維持手動；各自的工作量、執行時間、平台限制（例如只能在 Windows 跑的測試）。

## 研究指引

- 先讀 BUG-168 與 T0678 回報區的盤點表。
- 每個檔案先找最後幾次改動產品程式的 commit（`git log -- <產品檔>`），對照工單「要做的事」與驗收條件。
- 產品回歸的判斷要能說出「哪個使用情境會壞」。

## 互動規則

- yolo：問題問塔台，每輪最多 3 題；能從工單與決策紀錄判斷的，自己判斷並寫理由。

---

## 回報區

### 完成狀態

DONE（研究完成，只查不修）。29 項失敗全部屬 (A) 測試過時；9 個逾時檔是同一個原因（測試 mock 少了後來工單新加的 IPC，可重試的步驟失敗後，精靈停在「等使用者選重試／略過／取消」），也屬 (A)。**沒有找到產品回歸 (B)**，包括 SSH／WSL 的 systemd unit、launchd plist、linger 與安裝路徑。失效 script 有 **3 組 5 個**（BUG-168 列了 2 組，另多一組 `test:file-drag`），建議全刪。另外發現 **CI 完全沒跑 `npm run test:unit`**，只跑 typecheck。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 不適用（`affects_files` 只有 `_ct-workorders/` 底下的檔）；無 `branch` 欄位（C-2 不適用），HEAD 在 `main`。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。沒有問塔台：每一項都能從工單、commit 與 `docs/agent-guide/remote-security.md` 判斷。

跑法：Node v24.22.0；`npx tsx <file>` / `npx tsx --test <file>`；`BAT_HELPER_LOG_DIR`、`BAT_USER_DATA` 指到 Worker scratchpad；沒有連線遠端、沒有啟動 WSL／Docker／SSH（相關測試都以 `setExecFileImplForTests` / `setSpawnImplForTests` 或 IPC mock 取代，子代理執行前已確認）。重跑結果與 T0678 一致：8 檔失敗 29 項。沒有改任何產品程式、測試檔、`package.json` 或 CI 設定。

### 調查結論（逐項分類表：檔案、項目、分類 A／B／C／D、證據、相關 commit／工單）

**共同背景**：這些檔案都不在 `vite.config.ts` 的 `test.include`，各工單的驗收只跑 `npm run test:unit`，所以產品照工單改了，`tests/` 底下的舊測試沒人跟上。多數情況下 `electron/__tests__/`（vitest）裡已有同一函式的新版測試，在同一個 commit 改過（例如 T0511 改了 `electron/__tests__/ssh-start-server.test.ts`，T0475 改了 `electron/__tests__/claude-runtime-router.test.ts`）。T0382 回報區（`_ct-workorders/_archive/workorders/T0382-…md:166`）就寫過「`tests/wsl-*.test.ts` 不在 vitest include，沒改，要納入需更新 mock」。

| 檔案 | 項目 | 分類 | 期望 → 實際 | 證據（產品位置） | commit／工單 |
|---|---|---|---|---|---|
| `auth-result-metadata.test.ts` | RemoteClient catches pending translator implementations and falls back to Identity | A | 期望 `IdentityTranslator`；實際 `WslPathTranslator`（測試用 `targetOS: 'wsl-linux'` + `wslDistro`） | `electron/remote/path-translator.ts:282-286`、`electron/remote/remote-client.ts:706-721` | 測試 `26eb10d0`（T0270）寫成時 WSL translator 還是 not implemented；同日 `e569183f`（T0273，AC4：`wsl-linux` 不再丟例外、回傳 `WslPathTranslator`）實作。Docker（T0277）、SSH（T0282）之後也實作，已沒有「pending」translator。要保留 fallback 覆蓋，可改用缺 `wslDistro` 的 profile |
| `claude-runtime-router.test.ts` | T-R1、T-R3、T-R4、T-R5、T-R6 | A | 期望回傳內嵌路徑 `/stub/embedded/claude.exe`；實際丟 `Embedded claude binary not found` | `electron/claude-runtime-router.ts:302,312`（可注入的 `embeddedClaudeExists`，預設 `fs.existsSync`） | `0d39b532`（T0475 / BUG-118，A2 要求先檢查內嵌 binary 存在）。T0475 只在 `electron/__tests__/claude-runtime-router.test.ts` 的 stub 補 `embeddedClaudeExists: () => true`，漏了 `tests/` 這份。不是平台限定：該路徑在任何 OS 都不存在 |
| `docker-flow.test.ts` | createDockerWizardContext seeds Docker-specific state | A | 期望 `ctx.serverPort === 9876`；實際 `undefined` | `src/components/setup-wizard/docker-flow.ts:33-35`（註解說明不預設 port） | `99abe9a1`（T0649 / BUG-156：9876 與主機 BAT RemoteServer 預設值撞，改由 start-server 挑主機 port）。與 WSL 先例 T0382 / D128 同模式 |
| `profile-card.test.ts` | SshDetails ssh-linux vs ssh-darwin、DockerDetails mount table、ProfileCard 匯出形式、per-env badge label | A（測試寫法有 C 的弱點） | 期望拿到元素樹；實際 `Cannot read properties of null (reading 'useContext')` | `src/components/profiles/details/SshDetails.tsx:16`、`details/DockerDetails.tsx:6`、`ProfileCard.tsx:91` 的 `useTranslation` | SshDetails：`13c11ffe`（T0506）；DockerDetails、ProfileCard：`15a792d4`（T0652 / BUG-158 i18n）。測試把含 hook 的元件當一般函式呼叫（沒有 React renderer），任何 hook 都會壞。`90b35eed`（T0513）曾刻意把 hook 移到 `StatusDot` 以遷就這個測試，T0652 沒注意到。vitest 端只有 `src/components/profiles/__tests__/SshDetails.test.tsx`（5 項，只測 host 列），**ProfileCard、DockerDetails、ProfileCardDetails 沒有任何 vitest 覆蓋** |
| `ssh-bundle-uploader.test.ts` | test1、test2、test3、test4、test5d | A | 測試的 `installPath: '~/.local/bat-server'`（測試第 74 行）被拒：`Invalid server bundle install path (absolute, at least two segments, no quotes)` | `electron/server-bundle-install-script.ts:59-72`，由 `electron/remote/ssh-bundle-uploader.ts:81` 呼叫 | `f599f915`（T0552 / BUG-139：乾淨覆蓋會刪舊樹，所以根目錄必須絕對、至少兩段、不能是 `$HOME`；T0554 `38fe7421` 沿用）。`docs/agent-guide/remote-security.md:17` 寫明。`electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts:88-89` 明確要求 `~/` 要丟例外 |
| `ssh-bundle-uploader.test.ts` | test5c（sshHost 開頭 `-` 要拒絕） | A | 期望 `sshHost … cannot start with '-'`；實際是上面的安裝路徑錯誤 | 路徑檢查在 `ssh-bundle-uploader.ts:81`，host 檢查仍在 `electron/remote/ssh-args.ts:19`（`buildBaseSshArgs`） | `f599f915`（T0552）。host 檢查沒被拿掉，只是路徑檢查先丟。`tests/ssh-start-server.test.ts` test10c 與 `electron/remote/__tests__/ssh-alias-target.test.ts:181` 仍覆蓋 |
| `ssh-start-server.test.ts` | test1、test8（systemd unit） | A | 期望 `ExecStart=…/bat-server`（無參數）+ `Environment=BAT_REMOTE_BIND/PORT`；實際 `ExecStart=…/bat-server --port N --bind-interface localhost`、沒有 Environment 行 | `electron/remote/ssh-start-server.ts:225,243` | `3df62183`（T0511 / BUG-121）。**舊寫法才是 bug**：`scripts/bat-server.mjs:66-67` 只讀 `--port` 或 `BAT_SERVER_PORT`（預設 54321），從來不讀 `BAT_REMOTE_PORT`，舊 unit 實際聽 54321，精靈驗證失敗（v0.4.1–v0.6.0-pre.5）。被拿掉的只有這兩行 Environment，沒有遺失 token／HOME／PATH |
| `ssh-start-server.test.ts` | test2、test8（launchd plist） | A | 期望 `<key>EnvironmentVariables</key>`；實際參數放在 `ProgramArguments` | `ssh-start-server.ts:261-273` | `3df62183`（T0511，plist 帶同樣四個參數） |
| `ssh-start-server.test.ts` | test3（systemd 執行順序） | A | 期望 `enable --now`；實際 `daemon-reload && enable && restart` | `ssh-start-server.ts:535-546` | `3df62183`（T0511，工單認可的偏離）。`enable --now` 不會重啟已在跑的服務，重跑精靈升版會留著舊程序與舊參數；與 WSL 的 `wsl-systemd.ts` 一致，T0552 也依賴「enable 後重啟舊 server」 |
| `ssh-start-server.test.ts` | test4（launchd 驗證） | A | 期望 `launchctl list \| grep … && pgrep -x bat-server`；實際 20 s 輪詢 `launchctl list` PID + `lsof -iTCP:<port> -sTCP:LISTEN` | `ssh-start-server.ts:357,381` | `3df62183`（T0511 第 2 項：要確認 port 真的在聽）。bat-server 是 node 程序，`pgrep -x bat-server` 本來就比對不到 |
| `wsl-detect.test.ts` | installBundle() rejects relative tarball paths before spawning WSL | A | 期望 `Expected absolute Windows path: relative.tar.gz`；實際是安裝路徑 `~/.local/bat-server` 被拒 | `electron/wsl-detect.ts:350-352`、`server-bundle-install-script.ts:59-75` | `f599f915`（T0552）。檢查順序沒變（T0552 之前就是先檢查安裝路徑），新的是 `~` 被拒；tarball 檢查仍在（`wsl-detect.ts:146-151`）。新版測試：`electron/__tests__/wsl-install-bundle.test.ts` |
| `wsl-systemd.test.ts` | renderSystemdUnit ×2、writeUnit 經 wsl tee stdin | A | 測試傳 `execStart: '~/.local/…'`；實際 `Invalid Unix path` | `electron/wsl-systemd.ts:136-145` | `4d814e9b`（T0378 / BUG-087 B：systemd 不展開 `~`，ExecStart 與 Environment 必須絕對）。**舊測試資料本身就是 BUG-087 的錯誤 unit**。新版：`electron/__tests__/wsl-systemd.test.ts:144` |
| `wsl-systemd.test.ts` | enableLinger returns ok=true | A | 期望 `{ok:true}`；實際 `Invalid WSL user name: ""` | `wsl-systemd.ts:215-223`（`resolveDistroUser`：`id -un` + 白名單）、`:240-264` | `4d814e9b`（T0378 / BUG-087 A：不帶使用者的 `loginctl enable-linger` 在 WSL 會 ENXIO；改成先 `id -un`、以 `Linger=yes` 判斷成功）。mock 對每個呼叫都回空字串 |
| `wsl-systemd.test.ts` | enableLinger returns ok=false when loginctl reports an error | A | 期望 `permission denied`；實際 `loginctl failed` | `wsl-systemd.ts:244-246`、`:261-263` | `4d814e9b`（T0378）。mock 讓每個呼叫都失敗，先失敗的是新的 `id -un`，回傳的是 mock 的訊息。真正的 enable-linger 失敗仍回 stderr（`:261-263`），不是診斷資訊的回歸（見遭遇問題第 3 點的小缺口） |
| `wsl-systemd.test.ts` | startService runs daemon-reload, enable-now, status poll… | A | 期望 `{ok:true, token}`；實際 10 s 後 `wsl-service-start-timeout (ActiveState=?, SubState=?)` | `wsl-systemd.ts:296-303`（`systemctl --user show -p ActiveState -p SubState -p NRestarts`）、`:384-429` | `af7d94ff`（T0382 / BUG-091 / D128-3：從「第一次 active」改成「active 3 s 且 NRestarts 不變」，`enable --now` 改 `enable` + `restart`）。mock 只回應 `is-active`。舊邏輯會把 crash loop 的 server 判成成功。新版：`electron/__tests__/wsl-systemd.test.ts:164-280` |

小計：A = 29 項（8 檔）；B = 0；C = 0（profile-card 的寫法弱點併在 A 註記）；D = 0。

**SSH／WSL 安裝路徑的產品端追查（判 A 不判 B 的關鍵）**

- SSH：預設值是字面 `~/.local/bat-server`（`src/components/setup-wizard/ssh-flow.ts:11,45`），但 `steps/ssh/install-server-bundle.ts:99` 先經 `resolveSshInstallPath`（`steps/ssh/remote-home.ts:37-43`，T0379 / BUG-088 / D126）展開成遠端 `$HOME` 的絕對路徑；沒探測到 `$HOME` 就丟 precondition 錯誤，`~` 到不了 `uploadServerBundle`。這是唯一的呼叫者（→ `electron/preload.ts:639` → `electron/remote/ssh-setup-handlers.ts:86-89`）。profile 不存安裝路徑，舊版 profile 也帶不進 `~/`。
- WSL：`wsl:resolve-home`（`electron/wsl-detect.ts:217-226`，`printenv HOME`，要求絕對）→ 安裝路徑 `${home}/.local/bat-server`（`steps/wsl/install-server-bundle.ts:131`）→ exec 路徑 `${installPath}/bin/bat-server`（`steps/wsl/write-systemd-unit.ts:176`）；使用者名稱由 `enableLinger` 自己 `id -un` 取得。`wsl-flow.ts` 的 `~` 預設值會被安裝步驟覆寫，沒跑安裝就在 `write-systemd-unit.ts:174` 以 precondition 停下，不會寫出壞的 unit（T0378 回報區認可）。
- 刻意的邊界：遠端 `$HOME` 只有一段（例如 `/root`）時，展開後的根目錄不足兩段而被拒，這是 T0552 的設計。

### 逾時分析（檔案、卡住的步驟、原因、分類）

**共同機制**：`src/components/setup-wizard/wizard-runner.ts:565-566`，可重試的步驟失敗後 `await this.waitForRetryOrSkip()`，這個 Promise 只有 `retryCurrentStep` / `skipCurrentStep` / `cancel` / `jumpToStep` 能結束（T0274 `70404d27` 刻意設計：失敗畫面等使用者選）。測試沒有 onProgress 去按重試或取消，所以 mock 一缺，步驟丟 `TypeError` 後就永遠等下去，表現成逾時而不是失敗。共用 mock `tests/__mocks__/electron-api.ts` 最後更新是 `bf417069`（T0383），裡面沒有 `pickServerPort` / `resolveHome` / `getVersion`；`wizard-runner.test.ts` 第 73、156 行的內嵌 mock 一樣舊。**沒有真的計時器、子程序、等外部服務或碰本機環境。**

確認方式：子代理以 scratchpad 內的 preload（`--import`，repo 不改）攔 `waitForRetryOrSkip`，印出卡住的步驟並回 `cancel`；另一個 preload 用 Proxy 補上缺的 IPC，推估補完後的結果。

| 檔案 | 卡住的測試 | 卡住的步驟、缺的 IPC | 引入的 commit／工單 | 分類 | 補完 mock 後 |
|---|---|---|---|---|---|
| `wizard-runner.test.ts` | 第 2 項 WSL happy path、第 3 項 buildWslWizardSteps integrates… | WSL `install-server-bundle`：`wsl.resolveHome`（`steps/wsl/install-server-bundle.ts:54`）；之後還缺 `update.getVersion`、`remote.serverBundle.*`、`wsl.pickServerPort` / `keepAlive` / `snapshotUnit`、`profile.listLocal` | `4d814e9b`（T0378）；更早 `ac7021d4`（T0321）已讓它壞；T0382 / T0384 / T0552 / T0554 | A | 第 2 項的斷言 `serverInstallPath === '~/.local/bat-server'` 依 T0378 要改成絕對路徑 |
| `wsl-flow-journeys.test.ts` | Journey 1–3 | 同上（共用 mock） | 同上 | A | Journey 2 剩 `ctx.warnings` 含 `undefined`：NAT 警告改用 `i18next.t`（T0383），測試沒初始化 i18n |
| `wsl-wizard-e2e.test.ts` | 5 項 | 同上 | 同上 | A | 剩 NAT 那項（i18n，同上） |
| `wizard-rollback-cross.test.ts` | wsl-linux、ssh-linux（docker 那項本來就過） | wsl：`resolveHome`；ssh：`update.getVersion`（`steps/ssh/install-server-bundle.ts:105`） | wsl：T0378；ssh：`ffe55060`（T0322 / PLAN-031） | A；補完後 wsl 那項剩 1 個斷言失敗為 **D** | wsl 剩的失敗可能是子代理假造的 `snapshotUnit` 回傳造成，要用正確 mock 重跑才能判定 |
| `ssh-wizard-e2e.test.ts` | AC2.1、AC2.2、AC2.3、AC2.5（AC2.4 不卡但失敗） | SSH `install-server-bundle`：`update` undefined；第二層 `ssh.openVerifyTunnel` / `verifyTunnelStatus` / `closeVerifyTunnel`（`verify-remote.ts:67,95`） | `ffe55060`（T0322，2026-04-27 起就壞）；`a3717a5c`（T0387 / BUG-093，改經 tunnel 驗證遠端） | A | tunnel mock 要回傳測試內本機 HTTPS server 的 port，否則改卡在 `fetch-fingerprint`（`Server port was not resolved`，`steps/wsl/fetch-fingerprint.ts:69`）。T0387 回報區第 167 行已記這兩個 ssh 檔當時就逾時 |
| `ssh-flow-journeys.test.ts` | Journey A、B、C | 同上（B 先在 `verify-ssh-auth` 依劇本失敗、重試後一樣卡在 install） | 同上 | A | 同上 |
| `docker-flow-journeys.test.ts` | Journey 1–3 | Docker `start-server`：`docker.pickServerPort is not a function`（`steps/docker/start-server.ts:178`） | `99abe9a1`（T0649 / BUG-156） | A | 補 `pickServerPort` 後 3/3 過 |
| `docker-wizard-e2e.test.ts` | mode A／B happy；mode B start-server failure 拿到錯的訊息 | 同上 | 同上 | A | 5/5 過 |
| `docker-wizard-runner.test.ts` | mode A／B happy、rolls back … profile persistence fails | 同上 | 同上 | A | 5/5 過 |

補完 mock 後每檔 node:test `duration_ms` 約 0.11–0.63 s，加 tsx 啟動每檔約 1–3 s。

### 失效 script

| script | 指向 | 歷史 | 建議 |
|---|---|---|---|
| `test:claude-ctrl-o` | `tests/test-claude-ctrl-o.js` | `20ee962c`（2025-12-20）加入；同日 `ab4de813`「consolidated into diagnostic tool」刪檔但留了 script，從那天起就失效。兩個 commit 來自 scandnavik fork | 刪 script |
| `diagnose:ctrl-o`、`diagnose:ctrl-o:quick`、`diagnose:ctrl-o:verbose` | `tests/diagnose-ctrl-o.js` | `ab4de813` 加入（Claude Code Ctrl+O thinking 顯示的手動診斷工具）；`c1855790`（2026-04-11，本 fork「remove leftover test scripts and dev launch files」）刪檔，沒附工單、沒刪 script | 刪 script（一次性的手動 Electron 診斷，針對外部 CLI 行為，不是產品功能；要用可從 `c1855790^` 或 tony1223 upstream 取回） |
| `test:file-drag`（BUG-168 未列） | `tests/file-drag-to-chat.test.ts` | `6541fdb8`（2026-03-28，拖曳非圖片檔進 Agent chat）加 script，檔案在任何分支都沒 commit 過 | 刪 script |

- 其他引用：只有 BUG-168 與本工單；`docs/`、`CLAUDE.md`、README、CI 都沒有。`src/`、`electron/` 沒有 ctrl-o 相關處理。其餘 32 個 script 都指向存在的檔案。
- 代價：之後和 tony1223 upstream 同步時 `package.json` 可能有小衝突（upstream 仍有 `diagnose:ctrl-o*` 與檔案），寫進清理工單。

### 建議方向（修正工單分組：每組範圍、大小、風險；產品回歸各自一組）

沒有產品回歸，不需要 B 類工單。建議分 4 組，加 1 組 CI：

| 組 | 範圍 | 大小 | 風險 | 說明 |
|---|---|---|---|---|
| G1 失效 script | `package.json` 刪 5 個 script | XS | 低（upstream 同步小衝突） | 可併入 G5 |
| G2 單元測試跟上產品 | `auth-result-metadata`（改用缺 `wslDistro` 的 profile 測 fallback）、`claude-runtime-router`（`deps()` 補 `embeddedClaudeExists: () => true`）、`docker-flow`（斷言 `serverPort === undefined`）、`profile-card` 4 項 | S（profile-card 若改成 vitest + RTL 實際渲染、初始化 i18n 則 M） | 低 | 推薦 profile-card 搬到 `src/components/profiles/__tests__/`，順便補上 ProfileCard / DockerDetails 目前沒有的 vitest 覆蓋 |
| G3 SSH／WSL 安裝與 systemd 舊測試 | `ssh-start-server`、`ssh-bundle-uploader`、`wsl-systemd`、`wsl-detect` 共 18 項 | S–M | 低（只改測試）；要注意別把舊的錯誤期望（`~`、`BAT_REMOTE_PORT`、`enable --now`）原樣保留 | 這 4 檔與 `electron/__tests__/` 的 vitest 版大量重複。建議逐項比對：重複的刪掉，vitest 沒有的（例如 T0297 escapeXml／plist breakout、T0296 BatchMode）搬進 vitest 版，最後刪掉舊檔。只更新期望值也可以，但兩份測試會繼續各自漂移 |
| G4 精靈 mock 與防卡死 | 共用 `tests/__mocks__/electron-api.ts`、`wizard-runner.test.ts` 內嵌 mock；9 檔 | M（Docker 部分 S，WSL M，SSH M–L 因為 tunnel mock 要接測試內 HTTPS server） | 中：mock 要跟現行 IPC 形狀一致；`wizard-rollback-cross` wsl 那項有 1 個 D 待正確 mock 重跑判定 | 一併加防護：harness 的 onProgress 看到 Failed 就 `runner.cancel()`，或固定 `--test-timeout`，以後缺 mock 會直接失敗而不是卡住。可拆 G4a Docker（先做、最小）／G4b WSL／G4c SSH |
| G5 納入 CI | 見下節 | S–M | 中：Linux 上是否全過沒實測 | 放在 G2–G4 之後，否則一上 CI 就紅 |

### 納入 CI 的建議（選項、工作量、執行時間、推薦）

**前提發現**：`.github/workflows/` 四個 workflow 都沒有 `test:unit` 或 `vitest`；`pre-release.yml` / `release.yml` 只有 `typecheck` job。也就是說連 vitest 的 322 檔、5,664 項也不在 CI。本機實測 `npx vitest run` 58 s（Windows，322 檔；在我匯出 `BAT_HELPER_LOG_DIR` 的 shell 有 2 項失敗，原因見遭遇問題第 2 點，不匯出就全過）。

`tests/` 實測時間（Windows，每檔各自啟動）：17 個 tsx harness 檔每檔約 0.8–0.9 s；node:test 檔每檔約 0.9 s（`ssh-tunnel` 6.0 s、`wsl-systemd` 11.5 s 因為含真的等待）；9 個通過的 node:test 檔合併一次 `tsx --test` 共 6.1 s。全部修好後 41 檔估計 30–60 s。

| 選項 | 做法 | 工作量 | 執行時間 | 限制 |
|---|---|---|---|---|
| ① 改寫成 vitest，收進 `test.include` | 24 個 node:test 檔把 `node:test` / `assert` 換成 vitest；17 個自寫 harness 檔要改成 `describe` / `it`；需要 `// @vitest-environment node`（預設 jsdom） | L（41 檔，其中許多與 `electron/__tests__/` 重複，可順便刪） | 併入 `test:unit`，+10–20 s | 一勞永逸，只剩一套測試框架 |
| ② 新增 script（例如 `test:legacy`）+ CI step | 一個小 runner：node:test 檔一次 `tsx --test --test-timeout=30000 <files>`，harness 檔逐一 `tsx <file>` 看 exit code；CI 在 typecheck job 後加 `npm run test:unit` 與 `npm run test:legacy` | S | 30–60 s（加上 test:unit 約 1–2 分鐘） | 兩套框架並存；新測試仍可能被放進 `tests/` |
| ③ 維持手動 | 不改 | 0 | 0 | 就是 BUG-167 / BUG-168 的成因，不推薦 |

**推薦**：短期 ②，長期往 ① 收斂。

1. 先做 G2–G4，再做 G5 = ②：新增 `test:legacy`（帶 `--test-timeout`），在 `pre-release.yml` / `release.yml` 的 `typecheck` job（ubuntu-24.04）加跑 `npm run test:unit` 與 `npm run test:legacy`，失敗就擋 build，比照 **Typecheck gate**。
2. G3 的「刪重複、搬到 vitest」本身就是往 ① 前進；之後規定新測試只放 vitest 可收的位置（CLAUDE.md「Frontend unit tests」節補一句）。
3. 平台：這些測試都在 Windows 上寫、跑；Linux 上會不會全過**沒有實測**（D）。`gpu-detector.test.ts` 有 7 處 `process.platform`。建議 G5 先以 `workflow_dispatch` 在 ubuntu 跑一次看結果，不行的再標 Windows 限定或加 windows runner。`test:unit` 要依 CLAUDE.md 帶 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 時，要先處理遭遇問題第 2 點。

### 子代理使用

| 種類 | 數量 | 用途 | 唯讀（怎麼保證） | tokens | 備註 |
|---|---|---|---|---|---|
| 子代理（Agent 工具，Explore） | 4 | ① 9 個逾時檔的卡點；② SSH 2 檔；③ WSL 2 檔；④ auth／router／docker-flow／profile-card 與失效 script | 是（Explore 沒有 Edit／Write；prompt 明令不得改 repo、不得 stash/reset/checkout/restore，暫存只放 scratchpad；不得連遠端或啟動 WSL／Docker／SSH） | 349,437（工具回報：78,878 + 95,431 + 66,419 + 108,709） | 逾時子代理在 scratchpad 寫了 2 個診斷 preload（`--import` 載入，repo 未改）。主 Worker 抽查：`scripts/bat-server.mjs:67`（只讀 `--port` / `BAT_SERVER_PORT`）、`remote-home.ts` 的 `resolveSshInstallPath`、`wsl-systemd.ts:136-145,213-224`、`claude-runtime-router.ts:302,312`、`docker-flow.ts:33-35`、`wizard-runner.ts:560-568`、共用 mock 沒有 `pickServerPort` / `resolveHome` / `getVersion`、各 commit 的訊息與日期、`tests/file-drag-to-chat.test.ts` 不存在，全部相符。`git status` 確認 repo 只有本工單變動 |

沒有使用 Workflow 工具。

### 遭遇問題

1. 無阻擋，沒有問塔台。
2. 旁支發現（不在本單範圍，建議塔台另記）：`electron/__tests__/pty-manager-helper-env.test.ts` 第 174、203 行斷言 `env.BAT_HELPER_LOG_DIR` 為 undefined，但測試沒有先清掉 `process.env.BAT_HELPER_LOG_DIR`。執行測試的 shell 若有設這個變數（CLAUDE.md 要求跑 helper 測試時設到 temp），`test:unit` 就會有這 2 項失敗；不設則 22/22 通過。屬 (C) 測試隔離問題。若 G5 在 CI 設這個變數，要先修。
3. 小缺口（不是回歸）：`wsl-systemd.ts:244-246` 解析使用者失敗時用 `error.message`，不是 `describeError`，stderr 能不能顯示取決於 Node 有沒有把它放進 message。
4. 有 1 項標 (D)：`wizard-rollback-cross` 的 wsl-linux 那項，補完 mock 後剩 1 個斷言失敗，可能是假造的 `snapshotUnit` 回傳造成，要等 G4 用正確 mock 重跑。
5. 為什麼卡住的 Promise 沒讓 node:test 判定事件迴圈已空而結束，沒有追（推測 tsx 子程序讓迴圈保持開著），不影響結論。

### 回報時間

2026-10-21T20:28:00+0800
