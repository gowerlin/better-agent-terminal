---
schema_version: 1
schema_kind: bug
id: BUG-170
title: "yolo 提問備援重派新 Worker 後，舊的 BLOCKED Worker 分頁留著；新 Worker DONE 時 `--close-worker` 因同塔台同工單有兩個分頁回 AMBIGUOUS（exit 5），且新回報時兩個分頁都標 ✓"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-22T00:26:01+0800"
updated_at: "2026-10-22T00:26:01+0800"
impact:
  - worker-tab-recycle
  - control-tower
links:
  discovered_in: "T0693 回報區「調查結論」2（R2）與 4-b（2026-10-21，研究推演，未實機重現）"
  related: [T0693, D180, T0538, T0545, PLAN-041]
---

# BUG-170 — yolo 備援重派後舊 Worker 分頁讓回收 AMBIGUOUS

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只多一個要手動關的分頁；CT 一行提示使用者，不重試） |
| 可重現 | 一定（依程式碼推演；未實機重現） |
| **狀態** | 🔴 OPEN：D180 決定先記錄，修法之後再排 |
| 回報者 | T0693 Worker（研究推演） |

## 現象

yolo Worker 向塔台提問、等不到答覆而改走備援（工單 `BLOCKED` + `tower_question: open`）時，CT 塔台在工單 Renew 區段答覆、`status` 改回 `PENDING`，**派新的 Worker**，不對舊分頁送任何按鍵（control-tower `references/yolo-mode.md` § 塔台端「收到備援」）。舊分頁沒有被回收（它的工單不是 `DONE`）。

- 預期：新 Worker 完成後，`worker_auto_close` 以 `--close-worker T####` 回收 Worker 分頁，舊分頁也不留著。
- 實際：同塔台、同工單有兩個存活分頁 → `--close-worker` 回 `AMBIGUOUS`（exit 5，`electron/close-worker.ts:262`），CT 只「一行回報使用者，不重試」，兩個分頁都要手動關。新 Worker 回報時 `findReportingWorkers` 比對同塔台同工單的所有分頁，兩個都標 `✓`（`src/stores/__tests__/workspace-store.workerReport.test.ts:83` 的測試即此行為）。

## 修正方向（待決定）

- ① CT 端：yolo 備援流程在派新 Worker 前先 `--close-worker` 舊分頁（改 CT skill，跨專案工單）。
- ② BAT 端：派工時偵測同塔台同工單仍有存活分頁並回報（新回應欄位，需介面契約）。
- 決定前先實機確認一次（BAT 日誌 `[T0538] Worker reported` 與該工單分頁數）。
