---
schema_version: 1
schema_kind: bug
id: BUG-113
title: "Detached workspace 視窗顯示 Workspace not found：workspace:load / save 以 ctx.windowId 讀寫 registry，detached 視窗不在 windowMap（windowId null）→ load 回 null、save 回 false；自 512c118 多視窗重構起 detach 功能失效（本機 / 遠端皆然）"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-05T06:43:42+08:00"
updated_at: "2026-10-05T06:54:02+08:00"
impact:
  - detached-workspace
links:
  fix_workorder: T0453
  related: [BUG-112, T0446]
---

# BUG-113 — detached workspace 視窗載不到 workspace

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（detach 功能整個不可用；T0453 e2e 實機確認） |
| 可重現 | 必現（T0453 e2e：detached 視窗顯示「找不到工作區」） |
| **狀態** | ✅ FIXED |
| 回報者 | T0446 Worker（遭遇問題 1） |

## 現象（T0446 回報）

- `workspace:load` / `workspace:save`（ALWAYS_LOCAL）以 `ctx.windowId` 讀寫 window registry；detached 視窗不在 `windowMap` → `windowId` null → `main.ts` `if (!ctx.windowId) return null` → load 回 `null`、save 回 `false`
- renderer `App.tsx` detached 模式找不到 workspace → `app.workspaceNotFound`
- guard 來自 `512c118 refactor: single-process multi-window architecture`（2026-03-28），晚於 detach 功能 `070b61a`（2026-02-13）

## 修復方向（T0453）

detached 視窗唯讀載入父視窗 entry（T0446 的 `detachedWindowRecords` 已有 `parentWindowId`），持久化只由父視窗負責；避免 detached 視窗的 store（含全部 workspace、30 秒 autosave）覆寫父視窗 entry。

## 修復（T0453）

- **現況確認**：`e2e/detached-workspace.spec.ts` 對修改前的 build（`dist-electron` 05:26）執行 → detached 視窗 body 為「找不到工作區 此分離的工作區可能已被移除。」（`.workspace-container.active` 0 個）。
- **修法**（`electron/main.ts`，只動 IPC 綁定層，registry handler 不變）：`bindProxiedHandlersToIpc` 在 ALWAYS_LOCAL 短路前，對 `windowId` 為 null 且為 detached 視窗的 `workspace:load` / `workspace:save` 改走 `invokeDetachedWorkspacePersistence`：
  - `workspace:load` → 以 `detachedWindowRecords` 的 `parentWindowId` 唯讀讀取父視窗 entry（`invokeHandler('workspace:load', [], parentWindowId)`）
  - `workspace:save` → 回 `true` 但 no-op（父視窗擁有該 entry；detached 視窗的 store 含全部 workspace 且 30 秒 autosave，寫入會互相覆蓋）
  - 無記錄 / 父視窗 entry 已不存在（「Remove from profile」關閉）→ `null` + warn log → renderer 既有「找不到工作區」畫面；父視窗「Close only」關閉時 entry 仍在，detached 視窗照常載入（唯讀）
- remote detached 視窗：`workspace:*` 本就 ALWAYS_LOCAL（讀本機 registry 的複本），T0446 的 proxied 路由不變。
- **已知限制**：在 detached 視窗內新增 / 關閉的終端不會持久化到父視窗 entry（save 為 no-op）；reattach 後父視窗顯示的是 detach 當時的終端清單。
- **驗證**：e2e 1 passed（detach → 視窗顯示 Beta、終端執行 `echo` 回 `T0453_MARKER_OK` → detached 視窗送出清空 payload 的 save 後父視窗 entry 不變 → reattach 關窗、Beta 回到主視窗側欄）；unit source guard `electron/__tests__/detached-workspace-persistence.test.ts`。
