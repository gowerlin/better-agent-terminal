# PLAN-007 — Remote Dev Support Spec (Consolidated)

**Status**: ✅ Frozen for PLAN-007 PLANNED upgrade
**Date**: 2026-04-25
**Source workorders**: T0260 / T0261 / T0262 / T0263 / T0264 / T0265 / T0266 — all DONE
**Decision authority**: T0267 (PLAN-007 spec consolidation)
**Audience**: Implementation worker(s) for PLAN-007 phase 1+

> **約定**：本文件是 6 張 research 工單的「凝練版」。設計分支理由詳見原工單；本文件只記錄**最終結論 + 入口指標**。所有 commit hash 引用為 `main` branch 上的最新點。

---

## 1. Vision & Scope

### 1.1 框架翻轉

PLAN-007 把 BAT 從「桌面 client + 內嵌 server」單體擴展為「**client/server 解耦 + server 跨環境部署**」：

- **Client** 仍是 Electron 桌面 app（Windows / macOS / Linux）
- **Server** 拆出為 headless Node 進程，可獨立跑在 4 種拓樸下
- **Transport** 沿用 PLAN-018 凍結的 `wss + token + cert pinning (TOFU)`

### 1.2 4 環境覆蓋（v1）

| targetOS | 拓樸 | client OS | server OS | 主場景 |
|----------|------|-----------|-----------|--------|
| `local` | 單機（沿用今日 BAT） | * | 同 client | 預設 |
| `wsl-linux` | Win 桌面 + WSL2 | Win | Ubuntu/Debian inside WSL2 | Win 開發者「Linux 工具鏈，Win UI」 |
| `docker-linux` | 桌面 + 本地 Docker | * | container in Docker Desktop / Engine | dev container / 實驗環境 |
| `ssh-linux` / `ssh-darwin` | 桌面 + 遠端 host | * | Linux x64/arm64 / macOS arm64 | VPS / dev VM / 工作室 NAS |

### 1.3 Out of scope（v1 明示排除）

- Windows 跨機 SSH server（OpenSSH ConPTY 不穩，T0260 / T0266 §3）
- WSL1（無 systemd、PTY corner bugs，T0263 §5）
- iOS / Android client（無 Electron runtime）
- Server-side voice (whisper-node-addon hard exclude，T0263 §1 / T0264 §5)
- Apple Silicon 原生 arm64 docker server bundle（Docker Desktop emulation 已涵蓋；T0265 §5）
- 跨 host docker（docker host 偵測限本機 + Tailscale；T0265 §4）
- Jump host 顯式 UI（透明走 `~/.ssh/config` ProxyJump；T0266 §1 / D-SSH-5）
- darwin-x64 server bundle（Intel Mac dev box 比例 < 20%；T0266 §3）
- ssh certificate auth（YAGNI，key + agent 已涵蓋；T0266 §1）
- BAT-managed reverse tunnel（client 一般無公網；T0266 §5 選項 C）

### 1.4 與既有 PLAN 關係

| PLAN | 關係 |
|------|------|
| PLAN-018 (Tailscale + cert pinning) | 已交付。本 PLAN 沿用其 wss + TOFU + safeStorage 抽象。 |
| PLAN-005 (electron-builder 26 升級) | 已交付。server bundle pipeline 沿用本 release path 的 npm ci / verify scripts，但**獨立 workflow**（見 §5.1）。 |
| PLAN-027 (Claude runtime router) | 已交付。內嵌 vs system claude 機制延伸到 server 端：每個 deployment 內各自 router（§3 / §5.4）。 |
| PLAN-016 (Electron 41) | 已交付。Node 24 ABI 145 → server bundle 內嵌同版 node。 |

---

## 2. Cross-environment Architecture（共通）

> 凍結來源：T0264 §1-§6（commit `92af5c7`）

### 2.1 `targetOS` profile schema（凍結）

5 值 discriminated union：

```typescript
export type TargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'
```

`ProfileEntry` 採 **flat schema** 加欄位（非嵌套 union），既有 BAT remote profile 漸進升級：

```typescript
interface ProfileEntry {
  // 既有
  id: string; name: string
  type: 'local' | 'remote'
  remoteHost?: string; remotePort?: number; remoteToken?: string
  remoteFingerprint?: string; remoteProfileId?: string
  // 新增
  targetOS?: TargetOS                  // type='remote' 必填；type='local' 一律 'local'
  // per-OS metadata（依 targetOS 解讀）
  wslDistro?: string                   // wsl-linux
  dockerContainer?: string             // docker-linux
  dockerHost?: string                  // docker-linux (預設本機 docker daemon)
  sshHost?: string; sshUser?: string   // ssh-*
  sshPort?: number; sshKeyPath?: string
  useSshTunnel?: boolean               // ssh-* 預設 true（T0266 §5）
  tunnelLocalPort?: number             // ssh-* 預設動態挑空 port
  createdAt: number; updatedAt: number
}

// runtime helper
declare function extractTargetOSMeta(entry: ProfileEntry): TargetOSMetadata
```

**Migration 策略**（C-2 拍板，見 §6）：**被動 + UI 提示**雙軌。
- `profile-manager.ts` load 時若 `entry.targetOS === undefined`：
  - `type='local'` → 自動補 `'local'`（updatedAt 不變）
  - `type='remote'` → 不補；視為 legacy → 走 `IdentityTranslator`（等同今日 BAT remote）
- ProfilePanel 編輯 legacy remote profile 時跳 inline 提示「請選擇 targetOS」，不阻擋使用。

### 2.2 PathTranslator 框架（凍結）

```typescript
export interface PathTranslator {
  toServer(clientPath: string): string
  toClient(serverPath: string): string
  owns(path: string): boolean
}
```

5 種 implementation（D-SSH-6 拍板：SSH 統一一個 translator，見 §6）：

| Translator | targetOS | 來源 |
|-----------|----------|------|
| `IdentityTranslator` | `local` / legacy remote | T0264 §2 |
| `WslPathTranslator(distro)` | `wsl-linux` | T0263 §3（純函數 `winToWsl/wslToWin`）+ T0264 wrap |
| `DockerPathTranslator(mounts)` | `docker-linux` | T0265 §2（強化版含長前綴排序、Win path 規範化） |
| `SshPathTranslator(clientHome, serverHome, clientIsWindows)` | `ssh-linux` / `ssh-darwin` | T0266 §6（單一 class 處理 linux + darwin） |

註冊：`createTranslator(profile)` factory 走 switch on `profile.targetOS`。

