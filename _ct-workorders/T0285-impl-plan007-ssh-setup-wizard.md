# T0285 — Impl PLAN-007 SSH setup wizard（configure-ssh-host + verify-ssh-auth + install-server-bundle）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0285 |
| 類型 | impl |
| Phase | PLAN-007 Phase 4（SSH deployment）第四張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 14:48 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | L（spec 估 8-16h；GP099 校準後預期 wall 30-90 min — 3 個 wizard step + UI + IPC handler + ssh+tar pipe） |
| 依賴 | T0282（SshPathTranslator + ssh-config-parser）✅、T0283（server bundle linux-x64 tarball 已可產出）✅、T0284（SshTunnel 可選用，本工單不必依賴 tunnel runtime） |
| 後續 | T0286（systemd unit + launchd plist，依本工單 install-server-bundle 完成後產出 server-side install path）、T0287（SSH e2e + cross-OS matrix） |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-setup-handlers.ts`（新建，IPC handlers）、`electron/remote/ssh-auth-probe.ts`（新建，純函數 probe）、`electron/remote/ssh-bundle-uploader.ts`（新建，ssh+tar pipe）、`src/components/setup-wizard/SshConfigureHostStep.tsx`（新建）、`src/components/setup-wizard/SshVerifyAuthStep.tsx`（新建）、`src/components/setup-wizard/SshInstallBundleStep.tsx`（新建）、`tests/ssh-auth-probe.test.ts`（新建）、`tests/ssh-bundle-uploader.test.ts`（新建） |

## 目標

落地 T0266 §7 + spec §6 wizard 凍結 step：

1. **`configure-ssh-host`**（UI step）— host / user / port / identity / ssh-config alias dropdown / install path / tunnel mode 設定
2. **`verify-ssh-auth`**（UI + 後端 probe）— `ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new <user@host> 'echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME'` → parse output → 自動補 profile `targetOS` / `serverHome`
3. **`install-server-bundle`**（UI + 後端 upload）— `ssh user@host 'mkdir -p <installPath> && cd <installPath> && tar xz'` 並 pipe local tarball stdin，client 監聽 byte 累計推進度條

## 範圍

### 新增

#### 後端（electron/remote/）

1. **`ssh-auth-probe.ts`** — verify-ssh-auth 後端純函數
   - `export async function probeSshAuth(opts: SshProbeOptions): Promise<SshProbeResult>`
   - opts：`sshHost / sshUser / sshPort? / sshKeyPath?`
   - result：`{ ok: boolean; serverPlatform?: 'linux' | 'darwin'; serverArch?: string; serverHome?: string; sshExecPath?: string; error?: string; errorCode?: 'no-ssh' | 'permission-denied' | 'host-key' | 'connect-timeout' | 'unknown' }`
   - 流程：
     1. `which ssh`（Win 用 `where ssh`）→ 找不到 → `errorCode: 'no-ssh'`
     2. spawn ssh args：`['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', ...portArg, ...keyArg, `${user}@${host}`, 'echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME']`
     3. parse stdout：
        - 含 `BAT_AUTH_OK` → 解 `uname -sm` 行（如 `Linux x86_64`）→ `serverPlatform = 'linux' | 'darwin'`、`serverArch = 'x86_64' | 'arm64'`
        - 解 `HOME=...` 行 → `serverHome`
     4. parse stderr 對應 errorCode
     5. 沿用 D042 secure spawn pattern（dynamic-import + execFile / spawn 不過 shell）
2. **`ssh-bundle-uploader.ts`** — install-server-bundle 後端
   - `export async function uploadServerBundle(opts: UploadOptions, onProgress: (bytesSent: number, totalBytes: number) => void): Promise<void>`
   - opts：`sshHost / sshUser / sshPort? / sshKeyPath? / installPath / tarballPath`
   - 流程：
     1. spawn `ssh ... user@host 'mkdir -p <installPath> && cd <installPath> && tar xz'`
     2. fs.createReadStream(tarballPath) → 監聽 `data` 事件累計 bytesSent → 呼叫 onProgress
     3. pipe 到 ssh stdin
     4. 等 ssh exit code 0 → resolve；非 0 → reject with stderr
     5. **不**用 scp / rsync（D-SSH-4 拍板 v1 用 ssh+tar）
3. **`ssh-setup-handlers.ts`** — IPC handler 統合
   - `ssh:probe-auth` channel：呼叫 `probeSshAuth` 回 result
   - `ssh:upload-bundle` channel：呼叫 `uploadServerBundle`，progress 透過既有 IPC `setup-wizard:progress` event 推送（**不新增 channel**，T0270 凍結 channel set）
   - **守則**：所有新 IPC channel 必須在 spec doc / T0270 凍結清單內；若需要新事件，包在既有 `setup-wizard:*` channel 的 `eventType` payload 區分

#### 前端（src/components/setup-wizard/）

4. **`SshConfigureHostStep.tsx`**
   - Form：Host / Port / User（或 user@host 一格）/ Identity file（Browse 按鈕，預設「auto via ssh-agent」）/ Install path radio（`~/.local/bat-server` recommended | `/opt/bat-server` advanced）/ Tunnel mode radio（Tunnel recommended | Direct advanced）
   - Dropdown：呼叫 `ssh:list-hosts` IPC（沿用 T0282 `listSshHosts()`，IPC handler 在本工單建）→ list `~/.ssh/config` 的 alias，選了 alias → 自動填 host 欄位、其他欄位灰掉（OpenSSH 自己解析）
   - 寫入 wizard ctx（不寫 profile，profile commit 在 wizard 結束）
5. **`SshVerifyAuthStep.tsx`**
   - mount 後立即呼叫 `ssh:probe-auth` IPC
   - 顯示動態進度：「⏳ Testing connection to alice@server...」→ `✓ ssh executable found` / `✓ Connection established (3.2s)` / `✓ Server platform: linux x86_64` / `✓ Server home: /home/alice`
   - errorCode === `'no-ssh'` → 顯示「請安裝 OpenSSH client」+ 平台對應指令（macOS 預裝 / Linux apt install / Windows 用 Settings → Optional Features）
   - errorCode === `'permission-denied'` → modal：[A] Generate new key（將 ssh-keygen 命令 + 公鑰內容 copy-to-clipboard 給使用者）/ [B] Use existing key（Browse → 重新 verify）/ [C] Cancel
   - errorCode === `'host-key'` → 提示手動接受 + retry
   - 成功 → 寫入 wizard ctx 的 `targetOS` / `serverHome`（從 probe result 補）
6. **`SshInstallBundleStep.tsx`**
   - mount 後立即呼叫 `ssh:upload-bundle` IPC（傳本機 tarball 路徑：BAT 內建 v1 = `app.getPath('userData')/server-bundle/bat-server-linux-x64-v*.tar.gz`，由 BAT 安裝包 ship；尋找邏輯：grep 既有 ELECTRON / userData pattern）
   - 顯示進度條：bytes / total bytes、% 、speed（bytes per sec），ETA
   - 失敗 → 顯示 stderr + 「Retry」/「Cancel」按鈕

#### 測試

7. **`tests/ssh-auth-probe.test.ts`** — node:test runner，沿用 T0284 `SshTunnelDeps` 注入風格
   - 沒 ssh → `errorCode: 'no-ssh'`
   - permission denied stderr → `errorCode: 'permission-denied'`
   - host key 缺 → `errorCode: 'host-key'`
   - timeout → `errorCode: 'connect-timeout'`
   - 成功 stdout 含 `BAT_AUTH_OK\nLinux x86_64\nHOME=/home/alice` → result `{ ok, serverPlatform: 'linux', serverArch: 'x86_64', serverHome: '/home/alice' }`
   - darwin uname `Darwin arm64` → `serverPlatform: 'darwin', serverArch: 'arm64'`
   - 至少 6 個 case
8. **`tests/ssh-bundle-uploader.test.ts`** — 同上
   - mock spawn ssh + 大檔案 stream → 確認 progress callback 累計
   - ssh exit code 0 → resolve
   - ssh exit code != 0 → reject + stderr
   - 至少 4 個 case

### Out of scope（不做）

- ❌ 不寫 systemd / launchd unit（留 T0286）
- ❌ 不動 connect-test step / fetch-fingerprint step（PLAN-018 已落，沿用既有）
- ❌ 不寫 SSH key generation / ssh-keygen 自動執行（D-SSH-7 拍板：v1 only 顯示 ssh-keygen 命令給使用者複製，不在 BAT 內 spawn keygen）
- ❌ 不引入 ssh2 npm（D-SSH-1 拍板）
- ❌ 不新增 IPC channel（T0270 凍結 channel set；新事件包在既有 `setup-wizard:*` 內）
- ❌ 不寫 windowsHosting OpenSSH server / WSL1 /Win-as-server 變體
- ❌ 不寫 jump host UI（D-SSH-5：透過 ssh-config 透明支援）
- ❌ 不寫 sudo `/opt/bat-server` 安裝邏輯（D-SSH-8 拍板 opt-in，但本工單只實作 `~/.local/bat-server`，sudo path 留 T0286）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §7 §6 C-1 | wizard step interface 凍結 + IPC channel 凍結清單 |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §7（L734-893） | wizard 三個 step 完整 spec：UI mockup + 指令序列 + 兩個 user journey |
| `_ct-workorders/T0274-impl-plan007-wsl-setup-wizard-steps-1-4.md` | WSL wizard 既有結構參考（component pattern + IPC handler pattern） |
| `_ct-workorders/T0279-impl-plan007-docker-setup-wizard.md` | Docker wizard 既有結構參考（lifecycle modal + configure-mounts） |
| `electron/remote/ssh-config-parser.ts`（T0282 產出） | `listSshHosts()` 已備，本工單只需加 IPC handler 暴露給前端 |
| `electron/profile-manager.ts`（T0282 後） | ProfileEntry 全 SSH 欄位已備（含 serverHome） |
| `tests/ssh-tunnel.test.ts`（T0284 產出） | mock spawn 注入式測試風格範本 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-auth-probe.ts` 存在，export `probeSshAuth(opts)` | grep + 檔案存在 |
| AC2 | `probeSshAuth` 解 `BAT_AUTH_OK` + uname + HOME 正確（6 個 test case ≥ pass） | 跑 ssh-auth-probe.test.ts |
| AC3 | `electron/remote/ssh-bundle-uploader.ts` 存在，export `uploadServerBundle(opts, onProgress)` | grep + 檔案存在 |
| AC4 | `uploadServerBundle` progress callback 累計 byte sent 正確（4 個 test case ≥ pass） | 跑 ssh-bundle-uploader.test.ts |
| AC5 | 三個 wizard step component 存在（SshConfigureHostStep / SshVerifyAuthStep / SshInstallBundleStep） | grep src/components/setup-wizard/ |
| AC6 | `configure-ssh-host` UI 含 ssh-config alias dropdown，呼叫 `ssh:list-hosts` IPC（沿用 T0282 `listSshHosts()`） | grep + visual review |
| AC7 | `verify-ssh-auth` 在 errorCode='permission-denied' / 'no-ssh' / 'host-key' 都顯示對應引導 modal | grep + 程式碼 review |
| AC8 | **不新增 IPC channel**：所有新事件包在既有 `setup-wizard:*` channel 內（T0270 凍結 channel set） | grep `ipcMain.handle` 確認新增 channel 數 ≤ 3（`ssh:probe-auth` / `ssh:upload-bundle` / `ssh:list-hosts`，皆為新 namespace 不破既有 channel） |
| AC9 | 進度條：upload 期間 UI 顯示 bytes / total / % / speed / ETA | visual review + grep `Bytes\|speed\|ETA` |
| AC10 | TypeScript strict 編譯通過（除 baseline BUG-061 豁免）；所有 test pass（`npx tsx tests/ssh-auth-probe.test.ts && npx tsx tests/ssh-bundle-uploader.test.ts`） | 跑指令 |

