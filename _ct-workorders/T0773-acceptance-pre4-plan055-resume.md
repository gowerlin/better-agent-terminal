---
schema_version: 1
schema_kind: workorder
id: T0773
title: "pre.4 自動化驗收（安裝版）：PLAN-055 Terminal Server recovery 後恢復 agent 分頁 —— 真的 claude `--resume` 接回對話（真實模型小額）、真的 codex `resume` 選單"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
started_at: "2026-11-02T05:14:28+0800"
updated_at: "2026-11-02T05:24:58+0800"
completed_at: "2026-11-02T05:24:58+0800"
session_ids:
  - "e132c922-2487-4803-a3db-5f4a48d7cea3"
depends_on: []
related:
  - "PLAN-055（T0765 研究、T0766 B1 `cb263cc1`、T0767 B2 `5d104926`，D211）；D215（本批自動化驗收，真實模型上限）"
  - "既有 e2e：`e2e/t0766-interrupted-agents-recovery.spec.ts`、`e2e/t0767-interrupted-codex-resume.spec.ts`（兩支都用 csc 編的假 claude / codex，只驗 argv）、`e2e/t0704-heartbeat-recovery.spec.ts`（只結束 Terminal Server 造 recovery 的做法）；`e2e/v072-real-model-*.spec.ts`（真實模型的做法與費用計算）；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`，`TERMINAL_SERVER_SCRIPT` 已支援安裝版）"
  - "CLAUDE.md「Terminal Server 存活判定與 recovery」節（被中斷的 agent 分頁）；`docs/agent-guide/terminal-server-recovery.md`「被中斷的 agent 分頁」"
affects_files:
  - "e2e/t0773-*.spec.ts（新增，檔名可調；🔴 真實模型部分必須預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - "e2e/t0766-interrupted-agents-recovery.spec.ts、e2e/t0767-interrupted-codex-resume.spec.ts、e2e/t0704-heartbeat-recovery.spec.ts（只在需要支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/terminal-server-recovery.md
  - _ct-workorders/T0773-acceptance-pre4-plan055-resume.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；不行再用現有 source build `dist` / `dist-electron`（04:29 由 `31fa4974` 建出，與 tag `v0.7.3-pre.4` 的 `src` / `electron` / `scripts` 無差異），回報逐情境寫明。🔴 不得跑 `npx vite build`（T0770–T0773 並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`。"
  - "🔴🔴 只結束**隔離實例自己的** Terminal Server：pid 只能取自隔離實例 userData 下的 `bat-pty-server.pid`（或 spec 自己記錄的 pid），`taskkill /F /PID <pid>` 不加 `/T`（T0704 作法）。🔴 絕不讀、不用使用者 `%APPDATA%\\BetterAgentTerminal\\bat-pty-server.pid`，不結束任何不是 spec 自己啟動的程序 —— 使用者的塔台與 Worker 都跑在那個 Terminal Server 上。結束前先比對 pid 對應的程序命令列含隔離實例的路徑，比對不到就不結束、該項 BLOCKED。"
  - "🔴 情境（隔離實例，至少：Claude CLI 分頁（內嵌 claude）、Codex CLI 分頁（內嵌 codex）、一個純 shell 分頁）：① Claude CLI 分頁對模型說「記住數字 42，只回答 OK」（1 回合）→ 等 `claudeSessionId` 經 SessionStart hook 回報。② 只結束隔離實例的 Terminal Server → recovery。預期：recovery toast 含中斷數量；「被中斷的分頁」對話框列出 claude 與 codex 分頁、不列 shell；縮圖 ⏸；BAT 不自動 resume；Esc 關閉對話框不 resume。③ claude 分頁一鍵恢復 → 分頁命令以 `--resume=<同一個 session id>` 啟動（`=` 形式、無 `--fork-session`，BAT 的 `--mcp-config=` / `--settings=` / `--name=` 仍在）→ 問「剛才要你記住的數字？只回答數字」→ 回答 42（1 回合）。④ codex 分頁「開啟 resume 選單」→ 命令為原 BAT 參數後接 `resume`（無 session id、無 `--last`）→ 真的 codex 0.166 顯示它自己的 resume 選單（`CODEX_HOME` 用暫存目錄、不登入、不呼叫模型；選單為空或要求登入都照實記錄，重點是 codex 接受這組參數、沒有參數錯誤）。另跑 t0766、t0767、t0704 不回歸（同一驗收對象）。"
  - "🔴 真實模型（使用者 2026-11-02 同意，D215）：只用於 claude 分頁，`claude-haiku-5-5`（隔離實例 Settings / 工作區 `agentCustomArgs` 加 `--model claude-haiku-5-5`，不改產品程式碼；🔴 不得放 `--settings`）；🔴 不得使用 Opus / Fable / Sonnet。本單上限：合計 ≤ 4 個模型回合、估計費用 ≤ US$0.40（全批 US$1.00 的其餘），超過立即停止、回 PARTIAL。費用依 T0739 F1（累計值取最大）。codex 不跑真實模型。"
  - "🔴 登入與隔離：claude 用使用者現有登入；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不傾印整個 `process.env`；codex 用暫存 `CODEX_HOME`，不碰使用者 `~/.codex`。工作區 / 目錄名含 `t0773`，放 `%ProgramData%\\bat-e2e-t0773-*`，跑完刪除；本單在 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t0773` 的 session 目錄跑完可刪除（只刪這些）。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉附重現步驟與證據，由塔台開 BUG。"
  - "🔴 驗證：真實模型 spec 預設 skip，跑 1 次（不連跑）；不回歸 spec 失敗時同一情境最多重跑 1 次並記錄（並行負載可能造成逾時）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`terminal-server-recovery.md`「被中斷的 agent 分頁」驗證清單補一行（真的 claude / codex、本次結果）。回報附每回合模型、tokens、估計費用。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）：回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0773 — pre.4 自動化驗收（安裝版）：PLAN-055 中斷分頁恢復

