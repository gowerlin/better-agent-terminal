---
schema_version: 1
schema_kind: workorder
id: T0892
title: "研究：檢查 `v0.8.0-pre.1` 安裝後的日誌與程序記憶體，找非預期問題（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:31:29+08:00"
updated_at: "2026-11-25T00:37:30+08:00"
started_at: "2026-11-25T00:32:37+08:00"
completed_at: "2026-11-25T00:37:30+08:00"
session_ids:
  - "44342282-c028-410c-b1d4-bd80d17d37d0"
depends_on: []
related:
  - "D317（使用者 2026-11-25：pre.1 實際使用觀察多分頁大量輸出與記憶體，也檢查 0.8.x 的 log 有沒有非預期問題）"
  - "PLAN-066；D307 / D309–D315；T0886–T0890（共用 conout Worker、`--max-semi-space-size=1`）；BUG-214（延後，已知限制：反覆開關分頁的 V8 高水位）、BUG-215（CLOSED）"
  - "CLAUDE.md「Logging」「Terminal Server 存活判定與 recovery」「Windows PTY holder」「Linux …」各節；`docs/agent-guide/logging.md`、`docs/agent-guide/pty-holder.md`、`docs/agent-guide/terminal-server-recovery.md`"
affects_files:
  - _ct-workorders/T0892-research-v080-pre1-log-review.md
renew_count: 0
互動模式: disabled
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀：只能寫本工單檔（`git commit --only _ct-workorders/T0892-research-v080-pre1-log-review.md`）。不改產品程式、不開 BUG / PLAN 檔、不改任何 `_ct-workorders/_*` 檔（BUG 由塔台依本單結論開）。不切分支、不 push。"
  - "🔴 不干擾使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）：不結束、不重啟、不附加 debugger 到任何 BAT / Terminal Server / `bat-pty-holder` / shell 程序；不安裝 / 解除安裝；不改 Settings（含 Debug Logging 等級）；不呼叫會改變狀態的 helper（只允許 `bat-terminal.mjs --version` 與 BAT MCP 唯讀 tool）。程序資訊只用唯讀查詢（例 PowerShell `Get-Process` / `Get-CimInstance Win32_Process` 讀 WorkingSet / PrivateMemorySize / 命令列的執行檔路徑）。"
  - "🔴 讀日誌：`%APPDATA%\\BetterAgentTerminal\\Logs\\` 下 2026-11-24 03:35（`v0.8.0-pre.1` NSIS 重裝驗收）之後的檔：`debug-20261124-033627.log`、`debug-20261124-033706.log`、`debug-20261124-101607.log`（目前這次啟動，仍在寫入，約 2.9 MB）、`bat-scripts.log`（約 5.8 MB，只看 2026-11-24 03:35 之後的紀錄）；同目錄若有 Terminal Server / holder 相關日誌一併看。大檔用 `Select-String` / 分段讀，不要整檔載入。比對基準可看一份 pre.1 之前的日誌（例 `debug-20261123-203319.log`，`0.0.0-exp.18`）判斷某訊息是否新出現。"
  - "🔴 隱私（公開 repo，D176）：回報區不得貼權杖（`batcap.`、server token）、env 值、PTY 輸出內容、claude / codex 對話內容、完整 session id（只寫前 8 碼）、使用者家目錄（寫 `<使用者資料夾>`）、客戶 / 專案真名（工作區名稱一律寫「工作區A / B …」）。引用日誌只摘訊息類別與必要欄位（時間、模組 tag、錯誤碼、數量），每類最多 3 行樣本並去識別。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。不開會耗 token 的 claude / codex turn。"
---

# T0892 — 研究：`v0.8.0-pre.1` 安裝後的日誌與記憶體檢查

## 研究目標

使用者正在實際使用 `v0.8.0-pre.1`（2026-11-24 03:35 安裝；目前這次 BAT 啟動於 2026-11-24 10:16，已執行約 14 小時），要求在決定把 `v0.8.x` 併回 main 之前，檢查日誌有沒有非預期問題，並觀察多分頁大量輸出與記憶體。

要回答：

