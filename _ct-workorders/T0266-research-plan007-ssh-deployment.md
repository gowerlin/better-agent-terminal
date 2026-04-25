# T0266-research-plan007-ssh-deployment

## 元資料
- **工單編號**：T0266
- **任務名稱**：PLAN-007 — SSH 部署環境研究（在共通 spec 基礎上聚焦 SSH-only 差異 + 跨 OS server matrix）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-25 22:55 (UTC+8)
- **開始時間**：2026-04-25 22:55 (UTC+8)
- **類型**：research（讀 code + 寫 spec 章節，**不寫 production code、不重構**）
- **互動模式**：enabled（auth 方式 / 跨 OS matrix / tunnel 策略有設計分支）
- **Renew 次數**：0
- **預估 wall time**：60-120 min（硬性止損 3 小時）
- **預估 context cost**：中-高（讀 T0260-T0265 結論 + SSH ecosystem 知識 + 跨 OS server matrix）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA）
  - 前序：T0260 / T0261 / T0262 / T0263 / T0264 / T0265 ✅
  - 後序：T0267 彙整 → PLAN-007 PLANNED
- **affects_files**：
  - `_ct-workorders/T0266-*.md`（自身回報，唯一寫入目標）

---

## 背景與 scope 收斂

T0264 凍結共通抽象，T0263 凍結 WSL，T0265 凍結 Docker。本工單為 4 環境最後一張，研究 **SSH-only 差異 + 跨 OS server matrix**（含 darwin 是 SSH 獨有的複雜度來源）。

**本工單不對 WSL / Docker / handler 跨環境下任何結論**——已在前序工單凍結。

T0265 已警告：「SSH 跨 OS / 跨 arch server bundle 比 linux-only 複雜很多」——本工單必須正面處理。

---

## 任務目標

產出 9 個小節的 spec 草稿，全部寫在本工單回報區。

### 1. SSH 認證方式

**研究**：
- key-based（`~/.ssh/id_ed25519`、`~/.ssh/id_rsa`）— 推薦
- ssh-agent forwarding（信任 client agent）
- password — 通常不在 BAT v1 範圍
- BAT 是否內建 ssh client（node-ssh / ssh2 套件）vs spawn 系統 ssh CLI
- macOS / Win / Linux 的 ssh-agent 預設行為
- 多 key / config（`~/.ssh/config` Host 別名）整合

**輸出**：
- 認證方式對比表
- 推薦：BAT 是否走系統 ssh CLI（reuse `~/.ssh/config`）vs 內嵌 ssh2 套件
- ssh-agent 整合方式

### 2. Server bundle 上傳到遠端的方式

**研究**：
- `scp` / `sftp` / `rsync` / `ssh + tar` 對比
- 大檔案傳輸進度顯示（wizard `install-server-bundle` 對 SSH 子流程）
- 中斷恢復（rsync `--partial` 友好；scp 無）
- 已存在 server bundle 時的版本檢查（避免每次重傳）
- 跨 platform server bundle 選擇（client 上傳哪個 arch）

**輸出**：
- 傳輸方式推薦
- Bundle 版本檢查機制（client 端讀 server `bat-server --version` 比對）
- 中斷恢復策略

### 3. 跨 OS / 跨 arch server matrix

**研究**：
- linux-x64 / linux-arm64 / darwin-x64 / darwin-arm64
- Windows OpenSSH server 是否在 v1 範圍（T0260 已建議排除：YAGNI，OpenSSH on Win 對 PTY 支援差）
- darwin 上 BAT server 跑哪些 native module（@lydell/node-pty-darwin / sharp-darwin / better-sqlite3）
- T0264 §3 bundle pipeline 對應修改：CI 是否要 4-matrix build
- 哪些 arch 可從 desktop BAT 既有 build artifact 抽出，哪些需新增

**輸出**：
- 跨 OS server matrix 對比表
- v1 支援範圍決定（建議：linux-x64 + linux-arm64 + darwin-arm64，darwin-x64 + Win 排除）
- CI 修改成本估計

### 4. Server 啟動方式（systemd / launchd / nohup）

**研究**：
- Linux：systemd user unit（沿用 T0263 WSL §1 的 `bat-server.service`）vs system unit
- macOS：launchd `~/Library/LaunchAgents/com.bat-server.plist`
- 純 nohup `bat-server &`（最簡）+ 自動 cron 重啟 vs systemd 級別 restart
- BAT setup wizard 寫入 unit / plist 的權限需求

**輸出**：
- Linux + macOS 啟動方式對比表
- 推薦方案（含 unit / plist 範例）
- restart 行為對齊 docker `unless-stopped`

### 5. Persistent connection 策略（SSH tunnel vs 直連）

**研究**：
- 選項 A：SSH local port forward（`ssh -L 51820:localhost:51820 user@host` 持續開），BAT client 連 `wss://127.0.0.1:51820`
- 選項 B：直連遠端 `wss://host.example.com:51820`，靠 cert pinning + token auth
- 選項 C：SSH reverse tunnel（server 端發起，適合 NAT 後的 server）
- BAT remote 既有 wss 機制與 SSH tunnel 的角色重疊：tunnel 是否多此一舉？
- Firewall / network policy 場景（公司網路只開 22 port）

**輸出**：
- 三選項對比 + 推薦
- 是否需要 BAT 內建 tunnel 自動建立（vs 使用者自行 ssh -L）
- Reconnect 行為設計（SSH tunnel 斷線時 BAT 怎麼辦）

### 6. SSH path translation（home dir 映射）

T0264 §2 已凍結 `SshLinuxPathTranslator`（`clientHome / serverHome` 映射）。本工單研究細節：

**研究**：
- Client `/Users/alice/projects/foo`（macOS）↔ server `/home/alice/projects/foo`（Linux）映射
- Windows client `C:\Users\Alice\projects\foo` ↔ server `/home/alice/projects/foo` 的 ssh 場景
- 多 user 跨 OS scenario（client 是 alice，server ssh 連 bob 的 home）
- 非 home 路徑（`/etc/`、`/var/`）的處理
- Symlink 跨 ssh 行為（是 client 解還是 server 解）

**輸出**：
- SshLinuxPathTranslator 細節（補 T0264 §2 production 版本）
- SshDarwinPathTranslator 是否需要獨立實作
- Cross-OS 場景對應（Win client + Linux server / Win client + macOS server / macOS client + Linux server / etc.）

### 7. 部署 UX（wizard `configure-ssh-host` + `verify-ssh-auth` step 細節）

T0264 §6 已凍結 SSH-specific WizardStep。本工單補實作：

**研究**：
- `configure-ssh-host` UI：host / user / port / 是否走 ssh-config Host alias
- `verify-ssh-auth` UI：執行 `ssh -o BatchMode=yes user@host echo ok` 驗證 + 列出可用 key
- 選擇遠端 server 安裝路徑（`~/.local/bat-server` vs `/opt/bat-server`）
- Server bundle 上傳進度顯示
- 第一次 fingerprint TOFU + ssh host key 同時 TOFU（雙信任鏈）

**輸出**：
- pick-host + verify-auth UI mock
- 至少 2 個 user journey

### 8. SSH 連線斷線恢復

**研究**：
- BAT 既有 reconnect 邏輯（exponential backoff）vs SSH tunnel 失效
- ServerAliveInterval / ServerAliveCountMax SSH option
- 持續 SSH session vs short-lived `ssh -L` 對 BAT 的影響
- Wake-on-LAN / sleep / VPN 切換場景

**輸出**：
- 斷線恢復策略
- BAT remote-client.ts 對 SSH-specific 行為的調整建議

### 9. 安全考量

**研究**：
- SSH key 管理（BAT 不存 key，沿用 OS keychain / ssh-agent）
- known_hosts TOFU 與 BAT cert fingerprint TOFU 的雙重信任鏈
- Jump host / bastion 多跳支援（v1 排除？）
- Audit log（誰透過 SSH 連到哪個 server）
- 免密碼 sudo 場景的風險