> **AC8 註**：T0266 §7 spec 凍結 step 名稱為 `configure-ssh-host` / `verify-ssh-auth` / `install-server-bundle`，對應 IPC channel 命名 `ssh:probe-auth` / `ssh:upload-bundle` / `ssh:list-hosts` 為**新 namespace** 不衝突 T0270 channel set（T0270 凍結的是 `wsl:*` / `docker:*` / `setup-wizard:*` 等命名）。Worker 確認時若 channel set 凍結文件未列 `ssh:*` namespace 即可放心新增。

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0285 SSH setup wizard (configure-host + verify-auth + install-bundle)\n\n工單：T0285\n依賴：T0282 / T0283 / T0284\n落地 T0266 §7 凍結 spec`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0285-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除 wizard UI 顯示 ⏳ ✓ ✗ 外禁用。
6. **Channel set 凍結**：T0270 凍結 channel set，**禁止新增 wsl:* / docker:* / setup-wizard:* / tunnel:* 等既有 namespace 的 channel**；`ssh:*` 是新 namespace 可加（共 3 channel：probe-auth / upload-bundle / list-hosts）。
7. **不引 ssh2 npm**：D-SSH-1 拍板。
8. **不真連 ssh**：tests 必須 mock spawn，禁止真連任何 ssh host（與 T0284 同原則）。
9. **D042 secure spawn**：所有 spawn ssh 走 dynamic-import + execFile / spawn 不過 shell pattern（沿用 T0284 SshTunnel）。
10. **不寫 ssh-keygen 自動執行**：D-SSH-7；`SshVerifyAuthStep` 在 permission-denied modal 只顯示 `ssh-keygen -t ed25519` 命令文字 + copy-to-clipboard，**不**在 BAT 內 spawn keygen。
11. **completion 判定**：10 個 AC 全過或 ≥ 8 → 完成訊息 `T0285 完成`，否則 `T0285 部分完成：<AC# + 原因>`。

## 預期 wall

**30-90 min**（GP099 校準後；T0266 §7 給 UI mockup + 指令序列 + 兩個 user journey 完整 spec，主要工作為 React component 寫作 + IPC handler glue + 兩個 mock test）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0285 完成」訊息後從本檔讀回報區）
