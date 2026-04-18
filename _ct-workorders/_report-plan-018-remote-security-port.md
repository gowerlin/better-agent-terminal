# PLAN-018 Remote Security Hardening Port Research (T0166)

**研究時間**：2026-04-18 11:48 - 12:35 (UTC+8)
**研究者**：Worker（純靜態分析，未 checkout upstream、未跑 dev server）
**關聯**：PLAN-018、T0164、D058

---

## 總覽

### 調查規模

| 項目 | 數量 |
|------|-----|
| Upstream commits 分析 | 2（`3a0af80`、`5d9f486`） |
| Upstream 變更檔案 | 16（+1288/-285） |
| 新增檔案 | 3（`path-guard.ts`、`remote/certificate.ts`、`remote/secrets.ts`） |
| Fork 側 remote/ 檔案 | 6（`protocol.ts`、`remote-server.ts`、`remote-client.ts`、`tunnel-manager.ts`、`handler-registry.ts`、`broadcast-hub.ts`） |
| Fork 客製化關聯 commits | 6（`59a26f8`、`0150f5b`、`abf3d66`、`2890927`、`881aba2`、`f325d1d`） |

### 總體建議

**🟢 需分拆（不整包移植）**，理由：

1. **4 個面向耦合度低**：certificate.ts、path-guard.ts、brute-force 計數器、profile.remoteFingerprint 欄位彼此獨立，可分段驗證、失敗可局部 revert。
2. **Fork T0129 auto-start 與 T0165 C1.2 workspace routing 需合併考量**：不是衝突，但需要拆單時保留現狀（見衝突清單 C1 / C2）。
3. **整包 cherry-pick 會踩到 `src/types/electron.d.ts` 重寫衝突**（upstream 從 65 行手寫改成 type import，fork 有 253 行含 voice/git-scaffold/terminal-notify 擴充的自訂型別），需要人工合流，不適合機器整包。
4. **可獨立的單位**：sandbox、brute-force 計數器、TLS/fingerprint 三面向彼此無硬依賴；整合測試必須排在最後。

---

## 四大面向分析

### A. TLS + Fingerprint Pinning

#### 1. Upstream 實作位置與核心設計

**新增檔案**：
- `electron/remote/certificate.ts`（103 行，新）：`ensureCertificate(configDir)` 載入或產生 self-signed 證書，fingerprint 從 cert 現算（不存，無 drift 風險）。算法 SHA-256 over DER，輸出 `AB:CD:..` 大寫帶冒號格式。
- `electron/remote/secrets.ts`（54 行，新）：`safeStorage` 加密 JSON 包裝層，相容舊 plaintext 格式（讀到未加密檔會嘗試用 `writeEncryptedJson` 升級）。

**主體改造**：
- `remote-server.ts`：`new WebSocketServer({ host, port })` → `https.createServer({ cert, key })` + `new WebSocketServer({ server, maxPayload })`
- 預設 bindInterface = `'localhost'`（`127.0.0.1`），不再無條件 `0.0.0.0`
- Token 儲存：`server-token.json` plaintext → `server-token.enc.json`（safeStorage），保留舊檔讀取並自動遷移
- `remote-client.ts`：`ws://` → `wss://`，`rejectUnauthorized: false` + `on('open')` 手動比對 `_socket.getPeerCertificate().fingerprint256`
- `connect()` 簽名從 `(host, port, token, label)` 改為 `({host, port, token, fingerprint, label})`（**breaking change**）

**依賴新增**：`selfsigned@^5.5.0`（npm package）

#### 2. selfsigned `5d9f486` 補強

- selfsigned v5 `generate()` 改為 async，但 `certificate.ts::generate()` 當 sync 呼叫 → 回傳 Promise object，`.cert` / `.private` undefined → 載入時拋 `Cannot read properties of undefined (reading 'replace')`
- 修法：3 處 call site 加 `await` 並把呼叫者函式標 `async`：`certificate.ts`、`remote-server.ts`、`main.ts`
- **補強影響**：`ensureCertificate()` 變 async，`remoteServer.start()` 也要改成 async

