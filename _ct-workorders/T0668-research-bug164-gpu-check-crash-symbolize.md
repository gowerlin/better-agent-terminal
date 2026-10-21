---
schema_version: 1
schema_kind: workorder
id: T0668
title: "研究：BUG-164 — 符號化 macOS GPU 程序崩潰點（Electron 41.2.1 darwin-arm64 dSYM），判斷與建立 / 切換分頁時重建畫面的關聯（唯讀）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-164
priority: P2
sizing: M
created_at: "2026-10-19T12:07:48+0800"
started_at: "2026-10-19T12:08:54+0800"
updated_at: "2026-10-19T12:21:36+0800"
completed_at: "2026-10-19T12:21:36+0800"
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
  - "🔴 外部測試者A 的檔案在 `D:\\Downloads\\封存`（`BetterAgentTerminal Helper-2026-10-19-103931.ips` 與兩份日誌）。不得複製進 repo、不得 commit；引用時去識別化（路徑改 `<project>` / `<user>`）。前一份 `114303.ips` 不在本機，以 BUG-136 / BUG-164 的記載為準。"
  - "🔴 下載：Electron `41.2.1` darwin-arm64 dSYM（GitHub `electron/electron` release 的 `*-dsym*.zip`，先以 `.ips` 的 Framework UUID `4c4c44be-5555-3144-a121-891fbdf26df9` 確認版本相符，不符就停下回報）與符號化工具（例如 LLVM 官方 release 的 `llvm-symbolizer` / `llvm-atos` / `llvm-dwarfdump`，或 WSL 內現成的工具）。一律放系統暫存目錄或 scratchpad，**不得安裝到系統**、不得 `sudo apt install`、不得改 PATH 設定檔；用完刪除並在回報寫明。單一下載 > 3 GiB 或總耗時 > 60 分鐘就停下回報目前進度。"
  - "🔴 Chromium 原始碼查證以線上原始碼（chromium.googlesource.com / source.chromium.org，對應 Electron 41.2.1 的 Chromium 版本）為準，標明 tag / 行號與查證日期；不 clone 整個 Chromium。"
  - "🔴 不在本機嘗試重現 macOS GPU 崩潰；需要 外部測試者A 做的事寫進「給 外部測試者A 的問題 / 測試」（≤ 3 項，不耗 token 者優先）。"
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
   - 對照 外部測試者A 日誌裡崩潰前幾秒的事件（`debug-20261015-130846.log` 10-19 10:39:29 附近，以及 BUG-164 列的 10-15 時間表）
   - 每一點標「日誌證據 / 原始碼 / 推論」
4. **建議**：
   - 可在 BAT 端避開或緩解的做法（例如減少不必要的 `clearTextureAtlas`、GPU 崩潰後重建所有 xterm 的 texture atlas、改用 WebGL addon 並處理 `onContextLoss`、Chromium 旗標 / 停用 Graphite 的取捨），每個方案寫切分（S / M）、風險，以及不得退化的既有行為（Win11 `clearTextureAtlas` 修正）。
   - 若根因在 Chromium 而 BAT 無法避開，說明升級 Electron 是否能解（哪一版修了），以及先不處理的影響（GPU 程序自動重啟，使用者看到什麼）。

## 研究指引

- `[gpu]` 日誌的判讀見 `docs/agent-guide/logging.md`。外部測試者A 那兩份崩潰報告是 `0.6.1-pre.1`，當時沒有 `[gpu]` 日誌。
- 不轉述未證實的根因，每條結論標來源。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

✅ DONE（研究單，唯讀）。符號化完成，崩潰點與失敗狀態已確認；建議與給 外部測試者A 的測試見下。

Landing check：**PASS**。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 只有工單檔本身（不適用）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 互動紀錄

無（沒有問塔台，也沒有問使用者）。

### 調查結論

標記：【報告】= 外部測試者A 的 `.ips`；【日誌】= 外部測試者A 的 BAT 日誌；【二進位】= 對 Electron 41.2.1 官方檔案的符號化 / 反組譯；【原始碼】= Chromium / Skia / 本 repo 原始碼（查證日 2026-10-19）；【推論】= 尚未證實。

