---
schema_version: 1
schema_kind: workorder
id: T0379
title: "BUG-088 修復：SSH 精靈 systemd unit / launchd plist 改用絕對路徑（不留 `~`）"
type: implementation
status: DONE
priority: P1
sizing: S
created_at: "2026-10-04T21:30:23+08:00"
updated_at: "2026-10-04T21:50:29+08:00"
started_at: "2026-10-04T21:30:49+08:00"
completed_at: "2026-10-04T21:50:29+08:00"
target_version: next
depends_on: [T0378]
related:
  - "BUG-088（修復對象）"
  - "T0378（WSL 版同類修復；先讀其回報區與 commit `4d814e9` 的 `wsl-systemd.ts` / `write-systemd-unit.ts` 作為範本）"
  - "D126（WSL 版決策：絕對 `$HOME` 路徑、不留 `~`、預設不用 `%h`）"
affects_files:
  - electron/remote/ssh-start-server.ts
  - electron/remote/ssh-setup-handlers.ts
  - src/components/setup-wizard/steps/ssh/start-server.ts
  - src/components/setup-wizard/steps/ssh/configure-host.ts
  - src/components/setup-wizard/steps/ssh/install-server-bundle.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；外部輸入（host / user / path）沿用既有 `ssh-args.ts` 驗證與 escape（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 WSL 精靈（T0378 已修）不在範圍，不要改 `electron/wsl-*.ts` / `steps/wsl/*`；共用的 `SetupWizardShell.tsx` / `wizard-runner.ts` / `error-mapper.ts` 不需改動，若真要改須在回報區說明且 WSL / Docker 測試全綠。"
  - "🔴 不得刪除或重建本機 WSL 發行版 `Ubuntu-24.04`。"
  - "⚠️ 不 push。"
---

# T0379 — SSH 精靈服務檔改用絕對路徑

## 背景

T0378 修好 WSL 精靈的 systemd unit `~` 問題（BUG-087 缺陷 B）。T0378 Worker 讀碼發現 SSH 精靈有同樣的缺陷：預設 install path `~/.local/bat-server` 被原樣寫進 systemd `ExecStart` 與 launchd `ProgramArguments`，systemd 不展開 `~` ⇒ 服務起不來。

**實作前讀 BUG-088 與 T0378 回報區。**

## 決策（沿用 D126）

1. 服務定義檔（systemd unit 的 `ExecStart` / `Environment`，launchd plist 的 `ProgramArguments` 與其他路徑值）**不得出現 `~`**，一律寫出絕對路徑
2. 絕對路徑以已解析的遠端 `serverHome`（`verify-ssh-auth` 取得，已在 `StartServerOptions.serverHome`）展開 `installPath` 開頭的 `~` 或 `~/` 取得；`serverHome` 須為 `/` 開頭且通過既有驗證，否則明確報錯（不寫出壞檔）
3. 展開位置由 Worker 決定（`ssh-start-server.ts` 內 render 前展開，或精靈步驟先展開再傳入），但**最終寫出的檔案內容**必須是絕對路徑；`installPath` 已是絕對路徑（如 `/opt/bat-server`）時不變
4. 預設不用 `%h`（與 D126 一致）；修正 `renderSystemdUnit()` 內與實際行為不符的 `%h` 註解，以及 `serverHome` 「Currently informational」註解
5. 若 install / uninstall / rollback 等其他步驟也把 `installPath` 寫進**不經 shell 展開**的地方，一併修正；經 ssh 遠端 shell 執行的指令（`mkdir` / `tar` / `rm`）可維持現狀
6. launchd：Worker 確認 launchd 是否展開 `ProgramArguments` 裡的 `~`（查 Apple 文件 / `launchd.plist(5)`）；結論寫回報區。不論結論，plist 一律寫絕對路徑（零成本且確定正確）

## 驗收

- unit（新增，`ssh-start-server` 目前沒有測試）：
  - systemd unit：`installPath='~/.local/bat-server'` + `serverHome='/home/alice'` → `ExecStart=/home/alice/.local/bat-server/bin/bat-server`，內容不含 `~`
  - launchd plist：同上，`ProgramArguments` 為絕對路徑
  - `installPath='/opt/bat-server'` 不變
  - `serverHome` 缺失 / 非絕對 / 含非法字元 → 報錯、不產生檔案
  - 既有 T0297 F-005 結構字元 / XML escape 防護仍成立（若有既有測試須全綠）
  - 測試檔位置須被 `vite.config.ts` `test.include` 涵蓋（若需要匯出 render 函式供測試，可以）