## 元資料

- **工單編號**：T0773
- **類型**：implementation（驗收用 e2e，真實模型小額）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。PLAN-055 B1 / B2 的 e2e（t0766 / t0767）用假的 claude / codex，只驗 BAT 送出的參數。真的 claude 能不能以 `--resume=<id>` 接回對話、真的 codex 0.166 接不接受 BAT 組出的 `resume` 參數，還沒驗過。手動驗收要結束使用者自己的 Terminal Server，會中斷塔台；改在隔離實例內做（D215），不影響使用者正在用的 BAT。

## 範圍

1. 情境 ①–④（見 frontmatter），新寫 spec。
2. 不回歸 t0766 / t0767 / t0704。
3. docs 一行。

## 不做

- 不結束使用者的 Terminal Server 或任何不是 spec 自己啟動的程序。
- 不用 Opus / Fable / Sonnet；不超過上限；codex 不跑真實模型。
- 不改產品程式碼、不 build、不改共用 fixture；不碰認證檔。

## 驗收

- [ ] 情境 ①–④ 逐項結果，每項寫明驗收對象（安裝版 / source build）
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] t0766 / t0767 / t0704 綠、真實模型 spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-02T05:23:58+0800
- **session_id**：e132c922-2487-4803-a3db-5f4a48d7cea3
- **摘要**：情境 ①–④ 在安裝版 `0.7.3-pre.4` 隔離實例全部 PASS。真的 claude 以 `--resume=<同一個 id>` 接回對話並答出 42；真的 codex 0.166.0 接受 `… resume`，不登入時先顯示登入畫面，沒看到 resume 選單本身。t0766 / t0767 ×2 / t0704 在同一安裝版全綠。發現 1 個問題（F1）：recovery 後自動開啟的對話框，第一次按 Esc 關不掉。

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS
- C-3：`e2e/`、`docs/agent-guide/` 存在 → present（C-0 已 PASS，僅記錄）
- C-2：工單無 `branch` 欄位，不適用
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_HOME` 未設定（不是 worktree）
- `CT_MODE` = `yolo`；`CT_INTERACTIVE` 未設定；`BAT_REMOTE_TOKEN`：已設定

### 驗收對象

- 全部情境與不回歸 spec 都跑**安裝版** `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，FileVersion `0.7.3-pre.4`（spec 執行時以 PowerShell 讀出）。以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；沒有跑 `npx vite build`，也沒有用 source build。
- 內嵌 claude：安裝目錄 `resources\app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\claude.exe`（預設 embedded runtime）。
- 內嵌 codex：安裝目錄 `…\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`，`codex-cli 0.166.0`，以隔離實例的 PATH 放在最前面。codex-cli 分頁跑的是 PATH 上的 `codex`，命令列已確認是安裝目錄的 codex.exe。

