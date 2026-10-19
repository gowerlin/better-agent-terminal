---
schema_version: 1
schema_kind: workorder
id: T0669
title: "修正：macOS 預設停用 Skia Graphite（可經 env 恢復）＋ GPU 程序崩潰後可見終端自動重建畫面（BUG-164 方案 A + B）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-164
priority: P1
sizing: S
created_at: "2026-10-19T12:41:35+0800"
started_at: null
updated_at: "2026-10-19T12:41:35+0800"
completed_at: null
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
  - 給 Gary 的驗證步驟：`[gpu] feature status` 的 `skia_graphite=` 應該不再是 `enabled_on`；逃生口怎麼用。

## 不做

- 不升級 Electron（PLAN-053）。
- 不改用 WebGL addon。
- 不改 Windows 的 `clearTextureAtlas`。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗證結果

### 遭遇問題

### 回報時間
