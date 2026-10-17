---
schema_version: 1
schema_kind: workorder
id: T0408
title: "PLAN-037 A：remote-tools 偵測核心——固定 probe 腳本 + 輸出解析 + RemoteToolsReport 型別（不接線）"
type: impl
status: DONE
started_at: "2026-10-05T02:54:10+08:00"
updated_at: "2026-10-05T03:08:14+08:00"
completed_at: "2026-10-05T03:08:14+08:00"
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T02:51:49+08:00"
target_version: next
depends_on:
  - T0407
related:
  - "T0407 回報區 §0 實測、§1 工具清單、§2 登入判斷表、§3 偵測設計、§6 安全（本單規格來源）"
  - "D133（PLAN-037 波次：T0408 A ∥ T0409 C → T0410 D → T0411 B → T0412 E ∥ T0413 F → T0414 G → T0405 → T0406）"
affects_files:
  - electron/remote-tools/probe-script.ts
  - electron/remote-tools/parse.ts
  - electron/remote-tools/__tests__/
  - src/types/remote-tools.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只做純邏輯與型別，不接線**：不得改 `electron/main.ts`、`electron/remote/protocol.ts`、`electron/remote/headless-entry.ts`、`electron/preload.ts`、`src/types/electron.d.ts`（接線是 T0411）。新檔不得 import electron。"
  - "🔴 T0409 平行中（`src/lib/remote-tools/*`）：本單型別 `src/types/remote-tools.ts` 先 commit 越早越好；T0409 會讀它。"
  - "🔴 probe 腳本：**零插值**常數；禁止出現 `gh auth token` / `--show-token`；登入檢查丟棄 stdout；不讀 credential 檔內容（只 `[ -e ]`）。"
  - "🔴 WSL 只做唯讀實測（跑 probe 腳本本身可以，它是唯讀的）；不安裝任何東西、不 restart `bat-server.service`。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0408 — remote-tools 偵測核心（PLAN-037 A）

## 元資料
- **工單編號**：T0408
- **任務名稱**：remote-tools probe + parse + 型別
- **狀態**：DONE
- **建立時間**：2026-10-05 02:51 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

PLAN-037（D131 / D133）：遠端 AI 工具套件「檢查＋一鍵安裝」。T0407 研究完成並經使用者裁決 Q1-Q3。本單是偵測的**純邏輯核心**，供 T0411（headless / main 接線）與 T0410（面板）使用。**完整規格以 T0407 回報區 §3 為準**，本單只摘要要點。

## 範圍

1. `src/types/remote-tools.ts`：`RemoteToolsReport`（`schemaVersion: 1`）與相關 enum
   - 工具 id：`claude` / `git` / `gh` / `codex` / `curl` / `bash` / `rg` / `uv` / `python3` / `node`（分級見 T0407 §1：必要 / 建議 / 可選 / 前置）
   - 每工具：`status: ok | missing | interop-only | not-on-path | too-old | error`、`path?`、`version?`、`login?: loggedIn | loggedOut | unknown | n/a`、`serverVisible: boolean`
   - 環境：os family / id / version、`arch`、`musl`、`pkgManager: apt | dnf | yum | apk | brew | none`、`privilege: root | passwordless | password-required | sudo-missing`、`isWsl`
