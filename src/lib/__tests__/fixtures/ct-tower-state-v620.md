---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.2.0-pre.1"
inbox_features: ["recommended", "dismiss", "future-value"]
updated_at: "2026-11-25T21:00:00+0800"
next_ids:
  workorder: "T0905"
  decision: "D330"
  user: "U-7"
  action: "A-4"
todo:
  - "原文標記QZX T0902 暫停中（U-2 已放棄），等新方向"
awaiting_user:
  - id: "U-3"
    workorder: "T0901"
    kind: "decision"
    source: "breakpoint-A"
    summary: "原文標記QZX 回報字串不符規格，要怎麼收單"
    options: ["A 接受為 DONE，續派下一張（推薦）", "B 接受為 FAILED", "C 退回 ask 模式"]
    recommended: "A"
    created_at: "2026-11-25T21:00:00+08:00"
  - id: "U-4"
    workorder: "LB-T0184"
    kind: "decision"
    source: "worker-question"
    summary: '原文標記QZX 區塊清單寫法、推薦項比對不分大小寫'
    options:
      - "C1 兩碼代號（推薦）"
      - "b 小寫代號"
    recommended: "c1"
    created_at: "2026-11-25T21:01:00+08:00"
  - id: "U-5"
    workorder: ""
    kind: "decision"
    source: "tower-question"
    summary: "原文標記QZX 自由回答的題目（沒有推薦項）"
    options: []
    created_at: "2026-11-25T21:02:00+08:00"
  - id: "U-6"
    workorder: "T0903"
    kind: "decision"
    source: "breakpoint-E"
    summary: "原文標記QZX 兩個選項各有利弊，交給使用者判斷"
    options: ["A 直接合併", "B 派合併工單"]
    created_at: "2026-11-25T21:03:00+08:00"
user_actions:
  - id: "A-3"
    title: "原文標記QZX 重裝驗收"
    ref: "T0899"
    kind: "verify"
    created_at: "2026-11-25T21:04:00+08:00"
---

# 本文 原文標記QZX