### 情境結果

| 情境 | 結果 | 證據（安裝版） |
|---|---|---|
| ① claude 記住 42 | **PASS** | SessionStart hook 回報 `session=359c06a0`，`~/.claude/projects/<本次目錄>` 只有 1 個 transcript，檔名開頭相同（完整 UUID）。命令列含 `--model claude-haiku-5-5 --strict-mcp-config`、`--mcp-config=` / `--settings=` / `--name=`，沒有 `--resume`。回答 `OK`（1 回合，5 s）。 |
| ② 只結束隔離實例的 Terminal Server | **PASS**（Esc 見 F1） | pid 取自隔離 userData 的 `bat-pty-server.pid`。命令列含安裝版的 `terminal-server.js`，**且**父程序 = 隔離實例主行程（`app.evaluate(() => process.pid)`），兩者都成立才 `taskkill /F /PID`（無 `/T`）。log `attempting recovery... (reason=ipc-exit)` → `recovery complete`。toast `data-interrupted-count=2`，文字「2 個 agent 分頁已中斷，按此查看」。對話框列 claude 與 codex（兩列都 `data-resumable=true`），不列 shell。`.interrupted-agent-badge` ×2。`claude-sessions.json` 的 `interrupted` 有 claude 分頁的完整 id。recovery 後等 5 s，再按 Esc 等 5 s：`{"claudeStarts":1,"resumeLines":0,"agentsUnderNewServer":0,"badges":2}`，即不自動恢復，新 server 下沒有 claude / codex 程序。**第一次 Esc 沒有關閉對話框**（F1）；點一下對話框標題後再按 Esc 才關閉，也沒有因此恢復任何分頁。 |
| ③ claude 一鍵恢復 | **PASS** | 新 server 下的 claude.exe 命令列：`… --mcp-config=… --settings=… "--name=<同第一次>" --resume=359c06a0-445b-4b24-8307-deddee1953b0 --model claude-haiku-5-5 --strict-mcp-config`。用 `=` 形式，沒有 `--fork-session`，id 與第一次相同。SessionStart 再次回報 `session=359c06a0`。問「剛才要你記住的數字是多少？」→ 回答 `42`（1 回合，5 s）。對話框的 claude 列消失。 |
| ④ codex「開啟 resume 選單」 | **PASS**（照實記錄畫面） | 新 server 下的 codex.exe 命令列 = 第一次啟動的命令列（`-c features.daemon_auto_start=false -c mcp_servers.bat.* …`）+ ` resume`。逐字比對：去掉結尾 ` resume` 後與第一次完全相同；沒有 session id，沒有 `--last`。10 s 後 codex 仍在執行，畫面沒有參數錯誤。畫面是 codex 自己的「Welcome to Codex … Choose how you want to use Codex. 1. Sign in with ChatGPT …」登入畫面：暫存 `CODEX_HOME` 沒有登入，codex 先要求登入，**resume 選單本身沒有出現**（工單允許照實記錄）。對話框與 ⏸ 全部消失。 |

### 不回歸

