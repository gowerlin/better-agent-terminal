---
schema_version: 1
schema_kind: workorder
id: T0789
title: "研究：終端回覆 claude 的 `OSC 7501 ; ?` 探詢後，claude 會送哪些狀態序列、時機與副作用（PLAN-061 前置）"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T18:24:49+0800"
started_at: "2026-11-02T18:28:40+0800"
updated_at: "2026-11-02T19:04:56+0800"
completed_at: "2026-11-02T19:04:56+0800"
session_ids:
  - "593b2d34-16ed-40c7-93db-850dace2fa33"
depends_on: []
related:
  - "T0787 回報區〈Q2〉（claude 內嵌 `2.1.316` 有 OSC 7501 編碼器：常數 `PROGRAM_STATUS:7501`、`app=claude-code`、`kind=` / `progress=` / base64 `title=` / `msg=`；啟動送 `OSC 7501 ; ?`，收到以 `?` 開頭的回覆才送；字串 `probe: OSC 7501 reply` / `probe: no reply to OSC 7501 ; ?`；`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 或背景 worker 關閉）〈Q3〉（herdr-core `crates/herdr-core/src/status.rs`：6 個 state、kind、progress、id、`:` 分隔；探詢回覆格式官方未寫）〈建議下一步 ④ (2)〉"
  - "PLAN-061（PLAN-059 子項 B：OSC 7501 白名單）；PLAN-059；D227"
  - "`src/lib/codex-terminal-state.ts`（現行解析器：`CODEX_OSC_PAYLOAD_MAX = 128`、丟掉 `app≠codex`）；`electron/terminal-blocked-state.ts`（hook reason 判斷）；CLAUDE.md「blocked 狀態偵測」節"
affects_files:
  - _ct-workorders/T0789-research-claude-osc7501-probe-reply.md
  - _ct-workorders/PLAN-061-osc7501-allowlist.md
  - e2e/t0789-claude-osc7501-probe.spec.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: decision-requiring
memory_overrides:
  - "🔴 只研究：不改產品程式碼（`electron/**`、`src/**`、`scripts/**`）、不改 `package*.json`、不在 repo 跑 `npx vite build`（與 T0788 並行，T0788 會改程式並 build）。唯一可新增的 repo 檔是探針 `e2e/t0789-claude-osc7501-probe.spec.ts`（可 commit）；其他暫存放 Worker scratchpad 或系統暫存目錄的 `ct-T0789/`，收尾刪除。"
  - "🔴 實測方式：不需要 BAT。用 node-pty（repo 已有 `@lydell/node-pty`）或等效方式直接 spawn 內嵌 claude（`node_modules/@anthropic-ai/claude-code/bin/claude.exe`，記版本），由測試程式扮演終端：收到 `OSC 7501 ; ?` 時回覆、擷取之後所有輸出；模型一律用 `e2e/fixtures/fake-anthropic-api.ts`（或同等假 API＋阻擋真實 API 連線），**真實模型花費 0**；HOME / `CLAUDE_CONFIG_DIR` 指到暫存目錄，不碰使用者的 claude 設定與 BAT。需要時可另用安裝版 BAT（`BAT_E2E_EXECUTABLE`，`0.7.3-pre.7`）做對照，但不得用 repo 的 build 產物。"
  - "🔴 要回答：① 回覆格式：claude 接受什麼回覆（從二進位字串 / 解析程式碼反推並實測；不回覆、回錯格式、逾時的對照）。② 回覆後 claude 送出的序列：idle / working / blocked（權限對話框、AskUserQuestion、其他 elicitation 若可觸發）/ done / error / clear 的實際內容與時機（相對於 BAT hook 事件 `PermissionRequest` / `Stop` 等的先後，可在同一實驗記 hook 觸發時間），`kind` 的值、`progress`、`id`、`title` / `msg` 解碼內容與長度分布（最長多少字元，對照解析器 128 上限）。③ 副作用：回覆與不回覆的輸出差異（標題寫入、畫面、其他 OSC / DCS）、對 claude 行為的影響；`CLAUDE_CODE_DISABLE_TERMINAL_TITLE`、`disableAllHooks` 下是否仍送（後者是 BAT `blockedDetection: none` 的情境，正是 B 的價值所在）。④ 在 xterm.js 內回覆的可行點（只描述做法與風險，不實作）：xterm 的 OSC handler 能否攔截並經 `onData` / PTY 回寫、BAT 重開 replay 時會不會重複回覆、遠端 headless 怎麼辦。⑤ 結論：PLAN-061 要不要把 `claude-code` 放進白名單、解析長度上限改成多少、與 hook 判斷的優先序建議、claude 升版時的檢查方式。每項附證據；查不到寫「未確認」，不得寫成肯定句。"
  - "🔴 產出（寫在回報區）：序列實錄表（情境 / 原始序列（title / msg 只放解碼後長度與前 20 字）/ 時間 / 對應 hook）、回覆格式結論、副作用表、xterm 端做法與風險、給 PLAN-061 的建議（含工單草案：affects_files、必守規則、驗收）。PLAN-061 文末補〈T0789 結論摘要〉（只摘要、指向本單），狀態維持 IDEA。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單、PLAN-061 與探針；同一 checkout 有 T0788 並行，不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）。"