`RemoteClient` middleware 兩個 channel set（T0264 §2）：
- `PATH_AWARE_CHANNELS`：client→server 翻譯（`fs:readdir`、`git:diff`、`pty:create cwd`、`workspace:save` …）
- `PATH_RETURNING_CHANNELS`：server→client 翻譯（`fs:readdir`、`fs:stat`、`git:status`、`pty:get-cwd`、event `fs:changed`）

### 2.3 Server bundle pipeline（凍結）

**策略**：esbuild 獨立 bundle + 內嵌 node 24.x prebuilt + native module 重 build（T0264 §3 策略 B）。

**v1 三 platform binaries**：

| target | runner | arch via | 備註 |
|--------|--------|---------|------|
| `linux-x64` | `ubuntu-22.04` | native | glibc 2.35（§2.5） |
| `linux-arm64` | `ubuntu-22.04` + QEMU | docker/setup-qemu-action | build 時間 +10 min |
| `darwin-arm64` | `macos-14` | native | macOS 11+，post-install 清 quarantine（T0266 §3） |

**Bundle manifest**（共通骨架，per-target 換 native binary）：

```
bat-server-<target>-v0.X.Y.tar.gz/
├── bin/
│   ├── node                     # 24.x prebuilt for target
│   └── bat-server               # esbuild bundled JS entry (3-5 MB)
├── node_modules/                # 重 build 過的 native modules
│   ├── @lydell/node-pty + node-pty-<target>/
│   ├── better-sqlite3/
│   ├── @img/sharp + sharp-<target>/
│   ├── @anthropic-ai/claude-code/      # embedded runtime（D027 同設計）
│   └── @anthropic-ai/claude-agent-sdk/
├── electron/remote/             # server entry + handlers
├── handlers/                    # IPC handler 純 JS（renderer-agnostic）
└── README.md                    # version / glibc lower bound / arch / SHA-256
```

**Hard exclude**（C-6 拍板）：
- `@kutalia/whisper-node-addon`（無音訊；雙層排除：esbuild externals + extraResources filter）
- 跨平台 sharp / node-pty binary（只留對應 target）
- `electron`、`xterm`、`@xterm/*`、`src/**`（renderer-only）

**驗證**：CI pipeline 加 `verify-server-bundle.js`（仿 `verify-native-modules.js` / `verify-helper-bundle.js`）grep `node_modules` 確認 whisper 不存在，存在即 abort（C-6）。

### 2.4 `auth-result.serverPlatform` metadata（凍結）

```typescript
interface AuthResultMetadata {
  serverPlatform: 'win32' | 'linux' | 'darwin'    // os.platform()
  serverArch: 'x64' | 'arm64'                       // os.arch()
  serverEnv?: 'native' | 'wsl' | 'docker' | 'ssh'   // server 自宣告
  // per-env extras
  wslDistro?: string                                // serverEnv='wsl'
  dockerMounts?: Array<{ host: string; container: string }>
  serverHome?: string                               // serverEnv='ssh'
  // runtime
  nodeVersion: string
  claudeVersion?: string                            // runtime router 偵測（D027）
  bundleVersion: string                             // server bundle release 對齊
  glibcVersion?: string                             // linux only
}
```

**`auth-result.result`** 從 `boolean` 擴成 `true | AuthResultMetadata`（向下相容：`true` → `IdentityTranslator` fallback）。

**Fingerprint 不 bind serverEnv**（cert 屬於 server instance，env 是 deployment artifact；wsl→docker 同機保留 fingerprint）。

### 2.5 Native module 相容性 baseline（凍結）

| Module | local | wsl-linux | docker-linux | ssh-linux | ssh-darwin |
|--------|-------|-----------|--------------|-----------|-----------|
| `@lydell/node-pty` | ✅ | ✅ x64 | ✅ x64 | ✅ x64/arm64 | ✅ arm64 |
| `better-sqlite3` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@img/sharp-*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@kutalia/whisper-node-addon` | ✅ | ❌ exclude | ❌ exclude | ❌ exclude | ❌ exclude |
| `@anthropic-ai/claude-code` | ✅ | ✅ | ✅ | ✅ | ✅ |

**glibc 下限：2.35**（Ubuntu 22.04+ / Debian 12+，T0264 §5）— Setup wizard 第 1 步 `ldd --version` 偵測，<2.35 警告 + 升級提示。

**Node runtime：內嵌 24.x prebuilt**（不依賴 server 系統 node；ABI 對齊 BAT Electron 41）。

### 2.6 Setup wizard framework（凍結）

```typescript
interface WizardStep {
  id: string
  title: string
  appliesTo: TargetOS[] | 'all'
  run(ctx: WizardContext): Promise<void>
  rollback?(ctx: WizardContext): Promise<void>
  retryable?: boolean   // 預設 true
}
```

**共通 7 步驟**（`appliesTo: 'all'` 或多 OS）：

| ID | appliesTo | 主要動作 |
|----|-----------|---------|
| `detect-env` | all | 偵測 client OS、必要工具（wsl.exe / docker / ssh） |
| `install-server-bundle` | all remote | 下載 tarball / push / 解壓 |
| `start-server` | all remote | 啟 `bat-server` headless（依環境透過 wsl/docker/ssh） |
| `fetch-fingerprint` | all remote | TOFU 寫入 profile |
| `write-profile` | all | profile-manager.create |
| `connect-test` | all | RemoteClient 連線 + auth + metadata |
| `done` | all | 顯示 server metadata 摘要 |

**deployment-specific hooks**：
- WSL：`pick-wsl-distro` / `wsl-systemd-check`
- Docker：`pick-container` / `configure-mounts`
- SSH：`configure-ssh-host` / `verify-ssh-auth`

**Rollback 行為**（C-3 拍板，見 §6）：**best-effort + step-level explicit rollback**。

---

## 3. Server-side hardening

> 凍結來源：T0262 §1-§7（commit `6477cf9`）；EXP-HEADLESS-001 / T0261（commit 在 spike worktree，已 CONCLUDED）

### 3.1 `createHeadlessServer` factory contract

```typescript
interface HeadlessServerOptions {
  dataDir: string                              // required
  port: number                                 // required
  token?: string                               // 自帶 or factory load/generate
  bindInterface?: BindInterface                // default 'localhost'
  secretStrategy?: SecretStrategy              // auto-detect (electron→plaintext)
  certificateProvider?: CertificateProvider    // default file-based selfsigned 10y auto-renew
  handlers?: HeadlessHandlerRegistration[]
  logger?: { log; warn; error }
}