- `npx playwright test e2e/t0766-… e2e/t0767-… e2e/t0704-… --workers=1`，`BAT_E2E_EXECUTABLE` = 安裝版 → **4 passed（1.8 m）**，包括 t0704、t0766、t0767 BAT MCP 開 / 關。第一次就通過，沒有重跑。三支既有 spec **都沒改**：t0766 / t0767 用 `REPO_ROOT/scripts/bat-terminal.mjs` 派工，安裝版也能用。
- 真實模型 spec 預設 skip：不設 `BAT_E2E_REAL_MODEL` 時 `1 skipped`（修改前後各確認一次）。
- `npm run typecheck` = 0，`npm run typecheck:electron` = 0。新 spec 在 `e2e/`，不在兩個 tsconfig 的 `include` 範圍內，所以另外以 `tsc --noEmit --strict --skipLibCheck --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --types node e2e/t0773-real-agents-recovery-resume.spec.ts` 檢查 → 0。

### 模型回合與費用

費用依 transcript 的 `usage` 計算，同一 message 串流多筆時每個欄位取最大值（T0739 F1），價格取自 `src/lib/model-pricing.ts`。

| 執行 | 回合 | 模型 | in / cache read / cache write / out | 估計費用 |
|---|---|---|---|---|
| 第 1 次 | ① 記住 42 | claude-haiku-5-5 | 2 / 0 / 56,944 / 4 | US$0.01139 |
| 第 2 次 | ① 記住 42 | claude-haiku-5-5 | 2 / 34,045 / 22,898 / 4 | US$0.00492 |
| 第 2 次 | ③ 問數字 | claude-haiku-5-5 | 2 / 42,323 / 14,679 / 3 | US$0.00336 |
| **合計** | **3 回合**（上限 4） | 只有 Haiku 5.5，transcript 裡沒有 Opus / Fable / Sonnet | | **US$0.01967**（上限 US$0.40） |

codex 沒有呼叫任何模型（沒有登入）。

### 偏離與說明

1. **真實模型 spec 跑了 2 次**（工單寫「跑 1 次」）：第 1 次在 ② 的 Esc 斷言失敗（即 F1），③④ 沒有執行。spec 改成「記錄第一次 Esc 的焦點與結果，點一下對話框後再斷言 Esc」，又跑了 1 次。兩次合計 3 回合、US$0.0197，仍在本單 4 回合 / US$0.40 的上限內，沒有連跑。
2. **pid 比對方式**：Terminal Server 的命令列只有 `<安裝目錄>\resources\app.asar\dist-electron\terminal-server.js`，不含隔離實例的 userData。fork 時 userData 是經 env `BAT_USER_DATA` 傳入（`electron/main.ts` `startTerminalServer`），所以只看命令列分不出隔離實例和使用者自己的 server。改用三個條件同時成立才結束：pid 只取自隔離 userData 的 pid 檔、命令列含該版的 `terminal-server.js`、父程序是隔離實例主行程 pid。任一不符就不結束，該項記 BLOCKED（spec 內建）。實際兩次都三項相符。沒有讀使用者 `%APPDATA%\BetterAgentTerminal\bat-pty-server.pid`，也沒有結束 spec 以外的程序。teardown 沿用既有 spec 的 `killLeftoverServer`（只處理 spec 自己記下的 pid，並比對命令列）。
3. claude 參數多加了 `--strict-mcp-config`（照 T0747 的做法，不載入使用者自己的 MCP server）。沒有放 `--settings`。
4. spec log 的 `--name=` 值中間的「·」顯示成亂碼：`commandLineOf` 把 PowerShell 的 cp950 輸出當 UTF-8 解碼。這是測試輸出的問題，不是產品問題；第 1 次與恢復後的比對用同一種解碼，比對結果不受影響。

### 發現的問題

