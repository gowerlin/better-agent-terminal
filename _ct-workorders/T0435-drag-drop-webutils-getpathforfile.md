---
schema_version: 1
schema_kind: workorder
id: T0435
title: "BUG-107：preload 暴露 webUtils.getPathForFile（shell.getPathForFile），修復 Claude 面板 / Sidebar / Codex 面板拖放取路徑；檔名改以 /[\\\\/]/ 切"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-107
priority: P1
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: null
updated_at: "2026-10-05T05:51:45+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-107；T0421 研究（`ffb06f8`）回報區「調查結論 §0」與拆單第 1 列"
  - "BUG-061（tsc 基線 40 中 `CodexAgentPanel.tsx` TS2339 這筆會消失 → 39）"
  - "D134 追加（T0421 拆單，使用者 05:51 裁決）"
affects_files:
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/Sidebar.tsx
  - src/components/CodexAgentPanel.tsx
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 API 名稱沿用 Codex 既有呼叫 `window.electronAPI.shell.getPathForFile(file)`，preload 以 `webUtils.getPathForFile` 實作（`contextBridge` 內呼叫，不暴露 `webUtils` 物件本身）。"
  - "🔴 **本單不處理遠端路徑轉換**（T0437）。修好後遠端視窗附件會開始送出 client 路徑——這是已知且會在同一版由 T0437 擋住，不要在本單另做遠端判斷。"
  - "🔴 tsc 基線預期 40 → 39（`CodexAgentPanel.tsx` TS2339 消失）；回報區附前後數字。BUG-061 檔不改（塔台更新）。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔（`preload.ts` / `electron.d.ts`）commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0435 — 拖放取路徑（BUG-107）

## 範圍

1. preload `shell.getPathForFile(file)` → `webUtils.getPathForFile(file)`；型別同步
2. `ClaudeAgentPanel.tsx`、`Sidebar.tsx` 的 `file.path` 改用此 API（grep 全庫 `\.path` 於 DragEvent / File 上下文，勿遺漏）
3. `addFileByPath` 等檔名切割改 `/[\\/]/`
4. 測試：RTL 模擬 drop（mock `getPathForFile`）→ 附件 / 工作區加入使用回傳路徑；Windows 路徑檔名正確

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` = 39（或說明差異）
- [ ] 回報區附使用者實機步驟（本機：拖檔到 Claude 面板 / Sidebar / Codex 面板）
- [ ] BUG-107 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-107 + T0421 回報區 §0
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-107；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
