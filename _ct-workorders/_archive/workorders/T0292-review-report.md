# T0292 — bmad Adversarial Review Report on PLAN-007 (release/v0.4.0)

**Skill**: `/bmad-review-adversarial-general`（adversarial-general — cynical reviewer mindset）
**Scope**: `git diff main..release/v0.4.0` — 113 files / +14569 / -334 across 27 commits（PLAN-007 全 23 張藍圖工單）
**Reviewer cwd**: main repo（`release/v0.4.0` checked out，**未**進 worktree）
**產出時間**: 2026-04-26 16:50–17:35 (UTC+8)
**模式**: review-only（無 production code 修改；本檔為 Worker 唯一寫入目標）

---

## 整體評估

PLAN-007 是大手筆但骨架紮實的一次擴張：整套 4-environment（local/wsl/docker/ssh）translator + wizard + headless server bundle pipeline 在三個 phase 內收斂，test 覆蓋 28 個 spec 檔（~4000 行 test code），中文 / 空白 / 跨 OS path 都有 fixture，CI matrix 覆蓋 linux-x64/arm64/darwin-arm64。然而**對抗式 review 找出 3 個 Critical bug**（path translator 前綴碰撞 / build-server-bundle README sha 不一致 / Node binary 供應鏈無 checksum），以及一系列圍繞 `ssh argv 注入面`、`reconnect chain race`、`launchd XML escaping`、`stderr 語系脆弱`的 High 級 issue。**Critical 全部可在 release 前修完**（小範圍變更），但 path translator 前綴 bug 一旦在 production 被觸發會默默產生錯誤檔案路徑（**靜默資料損毀**比 crash 更難排查），release 前必修。整體建議：**GO-with-fix**——修完 3 個 Critical + F-004（SSH arg 注入面）+ F-005（plist XML escape）後再 release。

## Findings（依嚴重度降序）

### 🔴 Critical（必須修，否則 release 會炸或靜默損毀）

#### F-001：Path translator 前綴碰撞 — 跨 docker / ssh translator 的 startsWith 缺少 boundary 檢查

- **位置**：
  - `electron/remote/path-translator.ts:102`（SshPathTranslator.toServer）
  - `electron/remote/path-translator.ts:110`（SshPathTranslator.toClient）
  - `electron/remote/path-translator.ts:121`（SshPathTranslator.owns）
  - `src/utils/docker-path.ts:25`（hostToContainer）
  - `src/utils/docker-path.ts:35`（containerToHost）
  - `src/utils/docker-path.ts:51`（ownsDockerPath）
- **問題**：所有翻譯器以 `path.startsWith(prefix)` 判斷歸屬，但**未要求 prefix 後跟 `/` 或字串結尾**。當 mount/home 是另一個合法路徑的字面前綴時誤匹配。具體例子：
  - SSH：`clientHome='/Users/al'`、`serverHome='/Users/bob'`、`clientPath='/Users/alice/x.txt'` → tail = `'ice/x.txt'` → 翻譯為 `'/Users/bobice/x.txt'`（**錯誤**）
  - Docker：mount `{host:'/home/u', container:'/c/u'}`、path = `/home/user/x` → 翻譯為 `/c/user/x`（**錯誤**，應 passthrough）
- **影響**：**靜默資料損毀**——translator 不會 throw，會把不屬於 mount 的 path 映射到不存在的目標路徑。後端 fs.readFile / pty.create 會以該錯誤路徑去找檔，要嘛找不到、要嘛**意外讀到別處的檔案**。安全上是 path-confusion 漏洞（如果惡意 mount 設計）。功能上會神秘故障。
- **建議修法**：把所有 `startsWith(prefix)` 改成
  ```ts
  function startsWithPath(p: string, prefix: string): boolean {
    if (!p.startsWith(prefix)) return false
    return p.length === prefix.length
        || p[prefix.length] === '/'
        || p[prefix.length] === '\\'
  }
  ```
  並加 fixture 覆蓋 `/Users/al` vs `/Users/alice`、`/home/u` vs `/home/user`。
