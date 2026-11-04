---
schema_version: 1
schema_kind: workorder
id: T0834
title: "PLAN-038 U3：Claude / Codex 面板接線：遠端不可達的本機附件送出時上傳 → `@<serverPath>`；chip 進度、取消、失敗退回提示"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: [T0833, T0842]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉1、5，〈建議方向〉送出時上傳，〈建議下一步〉第 3 列）；T0833 的 `src/lib/remote-upload.ts`；T0437"
affects_files:
  - _ct-workorders/T0834-remote-upload-panels.md
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/client-paths.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - src/lib/__tests__/
  - src/components/__tests__/
  - docs/agent-guide/remote-file-upload.md
  - CLAUDE.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只在 `resolveClientPaths` 判定不可達（有 `reason`）時上傳；本機視窗、WSL 同 distro、`/mnt/c`、Docker 掛載內的附件行為完全不變。上傳失敗 / 超過上限 / 舊 server → 退回現行 T0437 拒絕＋toast。送出時上傳（不是附加時）；上傳期間送出鍵停用、可取消。"
  - "🔴 面板既有的送出流程（T0815 排進同一個 query、`queuedNoteKey`、權限卡 / 提問卡）不得改變；上傳完成後才進入既有送出路徑。不加 Settings 開關（D272）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0834 — PLAN-038 U3：面板接線

## 元資料
- **工單編號**：T0834｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0833｜**規模**：M

## 任務指令

### 前置條件
- T0828 回報區、T0832〈介面契約〉、T0833 回報區（renderer API）
- `CLAUDE.md`「Sub-agent / Active Tasks Tracking」節（T0815 送出流程）

### 任務
1. Claude / Codex `handleSend`：不可達附件 → 上傳 → prompt 以 `@<serverPath>` 帶入（顯示仍用原檔名）；chip 顯示進度、可取消；失敗退回拒絕。
2. i18n（en / zh-TW / zh-CN）。
3. RTL：兩面板 × {全可上傳、部分超上限、上傳失敗退回 toast、取消、本機視窗附件不變}。
4. `CHANGELOG.md` `[Unreleased]` Added：遠端視窗可附加本機檔案（PLAN-038）；docs 補面板一節。
5. **T0833 留下的後續**（塔台 2026-11-04 11:45 併入，見 T0833 回報區〈遭遇問題〉4、5）：
   - 面板拖放的非圖片檔目前只留路徑（`getPathForFile`）；需保留 `File` 物件，遠端不可達時走 T0833 的 `file` 來源（renderer 分塊）。對話框選的檔走 `path` 來源（main 已記白名單）。
   - `CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節補 client 端唯一實作一行（`electron/upload-client.ts` / `src/lib/remote-upload.ts`、面板接線位置），維持 3–12 行。
6. **與 BUG-211（T0842）合流**：遠端送出前的圖片預算 `checkRemoteImageBudget` 照舊套用在圖片（本單不改圖片走法）；非圖片附件走上傳，不計入圖片預算。送出失敗的復原沿用 T0842 的 `restoredInputText` / `restoredAttachments`。

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
