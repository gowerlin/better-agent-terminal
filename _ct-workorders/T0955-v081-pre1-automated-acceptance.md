---
schema_version: 1
schema_kind: workorder
id: T0955
title: "`v0.8.1-pre.1` 交付版自動化驗收：以隔離實例跑 A-19～A-23（BUG-228 / 229 / 230 / 231、T0950）"
type: verification
status: DONE
repo: better-agent-terminal
priority: P2
sizing: M
created_at: "2026-11-27T22:09:36+08:00"
started_at: "2026-11-27T22:10:43+08:00"
updated_at: "2026-11-27T22:34:47+08:00"
completed_at: "2026-11-27T22:34:47+08:00"
session_ids:
  - "08fe08ce-865d-4c0e-9eef-eeec79ebce45"
target_version: "v0.8.1-pre.1（交付版驗收）"
depends_on: []
related:
  - "D450（使用者：「用自動化測試」）；A-19～A-23（D449）；BUG-228（T0946）、BUG-229（T0947）、BUG-230（T0949）、BUG-231（T0951）、T0950；各工單〈待實機〉段；前例 T0923 / T0928（`launchIsolated`＋`BAT_E2E_EXECUTABLE` 驅動交付版 zip）、T0770–T0772 / T0792（安裝版自動化實測）"
