# T0272-impl-plan007-create-headless-server-factory

## 元資料
- **工單編號**：T0272
- **任務名稱**：PLAN-007 Phase 1 第五張（收尾）— `createHeadlessServer` factory + `scripts/bat-server.mjs` CLI entry + `lockfile.pid` 多 instance 互斥
- **狀態**：TODO
- **建立時間**：2026-04-26 02:53 (UTC+8)
- **類型**：impl（production code，無 UI）
- **互動模式**：disabled（fire-and-forget；scope 已被 spec doc §3.1 / §3.2 凍結）
- **Renew 次數**：0
- **預估 wall time**：8-16h（L sizing；參考 T0269/T0270/T0271 實際 10-22 min，本工單可能 30-60 min）
- **預估 context cost**：高（讀 既有 RemoteServer / secrets.ts / certificate.ts + 寫 factory + CLI + lockfile + token persistence）
- **關聯**：
  - 母 PLAN：PLAN-007（📋 PLANNED）
  - Spec 依據：
    - `_ct-workorders/_spec-remote-dev-support-2026-04.md` §3.1 createHeadlessServer factory contract（凍結）
    - 同 spec §3.2 Token persistence 跨平台（凍結）
    - 同 spec §3.3 Cert renewal（既有 PLAN-018，本工單只需 hook 進 factory）
  - 前序：
    - T0271（✅ DONE，Server bundle pipeline + server-entry.ts stub，commit `42eab95`）
    - T0270（✅ DONE，AuthResultMetadata + RemoteClient middleware，commit `26eb10d`）
  - 後續：T0274/T0275 WSL setup wizard 透過遠端 spawn 跑 bat-server CLI；T0278+ Docker / SSH 部署
  - **D089 worktree 策略**：本工單在 `../bat-plan-007` worktree 內執行，**禁止寫主線**
- **affects_files**（**worktree** `../bat-plan-007` 內，**不是主線**）：
  - 改 `electron/remote/server-entry.ts`（從 T0271 stub 升級為真正 entry，呼叫 `createHeadlessServer`）
  - 新增 `electron/remote/headless-entry.ts`（factory 實作 + interface export）
  - 新增 `scripts/bat-server.mjs`（CLI entry：parse argv → resolve dataDir/port → call factory → start/stop signal handling）
  - 改/新增 `electron/remote/lockfile.ts`（pid 互斥 helper）
  - 新增 `electron/remote/dataDir.ts`（platform default resolver）
  - 新增/擴 `tests/headless-server.test.ts`（factory contract test：start/stop、token persistence、lockfile fail-fast）
  - 改 `scripts/build-server-bundle.mjs`（include `scripts/bat-server.mjs` 進 staging，視 layout 策略）
  - 主線（**禁止寫入**）：僅本工單檔回報區可在主線更新

---

## D089 worktree 工作守則

**本工單為 PLAN-007 Phase B 第五張（Phase 1 收尾），沿用 worktree 模式**：

1. **cd 到 worktree**：`cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007`
2. **base commit**：`4e6a174`（T0271 DONE + report）on `feature/plan-007-remote-dev`
3. **commit 全部到 `feature/plan-007-remote-dev` 分支**
4. **絕對禁止**：
   - 切回主線改檔
   - push 到 origin
   - 在主線目錄下做 source code 修改
5. **本工單檔元資料更新**：Worker 完成後更新 worktree 內本工單檔狀態 → DONE 記 commit hash；**主線本工單檔由塔台同步**

---

## 任務目標

### 1. `HeadlessServerOptions` / `HeadlessServer` interface（spec §3.1 凍結）

在 `electron/remote/headless-entry.ts` 落地，依 spec §3.1：

