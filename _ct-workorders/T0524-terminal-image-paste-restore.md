---
schema_version: 1
schema_kind: workorder
id: T0524
title: "終端分頁貼圖修復：Windows 回歸 + mac 讓 claude CLI 能貼圖，同時保留標準複製貼上（BUG-130）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-130
priority: P1
sizing: S
created_at: "2026-10-14T13:36:40+0800"
started_at: null
updated_at: "2026-10-14T13:36:40+0800"
completed_at: null
target_version: "0.6.0-pre.8"
related:
  - BUG-130
  - "BUG-128 / T0522（mac Finder Command+V，`43c9073`；`src/lib/terminal-paste.ts`、`pasteClipboardMac()`）"
  - "commit 24780ec（Windows Ctrl+V 圖片 → Alt+V）"
  - "T0436（`clipboard.readImageDataUrl` IPC）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-paste.ts
  - src/lib/
  - electron/clipboard-file-paths.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/__tests__/
  - electron/__tests__/
  - e2e/
  - _ct-workorders/T0524-terminal-image-paste-restore.md
  - _ct-workorders/BUG-130-terminal-image-paste-regression.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；e2e 一律隔離實例。不消耗 Claude token。測試若寫入系統剪貼簿，結束前還原原內容。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它。"
  - "🔴 **與 T0523 並行，且可能共用檔案**（T0523 的 affects_files 含 `electron/main.ts`、`electron/preload.ts`、`src/types/`）。盡量不要改這三個檔案（既有 `clipboard.readImageDataUrl` / `clipboard.readFilePaths` IPC 優先沿用）。若一定要改：commit 前先 `git diff <file>`，若裡面有不屬於你的未 commit 變更，等 T0523 commit 後（`git log --oneline -5` 看到 T0523 的 commit）再 `git commit --only`，否則會把 T0523 的半成品一起 commit。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
---

# T0524 — 終端分頁貼圖修復，同時保留標準複製貼上（BUG-130）

## 背景

使用者回報：舊版 BAT 在 **Windows** 終端分頁（跑 claude CLI）有圖片時按 Ctrl+V 可以貼圖，目前安裝的 pre.7 已失效。使用者要求**貼圖與標準複製貼上同時保留**。另外 T0522 回報區記錄了 mac 的問題：Ctrl+V 被 BAT 攔成文字貼上，claude CLI 在 mac 上也無法貼圖。詳見 **BUG-130**。

T0522（`43c9073`）剛改過同一段：mac 的 Command+V / Ctrl+V / 右鍵 Paste 都走 `pasteClipboardMac()`（檔案 → 路徑、否則文字）。請先讀 T0522 回報區，在它的基礎上修改，不要改壞它。

## 任務

1. **找出 Windows 回歸的根因**：用 `git log -L` / `git log -S` 追 `TerminalPanel.tsx` Ctrl+V 分支（`24780ec` 起）的變化，判斷是程式碼改壞、Electron 41 的 `navigator.clipboard.read()` 權限 / 型別問題（`.catch` 靜靜退回 `readText()`）、`navigator.platform` 判斷，還是 claude CLI 新版在 Windows 的貼圖鍵改了（用內嵌 CLI `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 的實際行為或官方文件確認，**不要**啟動會消耗 token 的 session）。依據寫進回報區
2. **統一的貼上決策**（三平台，Ctrl+V 與 mac Command+V 共用）：
   - 圖片 → 送 CLI 貼圖鍵讓 CLI 自己讀系統剪貼簿：Windows `\x1bv`（Alt+V），mac / Linux `\x16`（Ctrl+V）。實際按鍵以第 1 點確認的 CLI 行為為準
   - 檔案（Finder / 檔案總管拷貝）→ 路徑（mac 沿用 T0522；Windows 檔案總管拷貝是否也要貼路徑，低成本就做、否則記錄）
   - 文字 → 一般貼上（含 >10 KB 確認、分段）
   - 判斷剪貼簿有沒有圖片，建議改由 main 端 Electron `clipboard`（`availableFormats()` / `readImage().isEmpty()`，可沿用或擴充既有 IPC）處理，不依賴 renderer 的 Async Clipboard 權限。讀取失敗時要 `window.electronAPI.debug.log`，不能靜靜吞掉
   - mac 的 Command+V 是否也要在圖片時送 `\x16`：使用者要的是「貼圖與標準貼上都能用」，建議 Command+V 與 Ctrl+V 都依上述規則；取捨寫進回報區
3. **檔案拷貝的優先序**：Finder 拷貝圖片檔時，剪貼簿同時有檔案與圖示圖片。這時應貼**路徑**，不是送貼圖鍵（不然 CLI 會貼出檔案圖示）。T0522 回報區有提到這一點，請守住
4. **標準複製貼上不得退化**：Ctrl+C（有選取才複製、否則送 SIGINT）、Ctrl+Shift+C / V、mac Command+C、右鍵選單 Copy / Paste；純文字 Command+V 只貼一次（T0522 的 1 秒吞噬機制）
5. 非 claude CLI 的終端（一般 shell）在剪貼簿是圖片時按 Ctrl+V，會收到 `\x1bv` / `\x16`。評估影響（例如 bash 的 `\x16` 是 quoted-insert），能依 agent preset 判斷是否送貼圖鍵就做；做不到就記錄，並說明為何可接受

## 驗證

- 單元測試：三平台 × {圖片, 檔案, 檔案+圖示圖片, 文字, 讀取失敗} × {Ctrl+V, mac Command+V} 的送出內容；Ctrl+C / Ctrl+Shift+C / V 不變；T0522 既有測試全綠
- **Windows 實機自動化（AI 可做）**：在隔離實例（source build，`npx vite build`）用 Electron `clipboard.writeImage()` 放一張圖，在終端分頁 Ctrl+V，確認 PTY 收到預期的貼圖鍵（可用 `cat -v` 或 node 腳本回顯收到的位元組）；換成文字再測一次。測完還原剪貼簿。截圖或 log 路徑寫進回報區
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0（若動 electron）、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- mac 驗收步驟（≤ 5 步）寫進回報區，交 Gary（跟 T0522 的步驟合併成一份最好）

## 驗收條件

- [ ] Windows 終端有圖片時 Ctrl+V 能讓 claude CLI 貼圖（隔離實例自動化證據）
- [ ] mac 終端有圖片時可以貼圖（單元測試 + 推論；實機交 Gary）
- [ ] 文字 / 檔案貼上與複製行為不退化
- [ ] BUG-130：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-130、T0522 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`，注意與 T0523 共用檔案的規則）；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
