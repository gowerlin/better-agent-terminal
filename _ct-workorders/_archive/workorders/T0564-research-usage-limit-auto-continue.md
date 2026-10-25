---
schema_version: 1
schema_kind: workorder
id: T0564
title: "研究：claude / codex 終端分頁的 5 小時用量限制，能否可靠辨識（含解鎖時間、與週限制區分），以及 BAT 在 yolo 分頁解鎖後自動輸入「繼續」的設計（PLAN-044）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: S
created_at: "2026-10-16T14:55:14+0800"
updated_at: "2026-10-16T15:04:16+0800"
started_at: "2026-10-16T14:56:44+0800"
completed_at: "2026-10-16T15:03:32+0800"
commit: "d090ec4d"
target_version: "研究，不改產品程式碼"
depends_on: []
related:
  - "PLAN-044（使用者選定的規格）"
  - "T0551 / BUG-140（`isTerminalAutoReply`：什麼算使用者輸入）"
  - "PLAN-041 / T0545（`--close-worker` 在 main 端計時、等安靜、使用者輸入取消：可參考的排程範本）"
  - "T0562（塔台分頁 `--set-role tower`：可能用來辨識塔台分頁）"
affects_files:
  - _ct-workorders/T0564-research-usage-limit-auto-continue.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：不改任何產品程式碼、設定或測試；只寫本工單檔。可以讀原始碼、跑唯讀指令、寫一次性探針到你的 scratchpad（不放進 repo）。"
  - "🔴 不為了觸發限制而消耗額度：不得刻意大量呼叫 claude / codex。訊息樣本來源：CLI 安裝包內的字串 / 錯誤型別（本機 `node_modules/@anthropic-ai/claude-code*`、系統 claude `<使用者資料夾>\\.local\\bin\\claude.exe`、codex 安裝位置）、官方文件 / changelog、BAT 日誌（`%APPDATA%\\BetterAgentTerminal\\Logs`）、CLI 自己的 session 紀錄（`~/.claude/projects/**/*.jsonl`、`~/.codex/sessions/**`）。"
  - "🔴 隱私：讀 session 紀錄時只擷取限制訊息 / rate limit 欄位本身，不得把對話內容（prompt、程式碼、回覆）抄進工單；路徑可寫，內容只寫與限制相關的欄位。"
  - "🔴 commit：`git add` 後 `git commit --only _ct-workorders/T0564-research-usage-limit-auto-continue.md`（其他 M / ?? 檔案是別張單進行中的變更，不是你的）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0564 — 研究：用量限制辨識與自動繼續

## 背景

塔台 auto-session yolo 時，Tower / Worker 的終端分頁（PTY 內跑 `claude` / `codex` CLI）會撞到 5 小時用量限制，整條流程停住。使用者希望 BAT 認出限制與解鎖時間，時間到自動輸入「繼續」。規格（PLAN-044，使用者已選定）：

- 只套用在 yolo 分頁（`CT_MODE=yolo` 的 Worker，以及以 yolo 運作的塔台分頁）
- 輸入內容可設定，預設「繼續」，送出後 Enter
- 解鎖時間後再加可設定的延遲（例 2 分鐘）
- 取消：等待期間使用者在該分頁打字（終端自動回應不算，T0551）；解鎖時畫面已不是限制訊息；週（7 天）限制不自動繼續（只提示）

BAT 現況（塔台初步搜尋，請核對）：Agent 面板（SDK）已收到結構化 rate limit 事件（`electron/claude-agent-manager.ts:1024` `rateLimitType` / `resetsAt`；`src/components/CodexAgentPanel.tsx` `onRateLimit`，status line 顯示 5h / 7d 重置倒數）；`electron/handlers/claude.ts:425` 有 `rateLimits.five_hour.resets_at` 結構（來源待查）。**終端分頁目前沒有任何限制偵測**。

## 研究問題

