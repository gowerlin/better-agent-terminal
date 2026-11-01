---
schema_version: 1
schema_kind: workorder
id: T0755
title: "headless server 啟動時以登入 shell 取得 PATH（PLAN-057 實作，預設開、可關）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T00:46:30+0800"
started_at: "2026-11-02T00:47:28+0800"
updated_at: "2026-11-02T01:06:12+0800"
completed_at: "2026-11-02T01:06:12+0800"
session_ids:
  - "3c4c9797-fdfa-4049-ad2f-4cddc4ba7082"
depends_on: [T0754]
related:
  - "PLAN-057；D206 / D207；T0754 回報區（結論、量測數據 A–E、③ 影響盤點、④ 套用點、⑥ 開關、⑦ 實作單草案）——本單的設計依據，請先讀"
  - "`electron/early-path-fix.ts`（macOS Electron 主程序，本單不改）；`electron/remote/headless-entry.ts`（`readHeadlessSettings`、`headlessHelperPathEnv`）"
  - "T0748 / T0749 的測試專用 headless server 做法；T0743 的 WSL Docker 做法"
affects_files:
  - electron/remote/headless-login-path.ts
  - electron/remote/server-entry.ts
  - scripts/bat-server.mjs
  - electron/remote/__tests__/headless-login-path.test.ts
  - src/types/index.ts
  - src/stores/settings-store.ts
  - src/components/SettingsPanel.tsx
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/headless-login-shell-path.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - _ct-workorders/T0755-headless-login-shell-path.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 設計照 T0754 草案⑦，加上 D207 三點：① 不加環境變數覆蓋，只有 `<dataDir>/settings.json` `headlessLoginShellPath`（布林，`!== false` 為開，啟動時讀一次）；② WSL 的 `/mnt/<磁碟>/` 項不過濾，日誌只記數量；③ 分頁 PATH 的 `~/.local/bin` 多一份接受，不改 `PtyManager`。"
  - "🔴 必守：取法 `<shell> -l -i -c` ＋每次隨機標記、只取最後一組；`spawn` `detached: true`，逾時 3000 ms 以 `process.kill(-pid, 'SIGKILL')` 砍整個程序群組，以 `exit` 事件結束並 `destroy()` stdout / stderr（🔴 不得用 `execFile` / `spawnSync` 的 timeout，T0754 數據 D）；shell 選法 `SHELL` → `os.userInfo().shell` → `/bin/sh`，白名單沿用 `selectLoginShell`，fish 另用 `string join : $PATH`；合併：登入 PATH 在前、原 PATH 獨有項接後、去重保留首次、只收絕對路徑、有換行 / NUL 整個不用；任何失敗 PATH 不動、記一行、照常啟動；🔴 開關關閉時不 spawn、不碰 `process.env`（測試守住）。日誌不記完整 PATH。win32 不執行（headless 只跑在 Linux / macOS）。"
  - "🔴 套用點：`scripts/bat-server.mjs` `main()`，`resolveDataDir` 之後、`createHeadlessServer` 之前 `await serverEntry.applyHeadlessLoginShellPath?.(…)`；不放進 `createHeadlessServer`（source guard 守住順序）。新模組不 import electron。不改 `PtyManager`、`early-path-fix.ts`、git / gh resolver、遠端工具面板、systemd / launchd 範本。"
  - "🔴 驗證：草案⑦的單元測試、真 shell 測試（win32 skip）、6 項突變檢查（逐項記錄失敗訊息）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。WSL 實機用測試專用 headless server（`/tmp/bat-e2e-t0755*`、`env -i $(systemctl --user show-environment)` ＋ `setsid`、不經 systemd、隨機 port）：開啟 → `applied` 且伺服器檢視 claude / codex / uv 為 found；`false` → `off` 且與現況相同；分頁 PATH 只多一份 `~/.local/bin`；使用者 bat-server MainPID / unit 狀態前後相同。Docker：`bat-e2e-t0755-` 容器驗 `applied`、結束清掉（不得 `prune`、不碰使用者容器）。不用 SSH 主機；macOS 未實測照實寫。需要 server bundle 時只在測試目錄建，不升級使用者 server。"
  - "🔴 CLAUDE.md 新增一節（3–12 行，依『CLAUDE.md 撰寫規則』），細節寫進 `docs/agent-guide/headless-login-shell-path.md` 並更新索引。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」（家目錄寫 `<使用者家目錄>`，不寫使用者容器名稱）。"
---

# T0755 — headless server 的登入 shell PATH（實作）