interface HeadlessServer {
  start(): Promise<StartServerResult>
  stop(): Promise<void>
  rotateToken(opts?: { gracePeriodMs?: number }): Promise<{ token; oldToken; oldValidUntil }>
  renewCertificate(): Promise<{ fingerprint; expiresAt }>
  getInfo(): HeadlessServerInfo
}

declare function createHeadlessServer(opts: HeadlessServerOptions): Promise<HeadlessServer>
```

**Factory 而非 class**（T0262 §1.1）：裝配責任，內部仍 `new RemoteServer()` wrap。`setSecretStrategy()` 仍是 process singleton；多 instance 場景 caller 顯式重設。

### 3.2 Token persistence 跨平台

| Platform | Default path | 備註 |
|----------|--------------|------|
| Linux | `${XDG_DATA_HOME:-$HOME/.local/share}/bat-server/` | XDG 規範 |
| macOS | `${XDG_DATA_HOME:-$HOME/Library/Application Support}/bat-server/` | 同 |
| Windows | `%LOCALAPPDATA%\bat-server\` | 不用 `%APPDATA%`（避免 OneDrive sync） |
| Docker | **強制** `--data-dir` 或 `BAT_SERVER_DATA_DIR`，**no fallback** | container 必須 mount volume |
| WSL | 同 Linux + 警告 dataDir 在 `/mnt/c/...`（NTFS perm 不可靠） | |

**優先序**：`--data-dir` flag > `BAT_SERVER_DATA_DIR` env > platform default > error。

**多 instance 互斥**：`dataDir/lockfile.pid` 寫入 pid + start time，pid alive 即 fail-fast。

### 3.3 Cert renewal — daily check + atomic swap

- `setInterval(24h)` + `--renew-now` CLI subcommand 雙保險
- Renewal flow：`expiresAt - now < 90d` → 重產 → `fs.renameSync(tmp → file)` atomic → `httpsServer.setSecureContext({ cert, key })` 熱換
- `cert:renewed` PROXIED_EVENT broadcast → client auto-update `profile.remoteFingerprint` + 非阻斷 toast
- 雙 cert grace（SNICallback）標 future（v1 不做）

### 3.4 Token rotation — dual-window 5min grace

- `rotateToken({ gracePeriodMs = 300_000 })` 回 `{ token, oldToken, oldValidUntil }`
- Server 同時接受 newToken + oldToken（直到 `oldValidUntil`）
- `token:rotated` event → client 更新 profile，下次 reconnect 用新 token

### 3.5 Multi-client session 隔離 — per-connection-as-session

- 每個 wss connection 自帶 `windowId` (uuid)
- `RemoteHandlerContext.windowId` 注入 handler；handler 自行責任 window-scoped state（既有 BAT pattern）
- Session lifecycle 不持久化（reconnect = new session；pty/workspace state 走 client persistence layer）

### 3.6 Heartbeat — client-driven 雙向 timeout

- Client `setInterval(30s)` ping，server 60s 無 ping 視為 dead → close connection
- Server `pong` 每次回；client 無 pong 90s 視為 dead → reconnect chain
- 既有 `RemoteClient.ts` 改 ping interval + dead detection；server 加 timestamp tracking

### 3.7 bind-interface 5 選項 + TLS error 9 分類

```typescript
type BindInterface = 'localhost' | 'tailscale' | 'all' | 'ip:<addr>' | 'unix-socket'
```

| 選項 | 適用 | fail-safe |
|------|------|-----------|
| `localhost` (預設) | local + wsl mirrored + docker host network | safe |
| `tailscale` | ssh / Tailscale mesh | fail-closed（找不到 ts0/utun → error） |
| `all` (`0.0.0.0`) | LAN 公開 | warn-loud |
| `ip:1.2.3.4` | 顯式 NIC | validate IP exists |
| `unix-socket` | local IPC bundle / SSH stdio fallback | dataDir 內 socket |

**TLS error 細化**（T0262 §7）：cert expired / CN mismatch / chain break / fingerprint mismatch / handshake timeout / bad ALPN / closed notify / unknown CA / protocol version → 9 分類，client 端 toast 對應動作（pin / reconnect / re-pair）。

---

## 4. Per-environment Specs

### 4.1 WSL2 deployment

> 凍結來源：T0263 §1-§7（commit `afb34a0`）

**啟動方式**：A（user-level systemd unit）+ D（hint UX 兜底）。
- `~/.config/systemd/user/bat-server.service` + `loginctl enable-linger`
- 使用者沒設 systemd 時，client 第一次連線跳 modal「要不要 `wsl exec` 啟動？」

**WSL2 only**（拒 WSL1，§1.3）。

**網路模式**：預設假設 mirrored（Win 11 23H2+），對 NAT 給降級提示「請切 mirrored 或手動填 WSL IP」；NAT 自動 IP 同步 P2 增強。

**Path translation**：`winToWsl/wslToWin` **純字串實作**（不 shell-out `wslpath`）：
- `C:\foo\bar` ↔ `/mnt/c/foo/bar`
- `\\wsl.localhost\Ubuntu\home\user\x` ↔ `/home/user/x`

**PTY env baseline**：BAT host 不傳整個 `process.env`；server 端固化最小集（`HOME` `USER` `PATH` `LANG` `SHELL` `TERM` `PWD` `XDG_*`） + BAT 自加（`BAT_SESSION` `BAT_REMOTE_PORT` `DISABLE_AUTOUPDATER` `LANG=en_US.UTF-8`）。**不向 PTY 子行程注入 token**（隔離）。

**Packaging**：MVP 手動下載 `bat-server-linux-x64.tar.gz` + P1 wizard 一鍵 `wsl exec tar xz`；不上 npm registry。

**UX**：8-step wizard（[1] type pick / [2] `wsl -l -v` distro / [3] systemd check / [4] mirrored vs NAT / [5] install bundle / [6] poll handshake / [7] TOFU fingerprint / [8] connect-test）。3 個 user journey（happy / NAT mode / 跨 distro 切換）。

### 4.2 Docker deployment

> 凍結來源：T0265 §1-§8（commit `055d8e2`）

**Base image**：`debian:bookworm-slim`（glibc 2.36，已涵蓋 baseline；保留 shell + apt 方便 wizard 注入）。Pin via `debian:12-slim` + digest。

**Mount strategy**：選項 A（wizard 顯式輸入 `host → /workspace/<basename>`）。選項 C（自動偵測 + UI 確認）標 v2。

**DockerPathTranslator** v1 production 版（強化過的 T0264 §2 簡化版）：長前綴優先排序、Win path normalize（lowercase drive + slash）、case-insensitive。

**Container lifecycle**：模式 A（使用者既有 container，`docker exec`） + 模式 B（wizard 創 `--name bat-server-<profileId>` `--restart=unless-stopped`） v1 並存，預設 B。模式 C（BAT 完管 lifecycle）排除。

**Permission**：v1 預設 root；v2 `--user $UID:$GID` opt-in。

**Docker host**：v1 限本機 docker daemon（`docker --version` + `docker info`）；TCP/SSH socket 排除（§1.3）。

**Multi-arch**：v1 僅 `linux/amd64`；arm64 標 future（Docker Desktop emulation 已涵蓋多數 dev 場景）。

**Health check**：Dockerfile `HEALTHCHECK CMD curl -fk https://127.0.0.1:${BAT_PORT}/health || exit 1` + RemoteClient 主動 keepalive 雙保險。

