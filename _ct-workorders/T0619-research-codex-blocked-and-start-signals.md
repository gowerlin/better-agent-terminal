---
schema_version: 1
schema_kind: workorder
id: T0619
title: "研究：PLAN-047 M1b-2 codex 分頁的 `blocked` 與啟動信號（codex 0.163.0 實測 OSC 9、yolo 核准模式、啟動信號候選）"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: M
created_at: "2026-10-18T11:25:51+0800"
started_at: "2026-10-18T11:27:20+08:00"
updated_at: "2026-10-18T11:51:14+08:00"
completed_at: "2026-10-18T11:51:14+08:00"
depends_on: []
related:
  - "T0574 回報區 R2（codex 建議 OSC 9 `approval-requested`（`-c tui.notifications`）＋句型後援；**未實際觸發**，只有文件 / 二進位字串證據，當時 codex 0.162.1）"
  - "T0590 / T0594 / T0597（claude hooks 的 `blocked`）、T0600（claude `SessionStart` 啟動確認；codex 一律 `agentStarted: null`）、T0607（codex 也回 `blocked` / `tower`，來自問答 store）"
  - "T0592（`e2e/t0592-codex-tower-worker.spec.ts`：隔離 BAT + 內嵌 codex `app-server`、隔離 `CODEX_HOME`，不呼叫模型；M1b-2 測試沿用此架構，D153）"
  - "並行：T0620（claude `ElicitationResult` 清除，改 `electron/terminal-blocked-state.ts` / `electron/bat-mcp-launch.ts` / `scripts/bat-hook.mjs`）—— 本單不改任何產品檔，無重疊"
affects_files:
  - _ct-workorders/T0619-research-codex-blocked-and-start-signals.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品檔、不 commit 產品檔**；實驗用的腳本、設定、擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。只 commit 本工單檔（`git commit --only`）。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不得修改使用者的 `%APPDATA%\\BetterAgentTerminal\\settings.json`、`~/.codex/`（含 `config.toml`）、`~/.claude/`；codex 實驗一律用隔離的 `CODEX_HOME`（暫存目錄）。要讀使用者設定（例如 codex preset 的自訂參數）可以讀，回報只寫參數名，不寫任何權杖 / API key / 帳號資訊。"
  - "🔴 需要呼叫模型時用最便宜的設定、最短的 prompt，總共只為了觸發信號；回報記下大約用了幾次模型呼叫。codex 登入狀態不得複製到 repo。"
  - "🔴 yolo Worker：不得問使用者；範圍內無法決定且猜錯會返工的選擇，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
---

# T0619 — 研究：codex 分頁的 `blocked` 與啟動信號

## 背景

claude 分頁靠 hooks 回報 `blocked`（T0590）與啟動（T0600），codex 分頁目前一律 `blockedDetection: none`、`agentStarted: null`。
T0574 建議 codex 走 OSC 9 `approval-requested`，但沒有實際觸發過，codex 也已從 0.162.1 升到 0.163.0。
另外，CT 的 yolo codex Worker 若以略過核准的模式執行，可能根本不會停下來等核准，`blocked` 偵測的價值要先確認。
**啟動信號**對 yolo 派工最直接（helper `--wait-started` 對 codex 目前只能回 `started: unknown`）。

## 要回答的問題

### Q1 — yolo codex Worker 會不會停下來等使用者？

1. BAT 派 codex Worker 時實際的啟動命令與參數：讀使用者 `settings.json` 的 codex preset 自訂參數（只寫參數名）、`electron/terminal-command-handlers.ts` / `buildLaunchCommand` 產生的命令。核准模式與 sandbox 模式是什麼？
2. 在這個模式下，codex 0.163.0 還有哪些情況會停下來等使用者（例如有沒有 `request_user_input` 之類的工具、plan mode、MCP elicitation、登入過期、信任目錄提示）？以二進位字串 / 文件 / 實測為證據，標證據等級。
3. 非 yolo（使用者手動開的 codex 分頁、預設核准模式）會停下來的情況。

### Q2 — OSC 9 在 codex 0.163.0 的實際行為（實測）

在隔離的 `CODEX_HOME` 下，以 `-c tui.notifications=…`、`-c tui.notification_method="osc9"`、`-c tui.notification_condition="always"`（鍵名以 0.163.0 實際為準）啟動 codex TUI（在 BAT 分頁或 node-pty 裡，終端寬高正常），用非 yolo 核准模式要它執行一個需要核准的指令：

