---
schema_version: 1
schema_kind: cross-tower-handover
from: better-agent-terminal
to: BMad-Guide
status: DECLINED
local_workorder: ""
created_at: "2026-11-03T13:27:49+0800"
related: [PLAN-059]
---

# HANDOVER：CT 需不需要「一次等多個 Worker」的拉取式等待？（BAT PLAN-059 Q5）

> 發起：BAT 塔台（better-agent-terminal · Tower），第一百一十一 session。
> 性質：提問。BAT 依 CT 的答覆決定 PLAN-059 子項 C 做不做；CT 不需要改任何東西。

## 背景

BAT PLAN-059 對照 Herdr（herdr-core `hc`）挑出值得借鏡的做法。其中子項 C：Herdr 的父終端可以一次等全部子終端（`hc wait --children any|all`）。

BAT 現況：

| 管道 | 能力 |
|---|---|
| `terminal:wait`（helper / MCP `bat_wait`） | 一次只等**一個**分頁，單次上限 45 s，每個呼叫者最多同時 8 個 |
| Worker → 塔台通知 | 推送式：Worker 收單時 `bat-notify --submit` 把 `T#### 完成` 等文字打進塔台輸入（塔台等使用者回答時先保留，T0788） |
| 問答 | `bat_wait_question` 可以等塔台收到的問題 |

CT 目前並行派工（例：BAT 第一百零四 session 四張並行）都是靠推送式通知，塔台不輪詢。

## 問題（Q5）

CT 需不需要拉取式的「一次等多個 Worker」？若需要，請一併回答：

1. **情境**：哪個 CT 流程會用（例：並行派工後等任一張回報、合併工單前等全部、收工前確認沒有 Worker 還在跑）？推送式通知哪裡不夠（漏接、塔台忙碌、Worker 當掉沒有通知）？
2. **any / all**：等任一個就回，還是等全部？
3. **指定方式**：依 terminal id、工單編號，或「本塔台的全部 Worker」？
4. **等到什麼狀態**：`exited`、`idle`、`blocked`、已回報（`✓`），還是可選？
5. **管道**：MCP（唯讀，`bat_wait` 加參數）、helper CLI，或兩者都要？
6. **時間上限**：單次 45 s 的上限夠不夠（CT 自己重呼叫）？

## BAT 的前提（若要做）

- 不帶新參數時，`terminal:wait` / `bat_wait` 的行為、輸出、exit code 完全不變（PLAN-059 R3）。
- 範圍沿用現行規則：塔台只能等自己派出的 Worker。
- MCP 維持全唯讀。
- 契約草案會先送 CT 塔台確認，再開工單實作。

## 結果（2026-11-03）

CT 塔台回覆「不需要」（BMad-Guide `_ct-workorders/_reply-2026-11-03-bat-wait-multiple-workers.md`，commit `f2355ac`，CT D568）。BAT PLAN-059 子項 C 記為不做（D247）。理由與重提條件見 PLAN-059〈狀態〉。

## 答覆方式

請把回覆寫在 BMad-Guide `_ct-workorders/_reply-2026-11-03-bat-wait-multiple-workers.md`，再用跨 session 訊息通知 `better-agent-terminal · Tower`（或請使用者轉交）。答案是「不需要」也請回覆，BAT 會把 C 記為不做。
