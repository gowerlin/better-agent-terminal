---
schema_version: 1
schema_kind: workorder
id: T0681
title: "BUG-168 G3：ssh-start-server／ssh-bundle-uploader／wsl-systemd／wsl-detect 四個舊測試與 vitest 版去重，獨有情境搬進 vitest，刪舊檔"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
started_at: "2026-10-21T20:41:13+08:00"
updated_at: "2026-10-21T20:51:59+08:00"
completed_at: "2026-10-21T20:51:59+08:00"
depends_on:
  - "T0679（DONE `6fb40e70`：逐項分類與證據）"
related:
  - "D177（往 vitest 收斂）；BUG-168；T0679 回報區「調查結論」表與「SSH／WSL 安裝路徑的產品端追查」"
  - "規則：CLAUDE.md「Remote 資安」節、`docs/agent-guide/remote-security.md`（安裝根目錄必須絕對、至少兩段）；T0511（systemd unit 帶 `--port`、`enable` + `restart`、launchd 驗證 port 在聽）、T0552／T0554、T0378、T0382"
affects_files:
  - tests/ssh-start-server.test.ts
  - tests/ssh-bundle-uploader.test.ts
  - tests/wsl-systemd.test.ts
  - tests/wsl-detect.test.ts
  - electron/__tests__/ssh-start-server.test.ts
  - electron/__tests__/wsl-systemd.test.ts
  - electron/__tests__/wsl-detect.test.ts
  - electron/__tests__/wsl-install-bundle.test.ts
  - "electron/remote/__tests__/ssh-*.test.ts"
  - _ct-workorders/T0681-bug168-g3-ssh-wsl-tests-dedupe.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試，不改產品程式。T0679 已判定全部是測試過時；以下舊期望是錯的，**不得**搬進 vitest：安裝路徑用 `~`（T0552 起必須絕對、至少兩段）、systemd unit 用 `Environment=BAT_REMOTE_PORT` 而不是 `--port`（舊寫法就是 BUG-121）、`enable --now`（T0511／T0382 改成 `enable` + `restart`）、`pgrep -x bat-server` 驗證 launchd（T0511 改輪詢 PID + `lsof` 確認 port 在聽）、`~` 路徑的 systemd unit（BUG-087 的錯誤 unit）、不帶使用者的 `loginctl enable-linger`（T0378 先 `id -un`）、「第一次 active 就成功」（T0382 改穩定 3 秒且 NRestarts 不變）。"
  - "🔴 收斂規則（D177）：逐項比對 vitest 版；重複的不搬；獨有且仍有效的搬進對應的 vitest 檔（例如 T0679 提到的 T0297 escapeXml／plist breakout、T0296 BatchMode、sshHost 開頭 `-` 的拒絕），期望值改成現行正確行為；最後 `git rm` 四個舊檔。若某個獨有情境要靠修改產品才能測，記下來不做。"
  - "🔴 測試不得真的連線遠端或啟動 WSL／Docker／SSH；沿用既有的 `setExecFileImplForTests`／`setSpawnImplForTests` 或 vitest 的 mock。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`tests/__mocks__/**`。刪檔後若有 `package.json` script 指向它們，列在回報區，由後續 CI 工單清理。"
  - "🔴 同時有 T0680（G2）與 T0683（CI 第一步）的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`（刪檔用 `git rm` 後同樣只 commit 自己的路徑），不要 `git add -A`。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數與檔數）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；刪掉的四個舊檔在 repo 內（`package.json` 以外）沒有其他引用。"
  - "🔴 順帶記錄（不改）：`electron/wsl-systemd.ts` 解析使用者失敗時用 `error.message` 而非 `describeError`（T0679 遭遇問題第 3 點），在回報區寫建議即可。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0681 — BUG-168 G3：SSH／WSL 舊測試去重並收進 vitest

## 目標

`tests/` 底下 ssh-start-server、ssh-bundle-uploader、wsl-systemd、wsl-detect 四個檔共 18 項失敗，T0679 判定全部是測試過時，而且和 `electron/__tests__/`、`electron/remote/__tests__/` 的 vitest 版大量重複。依 D177：重複的不搬、獨有且仍有效的搬進 vitest 並更新成現行正確的期望、刪掉舊檔。