- `npm run test:unit` 全綠（基線 **749**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime（建議）**：把產生的 systemd unit 寫到 `Ubuntu-24.04` 的暫存目錄，跑 `systemd-analyze --user verify <file>`（或放進 `~/.config/systemd/user/` 後 `daemon-reload` 看 `Loaded:`），確認不再出現 `Neither a valid executable name nor an absolute path`；驗完刪除暫存檔並 `daemon-reload`。執行檔不存在的錯誤屬預期
- **runtime 驗收（交使用者）**：實際 SSH 主機跑 SSH 精靈（若使用者有可用主機）

## 範圍外

- WSL 精靈（T0378 已修）、Docker 精靈
- `/opt/bat-server` sudo 安裝路徑的實作（T0286）
- macOS 實機驗證（Windows 端無法執行）

## Sub-session 執行指示

1. 讀取本工單 + `BUG-088` + T0378 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-088 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

**DONE** — SSH 精靈寫出的 systemd unit / launchd plist 以及它們的**檔案位置**一律為絕對路徑；另發現並一併修正 bundle 上傳目標同樣含字面 `~`（見「重要發現」）。unit **794/794**、vite build exit 0、tsc **40**（= baseline）；本機 `Ubuntu-24.04` `systemd-analyze --user verify` 新 unit 不再出現 `Neither a valid executable name nor an absolute path`（舊 unit 重現該錯誤）。實際 SSH 主機 runtime 驗收交使用者。

### Landing Zone