---

# T0789 — 研究：回覆 claude 的 OSC 7501 探詢

## 元資料

- **工單編號**：T0789
- **類型**：research
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T18:24:49+0800
- **預估規模**：M

## 研究目標

PLAN-059 子項 B（PLAN-061）要讓不只 codex 的程式也能回報分頁狀態。T0787 查到，目前主動送 OSC 7501 的只有 codex。claude 有完整的編碼器，但只有終端回覆它的 `OSC 7501 ; ?` 探詢時才會送，而 BAT 從來不回覆。如果 BAT 回覆，就多了一條不靠 hooks 的 blocked 來源，可以補上使用者關掉 hooks 的分頁（`blockedDetection: none`）。本單要實測：回覆格式是什麼、claude 回覆後送哪些序列、什麼時機送、有什麼副作用，作為 PLAN-061 定範圍的依據。

## 已知資訊

見 frontmatter `related` 第 1 條（T0787 Q2 / Q3 的查證結果）。

## 調查範圍

見 frontmatter `memory_overrides`。

## 互動規則

- yolo：不問使用者，判讀問題問塔台（每輪最多 3 題）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（研究單；①–⑤ 都有結論，產出寫在下面）
- **結論一句話**：回覆格式很寬鬆（`ESC ] 7501 ; ?` 開頭、BEL 或 ST 結尾即可），回覆後 claude 會穩定送出 idle / working / blocked(permission|question) / done / error / clear，`disableAllHooks` 下照送，正好補得上 hooks 關閉的分頁。**但在 Windows 本機 BAT 做不到**：系統 ConPTY 會丟掉寫進 PTY 輸入的 OSC 回覆，而且 claude 的 DA1 查詢由 conhost 自己回答，claude 會立刻判定「沒有回覆」。所以這條路只對 Linux / macOS 的 PTY 主機（遠端 headless bat-server、含 BAT 的 WSL 遠端視窗；macOS 本機）有效。
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下；C-3：`affects_files` 三項中兩項（本單、PLAN-061）已存在，探針 spec 由本單新增（上層 `e2e/` 存在），判為 present；C-2：工單沒有 `branch` 欄位，略過。`CT_HOME` 未設（不在 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **實測環境**（不用 BAT、不用 repo 的 build 產物、真實模型花費 0）：
  - Windows：repo 內嵌 claude `2.1.316`（`node_modules/@anthropic-ai/claude-code/bin/claude.exe`）＋ `@lydell/node-pty` `1.1.0`（系統 ConPTY，與 BAT 相同：BAT 沒有設 `useConptyDll`）＋ `@xterm/xterm` `5.5.0`（BAT 出貨版本）在純 Node 當終端。
  - Linux：WSL Ubuntu 24.04（核心 6.18）家目錄暫存資料夾，安裝**同版** `@anthropic-ai/claude-code-linux-x64@2.1.316`、`@lydell/node-pty@1.1.0`、`@xterm/xterm@5.5.0`、`@playwright/test@1.59.1`，跑同一份 spec（`T0789_CLAUDE=<linux claude>`）。
  - 模型：`e2e/fixtures/fake-anthropic-api.ts` 前面加一個小伺服器（最新 user 訊息含 `T0789-ERR` 回 HTTP 400），外加阻擋 proxy；兩個平台 `api.anthropic.com` 連線嘗試都是 0 次（spec 斷言）。HOME / USERPROFILE / `CLAUDE_CONFIG_DIR` / APPDATA 都指到暫存目錄。