1. **Claude CLI（`2.1.300`，內嵌與系統版）**：
   - 5 小時 / 週 / 模型專屬（例 Opus）限制在 TUI 上的訊息原文（含不同版本的變體）、重置時間的格式（相對 / 絕對、時區、12 / 24 小時制、跨日）。
   - 有沒有**結構化來源**可給終端分頁用：status line 指令收到的 JSON（`rate_limits`？`handlers/claude.ts:425` 是否就是它）、hooks（例 `Notification` / `Stop` 類事件是否帶限制資訊）、`~/.claude/projects/**/*.jsonl` 的錯誤紀錄、`--output-format` 等。BAT 能否在不改使用者全域設定的前提下取得（例如只對 BAT 啟動的分頁注入）。
2. **Codex CLI（目前安裝版本，WSL 為 `0.160.0`；本機請查）**：同上——訊息原文、重置時間格式、週限制區分、結構化來源（例 `~/.codex/sessions/**` 的 rate limit 欄位、app-server 事件）。
3. **偵測位置與方式**：main 端 PTY 輸出串流 vs renderer xterm buffer；文字比對的誤判風險（**同一分頁的對話內容本身可能出現限制訊息字樣**，例如塔台正在討論這個功能）——怎麼降低（優先結構化來源、比對 TUI 特有呈現、限定出現位置 / 時機、agent 閒置狀態等）。
4. **辨識 yolo 分頁**：Worker 有 `customEnv.CT_MODE`；塔台分頁沒有（塔台跑在使用者自己的分頁）——可行做法（T0562 的 tower role 加上 mode、helper 宣告、或其他）。
5. **送出**：PTY 寫入文字 + Enter 在 claude / codex TUI 上的可靠做法（參考 `bat-notify --submit` 的 renderer 合成 Enter、`[terminal-submit]` 日誌）；送出前的再確認（畫面仍是限制訊息、agent 仍在等待）。
6. **排程與取消**：放 main 端（比照 `WorkerCloseScheduler`）；BAT 重開 / 分頁重建 / detached / 遠端 headless 的行為；多個分頁同時撞限制；解鎖後立刻又撞（再次排程或停止）；時鐘與時區。
7. **Settings**：開關（預設？）、輸入文字、延遲分鐘；三語。
8. **風險與不做的事**：誤送的後果、與使用者自己手動繼續的競態、週限制提示的呈現方式。

## 產出（寫在回報區）

- 每個 CLI：訊息樣本（原文、來源、版本）、時間格式、結構化來源可行性，附證據（檔案路徑 / 行號 / 指令輸出）。區分「實測確認」與「依程式碼 / 文件推斷」。
- 推薦設計（偵測、辨識 yolo 分頁、排程、送出、取消、Settings、遠端），列出替代方案與不採用理由。
- 實作工單建議：範圍、`affects_files`、驗證方式（單元測試 / 以假 CLI 腳本輸出限制訊息的隔離 e2e，不耗額度）、需要塔台或使用者決定的事項（≤ 3 項，選項式）。
- 填 `DONE`（或 `PARTIAL` 並寫明缺口）、commit、通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0564"`），之後保持閒置。

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE**（研究單；未改任何產品程式碼 / 設定 / 測試，只寫本檔）。

Landing Zone Check：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 底下；C-3 `affects_files` 只有本工單（`_ct-workorders/` 排除）→ not applicable；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。工單原狀態為 `TODO`（非 `PENDING`），照 `IN_PROGRESS` → `DONE` 處理。

### 產出摘要

#### 0. 一句話結論

🔴 **claude CLI 已內建這個功能**：2.1.234 起「Continue automatically at usage limit」（設定鍵 `autoContinueAtUsageLimit`，**預設開啟**），撞到 claude.ai 用量限制後由 CLI 自己排程、在重置後 30–90 s 自動送出續行訊息，24 小時以外的重置（= 週限制的常見情況）不排、連續重排上限 2 次。BAT 若再對 claude 分頁打「繼續」會**重複續行**。⇒ PLAN-044 的「自動輸入繼續」**只對 Codex 分頁有實質價值**；claude 分頁 BAT 只該做「辨識 + 提示」與少數 CLI 不處理的缺口（見 §3）。

