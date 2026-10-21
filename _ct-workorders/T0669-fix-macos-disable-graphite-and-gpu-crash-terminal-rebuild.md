---
schema_version: 1
schema_kind: workorder
id: T0669
title: "修正：macOS 預設停用 Skia Graphite（可經 env 恢復）＋ GPU 程序崩潰後可見終端自動重建畫面（BUG-164 方案 A + B）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-164
priority: P1
sizing: S
created_at: "2026-10-19T12:41:35+0800"
started_at: "2026-10-19T12:43:10+0800"
updated_at: "2026-10-19T12:50:31+0800"
completed_at: "2026-10-19T12:50:31+0800"
depends_on: [T0668]
related:
  - "BUG-164（OPEN；§ T0668 符號化結果）"
  - "T0668 回報區「建議方向」方案 A、B（含 🔴 不得用第二個 `disable-features` 的理由）"
  - "PLAN-053（Electron 42+ 升級，另案）"
affects_files:
  - electron/main.ts
  - electron/gpu-status-log.ts
  - electron/preload.ts
  - src/components/TerminalPanel.tsx
  - src/types/electron.d.ts
  - "electron/__tests__/*graphite*.test.ts"
  - "src/**/__tests__/*gpu*.test.{ts,tsx}"
  - docs/agent-guide/logging.md
  - CLAUDE.md
  - _ct-workorders/T0669-fix-macos-disable-graphite-and-gpu-crash-terminal-rebuild.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 A 只在 `process.platform === 'darwin'` 加 `app.commandLine.appendSwitch('disable-skia-graphite')`，放在 `electron/main.ts` 既有 `appendSwitch` 區塊。**不得**改用第二個 `appendSwitch('disable-features', …)`：同名 switch 後者覆蓋前者，會讓既有的 `disable-features=ServiceWorker` 失效。Windows / Linux 行為完全不變。"
  - "🔴 A 的逃生口：env `BAT_SKIA_GRAPHITE=1` 時不加 switch（名稱可依現有 env 命名慣例調整，回報寫明）。判斷寫成可單元測試的純函式。啟動時以 `[gpu]` 前綴記一行：是否停用 Graphite、原因（darwin 預設 / env 逃生口 / 非 darwin）。"
  - "🔴 B：GPU 程序崩潰（main 既有的 `child-process-gone` type=GPU，`electron/gpu-status-log.ts` / `main.ts`）後通知 renderer。renderer 對**目前可見的**終端在 GPU 程序回來之後執行 `clearTextureAtlas()` + `refresh(0, rows - 1)`；隱藏的終端維持「下次 active 時由 isActive effect 處理」。時機要等 canvas 可重建：優先用圖層 canvas 的 `contextrestored` 事件，或在通知後延遲到下一次 RAF 加短延遲，選擇與理由寫進回報。同一次崩潰只重建一次，連續崩潰要節流。"
  - "🔴 不得改變 `TerminalPanel.tsx` isActive effect 既有的 `clearTextureAtlas()` + `refresh()`（Win11 修正）及其觸發條件；B 是新增的獨立路徑。不碰 T0667 的縮圖預覽（`TerminalThumbnail.tsx` / `src/lib/thumbnail-preview.ts`）。"
  - "🔴 新增 IPC 時沿用既有 preload / `window.electronAPI` 型別慣例；renderer 日誌用 `window.electronAPI.debug.log`，main 用 `logger`，不用 `console.log`。"
  - "🔴 文件：`docs/agent-guide/logging.md` 的 `[gpu]` 判讀補上 macOS Graphite 預設停用、逃生口、崩潰後重建的日誌行；CLAUDE.md「Logging」節的 `[gpu]` 那一行只補一句並連到 docs（遵守 CLAUDE.md 開頭的撰寫規則，不展開細節）。"
  - "🔴 `affects_files` 以外的檔案不要動，需要動時先問塔台。只 commit 本單相關檔案；不 push；不改 BUG-164、其他工單、塔台狀態檔。"
  - "🔴 yolo Worker：不問使用者；範圍內猜錯會返工的問題依 ct-exec § Questions For Tower 問塔台（每輪 ≤ 3 題）。"
---

# T0669 — macOS 停用 Graphite ＋ GPU 崩潰後重建可見終端

## 背景

T0668 把 BUG-164 的崩潰點符號化出來了：Chromium 146 `graphite_shared_context.cc:291` 的 CHECK。Skia Graphite 回傳 `kOutOfOrderRecording` 後，GPU 程序直接崩潰。Electron 41 沒有修正，PLAN-053 另案升級。使用者決定把方案 A + B 和 T0667 一起發 `v0.7.1-pre.3`。