2. `electron/remote-tools/probe-script.ts`：兩個**常數** POSIX sh 腳本（login 視角完整 probe、server 視角 PATH-only probe），輸出以 `__BAT_TOOLS_PROBE_V1_BEGIN__` / `_END__` 包住的 `key=value` 行；另匯出 login shell 選擇函式（路徑過 `/^\/[A-Za-z0-9._\/-]+$/`、basename ∈ {bash, zsh, sh, dash, ksh}，否則 `/bin/sh`）與 execFile 參數組裝（`-l -i -c`、timeout 20s、stdin 為 `/dev/null`）——**本單不實際接 child_process 到 handler**，但可提供一個 `runProbe(execFileImpl)` 之類可注入的函式
   - WSL：`/proc/sys/fs/binfmt_misc/WSLInterop` 存在或有 `$WSL_DISTRO_NAME` 時，`^/mnt/[a-z]/` 路徑歸 `interop-only` 且**不執行**
   - 額外掃 `~/.local/bin`、`/usr/local/bin`、`/opt/homebrew/bin` 找 `not-on-path`
   - 版本：`--version | head -n1`，有 `timeout` 就 `timeout 5`
   - 登入：只取 exit code（claude `auth status`、codex `login status`、gh `auth status --hostname github.com` 加 `timeout 8`，逾時 → unknown）
3. `electron/remote-tools/parse.ts`：標記之間只接受白名單 key、value 只留可列印字元且 ≤ 256；版本解析重用 `electron/claude-resolver.ts` 的正規式與 `HEALTHY_MIN`（claude 低於 → `too-old`）、`codex-runtime-resolver.ts` 的 `parseCodexVersion`；git / gh 用 `\d+\.\d+\.\d+`

## 驗收條件

- [x] parse 單元測試 fixture（至少）：WSL interop 遮蔽（codex / npm 解析到 `/mnt/c/...`）、首次安裝後 `not-on-path`、Alpine root 無 sudo + musl、macOS（brew、無 `timeout`）、全部未安裝 / 未登入、gh 逾時、惡意輸出（標記外雜訊、非白名單 key、超長 / 控制字元 value）
- [x] 守門測試：probe 常數不含 `gh auth token`、`--show-token`、`$(` 以外的插值來源（確認沒有 `${...}` 引用外部輸入的模板拼接）；新檔不 import electron
- [x] **WSL 唯讀實測**：以 `wsl.exe -d Ubuntu-24.04 -- bash -l -i -c <probe>`（execFile + array args）實際跑 login probe，parse 結果附在回報區；預期與 T0407 §0 一致（git ok、claude missing、codex interop-only…）
- [x] `npm run test:unit` 全綠（基線 1309）；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + **T0407 回報區 §0-§3、§6** + `electron/claude-resolver.ts`、`electron/codex-runtime-resolver.ts`、`electron/remote/arch-detect.ts`（timeout / NAME_RE 範式）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫並 commit 型別（讓 T0409 可用）→ probe / parse → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 4 項驗收全部通過。WSL 實測有 1 處偏差：`wsl.exe --` 改用 `--exec`，見「遭遇問題」1。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3：可測 2 項皆 present（`electron/remote-tools/probe-script.ts` → 最近祖先 `electron/`；`src/types/remote-tools.ts` → `src/types/`）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收**

| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | parse fixture | ✅ PASS | `electron/remote-tools/__tests__/parse.test.ts` 涵蓋：<br>• WSL interop：codex、node 解析到 `/mnt/c/...`。本單不探 npm，以 node 代表 nvm4w 的遮蔽<br>• 首次安裝後 `not-on-path`<br>• Alpine：root + apk + musl，含 rg 在 musl 上升為 required<br>• macOS：brew、`env.timeout=0`、Keychain 而無 credential 檔<br>• 全部未安裝 / 全部未登入<br>• gh `login=124` → unknown<br>• 惡意輸出：標記外雜訊、假 block、`__proto__` 與非白名單 key、enum 注入、ESC / NUL / RLO / ZWSP、超長 value、超過 512 行 |
| 2 | 守門測試 | ✅ PASS | `probe-script.test.ts` 檢查：<br>• 兩個 probe 常數不含 `gh auth token` / `auth token` / `--show-token`<br>• `probe-script.ts` 的程式碼行沒有反引號（沒有模板字面值）<br>• `${...}` 只允許固定 10 個環境變數名；`$(...)` 只允許 `command` / `uname` / `sed` / `sw_vers` / `id` / `bat_run`<br>• credential 檔的 3 行都必須是 `if [ -e "..." ]` 形式，腳本內沒有 `cat` / `source` / `.`<br>• 登入檢查函式固定為 `>/dev/null 2>&1 </dev/null`，只 emit `$?`<br>• server probe 不執行任何工具<br>• 以 esbuild bundle 三個新檔，`electron` 的 resolve 次數為 0 |
| 3 | WSL 唯讀實測 | ✅ PASS（偏差：改用 `--exec`） | 見下方「WSL 實測 parse 結果」；與 T0407 §0 一致 |
| 4 | test:unit / tsc | ✅ PASS | • `npm run test:unit`：97 files、**1442 passed**、1 skipped。1442 = 基線 1309 + T0409 的 38 + 本單 95；skipped 是本單「用真 `/bin/sh` 跑 server probe」那一項，在 win32 上略過<br>• `npx tsc --noEmit`：**40**（= 基線，新檔 0 筆）<br>• 另跑 `npx vite build`：exit 0 |

