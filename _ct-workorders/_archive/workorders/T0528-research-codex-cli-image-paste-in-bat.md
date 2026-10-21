---
schema_version: 1
schema_kind: workorder
id: T0528
title: "研究：BAT 終端分頁裡的 Codex CLI 能否貼圖 / 貼檔案（pre.8 的貼圖轉送鍵是 claude CLI 的 Alt+V（Windows），Codex 提示是 Ctrl+V）"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-130
priority: P2
sizing: S
created_at: "2026-10-14T17:22:38+0800"
started_at: "2026-10-14T17:23:26+0800"
updated_at: "2026-10-14T17:50:48+0800"
completed_at: "2026-10-14T17:34:46+0800"
related:
  - BUG-130
  - BUG-128
  - "T0524（終端貼上統一規則：檔案 → 路徑、圖片 → 送 CLI 貼圖鍵、文字 → 一般貼上）"
affects_files:
  - _ct-workorders/T0528-research-codex-cli-image-paste-in-bat.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只讀不改產品程式碼**：本單是實測 + 建議；需要修正時在回報區給方案，由塔台另開實作單。"
  - "🔴 **剪貼簿是使用者共用的**：實測要寫入系統剪貼簿時，先存下原內容、測完還原，且整段測試盡量短；不要在使用者的 BAT（port 9876）分頁裡測，一律用隔離實例（e2e 隔離 runtime）或 BAT 外的獨立終端。"
  - "🔴 **不得送出任何 prompt 給 Codex / Claude**（只觀察 composer 是否出現附件 `[Image #1]` 之類，然後 Ctrl+C / Esc 離開），不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 時間戳一律取自系統（R-G001）。"
---

# T0528 — 研究：BAT 裡的 Codex CLI 貼圖 / 貼檔案

## 研究目標

使用者想知道 Codex CLI 是否也支援貼上圖片或檔案連結，並特別要確認**在 BAT 終端分頁裡**是否可用。

塔台初查（本機 `codex-cli 0.162.1`，`<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` 字串）：
- Codex TUI 內建貼圖：`Paste an image with \`Ctrl+V\` to attach it to your next message.`、keymap `fixed.paste_image`、`tui\src\clipboard_paste.rs`、`clipboard image opened from file` / `from image`（剪貼簿是圖片檔也可）、`paste_image_as_png`
- 檔案引用：keymap `fixed.file_paths`、說明「Mention files」（composer 以 `@` 搜尋檔案路徑）
- 啟動參數：`codex -i, --image <FILE>...`（附在第一個 prompt）

**落差**：T0524（pre.8）的終端貼上規則在剪貼簿是圖片時，**送 claude CLI 的貼圖鍵：Windows 為 Alt+V，macOS / Linux 為 Ctrl+V**。Codex 的提示是 Ctrl+V。第三方資料提到 Codex 在原生 Windows 加過 Alt+V 偵測，但未在官方文件確認。⇒ 在 Windows 的 BAT 分頁跑 Codex 時，pre.8 送出的 Alt+V 可能不會觸發 Codex 貼圖。

## 調查範圍

1. **Windows 實測**（本機）：在**隔離的 BAT 實例**（或 BAT 外的獨立終端作為對照）啟動 `codex`，剪貼簿放一張 PNG：
   - (a) 直接按 Ctrl+V（BAT 外的對照組，以及 BAT 內若可繞過 T0524 的轉送）
   - (b) BAT 內依 T0524 規則按 Ctrl+V（實際送給 PTY 的是 Alt+V）
   - (c) 直接送 Alt+V
   - (d) 檔案總管「複製」一個 PNG 檔後在 BAT 內 Ctrl+V（T0524：檔案 → 貼路徑；Codex 收到路徑後是否會當附件？）
   - (e) 非圖片檔（例如 `.md`）複製後貼上 → 路徑；以及 composer 內 `@` 檔案搜尋是否可用
   - 每種情況記錄：composer 是否出現圖片附件、或只出現文字 / 路徑、或沒反應
