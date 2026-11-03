---
schema_version: 1
schema_kind: workorder
id: T0816
title: "Linux：Terminal Server 的 fork 改經 fd guard——只留 IPC 與 AppImage keepalive（fd 4）、不當 crashpad client（PLAN-062 方案 A3、BUG-209）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
isolation: worktree
created_at: "2026-11-03T22:19:09+0800"
started_at: "2026-11-03T22:20:53+08:00"
updated_at: "2026-11-04T00:01:58+08:00"
completed_at: "2026-11-04T00:01:58+08:00"
session_ids:
  - "73f9dc6a-325e-49ad-be33-1262b711bccd"
depends_on: []
related:
  - "PLAN-062；BUG-209；D260；T0812 回報區（〈2〉成因、〈3〉比較表、〈5〉實作工單草案）；T0807（`electron/child-process-fd-guard.ts`、`runWithoutChildProcessFdGuard`）；T0806（`guardPtySpawnFds`）；T0704（recovery re-fork）；T0578（Recovery 提示）；CLAUDE.md「Linux child_process 子程序只保留 stdio」「Terminal Server 存活判定與 recovery」節；`docs/agent-guide/linux-pty-fd-inheritance.md`"
affects_files:
  - electron/main.ts
  - electron/child-process-fd-guard.ts
  - "electron/appimage-keepalive.ts（新增）"
  - "electron/__tests__/child-process-fd-guard*.test.ts"
  - "electron/__tests__/appimage-keepalive.test.ts（新增）"
  - "electron/__tests__/**（本單相關的 source guard / 既有測試調整）"
  - "e2e/linux/**（新 spec 或擴充 t0807）"
  - ".github/workflows/linux-acceptance.yml（只在需要新 step 時）"
  - CLAUDE.md
  - docs/agent-guide/linux-pty-fd-inheritance.md
  - "docs/agent-guide/terminal-server-recovery.md（只在需要記一句時）"
  - _ct-workorders/T0816-linux-terminal-server-fork-fd-guard.md
