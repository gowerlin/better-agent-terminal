---
schema_version: 1
schema_kind: workorder
id: T0524
title: "終端分頁貼圖修復：Windows 回歸 + mac 讓 claude CLI 能貼圖，同時保留標準複製貼上（BUG-130）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-130
priority: P1
sizing: S
created_at: "2026-10-14T13:36:40+0800"
started_at: "2026-10-14T13:37:57+0800"
updated_at: "2026-10-14T13:57:37+0800"
completed_at: "2026-10-14T13:57:37+0800"
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

### 結果：DONE（Windows：隔離實例自動化驗證通過；mac：單元測試 + 推論，實機交 Gary）

### Landing Zone Check：PASS

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS。C-3：前 5 項（`src/components/TerminalPanel.tsx`、`src/lib/terminal-paste.ts`、`src/lib/`、`electron/clipboard-file-paths.ts`、`electron/main.ts`）都存在 → PASS。C-2：沒有 `branch` 欄位（HEAD = `main`）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 1. Windows 回歸根因（任務 1）

| 候選 | 查證 | 結論 |
|---|---|---|
| 程式碼改壞 | `git log -S"x1bv"` / `-S"navigator.clipboard.read()"` 都只命中 `24780ec`；`git log -L` 看 Ctrl+V 分支，`24780ec`（2025-12-18）之後只有 T0522（`43c9073`）動過，而且只加了 mac 分支 | 否 |
| claude CLI 貼圖鍵改了 | 內嵌 `claude.exe` 2.1.296 原始碼：`Ie=M==="windows"\|\|M==="wsl", Me=Ie?"alt+v":"ctrl+v"`，`[Me]:"chat:imagePaste"`，WSL 另綁 `"ctrl+v"`。binding 比對時 `(e.alt\|\|e.meta)===(r.alt\|\|r.meta)`，所以 `ESC v`（meta+v）會對到 `alt+v`。Windows 收鍵後執行 `powershell -NoProfile -NonInteractive -Sta -Command "…[System.Windows.Forms.Clipboard]::ContainsImage()…"`，再 `GetImage().Save(…png)` | 否（沒有啟動 CLI session，不消耗 token） |
| `navigator.platform` | 隔離實例裡 Windows 分支確實走到了（見下一列） | 否 |
| Electron 41 `navigator.clipboard.read()` 權限 / 型別 | 隔離實例實測：**source build（修正前程式碼）**與**安裝版 pre.7 執行檔**（`BAT_E2E_EXECUTABLE`，同樣是隔離 runtime / 埠），剪貼簿放 Electron `writeImage` 的圖、以及 .NET `Clipboard.SetImage` 的 2560×1440 圖，`read()` 都回 `[["image/png"]]`、`hasFocus=true`，按 Ctrl+V 後 PTY 都收到 `1b76`；CLI 自己的 `ContainsImage()` 檢查也回 exit 0 | 在本機**無法重現** |

**結論**：本機用兩種圖片來源，修正前的 pre.7 都能正常送出 Alt+V，回歸**沒有重現**，根因沒有被證實。最可能的路徑是舊程式碼本身的設計：`navigator.clipboard.read()` 一旦丟錯（視窗或文件沒取得焦點、某個截圖工具寫入的格式解碼失敗、權限），`.catch` 就靜靜退成 `readText()`。圖片剪貼簿沒有文字，所以什麼都沒貼，也完全沒有 log，使用者那邊的觸發條件因此無法回查。修正把這條路徑移除了：圖片改由 main 判斷，每個失敗與每次決策都寫 log。若使用者實機仍貼不出圖，查 debug log 的 `[terminal-paste]` 行，就能分辨是 BAT 沒判到圖片、送了鍵但 CLI 沒讀到，還是 key 根本沒進到 BAT。

### 2. 修正（任務 2–5）

