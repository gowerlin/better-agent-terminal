---
schema_version: 1
schema_kind: workorder
id: T0865
title: "BUG-213：Windows PTY holder 不繼承 BAT 主行程從啟動者拿到的 handle（帶 pipe 啟動 BAT 時，保留的 holder 不再讓呼叫端等不到 `close`）＋重跑 W6"
type: implementation
status: PARTIAL
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-05T09:35:13+0800"
started_at: "2026-11-05T09:38:58+0800"
updated_at: "2026-11-05T09:42:07+0800"
completed_at: "2026-11-05T09:42:07+0800"
session_ids:
  - "b6dcbaaa-3547-4d3f-85b4-3d3adb07c3bb"
depends_on: [T0862]
related:
  - "BUG-213；D290；T0862 回報區〈遭遇問題〉1、〈後續建議〉2（run `41942234283`）；T0859（holder 啟動 `holderSpawnSpec` / `forkTerminalServer`）；D286；`docs/agent-guide/pty-holder.md`"
affects_files:
  - _ct-workorders/T0865-pty-holder-handle-inheritance.md
  - _ct-workorders/BUG-213-pty-holder-inherits-launcher-handles.md
  - electron/pty-holder.ts
  - electron/main.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/terminal-server-recovery.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 Windows 上 holder 的啟動（與修正需要的最小接線）；macOS / Linux、沒有 holder 的 fork 路徑（`terminalServerForkOptions`）、協定 v1、安裝程式 `build/installer.nsh`、升級 quit（`installer-quit-request.ts`）、接回判斷（`upgrade-interruption.ts`）的行為一律不變。"
  - "🔴 停止條件：修正需要新增原生模組、改協定或安裝程式，或沒有可靠作法 → 不硬做，停下回報 PARTIAL，列出可行選項與代價（含「列為已知限制」）由塔台決定。"
  - "🔴 W6 重跑規則同 D289：可 push `origin main`（每次 push 前掃金鑰樣式與家目錄路徑、`.private/` 去識別化樣式，結果寫回報區；不 force-push）、觸發 `desktop-build.yml` ×2 與 `windows-upgrade-acceptance.yml`，各上限 5 次；不建 tag / Release、不跑 `pre-release.yml` / `release.yml`、不部署 Pages。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 不得在本機安裝任何安裝檔、不碰本機 BAT 安裝版與它的 Terminal Server；L185 不開真的 claude / codex。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；權杖與環境變數值不寫（只寫名稱）。"
---

# T0865 — BUG-213：PTY holder 不繼承啟動者的 handle

## 元資料
- **工單編號**：T0865｜**類型**：implementation｜**狀態**：PARTIAL｜**建立**：2026-11-05 09:35 (UTC+8)
- **規模**：M｜**決策**：D290｜**依賴**：T0862

## 背景
T0862 run `41942234283`：Playwright 啟動 BAT 時，BAT 主行程繼承了 Playwright 的 stdio pipe handle（可繼承），它以 `spawn` 啟動 holder 時 holder 再繼承下去；升級後 holder 保留，pipe 一直沒關，`ElectronApplication.close()` 等到 30 分鐘逾時。從檔案總管 / 開始功能表啟動沒有 pipe，不受影響；但從終端、啟動器、IDE、腳本帶 pipe 啟動 BAT 時，保留的 holder 會讓呼叫端等不到結束。使用者決定先修再發 `0.7.5-pre.1`（D290）。

## 任務
1. 查證：在 Windows 上重現「帶 pipe 啟動 BAT → holder 繼承 → 呼叫端等不到 `close`」（單元或 e2e 層級擇可行者；不在本機跑安裝檔）。確認哪些 handle 被繼承（只記類型與數量，不記內容）。
2. 修正：讓 holder 只拿到它需要的 stdio 與 `ipc`，不帶走 BAT 主行程從啟動者繼承來的 handle。作法由你查證後選（例如 BAT 主行程啟動時處理繼承來的標準 handle、或 holder 的啟動方式）；🔴 不得改變 holder 的 pid 關係、`ipc` 通道、env、cwd、`detached` / `windowsHide`、日誌內容，以及 T0859 / T0861 的接回行為。沒有可靠作法 → 依停止條件回報。
3. 測試：單元測試守住新規則；e2e 或 W6 spec 加一項「帶 pipe 啟動 BAT、升級後呼叫端能拿到 `close`」（可沿用 T0862 spec 的 spawn＋CDP 架構，加一個以 pipe 啟動的情境或檢查）。
4. 重跑 W6：`desktop-build.yml` 打 A、B 兩版（建自含修正的 `main`），跑 `windows-upgrade-acceptance.yml`，情境 1–9 全 PASS。
5. 文件：`docs/agent-guide/pty-holder.md`（已知限制 / 規則）、`terminal-server-recovery.md`「從 PTY holder 啟動」視需要補一句；`CLAUDE.md`「Windows PTY holder」節若新增必守規則補一行（≤ 100k 字元）。BUG-213 檔補修正 commit、狀態改 `FIXED`。

