---
schema_version: 1
schema_kind: workorder
id: T0603
title: "探針：BUG-152 安裝版派工不搶焦點（空白測試單，使用者目視）"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P2
sizing: XS
created_at: "2026-10-18T04:21:06+0800"
started_at: ""
updated_at: "2026-10-18T04:21:06+0800"
completed_at: ""
depends_on: [T0599]
related:
  - "BUG-152（FIXED，等安裝版目視）"
affects_files:
  - _ct-workorders/T0603-probe-bug152-focus.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 空白測試單：**什麼都不做**，不讀產品程式碼、不跑指令、不改任何其他檔案；只照 ct-exec 流程標 IN_PROGRESS → 回報區寫一行「空白測試單，無動作」→ DONE → commit 本檔（`git commit --only <本檔>`）→ 通知塔台。不 push。`src/styles/settings.css` 的 M 不是你的變更。"
---

# T0603 — 探針：BUG-152 派工不搶焦點

塔台派出本單時，使用者目視 BAT 畫面是否停在塔台分頁（BUG-152）。Worker 端無任何工作。

---

## 回報區

### 完成狀態

### 產出摘要

### 回報時間
