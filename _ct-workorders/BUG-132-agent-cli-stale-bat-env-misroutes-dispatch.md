---
schema_version: 1
schema_kind: bug
id: BUG-132
title: "agent CLI 自行保存的 BAT_* 環境不是自己 PTY 的值（外部測試者A 的 Codex：SCB 分頁一整天看到專案B 塔台的 BAT_TERMINAL_ID / BAT_WORKSPACE_ID）→ 塔台派工落到別的工作區，Worker 完成通知送進別的專案塔台"
status: FIXED
severity: medium
reproducibility: sometimes
created_at: "2026-10-14T17:04:00+0800"
updated_at: "2026-10-14T17:16:45+0800"
fixed_at: "2026-10-14T17:16:45+0800"
impact:
  - control-tower
  - bat-terminal-helper
  - workspace-routing
  - control-tower-notify
links:
  discovered_in: "T0526（外部測試者A 日誌判定 BUG-129 = T0523 §1 #11）"
  fix_workorder: T0527
  related: [BUG-129, T0523, T0526, PLAN-040, D141]
---

# BUG-132 — agent CLI 沿用別的分頁的 `BAT_*` → 派工落點 / 通知目標錯

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（Worker 落在別的工作區；yolo 時完成訊息會**送進**別的專案塔台並觸發它的流程） |
| 可重現 | 有時（取決於 agent CLI 的環境保存機制；外部測試者A 的 Codex 一整天持續） |
| **狀態** | ✅ FIXED（T0527：cwd 一致性檢查，治標 + 擋 yolo 誤送；遠端 headless 未涵蓋，根治 [A] 仍在 backlog） |
| 回報者 | T0526（外部測試者A 日誌） |

## 現象

證據見 T0526 回報區「判定結果」。重點：

- 外部測試者A 的 SCB 工作區 Codex 分頁（`1ba6042a`）在 05:18 / 05:25 / 05:26 三次派工時，helper 看到的 env 都是**專案B 塔台分頁**的 `BAT_TERMINAL_ID=77f17a65` / `BAT_WORKSPACE_ID=ff79114e`
- 07:56 mac 睡眠觸發 heartbeat 復原，PTY 全部重建且（pre.7）不帶 `BAT_*`；08:02 / 08:13 的 helper 呼叫仍帶同一組值並通過認證 ⇒ 值來自 agent CLI 自己保存的環境（Codex shell snapshot 或 resume 舊 thread，機制未確認），不是當下的 PTY env
- 結果：`--notify-id` 與 `--workspace` 兩者都錯，T0523（塔台終端優先）也會落在專案B；Worker 的 `BAT_TOWER_TERMINAL_ID` 也指向專案B 塔台

## 預期

- 派工落在塔台實際所在的工作區；至少在明顯錯誤時（cwd 屬於另一個工作區）不要靜默派到錯的地方，yolo 模式下不要把完成訊息送進別的塔台

## 修正方向（D141）

- **T0527（[B]）**：派工 cwd 與落點工作區 `folderPath` 的一致性檢查。不一致 → helper 警告 + main `logger.warn`；yolo 且 cwd 明確屬於另一個工作區 → 拒絕派工（exit 1）
- **[A] PID 祖先鏈辨識呼叫者 PTY（根治）**：backlog，#11 反覆發生或其他 agent CLI 出現同類情況時提高優先
- **[C] codex-cli preset 關閉 shell snapshot**：等 外部測試者A 確認機制後評估