## 要做的事

### A：macOS 預設停用 Skia Graphite

1. `electron/main.ts` 既有的 `appendSwitch` 區塊：darwin 且沒有逃生口 env 時，加 `disable-skia-graphite`。
2. 判斷抽成純函式，例如 `shouldDisableSkiaGraphite(platform, env)`，並加單元測試：darwin 預設停用、darwin + 逃生口不停用、win32 / linux 不停用。
3. 啟動時記 `[gpu]` 日誌（內容見 memory_overrides）。
4. 加一個 source guard 測試：`main.ts` 的 `disable-features` switch 只出現一次。

### B：GPU 崩潰後重建可見終端

1. main：GPU `child-process-gone` 時送一個 renderer 事件給所有 BAT 視窗（含 detached 視窗），附崩潰序號。既有的 `[gpu] crash #N` 日誌不變。
2. renderer：`TerminalPanel` 訂閱這個事件。只有可見的終端（`isActive`，且所在視窗 / 工作區可見）在 canvas 可用後執行 `clearTextureAtlas()` + `refresh(0, rows - 1)`，記一行日誌（終端 id、崩潰序號）。
3. 單元測試：
   - 收到事件時，只有可見的終端被重建。
   - 隱藏的終端不做事。
   - 同一個序號只重建一次。
   - 既有 isActive effect 的行為不變（沿用或補現有測試）。

### 文件

更新 `docs/agent-guide/logging.md` 與 CLAUDE.md（見 memory_overrides）。

## 驗收

- `npm run test:unit` 全綠。回報 passed / files，和 T0667 後的基線 5618 / 319 比較，說明差異。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- `npx vite build` 成功。
- `git diff --stat` 只有 `affects_files` 內的檔案。
- 回報區說明：
  - Windows / Linux 啟動參數有沒有變化（應該沒有）。
  - `disable-features` 仍然只有一個。
  - isActive effect 沒有被改。
  - B 的時機選擇與理由。
  - 給 外部測試者A 的驗證步驟：`[gpu] feature status` 的 `skia_graphite=` 應該不再是 `enabled_on`；逃生口怎麼用。

## 不做

- 不升級 Electron（PLAN-053）。
- 不改用 WebGL addon。
- 不改 Windows 的 `clearTextureAtlas`。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE

### 產出摘要