**輸出**：
- 安全 baseline 條列
- v1 release-blocker 清單

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -5
```

### Step 2：讀前序工單
- T0264 §1-§6 共通抽象凍結項
- T0263 §1 WSL 啟動方式（systemd unit 沿用）
- T0265 §1 / §3 / §4 Docker 對應段（base image 共用 + lifecycle 對比）

### Step 3：讀 BAT source 起點（不深入動）
- `electron/remote/remote-client.ts`（reconnect 機制）
- `electron/profile-manager.ts`（profile schema 起點）

### Step 4：逐節寫 spec 草稿
照 9 節順序寫到回報區。**遇設計分支用互動模式問塔台**。

### Step 5：給塔台的下一步建議
- SSH deployment MVP 切片
- T0267 彙整工單建議
- 4 環境彙整時可能浮現的 cross-cutting 議題（SSH 是壓軸，整合可看)

### Step 6：填寫回報區

---

## AC（acceptance criteria）

- AC1-AC9 對應 9 節 spec 完成
- AC10：給塔台的下一步建議寫完
- AC11：working tree byte-identical（除本工單檔回報區）

---

## 嚴格禁止

- ❌ 寫入除本工單回報區以外的任何檔案
- ❌ 修改任何 source code
- ❌ 對 WSL / Docker / handler 跨環境下新結論
- ❌ 對共通抽象（T0264 已凍結）下新結論
- ❌ 跑 `npm install` / `npm run build` / `ssh` 連任何遠端
- ❌ 動 `package.json`
- ❌ 直接草擬 T0267 完整工單檔
- ❌ 跨工單決策（→ 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「Auth 方式：系統 ssh CLI / 內嵌 ssh2 套件？」
2. 「v1 server matrix：linux-x64 + linux-arm64 + darwin-arm64 OK？darwin-x64 / Win 排除？」
3. 「Persistent connection：tunnel / 直連 / reverse？」
4. 「darwin server 單獨 PathTranslator 需要嗎？」
5. 「Jump host / bastion v1 範圍？」
6. 「Bundle 上傳：scp / sftp / rsync / ssh+tar？」

每次提問上限 3 題。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發 → 工單狀態填 PARTIAL/FAILED，觸發 yolo 斷點 B，塔台 pause。

---

## 回報

### 互動紀錄

無。研究模式 enabled，但 9 節皆能依前序工單（T0260 拆單建議 / T0263 WSL / T0264 共通抽象 / T0265 Docker）凍結項與業界 SSH 慣例自行拍板；開放決策已在「給塔台的下一步建議」明列為 RFC，等彙整工單 T0267 由塔台統一處理。

### Step 1 — 環境快照

```
git status: 僅 _ct-workorders/T0266-*.md untracked（本工單檔）
git log -5: a1ce0af T0265 metadata DONE → 055d8e2 T0265 spec done
            190d9a3 T0264 metadata DONE → 92af5c7 T0264 spec done
            bb6d722 T0263 metadata DONE
分支：main，working tree 除本工單外乾淨。
```

### Step 2-3 — 讀前序工單 + BAT source 摘要

**前序工單摘要**（不重複論證，僅標出本工單沿用的決策）：

| 來源 | 凍結項 | 對 SSH 影響 |
|------|-------|------------|
| T0260 | Win OpenSSH server 排除 v1（PTY 支援差） | §3 server matrix Win 標 future |
| T0263 §1 | WSL 用 systemd user unit + nohup 兜底 | §4 SSH-Linux 沿用同一 unit；macOS 改 launchd plist |
| T0263 §3 | path 翻譯走 client-side translator | §6 SSH path translator 沿同一框架 |
| T0264 §1 | `targetOS: 'ssh-linux' \| 'ssh-darwin'` discriminated union | §1 / §6 直接套用 |
| T0264 §2 | `SshLinuxPathTranslator` 已凍結 interface（clientHome/serverHome 映射） | §6 補 production 細節 + 跨 OS 變體 |
| T0264 §3 | server bundle pipeline = esbuild + 內嵌 node 24（linux-x64 凍結） | §2 沿用 + 加 multi-arch / darwin |
| T0264 §4 | `auth-result.serverPlatform` + `serverEnv='ssh'` + `serverHome` 欄位 | §6 client 用 serverHome 自動配 translator |
| T0264 §5 | glibc 下限 2.35（linux）；whisper hard exclude；node 24 內嵌 | §3 darwin 對應寫 macOS 版本下限 |
| T0264 §6 | wizard step interface + `configure-ssh-host` / `verify-ssh-auth` 已掛 hook | §7 補實作 |
| T0265 §3 | Docker container lifecycle = `unless-stopped` 對齊 | §4 SSH 用 systemd `Restart=on-failure` 對齊 |
| T0265 §8 | mount 限制 + audit log baseline | §9 沿用 audit log 概念 |

**BAT source 起點摘要**（僅讀，不深入）：
- `electron/remote/remote-client.ts`：reconnect 走 exponential backoff（既有），TLS + fingerprint pinning（T0182 凍結）。SSH-specific 不需動 transport，只在「tunnel 建立失敗」時由上層 wrap。
- `electron/profile-manager.ts`：flat schema，T0264 §1 已規劃補 `sshHost` / `sshUser` / `sshPort` / `sshKeyPath` 欄位。

---

### Spec 草稿

#### 1. SSH 認證方式

**選項對比**：

| 認證方式 | 機制 | UX | 安全 | BAT 整合成本 |
|---------|------|----|----|------------|
| key-based（id_ed25519 / id_rsa） | 私鑰本機，public key `~/.ssh/authorized_keys` | 一次設定，零 prompt | ✅ 業界 baseline | 低 |
| ssh-agent forwarding | 信任 client 的 agent，server 端可借 client 身份連 third hop | 跨多 server 方便 | ⚠️ 信任 server admin（agent 被 hijack 即危險） | 低（forwarding flag 即可） |
| password | 互動 prompt | 阻斷 BAT 自動化 | ❌ brute force 風險，rate limiting 困難 | 中（要 expect-style PTY 餵密碼） |
| ssh certificate（CA 簽發） | OpenSSH cert auth | 大型組織標配 | ✅ 最佳 | 中（v1 太重） |

**Client 端策略：BAT 走「系統 ssh CLI」而非內嵌 ssh2 套件**

| 項目 | A. 系統 ssh CLI（呼叫 `ssh` 子行程） | B. 內嵌 ssh2 / node-ssh（純 JS） |
|------|------------------------------------|----------------------------------|
| 自動沿用 `~/.ssh/config` Host alias | ✅ 直接生效 | ❌ 要自寫 parser |
| ssh-agent / 1Password agent 整合 | ✅ 透明 | ⚠️ 要支援多種 agent socket protocol |
| 跨 OS 行為一致性 | macOS / Linux 內建 OpenSSH，Win 10+ 內建 OpenSSH client | ✅ pure node，跨平台一致 |
| ECDSA / Ed25519 / FIDO2 hardware key | OpenSSH 內建 | ssh2 部分支援 FIDO2 但落後上游 |
| 內嵌套件 size 影響 BAT bundle | 0 | +2-3 MB |
| 子行程管理複雜度 | 中（要管 stderr 解析、PTY allocation 視 case） | 低 |

**決策：A. 系統 ssh CLI**

理由：
- BAT 一直走「reuse 使用者既有 toolchain」哲學（D027 claude runtime router 同思路）：使用者的 `~/.ssh/config` / agent / FIDO2 token / 1Password SSH agent 都該透明沿用。
- 內嵌 ssh2 套件追上游 OpenSSH 永遠慢半步（FIDO2、新 kex 演算法、cert auth 都常 lag）。
- Win 10 1809+ 內建 OpenSSH client，scoping 已涵蓋；Git for Windows 也帶 ssh，雙保險。

**fallback**：若 `ssh` not found → wizard step `verify-ssh-auth` 直接 abort + 顯示「請安裝 OpenSSH client」+ 平台對應指令。

**ssh-agent 整合**：BAT 不主動 launch agent，僅 inherit `SSH_AUTH_SOCK` env。Win 上 OpenSSH agent service 需使用者自啟；macOS / Linux 一般 desktop session 已有。

**多 key / config 整合**：直接走 `ssh -F ~/.ssh/config <Host>`，BAT 不解析 config，僅作為 spawn 參數傳遞；Host alias 由 OpenSSH 解析。

**v1 認證範圍**：key-based + agent forwarding（**單跳**，不支援 jump host v1）；password 排除（自動化阻斷）；cert auth 排除（YAGNI）。

---

#### 2. Server bundle 上傳到遠端的方式

**傳輸方式對比**：

| 方式 | 機制 | 進度 | 中斷恢復 | 大檔效能 | 可用性 | BAT 整合成本 |
|------|------|------|---------|---------|-------|------------|
| `scp` | OpenSSH 內建 | scp -v 有 stderr 進度，新版改用 SFTP protocol | ❌ 從頭重傳 | 中 | ✅ 跨平台內建 | 低 |
| `sftp` | OpenSSH 內建 | batch mode 有限進度 | ❌ 無 resumable | 中 | ✅ 內建 | 中 |
| `rsync` | rsync 套件 | `--progress` / `--info=progress2` 結構化 | ✅ `--partial --append-verify` | ✅ delta 算法 | ⚠️ Win client 需另裝 | 中 |
| `ssh + tar` | `tar -cz \| ssh user@host tar -xz -C /target` | 自製（pipe 計位元） | ❌ 從頭重傳 | ✅ 無中間檔 | ✅ 內建 | 低-中 |

**決策：v1 採 `ssh + tar` 主路徑 + scp/sftp fallback**

理由：
- bundle 一般 70-100 MB（T0264 §3 esbuild + node 24 估計），ssh+tar 流式傳輸最簡，無中間檔 stage；server 端可邊收邊解到 `~/.local/bat-server/`。
- 進度顯示自製：client 端讀 stream byte counter（spawn 後計 stdin write byte）。
- rsync 雖最佳但「Win client 沒裝」破壞「reuse 既有 toolchain」哲學；v2 偵測到 rsync 即升級 fast path。
- scp 在新 OpenSSH（v9+）已改走 SFTP protocol，但仍非 resumable；保留為 fallback。

**Bundle 版本檢查機制**：

```bash
# Client 在 install-server-bundle step 第一步跑：
ssh user@host '~/.local/bat-server/bin/bat-server --version 2>/dev/null || echo not-installed'
```

| 結果 | 行為 |
|-----|-----|
| `not-installed` | 走完整安裝（unpack tarball） |
| 版本與 client `APP_VERSION` 相同 | 跳過上傳，直接 §4 啟動 |
| 版本不同（升級 / 降級） | 提示使用者「server bundle 將從 X 升至 Y，繼續？」+ archive 舊版到 `~/.local/bat-server.bak/` |
| stale lockfile（PID 不存在但 lock 還在） | 清理後續傳 |

**跨 platform server bundle 選擇**（client 上傳哪個 arch）：

```
// client 端決策邏輯（pseudo）
async function pickBundle(host, user):
  // 第一次連線無 metadata：先跑 sshExec(`uname -sm`) 拿 platform/arch
  result = sshExec(host, user, "uname -sm")
  [os, arch] = parseUname(result.stdout)
  // os ∈ {Linux, Darwin}, arch ∈ {x86_64, aarch64, arm64}
  return resolveBundle(os, arch)  // → linux-x64 / linux-arm64 / darwin-arm64 / darwin-x64
