---
schema_version: 1
schema_kind: workorder
id: T0787
title: "研究：Worker 通知打進停在權限對話框 / AskUserQuestion 的塔台會不會替使用者作答（PLAN-059 Q1），順查 OSC 7501 的發送者與規格（Q2 / Q3）"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T17:59:30+0800"
started_at: ""
updated_at: "2026-11-02T17:59:30+0800"
completed_at: ""
session_ids: []
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

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 方法論狀態回寫

### 回報時間