證據分級：**[碼]** = 從 CLI 安裝包內嵌原始碼 / 字串讀出（實際檔案、版本見下）；**[文]** = CLI 內建 changelog（`~/.claude/cache/changelog.md`）；**[推]** = 依程式碼推斷、未實測。未實際觸發任何限制（工單禁止耗額度）；本機 `~/.claude/projects/**/*.jsonl` 與 `~/.codex/sessions/**`（只有 1 個 rollout 檔）**都沒有**任何限制訊息紀錄，BAT 日誌（`%APPDATA%\BetterAgentTerminal\Logs\debug-*.log`）也沒有 `rate_limit_event`，故**無實測樣本**，所有訊息原文皆為 [碼]。

#### 1. Claude CLI（`2.1.300`；內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 與系統 `<使用者資料夾>\.local\bin\claude.exe` 大小相同 270,863,520 bytes，`--version` 皆 `2.1.300 (Claude Code)`）

**1a. TUI 訊息原文** [碼]（bun 單檔，原始碼明文內嵌；以下 byte offset 皆指內嵌版 `claude.exe`）

- 組字函式（offset ≈ 225433497）：`` function at(e,r,n,s){… return `You've hit your ${e}${r}${h}` } ``，`h` = `" · progress saved"`（有條件）。
- 限制名稱表 `Aie`：`five_hour:"session limit"`、`seven_day:"weekly limit"`、`seven_day_opus:"Opus limit"`、`seven_day_sonnet:"Sonnet limit"`、`seven_day_overage_included:"Fable limit"`、`overage:"usage credit limit"`（Pro / Enterprise 的 `seven_day_sonnet` 改顯示 `weekly limit`）。
- 因此實際訊息形如：
  - 5 小時：`You've hit your session limit · resets 3pm (Asia/Taipei)`（可能再接 ` · progress saved`）
  - 週：`You've hit your weekly limit · resets Oct 20, 3pm (Asia/Taipei)`
  - 模型專屬：`You've hit your Opus limit · resets …` / `You've hit your Sonnet limit …` / `You've reached your Fable limit.`
  - 通用 / 不明類型：`You've hit your usage limit · resets …`、`You've hit your limit · resets …`
  - 非時間型（不該自動繼續）：`You've hit your monthly spend limit…`、`You've hit your team's shared budget…`、`You're out of usage credits…`、`Your org is out of usage · …`、`Your seat type doesn't include usage credits`、`You've hit your fast limit · resets in 4m`
- CLI 自己的分類函式 `H_(m)`：前綴 `You've hit your session limit` → `session`、`weekly limit` → `weekly`、`Opus/Sonnet/Fable limit` → `model`（可直接照抄這個比對規則）。
- 預警（**不是**限制，誤判來源）：`You've used 90% of your session limit · resets 3pm (Asia/Taipei)`、`Approaching weekly limit`、`You're now using usage credits · Your session limit resets …`。

**1b. 重置時間格式** [碼]（`Mx(epochSec, showTz, showHour, forceDate, tz)`，offset ≈ 225129939 一帶的 `uC` 包裝）

- 固定 `en-US` locale、**12 小時制、小寫 am/pm、整點省略分鐘**：`3pm`、`3:30pm`。
- 距今 ≤ 24 h：只有時間；> 24 h：`Oct 20, 3pm`；跨年再加年份（`Oct 20, 2027, 3pm`）。
- 時區：限制訊息呼叫時 `showTz=true` → 尾綴 ` (<IANA 時區>)`，時區取自 session 設定、否則系統時區（某些環境強制 `UTC`）。⇒ 文字可解析，但 **BAT 不需要解析**：見 1c 結構化來源。

**1c. 結構化來源**

