---
schema_version: 1
schema_kind: workorder
id: T0514
title: "pre.6 已安裝版自動化實機驗收（UI / 遠端路由線）：BUG-105 / 106 / 107 / 108 / 109 / 110 / 112 / 113 / 096"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P1
sizing: L
created_at: "2026-10-14T03:42:23+0800"
started_at: "2026-10-14T03:44:01+0800"
updated_at: "2026-10-14T04:03:07+0800"
completed_at: "2026-10-14T04:03:07+0800"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0510（同型驗收：installed exe + Playwright 隔離實例，`e2e/pre5-acceptance.spec.ts`）"
  - "T0467（`e2e/real-remote/plan039-real-remote-env.mjs`、`Dockerfile`、`e2e/fixtures/electron-isolation.ts` `launchIsolated` / `isolatedEnv`）"
  - "並行：T0515（精靈線）、T0516（建置產物線）"
affects_files:
  - e2e/pre6-ui-remote-acceptance.spec.ts
  - e2e/real-remote/
  - e2e/fixtures/
  - _ct-workorders/T0514-pre6-installed-ui-remote-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json` 不動）。發現產品缺陷 → 回報區記證據（步驟、預期 vs 實際、log 片段、截圖路徑），該項 FAIL、整單 PARTIAL，**不自行修**（由塔台開 BUG）。BUG 檔與 `_bug-tracker.md` 不動（塔台負責結案）。"
  - "🔴 **受測 build = 已安裝的 pre.6**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（FileVersion `0.6.0-pre.6`；`executablePath` 用正斜線），以 Playwright 起**隔離實例**（獨立 `--runtime` / userData）。"
  - "🔴 **不碰使用者正在用的 BAT**：不得關閉 / 重啟 / 對 port 9876 發 helper 連線；真實 `%APPDATA%\\BetterAgentTerminal\\` **只讀**。不得連線、停止或改動 WSL 內使用者的 bat-server（PID 381 / port 9877、`~/.local/bat-server`）。"
  - "🔴 **不得消耗 Claude token**：不開 Claude Agent session、不送 prompt。BUG-108 只驗附件讀檔路徑到送出前為止（附件出現在輸入區 / IPC 讀檔結果），不送訊息。"
  - "🔴 **Docker / WSL**：只建立、操作、刪除名稱前綴 `bat-t0514-` 且帶 label `bat.t0514=1` 的容器 / network / volume；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*` / `bat-t0510-*` / `bat-t0515-*`）；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network（image 可保留並列出）。"
  - "🔴 與 T0515 / T0516 並行：本單只新增上列 affects_files；共用 fixture 若要改，改成**新增**函式，不改既有簽章。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141），只跑本單 spec。commit 用精準 `git add` 或 `git commit --only`。"
---

# T0514 — pre.6 已安裝版自動化實機驗收（UI / 遠端路由線）

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化驗收（2026-10-14 第六十 session）。本單是三條並行線之一：**已安裝 pre.6 exe 的 UI 與遠端路由行為**。做法沿用 T0510：Playwright 驅動已安裝 exe 的隔離實例；需要遠端時用 T0467 的 headless bat-server 容器（`bat-t0514-*`）當 remote profile 目標。

