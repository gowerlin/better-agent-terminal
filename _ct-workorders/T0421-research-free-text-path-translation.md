---
schema_version: 1
schema_kind: workorder
id: T0421
title: "研究：遠端視窗自由文字中的 client 路徑（拖放檔案、prompt 內路徑、貼上、comment body 等）—— 盤點出現點、轉換策略、拆單"
type: research
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: M
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:39:27+08:00"
updated_at: "2026-10-05T05:48:59+08:00"
completed_at: "2026-10-05T05:48:59+08:00"
target_version: next
depends_on: []
related:
  - "BUG-105 / T0416 回報區「遺留：自由文字中的路徑（另案）」"
  - "T0416 盤點表（`PATH_ARG_SCHEMA` / `PATH_FREE_CHANNELS`；`github:*-comment` body 刻意不轉）"
  - "D134（本 session 排程表第 5 列）"
affects_files:
  - _ct-workorders/T0421-research-free-text-path-translation.md
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。"
  - "🔴 不部署、不改 WSL。可在本機以 vitest 片段或 node REPL 驗證 `PathTranslator` 行為，但不得留下產品檔案改動。"
  - "🔴 同工作樹有其他 Worker 平行在改 `electron/` / `src/`：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0421 — 研究：自由文字中的 client 路徑

## 背景

T0416 讓 108 個 proxied channel 的**結構化**路徑參數全部依 schema 轉換（WSL：`\\wsl.localhost\<distro>\…` ↔ `/…`、`C:\…` ↔ `/mnt/c/…`；SSH：home 對應）。但遠端視窗中仍有路徑以**自由文字**形式流向遠端，translator 不會碰：

- 推測場景：拖放檔案到終端 / Claude 面板（插入的是本機 `C:\…` 路徑）、Claude 面板附件 / 圖片路徑、使用者在 prompt 裡貼路徑、`pty:write` 的輸入、`github:*-comment` body、snippet 內容、檔案樹「複製路徑」、「在終端開啟」等

## 研究目標

1. **盤點**：遠端視窗中所有「本機路徑以文字形式產生並送往遠端」的出現點（附 `檔案:行`）；區分 (a) BAT 自己產生的路徑文字（拖放、複製路徑、附件）與 (b) 使用者手打的文字
2. **每個出現點的正確行為**：轉成 server 形式 / 不轉 / 不可轉（例如 `C:\` 下但不在 `/mnt/c` 掛載的路徑、SSH 非 home 路徑）時的 UX（提示、拒絕、上傳？）
3. **策略比較**：在產生點轉（renderer 已知是遠端視窗 + 有 translator）vs 在 channel 層掃描文字（風險：誤轉一般文字）vs 混合；明確建議**不**對使用者手打文字做自動改寫，除非有充分理由
4. **與檔案傳輸的邊界**：拖放本機檔案到遠端 Claude 面板時，是否需要把檔案內容傳到遠端（例如圖片附件走 data URL 已無路徑問題？）——只盤點與建議，不設計傳輸協定
5. **拆單建議**（D 區段表格）

## 互動規則

- 允許向使用者提問（`CT_INTERACTIVE=1` 時），最多 3 題，選項式（例如：拖放本機但遠端不可達的檔案時要提示還是上傳）
- 不互動時：給推薦 + 理由

## 回報要求

回報區須含：
- 盤點表（出現點 / 來源 / 目前行為 / 建議行為 / 理由）
- 策略比較與推薦
- `### 拆單建議摘要` 段落，第一個表格欄位必須為 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`（標題欄先用「工單 1」等占位，塔台會補 T####）

