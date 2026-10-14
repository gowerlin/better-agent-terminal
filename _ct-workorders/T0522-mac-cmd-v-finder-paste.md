---
schema_version: 1
schema_kind: workorder
id: T0522
title: "macOS：Finder 拷貝的項目在終端 Command+V 貼不上（只有 Ctrl+V 可以）（BUG-128）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-128
priority: P2
sizing: S
created_at: "2026-10-14T13:19:21+0800"
started_at: "2026-10-14T13:21:31+0800"
updated_at: "2026-10-14T13:21:31+0800"
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

### 結果：DONE（AI 端驗證全過；mac 實機驗收交 Gary）

### Landing Zone Check：PASS

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`affects_files` 前 5 項皆存在 → PASS；C-2：無 `branch` 欄位（HEAD = `main`）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 1. 根因複核（推論，AI 無 mac）

| 快捷鍵 | 修正前實際路徑 | Finder 拷貝時的結果 |
|---|---|---|
| Command+V | `attachCustomKeyEventHandler` 只攔 `ctrlKey`；xterm 對 metaKey 組合不處理、不 `preventDefault` → Chromium（`RenderWidgetHostViewCocoa` 先把 key equivalent 給 renderer，未處理才 redispatch 給選單）→ `electron/main.ts` Edit 選單 `role: 'paste'` → `webContents.paste()` → DOM `paste` 事件 → xterm `handlePasteEvent` 只讀 `clipboardData.getData('text/plain')` | Finder 放的是 file URL；Blink 的 `DataObject::CreateFromClipboard` 把 `text/uri-list` 以 `ReadFiles()` 轉成 Files 放進 DataTransfer，`text/plain` 取不到內容 ⇒ xterm 收到空字串，什麼都不貼（與 Gary 回報一致） |
| Ctrl+V（mac） | BAT 自己攔，`navigator.clipboard.readText()`（Async Clipboard API 直接讀 `NSPasteboardTypeString`） | Finder 在純文字欄位放的是**檔名**（非完整路徑）⇒「Ctrl+V 可以」推定貼出的只是 `report.pdf` 這類檔名 |

- Electron `clipboard`：`availableFormats()` 回 MIME 風格名稱，看不到原生 UTI，故不用；`clipboard.read(format)` 對 mac 自訂格式走 `ReadData` → `[NSPasteboard dataForType:]`。`read('NSFilenamesPboardType')` 回 XML plist（每個項目一個 `<string>` POSIX 路徑，多選皆在；AppKit 已標 deprecated，但 Finder 拷貝仍經 pasteboard type translation 提供），`read('public.file-url')` 只回第一個項目的 `file://` URL。兩者都是 Electron 社群讀 Finder 拷貝路徑的慣用法
- 依據：Electron `shell/common/api/electron_api_clipboard.cc`（`Clipboard::Read` → `ui::Clipboard::ReadData`）、Chromium `ui/base/clipboard/clipboard_mac.mm`（`ReadAvailableTypes` 有 Filenames 時回報 `text/uri-list`）、Blink `third_party/blink/renderer/core/clipboard/data_object.cc`、xterm.js `src/browser/Clipboard.ts` `handlePasteEvent`。以上為原始碼記憶推論，未在 mac 實測；BUG-128 的 Gary 現象（Cmd+V 無反應、Ctrl+V 有東西）與此推論一致
- 修正**不依賴**上述 Chromium 細節是否完全正確：Command+V 改在 keydown 自行處理並 `preventDefault`，檔案路徑由 main 直接讀 pasteboard

### 2. 修正

