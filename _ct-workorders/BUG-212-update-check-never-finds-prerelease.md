---
schema_version: 1
schema_kind: bug
id: BUG-212
title: "啟動時的新版檢查永遠找不到新版：`releases/latest` 排除預覽版（本 fork 全是預覽版 → 404）、版號比對不認得 `-pre.N`；主行程與每個視窗各查一次"
status: FIXING
severity: medium
reproducibility: "always（2026-11-04 `gh api repos/gowerlin/better-agent-terminal/releases/latest` → HTTP 404）"
created_at: "2026-11-04T18:35:08+0800"
updated_at: "2026-11-04T18:35:08+0800"
impact:
  - update-check
links:
  discovered_in: "第一百二十 session 塔台開單前核對（使用者要求改檢查更新行為）"
  related: [T0863, D287]
---
# BUG-212 — 新版檢查永遠找不到新版

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（使用者永遠收不到新版通知；不影響其他功能） |
| 可重現 | ✅ 必定 |
| **狀態** | ⏳ FIXING（T0863） |
| 回報者 | 塔台 |

## 現象（預期 vs 實際）

- **預期**：裝 `0.7.4-pre.8` 的使用者在 `0.7.4-pre.9` 發佈後啟動 BAT，會看到新版通知。
- **實際**：永遠不通知。

## 原因（讀碼＋查詢，2026-11-04）

1. `electron/update-checker.ts:51` 查 `/repos/gowerlin/better-agent-terminal/releases/latest`。GitHub 的 latest 只算非預覽版；本 fork 的 release 全是 prerelease，實測回 **HTTP 404** → `hasUpdate: false`（`:68-74`）。
2. `compareVersions`（`:25-45`）以 `.` 切開再 `Number()`：`0.7.4-pre.9` → `[0, 7, NaN, 9]`，預覽版比對結果不可靠。
3. release 清單裡混有 `server-bundle-v*`（也是 prerelease），不是桌面版，不能當成新版。
4. 主行程（`electron/main.ts:2218-2239`）與每個視窗的 `UpdateNotification`（`src/components/UpdateNotification.tsx:36-60`）各自向 GitHub 查一次。
5. 「在 GitHub 查看」一律開 `/releases` 總覽（`UpdateNotification.tsx:70`、`main.ts:1341`），最上面可能是 server-bundle 的 release。

## 修正

T0863（同時實作使用者要求的檢查更新行為，D287）。
