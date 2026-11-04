---
schema_version: 1
schema_kind: workorder
id: T0842
title: "BUG-211 修正（方向 A）：RemoteClient 送出前 frame 大小守門、不斷線；Claude / Codex 面板遠端送出前檢查圖片合計並保留輸入；失敗提示與 isStreaming 復原"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T11:14:45+0800"
started_at: ""
updated_at: "2026-11-04T11:14:45+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-211；D273；T0837 回報區（重現、門檻、〈建議方向〉A、〈建議下一步〉1）；`electron/__tests__/bug211-ws-max-payload.test.ts`（`319c3646`）；PLAN-038（方向 B 長期）"
affects_files:
  - _ct-workorders/T0842-bug211-frame-size-guard.md
  - _ct-workorders/BUG-211-remote-images-exceed-ws-max-payload.md
  - electron/remote/ws-limits.ts
  - electron/remote/remote-client.ts
  - electron/remote/remote-server.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/remote-image-budget.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/lib/__tests__/
  - src/components/__tests__/
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不改 `electron/remote/protocol.ts`、`electron/main.ts`、`electron/preload.ts`（T0832 / T0833 同時在改）；不調大 server `maxPayload`（T0837 方向 C 否決：auth 前就生效）；不做 auth metadata 協商（舊 server 同為 32 MiB，client 用共用常數即可）。上限常數抽到 `electron/remote/ws-limits.ts`，server 與 client 共用。"
  - "🔴 本機視窗（非遠端）的送出行為、圖片上限完全不變；遠端視窗合計 ≤ 門檻時行為不變。T0815 的送出流程（排進同一個 query、`queuedNoteKey`、權限 / 提問卡）不得改變；錯誤處理只在送出失敗時補提示與 `isStreaming` 復原，不改成功路徑。"
  - "🔴 T0834（PLAN-038 面板接線）之後也會改兩個面板：本單只做送出前檢查與失敗復原，邏輯集中在 `src/lib/remote-image-budget.ts`，面板只接線，方便 T0834 合流。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。T0832 同時在 main 執行。"
---

# T0842 — BUG-211 修正（frame 大小守門）

## 元資料
- **工單編號**：T0842｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 11:14 (UTC+8)
- **規模**：M｜**降級**：先完成 ① client 守門（連線不斷），② 面板檢查與 ③ 失敗復原可回 PARTIAL

## 任務指令

### 前置條件
- `_ct-workorders/T0837-bug211-repro-remote-image-frame.md` 回報區、`BUG-211-*.md`
- `electron/__tests__/bug211-ws-max-payload.test.ts`
- `CLAUDE.md`「Sub-agent / Active Tasks Tracking」節（T0815 送出流程）、「多 remote profile 同時連線」節

### 任務
1. **client 守門**：`RemoteClient.invoke`（與其他會 `ws.send` 的路徑）在送出前算 `Buffer.byteLength(frame)`；超過 `WS_MAX_PAYLOAD_BYTES` → 本地 reject 明確錯誤（例如 `FRAME_TOO_LARGE`，含大小與上限），不送出、連線不斷。
2. **server 日誌**：`Max payload size exceeded` 的 log 補 client label（T0837 發現看不出是哪個 client）；其餘 server 行為不變。
3. **面板（遠端視窗）**：送出前以 `remote-image-budget.ts` 檢查圖片合計（留安全邊際，例如原始合計 ≤ 20 MiB；值與理由寫進註解與回報）；超過 → 提示（i18n），**保留輸入與附圖**、不送出。
4. **失敗復原**：遠端送出遇到 `FRAME_TOO_LARGE` 或 `Connection closed` 等錯誤時，給使用者提示、`isStreaming` 復原、輸入不遺失（能恢復就恢復，做不到的寫進回報）。
5. **測試**：改寫 `bug211-ws-max-payload.test.ts`：3 × 10 MiB 期望本地 reject、連線不斷、其他 invoke 不受影響；保留「剛好上限 / +1 byte 的 raw ws」斷言作為 server 行為記錄。面板 RTL：遠端超過門檻 → 提示且保留；本機視窗不受影響。
6. **文件**：`CHANGELOG.md` `[Unreleased]` Fixed（BUG-211）；回報區寫 BUG-211 應改的狀態（FIXED）與修正 commit。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