1. 擷取 PTY 原始輸出，確認 OSC 9 序列的實際位元組（`ESC ] 9 ; … BEL/ST`）、內容、送出時機（距離畫面出現核准提示多久）。
2. 有哪些通知類型會送（`approval-requested`、`agent-turn-complete`、其他）？核准後、拒絕後、Esc 取消後各送什麼？有沒有能當「清除」的信號？
3. 視窗沒有焦點時 / `notification_condition` 各值的差異；codex 在 BAT 分頁內是否判斷為「沒焦點」。
4. 這些 `-c` 參數會不會改變 codex 其他行為（例如桌面通知、聲音）、會不會與使用者自己的 `config.toml` 衝突。
5. xterm.js 對 OSC 9 的處理：BAT renderer 目前收到 OSC 9 會怎樣（顯示亂碼、忽略、或觸發什麼）？主行程（PtyManager / Terminal Server）能否在不改寫輸出的情況下偵測它（只讀程式碼，不改）。

### Q3 — codex 的啟動信號候選

比較至少以下候選，各給出：何時出現、可靠度、在 BAT 哪一層能取得、成本：

- BAT MCP shim（`scripts/bat-mcp.mjs`）在 codex 啟動時被 codex 啟動並向 BAT 認證 —— 主行程能否據此記「已啟動」（看 shim 認證的時機是 codex 啟動時還是第一次用 tool 時）。
- OSC 9 / 其他 OSC（例如視窗標題 OSC 0 / 2）在啟動時是否會送。
- codex 的 `notify` 設定（`agent-turn-complete`）—— 只在回合結束時，能否當啟動後的第一個信號。
- `CODEX_HOME/sessions/` 檔案建立、輸出句型等。

### Q4 — 建議與介面草案

1. 值不值得做：分 yolo / 非 yolo 說明 `blocked` 偵測的實際價值；啟動信號的價值。
2. 推薦方案：`blockedDetection` 對 codex 要不要新增值（例如 `osc`）、`agentStarted` 的來源、清除規則；沿用 T0590 / T0600 契約的哪些欄位、哪裡要擴充（列出契約變更草案，並標明 CT 端是否需要跟著改）。
3. 實作切分與估計（幾張工單、要動的檔案、測試方式 —— 能否沿用 T0592 的「真 codex、不呼叫模型」e2e 架構）。
4. 風險與已知限制。

## 交付

- 回報區：Q1–Q4 逐題作答，每個結論標證據等級（`實測` / `二進位字串` / `官方文件` / `推論`），附實測步驟、codex / BAT 版本、擷取片段（去掉任何權杖）。
- 模型呼叫次數概估。
- 不改產品檔；完成後送 `T0619 完成`。

---

## 回報區

### 結論摘要（給塔台）

