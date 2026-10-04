---
schema_version: 1
schema_kind: bug
id: BUG-110
title: "遠端 profile 視窗在遠端未連線時，proxied channel 靜默改在本機執行（fail-open）：槽位空 / 重連中 / 槽位屬他 profile 時 pty:create、fs:*、git:* 等落到本機 invokeHandler"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-05T06:12:22+08:00"
updated_at: "2026-10-05T06:25:28+08:00"
fixed_at: "2026-10-05T06:25:28+08:00"
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
| **狀態** | 🔧 FIXED（T0443，待實機驗收） |
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

## 修復（T0443，2026-10-05）

- **路由 fail-closed**：`bindProxiedHandlersToIpc` 改經純函式 `planProxiedInvokeRoute`（`electron/remote/remote-connect-plan.ts`）。ALWAYS_LOCAL 短路不變（仍在路由判斷之前）；本機視窗 / 無 profile 綁定的視窗照舊本機；remote profile 視窗只有在槽位屬於該 profile 且 `isConnected` 時才 `remoteClient.invoke`，其餘（槽位空 / 重連中 / 斷線放棄 / 槽位屬他 profile）**拋錯**，訊息以 `REMOTE_NOT_CONNECTED:` 開頭（含 profileId、reason、channel），**不呼叫本機 `invokeHandler`**。
- **狀態事件**：`RemoteClient.setStatusChangeListener`（auth 成功 / 斷線 → reconnecting / 重連放棄 / `disconnect()` 時 ping）+ main 每次槽位換手 / 清空後推 `remote:client-status-changed`（`{ profileId, connected, state, reason }`）給綁該 profile 的視窗；同狀態去重。每次拒絕另推 `remote:invoke-refused`，renderer 每次斷線只提示一次（i18n 三語 `app.remoteNotConnected` / `app.remoteNotConnectedOtherProfile`）。不做自動重連。
- **init 路徑**：`profile:list` 被拒 → 改讀 `profile:list-local`；`settings:load` 被拒 → 先用預設值不阻塞 init，connected 後背景重載一次；連線失敗的 `profile:load` 被拒 → 不再顯示成本機配置；WorkspaceView 還原時 `settings:get-shell-path` / `pty:create` 被拒 → connected 後重試一次（新開分頁不重試）。

## 已知限制

- **多 remote profile 同時連線仍不支援**：主程式仍只有單一 `remoteClient` 槽位；後開的 remote profile 佔走槽位，先開的視窗改為「未連線」（提示 `app.remoteNotConnectedOtherProfile`，操作被拒，不再落本機）。需重開該 profile 視窗才會換回。per-profile client map 見 PLAN-039。
- **Detached workspace 視窗**（`workspace:detach`）不在 `windowMap`，`getWindowIdByWebContents` 回 `null` → 路由視為無 profile 綁定 → 照舊本機（既有行為，T0443 未改；見 T0443 回報區「遭遇問題」）。
- claude-cli preset（`terminal:create-with-command`）與整合式 Agent 面板（`claude:start-session`）在未連線時被拒後不自動重試，需連線後重開分頁。
