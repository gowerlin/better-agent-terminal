---
schema_version: 1
schema_kind: workorder
id: T0742
title: "T0738 B 類補 e2e：BUG-135 detached 收回後 focus、BUG-156 精靈選 port 避開 RemoteServer、BUG-108 面板圖片附件、BUG-107 拖放路徑、BUG-159 手動 codex 分頁 `--no-daemon` 注入"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:26:58+0800"
started_at: "2026-11-01T18:45:49+0800"
updated_at: "2026-11-01T19:06:15+0800"
completed_at: "2026-11-01T19:06:15+0800"
depends_on: [T0739]
related:
  - "T0738 回報區〈B 類後續候選〉（情境與做法以該表為起點）"
  - "BUG-135 / T0532、BUG-156 / T0649、BUG-108 / T0436、BUG-107 / T0435、BUG-159 / T0651；`e2e/detached-close-edges.spec.ts`、`e2e/t0524-terminal-image-paste.spec.ts`（剪貼簿備份還原寫法）、`e2e/fixtures/electron-isolation.ts`"
affects_files:
  - "e2e/t0742-*.spec.ts（新增，最多 5 支，可合併）"
  - _ct-workorders/T0742-e2e-b-class-bug-acceptance.md
renew_count: 0
session_ids:
  - "2124ed16-7d0b-4802-b0cf-41f0e7995cf4"
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（每項 ≤ 1 個情境，以 T0738〈B 類後續候選〉為準，開工時先讀該表與各 BUG 單 / 修正工單回報區確認名稱與行為）：① BUG-135：兩個工作區 A / B 各有終端；B detach → 主視窗切到 A 並聚焦 A 的分頁 → 關閉 B 的 detached 視窗（收回）→ 主視窗 active 工作區仍是 A、focused terminal 屬於 A。② BUG-156：隔離實例 RemoteServer 綁 `remotePort`，另佔一個 port；呼叫精靈選 port 的 IPC（T0649 的實際名稱）→ 回傳值不是 RemoteServer port、也不是被佔的 port；🔴 不呼叫 docker、不建容器。③ BUG-108：本機工作區，Claude 面板以 tmpdir 外的 PNG 加附件（`setInputFiles` 合成 drop，或 stub 檔案對話框）→ 附件縮圖出現、沒有 path guard denied；不送訊息、不需模型。④ BUG-107：`setInputFiles` 真檔合成 drop 到終端分頁 → PTY 收到含真實路徑的字串（`webUtils.getPathForFile`）。⑤ BUG-159（子項）：關 BAT MCP、開手動 codex 分頁（PATH 上 codex ≥ 0.156.0，內嵌或系統 0.166.0）→ debug log 或命令列有 `--no-daemon`；不登入 codex、不跑 daemon 行為。"
  - "🔴 每項要有修正前會失敗的論證：能便宜驗紅就驗（例如暫時把修正條件改掉、重 build、跑一次後從暫存備份還原；🔴 不得用 git stash / checkout / restore），否則以 `git show <修正 commit>^` 的程式碼說明舊版會走哪條路徑。某項在本機做不到就寫原因，其餘照做，可回 PARTIAL。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷記在〈發現的問題〉附重現步驟，由塔台開 BUG。不改 BUG 單狀態與 `_bug-tracker.md`（由塔台處理）；回報區列〈BUG 結案建議〉（每張：可 CLOSED / 仍需手動，附證據）。會寫系統剪貼簿就先備份、跑完還原；無法還原就不做。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例，不以預設實例啟動 source build、不碰使用者正在用的 BAT 與 userData、不執行安裝檔、不碰 Docker / WSL / SSH。T0739 完成後才派本單（避免同時 build）；先 `npx vite build`。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。不需要 LLM；若某項會啟動 claude / codex 的模型呼叫，只能打本機假 API，回報對外請求數。"
  - "🔴 驗證：新 spec 各連跑 2 次綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（e2e 不在 tsconfig 範圍則另以單檔 tsc 檢查）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0742 — T0738 B 類補 e2e

