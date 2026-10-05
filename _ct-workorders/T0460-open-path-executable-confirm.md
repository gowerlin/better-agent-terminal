---
schema_version: 1
schema_kind: workorder
id: T0460
title: "shell:open-external 對 file: 本機路徑以 openPath 開啟時，可執行副檔名（.bat / .cmd / .exe / .ps1 / .vbs / .lnk 等）先跳確認對話框；其他檔案照舊直接開"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T11:19:13+08:00"
started_at: "2026-10-05T11:20:24+08:00"
updated_at: "2026-10-05T11:25:07+08:00"
completed_at: "2026-10-05T11:25:07+08:00"
target_version: next
depends_on: []
related:
  - "T0457（`443ba4e`）回報區「遭遇問題」1：IPC `shell:open-external` 對 `file:///` 走 `shell.openPath`，點擊本機 `.bat` / `.exe` 即執行（PathLinker / TerminalPanel 等呼叫端）"
  - "使用者 2026-10-05 11:19 裁決：可執行副檔名加確認對話框（其他檔案照舊直接開）"
affects_files:
  - electron/main.ts
  - electron/navigation-guard.ts
  - electron/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **使用者裁決**：只對可執行 / 腳本類副檔名跳確認，其餘檔案行為不變。清單至少含 Windows：`.bat` `.cmd` `.com` `.exe` `.msi` `.ps1` `.psm1` `.vbs` `.vbe` `.js` `.jse` `.wsf` `.wsh` `.hta` `.scr` `.pif` `.cpl` `.reg` `.lnk` `.url`；macOS：`.app` `.command` `.pkg` `.dmg` `.terminal`；Linux / 通用：`.sh` `.run` `.AppImage` `.desktop`，以及無副檔名但在 POSIX 有可執行位元的檔案（能判斷才判斷，無法判斷不擋）。大小寫不敏感。清單與判斷抽成純函式（放 `navigation-guard.ts` 或新模組）並單測。"
  - "🔴 對話框：main 端 `dialog.showMessageBox`（以呼叫視窗為 parent），按鈕「取消」（預設、Esc）/「開啟」；文字 i18n 三語（main 端若無 i18n 機制，比照專案既有 main 端對話框做法，回報區說明）；顯示檔名（不顯示完整路徑以外的敏感資訊）；取消則不開啟並回傳可辨識結果。不得用 renderer 自行繞過（判斷在 main）。"
  - "🔴 `http(s)` 走 `openExternal` 的行為不變；`file:` 非可執行檔仍直接 `openPath`；遠端視窗的路徑語意（T0437 / PathLinker server 形式）不在本單範圍，只處理本機開啟。"
  - "🔴 同工作樹有 T0459（研究，只讀）。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0460 — 可執行檔開啟確認

## 驗收條件

- [x] 純函式測試：各平台副檔名（大小寫）命中、一般檔（`.txt` / `.md` / `.png` / `.pdf`）不命中、無副檔名不誤擋
- [x] handler 測試（mock `dialog` / `shell`）：可執行檔 → 對話框；取消 → 不 `openPath`；開啟 → `openPath`；非可執行 → 直接 `openPath`、不跳對話框；http(s) → `openExternal` 不變
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36
- [x] 回報區附實機步驟（終端輸出中的 `C:\…\x.bat` 連結點擊 → 確認框；`.txt` → 直接開）

## Sub-session 執行指示
1. 讀本工單 + T0457 回報區 + `electron/main.ts` `shell:open-external`（約 :2421）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE — commit `380cecf`（未 push）

**Landing Zone**：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 present（`electron/main.ts` 等皆存在）；C-2 無 `branch` 欄位（HEAD `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo` / `CT_INTERACTIVE=0`。

### 產出摘要

