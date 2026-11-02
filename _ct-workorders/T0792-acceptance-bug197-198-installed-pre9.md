---
schema_version: 1
schema_kind: workorder
id: T0792
title: "驗收 BUG-197 / BUG-198：以安裝版 `v0.7.3-pre.9` 跑 e2e `t0787` 多輪與 `t0694` 步驟 6（隔離實例＋假模型）"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T22:40:55+0800"
updated_at: "2026-11-02T23:00:38+0800"
completed_at: "2026-11-02T23:00:38+0800"
started_at: "2026-11-02T22:43:06+0800"
session_ids:
  - "0f5a9e39-1af4-4654-9f43-af05129bf7e8"
depends_on: []
related:
  - "BUG-197（medium，FIXED，T0790 `77ad79ea`，pre.8 起）；BUG-198（low，FIXED，T0791 `20bc7a88`，pre.9）；BUG-196（T0788，使用者實機驗收另做）；D233（驗收順序）；D234"
  - "安裝版自動化驗收前例：T0770 / T0771 / T0772 / T0777（`BAT_E2E_EXECUTABLE` 指向安裝版 exe，見 `e2e/fixtures/electron-isolation.ts` 第 18 行 T0510 註解）"
  - "`e2e/t0787-notify-into-blocked-tower.spec.ts`（T0790 拿掉 RACE 重跑 3 輪 30 情境 races 0）、`e2e/t0694-worker-resumed-badge.spec.ts`（T0791 新增步驟 6：晚到的 `stop`）"
