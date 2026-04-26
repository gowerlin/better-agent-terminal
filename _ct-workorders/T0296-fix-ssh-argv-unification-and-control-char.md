# T0296 — Fix PLAN-007 SSH argv 一致性 + 控制字元防護 + BatchMode（F-004 + EC-002 + EC-003 三合一）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0296 |
| 類型 | fix（v0.4.0 release blocker） |
| Phase | PLAN-007 release prep — fix chain 第 3 張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 17:35 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | L（GP099 校準後預期 wall 15-25 min — 4 個 ssh-*.ts 抽 helper + 控制字元 reject + BatchMode 補上） |
| 依賴 | T0294 ✅、T0295 ✅、T0292 review F-004、T0293 review EC-002 + EC-003 |
| 後續 | T0297（launchd plist XML escape） → T0298（re-review） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-tunnel.ts`、`electron/remote/ssh-bundle-uploader.ts`、`electron/remote/ssh-auth-probe.ts`、`electron/remote/ssh-start-server.ts`、`electron/remote/ssh-args.ts`（新建，共用 helper）、各對應 `tests/ssh-*.test.ts` 補 case |

## 目標

修復跨 4 個 ssh 模組的 argv / 控制字元 / 連線 option 三組關聯 issue：

- **F-004**（SSH user@host argv 未驗證 leading `-`）：`-oProxyCommand=evil.sh` 注入 RCE 風險
- **EC-002**（`escapeSingleQuotes` / installPath 漏 `\r`）：CRLF 路徑可破 heredoc / unit file
- **EC-003**（SshTunnel 缺 `BatchMode=yes` + `StrictHostKeyChecking=accept-new`）：與其他 3 個 ssh 模組不一致；prompt 卡 stdin → 10s timeout 才失敗

採**抽共用 helper** 一次解三組：

```ts
// electron/remote/ssh-args.ts (新建)

/** 拒絕控制字元、空白、shell-meaningful 字元 */
export function validateSshIdentifier(value: string, fieldName: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${fieldName} must be non-empty string`)
  }
  // leading '-' 會被 ssh CLI 當 option 解析
  if (value.startsWith('-')) {
    throw new Error(`${fieldName} cannot start with '-' (would be parsed as ssh option): ${JSON.stringify(value)}`)
  }
  // 控制字元 \x00-\x1f + DEL \x7f + 空白
  if (/[\x00-\x1f\x7f ]/.test(value)) {
    throw new Error(`${fieldName} contains forbidden control char or whitespace: ${JSON.stringify(value)}`)
  }
  return value
}

/** 拒絕 `'` 不需的 controls + 安全 escape `'` */
export function escapeSingleQuotesStrict(value: string, fieldName: string): string {
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${fieldName} contains forbidden control char: ${JSON.stringify(value)}`)
  }
  return value.replace(/'/g, "'\\''")
}

/** 跨 4 個 ssh 模組共用的 base connect args */
export interface SshConnectOpts {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
}