## 元資料

- **工單編號**：T0755
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T00:46:30+0800
- **預估規模**：M

## 背景

bat-server 由 systemd / launchd / 容器 ENTRYPOINT 啟動，PATH 只有系統預設值，server 程序的子程序（Claude 面板的 Bash 工具 / MCP 等）找不到 `~/.local/bin`、nvm、Homebrew。T0754 量測完成並給出設計；使用者決定照草案實作（D206 預設開、可關；D207 不加環境變數、不過濾 `/mnt`、接受分頁重複）。

## 範圍

1. 新模組 `electron/remote/headless-login-path.ts`（`resolveLoginShellPath` 純邏輯、`applyHeadlessLoginShellPath` 套用）；`server-entry.ts` 匯出；`bat-server.mjs` 呼叫。
2. Settings：`AppSettings.headlessLoginShellPath`、store setter、`SettingsPanel.tsx` 遠端視窗區塊（BAT MCP 旁）、三語系。
3. 文件：docs 新檔、索引、CLAUDE.md 一節。

## 不做

- 不改 `PtyManager`、`early-path-fix.ts`、git / gh resolver、遠端工具面板、unit / plist 範本；不加環境變數覆蓋；不升級使用者 bat-server；不發版。

## 驗收

- [ ] 單元測試、真 shell 測試、6 項突變檢查
- [ ] typecheck 0 / 0、`test:unit`、`vite build`
- [ ] WSL 測試 server：開啟 `applied`、關閉 `off` 與現況相同、分頁 PATH 只多一份；使用者 bat-server 前後相同
- [ ] Docker `bat-e2e-t0755-` 容器 `applied`、資源已清
- [ ] CLAUDE.md 一節 ＋ docs 檔 ＋ 索引

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：（C-0 已 PASS，僅記錄）`electron/remote/server-entry.ts`、`scripts/bat-server.mjs`、`electron/remote/headless-login-path.ts`（新檔，祖先 `electron/remote/` 存在）、`electron/remote/__tests__/headless-login-path.test.ts`（新檔，祖先存在）、`src/types/index.ts` → 全部 present
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 結果摘要

照 T0754 草案⑦ ＋ D207 三點實作完成：bat-server 啟動時以 `<shell> -l -i -c` ＋ 隨機標記取登入 shell 的 PATH，合併進 `process.env.PATH`；預設開，`<dataDir>/settings.json` `headlessLoginShellPath: false` 關閉。所有驗收項目都有證據，WSL 測試 server 與 Docker 實測都是 `applied`。

### 變更檔案（產品 commit `681a8d64`）

| 檔案 | 內容 |
|---|---|
| `electron/remote/headless-login-path.ts`（新） | `selectHeadlessLoginShell`、`buildLoginShellPathArgs`、`extractMarkedValue`、`resolveLoginShellPath`（純邏輯）、`runLoginShell`（`spawn` `detached: true`、逾時 3000 ms `killGroup(pid, 'SIGKILL')` = `process.kill(-pid, …)`、`exit` 結束並 `destroy()` pipes、SIGKILL 後再等 500 ms 保底）、`applyHeadlessLoginShellPath`（讀開關、套用、一行日誌、不丟例外）。不 import electron。 |
| `electron/remote/server-entry.ts` | 匯出 `applyHeadlessLoginShellPath` |
| `scripts/bat-server.mjs` | `main()`：`resolveDataDir` / `resolvePort` 之後、signal handler 與 `createHeadlessServer` 之前 `await serverEntry.applyHeadlessLoginShellPath?.({ dataDir, logger: console })` |
| `electron/remote/__tests__/headless-login-path.test.ts`（新） | 31 個單元測試 ＋ 4 個真 shell 測試（win32 skip）＋ source guard |
| `src/types/index.ts`、`src/stores/settings-store.ts` | `AppSettings.headlessLoginShellPath?: boolean`、`setHeadlessLoginShellPath` |
| `src/components/SettingsPanel.tsx` | 「進階」頁 BAT MCP 下方「BAT 伺服器 PATH」勾選框；只在 `targetOS` 對應 Linux / macOS 的遠端視窗顯示（`isPosixRemoteWindow`，經 `shellPlatformForTargetOS`） |
| `src/components/__tests__/settings-headless-login-path.test.tsx`（新） | 9 個測試：四種遠端 `targetOS` 顯示、本機（undefined / null / 未知值）不顯示、取消勾選存 `false`、三語系字串 |
| `src/locales/en.json`、`zh-TW.json`、`zh-CN.json` | `settings.headlessLoginShellPathTitle` / `headlessLoginShellPath` / `headlessLoginShellPathHint` |
| `docs/agent-guide/headless-login-shell-path.md`（新）、`docs/agent-guide/README.md` | 完整規則、日誌、影響表、已知限制、驗證清單；索引一列 |
| `CLAUDE.md` | 新增「headless server 的登入 shell PATH（PLAN-057 / T0755，D206 / D207）」一節（6 行，放在「指揮塔總覽」前）；檔案 79,217 字元 |