renew_count: 0
workdir: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍以 T0812〈5〉實作工單草案為準（必守規則逐條照做）：主行程兩個 Terminal Server fork 點（`electron/main.ts` 約 `:418` / `:479`）收成一個 helper（例 `forkTerminalServer`），拿掉 `runWithoutChildProcessFdGuard`；fd guard 加範圍旗標（例 `runWithoutCrashpadClient(fn)`：該次 spawn 從 envPairs 去掉 `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID`，guard 因此不保留那個 fd；可巢狀、例外後還原）；新增 `findAppImageKeepaliveFd`（只在 `process.env.APPIMAGE` 有值時，找出主行程持有、另一端在 `exe === APPIMAGE` 程序手上的 pipe fd；找不到回 null）；fork 的 stdio：有 keepalive → `['ignore','ignore','ignore','ipc', <keepalive fd>]`，沒有 → `['ignore','ignore','ignore','ipc']`（🔴 不得用 `'ignore'` 佔第 5 格）；server 的 fd 只剩 0–3（＋keepalive 時 4）、env 沒有兩個 crashpad 變數；T0704 re-fork 走同一個 helper；keepalive 偵測失敗 → 照舊啟動、記一行 `[terminal-server]` debug log、不丟例外。"
  - "🔴 只有 Linux：Windows / macOS 的 fork 參數、env、日誌完全不變（單元測試守住）；Windows 的同類現象（server 繼承主行程 std handle）只寫進文件、不修；headless 不受影響（bat-server 不 fork Terminal Server）。Terminal Server 不再是 crashpad client（T0812 實測目前本來就不產生 dump），文件寫明。T0806 `guardPtySpawnFds`、T0807 安裝點規則不變。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；單元（範圍旗標去掉兩個 env pair 且不保留該 fd、巢狀與例外還原；keepalive 偵測以假 /proc 涵蓋有 / 沒有 APPIMAGE、多個 pipe、讀取失敗；非 Linux 不變）＋突變檢查。Linux 驗收（AppImage、隔離 runtime、只開 shell 分頁）K1–K5：K1 保留 server 離開後主行程 fd 1 / 2 的 inode 無持有者（以 /proc 判定或 `bash -c 'out=$(…)'` 計時 ≤ 10 s；🔴 不要拿 Playwright `app.close()` 計時，FUSE 持有 Playwright 的 fd 3 / 4）；K2 server 的 fd 只有 0–4、env 無兩個 crashpad 變數名稱、`ss` 找不到對端是 crashpad 的 socket；K3 一般啟動時主行程結束後 `/proc/mounts` 仍有該 mount、讀 `/proc/<server>/exe` 後段不出錯；K4 重開同一 runtime 出現 Recovery 提示、按「還原」後原 shell 能執行指令；K5 renderer `Page.crash` 仍產生 `pending/*.dmp`；T0806 F1–F6、T0807 G1–G3（含 T0810 的 AppImage 對照組）不回歸。"
  - "🔴 CI 驗證（已授權）：push 分支 `ct/T0816`（只限這個分支；不得 push `main`），`gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=ct/T0816` 打 AppImage，再 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0816 -f build_run_id=<desktop-build run id>`，必要時迭代；最後一次 run id 與 22.04 / 24.04 結果寫進回報區；驗完 `git push origin --delete ct/T0816`。所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）。本機 WSL 可先試跑（`electron-builder --linux` 或 desktop-build artifact），WSL 使用者的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.claude`、`~/.codex`、原本在跑的 bat-server 不改不停；🔴 L185：不開 agent 分頁、不送按鍵、不登入。"
  - "🔴 worktree：依 ct-exec § Worktree Isolation（工單寫回主 checkout、在 worktree 自行安裝依賴）。CLAUDE.md 只改「Linux child_process 子程序只保留 stdio」節（T0815 在主 checkout 改其他節，合併由塔台處理）。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push `main`。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0816 — Linux：Terminal Server 的 fork 改經 fd guard（PLAN-062 A3、BUG-209）

## 元資料

- **工單編號**：T0816
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T22:19:09+0800
- **預估規模**：M
- **隔離**：worktree（與 T0815 並行）

## 背景

T0812（研究，`v0.7.4-pre.4`）：Linux 上 Terminal Server 是 crashpad client（Electron 在 `ELECTRON_RUN_AS_NODE` 的 fork 自動加 crashpad env 與 fd），crashpad handler 持有主行程 stdout / stderr，所以保留 server 離開時 `out=$(…)`、`| tee` 會等到 server 結束（PLAN-062）。方案 A3（fork 經 fd guard、只留 IPC 與 keepalive）實測 `out=$(…)` 908 ms 返回，dump 無損失（目前 server 本來就不產生 dump），T0704 recovery 與 T0578 Recovery 提示正常。同時修好 BUG-209（一般啟動時 keepalive fd 3 被 IPC 蓋掉，server 沒持有 keepalive → mount 被卸載）。使用者 2026-11-03 裁示實作（D260）。

## 範圍

見 memory_overrides；細節以 T0812 回報區〈5〉草案為準。

## 不做

- Windows / macOS、Playwright＋AppImage 的 `app.close()`（FUSE 持有 Playwright 額外傳入的 fd，不可控）、Linux node 模式子程序不產生 dump 的原因查證、發版、push `main`。

## 驗收

- [ ] 實作說明（helper、範圍旗標、keepalive 偵測、stdio 配置、非 Linux 不變的證據）
- [ ] 單元＋突變檢查
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] linux-acceptance（`--ref ct/T0816`）最後一次 run：K1–K5、T0806 F1–F6、T0807 G1–G3，22.04 / 24.04
- [ ] 文件更新（CLAUDE.md 該節、docs）
- [ ] 遠端 `ct/T0816` 已刪、worktree head SHA

