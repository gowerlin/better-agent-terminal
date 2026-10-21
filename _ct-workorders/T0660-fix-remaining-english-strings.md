---
schema_version: 1
schema_kind: workorder
id: T0660
title: "BUG-161：精靈 step 原始錯誤訊息、復原警告、縮圖列 `suggested`、「Set as Supervisor」改走 i18n；modal 關閉鈕補 `aria-label`；評估顯示選項 description"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-161
priority: P2
sizing: M
created_at: "2026-10-18T20:24:09+08:00"
started_at: "2026-10-18T20:25:03+08:00"
updated_at: "2026-10-18T20:46:12+08:00"
completed_at: "2026-10-18T20:46:12+08:00"
depends_on: [T0652, T0658]
related:
  - "BUG-161（T0652 回報區「範圍外英文字樣」1–6、T0656 補第 6 點）；T0652（遠端畫面 i18n 的作法、`i18n-completeness.test.ts` 的 T0652 區塊、error-mapper entry 形式）；T0658（`SetupWizardShell.tsx` 已改用 `.bat-wizard-*` / `profile-action-btn`）"
  - "使用者 2026-10-18 20:2x 決定：放進 `0.7.1-pre.2`，修完再發版"
affects_files:
  - "src/components/setup-wizard/**（step 錯誤訊息改成帶 code / key、error-mapper entry、`wizard-runner.ts` 復原警告、`SetupWizardShell.tsx` 顯示選項 description（若決定顯示））"
  - "src/components/ThumbnailBar.tsx（`suggested`、「Set as Supervisor」等縮圖列 / 右鍵選單字樣）"
  - "src/components/**（只限各 modal `&times;` 關閉鈕補 `aria-label`；用既有 `common.close` key）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/**/__tests__/**、src/locales/__tests__/**、src/components/setup-wizard/__tests__/**（受影響的測試）"
  - "e2e/**（只改以文字定位、因本單失效的 locator；不改流程）"
  - _ct-workorders/T0660-fix-remaining-english-strings.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍以 BUG-161 第 1–6 點為準；開工先 grep 列出最終清單（位置 → 原文 → key / code → zh-TW / zh-CN / en）寫進回報區。第 7 點（`systemd (user)`、`launchd`、`tunnel → localhost:<port>`、`default` 等技術值）不譯。其他功能的英文字樣只列清單給塔台、不改。"
  - "🔴 **step 原始錯誤訊息**：這些字串同時用於日誌與部分測試比對。作法：step 丟出的錯誤帶穩定的 `code`（沿用既有 error-mapper 的 `errorCodes` 機制），error-mapper 依 code 選三語 title / body（必要時帶參數，例如容器名、發行版名）；**日誌與 `Error.message` 保持英文原文**（比對用、除錯用），只有使用者看到的畫面改走 i18n。`error-mapper.test.ts` 的三語齊全規則要過。不得改 step id、錯誤 code 的既有值、`data-testid`。"
  - "🔴 復原警告（`wizard-runner.ts`）：含 step title 的句子改用 i18n 參數；step title 取 i18n label（`labelKey`），沒有 key 時退回英文 title。"
  - "🔴 選項 description（BUG-161 第 5 點）：評估在 `SetupWizardShell` 顯示 `WizardChoiceOption.description`（樣式用 T0658 的 `.bat-wizard-*` 或既有 class，不引入 Tailwind / 新依賴）；若會讓版面變差或需要設計決定，就不顯示、在回報說明。"
  - "🔴 `aria-label`：各 modal 的 `&times;` 關閉鈕補 `aria-label={t('common.close')}`；只加屬性，不改行為。🔴 Dialog 規則（CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」）不變。"
  - "🔴 測試：`i18n-completeness` 三語 key 一致；error-mapper 新 entry；以文字定位的 unit / e2e 測試同步更新（e2e 只改檔；改完跑 `npx vite build` 後只跑受影響的 e2e spec，並確認沒有其他 Worker 在跑 Playwright）。不耗 token。"
  - "🔴 非隔離工單（目前沒有其他 Worker 在跑）。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0660 — 剩下的英文字樣（BUG-161）

## 背景

