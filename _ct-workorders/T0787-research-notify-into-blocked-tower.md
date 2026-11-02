---
schema_version: 1
schema_kind: workorder
id: T0787
title: "研究：Worker 通知打進停在權限對話框 / AskUserQuestion 的塔台會不會替使用者作答（PLAN-059 Q1），順查 OSC 7501 的發送者與規格（Q2 / Q3）"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T17:59:30+0800"
started_at: "2026-11-02T18:01:10+0800"
updated_at: "2026-11-02T18:19:14+0800"
completed_at: "2026-11-02T18:19:14+0800"
session_ids:
  - "8ccd99bf-4807-4b08-813b-7a813fcf4825"
depends_on: []
related:
  - "PLAN-059（主 PLAN，PLANNED）子項 A / B、風險 R1 / R2 / R5、待釐清 Q1–Q3；D219"
  - "`electron/handlers/pty.ts:104`（`pty:write` 不看目標是否 blocked）；`scripts/bat-notify.mjs`（`--submit` = 文字＋Enter 寫進塔台 PTY；`--ask` / `--no-pty-write` 路徑，T0716）；`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`、hook reason `permission` / `question` / `elicitation`）；`src/lib/codex-terminal-state.ts`（OSC 7501 解析，目前丟掉 `app≠codex`）"
  - "前例（假模型＋隔離實例）：`e2e/t0757-mouse-answer-clears-waiting.spec.ts`、`e2e/t0762-claude-panel-waiting.spec.ts`、`e2e/fixtures/fake-anthropic-api.ts`、`e2e/fixtures/electron-isolation.ts`、`e2e/t0621-codex-osc-state.spec.ts`"
  - "CLAUDE.md「blocked 狀態偵測」「Worker 問塔台」「遠端 Tower 通知」「BAT MCP shim」節；`docs/agent-guide/blocked-state.md`、`tower-questions.md`、`remote-tower-notify.md`"
affects_files:
  - _ct-workorders/T0787-research-notify-into-blocked-tower.md
  - _ct-workorders/PLAN-059-herdr-comparison-borrowings.md
  - e2e/t0787-notify-into-blocked-tower.spec.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 只研究：不改產品程式碼（`electron/**`、`src/**`、`scripts/**`）、不改 `package.json` / `package-lock.json`。唯一可新增的 repo 檔是探針 spec `e2e/t0787-notify-into-blocked-tower.spec.ts`（可 commit，日後若開 BUG 可當重現 / 回歸測試）；其他暫存檔放 Worker scratchpad 或系統暫存目錄的 `ct-T0787/`，收尾刪除。"
  - "🔴 實測環境：一律用隔離實例（`e2e/fixtures/electron-isolation.ts`，自己的 userData / Terminal Server / RemoteServer）＋假模型（`e2e/fixtures/fake-anthropic-api.ts`），**真實模型花費 0**；不碰使用者的 BAT（`%APPDATA%\\BetterAgentTerminal`）與塔台分頁。可用 repo 的 `npx vite build` 產物或安裝版 `BAT_E2E_EXECUTABLE`（`C:\\Program Files\\BetterAgentTerminal`，`0.7.3-pre.7`），回報寫明用哪個。"
  - "🔴 Q1（主）要回答：塔台是 claude-cli 分頁、正停在 ① 工具權限對話框（例：Bash 需要核准）② AskUserQuestion 選項卡 時，Worker 以**真實路徑**送通知（Worker 分頁的範圍權杖跑 `bat-notify.mjs --submit --source T#### --target <塔台 id> \"T#### 完成\"`；做不到真實路徑才退而用同一組 IPC 順序，並在回報寫明差異），結果是什麼：文字落在哪、Enter 是否選中 / 核准 / 拒絕了某個選項、假模型實際收到的 `tool_result` / 答案為何（以假模型的請求紀錄為證）、送出當下 `bat_get_state` / `terminal:get-state` 的 `blocked` / `blockedReason`。另測對照組：③ 塔台 idle 時 `--submit`（基準）④ 不帶 `--submit` 的預填 ⑤ `--ask --no-pty-write`（應不寫 PTY）⑥ `--ask --submit`。每種情境至少跑 2 次確認穩定。codex 塔台（審批提示）為選做，時間允許才做。"
  - "🔴 Q2（順查）：claude（內嵌 CLI 版本）、codex（內嵌版本）、gemini、opencode 現在有沒有自己送 OSC 7501（`ESC ] 7501 ;`）。方法：本機已有的 CLI 實際在隔離實例跑一次並擷取 PTY 輸出；本機沒有的只在 scratch 目錄 `npm pack` / 下載套件後掃字串（不全域安裝、不登入、不跑需要帳號的指令）。每個 CLI 寫：版本、有 / 無 / 未確認、證據（擷取片段或字串位置）。"
  - "🔴 Q3（順查）：OSC 7501 有沒有正式規格（欄位、`app` 命名、`state` 值域含 `done` / `error`、`kind` 等）。只用官方來源：herdr / herdr-core 官方 repo 的 `schema/README.md` 與 docs（`gh api repos/<owner>/<repo>/contents/...` 或 raw.githubusercontent.com），附連結與查核日；查不到寫「未確認」，不得寫成肯定句。🔴 `gh` 對本 repo 的指令一律帶 `-R gowerlin/better-agent-terminal`；查別的 repo 用 `gh api repos/<owner>/<repo>/...` 明確寫出 owner。"
  - "🔴 產出（寫在回報區）：① Q1 情境表（情境 / 塔台狀態 / blockedReason / 落點 / 假模型收到的答案 / 是否替使用者作答 / 次數）與結論：R1 成立（→ BUG，附嚴重度、最小重現步驟）或不成立（→ 改善項）；② 子項 A 的設計建議：Worker 通知遇到 blocked 塔台時怎麼做（例：保留到不 blocked 再送、有上限、提示待送、可取消），沿用 T0769 已驗收的排隊原則，並寫出**契約草案**（helper 參數 / exit code / 輸出；不帶新參數時行為完全不變，PLAN-059 R3），標明哪些要送 CT 塔台確認；③ 子項 B 的範圍建議（全開 / 白名單 / 暫不做），依 Q2 / Q3 結果與 R2 / R5；④ 後續工單草案（affects_files、必守規則、驗收）。PLAN-059 文末補〈T0787 結論摘要〉（只摘要、指向本單），狀態維持 PLANNED。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單、PLAN-059 與探針 spec。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）：回報與 spec 不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。權杖值不得出現在任何輸出、回報或 spec。"