### 產出摘要

**Commits**
- `ab30fff` feat(remote-tools): RemoteToolsReport types —— 先行 commit；T0409（`ce27a82`）已依此型別實作
- `6d7daab` feat(remote-tools): fixed probe scripts + whitelist parser

**檔案**
- `src/types/remote-tools.ts`（新）
  - `REMOTE_TOOLS_SCHEMA_VERSION = 1`、`REMOTE_TOOL_IDS`（10 個）
  - `REMOTE_TOOL_TIER` 與 `remoteToolTier()`（rg 在 musl 上升為 required）
  - enum：`RemoteToolStatus` / `RemoteToolLoginState` / `RemoteOsFamily` / `RemotePkgManager` / `RemotePrivilege`，皆為 `as const` 陣列加型別
  - 介面：`RemoteToolReport`、`RemoteToolsEnv`、`RemoteToolsReport`、`RemoteToolsDetectResult`（errorCode：`host-platform` / `spawn-failed` / `timeout` / `no-markers`）
  - 規格外增補：`credentialFilePresent?`（T0407 §2 的後備檔案檢查）、`env.hasTimeout`、`env.authEnv`（5 個 auth 環境變數只報有 / 無）、`serverViewAvailable`、`warnings`
- `electron/remote-tools/probe-script.ts`（新）
  - `LOGIN_PROBE_SCRIPT` / `SERVER_PROBE_SCRIPT`：由純單引號字串陣列 `join('\n')` 組成，零插值
  - `selectLoginShell()`：路徑過 `/^\/[A-Za-z0-9._\/-]+$/`、basename ∈ {bash, zsh, sh, dash, ksh}，另外拒絕結尾 `/`（`/bin/bash/` 的 basename 也是 `bash`）；不符就回 `/bin/sh`
  - `buildLoginProbeInvocation()`：`<shell> -l -i -c 'exec /bin/sh -c "$1"' bat-tools-probe <PROBE>`，timeout 20s
  - `buildServerProbeInvocation()`：`/bin/sh -c <PROBE>`，timeout 5s
  - `runProbe(execFileImpl, invocation)`：execFile 可注入；呼叫後立即 `stdin.end()`，效果等同 `/dev/null`。ENOENT / EACCES → `spawn-failed`；killed / ETIMEDOUT → `timeout`；其他非 0 exit 仍回傳 stdout，交給 parser 判斷
- `electron/remote-tools/parse.ts`（新）
  - `extractProbeBlock`：只取**最後一個**完整的 BEGIN..END
  - `PROBE_KEY_WHITELIST`
  - `sanitizeProbeValue`：去除 C0 / DEL / C1 / zero-width / bidi 字元；上限 256，超過就截斷並寫 warning
  - `parseToolVersion`、`loginStateFromExitCode`（0 → loggedIn、1 → loggedOut、其他含 124 → unknown）
  - `parseRemoteToolsReport(login, server?)`
  - `detectRemoteTools(execFileImpl, { shell })`：並行跑兩個視角並合併