| 來源 | 內容 | 給終端分頁用的可行性 |
|---|---|---|
| status line stdin JSON [碼]（`statusLine` 說明，offset 232170607） | `rate_limits.five_hour / seven_day = { used_percentage, resets_at(epoch 秒) }`、`spend_limit`；只對訂閱者、第一次 API 回應後才有 | 只有用量百分比，**沒有「目前被擋」旗標**（100% ≈ 被擋）；要拿到得**替換使用者的 status line**（全域設定，或 `--settings` 覆蓋會蓋掉使用者自己的 status line）→ **不採用** |
| `~/.claude/cache/rate-limits.json` | `{"five_hour":{"used_percentage":4,"resets_at":…},"seven_day":…}` | **不是 CLI 寫的**：CLI 二進位中 `rate-limits.json` 出現 0 次；是使用者自己的 `~/.claude/hooks/statusline.js` 寫的（`electron/handlers/claude.ts:458` 註解也寫 "written by gsd-statusline hook"）。且為帳號層級、非分頁層級 → **不可依賴** |
| `StopFailure` hook [碼][文] | 「turn 因 API 錯誤結束時觸發，取代 Stop」，matcher 欄位 `error`，值含 `rate_limit` / `billing_error`；input 有 `error`、`error_details`、`last_assistant_message`；fire-and-forget | **可行且分頁精準**：BAT 啟動 claude 時以 `--settings '<json>'` 只對 BAT 分頁注入一個 `StopFailure`（matcher `rate_limit`）hook，hook 指令 = BAT helper，靠 PTY 的 `BAT_TERMINAL_ID` / `BAT_REMOTE_*` 回報 main。不動全域設定。[推] `error_details` 內容未實測，可能就是 1a 的文字（含重置時間），可能需要再配合文字解析；`--settings` 的 hooks 與使用者 hooks 是合併而非覆蓋（[推]，需實作時驗） |
| SDK `rate_limit_event`（`electron/claude-agent-manager.ts:1019`）| `rateLimitType` / `resetsAt` / `utilization` | 只有 Agent 面板（SDK / headless 模式）有，**終端分頁的互動 TUI 不輸出** |
| `~/.claude/projects/**/*.jsonl` | 錯誤會以 assistant 訊息（API error message）寫入 | 要把 PTY 對應到 jsonl（session id）才行，延遲與對應成本高 → 不採用 |
| `--output-format` | 只對 `-p` / headless | 終端分頁是互動 TUI → 不適用 |

**1d. CLI 內建自動繼續**（關鍵）[碼][文]

- changelog：`2.1.234`「Claude Code now continues your session automatically when a claude.ai usage limit resets; turn it off in `/config` ("Continue automatically at usage limit")」；`2.1.243` 修 status line `rate_limits` 重置後不更新；`2.1.284` 加 `/rate-limit-options` 到 `/help`、修「自動等待期間打字讓等待脫離設定控制」；`2.1.271` workflows 也會等重置後繼續。
- 設定：`autoContinueAtUsageLimit`，未設定時 = `true`（`rRn(e){return _4t()??e==="absent"}`、`/config` 列 `value:r?.autoContinueAtUsageLimit??!0`，offset 236681062 / 243301257）。受管設定可強制關閉（列在 restrictive policy 清單，offset 221590411）。
- 啟用條件（`_rt` / `X9r`）：claude.ai 訂閱登入（`billingType !== "usage_based"`，API key 使用者不適用）、互動 TUI、非遠端 workspace、伺服器旗標 `tengu_marble_heron`（預設開）/ killswitch `tengu_linked_clover`（預設開）、**重置距今 ≤ 24 h（`_Rt=86400000`）**、同一重置時間只自動排一次；`seven_day_opus` / `seven_day_sonnet` 若目前模型不是被擋的那個就不排（可換模型）。
- 時機：重置時間 + 隨機 30–90 s（`X=30000` / `J=90000`）；重排退避 `I=[60000,…]`；連續重排上限 `Y=2`（`rearm_cap`）。
- 送出的內容（meta 訊息，不是使用者打字）：`Your claude.ai usage limit has reset. Continue the task you were working on when the limit was reached; do not repeat work that is already complete.`
- TUI 上可辨識的文字（`ct` 物件，offset ≈ 249795812）：
  - 已排：`Usage limit reached · continuing automatically at 3pm · esc to cancel`、`Continuing automatically at 3pm · esc to cancel`
  - 又撞：`Usage limit reached again · continuing automatically at … · esc to cancel`
  - 觸發：`Usage limit available again · continuing now`
  - 取消：`Automatic continue cancelled · /rate-limit-options to re-arm`（Esc / Ctrl+C）
  - 放棄：`Automatic continue stopped · the usage limit now resets more than 24 hours out, so this task will not resume on its own (/rate-limit-options to wait anyway)`
  - **睡過頭**（電腦休眠跨過重置）：`Your usage limit has reset` / `Press enter to continue` —— 這種情況 **CLI 不自動送**（phase `stale`）。
  - 設定關閉時：限制對話框（`/rate-limit-options`）提供「Stop and wait for limit to reset」等選項 —— **對話框開著時往 PTY 打字會被當成選單操作**。

