---
schema_version: 1
schema_kind: bug
id: BUG-112
title: "從 remote profile 視窗 detach 出的 workspace 視窗不在 windowMap → 路由視為無 profile 綁定 → 所有 proxied 呼叫在本機執行（BUG-110 同類 fail-open）；也收不到 remote 事件"
status: OPEN
severity: high
reproducibility: always
created_at: "2026-10-05T06:28:31+08:00"
updated_at: "2026-10-05T06:28:31+08:00"
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
| **狀態** | 📂 OPEN |
| 回報者 | T0443 Worker（遭遇問題） |

## 現象（T0443 回報）

- `workspace:detach` 建立的視窗只放進 `detachedWindows`（key 為 workspaceId），不在 `windowMap` → `getWindowIdByWebContents` 回 `null` → `bindProxiedHandlersToIpc` 視為「無 profile 綁定」走本機
- `getWindowsForProfile` 對 detached 視窗以 workspaceId 比對 registry window id → 收不到 remote 事件（`pty:output` 等、T0443 的 `remote:client-status-changed`）

## 修復方向

detach 時記錄 `workspaceId → parentWindowId`（或直接記 profileId），路由與 `getWindowsForProfile` / 事件轉發一併查；detached 視窗套用 T0443 fail-closed 規則。
