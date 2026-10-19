---
schema_version: 1
schema_kind: workorder
id: T0666
title: "研究：BUG-136 第三輪 — Gary 2026-10-19 macOS 日誌 / GPU 崩潰報告 / Renderer CPU 量測判讀（唯讀）"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-136
priority: P2
sizing: S
created_at: "2026-10-19T11:44:00+0800"
started_at: null
updated_at: "2026-10-19T11:44:00+0800"
completed_at: null
depends_on: []
related:
  - "BUG-136（OPEN；前兩輪判讀、假設 A / B、重現方法、待 Gary 區分測試都在單內）"
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
  - "🔴 Gary 的檔案在 `D:\\Downloads\\封存`（使用者本機，**不得複製進 repo、不得 commit**）。日誌含客戶專案路徑與使用者名稱：回報區引用時一律去識別化（路徑改 `<project>` / `<user>`），不得貼整段原始日誌。"
  - "🔴 不得在回報、commit、暫存檔外的任何地方寫出權杖值（日誌若含 `batcap.` 或 token 字樣，只寫「有 / 無」）。"
  - "🔴 符號化（選做）：可下載 Electron 對應版本 darwin-arm64 dSYM 到系統暫存目錄或 scratchpad，以 `llvm-symbolizer` / `llvm-atos` 等工具符號化；時間上限約 20 分鐘或下載 > 1.5 GiB 就放棄，回報寫明。用完刪除下載檔。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；範圍內猜錯會返工的判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 Gary 做的事寫成「給 Gary 的問題 / 測試」清單。"
---

# T0666 — 研究：BUG-136 第三輪（Gary 2026-10-19 macOS 資料）

## 研究目標

BUG-136（macOS 舊分頁打字延遲、Renderer 約 1 顆核心）到目前根因未定（假設 A：GPU 崩潰後繪圖狀態損壞；假設 B：長對話分頁本身每次按鍵重繪太多）。Gary 今天（2026-10-19）提供新一輪資料，請判讀它們**支持 / 排除**哪個假設，並給出可決策的下一步（修正方向或下一輪區分測試）。

## 已知資訊

先完整讀 `_ct-workorders/BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md`（前兩輪判讀、GPU 崩潰時間表、重現方法、可先做的改善）。

### 本輪新資料（`D:\Downloads\封存`）

| 檔案 | 說明 |
|---|---|
| `debug-20261015-130846.log` | 10-15 13:08 啟動的那次 BAT（前一輪分析的是 `112206` / `094818`，這份沒分析過） |
| `debug-20261019-104323.log` | 今天 10:43 啟動的 BAT；Gary 目前裝的版本請從日誌讀（應已含 T0533 `[gpu]` 日誌，`0.6.1-pre.2` 起） |
| `BetterAgentTerminal Helper-2026-10-19-103931.ips` | 今天 10:39:31 的 Helper 崩潰報告（注意：時間**早於** `104323` 那次啟動，屬於前一次程序；請確認是哪種 Helper、哪個執行緒、與前一輪 `114303.ips` 是否同一個崩潰點） |
| `__MACOSX/` | macOS 壓縮檔的 metadata，忽略 |

### Gary 貼的 `ps` 量測（時間未附；pid 60100 = Renderer）

```
60078   1.3 …/BetterAgentTerminal Helper.app/…        60100 100.8 …Helper (Renderer)…
60078   1.4                                            60100  98.7
60078   4.9                                            60100  18.0
60078   2.2                                            60100  40.0
60078   4.9                                            60100  25.8
```

（60079 / 60083 皆 0.0–0.1，省略。）前兩筆 Renderer ≈ 100%，之後降到 18–40%。取樣間隔、當時是否在打字、是哪個分頁 active，Gary 沒說明 —— 請以日誌（pid、分頁切換、`[gpu]`、redraw 時間）推斷可對上的時段，推不出就列為給 Gary 的問題。

### Gary 的新觀察（2026-10-19 11:43）

> 「我發現 Context used 大概在 20–30% 就會開始卡頓了」

「Context used」是 agent 工作階段（Codex / Claude）的 context 使用量。這把卡頓與**對話長度**連在一起（偏假設 B 或「分頁輸出量 / scrollback / 重繪範圍」類），但前一輪量測顯示吃 CPU 的是 BAT Renderer 而非 codex 程序。請判斷這兩點如何同時成立（例：TUI 每次按鍵重送整個畫面 → xterm 解析 / 繪製成本隨畫面內容增加；或 scrollback 行數；或 BAT 自己的輸出處理路徑，如 OSC 7501 解析、`[terminal-attention]`、輸出遮罩、縮圖更新、replay buffer 等）。哪個 agent（Codex / Claude）請從日誌確認。

## 調查範圍

1. **三份資料判讀**（以日誌與崩潰報告為準，標明「日誌證據 / 原始碼 / 推論」）：
   - `104323`：BAT 版本、平台資訊、`[gpu]` 基準與是否有 `crash #N` / `feature status changed`（是否退回軟體繪圖）、分頁建立 / 切換 / redraw 時間線、agent 種類、派工事件；與 Gary 的卡頓時段對照。
   - `130846`：同上，補前一輪缺的 10-15 13:08 之後時段。
   - `103931.ips`：程序類型、觸發執行緒、exception type、Electron 版本與 Framework UUID；與 `114303.ips` 比較（同崩潰點？）。可選做符號化（見 memory_overrides）。
2. **原始碼對照**（唯讀）：從按鍵到畫面的 renderer 路徑上，有哪些成本會隨「分頁輸出量 / 對話長度」增加：`src/components/TerminalPanel.tsx`（xterm 設定、CanvasAddon、scrollback、`clearTextureAtlas`、resize / fit、activation）、renderer 端每筆 PTY 輸出都會跑的處理（縮圖、attention、搜尋、連結偵測等）。列出候選熱點與依據，不實作。
3. **兩個假設的更新判讀**：A / B 各自「符合 / 不符」的新證據；是否需要新假設（例：C = 輸出量驅動的 renderer 熱點，與 GPU 崩潰無關）。
4. **建議**：
   - 若證據足以定方向：給修正方向草案（切分 S / M、風險、不得退化的既有行為，例如 Win11 `clearTextureAtlas` 修正）。
   - 若仍不足：給 Gary 下一輪**最小**測試（≤ 3 項，步驟具體、不耗 token 者優先；例如 DevTools Performance 錄 5 秒打字、同一 context 用量下比較 Claude / Codex、清 scrollback 後是否恢復），並說明各結果分別指向哪個假設。

## 研究指引

- 先讀 `docs/agent-guide/logging.md` 的 `[gpu]` 判讀段，再讀日誌。
- 前一輪結論（BUG-136「判讀」「更新後的判讀」）不要重寫，只寫本輪新增或推翻的部分。
- **不轉述未證實的根因**：結論每條標「日誌證據 / 原始碼 / 推論」。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 Gary 回答的事寫進回報區「給 Gary 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 給 Gary 的問題 / 測試

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
