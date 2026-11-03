---
schema_version: 1
schema_kind: workorder
id: T0818
title: "PLAN-061 交付版驗收：WSL Ubuntu 以 `v0.7.4-pre.5` AppImage 確認 hooks 關閉的 claude 分頁以 OSC 7501 回報狀態（含真 claude 權限對話框 `blocked`）"
type: verification
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T00:49:06+0800"
depends_on: []
related:
  - "PLAN-061；T0811（`f274847c`）；T0789（`e2e/t0789-claude-osc7501-probe.spec.ts` 的假 API 腳本）；D229 / D262 / D263；T0803（WSL 跑交付版 AppImage 的前例）；L185"
affects_files:
  - _ct-workorders/T0818-plan061-verify-delivered-appimage-wsl.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只做驗收，不改任何產品程式、測試、文件、workflow；repo 內唯一可改的檔案是本工單（回報區）。驗收用的腳本、下載的 AppImage、假 API、隔離目錄一律放 WSL 暫存目錄，收尾刪除。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/.claude`、`~/.codex`、`~/bat-build`、`~/.local/bin/*` 不讀寫、不刪；BAT 用隔離 userData（`--runtime=<id>` 或 e2e 既有的隔離方式），claude 用隔離的 HOME / `CLAUDE_CONFIG_DIR`。不碰 Windows 端的 BAT 安裝版與它的 Terminal Server。"
  - "🔴 帳號與憑證（L185）：不登入任何 agent，不從 Windows 或其他地方複製憑證；claude 只用假 API key＋`ANTHROPIC_BASE_URL` 指向本機假 API（不連外、模型花費 0；HTTP(S)_PROXY 也指向不可達位址防外連）。**按鍵只在以輸出確認畫面是權限對話框之後才送**；畫面是登入 / onboarding / 信任資料夾以外的未知提示時不送任何按鍵，回報 PARTIAL 並附畫面文字。回報不寫權杖值、不寫家目錄真實路徑（D176，用 `<使用者資料夾>`）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0818 — PLAN-061 交付版驗收（WSL Ubuntu，`v0.7.4-pre.5` AppImage）

## 元資料

- **工單編號**：T0818
- **類型**：verification
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T00:49:06+0800
- **預估規模**：M

## 背景

PLAN-061（T0811 `f274847c`，已在 `v0.7.4-pre.5`）：非 Windows 主機上 hooks 關閉（`blockedDetection: none`）的 claude 分頁，改用 claude 自己的 OSC 7501（`app=claude-code`）回報狀態。claude 要終端回覆探詢 `ESC ] 7501 ; ?` 才會送，BAT 主行程 `PtyManager.enqueuePtyOutput` → `replyToProgramStatusProbes` 回覆固定字串；之後規則同 codex（`blocked` → `blockedReason: input`，`source: 'osc'`；`working` / `idle` / `clear` 清除；使用者輸入不清除 `input`）。細節見 `CLAUDE.md`「blocked 狀態偵測」節的 claude 段、`docs/agent-guide/blocked-state.md`「claude（OSC 7501）」。

T0811 在 WSL 以 tsx 載入 repo 的 `pty-manager.ts` 驗過：假程式 19 項全過；真 claude 2.1.316（隔離 HOME、`disableAllHooks`、假 API）回覆後 `none` → `osc`、`agentStarted`。**真 claude 的權限對話框 `blocked`（與回答後清除）沒有實測**，交付版也沒驗。塔台決定以交付版 AppImage 在 WSL 補驗（D263）。

## 範圍

1. 取得 `v0.7.4-pre.5` Linux AppImage（`gh release download v0.7.4-pre.5 -R gowerlin/better-agent-terminal …`），比對 GitHub asset digest（SHA-256）。在 WSL Ubuntu 24.04 以一般使用者、隔離 userData 執行（WSLg；userns 受限時 BUG-202 會自動 `--no-sandbox`，記下即可）。
2. 本機假 API：可沿用 / 改寫 `e2e/t0789-claude-osc7501-probe.spec.ts` 的假 API 腳本（複製到暫存目錄，不改 repo 檔）。第一則請求回一個 `Bash` tool_use（無害指令，例 `echo t0818`），讓 claude 跳出權限對話框；之後的請求回一般文字結束回合。
3. 在隔離的 BAT 開一個 claude CLI 分頁（使用 AppImage 內嵌的 claude；隔離 HOME / `CLAUDE_CONFIG_DIR` 的 settings 設 `disableAllHooks: true`；假 API 的 env 經工作區或 Settings 的方式帶入，或以你判斷最少侵入的方式，寫明做法）。用隔離實例自己的 helper / 查詢 channel（`bat-terminal.mjs` 的 state 查詢或 BAT MCP shim，連隔離實例的 port 與權杖）讀狀態，依序記錄：
   - a. 啟動後：`blockedDetection` 由 `none` → `osc`、`agentStarted: true`（若查得到）。
   - b. 送一則 prompt（經 PTY 寫入或 UI 輸入；是 claude 的輸入框才送）→ 權限對話框出現 → `state: blocked`、`blockedReason`（預期 `input`）、`source: 'osc'`。附當時的輸出片段證明畫面是權限對話框。
   - c. 回答權限對話框（允許或拒絕擇一，寫明）→ `blocked` 清除，回合結束回到 `idle`。
4. 對照組（擇一，寫明）：同一實例另開一個 hooks 開啟的 claude 分頁，確認 `blockedDetection: hook` 且 7501 不改變它（PLAN-061 規則：hook 分頁忽略 7501）。

## 不做

- 不改產品程式、測試、文件；不修 BUG（驗收失敗就回報，塔台另開修正單）；不驗 Windows（win32 不回覆是設計）、不驗 macOS；不驗 AskUserQuestion（有餘力可加，標「額外」）；不跑真實模型。

## 驗收

- [ ] AppImage 版號與 SHA-256（附指令與輸出）
- [ ] 假 API 沒有外連（附設定方式）、claude 版號（內嵌）
- [ ] a. hooks 關閉的 claude 分頁 `none` → `osc`（附查詢輸出）
- [ ] b. 真 claude 權限對話框 → `blocked` / `blockedReason` / `source: 'osc'`（附查詢輸出＋畫面片段）
- [ ] c. 回答後清除、回到 `idle`（附查詢輸出）
- [ ] 對照組：hook 分頁 `blockedDetection: hook`（附查詢輸出）
- [ ] 環境還原：隔離 userData、隔離 HOME、AppImage、暫存腳本已刪；沒有殘留程序；WSL 使用者既有目錄未變（附前後雜湊或時間戳）
- [ ] 結論：PASS（塔台結 PLAN-061）/ FAIL（附重現步驟）/ PARTIAL（附缺少哪個證據）

---

## 回報區

（由 Worker 填寫）