- **產品程式碼**：未改（`electron/**`、`src/**`、`scripts/**`、`package*.json` 都沒動），沒有在 repo 跑 `npx vite build`。新增 `e2e/t0789-claude-osc7501-probe.spec.ts`（探針，`T0789_PROBE=1` 才跑，只斷言沒有連到 anthropic.com）。
- **暫存清理**：Windows `%TEMP%\ct-T0789`、WSL `~/ct-T0789`、spec 自己建的 `bat-t0789-*` / `bat-e2e-t0789-*`（Windows `%ProgramData%`、WSL `/tmp`）都已刪除。WSL 的 npm 下載快取（`~/.npm`）沒有清。
- **Commit**：本單、PLAN-061、探針 spec 以 `git commit --only` 一起提交（同一個 commit 含回報與最終 metadata；hash 見 git log）。不 push、不發版。
- **session_id**：593b2d34-16ed-40c7-93db-850dace2fa33

### 互動紀錄

- [18:28] 開工：yolo（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。沒有需要問塔台的判讀問題，未發 `提問`；需要塔台決定的項目寫在〈建議方向〉。
- [18:45] Windows 實測回覆後 0 個狀態序列 → 以小程式驗證 ConPTY 輸入端（見 Q1）→ 改在 WSL 的 Linux PTY 跑同版 claude 取得回覆後的序列。
- 方法論：本單沒有 frontmatter `methodology`、沒有 `### 方法論邊界`；本 session 沒有看到方法論注入，也沒有呼叫任何方法論 skill。

### 調查結論

#### ① 回覆格式：claude 接受什麼

**從二進位反推**（claude `2.1.316`，`claude.exe` 內嵌 JS 字串）：

