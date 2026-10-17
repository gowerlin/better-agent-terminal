---
schema_version: 1
schema_kind: workorder
id: T0505
title: "SSH wizard：選 ~/.ssh/config alias 時 sshUser 為空 → verify-ssh-auth 必失敗（alias 路徑整條不通）——user 交由 ssh config 決定或自 `ssh -G` 解析"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P1
sizing: M
created_at: "2026-10-14T00:12:39+08:00"
started_at: "2026-10-14T00:16:51+08:00"
updated_at: "2026-10-14T00:31:00+08:00"
completed_at: "2026-10-14T00:31:00+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0502"
  - "T0496"
related:
  - "T0502 回報區「觀察」：`configure-ssh-host` 選 alias 後存 `sshUser: ''`；`steps/ssh/verify-auth.ts:65` 要求 `sshUser` 非空；electron `buildBaseSshArgs` / `validateSshIdentifier`（`electron/remote/ssh-args.ts:46-63`）也要求 user 非空 ⇒ 只有手動輸入 `user@host` 才能通過"
  - "`buildBaseSshArgs` 消費者：`ssh-auth-probe.ts`、`ssh-bundle-uploader.ts`、`ssh-start-server.ts`、`ssh-tunnel.ts`、`ssh-wizard-verify.ts`；F-004（開頭 `-` 會被 ssh 當 option，RCE）"
affects_files:
  - "electron/remote/ssh-args.ts"
  - "electron/remote/"
  - "src/components/setup-wizard/steps/ssh/"
  - "src/components/setup-wizard/__tests__/"
  - "electron/remote/__tests__/"
  - "src/lib/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 安全邊界不得放寬：F-004 防護（user / host 不得以 `-` 開頭、白名單驗證）維持；若改為「無 user 時只傳 host / alias」，alias 同樣須過白名單且不得以 `-` 開頭，並在 argv 中以 `--` 或固定位置避免被解析為 option（附負向測試）"
  - "🔴 先查證再改：比較 (a) user 可空——空時不組 `user@`，由 ssh config 決定 user / port / identity；(b) 選 alias 時以 `ssh -G <alias>`（execFile + array args + timeout）解析有效 user / hostname / port 寫入；評估 SSH profile 既有資料、teardown（`TEARDOWN_*_RE`）、tunnel、known_hosts 對兩者的影響，推薦並說明"
  - "🔴 既有「手動輸入 user@host」與已存 profile 行為不變（測試證明）"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例啟動 source build；不得對真實遠端主機連線（用 mock / 測試 fixture）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0505 — SSH wizard alias 路徑

## 實作

1. 追 SSH profile 從 wizard 到 runtime 的所有 `sshUser` 使用點（wizard steps、`buildBaseSshArgs` 消費者、profile 儲存 / 連線、teardown），列表
2. 依 memory_overrides 比較 (a) / (b)，選定並實作；alias 選單路徑能通過 `verify-ssh-auth` 及後續步驟（單元層級以 mock execFile 驗證組出的 argv）
3. 負向測試：alias / user / host 以 `-` 開頭或含非法字元被拒；argv 不出現可被解析為 option 的使用者輸入
4. 若現有已存 profile 有 `sshUser: ''`（alias 路徑曾存下但無法用），確認新行為下可直接使用或給出明確提示

## 驗收條件

