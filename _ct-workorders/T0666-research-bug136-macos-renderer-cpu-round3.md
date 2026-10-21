---
schema_version: 1
schema_kind: workorder
id: T0666
title: "研究：BUG-136 第三輪 — 外部測試者A 2026-10-19 macOS 日誌 / GPU 崩潰報告 / Renderer CPU 量測判讀（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-136
priority: P2
sizing: S
created_at: "2026-10-19T11:44:00+0800"
started_at: "2026-10-19T11:45:07+08:00"
updated_at: "2026-10-19T11:53:32+08:00"
completed_at: "2026-10-19T11:53:32+08:00"
depends_on: []
related:
  - "BUG-136（OPEN；前兩輪判讀、假設 A / B、重現方法、待 外部測試者A 區分測試都在單內）"
  - "T0533（`[gpu]` 狀態日誌，`electron/gpu-status-log.ts`；判讀見 `docs/agent-guide/logging.md`）"
affects_files:
  - _ct-workorders/T0666-research-bug136-macos-renderer-cpu-round3.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-136 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 外部測試者A 的檔案在 `D:\\Downloads\\封存`（使用者本機，**不得複製進 repo、不得 commit**）。日誌含客戶專案路徑與使用者名稱：回報區引用時一律去識別化（路徑改 `<project>` / `<user>`），不得貼整段原始日誌。"
  - "🔴 不得在回報、commit、暫存檔外的任何地方寫出權杖值（日誌若含 `batcap.` 或 token 字樣，只寫「有 / 無」）。"
  - "🔴 符號化（選做）：可下載 Electron 對應版本 darwin-arm64 dSYM 到系統暫存目錄或 scratchpad，以 `llvm-symbolizer` / `llvm-atos` 等工具符號化；時間上限約 20 分鐘或下載 > 1.5 GiB 就放棄，回報寫明。用完刪除下載檔。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；範圍內猜錯會返工的判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 外部測試者A 做的事寫成「給 外部測試者A 的問題 / 測試」清單。"
---

# T0666 — 研究：BUG-136 第三輪（外部測試者A 2026-10-19 macOS 資料）

## 研究目標

BUG-136（macOS 舊分頁打字延遲、Renderer 約 1 顆核心）到目前根因未定（假設 A：GPU 崩潰後繪圖狀態損壞；假設 B：長對話分頁本身每次按鍵重繪太多）。外部測試者A 今天（2026-10-19）提供新一輪資料，請判讀它們**支持 / 排除**哪個假設，並給出可決策的下一步（修正方向或下一輪區分測試）。

## 已知資訊

先完整讀 `_ct-workorders/BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md`（前兩輪判讀、GPU 崩潰時間表、重現方法、可先做的改善）。

### 本輪新資料（`D:\Downloads\封存`）

| 檔案 | 說明 |
|---|---|
| `debug-20261015-130846.log` | 10-15 13:08 啟動的那次 BAT（前一輪分析的是 `112206` / `094818`，這份沒分析過） |
| `debug-20261019-104323.log` | 今天 10:43 啟動的 BAT；外部測試者A 目前裝的版本請從日誌讀（應已含 T0533 `[gpu]` 日誌，`0.6.1-pre.2` 起） |
| `BetterAgentTerminal Helper-2026-10-19-103931.ips` | 今天 10:39:31 的 Helper 崩潰報告（注意：時間**早於** `104323` 那次啟動，屬於前一次程序；請確認是哪種 Helper、哪個執行緒、與前一輪 `114303.ips` 是否同一個崩潰點） |
| `__MACOSX/` | macOS 壓縮檔的 metadata，忽略 |

### 外部測試者A 貼的 `ps` 量測（時間未附；pid 60100 = Renderer）

```
60078   1.3 …/BetterAgentTerminal Helper.app/…        60100 100.8 …Helper (Renderer)…
60078   1.4                                            60100  98.7
60078   4.9                                            60100  18.0
60078   2.2                                            60100  40.0
60078   4.9                                            60100  25.8
```

（60079 / 60083 皆 0.0–0.1，省略。）前兩筆 Renderer ≈ 100%，之後降到 18–40%。取樣間隔、當時是否在打字、是哪個分頁 active，外部測試者A 沒說明 —— 請以日誌（pid、分頁切換、`[gpu]`、redraw 時間）推斷可對上的時段，推不出就列為給 外部測試者A 的問題。

### 外部測試者A 的新觀察（2026-10-19 11:43）