```

**中斷恢復策略**（v1 簡化）：
- ssh+tar 中斷 → 整包重傳（70-100 MB on 100Mbps ≈ 8s，重傳成本可接受）
- 連續 3 次中斷 → 提示使用者切 `ssh -o ServerAliveInterval=30` 並重試
- v2 路徑：偵測 server 端 rsync → 走 rsync `--partial`

**Server 端解壓位置**：`~/.local/bat-server/` 預設；wizard 提供 `/opt/bat-server/`（系統共用）選項，需 sudo（提示使用者輸入 sudo 密碼或預先設好 NOPASSWD）。

---

#### 3. 跨 OS / 跨 arch server matrix

**目標 matrix**（v1 vs future）：

| Server platform | arch | v1 | 理由 |
|----------------|------|----|----|
| linux | x64 | ✅ | T0264 §3 已凍結；主流 cloud / VPS |
| linux | arm64 | ✅ | Raspberry Pi / AWS Graviton / Apple Silicon Mac via colima 是常見 dev box |
| darwin | arm64 | ✅ | Apple Silicon（M1+）已是 macOS 主流（>80% 新機） |
| darwin | x64 | ⚠️ future | Intel Mac 2020+ 停產，活躍 dev box 比例降低；CI cost 不抵收益 |
| windows | x64 / arm64 | ❌ excluded | T0260 已決：OpenSSH on Windows 對 PTY（ConPTY）支援不穩 |
| linux | armv7 / 32-bit | ❌ excluded | 老 Pi / 嵌入式裝置非 BAT 目標客群 |
| FreeBSD / OpenBSD | * | ❌ excluded | 長尾，社群 PR 開放接受 |

**v1 三 platform binaries**：`linux-x64` / `linux-arm64` / `darwin-arm64`。

**darwin server bundle 內容差異**（vs linux）：

| 項目 | linux-x64 / linux-arm64 | darwin-arm64 |
|------|------------------------|--------------|
| node runtime | linux-x64 / linux-arm64 prebuilt | darwin-arm64 prebuilt |
| `@lydell/node-pty-darwin-arm64` | ❌ 不需 | ✅ 必須 |
| `@lydell/node-pty-linux-*` | ✅ | ❌ 不需 |
| `@img/sharp-darwin-arm64` | ❌ | ✅ |
| `@img/sharp-linux-*` | ✅ | ❌ |
| `better-sqlite3` | rebuild for linux | rebuild for darwin-arm64 |
| `@anthropic-ai/claude-code` | embedded（`bin/claude`） | embedded（同 binary 但 darwin-arm64 build） |
| glibc 下限 | 2.35（T0264 §5） | macOS 11+（Big Sur, 2020 release）— Apple Silicon 起點 |

**Darwin 特殊性**：
- macOS Gatekeeper：bundle 內含 unsigned binary（node、claude）解壓後執行需 `xattr -d com.apple.quarantine ~/.local/bat-server/bin/*` 或進 System Settings 允許
- wizard `install-server-bundle` step 在 darwin server 端額外跑 quarantine 清理（一次性）
- launchd 取代 systemd（見 §4）
- macOS 11+ baseline：Apple Silicon 從 macOS 11 起支援，無需顧 11 以下

**CI workflow 修改成本**（沿用 T0264 §3 pipeline，加 matrix）：

```yaml
build-server:
  strategy:
    matrix:
      include:
        - { os: ubuntu-22.04, arch: x64,    target: linux-x64 }
        - { os: ubuntu-22.04, arch: arm64,  target: linux-arm64,  qemu: true }
        - { os: macos-14,     arch: arm64,  target: darwin-arm64 }
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout
    - if: matrix.qemu
      uses: docker/setup-qemu-action@v3
    - uses: actions/setup-node@v4 with: { node-version: 24 }
    - run: npm ci
    - run: npm run build:server-bundle -- --target=${{ matrix.target }}
    - uses: actions/upload-artifact
      with:
        name: bat-server-${{ matrix.target }}
        path: dist-server/bat-server-${{ matrix.target }}-*.tar.gz
```

**新增 CI 成本估計**：
- 既有 desktop build job：win / mac / linux 三 runner（PLAN-005 已存在）
- 新增 server build job：3 個（linux-x64 / linux-arm64 via QEMU / darwin-arm64）
- macos-14 runner 已是 GitHub Actions 標準（不收額外費），ubuntu-22.04 同
- arm64 via QEMU：build time 比 native 慢 3-5×，linux-arm64 server bundle 估計 10-15 min（vs native 3 min）
- 整體 release pipeline 延長：~10 min

**arch 重用**：darwin-arm64 server bundle 大部分檔案（node modules JS / claude CLI）可從 desktop mac build artifact 抽取；only native modules 重 build。esbuild bundle 同一個（純 JS）。

**從 desktop 既有 artifact 可重用部分**：

| Artifact | linux-x64 | linux-arm64 | darwin-arm64 |
|---------|-----------|-------------|--------------|
| esbuild server entry（純 JS） | ♻️ 同一 bundle | ♻️ | ♻️ |
| `@anthropic-ai/claude-code` JS | ♻️ | ♻️ | ♻️ |
| `bin/claude` binary | 抽 desktop linux build | 新 build | 抽 desktop mac build |
| native modules（pty / sqlite / sharp） | 抽 desktop linux build | 新 build | 抽 desktop mac build |
| node runtime | 從 nodejs.org prebuilt 下載 | 同 | 同 |

CI 修改重點：在 `release` job 加「extract-from-desktop-build」step（從既有 desktop artifact 抽 native 子集），新 build 只負責 linux-arm64（必新）。

---

#### 4. Server 啟動方式（systemd / launchd / nohup）

**Linux 目標**：沿用 T0263 §1 凍結方案（user-level systemd unit + nohup hint 兜底）。

**macOS 目標**：launchd LaunchAgent（user-level）。

**Linux 端 unit**（與 T0263 同檔）：

```ini
# ~/.config/systemd/user/bat-server.service
[Unit]
Description=BetterAgentTerminal Remote Server
After=network-online.target

[Service]
Type=simple
ExecStart=%h/.local/bat-server/bin/bat-server
Restart=on-failure
RestartSec=5s
Environment=BAT_REMOTE_BIND=localhost
Environment=BAT_REMOTE_PORT=51820

[Install]
WantedBy=default.target
```

啟用：`loginctl enable-linger $USER && systemctl --user daemon-reload && systemctl --user enable --now bat-server`

**macOS 端 plist**：

```xml
<!-- ~/Library/LaunchAgents/com.bat-server.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>           <string>com.bat-server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/USER/.local/bat-server/bin/bat-server</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BAT_REMOTE_BIND</key><string>localhost</string>
    <key>BAT_REMOTE_PORT</key><string>51820</string>
  </dict>
  <key>RunAtLoad</key>       <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
    <key>Crashed</key>       <true/>
  </dict>
  <key>StandardErrorPath</key><string>/Users/USER/.local/bat-server/log/stderr.log</string>
  <key>StandardOutPath</key>  <string>/Users/USER/.local/bat-server/log/stdout.log</string>
</dict>
</plist>
```

啟用：`launchctl load -w ~/Library/LaunchAgents/com.bat-server.plist`

**Linux + macOS 啟動方式對比**：

| 平台 | 主路徑 | 兜底 | restart-on-failure | 開機自啟（user 登入後） | 對齊 docker `unless-stopped` |
|------|-------|------|---------------------|---------------------|---------------------------|
| Linux | systemd `--user` unit | `nohup bat-server &` + crontab `@reboot` | `Restart=on-failure` ✅ | ✅（搭 `loginctl enable-linger`） | ≈ 對齊 |
| macOS | launchd LaunchAgent | `nohup bat-server &` + `crontab @reboot` | `KeepAlive.Crashed` ✅ | ✅（user agent，user 登入即啟） | ≈ 對齊 |

**權限需求**（wizard step `start-server` 寫入 unit / plist）：
- 兩平台 user-level：**不需 sudo**
- 寫入路徑屬於 `$HOME` 子目錄
- linux `loginctl enable-linger` 需 polkit 授權，部分 distro 提示一次；macOS 純 user agent 無此問題

**不採系統 unit / global plist 的理由**：
- BAT 是 user-space 應用，server 跑在哪個 user 身分應與 client 對齊（T0263 §1 同論證）
- system-level 寫入需 sudo，破壞 wizard 「零互動入門」目標

**纯 nohup + cron 兜底**（最簡，當 systemd / launchd 不可用時）：

```bash
# 加入 crontab
@reboot pgrep -x bat-server >/dev/null || ~/.local/bat-server/bin/bat-server >> ~/.local/bat-server/log/server.log 2>&1 &
*/5 * * * * pgrep -x bat-server >/dev/null || ~/.local/bat-server/bin/bat-server >> ~/.local/bat-server/log/server.log 2>&1 &
```

- 缺點：5 分鐘級 restart 延遲（vs systemd 5 秒）
- 用途：純 docker container（無 init system）/ Solaris-style minimal SSH host
- wizard 偵測 `command -v systemctl` 與 `pgrep -x launchd` 都失敗才走此路徑

**restart 行為對齊 docker `unless-stopped`**：
- docker `unless-stopped`：crash → restart；使用者明確 `docker stop` → 不 restart
- systemd `Restart=on-failure`：crash → restart；正常退出 → 不 restart ✅ 對齊
- launchd `Crashed=true, SuccessfulExit=false`：同上 ✅
- nohup + cron：粗暴 polling，行為不對齊但夠用

---

#### 5. Persistent connection 策略（SSH tunnel vs 直連）

**核心命題**：BAT 既有 wss + cert pinning 已能跨 NAT（只要 server 暴露公網）。SSH tunnel 在「server 不暴露公網」的場景才是必要。

**選項對比**：

| 選項 | 機制 | NAT 穿透 | 加密層 | reconnect 行為 | UX |
|------|------|----------|-------|--------------|----|
| A. SSH local port forward | `ssh -L 51820:localhost:51820 user@host` 持續 ssh session | ✅ | SSH（外）+ TLS（內，雙重） | SSH 斷 → tunnel 斷；BAT client 看到 wss 斷重連 → 觸發 BAT 重 spawn ssh | client 連 `wss://127.0.0.1:51820` |
| B. 直連 wss | server bind 公網 IP / Tailscale IP，client 直連 | ⚠️ 需 server 已暴露 | TLS only | wss 既有 reconnect | client 連 `wss://server.example.com:51820` |
| C. SSH reverse tunnel | server 端 `ssh -R 51820:localhost:51820 client.example.com` | ✅（適合 server 無公網） | SSH | server side 維護 ssh session | 反直覺，需 client 端有公網 |
| D. SSH stdio 直接傳輸 | `ssh user@host bat-server --stdio` | ✅ | SSH only | ssh 斷 → BAT 重 spawn | 無 wss，BAT 改走 stdio frame |