---

## 回報區

<!-- Worker 由此往下寫 -->

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-04T00:01:58+08:00
- **session_id**：73f9dc6a-325e-49ad-be33-1262b711bccd
- 摘要：Linux 上 Terminal Server 的 fork 收成單一 `forkTerminalServer`，經 child_process fd guard 且不當 crashpad client；server 繼承的 fd 只剩 0–3（IPC）＋AppImage keepalive（fd 4）。PLAN-062（保留 server 離開時 `out=$(…)` / `| tee` 等到 server 結束）與 BUG-209（一般啟動時 mount 被卸載）一起修好。linux-acceptance 最後一輪 22.04 / 24.04 全綠（K1–K5、F1–F6、G1–G3）。

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`affects_files` 可測項都有既存祖先（`electron/`、`e2e/linux/`、`docs/agent-guide/`）→ PASS（資訊性）
- C-2：工單沒有 `branch` 欄位 → 不適用
- `CT_HOME`：主 checkout；`CT_WORKTREE_BRANCH`：`ct/T0816`；`BAT_WORKSPACE_ID`：已設定（只記證據）；`CT_MODE` = yolo、`CT_INTERACTIVE` = 0；`BAT_REMOTE_TOKEN`：已設定

### 實作說明

| 項目 | 內容 |
|---|---|
| helper | `electron/main.ts` `forkTerminalServer(serverScript, userDataPath)`：唯一的 `fork(serverScript…)`；`startTerminalServer` 與 T0704 `reforkTerminalServer` 都呼叫它，main.ts 不再用 `runWithoutChildProcessFdGuard`。讀 settings、組 env（`terminalServerInheritedEnv()` 不變）、`stdio: plan.stdio`，整個 fork 包在 `runWithoutCrashpadClient`。 |
| 範圍旗標 | `electron/child-process-fd-guard.ts`：`ChildSpawnRequest.withoutCrashpadClient`、`CRASHPAD_CLIENT_ENV_KEYS`；`guardChildSpawn` 包裝時從 envPairs 去掉兩個變數（每一筆，含 Electron 追加在後面的那筆），所以保留的 crash fd（`extra`）為空。`runWithoutCrashpadClient(fn)` 以深度計數、`finally` 還原（可巢狀、例外後還原），在 `guardCall` 傳給 async / sync 兩個 binding。`runWithoutChildProcessFdGuard` 保留（測試反向對照用，文件註明已無產品呼叫端）。 |
| keepalive 偵測 | 新檔 `electron/appimage-keepalive.ts`：`findAppImageKeepaliveFd(deps)` 只在 `APPIMAGE` 有值時讀 /proc；取本行程 fd ≥ 3 的 pipe，比對 `/proc/<pid>/exe` = `APPIMAGE`（或其 realpath，去掉 ` (deleted)`，排除自己）的程序持有同一 pipe inode **且存取模式不同**（排除啟動方傳入、兩邊共用同一 file description 的 pipe）。0 個 → `not-found`、多個 → `ambiguous`、讀取失敗 → `error`，不丟例外。`planTerminalServerFork(platform, find)`：非 Linux 回原 stdio、不查、不記；Linux 有 keepalive → `['ignore','ignore','ignore','ipc', fd]`，沒有 → 4 格（不用 `'ignore'` 佔第 5 格），一行 `[terminal-server] fork (Linux, PLAN-062 A3): …` debug log。 |
| 非 Linux 不變的證據 | `planTerminalServerFork('win32' / 'darwin')` = `{ stdio: ['ignore','ignore','ignore','ipc'], keepaliveFd: null, log: null }` 且不呼叫 lookup（單元測試＋突變 M7）；guard 在非 Linux 不安裝（既有測試），`runWithoutCrashpadClient` 只是計數器、不碰 binding；fork 的 `detached` / env 組法與修改前逐字相同。 |
| 實機量到的 server | 22.04 / 24.04、Playwright 啟動與一般啟動：server fd ≥ 3 中與主行程共用的只有 fd 4 的 keepalive（主行程 fd 5 / fd 3）；server 不設 CLOEXEC 的 fd 只剩 Electron node 模式自己開的 V8 snapshot、eventpoll、eventfd、app.asar。T0807 G3 量到 server 不設 CLOEXEC 的 fd 從修改前 ≥ 10 個降到 5 個（含自己的 pty master）。 |

