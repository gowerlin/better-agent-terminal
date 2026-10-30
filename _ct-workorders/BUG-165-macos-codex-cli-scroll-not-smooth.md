---
schema_version: 1
schema_kind: bug
id: BUG-165
title: "macOS：Codex CLI 分頁內捲動可用但不夠順"
status: CLOSED
severity: low
reproducibility: unknown
created_at: "2026-10-19T15:42:53+0800"
updated_at: "2026-10-30T16:23:07+0800"
impact:
  - terminal-rendering
  - codex
  - macos
links:
  discovered_in: "外部測試者A 回報（2026-10-19 15:40，v0.7.1-pre.3）"
  related: [BUG-136, BUG-164, T0667, T0669, T0670]
---

# BUG-165 — macOS：Codex CLI 分頁內捲動不夠順

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（捲動可用；體驗改善） |
| 可重現 | 未確認 |
| **狀態** | 🚫 CLOSED（2026-10-30 外部測試者A 在 macOS 實機確認使用正常）。前情：✅ FIXED（T0698 `ec4b3c13`，隨 `v0.7.1-pre.6` 發佈；原 OPEN：T0670 研究 DONE `8c581f5b`：主因候選 = xterm 滑鼠追蹤模式每個 wheel 事件最多送 1 個回報；**跨平台**，macOS 觸控板最明顯；待 外部測試者A 測試 1 確認後決定是否派 S 修正） |
| 回報者 | 外部測試者A（使用者轉達） |

## 現象

- 15:40 外部測試者A：「終端機畫面可以滾，可以的話看能不能再絲滑一點」；15:41「但至少打字卡頓的問題解決了」（BUG-136 已 CLOSED）。
- 使用者補充：指的是**在 Codex CLI 內**捲動。
- 預期：與一般終端（Terminal.app / iTerm2）中的 Codex 一樣順。實際：不夠順（程度未量化）。

## 已知背景

- 版本 `v0.7.1-pre.3`：macOS 預設 `--disable-skia-graphite`（T0669 / BUG-164），縮圖預覽上限（T0667 / BUG-136）。
- 外部測試者A 的 Codex 分頁使用 alt screen（BUG-136 T0666 日誌：`buffer changed: alt`）。

## 待確認（給 外部測試者A）

1. 用觸控板還是滑鼠滾輪？
2. 同一個 Codex 版本在 Terminal.app / iTerm2 裡捲動是否一樣不順？（區分 BAT 端與 codex 端）
3. 只在對話很長的分頁不順，還是新開的分頁也一樣？

## T0670 研究結論（2026-10-19，DONE `8c581f5b`；細節見工單回報區）

- 【原始碼 + 實測】codex 0.163 在 alt screen 自己接管滑鼠（`?1000/1002/1003/1006h`、`?1007l`），每個滾輪回報固定捲 `tui.mouse_scroll_speed` 行（預設 1）並整頁重繪。
- 【原始碼 + 實測】xterm.js 5.5（6.0 亦同）在滑鼠追蹤模式下**每個 wheel 事件最多送 1 個回報**，多的行數丟掉：60 個 × 50 px 快速滑動應捲 173 行，只送 60 個回報；慣性尾段 35.7 → 25。iTerm2 預設依累積行數送多個回報（每事件 ≤ 32）。
- 平台：**跨平台**（BAT / xterm / codex 該路徑皆無平台分支）；macOS 觸控板高頻 pixel-delta + 慣性事件下最明顯（推論）。`--disable-skia-graphite` 對捲動幀率的影響本機無法驗證。
- 次要因素（權重低）：xterm 5.5 不支援同步輸出 DEC 2026（可能偶見半幀）；main 輸出 16 ms 批次不對齊 vsync。
- 建議修正（S，待 外部測試者A 確認）：`TerminalPanel.tsx` `attachCustomWheelEventHandler`，僅 alt buffer + 滑鼠追蹤 + SGR 時依像素累積行數送多個回報（上限約 8），先只套 codex 分頁。不建議：調 `smoothScrollDuration` / `scrollSensitivity`、為此升 xterm 6.0。
- 使用者端暫解：`~/.codex/config.toml` `[tui]` `mouse_scroll_speed = 3`（BAT 不得注入 `-c tui.*`）。
- 副作用紀錄：T0670 在使用者 `~/.codex/sessions/2026/10/19/` 留下兩個測試 session 檔（15:48、15:54），未刪除。

## 外部測試者A 回覆（2026-10-19 17:28，使用者轉達）

- 「用 Claude CLI，滑鼠捲動比較滑順，但用 Codex 就會比較頓」→ 與 T0670 結論相符（問題只在 codex 自己接管滑鼠、每回報 1 行的路徑；Claude CLI 走不同路徑）。
- 「有空再排吧，不急著修」→ 不急，排程時再派 S 修正。`mouse_scroll_speed = 3` 測試尚未回覆。

## 排入修正（2026-10-22T01:48:58+0800，第八十九 session）

- 使用者指出待驗收的項目要包進預覽版讓測試者更新測試；BUG-165 尚無修正程式 → 使用者決定本批就做：T0698（`attachCustomWheelEventHandler`，codex 分頁 + alt buffer + 滑鼠追蹤 + SGR 時依累積行數送多個回報，上限 8）。`mouse_scroll_speed = 3` 暫解照樣寫進更版重點。

## 修正（2026-10-22T02:01:08+0800，T0698 `ec4b3c13`）

- codex 分頁（`agentPreset === 'codex-cli'`）+ alt buffer + `vt200` / `drag` / `any` 追蹤 + SGR 時，`attachCustomWheelEventHandler` 依累積行數送多個 SGR 滾輪回報（每事件上限 8，反向丟餘量），回報與 xterm 逐位元相同；其他情況交回 xterm。helper 派工的 codex Worker 分頁不涵蓋（Q-1）。`test:unit` 5891 passed。
- 待實機：macOS 觸控板手感、Windows / Linux 滾輪一格捲幾行（T0698 前 1 行，之後約與 Claude CLI 分頁相同）；已設 `mouse_scroll_speed = 3` 的使用者可能覺得過快，建議改回預設。

## 結案（2026-10-30T16:23:07+0800，第九十八 session）

- 外部測試者A 回覆（使用者轉達，2026-10-30）：BUG-165 / BUG-166「這兩個可以結案，目前使用上都 ok」。
- 驗證依據：外部測試者A 在 macOS 實機使用 `v0.7.1-pre.6` 起的預覽版（含目前版本）確認 → 🚫 CLOSED。
