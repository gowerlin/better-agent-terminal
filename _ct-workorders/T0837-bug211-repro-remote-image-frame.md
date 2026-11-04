---
schema_version: 1
schema_kind: workorder
id: T0837
title: "BUG-211 重現：遠端 Claude 面板多張大圖是否讓 invoke frame 超過 32 MiB、整條連線被關閉"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-211；D272；T0828（研究的推論）；T0436（client 端讀圖）；PLAN-038"
affects_files:
  - _ct-workorders/T0837-bug211-repro-remote-image-frame.md
  - _ct-workorders/BUG-211-remote-images-exceed-ws-max-payload.md
  - electron/__tests__/bug211-ws-max-payload.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只重現、不修：不改產品程式碼。可新增一個重現測試檔（上列路徑；若改用 `scripts/smoke-remote-headless.mjs` 類的真 server 腳本，放 scratchpad 不進 repo，或回報後由塔台決定是否收進 repo）。不碰本機 BAT 安裝版與它的 Terminal Server、不連任何真實遠端主機。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0837 — BUG-211 重現

## 元資料
- **工單編號**：T0837｜**類型**：research（重現）｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **intervention_type**：context-dependent

## 研究目標

確認 BUG-211 是否成立：遠端視窗 Claude 面板送出多張大圖時，`claude:send-message` 的 invoke frame 是否超過 server `WS_MAX_PAYLOAD_BYTES`（32 MiB，`electron/remote/remote-server.ts:126`），以及後果（ws close 1009？client 重連？其他分頁 / 進行中的 invoke 是否失敗？）。

## 調查範圍

1. 讀碼確認送出路徑與 frame 內容（面板 `MAX_IMAGES` / 單張上限、data URL 進 frame 的位置、client `RemoteClient` 的 `maxPayload`）。
2. 以真 `RemoteServer`（或 headless server）＋ `RemoteClient` 在測試中送一個 > 32 MiB 的 invoke frame，觀察 close code、client 事件、重連行為；另測 ~31 MiB 的對照。
3. 計算實際門檻：幾張多大的圖會超過（含 JSON / base64 開銷）。
4. 其他會送大 frame 的 channel（若讀碼看到）一併列出。

## 預期產出（回報區）
- 〈調查結論〉成立 / 不成立，附測試輸出與 close code
- 若成立：更新 BUG-211 的重現步驟與嚴重度建議；〈建議方向〉修法比較（送出前限制 vs 改走 PLAN-038 上傳通道 T0832–T0834 vs 調大 maxPayload 的風險）
- 若不成立：說明原因，建議塔台關單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
