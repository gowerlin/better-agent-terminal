---
schema_version: 1
schema_kind: workorder
id: T0758
title: "修正 BUG-189：npm 安裝的 codex（`codex.cmd`）也能探測版本；修正 t0584 依賴 npx PATH 的斷言"
type: implementation
status: DONE
started_at: "2026-11-02T02:25:19+08:00"
updated_at: "2026-11-02T02:41:08+08:00"
completed_at: "2026-11-02T02:41:08+08:00"
session_ids:
  - "719472c3-b87f-4ab5-b09c-398728b9d362"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "BUG-189；BUG-159 / T0651（`--no-daemon`）；T0621（派工 codex OSC 版本判定）；T0742 回報區〈發現的問題〉2 / 3"
  - "`electron/codex-osc-version.ts`（`resolveDispatchCodexBinary`、`createCodexOscVersionCheck`、`createCodexNoDaemonSupportCheck`）、`docs/agent-guide/bat-mcp-shim.md`（第 64 行附近已知限制）、`docs/agent-guide/worker-launch-confirmation.md`"
affects_files:
  - electron/codex-osc-version.ts
  - electron/__tests__/
  - e2e/t0584-bat-mcp-shim.spec.ts
  - e2e/t0742-codex-no-daemon.spec.ts
  - docs/agent-guide/bat-mcp-shim.md
  - docs/agent-guide/worker-launch-confirmation.md
  - CLAUDE.md
  - _ct-workorders/T0758-fix-bug189-npm-codex-version-probe.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證：npm 全域安裝的 `@openai/codex`（0.166.0）在 Windows 的 shim（`codex.cmd` / `codex.ps1` / 無副檔名 sh）指向什麼（JS 入口、`vendor/` 下的原生 `codex.exe` 或平台子套件），以實際讀 shim 與套件目錄為準（可在 `%TEMP%` 以 `npm i --prefix` 安裝一份測試用，不動使用者全域安裝）。"
  - "🔴 修正方向：從 shim 解析出實際的 codex 原生執行檔或 node 入口後，以 `execFile`（不經 shell、陣列參數、5 s timeout）跑 `--version`；🔴 不得改用 shell 執行 `.cmd`（CLAUDE.md「Child Process Spawning」）；解析不出時維持 `version-unknown`（行為與現在相同）。快取沿用路徑 + mtime。手動分頁的 `--no-daemon` 與派工的 OSC 判定都走同一個解析（不得各寫一份）。macOS / Linux 行為不變。"
  - "🔴 t0584 第 275 行：改成不依賴 PATH 的斷言（例：明確注入 codex 支援檢查結果，或依當下探測結果計算預期值），說明改法。`t0742-codex-no-daemon` 增加 npm shim 情境（PATH 最前面放測試用 shim 目錄）。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane B：T0758 → T0759 → T0760 → T0766 → T0767，與 Lane A 並行）：主 checkout 的 `dist` / `dist-electron` 可能正被 Lane A 的 e2e 使用。`npx vite build` 與 e2e 一律在 `git archive` 匯出目錄做（`%TEMP%/bat-<工單>-build`，`node_modules` 以 junction 共用主 checkout，T0742 作法）；主 checkout 只跑 `npm run typecheck` / `npm run typecheck:electron` / `npm run test:unit`。跑完刪匯出目錄（先刪 junction 本身，確認主 checkout `node_modules/electron` 仍在）。e2e 一律用隔離實例。"
  - "🔴 文件：`bat-mcp-shim.md` 已知限制改為新行為；CLAUDE.md「BAT MCP shim」節的 codex daemon 一句如需調整只改必要字。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0758 — 修正 BUG-189：npm 安裝的 codex（`codex.cmd`）也能探測版本；修正 t0584 依賴 npx PATH 的斷言

## 元資料

- **工單編號**：T0758
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

以 npm 安裝 codex 的 Windows 使用者，BAT 讀不到 codex 版本：BUG-159 的 `--no-daemon` 不注入、派工的 codex Worker 沒有 OSC 狀態。D210 排入本批。

## 範圍

1. 查證 npm shim 結構。
2. 解析 shim → 安全地探測版本；手動分頁與派工共用。
3. t0584 斷言、t0742 情境、文件。

## 不做

- 不改 codex 啟動參數本身、不改 daemon 判斷門檻（`>= 0.156.0`）、不發版。

## 驗收

