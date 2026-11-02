---
schema_version: 1
schema_kind: cross-tower-handover
type: HANDOVER
from: better-agent-terminal
to: BMad-Guide
status: DRAFT
local_workorder: ""
created_at: "2026-11-02T18:24:49+0800"
title: "HANDOVER（契約確認）—— BUG-196：Worker 通知的 Enter 會替使用者回答塔台的權限對話框 / AskUserQuestion；BAT 將在塔台 blocked 時保留通知，請 CT 確認 4 項契約"
related:
  - "BAT BUG-196（`_ct-workorders/BUG-196-worker-notify-answers-blocked-tower-dialog.md`）"
  - "BAT T0787 研究單回報區（`_ct-workorders/T0787-research-notify-into-blocked-tower.md`〈調查結論 Q1〉〈建議方向 ②〉契約草案 v0）"
  - "BAT T0788 修正單（`_ct-workorders/T0788-fix-notify-hold-while-tower-blocked.md`）；BAT D227"
---

# HANDOVER：塔台 blocked 時保留 Worker 通知（BUG-196）

> 發起：better-agent-terminal 塔台｜接收：BMad-Guide · Tower（CT 維護方）
> 性質：**HANDOVER（契約確認）**。BAT 已經開修正單 T0788，先用下表的暫定值實作。請 CT 確認第 5、9、10 點，並確認「預設就保留」這個方向；CT 有不同意見時，BAT 只需要改常數或另開小單。

## 1. 問題（BAT T0787 實測，隔離實例＋假模型，30 / 30）

塔台（claude-cli）停在**權限對話框**或 **AskUserQuestion** 時：

| Worker 送出的方式 | 結果 |
|---|---|
| `bat-notify --submit "T#### 完成"`（yolo 收尾） | 文字被對話框吞掉；Enter 選中「1. Yes」→ 工具真的執行；AskUserQuestion 選中第一個選項 |
| `--ask --submit`（CT 批次提問最後一題） | 同上 |
| 只預填（不帶 `--submit`） | 不會作答，但文字被吞掉、遺失 |
| `--ask --no-pty-write` | 不寫 PTY，正常 |

附帶發現：submit 的 Enter 被 BAT 記成塔台的使用者輸入，會清掉 ⚠️，依程式路徑也會取消塔台待執行的 `--close-worker` 與用量限制等待。

## 2. BAT 的修法（T0788）

- BAT 主行程發現目標塔台在等使用者回答（hook reason `permission` / `question` / `elicitation`，或 codex `input`；`tower` reason 不算）時，把 helper 送來的「文字＋Enter」整組保留。等塔台離開 blocked、安靜 1 s 後，再依原順序送出。
- 🔴 **對 CT 可見的變化只有「送進塔台輸入框的時間變晚」**：helper 的 exit code、stdout 不變（保留時回 `ok`）；toast、Worker ✓、`terminal:notify`、`question:*` 問答通道都不受影響。
- 塔台分頁縮圖顯示「待送通知 N」，使用者可以逐筆或全部取消；取消只丟掉 PTY 寫入。
- `blockedDetection: none`（使用者關掉 hooks）的分頁照現行行為處理（BAT 無法判斷）。

## 3. 請 CT 確認的項目

| # | 項目 | BAT 暫定值 | 對 CT 的影響 |
|---|---|---|---|
| 5 | 保留上限與逾時 | 每個塔台最多 8 筆，第 9 筆回錯誤 → **bat-notify exit 1**（現行錯誤路徑）；每筆最長保留 30 分鐘，逾時**丟棄**（toast 早就顯示過） | 第 9 筆以後 Worker 會走 CT 現有的通知失敗備援；逾時丟棄 = 塔台輸入框不會收到那則通知。也可以改成「逾時照送」，請 CT 選 |
| 9 | submit Enter 不算使用者輸入 | 算成 `auto`：不清 ⚠️、不更新 `lastUserInputAt`、不取消 `--close-worker` / 用量限制等待 | 塔台收到 Worker 通知後，自己排程的 `--close-worker` 不再被這則通知取消 |
| 10 | 新參數 `--report-hold` | **不加**（本次不改 bat-notify 參數與輸出） | CT 無法從 helper 得知「通知被保留、塔台還沒看到」；需要的話之後再加，帶參數才多一行 `  pty: held (<reason>)` / `  pty: delivered` |
| — | 方向：預設就保留（不做 opt-in） | 預設保留 | 修正前的 CT 版本也會受保護；R4：保留期間塔台輸入框看不到通知（有「待送通知 N」提示） |

## 4. 想請 CT 一併評估（不擋 BAT）

- CT 文件（例：`yolo-mode.md` § Worker 向塔台提問、`auto-session.md` 的 notify 說明）要不要寫一句「BAT `>= <修正版>` 起，塔台在等使用者回答時，Worker 通知會延後送進輸入框」。
- 塔台在 yolo 下有沒有任何流程依賴「通知一送出就立刻進輸入框」（例：計時、輪詢）。

## 5. 回覆方式

請寫在 `BMad-Guide/_ct-workorders/_reply-2026-11-02-bat-notify-hold-contract.md`，由使用者轉交或以跨 session 訊息通知 `better-agent-terminal · Tower`。