每項請先讀對應 BUG 檔的「現象 / 預期 / 修正」與修正工單回報區的「需實機驗收」段，依那裡寫的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔為準） |
|---|---|---|
| U1 | BUG-113 | 本機 workspace detach → 新視窗正常載入、不顯示 `Workspace not found` |
| U2 | BUG-112 | 從 remote profile 視窗 detach 出的 workspace 視窗，proxied 呼叫（如 `pty:create` / `fs:*`）走遠端，不落本機 |
| U3 | BUG-110 | remote profile 視窗在連線中斷時，proxied channel 回錯誤（fail-closed），不在本機執行（停掉 / 斷開本單容器即可製造） |
| U4 | BUG-105 | 遠端視窗下 `claude:*` 的 cwd、`github:*`、`git-scaffold:*`、`worktree:create` 的路徑轉換正確（不啟動 Claude session；可驗 IPC 參數 / 遠端實際落點 / log） |
| U5 | BUG-096 | renderer 遠端重連帶 fingerprint；不會以未 pin 連線取代已驗證連線（可從 main log / 連線紀錄驗） |
| U6 | BUG-106 | `worktree:merge` 不再呼叫已移除的方法（在隔離 git repo 上走一次，無 `is not a function`） |
| U7 | BUG-107 | 拖放檔案取得路徑（Electron 41 `webUtils.getPathForFile`）。若 Playwright 無法產生帶真實路徑的 OS 拖放，改驗 preload 暴露的 API 對 `<input type=file>` 選到的 File 回傳正確路徑，並在回報區註明「OS 拖放手勢需真人」 |
| U8 | BUG-108 | Claude 面板圖片附件：本機工作區外的圖片可附加（不被 path guard 擋）；遠端視窗讀的是遠端檔案系統 |
| U9 | BUG-109 | `/snippet` prompt 內的 `snippets.json` 路徑為本機 OS 實際路徑（Windows 為 `%APPDATA%\BetterAgentTerminal\snippets.json` 形式），不是寫死的 macOS 路徑 |

每項結果標 PASS / FAIL / NEEDS-HUMAN（自動化做不到的部分），附證據（截圖 / log 片段 / 斷言輸出）。

## 驗證

- 新增 opt-in spec `e2e/pre6-ui-remote-acceptance.spec.ts`（環境變數 gate，例如 `BAT_E2E_PRE6_UI=1`，預設 skip，不影響一般 e2e）
- 執行該 spec，回報區附執行指令與結果
- 收尾：本單容器 / network 已刪、隔離 userData 已刪、Terminal Server 已結束；真實 userData 雜湊前後一致

## 驗收條件

- [x] U1-U9 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [x] 未改產品程式碼；未碰使用者 BAT / WSL bat-server
- [x] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、T0510 回報區（harness 經驗）、U1-U9 對應 BUG 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 執行 → 填回報區（DONE：全項有結論；PARTIAL：有 FAIL 或做不完）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**DONE**。U1-U9 全部有結論：**9 項 PASS，0 FAIL**；自動化做不到的手勢 / 系統剪貼簿 / 真 Claude session 部分列為 NEEDS-HUMAN（見各項與「仍需真人」）。最終一次完整執行（env up → spec → env down）：`9 passed (17.9s)`。