- [x] 查證有證據（shim 內容、指向的檔案）
- [x] 單元測試＋突變檢查；typecheck 0 / 0、`test:unit`、`vite build`（匯出目錄）
- [x] t0742 npm shim 情境綠、t0584 綠（兩種 PATH）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（驗收三項全部通過；BUG-189 建議由塔台改 FIXED、待使用者以 npm 安裝的 codex 實機驗收）
- **產品 commit**：`ddfb4f38` fix: probe the codex behind a Windows npm shim (T0758, BUG-189)
- **落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在；C-2 無 `branch` 欄位（`main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **session_id**：719472c3-b87f-4ab5-b09c-398728b9d362

### 產出摘要

**1. 查證（npm shim 結構，`@openai/codex` 0.166.0）**

- 測試用安裝：`npm i -g --prefix <暫存目錄> @openai/codex@0.166.0`（未動使用者全域安裝；結束後已刪）。產生 `codex.cmd` / `codex.ps1` / 無副檔名 sh 三個 shim，內容都是「`%dp0%\node.exe` 或 `node`」執行 `"%dp0%\node_modules\@openai\codex\bin\codex.js" %*`（ps1：`"$basedir/node_modules/@openai/codex/bin/codex.js"`；sh：`"$basedir_win/node_modules/@openai/codex/bin/codex.js"`）。
- repo 自己的 `node_modules\.bin\codex.cmd`（npx 情境）相同，只是路徑為 `"%dp0%\..\@openai\codex\bin\codex.js"`。
- `codex.js` 不是 codex 本體：依 `process.platform` / `arch` 查 `PLATFORM_PACKAGE_BY_TARGET`，以 `require.resolve('@openai/codex-win32-x64/package.json')` 找平台套件，執行其 `vendor/x86_64-pc-windows-msvc/bin/codex.exe`（找不到套件時 `<套件>/vendor/…`），Windows 以 `spawn` 子程序轉送參數。
- 平台套件位置：`npm i -g` 版面在 `node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\`（巢狀）；專案版面 hoist 到 `node_modules\@openai\codex-win32-x64\`。兩者的 `codex.exe --version` 皆 `codex-cli 0.166.0`。

**2. 修正（`electron/codex-osc-version.ts`）**

- 新增 `resolveNpmCodexShim(shim, deps)`：讀 shim（不執行；> 64 KiB 不讀），以 regex 取出 `%dp0%` / `%~dp0`（pnpm cmd-shim）/ `$basedir` 開頭的 `.js` 路徑；只追 `…\@openai\codex\bin\codex.js`；照 codex.js 的找法（各層 `node_modules` 的 `@openai/codex-win32-<arch>/package.json` → `vendor/<triple>/bin/codex.exe`，再 `<套件>/vendor/…`；先本程序 arch、再另一個；套件根以 realpath 起算給 pnpm）找出原生 `codex.exe`。追不到 → 回原因（維持 `version-unknown`）。
- `resolveDispatchCodexBinary`：PATH 第一個含 codex 的目錄沒有 `codex.exe` 時依序讀 `codex.cmd` / `.ps1` / `.bat`，回 `{ path: <codex.exe>, via: <shim> }`；同目錄有 `codex.exe` 仍優先；追不到時不看之後的目錄（與 shell 實際執行的一致）。自訂 CLI 的絕對路徑 `.cmd` / `.ps1` / `.bat` 也照同一規則追。
- `createCodexVersionReader`：預設 deps 加 `readFile` / `realpath` / `arch`；探測仍是 `execFile(<codex.exe>, ['--version'])`、5 s timeout、不經 shell；快取鍵為原生 `codex.exe` 路徑 + mtime；日誌多 ` via=<shim>`。手動分頁 `--no-daemon`（`createCodexNoDaemonSupportCheck`）與派工 OSC（`createCodexOscVersionCheck`）都經這一個 reader，沒有第二份解析。macOS / Linux 路徑不讀檔、行為不變（測試守住）。
- 真機確認（修正後，tsx 直接呼叫 reader）：暫存的 `npm i -g` 版面 → `version=0.166.0 … via=…\codex.cmd`；repo `node_modules\.bin` → `0.166.0`。

**3. 測試與文件**

- 新增 `electron/__tests__/codex-npm-shim-version.test.ts`（14 tests）：npm 實際寫出的 cmd / ps1 shim、pnpm 形式、兩種版面、arch 順序、realpath（含 throw）、`vendor/` 後備、各種追不到的原因、同目錄 `codex.exe` 優先、自訂 CLI shim、macOS / Linux 不讀檔、兩個 consumer 共用 reader 與快取（mtime 變動重探）、`execFile` 參數、Windows 真檔案版面（含 > 64 KiB 不讀）。
- 既有測試改期望值：`codex-osc-state.test.ts`（shim 讀不到時原因改為 `cannot read the shim`；`.cmd` 自訂 CLI；`.vbs` 仍 `custom CLI is not an .exe`）、`codex-no-daemon-launch.test.ts`（helper 補 `readFile: () => null`，不依賴本機磁碟）。
- **t0584 第 275 行改法**：Settings 關閉時 codex 的期望值改由同一個探測（`createCodexNoDaemonSupportCheck()`，import 自 `electron/codex-osc-version.ts`）在同一個 PATH 算出：`inject ? '--no-daemon' : ''`（app 繼承測試程序的 PATH；Windows / Linux 的 `early-path-fix.ts` 不改 PATH）。原本斷言 `''` 只在「PATH 第一個 codex 探測不到版本」時成立：T0758 前靠 npx 把 `codex.cmd` 排第一；修正後 npx 情境也會注入，舊斷言反而會紅。檔頭第 4 點說明同步改。
- **t0742**：主體抽成 `codexTabGetsNoDaemon(name, setup)`；原情境（PATH 第一個是真 `codex.exe`）不變；新增 `T0758 / BUG-189` 情境：BAT 的 PATH 最前面放 `npm i -g` 版面的測試目錄（npm 原文 `codex.cmd` / `codex.ps1`、複製 `codex.js` / `package.json`、巢狀平台套件以 junction 指向 repo 內嵌 `@openai/codex-win32-x64`），斷言日誌 `→ injected: --no-daemon`、`[codex-version] path=<巢狀 codex.exe> version=0.166.0 … via=<codex.cmd>`、分頁命令列帶 `--no-daemon`；cleanup 先 `unlink` junction 本身並確認 repo 內嵌 `codex.exe` 仍在。檔案原本工作副本為 CRLF（index 為 LF），改寫後為 LF（與 index 一致，不產生假差異）。
- 文件：`docs/agent-guide/bat-mcp-shim.md`（版本檢查改為新行為、日誌 `via=`、驗證清單加新單元測試 / t0742 兩情境 / t0584 改法）、`docs/agent-guide/worker-launch-confirmation.md`（解析規則、已知限制例子、驗證清單）、`CLAUDE.md`「BAT MCP shim」節 codex daemon 一句只加括號內「Windows 的 npm shim 讀檔追到原生 `codex.exe` 再探測，`resolveNpmCodexShim`，T0758，🔴 不經 shell 執行 `.cmd`」。

**4. 驗證證據**

| 關卡 | 位置 | 結果 |
|---|---|---|
| `npm run typecheck` | 主 checkout | exit 0 |
| `npm run typecheck:electron` | 主 checkout | exit 0 |
| e2e 兩檔 tsc 型別檢查（ad-hoc） | 主 checkout | 無錯誤 |
| `npm run test:unit` | 主 checkout（最終狀態） | 366 files / 6542 passed / 10 skipped，exit 0 |
| 單元突變：拿掉 PATH 與自訂 CLI 的 shim 追蹤 | 主 checkout（暫改後以備份檔複製還原，未用 git restore） | 新檔 7 failed / 7 passed（直接測 `resolveNpmCodexShim` 與 macOS 的 7 個本來就不依賴被拿掉的分支）；還原後 14 passed |
| `npx vite build` | `git archive HEAD`（`ddfb4f38`）匯出目錄 `%TEMP%\bat-T0758-build`，`node_modules` junction | exit 0 |
| e2e t0742（2 tests） | 匯出目錄、隔離實例 | 2 passed：真 `codex.exe` 情境、npm shim 情境（日誌見上） |
| e2e 突變：匯出目錄換回修正前 `codex-osc-version.ts` 重 build | 同上 | npm shim 情境 1 failed：`[codex-version] path=- version=unknown (first codex on PATH is …\npm\codex.cmd (needs a shell))`、`no-daemon=no (version-unknown)`＝BUG-189 原樣重現；還原後重 build |
| e2e t0584（PATH 有 `node_modules\.bin`，`npx playwright`） | 匯出目錄 | 1 passed；探測 `via=…\node_modules\.bin\codex.cmd` → `0.166.0`，期望 `--no-daemon` |
| e2e t0584（PATH 拿掉 `node_modules\.bin`，`node …/@playwright/test/cli.js`） | 匯出目錄 | 1 passed；探測本機 `codex.exe` → `0.166.0`，期望 `--no-daemon` |
| 清理 | — | 先刪匯出目錄 junction 本身，確認主 checkout `node_modules/electron` 與內嵌 `codex.exe` 仍在，再刪匯出目錄；暫存 npm 安裝已刪；無殘留 `bat-t0742-codex-*` |

### 遭遇問題

- 測試用 npm 安裝的路徑少了一個分隔符，實際落在 `%LOCALAPPDATA%\Tempbat-t0758-npmcodex`（`Temp` 外面）；查證完已刪除，未影響其他東西。
- 第一次 e2e 突變以 PowerShell 管線寫回舊檔造成 build 失敗（舊 dist 照跑而通過，不算數）；改用 bash 寫檔重 build 後得到上表的有效失敗結果。
- 同一 checkout 有其他 Worker 的未提交變更（`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`electron/terminal-blocked-state.ts`、`docs/agent-guide/worker-tab-recycle.md` 與兩個新檔，屬 T0757）；本單只以 `git commit --only` commit 自己的檔案，未動它們。`npm run test:unit` 在含它們的工作樹上跑，全綠。
- 未做（不在範圍）：pnpm / bun 全域安裝只以單元測試的 shim 形式涵蓋，沒有實機安裝；codex 啟動參數與 `>= 0.156.0` 門檻未動；未 push、未發版。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 回報時間

- 2026-11-02T02:40:10+08:00