#### 2. Codex CLI（本機 `<使用者資料夾>\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` = `codex-cli 0.162.1`；BAT 內嵌 `node_modules/@openai/codex` = `0.160.0`；WSL 依工單為 `0.160.0`）

**2a. 訊息原文** [碼]（Rust 字串，`codex.exe` offset 265216664 一帶；`UsageLimitReachedError`，欄位 `plan_type` / `resets_at` / `rate_limits` / `promo_message` / `rate_limit_reached_type`）

- 前綴固定 `You've hit your usage limit.`，後接方案相關句：`Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus),` / `Upgrade to Pro (…), visit https://chatgpt.com/settings/usage to purchase more credits` / `Visit https://chatgpt.com/settings/usage to purchase more credits` / `To get more access now, send a request to your admin`。
- 結尾（offset 265207307）：` Try again at <time>.`、` or try again at <time>.`，無重置時間時 ` Try again later.` / ` or try again later.`。
- 模型專屬：`You've hit your usage limit for <model>. Switch to another model now, …`。
- 非時間型（不該自動繼續）：`Your workspace is out of credits…`、`You hit your spend cap…`、`Usage limit reached. You've reached your usage limit. Increase your limits to continue using codex.`、`You're out of credits.`
- **訊息文字不分 5 小時 / 週**；分類只在結構化欄位（`rate_limits.primary` = 5h、`secondary` = 週，`rate_limit_reached_type`）。

**2b. 時間格式** [碼]（chrono，同一處字串 `stndrdth` / `%b %-d` / `, %Y %-I:%M %p` / `%-I:%M %p`）：同一天 → `3:05 PM`（**本地時區、無時區標示、12 小時制大寫 AM/PM**）；不同天 → `Oct 17th, 2026 3:05 PM`。

**2c. 結構化來源**

- `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` 的 `token_count` 事件帶 `rate_limits`（`primary` / `secondary` 的 `used_percent` / `window_minutes` / `resets_at`）[碼：`used_percentwindow_minutes` 等欄位字串存在；本機唯一 rollout 檔沒有此欄位 → 未實測]。要把 PTY 對應到 rollout 檔（cwd + 起始時間），對應不可靠 → 不採用。
- app-server `account/rateLimits/read` / `account/rateLimits/updated`（BAT 的 `CodexAgentPanel` `onRateLimit` 走這條）——終端分頁跑的是 TUI，不是 app-server → 不適用。
- Codex 可設定 status line / **terminal title** 項目（`/statusline`、「configure which items appear in the terminal title」；項目含 `5-hour` / `weekly` 剩餘用量）[碼]。理論上可用 `-c` 對 BAT 分頁注入 terminal title 項目、BAT 讀 OSC title；但只有剩餘百分比、沒有「被擋 / 重置時間」，且會改使用者看到的標題 → 不採用。
- **Codex 沒有內建自動繼續**（搜尋 `continue automatically` / `auto resume` / `when … reset` 無相關字串；`Daybreak` 是模型選擇功能，`Automatically switched to … due to usage limits` 是**換模型**不是等待）。

#### 3. 推薦設計

**3a. 範圍切分**

| 分頁 | BAT 做什麼 |
|---|---|
| claude（CLI ≥ 2.1.234，訂閱登入） | **不送「繼續」**（CLI 會自己送，雙送 = 兩個續行 turn）。只做：① 辨識限制並在縮圖 / toast 顯示「限制中，CLI 將於 3pm 自動繼續」或「週限制 / 超過 24 h，不會自動繼續」；② 唯一補位：畫面出現 `Your usage limit has reset` + `Press enter to continue`（stale）→ 依同一套延遲 / 取消規則**只送 Enter**（不送文字）|
| claude（舊 CLI、API key、使用者關掉設定、受管政策關閉） | 預設**不送**（設定關閉時 CLI 會開限制對話框，打字有誤選風險）；列為塔台決定事項 D2 |
| codex | 完整 PLAN-044：辨識 → 排程（重置 + 延遲）→ 再確認 → 寫入文字 + Enter |

