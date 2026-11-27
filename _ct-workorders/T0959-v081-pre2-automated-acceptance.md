---
schema_version: 1
schema_kind: workorder
id: T0959
title: "`v0.8.1-pre.2` 交付版自動化驗收：沿用 T0955 驅動，加測 BUG-232（登入導引分頁 / 遠端工具安裝的命令前輸入）與 BUG-233（⏻ 後游標）"
type: verification
status: DONE
repo: better-agent-terminal
priority: P3
sizing: M
created_at: "2026-11-27T22:56:24+08:00"
updated_at: "2026-11-27T23:41:38+08:00"
started_at: "2026-11-27T23:25:51+08:00"
completed_at: "2026-11-27T23:41:38+08:00"
session_ids:
  - "2cccb265-dc51-4892-ad2b-1546c7cc8c58"
target_version: "v0.8.1-pre.2（交付版驗收）"
depends_on: []
related:
  - "D460（U-49：A，發版後自動化驗收）；BUG-232（T0956〈待實機〉）、BUG-233（T0957〈待實機〉）；T0955（驅動 `e2e/manual/t0955-v081-acceptance.ts`、假 claude `t0955-fake-claude.cs` / `.mjs`，D451）"
affects_files:
  - _ct-workorders/T0959-v081-pre2-automated-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0959` 寫檔（base = 派工當下的 `main`，已含 T0955 驅動）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式（`src/**`、`electron/**`、`scripts/**`）、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 的 T0955 驅動或新增本單腳本，README 同步。"
  - "🔴 受測物：GitHub Release `v0.8.1-pre.2` 的 `BetterAgentTerminal-0.8.1-pre.2-win.zip`，下載到自己的空目錄，以 release asset `digest` 比對相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.2-win/`；`resources/package.json` 版號必須是 `0.8.1-pre.2`；只用 zip。"
  - "🔴 隔離（同 T0955，不得違反）：不碰安裝版 BAT 與它的 Terminal Server / PTY holder / userData；只結束自己記下 pid 的程序（D308）；`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`；`dropEnv` 去掉 `BAT_*` / `CT_*` / `CLAUDECODE` / `CLAUDE_CODE_*`；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；不開真的 claude 回合（假 claude）。"
  - "🔴 情境（每項 PASS / FAIL / 未判定附證據）：R0 回歸：T0955 全套（A-19 / A-20 / A-23 / A-21 / A-22 / 兩個反例）在 pre.2 照跑一次。B233（BUG-233）：分頁 shell 設成 WSL（本機有 WSL 才做；`wsl.exe` 不存在 → 未判定並寫原因），假 claude 或在 WSL 內以 `printf` 送 `ESC[?1049h ESC[?25l` 後保持執行，按 ⏻ → 新 shell 後 xterm `isCursorHidden=false`，log 有 `[mouse-tracking] cursor shown: new-pty-spawned`；對照：Git Bash 分頁照舊看得到（不回歸）、一般 shell 沒隱藏時沒有 `cursor shown` log。B232-login（BUG-232）：讓受測實例的 Claude Agent 面板顯示「未登入」導引（例：`CLAUDE_CONFIG_DIR` 指向空目錄；方式由 Worker 查證，不改產品），按開啟終端，分頁出現後立刻鍵入 `abc` → 輸入列是 `<cli> auth login` 在前、`abc` 在後，沒有自動送出（沒有 Enter），log 有 `input before the launch command … sent after it`；做不到讓面板進「未登入」→ 未判定並寫原因。B232-install（遠端工具安裝）：需要遠端 profile 視窗；本機能在隔離實例內以既有方式建立 WSL profile 且不影響使用者的 WSL / bat-server 時才做，否則未判定並寫原因（🔴 不得動使用者現有的 WSL distro、systemd unit、bat-server）。"
  - "🔴 結果：每項附證據（log 行、argv / stdin 檔、截圖）；結果放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0959-results/`（本機），回報區放總表與摘錄；🔴 權杖值不得出現。受測版 FAIL 不修產品，記證據、建議開 BUG，繼續跑。同一項最多重試 3 次，仍不穩判「未判定」並附原因，不得硬判 PASS。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check` / 以 tsc 檢查驅動（同 T0955 的做法），worktree `npm ci`、`npx vite build` exit 0、`npm run typecheck` = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空，自己的程序全部結束（列 pid）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0959 — `v0.8.1-pre.2` 交付版自動化驗收

## 背景

`v0.8.1-pre.2` 含 BUG-232（T0956：登入導引分頁與遠端工具安裝的命令前輸入保留）與 BUG-233（T0957：⏻ 後還原被隱藏的游標）。使用者指示發版後以 T0955 的自動化驅動驗收（D460）。BUG-233 只在非 Windows 的 shell 出現（Windows 新 shell 會自己顯示游標），所以要用 WSL shell 測。

## 範圍

- 下載並驗證 pre.2 zip、隔離實例。
- R0 回歸（T0955 全套）＋ B233（WSL）＋ B232-login ＋ B232-install（可行時）。

## 不做

- 不改產品、不碰安裝版 BAT 與使用者的 WSL / bat-server、不開真的 claude 回合。

## 驗收

- [x] zip 雜湊與版號相符
- [x] R0、B233、B232-login、B232-install 逐項判定＋證據
- [x] 隔離：安裝版 BAT 未被碰、使用者層雜湊相同、自己的程序全部結束
- [x] 改了腳本時 build、typecheck、`node --check`

---

## 回報區

### 完成狀態

- **狀態**：`DONE`：pre.2 交付版上 R0（T0955 全套 8 項）、B233（WSL）、B233 Git Bash 對照、B232-login 與它的對照全部 **PASS**；B232-install **未判定**（理由見下）；隔離檢查全部 PASS。
- **session_id**：2cccb265-dc51-4892-ad2b-1546c7cc8c58
- **branch**：`ct/T0959`
- **base_sha**：`34bb8554f89179b454e61dd9e796e06e020bd8d3`
- **validated_sha**：`405da25a30b89dbd69da36f6d47942f23635b827`（關卡與正式驗收都在這個 commit 上執行）
- **head_sha**：`405da25a30b89dbd69da36f6d47942f23635b827`（與 validated_sha 相同）
- **產品 commit**：`405da25a test(e2e/manual): T0959 acceptance driver for BUG-233 / BUG-232 on a packaged build`。只改 `e2e/manual/`，沒改產品程式，也沒改 `e2e/fixtures/`。

### 落點檢查

- **結果**：PASS。
- C-0：工單 `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS。
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS。
- C-3：`e2e/manual/` 在 worktree 中存在 → PASS。
- C-2：工單沒有 `branch` 欄位；分支是 `ct/T0959`。
- 證據：`CT_HOME` 已設定，`CT_WORKTREE_BRANCH` = `ct/T0959`，`BAT_REMOTE_TOKEN` 已設定。

### 受測物

- `gh release download v0.8.1-pre.2 -R gowerlin/better-agent-terminal -p '*-win.zip'`，下載到自己的空目錄 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/_dl-0.8.1-pre.2/`。
- 雜湊相符：release asset 的 digest 是 `sha256:b11fafc0987843231db3f0a4495d7ba92d0d570f80e263b999d95f1010e5d0de`，本機 `sha256sum` 得到相同的值。比對相符後才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.2-win/`。
- `resources/package.json` 的版號是 `0.8.1-pre.2`。只用 zip。

### 做法

- **R0**：T0955 的驅動 `t0955-v081-acceptance.ts` 不改，直接對 pre.2 的 exe 執行。
  - 結果目錄：`T0959-results/r0/`。
  - 假 claude 用的是本單擴充過的 `.cs`。新增的「未登入」行為只有 `control.json` 指定時才啟用，T0955 不指定，所以它的行為不變。
- **新驅動** `e2e/manual/t0959-v081-pre2-acceptance.ts`：
  - 沿用 T0955 的隔離方式（`launchIsolated` 的同一組 fixture、`isolatedEnv`＋`dropEnv`）和假 claude（Claude Runtime 設 system＋假 `claude.exe`，`fallbackToEmbedded: false`）。
  - 開兩個各自獨立的隔離實例：
    - `--runtime=e2e-t0959-wsl-*`：Settings → Shell 設成自訂的 `C:\Windows\System32\wsl.exe`，開的是使用者預設 distro 的 shell。
    - `--runtime=e2e-t0959-git-*`：Shell 設成 Git Bash。
  - 程式碼裡的 Shell 選單沒有 WSL 選項，所以用自訂 shell。PtyManager 對 `wsl.exe` 不加任何參數。
- **假 claude 擴充**（`t0955-fake-claude.cs`）：`control.json` 有 `"authStatus": "loggedOut"` 時，`auth status` 會印出 `{"loggedIn": false, …}` 並 exit 1，和 claude 未登入時一樣。
  - 這樣 BAT 的 `claude:auth-status` 會回傳 `loggedIn=false`，Claude Agent 面板就顯示「未登入」導引。不必改產品，也不必動使用者的 claude 設定。
  - 查證：`electron/handlers/claude.ts` 的 `parseClaudeAuthStatus` 接受 exit 1 加上 JSON 的 `loggedIn`。

### 結果總表（正式執行：R0 `run-20261127-233837`，T0959 `run-20261127-233952`，commit `405da25a`）

| 項目 | 判定 | 主要證據 |
|---|---|---|
| R0 A-19（BUG-228） | **PASS** | argv 最後一個是 `/control-tower`；命令列以 `MSYS2_ARG_CONV_EXCL="/control-tower${…}"` 開頭；log `[T0946] tower tab terminal=858a6a60-…: Git Bash (MSYS) argument conversion excluded for the launch prompt`；`--set-role` exit 0（`bat-contract: 2`） |
| R0 A-20（BUG-229 / 231） | **PASS** | ⏻ 前舊 claude 收到 `[<35;4;3M…`。⏻ 後新 claude 的 argv 和第一次相同（4 個），stdin = `abc`。stdin、分頁輸出與 xterm buffer 都沒有 `35;…M`。log 有 `reset: before-new-pty … mode=any` 與 `input before the launch command: 3 write(s), 3 bytes → sent after it` |
| R0 A-23（T0950） | **PASS** | log 有 `alt screen left: new-pty-spawned`。⏻ 後是 normal buffer（`baseY 75`）。標記行在第 6–10 列，滾輪可以捲回。游標看得到（`isCursorHidden=false`） |
| R0 反例（Claude CLI／shell） | **PASS** / **PASS** | 一般 Claude CLI 分頁第一次啟動與 ⏻ 後都不帶 `/control-tower`，也沒有宣告塔台。shell 分頁 ⏻ 後打的字 553 ms 出現、674 ms 有輸出，沒有保留紀錄 |
| R0 A-21（BUG-230） | **PASS** | quit 時保留 Terminal Server（pid 32312），假 claude pid 48452 仍在。重開後選「保留」，log 有 `[tower-role] restored: terminal=858a6a60 role=tower mode=on contract=2 (Terminal Server PTY list)`；同一個程序仍在，`bat_whoami` 回 `role=tower`、`towerContract=2` |
| R0 A-22 | **PASS** | 選「重新開始」後 argv 最後一個是 `/control-tower`；log 有 `[tower-role] not restored: terminal=858a6a60 (not-running; no surviving Terminal Server)` |
| **B233**（BUG-233，WSL） | **PASS**（附註意事項） | 在 WSL shell 輸入 `printf '\033[?1049h\033[?25l'; sleep 6007`，xterm 變成 `alternate`、`isCursorHidden=true`，程式仍在執行。按 ⏻ 後新 shell 有提示列，xterm 是 `normal`、`isCursorHidden=false`。log 有 `[mouse-tracking] cursor shown: new-pty-spawned terminal=shell-t0959-wsl`（前一行是 `alt screen left`）。新 shell 可以輸入（echo 有回應）。截圖：`b233-wsl-hidden-before-restart.png`、`b233-wsl-after-restart.png` |
| B233 對照：WSL 閒置 ⏻ | **PASS** | 游標從沒隱藏的 shell 按 ⏻：沒有 `cursor shown`／`cursor state unknown` 日誌，游標看得到 |
| B233 對照：Git Bash（不回歸） | **PASS** | 同樣的隱藏游標再按 ⏻：游標看得到，是 normal buffer，可以輸入。log 也有 `cursor shown: new-pty-spawned terminal=shell-t0959-git`。R0 的塔台分頁 ⏻ 時也記了一行 `cursor shown` |
| B233 對照：Git Bash 閒置 ⏻ | **PASS** | 沒有 `cursor shown`／`cursor state unknown` 日誌，游標看得到 |
| **B232-login**（BUG-232） | **PASS** | 前置：Claude Agent 面板顯示「未登入」導引（log `[auth-status] exit 1, stdout reports loggedIn=false`）。按開啟終端，分頁出現後 77 ms、新 PTY 已有輸出時鍵入 `abc`；524 ms 後才看到命令。輸入列是 `$ '<使用者資料夾>\…\fake\claude.exe' auth loginabc`：命令在前、`abc` 在後。log 有 `[T0402] login terminal=9c370fa2-… typed: … auth login` 與 `[agent-command] id=9c370fa2-… input before the launch command: 3 write(s), 3 bytes → sent after it`。沒有送出：假 claude 沒有被以 `auth login` 執行，輸入列之後也沒有換行。截圖：`b232-login-guide.png`、`b232-login-typed.png` |
| B232-login 對照（不打字） | **PASS** | 再開一次、不打字：輸入列以 `… auth login` 結尾，沒有保留紀錄 |
| **B232-install** | **未判定** | 需要遠端 profile 視窗。本機能取得的方式都會改動使用者的 WSL：WSL 精靈會在 distro 裝 server bundle 與 systemd user unit；手動跑 bat-server 也是跑在那個 distro 裡；安裝動作本身會在遠端主機執行真的安裝程式。這些都違反工單「不得動使用者現有的 WSL distro、systemd unit、bat-server」。單元層已有 T0956 的 `electron/__tests__/launch-hold-login-install.test.ts`（真 `PtyManager`＋handlers）覆蓋 |
| 隔離 | **PASS** | 見下節 |

- **對照組（pre.1）**：用同一個 T0959 驅動對 `0.8.1-pre.1` 跑一次（`T0959-results/pre1-compare/`），確認驅動分得出修正前後：
  - **B232-login FAIL**：輸入列是 `$ abc'<…>\fake\claude.exe' auth login`，`abc` 在命令前面，也沒有保留日誌，正是 BUG-232 的症狀。pre.2 已修正。
  - **B233**：pre.1 也沒有 `cursor shown` 日誌（FAIL），但 ⏻ 後游標同樣看得到（`isCursorHidden=false`）。原因見下一點。
- **B233 的注意事項（建議塔台判讀）**：在 Windows 上，WSL 分頁仍然經過 ConPTY。⏻ 後新的 ConPTY 會自己送 `ESC[?9001h … ESC[?25l … ESC[?25h`（分頁原始輸出的順序），所以不論有沒有 T0957 的修正，游標都會出現（pre.1 對照也是如此）。
  - 本機的 WSL 分頁只能證明兩件事：修正的路徑在 pre.2 有執行（有 `cursor shown` 日誌），而且行為沒有回歸。
  - 它不能重現原 bug，因為原 bug 發生在 PTY 位於非 Windows 主機時。要驗證原 bug，需要在遠端 profile 視窗（WSL／SSH 的 bat-server）或 Linux／macOS 主機上測，和 B232-install 有同樣的限制。
- **穩定性**：pre.2 的 T0959 驅動共跑 4 次。第 1 次有兩項不是受測版的問題（下列），修正後第 2–4 次都是 exit 0。R0 跑 2 次，都是 exit 0、全部 PASS。
  - 隔離檢查比對安裝版 BAT 的 pid 時，把使用者分頁裡自行結束的 claude／node 也算進去。driver.log 沒有任何 `ended leftover`，表示驅動沒有結束它們。已改成核心程序必須相同、agent 端子程序只記錄。
  - B232 對照回到面板時用錯了縮圖選擇器。
- 受測版沒有 FAIL，不建議開 BUG。

### 隔離與收尾

- **安裝版 BAT**：沒有連線，也沒有結束、重啟或寫入它；沒有用名稱結束程序。
  - 核心程序（`BetterAgentTerminal.exe` ×5、`bat-pty-holder.exe` 17288）的 pid 前後相同。
  - agent 端子程序前後都是 19 個，期間沒有增減（正式執行）。
- **使用者層**：`~/.claude`、`~/.codex` 的設定檔共 1195 個，前後合併雜湊都是 `74e366a5…c23d`，沒有任何檔案變動。R0 與 T0959 兩次正式執行都有比對。
- **WSL**：只把使用者預設 distro 當成一個分頁的 shell 使用，沒有安裝、設定或寫入任何檔案。
  - 打的 `sleep 6007` 隨 ⏻ 結束。收尾時 `wsl.exe -e pgrep -fx "sleep 6007"` 找不到程序，驅動不需要另外結束。
- **自己啟動的程序**：
  - R0：Terminal Server 保留時是 pid 32312（A-22「重新開始」時由 BAT 結束），收尾時的 pid 4432 已結束。假 claude 是 pid 17064、48452、39024、47196、49428、36340，全部隨分頁結束。
  - T0959：兩個實例的 Terminal Server（pid 21572、47400）已結束。Electron 由 `closeIsolated` 結束。Git Bash 的 `sleep 6008` 隨 ⏻ 結束。
  - 收尾後再以 CIM 查詢（排除查詢指令本身）：可執行檔在 `BAT-TestBuilds` 下、或命令列含 `e2e-t0959-` 或 `t0955-fake-claude` 的程序數是 0。`%APPDATA%` 下 `BetterAgentTerminal-runtime-e2e-t09*` 的目錄數是 0。
- **結果目錄**：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0959-results/`，是本機目錄、不進 repo。
  - `report-<時間>.json`、`run-<時間>/`：內含 `driver.log`、`logs-wsl/` 與 `logs-git/`（遮罩過的 BAT 日誌）、分頁輸出、截圖。
  - `r0/`：R0 的結果。
  - `pre1-compare/`：pre.1 對照組。

### 修改檔案

- `e2e/manual/t0959-v081-pre2-acceptance.ts`（新增）：驅動。
- `e2e/manual/t0955-fake-claude.cs`：新增選用的 `auth status` 未登入回應，預設不啟用。
- `e2e/manual/README.md`：T0955 節補一行；新增「t0959-v081-pre2-acceptance.ts …（T0959）」一節。

### 驗證（在 `405da25a` 上執行）

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0 |
| `node --check e2e/manual/t0955-fake-claude.mjs` | OK（檔案沒改） |
| `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node`：t0959 與 t0955 驅動 | 兩個都是 0 錯（`npm run typecheck` 不涵蓋 `e2e/`） |
| `t0955-fake-claude.cs` 以 csc 編譯 | exit 0 |
| `npm run typecheck` | exit 0（0 個錯誤） |
| `npx vite build` | exit 0 |
| 正式驗收 R0／T0959 | 兩者都 exit 0 |

### Git

- worktree 只用 `git add <明確路徑>` 提交 1 個 commit（`405da25a`），維持 LF（已逐檔以 bytes 確認）。
- 沒有 merge／rebase／push／tag，沒有觸發 workflow，也沒有用 stash／reset／restore。
- 收單前 `git -C "$CT_WORKTREE" status --porcelain` 是空的。

### 遭遇問題

- 沒有阻擋。前面說明的驅動問題（隔離比對太嚴、對照用錯選擇器）已在本單內修正。
- B233 的驗證範圍受 Windows ConPTY 限制，見結果總表後面的注意事項。

### 互動紀錄

- [23:25] 開工：yolo、`CT_INTERACTIVE=0`，worktree `ct/T0959`。沒有問塔台：
  - B233 找到不改產品的 WSL 做法（自訂 shell `wsl.exe`）。
  - B232-login 找到「未登入」的做法（假 claude 的 `auth status`）。
  - B232-install 依工單規則判「未判定」。

### 後續建議

1. BUG-232：登入分頁的部分已實機（交付版）驗證 PASS，pre.1 對照也重現了原症狀。遠端工具安裝那一段仍待遠端 profile 視窗實測，塔台可依 D453 決定收單方式。
2. BUG-233：本機只驗到修正路徑有執行、而且沒有回歸。原 bug 要在 PTY 位於非 Windows 主機時驗證：遠端 WSL／SSH profile 視窗，或 Linux／macOS。建議請使用者在既有的遠端視窗手動跑 T0957〈待實機〉的 1–3。或者經使用者同意後，另開工單以獨立的拋棄式 distro（`wsl --import`）建立 WSL profile，B232-install 也可以一併驗證。
3. T0955 與 T0959 的驅動可以重複用在之後的交付版，只要換 `BAT_E2E_EXECUTABLE`。