1. **codex 0.163.0 自己會在 PTY 送一個機器可讀的狀態序列 `ESC ] 7501 ; state=<idle|working|blocked> : app=codex ESC \`**，結束時送 `ESC ] 7501 ; state=clear ESC \`。不需要任何 `-c` 設定、不需要 hooks / 信任、與通知設定 / 焦點 / `TERM_PROGRAM` 無關【實測】。0.162.1 與 0.159.2 的二進位沒有這個字串【二進位字串】，所以門檻是 **codex `>= 0.163.0`**。
2. 用它可以同時做 codex 的 `blocked`（核准提示、Plan mode 提問 → `state=blocked`；核准 / 拒絕 / Esc 後回 `working` 或 `idle`）與**啟動信號**（TUI 就緒後約 0.5 s 送第一個 `state=idle`；卡在啟動前的「Trust this folder?」/「Hooks need review」畫面時完全不送）【實測】。
3. T0574 建議的 OSC 9 **不建議**當主信號：只有在 codex 判斷「沒焦點」或 `notification_condition="always"` 時才送、沒有清除信號、內容是給人看的句子；要用還得以 `-c` 覆寫使用者的 `tui.*` 設定【實測】。
4. codex 0.163.0 也有與 claude 相容的 hooks（`SessionStart` / `PermissionRequest` / `PreToolUse` / `Stop` …，全部實測觸發），但經 `-c` 注入的 hooks 預設要使用者在啟動畫面「Hooks need review」信任，**這個畫面連 `--yolo` 也會擋住 Worker**【實測】。可經 `-c hooks.state=…` 預給信任雜湊（演算法已重現、會與使用者既有信任合併），但雜湊格式是未公開的內部格式 —— 列為備案，不建議當第一步。
5. 建議：**做**。新增 `blockedDetection: osc`（觀察到 OSC 7501 即設定），`agentStarted` 來源 = 第一個 OSC 7501；CT 需要跟著改（斷點 D 接受 `osc`；`--wait-started` 對 codex 不再固定 `unknown`）。估 2 張 BAT 工單 + 1 張 CT 工單；e2e 可沿用 T0592「真 codex、不呼叫模型」架構，改用本機假 Responses API 驅動真 TUI（本單實驗即是此方式，**0 次模型呼叫**）。

### 環境 / 版本 / 方法

- codex：`codex-cli 0.163.0`（`C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`，即 BAT 分頁 shell 解析到的 `codex`）。BAT：repo `0.7.0-pre.8`（main，本單不改產品檔）。Windows 11，node v24.22.0，`@lydell/node-pty` 1.1.0（repo 的 node_modules）。
- 實驗架構（全部在 scratchpad，未寫進 repo）：`run.cjs` 起一個本機假 OpenAI Responses API（SSE），以 `-c model_provider="mock"` + `-c model_providers.mock={…base_url="http://127.0.0.1:<port>/v1",wire_api="responses"}` 指向它；node-pty（`xterm-256color`、120x30）跑**真的 codex TUI**，每次一個全新的隔離 `CODEX_HOME`（無登入）。假伺服器第一次回 `exec_command`（帶 `sandbox_permissions: "require_escalated"`，`-a on-request -s read-only` 下必觸發核准），工具結果回來後回一則 `ok` 訊息；`REPLY_TOOL=rui` 時改回 `request_user_input`。PTY 原始輸出逐 chunk 記錄（相對時間戳），另有 hook 探針 `hook.cjs`（只寫檔、不輸出、exit 0）、MCP 探針 `mcp.cjs`。
- **模型呼叫次數：0**（沒有任何請求送到 OpenAI；codex 登入狀態沒有複製到任何地方，隔離 `CODEX_HOME` 為空目錄）。未修改 `%APPDATA%\BetterAgentTerminal\settings.json`、`~/.codex/`、`~/.claude/`（只讀）。
- 為了判定 OSC 7501 的引入版本，從 npm registry 下載 `@openai/codex@0.162.1-win32-x64`、`@openai/codex@0.159.2-win32-x64` tarball 到 scratchpad 的獨立目錄，**只 grep 二進位字串、未執行**，查完已刪除。

### Q1 — yolo codex Worker 會不會停下來等使用者？

**1. 實際啟動命令**

- 使用者 Settings `agentCustomArgs`：`codex-cli` = `--yolo`（另 `codex-agent` = `--yolo`）；`defaultAgent` = `claude-cli`；`windows.json` 內沒有工作區層級的 `agentCustomArgs` / `defaultAgent`【實測：讀檔，只記參數名】。
- helper 派工命令（`createAgentPromptCommandBuilder`，`electron/terminal-command-handlers.ts`）：`codex [-c features.daemon_auto_start=false（BAT 以系統管理員身分執行時）] <BAT MCP 的 -c mcp_servers.bat.*> --yolo '$ct-exec T####'`。`agentRegistry.buildLaunchCommand('codex-cli', undefined, …)` 的 `options` 為 `undefined`，所以 `approval-mode` / `sandbox` launch option 不參與；核准 / sandbox 完全由自訂參數決定【程式碼】。
- `--yolo` 是 `--dangerously-bypass-approvals-and-sandbox` 的別名（0.163.0 `--help` 不列出，但二進位字串 `dangerously-bypass-approvals-and-sandboxyolo` 相鄰，且 `codex --yolo` 可正常啟動）【二進位字串 + 實測】。⇒ **核准模式 never、sandbox danger-full-access**。0.163.0 的 `-a` 只剩 `on-request` / `never`（`untrusted` 已移除，實測 `invalid value 'untrusted'`）。
- 實測 `--yolo` + argv prompt：`idle → working → idle`，要求升權的 `exec_command` 直接執行，沒有核准畫面、沒有 `blocked`【實測】。

**2. yolo 模式下仍會停下來的情況**

| 情況 | 會不會停 | OSC 7501 | 證據 |
|---|---|---|---|
| 工作目錄所在 git repo 未信任 →「Trust this folder? 1. Trust and continue 2. Quit」 | **會**（`--yolo` 也一樣，啟動即擋） | 完全不送（連 `idle` 都沒有）；MCP server 也還沒啟動 | 實測 |
| BAT worktree（`git worktree add` 出的目錄），主 repo 已在 config.toml 信任 | 不會（沿用主 repo 的信任） | 正常 | 實測（暫存目錄的 git worktree）|
| 新增 / 變更的 hooks →「Hooks need review … 1. Review hooks 2. Trust all and continue 3. Continue without trusting」 | **會**（`--yolo` 也一樣，啟動即擋） | 不送 | 實測（以 `-c hooks.*` 注入時）；使用者 / 專案 / plugin 的 hooks 變更同樣會觸發【推論，同一個 trust 機制】 |
| 有新版時的更新提示（`Update now` / `Skip` / `Skip until next version`；設定鍵 `check_for_update_on_startup`） | 可能會（啟動時） | 推論同上：不送 | 二進位字串（未實際觸發）|
| `request_user_input`（Default mode） | 不會：工具回 `request_user_input is unavailable in Default mode` 給模型，回合照常結束 | `working → idle` | 實測（工具清單仍列出它，描述寫 "only available in Plan mode"；`default_mode_request_user_input` feature = under development / false）|
| `request_user_input`（Plan mode，使用者 `/plan` 或 Shift+Tab 切換後） | **會** | `blocked`（立即）| 實測；派工的 Worker 從 Default mode 開始，模型無法自行切換模式（工具說明：只有不同的 `<collaboration_mode>` 指示會改模式）|
| MCP elicitation | 可能（`tool_call_mcp_elicitation` stable / true、`auth_elicitation` stable / true） | 未測 | 二進位字串 + `codex features list`；BAT MCP shim 不發 elicitation |
| 登入過期 / 需要重新登入 | 可能（`Sign in with ChatGPT` 等畫面字串） | 未測 | 二進位字串 |
| 用量上限 | 不停在提示，回合結束（T0566 的文字辨識另行處理） | — | 既有 T0566 |

⇒ yolo codex Worker 在「回合中」幾乎不會停下來等使用者（核准被略過、Default mode 沒有提問工具）；**真正會卡住的是啟動前的全畫面提示**（未信任目錄、hooks review、可能的更新提示）。這類卡住正好是「啟動信號」能抓到的（沒有 OSC 7501），不是 `blocked` 能抓到的。

**3. 非 yolo（使用者手動開的 codex 分頁）**

- 預設設定（使用者 `config.toml`：`sandbox_mode = "workspace-write"`，未設 `approval_policy`，預設應為 `on-request`【推論】）：模型要求升權 / 沙箱外操作時出現核准提示（「Would you like to run …」），`blocked` 直到使用者按 `y` / `n` / Esc【實測，以 `-a on-request -s read-only` 重現】。
- Plan mode 的 `request_user_input` 提問、啟動前的信任 / hooks review / 更新提示同上表。
- BAT 手動開的 codex 分頁走 renderer `withBatMcpLaunchArgs`，使用者自訂參數 `--yolo` 同樣套用；只有使用者自己在 shell 打 `codex` 或改了參數時才是非 yolo【程式碼】。

### Q2 — OSC 9 在 codex 0.163.0 的實際行為（實測）

設定鍵 0.163.0 實際為 `tui.notifications`（bool 或類型清單）、`tui.notification_method`（`auto` / `osc9` / `bel`）、`tui.notification_condition`（`unfocused` / `always`）【二進位字串：`NotificationMethod osc9 bel`、`NotificationCondition unfocused always`；實測可用】。通知類型共 4 種：`agent-turn-complete`、`approval-requested`、`plan-mode-prompt`、`async-question`【二進位字串】。

**1. 位元組與時機**（`-c tui.notifications=true -c tui.notification_method="osc9" -c tui.notification_condition="always"`，`-a on-request -s read-only`）

```
t=2.084  ESC]7501;state=working:app=codex ESC\
t=2.119  ESC]9;Approval requested: "C:\\Program Files\\PowerSh... BEL      ← 1b 5d 39 3b … 07
t=2.165  （畫面輪詢 100 ms 看到核准提示）
t=3.067  ESC]7501;state=blocked:app=codex ESC\                          ← 標題同時變成 "[ ! ] Action Required | work"
t=5.174  （按 y）ESC]7501;state=working:app=codex ESC\
t=5.492  ESC]9;ok BEL                                                    ← agent-turn-complete，內容 = 最後一則助理訊息
t=5.492  ESC]7501;state=idle:app=codex ESC\
```

- OSC 9 以 **BEL** 結尾、內容是給人看的句子並截斷（`Approval requested: "<命令前段>..."`；Plan mode 為 `Plan mode prompt: <header>`；回合結束為最後一則訊息本文）。
- OSC 9 approval 比畫面出現核准提示早約 0.03 s；OSC 7501 `blocked` 在 prompt 由鍵盤輸入的情況晚約 0.9–1.0 s（與標題閃爍同一拍），prompt 由 argv 帶入的情況只晚約 0.02 s；Plan mode 提問則與 OSC 9 同一毫秒。⇒ 兩者都 ≤ 約 1 s。

**2. 各情況送什麼**

| 動作 | OSC 9 | OSC 7501 |
|---|---|---|
| 出現核准提示 | `Approval requested: …` | `blocked` |
| 核准（y） | 無（回合結束時才有 `agent-turn-complete`） | `working`，回合結束 `idle` |
| 拒絕（n） | 無 | `idle`（回合中止） |
| Esc 取消 | 無 | `idle` |
| Plan mode 提問 | `Plan mode prompt: Pick` | `blocked` |
| 回合結束 | 最後一則訊息 | `idle` |
| `/quit`、Ctrl+C ×2 | 無 | `state=clear` |

⇒ **OSC 9 沒有任何可當「清除」的信號**；OSC 7501 每個轉換都有。

**3. `notification_condition` 與焦點**

- codex 會開 DEC 1004（focus reporting，另開 1003/1006 any-event 滑鼠追蹤、2004 bracketed paste、2026、1049）。
- `unfocused`（預設）：沒收到任何焦點事件 → **不送**（codex 預設當成有焦點）；收到 `ESC [ I` → 不送；收到 `ESC [ O` → 送 OSC 9（核准 + 回合結束）。`always` → 一律送【實測】。
- 完全不設定（預設 `auto`）+ 收到 `ESC [ O` → 送**純 BEL**（`TERM_PROGRAM=better-agent-terminal`、`vscode`、`WezTerm` 下的 OSC 7501 行為相同；`auto` 對 BAT 選 BEL）【實測】。
- BAT 分頁內：xterm.js 在 DEC 1004 開啟時，textarea blur / focus 就送 `ESC [ O` / `ESC [ I`，所以背景分頁、BAT 視窗失焦時 codex 會判斷為「沒焦點」【程式碼推論，未在真 BAT 分頁量測】。OSC 7501 不受焦點影響【實測】。

**4. `-c` 參數的副作用 / 衝突**

- `-c tui.*` 只在該次啟動覆寫、不寫入 `config.toml`，但會蓋掉使用者自己的 `[tui] notifications*`（使用者目前沒設）。在 BAT 內 OSC 9 / BEL 都不會變成桌面通知或聲音（見第 5 點），所以實際副作用只有「使用者在 BAT 外的設定被忽略」這件事本身【推論】。
- 🔴 `-c notify=[…]` **會取代**使用者的 `notify`（實測：config.toml 的 notify 在加了 `-c notify` 後不再被呼叫）。使用者的 `~/.codex/config.toml` 目前有 `notify = [<computer-use 程式>, "turn-ended"]`，BAT 若注入 `notify` 會弄壞它 ⇒ 不得用 `notify`。另外 `notify` 每個回合可能觸發不只一次（實測一個回合 2 次 `agent-turn-complete`，thread-id 不同，含 codex 內部的標題產生子回合）。
- `tui.terminal_title=[]` 只關標題，不影響 OSC 7501【實測】。

**5. BAT 對 OSC 9 / 7501 / BEL 的處理（只讀程式碼）**

- renderer：`@xterm/xterm` 5.5.0 內建 OSC handler 只有 `0, 1, 2, 4, 8, 10, 11, 12, 104, 110, 111, 112`（`node_modules/@xterm/xterm/lib/xterm.js`）；OSC 9 / 7501 / 21337 走 parser 的 fallback（no-op）→ **靜默丟棄，不顯示亂碼**。BAT 沒有 `registerOscHandler`、沒有訂閱 `onBell` / `onTitleChange`（`src/` grep），xterm 5 沒有內建鈴聲 ⇒ BEL 無聲、標題不使用。縮圖 `TerminalThumbnail.tsx` 會先剝掉 OSC【程式碼】。
- 主行程：所有 PTY 輸出（direct node-pty、child_process 後援、Terminal Server 的 `handlePtyData`）都經 `PtyManager.enqueuePtyOutput`（`electron/pty-manager.ts`），該處已有 `launchSuspect.output()` 與 `deps.onPtyOutput`（main / headless 的 usage-limit 掃描）兩個只讀的 tap ⇒ **可以在不改寫輸出的情況下偵測 OSC 7501**，本機與 headless 共用同一個點。需要處理 chunk 邊界（序列被切在兩個 chunk；可比照 `src/lib/usage-limit.ts` 的 `INCOMPLETE_ESCAPE_TAIL`）。例外：BAT 重開時 `handleReplayBuffer` 直接 broadcast 重播內容、不經 `enqueuePtyOutput`，重開前的狀態不會被重新推導【程式碼】。

### Q3 — codex 的啟動信號候選

| 候選 | 何時出現 | 可靠度 | BAT 哪一層取得 | 成本 / 問題 |
|---|---|---|---|---|
| **OSC 7501 第一個 `state=`** | TUI 就緒後約 0.5 s（無 prompt、argv prompt、`--yolo` 都一樣）；卡在信任 / hooks review 畫面時**不送** | 高（每次 spawn 都有、與設定無關）；只限 codex `>= 0.163.0` | 主行程 `enqueuePtyOutput` | 低：純觀察、無注入。「沒看到」無法區分「舊 codex」與「卡住」→ 需要版本判定（見 Q4 風險）|
| BAT MCP shim（`scripts/bat-mcp.mjs`） | codex 在啟動 +0.31 s 就 spawn MCP server 並送 `initialize` / `tools/list`（沒有 prompt 也會；信任畫面期間不會）【實測，探針 MCP server】 | 中：shim 目前**只在第一次 tool 呼叫時**才連 BAT（`#connect()` 由 `invoke()` 觸發）【程式碼】，所以現況不能當信號；要用得改 shim 在 `initialize` 時連線回報、並加一個 channel | shim → RemoteServer → 主行程 | 中：改 shim + 新 channel；Settings 關閉 BAT MCP 或 codex 版本不同時失效；也只代表「codex 載入了設定」，不代表 TUI 已就緒 |
| codex hooks `SessionStart` | **TUI 模式下延到第一個回合**才觸發（無 prompt 的 TUI 不觸發；派工帶 argv prompt 時 ≈ 啟動 +0.5 s）；payload `source: "startup"` | 高（觸發時）；但經 `-c` 注入要信任，未信任會擋住啟動 | `bat-hook.mjs` → `terminal:report-hook`（沿用 T0600） | 高：信任雜湊（見 Q4 備案）；使用者 / 專案 hooks 變動也會冒出 review 畫面 |
| `notify`（`agent-turn-complete`） | 只在回合結束 | 低：派工的第一個回合可能很長 | 外部程式 | 會取代使用者的 `notify`（實測）⇒ 不可用 |
| OSC 9 | 只在核准 / 回合結束，且要 unfocused 或 `always` | 低 | 主行程 | 要覆寫 `tui.*`；不是啟動信號 |
| OSC 0 / 2 視窗標題 | spawn 後約 0.05 s 先送 codex 執行檔路徑，之後 `work`（目錄名）與 spinner | 低：內容是給人看的、`tui.terminal_title` 可改 | 主行程 | 不建議 |
| `CODEX_HOME/sessions/…/rollout-*.jsonl` | 第一個回合開始時才建立（無 prompt 的 TUI 不建立） | 低：BAT 分頁共用使用者的 `~/.codex`，多分頁無法歸屬 | 檔案監看 | 不建議 |
| 輸出句型（`OpenAI Codex (v…)` 等） | 啟動畫面 | 低（字串會改） | 主行程 | 不建議 |

⇒ 推薦 **OSC 7501**。

### Q4 — 建議與介面草案

**1. 值不值得做**

- `blocked`（yolo）：回合中幾乎不會發生（Q1）；價值在「異常偵測」——Worker 被切到 Plan mode、遇到 MCP elicitation 等。值不高，但用 OSC 7501 做幾乎零成本（與啟動信號共用同一個解析器）。
- `blocked`（非 yolo / 使用者手動分頁）：核准提示是常態，`blocked` 讓塔台 / 使用者看得到「在等你」（斷點 D 的非 yolo 告知型）。值中等。
- 啟動信號（yolo 派工）：**價值最高**。codex Worker 目前 `--wait-started` 一律 `started: unknown`；而 codex 實際會卡住的地方正是啟動前畫面（未信任 repo、hooks review、更新提示），OSC 7501 恰好能區分「已就緒」與「卡在啟動畫面」。

**2. 推薦方案與契約變更草案**（以下為草案，需塔台決策；T0590 / T0600 契約不得單方更改）

- 新解析器（唯一實作建議：`src/lib/codex-terminal-state.ts`，main / headless 共用、不 import electron，比照 `usage-limit.ts`）：從 PTY 輸出抽出 `ESC ] 7501 ; state=(idle|working|blocked|clear)[:app=codex] (ESC \ | BEL)`，處理 chunk 邊界；接在 `PtyManager.enqueuePtyOutput`（或 `deps.onPtyOutput`）。只讀、不改輸出。
- C-1 `blockedDetection` 新增值 **`osc`**：PTY 第一次出現 OSC 7501 時設定（觀察式，不依賴啟動決策，所以使用者手動開的 codex、在 shell 裡自己打 `codex` 都涵蓋）；codex 派工可在啟動時預設為 `osc`（見 C-3）。`hook` / `none` 語意不變。
- C-2 `blockedReason` 新增值（建議 **`input`**：agent 在等使用者，種類 OSC 7501 不區分）。`state=blocked` → `blocked` / `input`；`working` / `idle` / `clear` / PTY 結束 → 清除。**不**以使用者輸入清除（codex 自己會送轉換）。優先序沿用：`exited` > hook reason / `input` > `tower` > `working` / `idle`。
  - 備選：BAT 另注入 `-c tui.notifications=["approval-requested","plan-mode-prompt"]`、`notification_method="osc9"`、`notification_condition="always"`，以 OSC 9 開頭（`Approval requested:` / `Plan mode prompt:`）把 reason 細分為 `permission` / `question`。不建議第一步：要覆寫使用者 `tui.*`、句子格式未公開。
- C-3 `agentStarted`：`blockedDetection: osc` 的分頁，第一個 OSC 7501 → `true` + `agentStartedAt`；之前 → `false`。只記每個 PTY 第一次；生命週期比照 T0600（PTY 結束 / restart / recovery 清除）。`terminal:wait until: 'agent-started'`、helper `--wait-started` 對 codex 生效。
  - 版本判定：OSC 7501 只在 codex `>= 0.163.0`。派工時若 BAT 無法確認版本，就把分頁記為 `none`（維持 `unknown`），避免舊 codex 被誤判 `unconfirmed`（exit 8）。確認方式需實作單決定（例如派工前對解析到的 `codex` 跑 `codex --version`，`execFile` + timeout；或「觀察式」：只有看到過 7501 的 codex 才算，派工首次一律 `unknown`）。
- C-4 不建議新增 `state` 值；`state=clear`（codex 正常結束但 shell 還在）視同清除，`state` 回 `idle`。
- **CT 需要跟著改**：斷點 D 目前只認 `blockedDetection: hook` 與三種 hook reason（`yolo-mode.md` § 斷點 D），要加上 `osc` / `input`；`auto-session.md` 的 `agentStarted` / `started: unknown` 說明（「codex 一律 unknown」）要改。CT 版本需 MINOR。
- 備案（不建議第一步）：codex hooks。0.163.0 的 hooks 事件 `PreToolUse PermissionRequest PostToolUse PreCompact PostCompact SessionStart SessionEnd UserPromptSubmit SubagentStart SubagentStop Stop Interrupt`，payload 欄位與 claude 相同（`hook_event_name`、`session_id`、`turn_id`、`tool_name`=`Bash`、`permission_mode`=`default`…），hook 程序的 env 有 `CODEX_COMPANION_SESSION_ID` / `CODEX_COMPANION_TRANSCRIPT_PATH` / `CODEX_HOME`【實測】。可經 `-c hooks.<Event>=[{hooks=[{type="command",command="…",timeout=5}]}]` 注入，信任可經 `-c hooks.state={'C:\<session-flags>\config.toml:<event_snake>:0:0'={trusted_hash="sha256:<hex>"}}` 預給（TOML key 必須用單引號字串，雙引號會因 `\<` 解析失敗），`<hex>` = `sha256(鍵排序的精簡 JSON {"event_name":"session_start","hooks":[{"async":false,"command":"…","timeout":5,"type":"command"}]})`【實測：演算法重現、預給後無 review 畫面、hook 正常觸發；與使用者 config.toml 既有的 `hooks.state` 合併，使用者自己的 hook 照跑】。風險：雜湊格式是未公開內部格式，codex 一改就會讓每個 Worker 卡在 review 畫面；`--dangerously-bypass-hook-trust` 會連使用者 / 專案 hooks 一起略過信任，不可用。
- 附帶建議（可併入實作單或另開）：派工 codex 時考慮 `-c check_for_update_on_startup=false`，避免更新提示擋住 Worker（未實測更新提示本身）。

**3. 實作切分與估計**

| 單 | 內容 | 主要檔案 | 測試 |
|---|---|---|---|
| A（BAT，M） | OSC 7501 解析器 + `blockedDetection: osc` / `blockedReason: input` / `agentStarted` 來源；state 查詢、`terminal:wait`、helper `--wait-started` 對 codex 生效；版本判定 | 新 `src/lib/codex-terminal-state.ts`、`electron/pty-manager.ts`（`enqueuePtyOutput` tap）、`electron/terminal-blocked-state.ts`（型別、tracker）、`electron/terminal-query-handlers.ts`、`electron/bat-mcp-launch.ts`（codex 啟動決策）、`scripts/bat-terminal.mjs` / `scripts/bat-mcp.mjs`（說明、列舉）、docs `blocked-state.md` / `worker-launch-confirmation.md`、CLAUDE.md 對應節 | unit：解析器（chunk 邊界、BEL / ST 結尾、非 codex 的 7501）、tracker 轉換表；source guard |
| B（BAT，S–M） | e2e：沿用 T0592 隔離 BAT + 假 `codex.cmd` 架構，但改成啟動**真 codex TUI** 並以本機假 Responses API 驅動（本單 `run.cjs` 的方式）：派工 → `agentStarted: true`；核准提示 → `blocked` / `input`；按 y → 清除；未信任 git repo → `--wait-started` exit 8 | 新 `e2e/t06xx-codex-osc-state.spec.ts` | 0 次模型呼叫 |
| C（CT） | 斷點 D 接受 `osc` / `input`；`agentStarted` / `started:` 說明更新 | CT skill references | CT 驗證工單 |

合計約 2 張 BAT + 1 張 CT（A、B 可合成一張 L）。

**4. 風險與已知限制**

- OSC 7501 是未公開的介面（官方文件未查到；只有二進位字串與實測），codex 可能改格式或移除 → 解析器要寬鬆（只認 `state=` 值）、版本升級時跑 e2e（比照 CLAUDE.md「codex 升版時必跑 t0592」）。
- 只有 codex `>= 0.163.0`；0.162.1 / 0.159.2 沒有。
- OSC 7501 `blocked` 不區分核准 / 提問 / elicitation（reason 只能 `input`）。
- 啟動前的畫面（信任、hooks review、可能的更新提示）不送任何 7501 → 只能表現為「未啟動」，不是 `blocked`；塔台看到的是 `--wait-started` exit 8，需要人去分頁處理。
- BAT 重開（Terminal Server 存活）時重播內容不經 `enqueuePtyOutput`，重開前的 codex 狀態遺失，直到下一次轉換（可在 `handleReplayBuffer` 掃最後一個 7501 補救，實作單決定）。
- 遠端（WSL / SSH / Docker）的 Linux / macOS codex 是否同樣送 7501：未測（推論：同一套 TUI 程式碼）。
- 未在真的 BAT 分頁實測（以 node-pty 量測；BAT 的輸出路徑同為 node-pty → `enqueuePtyOutput`）；BAT 分頁的焦點事件行為為程式碼推論。
- codex TUI 會開 any-event 滑鼠追蹤（1003/1006），codex 分頁內 BAT 右鍵選單依 T0568 不出現（需 Shift + 右鍵），與本單無關，僅記錄。
- 另見二進位字串 `ESC]21337;status=;indicator=;status-color=;detail=`（另一種狀態 OSC），實驗中從未送出，用途 / 觸發條件未知。

### Landing / 執行紀錄

- Landing check：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 下；C-3 不適用（`affects_files` 只有本工單）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有需要問塔台的問題（研究結論以建議 + 草案呈現，決策留給塔台）。
- 產品檔：未修改。`src/styles/settings.css` 的 M 不是本單變更，未動。
- Commit：只 commit 本工單檔（`git commit --only`）；不 push。實驗檔留在 scratchpad `C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\62d24047-b982-49bb-815a-39730b996ee5\scratchpad\exp\`（`run.cjs` / `an.cjs` / `hook.cjs` / `mcp.cjs` / `hash.cjs`、各次擷取在 `out\`）。

### 互動紀錄

（無）
