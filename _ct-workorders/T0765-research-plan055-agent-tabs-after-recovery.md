---
schema_version: 1
schema_kind: workorder
id: T0765
title: "研究：PLAN-055 Terminal Server recovery 後的 agent 分頁（列出被中斷的分頁、claude 分頁提供 `--resume`）設計與實作單草案"
type: research
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "PLAN-055；BUG-171 / T0703（回報區建議方向 C）/ T0704；D186；T0642（`claudeSessionId` 查詢與 `ClaudeSessionPersistence`）；T0112（recovery 以同 id 重建 shell）"
  - "`electron/pty-manager.ts`（`handleServerDeath`、recovery）、`electron/claude-session-name-record.ts`、`electron/terminal-blocked-state.ts`（sessionId）、`docs/agent-guide/terminal-server-recovery.md`、`docs/agent-guide/claude-session-name.md`"
affects_files:
  - docs/
  - _ct-workorders/PLAN-055-agent-tabs-after-terminal-server-recovery.md
  - _ct-workorders/T0765-research-plan055-agent-tabs-after-recovery.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只讀、不改產品程式碼、不 build、不跑 e2e（與其他 Worker 並行）；不動使用者正在用的 BAT 與 Terminal Server。"
  - "🔴 產出：① 現況：recovery 後 agent 分頁實際變成什麼（以程式與 T0703 / T0704 回報為據）、哪些資訊還在（`claudeSessionId`、`agentPreset`、`launchRole`、工單、codex 的 session）；② 設計：怎麼列出被中斷的分頁（通知 / 對話框 / 分頁標示）、claude 分頁怎麼提供 `--resume <id>`（自動或按鈕、與 BAT MCP / hooks / `--name` 注入的關係）、codex 分頁怎麼辦、Worker 分頁（塔台派工）的處理；③ 2–3 個方案的取捨與規模；④ 選定方案的實作單草案（affects_files、驗收、e2e 怎麼造 recovery）。寫在回報區；PLAN-055 只在〈研究結果〉補摘要，status 不改。"
  - "🔴 需要使用者偏好的點列成〈待決點〉，不問塔台、不停下（研究單收尾後由塔台轉問）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0765 — 研究：PLAN-055 Terminal Server recovery 後的 agent 分頁（列出被中斷的分頁、claude 分頁提供 `--resume`）設計與實作單草案

## 元資料

- **工單編號**：T0765
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

PLAN-055（IDEA）：Terminal Server recovery 後 agent 分頁無聲變成 shell。D210 排入本批，先研究設計。

## 範圍

現況、設計、方案取捨、實作單草案、待決點。只讀不改。

## 不做

- 不改產品程式碼；不 build；不發版。

## 驗收

- [ ] ①–④ 齊全、有程式位置佐證
- [ ] 待決點清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
