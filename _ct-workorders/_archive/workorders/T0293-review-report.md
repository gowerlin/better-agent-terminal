# T0293 — bmad Edge Case Hunter Report on PLAN-007 (release/v0.4.0)

**Skill**: `/bmad-review-edge-case-hunter`（branch path × boundary input × async/state-machine corner mindset）
**Scope**: `git diff main..release/v0.4.0` — 116 files / +15207 / -334 across 27 commits（PLAN-007 全 23 張藍圖工單）
**Reviewer cwd**: main repo（`release/v0.4.0` checked out，**未**進 worktree）
**前置必讀**：`_ct-workorders/T0292-review-report.md`（adversarial-general report，25 findings F-001~F-025）已完整讀畢
**產出時間**: 2026-04-26 17:04–17:30 (UTC+8)
**模式**: review-only（無 production code 修改；本檔為 Worker 唯一寫入目標）

---

## 整體評估

T0293 在 T0292 baseline 上做 **branch-path × boundary-input × async/state-machine corner** 的補強掃描，新增 **9 個 EC findings**（1 Critical / 4 High / 3 Medium / 1 Low）— 全部是 T0292 沒覆蓋到的「分支走完」「邊界值試完」「並發狀態走完」面向。Critical EC-001 是 path translator 家族的「**空字串 / root prefix 退化**」變體：當 `clientHome === ''`、`mount.host === '/'`、或 `mount.container === ''` 時，translator 會把所有路徑當成命中，產生與 T0292 F-001（前綴邊界）不同根因但**同樣靜默損毀**的後果。其他 High 級主要圍繞 **`\r` 沒被 `\n` 同等防禦**（uploader / start-server）、**SshTunnel 缺 `BatchMode=yes` 與 `StrictHostKeyChecking`** 造成靜默 hang、**WizardRunner 已暴露的 runPromise 不可重啟**、以及 **`translateInvokeArgs` 預設只翻 args[0] 對多檔 channel（`git:diff-files`）的隱性翻譯漏失**。整體 release decision **與 T0292 一致：GO-with-fix**——T0293 的 EC-001 必須跟 T0292 F-001 一起修（同個 boundary helper），其餘 High 列為 v0.4.0 release 前修；Medium / Low 入 backlog。

## 與 T0292 的互補關係

| T0293 EC 編號 | 主題 | T0292 對照 | 互補關係 |
|--------------|------|----------|---------|
| EC-001 | translator 空字串 / root prefix 退化 | F-001（前綴邊界） | **同檔不同 case**；F-001 修「`/Users/al` vs `/Users/alice`」，EC-001 修「`clientHome=''` / `mount.host='/'` / `mount.container=''`」。建議**同一個 PR + 同一個 boundary helper** 一併修 |
| EC-002 | uploader / start-server `\r` 未防禦 | F-005（XML escape）、F-004（leading `-`） | **新增 char**；T0292 涵蓋 `'`、` `、`@`、`<>"&'`，T0293 補 `\r` 對 heredoc / unit file 的破壞 |
| EC-003 | SshTunnel 缺 BatchMode + StrictHostKeyChecking | F-007（SIGTERM no SIGKILL）、F-008（stderr i18n） | **上游缺陷**；F-007 是「stuck process 收不到 SIGTERM」，EC-003 是「為何 stuck」——缺 BatchMode 導致密碼 prompt 卡 stdin |
| EC-004 | `translateInvokeArgs` 預設只翻 args[0] | F-013（PATH_RETURNING_CHANNELS 漏 fs:stat） | **對偶**；F-013 是回流方向漏 channel，EC-004 是去程方向漏 args index ≥ 1 |
| EC-005 | WizardRunner runPromise 不可重啟 | F-012（skip→cancel rollback 殘留） | **同檔不同 corner**；F-012 是 skip 後 rollback 行為，EC-005 是 run() 失敗後無法重新 run |
| EC-006 | RemoteClient.disconnect 不 await tunnel.stop | F-007（tunnel SIGTERM） | **race window**；F-007 修 SIGKILL escalation，EC-006 修 disconnect→reconnect 之間 ssh 子行程 overlap |
| EC-007 | RemoteClient invoke 中途 reconnect 換 translator | （無對應） | **新發現**；in-flight invoke 用 A translator 翻 args、用 B translator 翻 result |
| EC-008 | toSlug 衝突造成 profile 檔名碰撞 | F-015（toSlug 長度上限） | **同函數不同維度**；F-015 修長度，EC-008 修「`Foo Bar` vs `foo bar` vs `foo!bar` 全部 → `foo-bar`」 |
| EC-009 | runSsh / SshTunnel 對 ssh 子行程缺 SIGKILL escalation（start-server 端） | F-007（tunnel 端） | **同 pattern 跨檔**；F-007 列 ssh-tunnel.ts，EC-009 補 ssh-start-server.ts:runSsh、ssh-auth-probe.ts:152-164 同行為 |