## 要做的事

1. 讀 T0679 回報區這四個檔的分類表與「產品端追查」。
2. 逐項比對 vitest 版，搬移獨有情境（期望值依現行工單與 `docs/agent-guide/remote-security.md`）。
3. `git rm` 四個舊檔。
4. 驗證、commit（不 push）。

## 驗收

- 四個舊檔已刪；回報區有對照表（舊項目 → vitest 位置／重複未搬／錯誤期望不搬，附理由）。
- `test:unit` 全過；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

DONE。四個舊檔（共 47 項：ssh-start-server 19、ssh-bundle-uploader 8、wsl-systemd 9、wsl-detect 11）已 `git rm`。逐項比對後：獨有且仍有效的搬進 vitest，共新增 35 項（期望值改成現行行為、路徑一律絕對）；重複的不搬；錯誤期望（`~` 安裝路徑、`Environment=BAT_REMOTE_*`、`enable --now`、`pgrep -x bat-server`、`~` 的 systemd unit、不帶使用者的 linger、「第一次 active 就成功」）一律不搬。沒有改產品程式，也沒有遇到「要改產品才能測」的情境。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（舊檔與 vitest 檔都存在）；無 `branch` 欄位（C-2 不適用），HEAD 在 `main`。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有問塔台（每一項都能依 T0679 分類表、T0511／T0552／T0378／T0382 與 `docs/agent-guide/remote-security.md` 判斷）。工單 `status` 原為 `TODO`（非 `PENDING`），照常改成 `IN_PROGRESS`。

### 對照表（舊項目 → vitest 位置／重複未搬／錯誤期望不搬）

新增的 vitest 測試都放在各檔尾端新的 `describe(... carried over from tests/... (T0681))`；`electron/remote/__tests__/ssh-bundle-uploader.test.ts` 是新檔。

**`tests/ssh-start-server.test.ts`（19 項）→ `electron/__tests__/ssh-start-server.test.ts`**