| # | BUG | 判定 | 主要證據 |
|---|---|---|---|
| U1 | BUG-113 | **PASS** | 本機 detach Beta → 新視窗 `?detached=<id>`、`.workspace-container.active` 可見、無「找不到工作區」；detached 終端執行 `echo T0514_U1_MARK""ER_OK` 回 `T0514_U1_MARKER_OK`；reattach 後 Beta 回主視窗側欄 |
| U2 | BUG-112 | **PASS** | 從 remote 視窗 detach 的視窗 `clientStatus.connected=true`（同 pin）；在其內 `pty.create({cwd:'C:\bat-t0514-virt\work'})` → shell 回 `T0514-U2-bat-t0514-srv-/work-212`；`fs.readdir` 列出容器限定的 `t0514-remote-marker.txt`；本機視窗 `pty.getCwd(<id>)` = `null` |
| U3 | BUG-110 | **PASS** | `docker stop bat-t0514-srv` → remote 與 detached remote 兩個視窗 `connected=false`；兩視窗各 5 個 proxied 呼叫（`pty:create` / `fs:readdir` / `git:log` / `claude:scan-skills` / `git-scaffold:healthCheck`）全部拒絕：`REMOTE_NOT_CONNECTED: remote profile t0514-remote-docker is not connected (reconnecting); <channel> was not run on this machine`；各收到 5 筆 `remote:invoke-refused`；本機 `pty.getCwd` = `null`（無本機 PTY） |
| U4 | BUG-105 | **PASS**（`claude:start-session` 端到端 NEEDS-HUMAN，見補充） | 全部以 client 路徑 `C:\bat-t0514-virt\work`（Windows 上不存在）呼叫，皆在容器 `/work` 執行：`claude:scan-skills` → `t0514-remote-skill`（project）；`claude:list-sessions` → 容器限定的 seeded session `5140d514-…5140`；`github:pr-list` / `issue-list` → 假 `gh` 回 `T0514-GH pwd=/work`（容器 gh log：`pwd=/work args=pr list --repo bat-t0514/fake-repo …`）；`git-scaffold:healthCheck` / `getRepoInfo` → `gitRoot: "C:\\bat-t0514-virt\\work"`（轉回 client）、`listCommits` → `T0514-REMOTE-MARKER commit`；`worktree:create(sessionId, cwd)` → 容器 `git worktree list` 出現 `/work/.bat-worktrees/t0514-wt`，remove 後消失 |
| U5 | BUG-096 | **PASS** | renderer initProfile 的 `remote:connect` 第 5 參數 = profile pin；main log `[remote:connect] reusing verified client for profile t0514-remote-docker`；錯 fingerprint → `fingerprint-mismatch` 拒絕、連線與 pin 不變；不帶 fingerprint → 以 pin 重用（回傳 fingerprint = pin，非 TOFU）；無 pin legacy profile / 錯 pin profile 開窗皆 `remote-unreachable`、不開視窗 |
| U6 | BUG-106 | **PASS** | 隔離 git repo：`worktree.create` 成功、`.bat-worktrees/t0514-wt` 出現；`typeof electronAPI.worktree.merge = undefined`；ipcMain 無 `worktree:merge` handler；隔離 RemoteServer 與容器 bat-server 送 `worktree:merge` 皆回 `invoke-error: No handler for channel: worktree:merge`；`worktree.remove` 成功、目錄消失；main log `is not a function` 0 行；pre.6 `dist-electron/main-CRDUhLQK.js` 內 `worktree:merge` 0 次 |
| U7 | BUG-107 | **PASS**（OS 拖放手勢 NEEDS-HUMAN） | `<input type=file>`（Playwright `setInputFiles`）選到的 File → `shell.getPathForFile` 回實際路徑（png / txt 兩檔逐字相同）；以這些 File 合成 `drop` 事件到 Claude 面板：txt 出現附件 chip（`title` = 完整 Windows 路徑；handler 只有取得路徑才會加入），本機與 remote 視窗皆同 |
| U8 | BUG-108 | **PASS**（貼上剪貼簿 NEEDS-HUMAN） | 工作區外 `%TEMP%\bat-t0514-outside-*\t0514-outside.png`：拖放 → 縮圖 `data:image/png;base64,<與檔案位元相同>`；`dialog:select-attachments`（stub picker）→ 同一 data URL；本機與 remote 視窗皆成功，期間 `image:read-as-data-url` 呼叫 0 次。對照：同路徑走預覽 channel，本機 `Path access denied`、remote 視窗（proxied 到容器）也失敗且容器無此目錄 ⇒ 附件由 client 讀取 |
| U9 | BUG-109 | **PASS**（判準依 BUG 檔，見偏差 1） | `/snippet T0514 snippet <ts>` 在本機與 remote Claude 面板送出，`claude:send-message` 被 recorder 攔下（未送 API）：prompt 以 `[BAT Snippets Context]` 開頭、含 snippet 標題與內容，**不含** `~/Library` / `Application Support` / `snippets.json` / `AppData` / `better-agent-terminal`。全文：`u9-snippet-prompt-{local,remote}.txt`；pre.6 renderer 68 個 chunk 中 `Library/Application Support/better-agent-terminal`、`snippets.json` 皆 0 次 |

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：`e2e/`、`e2e/real-remote/`、`e2e/fixtures/` 皆存在（informational）。C-2：無 `branch` 欄位，HEAD `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 做法

- **受測 build**：已安裝 `C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（`app.getVersion()` = `0.6.0-pre.6`），經 `e2e/fixtures/electron-isolation.ts` 既有的 `BAT_E2E_EXECUTABLE`（T0510）起隔離實例（`--runtime=e2e-t0514-<ts>`、獨立 userData、RemoteServer 空閒埠）。fixture **未修改**。
- **遠端目標**：WSL Docker 容器 `bat-t0514-srv`（label `bat.t0514=1`），內容為已安裝 BAT 內建的 `resources\bat-server-baseline\bat-server-linux-x64-v0.6.0-pre.6.tar.gz`（manifest sha256 `d1dd8d3a9869…`，容器內 `package.json` version `0.6.0-pre.6`），**無 source overlay**。容器內 `--bind-interface all` 於 9876，對 Windows 只發佈 `127.0.0.1:29514`。profile = `type: remote` + `targetOS: docker-linux` + `dockerMounts [{ host: 'C:\bat-t0514-virt\work', container: '/work' }]` + pinned fingerprint。client 路徑在 Windows 上不存在，任何落到本機的呼叫都拿不到容器 marker（commit、檔案、skill、seeded session、假 gh 的 `$PWD`）。
- **不耗 token**：在隔離實例 main 行程內（`app.evaluate`，僅測試側）把 37 個 `claude:*` ipcMain handler 換成 recorder（start / resume / send / models / account / auth / cli-path / detectRuntime …），只保留唯讀掃描 `claude:scan-skills` / `list-sessions` / `scan-star-commands` 與 archive 三個為真。執行期間 recorder 只收到 `auth-status` / `start-session` / `get-session-meta` / `get-statusline-extras` / `send-message`。`remote:connect` / `image:read-as-data-url` / `pty:create` 以 pass-through recorder 包裝（記錄 renderer 實際送出的參數後呼叫原 handler）。`dialog.showMessageBox` / `showOpenDialog` 在隔離實例內 stub。

