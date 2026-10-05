---
schema_version: 1
schema_kind: plan
id: PLAN-039
title: 多個 remote profile 同時連線（per-profile RemoteClient 取代單一槽位）
status: PLANNED
priority: medium
created_at: "2026-10-05T06:14:47+08:00"
updated_at: "2026-10-05T06:14:47+08:00"
links:
  research_workorder: null
  related: [BUG-110, T0443, T0442, T0430, T0419, BUG-096, PLAN-036, D134]
---

# PLAN-039 — 多 remote profile 同時連線

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-039 |
| 優先級 | 🟡 Medium |
| 狀態 | 📋 PLANNED（使用者 2026-10-05 06:14 裁決開 PLAN，排在 D134 這批之後） |
| 建立時間 | 2026-10-05 06:14 (UTC+8) |
| 來源 | BUG-110 塔台複核（`electron/main.ts` `bindProxiedHandlersToIpc` 單一 `remoteClient` / `remoteClientProfileId` 槽位） |

## 背景與動機

主程式只有一個 `remoteClient` 槽位。兩個不同 remote profile（例：WSL + SSH）同時開視窗時，後開者佔走槽位，先開者在 T0443 前會靜默改走本機 handler（BUG-110），T0443 後改為 fail-closed 顯示未連線——安全但不可用。要真正並行使用多個遠端環境，需每個 profile 各自持有 client。

## 待研究（Phase 0 研究單）

- 槽位使用點盤點：`remote:connect`（T0419 / T0430 `remote-connect-plan.ts`）、`loadProfileSnapshotDetailed`（T0442）、`profile:update` pin 變更（T0442）、`remote:disconnect` / `remote:client-status`、`bindProxiedHandlersToIpc`、事件轉發（`PROXIED_EVENTS` → 視窗）、`remoteClientTargets` WeakMap、`remoteOpMutex`
- 資料結構：`Map<profileId, { client, target, mutex }>`；生命週期（最後一個視窗關閉時斷線？閒置逾時？）
- 事件路由：遠端事件只送綁該 profile 的視窗（目前廣播語意需複核）
- SSH tunnel / 本機埠占用、資源上限（同時連線數）
- 與 T0443 狀態事件、K（T0431-T0434）helper 連線的關係
- 測試策略：parity / 守門、e2e 兩個 loopback profile

## 不在範圍

- 同一 profile 多條連線

## T0459 研究結論與拆單（D135，2026-10-05 11:29）

- 研究 DONE（`49d71f9`）；使用者裁決：最後視窗關閉 + 15 s 寬限期再斷、同時上限 8（超過拒絕）、同 target 兩 profile 允許 + warn
- 設計：新模組 `electron/remote/remote-connection-registry.ts`（`Map<profileId, …>`、per-profile mutex），`remote-connect-plan.ts` 純函式改以 profile 為鍵；移除 `other-profile` 提示
- 拆單（下 session 起派）：T0462 registry 模組 ∥ T0465 SSH tunnel 埠 → T0463 main.ts 取代單一槽位（🔴 L）→ T0464 生命週期 → T0466 e2e + 實機
