# Windows PTY holder：整體架構（PLAN-065，D286）

> 本檔是 PLAN-065 的總覽與入口：架構、位置、協定摘要、安裝 / 解除安裝 / 升級 / 降級的動作順序、已知限制、驗證清單。
> 細節在各工單的 docs，本檔不重複契約表：
> 協定 v1 與「從 PTY holder 啟動」→ [terminal-server-recovery.md](terminal-server-recovery.md)；打包與安裝程式複製 →
> [packaging-release-checks.md](packaging-release-checks.md)「Windows PTY holder 打包」；升級保留 holder、解除安裝、接回、不相容、換新 →
> [upgrade-interruption.md](upgrade-interruption.md)「holder 版」兩節；Recovery 提示期間的 create hold → [recovery-create-hold.md](recovery-create-hold.md)。

## 用途

Windows 的 NSIS 安裝程式在覆蓋安裝前結束 `$INSTDIR` 底下的所有程序（`Path.StartsWith('$INSTDIR')`）。T0857 前持有 ConPTY 的
Terminal Server 是 `BetterAgentTerminal.exe` 以 node 模式執行，所以每次升級都把所有分頁的 shell、長命令與 agent 一起結束
（T0820 實測）。PLAN-065 讓持有 ConPTY 的程序（PTY holder）從**安裝目錄外**執行：升級只結束 BAT 主行程，shell 與 PTY 留在 holder，
新版第一次啟動直接接回（不跳 Recovery 提示）。

## 架構