#### 3. Fork 側現況

- Fork `remote-server.ts` 當前 229 行，純 `ws://` + plaintext token，**完全無 TLS 處理**
- Fork `package.json` **無 `selfsigned` 依賴**（有 `ws@^8.19.0`、`@types/ws@^8.18.1`）
- Fork T0129 auto-start（`main.ts:1098-1104`）呼叫 `remoteServer.start()` 無參數 → 預設 host=`'0.0.0.0'` + 無 token 持久化
- Fork T0129 透過 `remoteServer.currentToken` getter 讓 PtyManager 取得 token（`main.ts:1110`）。Upstream 把這個 getter 重命名為 `getPersistedToken()`

#### 4. 移植衝突點

| # | 衝突 | 位置 |
|---|------|------|
| A1 | Fork T0129 auto-start 預設 `0.0.0.0`，upstream 預設 `127.0.0.1`。改 default 後，遠端 profile 需手動切 `tailscale`/`all` | `electron/main.ts:1100` |
| A2 | `remoteServer.currentToken` getter 在 PtyManager callback 中使用，upstream 重命名為 `getPersistedToken()` | `electron/main.ts:1110` |
| A3 | Fork `electron.d.ts` 253 行含 voice / git-scaffold / terminal-notify 自訂型別，upstream 改為 type import from preload。整包 cherry-pick 會刪光 fork 自訂型別 | `src/types/electron.d.ts` |
| A4 | Fork `remote:*` handler 的 preload 簽名未納入 fingerprint（無 `remoteFingerprint`）；App.tsx `remote.connect()` call site 也要加第 4 個參數 | `electron/preload.ts:341-345`、`src/App.tsx:322` |

#### 5. 預估工時

**2.5 - 4 小時**（包含 cert/secret 檔遷移驗證、PtyManager callback 修正、preload/App 連動）

---

### B. Path Sandbox

#### 1. Upstream 沙盒邊界

- `electron/path-guard.ts`（78 行，新）：**deny-list 而非 workspace-scoped sandbox**
- 核心 API：`isSensitivePath(absolutePath): boolean`
- 拒絕清單包含：`~/.ssh`、`~/.aws`、`~/.config/gcloud`、`~/.config/gh/hosts.yml`、`~/.netrc`、`~/.pgpass`、`~/.kube/config`、macOS Keychains、Chrome/Brave/Edge/Firefox credential stores、BAT 自身 cert + token 加密檔、Claude Code `.credentials.json`、Windows `C:\Windows\System32\config`、Linux `/etc/shadow`、`/etc/sudoers`、SSH host keys、`/root`、`/private/etc/master.passwd`
- 額外 regex 防護：`id_(rsa|dsa|ecdsa|ed25519)` in `.ssh/`、`*.pem` in `.ssh/` 或 `keys/`

#### 2. Workspace 結構假設

**upstream 註解明說**：「不做 workspace-scoped sandbox，因為 Claude 讀 `~/.bashrc`、`/etc/hosts` 是合法用途。更嚴格的 scoping 應該透過 `ctx.isRemote` 在 IPC 層做，但我們 *還沒* 傳 isRemote」。

→ **這意味著 path-guard 對 local 與 remote 一視同仁**，不依賴 workspace 結構。

#### 3. Fork 的 workspace 邏輯與 sandbox 的交互

Fork T0165 C1.2（`59a26f8`）引入 `ALWAYS_LOCAL_CHANNELS = {'workspace:save', 'workspace:load'}`：這些 channel 即使在 remote 連線時也本地執行（因為 `ctx.windowId` 沒 forward）。

**影響分析**：
- path-guard 套用在 `fs:readdir` / `fs:readFile` / `fs:search` / `fs:watch` / `image:read-as-data-url`，**不觸及 workspace:save/load**。
- Fork `ALWAYS_LOCAL_CHANNELS` 與 path-guard **彼此正交**，沒有衝突。
- Fork `handler-registry.ts::HandlerContext` 只有 `windowId`，**沒有 `isRemote` 旗標**，與 upstream 一致（upstream 也還沒加）。

