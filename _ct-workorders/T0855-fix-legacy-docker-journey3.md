---
schema_version: 1
schema_kind: workorder
id: T0855
title: "修正 legacy 測試 `tests/docker-flow-journeys.test.ts` Journey 3：T0850 後同容器重建改為更新既有設定"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-052
priority: P1
sizing: S
created_at: "2026-11-04T15:37:06+0800"
depends_on: [T0849, T0850]
related:
  - "PLAN-052；D283；T0850（`c0ace27e`）；T0849 回報區〈驗證〉〈後續建議〉；CLAUDE.md「Packaging / Release 前置檢查」Test gate（`test:legacy` 失敗會擋發版）"
affects_files:
  - _ct-workorders/T0855-fix-legacy-docker-journey3.md
  - tests/docker-flow-journeys.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試期望，不改產品程式碼：T0850 的行為（同容器名稱＋loopback 的既有設定 → 更新、名稱保留、不新增）是 D283 的設計。若判斷產品行為才是錯的，停下來問塔台。"
  - "🔴 只改既有檔，不在 `tests/` 新增檔（D177）；`tests/__mocks__/electron-api.ts` 不在本單範圍（T0849 剛改過），必須改時先問塔台。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。T0851 可能同時在跑，不要碰 `src/` 與 `electron/`。"
---

# T0855 — 修正 legacy Docker Journey 3 的期望

## 元資料
- **工單編號**：T0855｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 15:37 (UTC+8)
- **規模**：S｜**決策**：D283（範圍內跟進）｜**可並行**：T0851

## 現象
T0849 回報、塔台 15:36 重跑確認：`npx tsx --test tests/docker-flow-journeys.test.ts` → `✖ Journey 3: mount switching can rebuild the managed container and update the profile`（`second.createdProfileId` 期望 `docker-rebuild`、實際 `undefined`）。在 T0849 之前的乾淨 HEAD（`be1d218a`）同樣失敗，原因是 T0850（`c0ace27e`）讓同容器重跑改成更新既有設定、不再新建 profile；T0850 的驗收沒有列 `test:legacy`，所以沒發現。`test:legacy` 是發版 Test gate 的一部分，會擋下下一次發版。

## 任務
1. 讀 Journey 3 的情境，依 T0850 的行為改期望：重建同名容器後，第二次精靈執行應更新既有設定（`updatedProfileId` 指向原 profile、profile 數不變、埠 / 掛載等為新值、名稱保留），不再斷言 `createdProfileId`。測試標題已是「…update the profile」，維持原意。
2. 同檔其他 Journey 若有同樣的舊假設一併修正；沒有就不動。

### 驗收條件
- [ ] `npx tsx --test tests/docker-flow-journeys.test.ts` 全過
- [ ] `npm run test:legacy` 全過（33 / 33 檔）；`npm run test:unit` 全過
- [ ] commit 只含本單範圍

---

## 回報區

（Worker 填寫）
