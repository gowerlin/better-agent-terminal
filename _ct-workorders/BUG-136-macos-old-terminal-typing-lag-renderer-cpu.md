---
schema_version: 1
schema_kind: bug
id: BUG-136
title: "macOS：使用已久的 Codex 塔台分頁打字嚴重延遲，BAT Renderer 持續約 1 顆核心；同一程序新開的分頁正常。期間 GPU 行程崩潰 5 次"
status: FIXED
severity: medium
reproducibility: unknown
created_at: "2026-10-15T13:13:21+0800"
updated_at: "2026-10-19T12:05:54+0800"
impact:
  - terminal-rendering
  - xterm-canvas
  - macos
links:
  discovered_in: "Gary 回報（2026-10-15，v0.6.1-pre.1）"
  related: [T0533, T0666, T0667]
---

# BUG-136 — macOS 舊分頁打字延遲、Renderer 約 100% CPU

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（舊塔台分頁幾乎無法打字；繞行：新開分頁 + 新 Codex 工作階段） |
| 可重現 | 未確認（無最小重現；根因未定，見「判讀」） |
| **狀態** | ✅ FIXED（2026-10-19 T0667 `a9f0ad5a`：縮圖預覽上限，針對假設 C；待 Gary 以含此修正的版本確認打字延遲消失。確認失敗 → 退回 OPEN。GPU 崩潰（同一 CHECK 6 次）不在本修正範圍） |
| 回報者 | Gary（附量測與日誌） |

## 環境

- BAT `0.6.1-pre.1`（安裝版），Codex CLI `0.162.1`
- macOS 27.0.1（26A434），Apple M2 Pro，16 GiB
- 雙螢幕 2560×1440 + 1920×1080；BAT 視窗最大化，舊分頁 249×69

## 現象

- **實際**：使用已久、含大量對話的 Codex 塔台分頁（`be5530dd`）打字嚴重延遲。關閉 Word 後仍卡。
- **預期**：長時間使用的分頁在工作停止後仍能順暢輸入。
- 同一 BAT 程序內，新開的空白終端（12:54）與新 Codex 塔台工作階段（12:57）打字正常。

## 量測（Gary，12:50:13–12:51:56 +0800，`ps` / `vm_stat`）

- BAT Helper (Renderer) pid 64282：100.6% / 100.7% / 100.8%（單程序，約 1 顆核心），RSS 443 → 461 MiB
- WindowServer：43.4% / 38.9% / 40.3%
- Codex 程序：6.5% → 1.1% → 1.4%，其餘 0%
- Word 0%
- swap 已用 2105 MiB；103 秒內 swapout +0、swapin +203 頁
- 量測時舊分頁為 active（日誌 12:50:49 切回 `be5530dd`）
- 未量測：輸入延遲毫秒數、切到新分頁後的 Renderer CPU、CPU / heap profile

## 日誌證據（塔台分析，`debug-20261015-112206.log`）

以下時間皆為 +0800。

1. **GPU 行程崩潰 5 次**：`[CRASH] child-process-gone type=GPU reason=crashed exitCode=5`，時間為 11:43:01、11:43:09、12:02:28、12:12:34、12:23:23。Gary 的報告未提及此事。前一份日誌 `debug-20261015-094818.log`（09:48–11:21）沒有 GPU crash。
2. **崩潰後出現手動重繪**：
   - 12:12:34 崩潰後 49 秒，`c7852c1c` 按了 `[redraw] manual redraw`
   - 13:00:52 舊分頁 `be5530dd` 連按兩次重繪
   - 推測崩潰後畫面曾損壞
3. **新、舊分頁在同一程序**：12:54 的 `6841ca6b`、12:57 的 `b91b6c8c` 與舊分頁共用 main PID 64074 和同一個 Renderer，期間沒有重啟。⇒ 卡頓綁在分頁本身，不是整個 Renderer 都慢。
4. **舊分頁建立時間早於所有崩潰**：`be5530dd` 在 11:22 由 Terminal Server 保留的 PTY 還原；09:48 那次已存在，11:21 quit 時 `stopTerminalServer=false`，Codex 程序跨 BAT 重啟存活。
   - 崩潰前建立：`b308fb64` / `301bc669`（11:23）、`b9271150`（11:35）、`bf632657`（11:42）
   - 崩潰後建立：新的兩個分頁
5. **啟動慢 8 秒（另案觀察，未分析）**：11:22 啟動時 `buildMenu` 到 `RemoteServer Started` 間隔約 7.8 s，`first-renderer-ipc` +8178 ms；09:48 那次為 +498 ms。工作區在 Google Drive `CloudStorage` 底下，是否相關未驗證。

`bat-scripts.log` 只有派工 / 通知事件，與本案無關。

## Gary 第二輪回覆與新證據（2026-10-15 13:20）