## 驗收條件
- [ ] 重現與修正後對照（被繼承 handle 的類型 / 數量、呼叫端拿到 `close`）
- [ ] W6 情境 1–9 全 PASS（附 run id），另加帶 pipe 啟動的檢查 PASS
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] CLAUDE.md ≤ 100k 字元（回報實際字元數）
- [ ] commit 只含本單範圍；BUG-213 → `FIXED`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：PARTIAL（依停止條件：修正需要新增原生程式碼；任務 1 完成，任務 2–5 未做，等塔台決定）
- **session_id**：b6dcbaaa-3547-4d3f-85b4-3d3adb07c3bb
- **開始 / 完成**：2026-11-05 09:38 / 09:42 (UTC+8)

### 落點檢查
- **結果**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3：`affects_files` 的路徑都在（含 `e2e/`、`electron/__tests__/`）；C-2：工單沒有 `branch` 欄位（目前 `main`）。
- `CT_HOME` 未設定（不在 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`；`BAT_REMOTE_TOKEN` 已設定。

### 查證結果（任務 1）
在開發機用 repo 內的 Electron `45.2.1` 二進位（`node_modules/electron/dist/electron.exe`）重現，沒有跑安裝檔、沒有碰本機 BAT 安裝版與它的 Terminal Server。腳本在 scratchpad（沒有進 repo）：

- 呼叫端（Node）以 Playwright `_electron.launch` 的 stdio `['ignore','pipe','pipe','pipe','pipe']`（`playwright-core/lib/server/utils/processLauncher.js:106`，electron 傳 `stdio: "pipe"`）啟動 Electron。
- Electron 主行程以 holder 的同一組選項（`spawn`、`detached: true`、`stdio: ['ignore','ignore','ignore','ipc']`、`windowsHide: true`、`cwd` 另設）起一個持續 20 s 的純 node 子程序，1.5 s 後 `app.exit(0)`。呼叫端等 `close` 的上限 8 s。

| 情境 | 呼叫端 `exit` | 呼叫端 `close` | 沒關的 handle |
|---|---|---|---|
| Electron 父程序、`spawn`（holder 路徑），呼叫端用 pipe | 1623 ms | ❌ 8 s 內沒有 | **4 個 pipe**（fd 1、2、3、4，就是呼叫端給的全部 pipe） |
| 同上，呼叫端 `stdio: 'ignore'`（T0862 spec 的繞法） | 1612 ms | ✅ 1612 ms | 無 |
| Electron 父程序、`child_process.fork`（**沒有 holder 的舊路徑**），呼叫端用 pipe | 1618 ms | ❌ 8 s 內沒有 | 4 個 pipe（fd 1–4） |
| 純 Node 父程序、同樣的 `spawn` 選項，呼叫端用 pipe | 1555 ms | ✅ 1555 ms | 無 |

結論：
1. 重現了 BUG-213：holder 拿到的是呼叫端給 BAT 的全部 pipe（類型：匿名 pipe，數量 = 呼叫端開的 pipe 數，Playwright 是 4 個）。
2. **不是 holder 才有**：沒有 holder 的 fork 路徑一樣會繼承。T0859 之前，BAT 結束時保留 Terminal Server（Recovery「保留」的情境）就會讓帶 pipe 的呼叫端等不到 `close`。holder 只是讓「升級後保留」也變成會發生的情境。
3. 原因：Windows 上 libuv `uv_spawn` 用 `CreateProcessW(bInheritHandles = TRUE)`（`ipc` 與 stdio 都靠繼承傳過去），沒有 `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`，所以父程序裡**所有**可繼承的 handle 都會傳下去。純 Node 啟動時會呼叫 libuv `uv_disable_stdio_inheritance()`（把繼承來的標準 handle 與 `STARTUPINFO.lpReserved2` 的 CRT fd 設為不可繼承），所以純 Node 父程序沒有這個問題；Electron 45.2.1 的主行程沒有呼叫它（第 1、4 列的差異）。

### 為什麼停下（任務 2）
修正只有兩條路，兩條都需要原生程式碼：
- BAT 主行程把繼承來的 handle 設為不可繼承（`GetStdHandle` ×3 ＋ `GetStartupInfoW` 的 `lpReserved2` → `SetHandleInformation(h, HANDLE_FLAG_INHERIT, 0)`，也就是 libuv `uv_disable_stdio_inheritance` 做的事）；
- 或用 handle list（`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`）建立 holder。

JS 層查過的作法都不可行：
- `child_process` 沒有對應的選項；
- 關掉 fd 0–2 再開 NUL：Electron 是 GUI 程式，UCRT 不會更新 `GetStdHandle`，標準 handle 會指向已關閉（之後可能被重用）的值，Chromium 的 stderr 輸出可能寫進別的 handle；呼叫端也收不到 BAT 的輸出；
- 經中介程序（純 node 或 `utilityProcess`）再起 holder：中介程序一樣會收到這些 handle（它不知道 handle 值，關不掉），而且會改變 pid 關係與 `ipc` 通道（工單禁止）；
- 透過 WMI / `Start-Process` 起 holder：不會繼承，但 holder 就不是 BAT 的子程序、沒有 `ipc`（工單禁止）。

這正是停止條件（「修正需要新增原生模組 … 或沒有可靠作法 → 不硬做，停下回報 PARTIAL」），所以沒有改任何產品檔，任務 2–5（含 W6 重跑、文件、BUG → `FIXED`）都沒做。

### 選項與代價（由塔台決定）
| 選項 | 作法 | 代價 / 風險 |
|---|---|---|
| **A. 小型 N-API addon**（建議，如果要修） | 一個 win32 才載入的 C 函式 `setStdioInheritable(bool)`：只處理 `GetStdHandle` ×3 與 `lpReserved2` 列出的 CRT handle。`forkTerminalServer` 在 holder `spawn` 前同步設成不可繼承、`spawn` 後立刻還原（JS 單執行緒，中間沒有別的 spawn；Chromium 自己起子程序用 handle list，不受影響）。holder 與 fork 兩條路可以只改 holder，也可以一起修 | 新增原生模組：MSVC / node-gyp 建置（N-API 不綁 Electron ABI，可以 prebuilt 進 repo 或在 CI 建）；要改 `verify-native-modules.js`、打包白名單、`asarUnpack`、win32-arm64 是否支援；要決定 `allowScripts` 政策（CLAUDE.md「本機開發：npm 12 install scripts」）。如果改成在啟動時就設定（不還原），BAT 的其他子程序（git、claude、codex、direct PTY）也會不再繼承呼叫端的 pipe，算是行為改變 |
| B. koffi（FFI）呼叫 kernel32 | 作法同 A，用現成的 prebuilt FFI 套件，不用自己編譯 | 一樣是新增原生相依（數 MB、各平台 binary）；FFI 能呼叫任意 DLL，權限面比 A 大；打包與白名單成本同 A |
| C. 自帶小型 C 啟動器（holder 前面再加一個 exe） | 啟動器用 handle list 起 holder | 改變 pid 關係與 `ipc`，違反本單的不變式；不建議 |
| **D. 列為已知限制**（建議 `0.7.5-pre.1` 先用這個） | 不改程式；在 `docs/agent-guide/pty-holder.md`「已知限制」寫明：帶 pipe 啟動 BAT、而且呼叫端會等 pipe 關閉（Playwright、擷取輸出的腳本、部分 IDE task runner）時，BAT 結束後如果保留了 Terminal Server（升級或 Recovery「保留」），呼叫端要等 Terminal Server 結束才拿到 `close`；繞法是以 `stdio: 'ignore'` / `Start-Process` 啟動 BAT。BUG-213 改 `WONTFIX` 或延後（R-G003：`CLOSED`（延後）並列進待辦） | 不修。影響面小：從檔案總管、開始功能表、捷徑、安裝程式重開都沒有 pipe；而且這是 T0859 前就有的行為（fork 路徑一樣），不是 holder 帶進來的回歸 |
| E. 回報 Electron 上游 | 請 Electron 主行程啟動時呼叫 `uv_disable_stdio_inheritance()`（與 Node 一致） | 時程不可控；可以和 D 並行 |

建議：`0.7.5-pre.1` 走 **D**（加上可選的 E），因為這是既有行為、嚴重度 low，而且修正需要原生模組。如果之後要修，另開工單走 **A**，限定在 Terminal Server 的 `spawn` / `fork` 前後設定、之後還原（holder 與 fork 兩條路一起修），並重跑 W6。D 的文件修改與 BUG 狀態變更，等塔台決定後再做（本單沒有先寫）。

### 變更檔案
- `_ct-workorders/BUG-213-pty-holder-inherits-launcher-handles.md`：補〈查證（T0865）〉一節，`updated_at` 更新；狀態維持 OPEN。
- 本工單：狀態與回報區。
- 產品檔：**沒有改動**。

### 驗證
- 原始碼 / 文件：不適用（沒有產品變更）。
- build / test（`typecheck`、`typecheck:electron`、`test:unit`、`test:legacy`、`vite build`）：**沒跑**，因為沒有產品變更。
- W6：**沒跑**（沒有修正可驗）；沒有 push、沒有觸發任何 workflow。
- CLAUDE.md：沒有修改。

### Commit
- 產品 commit：無。
- 工單 commit：本工單與 BUG-213（commit 訊息含 `T0865`），沒有 push。

### 遭遇問題
- 修正需要原生程式碼 → 依停止條件停下（見上）。

### 互動紀錄
- [09:38] 開工（yolo；依工單停止條件，不向使用者提問）。
- [09:40] 查證完成：4 個 pipe 被繼承、fork 路徑也一樣、純 Node 不會 → 判定需要原生程式碼，依停止條件回報 PARTIAL，不改產品檔。

### 後續建議
1. 塔台在 D / A 之間做決定（見〈選項與代價〉）。選 D：開一張小單補 `pty-holder.md`「已知限制」（含「T0859 前的 fork 路徑一樣」）並把 BUG-213 改成延後；選 A：另開工單，包含原生模組的建置 / 打包決策與 W6 重跑。
2. 不論選哪個，T0862 spec 的繞法（以 `stdio: 'ignore'` ＋ CDP 啟動）維持不變。
