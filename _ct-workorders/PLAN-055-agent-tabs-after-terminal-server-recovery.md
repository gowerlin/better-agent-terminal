---
schema_version: 1
schema_kind: plan
id: PLAN-055
title: "Terminal Server recovery 後 agent 分頁不再無聲變成 shell：列出被中斷的 agent 分頁，claude 分頁保留 session id 並提供 `--resume`"
status: IDEA
priority: medium
created_at: "2026-10-25T21:16:40+0800"
links:
  source: "T0703 回報區「建議方向」C（BUG-171）；D186"
  related: [BUG-171, T0703, T0704, T0642, T0112]
---

# PLAN-055 — recovery 後的 agent 分頁

## 動機

Terminal Server 真的死掉時，`handleServerDeath` 只重建 shell、不重跑 agent（T0112 起的設計），分頁上原本的 claude / codex 會無聲消失，只剩 `$` 提示字元。BUG-171 一次結束了 5 個塔台與 1 個 Worker，使用者要自己記得哪些分頁原本在跑什麼、再一個個 `claude --resume`。T0704 修掉誤判後，這種情況只會在 server 真的崩潰時發生，但那時損失一樣看不見。

## 方向（T0703 建議 C，未定案）

- recovery 後 renderer 明確列出哪些 agent 分頁被重建（含工作區、分頁標題、Worker 工單）。
- claude 分頁保留 `claudeSessionId`（`ClaudeSessionPersistence`，T0642；recovery 時目前會清除），提供「重新啟動並 `--resume <id>`」。
- 或把被中斷的 agent 分頁標成「agent 已中斷」，而不是只顯示新 shell。
- headless 有自己的 PTY 生命週期，要另外評估。
- Worker 分頁被中斷時是否通知塔台（會牽涉 BAT ↔ CT 契約，需另議）。