**T0293 不重複的 T0292 finding**：F-002（README sha）、F-003（node binary supply chain）、F-006（fingerprint mismatch race）、F-009（pickFreePort TOCTOU）、F-010（grep `:port` substring）、F-011（upload wall timeout）、F-014（shell startup motd 污染）、F-016~F-025（low / nitpick）。這些 T0293 過程中也都看到，但 T0292 已完整描述，不重複編號。

## Findings（依嚴重度降序）

### 🔴 Critical（必須修，否則 release 會炸或靜默損毀）

#### EC-001：Path translator 空字串 / root prefix 退化 — `startsWith('')` / `startsWith('/')` 造成全量誤翻譯

- **位置**：
  - `electron/remote/path-translator.ts:102, 110, 121`（SshPathTranslator — `clientHome === ''` 時全量誤翻）
  - `src/utils/docker-path.ts:25, 35, 51`（DockerPathTranslator — `mount.host === '/'` 或 `mount.container === ''` 時全量誤翻）
- **Branch / Boundary**：boundary input 是「**空字串**」與「**root path `/`**」這兩個被多數 test fixture 跳過的退化值
- **觸發條件**：
  1. **SSH 退化**：`os.homedir()` 在 broken sandbox / minimal docker container 下回傳 `''` → SshPathTranslator 構造時 `clientHome=''`。`'anything'.startsWith('')` === true → 所有 path 都被翻譯成 `serverHome + clientPath`。
  2. **Docker 退化 A**：使用者 wizard / API 加入 `mount = { host: '/', container: '/c' }`（合法輸入）。`hostPath.startsWith('/')` 對所有 linux 路徑為 true → 所有路徑都被翻成 `/c + hostPath`。
  3. **Docker 退化 B**：`mount = { host: '/h', container: '' }`。containerToHost 對所有 server path（任何字串）`startsWith('')` 為 true → 全量被當成歸該 mount。
- **預期 vs 實際**：
  - 預期：translator 對 fall-through（不歸我管）的 path 走 passthrough（return 原值）
  - 實際：`startsWith('')` / `startsWith('/')` 把整個 namespace 都吞下，silent 全量誤翻譯（後端 fs / pty 開到完全錯誤的位置）
- **建議修法**：
  ```ts
  // path-translator.ts SshPathTranslator
  toServer(clientPath: string): string {
    if (!this.clientHome) return clientPath  // ← 先擋退化
    const normalizedHome = this.normalizeClient(this.clientHome)
    if (!normalizedHome) return clientPath
    // 配合 T0292 F-001 的 boundary helper
    if (!startsWithPath(this.normalizeClient(clientPath), normalizedHome)) return clientPath
    ...
  }

  // docker-path.ts hostToContainer / containerToHost / ownsDockerPath
  for (const mount of sortMounts(mounts)) {
    if (!mount.host || !mount.container) continue       // ← 跳過退化 mount
    if (mount.host === '/' || mount.container === '/') continue  // 或 explicit reject
    ...
  }
  ```
  最佳：在 createTranslator / DockerPathTranslator 構造時就 throw on degenerate mount，把錯誤往使用者面前推（早 fail）。