#### 4. 移植衝突點

| # | 衝突 | 位置 |
|---|------|------|
| B1 | `fs:readdir` / `fs:readFile` / `fs:search` 的 fork 實作需加 `isSensitivePath()` 檢查 + `path.resolve()` 正規化 | `electron/main.ts` `registerProxiedHandlers()` 內 |
| B2 | Fork 有額外的 `fs:stat`（T0158 PROXIED_CHANNELS）、`fs:reset-watch` 需同步加 path-guard（upstream 只處理 4 個 fs 通道） | `electron/main.ts` `fs:stat` handler |
| B3 | BAT 加密檔路徑條目只寫 macOS 形式（`Library/Application Support/...`），fork 在 Windows/Linux 上需補 `%APPDATA%` / `~/.config/` 路徑（upstream 已有 Linux XDG 條目，但不完整） | `electron/path-guard.ts` DENIED_SUFFIXES |

#### 5. 預估工時

**1 - 1.5 小時**（整檔移植 + 3-5 個 handler 的 `isSensitivePath()` 呼叫點插入 + 平台特定路徑擴充）

---

### C. Brute-force 防護

#### 1. Upstream 失敗計數器設計

位置：`remote-server.ts` lines 45-187

**參數**：
```typescript
MAX_AUTH_FAILURES = 5
AUTH_FAIL_WINDOW_MS = 60_000       // 60 秒窗口
AUTH_BAN_MS = 10 * 60_000          // 封鎖 10 分鐘
```

**資料結構**（**僅 in-memory**，沒有持久化）：
```typescript
authFailures: Map<string, { count, firstFailAt, bannedUntil }>
```

**演算法**：
- 每次認證失敗 → `recordAuthFailure(ip)` 增加計數；當 `count >= 5` 且在 `firstFailAt + 60s` 內 → `bannedUntil = now + 10min`
- 每次新連線先 `isBanned(ip)` 檢查；被封鎖直接 `ws.close(1008, 'Banned')`
- 認證成功 → `clearAuthFailures(ip)`
- 過期窗口（>60s 無失敗）自動重置
- 未認證 client 送任何非 `auth` frame → 立即記錄失敗 + 關閉

**IP 提取**：`req.socket.remoteAddress.replace(/^::ffff:/, '')`（去 IPv4-mapped IPv6 前綴）

#### 2. 持久化需求

**upstream 不持久化**。重啟後計數歸零，被封鎖的 IP 可立即重試。

**判斷**：持久化 non-trivial（需要 safeStorage JSON 檔 + 重啟時載入 + 定期清除過期項），**upstream 的設計選擇是合理的** — DoS 防護而非帳號鎖定，重啟重置可接受。

#### 3. Fork auth 流程影響

Fork 目前 auth 邏輯（`remote-server.ts:97-114`）：
- 單一 token 比對
- 失敗 → 送 `auth-result error` + `ws.close()`
- **無失敗計數、無封鎖**

Fork `profile-manager.ts` 沒有 per-profile 身份區別（所有 profile 共用 `remoteServer.token`）。Upstream 設計也是單 token — **這點一致**。

→ Brute-force 防護**不依賴 fork auth 流程**，純粹是 transport 層的 IP 節流。

#### 4. 移植衝突點

| # | 衝突 | 位置 |
|---|------|------|
| C1 | Fork T0133 `terminal:notify` 與 brute-force 防護**正交**（已認證後才能呼叫），無衝突 | — |
| C2 | Fork 若將來要做 per-IP 白名單（LAN 內部 device），與 brute-force ban 邏輯有潛在互動 — 但目前無此需求 | 未來考量 |
| C3 | 無其他衝突 | — |

**結論**：Brute-force 模組**幾乎零依賴**，可獨立先做。

#### 5. 預估工時

**1 - 1.5 小時**（純 server-side 邏輯新增，無 client 配合，測試亦純 server-side）

---

### D. 整合測試策略

#### 1. Upstream 自帶測試