**SDK vs CLI**：使用 docker CLI spawn（與 `dockerode` SDK 對 build 大小、版本相容性權衡 — CLI 是「使用者既有 toolchain」哲學）。

**UX**：wizard `pick-container`（既有 / 新建二按鈕） + `configure-mounts`（host 資料夾 picker → container path 預設 `/workspace/<basename>`）。

### 4.3 SSH deployment

> 凍結來源：T0266 §1-§9（commit `496fba4`）

**Auth**：系統 `ssh` CLI（不嵌 ssh2 套件）。沿用 `~/.ssh/config` / agent / FIDO2 透明。v1 限 key + agent forwarding 單跳；password / cert auth / jump host 顯式 UI 排除（§1.3）。

**Bundle 上傳**：`ssh + tar` 主路徑（流式，70-100 MB）+ scp/sftp fallback。rsync detected → v2 fast path with `--partial`。中斷恢復 v1 = 整包重傳。Server 解壓位置 `~/.local/bat-server/`（預設）/ `/opt/bat-server/`（需 sudo opt-in）。

**Server matrix**：v1 `linux-x64` + `linux-arm64` + `darwin-arm64`。darwin-x64 / FreeBSD / Win SSH 排除。

**啟動方式**：systemd（linux）+ launchd（darwin）+ nohup fallback（minimal SSH host）。restart 對齊 docker `unless-stopped` 語意（crash → restart；正常 stop → 不 restart）。

**Persistent connection**：v1 SSH local port forward（`ssh -N -L <localPort>:localhost:<remotePort> -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes`）為主路徑 + 直連 wss 為 advanced opt-in（profile.useSshTunnel toggle）。Reverse tunnel / stdio 排除。

**SshPathTranslator**（D-SSH-6：單一 class 而非 `SshLinuxPathTranslator` + `SshDarwinPathTranslator`）：
- `clientHome` ↔ `serverHome` prefix swap
- `clientIsWindows: true` 時 backslash ↔ slash 雙向轉
- Linux + darwin server 邏輯一致（POSIX path）；只差 home prefix（`/home/x` vs `/Users/x`）

**斷線恢復**：BAT `RemoteClient` reconnect chain 第一步檢查 `SshTunnel`，已死先 tunnel 重建。Exponential backoff 與 wss 共用。連續 5 次失敗 → modal 「SSH tunnel 無法建立」+ 提供「切換 profile」/「直連模式」按鈕。

**安全**：ssh-agent forwarding 預設 off + advanced 開（D-SSH-7）；sudo 安裝 `/opt/bat-server` opt-in（D-SSH-8）。

**UX**：wizard `configure-ssh-host`（host + port + key / 自動偵測 `~/.ssh/config` Host alias） + `verify-ssh-auth`（spawn ssh + parse `uname -sm` + 抓 server platform / serverHome）。

---

## 5. Cross-cutting Risks & Mitigation

> 來源：T0266 §C 7 條（commit `496fba4`）+ T0267 補。

### 5.1 Server bundle CI matrix 爆炸

- **風險**：v1 三 ssh platform + linux-x64（wsl/docker 共用）+ docker image = 4 + 1 = 5 種 artifact，CI release time 從 ~15 → ~30 min（QEMU build linux-arm64 是主要拖累 +10 min）。
- **Mitigation**：**獨立 server-bundle workflow**（C-1 拍板）— 與 desktop release 解耦。Tag push 觸發兩個 parallel workflow，desktop release 不被 server build 阻塞。
- **CI 監控**：每 release 紀錄 server-bundle workflow duration；>45 min 觸發優化任務。

### 5.2 Profile schema migration tax

- **風險**：legacy remote profile（`type='remote'` 但 `targetOS=undefined`）誤入 IdentityTranslator 路徑時，跨 OS path 操作會 silent fail。
- **Mitigation**：被動 + UI 提示雙軌（C-2 拍板，§2.1）。第一張實作 PLAN（cross-env 共通框架）含完整 migration unit test（covers `local` 自動補、`remote` 維持 undefined 走 IdentityTranslator、ProfilePanel inline prompt 三場景）。

### 5.3 Wizard step rollback baseline

- **風險**：`install-server-bundle` 失敗時不清 `~/.local/bat-server/`、`pick-container` 失敗不 `docker rm`，殘留垃圾。
- **Mitigation**：**best-effort + step-level explicit rollback**（C-3 拍板）。每 deployment 各自 rollback 行為見 §6 C-3。
- **驗收**：每張實作工單必須在 AC 列「rollback step 已實作 + 失敗測試通過」。

### 5.4 Runtime router 跨環境 claude 版本 mismatch

- **風險**：BAT 內嵌 claude（`@anthropic-ai/claude-code ^2.1.111`，PLAN-027）vs server-side 使用者另裝的 claude，版本差異可能導致行為不一致。
- **Mitigation**：**版本警告 only**（C-4 拍板）。`auth-result.metadata.claudeVersion` 與 client 比對：
  - `<2.0.0` → 阻擋連線（runtime 不相容）
  - `2.x.x` 但與 client major.minor 不同 → 顯示非阻斷 toast「server claude X.Y.Z, client A.B.C — 部分功能可能不一致」
  - 同 major.minor → 透明
- 不強版本一致（會把使用者鎖在 BAT release 節奏，違反 D027 哲學）。

### 5.5 Path translation 盲區

- **風險**：symlink target / git submodule 跨 mount / OneDrive placeholder 等 edge cases 在 4 種 translator 下行為不一致。
- **Mitigation**：**跨環境共通 contract test suite**（C-5 拍板）。建立 `electron/remote/__tests__/path-translator.contract.test.ts`，每個 translator 必須通過同一組 test fixtures（10+ edge cases）。每張 translator 實作工單 AC 含「contract test 全綠」。

### 5.6 Whisper exclude 驗證

