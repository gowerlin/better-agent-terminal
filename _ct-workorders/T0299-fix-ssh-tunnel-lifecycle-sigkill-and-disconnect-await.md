---
schema_version: 1
schema_kind: workorder
id: T0299
title: Fix v0.4.1 SSH/Tunnel Lifecycle Hardening（BUG-063 + BUG-067）
type: fix
status: DONE
sizing: L
created_at: "2026-04-26T18:12:00+08:00"
completed_at: "2026-04-26T18:32:00+08:00"
renew_count: 0
workdir: "**main repo**，branch **`release/v0.4.0`**（v0.4.1 patch 累積在同分支）"
---
# T0299 — Fix v0.4.1 SSH/Tunnel Lifecycle Hardening（BUG-063 + BUG-067）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0299 |
| 類型 | fix（v0.4.1 patch） |
| Phase | v0.4.1 patch chain 第 1 張 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 18:12 (UTC+8) |
| 派發時間 | 2026-04-26 18:13 (UTC+8) |
| 完成時間 | 2026-04-26 18:32 (UTC+8) |
| Wall time | ~19 min（GP099 下界） |
| Sizing | L（GP099 校準後預期 wall 15-25 min — kill helper + await chain + cross-file 套用） |
| 依賴 | T0298 ✅（v0.4.0 GO verdict）、T0296（ssh-args.ts helper pattern）、BUG-063、BUG-067 |
| 後續 | T0300（RemoteClient + WizardRunner state）→ T0301 → T0302 |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`**（v0.4.1 patch 累積在同分支） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-process-lifecycle.ts`（新建，共用 kill helper）、`electron/remote/ssh-tunnel.ts`、`electron/remote/ssh-start-server.ts`、`electron/remote/ssh-auth-probe.ts`、`electron/remote/remote-client.ts`、各對應 test 檔補 case |

## 目標

修復兩個 SSH lifecycle BUG：

- **BUG-063**（F-007 + EC-009）：SshTunnel / runSsh / probe 三處 ssh 子行程在 timeout 時只 SIGTERM，stuck process 收不到信號 → 殭屍進程
- **BUG-067**（EC-006）：RemoteClient.disconnect() 不 await tunnel.stop() → ssh 子行程 overlap race

採**抽共用 lifecycle helper** 一次解兩根因：

```ts
// electron/remote/ssh-process-lifecycle.ts (新建)

/**
 * Graceful shutdown of ssh child process with SIGKILL escalation.
 * 1. SIGTERM
 * 2. wait gracePeriodMs (default 1000ms)
 * 3. if still alive → SIGKILL
 * 4. resolves when process exits or timeoutMs elapsed
 */
export async function shutdownSshProcess(
  proc: ChildProcess,
  opts: { gracePeriodMs?: number; timeoutMs?: number; logger?: { warn: (m: string) => void } } = {}
): Promise<{ exited: boolean; method: 'sigterm' | 'sigkill' | 'timeout' }> {
  const grace = opts.gracePeriodMs ?? 1000
  const total = opts.timeoutMs ?? 5000

  if (proc.exitCode != null || proc.signalCode != null) {
    return { exited: true, method: 'sigterm' }  // already exited
  }

  const exitPromise = new Promise<void>(resolve => {
    proc.once('exit', () => resolve())
  })

  proc.kill('SIGTERM')
  const sigtermResult = await Promise.race([
    exitPromise.then(() => 'exited' as const),
    sleep(grace).then(() => 'timeout' as const),
  ])
  if (sigtermResult === 'exited') return { exited: true, method: 'sigterm' }

  // escalate to SIGKILL
  opts.logger?.warn(`ssh process ${proc.pid} did not exit after SIGTERM ${grace}ms, escalating to SIGKILL`)
  proc.kill('SIGKILL')
  const sigkillResult = await Promise.race([
    exitPromise.then(() => 'exited' as const),
    sleep(total - grace).then(() => 'timeout' as const),
  ])
  if (sigkillResult === 'exited') return { exited: true, method: 'sigkill' }

  opts.logger?.warn(`ssh process ${proc.pid} did not exit after SIGKILL ${total - grace}ms`)
  return { exited: false, method: 'timeout' }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
```

## 範圍

### 新增 `electron/remote/ssh-process-lifecycle.ts`

逐字落地上方 helper（含 `shutdownSshProcess` + `sleep`）。

### 修改 SSH lifecycle 入口

| 檔案 | 改動 |
|------|------|
| `electron/remote/ssh-tunnel.ts` | `stop()` + start error path（timeout / tunnel-down）改用 `shutdownSshProcess(proc)`；`stop()` **必須 await** lifecycle 完成 |
| `electron/remote/ssh-start-server.ts` | `runSsh` 內部 timeout 路徑改用 `shutdownSshProcess` |
| `electron/remote/ssh-auth-probe.ts` | probe 子行程 timeout 路徑改用 `shutdownSshProcess`（既有 152-164 SIGTERM only） |
| `electron/remote/remote-client.ts` | `disconnect()` 改為 async + `await this.tunnel?.stop()`（BUG-067） |