**一句話結論**：GPU 程序崩潰在 Chromium `gpu/command_buffer/service/graphite_shared_context.cc:291` 的 `CHECK(simulating_insert_failure || !is_unrecoverable_failure)`。Skia Graphite 的 `insertRecording` 回傳了 **`kOutOfOrderRecording`**（狀態值 5），意思是同一個 Recorder 前面有一份 recording 沒有送進 GPU（被丟掉），之後的 recording 順序對不上。Chromium 146（Electron 41 全系列）把這個狀態當成不可恢復，直接 CHECK 崩潰；Chromium 147 起改成 context lost 後重啟 GPU 程序，不再崩潰，Electron **42** 起才帶進來。真正的觸發點是「前面那份 recording 為什麼失敗」，這一點從崩潰報告看不出來。

#### 1. 符號化

【二進位】版本確認：Electron 官方 `electron-v41.2.1-darwin-arm64-symbols.zip`（breakpad 符號，123 MB）的 `MODULE mac arm64 4C4C44BE55553144A121891FBDF26DF90 Electron Framework`，`electron-v41.2.1-darwin-arm64.zip` 內 `Electron Framework` 的 `LC_UUID` = `4c4c44be55553144a121891fbdf26df9`，兩者都和 `.ips` 的 `4c4c44be-5555-3144-a121-891fbdf26df9` 相符。沒有下載 1.3 GB 的 dSYM：breakpad 檔沒有 INLINE 記錄，但行號表 + 反組譯已足以定位 CHECK（見下）。

【報告】`103931.ips`：GPU 程序（`CrGpuMain` 執行緒 0，frame #30 是 `content::GpuMain`），`EXC_BREAKPOINT` / `brk 0`，`pc` = `0x1105d2714`，Electron Framework load address `0x10f6c4000`（4553719808）。

**換算方式**（可重做）：
- `.ips` 每個 frame 的 `imageOffset` = 執行位址 − image load address。例：`0x10f6c4000 + 15787796 = 0x1105d2714` = 例外 `pc`。
- Electron Framework 的 `__TEXT` vmaddr = `0x0`（讀 Mach-O `LC_SEGMENT_64`），所以 breakpad / DWARF 位址 = `imageOffset`。
- frame #0 用 `imageOffset` 本身查；其餘 frame 是返回位址，用 `imageOffset − 4`（arm64 一條指令）查，才會落在 call 指令那一行。
- 工具：breakpad `.sym` 的 `FUNC` / 行號記錄用 Python 掃描；反組譯用 capstone（臨時 venv，見「遭遇問題」）。

崩潰執行緒（#20–#25 為 CoreFoundation / Foundation 的 run loop，#36 Helper `main`，#37 `dyld start`，省略）：

| # | offset | 函式 | 原始檔:行 |
|---|---|---|---|
| 0 | 15787796 (`0xf0e714`) | `gpu::GraphiteSharedContext::InsertRecordingImpl` +0x21c | `base/immediate_crash.h:180`（CHECK 的 trap；外層 = `graphite_shared_context.cc:291`，見下） |
| 1 | 15787108 (`0xf0e464`) | `gpu::GraphiteSharedContext::insertRecording` | `graphite_shared_context.cc:211` |
| 2 | 9697016 (`0x93f6f8`) | `gpu::SharedContextState::FlushGraphiteRecorder` | `shared_context_state.cc:863` |
| 3 | 9696684 | `gpu::SharedContextState::FlushWriteAccess` | `shared_context_state.cc:888` |
| 4 | 9694736 | `gpu::raster::RasterDecoderImpl::DoEndRasterCHROMIUM` | `raster_decoder.cc:3108` |
| 5 | 9694216 | `RasterDecoderImpl::HandleEndRasterCHROMIUM` | `raster_decoder_autogen.h:151` |
| 6 | 9693652 | `RasterDecoderImpl::DoCommands` | `raster_decoder.cc:1535` |
| 7 | 16912276 | `gpu::CommandBufferService::Flush` | `command_buffer_service.cc:267` |
| 8 | 16911300 | `gpu::CommandBufferStub::OnAsyncFlush` | `command_buffer_stub.cc:504` |
| 9 | 11332268 | `CommandBufferStub::ExecuteDeferredRequest` | `command_buffer_stub.cc:173` |
| 10 | 11329204 | `gpu::GpuChannel::ExecuteDeferredRequest` | `gpu_channel.cc:833` |
| 11–12 | | `base::internal::Invoker<…>::RunOnce`（bind / callback） | `bind_internal.h:740` / `callback.h:155` |
| 13 | 7649060 | `gpu::Scheduler::ExecuteSequence` | `callback.h:155` |
| 14 | 7647808 | `gpu::Scheduler::RunNextTask` | `scheduler.cc:625` |
| 15–19, 26–29 | | `TaskAnnotator` / `ThreadControllerWithMessagePumpImpl` / `MessagePumpCFRunLoopBase` / `RunLoop::Run` | `base/…` |
| 30 | 110774448 | `content::GpuMain` | `content/gpu/gpu_main.cc:482` |
| 31–35 | | `RunOtherNamedProcessTypeMain` → `ContentMain` → `ElectronMain` | `electron_library_main.mm:36` |