---

# T0787 — 研究：Worker 通知打進 blocked 的塔台

## 元資料

- **工單編號**：T0787
- **類型**：research
- **互動模式**：yolo（問題問塔台）
- **優先級**：P1
- **建立時間**：2026-11-02T17:59:30+0800
- **預估規模**：M

## 研究目標

PLAN-059 子項 A 是向 Herdr 學「送文字前先看目標狀態」。PLAN-059 風險 R1 懷疑 BAT 有一個現存缺口：塔台停在 claude 的權限對話框或 AskUserQuestion 時，Worker 用 `bat-notify --submit` 送進去的文字和 Enter 可能替使用者選了選項。本單用隔離實例加假模型實測，判斷 R1 是 BUG 還是改善項，並提出 A 的設計與契約草案。另外順便查 Q2（哪些 CLI 自己送 OSC 7501）與 Q3（OSC 7501 有沒有正式規格），用來決定子項 B 的範圍。

## 已知資訊

- `pty:write`（`electron/handlers/pty.ts:104`）不看目標分頁是否 blocked；`bat-notify --submit` 把通知文字和 Enter 寫進塔台 PTY。
- BAT 已經知道塔台是否 blocked：claude 分頁靠 hook（`TerminalBlockedTracker`：`permission` / `question` / `elicitation`），codex 靠 OSC 7501（`input`）。
- `terminal:notify` 不寫 PTY（T0716）。CT v5.15.0 批次提問時，前 N-1 題走 `--ask --no-pty-write`，最後一題走 `--submit`。
- Claude 面板在背景子代理執行時送訊息，已經有排隊的處理方式（T0769：提示待送、可取消、有上限）。PLAN-059 規定 A 要沿用這套行為。
- 前例：t0757 / t0762 已經在隔離實例裡用假模型重現過 claude 的權限對話框。

## 調查範圍