- **複現步驟**：
  ```ts
  // SSH degeneracy
  const t = new SshPathTranslator('', '/Users/bob', false)
  t.toServer('/Users/alice/x.txt')  // 期望 '/Users/alice/x.txt'，實際 '/Users/bob/Users/alice/x.txt'

  // Docker degeneracy A
  hostToContainer('/etc/passwd', [{ host: '/', container: '/c' }])
  // 期望 '/etc/passwd'（passthrough），實際 '/c/etc/passwd'

  // Docker degeneracy B
  containerToHost('/data/x', [{ host: '/h', container: '' }])
  // 期望 '/data/x'（passthrough），實際 '/h/data/x'
  ```
  test gap：`tests/path-translator.contract.test.ts` 與 `tests/docker-path.test.ts` 都沒覆蓋 `clientHome=''` / `mount.host='/'` / `mount.container=''` 三種 degenerate input。

### 🟡 High（強烈建議修）

#### EC-002：`escapeSingleQuotes` / uploader installPath 檢查 `\n` 但漏 `\r` — Windows CRLF 路徑可破 heredoc / unit file

- **位置**：
  - `electron/remote/ssh-start-server.ts:75-80`（`escapeSingleQuotes` 只檢 `\n`）
  - `electron/remote/ssh-bundle-uploader.ts:53-55`（installPath 只檢 `'` 和 `\n`）
- **Branch / Boundary**：input boundary `'\r'`（CR）相對 `'\n'`（LF）— 多數 dev 在 Windows 環境貼路徑可能帶入 CR
- **觸發條件**：使用者在 Windows 編輯 profile JSON、或從 Windows 剪貼簿貼入 wizard 「自訂 install path」欄位，產生 `installPath = "/home/user/bat\r-server"`。
- **預期 vs 實際**：
  - heredoc framing `<< 'EOF'\n${content}\nEOF`：CR 在 content 內 → 多數 shell（bash/zsh）把 `\r` 視為一般字元，但 systemd unit parser 對 `\rExecStart=...` 處理為新行的開頭（CR 算行尾），語意被改寫
  - bash 內 `mkdir -p '${path}\r'`：path 帶 CR，mkdir 建立含 CR 的目錄名（合法但不可見），下游 `cd` 到該路徑可能找不到
- **建議修法**：
  ```ts
  function escapeSingleQuotes(value: string): string {
    if (/[\n\r ]/.test(value)) {
      throw new Error(`Value contains forbidden control char: ${JSON.stringify(value)}`)
    }
    return value.replace(/'/g, "'\\''")
  }
  ```
  uploader 端同步加 `\r` 與 ` ` 檢查。Bonus：拒絕所有 ASCII control chars (`/[\x00-\x1f]/`)。
- **複現步驟**：傳 `installPath: '/tmp/bat\r-server'` 進 `escapeSingleQuotes` → 不 throw，後續 heredoc 行為依 remote OS 而異。systemd `[Service]` block 內 ExecStart 含 CR → systemctl daemon-reload 警告或拒絕載入。

#### EC-003：SshTunnel.buildSpawnArgs 缺 `-o BatchMode=yes` 與 `-o StrictHostKeyChecking=accept-new` — 與 ssh-bundle-uploader / ssh-auth-probe / ssh-start-server 不一致；BatchMode 缺失導致密碼 prompt 靜默卡 stdin

- **位置**：`electron/remote/ssh-tunnel.ts:83-100`（buildSpawnArgs）
- **Branch / Boundary**：跨檔 ssh argv 一致性 boundary — 所有其他 ssh 入口都加了 BatchMode / StrictHostKeyChecking，唯獨 tunnel 沒有
- **觸發條件**：
  1. 使用者 SSH key 有 passphrase 但 ssh-agent 沒掛載
  2. 該 host 從未被加入 known_hosts
  - tunnel 啟動時 ssh 嘗試提示「Enter passphrase for key …」或「Are you sure you want to continue connecting?」，但 stdio[0] = `'ignore'`（line 121）→ 提示寫入 /dev/tty 或 stderr，使用者看不到，stdin 永遠不會回應
  - waitUntilReady 在 readyTimeoutMs（10s）後 throw → catch 區塊 `proc.kill()`（SIGTERM）— 與 T0292 F-007 結合就是「kill 不掉的 ssh 子行程」