> 「我發現 Context used 大概在 20–30% 就會開始卡頓了」

「Context used」是 agent 工作階段（Codex / Claude）的 context 使用量。這把卡頓與**對話長度**連在一起（偏假設 B 或「分頁輸出量 / scrollback / 重繪範圍」類），但前一輪量測顯示吃 CPU 的是 BAT Renderer 而非 codex 程序。請判斷這兩點如何同時成立（例：TUI 每次按鍵重送整個畫面 → xterm 解析 / 繪製成本隨畫面內容增加；或 scrollback 行數；或 BAT 自己的輸出處理路徑，如 OSC 7501 解析、`[terminal-attention]`、輸出遮罩、縮圖更新、replay buffer 等）。哪個 agent（Codex / Claude）請從日誌確認。

## 調查範圍

1. **三份資料判讀**（以日誌與崩潰報告為準，標明「日誌證據 / 原始碼 / 推論」）：
   - `104323`：BAT 版本、平台資訊、`[gpu]` 基準與是否有 `crash #N` / `feature status changed`（是否退回軟體繪圖）、分頁建立 / 切換 / redraw 時間線、agent 種類、派工事件；與 外部測試者A 的卡頓時段對照。
   - `130846`：同上，補前一輪缺的 10-15 13:08 之後時段。
   - `103931.ips`：程序類型、觸發執行緒、exception type、Electron 版本與 Framework UUID；與 `114303.ips` 比較（同崩潰點？）。可選做符號化（見 memory_overrides）。
2. **原始碼對照**（唯讀）：從按鍵到畫面的 renderer 路徑上，有哪些成本會隨「分頁輸出量 / 對話長度」增加：`src/components/TerminalPanel.tsx`（xterm 設定、CanvasAddon、scrollback、`clearTextureAtlas`、resize / fit、activation）、renderer 端每筆 PTY 輸出都會跑的處理（縮圖、attention、搜尋、連結偵測等）。列出候選熱點與依據，不實作。
3. **兩個假設的更新判讀**：A / B 各自「符合 / 不符」的新證據；是否需要新假設（例：C = 輸出量驅動的 renderer 熱點，與 GPU 崩潰無關）。
4. **建議**：
   - 若證據足以定方向：給修正方向草案（切分 S / M、風險、不得退化的既有行為，例如 Win11 `clearTextureAtlas` 修正）。
   - 若仍不足：給 外部測試者A 下一輪**最小**測試（≤ 3 項，步驟具體、不耗 token 者優先；例如 DevTools Performance 錄 5 秒打字、同一 context 用量下比較 Claude / Codex、清 scrollback 後是否恢復），並說明各結果分別指向哪個假設。

## 研究指引

- 先讀 `docs/agent-guide/logging.md` 的 `[gpu]` 判讀段，再讀日誌。
- 前一輪結論（BUG-136「判讀」「更新後的判讀」）不要重寫，只寫本輪新增或推翻的部分。
- **不轉述未證實的根因**：結論每條標「日誌證據 / 原始碼 / 推論」。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 外部測試者A 回答的事寫進回報區「給 外部測試者A 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（研究單，唯讀；只改本工單檔）。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 不適用（`affects_files` 只有本工單）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

一句話結論：找到一個**與 GPU 無關、會隨分頁輸出量成長**的 Renderer 熱點：縮圖預覽 `scheduleBatchedPreviewUpdate`（`src/components/TerminalThumbnail.tsx`）。Codex 用 alt screen、輸出幾乎沒有 `\n` 時，這個預覽字串會無上限累積；每 150 ms 有輸出就對整串跑 11 次 regex，再把整串塞進一個 `white-space: pre` 的單行文字節點重新 layout。這可以同時解釋「Context used 20–30% 開始卡」「吃 CPU 的是 BAT Renderer 而不是 codex」「新分頁正常」「只在 macOS」。建議列為**假設 C**，權重高於 A / B。還需要 外部測試者A 做一項 1 分鐘的確認（見下）。

### 互動紀錄

- 沒有問塔台（判讀問題都能用日誌、原始碼、實測回答）。沒有問使用者。
- 使用者在執行途中（量測 layout 之後、時間未取）問「你需要用 chrome live 嗎, 再一次」→ 回覆不需要：layout 成本已改用 repo 內的 Electron 41.2.1 量測（和 BAT 同一個 Chromium，比 Chrome 更接近實際）。Action：繼續執行，沒有用 Chrome。