T0652 把遠端設定畫面的英文字樣改走 i18n，範圍外還留著：精靈 step 直接丟出的英文錯誤訊息（沒有 error-mapper entry 時原樣顯示）、`wizard-runner.ts` 的復原警告、縮圖列「+」選單的 `suggested`、縮圖右鍵選單的「Set as Supervisor」、modal 關閉鈕缺 `aria-label`、精靈不顯示選項 description。使用者決定放進 `0.7.1-pre.2` 一起發。詳見 BUG-161。

## 要做的事

1. 盤點並列最終清單。
2. 依 memory_overrides 逐項改：step 錯誤訊息（code + error-mapper）、復原警告、縮圖列字樣、`aria-label`、選項 description（評估）。
3. 測試與受影響的 e2e。
4. 截圖（不入版控，放 scratchpad）：zh-TW 介面的縮圖列「+」選單、右鍵選單，與至少一個精靈錯誤畫面（可用 unit test 的 render 或隔離實例；隔離實例不得改 `USERPROFILE` / `HOME`）。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 315 / 5467）
- `npx vite build` 成功；受影響的 e2e spec 通過

## 驗收

- BUG-161 第 1–6 點處理完（或寫明不處理的理由）；日誌與 `Error.message` 仍是英文
- 驗證全過；回報區附字串清單、範圍外英文清單（給塔台）、截圖清單、commit
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

- BUG-161 第 1–6 點全部處理；第 7 點（技術值）依工單不譯。狀態 FIXED。
- 第 1 點：精靈 step 丟出的錯誤改用 `wizardError(message, code, params?)`（`error-mapper.ts`），error-mapper 新增 32 個 entry（三語 title / body，必要時帶 `{{name}}` / `{{distro}}` 等參數；macOS / Windows 版文案用 i18next `context`：`body_darwin` / `body_win32`）。**`Error.message` 與日誌一律保持英文原文**；新 entry 多用 `hidden-by-default`（原文在「顯示詳細」內），外部輸出有診斷價值的（Docker 回報、mount 驗證、安裝 / 連線測試錯誤）用 `append-raw`。另：步驟列（Stepper）失敗列在已對應 entry 時改顯示翻譯後的 title（原本顯示英文原文）；`run()` 被拒時的錯誤框（取消、不可重試步驟失敗）也改走 i18n（`wizard.cancelled`、依 code 顯示 entry）。
- 第 2 點：`wizard-runner.ts` 兩則復原警告改用 `wizard.shared.warning.finalizeFailed` / `jumpRollbackFailed`（`{{step}}` = step 的 `labelKey` 翻譯，沒有 key 退回英文 `title`；i18next 未初始化時用原英文句）。logger 訊息不變。
- 第 3 點：`ThumbnailBar.tsx` 3 處 `suggested` 改用既有 key `profiles.addMenuSuggested`（與配置面板一致）。
- 第 4 點：modal 的 `×` 關閉鈕補 `aria-label={t('common.close')}`（21 個，只加屬性）。
- 第 5 點：**決定顯示**。`SetupWizardShell` 把有 description 的選項包成「按鈕 + 下方說明」，說明用既有 `.bat-wizard-prompt-description`，按鈕以 `aria-describedby` 連到說明，**按鈕的 accessible name 不變**（既有以名稱定位的測試 / e2e 不受影響）；沒有 description 的選項 DOM 與原本相同。版面只用 inline `flex-direction: column; max-width: 280px`，未改 CSS 檔、未引入 Tailwind / 依賴。WSL 發行版選項說明原為英文 `Running • WSL2`，改為 `wizard.wsl.pickDistro.optionDescription` + `state.Running / Stopped` 三語。
- 第 6 點：縮圖右鍵選單「Set as Supervisor」與同組「Remove Supervisor」改用 `workspace.setSupervisor` / `workspace.removeSupervisor`（位置在 `TerminalThumbnail.tsx`，即縮圖列的縮圖元件）。
- 未改 step id、既有 error code 值、`data-testid`；Dialog 關閉 / Esc 行為未變。

### Landing Zone Check

- 結果：PASS（C-3 記 INFO）
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。`CT_HOME` 未設定（非隔離工單），`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS。
- C-3：`affects_files` 為帶說明的條目，逐條取最近存在的祖先（`src/components/setup-wizard`、`src/components`、`src/locales`、`e2e`）皆存在 → present；C-0 已 PASS，僅記錄。
- C-2：無 `branch` 欄位；目前分支 `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 字串清單（位置 → 原文 → key / code → zh-TW / zh-CN；en 與原文同義）