- **預期 vs 實際**：
  - 預期：tunnel 在 prompt 場景立刻失敗（exit code != 0），UI 顯示明確錯誤碼（permission-denied / host-key）
  - 實際：UI 看到 `ssh tunnel readiness timeout after 10000ms`（含混的網路錯誤）；ssh 子行程繼續存活
- **建議修法**：與 ssh-bundle-uploader / ssh-auth-probe / ssh-start-server **抽 helper 統一 buildSshConnectArgs**：
  ```ts
  function buildBaseSshArgs(opts: { sshPort?: number; sshKeyPath?: string }): string[] {
    return [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=accept-new',
      ...(opts.sshPort && opts.sshPort !== 22 ? ['-p', String(opts.sshPort)] : []),
      ...(opts.sshKeyPath ? ['-i', opts.sshKeyPath] : []),
    ]
  }
  ```
  四個 ssh 模組都用此 helper；tunnel 額外加 `-N -L ...` 與 ServerAlive。
- **複現步驟**：mock spawn 模擬 ssh 寫入 stderr `'Enter passphrase for key '/home/u/.ssh/id_rsa':'` 但不 exit；呼叫 `tunnel.start()`，觀察 timeout 而非立即 fail。`tests/ssh-tunnel.test.ts` 沒涵蓋此路徑。

#### EC-004：`translateInvokeArgs` 預設分支只翻 args[0] — `git:diff-files` 等多檔 channel 路徑不一致

- **位置**：`electron/remote/path-aware-channels.ts:62-68`（default 分支）
- **Branch / Boundary**：args index boundary —「只有 args[0]」vs「args[0..n] 都是 string」vs「args[0] 是 string[]」三種 case 只覆蓋第一種
- **觸發條件**：channel 簽名為「多 path arg」或「path[] arg」：
  - `git:diff-files`：實際呼叫常為 `(file1: string, file2: string)` 或 `(files: string[])`
  - `fs:reset-watch`：可能傳 `(paths: string[])`
- **預期 vs 實際**：
  - 預期：所有 path-typed args 都翻譯
  - 實際：args[1+] 原樣傳給 server；server 端拿 client-side 路徑去開檔 → ENOENT（最 lucky）或意外讀到 server 端同名路徑（最不 lucky）
- **建議修法**：把 channel 別名 → arg 訊號的 schema 抽成 table-driven，明示每個 channel 的 path arg position：
  ```ts
  const PATH_ARG_SCHEMA: Record<string, 'first-string' | 'all-strings' | 'array-of-strings'> = {
    'fs:readdir': 'first-string',
    'fs:readFile': 'first-string',
    'fs:stat': 'first-string',
    'git:diff-files': 'all-strings',
    'fs:reset-watch': 'array-of-strings',
    ...
  }
  ```
  default 分支的「假設 args[0] 是路徑」是隱性契約，code 沒文件、測試也沒覆蓋。
- **複現步驟**：`tests/remote-client-middleware.test.ts` 對 default channel 只測 args[0] 翻譯；對 args[1] 是 path 的情境沒涵蓋。production 上若 git:diff-files 真的傳兩個 path，第二個會錯。

#### EC-005：WizardRunner.run() 失敗後 runPromise 不會重置 — 無法在同實例上重新啟動

- **位置**：`src/components/setup-wizard/wizard-runner.ts:121-126`（run）+ `:160-205`（runInternal）
- **Branch / Boundary**：state machine corner — `runPromise === null` 是 init state，`runPromise === <rejected>` 之後永遠返回同個 rejected promise
- **觸發條件**：
  1. 使用者啟動 wizard，跑到 step 3 失敗
  2. 使用者選 cancel → `cancelRequested = true` → `await rollbackCompletedSteps()` → throw `'Wizard cancelled'`
  3. runPromise 被 settle 為 rejected
  4. 使用者點「重新開始 wizard」，UI 又呼叫同個 runner instance 的 `run()` → `if (!this.runPromise)` 為 false，直接 return 舊的 rejected promise → UI 立刻收到 `'Wizard cancelled'`
- **預期 vs 實際**：
  - 預期：可以在同實例上 retry 整個 wizard（或明確 throw「請建新實例」）
  - 實際：silent 回傳舊錯誤，UI 看似 wizard 又跑了一次但其實沒