（#18 offset 3383492 在 breakpad 檔裡沒有 FUNC 記錄，應為 tail call 或沒有符號的 thunk，不影響判讀。原報告的 `cppgc::…` / `v8::External::Value` 等名稱是最近的匯出符號，沒有意義，T0666 判讀正確。）

#### 2. 是哪一個 CHECK、什麼狀態

【二進位】`InsertRecordingImpl`（`0xf0e4f8`–`0xf0e7b0`）的行號表：`0xf0e700` = 第 287 行、`0xf0e708`–`0xf0e710` = 第 291 行，緊接著 `0xf0e714: brk #0`。反組譯：

```
f0e6fc: and  w23, w21, #0xfffffffe   ; w21 = insert_status
f0e700: cmp  w21, #4                 ; kAsyncShaderCompilesFailed?
f0e704: b.eq #0xf0e744               ; 是 → 先 ScopedIncrement(use_shader_cache)，最後也跳到 f0e714
f0e708: cbnz w22, #0xf0e5a0          ; w22 = fSimulatedStatus（≠0 → 模擬失敗，正常返回）
f0e70c: cmp  w23, #4                 ; status ∈ {4, 5}?
f0e710: b.ne #0xf0e5a0               ; 否 → 正常返回
f0e714: brk  #0                      ; ← 崩潰點：CHECK(simulating_insert_failure || !is_unrecoverable_failure)
```

【報告】崩潰當下暫存器：`x21 = 5`、`x22 = 0`、`x23 = 4`、`lr = 0x10f6c4000 + 0xf0e6fc`。
- `x21 = 5` = `skgpu::graphite::InsertStatus::kOutOfOrderRecording`（【原始碼】Skia `30d129c8` `include/gpu/graphite/GraphiteTypes.h`：0 kSuccess、1 kInvalidRecording、2 kPromiseImageInstantiationFailed、3 kAddCommandsFailed、4 kAsyncShaderCompilesFailed、5 kOutOfOrderRecording）。
- `lr = …0xf0e6fc`：最後一次呼叫是第 272 行 `LOG(ERROR) << "Graphite insertRecording failed with status …"` 的結尾；若走狀態 4 那條路，`lr` 會是 `0xf0e77c`。兩個證據一致 ⇒ **10-19 這次是 `kOutOfOrderRecording`**。
- 注意：狀態 4 和 5 都會在同一個 `0xf0e714` 崩潰，所以 10-15 的 `114303.ips` 雖然 offset 完全相同，**無法從 offset 判斷是 4 還是 5**，要看它的 `x21`（本機沒有那份檔，見給 外部測試者A 的第 1 項）。BAT 已設 `disable-gpu-shader-disk-cache`（`electron/main.ts:146`），「磁碟 shader 快取損壞」造成狀態 4 的可能性低。

【原始碼】Chromium `146.0.7680.188`（Electron 41.2.1 的 `chromium_version`，`electron/electron` `DEPS@v41.2.1`）`gpu/command_buffer/service/graphite_shared_context.cc`：
- 第 258 行 `graphite_context_->insertRecording(*info_ptr)`；第 280–283 行 `is_unrecoverable_failure = (status == kAsyncShaderCompilesFailed || status == kOutOfOrderRecording)`；**第 291 行 `CHECK(simulating_insert_failure || !is_unrecoverable_failure)`**。
- 呼叫端 `shared_context_state.cc:858–864` `FlushGraphiteRecorder()`：`snap()` 回傳 `nullptr` 時直接略過，不插入。