**3b. 偵測位置與方式**：main 端 PTY 輸出串流（`PtyManager.enqueuePtyOutput` 旁加 hook，`electron/pty-manager.ts:594`），每分頁維持約 4 KB 的「去 ANSI 尾巴」。理由：隱藏 / 未掛載的分頁（BAT 重開後未造訪的分頁不掛載 `TerminalPanel`，`WorkspaceView.tsx:1380`）、detached、headless 都只有 main / server 一定看得到輸出。比對：

- 只認 1a / 2a 的**完整句型**（含 `· resets <time>` 或 `Try again at <time>.`），且 match 必須位於**行首**（去 ANSI 後，允許 TUI 前綴符號與空白），不認內文中間出現的同字串。
- 必須在**比對後輸出靜止**（沿用 `CLOSE_WORKER_IDLE_MS` 5 s 的「安靜」概念）才算成立；同一分頁的對話內容若只是「談到」這句話，通常前後還有大量輸出、或不在行首、或後面還有 agent 回覆 → 不成立。
- 時間：claude 優先用結構化（若採 `StopFailure` hook）；文字解析 `3pm` / `3:30pm` / `Oct 20, 3pm` + `(IANA)`，codex `3:05 PM` / `Oct 17th, 2026 3:05 PM`（本地時區）。解析出的時間若已過去或 > 7 天 → 視為解析失敗，不排。
- **週 / 5 小時區分**：claude 看名稱（`session limit` 才自動）；codex 文字不分 → 規則「重置距今 ≤ 5 h 15 min 才當 5 小時限制」，其餘一律只提示。也可同時當作 claude 的第二道保險。

替代方案：renderer xterm buffer 比對（優點：看的是渲染後畫面，最準；缺點：未掛載分頁看不到、背景視窗計時器節流、headless 要另做）→ 只用在**送出前再確認**（3e）。

**3c. 辨識 yolo 分頁**

- Worker：`PtyInstance.customEnv.CT_MODE === 'yolo'`（已存在，T0525 起 restart / recovery 沿用）。
- 塔台：T0562 的 `--set-role tower` 目前**不存於 main**（`electron/terminal-role.ts` 只驗證後廣播 `terminal:role-changed`），且 `--mode` 與 `--set-role` 互斥。建議擴充契約：`--set-role tower --mode yolo|on|ask|off`（CT 啟動塔台時帶上自己的模式；CT-T013 對應改），main 存進 `PtyInstance`（比照 `workorder`，restart / recovery 沿用），`terminal:role-changed` 多帶 `mode`。
- 另提供分頁右鍵「用量限制解鎖後自動繼續」手動開關（覆寫上述推得值），存 `TerminalInstance`，給非 CT 的使用情境。

**3d. 排程與取消**：新模組 `electron/usage-limit-continue.ts`（`UsageLimitContinueScheduler`，結構照 `WorkerCloseScheduler`，本機 main 與 headless `createHeadlessTerminalModule` 共用，不 import `electron`）。

- 到期時間 = `resetsAt + delayMinutes`（Settings）。同一分頁新的限制訊息 → 以最新一次為準（重設計時器）。
- 取消：等待中本機視窗 `pty:write` 且非 `isTerminalAutoReply`（T0551 同一判斷，`handlers/pty.ts:94` 已有 `noteUserInput`）；分頁結束（`onPtyExit`）；Settings 關閉；yolo 旗標被移除。
- 送出後再撞（codex 「解鎖後立刻又撞」）：允許依新的重置時間再排，但**同一分頁連續自動送出上限 2 次**（與 claude 的 `rearm_cap` 一致），之後只提示。
- 時鐘：一律用 epoch ms；電腦休眠跨過到期 → 醒來（`powerMonitor` `resume` 或下一次 tick 發現已過期）時照常走「再確認」，再確認通過才送。
- 多分頁同時撞：各自排程，彼此無關；同一時刻多分頁送出無共享資源問題。
- BAT 重開 / Terminal Server 存活：排程只在記憶體（與 close-worker 一致），重開後若畫面仍是限制訊息，replay 的輸出會**再次被偵測**而重新排程（[推]，需確認 T0108 replay 是否經過 `enqueuePtyOutput`）；Terminal Server 未存活則分頁已是空 shell，自然不排。
- detached：排程在 main，送出事件廣播給所有視窗，由擁有分頁的視窗處理（`ownsTerminalForCloseRequest` 同一套規則）。
- 遠端 headless：同一 scheduler 跑在 server，事件放 `PROXIED_EVENTS`（比照 T0536 `terminal:close-requested`）；使用者輸入只算 client 連線的 `pty:write`；到期時無 client 連著 → 不送、記日誌（Enter 由 client renderer 合成，與 `bat-notify --submit` `no-client` 同限制）。