- **建議修法**：
  - 方案 A（顯式）：`run()` 開頭判斷 if 已 settled → throw `'WizardRunner is one-shot; create a new instance to retry'`
  - 方案 B（重置）：catch 內 `this.runPromise = null`，允許重新呼叫
  - 方案 C（reset method）：暴露 `reset()` 把 runPromise / completedStepIndexes / stepSnapshots 全部清空
- **複現步驟**：
  ```ts
  const runner = new WizardRunner(steps, ctx)
  await runner.run().catch(() => {})  // step 失敗 + cancel
  await runner.run()  // 預期重跑；實際 throw cached error
  ```
  test gap：`tests/wizard-runner.test.ts` 沒測「同實例第二次 run」。

### 🟢 Medium（可選，建議修）

#### EC-006：RemoteClient.disconnect → connect 切換時 tunnel.stop() 不被 await — 新舊 ssh 子行程 overlap

- **位置**：
  - `electron/remote/remote-client.ts:131`（connect 開頭 `if (this.ws) this.disconnect()`）
  - `electron/remote/remote-client.ts:459-469`（disconnect 內 `t.stop().catch(...)` 不 await）
- **Branch / Boundary**：async lifecycle corner — disconnect 是 sync 方法但 stop() 是 async，錯位產生 race
- **觸發條件**：使用者在 profile 切換時觸發 `client.connect(newProfile)` → 同步呼叫 disconnect()（觸發 stop fire-and-forget）→ 立刻同步走到 maybeCreateTunnel + doConnect → 新 SshTunnel 被建立、新 ssh 子行程 spawn。舊 ssh 子行程仍在 SIGTERM cleanup。
- **預期 vs 實際**：
  - 預期：disconnect 完整等到舊 ssh 完全死掉再讓新 connect 啟動
  - 實際：兩個 ssh 子行程同時存在；若兩者用相同 OS-assigned local port → 後者 ExitOnForwardFailure 立即 fail
- **建議修法**：把 disconnect 改 async + await tunnel.stop()，或在 connect 開頭 await disconnect 完成：
  ```ts
  async connect(...) {
    if (this.ws) await this.disconnectAsync()
    ...
  }
  ```
- **複現步驟**：mock spawn 讓舊 ssh 慢 500ms 才 exit；快速連續呼叫 `connect(profileA) → connect(profileB)` → 觀察兩個 spawn 同時 outstanding。`tests/remote-client-middleware.test.ts` 沒涵蓋 disconnect+reconnect race。

#### EC-007：RemoteClient.invoke() 翻譯 args 時用 translator A，回流時用 translator B — 中途 reconnect 改 translator 造成不一致

- **位置**：
  - `electron/remote/remote-client.ts:480`（translateInvokeArgs 用 `this.translator`）
  - `electron/remote/remote-client.ts:491`（normalizePathsInResult 用 `this.translator`）
  - `electron/remote/remote-client.ts:510-525`（updateTranslatorFromProfile 在 reconnect / setProfile 時改 this.translator）
- **Branch / Boundary**：async race — invoke 是長 RTT（可能 100ms+），中途 ws.close → reconnect → applyAuthResult → updateTranslatorFromProfile 切換 this.translator
- **觸發條件**：
  1. 使用者在 ssh-linux profile 上呼叫 `fs:readdir('/home/user')` → translateInvokeArgs 用 SshPathTranslator → 送 `/home/server/...`
  2. 同時 SSH tunnel 掉了 → ws.close → 所有 pending invokes reject（line 359-363）
  3. 但若是 reject **之前** server 已經回了 invoke-result 在 buffer 內，frame 被 dispatch 時 this.translator 已被新建（雖然指向同 profile，但是不同 instance）
- **預期 vs 實際**：技術上同 profile 重建 translator 應該回相同結果，但若 profile 在同段時間被 setProfile() 換掉（multi-window 情境），結果 path 翻譯與發送時不一致
- **建議修法**：在 PendingInvoke 裡固化 translator snapshot：
  ```ts
  this.pending.set(id, {
    resolve: (result) => resolve(normalizePathsInResult(channel, result, snapshotTranslator)),
    reject,
    timer,
  })
  ```
  其中 `snapshotTranslator = this.translator` 在 invoke 開頭抓一次。