| 舊項目 | 處置 | 位置／理由 |
|---|---|---|
| test1 unit 欄位 | 部分搬 | 搬：`[Unit]`／Description／After／Type=simple／Restart=on-failure／RestartSec=5s／WantedBy 與 ExecStart 帶 `--port 51820 --bind-interface localhost`（「systemd unit carries the fixed sections…」，並斷言**沒有** `Environment=` 行）。不搬：`Environment=BAT_REMOTE_BIND/PORT`（BUG-121 的錯誤寫法，T0511）。`~` 展開已由既有「expands ~/ against serverHome」覆蓋 |
| test2 plist 鍵 | 部分搬 | 搬：Label `com.bat-server`、RunAtLoad、KeepAlive Crashed=true／SuccessfulExit=false。不搬：`EnvironmentVariables` / `BAT_REMOTE_PORT`（T0511 改 ProgramArguments；`ssh-bundle-layout-and-port.test.ts` 已斷言沒有 EnvironmentVariables） |
| test3 systemd 順序 | 部分搬 | 搬：3 次 exec、`method: 'systemd'`、phase 順序 `writing-unit → enabling → starting → verifying`、`checkOutput`。不搬：`enable --now`（T0511／T0382 改 `enable` + `restart`，`ssh-bundle-layout-and-port.test.ts:139` 已覆蓋）；unit 寫入路徑重複（既有 T0379 測試） |
| test4 launchd | 部分搬 | 搬：`method: 'launchd'`、3 次 exec、verify 指令 = `buildVerifyCommand('ssh-darwin', …)`。不搬：`launchctl list \| grep … && pgrep -x bat-server`（T0511 改 PID + `lsof`，`ssh-bundle-layout-and-port.test.ts:163` 已覆蓋）；`load -w` 與 servicePath 重複（既有 launchd 測試） |
| test5 unit 寫入失敗 | 搬 | 「a unit-write failure stops before enabling」（1 次 exec、`unit-write-failed`、`method: 'failed'`、stderr 進 error） |
| test6 enable 失敗 | 搬 | 「an enable failure stops before verifying」（2 次 exec、`enable-failed`） |
| test7 單引號 | 搬 | 「escapeSingleQuotes escapes apostrophes…」＋「an install path with an apostrophe still yields balanced remote commands」（`/opt/O'Brien/bat-server`，ExecStart 斷言改成帶 `--port`） |
| test8 port 流向 | 不搬（重複＋錯誤期望） | port 進 `--port`、預設 port、非法 port 已由 `ssh-bundle-layout-and-port.test.ts:119-131` 覆蓋；`BAT_REMOTE_PORT` env 是錯誤期望 |
| test9 heredoc | 搬（改絕對路徑） | 「buildWriteUnitCommand: mkdir, then a single-quoted heredoc closed by EOF」，舊版用 `~/.config/...` 改成 `/home/alice/.config/...`，整串比對 |
| test10b BatchMode | 搬 | 「every ssh exec carries -o BatchMode=yes」（3 次 exec 全檢查） |
| test10c sshHost 開頭 `-` | 搬 | 「an sshHost starting with - is rejected before any ssh exec」，比對 `/sshHost.*cannot start with '-'/`（`ssh-alias-target.test.ts` 只測無使用者的 alias、不比對訊息） |
| test10d `\r` | 搬（改絕對路徑） | 併入 escapeSingleQuotes 那項 |
| test11a escapeXml | 搬 | 「escapeXml maps the 5 XML special chars, & first」（pass-through 範例由 `~/...` 改成絕對路徑） |
| test11b plist 注入 | 大部分重複 | 跳脫與「沒有 RunAsUser key」已由既有「still XML-escapes the expanded path」覆蓋；只有「單一 `<plist>` root」搬進 plist 鍵那項 |
| test11c `&` / `"` | 部分搬 | `"` 搬（「renderLaunchdPlist escapes a double quote…」）；`&` 重複（既有 `a&b`） |
| test11d `[ ] =` | 部分搬 | `]` 搬（「renderSystemdUnit also rejects ]…」）；`[`、`=` 重複（既有 T0297 F-005 測試） |
| test11e validateSystemdValue | 搬（改絕對路徑） | 「validateSystemdValue passes benign values and rejects a newline」，舊的 `~/.local/bat-server` 範例不搬 |
| test11f 無 entity ref | 搬 | 併入 plist 鍵那項 |
| test10 verify 失敗 | 部分搬 | 搬：`checkOutput` 保留 probe 輸出；`verify-failed` 本身重複（`ssh-bundle-layout-and-port.test.ts:177`） |

**`tests/ssh-bundle-uploader.test.ts`（8 項）→ 新檔 `electron/remote/__tests__/ssh-bundle-uploader.test.ts`**（安裝根目錄一律 `/home/alice/.local/bat-server`，T0552）

| 舊項目 | 處置 | 位置／理由 |
|---|---|---|
| test1 進度 0 → total、單次 ssh | 搬 | 「streams the whole tarball through one ssh exec; progress walks 0 → total」 |
| test2 非 0 結束帶 stderr | 搬 | 「rejects with the ssh stderr when the remote command fails」 |
| test3 total 固定為 stat 大小 | 搬 | 「keeps reporting the stat size as the total…」 |
| test4 遠端指令含 mkdir / tar xz / `~` 路徑 | 不搬（重複＋錯誤期望） | 解壓指令已由 `ssh-bundle-layout-and-port.test.ts:59-91` 與 `ssh-alias-target.test.ts`（`buildExtractCommand`）完整覆蓋；`~/.local/bat-server` 是錯誤期望（T0552 拒絕，同檔 :88 斷言要丟例外） |
| test5b `\r` | 搬（改絕對路徑） | `it.each` 第 2 列，並斷言沒有 spawn |
| test5c sshHost 開頭 `-` | 搬 | `it.each` 第 3 列（以合法根目錄，才會走到 host 檢查） |
| test5d BatchMode | 搬 | 「ssh argv carries -o BatchMode=yes」 |
| test5 單引號 | 搬 | `it.each` 第 1 列 |