- **F1（建議開 BUG）recovery 後自動開啟的「被中斷的分頁」對話框，第一次按 Esc 不會關閉**
  - 現象：Terminal Server recovery 後對話框自動開啟，但鍵盤焦點仍在原分頁的 xterm（`document.activeElement` = `TEXTAREA.xterm-helper-textarea`，在 `.xterm` 內、不在對話框內）。按 Esc 時，xterm 把 Esc 送進 PTY 並取消事件，`modal-stack` 掛在 `document` bubble 階段的監聽器收不到，對話框保持開啟。點一下對話框（焦點移到 `BODY`）後 Esc 才關閉。
  - 影響：使用者在對話框上按 Esc，Esc 實際送進了背景分頁的 PTY。recovery 後 agent 分頁已經只剩 shell，影響較小；但這不符合 CLAUDE.md「Dialog 不因點擊外部關閉、Esc 統一」節（Esc 一律經 `ModalOverlay` 的 `onEscape` 關閉最上層 Dialog）。其他「不經點擊、自動開啟」的 Dialog 是否也有同樣情形未查證（推論：機制相同）。
  - 證據：第 2 次執行 log `② focus when the dialog had opened by itself: {"tag":"TEXTAREA","cls":"xterm-helper-textarea","inXterm":true,"inDialog":false}; first Esc closed the dialog: false`、`after clicking the dialog title: focus {"tag":"BODY",…}; second Esc closed the dialog: true`。第 1 次執行在同一步失敗（`toHaveCount(0)` 收到 1）。
  - 重現：`BAT_E2E_REAL_MODEL=1 BAT_E2E_EXECUTABLE=<安裝版> npx playwright test e2e/t0773-real-agents-recovery-resume.spec.ts`，看 log 的 `② focus …` 行。手動重現：開一個 claude-cli 分頁並點進終端，結束該實例的 Terminal Server，等對話框自動出現後直接按 Esc。
  - 可能的修法（交塔台判斷，本單未改產品程式碼）：對話框開啟時把焦點移進對話框，或讓 modal-stack 改在 capture 階段攔 Esc（後者會影響 T0567「對話框內的選單 / 自動完成先處理 Esc」的規則，需要評估）。

### 仍需手動

- codex 的 resume **選單畫面本身**：用暫存 `CODEX_HOME` 不登入時，codex 先顯示登入畫面。若要看到真正的 resume 選單（依 cwd 篩選的 session 清單），需要已登入的 codex 並有該 cwd 的歷史 session。這次依工單規定沒有碰使用者的 `~/.codex`。
- F1 的實機手感（Esc 送進 PTY 時背景分頁有沒有可見影響）請人看一次。

### 清理

- `%ProgramData%\bat-e2e-t0773-*` 已刪除（兩次都 `workspace folders removed: true`，事後 `ls` 確認沒有殘留）。
- `~/.claude/projects` 下名稱含 `bat-e2e-t0773` 的目錄每次刪 1 個，事後計數 0。這裡其他目錄都沒動。
- 隔離實例 userData 已刪除。teardown 後 Terminal Server `alive after teardown: false`。
- 沒有讀取、複製或印出任何認證檔或權杖。spec 沒有傾印 env，log 中的家目錄以 `<home>` 代替。

### 異動檔案與 commit

- `e2e/t0773-real-agents-recovery-resume.spec.ts`（新增）
- `docs/agent-guide/terminal-server-recovery.md`（「驗證清單」→ T0766 小節補 1 行，記錄真的 claude / codex 與本次結果）
- 產品 commit：`bb376b41`（`git commit --only` 只含上面 2 個檔）。本工單檔另外 commit。沒有 push、沒有發版、沒有改 CHANGELOG、沒有改產品程式碼、沒有改 `e2e/fixtures/electron-isolation.ts`、沒有改 t0766 / t0767 / t0704。

### 遭遇問題

- 第 1 次真實模型執行在 ② 的 Esc 斷言失敗（F1），處置見〈偏離與說明〉1。

### 互動紀錄

- 無（yolo，沒有問塔台也沒有問使用者；兩個判讀點自行決定並記錄在〈偏離與說明〉1、2）。