| 檔案 | 內容 |
|---|---|
| `src/lib/terminal-paste.ts` | `readMacTerminalClipboard` 改為三平台共用的 `readTerminalClipboard()`，回傳 `paths` / `image` / `text` 三種結果。優先序：`readFilePaths()`（T0522；main 只有 darwin 會讀，其他平台回 `[]`）→ `hasImage()` → `readText()`。`hasImage` 先用既有的 `clipboard.readImageDataUrl()`（T0436，main 的 `readImage().isEmpty()`），丟錯（IPC 失敗、圖片超過附件上限）時才退回 `navigator.clipboard.read()` 的 `image/*` 型別。每個失敗都會 log 並降到下一步。新增 `imagePasteKey(platform)`：`win32` → `\x1bv`，其他 → `\x16` |
| `src/components/TerminalPanel.tsx` | `pasteClipboardMac` 改為 `pasteClipboard(source)`：paths → `insertFilePaths()`（T0522 原樣），image → `pty.write(imagePasteKey(...))`，text → `handlePasteText()`（保留 >10 KB 確認、>64000 分段）。每次都記 `dlog('[terminal-paste] <source> → <kind> terminal=<id>')`。**Ctrl+V（三平台）、mac Command+V、右鍵選單 Paste** 全部走這個函式；舊的 Windows `navigator.platform` + Async Clipboard 分支與 Linux 純文字分支刪除。Ctrl+C、Ctrl+Shift+C / V、Command+V 的 `preventDefault` 與 1 秒原生 paste 吞噬（T0522）都沒有動 |
| `src/__tests__/terminal-paste-shortcuts.test.tsx` | T0522 測試改接新的 reader，平台分支測試依新行為調整（見第 4 節），另加矩陣與複製 / 右鍵測試 |
| `e2e/t0524-terminal-image-paste.spec.ts`（新） | Windows / mac / Linux 都能跑的隔離實例 e2e：終端執行 node raw-mode hex 回顯腳本，Ctrl+V 後檢查 PTY 收到的位元組。測試前存下剪貼簿（text / HTML / image），結束後還原 |

**取捨**
- **圖片判斷沿用 `readImageDataUrl`，沒有新增 `clipboard:has-image` IPC**：工單要求優先沿用既有 IPC，而且開工時 T0523 在 `electron/main.ts` / `preload.ts` / `electron.d.ts` 還有未 commit 的變更。代價是剪貼簿有圖時，main 會多編一次 PNG（2560×1440 的大圖在 e2e 裡仍是即時送鍵，感覺不到延遲）。純文字剪貼簿 `readImage()` 是空的，馬上回 `null`。之後若想省掉編碼，可另開單加一個只回 boolean 的 IPC
- **mac Command+V 有圖片時也送 `\x16`**（工單建議的選項）：Command+V 與 Ctrl+V 都能貼圖，文字與檔案行為不變。修正前 Command+V 碰到圖片剪貼簿什麼都不會發生，所以這不會讓任何既有情境變差
- **圖片優先於文字**：剪貼簿同時有圖與文字時（例如 Excel 複製儲存格會一起放 bitmap），Ctrl+V 會送貼圖鍵。這與 `24780ec` 起 Windows 的既有行為相同；要貼文字可以用 Ctrl+Shift+V（純文字，不檢查圖片）。這點記為殘餘風險
- **右鍵選單 Paste 也套用同一套決策**：Windows / Linux 過去只貼文字，現在有圖片時同樣送鍵，三個入口結果一致
- **Windows 檔案總管拷貝 → 路徑：沒有做**。Electron `clipboard` 沒有讀取 `CF_HDROP` 清單的 API，`FileNameW` 只拿得到第一個檔案，多選時會漏掉，成本不算低。現況與修正前相同（剪貼簿沒有文字，什麼都不貼）。需要的話可另開單（例如在 main 用 PowerShell `Get-Clipboard -Format FileDropList`）