```typescript
export interface HeadlessHandlerRegistration {
  channel: string
  handler: (ctx: RemoteHandlerContext, ...args: unknown[]) => Promise<unknown> | unknown
}

export interface HeadlessServerOptions {
  dataDir: string                              // required
  port: number                                 // required
  token?: string                               // 自帶；缺則 factory load 持久化或 generate 並寫 dataDir
  bindInterface?: BindInterface                // default 'localhost'
  secretStrategy?: SecretStrategy              // auto-detect（headless = plaintext fallback）
  certificateProvider?: CertificateProvider    // default file-based selfsigned 10y auto-renew
  handlers?: HeadlessHandlerRegistration[]
  logger?: { log; warn; error }
}

export interface HeadlessServerInfo {
  port: number
  bindAddress: string
  fingerprint: string
  tokenHash: string         // sha256 前 8 chars，避免 log 真 token
  startTime: number
  pid: number
  bundleVersion: string
}

export interface HeadlessServer {
  start(): Promise<{ port: number; fingerprint: string; bindAddress: string }>
  stop(): Promise<void>
  rotateToken(opts?: { gracePeriodMs?: number }): Promise<{ token: string; oldToken: string; oldValidUntil: number }>
  renewCertificate(): Promise<{ fingerprint: string; expiresAt: number }>
  getInfo(): HeadlessServerInfo
}

export async function createHeadlessServer(opts: HeadlessServerOptions): Promise<HeadlessServer>
```

**factory 內責任**（spec §3.1 「factory 而非 class」）：
1. 驗 dataDir 存在 / 可寫；不存在 mkdir -p
2. lockfile 檢查（見 §3）
3. token resolve：opts.token > load `dataDir/server-token.json` > generate + persist
4. cert resolve：opts.certificateProvider > new FileCertificateProvider(dataDir/server-cert.json)
5. setSecretStrategy(opts.secretStrategy ?? autoDetect()) — process singleton，多 instance caller 顯式重設
6. new RemoteServer({ port, token, cert, ... }) — 既有 PLAN-018 class
7. 註冊 opts.handlers（pre-start 註冊，避免 race）
8. return wrap object 滿足 `HeadlessServer` interface

> 既有 `RemoteServer` 是 PLAN-018 落地的 class。本工單**不要重寫**，factory 只是 wrap + 預先註冊 handler + lockfile 互斥 + token 持久化。

### 2. Token persistence（spec §3.2 凍結）

實作 `loadOrGenerateToken(dataDir: string): Promise<string>`：

- 路徑 `${dataDir}/server-token.json`
- 存在 → JSON.parse → 用 `secrets.ts` decrypt（safeStorage 或 plaintext fallback）→ return
- 不存在 → `crypto.randomBytes(32).toString('base64url')` → encryptToken → writeFileSync → return

`dataDir` 預設值（spec §3.2，依 platform）：

| Platform | Default path |
|----------|--------------|
| Linux | `${XDG_DATA_HOME:-$HOME/.local/share}/bat-server/` |
| macOS | `${XDG_DATA_HOME:-$HOME/Library/Application Support}/bat-server/` |
| Windows | `%LOCALAPPDATA%\bat-server\`（**不用** `%APPDATA%`，避免 OneDrive sync） |

優先序：CLI flag `--data-dir` > env `BAT_SERVER_DATA_DIR` > platform default > error。

新增 `electron/remote/dataDir.ts`：`resolveDefaultDataDir(): string`

### 3. `lockfile.pid` 多 instance 互斥（spec §3.2）

新增 `electron/remote/lockfile.ts`，三個 function：

```typescript
export interface LockInfo { pid: number; startTime: number }