### 調查結論

標記：【日誌】= 外部測試者A 的日誌 / 崩潰報告；【原始碼】= 本 repo `main`（`044c1360`）；【實測】= 本次在 Windows 機器上的量測；【推論】= 尚未證實。

#### 1. `debug-20261019-104323.log`（10-19 10:43:23 – 11:40:26 +0800）

- 【日誌】main PID 59873、terminal-server pid 60083；外部測試者A 的 `ps` 裡有 60083，所以 **pid 60100（Renderer）屬於這一次程序**，`ps` 量測在這段時間內做的。
- 【日誌】版本：日誌沒有版本字串。有 `[gpu]`（≥ 0.6.1-pre.2）、`[codex-state]` / `[agent-start] … (osc idle)`（`[codex-state]` 最早出現在 `v0.7.0-pre.9`）⇒ 外部測試者A 現在裝的是 **`v0.7.0-pre.9` 以後**（`v0.7.0-pre.9` / `v0.7.1-pre.1` / `v0.7.1-pre.2` 之一）；Codex ≥ 0.163.0（有 OSC 7501）。
- 【日誌】`[gpu] info: gpu0{vendor=0x106b … active} machine="Mac 14.10"`；`[gpu] feature status:` 基準 `2d_canvas=enabled`、`gpu_compositing=enabled`、`rasterization=enabled`、`skia_graphite=enabled_on`（硬體繪圖）。**整段沒有 `[CRASH]`、沒有 `[gpu] crash #N`、沒有 `feature status changed`** ⇒ 這次程序沒有 GPU 崩潰，也沒有退回軟體繪圖。
- 【日誌】agent 全是 **Codex**（`[bat-mcp] tab agent=codex-cli`，`buffer changed: alt`）。沒有 Claude 分頁。
- 【日誌】時間線（+0800）：
  - 10:43:32 還原 4 個分頁（全是重新 spawn 的 PTY，因為 terminal-server 是新的 → 之前的預覽快取也是空的），10:43–10:44 關掉其中 3 個。
  - 11:06:16–17 `b308fb64` 連按 2 次 `[redraw] manual redraw`，11:06:20 關閉。**附近沒有 GPU 崩潰**，所以「手動重繪」不能再當成 GPU 崩潰畫面損壞的證據。
  - 11:06:34 開新的 Codex 塔台 `d557f6a8`，之後一直是主要工作分頁：11:20–11:36 貼上 6 次、codex `working` / `idle` 來回十多次。11:32:30 起 `working`，到日誌結束都沒有回 `idle`。
  - 11:36:47 `d557f6a8` 派工建立 Worker `9434f019`（Codex，同工作區）；11:37–11:39 塔台輪詢 get-state / read-output；11:39:08 Worker → `idle`。
  - 11:38:29 新開一般終端 `ded8a9e9`（沒有注入 bat-mcp → 非 agent），11:38:30 和 11:38:52 各貼上一次。【推論】這就是 外部測試者A 跑 `ps` 的分頁，當時 active 的是這個空白分頁，不是 Codex 分頁。
- 【日誌】`MutationObserver`（每 100 次記一筆）只在 `d557f6a8` 持續增加：11:19 → 11:37 累計 3600 次。輸出活動集中在這個分頁。
- 【推論】`ps` 對時：前兩筆 ≈ 100% 時，`d557f6a8`（工作 30 分鐘以上）在 `working`，Worker `9434f019` 也在 `working`；降到 18–40% 可能對應 11:39:08 Worker → idle，但不知道取樣間隔，無法確認（列為給 外部測試者A 的問題）。重點是：**當時 active 的是新開的空白分頁，Renderer 仍約 1 核心**，而且這次程序沒有 GPU 崩潰。

#### 2. `debug-20261015-130846.log`（10-15 13:08:46 → 10-19 10:42:44，連續跑了 4 天）

