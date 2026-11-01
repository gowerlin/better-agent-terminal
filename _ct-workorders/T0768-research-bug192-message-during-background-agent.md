---
schema_version: 1
schema_kind: workorder
id: T0768
title: "研究：BUG-192 背景子代理執行中送新訊息的做法（串流輸入 vs 排隊 vs 其他），附實作單草案"
type: research
status: PENDING
updated_at: "2026-11-02T03:08:29+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T03:08:29+0800"
depends_on: []
related:
  - "BUG-192；D213；T0759 回報區（訊息序列、`stopTask` / `interrupt` 實錄、〈後續建議〉）；BUG-190 / T0759；T0727（假 Anthropic API）"
  - "`electron/claude-agent-manager.ts`（`sendMessage`、`runQuery`、`activeTasks`、中止路徑）、`src/components/ClaudeAgentPanel.tsx`、`node_modules/@anthropic-ai/claude-agent-sdk`（`sdk.mjs`、`sdk.d.ts`、`sdk-tools.d.ts`）、`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板的背景子代理」"
affects_files:
  - _ct-workorders/BUG-192-claude-panel-new-message-kills-background-agent.md
  - _ct-workorders/T0768-research-bug192-message-during-background-agent.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只研究：不改產品程式碼、不跑 `vite build`、不跑既有 e2e（與 Lane A / B 並行）；探測腳本放 scratchpad，以 SDK `query()` ＋內嵌 `claude.exe` ＋ `e2e/fixtures/fake-anthropic-api.ts`（T0759 作法），不用真實模型、不連外。不動使用者的 `~/.claude`（探測用暫存 `CLAUDE_CONFIG_DIR`），跑完清掉。"
  - "🔴 查證：① 現況重現（背景子代理執行中送新訊息 → 中止與錯誤訊息）；② SDK 0.3.316 的串流輸入（AsyncIterable prompt）能否在同一個 query 內於背景子代理執行中送後續訊息、主回合與子代理的訊息怎麼交錯、`perTaskStopAffordance` 是什麼、`stopTask` / `interrupt` 在串流輸入下的行為；③ 排隊方案：子代理結束（`task_notification`）後才送、使用者可取消排隊；④ BAT 現行功能在串流輸入下是否仍成立（權限 `canUseTool`、`setPermissionMode`、`promptSuggestions`、resume、Cache History 的 result 累計 T0744、中止按鈕、BUG-177 的空 prompt）。每項附 SDK 原始碼位置或實錄。"
  - "🔴 產出：2–3 個方案的取捨表（使用者看到的行為、改動範圍、風險、規模）、建議方案、實作單草案（affects_files、必守規則、驗收：單元＋假 API e2e 怎麼造情境、不回歸清單）、需要使用者偏好的〈待決點〉（不問塔台、不停下）。寫在回報區；BUG-192 只在文末補〈研究結果〉摘要，status 不改。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0768 — 研究：BUG-192 背景子代理執行中送新訊息的做法（串流輸入 vs 排隊 vs 其他），附實作單草案

## 元資料

- **工單編號**：T0768
- **類型**：research
- **優先級**：P2
- **建立時間**：2026-11-02T03:08:29+0800
- **預估規模**：S

## 背景

T0759 發現：Claude 面板的背景子代理執行中送出新訊息，會中止整個 query、子代理一起被結束。CLI 2.1.316 的 Agent 預設背景，這會常見。使用者決定開 BUG-192 並先研究、排進本批（D213）。

## 範圍

查證 ①–④、方案取捨、建議、實作單草案、待決點。只研究。

## 不做

- 不改產品程式碼；不 build；不用真實模型；不發版。

## 驗收

- [ ] ①–④ 有證據（SDK 原始碼位置或實錄）
- [ ] 方案取捨表、建議、實作單草案、待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