export function buildBaseSshArgs(opts: SshConnectOpts): string[] {
  const user = validateSshIdentifier(opts.sshUser, 'sshUser')
  const host = validateSshIdentifier(opts.sshHost, 'sshHost')
  const args: string[] = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
  ]
  if (opts.sshPort && opts.sshPort !== 22) args.push('-p', String(opts.sshPort))
  if (opts.sshKeyPath) args.push('-i', validateSshIdentifier(opts.sshKeyPath, 'sshKeyPath'))
  args.push('--', `${user}@${host}`)  // -- 終結 ssh option parsing
  return args
}
```

## 範圍

### 新增 `electron/remote/ssh-args.ts`

逐字落地上方 helper 三 export：`validateSshIdentifier` / `escapeSingleQuotesStrict` / `buildBaseSshArgs`（含 SshConnectOpts interface）。

### 修改 4 個 ssh 模組

| 檔案 | 改動 |
|------|------|
| `electron/remote/ssh-tunnel.ts` | `buildSpawnArgs` 改用 `buildBaseSshArgs(opts)` 起手，再 push `-N`、`-L`、`-o ServerAliveInterval=30`、`-o ServerAliveCountMax=3`、`-o ExitOnForwardFailure=yes`、`-o StreamLocalBindUnlink=yes` |
| `electron/remote/ssh-bundle-uploader.ts` | `buildSshArgs` 改用 `buildBaseSshArgs`；`installPath` 走 `escapeSingleQuotesStrict('installPath', installPath)` |
| `electron/remote/ssh-auth-probe.ts` | `buildSshArgs` 改用 `buildBaseSshArgs`（既有有 BatchMode 但抽 helper 統一） |
| `electron/remote/ssh-start-server.ts` | `runSsh` / `escapeSingleQuotes` 改用 `buildBaseSshArgs` + `escapeSingleQuotesStrict`；`installPath` / `serverHome` 走 strict escape |

### 補測試

5. **`tests/ssh-args.test.ts`**（新建，主軸）
   - validateSshIdentifier：
     - 空字串 throw
     - 含 `-oProxyCommand=evil.sh` throw（leading `-`）
     - 含 `\n` / `\r` / `\x00` / 空白 throw
     - 正常 user/host pass
   - escapeSingleQuotesStrict：
     - 含 `\r` throw
     - 含 `\n` throw
     - 含 `'` 正確 escape 為 `'\''`
     - 普通字串原樣返回
   - buildBaseSshArgs：
     - 必含 `BatchMode=yes` + `StrictHostKeyChecking=accept-new` + `--`
     - sshPort=22 時不含 `-p`
     - sshPort=2222 時含 `-p 2222`
     - sshKeyPath 含 `-i`
     - sshHost 含 leading `-` throw
   - 至少 12 case
6. **`tests/ssh-tunnel.test.ts`** / `ssh-bundle-uploader.test.ts` / `ssh-auth-probe.test.ts` / `ssh-start-server.test.ts` 各補 1-2 case
   - buildSpawnArgs / buildSshArgs 結果含 `BatchMode=yes`（驗證 EC-003 已修）
   - installPath 含 `\r` throw（驗證 EC-002 已修）
   - sshHost 含 `-oProxyCommand=evil` throw（驗證 F-004 已修）

### Out of scope（不做）

- ❌ 不修 baseline BUG-061
- ❌ 不擴展 v0.4.1 backlog（BUG-062~068）
- ❌ 不寫 `--` option terminator 變體（buildBaseSshArgs 已內建）
- ❌ 不重構 ssh 子行程 lifecycle（kill / SIGKILL escalation 留 BUG-063）
- ❌ 不擴 ssh-config-parser（合法性檢查留未來工單；本工單在 spawn 邊界守住即可）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/T0292-review-report.md` F-004 | argv leading `-` 注入詳情 + 跨 4 檔對照 |
| `_ct-workorders/T0293-review-report.md` EC-002 + EC-003 | 控制字元 / BatchMode 缺失詳情 + 修法 |
| `electron/remote/ssh-*.ts` 4 個模組現況 | 既有 buildSshArgs / buildSpawnArgs / escapeSingleQuotes 實作 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-args.ts` 存在，export 三 helpers + SshConnectOpts interface | grep |
| AC2 | F-004 修：`validateSshIdentifier` 拒絕 leading `-` + 控制字元 + 空白 | 寫進 ssh-args.test.ts |
| AC3 | EC-002 修：`escapeSingleQuotesStrict` 拒絕 `\r` 和 `\n` 與其他控制字元 | 寫進 ssh-args.test.ts |
| AC4 | EC-003 修：`buildBaseSshArgs` 必含 `BatchMode=yes` + `ConnectTimeout=10` + `StrictHostKeyChecking=accept-new` + `--` | 寫進 ssh-args.test.ts |
| AC5 | 4 個 ssh 模組 `buildSpawnArgs` / `buildSshArgs` / `runSsh` / `buildSshArgs` 全部改用新 helper | grep + diff |
| AC6 | 4 個 ssh 模組各自 test 加 1-2 case 驗證 BatchMode / control char / leading `-` reject | 跑指令 |
| AC7 | `installPath` / `serverHome` 走 escapeSingleQuotesStrict（含 `\r` reject） | grep |
| AC8 | `tests/ssh-args.test.ts` 至少 12 case 全綠 | 跑指令 |
| AC9 | 既有 ssh test（4 個檔）全部仍綠（zero regression） | 跑指令 |
| AC10 | TypeScript baseline drift = 0；git diff stat 受影響 ≤ 350 lines net add | 計算 |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`fix(remote): T0296 SSH argv unification + control char + BatchMode (F-004 + EC-002 + EC-003)\n\n工單：T0296\n依賴：T0292 F-004 + T0293 EC-002 + EC-003\n抽 ssh-args.ts 共用 helper：validateSshIdentifier + escapeSingleQuotesStrict + buildBaseSshArgs`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0296-*.md`
4. **工具白名單**：Read / Edit / Write / Bash（npm/npx/tsc/node/git）/ Grep / Glob
5. **emoji**：除測試輸出外禁用
6. **`--` option terminator 必加**：`buildBaseSshArgs` 必須在 user@host 前插 `--`（防 OpenSSH 解析）
7. **fail-fast**：所有 validation throw，**不**降級為 warn
8. **零 regression**：4 個 ssh test 既有 case 必須全綠
9. **不擴範圍**：本工單僅修 F-004 + EC-002 + EC-003；其他 finding 留後續工單
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0296 完成`

## 預期 wall

**15-25 min**（GP099 校準後；ssh-args.ts 純函數約 50-80 行 + 4 個模組各小範圍替換 + 12 case 新測試 + 4 個既有 test 補驗證）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0296 完成」訊息後從本檔讀回報區）