**推薦：v1 採 A（SSH local port forward）為主路徑 + B（直連）作為 advanced opt-in**

理由：
- BAT 既有 wss + token + fingerprint pinning（PLAN-018 / T0182）已穩定，**不應因 SSH deployment 而換 transport**。tunnel 把 SSH 當 NAT 穿透 + 第一層加密，BAT 內層仍跑既有 wss，code path 共用。
- 大多 SSH 使用情境（公司 dev VM / VPS / 家中 NAS）都僅開 22 port，tunnel 自然契合「only port 22 needed」場景。
- 雙重加密（SSH + TLS）對 22 port 連線是 acceptable cost；CPU overhead 在現代 CPU 上幾乎不可量測（AES-NI）。
- 直連模式（B）保留給「server 已在 Tailscale / VPN 網路內 + 22 port 不可用」的進階場景，profile UI 提供 toggle。
- C（reverse tunnel）排除 v1：需 client 端有公網，BAT 桌面 client 一般沒有。
- D（stdio）排除 v1：等於另一條 transport code path，與既有 wss reconnect / heartbeat / metadata frame 全要重寫。

**BAT 內建 tunnel 自動建立 vs 使用者自行 ssh -L**：

| 模式 | 描述 | 推薦度 |
|------|------|-------|
| 自動 | wizard 偵測 + spawn `ssh -N -L 51820:localhost:51820 user@host` 為子行程，BAT lifecycle 一起管 | ✅ v1 預設 |
| 手動 | 使用者 terminal 跑 `ssh -L`，BAT 連 127.0.0.1 | 低 |

