---
schema_version: 1
schema_kind: workorder
id: T0522
title: "macOS：Finder 拷貝的項目在終端 Command+V 貼不上（只有 Ctrl+V 可以）（BUG-128）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-128
priority: P2
sizing: S
created_at: "2026-10-14T13:19:21+0800"
started_at: null
updated_at: "2026-10-14T13:19:21+0800"
completed_at: null
target_version: "0.6.0-pre.8"
related:
  - BUG-128
  - "BUG-107 / T0435（拖放檔案路徑 `webUtils.getPathForFile`）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/__tests__/
  - src/components/__tests__/
  - electron/__tests__/
  - _ct-workorders/T0522-mac-cmd-v-finder-paste.md
  - _ct-workorders/BUG-128-mac-cmd-v-finder-copy-no-paste.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e / 截圖一律隔離實例。不消耗 Claude token。不要寫入使用者真實剪貼簿以外的系統狀態；測試若要動剪貼簿，結束後還原或只在隔離實例內進行。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它。"
  - "🔴 與 T0521 並行（T0521 改 `src/components/ControlTowerPanel.tsx`）：commit 用 `git commit --only <自己的檔案>`，不要 `git add -A`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。日誌用 logger / `window.electronAPI.debug.log`。"
  - "🔴 Windows / Linux 的 Ctrl+V（含 Windows 圖片 → Alt+V）、Ctrl+Shift+V、Ctrl+C / Ctrl+Shift+C 行為不得改變（No Regressions Policy）。"
---

# T0522 — mac：Finder 拷貝後 Command+V 貼不進終端（BUG-128）

## 背景

Gary（mac）回報：在 Finder 裡 Command+C 拷貝後，到 BAT 終端按 Command+V 貼不上，Ctrl+V 可以。從 LINE 或 BAT 內部複製的文字，Command+V 都正常。詳見 **BUG-128**。

推定根因：`src/components/TerminalPanel.tsx:517-551` 的自訂鍵盤處理只攔 `ctrlKey + v`，mac 分支用 `navigator.clipboard.readText()` 貼上。Command+V（`metaKey`）沒有被攔，交給 xterm / 瀏覽器原生的 `paste` 事件或 Electron 選單的 paste role，而 Finder 拷貝的剪貼簿裡 `text/plain` 可能是空的，只有檔案項目。

## 任務

1. **複核根因**：釐清 mac 上 Command+V 實際走哪條路徑（Electron 應用程式選單的 `paste` role → DOM `paste` 事件 → xterm `clipboardData.getData('text/plain')`？），以及 Finder 拷貝時 Electron `clipboard`（`availableFormats()`、`readText()`、`read('public.file-url')` / `NSFilenamesPboardType`）和 `navigator.clipboard.readText()` 各回什麼。AI 無法在 mac 上實測，可以依 Electron / Chromium 文件與原始碼推論，推論依據寫進回報區
2. **修正**：mac 上 Command+V 至少要跟 Ctrl+V 一樣能貼。建議方向（Worker 可調整，取捨寫進回報區）：
   - 剪貼簿有檔案項目（file URL）時，貼上**完整 POSIX 路徑**，有空白或特殊字元時用 shell 安全的引號或跳脫，與拖放檔案進終端的結果一致（參考 BUG-107 / T0435 的拖放路徑處理）。多個檔案用空白分隔
   - 純文字（LINE、BAT 內部）維持現狀，不得重複貼兩次（攔截 Command+V 後要 `preventDefault`，或確保原生 paste 事件不會再貼一次）
   - 檔案路徑要從 main 讀（Electron `clipboard`），就經 preload 暴露最小 API，不開放任意剪貼簿格式讀取
3. **Ctrl+V 在 mac 上的結果**：確認 Gary 說「Ctrl+V 可以」時實際貼了什麼（檔名？路徑？），修正後兩個快捷鍵要一致
4. **Claude / Codex 面板輸入框**：確認 Finder 拷貝後 Command+V 是否也有同樣問題（面板既有的圖片貼上邏輯不得改壞）。有問題就一起修；成本高就在回報區記錄、另開 BUG 由塔台決定
5. 遠端視窗（WSL / SSH / Docker）的終端：貼上的是 client 端（mac）的路徑。這是否合理（例如遠端無法存取）只要在回報區說明，不在本單處理

## 驗證

- 單元測試：路徑跳脫 / 引號（空白、單引號、中文、多檔案）；mac 平台 metaKey+V 走新路徑、剪貼簿只有文字時行為不變；非 mac 平台 Ctrl+V 行為不變（含 Windows 圖片 → `\x1bv`）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0（若動 electron）、`npx vite build` exit 0；`npm run test:unit` 全套無回歸
- Windows 上無法重現 Finder 剪貼簿：在回報區寫給 Gary 的 mac 實機驗收步驟（≤ 5 步）

## 驗收條件

- [ ] mac 上 Finder 拷貝後 Command+V 能貼出路徑（AI 端以單元測試 + 推論驗證；真人驗收交 Gary）
- [ ] 純文字 Command+V 不重複貼、不退化
- [ ] Windows / Linux 貼上行為不變
- [ ] BUG-128：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-128
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