**upstream 3a0af80 與 5d9f486 都沒有新增測試檔**（`git show --stat` 無 `*.test.*` / `*.spec.*`）。測試由使用者手動驗證。

#### 2. 需要的測試情境清單

**Dev-mode smoke**（開兩個 `npm run dev` instance 模擬兩端）：
- [D1] server 預設 `bindInterface: 'localhost'` 啟動，`netstat` 確認只 bind `127.0.0.1`
- [D2] client 連 `wss://127.0.0.1:9876` 帶正確 fingerprint → 連線成功，能執行一個 `fs:readdir`
- [D3] client 連帶**錯誤**的 fingerprint → 連線立即失敗，server log 記錄 mismatch
- [D4] client 連帶**正確** fingerprint 但**錯誤** token → 5 次失敗後 IP 被 ban 10 分鐘
- [D5] 已連線 client 呼叫 `fs:readFile('~/.ssh/id_rsa')` → 回傳 `{ error: 'Access denied (sensitive path)' }`
- [D6] 已連線 client 呼叫 `fs:readdir('~')` → 結果不含 `.ssh`、`.aws` 等敏感目錄
- [D7] 斷線後重連 → 觀察 exponential backoff 時間分布（3s、6s、12s、24s、30s）+ ±25% jitter
- [D8] 快速切換 remote profile（A → B → A）→ 不應卡住（`withRemoteClientLock` 序列化）

**Packaged 驗證**（`electron-builder --mac --win`）：
- [P1] macOS dmg：啟動後 Console.app 檢查 `safeStorage` 使用 keychain（非 plaintext）
- [P2] Windows NSIS：`%APPDATA%\better-agent-terminal\server-cert.enc.json` 存在且 `enc: true`
- [P3] 舊版 plaintext `server-token.json` 存在時升級 → 自動遷移為 `.enc.json`
- [P4] Tunnel QR code payload 包含 `fingerprint` 欄位（行動端才能 pin）
- [P5] Fork T0129 auto-start + PTY `$BAT_REMOTE_PORT` 環境變數 → Claude CLI 子程序透過 localhost + token 成功回撥

#### 3. 測試環境需求

- **雙 BAT instance**（本機即可，分別跑 `npm run dev -- --port=9876` 和 `npm run dev -- --port=9877`）
- **真實 Tailscale host**（選做，用於驗證 `bindInterface: 'tailscale'` 正確挑選 `100.x.x.x`）
- **macOS keychain 訪問權限**（驗證 safeStorage.isEncryptionAvailable）
- **Linux headless** 情境（safeStorage 不可用時的 plaintext fallback，需 log warning 驗證）

#### 4. 建議 smoke test 流程

```
Phase 1（dev-mode，30 分鐘）
  → D1、D2、D5、D6、D7（基本功能）
Phase 2（dev-mode，30 分鐘）
  → D3、D4、D8（失敗路徑 + 競爭條件）
Phase 3（packaged macOS + Windows，60 分鐘）
  → P1、P2、P3、P4、P5（持久化 + 打包兩平台）
Phase 4（regression，30 分鐘）
  → 跑完 T0163 baseline smoke（確認 vite 7 沒被打破）、BAT 三核心流程（PTY、Claude session、remote profile）
```

**總測試時間預估**：2.5 - 3 小時

---

## 衝突清單

### 🔴 高風險衝突（需個別決策）

| ID | 位置 | Fork 行為 | Upstream 設計 | 建議方向 | 影響工單 |
|----|------|----------|--------------|---------|---------|
| **C1** | `electron/main.ts:1100` | T0129 auto-start 無參數（`0.0.0.0`） | 預設 `bindInterface: 'localhost'` | **hybrid**：保留 auto-start，但傳 `{ bindInterface: 'localhost' }`，符合 PTY 本地 callback 需求 | 工單 1 |
| **C2** | `src/types/electron.d.ts`（全檔 253 行） | 手寫 API 型別含 voice / git-scaffold / terminal-notify / workspace 擴充 | 全刪改成 type import from preload | **keep fork**：fork 型別在 preload 並沒有完整定義，硬切會爆 TS error。保留 fork 手寫，只新增 `remoteFingerprint` / `bindInterface` 欄位 | 工單 1、工單 4 |
| **C3** | `electron/remote/protocol.ts` PROXIED_CHANNELS | 無 `claude:abort-session`、無 `claude:account-*` 系列（fork 未實作 account），有 `claude:scan-star-commands`、`settings:get-logging-info`、`fs:stat`、`git-scaffold:*`、`terminal:notify` 等 fork-only | upstream 加了 `claude:abort-session`、`claude:account-*` 系列 | **hybrid**：合併雙方新增，**加入** `claude:abort-session`（D058 已決定）、**不加** `claude:account-*`（fork 無此功能） | 工單 1 |