affects_files:
  - _ct-workorders/T0792-acceptance-bug197-198-installed-pre9.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 受測對象是**已安裝的** `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（`v0.7.3-pre.9`，第一百零八 session NSIS 重裝驗收 PASS）：先確認 FileVersion = `0.7.3-pre.9`、安裝版 `resources\\scripts\\bat-terminal.mjs --version` = `v0.7.3-pre.9`，不符就停下回報 BLOCKED。e2e 以 `BAT_E2E_EXECUTABLE` 指向它（隔離實例 `--runtime=<id>`），不要用 source build 代替；若某支 spec 實際仍用 repo 的 `scripts/` helper 或 hook 腳本而非安裝版 `resources/scripts`，在回報區寫明實際來源（安裝版的 hook 由安裝版 BAT 自己注入，以日誌或 `--settings` 檔路徑佐證）。"
  - "🔴 驗收項目：① BUG-197：`t0787` 跑 **3 輪**（每輪完整情境，含 UI 與 codex 情境；codex 找不到就記 skipped），記錄每輪通過數與 `races`（日誌中 `→ cleared (hook user-prompt-submit)` 出現在對話框仍在時的次數）及 `[blocked] … kept: … reported late` 出現次數。判準：3 輪全綠、races 0。② BUG-198：`t0694` 實跑（含步驟 6「晚到的 `stop` 不結束較晚開始的回合」），跑 **3 次**，記錄 `[turn] … kept: … reported late` 出現次數。判準：3 次全綠。③ 有任何失敗 → 單檔重跑 1 次判斷是偶發還是穩定失敗，兩次結果都記；不得改 spec 或產品程式碼讓它通過。"
  - "🔴 只驗收、不修：不改任何產品程式碼、spec、fixture。若 spec 需要的前置（例：`npx vite build` 才有的檔案）在安裝版模式下缺漏導致無法執行，先問塔台，不自行改 spec。BUG-197 / BUG-198 的狀態由塔台改，Worker 不動 BUG 單與 `_bug-tracker.md`。"
  - "🔴 隔離：一律隔離實例＋假模型（`fixtures/fake-anthropic-api.ts`），真實模型花費 0；不碰使用者正在用的 BAT 視窗、塔台分頁與 `%APPDATA%\\BetterAgentTerminal`。e2e 一律帶自己的 `--output`（例：系統暫存目錄下的 `t0792-<時間>`），不清、不寫共用的 `e2e-results/`；`cd` 失敗就中止，不得在 repo 根目錄跑整套 e2e（L180）。同一 checkout 有 T0793 並行（改 `src/lib/remote-tools/__tests__/nvm-login-profile.test.ts`、跑 `test:unit`），不得碰它的檔案；機器負載可能較高，回報區註明。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本工單檔（`git commit --only`）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）：回報區的路徑把使用者家目錄寫成 `<使用者資料夾>`。完成狀態寫 `DONE`（驗收結論 PASS / FAIL 寫在回報區）。"
---

# T0792 — 驗收 BUG-197 / BUG-198（安裝版 pre.9）

## 元資料

- **工單編號**：T0792
- **類型**：verification（安裝版自動化驗收）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T22:40:55+0800
- **預估規模**：S

## 目標

BUG-197（T0790，pre.8 起）與 BUG-198（T0791，pre.9）都是 hook 回報亂序造成的狀態錯誤，修正時以 source build 驗證。本單用交付版 `v0.7.3-pre.9` 的安裝版 exe 重跑相同 e2e，作為兩張 BUG 改 CLOSED 的依據（R-G003：修正進入交付版並實測過）。

## 範圍

1. 確認安裝版版號。
2. `t0787` 跑 3 輪（BUG-197）。
3. `t0694` 跑 3 次（BUG-198，含步驟 6）。
4. 回報區列出每輪結果、日誌計數、helper / hook 實際來源、結論 PASS / FAIL。

## 不做

- 不改產品程式碼、spec、fixture；不改 BUG 單與 tracker；不用真實模型。

## 驗收

- [x] 安裝版版號確認
- [x] `t0787` 3 輪結果與 races 計數
- [x] `t0694` 3 次結果（含步驟 6）
- [x] helper / hook 實際來源
- [x] 結論：BUG-197 PASS、BUG-198 PASS

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（驗收結論：**BUG-197 PASS、BUG-198 PASS**）
- **開始**：2026-11-02T22:43:06+0800；**完成**：2026-11-02T23:00:38+0800
- **session_id**：0f5a9e39-1af4-4654-9f43-af05129bf7e8

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 只有本工單檔（`_ct-workorders/` 下，排除）→ not applicable
- C-2：工單無 `branch` 欄位；目前 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### ① 安裝版版號

| 項目 | 結果 |
|---|---|
| `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` FileVersion | `0.7.3-pre.9`（ProductVersion `0.7.3.0`，LastWriteTime 2026-11-02 22:27:28） |
| 安裝版 `resources\scripts\bat-terminal.mjs --version` | `bat-terminal.mjs v0.7.3-pre.9`（exit 0） |
| 安裝版 `resources\package.json` | `{"name":"better-agent-terminal","version":"0.7.3-pre.9"}` |
| 安裝版內嵌 claude（`app.asar.unpacked\node_modules\@anthropic-ai\claude-code`） | `2.1.316` |

e2e 每次啟動的日誌都記 `executable=C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，debug log 第一行 `argv=C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe … --runtime=e2e-…`。

### ② BUG-197：`e2e/t0787-notify-into-blocked-tower.spec.ts` 3 輪

執行方式：`BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe' T0787_RUNS=1 npx playwright test e2e/t0787-notify-into-blocked-tower.spec.ts --output <系統暫存目錄>\…\t0792-<時間>-t0787-<n>`，整支 spec 跑 3 次。我把「3 輪（每輪完整情境，含 UI 與 codex）」解讀為：每輪是一次完整的 spec 執行，含 10 個對話框情境、UI「待送 N」與 codex ⑤。3 輪合計 30 個情境，與 T0790（`T0787_RUNS=3` 一次）的樣本數相同。