1. 日誌中有沒有 **錯誤 / 例外 / 非預期警告**（依類別彙總：次數、第一次與最後一次時間、模組 tag），哪些是 pre.1 之前就有的、哪些是新出現的。
2. **`v0.8.x` 新功能相關**的紀錄是否正常：Windows Terminal Server 共用 conout Worker（T0886–T0890）、PTY holder（PLAN-065，本機為 per-machine holder）、`--max-semi-space-size=1`、`[gpu]`、heartbeat / recovery（`[heartbeat] late pong`、`handleServerDeath`）、`[pty-fd-guard]` 等。有沒有 Worker 重啟、conout 斷線、recovery、孤兒清理、hello 協商失敗。
3. **記憶體**：目前 BAT 主行程、renderer、GPU、Terminal Server / holder、共用 conout Worker 等程序的 WorkingSet / Private（唯讀查詢），以及分頁數（BAT MCP `bat_list_terminals` 可見範圍或日誌）；與 T0889 / T0890 的量測（10 分頁 38.8 MB 等）比較是否合理，有沒有持續成長的跡象（日誌若有記憶體紀錄就看趨勢）。
4. `bat-scripts.log`：helper 派工 / notify / close-worker 的失敗紀錄（exit 非 0、`RECOVERY_PENDING`、`held-full`、逾時）。

## 已知資訊

- 已知限制：BUG-214（反覆開關分頁後 V8 高水位不回落，已延後）不要當成新問題，但若幅度明顯超過 T0890 量測要寫出來。
- pre.1 NSIS 重裝驗收 PASS（2026-11-24 03:35，`bat-nsis-acceptance-20261124-033551`）。
- 日誌位置與格式見 CLAUDE.md「Logging」與 `docs/agent-guide/logging.md`。

## 調查範圍

- 日誌檔（見 `memory_overrides` 第 3 條）。
- 程序唯讀查詢。
- 必要時讀 `v0.8.x` 分支的原始碼判斷某條日誌是否預期（`git show v0.8.x:<path>` 或 `git grep <pattern> v0.8.x`，不 checkout）。

## 研究指引

