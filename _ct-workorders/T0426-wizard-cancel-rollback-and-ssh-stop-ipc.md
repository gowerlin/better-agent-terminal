---
schema_version: 1
schema_kind: workorder
id: T0426
title: "BUG-099 + BUG-100：精靈取消時 rollback 失敗中的步驟；實作 ssh.stopServer / ssh.uninstallBundle IPC（preload + main）"
type: fix
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-099
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T06:01:34+08:00"
updated_at: "2026-10-05T06:01:34+08:00"
completed_at: null
target_version: next
depends_on:
  - T0425
related:
  - "BUG-099（runner cancel 不 rollback 失敗中的步驟）；BUG-100（`ssh.stopServer` / `ssh.uninstallBundle` 只有型別）"
  - "T0387（SSH fetch-fingerprint 失敗時自行關 tunnel 的繞道）；PLAN-032"
  - "D134（本 session 排程表第 10 列；兩 BUG 合一張）"
affects_files:
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/
  - src/components/setup-wizard/steps/docker/
  - src/components/setup-wizard/__tests__/
  - electron/preload.ts
  - electron/main.ts
  - electron/remote/ssh-start-server.ts
  - src/types/electron.d.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **決策已定（D134）：實作兩個 IPC**（不是刪型別）。child_process 一律 `execFile` / `spawn` + array args；sshHost / profileId / path 等外部輸入必過 `/^[a-zA-Z0-9._-]+$/` 白名單（ssh host 若含 `@` / `:` 需另訂嚴格白名單並在回報區說明）；timeout 必設（IO 30s）。遠端執行的指令只能是 hardcoded 字串組合（systemctl --user stop / disable、移除 `~/.local/bat-server` 等），不得拼接未驗證輸入。參考現有 `ssh.startServer` / `ssh.installBundle` 的實作方式，沿用其連線與 quoting 慣例。"
  - "🔴 **rollback 冪等性**：runner 改成取消時 rollback 失敗中的步驟之前，逐一檢查 WSL / Docker / SSH 所有有 `rollback()` 的步驟——對「只執行一半」的狀態呼叫 rollback 是否安全（重複刪除、服務不存在時不報錯）。不安全的步驟修成冪等；回報區附步驟 × 冪等性表格。"
  - "🔴 移除 T0387 的「SSH fetch-fingerprint 失敗時自行關 tunnel」繞道前，確認 runner 新行為已涵蓋，否則保留。"
  - "🔴 依賴 T0425（同改 `steps/ssh/`）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不對任何實際 SSH 主機執行。"
---

# T0426 — 精靈取消 rollback + SSH stop / uninstall IPC（BUG-099 + BUG-100）

## 背景

- BUG-099：`src/components/setup-wizard/wizard-runner.ts` `cancel()` 以 `retry` 結果解除等待，迴圈頂端只 rollback **已完成**步驟，失敗中的步驟 `rollback()` 不被呼叫
- BUG-100：`src/types/electron.d.ts` 宣告 `ssh.stopServer` / `ssh.uninstallBundle`（註解「real IPC handlers land in a follow-up workorder」），`electron/preload.ts` / `electron/main.ts` 無實作 → SSH `start-server` 步驟 rollback 拋錯，runner 只記 warn ⇒ SSH 精靈失敗後遠端殘留已啟動的服務 / bundle

## 範圍

1. 實作 `ssh:stop-server` / `ssh:uninstall-bundle` IPC（main + preload，型別對齊既有宣告）
2. runner：取消時對當前失敗步驟呼叫 `rollback()`，再依序 rollback 已完成步驟
3. 冪等性盤點與修正（memory_overrides 第 2 條）
4. 測試：runner cancel 呼叫失敗步驟 rollback；IPC handler 以 mock `execFile` 驗證 args 陣列、白名單拒絕、timeout；SSH start-server rollback 不再拋錯

## 驗收條件

- [x] 回報區附冪等性表格
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [x] BUG-099 / BUG-100 改 `FIXED` 並填 `links.fix_workorder: T0426`
- [x] 回報區附實機步驟（SSH 精靈在 start-server 後的步驟故意失敗 → 取消 → 遠端服務與 bundle 已清除）；實機由使用者執行

## Sub-session 執行指示
1. 讀本工單 + BUG-099 + BUG-100 + T0387 回報區 + 現有 `ssh.startServer` / `ssh.installBundle` 實作
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-099 + BUG-100；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（程式 + 單元測試完成；實機 SSH 驗收交使用者，步驟見下方）

