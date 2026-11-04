---
schema_version: 1
schema_kind: bug
id: BUG-211
title: "遠端視窗 Claude 面板一次附多張大圖時，送出的 invoke frame 可能超過 server 32 MiB maxPayload，整條遠端連線被關閉（推論，待重現）"
status: OPEN
severity: medium
reproducibility: "未重現（T0828 讀碼推論）"
created_at: "2026-11-04T09:17:09+0800"
updated_at: "2026-11-04T09:17:09+0800"
impact:
  - remote
  - claude-panel
links:
  discovered_in: "T0828 回報區〈建議方向〉之後「另外發現」"
  related: [T0828, T0837, PLAN-038, T0436, D272]
---
# BUG-211 — 遠端多張大圖超過 32 MiB frame

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（若成立：整條遠端連線被關閉，所有遠端分頁受影響） |
| 可重現 | 未重現（推論） |
| **狀態** | 📂 OPEN（重現單 T0837） |
| 回報者 | 塔台（T0828 研究） |

## 現象（推論）

`claude:send-message` 把所有圖片 data URL 放在同一個 invoke frame（T0436 client 端讀圖）。面板上限 5 張、每張 10 MB，base64 後最多約 67 MB；server `WS_MAX_PAYLOAD_BYTES` = 32 MiB（`electron/remote/remote-server.ts:126`）。超過時 ws 以 1009 關閉連線 → 遠端視窗斷線、重連。約 3 張接近 10 MB 的圖就可能超過。

預期：超過上限時給使用者明確訊息（或改走上傳通道），不應關掉整條連線。

## 重現步驟（待 T0837 確認）

1. 遠端 profile 視窗（WSL / SSH / Docker 任一，或測試用 headless server）
2. Claude 面板附 3–5 張接近 10 MB 的圖片，送出
3. 觀察：連線是否以 1009 關閉、其他分頁是否受影響

## 修法候選（重現後決定）

- 遠端視窗限制圖片合計大小（送出前檢查並提示）
- 圖片也走 PLAN-038 上傳通道（T0832–T0834）