## 元資料

- **工單編號**：T0742
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T18:26:58+0800
- **預估規模**：M

## 背景

T0738 盤點 22 張待驗收 BUG，12 張 A 類已由塔台結案；B 類（可在本機 Windows 補 e2e）中 BUG-127 / 131 / 175 已在 T0738 補上，其餘 5 項（BUG-135、156、108、107、159 子項）由本單補，結果作為結案或縮小手動範圍的依據。

## 範圍

1. 情境 ①–⑤（見 frontmatter）。
2. 修正前會失敗的論證。
3. 〈BUG 結案建議〉。

## 不做

- 不改產品程式碼、不改 BUG 狀態。
- 不碰 Docker / WSL / SSH、不用真實模型；BUG-107 真實 OS 拖放、BUG-108 / 107 遠端部分、BUG-159 daemon 行為維持手動。

## 驗收

- [x] ①–⑤ 逐項 PASS / 未涵蓋與原因
- [x] 每項的驗紅或論證
- [x] 新 spec 連跑 2 次綠、兩個 typecheck = 0
- [x] 〈BUG 結案建議〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（①–⑤ 全部 PASS；①③④⑤ 驗紅成功，② 以程式碼論證）
- **產品 commit**：`c3bab480`（`test(e2e): T0742 …`，只含 5 支新 spec，774 行）；未改 `src/` / `electron/` / `scripts/`，未改 BUG 單與 `_bug-tracker.md`，未 push
- **新增檔案**：`e2e/t0742-adopt-detached-focus.spec.ts`（①）、`e2e/t0742-docker-port-pick.spec.ts`（②）、`e2e/t0742-panel-image-attachments.spec.ts`（③）、`e2e/t0742-terminal-drop-path.spec.ts`（④）、`e2e/t0742-codex-no-daemon.spec.ts`（⑤）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `e2e/` 存在（PASS）；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- **session_id**：2124ed16-7d0b-4802-b0cf-41f0e7995cf4

### 情境結果

驗證基準：HEAD `95f9f160` 以 `git archive` 匯出到 `%TEMP%\bat-t0742-clean`（`node_modules` 以 junction 共用主 checkout），在匯出目錄 `npx vite build`（exit 0）後跑；原因見〈發現的問題〉1。全部用 `e2e/fixtures/electron-isolation.ts` 隔離實例。

| # | BUG | spec | 結果 | 驗紅 / 修正前論證 |
|---|---|---|---|---|
| ① | BUG-135 | `t0742-adopt-detached-focus` | PASS ×2（另主 checkout 開發時 1 次 7.8 s） | **驗紅成功**：`replaceWorkspaceTerminals` 的 fallback 改回 `terminals[0]?.id ?? null` → 第 2 段紅：`B's buffer has T0742MARKTWO: true`（A 的貼上進了 B 的終端） |
| ② | BUG-156 | `t0742-docker-port-pick` | PASS ×2（主 checkout 開發時 1.0 s；紅版 build 下 0.85 s） | 修正前沒有可對照的路徑：`git show 99abe9a1^:src/components/setup-wizard/steps/docker/start-server.ts` 第 66 行 `ctx.state.serverPort ?? ctx.serverPort ?? 9876`，`docker-flow` 預設 9876，也沒有 `docker:pick-server-port`；9876 即 RemoteServer 預設 port。紅版 build 下本 spec 仍綠（預期） |
| ③ | BUG-108 | `t0742-panel-image-attachments` | PASS ×2（另 1 次 11.8 s） | **驗紅成功**：`attachFile` 改走舊路徑 `image.readAsDataUrl(filePath)` → 第 1 步紅（縮圖 0 個）。spec 內另以 HEAD 的舊路徑（proxied `image:read-as-data-url`）讀同兩檔，兩者皆 `Path access denied` |
| ④ | BUG-107 | `t0742-terminal-drop-path` | PASS ×2（另 1 次 10.9 s） | **驗紅成功**：`droppedFilePaths` 改讀 `file.path`（修正前三處 drop handler 的讀法）→ PTY 只有提示列。spec 內另斷言 Electron 41 的 `File.path` = `undefined`、`shell.getPathForFile` = 真實路徑 |
| ⑤ | BUG-159（子項） | `t0742-codex-no-daemon` | PASS ×2（10.2 s / 10.3 s） | **驗紅成功**：拿掉 `batMcpHost.codexNoDaemonSupport`（等同修正前沒有 codex 段）→ `→ not injected (turned off in Settings); no-daemon=no (not-checked)`，argv 沒有 `--no-daemon` |