- 探詢：啟動時的能力探測（`bb()`）一次送出 `CSI > 0 q`（XTVERSION）、`CSI ? u`（kitty 鍵盤）、`OSC 7501 ; ? BEL`，最後用 `CSI c`（DA1）當「後面都問完了」的分界。
- 比對：`match: e.type==="osc" && e.code===PROGRAM_STATUS && e.data.startsWith("?")`；輸入端 OSC 的 regex 是 `/^\x1b\](\d+);(.*?)(?:\x07|\x1b\\)$/s`。所以**回覆只要是 `ESC ] 7501 ; ?…`，以 BEL 或 ST（`ESC \`）結尾**；`?` 後面放什麼都行。
- 時限：回覆必須**在 DA1 回覆之前**送到（DA1 先到 → `probe: no reply to OSC 7501 ; ?`，定為 false），而且整個探測有 `cC = 2000` ms 期限，逾時也定為 false（`likely: false`）。
- 一旦定案就不再變：`answer()` 對已定案的能力回 false；之後只有 stdout 塞車時的 `resync` 會再送 DA1 分界，**不會再探詢 7501**。每個 claude 程序只探詢一次（實測每個情境 `probes = 1`）。
- 不探詢的情況：`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` 有值、背景 worker（`CLAUDE_CODE_SESSION_KIND=bg`）、`hasUnknownSequencePrintingBug` 的終端（VTE < 0.53 等，xterm.js 不在其中）。

**實測**（Linux PTY，真 xterm 5.5 的 OSC handler 以 `term.input(reply, false)` 回覆）：

| 情境 | 回覆 | 結果 |
|---|---|---|
| c | `ESC]7501;?ESC\`（ST），探詢後 1 ms | ✅ 7 ms 後送 `state=idle:app=claude-code`，之後照常送狀態 |
| a / g | `ESC]7501;?BEL`，探詢後 1 ms | ✅ 同上 |
| d | `ESC]7501;okBEL`（不以 `?` 開頭） | ❌ 0 個狀態 |
| e | `ESC]7501;?BEL`，探詢後 2,000 ms（DA1 已回） | ❌ 0 個狀態 |
| b | 不回覆 | ❌ 0 個狀態（現況） |
| f | `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` | claude 不探詢（0 個 7501），也不寫 OSC 0 標題 |

**Windows（ConPTY）實測：回覆送不到 claude。**

- 小程式在 ConPTY 內以 raw mode 印出收到的位元組：`ESC[?1;2c`（DA1）、`ESCP>|…ESC\`（DCS）、`ESC[?0u`、一般文字都收得到；**`ESC]7501;?BEL`、`ESC]7501;?ESC\`、`ESC]11;rgb:…BEL` 三種 OSC 回覆一個位元組都收不到**。
- claude 的 DA1 查詢 `ESC[c` 沒有出現在 ConPTY 的輸出裡（Linux 有；Windows 的輸出在 `ESC]7501;?BEL` 後面直接接畫面），xterm 也沒有回 DA1（`da1Replies = []`）。代表 conhost 自己回答了 DA1，claude 在 xterm 收到探詢之前就判定「沒有回覆」。
- 所以 Windows 本機 BAT 有兩道阻擋，都在系統 ConPTY：OSC 回覆被丟、DA1 被 conhost 搶答。實測 a（BEL）、c（ST）都只有探詢、0 個狀態。
- 範圍：只在本機 Windows 11（build 28000）的系統 ConPTY 測過。其他 Windows 版本，或改用 node-pty 的 `useConptyDll`（換成較新的 OpenConsole）會不會不同：**未確認**（`@lydell/node-pty` `1.1.0` 沒有附 `conpty.dll`）。在本機 BAT 分頁裡執行 `wsl.exe` 再開 claude，一樣經過 Windows ConPTY，推論同樣不行（未實測）。

#### ② 回覆後 claude 送出的序列（Linux，情境 a / g）

狀態由 `YAe()` 算出，只在內容改變時送（同一個 key 去重）：

| claude 內部 | 送出 |
|---|---|
| `busy`，或 idle 但有排隊的 prompt | `state=working`（`progress` / `msg` = 進行中說明） |
| `waiting` 且 `blockedOn` | `state=blocked`，`kind`：`permission prompt` / `sandbox request` / `worker request` / `goal proposal` → `permission`；`input needed` → `question`；`dialog open` → 不帶 kind；`msg` = 對話框說明 |
| 上一回合 `completed` | `state=done`（`msg` = 完成說明） |
| 上一回合 null / `stopped`（Esc） | `state=idle` |
| 上一回合錯誤 | `state=error`（`msg` = 錯誤）；登入類錯誤（`authentication_failed` / `oauth_org_not_allowed` / `cloud_credential_error`）且之後沒有重新登入 → `state=blocked:kind=auth` |
| 背景子代理（Agent 等，最多 32 筆） | 子紀錄 `state=working|blocked:app=claude-code:id=<id>:title=<b64 說明>`，結束時 `state=clear:id=<id>`（**不帶 app**） |
| 程式結束（`restoreTerminalModes`） | `state=clear`（**不帶 app**），實測連送 3 次 |

**序列實錄表**（時間 = 相對 spawn 的毫秒；title / msg 只列解碼後長度與前 20 字；hook 時間取自同一時鐘）：

| 情境 | 原始序列 | 時間 | 對應 hook（時間） |
|---|---|---|---|
| 啟動、回覆探詢 | `state=idle:app=claude-code` | 291（回覆 284） | `SessionStart startup`（221） |
| 一般回合 | `state=working:app=claude-code` | 3,068 | `UserPromptSubmit`（3,082） |
|  | `state=done:app=claude-code` | 4,696 | `Stop`（4,681） |
| 權限對話框（Bash） | `state=working:app=claude-code:msg=<b64 56>` msg(42)「T0789 permission pro」 | 7,824 | `PreToolUse Bash`（7,830） |
|  | `state=blocked:app=claude-code:kind=permission:msg=<b64 80>` msg(59)「approve Bash: curl -」 | 7,847 | `PermissionRequest Bash`（7,862） |
|  | 使用者按 Enter（9,370）→ `state=working:app=claude-code` | 9,427 | `PostToolBatch`（9,470） |
|  | `state=done:app=claude-code` | 9,632 | `Stop`（9,622） |
| AskUserQuestion | `state=working:…:msg=<b64 28>` msg(19)「T0789 which option?」 | 13,338 | `PreToolUse AskUserQuestion`（13,345） |
|  | `state=blocked:app=claude-code:kind=question:msg=<b64 60>` msg(42)「answer: T0789 which 」 | 13,356 | `PermissionRequest AskUserQuestion`（13,372） |
|  | 使用者按 Enter（14,892）→ `state=working:app=claude-code` | 14,902 | `PostToolUse AskUserQuestion`（14,907） |
|  | `state=done:app=claude-code` | 15,096 | `Stop`（15,084） |
| Esc 中斷回合 | `state=idle:app=claude-code` | 26,558（Esc 26,495） | **沒有任何 hook**（`Stop` 不觸發） |
| 背景子代理（`Agent`，`run_in_background`） | `state=working:…:msg=<b64 40>` msg(28)「T0789 background hel」 | 30,545 | `PreToolUse Agent`（30,552） |
|  | 子紀錄 `state=working:app=claude-code:id=aaa1f21de1a96b886:title=<b64 40>` title(28)「T0789 background hel」 | 30,570 | `SubagentStart`（30,576） |
|  | 主回合結束仍是 `state=working:app=claude-code`（子代理還在跑） | 30,762 | `Stop`（30,751）**← hook 說回合結束，7501 說還在工作** |
|  | 子代理結束 `state=clear:id=aaa1f21de1a96b886` | 57,157 | `SubagentStop`（57,125） |
|  | claude 把完成通知當新回合處理 → `state=done:app=claude-code` | 57,281 | `UserPromptSubmit`（57,177）、`Stop`（57,271） |
| API 錯誤（HTTP 400） | `state=working:app=claude-code` → `state=error:app=claude-code:msg=<b64 64>` msg(46)「API Error: 400 T0789」 | 63,933 → 64,001 | `StopFailure`（64,007；BAT 沒有註冊這個 hook） |
| `/exit` | `state=clear` ×3 | 67,536–67,540 | `SessionEnd`（67,556） |
| g：`disableAllHooks: true` | idle / working / done / `blocked:kind=permission` / `blocked:kind=question` / working / done / clear ×3，內容同上 | 293–20,947 | **0 個 hook**（設定生效） |

- `kind` 實測只見到 `permission`、`question`；`auth` 與「不帶 kind」（`dialog open`）只從程式碼得知，**未實測**。MCP elicitation 對應哪個 `blockedOn`：**未確認**。
- `progress`：程式碼是工作清單的完成比例（`round(100 × completed / total)`，只在 working / blocked 送）。這個測試環境 claude 沒有提供 `TodoWrite` / `TaskCreate`（假 API 收到的工具清單沒有），**未實測**。
- 欄位順序固定：`state`、`app`、`id`、`kind`、`progress`、`title`、`msg`，以 `:` 分隔；`title` 先截到 192 位元組（UTF-8）、`msg` 截到 2,048 位元組，再 base64。
- **長度**：實測最長 payload 130 字元（`blocked:kind=permission` 帶 msg）。理論上限：主紀錄的 `msg` base64 最長 2,732 字元，加上固定欄位約 2.8k；子紀錄 `title` base64 最長 256、`id` 最長 32。**現行 `CODEX_OSC_PAYLOAD_MAX = 128` 下，實測 26 個狀態中只有 1 個超過（130 字元的 `blocked:kind=permission`），會被整個丟掉——剛好是最重要的 blocked；指令或提問稍長就一定超過。**
- 與 BAT hook 的先後：`blocked` 比 `PermissionRequest` hook 早約 15 ms；回答後的 `working` 比 `PostToolUse` / `PostToolBatch` 早約 5–40 ms；`done` 比 `Stop` 晚約 10–15 ms。整體可視為同時。

#### ③ 副作用

| 項目 | 不回覆（b） | 回覆（a） | 說明 |
|---|---|---|---|
| OSC 7501 序列 | 1（探詢） | 27（探詢＋26 個狀態） | — |
| OSC 0 標題寫入 | 55 次（`✳` / `◐` / `◑ Claude Code` 轉圈） | 3 次（`✳ Claude Code`、`Claude Code`、空字串） | **回覆後 claude 不再用標題做忙碌動畫**。BAT 沒有讀 OSC 0 標題（`src` / `electron` 找不到 `onTitleChange`），目前對 BAT 無影響；PTY 輸出量略減（對「等安靜」只有好處）。 |
| 其他 OSC / DCS / APC | 無 | 無 | 兩邊都只有 OSC 0 與 7501 |
| 畫面 | — | — | 沒有逐格比對；肉眼與 xterm 緩衝區沒有可見差異（未做像素比對） |
| claude 行為 | — | — | 回合、權限、AskUserQuestion、錯誤、背景子代理的流程與 hook 觸發完全相同（a 與 b 的 hook 序列一致） |
| 多餘回覆（模擬 BAT 重開 replay 時 xterm 再回一次） | 0 個新狀態、畫面不變 | 0 個新狀態、畫面不變 | claude 的 querier 對沒有在等的回覆直接忽略；輸入框沒有出現 `7501` 字樣 |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` | — | 不探詢、0 個狀態、0 次標題 | 使用者設了這個變數，B 就完全拿不到 |
| `disableAllHooks: true` | — | 狀態照送（g） | **這正是 `blockedDetection: none` 的情境，B 的價值所在（僅限非 Windows 主機）** |