**Gary 回覆（13:16–13:19）**

- 「是我派了好幾個工單後才開始卡頓」；每次開啟都是新的塔台分頁。
- 「沒有重開 BAT，只有新增一個 codex cli 分頁，然後關掉舊分頁」。但日誌在 11:21:04 有 `[quit] user confirmed quit`，11:22:06 新程序啟動。可能是關掉最後一個視窗或 Cmd+Q 觸發；不影響判讀。
- macOS 上 BAT 關閉後舊塔台不會留存：13:16 的 `ps` 顯示 terminal-server 與所有 codex 都是 BAT 重開後才啟動的。⇒ 原區分測試 1、2 已無法執行。

**GPU 崩潰時間與派工的關係**（`debug-20261015-112206.log`，+0800）

| GPU 崩潰 | 前一個事件 | 間隔 |
|---|---|---|
| 11:43:01 | 11:42:50 / 11:42:57 派工建立 `bf632657`、`f9b80c1a` | 4 s |
| 11:43:09 | 同上 | 12 s |
| 12:02:28 | 無建立事件（12:01:13 在舊分頁貼上文字） | — |
| 12:12:34 | 12:12:32 派工建立 `c7852c1c`；12:13:23 該分頁手動重繪 | 2 s |
| 12:23:23 | 12:21:37 對 `c7852c1c` 送 `$ct-exec`（notify `--submit`） | 106 s |

5 次中有 3 次在新終端建立後 2–12 秒內發生。卡頓開始時間與 Gary 說的「派了好幾個工單後」一致。

**崩潰報告**：`BetterAgentTerminal Helper-2026-10-15-114303.ips`，對應 11:43:01 那次。

- GPU 程序 pid 64267，11:22:06 啟動
- `EXC_BREAKPOINT` / `SIGTRAP`（Trace/BPT trap: 5），觸發執行緒 `CrGpuMain`（GPU 主執行緒）
- 判讀：Chromium 主動中止（CHECK / fatal），不是存取違規
- Electron Framework 未符號化（UUID `4c4c44be-5555-3144-a121-891fbdf26df9`，base `0x10f148000`）。頂層 frame 偏移 `15787796`、`15787108`、`9697016`。要知道是哪個 CHECK，需用 Electron `41.2.1` darwin-arm64 dSYM 以 `atos` 符號化。
- `GpuWatchdog` 執行緒存在但不是觸發者，看起來不是 watchdog 逾時

**更新後的判讀**：假設 A 的權重上升，並多了一個觸發條件。

- 派工 → 建立新終端（新 xterm + CanvasAddon canvas）→ GPU 程序 CHECK 崩潰
- 崩潰前就存在的終端畫面劣化：舊塔台卡頓、Renderer 約 1 核心；崩潰後才建立的終端正常
- 仍未排除 B，也未確認 Renderer CPU 的實際熱點

**新的重現方法**（不需要 Codex，不耗 token）：

1. 重開 BAT，開一個一般終端並輸出一些內容（例如 `ls -R ~ | head -3000`）
2. 連續按「+」快速新增 4–6 個終端
3. 每加一個就檢查有沒有新的 GPU 崩潰報告：`ls -lt ~/Library/Logs/DiagnosticReports | grep "BetterAgentTerminal Helper" | head -3`
4. 出現新的報告後，回第 1 步的終端打字，同時記錄 Renderer CPU
5. 判讀：
   - 重現 → 純 BAT / Chromium 問題，與 Codex 無關
   - 開了很多終端都沒有崩潰 → 回到派工路徑（Codex 啟動、notify `--submit`）找差異

## 第三輪（2026-10-19，T0666 研究）

新資料：`debug-20261015-130846.log`、`debug-20261019-104323.log`、`BetterAgentTerminal Helper-2026-10-19-103931.ips`、Gary 的 `ps`（Renderer pid 60100：100.8 / 98.7 / 18.0 / 40.0 / 25.8%），以及 Gary 11:43 的觀察「Context used 大概在 20–30% 就會開始卡頓」。完整證據見 `T0666-research-bug136-macos-renderer-cpu-round3.md` 回報區。