**任務 5：一般 shell 收到貼圖鍵**
- 沒有依 agent preset 決定要不要送：使用者常在一般終端分頁裡自己輸入 `claude`，加上 preset 判斷反而會把 Windows 上原本能用的情境弄壞。BAT 也拿不到 PTY 前景行程是什麼
- 影響：剪貼簿**只有圖片、沒有文字**時才會送鍵；這種情況改送文字貼上本來就什麼都不會貼。bash / zsh 的 `\x16` 是 quoted-insert，等下一個按鍵照字面插入，不會執行任何東西；PowerShell PSReadLine 的 Alt+V 預設沒有綁定。原本就是「什麼都沒貼」的情境，最多多出一個無害的按鍵，可以接受。Windows 自 `24780ec` 起就是這樣
- 遠端視窗：圖片判斷讀的是**本機**剪貼簿（T0436 local-only），鍵依本機平台決定。WSL 視窗的 CLI 是 `wsl` 平台，`alt+v` 與 `ctrl+v` 都有綁，而且會用 `powershell.exe` 讀 Windows 剪貼簿，可以運作。SSH / Docker 遠端的 CLI 讀不到本機剪貼簿，送鍵也貼不出圖，但修正前在這個情境同樣什麼都不貼，沒有變差

### 3. 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| 單元測試 | PASS | `src/__tests__/terminal-paste-shortcuts.test.tsx` 54 tests：`readTerminalClipboard` 5 條（檔案優先於圖片、圖片、文字、讀路徑失敗仍檢查圖片、圖片檢查失敗退回文字，兩種失敗都有 log）；`imagePasteKey`；**矩陣** 3 平台 × {Ctrl+V, mac Command+V}（共 4 組）× {圖片 → 鍵, 檔案 → 引號路徑, 檔案+圖示圖片 → 路徑, 文字 → 只貼一次, main 讀圖失敗 → Async 備援找到圖片, 兩種圖片檢查都失敗 → 文字 + log, 讀文字失敗 → 不送任何東西 + log}；Ctrl+C（有選取才複製、否則放行 SIGINT）/ Ctrl+Shift+C ×3 平台；Ctrl+Shift+V 有圖片時仍貼文字 ×3；右鍵 Paste 圖片 → 鍵、文字 → 文字 ×3；T0522 既有案例（mac Finder 路徑、純文字 Command+V 只貼一次且後續原生 paste 被吞、沒按 Command+V 的 paste 不受影響、mac Ctrl+V = Command+V、Windows meta+V 不攔截）全綠 |
| `npm run typecheck` | PASS（0） | exit 0 |
| `npm run typecheck:electron` | PASS（0） | exit 0（本單沒有動 electron） |
| `npx vite build` | PASS | exit 0 |
| `npm run test:unit` 全套 | PASS | 216 files、3636 passed / 1 skipped，exit 0（log 裡的 `AttachConsole failed` 是既有 real-PTY 測試的 node-pty 雜訊，不是失敗） |
| **Windows 隔離實例自動化** | PASS | `npx playwright test e2e/t0524-terminal-image-paste.spec.ts`：Electron `writeImage` 的圖 → PTY `1b76`；.NET `Clipboard.SetImage` 2560×1440 → PTY `1b76`；文字 `T0524 text paste` → PTY 原樣（`54303532342074657874207061737465`）；debug log 依序是 `[terminal-paste] Ctrl+V → image` ×2、`→ text`；剪貼簿已還原；Terminal Server 已結束，runtime userData 已刪除。截圖 / log：`e2e-results/t0524-evidence/ctrl-v-image.png`、`ctrl-v-text.png`、`debug-20261014-135447.log`（gitignored） |
| 修正前對照（根因用） | 記錄 | 同一支 e2e 對修正前的 source build 與安裝版 pre.7 執行檔都 PASS（見第 1 節） |
| mac 實機 | 未執行（AI 沒有 mac） | 交 Gary，步驟見下 |