問題 Q1–Q3、產出與限制都寫在 frontmatter 的 `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（研究單；Q1 主、Q2 / Q3 順查都有結論，產出 ①–④ 都寫在下面）
- **結論一句話**：**R1 成立，屬 BUG（建議嚴重度 High）**。塔台停在 claude 的權限對話框或 AskUserQuestion 時，Worker 的 `bat-notify --submit`（含 CT 批次提問最後一題的 `--ask --submit`）送出的 Enter 會替使用者選中預設選項：權限對話框 → 「1. Yes」→ 指令真的執行；AskUserQuestion → 第一個選項。30 次全部重現（3 輪 × 10 情境），沒有例外。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下；C-3：`affects_files` 三項中兩項已存在、探針 spec 由本單新增（其上層 `e2e/` 存在）→ present；C-2：工單沒有 `branch` 欄位，略過。`CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **實測環境**：repo 的 source build（`npx vite build`，HEAD `1cfb4277`，exit 0）＋ `e2e/fixtures/electron-isolation.ts` 隔離實例（自己的 userData / Terminal Server / RemoteServer，不碰使用者的 BAT 與塔台分頁）＋ `e2e/fixtures/fake-anthropic-api.ts` 假模型＋阻擋 proxy（`api.anthropic.com` 連線嘗試 0 次）。**真實模型花費 0**。沒有用安裝版。
- **產品程式碼**：未改（`electron/**`、`src/**`、`scripts/**`、`package*.json` 都沒動）。新增 `e2e/t0787-notify-into-blocked-tower.spec.ts`（探針，`T0787_PROBE=1` 才跑）。
- **Commit**：本單、PLAN-059、探針 spec 一起以 `git commit --only` 提交（hash 見 git log；同一個 commit 含回報與最終 metadata）。不 push、不發版。
- **session_id**：8ccd99bf-4807-4b08-813b-7a813fcf4825

### 互動紀錄

- [18:01] 開工：yolo（`CT_MODE=yolo`、`CT_INTERACTIVE=0`），本單沒有需要問塔台的判讀問題，未發 `提問`。設計建議中需要 CT 塔台確認的項目在〈建議方向〉逐項標出。
- 方法論：本單沒有 frontmatter `methodology`、沒有 `### 方法論邊界`；本 session 沒有看到方法論注入，也沒有呼叫任何方法論 skill。

### 調查結論

#### Q1：Worker 通知打進 blocked 的塔台（主）

**做法（真實路徑）**：塔台 = 隔離實例裡「+ → Claude CLI」開的 claude-cli 分頁（內嵌 claude `2.1.316`，`permissions.defaultMode: default`）。Worker = 以 `bat-terminal.mjs --notify-id <塔台 id> --workspace … --skill ct-exec --workorder T0787` 真的派出來的分頁（測試行程用 server token 派工，同 e2e/t0609），主行程日誌 `[helper-cap] issued: terminal=<worker> role=worker tower=<塔台>`，所以 Worker PTY 拿的是綁定塔台的 worker 範圍權杖。Worker 的 agent 是自訂 CLI（node 工作執行器），在 **Worker PTY 內**跑 `bat-mcp.mjs`（`bat_get_state` 查塔台）與 `bat-notify.mjs --source T#### --target "$BAT_TOWER_TERMINAL_ID" …`，權杖不離開 PTY。沒有退回「同一組 IPC 順序」的模擬。

每個情境：塔台收到帶標籤的提示 → 假模型回 Bash 工具（`curl -s --max-time 3 http://127.0.0.1:9/<tag>`，連本機關閉的埠，無副作用）或 AskUserQuestion（選項 Alpha / Beta）→ BAT 記 `blocked` → 等 2 s（對話框可接受輸入）→ Worker 查狀態並送一次通知 → 等 8 s → 記錄畫面、`[blocked]` / `[terminal-submit]` 日誌、假模型有沒有收到下一步請求與其 `tool_result` → Esc / Backspace 復原。

**情境表**（3 輪：第 1 輪塔台分頁在背景＝派工後 Worker 分頁變成作用中；第 2、3 輪點回塔台分頁＝使用者正看著對話框。三輪結果完全相同，下表每列 3/3）：

