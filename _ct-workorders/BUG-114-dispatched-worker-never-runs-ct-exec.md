---
schema_version: 1
schema_kind: bug
id: BUG-114
title: "bat-terminal.mjs 派工回報 terminal-created result=ok、exit 0，但新分頁的 agent 未執行預載的 /ct-exec（工單維持 PENDING）；或 Worker 中途靜默停住——塔台無「Worker 已啟動」訊號"
status: OPEN
severity: medium
reproducibility: intermittent
created_at: "2026-10-05T11:32:35+08:00"
updated_at: "2026-10-05T11:32:35+08:00"
impact:
  - auto-session
  - tower-dispatch
links:
  fix_workorder: null
  related: [T0436, T0452, T0457, L143]
---

# BUG-114 — 派工分頁建立成功但 Worker 未啟動

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（YOLO 鏈式派發會無聲卡住；第五十五 session 約 46 次派發中 3 次） |
| 可重現 | 間歇（未找到觸發條件） |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（第五十五 session 觀察） |

## 現象（第五十五 session 證據）

| 工單 | 派發 | `bat-scripts.log` | 實際 |
|---|---|---|---|
| T0452 | 06:37:01 | `terminal-created result=ok terminalId=69012c02…`、exit 0 | 43 分鐘後工單仍 `PENDING` / `started_at: null`、相關檔案 mtime 早於派發 ⇒ `/ct-exec` 從未執行；07:20 重派 17 s 內啟動 |
| T0457 | 07:29:12 | `terminal-created result=ok terminalId=910bc8cf…`、exit 0（與 T0440 成對派發，T0440 正常） | 6 分鐘仍 `PENDING`、無任何檔案活動；07:35 重派 17 s 內啟動 |
| T0436 | 06:00:20 | 正常啟動 | Worker 06:07 寫完回報區（DONE）後停在 commit 前，46 分鐘無活動、無 commit、無通知；以 `/ct-done` 補救 |

- 同 session 正常啟動延遲（派發 → `started_at`）為 17-39 s
- 三次都是 `bat-terminal` 視角成功；塔台無從得知 agent 是否收到 / 執行預載指令

## 待查方向

- 新分頁 agent（Claude CLI）啟動完成前即送出預載 `/ct-exec`（輸入被吞）？yolo `--submit` 時序？
- 多分頁同時建立時的焦點 / 輸入佇列競爭（T0457 為成對派發的第二張；T0452 為單獨派發，不成立）
- Worker 中途停住（T0436）是否為不同根因（agent 等待權限確認 / context 問題）——需看該分頁畫面，塔台無法取得

## 暫行對策（L143）

- 派發後 ≥ 3 分鐘無 `started_at` 才視為疑似未啟動；重派前確認原 Worker 無活動（工單 / 相關檔 mtime / commit），並請使用者關閉舊分頁，避免同單雙 Worker
- 可考慮：Worker 啟動時以 `bat-notify` 送「T#### 開始」心跳，或 BAT 在預載指令送出後回報 agent 是否接收