| 檢查 | 結果 |
|------|------|
| C-0 repo identity | ⚠️ WARN — frontmatter 無 `repo` 欄位（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 work order path | ✅ PASS（在 REPO_ROOT 下） |
| C-3 affects_files | ✅ PASS（前 5 個可測項全部存在） |
| C-2 branch | ℹ️ 無 `branch` 欄位；HEAD = `main` |
| `BAT_WORKSPACE_ID`（僅證據） | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b` |
| 派發 mode | `CT_MODE=on`、`CT_INTERACTIVE=0` |
| 其他 | 開工時 frontmatter `status: TODO`（非 `PENDING`），照常轉 `IN_PROGRESS` |

### 🔴 重要發現：BUG-088「經 ssh shell 的指令會展開 `~`」不成立

BUG-088 與本單決策 5 假設 `mkdir` / `tar` / `cat >` 經遠端 shell 會展開 `~`。實際上這些呼叫都把路徑放在**單引號**內，bash 不展開引號內的 `~`：

- 上傳（`electron/remote/ssh-bundle-uploader.ts`）：`mkdir -p '~/.local/bat-server' && cd '~/.local/bat-server' && tar xz` ⇒ 在 `$HOME` 下建立**名為 `~` 的目錄**，bundle 落在 `$HOME/~/.local/bat-server`
- 寫服務檔（`ssh-start-server.ts`）：`mkdir -p '~/.config/systemd/user'` + `cat > '~/.config/systemd/user/bat-server.service'` ⇒ unit 落在 `$HOME/~/.config/...`，systemd 找不到 ⇒ `enable --now` 會先以 unit not found 失敗（比 `bad-setting` 更早）
- launchd：`launchctl load -w '~/Library/LaunchAgents/...'` ⇒ 相對 cwd 的 `$HOME/~/Library/...`；即使載入成功，下次登入 launchd 掃 `~/Library/LaunchAgents` 也找不到

實證（`Ubuntu-24.04`，`HOME` 指向暫存目錄）：`bash -c "mkdir -p '~/.local/x'"` 產生 `./~/.local/x`。

依決策 5（「不經 shell 展開的地方一併修正」），單引號即不經 shell 展開，因此上傳目標與服務檔位置也改為絕對路徑。若只修 `ExecStart`，服務指向 `/home/alice/.local/bat-server/bin/bat-server`，而 bundle 實際在 `/home/alice/~/.local/bat-server`，仍然起不來。

### launchd 是否展開 `~`（決策 6 結論）

**不展開。** `launchd.plist(5)`：`ProgramArguments`「maps to the second argument of execvp(3)」，`Program` 必須為絕對路徑；缺 `Program` 時 `ProgramArguments[0]`「may be either an absolute path, or a relative path which is resolved using `_PATH_STDPATH`」。全文無任何 `~` / home 展開語意；`EnableGlobbing` 走 glob(3)（預設不含 tilde 展開，且新版 launchd 已不支援此 key）。⇒ 字面 `~/...` 會被當相對路徑而失敗。plist 一律寫絕對路徑。（未在 macOS 實機驗證，Windows 端無法執行。）

### 實作內容

| 檔案 | 改動 |
|------|------|
| `electron/remote/ssh-start-server.ts` | 新增 `resolveServerHome()`（須 `/` 開頭、符合 `/^\/[A-Za-z0-9._/-]*$/`、無 `..` 段，去尾斜線；與 T0378 WSL `resolveHome()` 同規則）、`expandHomePath()`（`~` / `~/…` → `<home>/…`；絕對路徑不變；`~user/…` 與相對路徑報錯）、`resolveInstallPath()`；`renderSystemdUnit()` 的 `ExecStart` 與 `renderLaunchdPlist()` 的 `ProgramArguments` 改用展開後路徑（仍經 `validateSystemdValue` / `escapeXml`）；`systemdUnitPath(home)` / `launchdPlistPath(home)` 改為 `<home>/.config/systemd/user/…` / `<home>/Library/LaunchAgents/…`；`startServerOnRemote()` 在任何 ssh exec **之前**驗證 `serverHome`，失敗即 throw（不寫檔；IPC handler 既有 catch 回 `errorCode: 'unknown'`）；修正 `%h` 註解與 `serverHome`「Currently informational」註解；`__internals` 匯出 `resolveServerHome` / `expandHomePath` |
| `src/components/setup-wizard/steps/ssh/remote-home.ts`（新） | renderer 端 `resolveSshServerHome()` / `resolveSshInstallPath()`，規則同上（renderer 不能 import electron 模組，故鏡像；electron 端為第二道防線） |
| `steps/ssh/install-server-bundle.ts` | 下載前解析 install path（缺 / 壞 `sshServerHome` 即報錯，不下載不上傳）；上傳到絕對路徑；`ctx.serverInstallPath` 存絕對路徑；新增 `state.sshResolvedInstallPath`，rollback 移除實際建立的絕對路徑；`state.sshInstallPath` 保留使用者原選項（configure-host 回頭編輯時選項仍對得上） |
| `steps/ssh/start-server.ts` | `ssh:start-server` 傳入解析後的絕對 `installPath` |

`configure-host.ts` 未改：`~/.local/bat-server` 為使用者可見的選項值，下游解析即可。`ssh-setup-handlers.ts` 未改（介面不變）。`ssh-bundle-uploader.ts` 未改：呼叫端已傳絕對路徑。`%h` 未採用（D126）。

### 驗收

| 證據線 | 結果 | 證據 |
|--------|------|------|
| unit（新增 45，vitest） | ✅ PASS | `electron/__tests__/ssh-start-server.test.ts`（29）：systemd `~/.local/bat-server` + `/home/alice` → `ExecStart=/home/alice/.local/bat-server/bin/bat-server`、不含 `~` / `%h`；`/opt/bat-server` 不變；尾斜線 home；展開後仍拒 `[ ] =`（F-005）；拒 `~bob/` 與相對路徑；plist `ProgramArguments` 絕對、不含 `~`、展開後仍 XML escape 並擋 `RunAsUser` 注入（F-005）；9 種壞 `serverHome`（缺 / 空 / 相對 / `~` / 空白 / `'` / `$` / 換行 / `..`）兩個 renderer 皆報錯，且 `startServerOnRemote` 0 次 ssh exec；寫檔 / `launchctl load` 路徑與 `servicePath` 為絕對。`src/components/setup-wizard/__tests__/ssh-service-paths.test.ts`（16）：helper 規則；install 步驟上傳到 `/home/alice/.local/bat-server`、`/opt` 不變、home 缺失時不下載不上傳、rollback 用絕對路徑；start-server 步驟 IPC 帶絕對路徑、壞 home 不呼叫 IPC。兩檔皆在 `vite.config.ts` `test.include` 內 |
| 反證 | ✅ | 暫時還原 3 個產品檔後，新測試 **31 failed / 14 passed**；恢復後 45/45 |
| 既有 `tests/ssh-start-server.test.ts`（node:test，非 vitest） | ✅ 19/19 | ⚠️ 工單稱「`ssh-start-server` 目前沒有測試」，實際有此舊檔（`npx tsx --test` 手動跑，不在 `test:unit`）。改前 19/19；test1/2/3/4/11f 原本斷言字面 `~`，已改為絕對路徑並加「不含 `~`」斷言，改後 19/19。F-005 / escape 相關 test7/10x/11a-e 未改且全綠 |
| 其他舊 node:test | ℹ️ | `ssh-flow` 5/5、`ssh-bundle-uploader` 8/8 PASS；`ssh-wizard-e2e` / `ssh-flow-journeys` / `wizard-rollback-cross` 在 **HEAD（未改動）即卡住逾時**（stash 實測），非本單造成、不在 gate 內 |
| `npm run test:unit` | ✅ PASS | **57 files / 794 tests** 全綠（基線 749 + 45） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline）；SSH / `remote-home` 相關零命中 |
| 本機 runtime（`Ubuntu-24.04`） | ✅ PASS | 以 `tsx` 呼叫修改後 `renderSystemdUnit()`（`serverHome=/home/gower`）產出 unit，放 `/tmp/t0379/` 跑 `systemd-analyze --user verify`：**新** → 僅 `Command /home/gower/.local/bat-server/bin/bat-server is not executable: No such file or directory`（執行檔不存在，屬預期）；**舊**（字面 `~`）→ `:9: Neither a valid executable name nor an absolute path: ~/.local/bat-server/bin/bat-server` + `Unit bat-server.service has a bad unit file setting.`（重現 BUG） |
| runtime 清理 | ✅ | 已刪 `/tmp/t0379` / `/tmp/t0379old` 與 scratchpad 產物；未寫入 `~/.config/systemd/user/`（`systemctl --user status bat-server` → `could not be found`），故無需 `daemon-reload`；未動發行版本身 |
| 實際 SSH 主機 / macOS | ⏳ 交使用者 | Windows 端無 SSH 目標與 macOS |