| 檔案 | 內容 |
|---|---|
| `electron/clipboard-file-paths.ts`（新） | `readClipboardFilePaths(clipboard, platform)`：僅 darwin；`NSFilenamesPboardType` plist（XML entity 解碼、只收絕對路徑、binary plist 略過）→ 退回 `public.file-url`（`fileURLToPath(..., { windows: false })`，file reference URL `file:///.file/id=` 略過）；其他平台回 `[]` 且不讀剪貼簿。無 `electron` import |
| `electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts` | 新 local-only IPC `clipboard:read-file-paths`（`registerLocalHandlers` 內 plain `ipcMain.handle`，無參數、只回 `string[]`；不在 `PROXIED_CHANNELS` / `ALWAYS_LOCAL_CHANNELS` / `PATH_ARG_SCHEMA` / handler registry）→ `electronAPI.clipboard.readFilePaths()`。不開放任意格式讀取 |
| `src/lib/terminal-paste.ts`（新） | `isMacCommandPaste(event, platform)`（只認 darwin 的純 Command+V，Shift / Option / Control 組合不攔）；`readMacTerminalClipboard()`：有檔案項目 → `{ kind: 'paths' }`，否則 `readText()`；讀路徑失敗退回純文字 |
| `src/components/TerminalPanel.tsx` | 拖放的後半抽成 `insertFilePaths()`（`terminalShellFamily` + `buildTerminalDropInsertion`：遠端解析、shell 引號、空白分隔、不送 Enter、`terminal.paste()` 走 bracketed paste）。新增 `pasteClipboardMac()`；mac 的 **Command+V**（keydown `preventDefault` + `return false`）、**Ctrl+V**（原本的 mac 分支）、**右鍵選單 Paste** 都走它。另在容器 capture 階段掛 `paste` listener：Command+V 後 1 秒內若仍有原生 paste（選單 role）抵達，直接 `preventDefault` + `stopImmediatePropagation`，xterm 不會再貼一次；沒有先按 Command+V 的 paste 事件不受影響 |
| `src/lib/image-attachment.ts` | `pastedDiskFiles(clipboardData)`：paste 事件中 `getPathForFile` 非空的 Files（同步讀取） |
| `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx` | 拖放逐檔邏輯抽成 `attachFile()`（行為不變）；`handlePaste` 在 darwin 且有實體路徑 Files 時 `preventDefault` 並逐檔 `attachFile()`（同拖放：圖片讀 File 成 data URL、其他檔案以路徑附加）。截圖 / 網頁圖片（File 無路徑）仍走 T0436 的 `clipboard.readImageDataUrl()` |

取捨：
- 檔案路徑從 main 讀而非 paste 事件的 `clipboardData.files` + `getPathForFile`：終端的 Command+V 在 keydown 就要決定是否攔截，此時拿不到 DataTransfer；main 讀 pasteboard 不依賴 Chromium 是否把 Finder 項目放進 paste 事件
- 面板則反過來用 paste 事件的 Files：面板 textarea 的原生 paste 要保留（純文字、T0436 圖片），只有「確定是磁碟檔案」才接手，風險最小；若 mac 的 Chromium 沒把 Finder 項目給 paste 事件，面板行為與修正前相同（不會更糟）
- mac 上 Ctrl+V 由「貼檔名」改為「貼完整路徑」，與 Command+V 一致（任務 3 要求）。右鍵 Paste 一併統一（同一 bug 的第三個入口）

### 3. Ctrl+V 與 Command+V 一致性（任務 3）

- 修正前 mac Ctrl+V：`readText()` → Finder 放的純文字 = 檔名（推論，見第 1 節）
- 修正後：Command+V、Ctrl+V、右鍵 Paste 全部走 `pasteClipboardMac()`；Finder 項目 → 完整 POSIX 路徑（zsh / bash = posix 引號：`'/Users/gary/My Report.pdf'`、`'it'\''s'`、中文路徑也加引號；無特殊字元不加引號），多檔以空白分隔，不送 Enter；純文字 → 原樣（含 >10 KB 確認對話框、>64000 分段）

### 4. Claude / Codex 面板（任務 4）

- 修正前推論：面板 textarea 的 Command+V 是瀏覽器原生 paste，`text/plain` 同樣取不到 ⇒ 什麼都不插入；若拷貝的是圖片檔（如 `pic.png`），既有 `handlePaste` 看到 `image/png` item 會呼叫 `clipboard.readImageDataUrl()`，main 的 `clipboard.readImage()` 讀到的可能是 Finder 放的**檔案圖示**而非圖片本身
- 已一併修（成本低，只動 mac 分支）：Finder 項目比照拖放附加。既有圖片貼上（截圖、網頁圖片）不變；Windows / Linux 不進新分支

### 5. 遠端視窗（任務 5，只說明）

- 終端的 Finder 路徑與拖放走同一條 `buildTerminalDropInsertion` → `remote:resolve-client-paths`（`local-file`，T0437）：WSL 視窗換成主機可讀的形式；SSH / Docker 等主機讀不到的 client 路徑**不插入**，改跳既有的 `claude.attachmentNotOnRemoteHost` toast。也就是說遠端不會被貼進一個主機上不存在的 mac 路徑，行為與拖放完全一致，合理
- 面板附加檔案在遠端視窗的處理與拖放相同（送出時經既有 attachment 路徑解析）