【原始碼】為什麼會 out of order（Skia `30d129c8`）：
- `src/gpu/graphite/Recorder.cpp` `snap()`：先 `new Recording(fNextRecordingID++, …)` 取號，之後 `prepareResources(...)` 失敗就 `recording = nullptr` 回傳 —— **號碼已用掉、recording 被丟掉**。
- `src/gpu/graphite/QueueManager.cpp:121–128`：要求有序的 Recorder，插入的 `uniqueID != 上一個 + 1` 就回 `kOutOfOrderRecording`（並印 `Recordings are expected to be replayed in order`）。
- ⇒ 【推論】GPU 主執行緒 Recorder 的某次 `snap()` 準備資源失敗（例如 texture / buffer 配置失敗），那份 recording 被丟掉；**下一次** raster flush（這裡是 `DoEndRasterCHROMIUM`）插入時就崩潰。崩潰的那一次 flush 不是起因，起因在它之前。Chromium 自己也還不知道根因：main 上的 TODO 寫「assume the reason of out of order is OOM for now」（crbug.com/478211694，非公開）。

【原始碼】Chromium 的處理歷程（GitHub `chromium/chromium` 鏡像的 commit 紀錄；M146 branch point = main #1582197、M147 = #1596535，chromiumdash）：

| commit | main 位置 | 內容 | 版本 |
|---|---|---|---|
| `d931bedc04`（2026-01-30） | #1577487 | 把 `kOutOfOrderRecording` 加進不可恢復清單 → CHECK 崩潰（bug 458722690） | M146 起（Electron 41） |
| `ed44a45932`（2026-02-11） | #1583059 | 改為 `MarkContextLost(kOutOfMemory)`，「graceful restart instead of crashing」（bug 478211694） | M147 起；**未併入 M146**：`146.0.7680.216`（Electron 41 最後一版 41.10.7）第 280–291 行仍相同 |
| `23c6e84ed0` / `12f4bfc0ed` | #1585270 / #1586705 | 崩潰前把 insert 錯誤訊息存成 crash key | M147 起 |

- 【原始碼】`148.0.7778.96`（Electron 42.0.0）/ `148.0.7778.280`（Electron 42.11.15）：`kOutOfOrderRecording` → `mark_context_lost_callback_.Run(error::kOutOfMemory)`；`gpu_channel_manager.cc` `OnContextLost` 在非 GL 的 GrContext（Graphite）下呼叫 `MaybeExitOnContextLost` → `GpuServiceImpl::RestartGpuProcessForContextLoss`。⇒ **升到 Electron 42 不再崩潰，但 GPU 程序仍會重啟一次**；觸發原因不變。
- Electron 對應：41.x = Chromium 146（41.2.1 → `.188`、41.10.7 → `.216`）、42.x = 148、43.x = 150、44.x = 152。41.10.7（2026-08-24）之後沒有 41 的新版，現行為 42 / 43 / 44。

【原始碼】已知 issue：**crbug.com/458722690**（公開，Mac、Internals>Skia、回報於 142）「Chrome glitches when trying to use canvas2d context extensively」。回報者的描述：程式「大量使用 offscreen canvas、高頻改變尺寸、大量用 ImageBitmap 做快取」，log 出現 `Recordings are expected to be replayed in order`，在 `chrome://flags` 關掉 Graphite 後問題消失或更難重現。沒有穩定重現步驟。這個 issue 的關聯 commit 就是 `d931bedc04`。

#### 3. 與 BAT 的關聯

