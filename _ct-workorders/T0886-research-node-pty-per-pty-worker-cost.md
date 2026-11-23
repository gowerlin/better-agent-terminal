---
schema_version: 1
schema_kind: workorder
id: T0886
title: "研究：Node 端能否省掉 node-pty 每個 PTY 的 Worker（Windows ConPTY 約 14 MB / 個），並量 macOS / Linux 的 Terminal Server 每分頁增量（PLAN-066 第 1 項）"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-23T16:20:43+0800"
started_at: "2026-11-23T16:22:12+0800"
updated_at: "2026-11-23T17:38:36+0800"
completed_at: "2026-11-23T17:38:36+0800"
session_ids:
  - "fc538071-c781-4f97-816b-588c52b8b7bf"
depends_on: [T0885]
related:
  - "PLAN-066；D304 / D305 / D306 / D307；T0885（研究結論與 PoC，分支 `ct/T0885` 的 `experiments/rust-eval/`）；PLAN-065（Windows PTY holder，`scripts/pty-holder.cjs`）；T0857（Terminal Server 協定 v1）；T0540（程序樹）；T0806（Linux PTY fd 防護）"
affects_files:
  - _ct-workorders/T0886-research-node-pty-per-pty-worker-cost.md
  - experiments/node-pty-worker/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0886
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 worktree 隔離（D305 / D307：實驗與產品改動都不直接進 main）：所有實驗在 BAT 建立的 worktree（分支 `ct/T0886`）進行，依 ct-exec § Worktree Isolation。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）；主 checkout 的其他檔一律不改，不切分支、不 merge / rebase、不 push。"
  - "🔴 研究工單：不改產品程式（`src/`、`electron/`、`scripts/`、`package.json` / lock、`node_modules` 內的檔案都不改，worktree 內也不改）。實驗用的修補（例：替 node-pty 換掉 conout Worker 的做法）一律做成 `experiments/node-pty-worker/` 內的獨立腳本或複本，以 node / electron-as-node 載入，不修改 repo 的 `node_modules`。"
  - "🔴 實驗與量測腳本放 worktree 的 `experiments/node-pty-worker/`，commit 到分支 `ct/T0886`；該目錄放自己的 `.gitignore` 擋 `node_modules/`、建置產物，不得 commit 建置產物或下載的 binary。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。本單不合併。"
  - "🔴 不碰本機 BAT 安裝版與使用者正在用的 BAT 與其 Terminal Server（只能列檔、讀大小與版本）。不觸發任何 GitHub workflow。Linux 量測可用本機 WSL `Ubuntu-24.04`（在 WSL 內另開暫存目錄，做完刪除）；macOS 不實測，以程式碼與 node-pty 原始碼推論並標示。實驗中自己起的 shell / 程序必須全部結束，回報區寫明清理結果（T0885 曾留下孤兒 pwsh）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。Git：主 checkout 只 commit 本工單檔；worktree 只 commit `experiments/node-pty-worker/` 下的檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。外部資料只引用官方或可查證來源並附連結；實測、事實、推論分開標示。"
---

# T0886 — 研究：Node 端能否省掉 node-pty 每個 PTY 的 Worker（PLAN-066 第 1 項）

## 元資料

- **工單編號**：T0886
- **任務名稱**：研究：node-pty 每個 PTY 的 Worker 成本能否在 Node 端消除，並量 macOS / Linux 增量
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 16:20 (UTC+8)

## 研究目標

T0885 發現：Windows 上 `@lydell/node-pty` 1.1.0 為每個 PTY 開一個 `worker_threads.Worker`（`node_modules/@lydell/node-pty/windowsConoutConnection.js:72`、`conoutSocketWorker.js`），每個約 14 MB。BAT 的 Terminal Server 10 個分頁時 167 MB，同樣持有 10 個 PTY 的 Rust 程式只要 2.5 MB。

使用者決定照 T0885 的建議順序做（D307）：**先研究 Node 端能不能把這個成本省掉**。省得掉就做 Node 端修正；省不掉才走 Rust Terminal Server（PLAN-066 第 2–4 項）。本單的結論決定走哪條路。

## 已知資訊

- T0885 回報區（`_ct-workorders/T0885-research-rust-rewrite-evaluation.md`）〈調查結論〉第 3 題與〈PoC 量測〉；量測方法與腳本在分支 `ct/T0885` 的 `experiments/rust-eval/`（`rust-pty-probe/node-probe.cjs`、`measure/tree-usage.ps1`），可用 `git show ct/T0885:<路徑>` 讀取或複製到本單目錄再改。
- PTY 相關程式：Terminal Server `electron/terminal-server/`（Windows 從 PTY holder `scripts/pty-holder.cjs` 執行，見 `CLAUDE.md`「Windows PTY holder」）、`electron/pty-manager.ts`（direct 模式）、Linux fd 防護 `electron/pty-spawn-fd-guard.ts`。改 PTY 行為前必讀 `CLAUDE.md` 相關節（T0540 程序樹、T0572 初始尺寸、T0578 Recovery、T0704 recovery、T0806 / T0807 fd、T0857 協定 v1）。
- `@lydell/node-pty` 是 microsoft/node-pty 的發佈 fork；conout Worker 是上游為了避免 ConPTY 輸出管線阻塞主執行緒而加的。