- **風險**：T0264 §5 寫 hard exclude，但 server bundle build script 真的雙層排除（esbuild externals + extraResources filter）需 CI 自動驗。
- **Mitigation**：**CI 自動 grep + release checklist 雙保險**（C-6 拍板）。
  - 自動：`scripts/verify-server-bundle.js` 解壓 tarball → grep `whisper` → 存在即 abort
  - 手動：release checklist 加「server bundle 驗證 — 已通過 verify-server-bundle.js ✅」

### 5.7 ProfilePanel UI 跨環境一致性

- **風險**：4 種 deployment 的 metadata 顯示元件若獨立寫，UI drift；若強共用，又難容納各 env 特殊欄位（distro / mounts / sshHost）。
- **Mitigation**：**共用骨架 + per-env slot**（C-7 拍板）。
  - 共用：`<ProfileCard>` 顯示 type / targetOS / fingerprint / lastConnected / serverPlatform
  - Per-env：`<ProfileCardEnvDetails>` slot 接受 `targetOS-specific` 子元件（`<WslDetails>` / `<DockerDetails>` / `<SshDetails>`）
  - 共用樣式 token / icon / status badge

---

## 6. Open Decisions (RFCs)

> 本工單拍板 8 個 RFC，每個 100-200 字記錄。

### C-1 CI matrix 切割

**決策**：**獨立 server-bundle workflow**（與 desktop release pipeline 解耦）。

**理由**：5 種 artifact 加進 desktop release pipeline 會把 release time 從 15 拉到 30+ min（linux-arm64 QEMU 為主要拖累），且 server bundle bug 不該阻塞 desktop release（兩者 release cadence 可不同）。獨立 workflow 給 server-bundle 自己的 tag pattern（如 `vX.Y.Z+server`）或同 tag 並行觸發。

**實作影響**：新建 `.github/workflows/server-bundle.yml`，3 個 matrix job（linux-x64 / linux-arm64 / darwin-arm64）。tag push 同時觸發 desktop pre-release.yml 與 server-bundle.yml。Release notes 內合併兩者 artifacts。

### C-2 Profile schema migration

**決策**：**被動 migration + UI 提示**（雙軌）。

**理由**：強制 migration（load 時即補 targetOS）對 legacy remote profile 容易誤判（不知該補 wsl 還是 ssh），靜默誤判即 silent failure；純 UI 提示則讓使用者繼續用 IdentityTranslator 直到主動編輯。雙軌兼顧：local profile 自動補（明確 `'local'`），remote 留 undefined 走 IdentityTranslator + UI inline prompt。

**實作影響**：`profile-manager.ts` load 加 hook；`ProfilePanel.tsx` 編輯 legacy remote profile 時顯示 inline 「請選 targetOS」。第一張實作 PLAN 含 migration unit test。

### C-3 Wizard step rollback baseline

**決策**：**best-effort + step-level explicit rollback**（每 deployment 各自實作；強制 atomic 排除）。

**理由**：強制 atomic（all-or-nothing）等於要求 wizard 內建 transaction；對 docker run / ssh+tar 等不可 rollback 的副作用是 over-engineering。Best-effort 路徑：每 step 自帶可選 `rollback()`，wizard runner 失敗時反向跑 completed steps 的 rollback；rollback 自身 fail 只 log 不阻塞。

**Per-deployment rollback 行為**：

| Step | rollback 動作 |
|------|--------------|
| `install-server-bundle` (wsl) | `wsl -d <distro> -e rm -rf ~/.local/bat-server/` |
| `install-server-bundle` (ssh) | `ssh user@host rm -rf ~/.local/bat-server/`（不動 `/opt/bat-server`，sudo 場景留給使用者） |
| `pick-container` (docker, 新建模式) | `docker rm -f bat-server-<profileId>` |
| `pick-container` (docker, 既有模式) | no-op（不動使用者既有 container） |
| `start-server` (wsl) | `systemctl --user disable --now bat-server` |
| `write-profile` | profile-manager.delete（最後一步失敗才會跑到這裡） |

**實作影響**：每張實作工單 AC 加「rollback step 有測試 + 失敗測試通過」。

### C-4 Claude runtime cross-env 相容

**決策**：**警告 only（不強版本一致）**。

**理由**：強版本一致（rejecting 連線）把使用者鎖在 BAT release 節奏，違反 D027「reuse 使用者既有 toolchain」哲學；完全不檢查（任由 mismatch）又會在 server claude < 2.0 時 silent break。中間道：< 2.0 阻擋（不相容硬下限），同 major.minor 透明，其他組合 toast 警告。

**實作影響**：`auth-result` 收 metadata 後 client 端比對 `claudeVersion`：
- 解析失敗 / undefined → 警告但允許連線
- `<2.0.0` → 阻擋 + modal 「server claude 版本過舊（< 2.0），請升級」
- major.minor 不同 → toast「server claude X.Y, client A.B — 部分功能可能不一致」
- 否則透明

### C-5 Path translator contract test

**決策**：**跨環境共通 test suite**（一套 fixtures，4 種 translator 各自必過）。

**理由**：4 個 translator 各自寫 test 容易 drift（symlink / case-sensitivity / OneDrive 一個 translator 處理另一個漏）。共通 suite 強制 design parity，新增 translator 時必加 fixtures，誰漏 case 立刻紅。

**實作影響**：建立 `electron/remote/__tests__/path-translator.contract.test.ts`：

```typescript
describe.each([
  ['Identity', () => new IdentityTranslator()],
  ['Wsl',      () => new WslPathTranslator('Ubuntu')],
  ['Docker',   () => new DockerPathTranslator([{ host: 'C:\\projects', container: '/workspace' }])],
  ['Ssh',      () => new SshPathTranslator('C:\\Users\\Alice', '/home/alice', true)],
])('Translator: %s', (name, factory) => {
  it('toServer/toClient round-trip preserves owned paths', ...)
  it('owns() agrees with toServer behavior', ...)
  it('non-owned paths pass through unchanged', ...)
  it('handles trailing slash consistently', ...)
  // ... 10+ fixtures
})
```

每張 translator 實作工單 AC 含「contract test 全綠 + 至少 2 個 unique-to-this-translator test」。

### C-6 Whisper exclude 驗證

**決策**：**CI 自動 grep + release checklist 雙保險**。

**理由**：純 CI 自動易在 build script 變動時被 silent skip（如 verify script 路徑改）；純 manual checklist 在 release 多時被略過。雙軌：CI fail-fast + checklist 顯式追蹤。