| 項目 | 依據 | 判讀 |
|---|---|---|
| 崩潰的 GPU 指令來自 OOP raster（`RasterDecoderImpl::DoEndRasterCHROMIUM`） | 二進位 | 網頁內容的 tile 光柵化與 GPU 加速 2D canvas 都走 raster decoder；BAT 視窗裡大部分繪製來自 xterm 的 2D canvas。【推論】無法從 stack 分辨是哪一個 canvas / tile。 |
| BAT 的終端繪製大量使用 GPU 2D canvas | 原始碼 | `TerminalPanel.tsx:366` `new CanvasAddon()`（`@xterm/addon-canvas` 0.7.0）。每個終端 4 個圖層 canvas（`CanvasRenderer.ts:52–55`：text / selection / link / cursor，`getContext('2d', { alpha })`，**沒有** `willReadFrequently` → GPU 加速），尺寸 = 終端格數 × 裝置像素（`BaseRenderLayer.ts:139–140`，例：2024×1126 CSS px 在 DPR 2 約 4048×2252，每層約 36 MB）。glyph atlas 頁也是 GPU 2D canvas（`addon-canvas.js` atlas page `getContext("2d",{alpha:!0})`，512 起、最大 4096），內容變動 100 ms 後 `createImageBitmap(canvas)` 重建 bitmap（`BaseRenderLayer.ts:457–510`）。只有暫存的 `_tmpCanvas` 用 `willReadFrequently`（CPU）。這和 issue 458722690 的使用型態（多個 canvas、改尺寸、ImageBitmap）相同。 |
| 切換 / 建立分頁時會集中做 canvas 工作 | 原始碼 | `TerminalPanel.tsx:288–310` isActive effect：RAF → `doResize()`（`fitAddon.fit()`；隱藏期間尺寸有變就重配 4 個圖層 canvas）→ 再一個 RAF → `clearTextureAtlas()`（atlas 頁 `clearRect`、glyph 快取清空並重畫、bitmap 重建）+ `refresh(0, rows-1)`。新建的終端第一次 active 也跑這段。atlas 由同設定的終端共用（xterm `acquireTextureAtlas`），清一次會影響所有終端。 |
| 10-19 崩潰前幾秒的事件 | 日誌 | `debug-20261015-130846.log`（UTC +8）：10:38:58–59 視窗 `will-resize 2560x1122 → 2560x1410`；10:39:11 → 10:39:16 active 終端 `9f94a630` 兩次 ResizeObserver resize（2024×1123 → 2024×1126）；之後 8 秒內切換 4 次 active：10:39:21.096 `b308fb64`、21.617 `6d462a28`、28.116 `cf6297e7`、29.294 `9f94a630`；**10:39:29.734 GPU 崩潰**（最後一次切換後 0.44 s）。同時至少 5 個終端存在。 |
| 10-15 五次崩潰 | 日誌（BUG-136 / BUG-164 記載，`112206` 不在本機） | 3 次在派工建立終端後 2–12 s；12:02:28 前沒有建立事件；10-15 13:43–13:45 連開 10 個分頁沒有崩潰 ⇒ **不是每次切換 / 建立都會觸發**。 |
| `clearTextureAtlas` 是起因嗎 | 推論 | **未證實**。崩潰需要「前面某次 snap 準備資源失敗」，這通常是 GPU 資源配置失敗（Chromium 也只能假設 OOM）。BAT 切換 / 建立分頁時在短時間內重配大 canvas、清 atlas、重建 ImageBitmap，會集中配置 GPU 資源，**時間上吻合、機制上合理**，但沒有 GPU 程序的 Skia 錯誤訊息就無法證明是哪個資源、哪個操作。也可能是其他 tile raster 或 Chromium / Metal 自己的狀況。 |
| 縮圖、視窗 resize、雙螢幕 | 原始碼 / 日誌 | 縮圖是 DOM 文字（`.thumbnail-preview`），不是 canvas，和這條路徑無關。視窗 resize 會讓 active 終端重配 canvas（10-19 那次崩潰前 30 秒有）。雙螢幕移動在日誌中沒有可辨識的事件，無法判斷。 |
| GPU 崩潰後 BAT 畫面會怎樣 | 原始碼 + 推論 | 【原始碼】Blink `canvas_rendering_context_2d.cc`（146）：GPU 程序死掉後，canvas 經 `NotifyGpuContextLost` / `TryRestoreContextEvent` 等 GPU 程序回來再重建 resource provider。【推論】重建後的 canvas 內容是空的；xterm canvas addon 沒有處理 `contextlost` / `contextrestored`，atlas 頁內容遺失後畫出來的字可能是空白或殘影，直到下一次 `clearTextureAtlas()`（下次切到該分頁時會自動做）或手動重繪。這解釋了 10-15 12:13:23 崩潰後的手動重繪，但沒有直接證據。 |
| 連續崩潰的後果 | 原始碼 | `content/browser/gpu/gpu_process_host.cc`（146）：每 5 分鐘原諒 1 次崩潰（`kForgiveGpuCrashMinutes = 5`），`recent_crash_count_ >= 3`（Mac 的 `GetFallbackCrashLimit()`）就 `FallBackToNextGpuModeDueToCrash()`，退回軟體繪圖直到 BAT 重開。10-15 的 11:43:01 / 11:43:09 兩次只差 8 秒（計數 2），5 分鐘內再崩一次就會退回軟體繪圖。 |