### 🟡 中風險衝突（機械式修改）

| ID | 位置 | Fork 行為 | Upstream 設計 | 建議方向 | 影響工單 |
|----|------|----------|--------------|---------|---------|
| **C4** | `electron/main.ts:1110` | `remoteServer.currentToken` getter | `remoteServer.getPersistedToken()` method | **take upstream** + 保留 `currentToken` 作為 alias 向後相容 | 工單 1 |
| **C5** | `electron/main.ts` `loadProfileSnapshot` (line 1020-1046) | inline function in `initialize` block，無 `withRemoteClientLock` | module-scope async function，有 `withRemoteClientLock` | **take upstream pattern**：提升為 module-scope function，加入 mutex 互斥鎖 | 工單 1 |
| **C6** | `electron/main.ts` fs handlers | 無 path-guard 保護 | 全部加 `path.resolve()` + `isSensitivePath()` | **take upstream** + 擴充 `fs:stat` / `fs:reset-watch`（fork-only） | 工單 2 |
| **C7** | `electron/preload.ts` remote/profile 簽名 | 無 `fingerprint` / `bindInterface` | 全部帶新欄位 | **take upstream**（fork 的 `listLocal` 已與 upstream 同步） | 工單 1 |
| **C8** | `electron/path-guard.ts` DENIED_SUFFIXES | N/A（新檔） | macOS 路徑為主，Linux XDG 不完整，Windows 只擋 `System32\config` | **take upstream + 擴充**：補 `%APPDATA%\better-agent-terminal\*.enc.json` / `%USERPROFILE%\.ssh`（Windows 慣例） | 工單 2 |

### 🟢 低風險衝突（格式同步）

| ID | 位置 | Fork 行為 | Upstream 設計 | 建議方向 | 影響工單 |
|----|------|----------|--------------|---------|---------|
| **C9** | `src/components/ProfilePanel.tsx` / `SettingsPanel.tsx` | 無 fingerprint 輸入欄位 | 顯示 fingerprint + bindInterface 選單 + QR payload 加欄位 | **take upstream** | 工單 1 |
| **C10** | `electron/remote/tunnel-manager.ts` `getConnectionInfo` | `(port, token)` + `ws://` | `(port, token, fingerprint, boundHost)` + `wss://` | **take upstream**（breaking change，需連動 `remote:get-connection` 呼叫端） | 工單 1 |
| **C11** | Fork `ALWAYS_LOCAL_CHANNELS` (T0165 C1.2) | `{'workspace:save', 'workspace:load'}` | **無此機制**（upstream 沒處理 `ctx.windowId` 問題） | **keep fork**：與 upstream 功能正交，保留即可 | — |
| **C12** | Fork `profile:list-local` IPC (T0165 C1.2) | fork-only | **無此 IPC** | **keep fork**：和 upstream 正交 | — |

**衝突總數統計**：12 項（3 🔴 / 5 🟡 / 4 🟢）
**需人工決策的只有 3 項**（C1 auto-start bindInterface、C2 electron.d.ts 處理、C3 PROXIED_CHANNELS 合併策略）

---

## 4 張實作工單拆單建議

### 工單 1（暫訂 T-PLAN018-01）：TLS + Fingerprint Pinning