**新模組 `electron/open-external-guard.ts`**（純函式 + DI handler，判斷全在 main）
- `EXECUTABLE_EXTENSIONS`：工單清單全收（Windows 20 個 / macOS 5 個 / Linux 4 個，`.AppImage` 以小寫比對），另補常見會被 "open" verb 執行的 `.msp` `.msc` `.vb` `.ws` `.inf` `.scf` `.jar` `.chm` `.appref-ms` `.application` `.gadget` `.settingcontent-ms` `.webloc`。三平台共用一份清單、大小寫不敏感。
- `isExecutablePath(path, platform, stat?)`：副檔名命中即 true；Windows 先剝 ADS 後綴（`x.bat::$DATA`）與尾端點 / 空白（`x.bat.`，OS 會自動去除，否則可繞過）。無副檔名時僅 POSIX + `stat.isFile` + 任一 execute bit 才 true；`stat` 讀不到 → 不擋；目錄不擋。
- `fileUrlToLocalPath(url, platform)`：沿用原 `file:///` 轉換（`decodeURIComponent(pathname)` + 去掉 `/C:/` 前導斜線），另支援 `FILE:///`、`file://localhost/`、`file:/x`；帶 host 在 Windows 轉 UNC `\\host\share\…`，其他平台回 null。
- `handleOpenExternal(url, deps)` → `'opened' | 'cancelled' | 'not-found' | 'invalid' | 'failed'`：
  - 非 `file:` → `openExternal(url)` 原樣（http(s) 行為不變，`mailto:` 等其他 scheme 亦同原行為）
  - 任何拼法的 `file:` URL（大小寫、前導空白、localhost / host 形式）都進 file 分支，**不再落到 `openExternal`**（原 `startsWith('file:///')` 會讓 `FILE:///C:/x.bat`、`file://localhost/C:/x.bat` 直接走 ShellExecute，等於繞過本單確認）；無法轉本機路徑 → `'invalid'` + log，不開
  - 不存在 → 原「File not found」框，`'not-found'`
  - 可執行 → `confirmExecutable`；取消 → `'cancelled'` 不 `openPath`；開啟 → `openPath`
  - 非可執行 → 直接 `openPath`（不跳框）；`openPath` 回錯 → log + `'failed'`
- `buildExecutableConfirmDialog(path, platform, lang)`：`type: 'warning'`、buttons `[取消, 開啟]`、`defaultId` = `cancelId` = 0（預設與 Esc 皆取消）、`noLink: true`；message 只放檔名，detail 放完整路徑 + 警語。
- `getExecutableConfirmStrings(lang)`：**main 端無 i18next**，比照既有 quit 對話框（`getQuitDialogStrings`，PLAN-012 / T0144）在 main 內嵌三語字串，語系取 `readPersistedSettingsSync()?.language`；同時在 `src/locales/{en,zh-TW,zh-CN}.json` 新增頂層 `openExecutableConfirm.{title,message,detail,open,cancel}`，並以單測比對 main 內嵌字串與三份 JSON **完全一致**（防漂移，quit 對話框目前沒有此保護）。

**`electron/main.ts`**（2 hunk：import + handler）
- `shell:open-external` 改為 `handleOpenExternal(url, deps)`：`shell.openPath` / `shell.openExternal` / `fsSync.existsSync` / `fsSync.statSync` 注入；確認框以 `BrowserWindow.fromWebContents(event.sender)` 為 parent（取不到則無 parent），`response === EXECUTABLE_CONFIRM_OPEN_INDEX` 才開。IPC 回傳值由 `undefined` 改為上述結果字串（renderer 呼叫端皆未使用回傳值，相容）。

**測試 `electron/__tests__/open-external-guard.test.ts`**（67 tests）
- 純函式：三平台各副檔名大小寫命中、跨平台同清單、`.txt` `.md` `.png` `.pdf` `.json` `x.bat.txt` `x.exe.md` 不命中、無副檔名不誤擋、POSIX x-bit / 非 x-bit / 目錄、Windows 忽略 mode、尾端點 / ADS
- `fileUrlToLocalPath`：原轉換、各拼法、UNC / 非 Windows host 拒絕、非 file URL
- handler（mock deps）：可執行 → 對話框；取消 → 不 `openPath`；開啟 → `openPath`；非可執行 → 直接 `openPath` 不跳框；POSIX x-bit 檔；mode 讀不到不擋；4 種 file URL 拼法皆不進 `openExternal`；host 無法對應 → `invalid`；不存在 → 不跳確認；`openPath` 失敗；http / https / mailto → `openExternal` 不變
- 對話框：Cancel 為 default + cancelId、按鈕文字、message 只含檔名 / detail 含完整路徑、三語字串 = locale JSON、未知語系 fallback 英文
- 接線守門：`main.ts` 的 `shell:open-external` 必須呼叫 `handleOpenExternal(`