**3e. 送出**：main 到期 → 送 `terminal:usage-limit-continue { id, text, traceId }` → 擁有分頁的 renderer：

1. **再確認**：xterm buffer 最後一屏仍含限制句型、其後沒有新的 agent 回覆、不在 alt-screen 對話框（claude 的 rate-limit 對話框）、輸入列為空；claude 分頁另外確認畫面**沒有** `continuing automatically` / `Continuing shortly`（CLI 已在處理就退出）。分頁未掛載 → 退回 main 端判斷（尾巴仍是限制句、比對後無新輸出）。
2. 寫入文字：`pty.write(id, text)`（一般 printable，用 bracketed paste 包起來更保險，[推] 需實測 codex composer 對 bracketed paste 的行為）。
3. 間隔約 150–300 ms 後以既有 `dispatchSyntheticEnterKeydown`（`src/components/TerminalPanel.tsx:480`，`bat-notify --submit` 同路徑）送 Enter，日誌沿用 `[terminal-submit]` 格式並加 `source=usage-limit`。
4. 不經 helper / RemoteServer，也就不受 helper capability 限制；本機寫入要確保**不被當成使用者輸入**而取消其他排程（例如同一 Worker 的 `--close-worker` 延遲）——這個寫入應走一條標記為自動的路徑（新 IPC 或 `pty:write` 帶 flag），**不能**走一般 `pty:write`。

**3f. Settings**（Settings → Advanced 或 Terminal 區，三語 `en` / `zh-TW` / `zh-CN`）：

- `usageLimitAutoContinue.enabled`：**預設關**（自動往 agent 打字屬高風險行為，使用者明確開啟才做；且 claude 已有 CLI 內建）。
- `usageLimitAutoContinue.text`：預設 `繼續`（多語系預設值依 UI 語言？建議固定一個值，見 D3）。
- `usageLimitAutoContinue.delayMinutes`：預設 2，夾 0–60。
- 提示：claude 分頁說明「Claude CLI 2.1.234 起自己會自動繼續，BAT 只處理 Codex 與 Claude 休眠後的 Press enter」。

**3g. 風險與不做的事**

- 誤送：最壞是在對話內容裡多出一句「繼續」，agent 可能重做或回覆「要繼續什麼」；yolo 分頁無人看守時成本可接受。claude 雙送是最實際的風險 → 3a 已排除。
- 與使用者手動繼續競態：使用者在等待中打字 → 取消（3d）；使用者在到期前一刻送出、BAT 再確認時畫面已有新回覆 → 不送（3e-1）。
- 週限制：只提示，不排（claude 名稱 / codex > 5 h 15 min 規則）。呈現：縮圖列徽章 + 一次性 toast「`<分頁>` 撞到週限制，`<重置時間>` 解除，不會自動繼續」。
- 不做：解析 claude `rate-limits.json`（非 CLI 產物）、替換使用者 status line、改使用者全域 `~/.claude/settings.json` / `~/.codex/config.toml`、對 claude 對話框做選單操作、對非時間型限制（spend cap、credits）做任何自動動作。

#### 4. 實作工單建議

**T-A（Codex 自動繼續 + claude 辨識提示）**，sizing M：