### 6. 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| 單元測試（新） | PASS | `electron/__tests__/clipboard-file-paths.test.ts` 12 tests（plist 多檔 / 空白 / 單引號 / 中文 / entity / NUL、file-url 解碼、reference URL 略過、非 darwin 不讀剪貼簿、IPC local-only 與無參數守門）；`src/__tests__/terminal-paste-shortcuts.test.tsx` 14 tests（mac Command+V 檔案 → 引號路徑、只走 `local-file` 解析、不送 `\r`；mac Command+V 純文字只貼一次且隨後的原生 paste 被吞；未按 Command+V 的 paste 不受影響；mac Ctrl+V = Command+V；Windows Ctrl+V 圖片 → `\x1bv`、文字照舊、meta+V 不攔、不查路徑；Linux Ctrl+V 照舊；三平台 Ctrl+Shift+V 照舊；路徑引號）；`src/__tests__/panel-finder-paste.test.tsx` 6 tests（兩面板 × mac Finder 附加 / mac 截圖照舊 / Windows 照舊） |
| 既有相關測試 | PASS | `image-attachment-client-read` / `drag-drop-get-path-for-file` / `terminal-drop-file-path` 與新測試合跑 4 files / 38 tests |
| `npm run typecheck` | PASS（0） | exit 0 |
| `npm run typecheck:electron` | PASS（0） | exit 0 |
| `npx vite build` | PASS | exit 0 |
| `npm run test:unit` 全套 | PASS | 216 files、3574 passed / 1 skipped，exit 0 |
| mac 實機 | 未執行（AI 無 mac） | 交 Gary，步驟見下 |

#### 給 Gary 的 mac 實機驗收步驟

1. 在 Finder 選一個檔名有空白的檔案（例如 `My Report.pdf`），Command+C；到 BAT 一般終端分頁按 Command+V → 應出現 `'/Users/…/My Report.pdf'`（完整路徑、有引號、沒有自動 Enter）
2. 同一個剪貼簿改按 Ctrl+V、以及右鍵 → Paste → 結果應與步驟 1 相同；Finder 一次選兩個檔案拷貝再 Command+V → 兩個路徑以空白分隔
3. 從 LINE 複製一段文字，在終端 Command+V → 只貼一次、內容不變（確認沒有重複貼上）
4. 在 Claude 面板輸入框，Finder 拷貝一個 `.txt` 與一張 `.png` 後 Command+V → 出現檔案附件與圖片縮圖（圖片應是圖片內容，不是檔案圖示）；另用 Command+Shift+Control+4 截圖後 Command+V → 照舊出現截圖縮圖
5. 若步驟 1 仍貼不出，請到 `~/Library/Application Support/BetterAgentTerminal/Logs/` 最新 `debug-*.log` 搜尋 `[terminal-paste]` 回報

### 7. 異動檔案

- 新增：`electron/clipboard-file-paths.ts`、`electron/__tests__/clipboard-file-paths.test.ts`、`src/lib/terminal-paste.ts`、`src/__tests__/terminal-paste-shortcuts.test.tsx`、`src/__tests__/panel-finder-paste.test.tsx`
- 修改：`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/components/TerminalPanel.tsx`、`src/components/ClaudeAgentPanel.tsx`、`src/components/CodexAgentPanel.tsx`、`src/lib/image-attachment.ts`、`_ct-workorders/BUG-128-mac-cmd-v-finder-copy-no-paste.md`（FIXED / `fixed_at` / 狀態列 / 根因與修正）、本工單
- 未動：`src/styles/settings.css`（非本單變更，未 commit）

### 8. 偏離 / 風險 / 後續

- 偏離：`affects_files` 未列 `src/lib/image-attachment.ts`（`src/lib/` 目錄已涵蓋）與 `electron/clipboard-file-paths.ts`（新檔，屬 electron 主程序 IPC 實作，與 `electron/main.ts` 同範圍）
- 風險（需 mac 驗收確認）：① 若某版 macOS 的 Finder 不再提供 `NSFilenamesPboardType` 也沒有 path 形式的 `public.file-url`（只有 file reference URL），`readFilePaths` 回 `[]`，退回貼純文字（檔名）——不會比修正前差；② 若 Command+V 的 keydown `preventDefault` 在某種情況擋不住選單 paste，capture 階段的 1 秒吞噬會擋掉重複貼上
- 已知、未處理：mac 上 Ctrl+V 在終端一直被 BAT 攔成「貼上」（修正前就是如此），所以 shell 的 Ctrl+V（quoted-insert）與 claude CLI 的 Ctrl+V 圖片貼上在 BAT 終端都無法使用；本單不改，若要恢復需塔台另案決定
- 無新 BUG

### 9. Commit

- 見下方 commit hash（`git commit --only` 本單檔案；未 push）