工單沒寫死、由我判讀的部分：

- 「只收絕對路徑」套用在**登入 PATH 的項**（相對、空項丟掉；一項都不剩 → 失敗）；原 PATH 的獨有項原樣保留（只去空項），避免改掉 server 原本就有的項目。
- 日誌的 `/mnt N` 是合併結果裡 `/mnt/<磁碟>/` 的項數；另加 `N total`（合併後項數）方便比對。
- 失敗日誌用 `logger.warn`（沒有就 `log`）；win32 記 `skipped (win32)`。
- shell 候選不合格（不在白名單、相對路徑）時退回 `/bin/sh`，不再改試 `os.userInfo().shell`（與 `resolveProbeShell` ＋ `selectLoginShell` 相同語意）。

### 驗證證據

**原始碼 / 建置 / 測試**

| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | exit 0 |
| `npm run test:unit` | exit 0：363 檔、6448 passed、10 skipped |
| 新測試（Windows） | `headless-login-path.test.ts` 31 passed / 4 skipped（真 shell，win32）；`settings-headless-login-path.test.tsx` 9 passed |
| `headless-electron-free.test.ts`（bundle 不得 import electron） | passed（新模組在 server-entry 的 import graph 內） |

**真 shell 測試（WSL）**：Windows 上 vitest 跳過這 4 個；WSL 沒有 Linux 版 node_modules，所以把同一個模組用 esbuild 編成 CJS，以 WSL nvm node v24.22.0 跑等效 harness（放在 scratchpad，情境與斷言同 vitest 的 `real bash` 區塊）。CI `tests.yml` 的 `ubuntu-24.04` 會跑 vitest 版本本身。

| 情境 | 結果 |
|---|---|
| `.profile`：`trap '' TERM` ＋ `sh -c 'sleep 37; :'` | `failed (timeout 3000 ms)`，3007 ms 結束，PATH 不變，殘留 0 |
| `.profile`：`exit 0` | `failed (no-marker, exit 0)`，39 ms，PATH 不變 |
| rc 印橫幅 ＋ OSC 標題 ＋ 加一項 | `applied`，rc 項排第一、原項都在、無重複（Ubuntu `/etc/profile.d` 另加 `/snap/bin`） |
| rc `setsid sh -c 'sleep 37; :' &`（佔住 stdout） | `applied`，39 ms |
| 合計 | 7/7 PASS |

開發途中把真 shell 期望值由「PATH 完全等於 X」改成「rc 項第一、原項都在、無重複」：Ubuntu 的 `/etc/profile.d/apps-bin-path.sh` 會另加 `/snap/bin`，原寫法在 Linux 必然失敗。

**突變檢查（每次只改一處；改完即從 scratchpad 備份還原，`cmp` 確認相同）**

| # | 突變 | 失敗的測試與訊息 |
|---|---|---|
| 1a | `killGroup(pid, 'SIGKILL')` → `'SIGTERM'` | 單元：`timeout → SIGKILL to the process group` — `expected "vi.fn()" to be called with arguments: [ 4242, 'SIGKILL' ]`；`default killGroup signals the negative pid` — `expected "kill" to be called with arguments: [ -4242, 'SIGKILL' ]`；source guard。WSL 真 shell：`FAIL hang: < 3500 ms — 3508 ms`、`FAIL hang: no leftover — leftover pids [32879]` |
| 1b | 預設 killGroup `process.kill(-pid, …)` → `process.kill(pid, …)`（不砍群組） | 單元：`default killGroup signals the negative pid` — `expected "kill" to be called with arguments: [ -4242, 'SIGKILL' ]`。WSL 真 shell：`FAIL hang: no leftover — leftover pids [32949]` |
| 2 | 拿掉標記過濾（`raw = stdout.trim()`） | 10 個失敗，例：`finds the PATH between rc noise` — `expected { ok: false, reason: 'invalid-chars' } to deeply equal { ok: true, …(4) }`。WSL 真 shell：`FAIL noise … "reason":"invalid-chars, exit 0"` |
| 3 | 忽略開關（`if (false && …)`） | `switch false → no spawn, env deep-equal, logs off (setting)`、`reads the setting from <dataDir>/settings.json by default` — `Test timed out in 3000ms.`（spawn 了假 child） |
| 4 | 拿掉與原 PATH 的合併 | `keeps entries only the original PATH had (an rc file removed them)` — `expected '/home/u/.local/bin:/usr/bin' to be '/home/u/.local/bin:/usr/bin:/opt/unit…'`；另 3 個 |
| 5 | `child.on('exit'` → `child.on('close'` | `finishes on exit even when close never comes` 等 7 個 — `Test timed out in 3000ms.`；source guard（`.on('close'`）。WSL 真 shell：`FAIL setsid … "reason":"timeout 3000 ms" … 3511 ms` |
| 6 | `bat-server.mjs` 的呼叫移到 `server.start()` 前（`createHeadlessServer` 之後） | `bat-server.mjs awaits applyHeadlessLoginShellPath?.() after resolveDataDir and before createHeadlessServer` — `expected 2454 to be greater than 2585` |

