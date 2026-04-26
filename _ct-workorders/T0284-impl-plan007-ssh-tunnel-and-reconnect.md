# T0284 — Impl PLAN-007 SshTunnel class + RemoteClient reconnect 整合

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0284 |
| 類型 | impl |
| Phase | PLAN-007 Phase 4（SSH deployment）第三張 |
| 狀態 | ✅ DONE（clean DONE，無 PARTIAL；所有 10 AC 全綠；worktree commit `c9d3801`，3 files / +642 / -2） |
| 建立時間 | 2026-04-26 14:30 (UTC+8) |
| 派發時間 | 2026-04-26 14:30 (UTC+8) |
| 完成時間 | 2026-04-26 14:45 (UTC+8) |
| Wall time | ~15 min（GP099 校準 30-60 min 預期，第三次連續落於下界以下；T0266 §5 spawn args 逐字 + §8 reconnect chain 完整 spec + D042 既有 secure spawn pattern 是神速主因） |
| Worktree commit | `c9d3801` on `feature/plan-007-remote-dev` |
| 關鍵設計亮點 | 1) `SshTunnelDeps` 注入式設計讓 8 個 mock test 不真連 ssh；2) `errorType=tunnel` 沿用既有 channel 守住 T0270 凍結 channel set；3) `TUNNEL_MAX_RESTART_FAILURES=5` 限制讓 reconnect 不無限重試 |
| Sizing | L（spec 估 8-16h；GP099 校準後預期 wall 30-60 min — child_process spawn ssh + reconnect chain hook） |
| 依賴 | T0270（RemoteClient middleware + reconnect framework）✅、T0282（profile schema serverHome 已落地）✅ |
| 後續 | T0285 SSH setup wizard（依本工單 SshTunnel + verify-ssh-auth）、T0286 systemd / launchd 啟動（依 wizard） |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-tunnel.ts`（新建）、`electron/remote/remote-client.ts`（reconnect chain hook）、`tests/ssh-tunnel.test.ts`（新建） |

## 目標

落地 T0266 §5 + §8 凍結 spec：新增 `SshTunnel` class（spawn `ssh -N -L ... -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes` 子行程 + tunnel ready polling + onTunnelDown event），整合進 `RemoteClient` reconnect chain（reconnect 第一步檢查 tunnel 是否還活，死了先重建再重連 wss）；新增 ssh-tunnel 單元測試（mock child_process）。

## 範圍

### 新增

1. **`electron/remote/ssh-tunnel.ts`**（新檔）
   - `export class SshTunnel`
   - Constructor 參數（從 profile `extractTargetOSMeta` 取）：
     ```ts
     interface SshTunnelOptions {
       sshHost: string
       sshUser: string
       sshPort?: number          // default 22
       sshKeyPath?: string       // undefined → OpenSSH 自動找
       remotePort: number        // BAT server bind port (server-side)
       localPort?: number        // undefined → 動態挑 free port
     }
     ```
   - 主要方法：
     - `async start(): Promise<{ localPort: number }>` — spawn ssh，回傳實際 localPort
     - `async stop(): Promise<void>` — kill ssh 子行程
     - `isAlive(): boolean` — 檢查 ssh 子行程仍存在
     - `on(event: 'tunnel-down', listener: () => void): void` — ssh exit 時觸發
   - **spawn 命令**（T0266 §5 凍結）：
     ```ts
     const args = [
       '-N',
       '-L', `${localPort}:localhost:${remotePort}`,
       '-o', 'ServerAliveInterval=30',
       '-o', 'ServerAliveCountMax=3',
       '-o', 'ExitOnForwardFailure=yes',
       '-o', 'StreamLocalBindUnlink=yes',
     ]
     if (sshPort && sshPort !== 22) args.push('-p', String(sshPort))
     if (sshKeyPath) args.push('-i', sshKeyPath)
     args.push(`${sshUser}@${sshHost}`)
     // 走 BAT 既有安全 spawn（不過 shell）
     // 沿用 main.ts:1696 / 2353 既有 pattern：dynamic import + execFile + Promise wrapper（參考 T0149 D042 偏差合理化）
     ```
   - **動態挑 localPort**（若 caller 沒指定）：用 `net.createServer().listen(0)` 拿 OS 配置的 free port，再 close → 把 port 號傳給 ssh `-L`
   - **Tunnel ready polling**：
     - spawn ssh 後，從第 1 秒起每 200ms tcp connect `127.0.0.1:<localPort>` 試探
     - 連通即 resolve `start()` Promise
     - 10 秒 timeout → reject + kill ssh 子行程
   - **stderr 監聽**（不阻塞 start，記 log）：
     - `Permission denied` → emit warning
     - `Connection refused` → emit warning
     - `Host key verification failed` → emit warning（後續 T0285 wizard 會接此）
   - **exit event**：ssh 子行程 exit（非 stop() 主動觸發）→ emit `tunnel-down`

2. **`tests/ssh-tunnel.test.ts`**（node:test runner，沿用 wsl-path.test.ts 風格）
   - **不真的 spawn ssh**（CI/dev 環境不能依賴外部 host）；改用 mock `child_process.spawn` 模擬：
     - mock spawn 回 fake ChildProcess（EventEmitter + stdin/stdout/stderr stub）
     - test1：`start()` 在 free port 上 polling tcp，連通後 resolve
     - test2：spawn 後 ssh 立刻 exit code 255 → `tunnel-down` 應 emit
     - test3：tcp polling 10 秒未連通 → `start()` reject + ssh process 應被 kill
     - test4：spawn args 組裝正確（含 `-N`、`-L localport:localhost:remoteport`、`ServerAliveInterval=30` 等所有 hardcode option）
     - test5：`sshKeyPath` 帶值 → args 含 `-i`；不帶 → args 不含 `-i`
     - test6：`sshPort=22` → args 不含 `-p`；`sshPort=2222` → args 含 `-p 2222`
     - test7：`stop()` 後 `isAlive()` 回 false
     - test8：動態 localPort 在不指定時應 > 0 且 < 65536
   - 至少 8 個 case

### 修改

3. **`electron/remote/remote-client.ts`** — reconnect chain hook
   - **既有**（T0270 凍結）：exponential backoff reconnect + TLS + fingerprint pinning
   - **新增**：reconnect 第一步檢查 SshTunnel
     - 若 profile `useSshTunnel === true` 且 `targetOS` 是 `ssh-linux | ssh-darwin`：
       1. 檢查 `this.tunnel?.isAlive()`
       2. tunnel 死掉 → `await this.tunnel.start()` 重建（同樣 backoff，避免 ssh server rate limit）
       3. tunnel 還活 → 直接重連 wss
     - 不影響 wsl / docker / local（其他 profile 走原邏輯）
   - **連線初次建立**（非 reconnect path）：
     - 若 profile 需要 tunnel → 先 `new SshTunnel(opts).start()` → 用回傳的 `localPort` 建 wss URL `wss://127.0.0.1:<localPort>` → 再走 TLS + fingerprint pinning
   - **tunnel-down 事件接駁**：
     - SshTunnel emit `tunnel-down` → `this.disconnect()` → 觸發既有 wss reconnect chain
     - 第一步檢查 tunnel 已 dead → 重建 → 重連
   - **連續 5 次 tunnel start 失敗**：emit 上層 modal 事件（IPC channel 已凍結，沿用既有 `auth-error` 或新增 `tunnel-error`，由 Worker 自決，不破 channel set）
     - **Worker 守則**：channel set 已凍結（T0270），**不要新增 IPC channel**；若需新事件，walls 在 RemoteClient 內 emit + IPC 用既有 `connection-error` 或同級 channel 包 `errorType: 'tunnel'`