### 變更檔案

- `electron/main.ts`、`electron/child-process-fd-guard.ts`、`electron/appimage-keepalive.ts`（新增）
- 測試：`electron/__tests__/appimage-keepalive.test.ts`（新增）、`child-process-fd-guard.test.ts`、`child-process-fd-guard-linux.test.ts`、`local-helper-capability.test.ts`、`helper-capability-persist.test.ts`（T0576 source guard 原本找 `fork(serverScript`，改找 `forkTerminalServer(serverScript`，意義不變）
- e2e：`e2e/linux/t0816-terminal-server-fork.spec.ts`（新增）、`t0807-child-process-fds.spec.ts`（G3 判準、G2 對照組等待）、`t0806-pty-fd-inheritance.spec.ts`（取樣穩定化，見〈遭遇問題〉）
- 文件：`CLAUDE.md`「Linux child_process 子程序只保留 stdio」節（只改這一節）、`docs/agent-guide/linux-pty-fd-inheritance.md`（新章「Terminal Server 的 fork」，並更新既有段落）、`docs/agent-guide/terminal-server-recovery.md`（re-fork 那一列補一句）
- `.github/workflows/linux-acceptance.yml`：未改（`npx playwright test e2e/linux/` 自動收新 spec，報告寫進 `LINUX_REPORT_DIR`，隨 artifact 上傳）

### 驗收結果

**本機（Windows，worktree，`npm ci` 安裝依賴）**

| 閘門 | 結果 |
|---|---|
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0） |
| `npx vite build` | PASS |
| `npm run test:unit` | 第一次 1 failed（`helper-capability-persist.test.ts` 的 T0576 source guard 找 `fork(serverScript`）；改 guard 後重跑 PASS：400 files / 7013 passed / 38 skipped |
| `npm run test:legacy` | PASS（exit 0） |
| desktop-build `tests` / `typecheck` job（ubuntu-24.04，含 Linux 實測 `child-process-fd-guard-linux.test.ts` 新增的 fork 形狀測試） | PASS（run 41655736852） |

**突變檢查**（scratchpad 腳本逐一改產品碼、跑 4 個測試檔、還原；10 / 10 被抓到）：M1 不過濾 env、M2 async binding 不傳旗標、M3 深度不還原、M4 第 5 格放 `'ignore'`、M5 接受同存取模式的 pipe、M6 stdio fd 也算、M7 非 Linux 也查 keepalive、M8 main.ts 改回 `runWithoutChildProcessFdGuard`、M9 main.ts 寫死 4 格 stdio、M10 不排除自己的 pid。

**linux-acceptance（`--ref ct/T0816`；AppImage = desktop-build run 41655736852，`commit: 24eb000c`，`0.0.0-exp.6`）**

最後一輪 run **41667030155**（spec 在 `69093e41`）：ubuntu-22.04 success、ubuntu-24.04 success。

