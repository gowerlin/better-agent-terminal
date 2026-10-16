---
schema_version: 1
schema_kind: bug
id: BUG-145
title: "新分頁的 PTY 有時停在建立時的尺寸（120x30），xterm 已 fit 成較寬的欄數，要按重繪才同步"
status: FIXED
severity: low
reproducibility: intermittent
created_at: "2026-10-16T22:12:44+0800"
updated_at: "2026-10-16T22:26:34+0800"
fixed_in: ecc00c60
impact:
  - terminal-resize
  - pty
links:
  discovered_in: "T0571 e2e 觀察（隔離實例，2026-10-16）"
  related: [T0571, T0572]
---

# BUG-145 — 新分頁 PTY 停在建立時的尺寸

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（推測：TUI 依錯的欄數排版、折行錯位；按工具列重繪可恢復） |
| 可重現 | 還原分頁偶發（競態）；⏻ 重啟必然（T0572 隔離實例實測） |
| **狀態** | ✅ FIXED（T0572，`ecc00c60`，待驗收） |
| 回報者 | T0571 Worker 觀察，塔台開單 |

## 現象

- T0571 的 e2e：隔離實例新分頁的 PTY 有時停在 spawn 尺寸 120x30，xterm 已經 fit 成 137 欄。
- spec 以工具列的 `terminal-redraw`（重送尺寸、PTY 收到 SIGWINCH）繞過後，座標才正確（`e2e/t0571-shift-right-click-copy.spec.ts` 約第 106 行）。
- Worker 判斷為「啟動時的 resize 競態」，不在 T0571 範圍，未處理。

## 期望

- 新分頁（含還原、重啟、外部建立的分頁）的 PTY 尺寸在 xterm 第一次 fit 之後與 xterm 一致，不需要使用者按重繪。

## 待確認

- 是否只在隔離實例 / e2e 發生，還是真實使用者也會遇到（例如 Terminal Server 模式下 `pty:create` 尚未完成時送出的 `pty:resize` 被丟掉）。

## 根因與修正（T0572）

- **根因**：host 一律以 120x30 spawn；`PtyManager.resize` 對尚未註冊的 id 直接丟棄。分頁先進 store、TerminalPanel 掛載即送第一次 `pty:resize`，`pty:create` 卻要等 `getShellFromSettings()` 等非同步步驟後才到 host → resize 可能先到被丟；TerminalPanel 的去重（`lastSentCols` / `lastSentRows`）之後不再送同一尺寸，PTY 停在 120x30。⏻ 重啟（`pty:restart` = kill + create）的新 PTY 也是 120x30，去重同樣擋住重送 → 必然發生。真實使用者路徑同樣會發生（與 e2e / 隔離實例無關）。
- **證據**（隔離實例，修正前）：還原分頁 2 輪中 1 輪 `pty 120x30 / xterm 137x35`（主行程日誌 `pty:create` 與第一次 `pty:resize` 只差 3 ms，先後靠運氣）；⏻ 重啟 2/2 輪 `pty 120x30 / xterm 136x35`，日誌顯示重啟後完全沒有 `pty:resize`。新分頁 8/8 正常（shell 查詢夠快時 create 先到）。
- **修正**（`ecc00c60`）：`createPtyWithReplay`（`created: true`）與 `restartOrCreatePty`（restart 成功）呼叫 `requestPtySizeSync(id)`；TerminalPanel 的 sink 重設去重並 `doResize()`（hidden 分頁等下次 activation）。修正後 e2e 3 輪全部一致。
- **未處理**：Terminal Server recovery 重建（120x30，renderer 不知道）；背景分頁未 fit 前維持 spawn 尺寸（既有行為）。