**驗證**
| 項目 | 結果 |
|---|---|
| 紅燈 | 先寫測試，模組不存在 → 1 file failed（11:22:40） |
| `npx vitest run electron/__tests__/open-external-guard.test.ts` | PASS 67/67 |
| `npm run test:unit` | PASS — 164 files，2713 passed / 1 skipped / 0 failed |
| `npx tsc --noEmit` | 36（改動前基線 36，無新增；無 `open-external-guard` / 本單 hunk 相關錯誤） |
| `npx vite build` / `npm run test:e2e` | 依工單指示**未跑** |
| 實機 runtime smoke | **未執行**（需重打包安裝版；見下方步驟，待使用者 / QA 驗收） |
| `git diff electron/main.ts` | 2 hunk（import + handler），皆本單 |

**實機驗收步驟**（Windows，安裝版或 `npm run dev`）
1. 準備 `C:\tmp\x.bat`（內容 `@echo hi & pause`）與 `C:\tmp\x.txt`
2. 在 BAT 終端執行 `echo file:///C:/tmp/x.bat` 與 `echo file:///C:/tmp/x.txt`（TerminalPanel 的 file:// link provider）；或在 agent 輸出 / PathLinker 中點同樣連結
3. 點 `x.bat` 連結 → 應跳「開啟可執行檔」警告框（語系依 Settings），顯示 `x.bat` 與完整路徑，預設焦點在「取消」
   - 按 Esc 或「取消」→ 不執行（無 cmd 視窗）
   - 再點一次，按「開啟」→ 執行（出現 cmd 視窗 `hi`）
4. 點 `x.txt` 連結 → 不跳框，直接以預設程式開啟
5. 回歸：點 `https://…` 連結 → 照舊開瀏覽器；點不存在的 `file:///C:/tmp/none.bat` → 照舊「File not found」框
6. （選）`echo FILE:///C:/tmp/x.bat`：TerminalPanel 的 regex 只抓小寫 `file:///`，此拼法主要來自 markdown 連結（`FileTreeMarkdown` / chat markdown），以 `.md` 內 `[x](file://localhost/C:/tmp/x.bat)` 點擊應同樣跳框

### 遭遇問題

1. **file: URL 拼法繞過（已在本單修）**：原 handler 以 `url.startsWith('file:///')` 分流，`FILE:///…`、`file://localhost/…`、`file://server/share/…` 會落到 `shell.openExternal`（ShellExecute 直接執行）。工單範圍為「`file:` 本機路徑」，若只在 `file:///` 分支加確認，這些拼法可完全繞過，故改以解析後 protocol 分流；`file://host/` 在 Windows 轉 UNC 路徑後同樣受確認保護，非 Windows 拒絕。
2. **未處理（範圍外，建議 Tower 評估）**：
   - `shell:open-path` IPC（`main.ts`，緊接本 handler 之後）仍對 renderer 給的任意路徑直接 `shell.openPath`，不經本單確認。目前呼叫端看似用於開資料夾；若要一致防護，可讓它也經 `isExecutablePath` + 確認框。
   - 非 http(s) / 非 file 的 scheme（`ms-msdt:`、`search-ms:` 等 Windows 協定處理器）仍原樣交給 `shell.openExternal`（工單明定 http(s) 不變，其他 scheme 未要求變更，維持原行為）。T0457 已限制導航 / window.open 只放 http(s)，但本 IPC 仍是任意 scheme。
   - `src/types/electron.d.ts` 的 `openExternal` 型別仍為 `Promise<void>`（不在 affects_files；呼叫端皆不讀回傳值）。若 renderer 未來要依 `'cancelled'` 等結果反應，需同步改型別。
   - 遠端視窗 / PathLinker server 路徑語意（T0437）依工單排除。
3. 新增檔 `electron/open-external-guard.ts` 不在 `affects_files` 清單，但 memory_overrides 明示「抽成純函式（放 `navigation-guard.ts` 或新模組）」，採新模組以免把 IPC handler 依賴混進 navigation guard。

### 回報時間

2026-10-05T11:24:17+08:00