| # | 情境 | Worker 送出前看到的塔台狀態（`bat_get_state`） | 通知 exit | 文字落點 | Enter / 結果 | 假模型收到的答案（`tool_result`） | 替使用者作答？ | 次數 |
|---|---|---|---|---|---|---|---|---|
| ① | 權限對話框＋`--submit "T0787 完成"` | `blocked` / `permission`（`hook`） | 0 | 被對話框吞掉（畫面、模型都看不到） | Enter 選中預設「1. Yes」，對話框關閉、指令執行（畫面「Ran 1 shell command」） | `Exit code 7`（curl 真的跑了：連線被拒） | **是（核准工具）** | 3/3 |
| ② | AskUserQuestion＋`--submit` | `blocked` / `question` | 0 | 被吞掉 | Enter 選中第一個選項 | `Your questions have been answered: "…"="Alpha". …` | **是（選 Alpha）** | 3/3 |
| ①d | 權限＋`--submit "T0312 完成"`（訊息含 3、1、2） | `blocked` / `permission` | 0 | 被吞掉；數字沒有被當成選項鍵（沒有選到「3. switch to auto mode」，結束後仍是 `manual mode on`） | 同 ①：「1. Yes」 | `Exit code 7` | **是** | 3/3 |
| ②d | AskUserQuestion＋`--submit "T0312 完成"` | `blocked` / `question` | 0 | 被吞掉 | 同 ②：Alpha | `…="Alpha"…` | **是** | 3/3 |
| ③ | 塔台 idle＋`--submit`（基準） | `working`（剛有輸出，未 blocked） | 0 | 輸入框 → 送出成一則使用者訊息 | 正常送出 | （無工具）模型收到「T0787 完成」這則提示 | 否（預期行為） | 3/3 |
| ④p | 權限＋不帶 `--submit`（只預填） | `blocked` / `permission` | 0 | 被對話框吞掉（不顯示、不送模型） | 沒有 Enter；對話框維持 | —（回合沒有往下走） | 否；但**通知文字遺失** | 3/3 |
| ④a | AskUserQuestion＋只預填 | `blocked` / `question` | 0 | 被吞掉 | 對話框維持 | — | 否；文字遺失 | 3/3 |
| ⑤ | 權限＋`--ask --no-pty-write` | `blocked` / `permission` | 0（`question:` / `expires:` / `notified: yes`） | 不寫 PTY（`[terminal-submit]` 0 筆） | 對話框維持 | — | 否（符合 T0716） | 3/3 |
| ⑥p | 權限＋`--ask --submit`（CT 批次提問最後一題） | `blocked` / `permission` | 0 | 被吞掉 | 同 ①：「1. Yes」 | `Exit code 7` | **是** | 3/3 |
| ⑥a | AskUserQuestion＋`--ask --submit` | `blocked` / `question` | 0 | 被吞掉 | 同 ②：Alpha | `…="Alpha"…` | **是** | 3/3 |

（④ 的 `messageOnScreenAfter` 欄位抓到的「❯ T0787 完成」是 ③ 留在對話紀錄裡的那一行，不是預填；預填的字在對話框期間沒有出現在畫面上。Esc 之後字會不會留在輸入框：本探針的復原步驟接著送 Backspace，**未量**。）

**每次作答時 BAT 自己的紀錄**（`[blocked]` 行）：`→ blocked reason=permission|question (hook …)` → **`→ cleared (user input)`** → `[turn] … ended (hook stop)`。也就是 Worker 經 `terminal:keypress` 送出的 Enter 被主行程記成「使用者輸入」：Enter 由塔台分頁的 xterm 產生（`dispatchEnter` → xterm `onData` → renderer `pty.write`，沒有 `{ auto: true }`），`pty:write` handler 把本機視窗的寫入當成使用者輸入（`noteUserInput`）。`[terminal-submit] remote Enter dispatched … dataEvents=1 dataBytes=1 controls=CR` 每次都有。

**結論**：
1. **R1 成立 → BUG**。建議嚴重度 **High**：
   - 權限對話框被 Worker 的完成通知自動核准，Bash / 寫檔 / 任何需要核准的工具會在使用者沒有同意的情況下執行。這正是權限對話框要擋的事。
   - AskUserQuestion 被自動選第一個選項，塔台以錯誤的決定繼續工作。
   - 事後畫面只剩「Ran 1 shell command」或「User answered Claude's questions: → Alpha」，使用者分不出是不是自己按的。
   - 觸發條件很常見：yolo 模式的 Worker 收尾一律 `--submit`，CT 批次提問最後一題也是 `--ask --submit`；塔台只要剛好停在任何一個權限對話框就會中。
   - 塔台分頁在背景或前景都一樣（3/3）。