#### ④ 在 BAT 端回覆的做法與風險（只描述，不實作）

**做法 A：xterm OSC handler（本單探針的做法）**——`terminal.parser.registerOscHandler(7501, data => data.startsWith('?') ? (terminal.input('\x1b]7501;?\x07', false), true) : false)`。

- 可行（Linux 實測）：xterm 依輸出順序處理，7501 回覆一定排在同一批的 DA1 回覆之前；兩者都經 `onData` → `pty:write`，順序保留。
- `isTerminalAutoReply`（`electron/close-worker.ts`）已把 OSC 回覆列為終端自動回應：不算使用者輸入，不會取消 `--close-worker` 或用量限制等待，派工輸入保留也會放行。
- 風險：
  1. **BAT 重開 / 遠端重連 replay**：replay buffer 裡的舊探詢會讓 xterm 再回一次。實測 claude 忽略多餘回覆，無害；但仍建議 replay 期間不回（`PtyOutputReplayer.replay()` 期間停用）。
  2. **多個 xterm**：遠端 headless 有多個 client 同時連線時，每個 client 的 xterm 都會回。第一個生效、其餘被忽略（同上），無害。
  3. **沒有 xterm 在處理輸出**：headless 沒有 client 連線、或分頁的 TerminalPanel 沒掛載時，2 秒內沒有回覆 → claude 定為 false，該 claude 程序之後永遠不送。helper 派工的 Worker 落在沒有開著的視窗時就會漏。BAT 的分頁是否在背景也一直掛載 xterm：**未確認**。
  4. 遠端延遲 > 2 秒（慢網路）也會漏。

