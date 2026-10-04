---
schema_version: 1
schema_kind: workorder
id: T0452
title: "T0444 後續：精靈重試路徑——Docker start-server（new）重試時沿用本次自建容器（docker start 而非再 docker run 撞名）；write-profile 重試成功後清掉前次孤兒 profile"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-111
priority: P2
sizing: S
created_at: "2026-10-05T06:36:25+08:00"
started_at: "2026-10-05T07:20:21+08:00"
updated_at: "2026-10-05T07:25:23+08:00"
completed_at: "2026-10-05T07:25:23+08:00"
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

- [x] 測試：new 模式自建容器後 start-server 失敗 → 重試成功（走 start）；同名非自建容器 → 仍報錯；write-profile 失敗一次後重試成功 → 只留一個 profile
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39；Docker 相關 `npx tsx --test tests/docker-*.test.ts` 綠（T0444 回報區有清單）

## Sub-session 執行指示
1. 讀本工單 + T0444 回報區 + `steps/docker/ownership.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**。兩個重試路徑都已修正；驗收三道（`test:unit`、`tsc`、Docker tsx 測試）全數通過。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo | ✅ PASS | frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 工單路徑 | ✅ PASS | 工單位於 REPO_ROOT 下 |
| C-3 affects_files | ✅ PASS（僅供參考） | 5 筆皆存在 |
| C-2 branch | ℹ️ N/A | 工單無 `branch` 欄位；HEAD 為 `main` |
| BAT_WORKSPACE_ID | ℹ️ | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |

### 產出摘要

**1. start-server（new）重試沿用本次自建容器**（`steps/docker/start-server.ts`）

- 新判斷 `restartOwnContainer` = new 模式 **且** 建立旗標 `dockerContainerCreatedByWizard === 名稱` **且** 容器目前存在（`listContainers`，即 `docker ps -a`）⇒ 呼叫 `startContainer(name, { port })`（既有的 `docker start` 路徑），不再 `docker run` 撞名。
- 旗標在、容器卻不存在（例：第一次 `docker run` 根本沒建出容器，如 image 不存在）⇒ 照常 `docker run`。這條路徑若回 `is already in use`，代表名稱被別人搶走 ⇒ 撤回旗標（T0444 的 `!createdEarlier` 條件在此情境會保留旗標、rollback 會誤刪他人容器，一併修正）。
- 非本次建立的同名容器：`claimNewContainer` 不變，仍直接報錯、不呼叫 `startContainer`；旗標指向其他容器時亦同。
- **token**：`docker run --token` 的值在 `docker run` 失敗時原本會遺失（lifecycle 自行產生），重試 `docker start` 後 server 用的是那個 token。改為 lifecycle 失敗時回傳 token，start-server 在旗標仍屬本次時寫入 `ctx.state.remoteToken`；`restartOwnContainer` 時以 state token 優先（server 以 CLI `--token` 為準，不讀 `server-token.json`，見 `electron/remote/headless-entry.ts` `createHeadlessServer`）。
- 抽出 `containerExists()`，`claimNewContainer` 共用。

**2. `electron/docker-lifecycle.ts`**：僅 create 路徑的 `docker run` 失敗時回 `{ ok:false, token, error }`（型別 `src/types/electron.d.ts` 原本即為 `token?` 選填，不需改）。`-p 127.0.0.1:`（T0418）與 existing 路徑的 `detectContainerExposure`（T0427）未動；仍用 `execFile` + array args。

**3. write-profile 成功時清掉孤兒**（`steps/wsl/write-profile.ts`）

- 新增 `pruneSupersededProfiles()`：SSH / Docker / WSL 三個分支 update 成功後，刪除 `ctx.createdProfileIds` 中除 `createdProfileId`（剛寫入者）以外的 id——只刪本次精靈建立的。刪除拋錯者保留在陣列並 warn，交給 rollback。
- **落點說明**：工單寫「精靈成功完成時」。runner（`wizard-runner.ts`）不在 affects_files，故在 write-profile 成功當下清理；結果等價——之後若有步驟失敗並取消，rollback 本來就刪除陣列內全部 id；若精靈完成，只留一個 profile。
- write-profile 為 `retryable: false`，「重試」實際來自 jumpToStep 跳回後重跑或 runner 重跑（ctx 保留），兩者都會經過此成功路徑。

### 新增 / 調整測試

`src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`（32 → 40 案）

| 情境 | 結果 |
|------|------|
| `docker run` 建立後失敗（port 已占）→ 重試 | 第二次走 `docker start`（`{ port }`，無 `createIfMissing`）成功；token 沿用 `tok-run`；不移除容器 ✅ |
| 旗標在但容器不存在 → 重試 | 再 `docker run` ✅ |
| 旗標在、容器不存在、`docker run` 撞名（被搶） | 撤回旗標、rollback 不移除 ✅ |
| 同名非自建容器、連續重試兩次 | 兩次皆報錯；不 start、不 remove ✅ |
| 旗標指向他容器 + 同名容器存在 | 報錯、不 start ✅ |
| （改寫 T0444 案）本次已建立後重試 | 原斷言「`docker run` 撞名失敗」→ 改為「`docker start` 成功、token 用 state 的 `tok-first`、旗標保留、rollback 仍移除」✅ |
| write-profile 失敗一次後重試成功 | 立即刪 `docker-1`；`createdProfileIds` = `['docker-2']` ✅ |
| write-profile 首次即成功 | 不刪任何 profile ✅ |
| 成功路徑清理時 delete 拋錯 | 保留 `docker-1` + warn；之後 rollback 刪除 ✅ |

`electron/__tests__/docker-lifecycle.test.ts`：新增「`docker run` 失敗時回傳 token」（指定 token / 自產 32 hex 兩種）。

### 驗收結果（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| `npx vitest run electron/__tests__/docker-lifecycle.test.ts src/components/setup-wizard` | ✅ PASS | 27 files / 316 passed |
| `npm run test:unit` | ✅ PASS | **159 files passed / 2537 passed / 1 skipped / 0 failed**（stderr 的 `AttachConsole failed` 為 node-pty conpty agent 雜訊，非測試失敗） |
| `npx tsc --noEmit` | ✅ PASS | **36** errors（≤ 39）；setup-wizard 下唯一一筆仍是既有 `integration.transitions.test.ts(52,10) TS6133`；`docker-lifecycle` 無 |
| `npx tsx --test tests/…`（Docker 相關，T0444 清單） | ✅ PASS | `docker-flow` 3/3、`docker-flow-journeys` 3/3、`docker-wizard-e2e` 5/5、`docker-wizard-runner` 5/5、`wizard-rollback` 6/6、`plan-007-cross-env-smoke` 1/1、`wizard-rollback-cross`（`--test-name-pattern=[Dd]ocker`）1/1 |
| `npx vite build` / `npm run test:e2e` | ⏭️ 未跑 | 依 memory_overrides（L141） |
| 實際 docker daemon | ⏭️ 未跑 | 依 memory_overrides；全部以 mock / 注入 execFile 驗證 |

### 遭遇問題

1. 無阻斷。
2. ℹ️ **已知殘留（範圍外）**：自建容器 `docker start` 重試沿用建立時的 port 綁定；若使用者經 jumpToStep 回到前面改了 port，重試仍會啟動舊綁定的容器（jumpToStep 不走 rollback，T0309 既有 TODO，塔台已記 backlog）。
3. ℹ️ 工作樹有其他 Worker 的未提交改動（`WorkspaceView.tsx`、`pty-replay.ts`、`terminal-drop.ts`、其他工單），本單 commit 以 `git commit --only` 指定路徑，未碰；未用 stash / reset / checkout / restore。

### 改動檔案

- `electron/docker-lifecycle.ts`
- `electron/__tests__/docker-lifecycle.test.ts`
- `src/components/setup-wizard/steps/docker/start-server.ts`
- `src/components/setup-wizard/steps/wsl/write-profile.ts`
- `src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Commit

- 實作 commit `3ef2703`（`fix(wizard): T0452 retry restarts the container this run created; prune orphan profiles on success`，5 files）；`git commit --only` 指定路徑
- 結案 metadata 另一個 commit（只含本工單）
- 未 push

### 回報時間

`2026-10-05T07:25:23+08:00`（系統時間）
