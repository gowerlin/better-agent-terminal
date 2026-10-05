---
schema_version: 1
schema_kind: workorder
id: T0464
title: "PLAN-039 工單 3：連線生命週期接線——視窗 / detached closed → release + 15 s 寬限期（到期重算）、開窗保護 60 s、quit 全量 await（上限 2 s）、上限拒絕 'limit' reason + 對話框 i18n、同 target warn log"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:29:43+08:00"
started_at: null
updated_at: "2026-10-05T11:29:43+08:00"
completed_at: null
target_version: next
depends_on:
  - T0463
related:
  - "T0459 研究回報區「生命週期」1-6 與拆單第 3 列；使用者 Q1（最後視窗關閉 + 寬限期）/ Q2（上限 8 拒絕）/ Q3（同 target 允許 + warn）"
  - "D135"
affects_files:
  - electron/main.ts
  - electron/remote/remote-connection-registry.ts
  - electron/remote/remote-connect-plan.ts
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
  - "🔴 規格見 T0459「生命週期」：寬限期到期須在該 profile mutex 內**重算** live 視窗數才 disconnect；縮到 tray 的視窗算 live；quit 以 `Promise.allSettled` 等 ssh 子行程退出（上限 2 s）；不新增自動重連（T0443 決策）。"
  - "🔴 上限拒絕：第 9 個 profile 回 `'limit'` reason，renderer 顯示 i18n 對話框 / 提示（三語），不擠掉既有連線。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push。"
---

# T0464 — 生命週期接線（PLAN-039 工單 3）

## 驗收條件

- [ ] 單元 / 整合：關最後視窗 → 寬限期內重開 reuse、到期斷線；tray 視窗不觸發 release；quit await；第 9 個拒絕 + 提示；同 target warn
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0459 / T0462 / T0463 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

### 塔台補充（第五十六 session，派發前）

- **T0463（`8604daa`）已先做了部分接線，本單在其上補完，不要重做**：視窗 / detached `closed` 已呼叫 `noteRemoteWindowClosed()` → registry 15 s 寬限 + 到期重算；connect 後無 live 視窗會排 60 s 首窗保護；`cleanupAllProcesses` 目前 `void remoteConnections.disconnectAll()`。T0463 刻意**不**採「關窗立即 release」（會打斷 `loadProfileSnapshotDetailed` 連上後、建窗前的空窗），維持此設計。
- **本單剩餘範圍**（T0463 回報區「遭遇問題」第 2 點）：
  1. quit 全量 await（`runCleanupOnce` 目前同步；上限 2 s，`Promise.allSettled`）
  2. `'limit'` 專屬 reason（目前 `remote-unreachable` + 錯誤文字 / `remote:connect` `errorCode: 'remote-limit'`）+ 三語對話框 / 提示；reason 型別若需擴充，同步 `remote-connect-plan.ts` / `preload.ts` / `src/lib/remote-not-connected.ts` / `src/types/electron.d.ts`（已加入 `affects_files`）
  3. 同 target warn log（`connected` outcome 已帶 `sameTargetProfileIds`，未接）
  4. 寬限期 / tray（縮到 tray 的視窗算 live）的 main 層測試
- `npx tsc --noEmit` 只涵蓋 `src/`。改 `electron/**` 時比照 T0463，在 scratchpad 以 extends `tsconfig.node.json` 的 tsconfig 補檢 electron 型別，回報「本單觸及檔案 0 個新錯誤」（不留檔於 repo）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