5 支同一輪合跑：第 1 輪 `5 passed (41.8s)`、第 2 輪 `5 passed (58.3s)`；紅版 build：`4 failed / 1 passed (1.3m)`（失敗都在各自的判別斷言，不是環境錯誤）。驗紅暫改只發生在匯出目錄，跑完以 `git archive HEAD <4 檔> | tar -x` 覆回，sha256 與 `git show HEAD:<file>` 一致後才跑型別檢查；主 checkout 的產品檔案沒有被動過（工單禁止的 git stash / checkout / restore 都沒用）。

各情境內容：

- **①**：A / B 兩個工作區各一個 shell（B 的終端在清單第一位）。第 1 段（工單原文）：B detach → 主視窗點 A 的分頁 → 關 B 的 detached 視窗 → active 仍是 A，右側欄 Snippets「貼上至終端」寫進 A 的 PTY、不進 B。**這一段在修正前也會過**（focus 仍在 A 的終端時不會走 fallback），所以加第 2 段：再 detach B、關掉 A 唯一的終端（focus = null，空狀態）、關 B 的視窗 → active 仍是 A，貼上 3 s 內沒有進 B 的 PTY；對照組：切到 B 再貼上 → 進 B。焦點不在畫面上，以 App `handlePasteToTerminal`（寫 `focusedTerminalId`）讀出。
- **②**：RemoteServer 綁 `remotePort`（例 58637），測試佔住掃描範圍第一個空 port（9878；9877 被使用者的 BAT 佔用）。`pickServerPort({ previousPort: remotePort })` / `({ previousPort: 9878 })` 都回 `9879`（實測是空 port、在 9877–9976、`reusedExistingPort` 為 false）；`({ preferredPort: remotePort })` → `docker-port-in-use`「…used by this BAT's own remote server…」。debug log `excluded host ports: <remotePort>`；沒有 `container` 參數 → 不呼叫 docker、不建容器。
- **③**：本機工作區（`%ProgramData%\bat-e2e-t0742-*\ws`）。Claude Agent 分頁（縮圖「+」）→ `setInputFiles` 真檔合成 drop `os.tmpdir()` 內的 PNG → 縮圖 1 個，`src` = 該檔 bytes 的 data URL；stub main 的 `dialog.showOpenDialog` 回傳工作區與 tmpdir 都以外的 PNG → 「+」→ 縮圖 2 個、bytes 相符；debug log 無 `Path access denied`。不送訊息。
- **④**：`setInputFiles` 真檔（`%TEMP%\bat-t0742-drop-*\t0742-dropped.txt`）合成 drop 到 active shell 分頁 → PTY buffer 出現 `'C:\…\t0742-dropped.txt'`（pwsh 引號、無 Enter）。最後送 Ctrl+C 清掉輸入列。
- **⑤**：Settings `batMcpEnabled: false`；縮圖「+」→ Codex CLI。版本探測 `[codex-version] path=…\OpenAI\Codex\bin\codex.exe version=0.166.0 (probed)`；決定 `[bat-mcp] tab agent=codex-cli terminal=<id> → injected: --no-daemon; mcp=no (turned off in Settings)`；分頁實際呼叫 `codex` 的參數 `-c features.daemon_auto_start=false --no-daemon`（elevated 參數 + T0651）。為了不啟動真 codex（不登入、不跑 daemon），工作區 env 把只印參數的 `codex.cmd` 放在分頁 PATH 最前面；BAT 主行程的 PATH 不含它，探測的仍是真 `codex.exe`。