### 改動檔案

```
 _ct-workorders/T0514-…md                    | metadata + 回報區
 e2e/pre6-ui-remote-acceptance.spec.ts       | 786 新增（U1-U9，BAT_E2E_PRE6_UI=1，預設 skip）
 e2e/real-remote/t0514-env.mjs               | 260 新增（up / status / down [--rmi]）
 e2e/real-remote/t0514-server.Dockerfile     |  50 新增（debian bookworm + git + pre.6 baseline bundle + /work markers + 假 gh）
```

未改 `electron/**` / `src/**` / `scripts/**` / `package.json` / `e2e/fixtures/**`（`t0514-env.mjs` 只 import `scripts/smoke-remote-headless.mjs` 的 `decodeTokenFile` / `normalizeFingerprint` / `parseFingerprintField`）。工作樹原有的 `src/styles/settings.css` 修改不屬本單，未動、未提交。

### 執行方式與結果

```powershell
node e2e/real-remote/t0514-env.mjs up        # 約 55 s（首次 build）；寫 %TEMP%\bat-t0514\connection.json
$env:BAT_E2E_PRE6_UI='1'; $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
npx playwright test e2e/pre6-ui-remote-acceptance.spec.ts     # 約 18 s；U3 會 docker stop 容器，重跑前先 up
node e2e/real-remote/t0514-env.mjs down      # 刪容器與 state（保留 evidence/）；--rmi 連 image 一起刪
```

