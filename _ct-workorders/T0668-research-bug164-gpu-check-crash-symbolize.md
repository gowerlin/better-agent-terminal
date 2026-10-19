---
schema_version: 1
schema_kind: workorder
id: T0668
title: "研究：BUG-164 — 符號化 macOS GPU 程序崩潰點（Electron 41.2.1 darwin-arm64 dSYM），判斷與建立 / 切換分頁時重建畫面的關聯（唯讀）"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-164
priority: P2
sizing: M
created_at: "2026-10-19T12:07:48+0800"
started_at: null
updated_at: "2026-10-19T12:07:48+0800"
completed_at: null
depends_on: []
related:
  - "BUG-164（OPEN；現象、崩潰時間表、偏移量都在單內）"
  - "BUG-136 / T0666 回報區 § 2、§ 3（崩潰報告判讀與觸發時機推論）"
  - "T0533（`[gpu]` 日誌，`electron/gpu-status-log.ts`）"
affects_files:
  - _ct-workorders/T0668-research-bug164-gpu-check-crash-symbolize.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-164 / BUG-136 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 Gary 的檔案在 `D:\\Downloads\\封存`（`BetterAgentTerminal Helper-2026-10-19-103931.ips` 與兩份日誌）。不得複製進 repo、不得 commit；引用時去識別化（路徑改 `<project>` / `<user>`）。前一份 `114303.ips` 不在本機，以 BUG-136 / BUG-164 的記載為準。"
  - "🔴 下載：Electron `41.2.1` darwin-arm64 dSYM（GitHub `electron/electron` release 的 `*-dsym*.zip`，先以 `.ips` 的 Framework UUID `4c4c44be-5555-3144-a121-891fbdf26df9` 確認版本相符，不符就停下回報）與符號化工具（例如 LLVM 官方 release 的 `llvm-symbolizer` / `llvm-atos` / `llvm-dwarfdump`，或 WSL 內現成的工具）。一律放系統暫存目錄或 scratchpad，**不得安裝到系統**、不得 `sudo apt install`、不得改 PATH 設定檔；用完刪除並在回報寫明。單一下載 > 3 GiB 或總耗時 > 60 分鐘就停下回報目前進度。"
  - "🔴 Chromium 原始碼查證以線上原始碼（chromium.googlesource.com / source.chromium.org，對應 Electron 41.2.1 的 Chromium 版本）為準，標明 tag / 行號與查證日期；不 clone 整個 Chromium。"
  - "🔴 不在本機嘗試重現 macOS GPU 崩潰；需要 Gary 做的事寫進「給 Gary 的問題 / 測試」（≤ 3 項，不耗 token 者優先）。"
  - "🔴 yolo Worker：不得問使用者。修不修、怎麼修由使用者決定，你只提推薦；範圍內猜錯會返工的判讀問題依 ct-exec § Questions For Tower 問塔台（每輪 ≤ 3 題）。"
---

# T0668 — 研究：BUG-164 GPU 程序崩潰點符號化

## 研究目標

macOS GPU 程序以同一個 CHECK 崩潰了 6 次（`EXC_BREAKPOINT` @ `CrGpuMain`，頂層 frame 偏移 `15787796` / `15787108` / `9697016`）。找出是哪一個 CHECK、什麼條件會觸發它，判斷和 BAT 建立 / 切換終端分頁時的畫面重建（`TerminalPanel.tsx` isActive effect 的 `clearTextureAtlas()` + `refresh()`、CanvasAddon、視窗 resize）有沒有因果關係，並給出可決策的修正建議。使用者打算把結果和 T0667（BUG-136 縮圖預覽上限）一起發版。

## 已知資訊

先完整讀 `BUG-164-macos-gpu-process-check-crash-on-tab-create-switch.md`，以及 T0666 回報區 § 2、§ 3。

## 調查範圍

1. **符號化**：從 `.ips`（JSON）取出崩潰執行緒完整的 frame 清單（不只頂層三個），以及 Electron Framework 的 UUID、load address、`__TEXT` vmaddr。用 dSYM 還原函式名、原始檔與行號（含 inline frame）。附上換算方式（offset ↔ address），讓別人可以重做。
2. **CHECK 的意義**：依符號化結果到 Chromium 原始碼找出該 CHECK / `NOTREACHED` / `LOG(FATAL)` 的條件，說明觸發它的狀態（例如 shared image / mailbox 生命週期、Skia Graphite / Metal、context lost、display / 視窗尺寸改變）。查 Chromium / Electron issue tracker 有沒有相同 stack 的已知 bug、修在哪一版、Electron 哪一版帶進來。
3. **與 BAT 的關聯**（唯讀看原始碼）：Renderer 端哪些操作可能走到這條路徑：
   - CanvasAddon 2D canvas 的建立 / 銷毀 / resize
   - `clearTextureAtlas`
   - 縮圖、多個 xterm 同時存在
   - 視窗 resize、雙螢幕移動
   - 對照 Gary 日誌裡崩潰前幾秒的事件（`debug-20261015-130846.log` 10-19 10:39:29 附近，以及 BUG-164 列的 10-15 時間表）
   - 每一點標「日誌證據 / 原始碼 / 推論」
4. **建議**：
   - 可在 BAT 端避開或緩解的做法（例如減少不必要的 `clearTextureAtlas`、GPU 崩潰後重建所有 xterm 的 texture atlas、改用 WebGL addon 並處理 `onContextLoss`、Chromium 旗標 / 停用 Graphite 的取捨），每個方案寫切分（S / M）、風險，以及不得退化的既有行為（Win11 `clearTextureAtlas` 修正）。
   - 若根因在 Chromium 而 BAT 無法避開，說明升級 Electron 是否能解（哪一版修了），以及先不處理的影響（GPU 程序自動重啟，使用者看到什麼）。

## 研究指引

- `[gpu]` 日誌的判讀見 `docs/agent-guide/logging.md`。Gary 那兩份崩潰報告是 `0.6.1-pre.1`，當時沒有 `[gpu]` 日誌。
- 不轉述未證實的根因，每條結論標來源。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。

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