### 補測試

5. **`tests/ssh-process-lifecycle.test.ts`** 新建
   - test1：proc 在 SIGTERM grace period 內 exit → method='sigterm'
   - test2：proc 不響應 SIGTERM → SIGKILL escalation → exit → method='sigkill'
   - test3：proc 也不響應 SIGKILL → method='timeout'
   - test4：proc 已 exit → 立即 return method='sigterm', exited=true（no kill called）
   - test5：grace + total timeout 自訂值生效
   - test6：logger.warn 在 escalation 觸發
   - 至少 6 case，全 mock ChildProcess
6. **`tests/ssh-tunnel.test.ts`** 補 case
   - tunnel.stop() 觸發 shutdownSshProcess（mock 監測 spawn 後的 lifecycle）
7. **`tests/remote-client-middleware.test.ts`** 補 case
   - disconnect() 是 async 且 await tunnel.stop()（mock tunnel.stop slow → disconnect resolve 在 stop 之後）

### Out of scope（不做）

- ❌ 不擴展其他子行程 lifecycle（如 docker exec / wsl interop — 留 future）
- ❌ 不修 baseline BUG-061
- ❌ 不擴 BUG-062~068 其他項（留 T0300 / T0301）
- ❌ 不引入新 dep（child_process / setTimeout 用 Node 內建）
- ❌ 不寫 Windows-specific 行為（taskkill 等；macOS / Linux POSIX signal 即可）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/BUG-063-*.md` | SIGKILL escalation 詳情 + 跨檔 pattern 列表 |
| `_ct-workorders/BUG-067-*.md` | disconnect 不 await tunnel.stop 詳情 + 修復策略 |
| `_ct-workorders/T0292-review-report.md` F-007 | tunnel SIGTERM only 詳情 |
| `_ct-workorders/T0293-review-report.md` EC-006 + EC-009 | disconnect race + 跨檔 pattern |
| `electron/remote/ssh-tunnel.ts` 現況 | 既有 stop / kill 行為 |
| `electron/remote/ssh-start-server.ts::runSsh` 現況 | 既有 timeout 處理 |
| `electron/remote/ssh-auth-probe.ts:152-164` 現況 | 既有 SIGTERM 處理 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-process-lifecycle.ts` 存在，export `shutdownSshProcess` + 含 grace / timeout 機制 | grep |
| AC2 | BUG-063 修：3 個 ssh lifecycle 入口（tunnel/start-server/probe）皆改用 shutdownSshProcess | grep + diff |
| AC3 | shutdownSshProcess 實作 SIGTERM → grace → SIGKILL → final timeout 4 階段 | 寫進 ssh-process-lifecycle.test.ts |
| AC4 | BUG-067 修：`RemoteClient.disconnect()` 改為 async + await this.tunnel?.stop() | grep + diff |
| AC5 | `tests/ssh-process-lifecycle.test.ts` ≥ 6 case 全綠 | 跑指令 |
| AC6 | tunnel.stop() 已 await shutdownSshProcess（不再立即 return） | grep |
| AC7 | 既有 ssh-tunnel / ssh-start-server / ssh-auth-probe / remote-client test 全部仍綠（zero regression） | 跑指令 |
| AC8 | TypeScript baseline drift = 0（沿用 36） | 跑 tsc |
| AC9 | git diff stat：受影響 ≤ 250 lines net add | 計算 |
| AC10 | logger.warn 在 SIGKILL escalation 觸發（debug-friendly） | 寫進 test6 |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch（v0.4.1 patch 累積同分支，後續 tag bump 在 T0302）
2. **commit message**：`fix(remote): T0299 SSH/Tunnel lifecycle hardening (BUG-063 + BUG-067)\n\n工單：T0299\n依賴：BUG-063 + BUG-067\n抽 ssh-process-lifecycle.ts 共用 helper：shutdownSshProcess (SIGTERM → grace → SIGKILL escalation)`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0299-*.md`
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob
5. **emoji**：除測試輸出外禁用
6. **POSIX signal only**：v0.4.1 不寫 Windows taskkill 變體（macOS / Linux 使用者為主）
7. **mock spawn**：tests 全 mock，禁止真 spawn ssh
8. **零 regression**：跨 4 個 ssh 模組既有 test 必須全綠
9. **不擴範圍**：僅修 BUG-063 + BUG-067；其他 v0.4.1 BUG 留 T0300+
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0299 完成`

## 預期 wall

**15-25 min**（GP099 校準後；shutdownSshProcess 約 30-40 行純函數 + 3 個 ssh 模組替換 + remote-client async 改 + 6 case test + 各模組補 1-2 case）

