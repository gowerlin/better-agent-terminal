---
schema_version: 1
schema_kind: workorder
id: T0804
title: "查證：AppImage 版 BAT 以 Playwright `app.close()` 關閉時不返回、Terminal Server 留著（T0803 觀察）——產品缺陷或測試方式問題"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T16:04:11+0800"
started_at: "2026-11-03T16:05:21+0800"
updated_at: "2026-11-03T16:24:41+0800"
completed_at: "2026-11-03T16:24:41+0800"
session_ids:
  - "54cc2772-67e7-429e-a6a8-30508e8859b9"
depends_on: []
related:
  - "T0803 回報區〈遭遇問題〉第 4 點；D250；T0797（`e2e/linux/`，已有清理殘留 Terminal Server 的程式）；T0144（`before-quit` 關閉確認）；T0540 / PLAN-042（quit Step A、`stopTerminalServerGracefully`）；T0704（Terminal Server recovery）"
affects_files:
  - _ct-workorders/T0804-appimage-app-close-hang-investigation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。不改產品程式、測試、e2e spec、文件、workflow；repo 內唯一可改的是本工單（回報區）。實驗腳本、下載的 AppImage、記錄放 WSL 或系統暫存目錄，收尾刪除。結論若是產品缺陷，在回報寫修正方向與工單草案，由塔台開 BUG / 修正單。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex` 不改不刪；BAT 一律用隔離 userData（`--runtime=<名稱>` 或 e2e 既有方式）。本機 Windows 正在使用的 BAT（安裝版）不得關閉、不得結束它的 Terminal Server；Windows 端若要對照，只能用隔離實例，且只結束自己啟動的程序（以 pid / 命令列確認）。"
  - "🔴 T0803 教訓：不開 codex / claude 分頁，只用 shell 分頁；不在任何 agent TUI 送按鍵；不登入任何服務。關閉確認對話框若出現，只能用 BAT 自己的按鈕或 IPC 回答，不得 `window.confirm` / 系統對話框以外的手段繞過。"
  - "🔴 判讀要有證據：每個結論附命令、程序樹（`ps -o pid,ppid,pgid,cmd`）、debug log 的 `[quit]` 等相關行（不貼權杖、不貼家目錄真實路徑，D176 用 `<使用者資料夾>` / `<使用者>`）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0804 — 查證：AppImage 版 `app.close()` 不返回

## 元資料

- **工單編號**：T0804
- **類型**：research（查證，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T16:04:11+0800
- **預估規模**：M

## 背景

T0803（BUG-159 驗收）在 WSL Ubuntu 24.04 以 Playwright `_electron.launch` 跑 `v0.7.4-pre.3` AppImage，兩輪都遇到：`app.close()` 不返回；主行程結束後 Terminal Server（`terminal-server.js`）仍在，AppImage runtime 不卸載；要另外 SIGTERM 主行程 → terminal-server → crashpad。T0803 沒有查原因。

可能的方向（未查證，僅供起點）：
- BAT 的 `before-quit` 會顯示關閉確認（T0144），`app.close()` 觸發的 quit 可能停在確認對話框（`e2e/linux/linux-os.ts` 註解提到 BAT 對 SIGTERM 以關閉確認回應）。
- Terminal Server 在 quit 時保留（供下次啟動 Recovery）可能是設計行為；Windows 的 quit Step A（`stopTerminalServerGracefully`，`electron/main.ts`）在 Linux 的行為要對照。
- AppImage 啟動器（BUG-202 / T0799，`scripts/appimage-sandbox-launcher.cjs`：`/bin/sh` 包 `BetterAgentTerminal.bin`）或 AppImage runtime 等子程序持有 stdio / 程序群組，讓 Playwright 等不到結束。
- `e2e/linux/t0797-linux-appimage-launch.spec.ts` 已有「清掉殘留 Terminal Server」的程式，可能早已遇過同樣情況。

## 範圍

1. 在 WSL（隔離 userData）重現：AppImage＋Playwright `_electron.launch`，只開 shell 分頁，呼叫 `app.close()`，記錄是否返回、多久、程序樹前後、debug log `[quit]` 相關行、畫面上是否有關閉確認。
2. 拆開可能原因，至少比對：
   - 關閉確認：有 / 沒有確認對話框時（以 BAT 自己的設定或對話框按鈕）`app.close()` 的結果。
   - 不經 AppImage：解開 AppImage（`--appimage-extract`）直接執行 `BetterAgentTerminal.bin`（或打包前的 linux-unpacked）的結果，區分啟動器 / runtime 的影響。
   - 使用者正常關閉（視窗 ✕ / 選單離開並確認）時 Terminal Server 是否留著、下次啟動是否出現 Recovery 提示——判斷「留著」是設計還是缺陷。
3. 對照：讀 `e2e/linux/` 與 Windows 端 e2e 如何關閉 BAT（不必實跑 Windows；若要實跑只能用隔離實例，見 memory_overrides）。
4. 結論分類：A 測試方式問題（附建議的關閉方式，可給 e2e helper 草案）／B 設計行為（附依據）／C 產品缺陷（附重現步驟、影響範圍、修正方向與工單草案）。可以多項並存。

## 不做

- 不修程式、不改 e2e；不開 BUG（塔台依結論開）；不驗 macOS；不動使用者的 WSL / Windows 既有 BAT 與資料。

## 驗收

- [x] 重現紀錄（命令、`app.close()` 結果與耗時、程序樹前後、`[quit]` log 行）
- [x] 各假設的比對結果（關閉確認、不經 AppImage、使用者正常關閉）
- [x] `e2e/linux/` 與 Windows e2e 關閉方式的對照
- [x] 結論（A / B / C）與依據；C 附修正方向與工單草案
- [x] 環境還原：隔離 userData、下載檔、暫存腳本已刪；沒有殘留的 BAT / terminal-server 程序（只限本單啟動的）；`~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex/config.toml` 前後雜湊相同

---

## 回報區

### 完成狀態

- **狀態**：DONE（研究型，驗收 5 項都有證據）
- **結論一句話**：`app.close()` 不返回**不是 AppImage 的問題，也不是產品缺陷**。BAT 主行程在 1 s 內正常結束，但 Playwright 等的是子程序的 `close` 事件（stdio 全部關閉），而 `chrome_crashpad_handler` 繼承了主行程的 stdout / stderr，只要 Terminal Server 活著（它是 crashpad 的 client），crashpad 就不結束，`close` 就不來。關閉確認回答「離開＋結束 Terminal Server」時 0.8–1 s 返回。→ **A（測試方式）＋ B（設計行為）**，C 無；另附兩項觀察交塔台。
- **開始 / 完成時間**：2026-11-03T16:05:21+0800 → 2026-11-03T16:24:41+0800
- **session_id**：54cc2772-67e7-429e-a6a8-30508e8859b9

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有 `_ct-workorders/` 底下的本工單 → not applicable
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`CT_HOME` 未設定（非 worktree）

### 環境

- WSL Ubuntu-24.04（uid 1000、WSLg `DISPLAY=:0`），node v26.13.0（nvm）、`playwright-core@1.59.1`（與 repo 的 `@playwright/test` 1.59.1 同版，裝在 `~/t0804-tmp`，已刪）
- 受測：`v0.7.4-pre.3` AppImage，SHA-256 `4f6bfd63a6cdcd74496c2edb01b905842119d7ff7ef489ba116d6c980d149a05`（與 T0803 相同）
- 每輪一個隔離 runtime（`--runtime=t0804-e1` … `t0804-e5`，userData `<使用者資料夾>/.config/BetterAgentTerminal-runtime-t0804-eN`），`BAT_*` / `CT_*` / `ELECTRON_RUN_AS_NODE` 從 env 移除、`BAT_REMOTE_PORT` 用空閒埠；`chromiumSandbox: true`
- 只開 shell 分頁（seed 一個工作區＋一個 `terminal` 分頁，送 `echo T0804_$((6*7))` 確認 shell 有在跑，5 輪都看到 `T0804_42`）；沒有開 codex / claude 分頁、沒有登入任何服務
- 驅動腳本（暫存、已刪）的作法：`_electron.launch` → 取子程序 pid 的 fd 1 / 2（Playwright stdio 在子程序端的 socket inode）→ 關閉前後列程序樹（`ps -eo pid,ppid,pgid,sid,stat,cmd`）、掃 `/proc/*/fd` 找誰還持有那兩個 socket、`/proc/mounts` 的 `.mount_Better*`、讀 debug log 的 `[quit]` / `[terminal-server]` 行；對話框以 `dialog.showMessageBox` mock 回答（與 `e2e/fixtures/electron-isolation.ts` `closeIsolated` 相同手法），E3 不 mock

### 驗收結果

#### 1. 重現紀錄 — 已重現

**E1**（AppImage，對話框回答「離開」、**不勾**「結束 Terminal Server」= 對話框預設值，`app.close()`，逾時 30 s）：

```
[+ 34129ms] spawned pid 1468 :: /tmp/.mount_Betterth0u3K/BetterAgentTerminal.bin --inspect=0 --remote-debugging-port=0 --runtime=t0804-e1
            its stdio (child side of Playwright's stdio): socket:[26781], socket:[26783]
[+ 48710ms] dialog.showMessageBox mocked → { response: 1 (Quit), checkboxChecked: false }
[+ 48710ms] calling app.close()
[+ 49585ms] spawned process 'exit' event code=0 signal=null          ← 主行程 875 ms 正常結束
[+ 78074ms] close result: TIMEOUT after 29364 ms; main pid 1468 state=gone; 'exit' 875 ms; 'close' not yet
[+ 79583ms] Terminal Server pid 1631 alive after close: true
```

關閉前程序樹（節錄，`pid ppid pgid sid stat cmd`）：

```
1468 1010 1468 1468 Ssl /tmp/.mount_Betterth0u3K/BetterAgentTerminal.bin --inspect=0 … --runtime=t0804-e1   ← 主行程（Playwright 的直接子程序）
1471 1009 1471 1471 Ssl <使用者資料夾>/t0804-tmp/BetterAgentTerminal-0.7.4-pre.3.AppImage …               ← AppImage runtime 的 FUSE 程序（fd 0–2 = /dev/null）
1549 1009 1548 1548 Sl  /tmp/.mount_Betterth0u3K/chrome_crashpad_handler --no-rate-limit …
1631 1468 1631 1631 Ssl /tmp/.mount_Betterth0u3K/BetterAgentTerminal.bin …/dist-electron/terminal-server.js
（另有 zygote / gpu / utility / renderer）
```

（Playwright 啟動的 pid 就是主行程：AppImage runtime exec 進 AppRun → BUG-202 啟動器 → `.bin`，同一個 pid；FUSE 程序是 runtime fork 出的另一個程序。）

關閉後：

```
1471 1009 1471 1471 Ssl <使用者資料夾>/t0804-tmp/BetterAgentTerminal-0.7.4-pre.3.AppImage …
1549 1009 1548 1548 Sl  /tmp/.mount_Betterth0u3K/chrome_crashpad_handler …
1631 1009 1631 1631 Ssl /tmp/.mount_Betterth0u3K/BetterAgentTerminal.bin …/terminal-server.js
mounts: 1
holders of Playwright's stdio sockets:
    pid 1549 fd 1 socket:[26781] :: chrome_crashpad_handler …
    pid 1549 fd 2 socket:[26783] :: chrome_crashpad_handler …
```

debug log：

```
[08:12:30.765Z] [LOG] [terminal-server] started with pid 1631
[08:12:49.603Z] [LOG] [quit] user confirmed quit (stopTerminalServer=false)
[08:12:49.605Z] [LOG] [quit] flushed 1 renderer(s)
[08:12:49.608Z] [LOG] [quit] saved 1 profile snapshot(s)
[08:12:49.609Z] [LOG] [quit] ssh subprocesses exited (0ms)
```

收尾時 SIGTERM Terminal Server 1631 → **9 ms 後** `'close' event code=0`、`app.close()` 返回；crashpad 1549 與 FUSE 程序 1471 隨之結束、mount 卸載。

→ 與 T0803 現象一致：主行程結束、Terminal Server 留著、AppImage runtime 不卸載、`app.close()` 不返回。T0803 的「要另外 SIGTERM 主行程」對應 E3（對話框沒回答，主行程還停在 `before-quit`）。T0803 的驅動腳本已刪，它用的是哪一種回答方式無法核對（推論：落在 E1 / E3 其中之一）。

#### 2. 各假設的比對

| 輪 | 執行檔 | 關閉方式 | 對話框回答 | `app.close()` | 主行程 `exit` | Terminal Server | mount |
|---|---|---|---|---|---|---|---|
| E1 | AppImage | `app.close()` | 離開、不勾（預設） | **逾時 29.4 s** | 875 ms, code 0 | 留著 | 留著 |
| E2 | AppImage | `app.close()` | 離開＋勾「結束 Terminal Server」 | **952 ms 返回** | 950 ms | 已結束（`via SIGTERM`），pidfile 刪除 | 0 |
| E3 | AppImage | `app.close()` | 不 mock（真的出現對話框） | **逾時 19.0 s** | 沒結束（state `S`） | 留著 | 留著 |
| E4 | 解開後的 `squashfs-root/BetterAgentTerminal`（啟動器 → `.bin`，不經 AppImage runtime） | `app.close()` | 離開、不勾 | **逾時 29.3 s** | 35 ms, code 0 | 留著 | 無 mount |
| E5a | AppImage | 視窗 ✕（`BrowserWindow.close()`，= 使用者關最後一個視窗） | 離開、不勾；shell 分頁不先 kill | 等 `close` 事件**逾時 29.4 s** | 845 ms, code 0 | 留著（shell `bash -l -i` 也在） | 留著 |
| E5b | AppImage（同 E5 的 userData 重開） | `app.close()` | 離開＋勾 | 818 ms 返回 | 817 ms | 新開的已結束 | 0 |

- **關閉確認**（E1 / E2 / E3）：決定性因素是對話框的「結束 Terminal Server」勾選。勾 → 正常；不勾 → 主行程正常結束但 `app.close()` 不返回；不回答 → 主行程停在 `before-quit`（log 只有 `[terminal-server] started`，沒有任何 `[quit]` 行），`app.close()` 不返回。E2 log：
  ```
  [quit] user confirmed quit (stopTerminalServer=true)
  [quit] flushed 1 renderer(s)
  [quit] saved 1 profile snapshot(s)
  [quit] terminal server stopped (via SIGTERM)
  [quit] ssh subprocesses exited (0ms)
  ```
- **不經 AppImage**（E4）：同樣逾時，持有 stdio 的同樣是 crashpad：
  ```
  holders of Playwright's stdio sockets (after close): 2
      pid 3125 fd 1 socket:[45261] :: …/squashfs-root/chrome_crashpad_handler …
      pid 3125 fd 2 socket:[45263] :: …/squashfs-root/chrome_crashpad_handler …
  SIGTERM Terminal Server 3140 → 4 ms 後 'close' event code=0
  ```
  ⇒ AppImage runtime、BUG-202 的 `/bin/sh` 啟動器都不是原因。AppImage runtime（FUSE 程序）的 fd 0–2 是 `/dev/null`，不持有 Playwright 的 stdio；它不卸載只是因為 Terminal Server 從 mount 內執行（`/tmp/.mount_*/BetterAgentTerminal.bin …/terminal-server.js`），而且 Terminal Server 繼承了 runtime 的 keepalive 描述元（E1 中斷那次的殘留：FUSE 程序 fd 6 `pipe:[10532]`，持有者只有它與 Terminal Server fd 5；殺掉 Terminal Server 後 FUSE 程序、crashpad 與 mount 3 s 內消失）。
- **為什麼 crashpad 跟著 Terminal Server**（E5a 取證，只列變數名稱）：Terminal Server（`ELECTRON_RUN_AS_NODE` 模式的 `.bin`）的 env 有 `CRASHPAD_HANDLER_PID`、`CRASHDUMP_SIGNAL_FD`，並持有一條連到 crashpad 的 `u_seq` socket（`ss -xp`：server fd 73 `30046` ↔ crashpad fd 75 `30047`），即 Terminal Server 是 crashpad 的 client；crashpad 是主行程 `crashReporter.start()`（`electron/main.ts:1731`）啟動、繼承主行程 fd 1 / 2。所以只要 Terminal Server 活著，crashpad 就活著，主行程的 stdout / stderr 就不會全部關閉。
- **Playwright 等的是什麼**（`playwright-core@1.59.1` 原始碼）：`lib/server/electron/electron.js` 的 close handler 先 `app.quit()`、再 `await appClosePromise`；該 promise 由 `lib/server/utils/processLauncher.js:154` 的 `spawnedProcess.once("close", …)` 觸發。Node 的 `close` 事件要等子程序結束**而且** stdio 串流全部關閉。E1 / E4 / E5a 都是 `exit` 有、`close` 沒有。
- **使用者正常關閉**（E5a → E5b）：視窗 ✕ → `window-all-closed` → `app.quit()` → `before-quit` 對話框；預設不勾時 Terminal Server 與 shell 都留著（log `[quit] user confirmed quit (stopTerminalServer=false)`）。同一 userData 重開：
  ```
  Recovery prompt visible: true — text: "🔄 Previous terminal session detected Terminal Server is still running, with 1 terminal still alive. Restore your previous working state? Restore session Start fresh"
  [terminal-server] 1 live PTYs detected — deferring to user recovery decision
  [BUG-146] pty:create held (Recovery prompt pending)
  ```
  按 BAT 自己的「Start fresh」後舊 server 3871、它的 shell、舊 crashpad、舊 FUSE 程序都消失，新 server 5327 啟動；再以「離開＋勾」關閉 818 ms 返回、mount 0。⇒「留著」是設計（T0144：預設不勾，server 在背景保留供下次 Recovery；T0110 / T0578 的 Recovery 流程照規格運作）。

#### 3. `e2e/linux/` 與 Windows e2e 關閉方式的對照（讀程式碼＋ CI 紀錄，沒有實跑 Windows）

- 共用的 `closeIsolated`（`e2e/fixtures/electron-isolation.ts:185`）：先 mock `dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: true })`（= 離開＋結束 Terminal Server），再 `app.close()` 與 20 s 逾時賽跑，逾時才 `app.process().kill()`；之後再檢查 pidfile 的 Terminal Server，命令列吻合才殺。Windows 的所有 e2e 與 Linux T0797 L1 都用它 ⇒ 一律走 E2 路徑。
- CI 實證（`linux-acceptance.yml` run 41578537967，2026-11-03）：L1 `quit (dialog answered "Quit" + stop Terminal Server): normal in 1480 ms` / `775 ms`，`Terminal Server pid … exited with the app`。
- T0797 L2（`plainLaunch`，`e2e/linux/linux-os.ts:297`）：不經 Playwright，對程序群組送 SIGTERM（BAT 以關閉確認回應）→ 寬限後 SIGKILL → `reapTerminalServer` 殺留下的 server；CI 紀錄 `L2: Terminal Server pid 4861 still alive after quit — killed`。這是「沒回答對話框」的情況（同 E3），spec 已知並處理。
- ⇒ repo 內的 e2e 沒有這個問題；T0803 是自寫的驅動腳本，沒有沿用 `closeIsolated` 的回答方式。Windows 上 crashpad 是否同樣持有 stdio 未查證（推論：Windows e2e 一律勾選結束 server，不會走到）。

#### 4. 結論

- **A 測試方式問題（成立）**：以 Playwright 關 BAT 時必須以「離開＋結束 Terminal Server」回答關閉確認（`closeIsolated` 的 mock），否則 (a) 不回答 → 主行程停在對話框（E3）；(b) 回答但不勾 → 主行程結束，`app.close()` 仍等不到 `close`（E1 / E4 / E5a）。與 AppImage 無關。建議做法：
  - 一般情況直接用 `closeIsolated`（或照抄它的 mock）。
  - 測試若必須驗「保留 Terminal Server」的關閉，不要只等 `app.close()`，改等主行程 `exit` 再自己收 Terminal Server，順序是**主行程先結束、再殺 server**（E3 收尾實測：主行程還停在對話框時先殺 server，watchdog 會照 T0112 重新 fork 一個 server，主行程再被殺後新 server 變成孤兒；本單已清掉，見〈遭遇問題〉）。e2e helper 草案：
    ```ts
    /** Quit BAT keeping the Terminal Server (dialog: Quit, checkbox unchecked), then reap the server ourselves. */
    async function quitKeepingServer(app: ElectronApplication, userData: string): Promise<void> {
      const serverPid = readPid(userData)
      await app.evaluate(({ dialog }) => { (dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false }) })
      const exited = new Promise<void>(r => app.process().once('exit', () => r()))
      await app.evaluate(({ app: a }) => a.quit()).catch(() => { /* process may already be gone */ })
      await Promise.race([exited, new Promise(r => setTimeout(r, 20_000))])
      // app.close() would wait here: chrome_crashpad_handler keeps the main process's stdout/stderr open while the server lives
      if (serverPid && isAlive(serverPid) && (await commandLineOf(serverPid)).includes('terminal-server.js')) {
        process.kill(serverPid, 'SIGTERM')   // crashpad and (AppImage) the FUSE runtime follow; Playwright's 'close' then fires
      }
      await app.close().catch(() => { /* already closed */ })
    }
    ```
- **B 設計行為（成立）**：quit 預設保留 Terminal Server（T0144，`checkboxChecked: false`），下次啟動出現 Recovery 提示（E5b 實測）。AppImage runtime 不卸載是 server 從 mount 內執行的必然結果，屬同一設計。
- **C 產品缺陷：無**（`app.close()` 不返回的成因都是設計或測試方式）。下面兩項是查證中看到、與本題無直接關係的觀察，是否開單由塔台判斷：
  1. ℹ️ **以「等 stdio EOF」方式啟動 BAT 的外部程式會一直等**（推論，未實測 Playwright 以外的情境）：例如 `out=$(./BAT.AppImage)`、`./BAT.AppImage | tee log`、以 pipe 收 stdout 的服務管理器等，只要 Terminal Server 保留，crashpad 就讓主行程的 stdout / stderr 不關閉。修正方向（如需要）：fork Terminal Server 時不讓它成為 crashpad client，或 crashpad 不繼承主行程 stdio；兩者都動到 Electron / crashpad 行為，需先實驗，優先度低。
  2. ⚠️ **PTY 內的 shell 繼承了 Terminal Server 的描述元**（E5a `ss -xp` 實測）：shell `bash -l -i`（pid 3929）持有 fd 59 / 61 / 70 / 83（與 server 共用的 `u_str` socket）與 **fd 73 = crashpad client socket**。影響（推論）：shell 或它背景化的子程序（`nohup`、`setsid`）只要活著，crashpad 就不結束；使用者程式也拿得到這些描述元。修正方向：server 端 spawn PTY 前把這些描述元設 `FD_CLOEXEC`（或查 node-pty 的 fd 繼承行為）。建議先開查證單（P3）確認每個 fd 的來源再決定。

#### 5. 環境還原 — PASS

| 項目 | 開始前（16:07:18） | 結束後（16:21:57） |
|---|---|---|
| `~/.config/BetterAgentTerminal` | `719d9318bb56913d`，3 項 | `719d9318bb56913d`，3 項（未變） |
| `~/bat-build` | `5bc47cbf8d0639f8`，53196 項 | `5bc47cbf8d0639f8`，53196 項（未變） |
| `~/.codex/config.toml` | sha256 `0772345e…6c88`，mtime 2026-10-19 11:48:52 | 相同 |
| `~/.config/BetterAgentTerminal-runtime-*` | 無 | 無（e1–e5 每輪收尾刪除） |
| `/proc/mounts` 的 `.mount_Better*` | 0 | 0 |

（雜湊方式同 T0803：`find . -printf '%P|%s|%T@|%y\n' | sort | sha256sum` 前 16 碼＋項目數。）

- 已刪：WSL `~/t0804-tmp`（AppImage、解開的 `squashfs-root` 1.1 GB、`playwright-core`、驅動腳本、紀錄、`ws` 資料夾）；Windows scratchpad 的下載檔與腳本。
- 收尾後 `ps` 沒有任何 `BetterAgent` / `terminal-server` / `chrome_crashpad_handler` / `.mount_Better` 程序。WSL 原本就在跑的 `<使用者資料夾>/.local/bat-server/bin/node … bat-server.mjs`（pid 386，非本單啟動）未碰。
- `npm i playwright-core` 會寫入 npm 共用快取 `~/.npm/_cacache`，未清（共用快取，不在保護清單）。
- 本機 Windows 的 BAT 安裝版與它的 Terminal Server 完全沒碰（只在 WSL 實驗）。

### 遭遇問題

1. E1 第一次執行時驅動腳本在頁面重載期間 `page.evaluate` 失敗而中斷，Playwright 結束主行程後留下 Terminal Server、crashpad、FUSE 程序（都屬 `t0804-e1`，以命令列與 mount 名稱確認）。順勢取到 keepalive 描述元證據（見第 2 節），之後以 `kill` 清掉；修正腳本（重載時重試）後重跑 E1。
2. E3 收尾順序錯誤：主行程還停在關閉確認時先 SIGTERM Terminal Server，主行程的 watchdog 依 T0112 重新 fork 了一個 server（pid 2539，`BAT_USER_DATA` 指向 `runtime-t0804-e3`，只以名稱比對確認、沒有印值），之後主行程被 SIGKILL，新 server 成為孤兒。E5a 列程序樹時發現，確認沒有子程序後 `kill`，3 s 內消失。這是 T0112 的正常行為，不是缺陷；已寫進第 4 節 helper 草案的順序說明。
3. WSL 沒有 `xwininfo` / `xdotool` / `import`，E3 無法截到原生對話框的畫面；E3 以「主行程仍在（state `S`）＋ log 沒有任何 `[quit]` 行」判斷停在對話框。依工單紅線沒有用 BAT 按鈕 / IPC 以外的手段回答它。

### 互動紀錄

- [16:05] 開工；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；落點檢查 PASS。
- [16:06] 讀 T0803 回報、`e2e/fixtures/electron-isolation.ts` `closeIsolated`、`e2e/linux/`、`electron/main.ts` quit 流程；查 CI run 41578537967 的 L1 / L2 關閉紀錄。
- [16:07] WSL 前置快照；下載 AppImage（SHA-256 一致）、安裝 `playwright-core@1.59.1`，讀 Playwright 的 close 實作。
- [16:09–16:21] E1（中斷一次後重跑）、E2、E3、E4（解開 AppImage）、E5a / E5b；清掉 E1 中斷與 E3 收尾留下的本單程序。
- [16:21] 刪除暫存、事後快照一致。
- 沒有向塔台提問。

### 子代理與 Workflow 使用

沒有使用。

### Commit

- 本單沒有產品變更；只 commit 本工單（`git commit --only`）。commit hash 見 git log（本回報寫在 commit 之前）。
- `methodology`：本單沒有 `methodology` 欄位、沒有 `### 方法論邊界`，啟動時沒有看到方法論注入，也沒有呼叫方法論 skill。

### 後續（交塔台）

1. 本單結論 A ＋ B：不需要修產品；之後在 Linux 以 Playwright 跑發佈版（驗收單）時，沿用 `closeIsolated`，或在工單裡寫明「關閉確認回答離開＋結束 Terminal Server」。
2. 觀察 2（PTY shell 繼承 Terminal Server 描述元，含 crashpad client socket）建議開 P3 查證單。
3. 觀察 1（等 stdio EOF 的外部啟動方式會一直等）優先度低，可記在 backlog。
