---
schema_version: 1
schema_kind: workorder
id: T0439
title: "終端拖放檔案：插入依 shell family 加引號的路徑（遠端視窗為 server 形式），不送 \\r；不可達 toast；先實測目前是否觸發 will-navigate → openExternal"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T07:20:43+08:00"
updated_at: "2026-10-05T07:28:24+08:00"
completed_at: "2026-10-05T07:28:24+08:00"
target_version: next
depends_on:
  - T0438
related:
  - "T0421 研究拆單第 5 列（🟡 需先實測）"
  - "D119 / T0362（`quoteArgForShell(arg, shell)`，shell family quoting 既有實作）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/components/WorkspaceView.tsx
  - electron/main.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：拖檔到終端目前發生什麼（xterm 預設行為、是否觸發 `will-navigate` → `openExternal` 在本機開檔——若是，屬安全 / UX 問題，回報區明記）。只能靠程式碼與 e2e / RTL 驗證時，標明推論。"
  - "🔴 quoting 重用既有 `quoteArgForShell`（D119 / T0362），不要新寫一套。路徑解析用 T0437 的 `remote:resolve-client-paths(paths, 'local-file')`；本機視窗插入本機路徑。只插入文字，**不送 `\\r`**；多檔以空白分隔。"
  - "🔴 若發現 `will-navigate` 會開本機檔，在本單一併阻擋終端區的 drop 導航（`preventDefault`），並在回報區說明。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0439 — 終端拖放檔案

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 終端 drop handler：取路徑（T0435 API）→ 解析（T0437）→ quote → 寫入 PTY
3. 不可達 toast（重用 T0437 i18n key）
4. 測試：pwsh / bash / cmd 三種 shell family 的插入字串；遠端可達 / 不可達

## 驗收條件

- [ ] 回報區附現況結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區 + T0435 / T0437 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T07:20:43+08:00，Worker，`CT_MODE=yolo`、`CT_INTERACTIVE=0`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（前 5 筆皆存在，informational）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴 T0438：`DONE`（HEAD `83b6d55 chore(ct): T0438 DONE`）

### 現況結論（驗收 1）

**拖檔到終端目前什麼都不會發生（no-op），不會觸發 `will-navigate` → `openExternal`。** T0421 #5 的「Chromium 預設把檔案當導覽」推測在本專案不成立。

| 證據 | 內容 | 性質 |
|---|---|---|
| Electron 41.2.1 型別文件 | `webPreferences.navigateOnDragDrop`：「Whether dragging and dropping a file or link onto the page causes a navigation. Default is `false`.」（`node_modules/electron/electron.d.ts:18773-18777`） | 官方行為定義 |
| BAT 未覆寫 | `electron/main.ts:966-970`（主視窗）與 `:3233`（detached 視窗）的 `webPreferences` 只設 `preload` / `nodeIntegration: false` / `contextIsolation: true`；全 repo 無 `navigateOnDragDrop`、無 document 層 `drop` / `dragover` listener | 程式碼 |
| 終端原本無 drop handler | `TerminalPanel.tsx` 修改前無 `onDrop` / `onDragOver`；xterm.js 不處理檔案拖放 | 程式碼 |
| 實驗（不具結論力） | scratchpad 小 Electron 腳本以 CDP `Input.dispatchDragEvent` 對 `loadFile` 頁面的 textarea 合成拖放：預設組與 `navigateOnDragDrop: true` 對照組**都**沒有 `will-navigate` / `did-start-navigation` / `openExternal`，textarea 也沒插入文字。對照組也沒導航 ⇒ CDP 合成拖放不走 browser 端的拖放導航路徑，**只能證明 renderer 收到 drop 且無預設插入，不能證明/否證導航** | 實驗（inconclusive） |

⇒ 結論為**程式碼 + 型別推論**，未以真實 OS 拖放實機確認（Worker 無法操作 GUI 拖放）。因未發現開本機檔的行為，依 memory_overrides 第 3 條**未改 `electron/main.ts`**；終端 drop handler 本身對檔案拖放 `preventDefault`（dragover + drop），即使日後有人開啟 `navigateOnDragDrop`，終端區的檔案拖放也不會走到 `will-navigate`。