其他驗證（皆在 HEAD `95f9f160` 匯出目錄）：
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- e2e 不在兩個 typecheck 範圍內：`npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --types node e2e/t0742-*.spec.ts` = 0
- 對外請求：只有 ③ 會起內嵌 claude CLI，指向本機假 API（`fixtures/fake-anthropic-api.ts`）＋拒絕一切的 proxy＋暫存 HOME；斷言並記錄：模型請求 0、proxy 嘗試 0、主行程 fetch / webRequest 對外 0（三輪皆然）。⑤ 只在 BAT 主行程跑 `codex --version`（本機，不連網）。其餘 3 支不需 LLM。沒有寫系統剪貼簿。
- 暫存清理：`%TEMP%\bat-t0742-*`、`%ProgramData%\bat-e2e-t0742-*`、隔離 userData `BetterAgentTerminal-runtime-e2e-t0742-*`、匯出目錄（先刪 junction 本身再刪目錄，確認主 checkout `node_modules\electron` 仍在）都已刪除，0 個殘留。scratchpad 內的驗紅備份不在 repo、不影響任何東西。

### 發現的問題

1. **與 T0744 同時在主 checkout 執行**（流程問題，不是產品缺陷）：本單開工（18:45）兩分鐘後 T0744（`workdir: main repo`）也在同一個 checkout 動工，改了 `src/components/ClaudeAgentPanel.tsx`、`e2e/fixtures/fake-anthropic-api.ts` 等。工單註明「T0739 完成後才派本單（避免同時 build）」，但這次是與 T0744 重疊。影響與處置：
   - 本單開發時在主 checkout 跑過 1 次 `npx vite build`（覆寫了 `dist-electron/` / `dist/`），可能含 T0744 當時的半成品；T0744 若在那之前已 build 並在跑 e2e，可能受影響——請塔台向 T0744 確認。
   - 本單的正式證據（2 次綠、驗紅、型別檢查）全部改在 HEAD 匯出目錄做，不受 T0744 未提交變更影響；驗紅也因此沒在主 checkout 暫改（以備份還原會蓋掉 T0744 正在改的 `ClaudeAgentPanel.tsx`）。
   - 本單 commit 只含自己的 5 支 spec（`git commit --only`），T0744 的檔案原樣留在工作目錄。
2. **BUG-159 修正對 npm 安裝的 codex 不生效**（已知限制，文件有寫，但影響結案判斷）：版本探測在 Windows 只認 PATH 上第一個 codex 為 `codex.exe`；第一個是 npm shim（`codex.cmd` / `.ps1`）就判 `version-unknown`、不加 `--no-daemon`（`electron/codex-osc-version.ts` `resolveDispatchCodexBinary`；`docs/agent-guide/bat-mcp-shim.md` 第 64 行）。實測：從 `npx playwright` 啟動時 PATH 最前面是 `node_modules\.bin`（內嵌 `@openai/codex` 的 `codex.cmd`），BAT 就不注入；spec 因此給隔離實例去掉 `node_modules\.bin` 的 PATH（等同從開始選單啟動）。⇒ 以 `npm i -g @openai/codex` 安裝 codex（`%APPDATA%\npm\codex.cmd`）的使用者、以及 `npm run dev` 的開發版，BUG-159 的防護不會生效。是否要另開單（例如解析 npm shim 指向的 `codex.exe`）由塔台決定。
   - 重現：PATH 最前面放一個含 `codex.cmd` 的目錄（例如 `npx` 啟動的 BAT，或 npm 全域安裝的 codex 在 `codex.exe` 之前），關 BAT MCP，開 Codex CLI 分頁 → debug log `[codex-version] path=- version=unknown (first codex on PATH is …\codex.cmd (needs a shell))`、`no-daemon=no (version-unknown)`。
