---
schema_version: 1
schema_kind: workorder
id: T0596
title: "研究：pre.4 實機 AskUserQuestion 回報 `blocked` / `permission`（預期 `question`），以及滑鼠回答後是被哪個事件清除"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T02:25:48+0800"
started_at: "2026-10-18T02:26:37+0800"
updated_at: "2026-10-18T02:31:02+0800"
completed_at: "2026-10-18T02:31:02+0800"
depends_on: [T0590, T0594]
related:
  - "CLAUDE.md「blocked 狀態偵測（PLAN-047 M1b / T0590）」小節；docs/agent-guide/blocked-state.md"
  - "CT-T017（已轉交 CT，斷點 D 依 `blockedReason` 告知使用者；本單結論可能需要補正 CT-T017）"
affects_files:
  - _ct-workorders/T0596-research-blocked-askuserquestion-permission-reason.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單：**不改任何產品程式碼、測試、CLAUDE.md、docs**；只寫本工單回報區並 commit 本檔（`git commit --only <本檔>`）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 日誌與輸出不得含權杖；回報區引用日誌時只貼 `[blocked]` / `[bat-mcp]` / `report-hook` 相關行，不貼 prompt、問題內容或答案以外的使用者資料（問題內容可省略）。"
  - "🔴 不得在使用者的 Claude CLI 測試分頁（`d05e9860-59d8-4da3-82a9-abaee3451c2b`）送任何輸入。呼叫模型的實機查證最多 1 次、`--model claude-haiku-5-5`、提示詞極短，可略過；能靠日誌與 claude 二進位字串回答就不跑。"
---

# T0596 — 研究：AskUserQuestion 的 `blockedReason` 為何是 `permission`

## 背景（塔台實機觀察，2026-10-18 第七十六 session）

- BAT `0.7.0-pre.4`（本機安裝，本次啟動日誌 `%APPDATA%\BetterAgentTerminal\Logs\debug-20261018-020939.log`；helper 日誌 `bat-scripts.log` 同目錄）。
- 使用者以 `+` 開一般 Claude CLI 分頁（terminal id `d05e9860-59d8-4da3-82a9-abaee3451c2b`，role `shell`，標題 `Claude CLI`）。畫面：`Claude Code v2.1.302`、Opus 5.5、`bypass permissions on`（自訂參數 `--dangerously-skip-permissions --effort high`）。
- 使用者輸入「用 AskUserQuestion 問我一個選擇題」，對話框出現、尚未回答時，塔台 MCP `bat_list_terminals scope=workspace` 得到：
  `{"state":"blocked","blockedReason":"permission","blockedDetection":"hook"}` —— **預期是 `question`**。
- 使用者以**滑鼠**點選答案後，塔台再查：`state: working`（已清除）。第一題回合結束約 02:22。
- 使用者接著又問了第二題（02:24 結束，回答前塔台未查），並在輸入框打了第三題（多選題，可能已送出）。
- 依 T0590 / T0594 規則：進入 `blocked` 後收到不同 reason → 換成新的；`PostToolUse(AskUserQuestion)`（`ask-user-question-done`）**只清 `question`**。若 reason 已被換成 `permission`，滑鼠回答應清不掉、要等 `Stop` —— 但實際上點完很快就不是 `blocked` 了。兩者有矛盾，需查證。

## 要回答的問題

1. **事件順序**：從 `debug-20261018-020939.log` 的 `[blocked] terminal=d05e9860… → …` 行與 `bat-scripts.log` 的 `report-hook`（`terminalId` = 該分頁）記錄，列出每一題從出現到清除的完整轉換：收到哪些 hook 事件、各自的 `result`（blocked / cleared / unchanged）、`tool=` 名稱、時間。三題（若第三題已送出）分開列。
2. **為什麼是 `permission`**：claude 2.1.302 在 `--dangerously-skip-permissions` 下，AskUserQuestion 是否也觸發 `PermissionRequest`（`tool_name` = `AskUserQuestion`）？順序是 `PreToolUse` → `PermissionRequest`，還是只有 `PermissionRequest`？以日誌為主，必要時讀 claude 2.1.302 二進位字串佐證（說明哪台 claude：內嵌或系統，`claudeRuntime` 設定）。
3. **被誰清除**：滑鼠回答後是哪個事件清除（`ask-user-question-done` / `stop` / `user input` / 其他）？若是 `ask-user-question-done` 卻清了 `permission`，表示實作與 docs 描述不符，指出程式位置；若是 `user input`，說明滑鼠點擊為何沒被 `isTerminalAutoReply` 排除。
4. **影響**：
   - CT 斷點 D 會以 `blockedReason` 告訴使用者「在等什麼」：AskUserQuestion 回報成 `permission` 的頻率與條件。
   - 真正的權限對話框（非 bypass 模式）是否也會先 `PreToolUse` 再 `PermissionRequest`，會不會有類似錯置。
   - 清除漏洞是否比 docs「已知限制」寫的更大或更小。
