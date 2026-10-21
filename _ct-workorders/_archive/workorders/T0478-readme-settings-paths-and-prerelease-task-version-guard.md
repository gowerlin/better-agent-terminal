---
schema_version: 1
schema_kind: workorder
id: T0478
title: "README「設定」段資料 / 日誌路徑與 CLAUDE.md Logging 路徑更正 + .vscode Pre-Release task / trigger-prerelease.ps1 未帶版號即拒絕執行"
type: implementation
status: DONE
repo: better-agent-terminal
project: docs
priority: P3
sizing: S
created_at: "2026-10-13T22:08:44+08:00"
started_at: "2026-10-13T22:09:37+08:00"
updated_at: "2026-10-13T22:18:56+08:00"
completed_at: "2026-10-13T22:18:56+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0477
related:
  - "T0477 回報區「偏離 / 範圍外發現」1 / 3"
  - "CLAUDE.md「Release」：`-f version=` 不可留空（留空走自動遞增 → `4.0.4-pre.1` 類脫節版號）、`gh` 一律帶 `-R`"
affects_files:
  - README.md
  - CLAUDE.md
  - .vscode/tasks.json
  - .vscode/scripts/trigger-prerelease.ps1
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **不得實際觸發 workflow**：驗證 `trigger-prerelease.ps1` 只能測「未帶版號 / 格式錯誤 → 拒絕」路徑；任何會走到 `gh workflow run` 的測試一律禁止（可用 dry-run 參數或 mock，見 B 段）"
  - "🔴 不 push、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況（README 為 i/lf w/crlf）"
  - "🔴 不改 `electron/` 程式碼；路徑以程式碼現況為準來寫文件"
---

# T0478 — 設定 / 日誌路徑文件更正 + Pre-Release task 版號防呆

## A. README「設定」段與 CLAUDE.md「Logging」路徑

背景：README 寫 `%APPDATA%/better-agent-terminal/` 等，但 `electron/main.ts:158` `app.setName('BetterAgentTerminal')`，另有 `--runtime=N` / `BAT_RUNTIME` 讓 userData 變成 `<base>-runtime-<N>`（`main.ts:160-171`）。`electron/logger.ts:84` 有 legacy `debug.log` 搬移邏輯，日誌實際位置可能已不在 userData 根目錄。

1. 以程式碼確認三平台實際 userData 路徑（`app.setName` 對 `getPath('userData')` 的影響、dev 與打包版是否不同、`package.json` `productName` / `build.productName`），以及 `BAT_RUNTIME` 的目錄規則
2. 以 `electron/logger.ts` 確認日誌實際路徑、檔名、是否需要 `BAT_DEBUG=1` 才寫磁碟（README 現寫「設定環境變數 `BAT_DEBUG=1` 啟用磁碟日誌」，請核對）
3. 可用本機證據佐證 Windows（如 `%APPDATA%\BetterAgentTerminal` 是否存在、`BAT_USER_DATA` 環境變數），只讀不改
4. 更新 README「設定」表與「除錯日誌」段；補一行 `BAT_RUNTIME` 多實例資料目錄說明（若屬實）
5. 更新 CLAUDE.md「Logging」節的 log 檔位置（現寫 `~/Library/Application Support/better-agent-terminal/debug.log`），三平台都列或改寫為規則
6. 全 repo `docs/` 與 README 內 grep `better-agent-terminal/debug.log`、`Application Support/better-agent-terminal`、`%APPDATA%/better-agent-terminal`、`.config/better-agent-terminal`，回報區列出；明確過期者在 README / CLAUDE.md 範圍內修，`docs/` 內的只列出不改

## B. `.vscode` Pre-Release task 版號防呆

背景：`.vscode/tasks.json`「CI/CD: 觸發 Pre-Release (GitHub Actions)」不傳 `-Version`，`trigger-prerelease.ps1` 在 `$Version` 為空時不加 `-f version=` → workflow 自動遞增出脫節版號；「(指定版本)」task 的 promptString 可空白送出；input 描述仍為 `2.1.4-pre.1`。