| 元件 | 位置 | 說明 | 工單 |
|---|---|---|---|
| holder 套件 | `$INSTDIR\resources\pty-holder\` | 官方 Node.js `node.exe` 改名 `bat-pty-holder.exe`（OpenJS 簽章）、打包的 `terminal-server.js`、node-pty 的 win32 檔、Node `LICENSE`、`holder-manifest.json`（每檔 `path` / `size` / `sha256`）。安裝目錄這份是 BAT 驗證時的**預期值**，所以保留 | T0858 / T0859 |
| holder 根目錄 | per-user `%LOCALAPPDATA%\BAT-PtyHolder\<key>`；per-machine `%ProgramFiles%\BAT-PtyHolder\<key>` | 安裝程式 `customInstall` 依 `$installMode` 複製；`<key>` = `<Node 版本>-<12 hex>`（內容雜湊），內容不變的升級不複製 | T0858 |
| Terminal Server | holder 的 `bat-pty-holder.exe terminal-server.js`，`cwd` = holder 目錄 | 主行程 `forkTerminalServer` 驗證通過才從 holder 啟動（win32 ＋打包版＋ NSIS 安裝＋重算雜湊相符），否則照舊 fork | T0859 |
| 協定 v1 | TCP：第一個請求 `server:hello`（權杖 `<userData>/bat-pty-server.token`） | 版本協商、未認證關閉、`server:extendIdle`、不認得的請求回 `error` | T0857 |
| 安裝程式 | `build/installer.nsh` | `customCheckAppRunning`（請 BAT 正常結束）、`customInstall`（標記、複製 holder、清理沒在用的 key）、`customUnInstall`（真的解除安裝才停 holder、刪根目錄） | T0823 / T0858 / T0860 |
| 升級時的 quit | `electron/installer-quit-request.ts` | 有 holder：延長 idle 24 h、結束分頁樹中安裝目錄下的程序（內嵌 claude / codex）、寫紀錄 schema 2、不停 server | T0860 |
| 升級後接回 | `startTerminalServer`（`electron/main.ts`）＋`decideHolderReattach`（`electron/upgrade-interruption.ts`） | 條件全成立 → 不跳 Recovery 提示、走「保留」同一段程式；toast「已接回 N 個終端」；不相容 → 結束並說明；0 個 PTY 的舊版 → 換新 | T0861 |

## 必守規則（摘要，原文在各 docs）

- 🔴 只有 win32 ＋打包版＋ NSIS 安裝（`resources\installer-quit-request.supported`）＋ holder 驗證通過才從 holder 啟動；其他情況 `forkTerminalServer` 逐字照舊。`forkTerminalServer` 是唯一啟動點，用 `spawn`（帶 `ipc`）、不得用 `fork`（Electron 的 fork 一律加 `ELECTRON_RUN_AS_NODE`）。
- 🔴 holder 不得叫 `BetterAgentTerminal.exe`、不得放在 `$INSTDIR` 內、根目錄與 `$INSTDIR` 互為字串前綴時不複製也不使用。
- 🔴 有程序在執行的 holder 目錄不得刪除（安裝程式 D9 清理、解除安裝都先查 `Win32_Process.Path`）；NSIS 不強制結束任何程序。
- 🔴 權杖不寫日誌、不進任何 env 與命令列；協定只做相加，`server:hello` / `server:shutdown` 每版都有效。
- 🔴 升級（安裝程式或 `--updated` 的舊版解除安裝程式）不停 holder；真的解除安裝（`--uninstall-quit-request`）一律停。版本 N 的解除安裝程式與 quit 行為在 N 發佈後就改不了，所以第一個有 holder 的版本發佈前必跑 W6 驗收（下面〈驗證清單〉）。
- 🔴 接回前不 spawn direct shell（BUG-146 / T0578 的 hold 規則不變）；不自動 resume、不通知塔台。

## 協定 v1 摘要（T0857）

| 方向 | 訊息 | 說明 |
|---|---|---|
| 主行程 → server | `server:hello { protocolMin, protocolMax, token }` | TCP 連線第一個請求；權杖錯 → `error UNAUTHENTICATED` 並關閉；沒有共同版本 → `NO_COMMON_PROTOCOL`（只接受 `server:shutdown` / `server:ping`） |
| server → 主行程 | `server:hello-ok { protocol, batVersion, runtime: { name, version }, holderDir?, pid }` | holder 版 `runtime.name = 'node'` 並帶 `holderDir` |
| 主行程 → server | `server:extendIdle { durationMs }` | 升級 quit 用，24 h、只一次；之後任何 client hello 清掉延長 |
| 不認得的請求 | `error UNKNOWN_REQUEST` | 舊版 server 不回 hello、只回 pong = protocol 0 |

完整訊息表、逾時、兩種版本組合：[terminal-server-recovery.md](terminal-server-recovery.md)「協定 v1」。

## 流程

N = 第一個有 holder 的版本，N+1 = 下一版。完整步驟與日誌見 [upgrade-interruption.md](upgrade-interruption.md)「各情況的動作順序」。

| 情況 | 安裝程式 / BAT 的動作 | 終端 | 下次啟動 |
|---|---|---|---|
| **安裝**（第一次） | `customInstall` 寫兩個標記、把 holder 複製到本範圍的根目錄 | — | 從 holder 啟動 Terminal Server（日誌 `[pty-holder] Terminal Server from holder <key> (per-user\|per-machine)`） |
| **升級** N → N+1（per-user，或已提權的 per-machine） | N+1 安裝程式 `--installer-quit-request` → N 的 BAT 延長 idle、結束分頁裡安裝目錄下的程序、寫 schema 2、只結束主行程；N 的解除安裝程式（`--updated`）不碰 holder；`customInstall` 複製 N+1 的 holder（key 相同就略過、在跑的目錄保留、沒在用的刪除） | shell、長命令、conhost 持續執行 | 紀錄的 holder pid = pid 檔 = hello 的 pid、≥ 1 個 PTY → 直接接回；toast `app.upgradeReattached`（同版 `…SameVersion`）；被結束的 agent 分頁列進清單 |
| **同版重裝** | 同升級（T0846：與取消安裝無法區分，用同版中性文字） | 持續 | 接回，`app.upgradeReattachedSameVersion` |
| **降級** N+1 → N | 舊版安裝程式的 `customCheckAppRunning` 送 `--installer-quit-request`；N+1 保留 holder；N+1 的解除安裝程式 `--updated` 不做事 | 持續 | N 有 holder 且協定相容 → 接回 |
| **降級到沒有 holder 的版本**（T0857 前） | 同上（舊版有 T0823 標記處理） | 舊版主行程連不上 v1 holder → 終端結束 | 舊版的既有 recovery / 說明；schema 2 紀錄被當 `invalid` 丟掉 |
| **真的解除安裝** | `--uninstall-quit-request` → BAT 停 server；`customUnInstall` 再請 holder 結束、等 ≤ 20 s、根目錄沒有程序在跑才 `RMDir /r`（否則保留並 `DetailPrint`）；userData 保留 | 結束 | — |
| **holder 不相容**（hello `unauthenticated` / `incompatible` / `timeout`，D5） | — | 下次啟動結束舊 holder（Windows 仍在跑 → `taskkill` 連同 PTY 樹） | toast「升級結束了 N 個終端」、agent 分頁進清單 |
| **holder 0 個 PTY 且版本較舊**（D6） | — | — | 換成本版的 holder（pid 改變） |

## 已知限制

- per-machine 互動升級需要 UAC 時，inner instance 不跑 `CHECK_APP_RUNNING`：主行程被舊版解除安裝程式以路徑強制結束、沒有紀錄；holder 不在 `$INSTDIR` 內 → 存活，下次啟動走 Recovery 提示（不是自動接回）。GitHub runner 是已提權的，W6 驗不到這條路（T0862）。
- 只刪**本次安裝範圍**的 holder 根目錄；改過範圍（per-user ↔ per-machine）留下的另一個不刪。`--runtime=N` 的 holder 收不到解除安裝請求（只送預設 runtime）→ 根目錄有程序在跑 → 保留。
- 降級到沒有 holder 的版本：終端結束（與升級前的 T0820 行為相同）；holder 是否留下、是否被舊版的孤兒清理結束，以 W6 情境 5 的實測為準（T0862 回報區）。
- holder 驗證每次啟動重算約 90 MiB 雜湊（T0859 實測約 0.1 s）；驗證與 `spawn` 之間有 TOCTOU。
- 升級 quit 的 idle 延長只一次：使用者在升級前又開 BAT 會清掉延長。
- macOS / Linux 沒有 holder（升級方式不同，未研究）；zip 版、`build:dir`、開發模式不用 holder。

## 驗證清單

| 層 | 內容 |
|---|---|
| 單元 | `electron/__tests__/pty-holder.test.ts`、`scripts/__tests__/pty-holder.test.mjs`（兩邊規則一致）、`electron/__tests__/installer-quit-holder.test.ts`、`electron/__tests__/holder-reattach.test.ts`、`terminal-server` 協定測試（見各 docs「驗證」） |
| e2e（本機打包版，`npm run build:dir`，不跑安裝程式） | `e2e/t0859-pty-holder.spec.ts`、`e2e/t0860-installer-quit-holder.spec.ts`、`e2e/t0861-holder-reattach.spec.ts` |
| 真實安裝程式（W6 / T0862） | `.github/workflows/windows-upgrade-acceptance.yml` ＋ `e2e/t0862-windows-upgrade-acceptance.spec.ts`（下節） |
| 發佈後手動 | `e2e/manual/nsis-reinstall-acceptance.ps1 -Version <版號>`：有 holder 的版本另查 holder 目錄與 manifest、執行中 holder 與分頁 shell 的 PID 在覆蓋安裝後不變、真的解除安裝後 holder 結束與根目錄刪除；沒有 holder 的版本照舊判讀 |

### W6：Windows 真實升級驗收（T0862）

- 🔴 只 `workflow_dispatch`、唯讀權杖、不傳 secret、不建 tag / Release / `server-bundle-v*`、不部署 Pages、不在發版關卡內；`gh` 一律帶 `-R gowerlin/better-agent-terminal`。
- 🔴 spec 只在 GitHub Actions 的 Windows runner 上執行（`GITHUB_ACTIONS=true`、`RUNNER_OS=Windows`、`T0862_ACCEPTANCE=1`，否則 skip）：它跑真的安裝程式，並以**預設 runtime** 啟動 BAT（安裝程式的 quit 請求只到預設 runtime 的 single-instance lock），在開發機上會碰到安裝版與它的 userData。
- 🔴 L185：情境 7 以 `<INSTDIR>\BetterAgentTerminal.exe`＋`ELECTRON_RUN_AS_NODE` 跑計時器代替內嵌 claude；不開真的 claude / codex、不登入、不呼叫模型。更新檢查以 T0864 的標記關閉（`checkForUpdates: false`＋`checkForUpdatesMigrated: true`，啟動前寫進 `settings.json`），否則 exp 版一定跳更新對話框。

```text
gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=main -f checks=false   # 跑兩次 → A、B（0.0.0-exp.<run>）
gh workflow run windows-upgrade-acceptance.yml -R gowerlin/better-agent-terminal -f build_run_a=<A 的 run id> -f build_run_b=<B 的 run id> [-f old_version=0.7.4-pre.9] [-f scenarios=1,3]
```

每個情境一個 job（乾淨 runner），結果寫進 job summary 與 artifact（`report-<n>.md`、`result-<n>.json`、去識別化的 debug log、截圖；權杖類檔名與樣式會被刪掉）。每個情境都檢查：shell 與 `ping -t` 的 pid 升級前後相同、conhost 還在、holder 的路徑、有紀錄時重開沒有 Recovery 提示、接回後持續收到輸出、toast 文字、holder 目錄。

| # | 情境 | 主要判準 |
|---|---|---|
| 1 | per-user A → B（`/S /currentuser`） | BAT 在 15 s 內結束、holder / shell / ping / conhost 存活、安裝目錄沒有程序、schema 2、跑著的 key 目錄保留、放進根目錄的兩個目錄：沒有程序在跑的被刪、有程序在跑的保留（D9；A、B 同 commit 時 key 通常相同，記錄兩個 key）；重開：沒有 Recovery 提示、`app.upgradeReattached`（vA → vB）、同 holder / shell pid、ping 輸出持續 |
| 2 | per-machine A → B（`/S /allusers`）＋真的解除安裝 | 同 1（根目錄在 `%ProgramFiles%`）；解除安裝時另有程序從根目錄執行 → holder 結束、根目錄保留、userData 保留。runner 已提權，UAC inner instance 的路徑不在範圍 |
| 3 | 同版重裝 B → B | 接回、`app.upgradeReattachedSameVersion` |
| 4 | 降級 B → A | 接回、`app.upgradeReattached`（vB → vA） |
| 5 | 降級 B → `0.7.4-pre.9`（沒有 holder） | 安裝不卡、舊版啟動、分頁 60 s 內能執行指令、原 shell 與 ping 結束；Recovery 提示 / toast / holder 是否留下照實記錄 |
| 6 | per-user 真的解除安裝 | holder、shell、ping 結束、`%LOCALAPPDATA%\BAT-PtyHolder` 刪除、安裝目錄刪除、userData 保留、pid 檔清掉 |
| 7 | A → B，分頁裡有內嵌 agent 替身 | BAT 結束替身（日誌 `ended 1 agent process(es)`）、15 s 內結束、紀錄 `endedAgentProcesses`；重開：shell 回到提示列、分頁列為被中斷、略過後清單清空 |
| 8 | D6：A → B，holder 有 0 個 PTY | 日誌 `has no PTYs and runs vA (this is vB) — replacing it`、舊 holder 結束、新 holder pid |
| 9 | D5：A → B 後權杖檔不符 | 日誌 `hello unauthenticated — ending it`、`detected … incompatible`、舊 holder / shell / ping 結束、`app.upgradeInterrupted`（1 個終端）、分頁有新 shell |