- `electron/claude-resolver.ts`：`HEALTHY_MIN` / `VERSION_REGEX` / `compareSemver` 加上 `export`，行為不變
- `vite.config.ts`：test include 加入 `electron/remote-tools/__tests__/**/*.test.ts`
- `electron/remote-tools/__tests__/parse.test.ts`、`probe-script.test.ts`（新，共 95 tests）

> 範圍外的 2 個檔案：`claude-resolver.ts`（工單要求「重用」其正規式與 `HEALTHY_MIN`，但原本未 export）、`vite.config.ts`（沒有 include 的話，`electron/remote-tools/__tests__` 不會被 vitest 執行）。兩者都只是最小必要修改。

**設計決策（給 T0411 / T0410）**
1. **login probe 再 exec 到 `/bin/sh`**
   - 做法：login shell 以 `-l -i` 載入 profile / rc（PATH 才完整），再把 probe 當作 `$1` 交給 `/bin/sh` 執行。
   - 理由：zsh 不會對未加引號的變數做 word splitting，`nomatch` 也會讓 glob 中止；ksh 同樣有差異。這樣 probe 永遠以 POSIX sh 語意執行。
   - 代價：看不到 rc 裡定義的 alias / function（例如 `alias claude=...`），只看得到 exported PATH 上的檔案。這和「使用者在終端打 `claude`」略有差距，但判斷安裝結果本來就以 PATH 為準。
2. **server 視角也套用 WSL interop 判斷**：`state=interop` 不算 `serverVisible`。
3. **enum 無法辨識時的預設值**
   - `privilege` → `password-required`（最保守）
   - `pkgManager` → `none`
   - `osFamily` 只認 `uname -s` 的 `Linux` / `Darwin`
4. **版本**
   - `found` 但 `--version` 沒有輸出 → `error`
   - 有輸出但解析不出版本 → `ok`，不帶 `version`
   - `too-old` 只套用在 claude（`< HEALTHY_MIN 2.1.280`）
5. **登入**：只對可執行的 binary（`ok` / `too-old`）檢查。`missing` / `interop-only` / `not-on-path` / `error` 的 `login` 一律記 `n/a`。

### WSL 實測 parse 結果

**login 視角**
- 執行方式：`execFile('wsl.exe', ['-d', 'Ubuntu-24.04', '--exec', '/bin/bash', '-l', '-i', '-c', LOGIN_PROBE_REEXEC, 'bat-tools-probe', LOGIN_PROBE_SCRIPT])`
- harness 放在 scratchpad，未 commit。

**server 視角**（唯讀模擬 `bat-server.service` 的環境）
- 讀 MainPID 的 `/proc/<pid>/environ`，只取 `PATH`，再以 `env -i HOME PATH /bin/sh -c SERVER_PROBE_SCRIPT` 執行。
- 沒有 restart service，也沒有安裝任何東西。

**環境**

| 欄位 | 值 |
|------|----|
| osFamily / osId / osIdLike / osVersion | `linux` / `ubuntu` / `debian` / `24.04`（原始值為 `"24.04"`，引號已去除） |
| arch / musl | `x86_64` / `false` |
| pkgManager | `apt` |
| privilege | `passwordless` |
| isWsl / hasTimeout | `true` / `true` |
| authEnv | 5 個全部 `false` |

**工具**

| 工具 | status | path | version | login | cred | serverVisible |
|------|--------|------|---------|-------|------|---------------|
| claude | missing | — | — | n/a | false | false |
| git | ok | `/usr/bin/git` | 2.43.0 | n/a | — | true |
| gh | missing | — | — | n/a | false | false |
| codex | **interop-only** | `/mnt/c/Users/Gower/AppData/Roaming/npm/codex` | — | n/a | false | false |
| curl | ok | `/usr/bin/curl` | 8.5.0 | n/a | — | true |
| bash | ok | `/usr/bin/bash` | 5.2.21 | n/a | — | true |
| rg / uv / node | missing | — | — | n/a | — | false |
| python3 | ok | `/usr/bin/python3` | 3.12.3 | n/a | — | true |