- **複現/驗證**：
  ```ts
  import { SshPathTranslator } from './path-translator'
  const t = new SshPathTranslator('/Users/al', '/Users/bob', false)
  console.log(t.toServer('/Users/alice/x.txt'))  // 期望 '/Users/alice/x.txt'，實際 '/Users/bobice/x.txt'
  ```
  test gap 證據：`tests/path-translator.contract.test.ts:284-309` 與 `tests/docker-path.test.ts:52-103` 都**沒有**non-aligned prefix 案例。

#### F-002：build-server-bundle README 內 sha256 與實際 bundle 內容不一致

- **位置**：`scripts/build-server-bundle.mjs:367-379`（packBundle）
- **問題**：流程是「tar 一次 → 算第一個 tar 的 sha → 把該 sha 寫進 README → 再 tar 一次」。第二次 tar 包含**已更新的 README**，所以 bundle 真實 sha 與 README 內字串**永遠不同**。`summary.sha256`（line 377）回報的是第二次 tar 的 sha，但 bundle 內 README 寫的是第一次 tar 的 sha。
- **影響**：使用者解開 bundle、cat README 比對 release notes 的 sha，會永遠對不上 → 信任崩盤；實務上 release pipeline 若拿 README 內 sha 去 publish，下載者驗證會 fail。
- **建議修法**：兩種選擇：
  1. **不在 README 內寫 sha**（最簡單）：sha 只放在 release notes / GitHub Release body
  2. **算 staging dir 的 deterministic hash 而非 tar 後的 sha**：把 README 從 hash 計算範圍排除
- **複現/驗證**：跑 `node scripts/build-server-bundle.mjs --target=linux-x64`，然後：
  ```bash
  tar tzvf dist-server/bat-server-linux-x64-*.tar.gz staging/README.md
  tar xzf dist-server/bat-server-linux-x64-*.tar.gz staging/README.md
  grep "sha256:" staging/README.md
  sha256sum dist-server/bat-server-linux-x64-*.tar.gz
  ```
  兩個值不會相等。

#### F-003：Node binary 無 checksum 驗證 — 供應鏈攻擊面

- **位置**：`scripts/build-server-bundle.mjs:234-249`（provisionNodeBinary）
- **問題**：`downloadFile` 從 `https://nodejs.org/dist/v${nodeVersion}/${tarballName}` 下載 node binary 後直接 tar 解壓 + 拷進 bundle，**未驗證 SHASUMS256.txt**。雖然走 HTTPS，但若：
  - nodejs.org CDN 被入侵
  - DNS 被劫持（CI runner 在受污染網路）
  - 中間有 cache proxy 注入
  則惡意 node binary 會被打進每個 release 的 bundle，分發給所有 SSH 部署的 server。
- **影響**：**供應鏈攻擊**直接命中所有 SSH/Docker/WSL deployment 的 remote 端 — 比 client 端的 electron app 範圍更廣，且 server 通常在使用者開發機 / 內網主機，被植入後門可橫向移動。
- **建議修法**：加 SHASUMS256.txt 下載 + 驗證：
  ```js
  const shasums = await fetch(`https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`).then(r => r.text())
  const expectedSha = shasums.split('\n').find(l => l.endsWith(tarballName))?.split(/\s+/)[0]
  if (!expectedSha) throw new Error('SHASUMS missing target')
  const actualSha = await sha256File(archivePath)
  if (actualSha !== expectedSha) throw new Error(`node binary sha mismatch: ${actualSha} vs ${expectedSha}`)
  ```
  Bonus：驗 GPG 簽章（nodejs.org 提供 SHASUMS256.txt.sig）。
- **複現/驗證**：手動下載 node tarball + SHASUMS256.txt 對照即可確認 build-server-bundle.mjs 內無此 check。

### 🟡 High（強烈建議修）

#### F-004：SSH user@host argv 未驗證 leading `-` — 跨 ssh-tunnel / ssh-bundle-uploader / ssh-auth-probe 一致性破洞

- **位置**：
  - `electron/remote/ssh-tunnel.ts:98`（buildSpawnArgs）
  - `electron/remote/ssh-bundle-uploader.ts:57`（buildSshArgs）
  - `electron/remote/ssh-auth-probe.ts:66`（buildSshArgs）
  - `electron/remote/ssh-start-server.ts:183-188` **唯一有**驗證 space/`@` 但**也未檢查 leading `-`**
