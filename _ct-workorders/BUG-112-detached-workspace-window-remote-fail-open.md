---
schema_version: 1
schema_kind: bug
id: BUG-112
title: "從 remote profile 視窗 detach 出的 workspace 視窗不在 windowMap → 路由視為無 profile 綁定 → 所有 proxied 呼叫在本機執行（BUG-110 同類 fail-open）；也收不到 remote 事件"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-05T06:28:31+08:00"
updated_at: "2026-10-05T06:40:47+08:00"
fixed_at: "2026-10-05T06:40:47+08:00"
impact:
  - remote-profile-trust
  - remote-window
links:
  fix_workorder: T0446
  related: [BUG-110, T0443, PLAN-039]
---

# BUG-112 — detached workspace 視窗遠端 fail-open

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（與 BUG-110 同類：遠端工作區在本機執行 shell / fs / git） |
| 可重現 | always（程式碼證據；T0443 回報） |
| **狀態** | 🔧 FIXED（T0446，待實機驗收） |
| 回報者 | T0443 Worker（遭遇問題） |

## 現象（T0443 回報）

- `workspace:detach` 建立的視窗只放進 `detachedWindows`（key 為 workspaceId），不在 `windowMap` → `getWindowIdByWebContents` 回 `null` → `bindProxiedHandlersToIpc` 視為「無 profile 綁定」走本機
- `getWindowsForProfile` 對 detached 視窗以 workspaceId 比對 registry window id → 收不到 remote 事件（`pty:output` 等、T0443 的 `remote:client-status-changed`）

## 修復方向

detach 時記錄 `workspaceId → parentWindowId`（或直接記 profileId），路由與 `getWindowsForProfile` / 事件轉發一併查；detached 視窗套用 T0443 fail-closed 規則。

## 修復（T0446，2026-10-05）

- **detach 時記錄綁定**：`workspace:detach` 在建窗前記下 `DetachedWindowRecord`（`parentWindowId` + 父視窗當下的 `profileId` + `resolved`）到 `detachedWindowRecords`（key 為 workspaceId）；`closed` / `workspace:reattach` / 最後一個主視窗關閉時一併刪除。
- **解析規則（純函式，`electron/remote/remote-connect-plan.ts`）**：`resolveDetachedProfileBinding(record, parentProfileId)` —— 父視窗仍在且有 profile → 父視窗的；否則 detach 時記錄的；已知的 profile 綁定不會被降級成「無綁定」（= 本機）；兩邊都不明 → `unresolved`。`detachedSenderRouteIdentity` —— 無綁定 → 本機（與父視窗同）；profile 查不到、`unresolved` → 視為 remote（以永不匹配槽位的 `UNRESOLVED_DETACHED_PROFILE_ID`），一律走 T0443 `planProxiedInvokeRoute`：只有該 profile 自己的 client 已連線才遠端，其餘 `REMOTE_NOT_CONNECTED` 拒絕，**不落本機**。
- **套用處**（`electron/main.ts`，新 `getSenderProfileBinding(wc)`）：`bindProxiedHandlersToIpc` 路由、`remote:connect`（T0419 綁定；`unresolved` 拒絕，不以未 pin 方式佔槽）、`remote:client-status`、`app:get-window-profile`、`app:new-window`（繼承父視窗 profile；`unresolved` 不開窗）、`wslFolderDefaultForSender`；`getWindowsForProfile` 以解析後的 profile 比對 detached 視窗 → RemoteClient 事件（`pty:output` 等）、`remote:client-status-changed`、`remote-tools:install-pending` 都會送到 detached 視窗。
- **本機 detached 視窗行為不變**：handler 收到的 `windowId` 仍為 null（`getWindowIdByWebContents` 未改），ALWAYS_LOCAL 短路不變，本機 / 無綁定 profile 路由仍為 `local`。

## 已知限制

- **Detached 視窗目前載不到 workspace（既有，自 `512c118` 多視窗重構起）**：`workspace:load`（ALWAYS_LOCAL）以 `ctx.windowId` 讀 registry，detached 視窗為 null → 回 `null` → 畫面顯示「Workspace not found」，不會建立 WorkspaceView / PTY。本修復讓 detached 視窗的路由、連線狀態、事件綁對 profile，但 detached 視窗本身能否顯示 workspace 屬另案（見 T0446 回報區「遭遇問題」）。