2. 第二個發現：Worker 的 submit Enter 被記成塔台分頁的「使用者輸入」。這會清掉 `blocked`（⚠️ 消失），也會更新塔台的 `lastUserInputAt`。依 CLAUDE.md，使用者輸入會取消該分頁待執行的 `--close-worker` 與用量限制等待（T0535 / T0566）。後兩項是依程式路徑推論，**本單沒有實測**，列為後續 BUG 單的必查項。
3. 只預填不按 Enter（④）不會替使用者作答，但字被對話框吞掉，塔台事後在輸入框看不到通知（只剩 toast 與 Worker ✓）。
4. Worker 自己就看得到塔台在 `blocked`：worker 權杖對塔台有 metadata 範圍，`bat_get_state` 回 `state: blocked`、`blockedReason`、`blockedDetection: hook`。但「先查再送」中間有競態窗口，而且 `blockedDetection: none`（使用者關了 hooks）時查不出來，所以防護應該放在 BAT 主行程，不是只放在 helper。
5. 「最小重現步驟」：
   1. BAT 開一個 Claude CLI 分頁當塔台（不要 bypass / auto 模式），讓它停在任何一個權限對話框（例如請它跑一個 Bash 指令）。
   2. 從這個塔台派一個 Worker（或任何帶 `BAT_TOWER_TERMINAL_ID` 的分頁）。
   3. 在 Worker 分頁執行 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-notify.mjs" --source T0001 --target "$BAT_TOWER_TERMINAL_ID" --submit "T0001 完成"`。
   4. 結果：塔台的對話框選了「1. Yes」，指令執行；`[blocked] → cleared (user input)`。
   - 自動重現：`T0787_PROBE=1 npx playwright test e2e/t0787-notify-into-blocked-tower.spec.ts`（先 `npx vite build`；Windows；`T0787_RUNS`、`T0787_TOWER_ACTIVE=1`、`T0787_SCREENS=1`、`T0787_RESULTS=<json>` 可調）。
6. codex 塔台（審批提示）：選做，**本單沒有做**。依 T0757 ⑥（codex 0.166 的審批提示接受 `y` / 鍵盤），推測 Enter 同樣會選中預設選項，**未確認**；後續 BUG 單驗收時一併測。

#### Q2：哪些 CLI 自己送 OSC 7501（順查）

