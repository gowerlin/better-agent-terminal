---
schema_version: 1
schema_kind: bug
id: BUG-110
title: "遠端 profile 視窗在遠端未連線時，proxied channel 靜默改在本機執行（fail-open）：槽位空 / 重連中 / 槽位屬他 profile 時 pty:create、fs:*、git:* 等落到本機 invokeHandler"
status: OPEN
severity: high
reproducibility: always
created_at: "2026-10-05T06:12:22+08:00"
updated_at: "2026-10-05T06:12:22+08:00"
impact:
  - remote-profile-trust
  - remote-window
links:
  fix_workorder: T0443
  related: [T0430, T0442, BUG-096, PLAN-036]
---

# BUG-110 — 遠端視窗未連線時落到本機執行

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（遠端視窗在使用者不知情下開本機 shell、讀寫本機檔案、跑本機 git） |
| 可重現 | always（程式碼證據，塔台 06:12 複核） |
| **狀態** | 📂 OPEN |
| 回報者 | T0430 / T0442 Worker（遭遇問題）；塔台複核擴大範圍 |

## 現象（程式碼證據）

- `electron/main.ts` `bindProxiedHandlersToIpc`（約 :2145）：`if (senderIsRemote && senderProfileId === remoteClientProfileId && remoteClient?.isConnected) return remoteClient.invoke(...)`，否則 `return invokeHandler(channel, args, windowId)` —— **遠端視窗在任何不滿足條件的情況都改走本機 handler**
- 觸發情境：
  1. 遠端連線中斷 / RemoteClient 自動重連期間（`isConnected === false`）
  2. T0442 pin 變更 fail-closed 清空槽位後
  3. **同時開兩個不同 remote profile 的視窗**：主程式只有單一 `remoteClient` 槽位，後開的 profile 佔走槽位，先開的視窗所有呼叫靜默變本機
- renderer 無連線狀態變化事件（`remote:client-status` 只在 init / resume 查詢），狀態列可能仍顯示已連線

## 修復方向

- T0443：遠端視窗 + 未連線（或槽位不屬於該 profile）→ 回結構化錯誤（例如 `REMOTE_NOT_CONNECTED`），**不**落本機；ALWAYS_LOCAL channel 維持本機（既有短路）；main 推送連線狀態事件給對應視窗
- 後續候選（架構，待使用者決定）：多 remote profile 同時連線（per-profile client map 取代單一槽位）
