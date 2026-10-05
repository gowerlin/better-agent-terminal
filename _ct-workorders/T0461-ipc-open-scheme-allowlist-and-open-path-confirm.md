---
schema_version: 1
schema_kind: workorder
id: T0461
title: "IPC shell:open-external 只放行 http / https / mailto（擋 ms-msdt: / search-ms: 等協定處理器）；shell:open-path 套用 T0460 可執行檔確認"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: S
created_at: "2026-10-05T11:25:30+08:00"
started_at: "2026-10-05T11:26:14+08:00"
updated_at: "2026-10-05T11:31:32+08:00"
completed_at: "2026-10-05T11:31:32+08:00"
target_version: next
depends_on:
  - T0460
related:
  - "T0460（`380cecf`）回報區「遭遇問題」2：`shell:open-path` 對 renderer 任意路徑直接 `openPath`；非 http(s) / 非 file scheme（`ms-msdt:` / `search-ms:` 等）仍交給 `shell.openExternal`"
  - "T0457 `navigation-guard.ts`（`isExternalBrowserUrl`）；T0460 `open-external-guard.ts`（`handleOpenExternal` / `isExecutablePath` / 確認框）"
  - "D134 追加（塔台 11:25 依授權直接決定：收緊方向）"
affects_files:
  - electron/main.ts
  - electron/open-external-guard.ts
  - electron/__tests__/
  - src/types/electron.d.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點** renderer 端所有 `shell.openExternal(` / `shell.openPath(` 呼叫者與其 URL / 路徑來源（使用者點擊的 agent 輸出、Markdown、設定頁固定連結、檔案樹等），列出實際用到的 scheme，回報區附表。若發現專案內確實需要 `http(s)` / `mailto` / `file` 以外的 scheme（例：`vscode:` 開 VS Code，T0078-T0082），列入白名單並說明依據；**不得**放行 `ms-msdt:` / `search-ms:` / `ms-*:` / `javascript:` / `data:` / `vbscript:` 等。"
  - "🔴 `shell:open-external`：非 file 分支只對白名單 scheme `openExternal`，其他回 `'invalid'`（或新結果碼）+ log 只含 scheme，不開啟。`shell:open-path`：沿用 T0460 `isExecutablePath` + 確認框（取消不開）；資料夾 / 非可執行檔行為不變。判斷放 `open-external-guard.ts` 純函式並單測。"
  - "🔴 既有正常功能不得回歸：開資料夾、開一般檔、http(s) 連結、設定頁 / About 連結。`electron.d.ts` 的回傳型別可同步為結果字串（呼叫端不讀回傳值時相容）。"
  - "🔴 T0459（研究，只讀）同時執行。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0461 — IPC 開啟 scheme 白名單 + open-path 確認

## 驗收條件

- [x] 回報區附呼叫者 / scheme 盤點表與白名單依據
- [x] 測試：`ms-msdt:` / `search-ms:` / `MS-MSDT:` / `javascript:` / `data:` / 未知 scheme 不開；http / https / mailto（+ 依盤點加入者）照舊；open-path 可執行檔跳確認、取消不開、資料夾與一般檔照舊
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0460 / T0457 回報區 + `electron/open-external-guard.ts`
2. 填 `started_at`、`status: DONE`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE** — 驗收條件 3/3 達成。

**Landing check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS（`REPO_ROOT=D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`electron/main.ts` / `electron/open-external-guard.ts` / `src/types/electron.d.ts` / `electron/__tests__/` 皆存在 → PASS
- C-2：無 `branch` 欄位（HEAD=`main`）
- 證據：`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

#### 1. 呼叫者 / scheme 盤點

`shell:open-external`（`window.electronAPI.shell.openExternal`）：