| 輪 | 時間 | 結果 | 情境（`$T0787_RESULTS`） | races | lateReports（`[blocked] … kept: hook … reported late`） | `[notify-hold] held` | codex ⑤ |
|---|---|---|---|---|---|---|---|
| 1 | 22:46:08–22:49:59 | **2 passed（3.8m）** | ①②①d②d③④p④a⑤⑥p⑥a＋ui，11 / 11 | 0 | 0 | —（日誌未擷取，見〈遭遇問題〉） | PASS（codex 0.166.0，18.0s；held 2） |
| 2 | 22:50:26–22:54:22 | **2 passed（3.9m）** | 11 / 11 | 0 | 0（debug log 計數 0） | 18 | PASS（15.1s；held 2） |
| 3 | 22:55:18–22:59:13 | **2 passed（3.9m）** | 11 / 11 | 0 | 0（debug log 計數 0） | 18 | PASS（15.8s；held 2） |

- `races` 取自 spec 輸出（`hook-order races (blocked cleared before the notify): 0`，3 輪皆同）；另在第 2、3 輪 debug log 數 `cleared (hook user-prompt-submit)`：0 次。
- `cleared (user input)` 第 2、3 輪各 10 行：這是每個情境最後「使用者在塔台分頁按 Enter 回答對話框」造成的。spec 有斷言「Worker 的 Enter 不算使用者輸入」，3 輪都通過。
- 假模型：spec 斷言 blocking proxy 沒有收到任何 `api.anthropic.com` 連線（通過），真實模型花費 0。
- 塔台分頁在背景（`towerTab: background`），claude `2.1.316`。

### ③ BUG-198：`e2e/t0694-worker-resumed-badge.spec.ts` 3 次（含步驟 6）

執行方式：`BAT_E2E_EXECUTABLE='…\BetterAgentTerminal.exe' npx playwright test e2e/t0694-worker-resumed-badge.spec.ts --output <系統暫存目錄>\…\t0792-<時間>-t0694-<n>`。

| 次 | 時間 | 結果 | `[turn] … kept: … reported late` | 內容 |
|---|---|---|---|---|
| 1 | 22:44:26–22:44:43 | **1 passed（15.0s）** | 1 | `kept: hook stop happened 13.8ms before the current turn (reported late)` |
| 2 | 22:45:01 起 | **1 passed（19.2s）** | 1 | `… 14.4ms …` |
| 3 | 22:45:25 起 | **1 passed（16.9s）** | 1 | `… 3.7ms …` |

步驟 6（`spec.ts:285` 斷言 `[turn] … kept:` 日誌、`↻` 維持、下一個 `stop` → `✓`）3 次都通過。

### ④ helper / hook 的實際來源

- **spec 直接執行的 helper**：兩支 spec 都用 **repo 的 `scripts/`**，不是安裝版的 `resources/scripts`：`runHelper` 呼叫 `path.join(REPO_ROOT, 'scripts', script)`；`t0694` 的 Worker 腳本也從 repo `scripts/` 執行 `bat-hook.mjs` / `bat-notify.mjs`；`t0787` 的 Worker 從 repo `scripts/` 執行 `bat-notify.mjs` / `bat-mcp.mjs`。
  - 比對 SHA-256：`bat-hook.mjs`、`bat-notify.mjs`、`bat-terminal.mjs`、`bat-mcp.mjs` 四支，repo HEAD 與安裝版 `resources/scripts` **完全相同**（例：`bat-hook.mjs` `a755a4879fcae15a…`）。`git log v0.7.3-pre.9..HEAD -- scripts electron src` 沒有任何 commit，所以兩邊是同一份程式碼。
  - 因此 BUG-198 的 `t0694` 是「安裝版 BAT 主行程（tracker）＋與安裝版逐位元相同的 repo hook 腳本」。