- 【日誌】沒有 `[gpu]` 行 ⇒ 當時還是 `0.6.1-pre.1`（`.ips` 的 `build_version` 也是 `0.6.1-pre.1`）。
- 【日誌】10-15 13:08–14:45 開了很多分頁：13:16、13:19、14:18 三次派工，13:43–13:45 連開 10 個分頁。這段時間**沒有** GPU 崩潰（不符合前一輪「建立終端後 2–12 秒崩潰」的模式，那個模式不是每次都會發生）。
- 【日誌】唯一一次 GPU 崩潰：**10-19 10:39:29.734** `[CRASH] child-process-gone type=GPU reason=crashed exitCode=5`。前 0.4 秒（10:39:29.294）切換 active 分頁到 `9f94a630`；10:39:21 / 10:39:28 也連續切換分頁；10:38:58–59 視窗剛改過尺寸（`will-resize 2560x1122 → 2560x1410`）。
- 【日誌】崩潰後 10:39:40 和 10:42:42 兩次取消 quit 對話框，10:42:44 確認 quit（`stopTerminalServer=false`），10:43:23 重開 → 就是 `104323` 那次。
- 【推論】前一輪 5 次崩潰中有 3 次在「建立終端後 2–12 秒」，這次在「切換分頁後 0.4 秒」。這兩個動作都會跑 `TerminalPanel.tsx` isActive effect 裡的 `clearTextureAtlas()` + `refresh()`（建立的終端第一次 active 時也會跑），也就是重建 canvas glyph texture。這是 GPU 崩潰觸發點的候選，**和打字延遲是兩件事**。

#### 3. `BetterAgentTerminal Helper-2026-10-19-103931.ips`

- 【日誌】GPU 程序 pid 48690（parent 48510 = `130846` 的 main），10-15 13:08:47 啟動、10-19 10:39:29.80 崩潰（跑了 4 天）；`build_version` `0.6.1-pre.1`；macOS 27.0.1 (26A434)、ARM-64。
- 【日誌】`EXC_BREAKPOINT` / `SIGTRAP`（Trace/BPT trap: 5）；觸發執行緒 0 `CrGpuMain`；`GpuWatchdog` 存在但不是觸發者。
- 【日誌】Electron Framework UUID `4c4c44be-5555-3144-a121-891fbdf26df9`（base `0x10f6c4000`，每次啟動位址不同屬正常）；頂層 frame 偏移 **`15787796` / `15787108` / `9697016`**，和前一輪 `114303.ips` **完全相同** ⇒ **同一個崩潰點（同一個 CHECK）**。報告裡的符號名（`cppgc::…`、`v8::External::Value`）只是最近的匯出符號，沒有意義。
- 符號化（選做）**沒有做**：崩潰點已確認和前一輪相同，符號化只會得到 CHECK 名稱，不影響本單結論（打字延遲與 GPU 無關）；留給 GPU 崩潰另案處理。沒有下載任何 dSYM。

#### 4. 原始碼對照：按鍵到畫面路徑上，成本隨輸出量成長的地方

| 候選 | 位置 | 會隨輸出量成長嗎 | 判讀 |
|---|---|---|---|
| **縮圖預覽累積** | `TerminalThumbnail.tsx` `scheduleBatchedPreviewUpdate` / `stripAnsi`，顯示在 `.thumbnail-preview`（`panels.css`：`white-space: pre; overflow: hidden`） | **會，沒有上限** | 【原始碼】每 150 ms 一次：`prev`（上次清理後的預覽）+ 新輸出 → `stripAnsi`（11 次 `replace`）→ `split('\n').slice(-8)`。只有遇到 `\n` 才會被截短；**輸出沒有 `\n` 時整串一直留著**。`setPreview` 再把整串設成一個單行文字節點。這段由全域 `pty.onOutput` 觸發，**不管分頁是否 active**。 |
| xterm 解析 / 繪製 | `TerminalPanel.tsx`：`scrollback: 10000`、`CanvasAddon` | alt buffer 不會 | 【原始碼 / 推論】alt buffer 沒有 scrollback，每次寫入的成本受畫面大小（249×69）限制，不隨對話長度成長。normal buffer 的 scrollback 上限 10000 行。 |
| prompt marker | `writeOutput`（`decorationManager`） | 不會 | 只在 normal buffer，上限 100 個。 |
| file:// link provider / WebLinks | `registerLinkProvider` | 不會 | 只在滑鼠移過時掃一行。 |
| `terminalScreenLines` | usage-limit 重查 | 不會 | 只在用量限制重查時跑，最多讀到 `max` 行。 |
| isActive effect 的 `clearTextureAtlas` | `TerminalPanel.tsx` | 不會 | 只在切換分頁時跑（但可能和 GPU 崩潰有關，見 §2）。 |
| OSC 7501 解析、`[terminal-attention]`、輸出遮罩 | 主行程（`PtyManager.enqueuePtyOutput` 等） | — | 在 main，不在 Renderer；遮罩只用在 read-output。 |