- **問題**：`args.push(\`${opts.sshUser}@${opts.sshHost}\`)` — 若 `sshHost` 以 `-` 開頭（例：`-oProxyCommand=evil.sh`），ssh CLI 會把 token 當 option 解析。Wizard 雖會限制 UI 輸入，但 ssh-config-parser（`electron/remote/ssh-config-parser.ts:11-13`）拉出的 Host alias 沒做合法性檢查 — 使用者 `~/.ssh/config` 內的 Host alias 直接餵 spawn。
- **影響**：若使用者匯入污染的 ssh config（社交工程 / 同步來自不可信源），可達 RCE（ProxyCommand 觸發任意命令）。次優情境是 user-supplied label 跑進 sshUser，被當 flag 解析 → command failure 但無 RCE。
- **建議修法**：抽 `validateSshUserHost(user, host)` helper，集中拒絕：
  - leading `-` / `=` / 空白 / `\n` / `\r` / `'`
  - 套到 4 個檔的 buildSshArgs/buildSpawnArgs。
  另外應在 user@host 前插 `--` 終結 ssh option parsing：`args.push('--', \`${user}@${host}\`)` ← OpenSSH 支援 `--` 作為 option terminator。
- **複現/驗證**：在 mock test 內傳 `sshHost: '-oProxyCommand=touch /tmp/pwned'`，檢查 spawn 收到的 argv 是否包含該值（目前會傳遞，沒 throw）。

#### F-005：launchd plist 內 installPath / port 未做 XML escape

- **位置**：`electron/remote/ssh-start-server.ts:127, 130, 137, 119`（renderLaunchdPlist）
- **問題**：plist 內幾個欄位直接字串插值：
  - `<string>${LAUNCHD_LABEL}</string>`（const，OK）
  - `<string>${opts.installPath}/bin/bat-server</string>`（**unchecked**）
  - `<string>${port}</string>`（number，OK）
  installPath 雖目前由 wizard 鎖在 `~/.local/bat-server`，但若未來開放自訂 / 使用者直接編 profile JSON 餵到此函式，含 `</string><array>...` 的字串會破壞 plist 結構，可能讓 launchd 載入任意 ProgramArguments → 啟動任意程式。
- **影響**：未來功能擴張時的 latent vuln；現在不易觸發但很容易被遺忘。同一函式 `renderSystemdUnit`（line 109）也直接內插 installPath 到 ExecStart 行，若含 newline 會破壞 unit file 結構。
- **建議修法**：
  ```ts
  function escapeXml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }
  ```
  套用到 plist 字串欄位；systemd unit 端則拒絕 `\n` / `=` 後接 newline。
- **複現/驗證**：手寫 `installPath = "/tmp</string><key>Foo</key><string>x"` 餵進 `renderLaunchdPlist`，輸出會破壞 plist。

#### F-006：RemoteClient 指紋不符後未 early-return — 'open' / 'message' handler 仍可能被觸發

- **位置**：`electron/remote/remote-client.ts:265-278`（upgrade handler）
- **問題**：fingerprint mismatch 時呼叫 `settle({ ok: false, errorCode: 'fingerprint-mismatch' })` + `this.ws?.close()` 後**沒有 return**。雖然 close 觸發後 'open' / 'message' 通常不會 fire，但在 `ws` 套件特定版本 / race window 下有理論可能：upgrade fired → close 排入 microtask → 同 tick 內 'open' callback 已 queued → `this.ws!.send(JSON.stringify(authFrame))` 跑，把 token 送進已被指紋拒絕的 connection。
- **影響**：理論性 token leak（送 auth frame 到指紋不符的伺服器；server 已收到 TLS handshake，已能讀 wss payload）。實務上 ws 多半不會這麼做，但 defensive return 成本為 0。
- **建議修法**：fingerprint mismatch 區塊末尾加 `return`，並把 `_connected = false` 改成在 settle 之前就完成。
- **複現/驗證**：寫 mock ws 模擬「upgrade 後立即 emit open」，驗證 send 不會被呼叫。目前 `tests/remote-client-middleware.test.ts:1-122` 沒覆蓋此 race。

