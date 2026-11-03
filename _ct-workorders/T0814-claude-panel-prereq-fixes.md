---
schema_version: 1
schema_kind: workorder
id: T0814
title: "PLAN-058 W1：Claude 面板前置修正——ELECTRON_RUN_AS_NODE 不寫全域 env、關分頁時關閉 session、query 結束清 queryInstance、command_lifecycle 日誌降噪"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-03T21:31:40+0800"
started_at: ""
updated_at: "2026-11-03T21:31:40+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-058；D259；T0813 回報區〈1〉現況盤點（A7 / A8）、〈6〉W1 草案；BUG-038 / T0161（ELECTRON_RUN_AS_NODE）；PLAN-041 / T0535（`closeTerminalNow`、`--close-worker`）；CLAUDE.md「Worker 分頁回收」「Electron Runtime」「Sub-agent / Active Tasks Tracking」節"
affects_files:
  - electron/claude-agent-manager.ts
  - electron/handlers/claude.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - src/stores/workspace-store.ts
  - src/stores/__tests__/workspace-store.closeTerminalNow.test.ts
  - "electron/__tests__/**（本單新增 / 修改的測試）"
  - "docs/agent-guide/claude-agent-sdk-cli.md（只在需要記錄新 IPC / 行為時）"
  - _ct-workorders/T0814-claude-panel-prereq-fixes.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍只有四項（T0813〈6〉W1）：① `ELECTRON_RUN_AS_NODE=1` 改經 SDK spawn 的 `options.env` 傳入，不再在 query 期間寫進全域 `process.env`（現行 `claude-agent-manager.ts` 約 `:973` 設、`:1219` 刪）；② 新增 `claude:dispose-session`（關閉 query、`close()`、移出 session map），`closeTerminalNow`（`src/stores/workspace-store.ts`）改呼叫它；⏻ 重啟維持 `stopSession`＋`startSession`；③ query 結束時清 `queryInstance`（之後的 `setModel` / `accountInfo` 不再打到已結束的 query）；④ `command_lifecycle` 的 `[claude:msg]` 日誌降噪（不刪資訊，改成摘要或 debug 等級）。不改主回合中送出的行為（那是 T0815 / W0）。"
  - "🔴 不回歸：PTY env 仍剔除 `ELECTRON_RUN_AS_NODE`（BUG-038，`pty-manager.ts`）；`--close-worker` 的關閉路徑與 exit code 不變（只換 IPC），✕ 也走 `closeTerminalNow`；`workspace-store.closeTerminalNow.test.ts` 的 T0535 對照與 source guard 照規則更新、不刪；遠端：新 channel 經 `PROXIED_CHANNELS` / path-aware 設定，headless 同一個 `ClaudeAgentManager`；Agent SDK 找不到 node 時的 Electron-as-node fallback 仍可用（spawn env 有該變數、全域沒有）；T0759 / T0769 的背景子代理與排隊行為不變。"
  - "🔴 不改 `electron/pty-manager.ts`、`CLAUDE.md`（T0811 進行中、同一 checkout；需要改 CLAUDE.md 時寫在回報區〈後續〉由塔台處理）。"
  - "🔴 驗證：單元（fallback 時全域 env 前後不變、spawn env 有該變數；關分頁後 session 不在 map、`close()` 被呼叫；query 結束後 `queryInstance` 為空、`setModel` 不呼叫已結束的 query）＋突變檢查；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；e2e 依影響挑跑（至少 `e2e/v072-pre7-claude-panel-ui.spec.ts`、`e2e/v072-pre6-claude-panel.spec.ts`，需先 `npx vite build`；跑不了寫原因）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。🔴 同一 checkout 有 T0811 的未提交修改（`electron/pty-manager.ts`、`CLAUDE.md`、docs 等），不得 commit、修改或還原它們。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0814 — Claude 面板前置修正（PLAN-058 W1）

## 元資料

- **工單編號**：T0814
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:31:40+0800
- **預估規模**：S

## 背景

T0813 盤點 Claude 面板現況時找到兩個現行就有的小風險：`ELECTRON_RUN_AS_NODE=1` 在 query 期間寫進主行程全域 `process.env`（這段期間主行程起的其他子程序都會拿到），以及關分頁只 `stopSession`、session 留在 map 不 `close()`。另外 query 結束後 `queryInstance` 沒有清，之後的 `setModel` / `accountInfo` 打到已結束的 query。D259：PLAN-058 範圍改為方案 D（T0815）＋本單 W1，本單先做。

## 範圍

見 memory_overrides 第 1 條四項。

## 不做

- 主回合中送出的行為（T0815）、常駐程序（方案 B，延後）、改 `pty-manager.ts` / `CLAUDE.md`、發版、push。

## 驗收

- [ ] 四項的實作說明（函式、IPC、遠端接線）
- [ ] 單元測試與突變檢查結果
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] e2e 結果（或跑不了的原因）
- [ ] 需要塔台補的 CLAUDE.md 內容（若有）

---

## 回報區

<!-- Worker 由此往下寫 -->