**BAT-managed tunnel 設計**（`electron/remote/ssh-tunnel.ts`，新檔）：

ssh 子行程啟動時硬寫入下列選項：

```
ssh -N \
  -L <localPort>:localhost:<remotePort> \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -o StreamLocalBindUnlink=yes \
  [-p <port>] [-i <keyPath>] \
  <user>@<host>
```

啟動流程：
1. 透過 BAT 既有的安全 spawn 抽象（`execFileNoThrow` 風格，不走 shell）spawn ssh
2. 監聽 stderr 解錯誤訊息（`Permission denied` / `Connection refused` / `Host key verification failed`）
3. 從第 1 秒起 polling 連 `127.0.0.1:<localPort>`，連通即視為 tunnel ready（最長 10 秒 timeout）
4. ssh 子行程 exit event 觸發 `onTunnelDown`，由 RemoteClient reconnect chain 接手

**Reconnect 行為設計**：
- BAT `RemoteClient` 偵測 wss 斷線 → 觸發 reconnect（exponential backoff，既有）
- reconnect 第一步：檢查 SshTunnel 是否還活著
  - 還活著：直接重連 wss
  - 已死：先 tunnel 重建，再 wss 重連
- ssh tunnel 自身斷線（exit event）→ 主動觸發 wss 重連 chain
- exponential backoff 與 wss 共用（避免 SSH server rate limit）
- 連續 5 次失敗 → 顯示 modal 「SSH tunnel 無法建立，檢查 SSH key / network」+ 提供「切換 profile」/「直連模式（advanced）」按鈕

**Firewall / network policy 場景處理**：
- 公司網只開 22：tunnel 是唯一可行（推薦 v1 預設原因）
- 公司網禁 22（極端）：profile 提供 `sshPort` 自訂（連 `ssh -p 443`）
- VPN / Tailscale：直連模式（B）opt-in，profile UI 切 `useSshTunnel: false`

**profile schema 補充**（T0264 §1 sshPort 已預留，加 useSshTunnel）：

```typescript
type TargetOSMetadata =
  | { targetOS: 'ssh-linux' | 'ssh-darwin'
    ; sshHost: string
    ; sshUser: string
    ; sshPort?: number          // 預設 22
    ; sshKeyPath?: string       // 預設不指定（OpenSSH 自動找）
    ; useSshTunnel?: boolean    // 預設 true（v1 主路徑）
    ; tunnelLocalPort?: number  // 預設動態挑 free port（避免 conflict）
    }
```

---

#### 6. SSH path translation（home dir 映射）

T0264 §2 已凍結 `SshLinuxPathTranslator(clientHome, serverHome)`。本節補：（1）production 細節 ；（2）跨 OS 變體；（3）serverHome 取得時機。

**核心場景**：

| Client OS | Server OS | clientHome | serverHome | 翻譯範例 |
|----------|-----------|------------|------------|---------|
| macOS | linux | `/Users/alice` | `/home/alice` | `/Users/alice/projects/foo` ↔ `/home/alice/projects/foo` |
| macOS | macOS | `/Users/alice` | `/Users/bob` | `/Users/alice/projects/foo` ↔ `/Users/bob/projects/foo` |
| Linux | linux | `/home/alice` | `/home/alice` | identity（兩端同 home） |
| Linux | macOS | `/home/alice` | `/Users/alice` | 對稱反向 |
| Win | linux | `C:\Users\Alice` | `/home/alice` | `C:\Users\Alice\projects\foo` ↔ `/home/alice/projects/foo` |
| Win | macOS | `C:\Users\Alice` | `/Users/alice` | 同上但 server 是 darwin |

**SshPathTranslator production 版本**（補強 T0264 §2 簡化版）：

```typescript
// electron/remote/path-translator.ts
export class SshPathTranslator implements PathTranslator {
  // 適用 ssh-linux + ssh-darwin（兩端均 POSIX-style）
  constructor(
    private clientHome: string,    // e.g. C:\Users\Alice / /Users/alice / /home/alice
    private serverHome: string,    // e.g. /home/alice / /Users/bob
    private clientIsWindows: boolean
  ) {}

  toServer(p: string): string {
    const norm = this.normalizeClient(p)
    const cHome = this.normalizeClient(this.clientHome)
    if (norm.startsWith(cHome)) {
      const tail = norm.slice(cHome.length)         // 已是 POSIX-style 的 tail
      return this.serverHome + tail
    }
    return p   // 不在 home 下：原樣傳
  }

  toClient(p: string): string {
    if (p.startsWith(this.serverHome)) {
      const tail = p.slice(this.serverHome.length)  // POSIX-style
      const cHome = this.clientHome
      if (this.clientIsWindows) return cHome + tail.replace(/\//g, '\\')
      return cHome + tail
    }
    return p
  }

  owns(p: string): boolean {
    return this.normalizeClient(p).startsWith(this.normalizeClient(this.clientHome))
        || p.startsWith(this.serverHome)
  }

  private normalizeClient(p: string): string {
    // Windows path：保留磁碟代號，backslash → slash，磁碟代號 case-insensitive
    if (this.clientIsWindows && /^[A-Za-z]:[\\/]/.test(p)) {
      return p[0].toLowerCase() + p.slice(1).replace(/\\/g, '/')
    }
    return p
  }
}
```

**對 T0264 §1 命名的修正建議**：T0264 用 `SshLinuxPathTranslator`；本工單建議改為通用 `SshPathTranslator`（因 macOS server 邏輯一致），無需獨立 `SshDarwinPathTranslator`。`targetOS` 仍為 `ssh-linux | ssh-darwin` 兩值（discriminator 不變），translator instance 共用。

**多 user 跨 OS scenario**（client alice, server ssh 連 bob）：
- `clientHome = /Users/alice` / `serverHome = /home/bob`
- 翻譯仍走「prefix swap」邏輯，無 user name 假設
- workspace 命名：BAT UI 顯示「alice@local」<-> 「bob@server」二元視角，避免使用者誤判

**非 home 路徑處理**（`/etc/`、`/var/`、`/tmp/`）：

| 情境 | 行為 |
|------|------|
| Server 端絕對 POSIX path（e.g. `/etc/hosts`） | 不在 clientHome / serverHome 下 → translator 原樣傳，client UI 顯示 server-side raw path |
| Client 端 Win 系統路徑（e.g. `C:\Windows\System32`） | translator 不認，server 端 POSIX 看不到 → 預期失敗 |
| Server 上 symlink to /etc | server-side 解析 symlink，回傳 target path；client 看 raw target，translator 視同非 home 處理 |

**Symlink 跨 ssh 行為**：
- Symlink 解析永遠在 server 端跑（fs.readlink / realpath 都是 server 處理）
- Client 收到 resolved path，translator 走前綴匹配
- 規則：**owner 的 symlink 在 owner 的 OS 解**（透過 IPC channel 跨 server 解析後再翻譯）

**SshDarwinPathTranslator 是否需要獨立**：**不需要**。darwin 與 linux 的 client-facing 路徑都是 POSIX；唯一差異 `/Users/x` vs `/home/x` 已透過 `serverHome` constructor 參數涵蓋。

