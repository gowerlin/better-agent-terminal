---
schema_version: 1
schema_kind: workorder
id: T0596
title: "研究：pre.4 實機 AskUserQuestion 回報 `blocked` / `permission`（預期 `question`），以及滑鼠回答後是被哪個事件清除"
type: research
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T02:25:48+0800"
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

（Worker 填寫）