#### F-007：SshTunnel.stop / start error path 只發 SIGTERM，無 SIGKILL escalation

- **位置**：`electron/remote/ssh-tunnel.ts:158, 173`（start error / stop）
- **問題**：兩處都是 `proc.kill()`（預設 SIGTERM）。Linux/macOS 上多數 ssh client 會乾淨退出；但若 ssh stuck 在 DNS lookup / kernel TCP retransmit，SIGTERM 可能被 ssh signal handler ignore（如 ssh 在處理 ExitOnForwardFailure 的 cleanup）。
- **影響**：Disconnect 後 ssh 子行程殘留；累積後吃連線數 / port，下次 start 衝突。
- **建議修法**：
  ```ts
  proc.kill('SIGTERM')
  setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL') }, 3000)
  ```
- **複現/驗證**：mock spawn 回傳「不會 exit」的 fake child，呼叫 `tunnel.stop()` 後檢查 SIGKILL 是否有被排程。目前 `tests/ssh-tunnel.test.ts` 沒涵蓋。

#### F-008：classifyStderr 只認英文 — 非英文 locale 下所有 ssh 錯誤都被歸 'unknown'

- **位置**：
  - `electron/remote/ssh-tunnel.ts:245-256`（classifyStderr — 用 `.includes`）
  - `electron/remote/ssh-auth-probe.ts:102-110`（classifyStderr — 用 `.includes` + `.toLowerCase()`）
- **問題**：substring 比對的是 `'Permission denied'` / `'Connection refused'` / `'Host key verification failed'` 等英文字串。LANG=zh_TW.UTF-8 / ja_JP.UTF-8 環境的 OpenSSH 會輸出本地化訊息（OpenSSH 雖核心英文但 PAM/系統訊息會本地化），分類失敗 → UI 永遠看到「unknown」錯誤，使用者不知道是密碼錯還是網路掛。
- **影響**：國際使用者 troubleshooting 體驗極差（BAT 的繁中介面對應不到正確錯誤碼）；UX 退化。
- **建議修法**：在 spawn ssh 時設 `env: { ...process.env, LC_ALL: 'C', LANG: 'C' }` 強制英文 stderr，再做 substring 分類。或改用 ssh exit code（255 = ssh 自己的錯，含 auth/refused/host-key）+ stderr 補強。
- **複現/驗證**：在中文 Linux 環境跑 ssh 到不存在的 host，stderr 會混入本地化文字。

### 🟢 Medium（可選，建議修）

#### F-009：SshTunnel.pickFreePort TOCTOU race

- **位置**：`electron/remote/ssh-tunnel.ts:180-200`（pickFreePort）+ `:115-123`（start 序列）
- **問題**：拿 OS-assigned port → close listener → 把 port 交給 ssh `-L localPort:...`。從 close 到 ssh bind 之間有 race window（毫秒級），其他 process 可搶到該 port，ssh 就會 ExitOnForwardFailure。
- **影響**：罕見但會發生在高活動 server；symptom 是 tunnel start 失敗，使用者不解原因。
- **建議修法**：保留 listener、把 socket FD 傳給 ssh（複雜）；或失敗時 retry 一輪 pickFreePort（簡單）。
- **複現/驗證**：在 high port pressure 機器（多 CI job）能偶發觀察。

#### F-010：ssh-start-server verify cmd `grep ':${port}'` 子字串誤配

- **位置**：`electron/remote/ssh-start-server.ts:329`
- **問題**：`ss -tnlp | grep ':${port}'`，port=51820 會 match `:518200`、`:518201`、`:51820`。雖然 51820 不太可能跟相鄰連 port 衝突，但 verification 的 false positive 風險真實存在。
- **影響**：verify 階段誤判其他服務為 bat-server；少見但可能在 docker container 多 service 環境誤觸。
- **建議修法**：`grep -E ':${port}( |$)'` 或改用 `ss -tnlp '( sport = :${port} )'` filter。
- **複現/驗證**：在 server 上開兩個 listener（51820、518200），verify 會錯誤通過。