| 欄位 | 內容 |
|------|-----|
| 標題 | 移植 upstream `3a0af80` + `5d9f486` 的 TLS + fingerprint pinning 到 fork remote 層 |
| 依賴順序 | **第 1 張**。工單 2/3 不依賴它，但 profile.remoteFingerprint 欄位是其他工單整合測試的前置（沒 fingerprint 就連不上 wss） |
| 核心變更 | **新增**：`electron/remote/certificate.ts`、`electron/remote/secrets.ts`、`package.json` 加 `selfsigned@^5.5.0`、`src/types/electron.d.ts` 加 `remoteFingerprint` / `bindInterface` 欄位<br>**改寫**：`remote-server.ts` (ws → wss + options 簽名 + getPersistedToken)、`remote-client.ts` (wss + fingerprint pin + exp backoff + generation counter)、`tunnel-manager.ts` (加 fingerprint + boundHost 參數)、`main.ts` (withRemoteClientLock + loadProfileSnapshot 提升 + fs handler path-guard 接入點預留 + T0129 auto-start 傳 `{bindInterface:'localhost'}`)、`preload.ts` (remote / profile 簽名同步)、`profile-manager.ts` (加 remoteFingerprint)、`App.tsx` (remote.connect 加 fingerprint)、`ProfilePanel.tsx` / `SettingsPanel.tsx` (表單欄位 + QR payload) |
| 驗收條件 | ✅ `npx vite build` 成功<br>✅ TypeScript 無新錯誤（`npx tsc --noEmit`）<br>✅ `wss://127.0.0.1:9876` 連線 + 正確 fingerprint 成功握手<br>✅ 錯誤 fingerprint 立即拒絕連線<br>✅ 舊 plaintext `server-token.json` 自動升級為 `.enc.json`<br>✅ Fork T0129 PTY auto-start 依然可讓 Claude CLI 子程序連回 localhost:PORT |
| 預估工時 | **2.5 - 4 小時** |
| 風險旗 | 🔴 **涉及 breaking change（preload 所有 remote/profile 簽名）與 cert 持久化遷移**。需準備回退腳本（刪 `.enc.json` 改回 plaintext） |

---

### 工單 2（暫訂 T-PLAN018-02）：Path Sandbox

| 欄位 | 內容 |
|------|-----|
| 標題 | 移植 `path-guard.ts` 到 fork，擴充 Windows/Linux 平台路徑，並接入 fork 現有 fs handlers |
| 依賴順序 | **可獨立（第 2 張或並行第 1 張）**。與工單 1 正交，僅 `main.ts` fs handler 區塊有 patch 重疊 — 若與工單 1 同時改 `main.ts` 需 rebase |
| 核心變更 | **新增**：`electron/path-guard.ts`（擴充 Windows `%APPDATA%` / Linux XDG 平台特定條目）<br>**改寫**：`main.ts` 中 `fs:readdir` / `fs:readFile` / `fs:search` / `fs:watch` / `fs:stat`（fork-only）/ `fs:reset-watch`（fork-only）/ `image:read-as-data-url` handler 加 `path.resolve()` + `isSensitivePath()` 檢查 |
| 驗收條件 | ✅ `fs:readFile('~/.ssh/id_rsa')` 回傳 `{ error: 'Access denied (sensitive path)' }`<br>✅ `fs:readdir('~')` 結果不含 `.ssh`、`.aws`、`.kube` 等<br>✅ `fs:readdir('project/')` 正常（非敏感路徑）<br>✅ `image:read-as-data-url` 對 >10MB 檔案拋明確錯誤<br>✅ Windows 上 `%APPDATA%\better-agent-terminal\server-cert.enc.json` 不可讀取 |
| 預估工時 | **1 - 1.5 小時** |
| 風險旗 | 🟡 **可能誤擋合法讀取**。須檢查 fork 側 FS panel、git panel、skill scanner 是否會讀到 `~/.config`、`~/Library` 內部的非敏感子路徑 |

---

### 工單 3（暫訂 T-PLAN018-03）：Brute-force 防護 + Max Payload