- `serverViewAvailable: true`，`warnings: []`
- server PATH：`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/snap/bin`

**與 T0407 §0 的比對**：一致。
- git / python3 / curl 已安裝；claude / gh / node / rg / uv 未安裝。
- codex 被 Windows interop 遮蔽。
- sudo 免密碼。
- server 視角不受 `/mnt` 污染。
- 認證檔與認證環境變數全部 absent。
- 補充：T0407 §0 看到的是 `npm` 解析到 `/mnt/c/nvm4w/nodejs/npm`；`node` 本身在 login PATH 上 `command -v` 找不到，所以這裡是 missing。parse fixture 另以 `node` → `/mnt/c/nvm4w/nodejs/node` 驗證 interop 分類。

**補充實測**（同一個 harness）
- login shell 為 `/bin/sh`（dash）：`-l -i -c` 可用，結果與上表相同。
- login shell 候選值為 `/bin/evil;rm`：退回 `/bin/sh`，結果相同。

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **工單指定的 `wsl.exe -d <distro> -- bash -l -i -c <probe>` 拿不到輸出**
   - 現象：stdout / stderr 都是空的，exit 0。
   - 原因判斷：`--` 會把剩下的參數交給 distro 的預設 shell 重新解析，多行的 probe 參數在這一層被破壞。
   - 處理：改用 `wsl.exe -d <distro> --exec /bin/bash -l -i -c ...` 就正常。`--exec` 不經過預設 shell，同樣是 execFile + array args。
   - 影響範圍：只影響從 Windows 主機經 `wsl.exe` 呼叫的路徑。T0411 的設計是在遠端 server 上直接 execFile，不經過 `wsl.exe`，所以不受影響。日後若要從 Windows 端直接對 WSL 跑 probe，必須用 `--exec`。
2. **寫檔時 `\uXXXX` 被轉成實際字元**
   - 現象：寫入的 `\uXXXX` 跳脫序列在 Bash heredoc / 工具寫入時變成實際字元，`parse.ts` 的正規式因此含有原始 U+2028，tsc 報錯。
   - 處理：改以 escape 形式重寫，並確認檔案只剩註解中的非 ASCII 字元；測試裡的控制字元一律改用 `String.fromCharCode` 產生。最終檔案沒有受影響。
3. **`npm run test:unit` 開頭的 stack trace**
   - 內容：`@lydell/node-pty conpty_console_list_agent.js: AttachConsole failed`。
   - 判斷：這是既有 PTY 測試的子行程在本機 console 環境產生的雜訊，與本單無關；97 個測試檔全部通過。

**給後續工單的備註**
- **T0411**：`detectRemoteTools(childProcess.execFile, { shell })` 就能接線。
  - `shell` 建議與遠端 PTY 解析 shell 的來源相同（`$SHELL` / `os.userInfo().shell`），值會再經 `selectLoginShell` 驗證。
  - probe 會繼承 handler 的 process env。probe 對 5 個 auth 變數只回報「有沒有設定」，不輸出值。若要與 headless PTY 的 `isHeadlessScrubbedEnvKey` 一致，可以在 execFile options 傳入已清理過的 env（`ProbeInvocation.options` 可展開覆寫）。
- **T0410**：`credentialFilePresent: false` 在 macOS 上不代表未登入，因為 claude 的憑證存在 Keychain。以 `login` 為準，只有 `login` 是 `unknown` 時才拿它當參考。
- `codex login status` 的 exit code 語意仍然只來自讀原始碼，T0407 已列入 G 的驗收項。

### 回報時間
2026-10-05T03:06:23+08:00