| 呼叫者 | URL 來源 | 實際 scheme |
|---|---|---|
| `TerminalPanel.tsx:312` WebLinksAddon | 終端輸出（使用者點擊） | http / https（addon 只偵測 http(s)） |
| `TerminalPanel.tsx:343` file link provider | 終端輸出 `file:///...` | file（T0460 分支） |
| `PathLinker.tsx:427` `LinkedText` | agent 輸出 `MD_LINK_RE` / `URL_RE` | http / https / file |
| `chat-markdown.ts:82` `openChatMarkdownLink` | chat Markdown，DOMPurify `ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|file):/i`；`file://` 先在 renderer 轉 preview | http / https / **mailto** / tel（file 走 preview，parse 失敗才落到 IPC） |
| `FileTreeMarkdown.tsx:116` | 檔案樹 Markdown 預覽 `a[data-external-link]`（DOMPurify 預設 URI 白名單：http(s) / ftp / mailto / tel / callto / sms / cid / xmpp / matrix / 相對路徑） | 實務為 http / https；相對連結經 DOM 解析成 app base（dev `http://localhost`、prod `file:`） |
| `AboutPanel.tsx:10` | 固定 `https://github.com/gowerlin/better-agent-terminal` | https |
| `UpdateNotification.tsx:60` | 固定 releases URL | https |
| `SettingsPanel.tsx:1191/1361/1367` | 固定 README / tailscale.com | https |
| `SetupWizardShell.tsx:507` | `error-mapper.ts` 固定 docker.com / learn.microsoft.com | https |
| `GitHubPanel.tsx:281/323`、`Sidebar.tsx:618` | 固定 cli.github.com / `git.getGithubUrl()` 組出的 repo URL | https |
| `remote-tools/ExternalLink.tsx` | `onOpenUrl` 注入；`RemoteToolsEntry` 未注入 → 走 `window.open` → T0457 navigation guard（http(s) only），不經此 IPC | — |

`shell:open-path`（`window.electronAPI.shell.openPath`）：`FileTree.tsx:350`（資料夾 / 檔案的父資料夾）、`Sidebar.tsx:551`（workspace `folderPath`）、`PathLinker.tsx:359`（`PATH_RE` 只比對絕對路徑 `C:\` / `/Users|home|tmp|...`）、`MarkdownPreviewPanel.tsx:89`（預覽中的檔案）、`SettingsPanel.tsx:330`（logsDir）、`VoiceSettingsSection.tsx:228`（modelsDir）——**全部是絕對本機路徑**，皆為使用者點擊觸發。headless remote 不回應此 channel（`headless-always-local.test.ts`）。

main 端其他 `shell.openExternal`：`main.ts:706` navigation guard（http(s) only，T0457）、`main.ts:911-963` 選單固定 GitHub URL——不經 IPC，不在本單範圍。

**白名單 = `http:` / `https:` / `mailto:`**（`EXTERNAL_URL_PROTOCOLS`）。依據：上表所有非 file 實際 scheme 只有這三種；mailto 來自 chat Markdown sanitizer 明文允許。未發現 `vscode:` 等其他 scheme 需求（VS Code 開啟走獨立的 `shell:open-in-editor` + `execFile`）。**刻意不放行 `tel:`**：chat sanitizer 允許但無任何功能依賴，收緊方向（D134）下排除；chat 中 `tel:` 連結點擊改為 `blocked`（只 log scheme）。`ftp:` / `callto:` / `sms:` 等 DOMPurify 預設允許者同樣不放行。

#### 2. 實作

- `electron/open-external-guard.ts`
  - 新增 `EXTERNAL_URL_PROTOCOLS`、`isAllowedExternalUrl(url)`：`new URL()` 解析後 protocol 在白名單，**且** raw 字串開頭就是該 scheme（URL parser 會去掉前導空白 / 控制字元，但交給 OS 的是 raw 字串，故 `' https://…'` / `'\thttps://…'` 一律拒）；非字串拒。
  - `handleOpenExternal`：非 file 分支先過 `isAllowedExternalUrl`，不通過回新結果碼 **`'blocked'`**，`logError` 只含 scheme（`[shell:open-external] refused scheme ms-msdt:`；不可解析記 `(unparseable)`），不開啟。file 分支（T0460）不變。
  - 新增 `handleOpenPath(targetPath, deps)` + `OpenPathDeps` / `OpenPathResult`（`'opened' | 'cancelled' | 'invalid' | 'failed'`）：
    - 只收**絕對本機路徑**（`path.win32` / `path.posix`.isAbsolute 依平台）；`ms-msdt:` / `search-ms:` / URL / 相對路徑 / 空字串 / 非字串 → `'invalid'`（ShellExecute 會把 `scheme:` 字串交給協定處理器，故一併收緊；所有既有呼叫者都傳絕對路徑，見盤點）。
    - 檔案沿用 T0460 `isExecutablePath`（Windows 不讀 mode；POSIX 無副檔名看 exec bit）→ 確認框，取消不開。
    - **資料夾一律直接開**（名字像 `three.js` / `project.sh` 的資料夾不跳確認），唯一例外：macOS `.app` bundle（OS 會啟動它）要確認。
    - stat 失敗（不存在 / 無權限）時按副檔名判斷。
    - `openPath` 回錯誤字串 → log + `'failed'`（原本靜默忽略）。
- `electron/main.ts`：抽出 `statForOpen` / `confirmExecutableFor(sender)` 兩個本地 helper，`shell:open-external` 與 `shell:open-path` 共用（確認框文案、父視窗、預設 Cancel 與 T0460 一致）；`shell:open-path` 改為委派 `handleOpenPath`。只有 import 行 + IPC handler 區兩個 hunk。
- `src/types/electron.d.ts`：`openExternal` / `openPath` 回傳型別同步為結果字串 union（呼叫端都不讀回傳值，或以 `|| window.open` 判斷 Promise truthy，相容）。

#### 3. 測試（`electron/__tests__/open-external-guard.test.ts`，+150 行）

- `handleOpenExternal`：`ms-msdt:` / `MS-MSDT:` / `search-ms:…\\attacker\share` / `ms-settings:` / `javascript:` / `data:` / `vbscript:` / `tel:` / 未知 scheme / 前導空白 https / 不可解析 → 不呼叫 `openExternal` / `openPath`、log 一次且不含 payload；`ms-msdt:` 回 `'blocked'` 且 log 含 scheme；`HTTPS://Example.com/Docs`、`mailto:…?subject=` 照舊開啟（原樣傳入）；既有 http / https / mailto 測試照舊。
- `isAllowedExternalUrl`：4 個允許、16 個拒絕（含 `ms-appinstaller:`、`file:`、`ftp:`、`\t` / 空白前綴、`https:` 無 host、空字串）、非字串。
- `handleOpenPath`：可執行檔跳確認且取消不開、確認後開、POSIX exec bit 檔案確認、一般檔直接開、Windows / Linux / macOS 資料夾（含 `three.js`、`project.sh`、win32 上 POSIX 形式 remote 路徑）直接開、macOS `.app` 資料夾確認、stat 失敗按副檔名確認、`ms-msdt:` / `search-ms:` / URL / 相對 / 空白 → `'invalid'`、非字串、openPath 失敗 log。
- wiring：`shell:open-path` handler 必須委派 `handleOpenPath(`。
- TDD：先寫測試 → 53 失敗（紅）→ 實作後 122/122 綠。

