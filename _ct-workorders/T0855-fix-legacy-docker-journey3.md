---
schema_version: 1
schema_kind: workorder
id: T0855
title: "修正 legacy 測試 `tests/docker-flow-journeys.test.ts` Journey 3：T0850 後同容器重建改為更新既有設定"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-052
priority: P1
sizing: S
created_at: "2026-11-04T15:37:06+0800"
started_at: "2026-11-04T15:38:03+0800"
updated_at: "2026-11-04T15:40:08+0800"
completed_at: "2026-11-04T15:40:08+0800"
session_ids:
  - "3788c376-1ac5-4391-a73f-65945f15efc8"
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
- **工單編號**：T0855｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:37 (UTC+8)
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

### 完成狀態
- **狀態**：DONE
- **session_id**：3788c376-1ac5-4391-a73f-65945f15efc8
- **產品 commit**：`3d042497`（只含 `tests/docker-flow-journeys.test.ts`）

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`tests/docker-flow-journeys.test.ts` 存在 → PASS
- C-2：工單無 `branch` 欄位，不比對（目前 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 不在 worktree（`CT_HOME` 未設）

### 結果摘要
Journey 3 依 T0850（D283）行為改期望：第二次精靈執行（同容器名稱、loopback）更新既有設定，不新建。改後斷言：
- `first.createdProfileId` = `docker-rebuild`；`second.createdProfileId` = `undefined`；`second.updatedProfileId` = `docker-rebuild`
- `operationLog.createdProfileIds` 只有 `['docker-rebuild']`、`harness.profiles.size` = 1（profile 數不變）
- 該 profile：`name` 保留 `Docker Rebuild`、`dockerContainer` = 原容器名、`dockerMounts` = 新掛載、`remotePort` / `remoteToken` = 第二次執行的值、`remoteFingerprint` = `FP:44:55:66`
- 原有的 remove / 兩次 start / 第二次 start 用新掛載的斷言保留。測試標題不改。

Journey 1 / 2 各只跑一次精靈，沒有「重跑會新建 profile」的假設，未動。產品程式碼、`tests/__mocks__/electron-api.ts` 均未改。

### 變更檔案
- `tests/docker-flow-journeys.test.ts`（Journey 3 期望）
- `_ct-workorders/T0855-fix-legacy-docker-journey3.md`（本工單）

### 驗證
| 閘門 | 結果 | 證據 |
|---|---|---|
| `npx tsx --test tests/docker-flow-journeys.test.ts` | PASS | tests 3、pass 3、fail 0（log 有 `Updated the existing remote profile "Docker Rebuild" instead of creating a new one`） |
| `npm run test:legacy` | PASS | `legacy tests: files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed`，exit 0 |
| `npm run test:unit` | PASS | Test Files 436 passed / 3 skipped（439）；Tests 7795 passed / 40 skipped（7835），exit 0 |
| commit 範圍 | PASS | `3d042497` 只含 `tests/docker-flow-journeys.test.ts`；工作區另有 `_ct-workorders/T0851-…md` 的修改（他單），未碰 |

### 偏離與遭遇問題
- 無。

### 互動紀錄
- （無；yolo，未提問）

### 後續建議
- 無。T0850 類「改變精靈行為」的工單，驗收可一併列 `npm run test:legacy`（塔台已加 Test gate 提醒，見 `628aaa71`）。