5. **修正建議**（只建議、不實作）：例如 `permission-request` 的 `toolName` = `AskUserQuestion` 時記為 `question`（或維持原 reason 不換）；或 `ask-user-question-done` 也清 `tool=AskUserQuestion` 的 `permission`。列出各方案的改動位置、風險、需補的測試，並給推薦。另說明 CT-T017 的文字是否需要補正。

## 驗收

- 回報區逐題回答 1–5，每個結論標明「實測（日誌行）」/「二進位字串」/「推論」。
- 只 commit 本工單檔。

---

## 回報區

### 結論摘要

- **矛盾的解答**：滑鼠回答**沒有**清除 `blocked`。兩題都是 `ask-user-question-done` → `unchanged`（reason 已是 `permission`），約 1.5–1.9 s 後回合結束的 `Stop` 才清除。塔台覺得「點完很快就不是 `blocked`」，是因為模型回答完這種小問題後立刻結束回合。實作與 docs 描述一致（`HOOK_EVENT_CLEARS_ONLY` 只清 `question`），沒有程式碼偏離。
- **根因**：claude 2.1.302 的 AskUserQuestion `requiresUserInteraction()` 為 `true`，`checkPermissions` 一律回 `behavior: "ask"`（`"Answer questions?"`）。問題對話框本身就走權限提示路徑，所以**一律**執行 `PermissionRequest` hook（`tool_name: AskUserQuestion`），`--dangerously-skip-permissions` 也一樣。順序固定：`PreToolUse(AskUserQuestion)` → 約 90 ms 後 `PermissionRequest(AskUserQuestion)`，tracker 依「不同 reason → 換成新的」改成 `permission`。
- **影響**：claude-cli 分頁的 AskUserQuestion **每次**都回報 `permission`，`question` 只維持約 90 ms。T0594 的 `PostToolUse(AskUserQuestion)` 清除因此實際上永遠不會生效，滑鼠回答後 `blocked` 會一直留到 `Stop`。回答後模型若還要做很久，CT 斷點 D 就會在整段工作期間誤報「在等權限確認」。這個漏洞比 docs「已知限制」寫的大。
- **推薦修正（方案 A）**：`permission-request` 帶 `toolName === 'AskUserQuestion'` 時記為 `question`。改 `TerminalBlockedTracker.report` 一處，契約欄位不變。CT-T017 第 74 / 81 / 104 行需要補正（見 Q5）。

### 環境與落點

- Landing：C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。C-1 PASS。C-3：`affects_files` 只有本工單（位於 `_ct-workorders/`，已排除）→ not applicable。C-2：無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`：研究單沒有互動，Q/A 記錄為無。
- 分頁跑的是**系統 claude**：`settings.json` 的 `claudeRuntime` = `{"mode":"system","fallbackToEmbedded":true}`。系統 `~/.local/bin/claude.exe` 的 `--version` = `2.1.302 (Claude Code)`，與畫面上的 `v2.1.302` 相符；內嵌的 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code` 是 `2.1.300`。下面的二進位字串都取自 `~/.local/bin/claude.exe`（2.1.302）。
- 日誌時間是 UTC（`Z`），下面同時寫本地時間（+08:00）。
- 沒有呼叫模型做實機查證，日誌與二進位字串已足以回答。沒有在使用者的測試分頁送任何輸入。

### Q1 事件順序（實測：日誌行）