**著陸檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 `REPO_ROOT` 下；C-3 抽查 `electron/main.ts` 等皆存在（C-0 已 PASS，僅記錄）；無 `branch` 欄位（C-2 不適用）；`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**產品 commit**：`32d62a45` `fix(BUG-164): disable Skia Graphite on macOS by default, redraw visible terminal after GPU crash (T0669)`（base `62c17be1`，未 push）。

**A：macOS 預設停用 Skia Graphite**
- `electron/gpu-status-log.ts`：新增純函式 `decideSkiaGraphite(platform, env)` → `{ disable, reason: 'darwin-default' | 'env-override' | 'not-darwin' }`、`formatSkiaGraphiteDecision`、常數 `SKIA_GRAPHITE_ENV = 'BAT_SKIA_GRAPHITE'`（沿用 `BAT_*` env 命名慣例，名稱與工單建議相同）。逃生口只認 `1`（容忍前後空白），其他值（`0` / `true` / 空字串）仍停用。
- `electron/main.ts`：既有 `appendSwitch` 區塊（`disable-features=ServiceWorker` 之後、`app.whenReady()` 之前，模組載入期）加 `if (skiaGraphite.disable) app.commandLine.appendSwitch('disable-skia-graphite')`，並 `logger.log` 一行：
  - darwin：`[gpu] skia graphite: disabled (darwin default, --disable-skia-graphite; BAT_SKIA_GRAPHITE=1 keeps it on)`
  - darwin + 逃生口：`[gpu] skia graphite: not disabled (BAT_SKIA_GRAPHITE=1)`
  - 其他平台：`[gpu] skia graphite: not disabled (platform=win32)`（linux 同理）
- **Windows / Linux 啟動參數沒有變化**：`disable-skia-graphite` 只在 `decideSkiaGraphite` 回 `disable: true`（僅 darwin）時加；Windows / Linux 只多一行 `[gpu]` 日誌。
- **`disable-features` 仍只有一個**（`ServiceWorker`）：source guard `electron/__tests__/skia-graphite-switch.test.ts` 斷言 `appendSwitch('disable-features'` 次數 = 1、`'disable-skia-graphite'` 只出現一次且受 `decideSkiaGraphite` 判斷控制、位置早於 `app.whenReady()`。

**B：GPU 崩潰後重建可見終端**
- main（`electron/main.ts` `child-process-gone`）：既有 `[CRASH]` 行與 `gpuStatusLog.onChildProcessGone`（`[gpu] crash #N`）不變；`type === 'GPU'` 時對 `getAllWindows()`（`windowMap` + `detachedWindows`，含 detached 視窗）送 `system:gpu-process-gone { crash: N }`，N = `onChildProcessGone` 回傳的本 session 崩潰序號。
- preload / 型別：`window.electronAPI.system.onGpuProcessGone(cb) → unsubscribe`（`electron/preload.ts`、`src/types/electron.d.ts`，比照 `system.onResume` / `terminal.onAttentionChanged` 的慣例）。
- renderer（`src/components/TerminalPanel.tsx`，主 init effect 內新增獨立路徑，cleanup 時取消訂閱與等待）：
  - 只有 `isActiveRef.current` 為真的終端會排程（`isActive` 已含「所在工作區 active、分頁為 focused、activeTab 為 terminal」，見 `WorkspaceView`）；隱藏的終端不做事，下次 active 時由 isActive effect 處理。
  - 視窗隱藏（`document.visibilityState === 'hidden'`，如最小化）時先等 `visibilitychange` 顯示後才開始等待（否則還原視窗時 isActive 不變，沒有人會重繪）。
  - 去重 / 節流：`crash <= 已見序號` 直接忽略（同一序號只重建一次）；等待中再來的崩潰併入同一次重建（記最新序號）；兩次重建之間至少 `GPU_REDRAW_MIN_INTERVAL_MS` = 1 s。
  - 重建：RAF 內 `terminal.clearTextureAtlas()` + `terminal.refresh(0, terminal.rows - 1)`，日誌 `[gpu] terminal redraw after GPU crash terminal=<id> crash=#N trigger=contextrestored|settled|timeout`（排程時另記 `[gpu] terminal redraw scheduled …`，等待中切走則記 `… skipped (no longer active) …`），一律經 `window.electronAPI.debug.log`。
- **B 的時機選擇與理由**：兩者並用。
  1. 主要觸發：圖層 canvas（`.xterm-screen canvas`，CanvasAddon 的 2D canvas）的 `contextrestored`。GPU 行程崩潰時加速 2D canvas 會 lost，restore 後內容被清空，這正是「canvas 可重建」的時間點。
  2. 補充觸發：每 `GPU_REDRAW_POLL_MS` = 250 ms 檢查，沒有任何圖層 canvas `getContext('2d').isContextLost()` 為 true 就重建（`trigger=settled`）。理由：通知走 GPU 行程 → main → renderer，`contextrestored` 可能**早於**這則訊息到達，只聽事件會永遠等不到；未加速的 canvas 也不會發事件。第一次檢查在 250 ms 後，等同「短延遲」。
  3. 上限：`GPU_REDRAW_MAX_WAIT_MS` = 5 s 後仍 lost 也重建（`trigger=timeout`），避免永遠不重建。
  只用「RAF + 短延遲」的話，GPU 行程較慢回來時會畫在仍 lost 的 canvas 上（no-op），restore 後又是空白，所以優先看 context 狀態。
- **isActive effect 沒有被改**：內容與依賴陣列 `[isActive, terminalReady, terminalId]` 原封不動；`src/__tests__/terminal-gpu-crash-redraw.test.tsx` 以 source guard 逐字比對該 effect，另有行為測試確認隱藏終端切成 active 時仍由它執行 `clearTextureAtlas()` + `refresh(0, rows - 1)` 一次，且不產生 GPU 路徑日誌。未碰 `TerminalThumbnail.tsx` / `src/lib/thumbnail-preview.ts`。

**文件**
- `docs/agent-guide/logging.md`「GPU 狀態日誌 `[gpu]`」下加兩個子項：macOS Graphite 預設停用（原因、🔴 不得用第二個 `disable-features`、逃生口、三種啟動日誌行、判讀）與崩潰後重建（事件、時機、去重 / 節流、日誌行、trigger 判讀、測試檔）。
- `CLAUDE.md`「Logging」節 `[gpu]` 那一行只補一句並連到 docs。

**給 外部測試者A 的驗證步驟（macOS，`v0.7.1-pre.3` 安裝後）**
1. 照常開啟 BAT，打開最新的 `~/Library/Application Support/BetterAgentTerminal/Logs/debug-<時間>.log`：
   - 應有 `[gpu] skia graphite: disabled (darwin default, --disable-skia-graphite; BAT_SKIA_GRAPHITE=1 keeps it on)`；
   - `[gpu] feature status:` 那行的 `skia_graphite=` **不再是 `enabled_on`**（實際字串請回報）。
2. 照平常使用一兩天（常切換、開新分頁、改視窗大小），回報期間有沒有 `[CRASH] child-process-gone type=GPU`。
3. 若仍有 GPU 崩潰：看崩潰後是否出現 `[gpu] terminal redraw after GPU crash terminal=… crash=#N trigger=…`，以及當下可見的終端是否不必切分頁就恢復正常（不再黑畫面 / 錯字）。
4. 逃生口（停用 Graphite 後畫面或打字感覺變差時）：結束 BAT，在終端機執行 `BAT_SKIA_GRAPHITE=1 /Applications/BetterAgentTerminal.app/Contents/MacOS/BetterAgentTerminal`，日誌應改為 `[gpu] skia graphite: not disabled (BAT_SKIA_GRAPHITE=1)`，`skia_graphite=` 回到 `enabled_on`。從 Dock / Finder 開啟不會帶這個 env。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run test:unit` | PASS | `Test Files 321 passed (321)`、`Tests 5635 passed / 3 skipped (5638)`、exit 0。與 T0667 後基線 5618 / 319 相比 **+17 tests / +2 files**，全部來自本單新增：`electron/__tests__/skia-graphite-switch.test.ts`（8）、`src/__tests__/terminal-gpu-crash-redraw.test.tsx`（9）。既有測試無失敗。 |
| `npm run typecheck` | PASS = 0 | `tsc --noEmit -p .` exit 0，無輸出 |
| `npm run typecheck:electron` | PASS = 0 | `tsc --noEmit -p tsconfig.node.json --composite false --target ES2022` exit 0，無輸出 |
| `npx vite build` | PASS | exit 0；`disable-skia-graphite` 與 `system:gpu-process-gone` 在 `dist-electron/main-*.js`，`system:gpu-process-gone` 在 `dist-electron/preload.js`，renderer 日誌字串在 `dist/assets/MainPanel-*.js` |
| `git diff --stat`（`32d62a45`） | PASS | 只有 `affects_files` 內檔案：`CLAUDE.md`、`docs/agent-guide/logging.md`、`electron/gpu-status-log.ts`、`electron/main.ts`、`electron/preload.ts`、`electron/__tests__/skia-graphite-switch.test.ts`（符合 `*graphite*`）、`src/components/TerminalPanel.tsx`、`src/types/electron.d.ts`、`src/__tests__/terminal-gpu-crash-redraw.test.tsx`（符合 `src/**/__tests__/*gpu*`）；另有本工單檔 |
| macOS runtime（Graphite 停用、崩潰後重建） | 未驗證 | 本機為 Windows，無法實測；交給 外部測試者A（上方步驟） |

驗證的程式碼即 `32d62a45` 的內容：單元測試開跑後只改了 `docs/agent-guide/logging.md` 與 `CLAUDE.md` 的文字（沒有測試讀取這兩個檔），typecheck 與 build 在最終內容上執行。

新增測試涵蓋：darwin 預設停用、darwin + 逃生口不停用、其他 env 值仍停用、win32 / linux 不停用、啟動日誌行、`disable-features` 只一個、Graphite switch 的條件與位置、GPU 崩潰廣播給所有視窗；renderer：只有可見終端重建且參數為 `refresh(0, rows - 1)`、隱藏終端不做事、同序號只重建一次、等待中的崩潰合併、連續崩潰間隔 ≥ 1 s、canvas 仍 lost 時等 `contextrestored`、視窗隱藏時等顯示、隱藏終端仍由 isActive effect 重繪、unmount 取消、isActive effect 原文 source guard。

### 遭遇問題

- 無阻斷問題，未向塔台提問。
- 已知限制：(1) macOS 實機行為（`skia_graphite=` 實際字串、改走 Ganesh 後是否還有其他 GPU 崩潰、`contextrestored` 是否實際觸發）無法在本機驗證；(2) `open -a BetterAgentTerminal` 是否把 shell env 轉給 app 未實測，文件與驗證步驟一律寫直接執行 binary；(3) 重建只涵蓋 xterm 終端（CanvasAddon），Claude / Codex 面板等 DOM 內容不在本單範圍。
- `npm run test:unit` 輸出中的 `Error: AttachConsole failed` / `No such remote 'origin'` 是既有測試的 stderr 雜訊，與本單無關（全部測試通過）。

### 互動紀錄

無（yolo，未向塔台或使用者提問）。

### 回報時間

2026-10-19T12:49:05+0800
