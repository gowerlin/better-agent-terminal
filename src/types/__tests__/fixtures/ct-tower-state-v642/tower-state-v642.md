---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.4.0-pre.2"
inbox_features: ["recommended", "dismiss", "multi", "menu"]
updated_at: "2026-11-28T15:40:00+0800"
next_ids:
  workorder: "T0960"
  decision: "D490"
  user: "U-62"
  action: "A-3"
todo:
  - "原文標記QZX 待辦（選單交接測試）"
awaiting_user:
  - id: "U-57"
    workorder: "T0957"
    kind: "decision"
    source: "tower-question"
    summary: "原文標記QZX 第 57 題（上一個選單被 Esc 關掉，仍待決）"
    options: ["A 先做 原文標記QZX（推薦）", "B 之後再做"]
    recommended: "A"
    created_at: "2026-11-28T15:30:00+08:00"
  - id: "U-59"
    workorder: ""
    kind: "decision"
    source: "tower-question"
    summary: "原文標記QZX 第 59 題（5 個選項，用文字範本，寫進第一題題目）"
    options: ["A 匯出", "B 報表", "C 權限", "D 通知", "E 稽核"]
    created_at: "2026-11-28T15:40:00+08:00"
  - id: "U-60"
    workorder: ""
    kind: "decision"
    source: "tower-question"
    summary: "原文標記QZX 第 60 題（自由回答，用文字範本，寫進第一題題目）"
    options: []
    created_at: "2026-11-28T15:40:00+08:00"
  - id: "U-61"
    workorder: "T0959"
    kind: "decision"
    source: "tower-question"
    summary: "原文標記QZX 第 61 題（開進選單）"
    options: ["A 先做 原文標記QZX（推薦）", "B 之後再做"]
    recommended: "A"
    created_at: "2026-11-28T15:40:00+08:00"
menu_open:
  ids: ["U-61"]
  opened_at: "2026-11-28T15:40:00+08:00"
user_actions:
  - id: "A-2"
    title: "原文標記QZX 實機驗收"
    ref: "T0958"
    kind: "verify"
    created_at: "2026-11-28T15:20:00+08:00"
reminders:
  - id: "weekly-log-review"
    title: "每週日誌清查"
    due_at: "2026-12-02"
---

# 本文 原文標記QZX

6.4.0-pre.2 範例：`menu_open` 寫在 `awaiting_user` 正後方、`user_actions` 之前。