**精靈 step 錯誤（`Error.message` 不變；表中為 title）**

| 位置 | 原文 | code | messageKey | zh-TW | zh-CN |
|---|---|---|---|---|---|
| docker `install-server-bundle` / `start-server`；wsl `wsl-systemd-check` / `install-server-bundle` / `write-systemd-unit`（4）/ `write-profile`（7）/ `connect-test`（2）/ `fetch-fingerprint`；ssh `install-server-bundle`（3）/ `start-server`（4）/ `verify-auth` / `verify-remote`（2）/ `remote-home`（$HOME 未探測） | 「Choose a Docker container before…」「Container name is missing.」「Select a WSL distro before checking systemd.」「Server port was not resolved…」「SSH host must be configured…」「Remote token missing…」等 | `wizard-precondition-missing`（`PRECONDITION_MISSING_CODE`） | `wizard.shared.error.preconditionMissing` | 前面的步驟沒有完成 | 前面的步骤没有完成 |
| wsl `write-profile`（4） | Failed to update the existing remote profile "…" / Failed to persist SSH·Docker·WSL profile metadata. | `wizard-profile-save-failed` | `wizard.shared.error.profileSaveFailed` | 無法儲存遠端配置 | 无法保存远程配置 |
| wsl `connect-test` | Connection test failed / testConnection 錯誤 | `connect-test-failed` | `wizard.shared.error.connectTestFailed` | 連線測試失敗 | 连接测试失败 |
| wsl / ssh `install-server-bundle` | installBundle / uploadBundle 錯誤 | `server-bundle-install-failed` | `wizard.shared.error.serverBundleInstallFailed` | 無法安裝 BAT 伺服器套件 | 无法安装 BAT 服务器包 |
| `server-bundle-import.ts` `distributeFailureError`（不可匯入的失敗） | `[arch-detection-failed] …` / `[baseline-corrupted] …` / `[aborted] …` | `server-bundle-distribute-failed` | `wizard.shared.error.serverBundleDistributeFailed` | 無法準備 BAT 伺服器套件 | 无法准备 BAT 服务器包 |
| docker `pick-container` | No Docker containers found. Create one first or switch to "Create new". | `docker-no-containers` | `wizard.docker.error.noContainers` | 找不到 Docker 容器 | 找不到 Docker 容器 |
| 同上 | Docker containers … through …-99 already exist… | `docker-container-names-exhausted`（`{name, last}`） | `wizard.docker.error.containerNamesExhausted` | 沒有可用的 Docker 容器名稱 | 没有可用的 Docker 容器名称 |
| docker `configure-mounts` | Select at least one host folder to mount… | `docker-mounts-none` | `wizard.docker.error.mountsNone` | 沒有選擇資料夾 | 没有选择文件夹 |
| 同上 | validateMounts 錯誤 | `docker-mounts-invalid` | `wizard.docker.error.mountsInvalid` | 選擇的資料夾無法掛載 | 选择的文件夹无法挂载 |
| docker `install-server-bundle` | Unable to inspect Docker container {name}. | `docker-inspect-failed`（`{name}`） | `wizard.docker.error.inspectFailed` | 無法讀取 Docker 容器 | 无法读取 Docker 容器 |
| docker `start-server` `claimNewContainer` | Docker container {name} already exists and was not created by this setup run… | `docker-container-not-owned`（`{name}`） | `wizard.docker.error.containerNotOwned` | Docker 容器名稱已被使用 | Docker 容器名称已被使用 |
| docker `start-server` | Failed to start Docker container {name}. / Docker 回報 | `docker-start-failed`（`{name}`） | `wizard.docker.error.startFailed` | 無法啟動 Docker 容器 | 无法启动 Docker 容器 |
| 同上 `waitForHealthy` | Failed to read Docker health for {name}. / Docker 回報 | `docker-health-unavailable`（`{name}`） | `wizard.docker.error.healthUnavailable` | 無法讀取容器的健康狀態 | 无法读取容器的健康状态 |
| 同上 | Docker container {name} reported unhealthy. | `docker-container-unhealthy`（`{name}`） | `wizard.docker.error.containerUnhealthy` | Docker 容器狀態不正常 | Docker 容器状态不正常 |
| 同上 | Timed out waiting for Docker container {name} to become healthy. | `docker-health-timeout`（`{name}`） | `wizard.docker.error.healthTimeout` | Docker 容器沒有進入正常狀態 | Docker 容器没有进入正常状态 |
| wsl `detect-env` `run()` | WSL setup is only available from the Windows BAT client. / Unable to detect WSL… | 既有 `wsl-not-on-windows` / `wsl-not-installed`（preflight 早已帶，run() 補上） | 既有 `wizard.wsl.error.notInstalled` | 找不到 WSL2 | 找不到 WSL2 |
| wsl `pick-wsl-distro` | BAT requires WSL2. Upgrade an existing distro to version 2 and retry. | `wsl-requires-wsl2` | `wizard.wsl.error.requiresWsl2` | 需要 WSL2 | 需要 WSL2 |
| wsl `resolveWslHome`、`write-systemd-unit` | Unable to resolve the home directory of the WSL user… / Expected an absolute home directory… | `wsl-home-unresolved` | `wizard.wsl.error.homeUnresolved` | 找不到 WSL 使用者的主目錄 | 找不到 WSL 用户的主目录 |
| wsl `write-systemd-unit` `takeUnitSnapshot` | Could not read the current BAT service in {distro} before changing it: … | `wsl-unit-snapshot-failed`（`{distro}`） | `wizard.wsl.error.unitSnapshotFailed` | 無法讀取目前的 BAT 服務 | 无法读取当前的 BAT 服务 |
| 同上 | Failed to write BAT systemd unit | `wsl-unit-write-failed` | `wizard.wsl.error.unitWriteFailed` | 無法寫入 BAT 服務檔 | 无法写入 BAT 服务文件 |
| 同上 `startService` | 服務啟動錯誤（既有 code，原無 entry） | 既有 `wsl-service-start-failed` | `wizard.wsl.error.serviceStartFailed` | BAT 服務沒有啟動 | BAT 服务没有启动 |
| ssh `verify-auth` | `no-ssh: Install OpenSSH client…`（依本機 OS） | 既有 `no-ssh`（`{context: process.platform}`） | `wizard.ssh.error.clientMissing`（`body` / `body_win32` / `body_darwin`） | 找不到 OpenSSH 用戶端 | 找不到 OpenSSH 客户端 |
| 同上 | `host-key: Host key verification failed…` | 既有 `host-key` | `wizard.ssh.error.hostKey` | SSH 主機金鑰驗證失敗 | SSH 主机密钥验证失败 |
| 同上 | `connect-timeout: Connection timed out…` | 既有 `connect-timeout` | `wizard.ssh.error.connectTimeout` | SSH 連線逾時 | SSH 连接超时 |
| ssh `remote-home.ts` | Server $HOME must be an absolute path… / Install path must be absolute or start with ~/… | `ssh-remote-path-invalid` | `wizard.ssh.error.remotePathInvalid` | 伺服器上的路徑無法使用 | 服务器上的路径无法使用 |
| ssh `start-server`（`startServerErrorHint` 4 種） | `unit-write-failed: …` / `enable-failed: …` / `start-failed: …` / `verify-failed: …` | 主行程既有 code（ssh-darwin 加 `{context: 'darwin'}`） | `wizard.ssh.error.unitWriteFailed` / `enableFailed` / `startCrashed` / `verifyFailed`（各含 `body_darwin`） | 無法寫入 BAT 服務檔 / 無法啟用 BAT 服務 / bat-server 啟動後就結束了 / 無法確認 bat-server 正在執行 | 无法写入 BAT 服务文件 / 无法启用 BAT 服务 / bat-server 启动后就退出了 / 无法确认 bat-server 正在运行 |
| ssh `verify-remote` `ensureSshVerifyEndpoint` | openVerifyTunnel 錯誤 | 既有 `ssh-tunnel-failed` / `ssh-tunnel-invalid-input` | `wizard.ssh.error.tunnelFailed` | 無法開啟 SSH tunnel | 无法打开 SSH tunnel |
| ssh `verify-remote` `crossCheckFingerprint` | TLS fingerprint … does not match the remote bat-server certificate… | 既有 `fingerprint-mismatch` | `wizard.ssh.error.fingerprintMismatch` | 連到了另一個伺服器 | 连到了另一个服务器 |