（`/home/u` 是測試裡的假家目錄。）發現：第一次跑 1a 時 WSL 真 shell **沒有**失敗：SIGTERM 送給整個群組時，`sh` / `sleep` 不會忽略 SIGTERM，一樣會結束。所以把卡住情境改成 `.profile` 先 `trap '' TERM`（模擬 interactive bash 忽略 SIGTERM；被忽略的訊號會傳給子程序），vitest 與 harness 一起改，重跑後 1a 被抓到。

**WSL 實機（測試專用 headless server）**

- 做法：把使用者既有的 `~/.local/bat-server` **唯讀複製**到 `/tmp/bat-e2e-t0755/install`；用 `build-server-bundle.mjs` 的 esbuild 設定（經 `dev-deploy-headless.mjs` 的 `loadBuildConfig` / `loadHelperScripts`）把本 repo 的 headless JS、6 個 helper、`bat-server.mjs` 建到 Windows scratchpad 再覆蓋進去（沒動 `dist-server/`）。以 `setsid nohup env -i $(systemctl --user show-environment) T0755_E2E_TAG=bat-e2e-t0755 … bat-server.mjs --data-dir /tmp/bat-e2e-t0755/data-<on|off> --port <隨機> --bind-interface localhost --token <隨機>` 啟動，不經 systemd。測試 client（Node 內建 WebSocket；只對測試 server 的自簽憑證設 `NODE_TLS_REJECT_UNAUTHORIZED=0`）呼叫 `remote-tools:detect`，再開一個分頁印 PATH（先 `unset HISTFILE`）。

| 項目 | 開啟（預設） | `settings.json` `false` |
|---|---|---|
| 日誌 | `applied (shell=/bin/bash, 124 ms, +2 entries, 11 total, /mnt 0)`（兩次相同） | `off (setting)` |
| 伺服器檢視 claude / codex / uv | `serverVisible: true`（status `ok`） | `serverVisible: false`（與現況相同；T0753 / T0754 量到的現況） |
| 伺服器檢視 node | `serverVisible: true`，status `error`（既有問題：nvm v26.13.0 缺 `libatomic.so.1`，T0754 待決點 4） | `serverVisible: false` |
| 伺服器檢視 git / gh | 可見 | 可見 |
| 分頁 PATH | 13 項，重複項 `<使用者家目錄>/.local/bin x2`，nvm 1，`/mnt` 0 | 13 項，重複項 `/snap/bin x2`（unit PATH 原本就重複），`~/.local/bin` 1，nvm 1，`/mnt` 0 |
| 分頁 PATH 去重後 sha（前 12 碼） | `ac556082bb70` | `ac556082bb70`（相同） |

分頁 PATH 結論：項目集合相同，只多一份 `~/.local/bin`；同時 unit PATH 原本重複的 `/snap/bin` 因 server 端去重而少一份（所以總數不變）。

- 使用者 bat-server 前後比對（測試前 00:58、清理後）：`bat-server.service` MainPID `357`、`active/running`、`NRestarts=0`、`ActiveEnterTimestamp` `2026-11-02 00:22:46` 相同；`~/.local/bat-server` 檔案清單（路徑、大小、mtime）sha256 `f0917690…` 相同；`~/.config/systemd/user` 清單 sha256 `426bd09e…` 相同；`~/.profile`、`~/.bashrc`、`~/.bash_history` 的 mtime 相同（server 的 `-l -i -c` 與測試分頁都沒有寫入 history）。
- 清理：測試 server 以 `kill` 結束，再對 environ 帶 `T0755_E2E_TAG` 的程序 SIGKILL（每次結束時剩 0）；`/tmp/bat-e2e-t0755*` 已刪除；`sleep 37` 殘留 0。