## 調查範圍與要回答的問題

1. **Worker 為什麼存在**：讀 `@lydell/node-pty` 1.1.0 與上游 microsoft/node-pty 的原始碼與議題 / PR，說明 conout Worker 解決什麼問題（附連結）、拿掉會回到什麼問題（例：死結、輸出卡住、關閉時 hang）。
2. **每個 Worker 的成本拆解**：14 MB 是 V8 isolate 本身、Worker 的 heap、還是 socket 緩衝？用實驗量（例：`resourceLimits`、`--max-semi-space-size`、空 Worker 對照）。
3. **可行的 Node 端做法**（每個都要實測 1 / 5 / 10 PTY 的持有者 Private Bytes，與 T0885 的 node.exe 探針同一量法，並檢查輸出正確、關閉不 hang、沒有殘留程序）：
   - (a) 一個共用 Worker 處理所有 PTY 的 conout（修補後的複本）。
   - (b) 縮小每個 Worker 的成本（`resourceLimits` 等）。
   - (c) 不用 Worker、改在主執行緒非阻塞讀 conout（若上游原本的問題在 Terminal Server 這種專用程序裡不成立）。
   - (d) 上游已有或正在進行的解法（新版本、選項、PR）。
   - (e) 你找到的其他做法。
   每個做法列：省下多少、風險、要怎麼在 BAT 落地（`patch-package`、vendored fork、等上游、或 PTY holder 專用的載入方式），以及對 `CLAUDE.md` 既有不變式的影響。
4. **macOS / Linux 增量**：Linux 用本機 WSL 實測 Node 持有 1 / 5 / 10 個 PTY 的記憶體增量（bash 即可）；macOS 以 node-pty 原始碼推論（unix 路徑有沒有 Worker）。說明 PLAN-066 的記憶體問題是不是只存在 Windows。
5. **結論與分流**：明確回答「Node 端能不能省掉大部分成本（目標：10 個 PTY 的持有者 < 40 MB，對照 Rust 2.5 MB、現況約 170 MB）」：
   - 能 → 給 Node 端修正的實作設計（改哪些檔、落地方式、測試與驗收、風險），可直接拆實作單。
   - 不能 → 說明原因，並列出 Rust Terminal Server 設計單（PLAN-066 第 2 項）要先回答的問題。

## 研究指引