**`tests/wsl-systemd.test.ts`（9 項）→ `electron/__tests__/wsl-systemd.test.ts`**（execStart / unit 路徑一律 `/home/demo/...`，T0378）

| 舊項目 | 處置 | 位置／理由 |
|---|---|---|
| renderSystemdUnit 區段與 RestartSec=2s | 搬（改絕對路徑） | 「renderSystemdUnit has the [Unit] / [Service] / [Install] sections…」；舊的 `~` execStart 是 BUG-087 的錯誤 unit，不搬 |
| 環境值跳脫引號／換行 | 搬（改絕對路徑） | 「renderSystemdUnit escapes quotes and newlines…」 |
| writeUnit 經 wsl tee stdin | 搬（改絕對路徑） | 「writeUnit creates the unit directory, then pipes the unit into wsl tee」（明確傳 `path`；舊版的預設 `~/.config/...` 不搬） |
| enableLinger ok=true | 不搬（重複＋錯誤期望） | 舊 mock 對 `id -un` 回空字串；現行行為由既有 T0378 測試（`id -un` → `show-user` → `enable-linger demo` → `Linger=yes`）覆蓋 |
| enableLinger loginctl 失敗 | 不搬（重複＋錯誤期望） | 既有「judges by Linger=yes…ENXIO」「reports a still-disabled linger」覆蓋 |
| startService enable-now + 第一次 active | 不搬（錯誤期望） | `enable --now`、「第一次 active 就成功」是 T0382 前的行為；既有 T0382 穩定性測試覆蓋 |
| startService 一直沒 active → 逾時 | 不搬（重複） | 既有「times out with the journal summary…」 |
| removeUnit | 搬（改絕對路徑） | 「removeUnit disables the service, removes the unit file and reloads, ignoring failures」（removeUnit 現行仍是 `disable --now`，那是移除，不是啟動） |
| 非法 distro／service name | 搬 | 「startService rejects an invalid distro or service name before running anything」，另斷言沒有任何 exec |

**`tests/wsl-detect.test.ts`（11 項）→ `electron/__tests__/wsl-detect.test.ts`、`electron/__tests__/wsl-install-bundle.test.ts`**

| 舊項目 | 處置 | 位置／理由 |
|---|---|---|
| list() 多個 distro + 預設標記 | 搬 | 「list() parses several distros, the default marker and both WSL versions」（既有只測單一 distro） |
| list() exit 0 + 無 distro 訊息 | 搬 | 「list() returns an empty list when `wsl -l -v` exits 0…」（既有只測 exit -1 路徑） |
| systemdEnabled() running | 搬 | 「systemdEnabled() is true when systemctl reports running」 |
| systemdEnabled() fallback `/etc/wsl.conf` | 搬 | 「systemdEnabled() falls back to systemd=true in /etc/wsl.conf…」 |
| detectNetworkMode mirrored／nat／unknown（3 項） | 不搬（重複） | 既有 T0383 `detectNetworkMode()` 四項 |
| validateDistroName() | 搬 | 「validateDistroName() rejects shell metacharacters」 |
| validateInstallPath() | 搬 | 「validateInstallPath() rejects traversal and shell metacharacters」 |
| installBundle() 相對 tarball | 搬（根目錄改絕對） | `wsl-install-bundle.test.ts`「refuses a relative tarball path without running anything」，根目錄 `/home/me/.local/bat-server`，錯誤訊息 `Expected absolute Windows path: relative.tar.gz` 與舊期望相同 |

小計：47 項 → 搬（全部或部分）38 項，新增 vitest 35 項（ssh-start-server +16、ssh-bundle-uploader 7、wsl-systemd +5、wsl-detect +6、wsl-install-bundle +1）；完全不搬 9 項（重複，或重複且含錯誤期望）；部分搬的項目中，錯誤期望的部分都沒搬。

### 驗證結果

主 checkout（`HEAD` = `65127614` + 工作樹；**同時含 T0680／T0683 Worker 尚未 commit 的變更**）：