- [ ] 使用點表、方案比較與推薦
- [ ] 單元：alias 路徑 verify → install → start → tunnel 的 argv 正確；手動 `user@host:port` 不變；安全負向測試
- [ ] `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`
- [ ] 回報區：需實機驗證項目（真 SSH alias）、CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0502 回報區 + `electron/remote/ssh-args.ts` 與消費者 + `src/components/setup-wizard/steps/ssh/`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。採方案 **(a)**：`sshUser` 可為空，空時 argv 只傳 `-- <alias>`，由 `~/.ssh/config` 決定 user（alias 的 HostName / Port / IdentityFile / ProxyJump 也一併生效）。選 alias 的路徑現在可以通過 `verify-ssh-auth` → `install-server-bundle` → `start-server` → verify tunnel → identity 讀取，rollback teardown 與 runtime tunnel（`RemoteClient`）也接受空 user。手動輸入 `user@host:port` 的 argv 與行為不變（測試逐 token 斷言）。

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：前 5 筆非萬用字元路徑皆存在（僅供參考）。C-2：無 `branch` 欄位，HEAD `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- frontmatter 原為 `status: TODO`，視為尚未開工，改為 `IN_PROGRESS`。

### 1. `sshUser` 使用點表（修改前 → 本單處理）

| 層 | 位置 | 修改前 | 本單 |
|---|---|---|---|
| wizard | `steps/ssh/configure-host.ts` | 選 alias 存 `sshUser: ''`；`sshUser: state.sshAlias ? '' : ''`（no-op） | 保留存 `''`（語意改為「由 ssh config 決定」）；alias 加白名單；清掉 no-op 三元式 |
| wizard | `steps/ssh/verify-auth.ts:65` | `!sshHost \|\| !sshUser` → throw | 只要求 host；log 用 `describeSshTarget` |
| wizard | `steps/ssh/install-server-bundle.ts` run / rollback | 要求 user | 只要求 host；`sshUser ?? ''` 傳給 `distribute` draftProfile / `uploadBundle` / `uninstallBundle` |
| wizard | `steps/ssh/start-server.ts` run / rollback | 要求 user | 同上（`startServer` / `stopServer`） |
| wizard | `steps/ssh/verify-remote.ts` tunnel / identity / mismatch 訊息 | 要求 user | 同上（`openVerifyTunnel` / `readServerIdentity`） |
| wizard | `steps/wsl/write-profile.ts` | 寫入 `sshUser`（可為 `''`）；註解已寫「alias is resolved at connect time via ssh-config」 | 不需改 |
| main | `electron/main.ts` server bundle distribute（draftProfile） | `!draft.sshUser \|\| !NAME_RX` → `arch-detection-failed` | 空 user 放行；有值仍過 `NAME_RX` |
| electron | `remote/ssh-args.ts` `buildBaseSshArgs`（5 個消費者共用） | `validateSshIdentifier(user)` 要求非空，`-- user@host` | `buildSshTarget()`：空 user → `-- host`，host 走嚴格白名單 |
| electron | `remote/ssh-auth-probe.ts` | 經 `buildBaseSshArgs` | 不需改（自動繼承） |
| electron | `remote/ssh-bundle-uploader.ts` | 經 `buildBaseSshArgs` | 不需改 |
| electron | `remote/ssh-start-server.ts` start | `opts.sshUser.includes('@')`；`loginctl enable-linger '<user>'` | `@` 檢查容許 undefined；空 user → `loginctl enable-linger "$(id -un)"` |
| electron | `remote/ssh-start-server.ts` teardown（`TEARDOWN_*_RE`） | `TEARDOWN_USER_RE` 要求 1–64 字 | 空 / undefined 放行；有值仍過 `TEARDOWN_USER_RE`；`TEARDOWN_HOST_RE` 不變 |
| electron | `remote/ssh-tunnel.ts` | `buildBaseSshArgs` + log `user@host` | log 改 `describeSshTarget` |
| electron | `remote/ssh-wizard-verify.ts` | `validateSshIdentifier(user)` 要求非空；target 字串 `user@host` | 改用 `buildSshTarget` 驗證；target 字串 `describeSshTarget` |
| electron | `remote/remote-client.ts` `maybeCreateTunnel` | `!sshHost \|\| !sshUser` → 不建 tunnel（warn 後 skip） | 只要求 host |
| electron | `remote/ssh-config-parser.ts` `listSshHosts` | 只濾 `*` / `?` | 改為白名單 `isUsableSshAlias`（另濾 `!neg`、開頭 `-`、`@`、引號等） |
| UI | `src/components/profiles/details/SshDetails.tsx:17` | 顯示 `{sshUser \|\| 'user'}@host:{port \|\| 22}` | **未改**（不在 affects_files，見後續建議） |
| 型別 | `preload.ts` / `src/types/electron.d.ts` IPC `sshUser: string` | — | 不需改（`''` 仍是 string） |

### 2. 方案比較與推薦

| 面向 | (a) user 可空，`ssh -- <alias>` | (b) 選 alias 時 `ssh -G <alias>` 解析 user / hostname / port 寫入 |
|---|---|---|
| ssh config 語意 | 完整保留：User / HostName / Port / IdentityFile / ProxyJump 都在連線當下由 ssh 解析 | 若寫入 HostName 會失去 ProxyJump / IdentityFile 等 alias 設定；只寫 user 則 user 被釘死，之後改 config 不生效 |
| 無 `User` 的 alias | ssh 用本機登入名（與 `ssh <alias>` 一致） | `ssh -G` 回本機登入名並寫進 profile（Windows 使用者名可能含空白而被白名單拒絕） |
| 新增攻擊面 | 無新 spawn；只放寬「user 可空」，host-only target 改用**更嚴格**的封閉字元集 | 新 IPC + 新 ssh spawn（execFile + timeout）；`ssh -G` 會執行 config 內的 `Match exec` |
| teardown（`TEARDOWN_*_RE`） | user 空放行；host whitelist 不變 | 不需改 |
| tunnel / runtime | 需放寬 `RemoteClient` 的 user 檢查 | 不需改 |
| known_hosts | 以 HostName（或 HostKeyAlias）記錄，與 user 無關；兩案相同 | 同左（只要 host 仍存 alias） |
| 已存 `sshUser: ''` profile | 直接可用 | 需另做 migration 或重跑 wizard |
| 改動面 | electron 5 檔 + main 1 處 + wizard 5 檔 | 新 IPC（main / preload / types）+ wizard；下游不動 |

**推薦並實作 (a)**：它就是 `ssh <alias>` 的原生語意，不需要新 spawn，也不把 config 的值快照進 profile；已存的空 user profile 不需 migration。(b) 的唯一優勢是「下游不用改」，但代價是語意錯誤（user 被釘死）和新增一條 spawn 路徑。

### 3. 安全（F-004）

- argv 一律 `... -- <target>`，target 永遠是 `--` 之後的單一元素（測試 `expectTargetAfterDoubleDash` 檢查每個呼叫點，且 `--` 之前不出現 target）。
- user 有值：沿用 `validateSshIdentifier`（開頭 `-`、控制字元、空白拒絕），argv 與修改前**逐 token 相同**。
- user 空（host-only target）：host 必須符合 `^(?!-)[A-Za-z0-9._:-]{1,253}$`（CLAUDE.md 白名單 + IPv6 用的 `:`，與 `TEARDOWN_HOST_RE` 同一字元集）。`@` 不在集合內，所以 host 不能夾帶 user。
- wizard 端：`listSshHosts` 只回白名單內的 alias；選單選到不合法 alias（非 Shell 呼叫者）→ `configure-host-invalid`，不寫入 state。
- 負向測試涵蓋：`-oProxyCommand=calc`、`-`、`root@devbox`、`!devbox`、`dev*`、空白、`;`、`$(id)`、單引號、換行、空字串、254 字、user `-oProxyCommand=calc` / `al ice` / 換行、user 非字串、有 user 時 host 以 `-` 開頭；start-server 與 teardown 遇到不合法 host **不 spawn**；wizard verify tunnel 回 `ssh-tunnel-invalid-input` 且不建 tunnel。
- `loginctl enable-linger "$(id -un)"` 是固定字串，沒有任何使用者輸入。

### 4. 已存 `sshUser: ''` profile

- `profile-manager` 本來就以 `sshUser ?? ''` 讀出。修改前 `RemoteClient.maybeCreateTunnel` 看到空 user 會 warn 後不建 tunnel（連線必失敗）；現在直接建 `ssh -- <host>` tunnel，**不需任何提示或 migration**（測試「saved profile with sshUser ""」）。
- 實務上修改前 wizard 走 alias 路徑會停在 `verify-ssh-auth`，不會寫出 profile；這類 profile 只可能來自手動 `profile:update` 或 T0502 的「只輸入 host」後又被改過的情況。

### 5. 改動檔案（`git diff --stat`，僅本單）

```
 electron/__tests__/ssh-teardown.test.ts            |   5 +-
 electron/main.ts                                   |   7 +-
 electron/remote/__tests__/ssh-alias-target.test.ts | 276 +++++++++++  (新檔)
 .../remote/__tests__/ssh-config-parser.test.ts     |  52 ++++   (新檔)
 electron/remote/remote-client.ts                   |   8 +-
 electron/remote/ssh-args.ts                        |  55 +++-
 electron/remote/ssh-config-parser.ts               |  13 +-
 electron/remote/ssh-start-server.ts                |  13 +-
 electron/remote/ssh-tunnel.ts                      |   6 +-
 electron/remote/ssh-wizard-verify.ts               |   9 +-
 .../__tests__/ssh-alias-no-user.test.ts            | 183 ++++++++  (新檔)
 .../setup-wizard/steps/ssh/configure-host.ts       |  14 +-
 .../steps/ssh/install-server-bundle.ts             |  16 +-
 .../setup-wizard/steps/ssh/ssh-target.ts           |  11 +       (新檔)
 .../setup-wizard/steps/ssh/start-server.ts         |  14 +-
 .../setup-wizard/steps/ssh/verify-auth.ts          |  10 +-
 .../setup-wizard/steps/ssh/verify-remote.ts        |  16 +-
 17 files changed, 662 insertions(+), 46 deletions(-)
