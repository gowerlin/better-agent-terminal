---
schema_version: 1
schema_kind: workorder
id: T0463
title: "PLAN-039 工單 2：main.ts 以 connection registry 取代單一 remoteClient 槽位（T0459 §1 表 #1-#21 全部使用點）；remote:connect 拒絕無綁定、remote:disconnect sender-scoped；移除 other-profile + renderer / preload / i18n 清理；遷移單一槽位前提的測試"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: L
created_at: "2026-10-05T11:29:43+08:00"
started_at: null
updated_at: "2026-10-05T11:29:43+08:00"
completed_at: null
target_version: next
depends_on:
  - T0462
related:
  - "T0459 研究回報區 §1 使用點表（#1-#21）、§6 遷移測試清單、拆單第 2 列（🔴）；遭遇問題中併入本單的既有小問題（`remote:connect` 無綁定佔槽、`remote:disconnect` 無 sender 範圍、`cleanupAllProcesses` 未 await）"
  - "T0419 / T0430 / T0442 / T0443 / T0446 的 guard 測試需同步遷移"
  - "D135"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/App.tsx
  - src/lib/remote-not-connected.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **高風險單（🔴 L）**：大範圍改 `main.ts` 熱點。**本單執行期間塔台不派任何會改 `main.ts` / `preload.ts` / `electron.d.ts` 的平行工單**（避免 hunk 交錯）。先以 T0459 §1 表逐點盤點並在回報區列出每點處置，再動手。"
  - "🔴 不變式（守門必須維持綠）：ALWAYS_LOCAL 短路在路由前；`invokeHandler` 只剩 `local` 出口；remote 視窗未連線一律 `REMOTE_NOT_CONNECTED`（T0443）；pin 變更只拆該 profile（T0442）；detached 視窗依父 profile（T0446）；同 target + pin 才 reuse（T0419）。source guard 新增：無模組層 `let remoteClient` / `remoteClientProfileId`。"
  - "🔴 生命週期接線（寬限期 / 上限對話框 / quit 全量 await）屬 T0464，本單只需 registry 取代槽位且行為正確（可先用「最後視窗關閉立即 release」的最小實作，T0464 換成寬限期）。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push；不部署 WSL。"
---

# T0463 — main.ts 改用 registry（PLAN-039 工單 2）

## 驗收條件

- [ ] 回報區附 #1-#21 逐點處置表與遷移測試清單
- [ ] 整合（vitest in-process）：兩個 headless server + registry，停 Q server → 只有 Q reconnecting，P invoke 照常
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 回報區全文 + T0462 回報區 + T0443 / T0446 / T0442 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

### 塔台補充（第五十六 session，派發前）

- T0462 已落地 `470f81a`：回報區「遭遇問題」末段有**給工單 2 / 3 的接線備註**（`run` 由呼叫端執行 `client.connect(...)`；log / `pushRemoteClientStatus` 依 outcome 在外層做；`settle` 成功時舊 client `void` disconnect）——照此接線。
- T0465 已落地 `b677e71`：`remote-client.ts` 有模組層 `fixedTunnelPortClaims`，於 `maybeCreateTunnel()` claim、`disconnect()` release。registry 經 `dropProfile` / 寬限期釋放 / `disconnectAll` 拆 client 時都必須走 `client.disconnect()`，claim 才會釋放；不要繞過 `disconnect()` 直接丟棄 client。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