| 欄位 | 內容 |
|------|-----|
| 標題 | 移植 per-IP 認證失敗節流、AUTH_TIMEOUT、unauth frame 立即關閉、maxPayload 32MB |
| 依賴順序 | **可獨立（第 3 張或並行）**。僅改 `remote-server.ts` 單檔，不需 preload / UI 配合。若與工單 1 同時改 `remote-server.ts` 需 rebase |
| 核心變更 | **改寫**：`remote-server.ts` 加入 `authFailures: Map<string, FailureEntry>` + `recordAuthFailure()` / `isBanned()` / `clearAuthFailures()` / `getClientIp()` 方法，`WebSocketServer` 設 `maxPayload: 32 * 1024 * 1024`，未認證送非 auth frame 立即關閉 |
| 驗收條件 | ✅ 同一 IP 5 次錯誤 token 後第 6 次連線立即被 close(1008, 'Banned')<br>✅ 10 分鐘後同 IP 可再次嘗試<br>✅ 成功認證後 `authFailures` 該 IP 項目被清除<br>✅ 送 >32MB frame → ws 層自動關閉<br>✅ 未認證 client 送 `invoke` frame → 立即關閉 + 記錄失敗 |
| 預估工時 | **1 - 1.5 小時** |
| 風險旗 | 🟢 **低風險**。純 server-side 新增邏輯，無 API 簽名變動，失敗可局部回退 |

---

### 工單 4（暫訂 T-PLAN018-04）：整合測試 + Smoke + Regression

| 欄位 | 內容 |
|------|-----|
| 標題 | 執行 dev-mode + packaged 端到端驗證，確認 PLAN-018 三張工單整合無 regression |
| 依賴順序 | **必須最後做**。依賴工單 1、2、3 全部 merge |
| 核心變更 | **新增**：`_ct-workorders/_report-plan-018-integration-test.md`（測試紀錄）<br>**可能產生**：`docs/remote-security-migration.md`（使用者升級指南，告知需重新 pair remote profile 以取得 fingerprint） |
| 驗收條件 | ✅ Phase 1 (dev-mode basic): D1/D2/D5/D6/D7 pass<br>✅ Phase 2 (dev-mode failure paths): D3/D4/D8 pass<br>✅ Phase 3 (packaged macOS + Windows): P1/P2/P3/P4/P5 pass<br>✅ Phase 4 (regression): vite 7 build 正常、BAT PTY / Claude session / ct-panel / git-panel 三大核心流程無 regression<br>✅ 升級指南文件完成 |
| 預估工時 | **2.5 - 3 小時** |
| 風險旗 | 🔴 **打包測試難度高**。macOS 需 keychain 權限、Windows NSIS 產出大、Tailscale 測試需真實環境。建議保留 1 小時 buffer |

---

### 4 張工單合計預估工時

**7 - 10 小時**（含 buffer）。建議分兩天完成：
- Day 1（4-6h）：工單 1（2.5-4h）+ 工單 3（1-1.5h，可並行）
- Day 2（3-4.5h）：工單 2（1-1.5h）+ 工單 4（2.5-3h）

---

## 依賴順序圖

```mermaid
graph TD
    A[工單 1: TLS + Fingerprint<br/>2.5-4h 🔴] --> D[工單 4: 整合測試<br/>2.5-3h 🔴]
    B[工單 2: Path Sandbox<br/>1-1.5h 🟡] --> D
    C[工單 3: Brute-force<br/>1-1.5h 🟢] --> D
    
    A -.可並行.- C
    A -.rebase 衝突<br/>main.ts fs區.- B
    A -.rebase 衝突<br/>remote-server.ts.- C
    
    style A fill:#f8d7da,stroke:#721c24,color:#721c24
    style B fill:#fff3cd,stroke:#856404,color:#856404
    style C fill:#d4edda,stroke:#155724,color:#155724
    style D fill:#f8d7da,stroke:#721c24,color:#721c24
```

**並行機會**：
- 工單 1 + 工單 3 可並行（不同檔案區塊）
- 工單 2 與工單 1 都動 `main.ts` fs handler 區塊，建議序列（工單 1 先 merge 再做工單 2）

**序列強制**：工單 4 必須在 1/2/3 全 merge 後才能開始

