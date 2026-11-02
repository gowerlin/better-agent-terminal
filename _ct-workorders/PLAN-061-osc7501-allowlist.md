---
schema_version: 1
schema_kind: plan
id: PLAN-061
title: "OSC 7501 狀態回報不限 codex：白名單 `codex` / `claude-code`、放寬解析長度（PLAN-059 子項 B）"
status: IDEA
priority: medium
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