export function acquireLock(dataDir: string): LockInfo
export function releaseLock(dataDir: string): void
function isPidAlive(pid: number): boolean   // 用 process.kill(pid, 0) try/catch
```

語意：
- `lockfile.pid` 寫 JSON `{ pid, startTime }`
- acquireLock：存在 + pid alive → throw（含 pid + startTime ISO + 「Stop it first or use a different --data-dir」）
- 存在 + pid dead → 視為 stale，覆寫
- releaseLock：unlink，try/catch ignore（檔案不存在不 throw）

`createHeadlessServer` 內：
- start 前 `acquireLock(dataDir)`；fail 直接 throw
- stop 內 `releaseLock(dataDir)`
- CLI entry 接 SIGTERM/SIGINT 時也 releaseLock（見 §4）

### 4. `scripts/bat-server.mjs` CLI entry

新增 ESM CLI script，作為 bundle 內的真正 entry：

**支援 flags**：
- `--data-dir <path>`
- `--port <num>`
- `--bind-interface <localhost|all|ip:...>`
- `--token <token>`
- `--version`
- `--help`

**flow**：
1. 用 `node:util` 的 `parseArgs` 解析 argv
2. `--version` / `--help` 印出後 exit 0
3. resolve dataDir：flag > `BAT_SERVER_DATA_DIR` env > `resolveDefaultDataDir()`
4. resolve port：flag > `BAT_SERVER_PORT` env > 預設（建議 54321）
5. 呼叫 `createHeadlessServer({ dataDir, port, bindInterface, token, logger: console })`
6. `await server.start()` → 印 `[bat-server] listening on <addr>:<port> (fingerprint: <16chars>...)`
7. SIGINT / SIGTERM handler → `await server.stop()` → exit 0
8. 整支腳本用 top-level try/catch，error 印 `console.error` + exit 1（不可 uncaught）

> 此 script 必須符合 BAT helper bundle 規範（BUG-058）。Worker 跑 `npm run verify:helpers`（若 codebase 有此 script）確認 import 都被 covered，或更新 `package.json` build extraResources filter。
> Bundle 內路徑（`../electron/remote/...`）視 T0271 stage 結構而定，Worker 校正後記在回報區。
> **不要用 `child_process.exec()` 拼字串**（codebase 安全規範），signal 處理就靠 `process.on(...)`。

### 5. 升級 `electron/remote/server-entry.ts`（取代 T0271 stub）

從 T0271 的 `console.log('stub')` 升級為呼叫 factory 啟動。

兩種 layout 策略 Worker 自決（spec §3.1 沒明示）：
- **A**：`server-entry.ts` 是 esbuild bundled JS，內含 factory 呼叫；`bat-server.mjs` 是 shell wrapper（透過 `bin/bat-server` POSIX shell 呼 `node bat-server.js`）
- **B**：`server-entry.ts` 薄殼 re-export factory；`bat-server.mjs` 是真 CLI entry，bundle bin 是它

選哪個記在回報區。

### 6. `build-server-bundle.mjs` 整合

確認 T0271 的 build script 把以下都包進 staging：
- `scripts/bat-server.mjs`（如果採策略 B）
- `electron/remote/headless-entry.js`（bundled）
- `electron/remote/lockfile.js`
- `electron/remote/dataDir.js`

T0271 已把整個 `electron/remote/` 複製過去，本工單可能只需要確認 esbuild entry 改對 + bat-server.mjs 加進 `bin/`。

### 7. 整合測試

#### 7a. `tests/headless-server.test.ts`（至少 6 case）

- factory `createHeadlessServer({ dataDir: tmpdir, port: 0, ...})` 不報錯
- start() 回 `{ port, fingerprint, bindAddress }`
- token 持久化：第二次 createHeadlessServer 讀同 dataDir，token 相同
- lockfile 互斥：模擬 pid alive 場景，第二個 createHeadlessServer throw
- stop() 後 lockfile 被刪除
- rotateToken / renewCertificate 接到既有 RemoteServer 對應方法（mock 即可）

#### 7b. CLI smoke（可選；Worker 自決，**Windows host 可豁免**）

- `node scripts/bat-server.mjs --version` 印 version
- `node scripts/bat-server.mjs --help` 印 usage
- `node scripts/bat-server.mjs --port 0 --data-dir <tmp>` 啟動後 SIGTERM 能乾淨關

---

## 守則 / 邊界

1. **不重寫 RemoteServer**：既有 PLAN-018 class 不動，factory 只 wrap。
2. **不動 secrets.ts / certificate.ts**：既有 strategy + provider 直接 reuse；factory 只負責 default 注入。
3. **不接 setup wizard**：CLI 啟動是 wizard 後續 step 的事，本工單只確保 CLI 自己能跑。
4. **不寫 Wsl/Docker/Ssh-specific 啟動邏輯**：CLI 是純 headless，不知道誰呼叫它。Phase 2+ wizard 透過遠端 spawn 呼叫即可。
5. **Token 必須持久化加密**：`secrets.ts` 已有 safeStorage / plaintext fallback strategy，factory 必須用 `setSecretStrategy()` 設好再 encryptToken。Linux 無 keychain → plaintext + warn log（spec D Q1.A）。
6. **Lockfile 必須 stale-aware**：pid 不存在的 lockfile 視為過期，不可永久 block。
7. **CLI 不可 throw uncaught**：所有 error 必須 catch + console.error + process.exit(1)，給 wizard 易讀的訊息。
8. **不用 `child_process.exec()` 拼字串**：codebase 安全規範。改用 `execFileSync` / `spawnSync`。
9. **不要動 source code 以外的東西**（除工單檔自己）。

---

## 驗收標準（AC）

- [ ] **AC1**：`electron/remote/headless-entry.ts` 落地，含 `HeadlessServerOptions` / `HeadlessServer` / `HeadlessServerInfo` interface 與 `createHeadlessServer` factory
- [ ] **AC2**：`electron/remote/lockfile.ts` 落地，`acquireLock`/`releaseLock`/`isPidAlive` 三 function；對 stale lockfile（pid 不存在）能 graceful 覆寫
- [ ] **AC3**：Token persistence 落地：`loadOrGenerateToken`，第一次跑 generate + persist，第二次跑同 dataDir 讀回相同 token
- [ ] **AC4**：`scripts/bat-server.mjs` CLI 落地，支援 `--data-dir` / `--port` / `--bind-interface` / `--token` / `--version` / `--help`
- [ ] **AC5**：CLI 對 SIGINT / SIGTERM 能 graceful stop（呼叫 `server.stop()` + `releaseLock`）
- [ ] **AC6**：`server-entry.ts` 從 T0271 stub 升級，啟動後能跑 factory
- [ ] **AC7**：integration test 至少 6 個 case 全綠（factory contract）
- [ ] **AC8**：`build:server-bundle` 仍能成功跑，tarball 內含 `bat-server.mjs` + 升級後 `server-entry.js` + `headless-entry.js` + `lockfile.js` + `dataDir.js`
- [ ] **AC9**：`verify:server-bundle` 仍綠（無 whisper）
- [ ] **AC10**：既有 BAT desktop `npm run build` 仍通過
- [ ] **AC11**：Worker 在 worktree commit `feature/plan-007-remote-dev` 分支，**不**動主線（除本工單檔回報區）
- [ ] **AC12（runtime，可豁免）**：在 linux/WSL 環境跑 `bat-server --port 0 --data-dir <tmp>`，啟動成功 + 印 fingerprint + Ctrl-C 能乾淨關（**Windows host 可豁免**，留 Phase 2 wizard 步驟做整合驗證）

---

## 完成步驟（建議）

1. cd 到 worktree（`../bat-plan-007`）
2. 確認 base commit `4e6a174`
3. 讀 spec §3.1-§3.2 + 既有 `electron/remote/remote-server.ts`（RemoteServer）+ `electron/remote/secrets.ts` + `electron/remote/certificate.ts`
4. 寫 `electron/remote/lockfile.ts` + `electron/remote/dataDir.ts`
5. 寫 `electron/remote/headless-entry.ts`（interface + factory）
6. 升級 `electron/remote/server-entry.ts`（呼叫 factory；策略 A 或 B 自決）
7. 寫 `scripts/bat-server.mjs`（CLI entry + signal handling）
8. 改 `scripts/build-server-bundle.mjs`（確保新檔被 staging）
9. 跑 `npm run build:server-bundle` 確認新 stub 跑得起來
10. 寫 integration test
11. 跑 `npm test` + `npm run build` + `npm run build:server-bundle` + `npm run verify:server-bundle`
12. commit 到 `feature/plan-007-remote-dev`（建議 message：`feat(remote): T0272 createHeadlessServer factory + bat-server CLI + lockfile`）
13. 更新本工單檔（worktree 內）狀態 → DONE，回報 commit hash + bundle layout 策略選擇 + test 數
14. 結束 session

---

## 回報區（Worker 填寫）

**狀態變更**：TODO → IN_PROGRESS → DONE / FAILED / 需要協助

**worktree commit**：`<hash>` on `feature/plan-007-remote-dev`

**修改檔**：
- ...

**Bundle layout 策略選擇**：
- [ ] A：esbuild entry 內含 factory；bat-server.mjs 是 shell wrapper
- [ ] B：bat-server.mjs 是 CLI entry；server-entry.ts 是薄殼 re-export
- 理由：

**Token persistence 策略**：
- secrets.ts strategy 在 headless 場景的 detect 結果：
- Linux 無 keychain 時是否觸發 plaintext + warn：

**測試結果**：
- factory contract：N passed
- CLI smoke（如有跑）：✅/❌
- build:server-bundle：✅/❌
- verify:server-bundle：✅/❌
- npm run build：✅/❌

**主動超出範圍項**（如有）：
- ...

**遇到的問題 / 決策**：
- ...

**Renew 觸發**（如有）：
- ...

---