## Sub-session 執行指示
1. 讀本工單 + BUG-105 + T0416 回報區 + `electron/remote/path-aware-channels.ts` / `path-translator.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T05:39:27+08:00，Worker，`CT_MODE=yolo`、`CT_INTERACTIVE=1`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 不適用（`affects_files` 只有本工單）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 研究單：未改任何產品檔；未用 stash / reset / checkout / restore；未部署；未 push。驗證腳本只放在 scratchpad（`t0421-probe.ts`，以 `npx tsx` 執行）

### 互動紀錄

| # | 問題 | 回答 |
|---|------|------|
| Q1 | SSH 遠端視窗把本機檔案拖放 / 附加到 Claude 面板（遠端通常沒有這個檔案；`SshPathTranslator` 只對應 home 前綴，不保證是同一檔案）時怎麼處理？ | **拒絕並提示**（toast「此檔案不在遠端主機上」，不插入路徑；上傳另開 PLAN。WSL / Docker 掛載內的路徑照常轉 server 形式） |
| Q2 | 遠端視窗的「複製路徑」（檔案樹 / Sidebar / Markdown 預覽）目前複製 client 形式，怎麼處理？ | **新增「複製遠端路徑」**（保留原本複製 client 形式，遠端視窗多一個選單項複製 server 形式） |

### 調查結論

#### 0. 先決發現：拖放目前在**所有視窗**都拿不到路徑（Electron 41）

Electron 32 起移除了 DOM `File` 的非標準 `path` 屬性，改用 `webUtils.getPathForFile(file)`（`node_modules/electron/electron.d.ts:19049` 註解：「This method superseded the previous augmentation to the `File` object with the `path` property」；該 d.ts 已無 `File` 擴充）。本專案為 Electron `41.2.1`：

| 位置 | 寫法 | 結果 |
|------|------|------|
| `src/components/ClaudeAgentPanel.tsx:2156` | `(file as File & { path?: string }).path` | 恆為 `undefined` → `continue`，**拖放靜默無效** |
| `src/components/Sidebar.tsx:373` | `(file as any).path` | 同上，拖資料夾新增工作區無效 |
| `src/components/CodexAgentPanel.tsx:2392` | `window.electronAPI.shell.getPathForFile(file)` | preload 的 `shell`（`electron/preload.ts:118-122`）**沒有這個方法** → 執行期 `TypeError`；也是 tsc 基線 40 錯中的一筆（`CodexAgentPanel.tsx(2392,49): error TS2339`） |

⇒「拖放檔案到 Claude 面板插入 `C:\…`」這個 T0416 推測場景**目前根本不會發生**；但修好拖放（工單 1）後就會立刻在遠端視窗出現路徑問題，所以工單 1 與工單 3 應一起規劃。（程式碼 + 型別證據，未實機。）

#### 1. 盤點表

方向：本機（client）產生的路徑文字 → 遠端。(a) = BAT 產生的路徑文字；(b) = 使用者手打 / 使用者內容。

| # | 出現點（檔案:行） | 來源 | 目前行為（遠端視窗） | 建議行為 | 理由 |
|---|---|---|---|---|---|
| 1 | Claude 面板拖放非圖片檔 → `addFileByPath` → 送出時 `@<path>` 前綴（`ClaudeAgentPanel.tsx:2152-2165`、`:2118-2125`、`:1475-1493`） | (a) | 拖放失效（§0）；修好後 `@C:\…` / `@\\wsl.localhost\…` 原樣進 `claude:send-message` prompt（`PATH_FREE_CHANNELS` 理由「prompt text」），遠端 agent 讀不到 | **產生點轉換**：WSL / Docker 可達 → `@/mnt/c/…`、`@/home/…`；不可達（SSH 全部、WSL 其他 distro / 網路分享 UNC、Docker 掛載外）→ **拒絕 + toast**（Q1） | 路徑在變成文字前是結構化值，renderer 知道它是路徑，零誤轉風險 |
| 2 | Claude 面板「附加檔案」按鈕 `dialog:select-files`（`ClaudeAgentPanel.tsx:2167-2179` → `electron/main.ts:2372-2379`，本機對話框、預設本機 home） | (a) | 同 #1：client 路徑進 `@` 前綴 | 同 #1 | 同 #1。另：本機對話框只能選本機檔，遠端視窗的「附加遠端檔案」應另走 Ctrl+P 檔案挑選器（見 #8）—— 不在本單範圍 |
| 3 | Claude 面板拖放 / 附加**圖片** → `addImageByPath` → `image:read-as-data-url`（`ClaudeAgentPanel.tsx:2097-2116`） | (a) | `image:read-as-data-url` 是 proxied + `first-string` → 本機圖片路徑被 `toServer` 後在**遠端**讀；遠端沙箱 `isPathAllowed`（synced roots，`electron/handlers/fs.ts:54,150`）擋掉工作區外的路徑 → 失敗（`console.error`，靜默）。SSH 下甚至會把 `C:\Users\u\Pictures\a.png` 映射成 `/home/u/Pictures/a.png` 讀到**別的檔案或不存在** | **改為 client 端讀取，不經路徑**：拖放用 renderer 手上的 `File` 物件直接 `FileReader.readAsDataURL`；對話框選的圖由 main 本機讀並回 data URL。送出仍是 data URL（`claude:send-message` 已支援） | 圖片附件的內容在 client 磁碟上，轉路徑本來就是錯的方向；data URL 已解決傳輸，**不需要路徑轉換也不需要檔案傳輸協定** |
| 4 | Claude 面板貼上圖片 → `clipboard:saveImage` 存 `os.tmpdir()/bat-clipboard-*.png`（`electron/main.ts:2442-2448`）→ #3 的 `addImageByPath`（`ClaudeAgentPanel.tsx:2127-2140`） | (a) | 遠端：同 #3（暫存檔不在 synced roots → 拒）。**本機也壞**：`os.tmpdir()` 不在 window registry 的工作區白名單（`electron/path-guard.ts:68-76`），`image:read-as-data-url` 一樣 `Path access denied` | `clipboard:saveImage` 改為（或新增）直接回 `clipboard.readImage().toDataURL()`，不落暫存檔 | 同 #3；且順帶修本機（程式碼推論，未實機，工單 2 第一步先重現） |
| 5 | 終端（xterm）拖放檔案 | (a) | 終端沒有 drop handler（全 repo `onDrop` 只在 Claude / Codex 面板、Sidebar、ThumbnailBar、Settings）。推測 Chromium 預設把檔案當導覽 → `will-navigate`（`electron/main.ts:1022-1028`）→ `shell.openExternal(file://…)`，在本機開檔（**未實測**） | 低優先：加 drop handler，插入**依 shell family 加引號**的 server 形式路徑（不加 `\r`）；不可達 → toast。至少 `preventDefault` 避免意外開檔 | 一般終端使用者期待（VS Code / Windows Terminal 皆如此）；同 #1 屬產生點 |
| 6 | 檔案樹「複製絕對路徑」/「複製相對路徑」（`src/components/FileTree.tsx:320-330`） | (a) | 絕對路徑為 client 形式（`fs:readdir` 結果已 `toClient`，`path-aware-channels.ts` `normalizePathsInResult`）；相對路徑兩邊通用 | **保留現狀 + 遠端視窗新增「複製遠端路徑」**（Q2） | 剪貼簿目的地不明（可能貼到本機 Explorer / 編輯器，也可能貼到遠端終端），由使用者選；相對路徑不需處理 |
| 7 | Sidebar 工作區「複製路徑」（`src/components/Sidebar.tsx:584`）、Markdown 預覽「複製路徑」（`src/components/MarkdownPreviewPanel.tsx:69`）、檔案預覽 modal 複製（`src/components/PathLinker.tsx:225`） | (a) | 同 #6（PathLinker 的路徑可能是 agent 輸出的 server 形式，也可能是 Ctrl+P 的 client 形式 → 混合） | 同 #6（Q2）。PathLinker 那個：`toServer` 對 server 形式為 no-op，「複製遠端路徑」對兩種輸入都正確 | 同 #6 |
| 8 | Claude 面板 Ctrl+P 檔案挑選器（`ClaudeAgentPanel.tsx:1170`，`fs:search` 結果） | (a) | 只開預覽（`:3283-3330` → `FilePreviewModal`），**不插入 prompt** | 不動 | 目前無路徑文字流向遠端 |
| 9 | Claude 面板合併 worktree prompt（`ClaudeAgentPanel.tsx:3367`） | (a) | `worktreeInfo.gitRoot` / `worktreePath` 是 server 形式（T0416 `SERVER_PATH_RESULT_CHANNELS` 刻意保留） | 不動 | 已正確 |
| 10 | Claude 面板 `/snippet` 情境 prompt（`ClaudeAgentPanel.tsx:1431,1437`） | (a) | 寫死 `~/Library/Application Support/better-agent-terminal/snippets.json`（macOS 路徑），任何平台都不對；T0422 起 snippet 是 ALWAYS_LOCAL，遠端 agent 本來就讀不到本機 snippets.json | 本單不處理，見「遭遇問題」1 | 不是轉換問題，是內容錯誤 + 設計前提改變 |
| 11 | GitHub 面板「送給 Claude」（`src/components/GitHubPanel.tsx:181-210`） | (a) | 檔案為 repo 相對路徑（`pr.files[].path`） | 不動 | 兩邊通用 |
| 12 | terminal agent 啟動命令 `agent:build-launch-command`（`WorkspaceView.tsx:832-838` → `electron/main.ts:3177-3183`，**不代理**，用本機 registry / 本機設定） | (a) | 自訂 CLI（`customCli.command`）若是本機絕對路徑（如 `C:\tools\x.exe`）會被打進遠端終端 | 本單不處理，記為已知限制（遭遇問題 2） | 屬「agent registry 未代理」問題，不是自由文字轉換；內建 agent 用裸命令名，不受影響 |
| 13 | claude-cli 分頁啟動命令（`WorkspaceView.tsx:697-718`） | (a) | `cliPath` 來自 `claude:get-cli-path`（server 形式，T0416 刻意不轉）；`customArgs` 為使用者設定 | 不動 | 已正確；customArgs 屬 (b) |
| 14 | 終端 Ctrl+V 貼圖 → 送 `\x1bv`（Alt+V）給 CLI（`src/components/TerminalPanel.tsx:479-502`、`src/components/PromptBox.tsx:171-182`） | (a) 觸發 / 內容在剪貼簿 | 遠端 claude CLI 讀的是**遠端主機**的剪貼簿，不是 client 的（SSH 必定讀不到；WSL 視 CLI 是否走 Windows interop，**未實測**） | 本單只盤點：屬「檔案傳輸邊界」，建議併入檔案上傳 PLAN 評估 | 沒有路徑文字，是內容傳輸問題 |
| 15 | 終端鍵入 / 貼上文字（`TerminalPanel.tsx:120-147,396`）、語音輸入（`MainPanel.tsx:60-63`）、PromptBox（`PromptBox.tsx:171`） | (b) | 原樣 `pty:write` | **不改寫** | 使用者手打 / 貼上的文字意圖不明（可能就是要 Windows 路徑，例如 `cmd.exe /c` 或 `wslpath` 參數）；pty 是 byte stream，路徑可能跨 chunk，bracketed paste 也會被破壞 |
| 16 | Claude prompt 手打 / 貼上的路徑（`ClaudeAgentPanel.tsx:1314` `handleSend`） | (b) | 原樣 | **不改寫**；可選：送出前偵測 `^[A-Za-z]:\\` / `\\wsl…` 樣式時顯示一行**非阻斷提示**（不改內容） | 見策略比較 |
| 17 | `github:pr-comment` / `issue-comment` body（T0416 刻意不轉） | (b) | 原樣 | **不改寫**（維持 T0416 決定） | comment 會公開到 GitHub，內容是給人看的，改寫等於竄改使用者言論 |
| 18 | snippet 內容貼到終端 / 送給 agent（`App.tsx:724-736`、`WorkspaceView.tsx:993-1004`） | (b) 使用者內容 | 原樣 | **不改寫** | 同 #15 |

反方向（server → client 的自由文字，例：agent 輸出的 `/home/x/f.ts` 經 `LinkedText` 點擊預覽，`PathLinker.tsx:387-397` → `fs:readFile` 的 `toServer` 對 server 形式是 no-op）目前可運作，不在本單範圍。

#### 2. 轉換可行性（`npx tsx` 實測 `WslPathTranslator('Ubuntu-24.04')` / `SshPathTranslator('C:\Users\gower','/home/gower',true)`）

| 輸入 | WSL `toServer` / `owns` | SSH `toServer` / `owns` |
|---|---|---|
| `C:\Users\gower\Pictures\a.png` | `/mnt/c/Users/gower/Pictures/a.png` / true | —（home 內）→ `/home/gower/Pictures/a.png` / true ⚠️ 遠端未必有此檔 |
| `D:\data\x.csv` | `/mnt/d/data/x.csv` / true | 原樣 / **false** |
| `\\wsl.localhost\Ubuntu-24.04\home\gower\repo\f.ts` | `/home/gower/repo/f.ts` / true | — |
| `\\wsl.localhost\Debian\home\gower\f.ts` | 原樣 / **false** | — |
| `\\fileserver\share\doc.pdf` | 原樣 / **false** | — |
| `C:\Users\gower\AppData\Local\Temp\bat-clipboard-1.png` | `/mnt/c/…/bat-clipboard-1.png` / true | `/home/gower/AppData/Local/Temp/…` / true ⚠️ 不存在 |
| `/home/gower/repo` | 原樣 / true（idempotent） | — |
| `C:\Program Files\x y\z.txt` | `/mnt/c/Program Files/x y/z.txt` / true（含空白，插入終端時需加引號） | — |
| `@C:\Users\gower\a.txt`、`see C:\Users\gower\a.txt please` | 原樣 / false（translator 只吃整串路徑） | — |

結論：
- `toServer` **不會報錯**，轉不了就原樣回傳 —— 產生點必須用 `owns()`（或新的可達性判斷）決定「轉 / 拒」，不能只呼叫 `toServer`。
- **SSH 的 `owns()` 對「本機檔案」沒有意義**：home 對應是工作區路徑的約定，不代表檔案存在於遠端。⇒ 依 Q1，SSH 視窗的本機檔案一律視為不可達。
- WSL 的 `/mnt/<drive>` 假設 automount 根目錄為 `/mnt`（`/etc/wsl.conf` 改過 `root=` 或關 automount 時會錯）—— 殘留風險，與 T0416 / T0393 同前提。
- translator 不提供「檔案存在」驗證；遠端 `fs:stat` 受 synced roots 沙箱限制，工作區外的路徑一律 deny，**無法用來探測**。⇒ 可達性只能靠規則判斷，不做遠端探測。

### 建議方向

#### 策略比較

| 策略 | 做法 | 優點 | 風險 / 成本 | 評價 |
|---|---|---|---|---|
| A. 產生點轉換 | 在 BAT 產生路徑文字的地方（附件 `@` 前綴、終端拖放、「複製遠端路徑」）先查詢 main 端 translator，得到 server 形式或「不可達」 | 輸入是結構化路徑，**零誤轉**；不可達時能給 UX（拒絕 + 提示）；本機視窗走 Identity，行為不變 | 每個產生點各接一次（目前 4 類）；需新 IPC 讓 renderer 取用 translator | ✅ **推薦** |
| B. channel 層掃描文字 | 在 `claude:send-message` / `pty:write` / `github:*-comment` 用 regex 找 `C:\…` / `\\wsl…` 改寫 | 一次涵蓋所有來源 | **誤轉一般文字**：程式碼範例、Windows 文件、regex、`cmd.exe /c` 參數、故意要給 `wslpath` 的字串、GitHub 留言內容；`pty:write` 是 byte stream，路徑可能跨 chunk、會破壞 bracketed paste；路徑邊界（空白、引號、標點）無法可靠判定；不可達時無法給 UX；改寫使用者言論 | ❌ 不採用 |
| C. 混合 | A + 對使用者手打文字做「偵測但不改寫」的提示 | A 的全部優點；手打路徑也有提醒 | 提示可能干擾（需可關閉）；不改內容所以無誤轉 | ⭕ 可選（A 之後再評估，列為工單 6 選做） |

**明確建議：不對使用者手打 / 貼上 / 使用者內容（prompt、終端輸入、comment body、snippet）做自動改寫。** 理由：(1) 意圖不可知，Windows 路徑可能就是要給遠端的 `wslpath` / `cmd.exe` / 文件內容；(2) regex 邊界判定不可靠；(3) GitHub comment 是公開言論；(4) 改錯比不改更難察覺。

#### 建議的機制（給工單 3 的設計方向，非定案）

- 新增 **ALWAYS_LOCAL** IPC（例：`remote:resolve-client-paths(paths: string[])`），main 用該視窗 `RemoteClient` 目前的 translator 回傳 `{ input, serverPath | null, reachable: boolean, reason? }[]`。本機視窗 → Identity，`reachable: true` 原樣。
- 可達性規則：
  - Identity：恆可達
  - WSL：`owns()` 為 true 才可達（其他 distro UNC、網路分享 UNC → 不可達）
  - Docker：在某個 mount 內（`ownsDockerPath`）才可達
  - SSH：本機檔案一律不可達（Q1）；但「複製遠端路徑」的輸入是 server 檔案的 client 形式（來自 `toClient`），可直接 `toServer` —— 所以 IPC 需區分用途（例：`purpose: 'local-file' | 'workspace-entry'`），或拆成兩個 API
- 只做規則判斷，不做遠端存在探測（遠端沙箱擋工作區外路徑，見 §2）
- 套用點：Claude 面板附件 `@` 前綴（送出前一次批次查詢；不可達者移除並 toast）、終端拖放（工單 5）、「複製遠端路徑」（工單 4）
- 為何不改 `claude:send-message` 簽章成結構化 `attachments` 參數：舊版 headless server 會忽略多出來的參數 → 附件**靜默遺失**；且終端拖放、複製路徑用不到它。renderer 端查詢 API 可共用於所有產生點

#### 與檔案傳輸的邊界（研究目標 4）

| 情境 | 需要傳內容？ | 建議 |
|---|---|---|
| 圖片附件（拖放 / 對話框 / 剪貼簿） | 已用 data URL 傳內容 | **不需要傳輸協定**；只要改成 client 端讀（工單 2），不要再走 proxied `image:read-as-data-url` |
| 非圖片附件，WSL / Docker 掛載內 | 不需要（同一檔案系統） | 轉 server 路徑（工單 3） |
| 非圖片附件，SSH / 掛載外 / 其他 distro | 需要 | 本期拒絕 + 提示（Q1）；若要支援，另開「檔案上傳到遠端暫存目錄」PLAN（新 channel、大小上限、暫存清理、路徑注入 prompt） |
| 終端 Alt+V 貼圖（遠端 claude CLI 讀遠端剪貼簿） | 需要 | 併入上述上傳 PLAN 評估；本期記為已知限制 |

### 拆單建議摘要

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|----|
| 1 | 工單 1：修復 Electron 41 拖放取不到路徑 —— preload 暴露 `webUtils.getPathForFile`（對齊 Codex 既有呼叫 `shell.getPathForFile`），改 `ClaudeAgentPanel.tsx:2156`、`Sidebar.tsx:373`；`addFileByPath` 檔名改以 `/[\\/]/` 切；tsc 40 → 39 | BUG（新開，本機也受影響） | 無 | S | 🟢 可直接派；**注意**：修好後遠端視窗的附件會開始送出 client 路徑，建議與工單 3 同版或先上工單 3 的不可達擋板 |
| 2 | 工單 2：圖片附件改由 client 端讀取 —— 拖放用 `File` + `FileReader`、`clipboard:saveImage` 改回 data URL（或新增 channel）、對話框選圖由 main 本機讀；附件不再走 proxied `image:read-as-data-url`（`FileTree.tsx:43` / `PathLinker.tsx:204` 的預覽維持 proxied） | BUG（新開；本機貼圖疑似也壞） | 無（拖放部分可與工單 1 並行） | M | 🟡 第一步先實機重現本機貼圖失敗（程式碼推論：`os.tmpdir()` 不在工作區白名單）；注意新 channel 不可變成任意本機讀檔口（只接受 main 自己產出的路徑或直接回 data URL） |
| 3 | 工單 3：遠端視窗附件路徑 —— 新增 ALWAYS_LOCAL `remote:resolve-client-paths`（可達性規則見「建議方向」）；Claude 面板 `@` 前綴改用 server 形式，不可達者拒絕 + i18n toast（Q1）；守門測試：每種 translator × 可達 / 不可達 fixture；`ALWAYS_LOCAL_CHANNELS` / parity 測試同步 | BUG-105 | 工單 1 | M | 🟢 |
| 4 | 工單 4：「複製遠端路徑」選單項（`FileTree.tsx`、`Sidebar.tsx:584`、`MarkdownPreviewPanel.tsx:69`、`PathLinker.tsx:225`），只在遠端 profile 視窗顯示；原「複製路徑」維持 client 形式（Q2） | BUG-105 | 工單 3（共用 IPC，`purpose: 'workspace-entry'`） | S | 🟢 |
| 5 | 工單 5：終端拖放檔案 —— 加 drop handler，插入依 shell family 加引號的 server 形式路徑（不送 `\r`），不可達 toast；先實測目前是否會觸發 `will-navigate` → `openExternal` 開本機檔 | BUG-105 | 工單 1、工單 3 | S–M | 🟡 需先實測目前行為；優先度低於 1–4 |
| 6 | 工單 6（選做）：Claude prompt 送出前偵測 client 形式路徑樣式 → 非阻斷提示（不改內容，可關閉） | BUG-105 | 工單 3 | S | 🟡 產品取捨，建議 1–4 上線後視回饋決定 |
| 7 | 工單 7（另案 PLAN）：本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖） | 新 PLAN | 工單 3 | L | 🔴 需塔台 / 使用者決定是否立項；本期依 Q1 以拒絕代替 |

### 遭遇問題

1. **`/snippet` 情境 prompt 寫死 macOS 路徑**（`ClaudeAgentPanel.tsx:1431`）：`~/Library/Application Support/better-agent-terminal/snippets.json` 在 Windows / Linux 都不對；T0422 讓 snippet 變 ALWAYS_LOCAL 後，遠端視窗的 agent 更不可能讀到本機 snippets.json，叫 agent「用 Read/Write 工具改 JSON」在遠端必定失敗。不屬本單範圍，建議塔台另開小 BUG（遠端視窗應改為只注入清單、或停用該流程）
2. **`agent:build-launch-command` 不代理**（`electron/main.ts:3177`）：用本機 agent registry 與本機設定組命令後打進遠端終端；自訂 CLI 若設本機絕對路徑會失敗，codex daemon opt-out 判斷也用本機 elevation。記為已知限制，非自由文字問題
3. **SSH 視窗的工作區選擇用本機對話框**（T0416 已記）：使用者選的是本機資料夾，靠 home 對應才落在遠端。本單 Q1 的「SSH 一律不可達」只針對附件；工作區路徑仍沿用 T0416 的 home 對應
4. 終端拖放的現況（#5）與 WSL claude CLI 的 Alt+V 貼圖行為（#14）為推論，**未實機驗證**
5. 同工作樹有其他 Worker 平行改動（`electron/main.ts`、`electron/remote/remote-client.ts`、`src/App.tsx` 等為 dirty）；本單只讀，行號以 2026-10-05 05:47 當下工作樹為準，派工時請以檔案內容重新定位

### 回報時間
2026-10-05T05:47:13+08:00