- 先讀 T0885 回報區與 `ct/T0885` 的 `experiments/rust-eval/README.md`，量法沿用以便對照。
- 量測在同一台機器、同一時段，每個情境 3 次取中位數。
- 結論要可決策；實測、事實、推論分開標示。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答（附 `檔案:行` 或來源連結）。
- 〈建議方向〉：各做法比較表＋推薦。
- 〈量測〉：原始數字表、方法、限制、重現步驟（指向 `experiments/node-pty-worker/`）。
- 〈建議下一步〉：Node 端實作單或 Rust 設計單的範圍、規模、依賴、驗收方式；另列需要使用者裁決的問題。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（五題都已回答；Windows 量測在同一台機器、同一時段，每個情境 3 次取中位數；Linux 在本機 WSL 實測；macOS 依原始碼推論）
- **一句話結論**：**能。** Node 端改成「整個程序共用一個 conout Worker」後，持有 10 個 PTY 的程序從 178 MB 降到 39 MB（node.exe）／162 → 37 MB（electron 當 node）。改成「不用 Worker、主執行緒讀 conout」可以再降到 24 MB。兩者都達到 < 40 MB 的目標，輸出、kill、自然結束、resize、殘留程序都和現況一樣。建議走 Node 端，PLAN-066 的 Rust Terminal Server（第 2–4 項）不必做。
- **worktree 證據**：
  - `branch`：`ct/T0886`
  - `base_sha`：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`
  - `validated_sha`：`8c9e23a88b99081263dd3a91236bb51d2b92268c`
  - `head_sha`：`8c9e23a88b99081263dd3a91236bb51d2b92268c`
  - 量測跑在 commit 前的同一份檔案上。唯一例外是 17:33 修正的量測腳本（見〈遭遇問題〉1）：修正只影響「哪些程序算子程序、哪些要清掉」，受影響的情境已用修正後的腳本重量，其他資料列逐列核對過程序數。commit 之後沒有其他 commit。
  - `git -C "$CT_WORKTREE" status --porcelain` 為空。
- **產品 commit**：`8c9e23a8 chore(T0886): node-pty conout Worker cost research: variants, harness, measurements`，只含 `experiments/node-pty-worker/` 下 33 個原始檔與結果檔（`node_modules/`、`vendor/` 不提交）。`src/`、`electron/`、`scripts/`、`package.json` 都沒改。
- **session_id**：fc538071-c781-4f97-816b-588c52b8b7bf

### 互動紀錄

- [16:22] 開工。落點檢查：C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS；C-1 工單在 `$CT_HOME/_ct-workorders/` 下 → PASS；C-3 `experiments/node-pty-worker/**` 含萬用字元、另一項是工單本身 → 不適用；C-2 frontmatter 沒有 `branch`。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0886`、`CT_WORKTREE_BASE` = `06c3b884…`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE` = `yolo`、`BAT_REMOTE_TOKEN` 已設定。開工時沒有塔台補充段落。
- 沒有向塔台提問。
- 相依：本單只需要 `@lydell/node-pty` 與 electron，改在 `experiments/node-pty-worker/` 自己 `npm install`（`@lydell/node-pty` 1.1.0、electron 45.2.1，與 BAT 相同）。repo 的 `node_modules` 沒裝、沒改。

### 調查結論

標示：〔實測〕本次在本機跑過、可重現；〔事實〕附原始碼位置或來源；〔推論〕作者判斷，尚未驗證。外部資料查核日都是 2026-11-23。

**1. Worker 為什麼存在、拿掉會怎樣**

- 〔事實〕Worker 由上游 microsoft/node-pty#415「Host conout socket in a worker」加入（2020-06 開、2021-02 合併，https://github.com/microsoft/node-pty/pull/415 ）。PR 說明：ConPTY 在 `ClosePseudoConsole` 之後可能還送最後一個畫面，並等輸出管線被讀完才返回；讀管線和呼叫關閉在同一個執行緒時會死結，VS Code 的 UI 因此卡死（修 #375、microsoft/vscode#76548）。
- 〔事實〕Microsoft 文件（https://learn.microsoft.com/en-us/windows/console/closepseudoconsole ，頁面更新 2025-07-09）：「Starting Windows 11 24H2 (build 26100) ClosePseudoConsole will return immediately to avoid accidental deadlocks. Earlier versions will wait indefinitely for the pseudoconsole to exit.」並建議呼叫者「close the output pipe before calling ClosePseudoConsole」，或不要在讀輸出管線的執行緒上呼叫它。最低支援 Windows 10 1809。
- 〔事實〕1.1.0 的關閉路徑：`kill()`（`node_modules/@lydell/node-pty/windowsPtyAgent.js:100`）先 fork `conpty_console_list_agent` 列出並結束主控台程序，再在主執行緒同步呼叫原生 `kill`（`:114`）。原生 `PtyKill` 直接呼叫 `ClosePseudoConsole`（上游 `src/win/conpty.cc` 在 commit `efbf8eb` 的 `PtyKill`，即 1.1.0 的基準 commit）。
- 〔事實〕Worker 的工作（`worker/conoutSocketWorker.js`）：連上 ConPTY 的 conout named pipe，自己開一個 `<conout>-worker` pipe 伺服器，把資料 `pipe()` 過去；主執行緒的 socket 再連到這個轉送 pipe（`windowsPtyAgent.js:49`、`windowsConoutConnection.js:72`）。所以每個 PTY 一個 Worker、兩層 named pipe。
- 〔事實〕原生 `connect`（`windowsPtyAgent.js:63`）同步呼叫 `ConnectNamedPipe`，要等 conout 的用戶端先連上才返回；上游 #943（2026-07）就是 Worker 被除錯器暫停時主執行緒卡在這裡。
- **拿掉 Worker 會回到的問題**：Windows 11 24H2 以前的系統上，主執行緒在 `ClosePseudoConsole` 裡等 conhost 把最後輸出寫完，conhost 等管線被讀，管線只有主執行緒會讀 → 整個持有者卡死（所有分頁一起停）。24H2 以後不會發生（Microsoft 文件）。其他原生呼叫（resize、clear）不需要等輸出被讀〔推論，上游也只為關閉加 Worker〕。
- 相關上游議題（都還開著）〔事實〕：#977 kill 後 Worker 不結束的洩漏（1.2 beta 的 kill 路徑；1.1.0 的 `kill()` 直接呼叫 `dispose()`，`windowsPtyAgent.js:116`，不受影響）、#887 kill 後事件迴圈不結束、#965 shell 自己結束時不關 pseudoconsole（BAT 在 `handlePtyExit` 之後一律 `endPty` → `pty.kill()`，`electron/terminal-server/server.ts:480`、`:550`、`:563`，不受影響）。上游沒有任何談 Worker 記憶體或共用 Worker 的議題。

**2. 每個 Worker 的 14 MB 是什麼**〔實測〕

不開 PTY，只開 N 個 Worker（`worker-cost.cjs`），斜率 =（10 個 − 0 個）÷ 10：

| Worker | 預設 | `resourceLimits` 只限 heap（young 1 / old 8 MB） | 再加 `codeRangeSizeMb: 1`、`stackSizeMb: 1` |
|---|---|---|---|
| 空 Worker（只保持事件迴圈） | 14.0 MB | 12.2 MB | 9.2 MB |
| 轉送 Worker（載入 `net`、監聽 named pipe） | 14.7 MB | 12.8 MB | 9.9 MB |

- 成本幾乎全部是「一個 Worker 本身」：空 Worker 與轉送 Worker 只差 0.6 MB，socket 緩衝不是主因。
- Worker 的 V8 heap 實際只有 5.9 MB（`getHeapStatistics`：total 5.9、used 4.6–4.8、malloced 0.4）；其餘約 8 MB 是每個 Worker 的 isolate 非 heap 部分與 Node 環境（code range、執行緒堆疊、libuv、內建模組）〔推論，依差額〕。
- `resourceLimits` 把 heap 上限從 4192 MB 降到 9.5 MB，但 heap 用量不變；省下的是預留並已承諾的空間（新生代、code range、堆疊）。每個 Worker 最少仍要約 9–10 MB。
- `--max-semi-space-size` 是整個程序的旗標，會連主 isolate 一起改；`resourceLimits.maxYoungGenerationSizeMb` 是它的每個 Worker 版本，已涵蓋。

**3. Node 端做法**（持有者 Private Bytes，pwsh，中位數；完整表見〈量測〉）〔實測〕

| 做法 | 1 PTY | 5 PTY | 10 PTY | 行為檢查 | 每 PTY 增量 |
|---|---|---|---|---|---|
| 現況 stock | 37.9 | 101.0 | 178.1 | 基準 | 15.6 MB |
| (b) `resourceLimits` | 32.2 | 73.0 | 122.5 | 全部通過 | 10.0 MB |
| (a) 共用一個 Worker（`patches/shared`） | 37.4 | 38.2 | 39.1 | 全部通過 | 0.2 MB |
| (a') 同上，不改 node_modules 的落地原型（`override/`） | 37.9 | 39.4 | 39.3 | 全部通過 | 0.2 MB |
| (c) 不用 Worker、主執行緒讀（`patches/main`） | 21.9 | 22.0 | 23.5 | 全部通過 | 0.2 MB |
| Rust（T0885 PoC C，對照） | 1.2 | 2.0 | 2.5 | — | — |

electron 當 node（BAT 沒有 holder 時的跑法）：stock 35.6 / 91.6 / 162.2、shared 35.8 / 39.0 / 37.8、override 39.0 / 36.7 / 37.1、main 23.7 / 23.9 / 24.2。

行為檢查（`check.cjs`，每個做法 × node / electron 各 3 次）全部一致：S1 2 萬行完整且依序、S2 5 個 PTY 並行各 2 萬行完整、S3 大量輸出中 kill 後 30–100 ms 收到 exit 且 exitCode 正確、S4 `exit 7` 收到 7、S5 resize 後 pwsh 回 100x40、S6 沒有 shell 存活、S7 事件迴圈自己在約 9.3 s 內結束（stock 一樣）、結束後沒有殘留子程序；沒有任何 hang。吞吐（10 個 PTY 同時各 50 萬行）：stock 2248 ms / CPU 2.3 s、shared 2199 ms / 1.9 s、main 2233 ms / 1.2 s，全部完整。

逐項：

- **(a) 共用一個 Worker**：只換 `ConoutConnection`。Worker 在第一個 PTY 建立時啟動，最後一個 PTY 關閉後結束；轉送邏輯、1 s 排空、主執行緒連線方式都照舊。
  - 省下：10 PTY 省 139 MB（−78%）。
  - 風險：
    - 一個執行緒轉送所有 PTY。實測 10 個同時大量輸出沒有變慢，CPU 反而少。
    - 共用 Worker 若當掉，所有 PTY 都會失去輸出。原本只有一個 PTY 受影響。原型把每個轉送的錯誤都限制在自己身上，測試中沒有發生。
    - 防死結的設計不變，所以所有 Windows 版本都一樣安全。
  - 落地：見 (a')。
- **(a') 不改 node_modules 的載入方式**：`windowsPtyAgent.js:49` 每次建立 PTY 都以 `windowsConoutConnection_1.ConoutConnection` 讀模組匯出的屬性，所以 Terminal Server 在載入 node-pty 後、第一次 spawn 前替換這個匯出即可，不用 patch-package、不用 fork。原型 `override/shared-conout.cjs` 先檢查版本必須是 `1.1.0`、類別形狀正確，否則什麼都不做（照舊用原本的 Worker）。
  - 落地：Terminal Server 啟動時安裝；`scripts/pty-holder.cjs` 的 holder 檔案清單要加入 Worker 腳本；`package.json` 的 `"@lydell/node-pty": "^1.1.0"`（第 74 行）改成精確的 `1.1.0`。
- **(b) `resourceLimits`**：10 PTY 122.5 MB，達不到目標；`codeRangeSizeMb: 1` 對日後的 Worker 程式碼量沒有餘裕。不建議單獨使用；可以疊在 (a) 的共用 Worker 上，約再省 5 MB〔推論，依 2. 的差額〕。
- **(c) 主執行緒讀**：10 PTY 23.5 MB，最省，管線也從兩層變一層。
  - 風險：Windows 11 24H2 以前會死結（第 1 題）。原型在 kill 時先關自己這端的輸出管線，再呼叫 `ClosePseudoConsole`。這是 Microsoft 文件建議的做法，只在 build < 26100 時啟用。
  - 驗證限制：本機是 build 28000，只能用 `main-closefirst` 強制走這條路徑，確認不會壞，無法驗證舊版 Windows 真的不死結。
  - 另一個差異：kill 時 `close` 事件比原生 exit callback 早到。原型讓 `exit` 事件最多等 1 s 拿到 exit code。
  - 改動範圍：要改 `windowsPtyAgent.js` 的建構子與 `kill`，以及 `windowsTerminal.js` 的 `close` 處理。外部替換的範圍比 (a) 大很多。
- **(d) 上游**〔事實〕：
  - microsoft/node-pty main（2026-11-02 `35c28c7d`）與最新 1.2.0-beta.17／@lydell 1.2.0-beta.18 仍是每個 PTY 一個 Worker（`src/windowsConoutConnection.ts`）。
  - main 的 `WindowsPtyAgent` 新增了內部選項 `conoutConnectionFactory`（只給測試，`spawn` 沒有開放），日後可以向上游提議開放或內建共用 Worker。
  - 1.2 的 `useConptyDll`（附帶新版 conpty.dll）會讓舊版 Windows 也用新的 ConPTY，但仍是 beta，也還是每個 PTY 一個 Worker。目前沒有可以直接升級的解法。
- **(e) 其他**：
  - 把轉送改放原生執行緒（改 C++ addon）：效果等於 (c)，但要自己建 native fork，不划算。
  - Rust holder：PLAN-066 第 2–4 項，見〈建議方向〉。

**4. macOS / Linux**

- Linux〔實測，WSL Ubuntu 24.04、node v26.13.0、`@lydell/node-pty` 1.1.0、bash〕：

  | | 持有者 Private | 執行緒 |
  |---|---|---|
  | 0 PTY（只有 node） | 40.2 MB | 7 |
  | 1 PTY | 45.0 MB | 8 |
  | 5 PTY | 45.2 MB | 12 |
  | 10 PTY | 46.0 MB | 17 |

  - 第一個 PTY 約 +4.8 MB，主要是載入 node-pty。之後每多一個 PTY 約 +0.1 MB 與 1 條執行緒。
  - 那條執行緒是原生 `waitpid` 執行緒（上游 `src/unix/pty.cc` 的 `SetupExitCallback`）。
- macOS〔推論〕：與 Linux 走同一個 `UnixTerminal`（`index.js` 只有 win32 走 `WindowsTerminal`）。用 `tty.ReadStream` 在主執行緒讀 master fd（`unixTerminal.js:85`），只是改用 `spawn-helper`／`posix_spawn` 啟動，沒有 Worker。
- 結論：PLAN-066 的「每個分頁約 14 MB」只存在 Windows。Linux 與 Windows 的 node 基準不能直接比：Linux 量的是常駐私有記憶體，Windows 是已承諾的 Private Bytes，node 版本也不同。

**5. 結論與分流**：**能。** 10 個 PTY 的持有者：

| | 持有者 |
|---|---|
| (a') 共用 Worker（node.exe，holder 的跑法） | 39.3 MB |
| (a') 共用 Worker（electron 當 node） | 37.1 MB |
| (c) 主執行緒讀 | 約 24 MB |
| 現況 | 約 170 MB |
| Rust | 2.5 MB |

換算成 BAT 10 個分頁：框架從 654 MB 降到約 525 MB（Terminal Server 167 → 約 38 MB），接近 T0885 對 Rust holder 估的 490 MB〔推論〕。剩下與 Rust 的差距約 35 MB，主要是 node／electron 本身的基準（約 19–24 MB），不再隨分頁數增加。Node 端修正的實作設計見〈建議下一步〉。

### 建議方向

| 做法 | 10 PTY 持有者 | 省下 | 風險 | 落地 | 對既有不變式 |
|---|---|---|---|---|---|
| (a') 共用 Worker，載入時替換 `ConoutConnection`（推薦） | 39.3 MB（electron 37.1） | −139 MB | 低：防死結設計不變；一個 Worker 當掉會影響所有 PTY（已限制錯誤範圍） | Terminal Server 安裝 override，精確釘 `@lydell/node-pty@1.1.0`，版本或形狀不符就照舊 | T0540 結束順序、T0572、T0578、T0704、T0857 都不變；holder 檔案清單多一個檔（PLAN-065，要跑 W6） |
| (c) 主執行緒讀 | 23.5 MB | −155 MB | 中：舊版 Windows 的防死結做法本機無法驗證；要改 agent 與 terminal 兩個類別 | 只能 vendored fork 或大範圍替換原型方法 | 同上；exit 事件時序有差異（已處理） |
| (b) `resourceLimits` | 122.5 MB | −56 MB | 低 | 同 (a') | 不變；達不到目標 |
| Rust Terminal Server（PLAN-066 第 2–4 項） | 2.5 MB | −176 MB | 中：升級相容（T0885 R1 / R2） | 新 crate＋holder 改版 | 要重新驗證全部 |

**推薦**：

- 做 (a')，不做 Rust。
- (c) 只在使用者還要再省約 15 MB 時再做，而且要先在 Windows 11 24H2 以前的系統上驗證，例如另開工單用 GitHub `windows-2022` runner（build 20348）。
- (b) 可以疊在 (a') 的共用 Worker 上當小優化，不單獨做。

### 量測

**方法**（細節、腳本與重現步驟：分支 `ct/T0886` 的 `experiments/node-pty-worker/README.md`）

- 環境：Windows 11 開發機（build 28000）、node v26.13.1、electron 45.2.1（當 node 用，`ELECTRON_RUN_AS_NODE=1`）、`@lydell/node-pty` 1.1.0、pwsh 7。2026-11-23 16:36–17:23 一次跑完（`measure/run-all.ps1`），override 在 17:23–17:35 補量（`measure/run-override.ps1`）。每個情境 3 次取中位數。同時有其他程式在跑，包含使用者的 BAT。
- 量法沿用 T0885 PoC C：持有者只持有 N 個 pwsh PTY（`-ExecutionPolicy Bypass -NoLogo`，自己回應 `ESC[6n`），所有提示出現後等 10 s，讀持有者自己的 `PrivateMemorySize64` / `WorkingSet64`；shell（pwsh＋conhost）另列。node 版 stock 1 / 5 / 10 PTY 為 37.9 / 101.0 / 178.1 MB，與 T0885 的 37.9 / 100.7 / 178.3 MB 一致。
- 每個做法以該版本自己的 `kill()` 結束，檢查持有者在時限內結束、沒有殘留 shell。
- 做法的實作：`patches/<variant>/` 蓋在 `node_modules/@lydell/node-pty` 的複本上（`make-vendor.mjs` 產生 `vendor/`，不提交）；`override/` 直接用原本的套件。

**原始數字**（中位數；每次的原始列在 `results/holder.csv`、`cost.csv`、`check.jsonl`、`throughput.jsonl`、`linux-holder.csv`，彙整在 `results/summary.md`）

| 持有者 | 做法 | PTY 1 / 5 / 10：Private MB | WS MB | 執行緒 | 全部提示 ms |
|---|---|---|---|---|---|
| node.exe | stock | 37.9 / 101.0 / 178.1 | 66.7 / 105.1 / 152.1 | 14 / 22 / 32 | 316 / 378 / 462 |
| node.exe | limits（young 1、old 8、codeRange 1、stack 1） | 32.2 / 73.0 / 122.5 | 64.8 / 95.0 / 131.3 | 14 / 22 / 32 | 319 / 377 / 480 |
| node.exe | shared | 37.4 / 38.2 / 39.1 | 66.6 / 67.7 / 68.8 | 14 / 18 / 23 | 317 / 354 / 401 |
| node.exe | override | 37.9 / 39.4 / 39.3 | 67.1 / 68.5 / 68.8 | 14 / 18 / 23 | 331 / 341 / 394 |
| node.exe | main | 21.9 / 22.0 / 23.5 | 56.9 / 57.2 / 58.4 | 13 / 17 / 22 | 311 / 343 / 405 |
| electron 當 node | stock | 35.6 / 91.6 / 162.2 | 49.6 / 81.5 / 121.2 | 16 / 24 / 34 | 315 / 385 / 512 |
| electron 當 node | shared | 35.8 / 39.0 / 37.8 | 49.6 / 53.2 / 51.2 | 16 / 20 / 25 | 307 / 335 / 396 |
| electron 當 node | override | 39.0 / 36.7 / 37.1 | 52.7 / 50.7 / 51.3 | 16 / 20 / 25 | 346 / 346 / 393 |
| electron 當 node | main | 23.7 / 23.9 / 24.2 | 40.7 / 39.2 / 39.8 | 15 / 19 / 24 | 293 / 336 / 383 |

- shell（pwsh＋conhost）在所有做法都一樣：1 / 5 / 10 PTY 約 36 / 177 / 352 MB。
- 吞吐（10 PTY、各 50 萬行、約 47 bytes／行）：

  | 做法 | 時間 | CPU | 事件迴圈最大延遲 |
  |---|---|---|---|
  | stock | 2248 ms | 2.3 s | 109 ms |
  | shared | 2199 ms | 1.9 s | 96 ms |
  | main | 2233 ms | 1.2 s | 71 ms |

  1 PTY 時三者約 1.5 s。
- Worker 成本拆解：見〈調查結論〉2；node.exe 只有主 isolate 時 19.4 MB。

**限制**

- 只在 Windows 11 build 28000 上量。`ClosePseudoConsole` 在這個版本本來就立即返回，所以 (c) 在 24H2 以前系統的死結防護沒有驗證；(a) / (a') 不受影響（防死結設計不變）。
- 持有者只持有 PTY，沒有 Terminal Server 的協定、ring buffer 與 client socket；T0885 實測 BAT Terminal Server 1 個分頁 37.4 MB，與 electron 探針 35.9 MB 相近，所以只換算框架總量〔推論〕。
- Linux 用 node v26.13.0（WSL nvm），不是 electron；Linux 的私有記憶體與 Windows 的 Private Bytes 定義不同，只比較增量。
- 量測期間我在 WSL 做 Linux 量測（成本拆解階段），只影響時間類數字，不影響 Private Bytes。
- `check.cjs` 的 stderr 每次有 7 行 `AttachConsole failed`：node-pty 1.1.0 的 console-list agent 在 shell 已結束時的輸出，stock 一樣。
- S6 每次都多 1 個 conhost（kill 之後 3 s 內還在），stock 一樣；程序結束後的殘留檢查都是 0。

### 建議下一步

| # | 工作 | 類型 / 規模 | 依賴 | 驗收 |
|---|---|---|---|---|
| 1 | 實作：Terminal Server 在 Windows 用共用 conout Worker（(a')） | 實作 / M（1 張） | 本單 | 單元測試＋既有 Terminal Server e2e 通過；BAT 10 分頁的 Terminal Server < 45 MB；W6 `windows-upgrade-acceptance.yml` 通過 |
| 2 | （選用）研究＋驗證：主執行緒讀 conout（(c)）在 Windows 11 24H2 以前系統的死結防護 | research / S | 1 完成、使用者要再省約 15 MB | GitHub `windows-2022` runner 上大量輸出中 kill 不 hang |
| 3 | PLAN-066 第 2–4 項（Rust Terminal Server） | — | — | 建議不開；若 1 驗收未達標再回頭評估 |

第 1 項的實作設計：

- **新增**：
  - `electron/terminal-server/shared-conout.ts`：`installSharedConout(nodePtyDir)` → `'installed' | 'skipped:<原因>'`，邏輯同 `experiments/node-pty-worker/override/shared-conout.cjs`。只在 win32 執行；版本必須是 `1.1.0`、`ConoutConnection` 形狀必須正確，否則不替換、照舊運作。
  - Worker 腳本（例：`electron/terminal-server/shared-conout-worker.cjs`），建置到 `dist-electron/`。`getWorkerPipeName` 直接寫成 `name + '-worker'`，不依賴套件內部路徑。
- **改動**：
  - `electron/terminal-server/server.ts:24` 載入 node-pty 後、第一次 spawn 前呼叫安裝函式；結果只記一行，經 `pty:created` 或既有日誌管道。
  - `package.json`：`build.asarUnpack` 加入 Worker 腳本；`"@lydell/node-pty"` 改成精確的 `1.1.0`。
  - `scripts/pty-holder.cjs`：`holderSourceFiles` 加入 Worker 腳本，並更新 holder manifest。
  - direct 模式（`electron/pty-manager.ts`，在 Electron 主行程）是否也套用：由塔台決定。建議第 1 張只做 Terminal Server。
- **測試**：
  - vitest（Windows 才跑）：安裝結果是 `installed`；3 個 PTY 的輸出完整；只有 1 個 Worker；kill 不 hang；版本或形狀不符時是 `skipped`。
  - source guard：只在 `server.ts` 安裝。
  - 既有 e2e：T0540 / T0572 / T0578 / T0704 / T0861。
  - 記憶體驗收：沿用 T0885 `bat-baseline.spec.ts` 量 1 / 5 / 10 分頁。
  - holder 內容改變，依 CLAUDE.md「Windows PTY holder」要跑 W6。
- **不變式**：
  - T0540 的 `endPty`（先 taskkill 樹再 `pty.kill()`）不變。
  - ConPTY 關閉仍有 Worker 排空。
  - T0806 / T0807 只影響 Linux，不碰。
  - T0857 協定不變。
  - T0866 stdio guard 只管子程序，Worker 是執行緒，不受影響。
- **風險**：
  - 共用 Worker 當掉會讓所有分頁失去輸出。建議加 Worker `exit` 的日誌；要不要自動重建，在實作單決定。
  - 升 node-pty 時，override 會因版本守門自動停用，記憶體回到現況，但功能不壞。升版時要重新驗證。

需要使用者 / 塔台裁決：

- **Q-A**：是否接受「Node 端修正、不做 Rust」，並以第 1 項開實作單？（建議：接受）
- **Q-B**：direct 模式（`pty-manager.ts`）要不要一起套用？（建議：先不要，第 1 張只做 Terminal Server）
- **Q-C**：要不要做第 2 項，再省約 15 MB／10 分頁？（建議：先不做）
- 是否把 `experiments/node-pty-worker/` 合回主線：本單不合併，建議留在分支當紀錄。

### Renew 歷程

（無）

### 遭遇問題

1. 🔴 **量測腳本可能誤殺了 8 個無關程序（17:29）**：
   - **原因**：沿用自 T0885 的 `measure/tree-usage.ps1` 只用 `Win32_Process.ParentProcessId` 找子程序。Windows 會保留已死父程序的 PID；PID 被重用時，父程序早已結束的無關程序會被算成探針的子程序。
   - **經過**：`electron-node override 1 PTY` 第 3 次（17:28:55 量測）在探針底下算到 10 個「shell」程序（445 MB；應該只有 2 個）。`measure.ps1` 把其中仍在執行的 8 個當成殘留，以 `taskkill /T /F` 結束了它們，連同各自的子程序。
   - **查不到是哪些程序**：腳本沒有記錄 PID；Security 紀錄沒有程序結束稽核（4689）；Application 紀錄在 17:28:50–17:29:30 只有一筆無關的 SPP 事件。
   - **已確認的範圍**：
     - 被算進來的只有名稱是 pwsh / conhost / OpenConsole / node / powershell / cmd 的程序，或這些程序的子孫。
     - 事後 `bat_list_terminals` 看得到的塔台分頁與本 Worker 分頁都還在。
     - 目前系統上父程序已不存在的 shell 類程序只剩 1 個（09:39 建立的 conhost）。
     - BAT Terminal Server 底下的 shell，父程序是仍在執行的 Terminal Server，PID 不可能和探針相同，所以不會被誤算〔推論〕。
   - **請使用者確認**：17:29 左右，有沒有其他終端、MCP server、背景 node 程序不見了。
   - **已修正**：
     - 子程序的建立時間必須晚於父程序（`tree-usage.ps1`）。
     - `measure.ps1` 的殘留只結束探針啟動之後建立的程序，而且一次只結束一個，不再結束整棵樹。
     - `check.ps1` 的結束後殘留查詢也做同樣修正。`check.ps1` 先前的紀錄全部是 0 個，沒有結束過任何程序。
   - **資料**：受影響的情境已刪除並重量。其他 80 列的 shell 程序數都符合預期（node 版 2N+1，多 1 個是持有者自己的 conhost；electron 版 2N），沒有受影響。
   - **T0885**：同一支 `tree-usage.ps1` 也在分支 `ct/T0885`。T0885 的 `measure-probe.ps1` 只對探針本身做 `taskkill /T`，不會這樣誤殺，但它的樹統計可能有同樣的誤算〔推論〕。建議塔台記錄這個問題。
2. **main 版 kill 後 `exitCode` 是 undefined**（開發中發現，已修正）：
   - 原因：主執行緒直接讀管線後，輸出管線的 `close` 比原生 exit callback 早到。
   - 修正：補丁讓 `exit` 事件最多等 1 s 拿到 exit code；之後 S3 的 exit code 都是 0，與 stock 相同。
3. **Git Bash 呼叫 `wsl.exe` 時路徑跳脫失敗**：第一次在 WSL 留下一個空的暫存目錄 `/tmp/t0886-8MIYxD`，已確認是空的並刪除。之後改用 `/mnt/<磁碟>` 路徑執行腳本檔。
4. **清理**：
   - WSL 暫存目錄 `/tmp/t0886-*` 都已刪除，WSL 內沒有 t0886 相關程序。
   - Windows `%TEMP%` 下的 `t0886*` 暫存都已刪除。量測主控台輸出已保存為 `results/run-all-console.txt`。
   - 依 `ExecutablePath` / 命令列比對，沒有任何實驗程序還在執行。
   - 每次量測的殘留 shell 都是 0，`check` 結束後的殘留子程序都是 0。
5. **本機安裝版與使用者的 BAT**：沒有讀取、啟動、結束或重裝本機安裝版。使用者 BAT 的 Terminal Server 不是本單的操作對象；但見第 1 點，8 個被誤殺的程序是什麼無法排除。
6. 量測途中我在 `probe.cjs` / `check.cjs` / `throughput.cjs` 加了 `override` 分支（17:21，run-all 跑到行為檢查時）。這只是新增的分支，不改其他做法的路徑；每次執行都會重新載入檔案。

### 子代理與 Workflow 使用

| 種類 | 數量 | 用途 | 唯讀（怎麼保證） | tokens | 備註 |
|---|---|---|---|---|---|
| 子代理（web-fetch） | 1 | 讀 Microsoft `ClosePseudoConsole` 文件 | 是（web-fetch 只有 WebFetch 工具，prompt 也明令不寫檔） | 9,219（工具回報） | 主 agent 以引文寫入結論；上游 PR / 議題由主 agent 用 `gh api` 直接讀 |

### 方法論狀態回寫

不適用（本工單沒有 `methodology`）。

### 回報時間

2026-11-23T17:36:36+08:00