#### F-011：ssh-bundle-uploader 無整體 upload timeout

- **位置**：`electron/remote/ssh-bundle-uploader.ts:79-149`（uploadServerBundle）
- **問題**：spawn ssh + pipe tarball stream，僅依賴 ssh `-o ConnectTimeout=10` 控制連線階段，但 connection 之後 stream 卡住（remote disk full、network silent stall）會永遠等待。沒有 wall timeout / progress watchdog。
- **影響**：UI 進度條停在 X% 永久不退，wizard 也卡住。
- **建議修法**：加 wall timeout（建議 5 min for 100 MB bundle），或 watchdog：「30s 內 bytesSent 沒成長就 abort」。
- **複現/驗證**：mock spawn + stream 故意不 emit data，呼叫 uploader 觀察 hang。

#### F-012：WizardRunner skip 把 failed step 標 Succeeded → 後續 rollback 會誤動

- **位置**：`src/components/setup-wizard/wizard-runner.ts:142-148`（skipCurrentStep）+ `:194-197`（runInternal skip 分支）
- **問題**：skip 後 `snapshot.status = Succeeded`、`completedStepIndexes.push(index)`。但該 step 實際是 throw 過的（line 183 catch），可能已留下部分外部 side effect（檔已寫一半、systemd unit 已生成但 enable fail）。後續 cancel / 失敗 rollback 時，rollbackCompletedSteps（line 218）會把這個「假成功」step 也 rollback，可能 undo 不存在的東西、或 double-undo。
- **影響**：rollback 遇到例外時只 warn 不 throw（line 237），所以使用者看不到錯誤，但 cleanup 不完整 → 殘留 systemd unit / launchd plist / partial install dir。
- **建議修法**：skip 走獨立 status（`Skipped`）並從 completedStepIndexes 排除；或在 step 內定義「partial state cleanup」屬於 step 本身的 try/finally 而非 wizard runner 責任。
- **複現/驗證**：build wizard 場景：step A 寫檔成功 → step B partial-fail → user click skip → user 之後 cancel → 觀察 step B 的 rollback 是否被呼叫且有意義。

#### F-013：PATH_RETURNING_CHANNELS 漏掉 fs:stat — server-side path 流回 renderer

- **位置**：`electron/remote/path-aware-channels.ts:23-29`
- **問題**：set 裡只有 `fs:readdir / fs:search / git:getRoot / pty:get-cwd`。`fs:stat` 結果通常包含 path（或至少 caller 期望結果與 client path 對齊）。RemoteClient.invoke 拿回 stat 結果，沒做 toClient → renderer 拿到 server 端絕對路徑，UI 顯示「/home/user/...」而非 Win 端的「C:\...」。
- **影響**：UI 顯示不一致；renderer 把 server path 餵進其他 IPC 會誤導 file watch / 開檔。
- **建議修法**：把 `fs:stat` 加入 set，並 audit 所有 `fs:*` channel 是否需要翻譯。
- **複現/驗證**：在 ssh profile 上 invoke fs:stat，比對 result.path 是否經過 translation。

#### F-014：ssh-auth-probe REMOTE_PROBE_COMMAND 對 shell 啟動訊息脆弱

- **位置**：`electron/remote/ssh-auth-probe.ts:52, 191-196`
- **問題**：`'echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME'` 走 remote 預設 shell。若使用者 `.bashrc` / `.zshrc` / 系統 motd 印任何東西到 stdout（不只 stderr），parse 邏輯：
  - `okIdx = lines.findIndex(...)` 找到 `BAT_AUTH_OK` 行
  - `platformLine = lines[okIdx + 1]` 假設下一行就是 uname 輸出
  若 motd / shell startup 有訊息插在 BAT_AUTH_OK 之前（fzf 啟動訊息、neofetch 等），okIdx 後一行可能不是 uname 輸出。