- 開工：`2026-10-05T06:01:34+08:00`（系統時間）；派發 `CT_MODE=yolo`、`CT_INTERACTIVE=0`；無使用者中途指示
- 依賴：開工時 `git log --oneline -3` 的 HEAD = `a73caf9 fix(wizard): T0425 BUG-098 remove SSH direct mode, tunnel only` ✅

### 落點檢查（Landing Zone）— 整體 **PASS**

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ✅ PASS | frontmatter `repo: better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 工單路徑 | ✅ PASS | `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal` |
| C-3 affects_files | ✅ PASS（informational） | 前 5 項（`wizard-runner.ts`、`steps/ssh/`、`steps/wsl/`、`steps/docker/`、`__tests__/`）皆存在 |
| C-2 branch | ℹ️ N/A | 無 `branch` 欄位；實際 `main` |
| `BAT_WORKSPACE_ID` | 證據 | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |

### 產出摘要

**1. BUG-100 — `ssh:stop-server` / `ssh:uninstall-bundle` IPC**

- `electron/remote/ssh-start-server.ts`：新增 `stopServerOnRemote()` / `uninstallBundleOnRemote()`，沿用同檔 `runSsh()`（`spawn('ssh', [...array args])`、`buildBaseSshArgs` 的 `BatchMode` / `ConnectTimeout` / `StrictHostKeyChecking` / `-- user@host`、C locale env、逾時以 `shutdownSshProcess` 收掉）與單引號 quoting 慣例；timeout 預設 30s（`StarterDeps.timeoutMs` 可覆寫）
- 輸入白名單（驗證失敗直接回 `{ ok: false }`，**不 spawn**）：
  - `sshHost`：`/^(?!-)[A-Za-z0-9._:-]{1,253}$/` —— 依 memory_overrides 另訂：在 `[a-zA-Z0-9._-]` 之外**只多允許 `:`**（IPv6 literal，如 `fe80::1`）；`@` 一律拒絕（user / host 本來就分欄位傳）；不得以 `-` 開頭（會被當成 ssh option）
  - `sshUser`：`/^(?!-)[A-Za-z0-9._-]{1,64}$/`
  - `sshPort`：1–65535 整數；`sshKeyPath`：本機路徑（常含 `C:\`），只作為 `-i` 的單一 argv 元素、不進遠端指令，沿用 `validateSshIdentifier`（拒絕開頭 `-`、空白、控制字元）
  - `serverHome`：沿用 `resolveServerHome`（絕對路徑、`[A-Za-z0-9._/-]`、無 `..`）；`targetOS` 僅 `ssh-linux` / `ssh-darwin`
  - `installPath`（`rm -rf` 的對象）：`~/<rel>` 或絕對路徑、字元 `[A-Za-z0-9._/-]`、不得有空 / `.` / `..` 段、**最後一段必須是 `bat-server`**（configure-host 的兩個選項 `~/.local/bat-server`、`/opt/bat-server` 皆符合）⇒ 不可能刪到 `/`、`$HOME` 或其他目錄
- 遠端指令只由常數 + 上述驗證值組成：
  - linux：`systemctl --user disable --now bat-server` → `rm -f '<home>/.config/systemd/user/bat-server.service'` → `daemon-reload` → `reset-failed`（前四步失敗皆忽略）→ 服務仍 active 或檔案仍在才 `exit 1`。**刻意不動 `loginctl enable-linger`**（可能早於 BAT 存在）
  - darwin：`launchctl unload -w '<plist>'` → `launchctl remove com.bat-server` → `rm -f '<plist>'` → 檔案仍在才 `exit 1`
  - uninstall：`rm -rf -- '<abs>' && test ! -e '<abs>'`；`~/` 形式為 `"$HOME"/'<rel>'`（`$HOME` 是常數字串，由遠端 shell 展開，不會產生字面 `~` 目錄）
- `electron/remote/ssh-setup-handlers.ts`：註冊 `ssh:stop-server` / `ssh:uninstall-bundle`（try/catch，永不對 renderer reject）
- `electron/preload.ts`：`ssh.stopServer` / `ssh.uninstallBundle`；`src/types/electron.d.ts`：型別**未改**（既有宣告即正確），只把「handlers land in a follow-up workorder」註解改為指向 T0426

**2. BUG-099 — runner 取消時 rollback 失敗中的步驟**

- `wizard-runner.ts`：新增 `waitForCancel`；`cancel()` 在失敗畫面時改以 `'cancel'` 決策解除等待（原本借用 `waitForRetry` ⇒ 被當成 retry，迴圈頂端只 rollback 已完成步驟）。`'cancel'` 分支：`rollbackFailedStep(step, index)` → `rollbackCompletedSteps()` → `throw new Error('Wizard cancelled')`（訊息與既有一致）
- 失敗步驟 rollback 成功時標 `rolled-back`（`failed → rolled-back` 本來就在允許表內）；rollback 拋錯 → `logger.warn`、狀態保持 `failed`、仍繼續 rollback 已完成步驟
- 不變：retry / skip / jumpToStep；不可重試步驟的既有路徑（rollback 失敗步驟 + 已完成步驟、拋原始錯誤、snapshot 保持 `failed`）

**3. 冪等性盤點與修正**

| flow | 步驟 | rollback 動作 | 重複呼叫 / 目標不存在 | 只執行一半時呼叫 | 處置 |
|------|------|--------------|----------------------|------------------|------|
| SSH | `install-server-bundle` | `ssh.uninstallBundle` → `rm -rf -- <path>` | ✅ `rm -rf` 對不存在路徑為 no-op；IPC 失敗只 warn | ❌→✅ 原本在下載失敗（尚未上傳）時也會刪 `sshResolvedInstallPath`＝**先前安裝留下的 bundle** | **已修**：`sshBundleUploadStarted`（run 開頭 `false`、上傳前 `true`），`false` 時 rollback 跳過。上傳途中失敗仍會刪（目錄已被部分覆寫） |
| SSH | `start-server` | `ssh.stopServer` → disable/stop + 刪 unit/plist | ✅ 各動作忽略「不存在」，只有最終檢查決定結果；IPC 失敗只 warn（原本此 IPC 不存在 ⇒ 拋錯，即 BUG-100） | ❌→✅ 原本在 run 尚未呼叫遠端（例如 install path 未設）就失敗時，會停掉**先前安裝的** `bat-server` | **已修**：`sshStartServerTouchedRemote`（呼叫 `ssh:start-server` 前設 `true`），`false` 時跳過。遠端階段失敗（unit 已寫、enable 失敗等）照常 rollback |
| SSH | `fetch-fingerprint` / `connect-test`（verify-remote） | 關 verify tunnel | ✅ main `close()` 冪等（T0387 已測） | ✅ | 不需改。**T0387 繞道保留**（見「遭遇問題 1」），只更新註解 |
| SSH | `configure-host` / `verify-ssh-auth` | 無 rollback | — | — | — |
| WSL | `pick-wsl-distro` | 清 `ctx.wslDistro` / `wslHome` | ✅ 純 ctx | ✅ | 不需改 |
| WSL | `install-server-bundle` | `wsl.uninstallBundle` → `rm -rf` | ✅ | ✅ `serverInstallPath` 只在安裝成功後設定，失敗時 rollback 為 no-op（可能殘留部分解壓檔，下次安裝覆寫） | 不需改 |
| WSL | `write-systemd-unit` | `removeUnit`（`disable --now` / `rm -f` / `daemon-reload` 皆 `allowFailure`）+ `releaseKeepAlive`（Set delete） | ✅ | ❌→✅ 原本在寫 unit 前失敗（例如挑 port 失敗）也會 `disable --now` **先前安裝的** `bat-server.service`；`wslSystemdEnabled === false` 分支亦同 | **已修**：`ctx.state.wslUnitWriteStarted`（`writeUnit` 前設 `true`），`false` 時跳過 |
| WSL | `write-profile`（WSL/Docker/SSH 共用） | `profile.delete(createdProfileId)` 後清 id | ✅ 第二次為 no-op | ✅ create 成功、update 失敗 ⇒ 刪掉該 profile（正確） | 不需改（重試遺留見「遭遇問題 3」） |
| Docker | `pick-container` | `new` 模式 `removeContainer`（`docker rm -f`） | ✅ 容器不存在 → `{ ok:false }`，不拋錯 | ✅ | 不需改（既有風險見「遭遇問題 3」） |
| Docker | `configure-mounts` | 清 state / draft | ✅ 純 ctx | ✅ | 不需改 |
| Docker | `install-server-bundle` | `existing` 模式 `docker exec rm -rf <serverInstallPath>` | ✅ | ❌→✅ 跳回前面步驟後重跑失敗時，會沿用前一次成功留下的 `serverInstallPath`，在使用者既有容器內 `rm -rf /opt/bat-server` | **已修**：run 開頭清 `ctx.serverInstallPath`（本步驟自己的輸出），失敗時 rollback 為 no-op |
| Docker | `start-server` | `new` → `removeContainer`；`existing` → `stopContainer` | ✅ `docker rm -f` 缺容器回 `ok:false`；`docker stop` 對已停止容器回 0 | ✅ 不拋錯 | 不需改 |

**4. 測試**

- `electron/__tests__/ssh-teardown.test.ts`（新，48 案）：linux / darwin 指令與 argv（`ssh`、`--` 後為 `alice@devbox.example`、`BatchMode=yes`、`-p` / `-i` 為獨立元素、C locale env）、冪等形狀、IPv6 host；17 種 stop 輸入 + 15 種 installPath 白名單拒絕（全部斷言**未 spawn**）；非零 exit 帶 stderr；timeout（覆寫為 20ms）→ `timed out`；IPC handler 以 `vi.mock('child_process')` 的 mock `spawn` 驗證 channel 註冊、array args、非法 / 缺漏請求回 `{ ok:false }` 且不 spawn
- `electron/__tests__/preload-ssh-teardown.test.ts`（新）：preload `ssh.stopServer` / `ssh.uninstallBundle` 走 `ssh:stop-server` / `ssh:uninstall-bundle`
- `src/components/setup-wizard/__tests__/wizard-cancel-rollback.test.ts`（新，14 案）：runner 取消順序（失敗步驟 → 已完成步驟反向）與 `rolled-back` 狀態、失敗步驟 rollback 拋錯時仍 rollback 其他步驟、無 rollback 的失敗步驟、retry / skip 不 rollback、不可重試路徑不變；SSH：後續步驟失敗 → 取消 → `stopServer` 再 `uninstallBundle`、start-server 遠端失敗也會 rollback、未觸及遠端 / 下載失敗不會刪、上傳中失敗會刪、`stopServer` 回失敗只 warn 不拋錯；WSL：寫 unit 後失敗 → 移除 unit + 釋放 keep-alive、寫 unit 前失敗 → 不動既有 unit；Docker：重跑失敗不沿用舊路徑

### 驗收結果（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| `npm run test:unit` | ✅ PASS | **133 files / 2077 passed / 1 skipped**，exit 0（工作樹含其他平行 Worker 的改動）。輸出中的 `error: No such remote 'origin'` 為既有測試的 stderr 雜訊，非失敗 |
| `npx tsc --noEmit` | ✅ PASS | **39** errors（開工 baseline 39；排序後的錯誤清單 `diff` 完全相同）；本單觸及的檔案 0 筆 |
| `npx vite build` / `npm run test:e2e` | ⏭️ 未跑 | 依 memory_overrides（L141，平行 Worker） |
| 實機 SSH 驗收 | ⏳ 待使用者 | 依 memory_overrides **未對任何實際 SSH 主機執行**；步驟如下 |

### 實機驗收步驟（交使用者；需要一台可用 key 登入的 Linux 主機）

1. 以含本修正的版本啟動 BAT，開 SSH 精靈，正常走過 configure-host / verify-ssh-auth / install-server-bundle / start-server（start-server 完成後 log 應有 `✓ bat-server is running (systemd)`）
2. 讓 start-server **之後**的步驟失敗。最簡單的方式：start-server 完成、fetch-fingerprint 開始前，在遠端執行 `systemctl --user stop bat-server`（或把遠端 `~/.local/share/bat-server/server-cert.json` 改名）→ fetch-fingerprint 失敗
3. 在失敗畫面按「取消」
4. 預期 log：沒有 `Rollback failed for start-server` / `Failed to stop bat-server over SSH`（BUG-100 修正前這裡會出現 `window.electronAPI.ssh.stopServer is not a function`）
5. 在遠端確認已清除：
   - `systemctl --user status bat-server` → `Unit bat-server.service could not be found.`
   - `ls ~/.config/systemd/user/bat-server.service` → `No such file or directory`
   - `ls ~/.local/bat-server` → `No such file or directory`
   - `ss -tnlp | grep 51820`（或精靈使用的 port）→ 無輸出
6. （選）BUG-099 本身：再跑一次，讓 **start-server 自己**失敗後按取消（例如先在遠端 `mkdir -p ~/.config/systemd/user && chmod 500 ~/.config/systemd/user` 讓寫 unit 失敗）。取消後 `~/.local/bat-server` 應被移除（已完成的 install 也被 rollback），且不留 unit 檔；驗收後記得 `chmod 700 ~/.config/systemd/user`
7. （選）darwin 主機：步驟 5 改看 `launchctl list | grep com.bat-server`（無輸出）與 `ls ~/Library/LaunchAgents/com.bat-server.plist`（不存在）

### 遭遇問題 / 交塔台

1. **T0387 的「SSH fetch-fingerprint 失敗時自行關 tunnel」繞道：保留**。新 runner 只涵蓋「失敗畫面按取消」；在失敗畫面按 **skip** 或 **跳回前面步驟（jumpToStep）** 時，失敗步驟仍不會 rollback（jump 的完整 rollback 鏈是 T0309 標記的既有 TODO），移除繞道會讓 tunnel 留到精靈關閉 / app 結束。只更新了 `verify-remote.ts` 的註解
2. **白名單比 start-server 嚴格**：teardown 的 host / user 白名單比 `ssh:start-server`（`validateSshIdentifier`）窄。若使用者 `~/.ssh/config` 的 alias 含 `[A-Za-z0-9._:-]` 以外的字元，start-server 會成功但 rollback 回 `Invalid sshHost for teardown` → 只 warn、不清遠端。這是 memory_overrides 要求的取捨，如需放寬請另開單
3. **既有風險（範圍外，未改，建議塔台評估）**：
   - Docker `install-server-bundle` 在 `existing` 模式的 rollback 會在使用者自己的容器內 `rm -rf /opt/bat-server`，但這個步驟本身沒有安裝任何東西（bundle 來自 image）——已完成步驟被 rollback 時仍會發生，本單只擋掉「沿用舊路徑」的情況
   - Docker `pick-container` 在 `new` 模式會沿用 `state.dockerContainer` 既有名稱，rollback 以 `docker rm -f` 移除；若該名稱剛好是使用者既有容器會被刪除
   - Docker `start-server` 在 `existing` 模式 rollback 會 `docker stop` 使用者的容器（即使精靈開始前它就在跑）
   - `write-profile` 在 create 成功、update 失敗後按 retry，第一次建立的 profile 會遺留（`createdProfileId` 被覆寫）
4. ℹ️ `electron/main.ts` 列在 affects_files 但**未修改**：SSH IPC 一律在 `registerSshSetupHandlers()` 註冊（main 已呼叫），handler 加在 `electron/remote/ssh-setup-handlers.ts`（不在 affects_files，與 T0387 做法相同）
5. ℹ️ memory_overrides 寫「以 mock `execFile` 驗證」：既有 `ssh.startServer` / `ssh.installBundle` 皆用 `spawn` + array args，本單依「沿用其連線與 quoting 慣例」也用 `spawn`，測試改以 mock `spawn`（`StarterDeps.spawn` 注入 + `vi.mock('child_process')`）驗證 args 陣列 / 白名單 / timeout
6. ℹ️ 平行 Worker：`electron/preload.ts` / `src/types/electron.d.ts` 同時有 T0436 尚未提交的 hunk。commit 以暫存 index（`GIT_INDEX_FILE`）只套用本單 hunk 建立，再用 `git update-index --cacheinfo` 讓主 index 的這兩個項目對齊新 HEAD；**未動工作樹、未用 stash / reset / checkout / restore**，T0436 的改動仍在工作樹中未提交

### 改動檔案

- `electron/remote/ssh-start-server.ts`
- `electron/remote/ssh-setup-handlers.ts`
- `electron/preload.ts`（僅本單 hunk）
- `src/types/electron.d.ts`（僅註解）
- `src/components/setup-wizard/wizard-runner.ts`
- `src/components/setup-wizard/steps/ssh/start-server.ts`
- `src/components/setup-wizard/steps/ssh/install-server-bundle.ts`
- `src/components/setup-wizard/steps/ssh/verify-remote.ts`（僅註解）
- `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts`
- `src/components/setup-wizard/steps/docker/install-server-bundle.ts`
- `electron/__tests__/ssh-teardown.test.ts`（新）
- `electron/__tests__/preload-ssh-teardown.test.ts`（新）
- `src/components/setup-wizard/__tests__/wizard-cancel-rollback.test.ts`（新）
- `_ct-workorders/BUG-099-wizard-cancel-skips-failed-step-rollback.md`、`_ct-workorders/BUG-100-ssh-stop-server-uninstall-bundle-ipc-missing.md`（`FIXED`、`links.fix_workorder: T0426`）

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Commit

（commit 後補）

### 回報時間

（結案時補）