| 檢查 | 結果 |
|---|---|
| 新增／修改的 5 個 vitest 檔單獨跑 | PASS：ssh-start-server 45、ssh-bundle-uploader 7、wsl-systemd 22、wsl-detect + wsl-install-bundle 48 |
| `npm run test:unit` | PASS：326 檔、5,751 passed／3 skipped，58.5 s |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 2 個錯誤，**都在 `electron/__tests__/claude-runtime-router.test.ts`**（T0680 正在改、未 commit 的檔，TS7024 第 571、582 行）；本單檔案 0 個 |

只含本單變更的乾淨驗證（scratchpad 內 `git worktree add --detach … HEAD`，複製本單 5 個檔、刪 4 個舊檔，`node_modules` 以 junction 指向主 checkout；跑完先拆 junction 再 `git worktree remove`，主 checkout 的 `node_modules` 確認仍在）：

| 檢查 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| `npm run test:unit` | 323 檔，5,691 passed／6 skipped／**2 failed**：都是 `electron/__tests__/bat-mcp-codex-env.test.ts`（啟動內嵌 codex `app-server` 的整合測試）45 s 逾時。與 SSH／WSL 無關；同一檔在主 checkout 的全套中通過，判斷是臨時 worktree 位在 Temp、`node_modules` 走 junction 造成的環境差異（未深追） |

- `validated_sha` 不適用（非 worktree）；驗證時 HEAD = `65127614`，product commit 見下。
- 引用檢查：`git grep` 刪掉的四個檔名，在 `_ct-workorders/` 以外沒有引用；`package.json`、`vite.config.ts`、`.github/workflows/*.yml` 都沒有。產品註解中提到舊測試編號的地方見「建議」。
- 沒有連線遠端、沒有啟動 WSL／Docker／SSH：全部用 `setExecFileImplForTests`／`setSpawnImplForTests` 或注入的 `spawn`／`stat`／`createReadStream`。
- 沒跑 Playwright e2e（依工單）。

### 因刪檔而失效的 package.json script

無。`package.json` 沒有任何 script 指向這四個檔。

### 建議（不在本單範圍）

1. `electron/wsl-systemd.ts:244-246`（`enableLinger` 解析使用者失敗）用 `error.message`，不是 `describeError`；`id -un` 失敗時 stderr 能不能出現在錯誤訊息裡取決於 Node 是否把它放進 message（T0679 遭遇問題第 3 點）。建議改用與其他失敗路徑一致的描述函式並補一項 vitest。
2. 產品註解仍指向已刪的舊測試編號，可在下次改這兩個檔時順手更新：`electron/remote/ssh-start-server.ts:109`（「keep test7 in ssh-start-server.test.ts green」）、`:395`（「test7's guard regex」）、`electron/remote/ssh-bundle-uploader.ts:72`（「test5 contract」）。對應的契約現在由本單新增的 vitest 守住（`forbidden newline`、`installPath contains forbidden character`）。
3. `startServerOnRemote` 的 `start-failed` 分類（`isStartIssue`，`ssh-start-server.ts:557`）沒有任何測試（舊檔也沒有），可另補。

### Commit

- `eaf8c168` test: T0681 BUG-168 G3 move unique ssh/wsl legacy tests into vitest, delete tests/ copies（9 檔：4 個 vitest 檔修改、1 個新檔、4 個舊檔刪除；`git commit --only` 只含本單路徑）
- 工單檔另一個 commit（本回報）。未 push。

### 互動紀錄

無（未問塔台、無使用者介入）。

### 遭遇問題

1. 用 Git Bash heredoc 追加測試時，內容含 `'` 與反斜線導致 bash 解析失敗（沒有寫入任何東西，確認檔案未變），改用 Edit／Write 工具（L129）。
2. 主 checkout 的 `typecheck:electron` 被 T0680 未 commit 的檔拖到 2 個錯誤，因此另開臨時 worktree 取得只含本單變更的乾淨證據（見驗證結果）。index 內 T0680 已 `git rm` 的舊檔與其他 Worker 的變更都未動、未納入本單 commit。
3. 臨時 worktree 中 `bat-mcp-codex-env.test.ts` 逾時（見驗證結果），與本單無關，未深追。

### 回報時間

2026-10-21T20:50:35+08:00