2. **讀 T0524 的實作**（只讀）：貼圖轉送鍵是否依分頁的 agent preset 或前景程式區分？Codex CLI preset 分頁與一般分頁裡手動執行 `codex` 各自走哪條路？
3. **mac / Linux**：無法實測；依程式碼與 Codex 的 Ctrl+V 提示推論 pre.8 在 mac / Linux 是否可用（T0524 在 mac / Linux 送 Ctrl+V，理論上與 Codex 一致），標明為推論
4. **Codex 面板**（BAT 內建的 Codex Agent 面板，非終端）：附件 / 貼圖是否已支援（BUG-128 修正提到 Claude / Codex 面板可用 Command+V 加附件），只需依程式碼確認

## 研究指引

- 判斷 Codex 的貼圖鍵時，以實測為準；`codex` 的 keymap 可能可透過設定（`/keymap` 或 config）查看預設綁定，能查到就附上
- 若 (b) 失效：給方案，例如 [A] 依前景程式 / agent preset 選貼圖鍵（claude → Alt+V、codex → Ctrl+V）、[B] Windows 一律送 Ctrl+V 並確認 claude CLI 在 Windows 也接受、[C] 讓使用者在 Settings 選；評估各自對 claude CLI（BUG-130）的回歸風險
- 若 (b) 可用：寫明證據，塔台可直接回覆使用者

## 互動規則

- 本單以 `--no-interactive` 派發：不向使用者提問。需要真人操作才能判定的項目（例如必須實體按鍵且無法自動化），列為 NEEDS-HUMAN 並寫出 2 分鐘內可完成的手動步驟

## Sub-session 執行指示

1. 讀本工單、T0524、BUG-130
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實測 / 調查 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**：(b) **可以用**。Windows 上 pre.8 的 BAT 終端分頁裡，Codex CLI 0.162.1 收到 Ctrl+V 後送出的 Alt+V（`ESC v`）會貼圖，composer 出現 `[Image #1]`。已在隔離的 BAT 實例中端到端驗證，不需要改產品程式碼。塔台可以直接回覆使用者。

- Landing Zone Check：**PASS**。C-0 frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3 不適用（`affects_files` 只有本工單）。C-2 沒有 `branch` 欄位（HEAD = `main`）
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 受測 Codex：`<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`，`codex-cli 0.162.1`

**給使用者的一句話**：可以。在 Windows 的 BAT 終端分頁跑 `codex`，截圖後按 Ctrl+V 就會貼成附件（`[Image #1]`）。BAT 實際送的是 Alt+V，Codex 0.162.1 的 Ctrl+V 和 Alt+V 都能貼圖。也可以用 `@` 搜尋檔案，或貼上圖片檔的路徑。檔案總管「複製」檔案後按 Ctrl+V，Windows 版目前不會貼任何東西（T0524 已知未做，見建議 [1]）。

### 實測結果（Windows）

測試方式分兩層，都**沒有**在使用者 port 9876 的 BAT 裡測：

- **L1 ConPTY 直測**：BAT 外的 node 腳本，用 BAT 同一套 `@lydell/node-pty`（ConPTY）啟動 `codex.exe --no-alt-screen`，cwd 是已信任的 `C:\temp`。直接寫入 BAT 會送的位元組，再從輸出判斷 composer 的狀態
- **L2 隔離 BAT 端到端**：scratch e2e 放在 scratchpad，沒有放進 repo，透過 `e2e/fixtures/electron-isolation` 的 `launchIsolated` 啟動，使用隔離 runtime `e2e-t0528-codex-*` 和獨立埠。用的是 source build（`dist/` 17:15 建置，含 T0524 的 `[terminal-paste]` 程式碼）。在終端分頁先用 node raw-mode hex 回顯看 BAT 寫進 PTY 的位元組，再在同一個分頁跑 codex，以 Playwright 在 xterm 上按 `Control+v`

