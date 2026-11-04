---
schema_version: 1
schema_kind: bug
id: BUG-211
title: "遠端視窗 Claude 面板一次附多張大圖時，送出的 invoke frame 超過 server 32 MiB maxPayload，整條遠端連線以 1009 關閉（T0837 已重現）"
status: FIXED
severity: medium
reproducibility: "always（T0837：真 RemoteServer + RemoteClient 測試，frame > 33,554,432 bytes 必定 1009）"
created_at: "2026-11-04T09:17:09+0800"
updated_at: "2026-11-04T11:25:45+0800"
impact:
  - remote
  - claude-panel
links:
  discovered_in: "T0828 回報區〈建議方向〉之後「另外發現」"
  related: [T0828, T0837, T0842, PLAN-038, T0436, D272, D273]
---
# BUG-211 — 遠端多張大圖超過 32 MiB frame

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（T0837 建議維持：整條 profile 連線斷開，同 profile 所有進行中的 invoke 失敗，約 1–2 s 自動重連；使用者的訊息與圖片無聲遺失） |
| 可重現 | ✅ 必定（T0837 測試重現，`electron/__tests__/bug211-ws-max-payload.test.ts`） |
| **狀態** | 🔧 FIXED（T0842 `bb8cbe1a`，方向 A，D273；待部署驗證：遠端視窗實機附 3 張大圖送出） |
| 回報者 | 塔台（T0828 研究） |

## 現象（T0837 已重現）

`claude:send-message` 把所有圖片 data URL 放在同一個 invoke frame（T0436 client 端讀圖；Claude 面板 `ClaudeAgentPanel.tsx` 與 Codex 面板 `CodexAgentPanel.tsx` 同一條 channel）。面板上限 5 張（`MAX_IMAGES`）、每張 10 MiB（`MAX_ATTACHMENT_IMAGE_BYTES` / `MAX_IMAGE_SIZE`）；server `WS_MAX_PAYLOAD_BYTES` = 32 MiB = 33,554,432 bytes（`electron/remote/remote-server.ts:126`），client（`ws` 8.20.0）沒設 `maxPayload`（預設 100 MiB，只管 client 收的方向）。

T0837 實測（真 `RemoteServer` + 真 `RemoteClient`，loopback wss）：

| 情境 | frame bytes | 結果 |
|---|---|---|
| raw ws，剛好 33,554,432 | 33,554,432 | handler 收到、回 `invoke-result` |
| raw ws，33,554,433 | 33,554,433 | server log `WebSocket error: Max payload size exceeded`，socket close **1009**，handler 沒被呼叫；同 server 其他連線不受影響 |
| RemoteClient，2 × 10 MiB | 27,962,181 | 正常送達 |
| RemoteClient，3 × 10 MiB | 41,943,222 | close **1009**；這次的 `claude:send-message` 與同一 client 另一個進行中的 invoke 都 reject `Connection closed`；client `isReconnecting` → 約 1.8 s 後自動重連成功，之後小 frame 正常；另一個 profile 的 client 不受影響 |
| 計算：3 × 8 MiB | 33,554,610 | 超過（不必到 10 MiB） |
| 計算：5 × 10 MiB | 69,905,304 | 超過 |

門檻：一個 frame 內圖片原始大小合計約 **24 MiB**（25,165,731 bytes，base64 4/3 倍＋JSON 開銷）就超過；2 張任意大小（≤ 10 MiB）一定過得了，3 張以上合計 > 24 MiB 必定斷線。

後果（測試＋讀碼）：
- 整條 profile 連線斷開，同 profile 所有視窗 / 分頁進行中的 invoke 一起失敗（同 profile 共用一個 `RemoteClient`）；其他 profile 不受影響。
- 自動重連（backoff 1–2 s）；server 端的 PTY / session 不受影響（headless 的孤兒 PTY 回收要整段 idle 才觸發，重連遠短於它）。斷線期間 server 推送的 event 不會補送（讀碼推論，未實測）。
- renderer（讀碼推論，未實測）：送出前已清掉輸入框與附圖、`isStreaming` 設為 true；遠端視窗不在本地加使用者訊息；`Connection closed` 不是 `No handler`，`showRemoteUnsupported` 會 rethrow → 沒有任何提示、訊息與圖片無聲遺失、面板可能停在「執行中」。
- server log 只有 `[RemoteServer] WebSocket error: Max payload size exceeded`，沒有 `Client disconnected`（error handler 先 `dropClient`，close handler 找不到 client）。

預期：超過上限時給使用者明確訊息（或改走上傳通道），不應關掉整條連線。

## 重現步驟（T0837 確認）

自動：`npx vitest run electron/__tests__/bug211-ws-max-payload.test.ts`（4 個測試，斷言目前的錯誤行為；修好後需改寫斷言）。

手動：
1. 遠端 profile 視窗（WSL / SSH / Docker 任一）
2. Claude 面板附 3 張約 8–10 MiB 的圖片（合計 > 24 MiB），送出
3. 觀察：遠端視窗短暫斷線重連；送出的訊息與圖片消失、沒有錯誤提示

## 修法候選（重現後決定）

- 遠端視窗限制圖片合計大小（送出前檢查並提示）
- 圖片也走 PLAN-038 上傳通道（T0832–T0834）

## 修正（T0842，`bb8cbe1a`，方向 A）

- `electron/remote/ws-limits.ts`：`WS_MAX_PAYLOAD_BYTES`（32 MiB）由 server 與 client 共用；server `maxPayload` 不變。
- `RemoteClient.invoke`（與 auth frame）送出前算 UTF-8 bytes，超過 → 本機 reject `FRAME_TOO_LARGE: <channel> frame is <n> bytes; the remote connection accepts at most 33554432 bytes`，不送出、連線不斷、其他 invoke 不受影響（`bug211-ws-max-payload.test.ts`：3 × 10 MiB 實測 41,943,230 bytes 本機拒絕，client close codes `[]`）。
- server `Max payload size exceeded` 日誌補連線識別（`client: <label>` / `helper: <role> <id>` / `unauthenticated`）。
- Claude / Codex 面板（遠端視窗）：送出前檢查圖片解碼後合計 ≤ 20 MiB（`src/lib/remote-image-budget.ts`），超過 → toast、保留輸入與附圖、不送出；遠端送出失敗 → 系統訊息顯示原因、輸入與附件放回、復原這次送出開始的 `isStreaming`。本機視窗不檢查、行為不變。
- 未涵蓋：fork 後自動送出的 pending 圖片（`onHistory` 路徑）不做面板檢查，只靠 client 守門（不斷線，但無提示）；方向 B（PLAN-038 上傳通道）仍為長期方案。