| CLI | 版本 | 有沒有送 | 證據 |
|---|---|---|---|
| claude | 內嵌 `2.1.316` | **有編碼器，但預設不送**（要終端回覆探詢才送）；在 BAT 實測 **0 次狀態回報** | ① 隔離實例實測：claude 分頁 PTY 的 replay buffer（啟動後 2,305 字元、結束時 243,926 字元，`total` 與 buffer 長度相同 = 沒有被截）中 `ESC ] 7501 ;` 共 1 個，就是啟動時的探詢 `ESC ] 7501 ; ?`，`state=` 0 個。② 二進位字串：常數表 `PROGRAM_STATUS:7501`；編碼器先放 `state=<s>`、`app=claude-code`，再依情況加 `id=`、`kind=`（只在 blocked）、`progress=`（working / blocked）、`title=` / `msg=`（base64，截到 192 / 2048），欄位以 `:` 分隔；結束時送 `state=clear`。能力旗標 `programStatus` 預設 `likely:false`，啟動時送 `OSC 7501 ; ?`，終端回覆以 `?` 開頭的 OSC 7501 才設為 true（字串 `probe: OSC 7501 reply` / `probe: no reply to OSC 7501 ; ?`）；`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 或背景 worker 直接關閉。xterm.js 不認得 OSC 7501、不回覆，所以 claude 在 BAT 裡從不送。 |
| codex | 內嵌 `0.166.0` | **有，主動送** | 二進位字串：`]7501;state=`、`idle` / `working` / `blocked` / `done`、`]7501;state=clear`。官方原始碼 `openai/codex` `codex-rs/tui/src/terminal_program_status.rs`（最後修改 commit `c0e88f3c`，2026-10-28）：格式 `ESC ] 7501 ; state=<s>:app=codex[:kind=permission|question|auth]`；送出條件 = stdout 是終端，且不是舊版 VTE，**不探詢**。BAT 現行解析器已涵蓋（T0621 / T0717）。 |
| gemini | `@google/gemini-cli` `0.66.0`（npm 最新） | **無**（字串掃描） | scratch 目錄 `npm pack` 後掃 `7501`：只出現在無關的資料表（Unicode 對應表、版本表），沒有 `]7501` / `7501;` / `PROGRAM_STATUS`。沒有安裝、沒有執行。 |
| opencode | `opencode-windows-x64` `1.19.5`（`opencode-ai` 1.19.5 的 Windows 平台套件） | **無**（字串掃描） | `npm pack` 後掃 `opencode.exe`：`7501` 只出現在 CJK 字碼表與 SVG 座標，沒有 OSC 用法。沒有安裝、沒有執行。 |

（gemini / opencode 是靜態字串掃描。動態組出的序列理論上掃不到，但 claude 與 codex 都是以字面 `7501` 寫成，所以「無」的可信度高。仍屬「字串掃描無」，不是實跑結果。）

#### Q3：OSC 7501 有沒有正式規格（順查）

查核日 2026-11-02，只用官方 repo：

- **沒有獨立的規格文件**（找不到專門描述 OSC 7501 欄位與語法的 spec / RFC 類文件）。正式來源只有下面三處，內容一致：
  1. herdr-core `schema/README.md` § Status（https://github.com/herdrdev/herdr-core/blob/master/schema/README.md ，commit `5a9de29b`）：「A terminal's status is whatever its program reported through OSC 7501, the Program Status Protocol (`idle`, `working`, `done`, `blocked`, `error`, ...), stored as reported. hc never infers status from the screen.」值域寫成開放式（`...`）。
  2. herdr-core `README.md`「Status comes from the program」：agent 可回報 working / done / blocked / error；core 不辨識 agent 品牌。
  3. herdr-core `crates/herdr-core/src/status.rs`（同 commit）＋`crates/ghostty-vt/src/lib.rs`（解析結果的結構）：
     - `state`：`idle` / `working` / `done` / `blocked` / `error` / `clear`（解析器只認這 6 個，其他丟掉）。
     - `kind`：`permission` / `question` / `auth`，只在 `blocked` 時有。
     - `progress`：0–100，只在 working / blocked 時有。
     - `id`：子紀錄，`clear` 帶 id 時連子紀錄一起清。
     - `app`：自由字串，範例 `claude-code`。
     - `title` / `msg`：base64。
     - 欄位以 `:` 分隔，例：`ESC ] 7501 ; state=blocked:id=a/b:kind=permission:progress=40:app=claude-code:title=<b64>:msg=<b64> ESC \`。
     - 語意：`done` = 回合完成；`error` 與 `blocked` 都算「卡住」；離開 `working` 一律算回合結束；程式結束時狀態清空。
     - 實際的 OSC 解析器在 herdr 自己 fork 的 libghostty-vt 裡，不在這兩個 repo 公開的檔案中：**未確認**。
- herdr（TUI）主 repo（https://github.com/herdrdev/herdr ，commit `ee5bfb50`）：`docs/next/website/…/add-herdr-support.mdx` 的第三方整合方式是 `"$HERDR_BIN_PATH" pane report-agent … --state idle|working|blocked`，**不是** OSC 7501；整個 repo 搜不到 7501。
- 「探詢」語法（`OSC 7501 ; ?`）與回覆格式：claude 會送探詢，但 herdr-core 公開文件**沒有寫**終端該怎麼回覆，**未確認**。
- 對 BAT 現行解析器（`src/lib/codex-terminal-state.ts`）的影響：
  - `CODEX_OSC_PAYLOAD_MAX = 128`：帶 base64 `title` / `msg` 的 herdr / claude 格式會超過 128 字元，整個序列被當成 invalid 丟掉。
  - `app≠codex` 一律丟掉。
  - `done` / `error` 已讀成 `idle`；`kind` 已忽略。

### 建議方向

#### ② 子項 A 的設計建議與契約草案

**原則**（沿用 T0769：不中斷、不直接打入；提示待送、可取消、有上限）：Worker 通知遇到塔台 `blocked` 時，BAT 主行程把「預填文字＋Enter」**整組保留**，等塔台離開 `blocked` 再依原順序送出。只保留 Enter、照樣送文字也不行：④ 證實文字會被對話框吞掉。

**放在主行程**，不放在 helper 端「先查再送」：
- 沒有競態窗口。
- 舊 helper、手動腳本、遠端 headless 一起受保護。
- helper 端查狀態做不到原子性，`blockedDetection: none` 時也查不出來。

**契約草案 v0**（🟥 = 要送 CT 塔台確認）：

1. **觸發條件**：helper 經 RemoteServer 呼叫（有 `ctx.helper`）的 `pty:write` 或 `terminal:keypress`，目標分頁的 `TerminalBlockedTracker` 有 hook / osc reason（`permission` / `question` / `elicitation` / codex `input`）。
   - `tower`（Worker 等塔台答覆）**不**觸發：那是 Worker 自己的狀態，不是對話框。
   - `blockedDetection: none` 的分頁維持現行行為（無法判斷），記 `[notify-hold] skipped (detection none)`。
   - 本機視窗的使用者輸入、`{ auto: true }`（T0566 用量限制續行）不受影響。
2. **保留單位**：同一個 helper 連線、同一個目標分頁，在 `pty:write` 之後 2 s 內到的 `terminal:keypress`（bat-notify 固定間隔 250 ms，`SUBMIT_KEYPRESS_DELAY_MS`），兩者合成一筆；單獨的 `pty:write`（預填）自成一筆。
3. **回應**：保留時 `pty:write` 回 `{ ok: true, held: true }`，`terminal:keypress` 回 `{ ok: true, held: true }`，與送出成功一樣是 `ok`。舊 bat-notify 只看 `ok === false`，所以 **exit 0、stdout 不變**（R3：不帶新參數時輸出與 exit code 完全不變）。
4. **送出**：塔台離開 hook / osc `blocked` 後，再等連續安靜 1 s（沒有使用者輸入、沒有新的 blocked），依保留順序寫入（文字 → 250 ms → Enter，Enter 仍走 renderer xterm）；送出前再檢查一次 `blocked`。
5. **上限**：每個目標分頁最多保留 8 筆，超過的新通知直接回 `{ ok: false, reason: 'held-full' }`（bat-notify exit 1，現行錯誤路徑）。每筆最長保留 30 分鐘，逾時丟棄並記日誌（toast 早就顯示過，`terminal:notify` 不受保留影響）。🟥 上限數字與「逾時丟棄」或「逾時改為照送」，請 CT 塔台確認。
6. **提示與取消**（同 T0769）：塔台分頁縮圖（或 ⚠️ 旁邊）顯示「待送通知 N」，可展開列出來源工單與時間，逐筆取消 / 全部取消；取消只丟 PTY 寫入，toast 與 Worker ✓ 照舊。
7. **生命週期**：塔台 PTY 結束、⏻ 重啟、Terminal Server recovery 時全部丟棄（記數量）；不持久化，BAT 重開後消失。
8. **日誌**：`[notify-hold] held|sent|cancelled|expired|dropped terminal=<塔台> source=<Worker> reason=<blockedReason> len=<n>`，不記文字內容。
9. **使用者輸入判定**（第二個發現）：helper 觸發的 submit Enter 不算塔台的使用者輸入。renderer 的 `dispatchEnter` 對 `reason: 'submit'` 比照 T0566 的 `auto` 帶 `{ auto: true }`，使它不清 `blocked`、不更新 `lastUserInputAt`、不取消 `--close-worker` 與用量限制等待。🟥 這會改變 Worker ✓ 之外的狀態判讀時機，送 CT 塔台確認。
10. **新參數（可選，🟥 送 CT 塔台決定要不要）**：bat-notify `--report-hold`。帶了才在 stdout 多一行 `  pty: held (<reason>)` 或 `  pty: delivered`，讓 CT 知道塔台還沒看到；不帶時輸出完全不變。

**為什麼預設就保留**（不做 opt-in）：這是 BUG 修正，不是新功能。opt-in 要等 CT 每個呼叫點都改才生效，修正前的 CT 仍會自動核准權限。預設保留對 CT 可見的只有「送進 PTY 的時間變晚」：exit code、stdout、toast、Worker ✓ 都不變，符合 R3。代價是 R4（保留期間塔台輸入框看不到通知），由上限與「待送通知 N」提示緩解。🟥 這個方向本身請 CT 塔台確認。

#### ③ 子項 B 的範圍建議：**白名單，暫不全開**；探詢回覆另案研究

- 現況證據：
  - 主動送 7501 的只有 codex（BAT 已支援）。
  - claude 有完整編碼器，但只在終端回覆 `OSC 7501 ; ?` 時才送，BAT 從不回覆。
  - gemini / opencode 沒有。
  - 所以「放寬 `app≠codex`」本身的效益**目前近乎 0**：沒有其他 CLI 會送。
- 真正有價值的是「讓 claude 送」：BAT（xterm 層）回覆 claude 的探詢 → claude 送 `state=…:app=claude-code[:kind=permission|question]`。這等於多一條不靠 hooks 的 blocked 來源，可補 `disableAllHooks` / `blockedDetection: none` 的分頁。前提與風險：
  - 回覆格式官方沒寫（Q3 未確認），要從 claude 二進位反推、實測。
  - 一旦回覆，claude 每次狀態變化都會往 PTY 寫序列，也可能改變它的其他行為（如 title 寫入）。
  - 與現行 hook 判斷要定優先序。
  - 解析器的 128 字元上限要放寬（claude 會帶 base64 `title` / `msg`）。
- 建議：
  1. B 改為白名單 `app ∈ { codex, claude-code }`（R2：任意輸出能改狀態；白名單擋不住刻意偽造，但擋得住隨手印出來的 log），解析放寬長度、只取 `state` / `kind`（R5：不認得的值忽略）。
  2. 「回覆 claude 探詢」開一張**研究單**先實測，不直接實作。
  3. 優先序排在 A 之後。

### 建議下一步

#### ④ 後續工單草案

**(1) BUG 單：Worker 通知替使用者回答塔台對話框**（建議 BUG-xxx，High；建議先修，修完併下一個預覽版）

- `affects_files`（草案）：
  - 新增 `electron/notify-hold.ts`（唯一實作：保留佇列、合併、上限、逾時）
  - `electron/handlers/pty.ts`（`pty:write` 接保留）
  - `electron/handlers/terminal.ts`（`terminal:keypress` 接保留）
  - `electron/terminal-blocked-state.ts`（訂閱清除事件；只讀，不改判斷）
  - `electron/remote/headless-entry.ts`（headless 共用）
  - `src/components/TerminalPanel.tsx`（submit Enter 帶 `auto`）
  - 縮圖「待送通知 N」UI 與取消（`src/components/…Thumbnail*`、i18n 三語系）
  - 單元測試
  - `e2e/t0787-notify-into-blocked-tower.spec.ts`（把探針改成斷言）
  - `docs/agent-guide/notify-hold.md`（新）、`CLAUDE.md` 新節
  - 只有 CT 同意契約第 10 點時才改 `scripts/bat-notify.mjs`
- 必守規則：
  - 不帶新參數時 helper 的 exit code / stdout 不變（R3）。
  - `terminal:notify` 不受保留影響（T0716：不寫 PTY）。
  - 保留不跨 BAT 重開。
  - 日誌不記文字內容。
  - 不改 `TerminalBlockedTracker` 的判斷規則（T0590 / T0757）。
  - 本機使用者輸入與 T0566 `{ auto: true }` 行為不變。
  - `blockedDetection: none` 維持現行行為。
  - 新 Dialog（若有）用 `ModalOverlay`。
- 驗收：
  - 探針 10 情境 × 2 輪改成斷言：①②①d②d⑥p⑥a → 對話框維持、`tool_result` 不出現；使用者自己回答之後，通知在 1 s 安靜後送進輸入框，模型收到「T#### 完成」。③ 照舊立即送出；④ 保留後送出預填；⑤ 不變。
  - 「待送通知 N」顯示與取消。
  - 上限 / 逾時 / PTY 結束丟棄的單元測試。
  - 突變檢查：拿掉保留即失敗。
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。
  - codex 塔台審批提示補測（T0787 選做未做）。
  - 確認 submit Enter 改 `auto` 後，塔台的 `--close-worker` 延遲與用量限制等待不再被 Worker 通知取消（第二個發現的實測）。

**(2) 研究單：回覆 claude 的 `OSC 7501 ; ?` 探詢**（子項 B 的前置；Medium）

- 隔離實例＋假模型。
- 回覆格式從二進位反推並實測，記錄 claude 送出的序列種類與時機（含 permission / question 的 `kind`）。
- 與 hook 判斷的一致性、對畫面 / 標題的副作用、`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 的影響。
- 不改產品程式碼（探針 spec 除外）。