affects_files:
  - _ct-workorders/T0955-v081-pre1-automated-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0955` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式（`src/**`、`electron/**`、`scripts/**`）、不改 `e2e/fixtures/`；只可在 `e2e/manual/` 新增本單的驅動腳本，README 同步。"
  - "🔴 受測物：GitHub Release `v0.8.1-pre.1` 的 `BetterAgentTerminal-0.8.1-pre.1-win.zip`。`gh release download v0.8.1-pre.1 -R gowerlin/better-agent-terminal -p '*-win.zip'` 到自己的空目錄，以 `gh release view v0.8.1-pre.1 -R gowerlin/better-agent-terminal --json assets` 的 `digest`（SHA-256）比對，相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.1-win/`；只用 zip，不執行 .exe 安裝檔。解出的 `resources/package.json` 版號必須是 `0.8.1-pre.1`。"
  - "🔴 隔離（不得違反）：使用者正在用安裝版 BAT 跑塔台與本工單的分頁。🔴 不得結束、重啟、連線或寫入安裝版 BAT、它的 Terminal Server / PTY holder、它的 userData（`%APPDATA%\\BetterAgentTerminal`）；不得用 `taskkill /IM` 之類以名稱結束程序，只能結束自己啟動、記下 pid 的程序（D308）。受測實例一律 `launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`（獨立 userData 與 Terminal Server），`dropEnv` 移除 `BAT_*` / `CT_*` / `CLAUDECODE` / `CLAUDE_CODE_*`。使用者層 `~/.claude`、`~/.codex` 前後雜湊相同。"
  - "🔴 不開真的 claude 回合、不花模型額度：以「假 claude」驗證。做法由 Worker 查證後選（例：受測實例的 Settings → Claude Runtime 指向 system、PATH 前置一個假 `claude.exe` / `claude` 腳本；或其他不改產品的方式），回報區寫明。假 claude 要能：① 把收到的 argv 寫進檔案；② 依參數模擬 claude 的全螢幕狀態（送 `ESC[?1049h`、`ESC[?1003h`、`ESC[?1006h`、`ESC[?25l` 後等待）；③ 把 stdin 收到的字寫進檔案；④ 在自己的 PTY env 下呼叫受測實例的 helper（`BAT_HELPER_DIR` 的 `bat-terminal.mjs --set-role tower --bat-contract 2 --mode on`）模擬塔台宣告。找不到不改產品就能讓受測實例啟動假 claude 的方式 → 問塔台。"
  - "🔴 情境（對應 A-n，每項 PASS / FAIL / 未判定附證據）：受測實例 Settings → Shell 設為 Git Bash（`C:\\Program Files\\Git\\bin\\bash.exe`，不存在就 BLOCKED 問塔台）。A-19（BUG-228）：縮圖列「+」→「以塔台開啟 Claude」→ 假 claude argv 最後一個是 `/control-tower`（不是 `C:/Program Files/Git/control-tower`），分頁命令列有 `MSYS2_ARG_CONV_EXCL=` 前置變數，debug log 有 `[T0946]`。A-20（BUG-229 / 231）：假 claude 進入全螢幕＋滑鼠追蹤後按 ⏻，期間以 Playwright 在分頁上持續移動滑鼠並立刻鍵入 `abc`；新 shell 的輸出 / 分頁文字沒有 `35;`…`M` 片段，新假 claude 的 argv 完整且最後是 `/control-tower`，stdin 收到 `abc`（或 log `[agent-command] … input before the launch command … sent after it`），log 有 `[mouse-tracking] reset: before-new-pty`。A-23（T0950）：同一次 ⏻ 後 xterm 在 normal buffer（例：分頁 DOM / `terminal.buffer.active.type` 經可取得的方式），先前寫的標記行可往上捲到，游標狀態照實記錄（看得到 / 看不到，不修）。A-21（BUG-230）：假 claude 宣告塔台後，結束受測實例並保留終端（照 BAT 的關閉流程：quit 時保留 Terminal Server，或該實例支援的等價方式），再以同一 runtime 啟動、Recovery 提示選「保留」→ 塔台分頁仍是 `role: tower` / 契約 2（helper 查詢或待辦分頁不顯示「沒有已宣告的塔台分頁」），log 有 `[tower-role] restored:`；zip 版不支援保留終端 → 記「未判定」與原因。A-22（可選）：同 A-21 但選「重新開始」→ 塔台分頁重新啟動並帶 `/control-tower`（假 claude argv），log 有 `not restored`。反例：一般 Claude CLI 分頁 ⏻ 不帶 `/control-tower`；一般 shell 分頁 ⏻ 後打字立即出現。"
  - "🔴 結果：每項附證據（log 行、argv 檔內容、截圖檔名）；🔴 權杖值、`tower-roles.json` 以外的使用者資料不得出現在回報區；結果與截圖放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0955-results/`（本機，不進 repo），回報區放總表與摘錄。受測版 FAIL 不修產品，記證據、建議開 BUG，繼續跑下一項。同一項最多重試 3 次，仍不穩判「未判定」並附原因，不得硬判 PASS。"
  - "🔴 驗證與 Git：新增 `e2e/manual/` 腳本時 `node --check`（或對 `.ts` 跑 typecheck 可涵蓋的方式），worktree `npm ci`、`npx vite build` exit 0、`npm run typecheck` = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空，自己啟動的程序全部結束（列出 pid）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0955 — `v0.8.1-pre.1` 交付版自動化驗收（A-19～A-23）

## 背景

`v0.8.1-pre.1` 含 BUG-228（Git Bash 改寫 `/control-tower`）、BUG-229（⏻ 後滑鼠回報黏在命令前面）、BUG-230（接回後塔台宣告消失）、BUG-231（⏻ 期間打的字黏在命令前面）、T0950（⏻ 後離開殘留 alt screen）。塔台發了 A-19～A-23 請使用者實機驗收，使用者指示改用自動化測試（D450）。本單以發佈的 zip 開隔離實例、用假 claude 驗證，不碰使用者正在用的安裝版 BAT、不花模型額度。

## 範圍

- 下載並驗證 `v0.8.1-pre.1` zip，開隔離實例（Git Bash shell）。
- 以假 claude 跑 A-19～A-23 與反例，逐項判定並附證據。
- 必要時在 `e2e/manual/` 新增驅動腳本。

## 不做

- 不改產品、不碰安裝版 BAT 與使用者資料、不開真的 claude 回合、不跑 NSIS 安裝。

## 驗收

- [x] zip 雜湊相符、版號 `0.8.1-pre.1`
- [x] A-19、A-20、A-23、A-21、（可選）A-22 與反例逐項判定＋證據
- [x] 隔離：安裝版 BAT 未被碰、使用者層雜湊相同、自己的程序全部結束
- [x] 新增腳本時 build、typecheck、`node --check`

---

## 回報區

### 完成狀態

- **狀態**：`DONE`：A-19～A-23 與兩個反例在 `v0.8.1-pre.1` 交付版 zip 上全部 **PASS**；隔離檢查全部 PASS。
- **session_id**：08fe08ce-865d-4c0e-9eef-eeec79ebce45
- **branch**：`ct/T0955`
- **base_sha**：`8a095af021856e2bbbded23f4b77bd7dc0331da6`
- **validated_sha**：`7b8c9f0c49d5c8d13c1dccd41ecb03574d50bec5`（關卡與正式驗收都在這個 commit 上執行）
- **head_sha**：`7b8c9f0c49d5c8d13c1dccd41ecb03574d50bec5`（與 validated_sha 相同）
- **產品 commit**：`7b8c9f0c test(e2e/manual): T0955 automated acceptance driver for A-19..A-23 with a fake claude`（只新增 `e2e/manual/` 的腳本與 README 一節，沒改產品程式、沒改 `e2e/fixtures/`）

### 落點檢查

- **結果**：PASS。
- C-0：工單 `repo` = `better-agent-terminal`；`basename "$CT_HOME"` = `better-agent-terminal` → PASS。
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS。
- C-3：`affects_files` 的 `e2e/manual/` 在 worktree 中存在 → PASS。
- C-2：工單沒有 `branch` 欄位，不適用；目前分支 `ct/T0955`。
- 證據：`CT_HOME` 已設定（主 checkout），`CT_WORKTREE_BRANCH` = `ct/T0955`，`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`，`BAT_REMOTE_TOKEN` 已設定。

### 受測物

- `gh release download v0.8.1-pre.1 -R gowerlin/better-agent-terminal -p '*-win.zip'`，下載到自己的空目錄 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/_dl-0.8.1-pre.1/`。
- 雜湊相符：`gh release view` 的 digest 是 `sha256:695a200360ad86be93e611f497cf0d24086f61d0ded637b9cf0c2bb380a68071`；本機 `sha256sum` 得到 `695a200360ad86be93e611f497cf0d24086f61d0ded637b9cf0c2bb380a68071`。比對相符後才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.1-win/`。
- `resources/package.json` 的版號是 `0.8.1-pre.1`。只用 zip，沒有執行 .exe 安裝檔。

### 做法（假 claude）

- **啟動方式**：Settings → Claude Runtime 設成 `system`，`customPath` 指向假 `claude.exe`，`fallbackToEmbedded: false`，所以內嵌 claude 絕不會啟動；Settings → Shell 設成 `git-bash`。這兩項在啟動前寫進受測 runtime 的 `settings.json`，不必改產品。
  - 查證過程：BAT 偵測 system claude 時只接受真的 `.exe`（`electron/claude-resolver.ts` 用 `spawn` 執行 `<path> --version`，不收 `.cmd`），所以用 .NET Framework 的 `csc.exe` 把 `e2e/manual/t0955-fake-claude.cs` 編成 exe，放在 repo 外的結果目錄。
- **假 claude 的行為**：
  - `--version` 回 `2.1.331 (Claude Code)`。
  - 在分頁內啟動時：
    - ① 把原始命令列與 argv 寫檔。
    - ② 主控台設成 VT 輸入／輸出模式，印 5 行標記與 60 行填充。
    - ③ 參數中有 `/control-tower` 時，在分頁自己的 helper env 下執行 `bat-terminal.mjs --set-role tower --bat-contract 2 --mode on`。
    - ④ 依 `control.json` 送出 `ESC[?1049h ESC[?1003h ESC[?1006h ESC[?25l` 後等待，或停在 normal buffer。
    - ⑤ stdin 每次讀到的內容以 base64 記錄。
    - ⑥ 背景回應驅動的 `bat_whoami` 查詢：經分頁自己的 port 與範圍權杖，透過 BAT MCP shim。
  - helper 部分在 `t0955-fake-claude.mjs`，stdio 都導向檔案，不碰主控台。
- **調整紀錄**：第一版用 node 的 `setRawMode` 讀 stdin，xterm 收不到 `?1003h`（`mouseTrackingMode` 停在 `none`）。原因是 ConPTY 只在主控台開了 `ENABLE_VIRTUAL_TERMINAL_INPUT` 時才轉送滑鼠模式，所以改由 C# 自己設定主控台模式並讀 stdin。改完後 xterm 進入 `any`，舊假 claude 也收到 `[<35;…M` 回報（A-20 的前置條件成立）。
- **驅動**：`e2e/manual/t0955-v081-acceptance.ts`（tsx＋Playwright `_electron`）。
  - 隔離：`--runtime=e2e-t0955-<ms>`，用 `isolatedEnv` 建 env：去掉 `BAT_*` / `CT_*`，`dropEnv` 再去掉 `CLAUDECODE` / `CLAUDE_CODE_*` 等變數；`CLAUDE_CONFIG_DIR` 指向結果目錄。
  - 同一個 runtime 重開時沿用同一個 remote port，這樣接回後分頁裡的 helper 仍連得到。
  - quit 對話框在主行程以 `dialog.showMessageBox` 的替身回答：A-21／A-22 是「結束＋不停 Terminal Server」，收尾是「結束＋停 Terminal Server」。
  - 主要的工作區只放在結果目錄，`_ct-workorders/_tower-state.md` 只有 frontmatter（`bat_contract: 2`）。

### 結果總表（正式執行 `run-20261127-223159`，commit `7b8c9f0c`）

| 項目 | 判定 | 主要證據 |
|---|---|---|
| A-19（BUG-228） | **PASS** | 假 claude 的 argv 最後一個是 `/control-tower`（不是 Git 路徑）；分頁命令列以 `MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"` 開頭；假 claude 看到的 `MSYS2_ARG_CONV_EXCL` = `/control-tower`；log `[T0946] tower tab terminal=b393bace-…: Git Bash (MSYS) argument conversion excluded for the launch prompt` |
| A-20（BUG-229 / 231） | **PASS** | 前置條件：xterm `alternate`＋`mouseTrackingMode=any`，舊假 claude 的 stdin 收到 `[<35;4;3M[<35;7;4M…`。⏻ 後 194 ms 新 PTY 已出現，此時鍵入 `abc`，滑鼠在分頁上持續移動到新 claude 啟動後 4 s。新 claude 的 argv 4 個、和第一次相同，最後一個是 `/control-tower`；新 claude 的 stdin = `abc`，沒有 `35;…M`；⏻ 後的分頁輸出與 xterm buffer 都沒有 `35;…M`。log 有 `[mouse-tracking] reset: before-new-pty terminal=b393bace-… mode=any` 與 `[agent-command] id=b393bace-… input before the launch command: 3 write(s), 3 bytes → sent after it` |
| A-23（T0950） | **PASS** | log 有 `[mouse-tracking] alt screen left: new-pty-spawned terminal=b393bace-…`。⏻ 後 xterm 在 `normal` buffer（`baseY 75`、`length 110`）。第一個假 claude 在全螢幕前寫的 `T0955-MARK-35664-1…5` 在 buffer 第 6–10 列，以滑鼠滾輪往上捲到 `viewportY 0` 時看得到全部 5 行（截圖 `a23-scrolled-up.png`）。**游標**：看得到（`isCursorHidden=false`），`mouseTrackingMode=none` |
| 反例：一般 Claude CLI 分頁 | **PASS** | 第一次啟動與 ⏻ 後，argv 最後都是 `--name=T0955 · c54f80`，不帶 `/control-tower`；分頁沒有宣告塔台 |
| 反例：一般 shell 分頁 | **PASS** | ⏻ 後立刻鍵入 `echo T0955SHELL…`＋Enter：567 ms 後看得到輸入的文字，625 ms 後看到輸出；這個分頁沒有任何 `[agent-command]` 保留紀錄 |
| A-21（BUG-230） | **PASS** | quit 時保留 Terminal Server（log `[quit] user confirmed quit (stopTerminalServer=false)`；Electron 主行程自行結束），之後 Terminal Server pid 31288 與塔台分頁的假 claude pid 34168 都還在。以同一個 runtime 重開，Recovery 提示選「保留」。log 有 `[tower-role] restored: terminal=b393bace role=tower mode=on contract=2 (Terminal Server PTY list)`；同一個假 claude 程序（pid 34168）仍在執行（接回，不是重啟）。從該分頁以 BAT MCP `bat_whoami` 查詢，得到 `role=tower`、`towerContract=2`、`towerMode=on`（`terminal b393bace-… role=tower agent=claude-cli session="T0955 · Tower" bat-contract=2 hooks=none (no-report)`） |
| A-22（可選） | **PASS** | 再次保留 Terminal Server 結束後重開，選「重新開始」。塔台分頁啟動新的假 claude，argv 最後一個是 `/control-tower`；log 有 `[tower-role] not restored: terminal=b393bace (not-running; no surviving Terminal Server)` |
| 隔離 | **PASS** | 見下節 |

- quit 前的 `tower-roles.json`：`{"version":1,"towers":[{"terminalId":"b393bace-b6f3-42a0-88ba-8d962c33b251","pid":39032,"role":"tower","mode":"on","towerContract":2,"ptyAgent":"claude-cli"}]}`
- **穩定性**：修好驅動後，同一個腳本又跑了 3 次（`run-20261127-222742`、`run-20261127-222903`、正式的 `run-20261127-223159`），每次所有項目都 PASS、exit `0`。前 3 次失敗都是驅動或假 claude 的問題，不是受測版的問題：
  - 假 claude 沒開 VT 輸入，所以滑鼠追蹤沒有傳到 xterm。
  - 標記行在可見區，被新 ConPTY 開頭的 `ESC[2J` 清掉；改為後面加 60 行填充，讓標記進入 scrollback。
  - whoami 判讀錯欄位。
  - shell 判讀時，OSC 標題序列把輸入的文字切開了。
  - 變數遮蔽同名函式。
  - `app.close()` 之後才讀 `process()`。
- 本單沒有受測版 FAIL，不建議開 BUG。

### 隔離與收尾

- **安裝版 BAT**：沒有連線，也沒有結束、重啟或寫入它；沒有用名稱結束程序。驗收前後列出非受測目錄的 BAT 相關程序（`BetterAgentTerminal.exe`、`bat-pty-holder.exe`，以及命令列含 BetterAgentTerminal 的 node / claude / bash），pid 集合完全相同。
- **使用者層**：比對 `~/.claude` / `~/.codex` 的設定檔共 1195 個，涵蓋 settings、CLAUDE.md、skills / agents / commands、plugins 清單、codex config.toml / AGENTS.md / skills。前後合併雜湊都是 `74e366a57bdfb156847751776684709369cb132a1808efd1bd6ff517bcb9c23d`，沒有任何檔案變動。session 紀錄由執行中的 Claude Code session 寫入，不列入比對。
- **自己啟動的程序（正式執行）**：
  - Electron 主行程：Playwright 啟動 3 次，第一次 pid 51668 自行結束，第二、三次由 `app.close()` 結束。
  - Terminal Server：保留時是 pid 31288，A-22「重新開始」時由 BAT 結束；收尾時的 pid 49512 已結束。
  - 假 claude：pid 35664、34168、43492、32872、47300、47340，全部隨分頁或 Terminal Server 結束。腳本收尾時找不到殘留，不需要另外結束。
  - 收尾後再以 CIM 查詢：可執行檔在 `BAT-TestBuilds` 下、命令列含 `t0955-fake-claude` 或 `e2e-t0955-` 的程序數是 0；`%APPDATA%` 下沒有 `BetterAgentTerminal-runtime-e2e-t0955-*` 目錄（6 次執行的 runtime userData 都已刪除）。
- **結果目錄**：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0955-results/`，是本機目錄、不進 repo。
  - `report-<時間>.json`。
  - `run-<時間>/` 內含：`driver.log`、假 claude 的 argv / meta / stdin / setrole / cmd 結果、分頁輸出（去 ANSI 版與 raw 版）、遮罩過的 BAT `Logs/`、`tower-roles.json`、截圖。
  - 正式執行的截圖：`a19-tower-fullscreen.png`、`a23-scrolled-up.png`、`a23-bottom.png`、`a21-recovery-prompt.png`、`a21-after-keep.png`、`a22-after-fresh-start.png`。

### 修改檔案

- `e2e/manual/t0955-v081-acceptance.ts`（新增）：驅動。
- `e2e/manual/t0955-fake-claude.cs`（新增）：假 `claude.exe`。
- `e2e/manual/t0955-fake-claude.mjs`（新增）：假 claude 的 helper 部分。
- `e2e/manual/README.md`：新增「t0955-v081-acceptance.ts / …（T0955）」一節。

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0（結尾的 install-scripts 警告屬預期） |
| `node --check e2e/manual/t0955-fake-claude.mjs` | OK |
| `tsc --noEmit --strict … e2e/manual/t0955-v081-acceptance.ts` | 0 錯（`npm run typecheck` 不涵蓋 `e2e/`，所以另外以 tsc 檢查；同樣的旗標檢查既有的 `ct610-driver.ts` 也是 0 錯） |
| `t0955-fake-claude.cs` | csc 編譯成功 |
| `npx vite build`（在 `7b8c9f0c` 上） | exit 0 |
| `npm run typecheck`（在 `7b8c9f0c` 上） | exit 0、0 個錯誤 |
| 正式驗收（在 `7b8c9f0c` 上） | exit 0，全部 PASS |

### Git

- worktree 只用 `git add <明確路徑>` 提交 1 個 commit（`7b8c9f0c`），維持 LF。
- 沒有 merge / rebase / push / tag，沒有觸發 workflow，也沒有用 stash / reset / restore。
- 收單前 `git -C "$CT_WORKTREE" status --porcelain` 是空的。

### 遭遇問題

- 沒有阻擋。前面說明的驅動問題都已在本單內修正。
- 小註：假 claude 不執行 BAT hooks，所以塔台縮圖顯示 `🪝✕`（hooks `none (no-report)`），與本單的驗收項目無關。
- 待辦分頁在預設版面沒有渲染（DOM 裡沒有 `.inbox-tower-name`），所以 A-21 以 helper 查詢＋日誌判定，工單允許這個方式。

### 互動紀錄

- [22:10] 開工：yolo、`CT_INTERACTIVE=0`，worktree `ct/T0955`。沒有問塔台：假 claude 已找到不改產品的方式（system runtime＋編譯的 `claude.exe`）。

### 後續建議

- 這套驅動可以重複用在之後的交付版：只要換 `BAT_E2E_EXECUTABLE`。凡是改到 ⏻、Recovery 或塔台宣告路徑的版本，建議發版後照跑一次。
