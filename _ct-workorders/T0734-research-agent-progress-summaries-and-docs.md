---
schema_version: 1
schema_kind: workorder
id: T0734
title: "研究 Claude 面板 `agentProgressSummaries` 的請求與成本＋把 prompt suggestion / progress summaries 的成本與關閉方式寫進 docs"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T12:41:53+0800"
started_at: ""
updated_at: "2026-11-01T12:41:53+0800"
completed_at: ""
depends_on: []
related:
  - "D199；T0733 回報區（prompt suggestion：成因、抑制條件、三種關閉方式、token 估算、面板比終端少的節流、相關但未涵蓋的 `agentProgressSummaries`）"
  - "T0733 / T0729 的 SDK 直接呼叫原型做法（假 Anthropic API、暫存 HOME 與工作區放在使用者家目錄以外、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋外連 proxy）"
  - "`electron/claude-agent-manager.ts` `queryOptions`；`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0734-research-agent-progress-summaries-and-docs.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 docs：不改產品程式碼、測試、CLAUDE.md（T0732 正在改 CLAUDE.md「Logging」）；不跑 `vite build` / 打包 / e2e。原型只放 scratchpad，以 SDK 0.3.316 驅動內嵌 CLI 2.1.316 打本機假 API；不得用使用者的登入或真實 key，不得有請求送到 api.anthropic.com；暫存 HOME 與 cwd 都放在使用者家目錄以外（T0733 偏差：cwd 在家目錄下會讀到使用者的 CLAUDE.md）。"
  - "🔴 `agentProgressSummaries` 要回答：① 以 BAT 面板實際選項重現一個前景 sub-agent（`Agent` tool_use，假 API 讓 sub-agent 跑 > 30 s 或以 gate 拖住）：progress summary 請求的頻率、內容特徵（model、system、tools 數、messages、`max_tokens`、thinking）、在哪裡產生；② BAT 是否用到結果（追 SDK 訊息 → `processMessage` → IPC → 面板哪個元件顯示），關掉後面板少了什麼；③ 關閉方式（SDK 選項、env、settings，以實測為準）；④ 真實帳號 token 估算（標明估算，cache read / 未快取 / output 分開）；⑤ 背景 sub-agent（CLI 2.1.316 `Agent` 預設背景執行，T0727 觀察 4）時是否同樣產生；⑥ Claude CLI 終端分頁的預設行為（只看原始碼）。"
  - "🔴 docs：在 `docs/agent-guide/claude-agent-sdk-cli.md` 新增一節（例如「Claude 面板額外的模型請求」），以使用者看得懂的方式寫兩項：prompt suggestion（D199 維持開啟；用途＝建議晶片與 Tab 填入；何時不送；成本特性；使用者關閉方式 `promptSuggestionEnabled: false` / env；面板比終端少的節流）與 agentProgressSummaries（依本單實測）。另附一句：BUG-177 修正後查模型清單不再送請求（T0729）。數字標明來源（實測 / 估算）。遵守 docs 去識別化，不寫家目錄路徑。"
  - "🔴 回報區給：①–⑥ 結論與證據、建議（維持 / 加開關 / 改預設；若要改，列實作單草案）、需要使用者決定的點。log / 回報不含權杖或完整 session id。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit docs 與本單。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0734 — 研究 `agentProgressSummaries`＋額外請求的 docs

## 元資料

- **工單編號**：T0734
- **類型**：research（附 docs 交付）
- **優先級**：P3
- **建立時間**：2026-11-01T12:41:53+0800
- **預估規模**：S

## 背景

T0733 查明 Claude 面板每個 turn 結束後多出的請求是面板自己開的 prompt suggestion。使用者決定（D199）：維持開啟，把成本與關閉方式寫進 docs；並研究面板同樣開啟的 `agentProgressSummaries`（sub-agent 執行時約每 30 秒 fork 一次產生進度摘要）的成本。

## 範圍

1. `agentProgressSummaries` ①–⑥ 實測與查證。
2. docs 新增「Claude 面板額外的模型請求」一節。

## 不做

- 不改產品程式碼、測試、CLAUDE.md；不 build；不耗 token。

## 驗收

- [ ] ①–⑥ 各有結論與證據
- [ ] docs 一節涵蓋兩項功能，數字標明來源
- [ ] 建議與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