```

- `electron/main.ts` 不在 affects_files 清單，但它是 install 步驟 draftProfile 驗證的唯一位置（不改則 alias 路徑停在 `install-server-bundle` 的 `arch-detection-failed`），屬本單驗收條件的必要範圍；只改該處 7 行。
- 既有測試只改一處：`ssh-teardown.test.ts` 原本斷言 `sshUser: ''` 被拒，這正是本單要改的行為；改為斷言 `-oProxyCommand=x` / `al ice` 被拒，空 user 的正向測試在 `ssh-alias-target.test.ts`。
- 換行維持各檔現況（`ssh-args.ts` / `ssh-config-parser.ts` / `verify-auth.ts` 工作樹為 CRLF，其餘 LF；index 皆 LF）。其他 Worker 的未提交檔案（`T0498` / `T0504` 工單等）未碰。

### 6. 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| alias 路徑 configure → verify-auth → install → start → verify tunnel | PASS | `ssh-alias-no-user.test.ts`：`probeAuth` / `distribute` / `uploadBundle` / `startServer` / `openVerifyTunnel` 皆收到 `{ sshHost: 'devbox', sshUser: '' }`；log 無 `@devbox` |
| alias 路徑 rollback（stop-server / uninstall-bundle） | PASS | IPC 收到空 user；electron 端 teardown 以 `-- devbox` spawn |
| 各呼叫點 argv（electron，mock spawn） | PASS | probe / upload / start-server（每個 exec）/ teardown / `SshTunnel.buildSpawnArgs` / wizard verify tunnel / identity 皆 `... -- devbox` |
| 手動 `user@host:port` 不變 | PASS | argv 逐 token = `[...PREFIX, '-p', '2222', '--', 'deploy@build.example.com']`；wizard 全程傳 `deploy` / `2222`；`loginctl enable-linger 'alice'` 不變；既有 ssh 測試全數通過 |
| 安全負向 | PASS | 見第 3 節；不合法輸入皆在 spawn 前被拒 |
| 已存空 user profile | PASS | `RemoteClient` 建出 tunnel（`sshUser: ''`）；host 空仍 skip |
| 測試有效性 | PASS | 把 `ssh-args.ts` / `verify-auth.ts` / `remote-client.ts` 暫時換成 HEAD 版本（先複製到 scratchpad，跑完複製回來；未用 git stash / restore / checkout）：新測試 19 失敗；換回後全過 |
| `npm run test:unit` | PASS | exit 0；199 files，3352 passed、1 skipped |
| `npm run typecheck` | PASS | exit 0（維持 0） |
| `npm run typecheck:electron` | PASS | exit 0（維持 0；新測試檔一度有 1 個 TS2719，已以型別轉換修正後重跑） |
| `npx vite build` | PASS | exit 0 |
| 實機 SSH alias | 未執行 | 依規定不連真實遠端主機、不以預設實例啟動 source build |

### 7. 需實機驗證項目（AI 無法代驗）

1. `~/.ssh/config` 有 `Host devbox` + `HostName` + `User` + `IdentityFile`（無 `Port` 與有自訂 `Port` 各一）：wizard 選 alias 完整跑完、建立 profile、重開後連線。
2. alias 經 `ProxyJump` 跳板：wizard 與 runtime tunnel 都能連上。
3. alias **沒有** `User`：ssh 使用本機登入名；本機登入名與遠端帳號不同時，`verify-ssh-auth` 應以 `permission-denied` 失敗並可跳回 configure 改用手動 `user@host`。
4. Linux 遠端：`loginctl enable-linger "$(id -un)"` 成功、登出後 bat-server 仍存活；cancel wizard 的 teardown 正常移除 unit 與 bundle。
5. Windows 內建 OpenSSH 與 macOS / Linux OpenSSH 各一。
6. 既有手動 `user@host:port` profile 連線不受影響。

### 8. CLAUDE.md 建議文字（由 T0493 套用）

在「Remote 資安（PLAN-018 T0182）」節後或 SSH 相關段落加入：

> - **SSH target 與 user（T0505）**：`sshUser` 可為空。空時所有 ssh 呼叫點（`buildBaseSshArgs`，`electron/remote/ssh-args.ts`）的 argv 結尾為 `-- <host>`，由 `~/.ssh/config` 決定 user / HostName / Port / IdentityFile / ProxyJump（wizard 選 alias 即走此路，存 `sshUser: ''`）；有值時維持 `-- user@host`。host-only target 必須符合 `^(?!-)[A-Za-z0-9._:-]{1,253}$`（不得以 `-` 開頭、不含 `@`），`listSshHosts` 只列出符合者。遠端 `loginctl enable-linger` 在無 user 時用 `"$(id -un)"`。

### 9. 後續建議（未處理，供塔台參考）

- `src/components/profiles/details/SshDetails.tsx:17` 對空 user 顯示 `user@devbox:22`（placeholder `user`、預設 `22`），alias profile 看起來像缺資料；建議空 user 時只顯示 host，port 未設時不顯示 `:22`。不在本單 affects_files，未改。
- `configure-host-invalid`（alias 不合法）沿用 T0502 的情況：沒有 error-mapper entry，走 fallback（原始訊息 + retry / skip / cancel）。因 `listSshHosts` 已過濾，只有非 Shell 呼叫者會走到。

### Commit

- 以 `git commit --only` 提交本單 17 個檔案 + 本工單；不 push。commit hash 見 `git log`（本回報寫於 commit 前）。

### 互動紀錄

- 無（`CT_INTERACTIVE=0`，fire-and-forget）。