1. `trigger-prerelease.ps1`：`$Version` 為空或不符 `^\d+\.\d+\.\d+-pre\.\d+$`（不帶 `v`）時印出原因與正確用法並 `exit 1`，**不呼叫 `gh`**。移除「留空則自動遞增」的說明 / 分支。確認 `gh` 呼叫帶 `--repo gowerlin/better-agent-terminal`（或 `-R`）
2. 可選：加 `-DryRun` switch 只印出將執行的 `gh` 指令不執行，供驗證用
3. `tasks.json`：刪除不帶版號的「CI/CD: 觸發 Pre-Release (GitHub Actions)」task，或改為同樣要求輸入版號（擇一，回報區說明）；`prereleaseVersion` 描述改為 `X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）`
4. tasks.json 中若有其他 task 引用已刪除的 label（如 `dependsOn`），一併處理；確保 JSON（含註解 JSONC）仍可被 VSCode 解析
5. 驗證（不得觸發 workflow）：
   - `pwsh -File .vscode/scripts/trigger-prerelease.ps1` → exit 1、未呼叫 gh
   - `-Version v0.6.0-pre.4`、`-Version 0.6.0` → exit 1
   - 若有 `-DryRun`：`-Version 0.6.0-pre.4 -DryRun` → exit 0 且印出含 `-R`/`--repo` 與 `-f version=0.6.0-pre.4` 的指令
   - 回報區附各指令輸出

## 驗收條件

- [ ] README「設定」/「除錯日誌」與 CLAUDE.md「Logging」路徑與程式碼一致，回報區附程式碼依據（檔案:行）
- [ ] `trigger-prerelease.ps1` 未帶 / 錯誤格式版號一律 exit 1 且不呼叫 gh
- [ ] tasks.json 無「不帶版號觸發」的 task；描述不含 `2.1.4`
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + README「設定」段 + CLAUDE.md「Logging」+ `electron/main.ts:150-175` + `electron/logger.ts` + `.vscode/tasks.json` + `.vscode/scripts/trigger-prerelease.ps1`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。A、B 兩段都已完成，4 項驗收條件全部通過。