**做法 B（建議）：主行程在 PTY 輸出端回覆**——`PtyManager.enqueuePtyOutput`（現在已在這裡掃 codex 的 7501）看到 `ESC]7501;?` 就直接寫回 PTY。

- 比 renderer 的 DA1 回覆更早送到，不需要 xterm、不需要 client 連線，headless 也一樣；只有一個回覆者，不會重複。
- replay（`handleReplayBuffer`）路徑不回覆即可避免重複。
- 寫入要走 BAT 自己的自動寫入（不算使用者輸入），內容固定（`ESC]7501;?BEL`），不需記錄內容以外的資訊。
- **Windows（PTY 在系統 ConPTY 上）不做**：寫了也送不到（Q1）。判斷依 PTY 所在主機的平台（遠端看 bat-server 主機）。

**遠端 headless**：bat-server 在 Linux / macOS 主機上用真 PTY，做法 B 直接適用，這也是本單 Linux 實測代表的情境。macOS 本機 BAT 同理，但 **macOS 未實測**。

#### ⑤ 結論（給 PLAN-061）

1. **白名單**：值得把 `claude-code` 放進白名單，但效益**只在非 Windows 主機**（遠端 headless、macOS / Linux 本機）。Windows 本機的 `blockedDetection: none` 分頁補不到。
2. **長度上限**：從 128 改成 **4096**（主紀錄理論上限約 2.8k，留餘裕；未完成序列的保留長度跟著改）。只讀 `state` / `kind`，不認得的 key 與值忽略；**`title` / `msg` 不解碼、不存、不記日誌**（內容是指令與提問文字，可能含秘密）。
3. **子紀錄與 clear**：claude 的 `state=clear` 與 `state=clear:id=…` 都**不帶 `app`**。現行解析器允許沒有 `app` → 子代理結束的 `state=clear:id=…` 會被當成整個分頁的 clear。新解析器要：帶 `id=` 的紀錄一律不影響分頁狀態；沒有 `id` 的 `state=clear` 才是分頁 clear。
4. **與 hook 的優先序**：沿用 codex 規則（T0621 / D158）——第一個 claude 狀態序列把 `blockedDetection` 設為 `osc`，**已經是 `hook` 時忽略 7501**。hook 分頁行為完全不變，只有 hooks 關閉的分頁改用 7501（`blocked` → `blockedReason: input`，`working` / `idle` / `done` / `error` / `clear` 清除，同 codex）。
   - 7501 比 hook 多知道的事：Esc 中斷（hook 完全不觸發，7501 立即 `idle`）、API 錯誤（BAT 沒註冊 `StopFailure`）、背景子代理還在跑（`Stop` 後 7501 仍是 `working`）。要不要把這些拿來補 hook 分頁的回合信號，另案決定，不放進 PLAN-061 第一版。
   - `agentStarted`：hooks 關閉時，回覆後約 7 ms 就有 `state=idle`，可比照 codex 的 osc 分頁當作啟動確認。
