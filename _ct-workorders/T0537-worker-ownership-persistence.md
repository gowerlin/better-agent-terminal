---
schema_version: 1
schema_kind: workorder
id: T0537
title: "PLAN-041 B'-4：持久化 Worker 歸屬（塔台 id + 工單編號），BAT 重開後 `--close-worker` 仍有效"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-041
priority: P3
sizing: S-M
created_at: "2026-10-15T15:44:39+0800"
updated_at: "2026-10-15T15:44:39+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-041
  - T0534（研究回報 §1.4：BAT 重開後主行程失去歸屬）
  - D144
affects_files:
  - src/types/index.ts
  - src/stores/workspace-store.ts
  - electron/terminal-command-handlers.ts
  - electron/pty-manager.ts
  - src/components/WorkspaceView.tsx
  - src/**/__tests__/
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0537-worker-ownership-persistence.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。e2e 一律隔離實例，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 detached 視窗持久化語意不得改變（`saveDetachedWorkspaceTerminals` 只合併終端清單；CLAUDE.md「Detached workspace 視窗的持久化」）。新欄位隨終端物件一起序列化即可。"
---

# T0537 — 持久化 Worker 歸屬

## 背景

T0535 的歸屬只存在主行程記憶體（`PtyInstance.customEnv.BAT_TOWER_TERMINAL_ID` / `workorder`）。BAT 重開後 Terminal Server replay 重新註冊的 PTY 不帶 `customEnv`（`pty-manager.ts` `handleReplayList`），`--close-worker` 只能回 `NOT_FOUND`。分頁 id 在重開後不變，塔台分頁 id 也不變，所以只要把歸屬存下來就能接續。

## 任務

1. `TerminalInstance` 新增 `towerTerminalId?: string`、`workorder?: string`（`src/types/index.ts`）。
2. `terminal:created-externally` 事件帶上 `workorder`（`terminal-command-handlers.ts`）；`addExternalTerminal` 寫入兩個欄位；`save()` / `applySerializedData` 序列化往返。
3. 重開後還原時把歸屬交回主行程，讓 T0535 的 `findWorkerTerminals` 照常運作。做法由 Worker 決定並在回報區說明理由，例如：
   - renderer 還原分頁時呼叫 `pty:create` / 新 IPC 帶上 `towerTerminalId` / `workorder`，PtyManager 補登記；或
   - 主行程查詢時 fallback 到 window registry 的終端清單。
   不論哪種做法：歸屬只能來自 BAT 自己存的資料，不得由 helper 參數宣告。
4. 塔台分頁本身被關掉或改名不影響已存的歸屬；Worker 分頁被使用者手動 ✕ 後，歸屬隨分頁移除。
5. 文件：CLAUDE.md「Worker 分頁回收（PLAN-041）」移除「BAT 重開後 `NOT_FOUND`」限制，改寫為實際行為（含 Terminal Server 未存活時，Worker 分頁還原成空 shell，仍可被回收）。

## 驗收條件

- [ ] 單元測試：序列化往返；`addExternalTerminal` 寫入；舊資料（無新欄位）載入不變
- [ ] e2e（隔離實例）：派工 → 關閉並重開實例 → 塔台以同一 id 呼叫 `--close-worker` → 成功關閉；detached 視窗中的 Worker 同樣適用
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 範圍外

- 分頁列標示 Worker / 已回報、右鍵批次關閉（方案 D，另案）

## 回報區

（Worker 填寫）