- **影響**：sshd 介面正常 user 在啟用 motd / 個人化 shell 的環境，wizard 會說「serverPlatform 解析失敗」→ wizard 卡 verify 階段。
- **建議修法**：用結構化 marker：`echo BAT_AUTH_BEGIN; uname -sm; echo HOME=$HOME; echo BAT_AUTH_END`，parse 取 BAT_AUTH_BEGIN 與 BAT_AUTH_END 之間的內容。或 `ssh -o RequestTTY=no -T` + `bash --noprofile --norc -c`。
- **複現/驗證**：在 server `.bashrc` 加 `echo "Welcome $USER"`，跑 probeSshAuth 看 platform 是否誤判。

#### F-015：profile-manager toSlug 無長度上限 — 超長 profile 名造成檔名問題

- **位置**：`electron/profile-manager.ts:232-237`
- **問題**：`name.toLowerCase().replace(...)` 後直接當檔名（line 228 `getProfilePath`）。Windows MAX_PATH 260 / NTFS 單段 255 字元限制，使用者輸入超長 name（複製貼上長文）會 ENAMETOOLONG。
- **影響**：corner case；極長名 profile create 失敗。
- **建議修法**：`return slug.slice(0, 64) || 'profile'`。
- **複現/驗證**：create profile 用 500 字元 name。

### ⚪ Low / Nitpick

- **F-016**：`electron/remote/ssh-config-parser.ts:5-23` 不支援 `Include` 指令、negation pattern (`!host`)、行內註解。多半使用者 ssh config 都很簡單，但企業環境常用 Include。
- **F-017**：`electron/remote/path-translator.ts:36` 與 `:90` 重複定義 `WIN_DRIVE_PATTERN` / `SSH_WIN_HOME_PATTERN`，內容相同。合併成一個 const 即可。
- **F-018**：`scripts/build-server-bundle.mjs:145` 寫死 `^v24\.` regex，Node 26 LTS 出來時要手動 bump，建議從 `package.json` engines 欄位讀。
- **F-019**：`scripts/build-server-bundle.mjs:287-288` `entry.toLowerCase().includes('whisper')` 子字串太鬆，會誤殺含 `whisper` 字串的 npm package（雖然目前無 false positive，但 latent risk）。
- **F-020**：`electron/remote/remote-client.ts:374` 與 `:183` reconnect trigger 不一致——wss close 前未 auth 不 reconnect，但 tunnel-down 前未 auth **會** reconnect。應統一語意。
- **F-021**：`electron/remote/ssh-bundle-uploader.ts:67-71` 用 `require('fs')` 同步 require，與檔案其他處 `await import('child_process')` 風格不一致。
- **F-022**：`electron/remote/remote-client.ts:359-363` 在 for-of 內 `Map.delete` — Node Map 規範安全但慣例是先複製。
- **F-023**：`scripts/build-server-bundle.mjs:340` launcher script 用 `#!/bin/sh` 但 alpine 等系統 `/bin/sh` 是 ash，假設 POSIX-compliant。實測 OK 但寫死 `bash` 更穩。
- **F-024**：`.github/workflows/build-server-bundle.yml:8` push trigger 寫死 `feature/plan-007-remote-dev` 分支，merge 後 push trigger 失效；應改 `release/**` 或 main。
- **F-025**：`tests/path-translator.contract.test.ts:284-309` 與 `tests/docker-path.test.ts:52-103` 缺 prefix-collision fixture（直接驗證 F-001 沒被涵蓋）。

## 跨環境一致性觀察

審查 wsl / docker / ssh 三個 deployment 的 wizard step / rollback / IPC channel 設計：