**其他**

| 位置 | 原文 | key | zh-TW | zh-CN |
|---|---|---|---|---|
| `wizard-runner.ts` finalize 警告 | Could not finish cleaning up after "<title>": <error> | `wizard.shared.warning.finalizeFailed` | 「{{step}}」之後的清理沒有完成：{{error}} | “{{step}}”之后的清理没有完成：{{error}} |
| `wizard-runner.ts` jump 回退警告 | Could not undo "<title>" before going back: <error> | `wizard.shared.warning.jumpRollbackFailed` | 回到前面的步驟之前，無法復原「{{step}}」：{{error}} | 回到前面的步骤之前，无法撤销“{{step}}”：{{error}} |
| `SetupWizardShell` 錯誤框（取消） | Wizard cancelled | `wizard.cancelled` | 已取消設定。 | 已取消设置。 |
| `pick-wsl-distro` 選項說明 | `${state} • WSL${version}` | `wizard.wsl.pickDistro.optionDescription` + `state.Running` / `state.Stopped` | 執行中 / 已停止 | 运行中 / 已停止 |
| `ThumbnailBar.tsx` ×3 | suggested | 既有 `profiles.addMenuSuggested` | 建議 | （既有） |
| `TerminalThumbnail.tsx` 右鍵 | Set as Supervisor / Remove Supervisor | `workspace.setSupervisor` / `workspace.removeSupervisor` | 設為監督者 / 移除監督者 | 设为监督者 / 移除监督者 |
| 21 個 modal `×` | （無 accessible name） | 既有 `common.close`（aria-label） | 關閉（既有） | （既有） |