### 偏離 / 範圍說明

- ⚠️ **修改 `tests/ssh-start-server.test.ts`（不在 `affects_files`）**：該舊測試鎖定的正是本單要修的錯誤行為（`ExecStart=~/…`、`cat > '~/…'`），不改即與修復矛盾。只改路徑斷言，未刪任何案例。
- ⚠️ **新增 `src/components/setup-wizard/steps/ssh/remote-home.ts`（不在 `affects_files`，同目錄新檔）**：install 與 start-server 兩步驟共用的路徑解析；renderer 無法 import electron 模組。
- ⚠️ **擴大到上傳目標與服務檔位置**：依決策 5 字面規則（單引號 = 不經 shell 展開），見「重要發現」。未改 `ssh-bundle-uploader.ts`（呼叫端傳絕對路徑即可）。
- 未改 WSL / Docker 精靈、`SetupWizardShell.tsx` / `wizard-runner.ts` / `error-mapper.ts`。

### 殘餘風險 / 後續建議

1. 已用舊 build 跑過 SSH 精靈的主機，`$HOME` 下會殘留字面 `~` 目錄（內含 bundle 與 unit）；本修復不清理。建議塔台在 BUG-088 驗收說明提醒使用者手動移除 `"$HOME/~"`（**務必加引號**，裸 `rm -rf ~` 會刪掉整個 home）。
2. `window.electronAPI.ssh.uninstallBundle` / `ssh.stopServer` 只有型別宣告（T0289「Real IPC handlers land in a follow-up」），preload 無實作 ⇒ SSH 精靈 rollback 呼叫目前會失敗（被 warn-log 吞掉）。既有缺口，非本單範圍；實作時應沿用本單絕對路徑。
3. 三個舊 node:test（`ssh-wizard-e2e` / `ssh-flow-journeys` / `wizard-rollback-cross`）在 HEAD 即卡住，可能自 T0322 distributor 改寫後未維護；建議另案清理或遷入 vitest。
4. `serverHome` 白名單不接受含空白的 home（如 `/Users/John Smith`）；macOS 短名稱不含空白，實務風險低，遇到會明確報錯而非寫出壞檔。
5. SSH 精靈 linger 已帶使用者名稱（`loginctl enable-linger '<user>'`），無 BUG-087 缺陷 A。

### Commit

`git commit --only`：3 個產品檔 + `remote-home.ts` + 2 個新 vitest 檔 + `tests/ssh-start-server.test.ts` + 本工單檔（message 含 `T0379`，hash 以 `git log` 為準）。未 push；BUG-088 檔未改。