| 項目 | 22.04 | 24.04 | 證據 |
|---|---|---|---|
| K1 保留 server 離開：主行程 stdout 無其他持有者、`out=$(…)` ≤ 10 s | PASS | PASS | 主行程結束 2 s 後，主行程 stdout `pipe:[…]` 除讀取的 bash 外沒有持有者，crashpad handler 已結束；`out=$(…)` 在偵測主行程結束的取樣粒度（100 ms）內返回（記錄值 −10 ms）；server 與 shell 仍在 |
| K2 server 繼承 fd 只剩 0–3＋fd 4、無 crashpad env、無連到 crashpad 的 socket | PASS | PASS | Playwright 啟動 `keepalive fd 5 → 4`、一般啟動 `keepalive fd 3 → 4`（debug log 與 /proc 一致，FUSE runtime 持有另一端）；environ 沒有 `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID`；`ss -xapn`：server 1 個 unix socket，對端不是 crashpad |
| K3 一般啟動、主行程結束後 mount 仍在、`/proc/<server>/exe` 後段可讀 | PASS | PASS | mount present；讀回 65536 bytes（offset 234401096 / 234466632） |
| K4 重開同 runtime → Recovery「還原」→ 原 shell 執行指令 | PASS | PASS | server pid 不變，shell 寫出 `t0816-42` |
| K5 renderer `Page.crash` → `Crashes/pending/*.dmp` | PASS | PASS | before 0 → after 1 |
| T0806 F1–F6 | PASS | PASS | 22.04 F1：shell B 的 `3=/etc/init.d` 判為暫時 fd（5 s 內關閉） |
| T0807 G1–G3 | PASS | PASS | G3 的 server 數字只記錄（5 個） |
| T0797（同批）L1 / L2 / V1 / W1 | PASS / PASS / PASS / INFO | WARN / PASS / PASS / PASS | 與本單無關的既有結果（24.04 L1 WARN = BUG-202 sandbox 自動降級；22.04 W1 = BUG-203） |

前三輪（41657515259、41661353142、41664258284）的失敗都在 spec，三輪的產品行為一致，見〈遭遇問題〉。

### 相關功能不回歸判定

- Windows / macOS：fork 參數與日誌不變（單元測試守住）；沒有實機跑（本單不做）。
- headless：bat-server 不 fork Terminal Server，未改。
- T0806 `guardPtySpawnFds`、T0807 安裝點：未改；F1–F6、G1–G3 最後一輪兩版 PASS。
- T0704 recovery（F4）、T0578 Recovery 提示（F6、K4）：PASS。

### 遭遇問題

1. **第一輪（41657515259）**：t0816 spec 用 Node inspector `Runtime.evaluate('process.pid')` 拿主行程 pid，Electron 主行程回 `{"type":"undefined"}`（原因未查；同一條連線送的關閉確認 mock 與 `app.quit()` 照常生效），K1 / K2 一般啟動因此缺 pid。改成以 /proc 命令列（含 `--runtime=` 與 `--inspect=`、不含 `--type=`、exe 不是 AppImage 或 bash）找主行程，inspector 回傳值只記證據。同一輪 K5 `await cdp.send('Page.crash')` 一直沒有回應，測試卡到 12 分鐘逾時 → 改成不等回應。
2. **第二輪（41661353142）**：24.04 T0806 F4 FAIL，但證據列出的 fd 是乾淨的 0–2：判定與證據各讀一次 /proc，判定那一刻 bash 還在 source login profile。→ 等 fd 255 出現再判，判定與證據共用一份快照。
3. **第三輪（41664258284）**：22.04 T0806 F1 shell B 有 `3=/etc/init.d`（profile 正在列目錄，fd 255 已開）；24.04 T0807 G2 的對照組（乾淨啟動的同一執行檔）在 1.5 s 時還沒開自己的 V8 snapshot / eventpoll / eventfd，子程序自己開的這三個 fd 因此被當成外漏（子程序實際上只多了允許的 `CRASHDUMP_SIGNAL_FD`）。→ T0806 只計 5 s 內沒關掉的額外 fd（繼承的 fd 不會自己關）；T0807 的對照組等 V8 snapshot 映射後再取樣。兩者都是既有 spec 的取樣競態，與 Terminal Server fork 無關（同一個 AppImage 在前兩輪這兩項都 PASS）。
4. 本機一次 `cat > 檔案` 沒有輸入、卡在 stdin，工具逾時後以 TaskStop 停掉；當時 main.ts 還沒被改，之後改用 scratchpad 腳本。
5. Tower Addenda Check：節點 1（驗證前）與節點 2（產品 commit 前）沒有在當下執行，是在產品 commit 後、push 前補跑；節點 3（回報前）照常執行。三次都沒有新段落。