### Out of scope（不做）

- ❌ 不寫 verify-ssh-auth wizard step（留 T0285）
- ❌ 不動 PathTranslator（T0282 已落）
- ❌ 不動 channel set / IPC schema（T0270 凍結）
- ❌ 不寫 SSH key generation / management UI（D-SSH-7 排除 v1）
- ❌ 不寫 jump host 邏輯（D-SSH-5 拍板：透過 `~/.ssh/config` 透明支援，BAT 不解析）
- ❌ 不寫 tunnel rate limiting（依賴 RemoteClient 既有 exponential backoff）
- ❌ 不在 ssh-tunnel.ts 引入 ssh2 npm（D-SSH-1 拍板：系統 ssh CLI）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §5 §8 §6 C-1 | SSH tunnel + reconnect 凍結 spec |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §5 L580-628 §8 L898-959 | SshTunnel spawn 命令逐字 + reconnect 策略 + 場景表 |
| `electron/remote/remote-client.ts`（worktree 現況） | T0270 reconnect framework + TLS pinning + fingerprint TOFU |
| `electron/profile-manager.ts`（T0282 後） | `extractTargetOSMeta` 解出 ssh-linux/darwin metadata（含 sshHost/User/Port/KeyPath/useSshTunnel/tunnelLocalPort/serverHome） |
| `electron/main.ts`（既有 secure spawn pattern） | L1696 / L2353 dynamic import + execFile pattern（D042）— SshTunnel 沿用 |
| `tests/ssh-config-parser.test.ts`（T0282 產出） | node:test runner + mock 風格範本 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-tunnel.ts` 存在，export `SshTunnel` class + `SshTunnelOptions` interface | grep + 檔案存在 |
| AC2 | `SshTunnel.start()` spawn ssh args 完整含所有 hardcode option（`-N` / `-L localport:localhost:remoteport` / 三個 `-o` / `StreamLocalBindUnlink=yes`） | 寫進 ssh-tunnel.test.ts test4 |
| AC3 | 動態挑 free localPort 機制：caller 不指定時 `net.createServer().listen(0)` 拿 port，再傳給 ssh -L | 寫進 ssh-tunnel.test.ts test8 |
| AC4 | tunnel ready polling 邏輯：spawn 後每 200ms tcp connect 試探，連通 resolve / 10s timeout reject + kill | 寫進 ssh-tunnel.test.ts test1/test3 |
| AC5 | `tunnel-down` event 在 ssh 子行程 exit 時 emit；`stop()` 主動觸發不 emit | 寫進 ssh-tunnel.test.ts test2/test7 |
| AC6 | `RemoteClient` reconnect 第一步檢查 SshTunnel；tunnel dead → 重建；tunnel alive → 直接 wss 重連 | grep remote-client.ts + 程式碼 review |
| AC7 | 初次連線（非 reconnect）：profile `useSshTunnel === true` 時先 spawn tunnel 再 wss connect 127.0.0.1:<localPort> | grep + 程式碼 review |
| AC8 | tunnel-down event 接駁：SshTunnel emit → RemoteClient 觸發既有 wss reconnect chain | grep + 程式碼 review |
| AC9 | **不新增 IPC channel**（T0270 凍結）；新事件包在既有 channel `errorType` 區分 | grep `ipcMain.handle` / `contextBridge` 確認無新 channel |
| AC10 | `npx tsx tests/ssh-tunnel.test.ts` 全綠，至少 8 case；TypeScript strict 編譯通過（除 baseline BUG-061 豁免） | 跑指令 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0284 SshTunnel class + RemoteClient reconnect 整合\n\n工單：T0284\n依賴：T0270 / T0282\n落地 T0266 §5 §8 凍結 spec（系統 ssh CLI + tunnel + reconnect chain）`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0284-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash（npm/npx/tsc/node）/ Grep / Glob。
5. **emoji**：除測試輸出外禁用。
6. **Channel set 凍結**：T0270 凍結 channel 名單；本工單**嚴禁新增 IPC channel**。新事件用既有 channel `errorType` 區分（同 spec §6 C-1 風格）。
7. **不引 ssh2 npm**：D-SSH-1 拍板用系統 ssh CLI，禁止 `npm install ssh2`。
8. **Mock spawn 不真連**：tests 必須 mock `child_process.spawn`，**禁止真的 spawn ssh 連任何 host**（CI / dev 隔離）。
9. **dynamic localPort 安全**：用 `net.createServer().listen(0)` 拿 port → close → 傳給 ssh，**禁止** loop 試 `getRandomInt(50000, 60000)`（race condition）。
10. **completion 判定**：10 個 AC 全過或 ≥ 8（baseline BUG-061 仍豁免 AC10 部分）→ 完成訊息 `T0284 完成`，否則 `T0284 部分完成：<AC# + 原因>`。

## 預期 wall

**30-60 min**（GP099 校準後；T0266 §5 給 spawn args 逐字 + §8 給 reconnect chain 邏輯，主要工作為 RemoteClient hook 設計 + mock 風格 test 書寫）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0284 完成」訊息後從本檔讀回報區）