來源：`debug-20261018-020939.log`（`[blocked]` 行）與 `bat-scripts.log`（`report-hook`，`remote-server` 與 `bat-hook` 各一筆，內容相同，下面只列一筆）。
完整性：debug log 中這個分頁每一次 `Helper authenticated: role=tower terminal=d05e9860…` 都能對應到一筆 `report-hook`（共 10 次），所以 `unchanged` 的 5 s 節流沒有藏掉任何事件（實測）。

**第一題**

| 本地時間 | UTC | hook | result | `[blocked]` 行 |
|---|---|---|---|---|
| 02:21:13.297 | 18:21:13.297Z | `user-prompt-submit` | unchanged | — |
| 02:21:18.765 | 18:21:18.765Z | `ask-user-question` | blocked | `→ blocked reason=question (hook ask-user-question)` |
| 02:21:18.858 | 18:21:18.858Z | `permission-request` | blocked | `→ blocked reason=permission (hook permission-request tool=AskUserQuestion)`（+93 ms） |
| 02:21:42.117 | — | （塔台 `terminal:list scope=workspace` → `blocked` / `permission`） | | |
| 02:22:06.756 | 18:22:06.756Z | `ask-user-question-done` | **unchanged** | —（滑鼠回答，reason 是 `permission`，不清） |
| 02:22:08.205 | 18:22:08.205Z | `stop` | **cleared** | `→ cleared (hook stop)`（回答後 +1.45 s） |
| 02:22:16.389 | — | （塔台 `terminal:list` → `working`） | | |

**第二題**

| 本地時間 | UTC | hook | result | `[blocked]` 行 |
|---|---|---|---|---|
| 02:23:12.615 | 18:23:12.615Z | `user-prompt-submit` | unchanged | — |
| 02:23:16.994 | 18:23:16.994Z | `ask-user-question` | blocked | `→ blocked reason=question (hook ask-user-question)` |
| 02:23:17.081 | 18:23:17.081Z | `permission-request` | blocked | `→ blocked reason=permission (hook permission-request tool=AskUserQuestion)`（+87 ms） |
| 02:24:09.487 | 18:24:09.487Z | `ask-user-question-done` | **unchanged** | — |
| 02:24:11.363 | 18:24:11.363Z | `stop` | **cleared** | `→ cleared (hook stop)`（回答後 +1.88 s） |

**第三題**：**沒有送出**（實測）。02:24:11 之後這個分頁沒有任何 `report-hook`，包括 `user-prompt-submit`。02:25:37.522 出現 `[helper-cap] revoked: terminal=d05e9860-59d8-4da3-82a9-abaee3451c2b`，接著是 `[decoration-manager] disposed`，表示分頁在這時被關閉。

另：塔台 02:21:47 的 `terminal:get-state target=d05e9860…` 回 `NOT_OWNER`（實測），這是唯讀查詢的範圍規則，與本題無關，只記錄。

### Q2 為什麼是 `permission`

1. **兩個 hook 都會執行，順序固定是 `PreToolUse` → `PermissionRequest`**（實測）：兩題都是先 `ask-user-question` 再 `permission-request tool=AskUserQuestion`，相隔 87–93 ms。
2. **AskUserQuestion 永遠走權限提示路徑**（二進位字串，claude 2.1.302）：
   - 工具定義：`requiresUserInteraction(){return!0}` … `async checkPermissions(e){return{behavior:"ask",message:"Answer questions?",updatedInput:K(e)}}`。
   - 規則判斷：`if(e.requiresUserInteraction?.())return V?.behavior==="ask"?V:{behavior:"ask",message:Hl(e.name),decisionReason:{type:"other",reason:"requiresUserInteraction"}}`。auto mode 也有 `tengu_auto_mode_fallback_to_ask` / `reason:"requires_user_interaction"`，`So()` 中的 `if(n.requiresUserInteraction?.()===!0)return!1` 也排除了自動放行。
   - 權限提示流程的 `runHooks` 呼叫 `executePermissionRequestHooks`（字串 `executePermissionRequestHooks called for tool: ${e}`，hook input `hook_event_name:"PermissionRequest",tool_name:e,tool_input:r,permission_suggestions:y`）。結果處理中有 `if(B.behavior==="allow"){if(!B.updatedInput&&e.requiresUserInteraction?.())return null;`，以及 `Hook satisfied user interaction for ${n.name} via updatedInput`。也就是說，claude 本來就設計成讓 `PermissionRequest` hook 處理 requiresUserInteraction 工具（hook 可以帶 `updatedInput` 代答），所以這不是 bypass 模式的異常行為。
   - 推論：bypass（`--dangerously-skip-permissions`）只會自動放行一般工具的 ask。requiresUserInteraction 工具在 bypass 之前就固定回 ask，所以 AskUserQuestion 在**任何**權限模式下都會觸發 `PermissionRequest`。唯一的例外是 `forRemoteExecution === true`（`runHooks` 第一行就 `return null`），一般 CLI 分頁不會碰到。