- 最終執行（2026-10-14T04:00:03+0800 起）：`ok 1-9`、`9 passed (17.9s)`，exit 0。開發期另跑 4 次：run1-3 失敗皆為 spec 自身問題（auth stub 回 `loggedIn:false` 觸發登入引導、Esc 會清空輸入框、`pty:get-cwd` 回傳本就轉回 client 形式），run4 `9 passed`；皆非產品問題。
- 未設 env：`npx playwright test e2e/pre6-ui-remote-acceptance.spec.ts` → `9 skipped`。
- 證據（`%TEMP%\bat-t0514\evidence\`）：`final-run.log`、`env-up.log`、`env-down.log`、`instance-debug-20261014-040004.log`（隔離實例 main log）、`u1-local-detached.png`、`u2-remote-detached.png`、`u3-remote-window.png`、`u3-detached-remote-window.png`、`u4-remote-window.png`、`u7-u8-local-drop.png`、`u8-remote-attachments.png`、`u9-local-snippet.png`、`u9-snippet-prompt-{local,remote}.txt`、`userdata-{before,after}.txt`。

### 各項補充

- **U4 `claude:start-session` / `resume-session` cwd**：recorder 攔在 ipcMain，位置在 RemoteClient 路徑轉換之前，所以 recorder 看到 client 形式（`cwd: "C:\\bat-t0514-virt\\work"`，符合預期），**端到端轉換未實跑**（實跑 = 在容器啟動 Claude session，違反不耗 token 規則）。替代證據：同一條轉換路徑（`translateInvokeArgs` + `PATH_ARG_SCHEMA`）上的 `claude:scan-skills` / `list-sessions` / `worktree:create` 已實證；已安裝 pre.6 `dist-electron/main-CRDUhLQK.js` 含 `"claude:start-session":{kind:"object-fields",index:1,fields:["cwd","worktreePath"]}`、`"claude:resume-session":{kind:"arg-indices",indices:[2,6]}`、`"worktree:create":{kind:"arg-indices",indices:[1]}`。→ NEEDS-HUMAN。
- **U4 回傳形式**：`pty:get-cwd`、`git-scaffold:*` 的 `gitRoot` 轉回 client 形式；`worktree:create` 回 `worktreePath: "/work/.bat-worktrees/t0514-wt"`（server 形式），兩者皆與 `PATH_RETURNING_CHANNELS` / `SERVER_PATH_RESULT_CHANNELS` 的設計一致。
- **U4 對照**：同一 client 路徑在本機視窗 `git.getLog` → `[]`、`claude.scanSkills` 不含 `t0514-remote-skill`（只列使用者 `~/.claude` 的 global skill，唯讀）。
- **U5 失敗對話框**（stub 記錄）：`Remote profile not trusted` / `Cannot authenticate to remote profile "T0514 legacy (no pin)"` … `Error: Profile has no pinned server fingerprint (legacy setup)`；`"T0514 wrong pin"` … `Error: Server fingerprint does not match the pinned value`；main log `[profile] remote profile t0514-legacy-no-pin is missing remoteFingerprint — refusing to connect`、`[profile] remote connect failed for profile t0514-wrong-pin … [trust/fingerprint-mismatch]`。
- **U7**：Sidebar 拖放（BUG-107 修正的另一呼叫端）未覆蓋；Codex 面板未開（同一 preload API）。
- **U8 貼上**：`clipboard:read-image-data-url` 需寫入**系統剪貼簿**（與使用者共用），刻意不碰 → NEEDS-HUMAN。

### 環境清理

- 容器：`docker ps -a --filter label=bat.t0514=1` 空；network / volume（label `bat.t0514=1`）皆無。image `bat-t0514-srv:local`（`0a67e21d2bf6`，2.48GB）**保留**供重跑（`down --rmi` 可刪）。未動 `bat-t0467-*` / `bat-t0510-*` / `bat-t0515-*` 與其他 image / 容器；未 `docker system prune`、未 `wsl --shutdown` / `--terminate`。
- 隔離實例：5 次執行的 `BetterAgentTerminal-runtime-e2e-t0514-*` 皆已刪（`%APPDATA%` 下無殘留）；每次 Terminal Server `alive after teardown: false`；temp repo / outside 目錄皆刪。
- 使用者 BAT：pid 46040 等（StartTime 2026-10-14 03:20:37）全程未關閉 / 重啟；從未連 9876；未連線、停止或改動 WSL bat-server（9877）。
- **真實 userData 雜湊（偏差 2）**：`%APPDATA%\BetterAgentTerminal\`（不含 Logs / Crashes，唯讀 sha256）前後比對，`settings.json`、`server-cert.json`、`server-token.json`、`Local State` 等相同；**不同的 6 個**：`windows.json`、`profiles/default.json`、`profiles/index.json`、`profiles/index.json.bak`、`bat-pty-registry.json`、`ct-drift.log`。判定為使用者執行中的 BAT 與塔台自身寫入：6 檔皆無 `t0514` 字樣；`profiles/index.json` 仍只有 `default` / `wsl-ubuntu-24-04`，`default.updatedAt` = 1791921638799（20:00:38Z，晚於本單最終執行結束），mtime 04:00:38；`ct-drift.log` 末行為 20:00:31Z 的塔台 drift 掃描。前後清單見 evidence。

### 偏差

1. **U9 判準**：工單表寫「`snippets.json` 路徑為本機 OS 實際路徑」，但 BUG-109 修正（T0441）是**完全移除路徑**、改注入 snippet 內容（理由：BAT 只在啟動時讀一次 `snippets.json`，agent 改檔無效）。依工單「以 BUG 檔為準」，判準改為「prompt 含 snippet 內容、不含任何 snippets 路徑」。
2. **真實 userData「雜湊前後一致」**不成立也無法成立：使用者的 BAT 在執行中（30 秒 autosave 等），改以「變動檔無本單痕跡 + 寫入者為使用者 BAT / 塔台」判定，見上。
3. `claude:*` 以 recorder 取代屬「隔離實例 main 行程內的測試側攔截」，非產品修改；因此 U4 的 start-session 端到端與「Claude 實際收到的訊息」不在本單驗證範圍。

### 其他觀察（非本單 BUG，供塔台參考，未修）

- `claude:scan-skills` 掃 `.claude/commands/*.md` 時以檔案第一行當 description（`electron/handlers/claude.ts:297`），帶 YAML frontmatter 的 command 會顯示成 `"---"`（本單 `t0514-remote-skill` 實測 `description: "---"`）；同檔 skills 分支（:328-347）有解析 frontmatter。屬既有行為，與 BUG-105 無關。

### 仍需真人

1. **OS 拖放手勢**（BUG-107）：從檔案總管把檔案拖到 Claude 面板 / Sidebar（本單以 real-path File 合成 drop 事件驗證 handler 與 `webUtils` 路徑，未驗 OS 手勢本身；Sidebar 未覆蓋）
2. **貼上圖片**（BUG-108）：截圖後在 Claude 面板 Ctrl+V（本機 + 遠端視窗）
3. **Claude session 實跑**（BUG-105 / 108 / 109）：遠端視窗開 Claude 面板讓 agent 執行 `pwd`（應為遠端路徑）、附圖送出、`/snippet` 送出後 agent 的回應
4. 真實 WSL / SSH 主機上的 U2 / U3（本單以 docker-linux profile 驗證路由邏輯；路由與 targetOS 無關，但 SSH tunnel 斷線時序未涵蓋）

### 驗收條件對照

- [x] U1-U9 各有 PASS / FAIL / NEEDS-HUMAN 與證據（9 PASS，部分子項 NEEDS-HUMAN）
- [x] 未改產品程式碼；未碰使用者 BAT / WSL bat-server
- [x] 環境清理完成（image 保留並列出）

### Commit

- `git add` 3 個新檔 + `git commit --only` 本單 4 個檔案；不 push。hash 見 `git log`（本回報寫於 commit 前）。

