---
schema_version: 1
schema_kind: bug
id: BUG-164
title: "macOS：GPU 程序在建立 / 切換終端分頁時以同一個 CHECK 崩潰（`EXC_BREAKPOINT` @ `CrGpuMain`，累計 6 次）"
status: CLOSED
severity: low
reproducibility: unknown
created_at: "2026-10-19T12:06:59+0800"
updated_at: "2026-10-19T18:12:30+0800"
impact:
  - gpu-process
  - xterm-canvas
  - macos
links:
  discovered_in: "BUG-136 調查（外部測試者A 回報，2026-10-15 / 2026-10-19）；T0666 判讀"
  related: [BUG-136, T0533, T0666, T0668, T0669, PLAN-053]
---

# BUG-164 — macOS GPU 程序同一個 CHECK 崩潰

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（Chromium 會自動重啟 GPU 程序；目前沒有證據顯示會造成打字延遲，延遲另見 BUG-136） |
| 可重現 | 未確認 |
| **狀態** | 🚫 CLOSED（2026-10-19 18:12 使用者同意結案：外部測試者A 以 `v0.7.1-pre.3` 驗收三項皆 PASS，Graphite 關閉後約 4h40m 0 次 GPU 崩潰；若再崩潰另開 BUG，並作為提前做 PLAN-053 的依據）。原 FIXED（T0669 `32d62a45`：macOS 預設 `--disable-skia-graphite`（`BAT_SKIA_GRAPHITE=1` 可恢復）+ GPU 崩潰後重建可見終端；待 外部測試者A 以 `v0.7.1-pre.3` 確認 `skia_graphite=` 不再是 `enabled_on`、期間無 GPU 崩潰。Electron 42+ 升級另見 PLAN-053） |
| 回報者 | 外部測試者A（日誌與崩潰報告）；判讀 T0666 |

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

## T0668 符號化結果（2026-10-19）

完整證據見 `T0668-research-bug164-gpu-check-crash-symbolize.md` 回報區。

- 【二進位】崩潰點是 Chromium 146 `gpu/command_buffer/service/graphite_shared_context.cc:291` 的 `CHECK(simulating_insert_failure || !is_unrecoverable_failure)`。呼叫路徑：`RasterDecoderImpl::DoEndRasterCHROMIUM` → `SharedContextState::FlushGraphiteRecorder` → `GraphiteSharedContext::insertRecording`。
- 【報告】10-19 那次的暫存器 `x21 = 5`，對應 Skia Graphite 的 `kOutOfOrderRecording`。
  - 意思是：前一次 `Recorder::snap()` 準備資源失敗，那份 recording 被丟掉，下一次插入時順序對不上。
  - 真正的起因在崩潰之前，Chromium 自己也只能假設是 GPU OOM。
  - 10-15 那 5 次只有 offset 可查，看不出是狀態 4 還是 5，要看那幾份 `.ips` 的 `x21`。
- 【原始碼】Chromium 147（Electron **42** 起）把這個 CHECK 改成 context lost 後重啟 GPU 程序，不再崩潰，但觸發原因不變。這個修正沒有 backport 到 Electron 41，而 41.10.7 是最後一版。
  - 已知 issue：crbug.com/458722690（Mac、canvas2d 用量大、高頻改尺寸、ImageBitmap 快取），關閉 Graphite 後問題消失或更難重現。
- 【推論】BAT 每個終端有 4 層 GPU 2D canvas，切換或建立分頁時會重配 canvas、清 atlas、重建 ImageBitmap。這段 GPU 資源配置很集中，和崩潰時間吻合（10-19：切換分頁後 0.44 s），但**未證實**是起因。
- 連續崩潰的後果：5 分鐘內崩 3 次，Chromium 會退回軟體繪圖，直到 BAT 重開。
- 建議（使用者決定）：
  - A：macOS 加 `disable-skia-graphite`，保留逃生口（S）。
  - B：GPU 崩潰後讓可見的終端自己重建畫面（S）。
  - C：升級 Electron 42+，另開 PLAN。

## 下一步（未派工）

1. 符號化：下載 Electron `41.2.1` darwin-arm64 dSYM，用 `atos` / `llvm-symbolizer` 還原上面三個偏移，找出是哪一個 CHECK。
2. 依 CHECK 名稱評估與 `clearTextureAtlas` / CanvasAddon / 視窗 resize 的關聯；必要時請 外部測試者A 跑 BUG-136 的「快速新增終端」重現步驟，並附 `[gpu]` 日誌（`0.6.1-pre.2` 起才有）。
3. 修正方向（待第 1、2 點）：例如 GPU 崩潰後對所有 xterm 重建 texture atlas，或改用 WebGL addon 並處理 `onContextLoss`。不得讓 Win11 `clearTextureAtlas` 修正退化。

## 實機驗收（外部測試者A，`v0.7.1-pre.3`）

| 檢查點 | 結果 |
|---|---|
| 日誌有 `[gpu] skia graphite: disabled` | ✅ PASS（15:40 使用者轉達：`[2026-10-19T05:28:36.795Z] [LOG] [gpu] skia graphite: disabled (darwin default, --disable-skia-graphite; BAT_SKIA_GRAPHITE=1 keeps it on)`，即 13:28:36 +0800 啟動） |
| `[gpu] feature status` 的 `skia_graphite=` 不再是 `enabled_on` | ✅ PASS（`debug-20261019-132836.log`：`skia_graphite=disabled_off`） |
| 使用期間無 `child-process-gone type=GPU` / `[gpu] crash #N` | ✅ PASS（同一次執行 13:28–18:10，約 4h40m，0 次） |

外部測試者A 對照（使用者轉達截圖，時間為台灣時間）：

| log 啟動 | `skia_graphite` | GPU 崩潰次數 |
|---|---|---|
| 10/14 11:35 | 無此行 | 3 |
| 10/15 11:22 | 無此行 | 6 |
| 10/15 13:08（跑到 10/19 10:42） | 無此行 | 1 |
| 10/19 10:43 | `enabled_on` | 1 |
| 10/19 12:16 | `enabled_on` | 4（12:00–13:24） |
| **10/19 13:28（pre.3）** | **`disabled_off`** | **0** |

崩潰原因皆 `reason=crashed exitCode=5`。另 10/14 17:04、17:04、10/15 09:48 三次無 feature status 行、0 次崩潰。外部測試者A 的保留：關閉 Graphite 後只有一次約 5 小時的紀錄，尚不能斷定；10/14–10/15 的 log 無 feature status 行，無法比較。

## 附件

外部測試者A 的檔案放在使用者本機 `D:\Downloads\封存`，未入庫。日誌含客戶專案路徑，引用時請去識別化。

## 結案（2026-10-19 18:12）

- 使用者同意結案（外部測試者A 保留意見：只有一次約 5 小時紀錄）。之後若再出現 `child-process-gone type=GPU`，另開新 BUG，並評估提前做 PLAN-053（Electron 42+）。