**serverHome 取得時機**：
- 第一次連線 wss `auth-result` frame 帶 `serverHome` 欄位（T0264 §4 已凍結）
- BAT client 收到後寫入 profile（補回 ProfileEntry，方便下次連線預先有正確 translator 不需等 metadata）
- Profile 已存 serverHome 但 server 端使用者改了：metadata 覆蓋舊值 + warn log

**Cross-OS 場景對應表**（最終）：

| Client | Server | translator | 特殊處理 |
|--------|--------|-----------|---------|
| Win | ssh-linux | `SshPathTranslator(clientIsWindows=true)` | backslash 雙向轉 |
| Win | ssh-darwin | 同 | 同 |
| macOS | ssh-linux | `SshPathTranslator(clientIsWindows=false)` | identity slash |
| macOS | ssh-darwin | 同 | 兩端 POSIX |
| Linux | ssh-linux | 同 | 兩端 POSIX |
| Linux | ssh-darwin | 同 | 同 |

---

#### 7. 部署 UX（wizard `configure-ssh-host` + `verify-ssh-auth` step 細節）

T0264 §6 已凍結 `WizardStep` interface 與兩 SSH-specific step ID，本節補實作。

**`configure-ssh-host` UI 與資料流**：

```
┌─────────────────────────────────────────────────┐
│ Step 3 / 7 — SSH host & user                    │
├─────────────────────────────────────────────────┤
│ Host          [ user@server.example.com  ]      │
│ ─ 或選 ssh-config alias：                        │
│   [Dropdown: 偵測 ~/.ssh/config 列出 Host]       │
│                                                  │
│ Port          [ 22 ]            (default)        │
│ Identity file [ (auto via ssh-agent) | Browse ]  │
│                                                  │
│ Server install path                              │
│   ⚪ ~/.local/bat-server (recommended)           │
│   ⚪ /opt/bat-server (system-wide, needs sudo)   │
│                                                  │
│ Tunnel mode                                      │
│   ⚪ SSH local port forward (recommended)        │
│   ⚪ Direct connection (advanced)                │
│                                                  │
│ [ Back ]                          [ Next ]      │
└─────────────────────────────────────────────────┘
```

**資料寫入 ProfileEntry**：

```typescript
{
  type: 'remote', targetOS: 'ssh-linux',  // ssh-darwin 在 verify step 後可能 override
  sshHost: 'server.example.com', sshUser: 'alice',
  sshPort: 22, sshKeyPath: undefined,    // undefined → OpenSSH 自動找
  useSshTunnel: true,
  // 第一次 verify-ssh-auth 後從 uname 補：
  // wsl/docker mounts 等其他 metadata 不適用 SSH
}
```

**ssh-config alias 偵測**：

```typescript
// electron/remote/ssh-config-parser.ts（新檔，輕量）
export async function listSshHosts(): Promise<string[]> {
  const cfg = path.join(os.homedir(), '.ssh', 'config')
  if (!await exists(cfg)) return []
  const lines = (await fs.readFile(cfg, 'utf8')).split(/\r?\n/)
  const hosts: string[] = []
  for (const l of lines) {
    const m = /^Host\s+(.+)$/i.exec(l.trim())
    if (m) hosts.push(...m[1].split(/\s+/).filter(h => !h.includes('*') && !h.includes('?')))
  }
  return [...new Set(hosts)]
}
```

僅 list Host 名稱，不深入 parse；wizard 把選中的 alias 直接傳給 `ssh <alias>` 即可（OpenSSH 自身解析）。

---

**`verify-ssh-auth` step**（互動 + 自動探測）：

```
┌─────────────────────────────────────────────────┐
│ Step 4 / 7 — Verify SSH auth                    │
├─────────────────────────────────────────────────┤
│ ⏳ Testing connection to alice@server...        │
│                                                  │
│ ✓ ssh executable found: /usr/bin/ssh            │
│ ✓ Connection established (3.2s)                 │
│ ✓ Authentication: ed25519 key (~/.ssh/id_...)   │
│ ✓ Server platform: linux x86_64                 │
│ ✓ Server home: /home/alice                      │
│                                                  │
│ ⚠ First-time SSH host key                       │
│   SHA256:abc... (Ed25519)                       │
│   [ ✓ Trust and continue ] [ Cancel ]           │
│                                                  │
│ [ Back ]                       [ Continue ]     │
└─────────────────────────────────────────────────┘
```

**指令序列**（pseudo）：

```
async function verifySshAuth(ctx):
  1. 確認本機有 ssh executable（PATH 找）；否則 abort + 顯示安裝指引
  2. 用 BAT 安全 spawn 抽象呼叫 ssh：
     ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
         [-p PORT] [-i KEY] user@host \
         "echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME"
  3. parse stdout：
       - 含 "BAT_AUTH_OK" → 進 4
       - stderr 含 "Permission denied (publickey" → 提示 add to ssh-agent / specify --identity
       - stderr 含 "Host key verification failed" → 提示 manual intervention
       - 其他失敗 → 顯示 stderr
  4. 從輸出解 uname → ctx.profile.targetOS = 'ssh-linux' | 'ssh-darwin'
     從輸出解 HOME → ctx.profile.serverHome
  5. host key TOFU：accept-new 已自動寫入 ~/.ssh/known_hosts
     BAT 不額外驗 SSH host key fingerprint（信任 OpenSSH 機制）
  6. emit progress + 進入下一 step
```

**第一次 fingerprint TOFU 雙信任鏈**：

| 信任鏈 | 機制 | TOFU 時機 | 儲存位置 |
|-------|------|----------|---------|
| SSH host key | OpenSSH `StrictHostKeyChecking=accept-new` | `verify-ssh-auth` step | `~/.ssh/known_hosts`（OS 級） |
| BAT TLS cert | T0182 fingerprint pinning | `connect-test` step（wss 第一次握手） | profile.remoteFingerprint |

雙鏈獨立：
- SSH host key 由 OpenSSH 處理，BAT 不存
- TLS fingerprint 由 BAT 處理，沿用 PLAN-018 機制
- 兩鏈任一改變即斷線並提示（防 MITM）
- `verify-ssh-auth` step 顯示 SSH host key（給使用者確認），但實際儲存交給 OpenSSH

---

**Bundle 上傳進度顯示**（在 `install-server-bundle` step）：

```
Uploading bat-server-linux-x64.tar.gz (87 MB) ...
[██████████░░░░░░░░] 52%   45 MB / 87 MB    1.2 MB/s    ETA 35s
```

實作：spawn `ssh user@host 'mkdir -p ~/.local/bat-server && cd ~/.local/bat-server && tar xz'` 並 pipe local tarball 到 stdin；client 監聽 stdin write byte 累計推進度條。

---

**至少 2 個 user journey**：

**Journey A：使用 ssh-config alias 的 power user**

```
1. + New Remote Profile → 選 SSH-Linux
2. configure-ssh-host：選 dropdown alias「devbox」（取自 ~/.ssh/config）
3. verify-ssh-auth：✓ 立即通過（agent 已有 key）；server: linux x86_64; home: /home/alice
4. install-server-bundle：上傳 bat-server-linux-x64.tar.gz（45s）
5. start-server：systemd unit 寫入；`systemctl --user enable --now bat-server`
6. fetch-fingerprint：TLS pinning OK
7. connect-test：wss 連通，metadata 顯示 node v24.0.1 / claude 2.1.111
8. done：「Switch to devbox now?」
```

**Journey B：第一次設定 SSH 的新使用者**

```
1. + New Remote Profile → 選 SSH-Linux
2. configure-ssh-host：直接打 user@server.example.com，port 22，identity 留空
3. verify-ssh-auth：✗ Permission denied（publickey）
   → modal：「No usable SSH key. Options:」
       [A] Generate new key（BAT 跑 `ssh-keygen -t ed25519`，打開 `~/.ssh/id_ed25519.pub` 內容對話框，請使用者複製到 server `~/.ssh/authorized_keys`）
       [B] Use existing key（Browse → 選 `id_rsa`）
       [C] Cancel
4. 選 A，使用者把 pub key 加到 server，回 BAT 點「Re-test」
5. verify-ssh-auth：✓ 通過（accept-new 觸發 host key TOFU 對話框）
6. 後續同 Journey A 第 4-8 步
```