A 段有一個關鍵發現：**設定與日誌不在同一個目錄**。`settings.json` / `windows.json` / `profiles/` 位於 `<appData>/BetterAgentTerminal/`；除錯日誌 `Logs/debug-*.log`、`Crashes/`、`snippets.json` 則位於 `<appData>/better-agent-terminal/`。原 README 寫的 `%APPDATA%/better-agent-terminal/` 只對日誌部分正確，對設定部分是錯的。「`BAT_DEBUG=1` 啟用磁碟日誌」的說法也是錯的：磁碟日誌預設開啟，與 `BAT_DEBUG` 無關。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，判定 PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` 之下，PASS
- C-3（因 C-0 已 PASS，僅供參考）：4 個 `affects_files` 都存在
- C-2：工單沒有 `branch` 欄位，不適用；實際在 `main` 執行
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### A. 路徑查證（程式碼依據）

| 事實 | 依據 |
|---|---|
| `package.json` 的 `name` 是 `better-agent-terminal`。`productName` 只寫在 `build.productName`，打包後 `app.asar` 內的 `package.json` **沒有** `productName`（以 `@electron/asar` 讀取已安裝的 0.6.0-pre.2 實測） | `package.json:2`、`package.json:118` |
| `app.setName('BetterAgentTerminal')` | `electron/main.ts:158` |
| `snippetDb` 單例在 import 時呼叫 `app.getPath('userData')`，時間點早於 `setName`。已安裝的 bundle 中 `const hr=new mR` 位於 offset 263870，`setName` 位於 626466 | `electron/snippet-db.ts:45`、`:189`；`electron/main.ts:83` |
| whenReady 中先執行 `logger.init(app.getPath('userData'))`，再執行 `app.setPath('crashDumps', getCrashesDir())` | `electron/main.ts:1399`、`:1402`、`:620-622` |
| 日誌目錄為 `<userData 當下值>/Logs`，檔名 `debug-<YYYYMMDD-HHMMSS>.log`，最多保留 10 個；舊版 `debug.log` 會被搬成 `debug-legacy-<stamp>.log` | `electron/logger.ts:26-28`、`:77`、`:82-93`、`:160` |
| 磁碟日誌預設開啟：`loggingEnabled !== false`，`logLevel` 預設 `debug`；UI 位於 Settings → Advanced → Debug Logging | `electron/main.ts:555-560`、`electron/logger.ts:33-34`、`src/components/SettingsPanel.tsx:1040`、`:1119-1170` |
| `BAT_DEBUG` 只用來設定 `isDebugMode`，作用是顯示 debug preset、worktree 選項等 UI，**與磁碟日誌無關** | `electron/preload.ts:824`、`src/components/WorkspaceView.tsx:208`、`:1331-1337`、`src/types/agent-presets.ts:104-106` |
| `--runtime=N` / `BAT_RUNTIME=N`：取 `getPath('userData')` 的 basename 加上 `-runtime-<N>`，再以 `setPath('userData')` 覆寫 | `electron/main.ts:160-171` |

**機制（以 Electron 41.2.1 probe 實測，probe 放在 scratchpad，已清除）**：Chromium PathService 會在第一次 `getPath('userData')` 時，依當下的 app name 算出路徑並快取，之後 `setName` 不會改變快取值。任何一次 `app.setPath(...)` 都會清空快取（override 不受影響），之後的 `getPath('userData')` 才會改用新名稱重新計算。probe 的順序與 BAT 相同：import 時 getPath → setName → requestSingleInstanceLock → whenReady getPath → setPath(crashDumps) → getPath。實測輸出如下：

```
import-time (like snippet-db): name=bat-probe-lower userData=...\Roaming\bat-probe-lower
after-setName: name=BatProbeUpper userData=...\Roaming\bat-probe-lower
after-lock:    name=BatProbeUpper userData=...\Roaming\bat-probe-lower
whenReady (logger.init): name=BatProbeUpper userData=...\Roaming\bat-probe-lower
after-setPath(crashDumps): name=BatProbeUpper userData=...\Roaming\BatProbeUpper
crashDumps=...\Roaming\bat-probe-lower\Crashes
```

對照組：import 時不呼叫 getPath（打包模式，exe 不叫 `electron.exe`，`isPackaged=true`）的話，全程都是 `BatProbeUpper`，不會出現小寫目錄。

**本機 Windows 實證（只讀）**：
- `%APPDATA%\BetterAgentTerminal\`：`settings.json`、`windows.json`（22:10 更新）、`profiles/`、`server-cert.json`、`server-token.json`、`whisper-models/`、`bat-pty-*`，以及 Chromium 的 `Preferences` / `Local Storage` 等。環境變數 `BAT_USER_DATA=<使用者資料夾>\AppData\Roaming\BetterAgentTerminal` 由 terminal server 繼承，該值在 `main.ts:303` 取得，時間點在 setPath 之後
- `%APPDATA%\better-agent-terminal\`：`Logs\debug-20261013-144906.log`（目前執行中的實例，argv=`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）、`Crashes/`、`lockfile`（單一實例鎖）、`Local State`。該 log 內有一行 `[startup] crashDumps path: <使用者資料夾>\AppData\Roaming\better-agent-terminal\Crashes`
- 本機沒有 `*-runtime-*` 目錄。runtime 實例的路徑 `better-agent-terminal-runtime-<N>` 是由程式碼與 PathService 語意推導出來的，**未經實機觀察**
- macOS / Linux 走同一條 Electron PathService 路徑，依程式碼推導，**未實機驗證**。README 與 CLAUDE.md 都以規則形式描述三平台