**實作影響**：
1. 新增 `scripts/verify-server-bundle.js`：解壓 tarball → 找 `whisper` substring → 存在即 abort（仿 `verify-native-modules.js` / `verify-helper-bundle.js`）
2. server-bundle workflow 在 upload-artifact 前跑 verify
3. `CLAUDE.md` 「Packaging / Release 前置檢查」段加 server bundle 驗證項
4. 對應實作工單寫進「Release 驗收必跑」flow

### C-7 ProfilePanel UI 跨環境一致性

**決策**：**共用骨架 + per-env slot**。

**理由**：純獨立 component 在 4 種 profile 切換時視覺斷裂；強統一介面對 SSH 的 host alias / Docker mount table / WSL distro 列表這類 env-unique 資訊難容納。組合：共用 `<ProfileCard>` 處理 type / targetOS / fingerprint / lastConnected / serverPlatform / runtime version；per-env `<ProfileCardDetails>` slot 接特化 component。

**實作影響**：
- 新增 `src/components/profiles/ProfileCard.tsx`（共用）+ `ProfileCardDetails.tsx`（dispatcher）+ `details/{Wsl,Docker,Ssh,Local}Details.tsx`
- ProfilePanel.tsx 重構為「列卡片 + 點開展開」，舊 inline form 改為 modal
- 共用樣式 token：status color（green/yellow/red/grey）、env icon（💻🐧🐳🔐）、fingerprint 縮寫顯示

### D-SSH-6 Translator 命名

**決策**：**改名 `SshPathTranslator`**（取代 T0264 §1 預留的 `SshLinuxPathTranslator`）。

**理由**：T0266 §6 證明 ssh-linux 與 ssh-darwin 翻譯邏輯只差 `serverHome` constructor 參數（`/home/x` vs `/Users/x`），共用一個 class 即可。`targetOS` 仍保留 `ssh-linux | ssh-darwin` 兩值（discriminator 仍需，影響 wizard step / metadata UI）。

**實作影響**：
- T0264 §1.2 spec 註解標「← T0267 D-SSH-6 修正：translator 改 `SshPathTranslator`」
- 不新增 `SshDarwinPathTranslator`
- `createTranslator(profile)` switch 兩個 case fall-through：`case 'ssh-linux': case 'ssh-darwin': return new SshPathTranslator(...)`

---

## 7. MVP Roadmap & 工單拆解

5 Phase，22-30 工程日（含風險係數 30-40d）。

### Phase 1 — Cross-env 共通框架（5-7d）

凍結 §2 的 6 節為可運行 code。第一張實作 PLAN 含 schema migration unit test（C-2 mitigation）。**無外部 deployment 風險，純內部抽象**。

### Phase 2 — WSL deployment（3-4d，風險最低）

複用 Phase 1 抽象 + WslPathTranslator + systemd unit。**debug 環境最近**（local Win + WSL2），是首選試水溫的 deployment。

### Phase 3 — Docker deployment（5-6d）

container lifecycle + mount UI 較重。base image bookworm-slim + 模式 A/B lifecycle + 顯式 mount。

### Phase 4 — SSH deployment（6-8d，跨 OS matrix 最複雜）

3 個 server bundle target（linux-x64 / linux-arm64 / darwin-arm64） + ssh tunnel + 跨 OS path translation。CI matrix 與 release pipeline 解耦在此 phase 落地。

### Phase 5 — 整合測試 + UX polish（3-5d）

- 4 環境 e2e（每環境 happy path + 1 failure recovery）
- ProfilePanel UI polish（C-7）
- 文件：使用者手冊 + troubleshooting guide
- Release checklist 加 server bundle 驗證項

**合計**：22-30 工程日（單人專注），含風險係數 30-40d（first-of-kind multi-deployment 系統）。

**派單建議**：Phase 1 第一張（T0268）即 cross-env P1，**其後立刻開 WSL S1（T0273 估）以驗 cross-env 抽象在實際 deployment 下不漏**（avoid bigbang Phase 2-4 才發現 §2 漏洞）。

---

## 8. Implementation Backlog（藍圖）

藍圖卡 22 張，編號 T0268+ 預留（實際工單由塔台 PLANNED 後逐張開）。

### Phase 1: Cross-env 共通框架

```
T0268: targetOS profile schema + migration
- Phase: 1
- 範圍: ProfileEntry 加 targetOS / wslDistro / dockerContainer / sshHost / sshUser / sshPort / sshKeyPath / useSshTunnel / tunnelLocalPort 欄位；profile-manager.ts load 加被動 migration（local 自動補、remote 維持 undefined）；extractTargetOSMeta helper；ProfilePanel inline prompt for legacy remote
- Sizing: M (4-8h)
- 依賴: 無
- AC: schema 涵蓋 5 個 targetOS / migration unit test 三場景全綠 / legacy remote profile 仍可連線（IdentityTranslator）

T0269: PathTranslator interface + IdentityTranslator + contract test scaffold
- Phase: 1
- 範圍: electron/remote/path-translator.ts；contract test fixtures（10+ edge cases）；createTranslator factory（先只認 local + legacy）；RemoteClient 不接入（下張）
- Sizing: M (4-8h)
- 依賴: T0268
- AC: contract test 全綠 / IdentityTranslator round-trip 不失真 / 不影響既有 BAT remote 連線

T0270: RemoteClient middleware + auth-result metadata 擴充
- Phase: 1
- 範圍: PATH_AWARE_CHANNELS / PATH_RETURNING_CHANNELS 兩 set；RemoteClient.invoke 加 translator 中間件；onEvent 翻譯 fs:changed payload；protocol.ts AuthResultMetadata schema；server 啟動 emit metadata
- Sizing: L (8-16h)
- 依賴: T0269
- AC: BAT remote (legacy) 連線仍透明 / metadata 帶回後 createTranslator 可選對應 / 既有 fs:watch e2e 不破

T0271: Server bundle pipeline (linux-x64 baseline)
- Phase: 1
- 範圍: scripts/build-server-bundle.mjs（esbuild + 內嵌 node 24 + native rebuild）；package.json build:server-bundle；hard exclude whisper / cross-platform binaries；scripts/verify-server-bundle.js（grep whisper → abort）
- Sizing: L (8-16h)
- 依賴: 無（與 T0268-T0270 並行）
- AC: bat-server-linux-x64-vX.Y.Z.tar.gz 產出 70-100 MB / verify-server-bundle 通過 / tar 解壓後可手動跑 bat-server --version

T0272: createHeadlessServer factory
- Phase: 1
- 範圍: electron/remote/headless-entry.ts；HeadlessServerOptions / HeadlessServer interface；factory 內 wrap RemoteServer + handler pre-register；scripts/bat-server.mjs CLI entry；lockfile.pid 互斥
- Sizing: L (8-16h)
- 依賴: T0271
- AC: bat-server CLI 啟動 + stop 乾淨 / 多 instance fail-fast / token 持久化跨 platform 路徑正確
```

