---
schema_version: 1
schema_kind: workorder
id: T0525
title: "本機 PTY 重建 / 重啟保留完整 env：Terminal Server heartbeat 復原 + Electron pty:restart 的 customEnv（BUG-131）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-131
priority: P2
sizing: S
created_at: "2026-10-14T13:48:52+0800"
started_at: null
updated_at: "2026-10-14T13:48:52+0800"
completed_at: null
target_version: "0.6.0-pre.8"
related:
  - BUG-131
  - "T0523（`dcdfffe`：PTY instance 記 `workspaceId`、restart 沿用）"
  - "T0448（headless restart 保留 customEnv / 角色）"
  - "T0112 / T0108（Terminal Server recovery / 重接）"
  - "T0481（`localHelperEnv()` / `BAT_USER_DATA`）"
affects_files:
  - electron/pty-manager.ts
  - electron/terminal-server/
  - electron/__tests__/
  - _ct-workorders/T0525-pty-rebuild-preserve-env.md
  - _ct-workorders/BUG-131-pty-rebuild-drops-env.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 Terminal Server）；測試一律 mock / 隔離。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。T0524 並行中（改 `src/components/TerminalPanel.tsx` / `src/lib/terminal-paste.ts`），不要碰那兩個檔案。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 remote headless 的權杖語意（PLAN-036 K、T0448）不得改變；server token 不得寫進日誌。"
---

# T0525 — 本機 PTY 重建 / 重啟保留完整 env（BUG-131）

## 背景

T0523 調查塔台派工落點時，發現本機 PTY 有兩條重建路徑會掉 env，詳見 **BUG-131**（請先讀），以及 T0523 回報區 §1 #5、§7-2 / §7-3。

## 任務

1. **Electron `pty:restart`**：比照 T0448（headless）在 PTY instance 保留建立時的 `customEnv`，restart 時沿用，讓工作區 / 全域環境變數、Worker 的 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` 都留下來。helper env（`BAT_REMOTE_TOKEN` / port / `BAT_USER_DATA` 等）用**當下**的值重新產生，不要沿用舊值。T0448 為何當初只做 headless：讀 T0448 回報區，確認 Electron 端沒有刻意不保留的理由；有的話寫進回報區並停在 PARTIAL
2. **Terminal Server heartbeat 復原**（T0112）：重建每個 PTY 時重送完整 env（與第一次 `pty:create` 相同的組法：`envWithUtf8`、`DISABLE_AUTOUPDATER`、`claudeCliUpdateGuardEnv()`（claude-cli preset）、`localHelperEnv()`、`BAT_*`、`customEnv`、`workspaceId`）。若現有架構重建時拿不到這些資訊，就在 instance 上記錄足夠的資料
3. 盡量讓「第一次建立」「restart」「recovery」共用同一個 env 組裝函式，避免三處再次分歧
4. T0108 的 Terminal Server 重接（PTY 活著、不重建）不在本單範圍，只要確認不受影響

## 驗證

- 單元測試：restart 後 env 含原 `customEnv` + 當下的 helper env + `BAT_WORKSPACE_ID`；recovery 重建時送出的 `pty:create` 帶完整 env（mock Terminal Server）；token 改變後 restart / recovery 用新 token
- 既有 `pty-manager-helper-env.test.ts`、T0448 相關 headless 測試全綠
- `npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [ ] restart / recovery 後的 PTY env 與第一次建立時一致（helper 值為當下有效值）
- [ ] 遠端權杖語意不變
- [ ] BUG-131：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-131、T0523 回報區 §1 / §7、T0448 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