- 【日誌】`104323`（Gary 現在裝的是 `v0.7.0-pre.9` 以後的版本，agent 全是 Codex）：**沒有 GPU 崩潰**，全程硬體繪圖，但 Renderer 仍約 1 顆核心 ⇒ **假設 A 不是打字延遲的必要條件**。
- 【日誌】`103931.ips` 的頂層偏移和 `114303.ips` 完全相同 ⇒ 同一個 GPU CHECK（累計 6 次）。觸發時機是建立或切換分頁時，候選是 isActive effect 的 `clearTextureAtlas`（推論）。**和打字延遲是兩件事**，另案追蹤。
- 【原始碼 + 實測】**假設 C（新，權重最高）**：縮圖預覽 `scheduleBatchedPreviewUpdate`（`src/components/TerminalThumbnail.tsx`）只在遇到 `\n` 時才截短。Codex 用 alt screen，輸出時 Linux / macOS 的 PTY 幾乎不含 `\n`（WSL 實測 145 KB 輸出中 `\n` = 0），Windows ConPTY 則會插入 `\n`。所以 macOS 上預覽字串會無上限累積，每 150 ms 跑 11 次 regex，再對一個單行文字節點重新 layout。用 Electron 41.2.1 實測 layout：1 M 字元要 126 ms、4 M 字元要 512 ms。C 可以同時解釋四件事：卡頓隨對話長度出現、吃 CPU 的是 BAT Renderer 而不是 codex、新分頁正常、只發生在 macOS。
- 待 Gary 確認（約 1 分鐘）：開始卡的時候，在 DevTools Console 執行 `[...document.querySelectorAll('.thumbnail-preview')].map(e => e.textContent.length)`。卡的那個分頁如果是幾十萬以上 → C 確認。
- 修正草案（S）：預覽在合併前只保留尾端，每行限長，整體上限約 2 KiB；Claude `onStream` 那條也套同一個上限；加單元測試。不碰 `TerminalPanel.tsx`。

## 判讀（根因未定，兩個假設）

| | A：BAT 繪圖狀態在 GPU 崩潰後損壞 | B：Codex 舊工作階段本身變慢 |
|---|---|---|
| 機制 | 終端使用 `@xterm/addon-canvas` `^0.7.0`（`src/components/TerminalPanel.tsx` `new CanvasAddon()`），沒有處理 2D context loss（WebGL addon 才有 `onContextLoss`）。GPU 崩潰前建立的 canvas 與 texture atlas 可能處在異常狀態；崩潰後新建的正常。Chromium 在 GPU 反覆崩潰後也可能整體退回軟體繪圖，與 WindowServer 約 40% 相符 | 長對話的 Codex TUI 每次按鍵重畫大量畫面 |
| 符合 | 舊分頁早於崩潰、新分頁晚於崩潰；崩潰後有手動重繪 | 卡的正是長對話分頁 |
| 不符 | 09:48–11:21 沒有崩潰。若那段已卡（11:21 的重啟是否因卡頓？），A 不成立 | Codex 程序 CPU 只有 1–6%，吃 CPU 的是 BAT Renderer |

**Worker 未取得區分測試結果前，不轉述任何根因。**

## 待 Gary 做的區分測試

1. 在**崩潰前就開著的非 Codex 分頁**（例如第二個工作區 11:23 的空白終端）打字。
   - 也卡 → 偏 A
   - 順 → 偏 B
2. **只重開 BAT（quit 時保留終端 / 不停 Terminal Server）**，回到舊 Codex 分頁打字。Codex 程序與長對話保留，只重建 BAT 畫面。
   - 變順 → A
   - 仍卡 → B
3. 確認 09:48–11:21（尚無 GPU 崩潰）那段，舊分頁是否已經卡；11:21 的重啟是否因為卡頓。
4. 選做：
   - Settings 開 DevTools，Performance 錄 5 秒在舊分頁打字的過程
   - 附上 `~/Library/Logs/DiagnosticReports` 內 11:43–12:23 的 GPU 崩潰報告

## 可先做的改善（不論 A / B）

- `electron/main.ts` 的 `child-process-gone`（type=GPU）額外記錄 `app.getGPUFeatureStatus()`，判斷是否已退回軟體繪圖。→ **T0533 完成**：`0.6.1-pre.2` 起日誌可判斷是否退回軟體繪圖（`[gpu] feature status` 基準、`[gpu] crash #N` + 崩潰當下狀態與變動、`feature status changed`；判讀見 `CLAUDE.md`「Logging」節）。本單仍 OPEN，T0533 只是診斷，不是修正。
- 終端 renderer 在 GPU 崩潰 / context loss 後自動重建：
  - 方案一：CanvasAddon 監聽 `contextlost` / `contextrestored`，或在 GPU crash 時對所有 xterm `clearTextureAtlas()` + `refresh`
  - 方案二：改用 `@xterm/addon-webgl` 並在 `onContextLoss` 時 dispose 後 fallback
  - 需評估與既有 Win11 `clearTextureAtlas` 修正（`TerminalPanel.tsx` isActive effect）的互動，不得造成退化

## 附件

Gary 提供的檔案放在使用者本機，未入庫：

- `debug-20261015-094818.log`、`debug-20261015-112206.log`、`bat-scripts.log`
- `關閉Word後量測.json`、`新舊工作階段比較.json`、`BAT問題回報草稿.txt`

日誌含客戶專案路徑，引用時請去識別化。