**(3) 子 PLAN：B（OSC 7501 白名單）**

- 依 (2) 的結果定 `app` 白名單與長度上限。
- 解析器維持寬鬆（R5）。
- 不做全開。

### Renew 歷程

（無）

### 遭遇問題

- 探針第 1 次執行（塔台在背景那輪）在最後的 Q2 擷取步驟失敗：`pty.getBuffer` 回 `{ data, total }` 不是字串。10 個情境的結果在失敗前都已寫進日誌，可用；修正 spec 後正式 2 輪 `1 passed (5.2m)`。
- 派工後 Worker 分頁會變成作用中分頁（T0599 保的是 OS 焦點，不是分頁）。所以分兩種情況各測：背景 1 輪、`T0787_TOWER_ACTIVE=1` 點回塔台 2 輪，結果相同。
- 每種情境 3 次（背景 1＋前景 2）。codex 塔台（選做）沒做，見 Q1 第 6 點。
- 暫存檔（`npm pack` 的 gemini / opencode 套件、herdr 文件、探針 log 與結果 JSON）都在 Worker scratchpad，收尾已刪除；探針自己的暫存目錄在 `finally` 刪除。

### 方法論狀態回寫

（本單沒有方法論；不適用）

### 回報時間

- 2026-11-02T18:19:14+0800