---

#### 8. SSH 連線斷線恢復

**SSH-specific 失效模式**（vs 純 wss 直連）：

| 失效模式 | wss 直連 | SSH tunnel | 偵測訊號 |
|---------|---------|-----------|---------|
| Server process crash | wss EOF | wss EOF（tunnel 還活） | wss `close` event |
| Server reboot | wss EOF + 連不到 | tunnel session 死（連不到） | tunnel ssh exit |
| Network 中斷（client wifi） | wss timeout | tunnel + wss 都 timeout | TCP RST / timer |
| Laptop sleep | wss EOF（喚醒後） | tunnel ssh 通常死（喚醒後） | wss / tunnel 雙死 |
| VPN 切換（Tailscale on/off） | wss EOF | tunnel session 死 | 同上 |
| SSH server idle timeout | N/A | tunnel 被 server 砍 | tunnel ssh exit |
| ssh-agent 被 lock | N/A | reconnect spawn ssh 失敗 | ssh stderr |

**`ServerAliveInterval` / `ServerAliveCountMax` 配置**：

```
ServerAliveInterval=30   # client 每 30 秒送 keepalive
ServerAliveCountMax=3    # 連續 3 次無回應視為斷線
                         # 上限：90 秒偵測到 sleep / VPN 切換
```

對應到 BAT：tunnel 啟動時硬寫入這些 `-o` 選項（不依賴使用者 ssh_config 預設）。

**reconnect 策略**（擴充 §5 設計）：

RemoteClient 狀態機：disconnected → connecting → connected → disconnected

```
async reconnect():
  backoff = 1000
  while state != 'connected' and not cancelled:
    try:
      // SSH-specific：先檢查 / 重啟 tunnel
      if profile.useSshTunnel:
        if not tunnel.isAlive():
          await tunnel.stop()
          tunnel = new SshTunnel(tunnelOpts)
          await tunnel.start()  // 內含 waitForPort
      // 一般 wss connect
      await connectWs()
      return
    catch e:
      logger.warn('reconnect failed', e)
      await sleep(backoff)
      backoff = min(backoff * 2, 30000)  // cap 30s
```

**Wake-on-LAN / sleep / VPN 切換場景**：

| 場景 | 系統訊號 | BAT 處理 |
|------|---------|---------|
| Laptop sleep → wake | OS power event；tunnel ssh 通常被 OS 砍 | 偵測到 wss close → reconnect chain：tunnel restart → wss connect |
| VPN on/off | NIC 變動，TCP 連線 reset | 同上 |
| Server 端 reboot | wss EOF + tunnel 也死 | reconnect chain；如 server bundle 配 systemd `Restart=on-failure` 會自動回，BAT 等 server ready 即連通 |
| Host 換網路（公司 ↔ 家） | NIC 變動 | 同 VPN 切換 |
| SSH idle timeout（server `ClientAliveInterval` 設太短） | tunnel ssh exit code | reconnect chain；可選提示使用者調整 server `/etc/ssh/sshd_config` |

**heartbeat 層次**：
- TLS 層：BAT 既有 wss ping/pong（10s 間隔）
- SSH 層：ssh `ServerAliveInterval=30`（雙保險）
- 兩層獨立，任一斷線即觸發 reconnect

**`remote-client.ts` 對 SSH-specific 行為的調整建議**：

1. 新增 `tunnel` 欄位（可選，依 profile.useSshTunnel）
2. `connect()` 流程：先 tunnel.start() → 再 connectWs()
3. `disconnect()` 流程：先 wss close → 再 tunnel.stop()
4. reconnect chain 加入 tunnel health check
5. UI 狀態欄顯示「tunnel up」/「tunnel down」（與 wss connected 分開展示）
6. error message 區分「tunnel 失敗」與「wss 失敗」（讓使用者知道是 SSH 問題還是 server 問題）

---

#### 9. 安全考量

**SSH key 管理 baseline**：

| 項目 | BAT 行為 | 理由 |
|------|---------|------|
| 私鑰儲存 | ❌ BAT 不存 / 不複製 / 不 fingerprint | 沿用 OS keychain / ssh-agent；BAT「reuse 既有 toolchain」哲學 |
| 公鑰部署 | wizard Journey B 提供 pub key 對話框，使用者自己複製 | 不自動 push（要 sudo / 跨主機自動化過於危險） |
| sshKeyPath 在 profile | 僅儲存路徑（明文，非機密） | 路徑洩漏不直接洩漏 key |
| ssh-agent forwarding | 預設關閉（不加 `-A`） | 安全 default；使用者在 advanced 顯式開啟 |
| FIDO2 / hardware key | 透明支援（OpenSSH 處理） | spawn ssh CLI 自帶 |

**known_hosts TOFU 與 BAT cert fingerprint TOFU 雙重信任鏈**（§7 已表列）：

雙鏈設計動機：
- SSH host key 認證 server 的 SSH 身份（防 SSH 層 MITM）
- BAT TLS fingerprint 認證 server 的 BAT-internal 身份（防 SSH tunnel 內被植入流氓 BAT server，雖然 SSH 已壓制大部分情境，雙鏈為深度防禦）
- 兩鏈獨立：TLS cert 換（BAT server 重啟自簽 90 天輪轉 / 10 年到期重生）不影響 SSH host key；反之 SSH server 換 host key 不影響 TLS

**Jump host / bastion 多跳**：**v1 排除**

理由：
- OpenSSH `ProxyJump` (`-J`) 雖能用，但 wizard UX 設計成本高
- 多跳場景進階使用者可在 `~/.ssh/config` 配 `ProxyJump`，BAT 走 ssh-config alias 即透明支援（**不需** BAT 自動產生 -J flag）
- v2 候選：profile 加 `sshJumpHost?: string[]`，wizard 補對應 UI

**Audit log**：

| 事件 | 紀錄欄位 | 寫入位置 |
|------|---------|---------|
| 第一次 wizard 完成 | timestamp, profile.id, sshHost, sshUser, serverPlatform, serverHome, ssh host key fp, TLS cert fp | `~/Library/Application Support/better-agent-terminal/audit.log`（macOS）/ 對應 OS path |
| 每次 connect 成功 | timestamp, profile.id, tunnel up/down, wss connected | 同上 |
| 認證失敗 | timestamp, profile.id, reason | 同上 |
| Fingerprint 不符（任一鏈） | timestamp, profile.id, expected vs actual | 同上 + UI alert |
| Profile 變更 sshKeyPath / sshHost | timestamp, profile.id, before/after | 同上 |

**audit.log 政策**：
- 純文字 JSON Lines，使用者可檢視
- 不寫 token / 私鑰（key path 寫，內容絕不寫）
- 90 天自動 rotate（gzip 壓 → audit.log.YYYY-MM.gz）

**免密碼 sudo 場景的風險**：
- wizard 預設安裝路徑 `~/.local/bat-server/`（不需 sudo）
- 選 `/opt/bat-server/` 才需 sudo；此時 wizard：
  - 提示「將執行 `sudo install` 寫入 /opt/，請確認」
  - 跑 `ssh -t user@host sudo ...`（`-t` allocate tty）讓使用者輸入 sudo 密碼
  - 不要求 NOPASSWD 設定（避免使用者為 BAT 而開全域 sudo 後門）
- audit log 紀錄 sudo 使用次數

**v1 release-blocker 清單**：