**建置環境備註**：驗證中途，T0525 的 `electron/pty-manager.ts` 半成品（未 commit）被一起 build 進去，隔離實例的 PTY 因此沒有輸出。所以最後一輪 build / typecheck / test:unit / e2e 是在暫時的 `git worktree`（`--detach HEAD` = `076e3ef`，只複製本單 4 個檔案，`node_modules` 用 junction）裡跑的，跑完先拆掉 junction 再 `git worktree remove`。之後 T0525 已 commit（`d4ee455`）。

#### 給 Gary 的 mac 實機驗收步驟（含 T0522）

1. 用 Command+Shift+Control+4 截圖（進剪貼簿），在 BAT 終端分頁啟動 `claude`，按 **Ctrl+V** → 輸入框出現 `[Image #1]`；再截一張改按 **Command+V** → 出現 `[Image #2]`
2. Finder 拷貝一張 `.png` 檔，在 claude 輸入框按 Command+V → 應該出現**檔案路徑**（`'/Users/…/pic.png'`），不是 `[Image]`、也不是檔案圖示；Finder 拷貝 `My Report.pdf` 到一般終端分頁按 Command+V / Ctrl+V / 右鍵 → Paste → 都是有引號的完整路徑，不會自動 Enter
3. 從 LINE 複製一段文字，在終端按 Command+V 與 Ctrl+V → 各只貼一次、內容不變；選取終端文字後按 Command+C → 可以貼到其他 App
4. 在 Claude 面板輸入框做 T0522 第 4 步（Finder 拷貝 `.txt` + `.png` → 附件與縮圖；截圖 → 截圖縮圖）
5. 若有任何一步不對，到 `~/Library/Application Support/BetterAgentTerminal/Logs/` 最新的 `debug-*.log` 搜尋 `[terminal-paste]` 回報（會記錄 `Ctrl+V → image|paths|text`）

### 4. 偏離 / 風險 / 後續

- 偏離：T0522 的兩個測試改寫為新行為：「Windows Ctrl+V 不查詢檔案路徑」與「Linux Ctrl+V 只讀文字、不查路徑」。新設計三平台共用同一套決策，Windows / Linux 會多一次 `readFilePaths` IPC（main 不讀剪貼簿，直接回 `[]`）與一次 `readImageDataUrl`。工單要求「三平台統一的貼上決策」，所以這是預期中的改變。新測試改斷言「不呼叫 Async Clipboard」「純文字時不送鍵」
- 風險：① Windows 回歸的根因在本機沒重現（見第 1 節），修正等於加固加 log；使用者實機若仍失敗，可以從 `[terminal-paste]` log 定位。② 剪貼簿同時有圖與文字時送貼圖鍵（與既有 Windows 行為相同，Ctrl+Shift+V 可貼文字）。③ mac 的 `\x16` 路徑沒有實機驗證
- 後續建議（不阻擋）：Windows 檔案總管拷貝 → 路徑（需要 `CF_HDROP` 清單讀取，可另開單）；改用只回 boolean 的 `clipboard:has-image` IPC，省掉 PNG 編碼（可另開單）
- 沒有新 BUG

### 5. 異動檔案

- 新增：`e2e/t0524-terminal-image-paste.spec.ts`
- 修改：`src/lib/terminal-paste.ts`、`src/components/TerminalPanel.tsx`、`src/__tests__/terminal-paste-shortcuts.test.tsx`、`_ct-workorders/BUG-130-terminal-image-paste-regression.md`（FIXED / `fixed_at` / 狀態列 / 根因與修正）、本工單
- 沒有動：`electron/**`（`main.ts` / `preload.ts` / `src/types/electron.d.ts` 都沒改）、`src/styles/settings.css`（不是本單的變更，不 commit）

### 6. Commit

- `7ac0d0a` fix(terminal): image paste sends the claude CLI key on every platform（`git commit --only` 本單 6 檔；未 push）。本 closeout（status DONE / completed_at）另 commit