### 建議方向

修不修、怎麼修由使用者決定；以下是推薦與取捨。所有方案都**不動** `TerminalPanel.tsx` isActive effect 在 Windows 上的 `clearTextureAtlas()` + `refresh()`（Win11 修正），T0667 也不受影響。

| 方案 | 切分 | 效果 | 風險 / 代價 |
|---|---|---|---|
| **A（推薦先做）macOS 停用 Skia Graphite**：`electron/main.ts` 現有 `appendSwitch` 區塊加 `if (process.platform === 'darwin') app.commandLine.appendSwitch('disable-skia-graphite')` | S | 這個 CHECK 在 `GraphiteSharedContext`，Graphite 關閉後整條路徑不存在（Ganesh 沒有 recording 順序檢查）。issue 458722690 回報者關掉 Graphite 後問題消失或更難重現。 | 【原始碼】`gpu/config/gpu_switches.cc:153` `kDisableSkiaGraphite = "disable-skia-graphite"`；`gpu_finch_features.cc:645–662` 有這個 switch 就回 false。不支援 Graphite 的 Mac 在 146 本來就走 Ganesh（ANGLE Metal），是有維護的路徑。代價：失去 Graphite 的效能改善（BAT 是終端畫面，影響應不大，未量測）；未來 Chromium 可能移除 Mac 的 Ganesh（時程未查證）。🔴 **不要**改成第二個 `appendSwitch('disable-features', 'SkiaGraphite')`：Chromium 的 switch 同名後者覆蓋前者，會讓現有的 `disable-features=ServiceWorker`（`main.ts:150`）失效。建議保留一個逃生口（例如 env `BAT_SKIA_GRAPHITE=1` 不加 switch）。驗收：`[gpu] feature status` 的 `skia_graphite` 不再是 `enabled_on`；Windows / Linux 不受影響（Graphite 只在 Apple 預設開，且 switch 只在 darwin 加）。 |
| **B GPU 崩潰後讓可見的終端自己重建**：main 的 `child-process-gone`（type=GPU）通知 renderer，或 TerminalPanel 監聽圖層 canvas 的 `contextrestored`，對 active 終端 `clearTextureAtlas()` + `refresh()` | S | 不論崩潰原因（也包含 Electron 42 之後的 graceful restart），崩潰當下可見的終端不必等切換分頁或手動重繪就恢復。隱藏的終端在下次 active 時本來就會做。 | 不能減少崩潰次數。要確認 Chromium 重建 canvas 的時機（太早做會在 GPU 程序回來前又失效），`contextrestored` 比固定延遲可靠。單元測試可以 mock；實際效果只能 外部測試者A 驗。 |
| **C 升級 Electron 42+** | M–L（另開 PLAN） | Chromium 148 把這個 CHECK 改成 context lost → GPU 程序重啟（不產生崩潰報告）。另一個理由：Electron 41 已停止更新（41.10.7 之後無新版）。 | 觸發原因不變，使用者仍會看到 GPU 重啟（畫面閃一下 / canvas 重建）；graceful restart 是否計入上述「3 次退回軟體繪圖」**未查證**。升級範圍大（CLAUDE.md「Electron Runtime」、CLI / SDK、打包、native module 等全面回歸），不適合併進這次發版。 |
| D 只在 Windows 做 isActive 的 `clearTextureAtlas()` | S | 減少 Mac 上切換分頁時的 GPU 資源重配。 | **效果未證實**（觸發機制沒有證據），而且 Mac 上切換後是否會出現 Win11 那種黑屏 / 字疊在一起沒驗過。做了 A 就不需要；只有 A 不可行、又要保留 Graphite 時才考慮。 |
| E 改用 WebGL addon + `onContextLoss` | M | 終端繪製不走 2D canvas 的 raster decoder。 | Chromium 每頁 WebGL context 上限約 16 個，BAT 常開很多終端，超過會讓舊的失去 context；Windows 行為也要重驗。不推薦。 |

**先不處理的影響**：GPU 程序自動重啟（重啟耗時未量測），整個視窗可能閃一下；崩潰當下可見的終端可能字消失 / 殘影，切換分頁或手動重繪後恢復；5 分鐘內崩 3 次會退回軟體繪圖直到重開 BAT（CPU 與 WindowServer 負擔上升）。目前沒有證據顯示會造成資料遺失或 PTY 中斷（PTY 在主行程 / Terminal Server，不在 GPU 程序）。BUG-164 的 `low` 嚴重度合理。

