---
schema_version: 1
schema_kind: workorder
id: T0835
title: "PLAN-038 U4：終端分頁接線：SSH / Docker 掛載外 / 其他 distro 的拖放改上傳後貼路徑；SSH / Docker 視窗 Ctrl+V 貼圖改上傳 PNG 後貼路徑；分頁關閉刪暫存"
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
depends_on: [T0834]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉1、5、6，〈建議下一步〉第 4 列）；T0439（終端拖放貼路徑）；T0524（貼圖鍵）；T0832〈介面契約〉（PTY id session key）"
affects_files:
  - _ct-workorders/T0835-remote-upload-terminal.md
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-drop.ts
  - src/lib/terminal-paste.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - src/lib/__tests__/
  - docs/agent-guide/remote-file-upload.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改「遠端不可達」的情況：本機分頁、WSL 視窗（含 Alt+V 貼圖鍵，維持現狀、只列實機確認）、Docker 掛載內的拖放與貼上行為完全不變。Ctrl+V 圖片改上傳只限 SSH / Docker 視窗；文字貼上不受影響。"
  - "🔴 不改 xterm 寫進 PTY 的其他行為；路徑以既有 `buildTerminalDropInsertion` 的引號規則貼上。分頁關閉時依 T0832 契約清理該 PTY id 的暫存。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0835 — PLAN-038 U4：終端接線

## 元資料
- **工單編號**：T0835｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0834（同改 locales、共用上傳 UI 慣例）｜**規模**：S–M

## 任務指令

### 前置條件
- T0828 回報區、T0832〈介面契約〉、T0833 / T0834 回報區
- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤」「終端連結」節（TerminalPanel 既有規則，避免回歸）

### 任務
1. 拖放：不可達 → 上傳 → 以引號路徑貼上（上傳中提示、可取消、失敗退回 toast）。
2. Ctrl+V 圖片（SSH / Docker 視窗）：main 讀 client 剪貼簿 PNG → 上傳 → 貼路徑；不再送 Alt+V（該情況下必定失敗）。
3. 分頁關閉清暫存（PTY id）。
4. 測試：drop / paste 在 SSH 型視窗走上傳；本機與 WSL 不變。
5. docs 補終端一節；`CHANGELOG.md` `[Unreleased]` 一條。

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