#### 5. 實測（假設 C 的依據）

- 【實測】Codex 原始輸出沒有 `\n`：在 WSL Ubuntu 24.04（Linux 原生 PTY，沒有 ConPTY 改寫，和 macOS 一樣）用 codex-cli `0.160.0` 開 249×69 的 PTY，打 33 個字（不送 Enter，不呼叫模型）：使用 alt screen（`?1049h`），約 145 KB 輸出中 **`\n` = 0**，畫面全部用 `CSI row;col H` 定位。
- 【實測】Windows 不同：在原生 Windows（ConPTY）用 codex-cli `0.163.0` 做同樣的事，打 33 個字出現 33 個 `\n`（ConPTY 重新編碼輸出，每次重繪插入 `\x1b[K\n`）。⇒ 【推論】Windows 上預覽每次都被截成 8 行，**這解釋了為什麼只有 macOS 出問題**。
- 【實測】把 WSL 擷取的真實位元組流，丟進複製出來的 `stripAnsi` + flush 邏輯，預覽長度隨輸入**線性成長、不會收斂**（餵 2.3 M 原始字元後剩 86,780 字元；啟動畫面大多是 braille 動畫會被濾掉，保留率只有 3.7%；實際對話的文字保留率會高很多）。
- 【實測】只算 JS（Node 24，複製的 `stripAnsi`）每次 flush：預覽 0.25 MiB → 1.2 ms、1 MiB → 5.5 ms、4 MiB → 22.9 ms、16 MiB → 72.5 ms。
- 【實測】DOM layout（Electron **41.2.1**，和 BAT 同版；仿 `.thumbnail-preview` 樣式，每次設新的 `textContent` 並強制 layout）：64 K 字元 → 9 ms、256 K → 34 ms、1 M → **126 ms**、4 M → **512 ms**。
- 【推論】預覽累積到約 1 M 字元後，每 150 ms 一次的更新要 130 ms 以上，Renderer 主執行緒幾乎沒有空檔 ⇒ 約 1 顆核心、按鍵延遲。這只發生在**有輸出**的時候：Codex 在 `working`（spinner / 計時器持續更新）或你在那個分頁打字（Codex 回顯並重繪）。

### 建議方向

**假設的更新判讀**

| | 新證據：符合 | 新證據：不符 |
|---|---|---|
| **A**（GPU 崩潰後繪圖狀態損壞） | GPU 崩潰確實會一再發生，而且是同一個點（§3）；觸發時機都在建立 / 切換分頁時（§2，推論） | 【日誌】`104323` 沒有任何 GPU 崩潰、全程硬體繪圖，Renderer 仍約 100%；那段時間的手動重繪也和崩潰無關。⇒ **A 不是打字延遲的必要條件**，權重大幅下降 |
| **B**（Codex 長對話每次按鍵重繪太多） | 卡頓和對話長度有關（外部測試者A：20–30%） | Codex 自己的 CPU 低；alt buffer 的 xterm 成本受畫面大小限制（§4）。⇒ B 原本的機制不成立，由 C 取代 |
| **C（新）**：BAT 縮圖預覽字串無上限累積，Renderer 成本隨分頁輸出總量成長 | 和對話長度 / 累積輸出成正比；成本在 BAT Renderer、不在 codex；新分頁從空字串開始所以正常；只在 macOS（Windows ConPTY 會插 `\n`，§5）；BAT 重開後清空（預覽只存在記憶體）；背景分頁在 `working` 也會拖慢整個 Renderer（`104323` 的 `ps` 情境，推論） | 還沒在 外部測試者A 的機器上直接看到預覽長度（給 外部測試者A 的測試 1 一分鐘就能確認） |

前一輪的「舊分頁早於崩潰、新分頁晚於崩潰」在 C 底下可以解釋為：舊分頁 = 累積輸出多的分頁，和崩潰時間只是剛好重疊。

**修正方向草案（使用者決定要不要修；這裡只提建議）**

- **S（推薦先做）**：在 `scheduleBatchedPreviewUpdate` 加上限。
  1. 合併前只保留 `pending` 原始輸出的尾端（例如最後 16 KiB）；從第一個 `\x1b` 或換行之後開始切，避免切到 escape sequence 中間。
  2. `stripAnsi` / `slice(-8)` 之後，每行再限制長度（例如 300 字元，縮圖本來就只顯示約 30 個字），整體上限約 2 KiB。
  3. Claude `onStream` 那條（`combined.split('\n').slice(-8)`）用同一個上限。
  4. 新增單元測試：餵 10 MB 沒有 `\n` 的串流，斷言 `previewCache` 長度 ≤ 上限、單次 flush 時間有界；並保留「一般 shell 輸出 → 最後 8 行」的既有行為。
  - 風險：低。只改縮圖文字。alt-screen 程式的縮圖本來就是重繪片段拼起來的雜訊，截短不會讓它更糟。
