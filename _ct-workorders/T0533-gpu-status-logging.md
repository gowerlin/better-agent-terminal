---
schema_version: 1
schema_kind: workorder
id: T0533
title: "BUG-136 診斷：啟動與 GPU 行程崩潰時記錄 GPU 功能狀態（判斷是否已退回軟體繪圖）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-136
priority: P2
sizing: S
created_at: "2026-10-15T13:17:17+0800"
started_at: "2026-10-15T13:18:25+0800"
updated_at: "2026-10-15T13:25:28+0800"
completed_at: "2026-10-15T13:25:28+0800"
target_version: "0.6.1-pre.2"
related:
  - BUG-136
affects_files:
  - electron/main.ts
  - electron/gpu-status-log.ts
  - electron/__tests__/
  - CLAUDE.md
  - _ct-workorders/T0533-gpu-status-logging.md
  - _ct-workorders/BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；需要實機時一律隔離實例。不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 純診斷：**不得**改變任何繪圖行為（不關硬體加速、不加 Chromium switch、不動 xterm renderer / CanvasAddon / `clearTextureAtlas`）。"
---

# T0533 — 記錄 GPU 功能狀態（BUG-136 診斷）

## 背景

BUG-136：Gary 在 macOS 27.0.1 + `0.6.1-pre.1` 上遇到舊分頁打字嚴重延遲，BAT Renderer 持續約 100% CPU，WindowServer 約 40%。同一段時間 GPU 行程崩潰 5 次：

```
[CRASH] child-process-gone type=GPU reason=crashed exitCode=5
```

現有日誌只記到崩潰本身（`electron/main.ts` 的 `child-process-gone` handler）。崩潰後 Chromium 有沒有退回軟體繪圖（raster / compositing / 2D canvas / WebGL 變成 software 或 disabled），現在完全看不到。這是區分 BUG-136 兩個假設的關鍵資料，所以先在 `0.6.1-pre.2` 補上記錄。根因修正另案處理。

## 任務

1. 新增 `electron/gpu-status-log.ts`，放可單元測試的純函式：
   - 把 `app.getGPUFeatureStatus()` 的結果格式化成**單行**、key 排序固定的字串，例如 `gpu_compositing=enabled 2d_canvas=enabled webgl=enabled …`，全部 key 都要列出
   - 比較前後兩次狀態，回傳變動的 key（`2d_canvas: enabled → unavailable_software`）
2. **啟動基準**：在 app ready 後（`crashDumps` log 附近）記一次 `[gpu] feature status: …`。另記一行 `app.getGPUInfo('basic')` 的精簡資訊（GPU vendor / device、driver 等，只取少數欄位，不要整包 JSON）。`getGPUInfo` 是 async；失敗只記 warn，不影響啟動，也不阻塞 whenReady 流程。
3. **GPU 崩潰時**：`child-process-gone` 的 `type === 'GPU'` 分支在原有 `[CRASH]` 行之後：
   - 記本次 session 的 GPU 崩潰次數，例如 `[gpu] crash #3 this session`
   - 記當下的 feature status，以及與上次記錄相比的變動
4. **狀態變化**：監聽 `app.on('gpu-info-update')`。feature status 與上次記錄**不同時**才記 `[gpu] feature status changed: …`（含變動的 key），避免洗版。崩潰後重啟的 GPU 行程完成 fallback 的時間點不固定，這個事件可以補到崩潰當下還沒反映的狀態。
5. 原有 `[CRASH] child-process-gone …` 行的格式**不變**，外部比對與既有分析都依賴它。
6. `CLAUDE.md` 的「Logging」節加一句：`[gpu]` 這幾行的意義，以及看到 `software` / `disabled` 代表什麼。

## 驗證

- 單元測試：`electron/__tests__/gpu-status-log.test.ts`
  - 格式化結果 key 排序穩定
  - 變動比對：無變動回空；有變動列出 key 與前後值
  - 崩潰計數只算 `type === 'GPU'`