## 工單回報區

**完成狀態**：DONE — 10/10 AC pass，BUG-063 + BUG-067 雙根因落地，零 regression。

**產出摘要**：
- **新增** `electron/remote/ssh-process-lifecycle.ts`：`shutdownSshProcess` 共用 helper，4 階段（SIGTERM → grace → SIGKILL → final timeout），含 logger.warn 升級。Default grace=1s / total=5s。
- **修 BUG-063** 三個 ssh lifecycle 入口：
  - `ssh-tunnel.ts::stop()` 改 `await shutdownSshProcess(proc)`（同時把 start() 失敗的 error path 也走 helper）
  - `ssh-start-server.ts::runSsh` timeout 路徑：`void shutdownSshProcess(proc)` fire-and-forget（runSsh 仍在 timer fire 時回傳 timedOut）
  - `ssh-auth-probe.ts` probe timeout 路徑：同 fire-and-forget pattern + 帶 logger
- **修 BUG-067** `RemoteClient.disconnect()` 改為 `async` + `await this.tunnel?.stop()`（連帶 `connect()` 也 `async` 並 `await this.disconnect()`）。所有現有 `await client.connect(...)` callsite 不受影響。
- **新增** `tests/ssh-process-lifecycle.test.ts`：6 case（SIGTERM exit / SIGKILL escalation + warn / SIGKILL ignored timeout / 已 exit short-circuit / 自訂 grace+timeout / kill throw 吞掉）
- **補 case** `tests/ssh-tunnel.test.ts` test9：stop() 必須 await SIGKILL 真正觸發 exit 才 resolve
- **補 case** `tests/remote-client-middleware.test.ts`：disconnect() 等 tunnel.stop()、disconnect() 吞掉 stop() rejection

**測試結果**：
- ssh-process-lifecycle: 6/6 pass（new file）
- ssh-tunnel: 11/11 pass（10 既有 + 1 新增 test9）
- ssh-args / ssh-auth-probe / ssh-start-server / ssh-bundle-uploader / ssh-config-parser: 全綠（13 + 10 + 19 + 8 + 8 = 58）
- **SSH suite 全部**：75 pass / 0 fail
- remote-client-middleware: 15/15 pass（13 既有 + 2 新增 disconnect await）
- auth-result-metadata: 5/6（baseline 既有 1 fail，與本工單無關，stash 驗證）
- tsc baseline: **36 errors**（CodexAgentPanel.tsx + agent-profiles.ts BUG-061，零 drift）

**Diff stat（受影響）**：8 file changed，net add **246 lines**（≤ AC9 上限 250）
- `electron/remote/ssh-process-lifecycle.ts` +69（新檔）
- `tests/ssh-process-lifecycle.test.ts` +85（新檔）
- `electron/remote/remote-client.ts` net +13
- `electron/remote/ssh-tunnel.ts` net 0（24 add / 24 del — helper 替換）
- `electron/remote/ssh-start-server.ts` net +5
- `electron/remote/ssh-auth-probe.ts` net +4
- `tests/ssh-tunnel.test.ts` net +42（test9 SIGKILL escalation case）
- `tests/remote-client-middleware.test.ts` net +27（2 case + helper）

**互動紀錄**：無（fire-and-forget yolo）

**遭遇問題**：無實質卡點。一輪 trim：初版 net 407（test 過詳）→ 削減測試文件 + helper docstring 至 246（過 AC9）。

**Renew 歷程**：無

**AC 對照**：

| # | 條件 | 結果 |
|---|------|------|
| AC1 | ssh-process-lifecycle.ts export shutdownSshProcess + grace/timeout | ✅ |
| AC2 | tunnel/start-server/probe 三入口皆走 shutdownSshProcess | ✅ grep 確認 |
| AC3 | helper 4 階段 SIGTERM→grace→SIGKILL→timeout | ✅ test1+2+3+5 涵蓋 |
| AC4 | RemoteClient.disconnect() async + await tunnel.stop() | ✅ |
| AC5 | ssh-process-lifecycle.test.ts ≥ 6 case | ✅ 6 pass |
| AC6 | tunnel.stop() 已 await shutdownSshProcess | ✅ test9 證實 stop() 不在 SIGKILL exit 前 resolve |
| AC7 | 既有 4 個 ssh 模組 + remote-client test 零 regression | ✅ SSH 75/75、middleware 15/15 |
| AC8 | tsc baseline drift = 0（沿用 36） | ✅ |
| AC9 | git diff stat ≤ 250 lines net add | ✅ 246 |
| AC10 | logger.warn 在 SIGKILL escalation 觸發 | ✅ test2 assert pid=12345 + escalating SIGKILL |

**Commit**：`db496c7` — fix(remote): T0299 SSH/Tunnel lifecycle hardening (BUG-063 + BUG-067)

