---
schema_version: 1
schema_kind: workorder
id: T0533
title: "BUG-136 診斷：啟動與 GPU 行程崩潰時記錄 GPU 功能狀態（判斷是否已退回軟體繪圖）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-136
priority: P2
sizing: S
created_at: "2026-10-15T13:17:17+0800"
started_at: null
updated_at: "2026-10-15T13:17:17+0800"
completed_at: null
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

- [ ] 啟動記錄基準 GPU 功能狀態與精簡 GPU 資訊
- [ ] GPU 崩潰時記錄崩潰次數、當下狀態與變動
- [ ] `gpu-info-update` 只在狀態變化時記錄
- [ ] 原 `[CRASH]` 行格式不變；繪圖行為零改動
- [ ] BUG-136 的 `links.related` 加 T0533，body 註記「`0.6.1-pre.2` 起日誌可判斷是否退回軟體繪圖」；BUG-136 維持 OPEN（此單不是修正）

## Sub-session 執行指示

1. 讀本工單與 BUG-136
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED），附一段實機日誌範例
4. commit（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區