- 實機（隔離實例，Windows 即可）：啟動後日誌有 `[gpu] feature status:` 與 GPU 資訊各一行。崩潰路徑若無法安全觸發，以單元測試涵蓋，並在回報區說明。
- `npm run typecheck:electron` = 0、`npm run typecheck` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [x] 啟動記錄基準 GPU 功能狀態與精簡 GPU 資訊
- [x] GPU 崩潰時記錄崩潰次數、當下狀態與變動
- [x] `gpu-info-update` 只在狀態變化時記錄
- [x] 原 `[CRASH]` 行格式不變；繪圖行為零改動
- [x] BUG-136 的 `links.related` 加 T0533，body 註記「`0.6.1-pre.2` 起日誌可判斷是否退回軟體繪圖」；BUG-136 維持 OPEN（此單不是修正）

## Sub-session 執行指示

1. 讀本工單與 BUG-136
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED），附一段實機日誌範例
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果：DONE

- 開始 `2026-10-15T13:18:25+0800`，完成見 frontmatter `completed_at`。派發模式 `CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **著陸檢查：PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `electron/main.ts` 等存在（informational）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 變更

| 檔案 | 內容 |
|---|---|
| `electron/gpu-status-log.ts`（新） | 純函式：`formatGpuFeatureStatus`（單行、全部 key、code-unit 排序）、`diffGpuFeatureStatus`（`key: 前 → 後`，單邊缺 key 記 `(none)`）、`summarizeGpuInfo`（每顆 GPU 的 vendor / device hex、`deviceString`、`driverVendor`、`driverVersion`、`active`，加 `machineModelName`）；`createGpuStatusLog` 追蹤器（GPU 崩潰計數、上次記錄的狀態） |
| `electron/main.ts` | whenReady `crashDumps` 段之後建立追蹤器；`app.on('gpu-info-update')`；15 s fallback timer（`unref`）；`void app.getGPUInfo('basic')`（不 await，失敗 `logger.warn`）；`child-process-gone` 在原 `[CRASH]` 行**之後**呼叫 `onChildProcessGone(details)`。`[CRASH]` 行逐字未動 |
| `electron/__tests__/gpu-status-log.test.ts`（新） | 18 tests：排序穩定、diff（無變動 / 有變動 / 單邊）、GPU info 精簡、基準時機、fallback、只在變化時記、崩潰計數只算 `type === 'GPU'`、取狀態失敗只 warn；main.ts source guard（`[CRASH]` 行不變且在 hook 之前、`getGPUInfo` 不 await） |
| `CLAUDE.md` | Logging 節新增 `[gpu]` 各行意義與 `enabled` / `*_software` / `*_off` 判讀 |
| `_ct-workorders/BUG-136-…md` | `links.related` 已含 T0533（塔台開單時已加）；「可先做的改善」第一項註記「`0.6.1-pre.2` 起日誌可判斷是否退回軟體繪圖」；status 維持 OPEN |

繪圖行為零改動：沒有關硬體加速、沒有 Chromium switch，未碰 xterm renderer / CanvasAddon / `clearTextureAtlas`。

### 與工單的偏差（已處理，請塔台知悉）

**基準不在 whenReady 當下記，改在第一次 `gpu-info-update` 記。** 第一版照字面在 whenReady 記，實機（隔離實例，Windows）日誌：

```
05:21:17.870Z [gpu] feature status: 2d_canvas=disabled_software … gpu_compositing=disabled_software … rasterization=disabled_software … webgl=disabled_off webgpu=disabled_off …
05:21:18.059Z [gpu] feature status changed: 2d_canvas: disabled_software → enabled, gpu_compositing: disabled_software → enabled, … webgl: disabled_off → enabled, webgpu: disabled_off → enabled | …
```

whenReady 當下 Chromium 還沒拿到 GPU 資訊，`getGPUFeatureStatus()` 回的是佔位值（Electron 文件也註明「only usable after the `gpu-info-update` event」），~190 ms 後才變成真實值。照字面記會讓每份日誌一開頭就看似「已退回軟體繪圖」，正好誤導 BUG-136 的判讀。改法：第一次 `gpu-info-update` 記 `[gpu] feature status: …` 為基準；15 s 內沒有 update 才以 `[gpu] feature status (no gpu-info-update yet): …` 補記。時間點仍在 app ready 之後、約 +100–200 ms，驗收條件「啟動記錄基準」照樣滿足。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck:electron` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npx vite build` | ✅ exit 0 |
| `npm run test:unit` | ✅ 226 files / 3748 passed / 1 skipped（含新檔 18 tests） |
| 實機：啟動 | ✅ 隔離實例（`launchIsolated`，`--runtime=e2e-t0533-gpu-*`、BAT_* 清除、remote port 為臨時埠，跑完刪 userData），一份日誌有 `[gpu] info:` 與 `[gpu] feature status:` 各一行 |
| 實機：GPU 崩潰 | ✅ 同一隔離實例以隱藏視窗 `loadURL('chrome://gpucrash')` 觸發 4 次，見下 |
| 全套 e2e | 未跑（工單 / L141 禁止）。實機用的暫存 spec 已刪除、未入庫 |

實機日誌範例（去掉時間前綴與部分 key，Windows，GTX 1050 Ti + Intel）：

```
[gpu] info: gpu0{vendor=0x10de device=0x1c82 name="NVIDIA GeForce GTX 1050 Ti" driver=32.0.15.6094} gpu1{vendor=0x8086 device=0x7d67 name="Intel(R) Graphics" driver=32.0.101.8860} gpu2{vendor=0x1414 device=0x008c name="Microsoft Basic Render Driver" driver=10.0.28000.3231} gpu3{vendor=0x8086 device=0xad1d driver=0.0.0.0}
[gpu] feature status: 2d_canvas=enabled direct_rendering_display_compositor=disabled_off_ok gpu_compositing=enabled multiple_raster_threads=enabled_on opengl=enabled_on rasterization=enabled raw_draw=disabled_off_ok skia_graphite=disabled_off trees_in_viz=disabled_off video_decode=enabled video_encode=enabled webgl=enabled webgpu=enabled webnn=disabled_off
[CRASH] child-process-gone type=GPU reason=crashed exitCode=-1073741819
[gpu] crash #1 this session
[gpu] feature status at crash: 2d_canvas=enabled … gpu_compositing=enabled … (同基準)
[gpu] changes since last logged: none
… crash #2 同上 …
[CRASH] child-process-gone type=GPU reason=crashed exitCode=-1073741819
[gpu] crash #3 this session
[gpu] feature status at crash: 2d_canvas=disabled_software … gpu_compositing=disabled_software multiple_raster_threads=disabled_off opengl=disabled_off rasterization=disabled_software … webgl=disabled_off …
[gpu] changes since last logged: 2d_canvas: enabled → disabled_software, gpu_compositing: enabled → disabled_software, multiple_raster_threads: enabled_on → disabled_off, opengl: enabled_on → disabled_off, rasterization: enabled → disabled_software, video_decode: enabled → disabled_software, video_encode: enabled → disabled_software, webgl: enabled → disabled_off, webgpu: enabled → disabled_off
[gpu] crash #4 this session
[gpu] changes since last logged: none
```

### 對 BUG-136 有用的觀察（未下根因結論）

- **Chromium 在第 3 次 GPU 崩潰時整體退回軟體繪圖**（本機 Windows 實測），且之後不會自己回到硬體。Gary 的 session 崩潰 5 次，若 macOS 行為相同，第 3 次（12:02:28）之後整個 Renderer 很可能已是軟體繪圖。這與假設 A 的「WindowServer ~40%」相容，但還不能解釋「新分頁順、舊分頁卡」——軟體繪圖會影響所有分頁。`0.6.1-pre.2` 的日誌可以直接確認。
- 判讀注意：崩潰後的真實 fallback 與啟動前的佔位值長得很像（都是 `disabled_software`），差別在 `multiple_raster_threads`（佔位值 `enabled_on`、真實 fallback `disabled_off`）。現行時機下佔位值不會進日誌，除非 15 s 內都沒有 `gpu-info-update`（那行會標 `no gpu-info-update yet`）。
- 崩潰後的 fallback 已在 `feature status at crash` 反映，之後的 `gpu-info-update` 狀態相同，所以沒有多一行 `changed`（符合「不洗版」）。

### Commit

見下方 commit 欄位（`git commit --only`，不含 `src/styles/settings.css`，不 push）。

### Follow-ups（建議，未做）

- macOS 是否同樣第 3 次崩潰退回軟體，需 `0.6.1-pre.2` 的真實日誌確認（AI 無法代驗）。