`aria-label` 補在：`ClaudeAgentPanel.tsx` ×6、`CodexAgentPanel.tsx` ×6（`.claude-plan-modal-close`）、`ProfilePanel.tsx` ×4、`profiles/EditRemoteProfileModal.tsx`（`.settings-close`）、`AboutPanel.tsx`、`SettingsPanel.tsx`（Settings 標頭）、`SnippetPanel.tsx`（`.close-btn`）、`WorkspaceEnvDialog.tsx`（`.dialog-close-btn`）、`PathLinker.tsx`（`.path-preview-close`）。

### 範圍外英文字樣（給塔台，未處理）

1. `MainPanel.tsx:106` 監督者徽章 `title="Supervisor"`；`TerminalThumbnail.tsx` 通知點 `title="New notification"`。
2. `ClaudeAgentPanel.tsx:3720` / `CodexAgentPanel.tsx:4100` Cache History 的「Clear」按鈕與 `title="Clear history"`（與關閉鈕同 class）。
3. `SettingsPanel.tsx:640` 自訂 CLI 列 `×` 刪除鈕 `title="Remove"`；`PathLinker.tsx` 搜尋鈕 `title="Search (Ctrl+F)"`。
4. 非 modal 的 `×`：`CtToast.tsx`、`UpdateNotification.tsx`（無 aria-label）；附件移除鈕 / PromptBox 圖片移除 / Claude 路徑提示已有 `title` 或 aria-label，未動。
5. 精靈：`ssh/configure-host.ts` `INSTALL_PATH_OPTIONS` 的英文 label / description（含「T0286」字樣；目前沒有傳給 `requestChoice`，畫面看不到，但若日後改用會連內部工單號一起顯示）；runner 的 `Preflight check failed` / `preflight warning: <step.id>` 後備字串；SSH 各 hint 英文原文仍在「顯示詳細」的原始錯誤內（設計如此）；ssh `start-server` 主行程回 `unknown` 等其他 code 仍走 fallback（標題已翻譯、內文英文）；finalize / rollback 自身丟的英文錯誤以 `{{error}}` 原文帶入警告句。
6. 文件：`docs/agent-guide/` 沒有精靈錯誤 code 的說明頁，未新增（不在 `affects_files`）。

### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| unit | PASS | `npm run test:unit`：**317 files passed、5597 passed、3 skipped**（exit 0；基線 315 / 5467）。新增 `src/components/setup-wizard/__tests__/step-error-i18n.test.tsx`（51 項：wizardError、36 組 code → entry 對照、參數插值、context 變體、各 step 實際丟出的 code 與不變的英文 message、runner params / 翻譯警告、Shell 選項說明 / 步驟列 title / 取消文字 / 不可重試錯誤框）與 `src/components/__tests__/t0660-english-strings.test.ts`（source guard：`suggested` / Supervisor 走 i18n、9 檔 modal `×` 都有 aria-label）；`i18n-completeness.test.ts` 加 T0660 區塊（新 key 三語非空、6 個根節點三語 key 集合相同、警告保留 `{{step}}` / `{{error}}`）；`error-mapper.test.ts` 既有「每個 entry 三語 title / body」對 32 個新 entry 通過 |
| 受影響測試 | 已更新 | `integration.mapped-ux.test.tsx`（步驟列也顯示 mapped title → 改 `findAllByText`）、`server-bundle-import.test.tsx`（不可匯入的失敗改帶 `server-bundle-distribute-failed`） |
| build | PASS | `npx vite build` exit 0 |
| e2e | PASS | `e2e/t0644-open-claude-as-tower.spec.ts`（「+」選單 `suggested` 改走 i18n，locator regex 補 `建議\|建议`）隔離實例 1 passed。執行前確認沒有其他 Playwright 程序。其他 e2e 以 class 定位關閉鈕（`.settings-close` / `.close-btn`），或以 `name: '×'` 定位 `.main-panel` 的按鈕（未改），不受影響；不耗 token（該 spec 的 claude 只跑 `--version`） |
| runtime smoke（zh-TW） | PASS（部分） | 隔離實例（zh-TW）以暫時腳本拍照，見截圖清單。log：`suggested tag: 建議`、`context menu: ◧ 向左分割 \| ◨ 向右分割 \| 👁 設為監督者`、精靈步驟列 `未偵測到 Docker daemon`（原為英文原始錯誤）、取消後錯誤框 `已取消設定。`。本機 Docker daemon 未啟動、`electronAPI` 由 contextBridge 暴露無法替換，所以**新 entry（如 `docker-no-containers`）與 Docker 模式選項說明沒有實機截圖**，由 unit test 以 render 涵蓋。WSL / SSH 精靈未拍（會動到本機 WSL / 會拍到 SSH 別名） |

驗證時 HEAD = `0198c36e`（非隔離工單，工作樹含本單未 commit 的變更）；之後的 commit `a5caf04a` 只收這些變更，未再改內容。

### 截圖清單（不入版控，scratchpad）

目錄：`<使用者資料夾>\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\fe6bd4ed-c06d-42cb-9589-96976a3fb05a\scratchpad\shots\out\`

1. `1-add-menu-zh-TW.png`：縮圖列「+」選單，`建議` 標籤
2. `2-thumbnail-context-menu-zh-TW.png`：縮圖右鍵選單「👁 設為監督者」
3. `3-docker-wizard-error-zh-TW.png`：Docker 精靈 detect-env 失敗，步驟列與詳細面板皆為中文標題，原始英文在詳細區
4. `4-docker-wizard-cancelled-zh-TW.png`：按取消後錯誤框「已取消設定。」

暫時腳本放在 gitignore 的 `e2e-results/t0660-shots/`，用完已刪除；隔離實例的 userData 由 fixture 移除（`runtime userData removed: true`、Terminal Server 已結束）。截圖 3、4 背景的終端分頁縮圖可看到本機 temp 路徑（只在 scratchpad，未入版控）。

### Commit

- 產品：`a5caf04a` fix: wizard step errors, recovery warnings and thumbnail labels follow the UI language (T0660, BUG-161)（41 檔；`git commit --only`，未含 `src/styles/settings.css`）
- 工單：本檔另一個 commit
- 未 push

### 偏差

- 「Set as Supervisor」實際位置是 `TerminalThumbnail.tsx`（縮圖列的子元件），不是 `ThumbnailBar.tsx`；依工單意圖（縮圖列 / 右鍵選單字樣）改在該檔。
- 選項說明的版面用 inline style + 既有 class，未改 `src/styles/setup-wizard.css`（不在 `affects_files`）。
- 步驟列失敗列改顯示 mapped title、`run()` 被拒的錯誤框改走 i18n、`detect-env` run() 補既有 code、`distributeFailureError` 補 code：都屬第 1 點「使用者看到的英文原始錯誤」，原清單未逐條列出。

### 遭遇問題

- 無阻斷。`electronAPI` 不可替換，無法在實機觸發新 entry，改由 unit test 涵蓋（見驗證）。

### 互動紀錄

無（yolo，未向塔台提問）。