3. **tracker 行為符合設計**（原始碼）：`TerminalBlockedTracker.report`（`electron/terminal-blocked-state.ts:109-114`）在「已 blocked、收到不同 reason」時換成新的 reason，所以變成 `permission`。`tool=AskUserQuestion` 只記在 `state.toolName` 與日誌，不影響 reason。

### Q3 被誰清除

- **兩題都是 `stop` 清除**（實測：`→ cleared (hook stop)`）。
- 滑鼠回答當下確實有 `ask-user-question-done`（`PostToolUse(AskUserQuestion)`，T0594），但 result 是 `unchanged`（實測）。原因是 `HOOK_EVENT_CLEARS_ONLY['ask-user-question-done'] = 'question'`（`electron/terminal-blocked-state.ts:60-62`），而 `report()` 第 106 行在目前 reason 不是 `question` 時直接回 `unchanged`。這與 docs 描述一致，**實作沒有偏離 docs**。docs 的盲點在前提：docs 假設 AskUserQuestion 期間的 reason 是 `question`，實際上它一律被換成了 `permission`。
- 沒有 `→ cleared (user input)` 行（實測）。這個分頁在 02:21:12 的日誌是 `[terminal-context-menu] … the program tracks the mouse (any)`（實測），滑鼠點擊以滑鼠回報序列寫進 PTY，被 `isTerminalAutoReply`（`electron/close-worker.ts:96`）視為終端自動回應，不算使用者輸入。這是 T0590 / T0551 的既定行為（推論：符合 docs「滑鼠回報屬 `isTerminalAutoReply`」）。
- 「點完很快就不是 `blocked`」：兩次都是回答後 1.45 s / 1.88 s 收到 `Stop`（實測）。模型回完一句就結束回合，所以看起來像是被回答清掉。

### Q4 影響

1. **CT 斷點 D 的 `blockedReason`**（實測 + 二進位推論）：在 claude-cli 分頁（本機或 headless 的 claude 2.1.302；內嵌 2.1.300 也一樣：二進位字串同樣有 `checkPermissions(e){return{behavior:"ask",message:"Answer questions?"` 與 `if(e.requiresUserInteraction?.())return V?.behavior==="ask"?V:{behavior:"ask"`），AskUserQuestion **100% 回報 `permission`**，與權限模式無關。`question` 只在 `PreToolUse` 到 `PermissionRequest` 之間約 90 ms 可見，CT 實際上讀不到。目前 CT 看到 `permission` 時，無法區分「權限確認」和「在問使用者問題」。
   - 推論：其他 requiresUserInteraction 工具也會以 `permission` 進入，例如 ExitPlanMode。二進位的推播卡片 `pe()` 對 `requiresUserInteraction` 工具分 `Question` / `Plan` / … 幾類。這些工具確實在等使用者決定，回報 `permission` 尚可接受，本單不建議處理。