### A. 文件更新

- README「設定」：改為「資料目錄 / 日誌目錄」雙欄的三平台表格，並列出兩個目錄各放哪些檔案，用一句話說明為何分成兩處；新增 `--runtime=<N>` / `BAT_RUNTIME=<N>` 多實例目錄說明
- README「除錯日誌」：改寫為預設開啟、`Logs/debug-<stamp>.log`、保留 10 個、可在 設定 > 進階 > 除錯日誌 關閉或調整等級，並註明 `BAT_DEBUG` 與日誌無關
- README 同檔另外兩處過期內容（屬 README 範圍，一併修正）：專案結構中 `logger.ts` 的註解原為「BAT_DEBUG=1 啟用」；技術堆疊「儲存」列原寫 `workspaces.json`，該檔現在只作為遷移來源，已改為 `windows.json`、`profiles/`
- CLAUDE.md「Logging」：log 位置改寫為三平台規則，說明預設開啟、與 `BAT_DEBUG` 無關、legacy 搬移；另新增一條「日誌與設定不在同一目錄」的根因說明，並提醒日後調整 import 順序、`setName` 或 `setPath` 時資料路徑會跟著改變

### A6. grep 結果（`better-agent-terminal/debug.log`、`Application Support/better-agent-terminal`、`%APPDATA%/better-agent-terminal`、`.config/better-agent-terminal`）

| 位置 | 處置 |
|---|---|
| `README.md:244-246`、`:250` | 已修正 |
| `CLAUDE.md:23` | 已修正 |
| `docs/plan-027-cross-platform-verification.md:50`（`~/Library/Application Support/better-agent-terminal/debug.log`） | **只列出，未修改**。目錄正確，但檔案已改為 `Logs/debug-<stamp>.log` |
| `docs/plan-027-cross-platform-verification.md:92`（`~/.config/better-agent-terminal/debug.log`） | **只列出，未修改**，原因同上 |

### B. Pre-Release 版號防呆

- `trigger-prerelease.ps1`：`$Version` 先 Trim；若為空，或不符合 `^\d+\.\d+\.\d+-pre\.\d+$`，就印出原因、正確格式、用法與判版提醒後 `exit 1`。這段檢查放在任何 `gh` 呼叫（包括 `gh auth status`）之前。「留空則自動遞增」的說明與分支都已移除。`gh` 呼叫帶 `--repo gowerlin/better-agent-terminal`，`-f version=` 改為必帶。新增 `-DryRun` switch，只印出指令後 `exit 0`，不檢查 gh、也不呼叫 gh。另外把原本的 `$args` 變數改名為 `$GhArgs`，因為 `$args` 是 PowerShell 的自動變數
- `tasks.json`：採用「**刪除**」方案，移除不帶版號的「CI/CD: 觸發 Pre-Release (GitHub Actions)」task，並在原位置留下註解說明原因。保留的「(指定版本)」task 收到空值時會被 script 拒絕。`prereleaseVersion` 的描述改為 `輸入 Pre-Release 版本號：X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）`。`releaseVersion` 的描述原本也是 `2.1.4`，一併改為 `例如 0.6.0 或 0.6.0-pre.4，可帶 v`（依 `release.ps1:10`「可帶 v 前綴」）
- 已確認沒有任何 task 以 `dependsOn` 引用被刪除的 label。repo 內（`_ct-workorders/` 除外）也沒有其他地方引用這個 label

### 驗證

**source / docs**
- 以 `typescript.parseConfigFileTextToJson` 解析 `tasks.json`（JSONC）：PASS。共 15 個 task，`dependsOn` 引用 0 個，檔案內不含 `2.1.4`
- 換行符維持原狀：README、tasks.json、trigger-prerelease.ps1 為 w/crlf；CLAUDE.md 為 w/lf