**Docker（WSL Docker engine，只用 `bat-e2e-t0755-` 容器）**

- `bat-server:latest`（0.7.1-pre.6 映像，ENTRYPOINT `tini -- /opt/bat-server/bin/bat-server --bind-interface all`，映像 `Env` 沒有 `SHELL`）；新建置的 `server-entry.js` / `headless-entry.js` / `dataDir.js` / `lockfile.js` / `bat-server.mjs` 以唯讀 bind mount 蓋上，`--data-dir /tmp/bat-e2e-data`（容器內），不 publish port。

| 容器 | 日誌 |
|---|---|
| `bat-e2e-t0755-default`（映像預設 rc） | `applied (shell=/bin/bash, 8 ms, +0 entries, 6 total, /mnt 0)` — PATH 與映像相同 |
| `bat-e2e-t0755-rc`（唯讀掛一份 `/root/.profile`：`. /etc/profile` ＋ 加 `/root/.t0755-bin`） | `applied (shell=/bin/bash, 4 ms, +1 entries, 7 total, /mnt 0)` |

- `shell=/bin/bash` 來自 `os.userInfo().shell`（`SHELL` 沒設）。
- 清理：兩個容器都 `docker rm -f`；`/tmp/bat-e2e-t0755-docker` 已刪；之後 `bat-e2e-t0755-` 容器 0 個；使用者既有容器（1 個）ID 前後相同、仍 Up。沒有 `prune`、沒有建映像。

**未驗證**：macOS（launchd）沒有機器，未實測（docs 已標明）；SSH 主機依工單不使用。

### 遭遇問題

- 用 Python 改檔時，Windows 的 text mode 把 `server-entry.ts`、`bat-server.mjs`、新模組改成 CRLF；發現後改回 LF（`git ls-files --eol` 確認 `w/lf`），之後的修改都用 `newline=''` 或 Edit 工具。
- 為了讓 scratchpad 的建置腳本解析到 repo 的 esbuild，暫時把一個建置腳本複製到 repo 根目錄執行，跑完立即刪除（沒有進 commit，`git status` 確認）；之後改用 `npx esbuild` 與 `createRequire` 解析。
- 突變 1a 在真 shell 一開始沒被抓到（見突變檢查表下方說明），已補強測試情境。
- `/proc/<pid>/environ` 是程序啟動時的環境，看不到行程內改過的 `process.env.PATH`（兩種模式都顯示 unit PATH 10 項）；生效值以伺服器檢視與日誌確認。已寫進 docs 的已知限制。

### 後續建議（給塔台）

- 正式 server bundle 發版後，用精靈安裝 / 升級的 bat-server 再看一次 journal 的 `login shell PATH: applied` 與工具面板「伺服器：可見」（本單只用測試目錄，沒升級使用者的 server）。
- macOS 主機有機會時補實測（launchd 環境的 `SHELL`、zsh `-l -i` 耗時）。
- 使用者 WSL 的 nvm 預設 node v26.13.0 缺 `libatomic.so.1`（T0754 待決點 4）：套用後 Claude 面板的 `node` / `npx` 會變成載入錯誤，建議使用者裝 `libatomic1` 或把 nvm 預設改成 v24。

### 互動紀錄

- 無（yolo；沒有需要問塔台的問題）。

### 完成狀態

- **狀態**：DONE
- **驗收**：單元測試、真 shell 測試（WSL harness 7/7；vitest 版本在 CI Linux 跑）、6 項突變檢查（逐項記錄）✅；typecheck 0 / 0、`test:unit`、`vite build` ✅；WSL 測試 server 開啟 `applied`、關閉 `off` 與現況相同、分頁 PATH 只多一份 `~/.local/bin`、使用者 bat-server 前後相同 ✅；Docker `bat-e2e-t0755-` 容器 `applied`、資源已清 ✅；CLAUDE.md 一節 ＋ docs 檔 ＋ 索引 ✅
- **commit**：產品 `681a8d64`（`git commit --only`，14 個檔案）；工單另以 `git commit --only` commit；未 push
- **session_id**：3c4c9797-fdfa-4049-ad2f-4cddc4ba7082
