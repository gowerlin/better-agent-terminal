---
schema_kind: tower-state
summary_version: 1
bat_contract: 2
ct_version: "6.4.0-pre.2"
inbox_features: ["recommended", "dismiss", "multi", "menu"]
updated_at: "2026-11-28T15:30:00+0800"
next_ids:
  workorder: "T0960"
  decision: "D490"
  user: "U-59"
  action: "A-2"
awaiting_user:
  - id: "U-57"
    workorder: "T0957"
    kind: "decision"
    source: "tower-question"
    summary: "made-up question 57 (menu handover)"
    options: ["A first", "B later"]
    recommended: "A"
    created_at: "2026-11-28T15:20:00+08:00"
  - id: "U-58"
    workorder: "T0958"
    kind: "decision"
    source: "tower-question"
    summary: "made-up question 58 (menu handover)"
    options: ["A first", "B later"]
    recommended: "A"
    created_at: "2026-11-28T15:21:00+08:00"
menu_open:
  ids: ["U-57", "U-58"]
  opened_at: "2026-11-28T15:23:00+08:00"
user_actions:
  - id: "A-1"
    title: "made-up action"
    created_at: "2026-11-28T15:22:00+08:00"
reminders:
  - id: "made-up-reminder"
    title: "made-up reminder"
    due_at: "2026-11-29T09:00:00+08:00"
---

# made-up body