2. **真正的權限對話框（非 bypass）**（推論，依 `BAT_CLAUDE_HOOKS` 與二進位流程）：BAT 的 `PreToolUse` 只掛 matcher `AskUserQuestion`，所以 Bash / Edit 等工具只會觸發 `PermissionRequest` → `permission`，**不會錯置**。錯置只發生在 AskUserQuestion：它同時符合兩個進入類 hook，而後到的那一個（`PermissionRequest`）把 reason 換成 `permission`。
3. **清除漏洞比 docs 寫的大**（實測 + 推論）：
   - docs「已知限制」寫「AskUserQuestion 以滑鼠回答 → T0594 起由 `PostToolUse(AskUserQuestion)` 清除」，**實際上永遠不成立**：reason 必定是 `permission`，`ask-user-question-done` 一定是 `unchanged`。T0594 的修正在真實 claude 下等於沒有作用（T0594 的 e2e / headless 測試只模擬了 `ask-user-question` → `ask-user-question-done`，沒有中間那個 `permission-request`，所以測試通過但沒有涵蓋真實順序）。
   - 實際行為：AskUserQuestion 以滑鼠回答後，`blocked` / `permission` 一路維持到該回合 `Stop`（或使用者鍵盤輸入）。如果回答後 Worker 還要工作很久（CT Worker 常見的情況：問完再實作），CT 在整段工作期間都會讀到 `blocked`，`terminal:wait until: 'idle'` 也會立即成立（`blocked` 不是 `working`）。這會讓塔台誤以為 Worker 還在等使用者回答。
   - docs 第 2 點（`--dangerously-skip-permissions` 下「只會有 AskUserQuestion / elicitation」）以及 CT-T017 第 81 行（「不會出現 `permission`」）與實測不符：bypass 下仍會出現 `permission`（來自 AskUserQuestion）。

### Q5 修正建議（只建議、不實作）

| 方案 | 改動位置 | 效果 | 風險 |
|---|---|---|---|
| **A（推薦）**：`permission-request` 帶 `toolName === 'AskUserQuestion'` 時 reason 記為 `question` | `electron/terminal-blocked-state.ts` `TerminalBlockedTracker.report`：以 `const reason = event === 'permission-request' && toolName === 'AskUserQuestion' ? 'question' : HOOK_EVENT_REASON[event]` 取代第 103 行（或抽成 `reasonOf(event, toolName)`）。`bat-hook.mjs` 已經會送 `tool_name`（`hookReport` 第 65-66 行），handler 已經保留 `permission-request` 的 `toolName`，**都不用改** | 已經是 `question` → `unchanged`（`blockedSince` 保留 PreToolUse 的時間）；沒有 PreToolUse 時也直接進 `question`；`ask-user-question-done` 就能如 T0594 的設計清除。CT 看到的 reason 正確 | 低。依賴 `tool_name` 字串，claude 改名時退回 `permission`（等於現在的行為）。舊版 `bat-hook.mjs`（不帶 toolName）同樣退回 `permission`。契約欄位與列舉值都不變，只修正 `PermissionRequest` 的對應，docs 事件表要補一列例外 |
| B：已 blocked 時不換 reason（先到者為準） | `report()` 第 110 行改成「已 blocked 就 `unchanged`」 | AskUserQuestion 維持 `question` | 中。T0594 想防的情境反而會出錯：問題回答完，`ask-user-question-done`（async）還沒到，另一個工具的權限對話框就出現了 → reason 停在 `question`，等 done 到達後清掉，此時權限對話框其實還開著（誤清）。也會讓 `question` → `elicitation` 之類的真實切換失效 |
| C：`ask-user-question-done` 也清 `toolName === 'AskUserQuestion'` 的 `permission` | `report()` 第 105-106 行的 `HOOK_EVENT_CLEARS_ONLY` 判斷加上 `state.toolName` 條件 | 修好清除漏洞 | 低，但**只修清除、不修 reason**：等待期間 CT 仍讀到 `permission`，斷點 D 對使用者說的「在等什麼」依然錯誤 |

**推薦 A**，可以加上 C 的 toolName 條件當保險：A 實施後，`permission` + `toolName = AskUserQuestion` 的狀態只會在舊 hook 腳本下出現，這時 C 可以補上清除。只做 A 也足夠。PreToolUse(AskUserQuestion) hook 建議**保留**：它比 PermissionRequest 早約 90 ms 進入 `blocked`，`forRemoteExecution` 路徑不跑 PermissionRequest 時也能涵蓋。

