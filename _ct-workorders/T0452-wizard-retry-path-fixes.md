---
schema_version: 1
schema_kind: workorder
id: T0452
title: "T0444 後續：精靈重試路徑——Docker start-server（new）重試時沿用本次自建容器（docker start 而非再 docker run 撞名）；write-profile 重試成功後清掉前次孤兒 profile"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-111
priority: P2
sizing: S
created_at: "2026-10-05T06:36:25+08:00"
started_at: null
updated_at: "2026-10-05T06:36:25+08:00"
completed_at: null
target_version: next
depends_on:
  - T0444
related:
  - "T0444（`bb24f33`）回報區「遭遇問題」3 前兩項；`steps/docker/ownership.ts` 所有權旗標"
  - "D134 追加（塔台 06:36 依授權直接決定）；jumpToStep 不走 rollback（T0309 既有 TODO）記 backlog，不在本單"
affects_files:
  - electron/docker-lifecycle.ts
  - src/components/setup-wizard/steps/docker/start-server.ts
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/__tests__/
  - electron/__tests__/docker-lifecycle.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 start-server（new）重試：若 T0444 的所有權旗標表示容器是**本次精靈建立**的，重試改走 `docker start`（或先檢查存在再決定 run / start）；非本次建立的同名容器仍維持 T0444 的報錯行為（不得沿用使用者容器）。`docker-lifecycle.ts` 改動須維持 T0418 的 `-p 127.0.0.1:` 與 T0427 偵測；child_process 規則同 CLAUDE.md。"
  - "🔴 write-profile：精靈**成功完成**時，`ctx.createdProfileIds` 中除最終採用的那個以外的 profile 一併刪除（只刪本次精靈建立的）。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不對實際 docker daemon 執行破壞性指令。"
---

# T0452 — 精靈重試路徑（T0444 後續）

## 驗收條件

- [ ] 測試：new 模式自建容器後 start-server 失敗 → 重試成功（走 start）；同名非自建容器 → 仍報錯；write-profile 失敗一次後重試成功 → 只留一個 profile
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39；Docker 相關 `npx tsx --test tests/docker-*.test.ts` 綠（T0444 回報區有清單）

## Sub-session 執行指示
1. 讀本工單 + T0444 回報區 + `steps/docker/ownership.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