3. **`e2e/t0584-bat-mcp-shim.spec.ts` 第 275 行的斷言依賴 npx 的 PATH**：它斷言 Settings 關閉時 `batMcpLaunchArgs('codex-cli', 'pwsh', '')` 為 `''`。T0651 之後，PATH 上第一個 codex 是 `codex.exe` ≥ 0.156.0 時應回 `--no-daemon`；現在會過只是因為 npx 把 `node_modules\.bin\codex.cmd` 放在前面（→ `version-unknown`）。本單沒跑 t0584（不在範圍），屬讀碼判斷；換成不經 npx 的 PATH 或 npm shim 消失時，這行會紅。建議日後改 t0584 時一併處理。
4. **Recovery 提示**：①③④ 的隔離實例在 seed 後 `reload` 時，首啟建立的預設終端仍在 Terminal Server，可能跳出 Recovery 提示並擋住點擊（① 首跑實測擋住）。spec 一律在 8 s 內偵測並選「保留」。不是缺陷（行為符合 T0578），記錄給之後寫 spec 的人。

### BUG 結案建議

| BUG | 建議 | 依據 | 仍需手動 / 殘留 |
|---|---|---|---|
| BUG-135 | **可 CLOSED** | 修正 T0532 `8b5251a8`（v0.6.1-pre.1，已在交付版）；`t0742-adopt-detached-focus` 在 HEAD `95f9f160` PASS ×2，且驗紅成功（修正前 fallback 讓 A 的貼上進到 B 的終端） | 無 |
| BUG-156 | **選 port 部分可 CLOSED**（或拆單） | 修正 T0649 `99abe9a1`（v0.7.1-pre.2）；`t0742-docker-port-pick` PASS ×2：跳過 RemoteServer port 與被佔的 port、`preferredPort` = RemoteServer port 被拒、不呼叫 docker | 實際 `docker run -p` publish 與「使用既有容器」的 port 檢查需執行中的 Docker engine（T0743 範圍） |
| BUG-108 | **本機部分可 CLOSED** | 修正 T0436 `6c26edcc`（v0.6.0-pre.2）；`t0742-panel-image-attachments` PASS ×2（drop tmpdir 圖、對話框選工作區與 tmpdir 外的圖），驗紅成功，舊路徑同檔 `Path access denied` | 遠端視窗（WSL / Docker）讀 client 檔案；貼上路徑（`clipboard:read-image-data-url`）本單未涵蓋（需寫剪貼簿）；Codex 面板同修正未涵蓋 |
| BUG-107 | **本機合成 drop 可 CLOSED** | 修正 T0435 `c6c4e9e4`（v0.6.0-pre.2）；`t0742-terminal-drop-path` PASS ×2，驗紅成功，實測 `File.path` = undefined | 真實檔案總管拖放（Playwright 做不到）、遠端視窗、Claude 面板 / Sidebar 的拖放（本單只驗終端；Claude 面板的 drop 由 ③ 間接涵蓋 `getPathForFile`） |
| BUG-159 | **仍需手動，不建議現在結** | 修正 T0651 `5b1be0f5`（v0.7.1-pre.2）；`t0742-codex-no-daemon` PASS ×2 證明「BAT MCP 關 + `codex.exe` 0.166.0 → 命令列有 `--no-daemon`」，驗紅成功 | daemon 行為本身（一般權限 BAT、真 codex 登入、兩個分頁各看自己的 `BAT_TERMINAL_ID`）仍是 C 類；另見〈發現的問題〉2：npm 安裝的 codex 不會注入，建議塔台先決定是否處理 |

### 互動紀錄

- 無使用者介入；yolo 模式，沒有向塔台提問（判讀問題都能從工單、BUG 單、修正 commit 與程式碼決定）。
- 驗紅前（匯出目錄第 1 輪於 19:00:45 開始之前）發現 T0744 同時在主 checkout 工作 → 自行決定：驗紅與正式驗證改在 `git archive` 匯出目錄做、不在主 checkout 暫改產品檔（工單允許的驗紅方式，換個位置做以免蓋掉 T0744 的修改）；記入〈發現的問題〉1 由塔台向 T0744 確認。

### 回報時間

- 2026-11-01T19:04:59+0800