| 面向 | wsl | docker | ssh | 一致性 |
|------|-----|--------|-----|--------|
| Wizard step 結構 | 7 步 | 7 步（Phase 3 capstone） | 7 步（含 systemd/launchd） | ✅ 一致 |
| rollback contract | T0289 統一 | T0289 統一 | T0289 統一 | ✅ T0289 收斂 |
| translator 建構入口 | createTranslator switch | createTranslator switch | createTranslator switch | ✅ |
| Path 前綴匹配 boundary | regex 有 `[\\/]` 邊界 ✅ | startsWith 無 boundary ❌ | startsWith 無 boundary ❌ | ❌ wsl 對，docker / ssh 錯（F-001） |
| user@host argv 防護 | n/a | n/a（local docker daemon） | 無 leading-`-` 檢查 ❌ | ❌ ssh 缺 |
| stderr 分類 | n/a | n/a | 只認英文 ❌ | ❌ ssh 缺 i18n |
| Service unit 樣板 | systemd unit | n/a | systemd / launchd | ⚠️ ssh-Linux 與 wsl 用同一 systemd 樣板嗎？wsl 路徑有 `wsl-systemd.test.ts` 獨立邏輯，沒共用 helper |
| Server bundle | 不需要（local 跑 BAT） | 預打 image | 預打 tarball + uploader | ⚠️ docker 與 ssh 都有 server bundle 概念，但 build pipeline 只 cover ssh 端的 .tar.gz；docker 的 image 是另一條 pipeline（T0278）|
| Reconnect chain | 無 tunnel | 無 tunnel | tunnel-down → restart wss | ⚠️ ssh 獨有，無對照 |
| Wizard rollback test | `tests/wizard-rollback.test.ts` | 同上 + cross | 同上 + cross | ✅ T0289 cross-deployment test 收斂 |

**主要分歧點**：
1. **F-001 path translator boundary 不一致**——wsl 的 regex 解法是對的（`/^\/mnt\/[a-zA-Z](?:\/|$)/`），docker/ssh 的 startsWith 是錯的。應**讓 docker/ssh 抄 wsl 模式**或抽 boundary helper。
2. **systemd unit 樣板無共用**——wsl 與 ssh 都生 systemd user unit，但 wsl 在 `T0275`、ssh 在 `ssh-start-server.ts:96-117` 各寫一份。將來改 unit 結構（如加 ProtectSystem）要改兩處。
3. **ssh 反連鏈是獨家設計**——wsl/docker 不需 tunnel 所以無對照，但 ssh 的 `tunnel-down → wss reconnect → exponential backoff` 邏輯複雜，沒有可借鑑的 wsl/docker 對偶；review 時更難判斷是否完備。

## 測試覆蓋盲區

mock test 涵蓋大量 happy path 與少數 error path，但下列 **real-world 場景** mock 沒模擬到：

1. **Path translator 前綴碰撞 fixture**（直接證據 F-001）——`tests/path-translator.contract.test.ts:284-309`、`tests/docker-path.test.ts:52-103` 都沒 `/Users/al` vs `/Users/alice`、`/home/u` vs `/home/user` 案例。**production 上一定會踩到**，因為 home dir 命名習慣天然有此風險。

2. **OpenSSH 本地化 stderr**——`tests/ssh-auth-probe.test.ts`、`tests/ssh-tunnel.test.ts` 全用英文 stderr fixture（如 `'Permission denied (publickey).'`）。中文 / 日文 / 法文 OpenSSH stderr 沒覆蓋，意味 F-008 不會被任何單元測試發現。

3. **SSH config 非標準語法**——`tests/ssh-config-parser.test.ts:1-76` 只測 `Host alias` 簡單行；`Include`、`Match`、`HostName` resolve、wildcard 都沒覆蓋。

4. **遠端 shell 啟動訊息污染**——`tests/ssh-auth-probe.test.ts` 的 mock stdout 都是乾淨 `BAT_AUTH_OK\nLinux x86_64\nHOME=/home/...`，沒測 motd / `.bashrc echo` 干擾（F-014）。

5. **TUN/firewall 中斷**——`tests/ssh-tunnel.test.ts` 測 normal exit / 一般 stderr，但沒測 ssh process **不回應 SIGTERM**（要 SIGKILL）的情境（F-007）。

6. **大檔上傳 stall**——`tests/ssh-bundle-uploader.test.ts:1-169` 測 normal stream、stream error、ssh non-zero exit。沒測 stream **slowly trickle 但 wall time 過長**（F-011）。

7. **tarball 真實內容 verify**——build-server-bundle 沒測「打包後 README 內 sha 與 bundle sha 是否一致」（F-002 只在實跑時可見）。

8. **fingerprint mismatch 後 send race**——`tests/remote-client-middleware.test.ts:1-122` 沒測 upgrade 後 close + open race（F-006）。

9. **ssh argv 注入測試**——所有 buildSshArgs 測試都假設 user/host 是「正常」字串。沒測 `sshHost = '-oProxyCommand=evil'`（F-004）。