5. **claude 升版時的檢查**：
   - 字串檢查：`claude.exe` 內仍有 `PROGRAM_STATUS:7501`、`probe: OSC 7501 reply`、`app=claude-code`、`e.data.startsWith("?")`、`kBo` 對應表（`"permission prompt":"permission"`、`"input needed":"question"`）、`cC=2000`。
   - 實跑：在 WSL / Linux 依 spec 檔頭的步驟跑 `T0789_PROBE=1`（a、c、d、g 四個情境），比對狀態序列與本表。
   - Windows 再跑一次 a，確認仍是「只有探詢、0 個狀態」；如果哪天變成有狀態，代表 ConPTY 行為改了，要重新評估 Windows。

### 建議方向

- **建議：PLAN-061 縮小為「非 Windows 主機的 claude 7501」**，優先序維持在 A（BUG-196 / T0788）之後。
  - 理由：實作量小（解析器＋主行程回覆＋tracker 一處），能補遠端 headless 與 macOS 上關掉 hooks 的 claude 分頁。
  - 但 Windows 本機（BAT 主要使用者環境）沒有效益；`blockedDetection: none` 在 Windows 仍是缺口。
  - 如果塔台判斷遠端 / macOS 的 hooks-off 分頁太少，也可以只做解析器那半（白名單＋長度＋子紀錄），回覆先不做。
- 需要塔台決定的項目：
  1. 回覆放主行程（做法 B，建議）還是 xterm（做法 A）。
  2. 第一版是否只用在 `blockedDetection: none` 的分頁（建議是，同 codex 規則）。
  3. Esc 中斷 / 錯誤 / 背景子代理這三個「hook 不知道的事」要不要另開單補到 hook 分頁。
- 不建議：全開 `app`（PLAN-059 R2）；解碼或記錄 `title` / `msg`。

### 建議下一步

#### PLAN-061 實作工單草案（塔台定案後開單）

