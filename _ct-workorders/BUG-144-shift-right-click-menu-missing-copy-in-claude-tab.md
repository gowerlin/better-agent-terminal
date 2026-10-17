---
schema_version: 1
schema_kind: bug
id: BUG-144
title: "claude CLI 分頁（滑鼠追蹤開啟）已反白文字後 Shift + 右鍵，BAT 選單只有「貼上」、沒有「複製」"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-16T21:48:35+0800"
updated_at: "2026-10-17T10:35:05+0800"
impact:
  - terminal-context-menu
  - terminal-selection
links:
  discovered_in: "BUG-142 pre.7 實機驗收（第六十九 session，本機 BAT 0.6.1-pre.7，塔台分頁 claude CLI 2.1.300）"
  related: [BUG-142, T0568, T0571, T0573]
---

# BUG-144 — Shift + 右鍵選單沒有「複製」

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（貼上正常；複製可改用其他方式，但 T0568 宣稱的 Shift + 右鍵複製不能用） |
| 可重現 | 必現（使用者實機） |
| **狀態** | ✅ FIXED（T0573 `6e4f3764`，待實機驗收；T0571 `35eaf125` 實機無效） |
| 回報者 | 使用者（BUG-142 實機驗收第 2 項） |

## 現象

- claude CLI 分頁（REPL 開 DECSET 1000 / 1002 / 1003 / 1006）反白一段文字後按 **Shift + 右鍵**：BAT 選單出現，但只有「貼上」，沒有「複製」。
- 使用者兩種選法都試過，結果相同：
  1. 直接拖曳（沒按 Shift）
  2. 按住 Shift 拖曳

## 期望

- 按住 Shift 拖曳選取（xterm 的選取）後，Shift + 右鍵 → 選單有「複製」，複製的內容等於反白文字（T0568 回報區「有選取文字時」的設計）。
- 直接拖曳時反白可能是 claude CLI 自己畫的（xterm 沒有選取），BAT 拿不到這段文字；這種情況的正確行為要先查清楚再決定（見 T0571）。

## 推測根因（T0571 前；證實的根因見「根因與修正」）

- 選單的「複製」由 `contextmenu` 當下 `terminal.getSelection()` 是否為空決定（`src/components/TerminalPanel.tsx`）。T0568 的元件測試只測「追蹤關閉 + 有選取 → 有複製」，沒測「追蹤開啟 + Shift + 有選取」。
- 候選原因：Shift + 右鍵的 mousedown 先清掉 xterm 選取；claude TUI 重繪讓 xterm 清掉選取；Shift 拖曳在追蹤模式下其實沒建立 xterm 選取（反白另有來源）等。

## 根因與修正（T0571，commit `35eaf125`）

- **根因**：xterm 5.5.0 把滑鼠回報當使用者輸入，送出時 `SelectionService` 清掉選取。claude CLI 開 1003，每移動一格都是回報（按住 Shift 也送），Shift + 拖曳的選取在 Shift + 右鍵之前就沒了。只開 1000 / 1002 時選取會留著。
- **修正**：`MouseReportSelectionKeeper`（`src/lib/terminal-context-menu.ts`）在選取只因滑鼠回報被清掉時放回同一範圍（回報照常送進 PTY）；選單「複製」寫入右鍵當下的選取文字。
- **直接拖曳**：反白是 claude 自己的選取，xterm 沒有選取，BAT 讀不到；claude 放開滑鼠即複製（`copyOnSelect` 預設開），不按 Shift 的右鍵也複製。BAT 不處理。
- 驗證：單元 / 元件測試、e2e `e2e/t0571-shift-right-click-copy.spec.ts`（隔離實例）。待使用者實機驗收。

## 實機驗收失敗（pre.8，記錄於 2026-10-17T10:04:44+0800）

- 環境：本機 Windows，BAT `0.6.1-pre.8`（FileVersion 確認），塔台分頁 claude CLI 2.1.300（REPL，非隔離實例）。
- 操作：依塔台指示「按住 Shift 拖曳選取 → 移動滑鼠 → Shift + 右鍵」。
- 結果：畫面上反白**仍在**（使用者截圖：一段文字以藍底反白），但 BAT 選單**只有「貼上」**，沒有「複製」。
- 判定：原問題未解（修正無效）→ 退回 FIXING，派 **T0573**。T0571 的 e2e（node 腳本模擬 1000 / 1002 / 1003 / 1006）通過，但與真實 claude CLI 的行為有落差，落差點待 T0573 查明。

## 根因與修正（T0573，commit `6e4f3764`）

- **實機的藍底反白是 claude 自己的選取**（xterm 選取色 `#5c5142` 棕色）。Shift + 拖曳不送按鍵給 claude，claude 先前一般拖曳的反白會留著；xterm 選取已沒了 → 只有「貼上」。
- **根因 1：聚焦時 claude 重送追蹤模式**。claude CLI 2.1.300 開 DECSET 1004，分頁失焦約 5 秒以上再收到 `ESC [ I` 時重送 `?1000h ?1002h ?1003h ?1006h`（實測 6 s → 重送、2 s → 不重送）。xterm 5.5.0 對每個追蹤 DECSET 都設一次滑鼠協定 → `SelectionService.disable()` → 清選取，不經 `onData`，T0571 的 keeper 不放回；重新聚焦的那一下若是 Shift + 拖曳，DECSET 在拖曳中途到達，拖曳也被結束。
- **根因 2：重選同一範圍沒有事件**。xterm `clearSelection()` / `select()` 不更新 `_oldSelection*`，再拖出完全相同的範圍時不發 `onSelectionChange`，keeper 不知道有選取。
- **修正**：TerminalPanel 以 `?h` CSI handler 在 xterm 處理前通知 keeper（追蹤已開時才算），寫入解析完把選取放回；拖曳仍按著時在原起點以相同修飾鍵補一個 `mousedown` 讓拖曳繼續；Shift + 拖曳放開時主動同步 keeper。開選單時記一行 `[terminal-context-menu] … shown: mouseTrackingMode=… hasSelection=… selectionText=<n> chars keeper=…`。
- **驗證**：隔離實例跑真實 claude CLI 修正前後對照（失焦後 Shift + 拖曳、同範圍重選、選好後失焦再 Shift + 右鍵：修正前只有「貼上」、修正後「複製」且剪貼簿正確）；單元 / 元件測試；e2e `t0571`（腳本加 1004 與聚焦重送 DECSET）/ `t0568`。詳見 T0573 回報區。待使用者實機驗收。