### Phase 2: WSL deployment

```
T0273: WslPathTranslator + wsl-path 純函數整合
- Phase: 2
- 範圍: WslPathTranslator class wraps T0263 純函數；contract test 補 WSL fixtures（drive letter / UNC / 中文路徑 / long path）；createTranslator switch 加 wsl-linux case
- Sizing: M (4-8h)
- 依賴: T0269 / T0270
- AC: contract test 全綠 / drive letter case-insensitive / `\\wsl.localhost` 與 `\\wsl$` legacy 雙向

T0274: WSL setup wizard (steps 1-4 + UI shell)
- Phase: 2
- 範圍: wizard runner（src/components/setup-wizard/）；detect-env / pick-wsl-distro / wsl-systemd-check / install-server-bundle steps；progress UI；rollback chain 骨架
- Sizing: L (8-16h)
- 依賴: T0271
- AC: wsl -l -v parsing / 偵測 systemd / 透過 wsl exec 解壓 tarball / rollback 清 ~/.local/bat-server

T0275: WSL setup wizard (steps 5-7 + systemd unit)
- Phase: 2
- 範圍: 寫 ~/.config/systemd/user/bat-server.service；loginctl enable-linger；fetch-fingerprint TOFU；connect-test；done step
- Sizing: M (4-8h)
- 依賴: T0274 / T0272
- AC: systemd unit 啟動 + restart on failure / fingerprint TOFU 寫入 profile / connect-test 收 metadata

T0276: WSL e2e + 3 user journeys
- Phase: 2
- 範圍: e2e Playwright/Chrome DevTools 跑 happy path（mirrored mode）+ NAT mode 降級提示 + 跨 distro 切換；Documentation
- Sizing: M (4-8h)
- 依賴: T0275
- AC: 3 user journey e2e 全綠 / docs 含 mirrored mode 設定 / WSL1 警告流程驗證
```

### Phase 3: Docker deployment

```
T0277: DockerPathTranslator (production-grade)
- Phase: 3
- 範圍: 強化版 DockerPathTranslator（長前綴排序 / Win path normalize / case-insensitive drive letter）；contract test 補 docker fixtures（多 mount / Windows host path / 跨 mount root path）
- Sizing: M (4-8h)
- 依賴: T0269
- AC: contract test 全綠 / 多 mount 排序正確 / Windows host C:\ vs c:\ 同視

T0278: Docker base image + Dockerfile + multi-arch baseline
- Phase: 3
- 範圍: docker/Dockerfile（debian:bookworm-slim + COPY bat-server bundle + HEALTHCHECK）；docker build --platform linux/amd64；image push 到 ghcr.io 或 BAT release（待塔台拍板）
- Sizing: M (4-8h)
- 依賴: T0271
- AC: docker run -d 起得來 / HEALTHCHECK 通過 / image size <300 MB

T0279: Docker setup wizard (lifecycle 模式 A + B + configure-mounts)
- Phase: 3
- 範圍: pick-container step（既有 / 新建二按鈕）；configure-mounts step（host folder picker → container path）；container lifecycle UI（start / stop / logs / health）；rollback (docker rm 模式 B)
- Sizing: L (8-16h)
- 依賴: T0277 / T0278
- AC: 模式 A 既有 container 連入 / 模式 B 新建 container 完整流程 / mount 表正確進 metadata

T0280: Docker e2e + lifecycle scenarios
- Phase: 3
- 範圍: e2e cover 模式 A + 模式 B + container restart / host reboot recovery；docs 含 dev container 整合範例
- Sizing: M (4-8h)
- 依賴: T0279
- AC: e2e 全綠 / unless-stopped 行為驗證 / docs cover Docker Desktop + Docker Engine
```

### Phase 4: SSH deployment

```
T0281: SshPathTranslator + ssh-config alias parser
- Phase: 4
- 範圍: SshPathTranslator class（單一 class，D-SSH-6 落地）；ssh-config-parser.ts（lightweight Host alias listing）；contract test 補 ssh fixtures（cross-OS home / Win client / non-home path）
- Sizing: M (4-8h)
- 依賴: T0269
- AC: contract test 全綠 / Windows client backslash 雙向轉 / non-home path pass-through

T0282: Server bundle pipeline (linux-arm64 + darwin-arm64)
- Phase: 4
- 範圍: build-server-bundle 加 --target flag；CI matrix（linux-x64 / linux-arm64 via QEMU / darwin-arm64 native）；server-bundle 獨立 workflow（C-1 落地）；artifact upload 到 GitHub Release
- Sizing: L (8-16h)
- 依賴: T0271
- AC: 3 個 target tarball 產出 / verify-server-bundle 全綠 / workflow 與 desktop release 並行不阻塞

T0283: SshTunnel class + reconnect 整合
- Phase: 4
- 範圍: electron/remote/ssh-tunnel.ts（spawn ssh -N -L + ServerAlive + ExitOnForwardFailure）；stderr 解錯誤；polling 連 127.0.0.1:<localPort>；exit event → RemoteClient reconnect chain
- Sizing: L (8-16h)
- 依賴: T0270
- AC: tunnel 起得來 / 斷線自動重建 / 5 次失敗 modal 切 profile / 手動切換 useSshTunnel=false 走直連

T0284: SSH setup wizard (configure-ssh-host + verify-ssh-auth + bundle 上傳)
- Phase: 4
- 範圍: configure-ssh-host UI（host / port / key / install path / tunnel mode）；verify-ssh-auth step（spawn ssh + uname -sm + serverHome 抓取）；ssh + tar 上傳 bundle；rollback (ssh rm -rf ~/.local/bat-server)
- Sizing: L (8-16h)
- 依賴: T0282 / T0283
- AC: ssh-config Host alias 偵測 / FIDO2 hardware key 連線 / 進度條準確 / rollback 清理乾淨

T0285: systemd unit + launchd plist (Linux + macOS)
- Phase: 4
- 範圍: linux server: systemd unit 寫入 + enable + linger；darwin server: launchd plist + launchctl load；macOS quarantine 清理（xattr -d）
- Sizing: M (4-8h)
- 依賴: T0284
- AC: linux restart=on-failure 驗證 / macOS launchd KeepAlive 驗證 / quarantine 一次性清乾淨

T0286: SSH e2e + cross-OS matrix
- Phase: 4
- 範圍: e2e 跑 linux-x64 + linux-arm64 + darwin-arm64 三 server target；tunnel mode + 直連 mode 各驗 1 case；docs 含 ~/.ssh/config 整合範例
- Sizing: L (8-16h)
- 依賴: T0285
- AC: 3 platform e2e 全綠 / tunnel reconnect 場景驗證 / docs cover 1Password agent / FIDO2 / jump host 透明走 ProxyJump
```