**script 行為（PASS，未觸發 workflow）**：先在 scratchpad 放一個假的 `gh.ps1` 並 prepend 到 PATH，確認 `(Get-Command gh).Source` 指向假 gh；它被呼叫時會寫入 marker 檔。

```
===== pwsh -File .vscode/scripts/trigger-prerelease.ps1
  ❌ 未指定版本號
     格式：X.Y.Z-pre.N（不帶 v，例如 0.6.0-pre.4）
     用法：pwsh -File .vscode/scripts/trigger-prerelease.ps1 -Version 0.6.0-pre.4 [-DryRun]
     版號取本 fork 主線（v0.x）最新 tag 遞增，不要信 git tag 排序第一名（見 CLAUDE.md「Release」）
  exit=1
===== ... -Version v0.6.0-pre.4
  ❌ 版本號格式錯誤：'v0.6.0-pre.4'   (提示同上)
  exit=1
===== ... -Version 0.6.0
  ❌ 版本號格式錯誤：'0.6.0'          (提示同上)
  exit=1
===== ... -Version ""                 (模擬 promptString 空白送出)
  ❌ 未指定版本號                      (提示同上)
  exit=1
===== ... -Version 0.6.0-pre.4 -DryRun
  🔍 DryRun：不會觸發 workflow，將執行的指令：
     gh workflow run pre-release.yml --repo gowerlin/better-agent-terminal --ref main -f version=0.6.0-pre.4
  exit=0
===== fake gh invoked? False
```

**build / tests**：未執行。本單只改文件、`.vscode` 設定與 script，沒有改 `electron/` 或 `src/`，`npx vite build` 不受影響。

### git diff --stat（commit 前）

```
 .vscode/scripts/trigger-prerelease.ps1             | 51 +++++++++++++++-------
 .vscode/tasks.json                                 | 21 ++-------
 CLAUDE.md                                          |  3 +-
 README.md                                          | 27 ++++++++----
 ...ings-paths-and-prerelease-task-version-guard.md |  6 +--
```

### 偏離 / 範圍外發現（交塔台決策）

1. **userData 分裂屬於產品行為問題，不只是文件問題**：設定與日誌分在兩個目錄，`snippets.json` 也跟日誌放在一起。原因是 `snippet-db` 在 import 時就取得路徑。要修正需另開工單，例如把 `snippetDb` 改為 lazy 初始化，或把 `setName` 提到所有 import 之前。但修正後日誌與 `snippets.json` 的位置會改變，必須同時設計搬移邏輯，否則使用者既有的 snippets 會「消失」。本單依 memory_overrides 規定不改 `electron/`
2. **runtime 實例的 snippets 會共用**：`BAT_RUNTIME` 實例的 `snippetDb` 路徑在 runtime override 之前就已決定，因此所有 runtime 實例共用預設實例的 `<appData>/better-agent-terminal/snippets.json`。這是由程式碼推導的結論，未實機驗證
3. **helper scripts 的 runtime 路徑假設不一致**：`scripts/_bat-logger.mjs:10-12` 與 `scripts/_bat-cert.mjs:20` 假設路徑為 `BetterAgentTerminal[-runtime-<N>]`。預設實例下這個假設正確，因為 cert 與 settings 都在 `BetterAgentTerminal`。但 runtime 實例的實際目錄是 `better-agent-terminal-runtime-<N>`（推導），helper 會找錯 cert / log 目錄。只列出，未修改
4. `docs/plan-027-cross-platform-verification.md:50`、`:92` 的 `debug.log` 路徑已過期（見 A6），只列出
5. BUG-116 的回報者在 mac 上觀察到 `~/Library/Application Support/better-agent-terminal/Logs/` 不存在。若主程序在 whenReady 的 `logger.init` 之前就因 whisper 而崩潰，這個現象與本單結論一致；未驗證

### Commit

見下方 commit（本單檔案 + 4 個 affects_files）。未 push，未建 tag。