---

## 下一步選項

### [A] 接受拆單建議，依序派發 4 張實作工單 ✅ 推薦

**理由**：
- 4 張工單切分清晰，依賴關係明確
- 工單 2 / 3 風險低、工時短，可當 warm-up
- 工單 1 是最大單位但範圍收斂（cert 檔遷移 + preload 簽名 + UI 三處）
- 符合 D058 Phase 2 獨立 PLAN-018 + EXP worktree 策略

**建議派發順序**：
1. 先派工單 3（🟢 brute-force，低風險 1-1.5h 練手，驗證 worktree 流程）
2. 派工單 1（🔴 TLS，最大影響面，需 C1/C2/C3 決策）
3. 派工單 2（🟡 sandbox，接在工單 1 之後避免 rebase）
4. 派工單 4（🔴 整合測試，全部 merge 後）

### [B] 調整拆單

**候選**：
- B1：合併工單 3 進工單 1（都改 `remote-server.ts`）→ 減少 rebase，但工單 1 變更放大到 3.5-5.5h
- B2：把「UI 表單與 QR payload」從工單 1 拆出來成工單 1b → 工單 1 只做 server/client/main，UI 獨立驗證
- B3：把「cert 檔遷移腳本 + 升級指南」從工單 4 拆出來成工單 5

### [C] 調整 PLAN-018 範圍

**候選**：
- C1：先不做 path sandbox（工單 2），因為 upstream 註解自稱「harm-reduction 而非完整 sandbox」+ 需擔心誤擋合法讀取 → PLAN-018 只做 TLS + brute-force + 整合測試（3 張工單，4.5-7h）
- C2：暫緩 UI 整合（ProfilePanel / SettingsPanel / QR payload），先讓 core 層能通，UI 用手動編輯 profile JSON 臨時支援 → 工單 1 從 2.5-4h 壓到 1.5-2.5h

**推薦：[A]**。拆單粒度與風險分布已合適，C2 的 UI 延後對行動端 QR 流程衝擊大，B1 的合併會讓一張 🔴 工單變更過大不便 review。

---

## 附錄：研究涵蓋率

### 有讀到（靜態分析）
- ✅ `3a0af80` 全 16 檔案 diff 概覽 + certificate.ts / secrets.ts / path-guard.ts 全文 + remote-server.ts / remote-client.ts / tunnel-manager.ts / main.ts / preload.ts / profile-manager.ts diff
- ✅ `5d9f486` selfsigned async 修復全貌
- ✅ Fork 側 `electron/remote/` 6 個檔案清單 + `remote-server.ts` / `remote-client.ts` / `protocol.ts` 全文 + `tunnel-manager.ts` 全文 + `handler-registry.ts` 全文
- ✅ Fork 側 `main.ts` T0129 auto-start 片段、T0165 C1.2 `ALWAYS_LOCAL_CHANNELS` 改動
- ✅ Fork 側 `profile-manager.ts` remoteFingerprint 欄位盤點（目前無）
- ✅ Fork 側 `package.json` selfsigned 依賴缺失確認

### 沒讀到（可日後補）
- ❌ Fork 側 `ProfilePanel.tsx` / `SettingsPanel.tsx` 完整實作（僅知道需要加 fingerprint 欄位）
- ❌ Fork 側 `App.tsx` remote.connect 呼叫點完整上下文（只看了 upstream diff 位置）
- ❌ Fork 側 T0158 PROXIED_CHANNELS 重整的完整原因（已知擴充了 `git-scaffold:*`、`terminal:notify`、`fs:stat`、`fs:reset-watch` 等，但沒深追該 commit 具體理由）
- ❌ 實測 Windows `%APPDATA%\better-agent-terminal\` 實際路徑（靠慣例推斷）

這些空白都在工單 1 / 2 執行時可補充，不影響拆單決策。

---

**研究完成時間**：2026-04-18 12:35 (UTC+8)
**研究者建議**：進入「下一步 [A]」流程，先派 T0167（工單 3 brute-force）暖身，再派 T0168（工單 1 TLS）主餐。
