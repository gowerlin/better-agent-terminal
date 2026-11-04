---
schema_version: 1
schema_kind: workorder
id: T0850
title: "Docker 精靈 W3：重跑精靈時以容器名稱辨識既有設定並更新，不再新增一筆"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: S
created_at: "2026-11-04T15:18:27+0800"
depends_on: []
related:
  - "PLAN-052；D282 / D283；T0848 回報區〈調查結論〉4 與〈建議下一步〉W3；T0552（WSL / SSH 重跑更新同一筆、名稱保留）；T0463（指紋改變只斷開該 profile）"
affects_files:
  - _ct-workorders/T0850-docker-rerun-wizard-updates-profile.md
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/__tests__/write-profile-existing.test.ts
  - src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 Docker 分支：WSL / SSH 的 `findExistingProfiles` / `updateExistingProfiles` 行為與既有測試不變（可共用函式，但不得改變它們的比對結果）。"
  - "🔴 T0849 與本單並行：不要碰 `electron/docker-*.ts`、`steps/docker/*`、`steps/wsl/connect-test.ts`、`error-mapper.ts`、locales、`src/components/setup-wizard/__tests__/docker-flow.test.ts`；本單測試只改 `affects_files` 列的兩個測試檔。若必須改 T0849 範圍內的檔，先問塔台。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0850 — Docker 精靈 W3：重跑精靈更新既有設定

## 元資料
- **工單編號**：T0850｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：S｜**決策**：D283｜**可並行**：T0849（W1）

## 背景
Docker 分支寫設定一律 `profile.create`（`src/components/setup-wizard/steps/wsl/write-profile.ts:202-237`），重跑精靈會多一筆；WSL / SSH 用 `findExistingProfiles` / `updateExistingProfiles`（`:51-91`）更新同一筆。T0848 建議辨識鍵：`targetOS === 'docker-linux'` && `dockerContainer === <容器名稱>` && `isLoopbackHost(remoteHost)`，**不含埠**（重建容器時埠可能重挑）。

## 任務
1. Docker 分支改用上述辨識鍵找既有設定；找到 → 更新 `remotePort`、`remoteToken`、`remoteFingerprint`、`dockerMounts`、`targetOS`，名稱保留（T0552 慣例）；找不到 → 照舊新增。多筆同時符合時沿用 WSL / SSH 的處理方式。
2. rollback（取消 / 失敗）沿用既有機制：更新前的值能還原。
3. 測試：同名容器 → 更新且 profile 數不變；名稱 `-2` 的新容器 → 新增；非 loopback 不比對；rollback 還原；WSL / SSH 既有案例不回歸。

### 驗收條件
- [ ] 上述測試通過；既有 write-profile / 精靈測試不回歸
- [ ] `npm run typecheck` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

（Worker 填寫）