### 塔台後續建議（不在本單範圍）

- `docs/agent-guide/README.md` 索引那一列可補「Terminal Server 的 fork（T0816）」；README 不在本單 `affects_files`，沒有改。
- Electron 主行程 inspector `Runtime.evaluate('process.pid')` 回 `undefined` 的原因沒有查（只影響測試做法）。
- T0812〈其他觀察〉3：其他活得比主行程久的 `ELECTRON_RUN_AS_NODE` 子程序仍保留 crash fd（設計如此，已寫進文件的已知限制）。

### Worktree / Commit

- `branch`：`ct/T0816`
- `base_sha`：`685bb3d756bf8a8d6bd69fd5c0d437d190e35a4c`
- `validated_sha`：`24eb000c7240032be8a9bfe33fdf600f8ecf20d3`（本機閘門：typecheck ×2、vite build、unit、legacy、突變；unit 的修正在 commit 前完成，重跑通過後才 commit）；linux-acceptance 最後一輪在 `69093e41`
- `head_sha`：`69093e41050d8494281506231e377bfa9bb961fa`
- `validated_sha` ≠ `head_sha` 的原因：`24eb000c` 之後的 4 個 commit（`a62b1c50`、`b62e822d`、`f53c420e`、`69093e41`）只改 `e2e/linux/*.spec.ts`。這些檔案不在 typecheck / unit / legacy / vite build 的範圍（vitest 不收 e2e，`tsconfig` 不含 e2e；改過的 spec 另以 `tsc --noEmit` 單檔檢查為 0 錯誤），並由最後一輪 linux-acceptance 在 `69093e41` 上驗過；AppImage 的產品碼仍是 `24eb000c`。
- 產品 commit：`24eb000c` fix(linux)…；`a62b1c50`、`b62e822d`、`f53c420e`、`69093e41` test(e2e)…
- push：只 push `ct/T0816`（工單授權的 CI 驗證）。驗完已 `git push origin --delete ct/T0816`，`git ls-remote --heads origin ct/T0816` = 0 筆。沒有 push `main`，沒有發版。
- worktree `git status --porcelain` 為空。沒有用 `git stash` / `reset` / `checkout --` / `restore`。

### 互動紀錄

- [22:20] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；落點 PASS；讀 T0812 回報〈2〉〈3〉〈5〉、`child-process-fd-guard.ts`、`main.ts` fork 點、既有 Linux e2e 與 linux-acceptance.yml。
- [22:22] worktree `npm ci`（npm 12，`electron-winstaller` 的 install script 照預期被擋）。
- [22:30–22:50] 實作、單元測試、Linux 實測測試、e2e spec、文件。
- [22:52–23:00] 本機閘門；unit 有 1 筆 source guard 失敗 → 修正後重跑 PASS；突變 10 / 10。
- [23:02] commit `24eb000c`、push `ct/T0816`、desktop-build 41655736852（全綠）。
- [23:30–00:00] linux-acceptance 四輪（41657515259、41661353142、41664258284、41667030155）；前三輪的 spec 修正見〈遭遇問題〉，第四輪兩版全綠；刪除遠端分支。
- 沒有向塔台提問。

### 子代理與 Workflow 使用

本單沒有使用子代理或 Workflow。

### 方法論執行紀錄

- **methodology_ambient**：none
- 本單沒有 `methodology` 欄位與 `### 方法論邊界`，也沒有呼叫方法論 skill。
