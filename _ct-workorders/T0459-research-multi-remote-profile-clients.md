---
schema_version: 1
schema_kind: workorder
id: T0459
title: "研究：PLAN-039 多個 remote profile 同時連線——單一 remoteClient 槽位使用點盤點、per-profile client map 設計、生命週期 / 事件路由 / 資源上限、拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-039
priority: P2
sizing: M
created_at: "2026-10-05T11:19:13+08:00"
started_at: null
updated_at: "2026-10-05T11:19:13+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-039（待研究清單）；BUG-110 / T0443（fail-closed + `REMOTE_NOT_CONNECTED` + `remote:client-status-changed`）"
  - "T0419 / T0430 / T0442（`remote-connect-plan.ts`：`planRemoteConnect` / `settleRemoteConnect` / pin 變更 fail-closed）；T0446（detached 視窗綁 profile）"
  - "PLAN-036 K（T0431-T0434、T0447-T0451：helper 連線、broadcastHub、`countBroadcastReceivers`）"
  - "使用者 2026-10-05 06:14 裁決開 PLAN、11:19 裁決開研究單"
affects_files:
  - _ct-workorders/T0459-research-multi-remote-profile-clients.md
interaction:
  mode_hint: yolo
  interactive: true
  intervention_type: decision-requiring
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。可在 scratchpad 寫探測腳本，不得留在 repo。"
  - "🔴 不部署、不改 WSL / 遠端主機。"
  - "🔴 同工作樹可能有其他 Worker（T0460 改 `electron/main.ts` 的 `shell:open-external`）：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。只 commit 本工單；不 push。"
---

# T0459 — 研究：多 remote profile 同時連線（PLAN-039）

## 背景

`electron/main.ts` 只有一個 `remoteClient` / `remoteClientProfileId` 槽位。兩個不同 remote profile（例：WSL + SSH）同時開視窗時，後開者佔走槽位；T0443 後先開者 fail-closed 顯示「未連線」（`app.remoteNotConnectedOtherProfile`），需重開視窗才能換回。要真正並行使用多個遠端環境，需每個 profile 各自持有 client。

## 研究目標

1. **槽位使用點盤點**（附 `檔案:行`）：`remote:connect`、`loadProfileSnapshotDetailed`、`profile:update`（pin 變更）、`remote:disconnect` / `remote:client-status`、`bindProxiedHandlersToIpc`（`planProxiedInvokeRoute`）、`remoteClientTargets`、`remoteOpMutex`、`getWindowsForProfile` 與 RemoteClient 事件轉發（`PROXIED_EVENTS`）、T0443 狀態事件、detached 視窗（T0446）、path translator 取得處、system resume、其他任何讀 `remoteClient` 的地方
2. **資料結構與並行**：`Map<profileId, { client, target, mutex, status }>`；每 profile 一把 mutex 還是全域；`remote-connect-plan.ts` 純函式如何改成以 profile 為鍵
3. **生命週期**：何時建立 / 斷線（最後一個綁該 profile 的視窗關閉？閒置逾時？），重連策略，app 結束清理（SSH tunnel 子行程）
4. **事件路由**：遠端事件只送綁該 profile 的視窗；複核目前是否有「送給所有視窗」的廣播語意需修
5. **資源**：同時連線數上限、SSH tunnel 本機埠配置衝突、記憶體
6. **與 K 的關係**：本機 BAT 同時連多個 headless server 時，各 server 的 helper / 權杖各自獨立，`created-externally` / `notified` 路由到正確視窗
7. **測試策略**：parity / 守門、單元、e2e 兩個 loopback profile 同時開窗
8. **遷移風險**：哪些既有測試（T0419 / T0430 / T0442 / T0443 / T0446）以單一槽位為前提，需同步改寫
9. **拆單建議**（D 區段表格）

## 互動規則

- 允許向使用者提問（`CT_INTERACTIVE=1`），最多 3 題，選項式（例：生命週期策略、連線數上限）
- 不互動時：給推薦 + 理由

## 回報要求

- 盤點表、設計建議、風險
- `### 拆單建議摘要` 段落，第一個表格欄位必須為 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`（標題欄先用「工單 1」等占位，塔台會補 T####）

## Sub-session 執行指示
1. 讀本工單 + PLAN-039 + BUG-110 + T0443 / T0446 / T0442 回報區 + `electron/remote/remote-connect-plan.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 調查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 拆單建議摘要

### 遭遇問題

### 回報時間