- 先用 `Select-String` 抓 `error|exception|fail|warn|uncaught|unhandled|crash|ENOENT|EPIPE|ECONNRESET|timeout|recovery|restart|exit code` 等關鍵字，依模組 tag 分組計數，再逐類判讀。
- 每一類給判定：**預期**（附依據：原始碼位置或 docs）／**既有問題**（pre.1 之前就有）／**新問題**（需塔台決定是否開 BUG）。
- 新問題要寫：現象、出現次數與時間、可能影響、建議的下一步（開 BUG / 再觀察 / 補日誌）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
DONE —— 四個研究問題都有答案。**沒有找到 `v0.8.x` 帶來的新問題**；找到 3 項既有行為（不是回歸）可由塔台決定是否開單。
- **session_id**：44342282-c028-410c-b1d4-bd80d17d37d0

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 不適用（`affects_files` 只有本工單）；C-2 工單沒有 `branch` 欄位（目前 `main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 互動紀錄
- 無提問（判讀都能由原始碼 / docs 決定）。
- 唯讀遵守：只讀日誌、`Get-Process` / `Get-CimInstance Win32_Process`（WorkingSet / Private / 執行緒 / handle / 執行檔路徑 / 命令列中的旗標）、BAT MCP `bat_list_terminals`；`git show` / `git grep` / `git diff --stat` 讀 `v0.8.x`，不 checkout。沒有結束 / 重啟 / 附加任何程序，沒改 Settings，沒呼叫會改變狀態的 helper。

### 調查結論

**範圍**：`debug-20261124-033627.log`（安裝程式的 `--uninstall-quit-request`，4 行）、`debug-20261124-033706.log`（重裝後第一次啟動，19:37–19:56Z，使用者正常結束）、`debug-20261124-101607.log`（本次啟動 2026-11-24 02:16Z 起，24,8xx 行 / 2.98 MB）、`bat-scripts.log` 2026-11-23 19:37Z 之後 10,138 筆。對照基準 `debug-20261123-203319.log`（`0.0.0-exp.18`）、`debug-20261123-095023.log`。日誌時間為 UTC（03:35 本地 = 19:35Z）。

**`v0.8.x` 改了什麼（判斷新 / 既有的依據）**：`git diff --stat <merge-base> v0.8.x -- src electron` 只有 `electron/pty-holder.ts`、`electron/terminal-server/server.ts`、`electron/terminal-server/shared-conout{.ts,-worker.cjs}`（＋測試）。主行程其他模組與 renderer 沒改，所以下面主行程 / renderer 的現象都屬既有程式。

#### 1. 錯誤 / 例外 / 警告（關鍵字＋ `[ERROR]` / `[WARN]` 分組）

| 類別（模組 tag） | 次數 | 時間（UTC） | 判定 |
|---|---|---|---|
| `[RENDERER] [ct-overview] _tower-state.md summary ignored: YAML parse error: unknown escape sequence` | 347 | 11-24 08:11 → 12:25 | **既有行為**（T0701，`ControlTowerPanel.tsx:506`，2026-10-25 起在 main）。觸發的是另一個工作區（工作區A）的 `_tower-state.md` frontmatter 有雙引號字串內的反斜線（Windows 路徑）。每次 `fs.watch` → `reloadAll` 就記一次，而且 js-yaml 錯誤訊息自帶**多行原文摘錄**（每次約 8 行、含該工作區塔台狀態內容），合計 2,776 行 / 222 KB（本檔 7.5%）。12:25Z 後不再出現（推測該檔已修正）。見〈建議方向〉B。 |
| `[RENDERER] [terminal-paste] clipboard:read-image-data-url failed … Image too large (48563050 > 10485760 bytes)` 等 | 3（＋各 1 行 `clipboard image check failed, pasting text {}`、`Ctrl+V paste failed {}`） | 08:43:15、09:49:40、09:49:44 | **既有行為**（`electron/image-attachments.ts:82` 10 MiB 上限、`src/lib/terminal-paste.ts` 的退回路徑；`v0.8.x` 沒改）。剪貼簿 PNG 分別 50.9 MB / 36.5 MB。前兩次退回 `navigator.clipboard.read()` 判定有圖、照送貼圖鍵；第三次 `navigator.clipboard.read()` 與 `readText()` 都丟例外 → 這次 Ctrl+V 沒有任何效果，畫面也沒提示。另外錯誤物件記成 `{}`（DOMException 序列化後沒有訊息）。見〈建議方向〉A。 |
| `[WARN] [RemoteServer] Helper invoke denied: channel=question:answer role=tower … reason=tower-not-bound` | 1 | 11:16:25 | **預期**（呼叫端用錯）：`bat-scripts.log` 同時刻 `bat-terminal answer` 的 `--notify-id` 給的是 Worker 的 id，不是塔台自己；6 秒後同一題重送成功（`answered … waited=21159`）。授權規則見 `electron/__tests__/tower-questions.test.ts:254`。 |

- 沒有：`uncaught` / `unhandled` / `crash` / `render-process-gone` / `unresponsive` / `did-fail-load` / `EPIPE` / `ECONNRESET` / GPU process 掉線。`Crashes\` 目錄 2026-11-20 之後沒有新 dump（只有 `settings.dat`）。
- 基準日誌（`0.0.0-exp.18` 與 11-23 那次）同樣幾乎沒有錯誤（只有 `[BUG-129] dispatch cwd outside the landing workspace` WARN 3 行，屬 T0527 預期檢核）。**沒有任何類別是 pre.1 才新出現、且與 `v0.8.x` 改動相關的。**

#### 2. `v0.8.x` 新功能相關紀錄

| 項目 | 觀察 | 判定 |
|---|---|---|
| PTY holder（per-machine） | 兩次啟動都是 `[pty-holder] Terminal Server from holder 24.22.2-7a21c053bf76 (per-machine), verified in 427 / 437 ms` → `[stdio-inherit] … 0 inherited handle(s); 0 restored` → `[terminal-server] started with pid …` → `[PtyManager] Terminal Server connected via IPC — proxy mode active` | 正常 |
| `--max-semi-space-size=1` | holder 程序（`bat-pty-holder.exe`，目錄 `24.22.2-7a21c053bf76`）命令列含 `--max-semi-space-size=1` | 正常（T0890 生效） |
| 共用 conout Worker（T0886–T0890） | 日誌**看不到** `[shared-conout] installed / skipped / worker error / worker exited` | **預期（已知限制）**：這些行寫在 server 的 stderr，Windows 的 fork / holder stdio 是 `ignore`（`docs/agent-guide/terminal-server-recovery.md` 第 294、352、428 行）。間接證據見下方記憶體段：8 個 PTY 時 holder 只有 17–18 個執行緒、conhost 數 = 存活 shell 數。 |
| heartbeat / recovery | `late pong` / `handleServerDeath` / `re-forked` / `orphan` / `recovery` / `interrupted` 全部 0 次（14 小時、52 個 PTY 建立） | 正常 |
| hello 協商 | 本機走 IPC，沒有 TCP hello，0 行 | 預期 |
| 升級 / 結束 | 安裝時 `[installer-quit] no running BAT and no Terminal Server — nothing to do`；19:37Z `[upgrade-interruption] none: previous=0.0.0-exp.18 current=0.8.0-pre.1 ended-ptys=0`；19:56Z 使用者結束 `stopTerminalServer=true` → `terminal server stopped (via IPC server:shutdown)`；10:16 啟動沒有 `upgrade-interruption` 行（同版不記，`electron/upgrade-interruption.ts:448`） | 正常 |
| `[gpu]` | `skia graphite: not disabled (platform=win32)`、feature status 正常（gpu_compositing enabled），沒有 GPU crash | 正常 |
| `[pty-fd-guard]` | 0 行 | 預期（只有 Linux） |
| `[program-status] … probe seen, no reply (win32 ConPTY drops OSC replies)` | 51 | 預期（T0811：win32 不回） |

#### 3. 記憶體（唯讀查詢，2026-11-25 00:3x 本地，兩次取樣相隔約 3 分鐘）

BAT 主程序樹（PID 2740 起，2026-11-24 10:16 啟動，執行約 14.3 小時）：

| 程序 | WorkingSet | Private | Peak WS | 執行緒 / handle |
|---|---|---|---|---|
| 主行程 | 182.5 → 171.9 MB | 120.1 → 109.5 MB | **671.2 MB** | 41–42 / 1057 |
| renderer | 351.6 → 348.5 MB | 291.6 → 287.8 MB | 389.4 MB | 33 / 446 |
| GPU | 151.9 → 153.5 MB | 658.1 → 692.4 MB | 158.1 MB | 40 / 678 |
| network utility | 50.7 MB | 11.7 MB | 50.8 MB | — |
| crashpad | 41.9 MB | 9.1 MB | 42.0 MB | — |
| **Terminal Server（holder）** | 114.5 → 112.4 MB | **84.9 → 82.2 MB** | 117.3 MB（peak paged 86.9 MB） | 17–18 / 450 |
| holder 子程序 | 8 × `bash.exe` ＋ 8 × `conhost.exe`，WS 合計 120.2 MB | | | |

- 分頁數：holder 下 8 個存活 shell（BAT MCP `bat_list_terminals` 的 Worker 範圍只看得到本 Worker 與塔台 2 個，所以以程序樹為準）。本次啟動共建立 **52 個 PTY**（`[PtyManager] pty:create … → Terminal Server` 52 次；其中 45 個是 helper 派工的 Worker，44 個已回收）。
- **與 T0889 / T0890 比較**：T0890 holder 版 C1 10 分頁約 41.1 MB Private；stock（每 PTY 一個 Worker）10 分頁 164.6 MB。目前 8 分頁 82–85 MB：比共用版測試多約 +42 MB，但遠低於 stock。差異來源無法從日誌拆開：實機分頁是 claude TUI 大量輸出（測試是 node 腳本），加上 44 次開關分頁（BUG-214，T0890 量測 holder 300 次 +12.7 MB、20 輪全關再開 +2.8 MB）。**沒有持續成長的跡象**：Private 82.2 MB 與 peak paged 86.9 MB、目前 WS 112 MB 與 14 小時峰值 117 MB 都很接近；但 BAT 日誌沒有記憶體紀錄，只有兩個點，算不出趨勢斜率。
- **共用 conout 生效的間接證據**：holder 8 個 PTY 只有 17–18 個執行緒（stock 每 PTY 多一個 Worker 執行緒）；52 個 PTY 建立後 conhost 只剩 8 個（= 存活 shell），結束的 PTY 的 conhost 都有釋放（T0889 conin 釋放）。
- 主行程 **Peak WS 671 MB**：時間上對應剪貼簿 50.9 MB / 36.5 MB 的 PNG（main 先 `readClipboardPng` 讀出整張圖才比 10 MiB 上限，`[clipboard] read-image … png=50913361` 到拒絕約 2–3 秒），目前已回落到 172 MB。屬既有程式。
- GPU Private 658 → 692 MB（3 分鐘 +34 MB，WS 不變）是驅動提交量，波動屬常見，`v0.8.x` 沒碰；無 pre.1 前的同條件基準可比，列為再觀察。

#### 4. `bat-scripts.log`（19:37Z 之後 10,138 筆）

| 類別 | 次數 | 判定 |
|---|---|---|
| `bat-terminal --close-worker` exit 3 `NOT_FOUND` | 9（全在 08:11:28–29） | 預期：塔台對已回收的 Worker 批次重送關閉 |
| `bat-terminal` exit 1 `close-worker-without-notify-id`（02:48:02）、`answer-without-notify-id`（09:51:20）、`answer-FORBIDDEN`（11:16:25） | 3 | 預期：呼叫端漏帶 / 帶錯 `--notify-id`，之後都重送成功 |
| `bat-notify` exit 1 `no-message`（09:50:52）、`ask-invalid-input`（stdin 非 JSON，09:50:56） | 2 | 預期：Worker 用法錯誤，之後 `--ask` 成功（11 題全部 answered） |
| `bat-hook report-hook` `failed` `CONNECT_FAILED`（`post-tool-batch`，約 1 s 逾時） | 2（都在 09:49:40） | **既有**（舊 `bat-scripts-20261120-163108.log` 也有 7 次）。這次時間正好落在主行程讀 36.5 MB 剪貼簿 PNG（09:49:37.5–40.5）期間，推測主行程事件迴圈被佔住約 3 s，RemoteServer 來不及接受連線。影響：兩筆 hook 狀態回報遺失（hook 設計就是靜默失敗）。 |
| `RECOVERY_PENDING` / `held-full` / `WORKTREE_FAILED` / `LAUNCH_UNCONFIRMED` / 逾時 | 0 | — |
| 派工 | `terminal-created` 45、`wait-started` 45 全部 `agentStarted=true` | 正常 |
| `report-hook` `unchanged` | 4,823 | 正常結果（狀態沒變，不是錯誤） |

- 日誌量：主日誌最大宗是 `[RemoteServer] Helper authenticated / disconnected`（10,069 行 / 1.25 MB，42%），來自每次 hook 回報；其次 `[render] Thumbnail render`（7,670 行 / 786 KB）。都是既有行為；本次啟動 14 小時 2.98 MB，量不構成問題。

### 建議方向

**結論：日誌與記憶體都不阻擋 `v0.8.x` 併回 main。** 沒有 recovery、heartbeat 判死、孤兒清理、crash dump；holder、`--max-semi-space-size=1`、stdio 繼承都按設計運作；Terminal Server 8 分頁 82–85 MB、14 小時峰值 117 MB WS，沒有失控。

以下三項都不是 `v0.8.x` 的回歸，由塔台決定要不要開單（建議等級由高到低）：

- **A. 大型剪貼簿圖片的 Ctrl+V（既有，建議開 BUG，低～中）**：① main 先讀出整張 PNG 才檢查 10 MiB 上限，50 MB 級的圖讓主行程峰值到 671 MB、事件迴圈卡約 3 s（同時 2 筆 hook `CONNECT_FAILED`）；② 退回路徑兩步都失敗時 Ctrl+V 無聲失效；③ 錯誤記成 `{}`。修法方向：`hasImage` 只看 MIME 類型（不解碼）、或先比大小再編碼；兩步都失敗時給使用者提示；log 改記 `err.name` / `err.message`。
- **B. `ct-overview` YAML 錯誤日誌（既有，建議小修或併入其他單）**：同一錯誤每次重載都記、並附多行原文摘錄（會把其他工作區塔台狀態內容寫進 debug log）。修法方向：只記第一行（`reason` ＋行列）、同一檔同一錯誤只記一次直到內容改變。另外可提醒對應的 CT：frontmatter 的 Windows 路徑要用單引號或跳脫反斜線。
- **C. 共用 conout Worker 的 stderr 看不到（已知限制，docs 已寫「另案」）**：本次只能用執行緒數與 conhost 數間接確認。若要在實機確認 Worker 有沒有掉，需要協定加欄位（docs 第 428 行），維持另案即可。

### 建議下一步

1. 塔台決定 `v0.8.x` 併回 main（本單沒有反對證據）。
2. 視需要開 BUG：A（剪貼簿大圖）、B（ct-overview 日誌）；C 維持已知限制。
3. 若要回答「記憶體有沒有隨時間成長」，需要定時取樣（例如每小時一次唯讀 `Get-Process` 記 holder / renderer / GPU 的 Private），可開一張小型觀察單；本單只有兩個取樣點。

### Renew 歷程
無

### 遭遇問題
- BAT MCP `bat_list_terminals`（Worker 範圍）只回本 Worker 與塔台 2 列，看不到其他分頁；分頁數改以 holder 的子程序（8 個 shell）為準。
- 日誌沒有記憶體紀錄，無法從日誌看趨勢（見建議下一步 3）。
- 本單是唯讀研究，沒有建置 / 測試關卡；沒有產品 commit。
- 工作目錄裡 `_ct-workorders/_tower-state.md` 有塔台未提交的修改，本單沒有動它，commit 只含本工單。

### 回報時間
2026-11-25T00:37:30+08:00