- **M（之後可選）**：alt buffer 的分頁，縮圖改從 xterm buffer 讀可視區的最後幾行（節流），讓 Codex / vim 類程式的縮圖有意義。要處理 hidden 分頁、xterm 尚未掛載、分頁在其他工作區等情況。
- **GPU 崩潰另案**（不併進上述修正）：同一個 CHECK 出現 6 次（10-15 五次、10-19 一次）。建議另開 BUG，或在 BUG-136 拆出子項：先用 Electron 41.2.1 darwin-arm64 dSYM 符號化偏移 `15787796` / `15787108` / `9697016`，再評估 isActive effect 的 `clearTextureAtlas` 是否和觸發有關。
- **不得退化**：Win11 isActive effect 的 `clearTextureAtlas()` + `refresh()` 修正不動（S 方案不碰 `TerminalPanel.tsx`）；縮圖的通知徽章、Worker 徽章、usage-limit 徽章不受影響；一般 shell 的縮圖照舊顯示最後 8 行。

### 給 外部測試者A 的問題 / 測試

最多 3 項，都不耗 token：

1. **（最關鍵，約 1 分鐘）確認縮圖預覽長度**：Settings 開啟 DevTools（`enableDevTools`，要重開 BAT 才會出現在 View 選單）→ 重開後照常用 Codex 塔台，直到開始卡 → View → Toggle Developer Tools → Console 貼上：
   `[...document.querySelectorAll('.thumbnail-preview')].map(e => e.textContent.length)`
   - 卡的分頁對應的數字是幾十萬到幾百萬 → **C 確認**，可以直接派 S 修正
   - 每個都只有幾百 → C 排除，回頭查 A / B（改做第 2 項）
2. **選做：Performance 錄 5 秒**：同一個 DevTools → Performance → Record，在卡的分頁打字 5 秒 → Stop，匯出 profile 檔附上。C 的話，主要時間會在 `Layout`，以及 `scheduleBatchedPreviewUpdate` / `replace`。
3. **問題**：`ps` 那 5 筆是每隔幾秒取一次、從幾點幾分開始？取樣時是在 11:38 新開的空白分頁執行的嗎？那時塔台分頁是不是正在跑（working）？（用來確認「背景分頁在 working 也會拖慢 Renderer」）。

### 建議下一步

1. 塔台把 外部測試者A 測試 1 轉給 外部測試者A（最便宜、結果最明確）。
2. 測試 1 確認 C → 派 S 修正工單（`TerminalThumbnail.tsx` 預覽上限 + 單元測試，`npm run test:unit`、`npm run typecheck`、`npx vite build`）；使用者決定要不要先做，再看 外部測試者A 回報。
3. 不論 C 是否成立，GPU 崩潰另案追蹤（符號化 + `clearTextureAtlas` 關聯）；BUG-136 的單據是否拆分，由塔台決定（本單未修改 BUG-136）。

### Renew 歷程

無。

### 遭遇問題

- 日誌沒有 BAT 版本字串，只能從功能日誌推出範圍（`v0.7.0-pre.9` 以後）。
- 原生 Windows 的 Codex 擷取受 ConPTY 改寫影響，不能代表 macOS；改用 WSL 的 Linux PTY 擷取。WSL 的 codex 是 `0.160.0`（外部測試者A 的是 ≥ 0.163.0）；alt screen 的繪製方式（`CSI H` 定位、沒有 `\n`）在這兩個版本之間應該相同，但沒有在 0.163 上直接驗證。
- 第一次嘗試 Chrome Live 失敗（Chrome 沒有啟動），改用 repo 內的 Electron 41.2.1 量測。
- 符號化沒有做（理由見 §3）。
- 暫存檔都在 scratchpad：擷取用的原始輸出已刪除，WSL 的 `/tmp/t0666` 已刪除，沒有複製 外部測試者A 的任何檔案；回報引用的路徑已去識別化；日誌中沒有 `batcap.` 權杖字樣。

### 回報時間

2026-10-19T11:52:04+0800