- `affects_files`（預估）：`electron/usage-limit-continue.ts`（新，偵測 + scheduler）、`electron/pty-manager.ts`（輸出 hook、`role` / `mode` 欄位）、`electron/main.ts`（接線）、`electron/handlers/pty.ts`（自動寫入路徑不算使用者輸入）、`electron/remote/headless-entry.ts` + `electron/remote/protocol.ts`（`PROXIED_EVENTS`）、`electron/preload.ts`、`src/types/electron.d.ts`、`src/components/TerminalPanel.tsx`（再確認 + 送出）、`src/App.tsx`（事件分派）、`src/components/SettingsPanel.tsx` + `src/types/index.ts`（設定）、`src/locales/{en,zh-TW,zh-CN}.json`、`CLAUDE.md`。
- 驗證：單元測試——句型比對（1a / 2a 全部變體 + 預警句 / 對話引用句的負向樣本）、時間解析（12h、整點、跨日、跨年、IANA 時區、已過期）、scheduler（延遲、取代、使用者輸入取消、自動回應不取消、上限 2 次、週限制只提示、分頁消失）；隔離 e2e：自訂 CLI 跑 node 腳本，印出 codex 樣式的限制訊息（`Try again at <now+1min 的 h:mm AM/PM>.`）後讀 stdin 記錄，延遲設 0 → 斷言 stdin 收到 `繼續\r`；另一個腳本印 claude 樣式訊息 + `continuing automatically` → 斷言不送；印 `Press enter to continue` → 斷言只收到 `\r`。不耗額度。
- **T-B（塔台 yolo 宣告）**：`bat-terminal.mjs --set-role tower --mode <m>` + main 存 role/mode，sizing S，T-A 依賴；CT-T013 需同步。
- （選）**T-C（claude `StopFailure` hook 結構化來源）**：只在 D1 選 B 時開。

**需要塔台 / 使用者決定（3 項）**

- **D1 claude 分頁怎麼處理**：A（推薦）信任 CLI 內建，BAT 只辨識 + 提示 + stale 時送 Enter；B 同 A 再加 `StopFailure` hook 注入取得結構化事件（較準，但要改 claude 啟動命令 `--settings`）；C 照 PLAN-044 原樣也送「繼續」（會雙送，不建議）。
- **D2 claude 內建自動繼續不可用時**（API key、舊 CLI、使用者 / 管理員關閉）：A（推薦）不送，只提示；B 送文字（需先確認畫面不是限制對話框）。
- **D3 Settings 預設**：A（推薦）預設關、文字固定 `繼續`、延遲 2 分；B 預設開（yolo 分頁才生效）；C 文字依 UI 語言（`continue` / `繼續` / `继续`）。

### 互動紀錄

無（`CT_INTERACTIVE=0`，yolo）。

### Renew 歷程

無。

### 遭遇問題

- 無實測樣本：本機 claude / codex session 紀錄與 BAT 日誌皆無限制事件，工單禁止為觸發限制耗額度 → 訊息原文全部來自 CLI 二進位內嵌字串（[碼]），未在真實 TUI 上看過排版（前綴符號、換行位置）。實作工單的 e2e 以假 CLI 腳本覆蓋，第一次真實撞限制時建議塔台留意 `[usage-limit]` 日誌。
- claude 內建自動繼續的伺服器旗標（`tengu_marble_heron` / `tengu_linked_clover`）由 Anthropic 端控制，BAT 無法得知當下值；設計已讓 BAT 以畫面上的 `continuing automatically` 文字判斷 CLI 是否接手。
- 收尾順序偏差：報告與最終狀態在同一個 commit（`commit` 欄位無法寫入自己的 hash，留給塔台記錄），與 ct-exec「先 commit 再改最終狀態」略有不同。

### 回報時間

2026-10-16T15:01:28+0800

---

## 塔台收單（第六十七 session，2026-10-16T15:04:16+0800）

- ✅ **T0564 已確認 DONE**：commit `d090ec4d`（只含本單）。證據分級清楚（[碼] / [文] / [推]），無實測樣本（未耗額度，符合工單）。
- **關鍵發現**：claude CLI ≥ 2.1.234 內建 `autoContinueAtUsageLimit`（預設開），BAT 對 claude 分頁再送「繼續」會雙送 → PLAN-044 範圍改以 Codex 為主、claude 只辨識 / 提示 / stale 補 Enter（待 D1–D3）。
- **契約影響**：塔台 yolo 辨識建議 `--set-role tower --mode <m>`（T-B）；T0562 尚未發版，可在 `0.6.1-pre.6` 前擴充，CT-T013 需同步 → 待使用者決定。
- D1–D3 交使用者決定後開實作單。
