---
schema_version: 1
schema_kind: plan
id: PLAN-061
title: "OSC 7501 狀態回報不限 codex：白名單 `codex` / `claude-code`、放寬解析長度（PLAN-059 子項 B）"
status: IN_PROGRESS
priority: low
created_at: "2026-11-02T18:24:49+0800"
links:
  source: "PLAN-059 子項 B；T0787 回報區〈Q2〉〈Q3〉〈建議方向 ③〉；D227"
  related: [PLAN-059, T0787, T0789, T0621, T0717]
---

# PLAN-061 — OSC 7501 白名單（PLAN-059 子項 B）

## 動機

BAT 的 OSC 7501 解析器（`src/lib/codex-terminal-state.ts`）會丟掉 `app≠codex` 的序列，長度上限 128 字元，帶 base64 `title` / `msg` 的序列會被整個丟掉。T0787 查到：目前主動送 7501 的只有 codex；claude（內嵌 `2.1.316`）要終端回覆 `OSC 7501 ; ?` 探詢才送；gemini、opencode 沒有。所以只放寬 `app` 這一項，效益接近 0。真正有價值的是讓 claude 也送，這樣多了一條不靠 hooks 的 blocked 來源，可以補上使用者關掉 hooks（`blockedDetection: none`）的分頁。

## 方向（T0787 建議，待 T0789 結果定案）

1. 白名單 `app ∈ { codex, claude-code }`，不全部開放（PLAN-059 R2：白名單擋得住隨手印出來的 log，擋不住刻意偽造）。
2. 放寬長度上限，只讀 `state` / `kind`，不認得的值忽略（PLAN-059 R5）。
3. BAT 在 xterm 層回覆 claude 的探詢：做法、副作用、與 hook 判斷的優先序，等 T0789 實測。

## 前置

- T0789（研究：回覆 claude 探詢的格式、claude 送出的序列與副作用）。

## 相關

- PLAN-059（主 PLAN）；BUG-196 / T0788（子項 A，與本 PLAN 檔案不重疊）。

## 狀態

- IDEA（D227：登記子 PLAN，等 T0789 結果再定範圍與開單）。
- 2026-11-02 19:05 T0789 DONE → **D229**：範圍縮小為「非 Windows 主機上關掉 hooks 的 claude 分頁」，維持 IDEA、priority 改 low。定案方向：回覆放主行程（T0789 做法 B）；第一版只用在 `blockedDetection: none` 的分頁（同 codex 規則，已是 `hook` 時忽略 7501）；「hook 不知道的事」（Esc 中斷、API 錯誤、背景子代理）不在本 PLAN。觸發條件：有遠端 headless 或 macOS 使用者回報 hooks 關閉時看不到 ⚠️，或 Windows ConPTY 行為改變（升版檢查見 T0789 ⑤-5）。開單時以 T0789〈建議下一步〉的草案為準。

## T0789 結論摘要

（只摘要；證據、序列實錄表與工單草案見 T0789 回報區。）

- 回覆格式：`ESC ] 7501 ; ?`，BEL 或 ST 結尾；要在 claude 的 DA1 回覆之前、2 秒內送到。每個 claude 程序只探詢一次。
- 回覆後（Linux PTY 實測，claude `2.1.316`）：claude 送 `idle` / `working` / `blocked:kind=permission|question` / `done` / `error` / `clear`，與 BAT hook 幾乎同時；`disableAllHooks` 下照送。另有背景子代理的 `id=` 子紀錄。
- **Windows 本機做不到**：系統 ConPTY 丟掉 OSC 回覆，claude 的 DA1 由 conhost 搶答。效益只在非 Windows 主機（遠端 headless、macOS / Linux）。
- 對解析器的影響：實測最長 payload 130（理論約 2.8k）→ 上限建議 4096；`state=clear` 與 `state=clear:id=…` 不帶 `app`，帶 `id=` 的子紀錄不得影響分頁狀態；`title` / `msg` 不解碼、不記錄。
- 副作用：回覆後 claude 不再用 OSC 0 標題做忙碌動畫（BAT 沒用到）；多餘回覆被忽略。
- 建議：範圍縮小為「非 Windows 主機的 claude 7501」；回覆放主行程（`PtyManager` 輸出端）；沿用 codex 規則，已是 `hook` 的分頁忽略 7501。待塔台決定後開單。
- 2026-11-03 21:11 → IN_PROGRESS（D258，使用者指示開始）：T0811（實作，照 D229 / T0789 草案）。
- 2026-11-03 21:35 T0811 DONE（`f274847c`）：解析器白名單 `codex` / `claude-code`、上限 4096、`id=` 子紀錄不影響分頁；`PtyManager.enqueuePtyOutput` 在非 win32 主機以 `PtyManager.write` 回覆探詢一次（replay / child_process 後援 / win32 不回）；hooks 關閉的分頁 `none` → `osc`。WSL 實機：假程式 19 項全過、真 claude 2.1.316（假 API、不送按鍵）回覆後 `osc` / `agentStarted`，win32 對照 0 狀態；真 claude 的權限對話框 `blocked` 未實測（假程式驗）；codex `t0621` e2e PASS。維持 IN_PROGRESS，待發版後交付版驗收。
