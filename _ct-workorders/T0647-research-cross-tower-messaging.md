---
schema_version: 1
schema_kind: workorder
id: T0647
title: "研究：PLAN-051 BAT 跨塔台傳訊通道——需求是否成立、投遞語意、權限與安全、遠端，給推薦與介面契約草案（唯讀）"
type: research
status: TODO
repo: better-agent-terminal
project: PLAN-051
priority: P3
sizing: M
created_at: "2026-10-18T18:13:30+0800"
depends_on: []
related:
  - "PLAN-051（動機、初步想法、待研究 1–5）"
  - "PLAN-050 / D167 / T0643（`terminal:list { scope: 'towers' }`、`claudeSessionName`）；D149（範圍權杖：塔台只能寫自己的 Worker）；PLAN-048 / T0607 / D155 / D156（`question:*` 問答 store：內容只在主行程記憶體、日誌不記內容）"
  - "CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」「helper 唯讀查詢 channel」「Worker 問塔台」「Claude 分頁的 session 名稱」各節與對應 `docs/agent-guide/*.md`"
  - "跨專案往來紀錄：本 repo `_ct-workorders/_reply-*.md`、`CT-T###` 委派單（含 `_archive/`）；BMad-Guide 端 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\`（唯讀）"
affects_files:
  - _ct-workorders/T0647-research-cross-tower-messaging.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改其他工單 / PLAN / 塔台狀態檔、不改 BMad-Guide repo 的任何檔案；只 commit 本工單檔（`git commit --only`）。不 push。實驗腳本與擷取檔一律放系統暫存目錄或 scratchpad（不得寫進 repo）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 **不得對其他 session 送 SendMessage**，也不得用 helper 對其他分頁寫入（`bat-notify` / `pty:write` / `--answer` 等）；ListAgents、`bat_list_terminals scope=towers`、`bat_whoami` 等唯讀觀察可以用。不得改名任何 session 或分頁。"
  - "🔴 不得修改使用者的 `%APPDATA%\\BetterAgentTerminal\\settings.json`、`~/.claude/`、`~/.codex/`；可以讀。回報不寫任何權杖 / API key / 帳號資訊（`BAT_REMOTE_TOKEN` 只寫「已設定」）。"
  - "🔴 實測 codex / claude 時用不呼叫模型的方式（`--help`、版本、設定檔、二進位字串、官方文件）為主；必須呼叫模型時用最便宜的模型、最短的 prompt，回報記次數。實驗開的 session 用完要結束，不得留下殘留 session。"
  - "🔴 yolo Worker：不得問使用者。是否放寬 D149、做不做、做哪一種投遞語意都是**使用者決定**，你只提推薦與理由，不要問塔台代決；範圍內無法決定且猜錯會返工的研究方向問題，依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
  - "🔴 非隔離工單。另一張工單 T0646（網站 `/remote/`）同時進行，只改 `site/**`，不碰。"
---

# T0647 — 研究：BAT 跨塔台傳訊通道（PLAN-051）

## 背景

跨專案的塔台協作（BAT 塔台 ↔ BMad-Guide 塔台的委派單、回函、版號通知）目前靠 Claude Code 的 ListAgents / SendMessage，加上 `_reply-*.md` 檔案當正式紀錄。PLAN-050 讓 Claude 塔台在 ListAgents 上可辨識（`<工作區> · Tower`），並加了 `scope: 'towers'` 讓塔台列出同一 BAT 的所有塔台。PLAN-051 的疑問是：codex 塔台不在 ListAgents、沒有 SendMessage；遠端（WSL / SSH / Docker）塔台與本機塔台之間也沒有直接管道——BAT 要不要提供一條「塔台 ↔ 塔台」的通道。

塔台補充：本 session 的 ListAgents 工具說明提到它也能列出「Remote Control 連上的其他機器上的 session」與「雲端 session」。PLAN-051 寫「SendMessage 只限同一台機器」可能已不正確，請一併查證。

## 要回答的問題

### Q1 — 需求是否成立（證據優先）

1. 盤點目前的跨塔台往來：本 repo 與 BMad-Guide 的 `_reply-*.md`、`CT-T###` 委派單、跨 session 訊息的紀錄（`_tower-state.md` / 決策日誌提到的次數即可，不必逐則）。對象是哪種 agent、本機或遠端、走 SendMessage 還是請使用者轉交。
2. 實際有沒有「一邊是 codex 塔台」或「一邊在遠端」而卡住的案例；沒有的話，PLAN-050 是否已涵蓋現有需求。
3. 查證 Claude Code 的 ListAgents / SendMessage 目前的範圍（同機、Remote Control 其他機器、雲端 session；雲端 session 能否回覆），以及 codex CLI 有沒有任何 session 間傳訊或可被外部注入訊息的機制（官方文件 / `--help` / 設定），標明版本與查證日期。

### Q2 — 投遞語意

比較至少三種：(a) 沿用 `bat-notify` 預填 / `--submit`（yolo 才自動送出）；(b) 比照 `question:*` 的結構化訊息箱（可查詢、可等待、有狀態）；(c) 只提供「列出塔台 + 找到對方分頁」的唯讀能力，傳訊仍走 SendMessage 或檔案。面向：收件塔台忙碌 / 閒置 / 已結束時的行為、與 `_reply-*.md` 正式紀錄的分工、CT 端要改多少規則、BAT 改動量。

### Q3 — 權限與安全

1. 跨塔台寫入需要放寬 D149 的哪一部分；最小權限的設計（例如只能投遞到 `scope: 'towers'` 列出的已宣告塔台、收件端可拒收、速率限制）。
2. 內容保存與遮罩（比照 D155：只在主行程記憶體、`redactTerminalSecrets`、日誌不記內容）；prompt injection：收到的訊息如何讓收件塔台當成資料而非指令（比照 SendMessage 與本 repo 處理「pasted content」的方式）。
3. 誰能冒充誰：發件人身分來自權杖綁定，不接受參數宣告（比照 `HandlerContext.helper`）。

### Q4 — 遠端

headless bat-server 的塔台與本機塔台之間是否要通、怎麼通（同一 BAT client 底下的多個 RemoteServer / profile 連線）；不通的話限制寫清楚。

### Q5 — 推薦

- 做 / 不做 / 先做最小版本的推薦與理由（含「目前需求不足，維持 IDEA」也是合法結論）
- 若推薦做：介面契約草案（格式比照 T0600 / T0607 的「介面契約」：channel、helper 參數、exit code、狀態、限制常數、降級）、實作切分（S / M / L、會動的檔、需要的 e2e）、CT 端要配合的規則（以 CT-T### 委派的範圍描述）
- 列出需要使用者決定的事項（選項式，標推薦）

## 交付

回報區依 Q1–Q5 作答，每個結論附證據（檔案:行號、指令輸出、官方文件連結與查證日期），標明哪些是實測、哪些是推論。

---

## 回報區

（Worker 填寫）