**推薦組合**：A + B（都 S，可以和 T0667 一起發版），C 另開 PLAN 排程。若希望先確認再改程式，外部測試者A 測試 2 不需要新版本。

### 給 外部測試者A 的問題 / 測試

（≤ 3 項，前兩項不耗 token）

1. **（零成本）提供其他 GPU 崩潰報告**：`~/Library/Logs/DiagnosticReports/` 內所有 `BetterAgentTerminal Helper-*.ips`（特別是 10-15 那 5 份，含 `114303.ips`）。我們讀每份的 `x21`：`5` = out-of-order（和 10-19 相同），`4` = shader 編譯失敗（不同成因）。只要檔案，不用操作 BAT。
2. **（不用新版本）停用 Graphite 試用一兩天**：結束 BAT 後在終端機執行 `open -a BetterAgentTerminal --args --disable-skia-graphite`，照平常使用（包括常切換、開新分頁、改視窗大小）。回報：(a) 日誌的 `[gpu] feature status` 那行 `skia_graphite=` 是什麼值；(b) 期間有沒有 `[CRASH] child-process-gone type=GPU`；(c) 畫面或打字的感覺和平常有沒有差別。
3. **（選做，要多一點操作）抓 GPU 程序的 Skia 錯誤訊息**：用終端機直接啟動 `/Applications/BetterAgentTerminal.app/Contents/MacOS/BetterAgentTerminal --enable-logging=stderr 2>&1 | grep -i -E 'graphite|recording|skia' > ~/bat-gpu.txt`（不加第 2 項的 switch），等下一次 GPU 崩潰後附上 `bat-gpu.txt`。`Recordings are expected to be replayed in order` 前面幾行可以看出是哪個資源先失敗。

### 建議下一步

1. 塔台把「給 外部測試者A」第 1、2 項轉給 外部測試者A（第 1 項確認 6 次是不是都同一個狀態；第 2 項確認停用 Graphite 是否有效）。
2. 使用者決定是否在 T0667 這次發版一併做 **A（macOS `disable-skia-graphite`，含逃生口）+ B（GPU 崩潰後重建可見終端）**；要做的話派一張實作單（`electron/main.ts`、`src/components/TerminalPanel.tsx`、對應單元測試與 `docs/agent-guide/logging.md` 的 `[gpu]` 判讀補充；驗收 `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`；Win11 的 `clearTextureAtlas` 行為不變）。
3. Electron 42+ 升級另開 PLAN（也解決 Electron 41 停止更新的問題）。
4. BUG-164 狀態由塔台更新（本單未修改 BUG-164 / BUG-136）。

### Renew 歷程

無。

### 遭遇問題

- `114303.ips`（10-15）不在本機，只能依 BUG-136 / BUG-164 記載的 offset；offset 相同不代表狀態相同（見調查結論 §2）。
- breakpad 符號檔沒有 INLINE 記錄，frame #0 的行號只到 `immediate_crash.h:180`；以行號表相鄰記錄 + capstone 反組譯補足，沒有下載 dSYM（`electron-v41.2.1-darwin-arm64-dsym.tar.xz` 1.3 GB，不需要）。
- chromium.googlesource.com 的 `+log` 頁面要登入（403），改用 GitHub `chromium/chromium` 鏡像查 commit 紀錄；檔案內容仍以 googlesource 的 tag 版本為準。crbug.com/478211694 非公開，讀不到內容。
- 未查證：Chromium 148 的 graceful restart 是否計入 GPU crash limit；Graphite 關閉後的效能差異；Mac Ganesh 路徑的移除時程。
- 下載與暫存：`electron-v41.2.1-darwin-arm64-symbols.zip`（123 MB）、`electron-v41.2.1-darwin-arm64.zip`（116 MB）、Chromium / Skia 原始碼片段、capstone（在 scratchpad 內建 venv，`UV_CACHE_DIR` 指向 scratchpad，沒有安裝到系統、沒有改 PATH），總計約 1.1 GB，全部放在 session scratchpad，結束時已刪除。總耗時約 11 分鐘。沒有複製 外部測試者A 的檔案進 repo；本回報引用的日誌只有檔名、時間與終端 id，沒有使用者路徑。

### 回報時間

2026-10-19T12:21:36+0800