**殘留風險（建議塔台評估，非本單範圍）**：`will-navigate` handler（`electron/main.ts:1006-1012`）對任何非 app URL 一律 `shell.openExternal(url)`，含 `file://`。正式版 `appUrl` 為 `file://${path.join(...)}`，Windows 下是反斜線形式，`file:///C:/…` 永遠不會 startsWith ⇒ 若任何途徑造成導航到本機 `file://`（例如有人開 `navigateOnDragDrop` 後在非終端區拖放、或頁面出現 `file://` 連結），會由 ShellExecute 開啟該檔（`.bat` / `.exe` 等同執行）。建議另開小單：`will-navigate` 對 `file:` scheme 只 `preventDefault`、不 `openExternal`。

### 產出摘要

**行為**：檔案拖到終端 → 取本機路徑（T0435 `shell.getPathForFile`）→ `remote:resolve-client-paths(paths, 'local-file')`（T0437，經 `resolveAttachmentPaths`；IPC 失敗 fail-closed 全拒）→ 依該終端 shell family 以 `quoteArgForShell`（D119 / T0362，未另寫 quoting）加引號 → 空白串接 → `terminal.paste(text)` 寫入 PTY（走 xterm paste：尊重 bracketed paste mode，claude CLI 等 TUI 收到「貼上」而非逐鍵；**不送 `\r`**，文字本身不含換行）。不可達者不插入，toast `claude.attachmentNotOnRemoteHost`（重用 T0437 key，三語系已存在，**locale 檔未改**）。本機視窗 Identity ⇒ 插入本機路徑。非檔案拖放（文字）不攔截。

**shell family 來源**：終端建立時記錄實際傳給 `pty:create` / `pty:restart` 的 shell 路徑（`createPtyWithReplay` 一處涵蓋 WorkspaceView 全部建立點與 `useRemoteToolInstall`；`pty:restart` 在 WorkspaceView 另記）；本 renderer 沒建立過的終端（`created-externally`、reload 後存活且未重建）退回設定 shell（`getShellFromSettings`；遠端視窗 settings 為 proxied ⇒ server shell 路徑）→ `detectShellFamily`。

| 檔案 | 改動 |
|---|---|
| `src/lib/terminal-drop.ts`（**新檔，超出 affects_files**） | `rememberTerminalShell` / `getShellFromSettings`（自 WorkspaceView 搬出，邏輯不變）/ `terminalShellFamily` / `buildTerminalDropText` / `buildTerminalDropInsertion` / `dataTransferHasFiles` / `droppedFilePaths` |
| `src/components/TerminalPanel.tsx` | `onDragOver`（含 `Files` 才 `preventDefault` + `dropEffect='copy'`）/ `onDrop`（上述流程，插入後 focus 終端）；`CtToast` 掛在 `.terminal-panel`（`contain: layout` 為定位容器，toast 顯示於終端右上） |
| `src/components/WorkspaceView.tsx` | 改 import `getShellFromSettings`（刪本地定義）；`pty.restart` 後 `rememberTerminalShell` |
| `src/lib/pty-replay.ts`（**超出 affects_files**，+3 行） | `createPtyWithReplay` 開頭 `rememberTerminalShell(options.id, options.shell)` |
| `src/__tests__/terminal-drop-file-path.test.tsx`（新） | 15 tests：pwsh / bash(posix) / cmd 三種 quoting（含空白、單引號、無換行）；Identity 原樣、WSL 可達轉 `/mnt/…`、部分不可達、IPC 失敗 fail-closed；shell family 由 `createPtyWithReplay` 記錄 / 未知退回設定；TerminalPanel RTL（xterm deep-proxy mock）：本機 pwsh 兩檔空白分隔且無 `\r`、遠端 bash 插入 host 形式 + 不可達 toast、SSH 全不可達只 toast 不寫 PTY、cmd 雙引號、文字拖放不攔截 |

**未改**：`electron/main.ts`（未發現開檔行為）、`src/locales/*.json`（重用 T0437 key）。

### 驗證