| 情況 | 結果 | 證據 |
|---|---|---|
| (a) Ctrl+V（`^V` = `16`）直送 Codex，剪貼簿是 PNG 圖片 | ✅ 出現 `[Image #1]` 附件 | L1：輸出有 `[Image #1]`。Codex log（`~/.codex/logs_2.sqlite`，pid 37080）依序記錄 `paste_image_as_png: attempting clipboard image read` → `clipboard image opened from image: 64x48` → `pasted image size=64x48 format=PNG` → `attach_image path="…\codex-clipboard-g8DOvk.png"` |
| (b) **BAT 內依 T0524 規則按 Ctrl+V**（BAT 實送 Alt+V） | ✅ **出現 `[Image #1]` 附件** | L2：hex 回顯 `Ctrl+V with image → PTY bytes ["1b76"]`。同一個分頁啟動 Codex 0.162.1 後按 Ctrl+V，結果是 `attached=true`、`tail=" [Image #1] "`。BAT debug log 有 `[terminal-paste] Ctrl+V → image terminal=e2e-t0528-term`。截圖 `scratchpad/t0528/bat-codex-ctrl-v.png`：composer 為 `› [Image #1]`，狀態列 `Ready`。Playwright `1 passed (28.1s)` |
| (c) Alt+V（`ESC v` = `1b76`）直送 Codex | ✅ 出現 `[Image #1]` 附件 | L1：輸出有 `[Image #1]`。Codex log（pid 40504）的鏈與 (a) 相同，最後一步是 `attach_image` |
| (d) 檔案總管「複製」PNG 檔（`SetFileDropList`）後在 BAT 按 Ctrl+V | ⚠️ **BAT 什麼都沒送** | L2：main `availableFormats()` = `["text/uri-list"]`，`readImage().isEmpty()` = true，`readText()` = `""`，PTY bytes `[]`。BAT debug log `Ctrl+V → text`（空文字）。原因：`readFilePaths` 只有 darwin 會讀（T0522），Windows 只能退到文字。T0524 回報區已記為「Windows 檔案總管拷貝 → 路徑：沒有做」 |
| (d') 同一個檔案剪貼簿，直送 `^V` / `ESC v` 給 Codex | ✅ `[Image #1]`（Codex 自己會從檔案清單讀圖） | L1：Codex log `clipboard image opened from file: 64x48` → `attach_image`（pid 36096 / 37272）。BAT 在這個情境不會送鍵，所以實際用不到，只當參考 |
| (d'') 把 PNG 的**路徑**當文字送進 Codex（加引號，或 bracketed paste） | ✅ `[Image #1]`（Codex 認得圖片路徑，自動轉成附件） | L1：`"C:\…\t0528-sample.png"` 和 `ESC[200~…png ESC[201~` 兩種都變成 `[Image #1]`。⇒ BAT 如果在 Windows 把檔案總管複製的檔案貼成路徑，Codex 就能用 |
| (e) 檔案總管複製 `.md` 後在 BAT 按 Ctrl+V | ⚠️ BAT 什麼都沒送（與 (d) 同一個原因） | L2：PTY bytes `[]`，formats `["text/uri-list"]` |
| (e') `.md` 路徑當文字送進 Codex | ✅ 照字面插入成文字（不會變附件） | L1：composer 顯示 `› "C:\…\t0528-note.md"` |
| (e'') composer 內打 `@` | ✅ 跳出 mention 選單（Plugins / 檔案篩選，`←/→ filter`、`enter/tab insert`） | L1：輸出有 `Type to search mentions`、`enter/tab insert · esc close · ↑/↓ select · ←/→ filter` |

**沒有送出任何 prompt、沒有消耗 token**：所有測試行程的 Codex log 只有 `model/list`、`hooks/list`、`command/exec`、`skills/list`、`thread/start` 這幾種 rpc，**完全沒有 `turn/start`**。每次都先 Esc 加 Backspace 清空草稿，再用 Ctrl+C 離開（前兩個案例除外，見「遭遇問題」）。

**Codex 的 keymap**：`paste_image` 屬於 `fixed.*` 綁定（`fixed.paste_image`，和 `fixed.quit`、`fixed.file_paths` 同類），二進位裡沒有 `tui.keymap.*.paste_image` 這類可設定的 key，所以應該不能用 `/keymap` 改，也就無法從設定查到預設鍵。官方提示只寫 `Ctrl+V`，但實測 0.162.1 在 Windows ConPTY 裡 Ctrl+V 和 Alt+V **都會**觸發同一條 `paste_image_as_png`。這是實測結果，沒有官方文件佐證。

### T0524 轉送路徑（程式碼）

- `src/components/TerminalPanel.tsx:197` `pasteClipboard(source)` → `readTerminalClipboard()`（`src/lib/terminal-paste.ts:86`），優先序 paths → image → text。圖片 → `pty.write(imagePasteKey(window.electronAPI.platform))`
- `imagePasteKey`（`src/lib/terminal-paste.ts:42`）**只看平台**：`win32` 送 `\x1bv`，其他平台送 `\x16`。**不看 agent preset，也不看前景程式**，`TerminalPanel.tsx` 沒有任何 `agentPreset` 參照
- ⇒ `codex-cli` preset 分頁（`src/types/agent-presets.ts:75`）、一般分頁手動執行 `codex`、claude CLI 分頁，三者走**同一條路**，送的位元組也相同。三個入口（Ctrl+V、mac Command+V、右鍵 Paste）都一樣
- Windows 的 `readFilePaths` 一律回 `[]`（main 端只有 darwin 會讀），這就是 (d)/(e) 什麼都沒貼的原因

### mac / Linux 推論

（**推論，沒有實測**）T0524 在 mac / Linux 有圖片時送 `\x16`（Ctrl+V），和 Codex 官方提示的 `Ctrl+V` 一致。L1 也證實 Codex 收到 `^V` 會走 `paste_image_as_png`（Windows 上測的，但 crossterm 對 `^V` 的解碼與平台無關）。Codex 在 mac / Linux 讀剪貼簿用的是 arboard，和 Windows 同一套庫（`clipboard_paste.rs`）。所以 pre.8 在 mac / Linux 的 BAT 終端裡，Ctrl+V 和 mac Command+V 應該都能讓 Codex 貼圖。另外，mac Finder 複製的檔案會貼成路徑（T0522），依 (d'') 的結果，Codex 會把圖片路徑轉成附件，其他檔案則是文字路徑。SSH / Docker 遠端的 Codex 讀不到本機剪貼簿，這是 T0524 已記錄的同一個限制。

### Codex 面板

（依程式碼確認，沒有實測）**已支援貼圖與附件**：

- `src/components/CodexAgentPanel.tsx:2356` `handlePaste`（輸入框 `onPaste`，`:3762`）：剪貼簿項目有 `image/*` 時，透過 main 的 `clipboard.readImageDataUrl()` 讀圖，再 `addImage`（上限 `MAX_IMAGES = 5`）。mac 上 Finder 複製的檔案會當成附件（T0522 / BUG-128 的 `pastedDiskFiles`）。也支援拖放，以及附件按鈕（`dialog.selectAttachments`）
- 後端 `electron/codex-agent-manager.ts:1007-1047`：data URL 的圖片先寫成 temp 檔（`bat-codex-images`），再以 `{ type: 'local_image', path }` 交給 Codex SDK
- 缺口和終端一樣：Windows 檔案總管複製的檔案，`pastedDiskFiles` 只在 darwin 判斷

### 建議方向

1. **不需要改貼圖鍵**：(b) 可以用。這次沒有測出要改的地方，所以 [A] 依前景程式 / preset 選鍵、[B] Windows 一律送 Ctrl+V、[C] 在 Settings 讓使用者選，**都不建議**。改 [B] 要再確認 claude CLI 在 Windows 是否接受 `^V`，2.1.296 原始碼 `windows` 只綁 `alt+v`（T0524），會冒 BUG-130 回歸的風險，換不到任何好處
2. **[1] 可選後續（低優先）**：Windows 檔案總管複製的檔案貼成路徑，就是 T0524 已列的後續項。main 用 PowerShell `Get-Clipboard -Format FileDropList`（`execFile` + timeout）或讀 `CF_HDROP` 取得清單，交給既有的 `insertFilePaths()`。依 (d'')，Codex 會把圖片路徑自動轉成附件；claude CLI 也接受路徑文字。Codex 面板 / Claude 面板的 `pastedDiskFiles` 可以同一張單一起補上 Windows
3. 殘餘風險：Codex 的 Alt+V 在官方文件沒有記載，未來版本可能拿掉。真的發生時，BAT 會照樣記 `[terminal-paste] Ctrl+V → image`，Codex 那邊就不會出現 `[Image #N]`，從 log 可以馬上判斷出來，屆時再評估 [A]

### NEEDS-HUMAN 手動步驟（若有）

沒有必要的手動步驟。實體鍵盤的 Ctrl+V 和 Playwright `keyboard.press` 走的是同一個 xterm keydown handler。想自己確認的話可以這樣做（2 分鐘）：Win+Shift+S 截圖 → 在 BAT 終端分頁執行 `codex` → 按 Ctrl+V → composer 出現 `[Image #1]` → 按 Esc 和 Backspace 清掉草稿，再按 Ctrl+C 兩次離開（不要按 Enter）。

### 遭遇問題

- **對使用者資料的副作用（已揭露，已依使用者要求清除）**：前兩個 L1 案例（17:25:32 / 17:25:47）結束時，直接用 Ctrl+C 清掉含 `[Image #1]` 的草稿。Codex 會把被清掉的草稿寫進 `~/.codex/history.jsonl`，所以多了 2 筆 `"[Image #1]"`（10 字元）的紀錄。這兩筆**不是送出的 prompt**，Codex log 沒有 `turn/start`。因為那是使用者的檔案，我沒有刪除。之後的案例都先清空草稿再離開，沒有再新增紀錄。**2026-10-14T17:50:48+0800 使用者要求刪除**：已以 `ts` + `session_id` 精確比對，只移除這 2 行（4662 → 4660 行），使用者自己其他日期的 `[Image #1]` 紀錄不動；刪除前的備份在 session scratchpad `t0528/history.jsonl.bak`
- 隔離 BAT 的 PowerShell 裡，`codex` 先解析到 npm 全域的 `codex` 0.160.0（`%APPDATA%\npm\codex.ps1`）。目前 session 是**以系統管理員權限執行**，它報錯 `start the Windows daemon from a non-elevated terminal …`，所以 L2 改用 0.162.1 的完整路徑。這個錯誤和貼圖無關（`electron/windows-elevation.ts` 已處理 `codex-cli` preset 在權限提升時的情況），只記錄
- `AttachConsole failed`（`conpty_console_list_agent.js`）是 node-pty 在 kill 時的既有雜訊，不影響結果
- 剪貼簿：測前備份原本的文字（9 字元，`UnicodeText`），測完還原，確認 `textLen=9`、formats `UnicodeText,System.String,Text`。隔離實例已收掉：Terminal Server `alive after teardown: false`，`runtime userData removed: true`。scratch 裡的 `node_modules` junction 已先拆除（repo `node_modules` 完好）
- 產品程式碼：**沒有任何修改**。scratch harness / spec 都在 session scratchpad，沒有進 repo

### 異動檔案 / Commit

- 只改了本工單（`_ct-workorders/T0528-research-codex-cli-image-paste-in-bat.md`）。用 `git commit --only` 提交，沒有 push。`src/styles/settings.css` 不是這張單的變更，沒有 commit