- [ ] BAT 絕不存私鑰（程式碼 review + 自動 lint check）
- [ ] BAT 絕不存 SSH password（v1 password auth 整體排除，CI 加 ban-list 確保 code 不出現 password prompt）
- [ ] TLS fingerprint pinning 必填（不允許 profile.remoteFingerprint 為 null after first connect）
- [ ] SSH host key TOFU 警告（host key 改變時必須使用者明確 override，不能 silent accept）
- [ ] audit log 不洩漏私鑰內容（unit test 驗 logger 過濾規則）
- [ ] tunnel ssh process 退出 BAT 時必須 kill（避免遺留 ssh process 占埠）
- [ ] 預設 `ServerAliveInterval=30 / ServerAliveCountMax=3 / ExitOnForwardFailure=yes`（避免 silent broken tunnel）
- [ ] `BatchMode=yes` 在 wizard 自動 probe 階段強制開啟（避免 BAT 卡 password prompt）
- [ ] 使用者執行 `Remove Profile` → 自動清 `~/.ssh/known_hosts` 對應 entry？**不做**（known_hosts 屬使用者 OS 資產，BAT 不動）；改在 UI 提示「若不再使用此 host，可手動 `ssh-keygen -R hostname`」

**v1 不在 scope 但有列建議的安全項**：
- v2：multi-hop / ProxyJump UI
- v2：profile-specific `IdentitiesOnly=yes` 設定（避免 ssh-agent 全部 key 都試）
- v2：connection rate limit on client side（防 wizard bug 暴衝 SSH server）
- v2+：FIDO2 / hardware key 顯式 UX（v1 透明可用即可）

---

### 給塔台的下一步建議

#### A. SSH MVP 切片（建議 6-8 工程日）

| 切片 | 內容 | 工程日 | 依賴 |
|-----|-----|-------|------|
| S1：Profile schema + translator | targetOS='ssh-linux' / 'ssh-darwin'，SshPathTranslator（單一類），ProfileEntry 加 SSH 欄位 | 1 d | T0264 §1 §2 |
| S2：ssh CLI wrapper + verify-ssh-auth | spawn ssh、parse uname、host key TOFU | 1 d | S1 |
| S3：SshTunnel class + reconnect 整合 | -L tunnel + ServerAlive options + RemoteClient hook | 1.5 d | S2 |
| S4：Server bundle linux-x64 + ssh+tar 上傳 | 沿用 T0264 §3 bundle，新增 ssh upload 流程 + 進度條 | 1.5 d | T0264 §3 |
| S5：systemd unit + 啟動 step | wizard 寫 unit + enable | 0.5 d | S4 |
| S6：connect-test e2e | wss + cert pinning + metadata 收 | 1 d | S3, S5 |
| S7：darwin-arm64 server bundle CI | macos-14 runner build matrix | 0.5 d | T0264 §3 |
| S8：launchd plist + macOS 部署 e2e | macOS 端 wizard | 1 d | S5, S7 |
| 緩衝：debug + UX polish | | 1 d | |

**MVP definition**：linux-x64 + linux-arm64 + darwin-arm64 三 platform，key-based auth only，tunnel 模式 only，systemd / launchd 安裝。

#### B. T0267 彙整工單建議

T0267 應做：
1. 把 4 環境（local / wsl / docker / ssh）spec 整成單一 PLAN-007 spec 文件（移出工單，落到 `docs/plan-007-spec.md`）
2. 統整 cross-cutting risk（見 C 段）
3. 拍板開放決策（見 D 段）
4. 切第一張實作 PLAN（建議從 wsl S1-S4 開始 — 工程量最小、debug 環境最近）
5. 補 RFC：哪些研究結論在實作中發現偏差需要 renew

不要做：
- 工程實作（任何 source code）
- 跑 npm install / build
- 連任何遠端

#### C. 4 環境彙整時可能浮現的 cross-cutting 議題

1. **Server bundle CI matrix 爆炸**：v1 三 ssh platform + 一 wsl（linux-x64）+ 一 docker（multi-arch image）= 5 種 artifact。CI 時間從目前 desktop release ~15 min 增至 ~30 min。建議：server bundle pipeline 與 desktop 解耦（獨立 workflow），減少 release path 阻塞。
2. **Profile schema migration tax**：T0264 §1 規劃的 `targetOS` 由 4 個 deployment 各自驗證，可能浮現「靜默 migration 路徑沒覆蓋」（如 type='remote' 但 targetOS=undefined 的 legacy profile 該不該強制升級）。建議第一張實作 PLAN 即補完整 migration 測試。
3. **Wizard step rollback chain**：ssh `install-server-bundle` 失敗時 rollback 要不要清 `~/.local/bat-server/`？docker `pick-container` 失敗要不要 `docker rm`？rollback 強度未在共通框架定義，需 T0267 寫一份「rollback 安全 baseline」。
4. **runtime router 對 server-side claude 的相容性**：BAT 內嵌 claude CLI（D027）vs server-side 使用者另裝的 claude，兩端版本 mismatch 行為（已警告但未測）。建議實作 PLAN 加 e2e 測試。
5. **path translation 盲區**：當路徑同時含 home + 非 home（如 symlink target / git submodule 跨檔系統）時的行為，4 種 translator 各自處理但無 cross-env 共通 contract test。
6. **whisper-node-addon 排除規則**：T0264 §5 寫死 hard exclude，但 server bundle build script 真的雙層排除（esbuild externals + extraResources filter）需驗證；v1 沒驗就 release 等於沒做。
7. **跨環境 metadata 顯示一致性**：ProfilePanel 顯示 wsl distro / docker container / ssh host 等資訊，UI 元件設計是否複用？T0264 §6 有起點但未細化。

#### D. 開放決策（RFC，建議 T0267 拍板）

| RFC | 議題 | 候選 | 本工單建議 |
|-----|-----|-----|-----------|
| D-SSH-1 | Auth：系統 ssh CLI vs 內嵌 ssh2 | A. 系統 CLI / B. 內嵌 ssh2 | A（已自決，§1） |
| D-SSH-2 | v1 server matrix | linux-x64+arm64+darwin-arm64 / 加 darwin-x64 / 加 win | 不加（已自決，§3） |
| D-SSH-3 | tunnel vs 直連預設 | tunnel default / 直連 default / 強制 tunnel only | tunnel default + 直連 opt-in（已自決，§5） |
| D-SSH-4 | bundle 上傳方式 | scp / sftp / rsync / ssh+tar | ssh+tar v1 + rsync v2 fast path（已自決，§2） |
| D-SSH-5 | jump host v1 是否支援 | yes / no（透過 ssh-config 透明支援）/ 顯式 UI | no（已自決，§9） |
| D-SSH-6 | translator 命名 | T0264 用 SshLinuxPathTranslator / 改 SshPathTranslator 共用 | 改名 SshPathTranslator（建議；§6） |
| D-SSH-7 | ssh-agent forwarding 預設 | on / off | off + advanced 開（已自決，§9） |
| D-SSH-8 | sudo 安裝 /opt/bat-server | 強制 / opt-in / 排除 | opt-in（已自決，§9） |

#### E. 工程量總估（PLAN-007 全 4 環境）

| 環境 | 工程日（含測試） | 備註 |
|-----|---------------|-----|
| Cross-env 共通框架（T0264 §1-§6） | 5-7 d | profile schema、translator framework、wizard skeleton |
| WSL 部署（T0263） | 3-4 d | 共通框架已抽，僅實作 WslPathTranslator + systemd hook |
| Docker 部署（T0265） | 5-6 d | container lifecycle UI + mount 設定較重 |
| SSH 部署（本工單） | 6-8 d | 詳 A 段 |
| 整合測試 + UX polish + 文件 | 3-5 d | 4 環境 e2e |
| **合計** | **22-30 工程日** | 約 4-6 週（單人專注） |

風險係數：×1.3（first-of-kind multi-deployment 系統）→ **保守估計 30-40 工程日**。

---

### 收尾 commit
- commit message 範例：`chore(workorder): T0266 PLAN-007 SSH deployment spec done — 9 sections ready`