### Phase 5: 整合測試 + UX polish

```
T0287: ProfilePanel UI 重構（C-7 落地）
- Phase: 5
- 範圍: ProfileCard / ProfileCardDetails / details/{Wsl,Docker,Ssh,Local}Details.tsx；共用 status / icon / fingerprint badge；舊 inline form 改 modal
- Sizing: L (8-16h)
- 依賴: T0276 / T0280 / T0286
- AC: 4 種 profile 視覺一致 / per-env 特化資訊正確顯示 / 既有 profile CRUD 操作不破

T0288: Setup wizard rollback contract + cross-deployment test
- Phase: 5
- 範圍: rollback chain unit + integration test cover 4 種 deployment 各 step；wizard cancel mid-flight scenario；rollback fail 不阻塞 cancel 行為
- Sizing: M (4-8h)
- 依賴: T0276 / T0280 / T0286
- AC: 每 step rollback 至少 1 happy + 1 failure 測試 / rollback fail log 清晰 / wizard cancel 後 profile-manager 無垃圾

T0289: Documentation + release checklist 更新
- Phase: 5
- 範圍: docs/remote-dev-support.md（4 環境 setup 手冊）；CLAUDE.md「Packaging / Release 前置檢查」加 server bundle 驗證；release checklist 加 server bundle workflow 完成項
- Sizing: M (4-8h)
- 依賴: T0287 / T0288
- AC: docs 涵蓋 4 環境 + troubleshooting / release checklist 可直接跑 / claude runtime version mismatch warning 行為文件化

T0290: End-to-end smoke test + migration verification
- Phase: 5
- 範圍: 既有 BAT remote (legacy) profile load → 自動 IdentityTranslator → 連線正常；4 種新 profile 創建 + 連線 + 一個 fs:watch + 一個 git diff + 一個 pty open；migration 三場景 e2e
- Sizing: M (4-8h)
- 依賴: T0287 / T0288 / T0289
- AC: smoke test 全綠 / legacy profile 不破 / 4 環境同時開機（多 profile）功能不互相干擾
```

**合計藍圖**：23 張（Phase 1: 5 / Phase 2: 4 / Phase 3: 4 / Phase 4: 6 / Phase 5: 4）。

---

## 9. Future Enhancements（明示排除 v1）

| 編號 | 項目 | v1 排除理由 | 候選 trigger |
|------|------|-----------|-------------|
| F1 | Multi-arch arm64 docker server bundle | Docker Desktop emulation 已涵蓋多數 Apple Silicon dev 場景 | 使用者報告 emulation 效能瓶頸 |
| F2 | Docker Compose template | YAGNI；模式 A 已涵蓋 dev container 整合 | 多 service 整合場景需求出現 |
| F3 | 跨 host docker over TCP/SSH | docker host 偵測限本機簡化 v1 | 使用者明確要求 daemon 分離 |
| F4 | Jump host 顯式 UI | 透明走 `~/.ssh/config ProxyJump` 已涵蓋 90% | 多跳 + 動態 jump host 選擇需求 |
| F5 | Server-side voice (whisper) | server-side 無音訊裝置 + 引入即需 audio 轉發（pulseaudio over network） | 獨立 spike + PLAN |
| F6 | Apple Silicon native arm64 docker server | Docker Desktop emulation linux/amd64 已 work | F1 同 trigger |
| F7 | Windows OpenSSH server target | ConPTY 對 BAT PTY 場景不穩 | OpenSSH on Windows ConPTY 修復 |
| F8 | rsync `--partial` resumable upload | ssh+tar v1 70-100 MB 重傳成本可接受 | bundle 增至 200 MB+ |
| F9 | Reverse SSH tunnel | client 一般無公網 | NAS / 反向需求情境 |
| F10 | SSH stdio transport | 與既有 wss reconnect / heartbeat / metadata 全要重寫 | wss 在 22 port 嚴重受限環境 |
| F11 | SSH certificate auth | YAGNI；key + agent 已涵蓋 | 大型組織導入需求 |
| F12 | password auth via expect-style PTY | 阻斷 BAT 自動化哲學 | 不會解鎖（lasting exclusion） |
| F13 | WSL1 support | systemd 缺 + PTY corner bugs | 不會解鎖 |
| F14 | NAT mode WSL2 自動 IP 同步 | mirrored mode (Win 11 23H2+) 主流 | NAT 使用者比例回升 |
| F15 | docker compose 整合 | F2 同 | 同 |
| F16 | 雙 cert SNICallback grace | broadcast cert:renewed + auto-pin 已 acceptable | cert renewal 場景使用者抱怨 |
| F17 | server-side code editor agent | 不在 PLAN-007 框架內（屬於 PLAN-XXX agent UX） | 獨立 PLAN |

---

## Appendix A — Source workorder commit hashes

| 工單 | spec commit | metadata commit |
|------|------------|----------------|
| T0260 (scoping) | — | (early) |
| T0261 (EXP-HEADLESS-001 spike) | (worktree, CONCLUDED) | — |
| T0262 (server-side hardening) | `6477cf9` | `53bd102` |
| T0263 (WSL deployment) | `afb34a0` | `bb6d722` |
| T0264 (cross-env abstractions) | `92af5c7` | `190d9a3` |
| T0265 (Docker deployment) | `055d8e2` | `a1ce0af` |
| T0266 (SSH deployment) | `496fba4` | `88daa06` |
| T0267 (this consolidation) | (本 commit) | (本工單收尾) |

## Appendix B — PLANNED 升級檢核

- [✅] T0260-T0266 所有 research 工單 DONE
- [✅] EXP-HEADLESS-001 CONCLUDED（T0261）
- [✅] spec doc `_spec-remote-dev-support-2026-04.md` 落地（本檔）
- [✅] Cross-cutting RFC 拍板（C-1 ~ C-7 + D-SSH-6，本檔 §6）
- [✅] 實作 backlog 藍圖（T0268 ~ T0290 共 23 張，§8）
- [✅] 工程量總估 + 風險係數（22-30 → 30-40 工程日，§7 / T0266 §E）
- [✅] 開放決策清單（§6 共 8 個 RFC 全部 closed）
- [⏳] PLAN-007 元資料更新：💡 IDEA → 📋 PLANNED（**塔台執行**，本工單不動 PLAN-007.md）

---

**END OF SPEC**