| 閘 | 結果 | 證據 |
|---|---|---|
| 新測試 | PASS | `npx vitest run src/__tests__/terminal-drop-file-path.test.tsx` → 15 passed |
| 反向驗證（mutation） | PASS | 暫移除 `onDrop={handleDrop}` → 4 個 TerminalPanel drop 測試失敗；已以 sed 還原（`grep -c 'onDrop={handleDrop}'` = 1） |
| `npm run test:unit` | PASS | `Test Files 160 passed (160)`、`Tests 2552 passed \| 1 skipped (2553)` |
| `npx tsc --noEmit` | **36**（≤ 39） | 本單檔案（terminal-drop / TerminalPanel / WorkspaceView / pty-replay）0 筆 |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依 memory_overrides（L141） |
| 實機拖放 | 未做 | Worker 無法操作 GUI；見下方步驟 |

### 實機步驟（驗收 3，待使用者以新 build 驗證）

1. **本機視窗 · PowerShell 終端**：從檔案總管拖 `C:\Users\<你>\My Docs\a.txt` 到終端 → 提示字元後出現 `'C:\Users\<你>\My Docs\a.txt'`，**不會自動執行**（無 Enter），終端取得焦點；同時拖兩個檔 → 兩路徑以空白分隔
2. **本機 · cmd 終端** → `"C:\…\a.txt"`；**Git Bash 終端** → `'C:\…\a.txt'`。無空白的 Windows 路徑在 pwsh / bash 也會被加單引號（`quoteArgForShell` 安全字元集不含 `\`），屬預期
3. **確認不會開檔**：拖 `.txt` / `.bat` 到終端，系統預設程式**不應**被開啟（同時實機驗證「現況結論」）
4. **WSL 視窗 · bash 終端**：拖 `C:\Program Files\x y\z.txt` → `'/mnt/c/Program Files/x y/z.txt'`；拖 `\\wsl.localhost\<本 distro>\home\<u>\a.ts` → `/home/<u>/a.ts`；拖他 distro UNC 或 `\\server\share\…` → 終端右上 toast「此檔案不在遠端主機上，未附加：…」，不插入
5. **SSH 視窗**：拖任一本機檔 → 只出 toast，不插入文字
6. **Docker 視窗**：mount 內 host 檔 → container 路徑；mount 外 → toast
7. **claude CLI 分頁**（本機）：拖圖片檔 → CLI 以貼上收到路徑（bracketed paste），應辨識為圖片附件（CLI 行為，非本單保證）
8. 拖曳終端內選取的文字不受影響（非檔案拖放不攔截）

### 遭遇問題

1. **超出 affects_files**：新檔 `src/lib/terminal-drop.ts`（helper 需 TerminalPanel / WorkspaceView / pty-replay 共用且便於單測）、`src/lib/pty-replay.ts` +3 行（所有終端建立的單一匯流點，比在 WorkspaceView 7 個呼叫點各補一行乾淨）。皆為最小改動
2. **未記錄 shell 的終端**以設定 shell 推斷：`created-externally`（bat-terminal.mjs 派單）或「以 `+` 選特定 shell 建立 → reload 後 PTY 存活」的分頁，若與設定 shell 不同 family，引號風格可能不符（例如設定 pwsh、實際 cmd）。後果僅插入字串引號不對，不會執行。根治需 main 回報 PTY 實際 shell（另案）
3. **現況未實機**：見「現況結論」；CDP 合成拖放實驗因對照組失效而無結論力
4. **`will-navigate` 對 `file://` 一律 `openExternal`**：殘留風險，建議另開小單（見上）
5. **toast 文案**「未附加」沿用 T0437 key（範圍 3 指定重用），終端語境語意略偏（實為「未插入」）；若要精準可另加 `terminal.*` key
6. 同工作樹平行 Worker 的改動（docker-lifecycle / setup-wizard / T0427 / T0436 / T0452 / `_tower-state.md`）本單未碰；全量 unit test 本輪全綠

### Commit

- `git commit --only`：`src/lib/terminal-drop.ts`、`src/components/TerminalPanel.tsx`、`src/components/WorkspaceView.tsx`、`src/lib/pty-replay.ts`、`src/__tests__/terminal-drop-file-path.test.tsx`、本工單；不 push。hash 見 `git log`（本回報寫於 commit 前）

### 回報時間

2026-10-05T07:27:41+08:00