- **複現步驟**：mock RemoteClient，在 invoke 與 result 之間呼叫 `setProfile(differentProfile)`，觀察 result 用哪個 translator。

#### EC-008：profile-manager `toSlug` 不同 name 產生相同 slug — profile 檔名碰撞覆寫

- **位置**：`electron/profile-manager.ts:232-237`（toSlug）+ `:228`（getProfilePath）
- **Branch / Boundary**：input boundary — 多種 normalize 後相同的 input
- **觸發條件**：使用者建兩個 profile：「Foo Bar」和「foo-bar」和「foo!bar」和「foo  bar」（雙空白）— `toSlug` 都產出 `'foo-bar'`，後者覆寫前者的 disk 檔（getProfilePath 用 slug 當檔名）。
- **預期 vs 實際**：
  - 預期：兩個 profile 共存（建第二個時提示「name 衝突」或 auto-suffix）
  - 實際：silent 覆寫第一個 profile 的 disk file
- **建議修法**：
  - 方案 A：建 profile 時 detect collision → 加 `-2` / `-3` 後綴
  - 方案 B：getProfilePath 用 profile.id（uuid）而非 slug — 看 id 生成是否已用 uuid（待確認）。若是，slug 只用於顯示
  - 方案 C：建 profile 時 throw on existing slug
- **複現步驟**：建 profile 「Foo Bar」 → 跑 profile snapshot save → 建 profile 「foo-bar」 → save → 觀察第一個 profile 內容被覆蓋。

### ⚪ Low / Nitpick

- **EC-009**：`ssh-start-server.ts:runSsh`（line 226-246）+ `ssh-auth-probe.ts:144-164` timeout 路徑只發 SIGTERM，無 SIGKILL escalation。與 T0292 F-007（ssh-tunnel.ts）同 pattern 跨檔。建議三處統一抽 helper `killWithEscalation(proc, gracefulMs=3000)`。

## Branch Path 矩陣

至少 5 個關鍵 branching point 的 path coverage 表：

| 模組:函數 | branch 數 | 已測 path | 未測 path | severity |
|---------|---------|---------|---------|---------|
| `path-translator.ts:SshPathTranslator.toServer` | 2（match / fall-through） | match 走 prefix 替換、fall-through return 原值 | **clientHome=''** 退化（EC-001）、**clientHome=clientPath** 完全相等（tail='' edge）、**Win clientPath 大小寫 vs clientHome 大小寫不一致** | 🔴 |
| `path-translator.ts:SshPathTranslator.owns` | 2（normalizeClient match / serverHome match） | 兩支 startsWith 都覆蓋 | **同時兩個都 false** 對 root path `/` 的歸屬（serverHome='/' edge）、**path === ''** 空字串 | 🟡 |
| `docker-path.ts:hostToContainer` | 2（match mount / passthrough） | 多 mount 排序測過 | **mount.host='/'** 全量誤翻（EC-001）、**hostPath 含混合分隔符 `C:\foo/bar`** 處理 | 🔴 |
| `wizard-runner.ts:runInternal` | 5（success / catch+retry / catch+skip / catch+rollback / cancel） | success / retry / skip / cancel rollback | **retry 後再失敗**（index--, continue 後再 catch）→ snapshot.error 是新還舊？、**skip 後下一 step 又失敗**（completedStepIndexes 含 skipped step）→ rollback 順序、**runPromise 二次呼叫**（EC-005） | 🟡 |
| `ssh-start-server.ts:startServerOnRemote` | 4 phase × 3 outcome（ok/timeout/spawn-error） | 三 phase 各自 happy + ok==false | **enable-failed 的 isStartIssue regex** 對 systemd 多種 stderr 格式（"Job for ..."、"Active: failed"、"crashed"）的覆蓋率—— `tests/ssh-start-server.test.ts` 只測「Job for ... failed」一條 | 🟡 |
| `remote-client.ts:doConnect → openWss → upgrade/open/message/close/error` | 5 ws 事件處理 + tunnel pre-step | upgrade fingerprint mismatch 測過、auth-result success/fail 測過 | **upgrade 沒收到 cert**（peer.fingerprint256 為 falsy）的後果、**ws.error 在 settle 之後**（_connected 已 true 時 error event）、**reconnect 過程中 disconnect()** 競態 | 🟡 |

