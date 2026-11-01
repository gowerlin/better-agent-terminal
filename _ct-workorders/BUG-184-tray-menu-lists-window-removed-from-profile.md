---
schema_version: 1
schema_kind: bug
id: BUG-184
title: "系統匣圖示選單殘留已「Remove from profile」的視窗，同名項目出現兩個"
status: CLOSED
severity: low
reproducibility: unknown
created_at: "2026-11-01T22:04:49+0800"
updated_at: "2026-11-02T02:13:04+08:00"
closed_at: "2026-11-02T02:13:04+08:00"
closed_reason: "verified"
fixed_at: "2026-11-01T22:21:13+0800"
fixed_by: "T0750 (8a432d40)"
impact:
  - system-tray
  - profile-window
links:
  discovered_in: "BUG-182 實機驗收（2026-11-01，第一百零四 session，使用者回報附截圖）"
  related: [BUG-183]
---

# BUG-184 — 匣圖示選單殘留已移出 profile 的視窗

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（選單多一個項目，容易選錯；不影響終端功能） |
| 可重現 | 未確認（使用者遇到一次） |
| **狀態** | 🚫 CLOSED（2026-11-02 使用者實機驗收通過，安裝版 `v0.7.3-pre.3`） |
| 回報者 | 使用者（BUG-182 實機驗收時，`v0.7.3-pre.1` 安裝版，Windows） |

## 現象

- 系統匣圖示選單同時列出兩個 `Better Agent Terminal - WSL Ubuntu-24.04:1`，其中一個是使用者先前已從 profile 移除的視窗。
- 預期：已移出 profile 的視窗不再出現在匣選單（或該視窗已關閉）。
- 實際：仍列在選單，子選單有 Show / Remove from profile。

## 塔台初步定位（唯讀，未驗證）

- 匣選單由 `rebuildTrayMenu`（`electron/main.ts` 約 816 行）依 `windowMap` 中未 destroyed 的視窗逐一列出，標籤取 `win.getTitle()`；殘留表示那個 BrowserWindow 仍在 `windowMap`（未 destroy，或 destroy 後選單沒重建）。
- 使用者以哪個入口「從 profile 移除」（關窗對話框 / 匣選單 / 配置畫面）未確認；兩個同名標籤也無法分辨。
- 與 BUG-183 可能同源（視窗的存活狀態與 profile registry 不一致），建議同一張修正單處理。

## 修正（T0750，8a432d40）

- **成因（已查證）**：殘留的不是「Remove from profile」，而是**刪除 profile**。使用者的 `windows.json`（唯讀）有一筆存活視窗的 entry，`profileId` 指向已不在 `profiles/index.json` 的 profile（`wsl-ubuntu-24-04-<時間戳>`）；當天日誌依序是精靈建立該 profile（13:45）→ `profile:delete` 兩次（13:51、13:52）→ 重新建立 `wsl-ubuntu-24-04`（13:52）。`profile:delete`（「配置」卡片 ✕，或 WSL 精靈刪除前次嘗試的 profile）只刪 profile、不碰視窗：視窗留著、綁定已不存在的 profile，與重建的同名 profile 視窗並列在匣選單，標題都是 `… - WSL Ubuntu-24.04:1`。
- **已排除**：關窗對話框與匣選單的「Remove from profile」都會 `removeEntry` + `destroy()`（`closed` → `windowMap.delete` → `rebuildTrayMenu`）；若是這兩條，那筆 registry entry 不會還在。
- **修正**：`profile:delete` 成功後 `closeWindowsOfDeletedProfile`（`electron/main.ts`，選擇邏輯 `planDeletedProfileWindows`）destroy 該 profile 的存活視窗（含隱藏的）、刪 registry entry、重建匣選單；那些視窗若是全部的存活視窗，先開 Default profile。
- **匣選單標籤**：未改（提案見 T0750 回報區）。
- **驗證**：unit `src/lib/__tests__/profile-window-front.test.ts`、e2e `e2e/t0750-profile-window-reopen.spec.ts`（突變檢查：未修正版失敗於「C 的視窗應消失」）。待使用者實機驗收。

## 驗收（2026-11-02T02:13:04+08:00，第一百零四 session）

- 修正（T0750 `8a432d40`）在交付版 `v0.7.3-pre.2` 起；使用者以安裝版 `v0.7.3-pre.3` 實機測試通過：在「配置」以 ✕ 刪除開著的 profile 時視窗一併關閉、匣選單不殘留。
- 依 R-G003 改 `CLOSED`（`closed_reason: verified`）。