- **affects_files（草案）**：
  - `src/lib/codex-terminal-state.ts`（或改名 / 新增 `src/lib/program-status.ts`：白名單 `codex` / `claude-code`、上限 4096、`id=` 子紀錄忽略、無 app 的 `state=clear` 才是分頁 clear）＋ 單元測試
  - `electron/pty-manager.ts`（`enqueuePtyOutput` 偵測 `ESC]7501;?` → 非 win32 主機以自動寫入回覆；`handleReplayBuffer` 不回覆）
  - `electron/terminal-blocked-state.ts`（`observeCodexState` 接受 claude 狀態，規則同 codex：已是 `hook` 時忽略）
  - `electron/remote/headless-entry.ts`（若回覆需要接線）
  - `e2e/t0789-claude-osc7501-probe.spec.ts`（改成在 Linux 跑 BAT headless 的驗收，或新 spec）
  - `docs/agent-guide/blocked-state.md`、`CLAUDE.md`「blocked 狀態偵測」節
- **必守規則**：
  - 只讀 `state` / `kind`；`title` / `msg` 不解碼、不存、不記日誌。
  - hook 分頁行為不變（已是 `hook` 時忽略 7501），codex 行為不變（e2e `t0621` 必跑）。
  - 帶 `id=` 的子紀錄不影響分頁狀態。
  - Windows ConPTY 主機不寫回覆。
  - 回覆內容固定 `ESC]7501;?BEL`，只在 PTY 輸出中看到探詢時寫一次，replay 不寫。
  - 回覆不算使用者輸入（`isTerminalAutoReply` 已涵蓋 OSC，仍要有測試守住）。
  - 不注入 claude 參數或 env（不碰 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`）。
- **驗收**：
  - 單元測試：解析（白名單、4096、子紀錄、無 app 的 clear、未知值忽略）、回覆只寫一次、replay 不寫、win32 不寫、自動回應不算輸入。
  - Linux（WSL 遠端 headless）實機：`disableAllHooks` 的 claude 分頁在權限對話框 / AskUserQuestion 時 `bat_get_state` = `blocked` / `blockedReason: input` / `blockedDetection: osc`，回答後清除；hook 分頁仍是 `hook`。
  - 突變檢查：拿掉回覆 → 上述斷言失敗。
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。

### Renew 歷程

- 無。

### 遭遇問題

1. **Windows 端回覆送不到**（見 Q1）：改在 WSL 跑同版 Linux claude 取得回覆後的資料。Linux 結果代表遠端 headless / Linux 主機；macOS 未實測。
2. **誤在 repo 目錄跑了整套 e2e（WSL，已停止）**：WSL 發行版閒置停止後 `/tmp` 被清空，我的指令 `cd /tmp/ct-T0789` 失敗後沒有中止，於 18:51:04 在 repo 目錄（`/mnt/d/…`）以 WSL 的 node 跑了 `npx playwright test`（全部 spec，`T0789_PROBE=1`）。約 4 分鐘後我發現並停止，期間 6 個 spec 在 Linux 上失敗（沒有 Linux electron）。
   - 檢查結果：沒有新的 git worktree / 分支 / stash；repo 追蹤檔沒有被改；WSL 端沒有殘留程序；Windows 端的 electron / playwright 程序是 T0788 自己在跑的 t0787 spec，不是我的。
   - **可能影響 T0788**：playwright 開跑時會清空輸出目錄 `e2e-results/`（gitignored），這個目錄與 T0788 共用。18:51 時 T0788 正在跑 `e2e/t0787-notify-into-blocked-tower.spec.ts`，它在 `e2e-results/` 的產物可能被清掉。我在 18:30–18:40 的兩次 Windows 探針執行（當時未帶 `--output`）也會清空同一目錄。T0788 若看到 e2e 產物（截圖、trace）缺失，原因在這裡。
   - 之後的執行都改帶 `cd … || exit 1`，Windows 端帶 `--output <暫存>`；spec 檔頭已註明要帶 `--output`。`e2e-results/` 內的 `e2e-t0576…` 等 6 個失敗產物目錄（我的誤跑留下的）沒有刪，避免動到 T0788 可能在用的目錄。
3. `todo` 情境：這個環境 claude 沒有提供工作清單工具，`progress` 沒測到（見 Q2）。

### 方法論狀態回寫

- 無（本單沒有 `methodology`）。

### 回報時間

- 2026-11-02T19:02:49+0800