- **t0787 塔台（claude）的 hook**：由安裝版 BAT 自己注入。debug log 記錄 `[bat-mcp] tab agent=claude-cli … injected: '--mcp-config=…\bat-mcp\claude.json' '--settings=…'`。擷取到的 `<userData>\bat-mcp\claude-settings.json` 內每個 hook 都是 `node 'C:/Program Files/BetterAgentTerminal/resources/scripts/bat-hook.mjs' <event>`（每份 10 處），第 2、3 輪都有擷取。
- 塔台分頁的 claude 由安裝版 BAT 啟動（安裝版內嵌 `2.1.316`）。spec 讀 repo `node_modules` 的 `claude.exe` / `package.json` 只用來檢查檔案存在和標示版本，也是 `2.1.316`。
- codex ⑤：使用 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`（0.166.0），沒有 codex hook（OSC 7501）。

### 驗收結論

| BUG | 判準 | 結果 |
|---|---|---|
| BUG-197 | `t0787` 3 輪全綠、races 0 | **PASS**：3 / 3 輪 2 passed，30 個對話框情境＋3 次 UI＋3 次 codex ⑤ 全部通過，races 0。lateReports 0：這 3 輪沒有自然發生亂序，與 T0790 一樣，晚到路徑由 T0790 的單元與真實程序測試涵蓋 |
| BUG-198 | `t0694` 3 次全綠（含步驟 6） | **PASS**：3 / 3 次 1 passed，`[turn] … kept: … reported late` 每次 1 行（步驟 6 刻意製造的亂序） |

沒有任何失敗，所以沒有單檔重跑。

### 隔離與環境

- 每次都是隔離實例（`--runtime=e2e-…`）＋假模型。`t0787` 的 userData 在 spec 的暫存 home 下，`t0694` / `t0788c` 在 `%APPDATA%\BetterAgentTerminal-runtime-e2e-…`。每次 teardown 都記錄 `runtime userData removed: true` 與 `Terminal Server pid … alive after teardown: false`（t0787 共 6 次、t0694 共 3 次）。沒有碰使用者的 `%APPDATA%\BetterAgentTerminal`、使用中的 BAT 視窗或塔台分頁。
- `--output` 一律放在系統暫存目錄下的 Worker 暫存區。共用的 `e2e-results/` 沒有寫入（mtime 停在 19:20）。
- T0793 在同一 checkout 並行，它的 `BUG-199`、`T0793`、`_bug-tracker.md` 是 dirty 狀態，本單沒有碰。負載可能較高，但 t0787 每輪 3.8–3.9m（T0790 source build 的 `T0787_RUNS=3` 是 9.9m），沒有逾時。
- 證據擷取：teardown 會刪掉 userData，所以執行期間用背景 PowerShell 每 1.5 s 把 `Logs/`、`bat-mcp/` 複製到 Worker 暫存區（不進 repo），跑完已停止。
- `%APPDATA%` 下另有一個舊的 `BetterAgentTerminal-runtime-e2e-t0609-1793616886860` 目錄，比本單早，是其他工作留下的。本單沒有動它，僅記錄。

### 遭遇問題

- 第 1 輪 `t0787` 時，背景監看只掃 `%APPDATA%`，沒抓到 spec 暫存 home 下的 userData，所以第 1 輪沒有 debug log 與 `claude-settings.json` 副本。第 1 輪的 races / lateReports 取自 spec 輸出與 `$T0787_RESULTS` JSON。補上第二個監看後，第 2、3 輪都有完整擷取。這不影響判定：判準的 races 數取自 spec 本身。

### 修改檔案

- `_ct-workorders/T0792-acceptance-bug197-198-installed-pre9.md`（只有本檔；沒有改產品程式碼、spec、fixture、BUG 單或 tracker）

### Commit

- 不需要產品 commit。本工單檔以 `git commit --only` 提交（hash 見 git log）。不 push。

### 互動紀錄

- 無（yolo，沒有提問塔台；「3 輪」的解讀已在 ② 寫明）。

### 後續建議

- 塔台可以依本單把 BUG-197 / BUG-198 改為 CLOSED（交付版 `v0.7.3-pre.9` 實測）。
- 可選：e2e spec 的 helper 目前固定用 repo `scripts/`。若日後需要嚴格驗「安裝版 helper」，可以另開工單讓 spec 在 `BAT_E2E_EXECUTABLE` 模式下改用 `<安裝目錄>\resources\scripts`。本次兩邊逐位元相同，不影響結論。
