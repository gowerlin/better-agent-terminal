---
schema_version: 1
schema_kind: bug
id: BUG-111
title: "設定精靈 rollback 會動到非精靈建立的資源：Docker existing 模式 rm -rf /opt/bat-server、docker stop 使用者容器；new 模式沿用既有名稱時 docker rm -f 使用者容器；write-profile retry 遺留 profile"
status: FIXED
severity: high
reproducibility: always
created_at: "2026-10-05T06:13:14+08:00"
updated_at: "2026-10-05T06:34:56+08:00"
impact:
  - setup-wizard-docker
  - data-loss
links:
  fix_workorder: T0444
  related: [T0426, BUG-099, PLAN-032]
---

# BUG-111 — 精靈 rollback 動到使用者資源

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（可能刪除 / 停止使用者自己的容器與資料） |
| 可重現 | always（程式碼證據；T0426 回報） |
| **狀態** | ✅ FIXED（T0444） |
| 回報者 | T0426 Worker（遭遇問題 3）；T0426 讓 cancel 也 rollback 失敗步驟後，觸發機會增加 |

## 現象（T0426 回報）

- Docker `install-server-bundle`（existing 模式）rollback 在使用者容器內 `rm -rf /opt/bat-server`，但該步驟本身沒安裝任何東西（bundle 來自 image）
- Docker `pick-container`（new 模式）沿用 `state.dockerContainer` 既有名稱，rollback `docker rm -f`；名稱若是使用者既有容器會被刪除
- Docker `start-server`（existing 模式）rollback `docker stop` 使用者容器（即使精靈開始前就在跑）
- `write-profile` create 成功、update 失敗後 retry，第一次建立的 profile 遺留（`createdProfileId` 被覆寫）

## 修復方向

rollback 只清「本次精靈執行實際建立 / 啟動」的資源：步驟執行時記錄 `created` / `startedByWizard` 旗標（含原本狀態，例如容器原本是否在跑、名稱是否原本存在），rollback 依旗標決定；write-profile 保留所有已建立 id。

## 修復（T0444）

- 各 Docker 步驟執行時把所有權旗標寫入 `ctx.state`（`dockerContainerCreatedByWizard` / `dockerContainerStartedByWizard` / `dockerContainerWasRunningBefore` / `dockerBundleInstalledByWizard`，容器旗標存名稱）；rollback 只依旗標動作，旗標缺失不動作並 warn（`steps/docker/ownership.ts`）
- `pick-container` new 模式不沿用已存在名稱（改用不衝突名稱並警告）；`start-server` new 模式在 `docker run` 前再檢查，名稱已存在且非本次建立即報錯
- `install-server-bundle` 不再於使用者容器內 `rm -rf /opt/bat-server`（bundle 來自 image，旗標恆 `false`）
- `start-server` existing 模式只 stop 本次從停止狀態啟動的容器
- `write-profile` 以 `ctx.createdProfileIds` 記錄所有建立的 profile，rollback 全刪
- 測試：`src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`（32 案所有權矩陣）；待人工於實際 docker 環境驗收