10. **WizardRunner skip→cancel 序列**——`tests/wizard-runner.test.ts:1-224` 測 skip 與 cancel，但沒測「skip failed step → 後續另一 step 失敗 → cancel → 觀察被 skip 的 step 是否被 rollback 處理」（F-012）。

## Security 觀察

獨立列出（不重複 critical findings 內容）：

1. **`ssh -o StrictHostKeyChecking=accept-new`** — 出現在 `ssh-bundle-uploader.ts:42`、`ssh-start-server.ts:172`、`ssh-auth-probe.ts:58`。`accept-new` 比 `no` 安全（拒絕已 pin 過但 mismatch），但首次連線無人工確認 → MITM on first use。Wizard 應在 verify 階段顯示 host fingerprint 給使用者確認（目前 wizard step 沒這個 step）。

2. **TLS rejectUnauthorized: false**（`remote-client.ts:237`）— 自簽憑證 + fingerprint pinning 模式對；但 fingerprint 為空（首次 TOFU）時，伺服器假冒風險完全在 transport 安全上 — 與 `ssh -o StrictHostKeyChecking=accept-new` 同種 first-use 風險。Wizard 顯示 fingerprint 讓使用者比對是 mitigation，但 UI 沒把這個 step 顯眼放出來（在 ProfilePanel `Pin expected fingerprint` 按鈕後面）。

3. **safeStorage fallback to plaintext on Linux**（CLAUDE.md 已記，`server-token.json` Linux 無 keychain 時 plaintext）— PLAN-018 決策，但該風險應在 wizard 顯示警告。目前 review code 沒看到使用者 facing 的 warning。

4. **WSL pure-fn winToWsl/wslToWin** — 對 path 沒做任何 sanitization；若 wsl path 含 `..`，會直接傳給 server，依賴 server 端 fs 處理。Server 端是否有 path-traversal 防護未在本次 review 範圍。

5. **systemd unit 內 `Environment=BAT_REMOTE_BIND=localhost`** — hardcode `localhost`，沒法被使用者改。雖然安全但若 server 想對外開放（極少場景）需手動編 unit。

6. **ssh `BatchMode=yes`** — 阻止互動 prompt（密碼），強制 key auth。對。但若使用者 key 有 passphrase 又沒掛 ssh-agent，會 silent fail，wizard 看到 `permission-denied` 但不知是 passphrase 問題。建議偵測到 permission-denied 時 hint 「請確認 ssh-agent 已載入 key 或 key 無 passphrase」。

7. **plist KeepAlive.SuccessfulExit=false** — launchd 永遠重啟。若 bat-server 啟動 panic，會無限重啟 → CPU spin。建議加 ThrottleInterval 或 retry budget。

## Recommendation

**GO-with-fix**

下列為 release 前**必修**清單（Critical + 高觸發 High）：

1. **F-001** path translator 前綴 boundary（小 PR，<50 行修 + ~10 fixture，預估 1 hr）
2. **F-002** build-server-bundle README sha 一致性（小 PR，~20 行，預估 30 min）
3. **F-003** Node binary SHASUMS 驗證（中 PR，~50 行 + helper，預估 1 hr）
4. **F-004** SSH argv 注入面（小 PR，~30 行 + 統一 helper，預估 1 hr）
5. **F-005** launchd plist XML escape（小 PR，~15 行 + escapeXml helper，預估 30 min）

**總工時預估**：~4 hr 修 + ~1 hr 補 test。可開為 T0294 一張工單收完，或拆 5 張平行修。

**release 後可緩修**（High 但非阻斷）：F-006 / F-007 / F-008 → 排進 v0.4.1 patch。

**Medium / Low** 入 backlog 或記為已知 issue。

**最後備註**：PLAN-007 的 test 量（28 spec / ~4000 行）是值得肯定的 — 大部分 finding 是「test 寫了但沒打對抗測試」而非「test 缺得離譜」。F-001（prefix bug）在所有 translator 跨檔重複出現，建議**抽 boundary helper 並統一強制使用**，避免 v0.4 / v0.5 再增 translator 時複製錯誤。