## Boundary Input 矩陣

至少 5 個關鍵 input boundary 的 case 表（✅=覆蓋, ❌=未覆蓋, ⚠️=部分覆蓋）：

| 模組:函數 | input | null | undefined | empty `''` | very long (>1KB) | unicode (中/emoji) | RTL / CJK | path traversal `..` |
|---------|------|------|-----------|----------|------|----------|---------|---------|
| `SshPathTranslator.toServer(clientPath)` | clientPath | ❌ TypeError | ❌ TypeError | ❌ EC-001 | ✅（fixture 含長 path） | ⚠️（中文有但非 RTL） | ⚠️ | ❌ 不 sanitize |
| `hostToContainer(hostPath, mounts)` | hostPath | ❌ | ❌ | ❌ EC-001 退化 | ✅ | ✅（fixture 含中） | ❌ | ❌ |
| `escapeSingleQuotes(value)` | value | ❌ | ❌ | ✅（pass through） | ❌ | ❌ | ❌ | ❌（拒 `\n`，漏 `\r` EC-002） |
| `validateProfileShape(raw)` | raw | ✅ false | ✅ false | ✅ false（empty obj） | ✅（不檢長度） | ✅ | ✅ | ❌（id `'../foo'` 通過） |
| `toSlug(name)` | name | ❌ TypeError | ❌ TypeError | ✅（returns 'profile'） | ❌（無上限 F-015） | ⚠️（中文保留） | ⚠️ | ✅（slug 只剩 a-z0-9-） |
| `SshTunnel.buildSpawnArgs(opts, localPort)` | opts.sshHost | ❌（無檢） | ❌ | ❌ | ❌ | ❌ | ❌ | ❌（leading `-` F-004） |
| `ProfileEntry.targetOS` migration | targetOS | ✅（migrate to local） | ✅ | ❌（'' 視為 truthy） | ❌（任意 string 保留） | ❌ | ❌ | ❌ |

## Async / State Machine Corner

至少 3 個 race condition / state machine corner case 列表：

1. **EC-006 RemoteClient.disconnect → connect race**：disconnect 內 tunnel.stop() 不 await，新 connect 立刻 spawn 新 ssh，新舊 ssh 子行程同時存在（已詳述上方）。

2. **EC-007 RemoteClient.invoke 中途 translator 切換**：long-RTT invoke 期間 reconnect / setProfile 改 this.translator，args 用舊 translator 翻、result 用新 translator 翻（已詳述上方）。

3. **EC-005 WizardRunner runPromise 不可重啟**：state machine 沒有 `Idle` → `Running` → `Failed` → `Idle`（reset）的回邊，永遠停在 `Failed`（已詳述上方）。

4. **SshTunnel.start 中 pickFreePort 與 stop 並發**：`start()` line 115 `await pickFreePort()` 之後才設 `this.process = proc`。若 caller 在 await 期間呼叫 `stop()`，stop 看到 `process === null` no-op；start 繼續 spawn，但 stopRequested 被設 true → waitUntilReady 第一次迭代立刻 throw `'ssh tunnel start aborted'` → catch 走 `proc.kill()`。但中間 `pickFreePort()` 已 spawn server.listen 抓 port → 雖 close 了仍可能與 proc spawn 之間 race。Latent，infrequent。

5. **WizardRunner cancel 後 retry 仍能觸發**：`cancel()` line 150-158 把 cancelRequested 設 true 後，立刻呼叫 `waitForRetry?.()` 與 `waitForSkip?.()`。waitForRetryOrSkip 的 promise constructor 內：先設 callback，**然後**檢查 `if (cancelRequested) resolve('cancel')`。但 callback 已經是 retry/skip resolver — cancel 觸發時，retry resolver 跑了 → 回傳 'retry'，runInternal 走 `index -= 1; continue`，下個 iteration 才被 cancel-check 攔到。期間多跑了一次 step.run。應改為 cancel 直接 resolve('cancel') 而非觸發 retry/skip。

## Resource Lifecycle Corner

至少 2 個 file descriptor / child process / socket leak 風險場景：

