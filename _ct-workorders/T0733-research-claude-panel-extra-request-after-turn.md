---
schema_version: 1
schema_kind: workorder
id: T0733
title: "研究：Claude 面板每個 turn 結束後 CLI 在同一對話多送的一個模型請求是什麼、能不能關"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T12:25:49+0800"
started_at: ""
updated_at: "2026-11-01T12:25:49+0800"
completed_at: ""
depends_on: []
related:
  - "T0729 回報區〈發現的問題 / 後續〉1；D198"
  - "`e2e/fixtures/fake-anthropic-api.ts`（T0727）；T0729 的 SDK 直接呼叫原型做法（假 API、暫存 HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、擋外連 proxy）"
  - "CLAUDE.md「Claude Agent SDK / CLI」；`electron/claude-agent-manager.ts`（面板的 `query()` 選項）"
affects_files:
  - _ct-workorders/T0733-research-claude-panel-extra-request-after-turn.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不改：不改產品程式碼、測試、docs；不跑 `vite build` / 打包 / e2e（T0730 / T0732 在同一 repo build）。原型腳本只放 scratchpad，以 SDK 0.3.316 直接驅動內嵌 CLI 2.1.316，打本機假 Anthropic API；不得用使用者的 OAuth / 真實 API key，不得有請求送到 api.anthropic.com；暫存 HOME，不讀寫使用者 `~/.claude`。"
  - "🔴 要回答：① 這個請求的性質（請求內容的特徵：model、system prompt 片段、tools 數、`max_tokens`、使用者訊息、metadata；對照 CLI binary 字串找出對應功能，例如 prompt suggestion / 摘要 / 標題產生），附證據但不得把使用者資料或權杖寫進回報；② 是否每個 turn 都送、與 `query()` 哪些選項有關（以 BAT 面板實際傳的選項重現，`electron/claude-agent-manager.ts`）；③ 能否以 SDK 選項或 env 關閉（候選如 `promptSuggestions`、`CLAUDE_CODE_*` env 等，以 SDK 型別與 CLI 實測為準），關閉後對面板功能有無影響（BAT 是否用到該結果）；④ 真實帳號下每次大約多少 input / output token（以假 API 收到的請求內容估算，標明是估算）；⑤ 同樣的請求在 Claude CLI 終端分頁是否也會發生（只看 CLI 預設行為，不實測真實帳號）。"
  - "🔴 回報區給：結論、建議（改 / 不改，若改則列實作單草案：範圍、affects_files、驗證方式），以及需要使用者決定的點。不耗 token、不 build。log / 回報不含權杖或完整 session id。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0733 — 研究：Claude 面板 turn 後多出的請求

## 元資料

- **工單編號**：T0733
- **類型**：research
- **優先級**：P2
- **建立時間**：2026-11-01T12:25:49+0800
- **預估規模**：S

## 背景

T0729 以假 Anthropic API 觀察到：Claude 面板每個情境的最後一個 turn 結束後，CLI 在同一段對話又送一個請求（無新的使用者訊息、分頁自己的模型、15 tools），疑似 CLI 自己的後續功能（例如 prompt suggestion），真實帳號會耗 token。使用者決定開研究單（D198）。

## 範圍

1. 以 SDK 直接呼叫原型重現並辨識請求性質。
2. 查可否關閉、影響、token 估算、CLI 分頁是否同樣。
3. 建議與實作單草案。

## 不做

- 不改任何產品檔案、不 build、不耗 token。

## 驗收

- [ ] ①–⑤ 各有結論與證據
- [ ] 建議（含實作單草案或不改理由）與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
