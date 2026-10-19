---
schema_version: 1
schema_kind: bug
id: BUG-164
title: "macOS：GPU 程序在建立 / 切換終端分頁時以同一個 CHECK 崩潰（`EXC_BREAKPOINT` @ `CrGpuMain`，累計 6 次）"
status: OPEN
severity: low
reproducibility: unknown
created_at: "2026-10-19T12:06:59+0800"
updated_at: "2026-10-19T12:06:59+0800"
impact:
  - gpu-process
  - xterm-canvas
  - macos
links:
  discovered_in: "BUG-136 調查（Gary 回報，2026-10-15 / 2026-10-19）；T0666 判讀"
  related: [BUG-136, T0533, T0666]
---

# BUG-164 — macOS GPU 程序同一個 CHECK 崩潰

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（Chromium 會自動重啟 GPU 程序；目前沒有證據顯示會造成打字延遲，延遲另見 BUG-136） |
| 可重現 | 未確認 |
| **狀態** | 📂 OPEN（使用者 2026-10-19 同意從 BUG-136 拆出另案追蹤） |
| 回報者 | Gary（日誌與崩潰報告）；判讀 T0666 |

## 環境

- macOS 27.0.1（26A434），Apple M2 Pro，雙螢幕
- BAT `0.6.1-pre.1`（兩份崩潰報告的 `build_version`）；Electron Framework UUID `4c4c44be-5555-3144-a121-891fbdf26df9`（Electron `41.2.1` darwin-arm64）

## 現象

- GPU 程序 `child-process-gone type=GPU reason=crashed exitCode=5`，累計 6 次：
  - 10-15 五次：11:43:01、11:43:09、12:02:28、12:12:34、12:23:23（`debug-20261015-112206.log`）
  - 10-19 一次：10:39:29.734（`debug-20261015-130846.log`，該程序跑了 4 天）
- 崩潰報告 `114303.ips`（10-15）與 `103931.ips`（10-19）：`EXC_BREAKPOINT` / `SIGTRAP`，觸發執行緒 `CrGpuMain`，`GpuWatchdog` 不是觸發者。頂層 frame 偏移 **`15787796` / `15787108` / `9697016`**，兩份完全相同，所以是同一個 Chromium CHECK（主動中止），不是存取違規。
- 觸發時機（推論）：5 次中有 3 次在建立終端後 2–12 秒；10-19 那次在切換 active 分頁後 0.4 秒，前 30 秒內剛改過視窗尺寸。兩種動作都會跑 `TerminalPanel.tsx` isActive effect 的 `clearTextureAtlas()` + `refresh()`（重建 canvas glyph texture）。
- 10-15 13:08 之後那次程序連開十多個分頁，都**沒有**崩潰，所以不是每次建立分頁都會觸發。

## 與 BUG-136 的關係

- T0666：10-19 10:43 啟動的那次程序沒有 GPU 崩潰、全程硬體繪圖，Renderer 仍約 1 顆核心 ⇒ GPU 崩潰**不是**打字延遲的必要條件。延遲改由 BUG-136 假設 C（縮圖預覽無上限累積，T0667 修正）處理。
- 是否會讓崩潰前就存在的分頁畫面劣化（BUG-136 原假設 A），尚未排除也未證實。

## 下一步（未派工）

1. 符號化：下載 Electron `41.2.1` darwin-arm64 dSYM，用 `atos` / `llvm-symbolizer` 還原上面三個偏移，找出是哪一個 CHECK。
2. 依 CHECK 名稱評估與 `clearTextureAtlas` / CanvasAddon / 視窗 resize 的關聯；必要時請 Gary 跑 BUG-136 的「快速新增終端」重現步驟，並附 `[gpu]` 日誌（`0.6.1-pre.2` 起才有）。
3. 修正方向（待第 1、2 點）：例如 GPU 崩潰後對所有 xterm 重建 texture atlas，或改用 WebGL addon 並處理 `onContextLoss`。不得讓 Win11 `clearTextureAtlas` 修正退化。

## 附件

Gary 的檔案放在使用者本機 `D:\Downloads\封存`，未入庫。日誌含客戶專案路徑，引用時請去識別化。