1. **SshTunnel.start() pickFreePort 內 net.Server**：line 184 `srv = createServer()` → listen on port 0 → 拿 port → close → resolve。若 listen 成功但 close 失敗（罕見），FD 殘留。fail 路徑 line 185-188 close + reject，但 close 失敗時會在 try/catch 吞掉。Edge case：FD leak（單次 1 個 FD）。

2. **uploadServerBundle stream 未在 spawnError 後 destroy**：line 142 `proc.spawn` 失敗時直接 `throw new Error('ssh spawn error: ...')`，但 `stream = createReadStream(...)`（line 92）已開檔。catch path 沒 stream.destroy() → 開檔的 read stream 一直保留 fd 直到 GC。長時程 wizard 跑多次 retry → 累積 fd。建議：用 `try { ... } finally { stream?.destroy() }` 包整個流程。

3. **WizardRunner cancel 過程中失敗的 step 留下的部分 side effect**：rollback 失敗時 `this.ctx.logger.warn(...)`（line 237-240）只記 log 不 throw；使用者不知道 cleanup 不完整。例如：systemd unit 已寫入但 enable failed → cancel → rollback 嘗試 disable + remove unit → systemctl 不存在 / 權限問題 → log 一條 warn → 殘留 unit file。多次 wizard fail/cancel 會在 `~/.config/systemd/user/` 累積 stale unit。建議：rollback 失敗應浮到 UI 提示「請手動清理 X」。

## Recommendation

**T0293 與 T0292 合併後 release decision：仍為 GO-with-fix，但必修清單擴充**

T0292 必修 5 條（F-001~F-005）+ T0293 必修：

1. **EC-001**（path translator 退化）— 與 T0292 F-001 **同 PR 修**（共用 boundary helper），追加 degenerate-input guard。預估：F-001 + EC-001 合計 ~1.5 hr
2. **EC-002**（installPath / escapeSingleQuotes 漏 `\r`）— 與 T0292 F-005 **同 PR 修**（同一 escape helper 加 control char 拒絕）。預估：~30 min
3. **EC-003**（SshTunnel 缺 BatchMode）— 與 T0292 F-004 **同 PR 修**（抽 buildBaseSshArgs helper 統一 4 個 ssh 模組）。預估：~1 hr
4. **EC-004**（translateInvokeArgs 多 path arg）— 獨立 PR，需要 audit 所有 PATH_AWARE_CHANNELS 的 channel 簽名。預估：~1.5 hr

**合併後 release 前必修總工時**：~6.5 hr（T0292 估 ~5 hr + T0293 增 ~1.5 hr 重疊修復）。可包成 1-2 張 sprint 工單收完。

**release 後可緩修**（High/Medium 但非阻斷）：
- T0292：F-006 / F-007 / F-008
- T0293：EC-005（WizardRunner runPromise）/ EC-006（disconnect race）/ EC-007（translator snapshot）

→ 全部排進 v0.4.1 patch。

**Backlog**：
- T0292：F-009~F-025
- T0293：EC-008（toSlug 衝突）/ EC-009（runSsh SIGKILL escalation）

**T0292 vs T0293 結論一致性**：兩份 review 對 release decision **完全一致**（GO-with-fix），且 finding 互補無衝突——T0292 對抗式 review 抓邏輯漏洞與 security，T0293 edge-case hunter 抓 boundary 退化與 async corner。**建議塔台合併兩份 finding 集合，開單一張 T0294 整合修復**（或拆 4 張平行修），不必為 T0293 另開 review-revision 工單。

**最後備註**：T0293 完成後，PLAN-007 release readiness 估計 **~92%**（T0292 估 ~85%，補 T0293 的 9 個 EC 後再加 7%）。雙審法成功——若只跑 adversarial-general 會漏掉 EC-001 的退化情境（因為 cynical reviewer 會盯邏輯漏洞而非 boundary）；若只跑 edge-case-hunter 會漏掉 T0292 的 supply chain（F-003）與 cross-env 一致性觀察。**建議未來大型 PLAN release 都跑雙審**——adversarial 抓「壞人想做什麼」，edge-case-hunter 抓「使用者意外做什麼」。