需補的測試（建議）：
- `electron/__tests__/terminal-blocked-state.test.ts`：① `ask-user-question` → `permission-request(toolName: AskUserQuestion)` → `unchanged`，reason 為 `question`，`blockedSince` 不變，不印 `[blocked]` 轉換行；② 接著 `ask-user-question-done` → `cleared`；③ 只有 `permission-request(AskUserQuestion)` → `blocked` / `question`；④ `question` 期間收到 `permission-request(Bash)` → 換成 `permission`（T0594 情境不變）；⑤ channel 回傳 `blockedReason: 'question'`；⑥ 真 `bat-hook.mjs` 程序：stdin `PermissionRequest` + `tool_name: AskUserQuestion` → 塔台 state 為 `question`。
- `electron/remote/__tests__/headless-blocked-state-e2e.test.ts` 與 `e2e/t0590-blocked-state.spec.ts` 3b 段：driver 改成照真實順序送 `ask-user-question` → `permission-request`（帶 `AskUserQuestion`）→ 隔幾秒 `ask-user-question-done`，斷言等待期間是 `blocked (question)`、done 之後離開 `blocked`、不經鍵盤。**這是 T0594 測試漏掉的順序**，修正後一定要加。
- docs：`docs/agent-guide/blocked-state.md` 事件表 `PermissionRequest` 列補「`tool_name` = `AskUserQuestion` → `question`」；「已知限制」改寫 bypass 那一條，並補上本單的 claude 2.1.302 查證。CLAUDE.md 該節不需要改（契約不變），除非塔台認為例外對應屬於「必守規則」。
- 實機驗收：系統 claude 2.1.302 分頁問一題 → 塔台 `bat_list_terminals` 為 `blocked` / `question` → 滑鼠回答 → 立刻出現 `→ cleared (hook ask-user-question-done)`，不必等 `Stop`。最好請模型回答後再做一段長一點的工作，才能把 done 與 Stop 分開。

**CT-T017 需要補正**（`_ct-workorders/CT-T017-delegate-ct-worktree-status-source-and-blocked.md`）：
- 第 81 行「以 `--dangerously-skip-permissions` 啟動的 Worker 不會出現 `permission`，只會有 `question` / `elicitation`」：在目前的 BAT（≤ 0.7.0-pre.4）**不成立**，AskUserQuestion 一律回 `permission`。建議改成：「在 BAT 修正（本單方案 A）之前，`permission` 可能是權限確認，也可能是 AskUserQuestion；斷點 D 對使用者的措辭寫『在等你確認或回答』，不要斷言是權限」。
- 第 74 行「AskUserQuestion 回答完成（只清 `question`）」：在修正前，實際上不會因為回答完成而清除，會維持到 `Stop`。修正前，斷點 D 應預期「回答後到回合結束前仍可能是 `blocked`」，不要據此重複催促使用者。
- 第 104 行驗收步驟（「`bat_get_state` 為 `blocked` / `question`；回答後恢復」）：在修正前跑會得到 `permission`，而且要等到 `Stop` 才恢復。建議 CT-T017 的驗收排在 BAT 修正版之後，或暫時把期望值寫成 `permission` 或 `question` 都可以。

### 建議後續工單

- BAT 實作單（P1–P2，S）：方案 A，加上前面列的測試與 docs 修正（含 T0594 測試漏掉的真實事件順序）。
- 塔台補正 CT-T017（或發 reply 給 BMad-Guide）：上面三處措辭，版本條件寫「BAT 修正版之前 / 之後」。

### 異動檔案

- 只有本工單檔 `_ct-workorders/T0596-research-blocked-askuserquestion-permission-reason.md`（回報區與 metadata）。產品程式碼、測試、CLAUDE.md、docs 都沒有改。`src/styles/settings.css` 的 M 不是本單的變更，未觸碰。

### 驗證

- source / docs 查證：PASS（`electron/terminal-blocked-state.ts`、`electron/bat-mcp-launch.ts` `BAT_CLAUDE_HOOKS`、`scripts/bat-hook.mjs`、`docs/agent-guide/blocked-state.md`）。
- 日誌查證：PASS（兩份日誌，`report-hook` 與 `Helper authenticated` 一一對應）。
- 二進位字串：PASS（`~/.local/bin/claude.exe` 2.1.302）。
- build / tests：不適用（研究單，沒有改程式碼）。
- 實機模型呼叫：略過（不需要）。

### Commit

- `git commit --only _ct-workorders/T0596-research-blocked-askuserquestion-permission-reason.md`（hash 見 Tower 收到的通知與 git log）。不 push。