#### 4. 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| 目標測試 | PASS | `open-external-guard` + `navigation-guard` + `navigation-guard-install`：3 files / 177 tests passed |
| `npm run test:unit` | PASS | 164 files passed；2768 passed / 1 skipped；exit 0（log 內 `AttachConsole failed` / `No such remote 'origin'` 為既有 node-pty / git fixture 雜訊，非失敗） |
| `npx tsc --noEmit` | PASS | 36 個 error（= 基準 ≤ 36），無任何一筆落在本單改動檔 |
| `npx vite build` / `npm run test:e2e` | 未跑（依工單 L141 明令不跑） | — |
| runtime smoke（實機點擊確認框） | 未執行 | 本單無 runtime lane 要求；實機行為由純函式單測 + wiring 測試覆蓋 |

### 遭遇問題

1. Bash 工具一度 `EPERM: uv_spawn bash.exe`，改用 PowerShell / Edit 工具完成，不影響產出。
2. **行為變更（刻意）需塔台知悉**：
   - chat Markdown 中 `tel:` 連結（sanitizer 允許）點擊後不再開啟，回 `blocked`。如日後要支援，加進 `EXTERNAL_URL_PROTOCOLS` 即可。
   - `shell:open-path` 拒絕非絕對路徑；現有 6 個呼叫者皆傳絕對路徑，無回歸。
   - `shell:open-path` 的 openPath 失敗現在會寫 error log（原本靜默）。
3. **殘餘風險 / 未在本單範圍**：
   - `FileTreeMarkdown` 相對連結在 prod 會被 DOM 解析成 `file:///…/app.asar/…` 進 T0460 file 分支（既有行為，通常 not-found；非安全問題）。
   - Windows UNC 路徑（`\\server\share\…`）在 open-path 仍視為合法絕對路徑；可執行副檔名會跳確認，但非可執行檔（如 `.docx`）會直接以預設程式開啟遠端分享檔——與 T0460 file: URL UNC 行為一致，若要更收緊屬另案。
   - `main.ts` 選單與 navigation guard 的 `shell.openExternal` 不經 IPC、URL 固定或已限 http(s)，未改。
4. T0459（研究，只讀）同時執行；commit 前 `git diff electron/main.ts` 僅本單兩個 hunk（import 行 @105、IPC handler @2420）。未用 `git stash` / `reset` / `checkout --` / `restore`；寫檔全為 LF（CRLF=0 檢查）；未 push。

### 回報時間

2026-10-05T11:30:34+08:00
