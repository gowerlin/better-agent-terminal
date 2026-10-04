---
schema_version: 1
schema_kind: workorder
id: T0444
title: "BUG-111：精靈 rollback 只清本次精靈建立 / 啟動的資源（Docker container / bundle / 啟動狀態、write-profile 多次 create）"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-111
priority: P1
sizing: S
created_at: "2026-10-05T06:13:14+08:00"
started_at: "2026-10-05T06:21:33+08:00"
updated_at: "2026-10-05T06:36:16+08:00"
completed_at: "2026-10-05T06:36:16+08:00"
target_version: next
depends_on:
  - T0427
related:
  - "BUG-111；T0426 回報區「遭遇問題」3（冪等性盤點表）"
  - "D134 追加（塔台 06:13 依授權直接決定）"
affects_files:
  - src/components/setup-wizard/steps/docker/
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **原則：rollback 只撤銷本次精靈執行實際造成的變更**。每個有 rollback 的 Docker 步驟在執行時記錄所有權旗標（例：`containerCreatedByWizard`、`containerWasRunningBefore`、`bundleInstalledByWizard`），寫入精靈 state；rollback 依旗標決定，旗標缺失（舊 state / 判斷失敗）時**不動作**並 warn（fail-safe = 不刪）。"
  - "🔴 Docker `pick-container` new 模式：建立前若同名容器已存在，**不得**沿用並在 rollback 刪除——改為報錯要求換名（或產生不衝突名稱，擇一並說明）。existing 模式 rollback 不 stop 原本就在跑的容器、不 `rm -rf` 非精靈安裝的路徑。"
  - "🔴 `write-profile`：記錄所有本次建立的 profile id（陣列），rollback 全部刪除；不得覆寫遺失。"
  - "🔴 依賴 T0427（同改 `steps/docker/`）。開工前 `git log --oneline -5` 確認。共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不對任何實際 docker daemon 執行破壞性指令。"
---

# T0444 — 精靈 rollback 所有權（BUG-111）

## 範圍

1. Docker 三步驟（`pick-container` / `install-server-bundle` / `start-server`）所有權旗標 + rollback 改寫
2. `write-profile` 多 id 記錄
3. 測試：每個步驟 × (精靈建立 / 使用者既有) × (rollback) 的矩陣；旗標缺失不動作；同名容器存在時 new 模式報錯

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39
- [ ] 回報區附所有權矩陣
- [ ] BUG-111 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-111 + T0426 回報區（冪等性表）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 實際改動檔 + 本工單 + BUG-111；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（BUG-111 → `FIXED`）。`npm run test:unit` 有 1 案失敗，屬平行 Worker 未提交改動的範圍、與本單無關（見下方「驗收結果」與「遭遇問題 1」）。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo | ✅ PASS | frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`） |
| C-1 工單路徑 | ✅ PASS | 工單位於 REPO_ROOT 下 |
| C-3 affects_files | ✅ PASS（僅供參考） | 4 筆皆存在 |
| C-2 branch | ℹ️ N/A | 工單無 `branch` 欄位；HEAD 為 `main` |
| BAT_WORKSPACE_ID | ℹ️ | `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄） |

開工時 `git log --oneline -5` 頂端為 `89c538c`（T0427 已提交，依賴滿足）。

### 產出摘要

**原則**：rollback 只撤銷本次精靈執行實際造成的變更。各步驟在執行時把所有權旗標寫入 `ctx.state`，rollback 依旗標決定；旗標缺失（舊 state、判斷失敗）一律**不動作**並 warn。容器旗標存的是**容器名稱**而非 `true`，旗標對 A 容器不能授權動 B 容器（例如跳回 pick-container 換了容器）。

**新檔 `steps/docker/ownership.ts`**：旗標 key 常數 `DOCKER_OWNERSHIP_KEYS` + `isContainerCreatedByWizard` / `isContainerStartedByWizard` / `isNameConflictError` / `removeContainerIfCreatedByWizard`（移除成功或 `No such container` 時釋放旗標，第二次 rollback 為 no-op）。

| 旗標（`ctx.state`） | 由誰寫 | 意義 |
|------|------|------|
| `dockerContainerCreatedByWizard` | start-server（new） | 本次 `docker run --name` 建立的容器名稱 |
| `dockerContainerStartedByWizard` | start-server（existing） | 本次從停止狀態啟動的既有容器名稱 |
| `dockerContainerWasRunningBefore` | start-server（existing） | 啟動前是否在跑（`inspectContainer`）；未設 = 不明 |
| `dockerBundleInstalledByWizard` | install-server-bundle | 本次是否寫入 bundle；現行 image-baked 恆為 `false` |
| `ctx.createdProfileIds`（`WizardContext` 新欄位） | write-profile | 本次建立的所有 profile id |

**各步驟改動**

- **`pick-container`（new 模式）**：不再沿用已存在的名稱。決策（memory_overrides「擇一」）：**產生不衝突名稱**——偏好名稱（state 帶入）若空閒或為本次建立則保留；否則改用預設 `bat-server-<slug>`，被占用再依序試 `-2`…`-99`，並在 `ctx.warnings` / log 寫「`X already exists and was left untouched; BAT will create Y instead.`」；全被占用才報錯。理由：名稱是精靈自動推導的（UI 沒有輸入欄），直接報錯會讓「同名 profile 重跑精靈」卡住且使用者無處改名；改名不會碰到既有容器。rollback 僅在 `dockerContainerCreatedByWizard === 名稱` 時移除（安全網；正常情況 start-server rollback 已先移除）。
- **`start-server`**：
  - new：`docker run` 前**再檢查一次** `listContainers`（pick-container 可能很早就跑過），名稱存在且非本次建立 ⇒ 直接報錯、**不呼叫** `startContainer`。檢查通過即在呼叫前寫入建立旗標（`docker run --name` 只可能建立我們的容器，涵蓋「建立後啟動失敗，例如 port 已占用」）；若回 `is already in use`（檢查與 run 之間被搶名）且並非先前已由本次建立 ⇒ 撤回旗標。
  - existing：啟動前 `inspectContainer` 記錄 `WasRunningBefore`；原本停止才寫 `StartedByWizard`。重試時若旗標已在（第一次嘗試啟動的）則保留，不因「現在在跑」而失去所有權。inspect 失敗 ⇒ 不寫旗標（rollback 不 stop）。
  - rollback：new 只移除本次建立者；existing 只 stop 本次啟動者，原本就在跑的寫 info「Leaving … running」，不明者 warn。
- **`install-server-bundle`**：run 寫 `dockerBundleInstalledByWizard = false`（bundle 來自 image，本步驟只驗證）；rollback 僅在旗標 `=== true` 時 `rm -rf`（現行永不成立）⇒ **不再在使用者容器內 `rm -rf /opt/bat-server`**；旗標缺失且 existing 模式時 warn。
- **`write-profile`**：`recordCreatedProfile()` 累積 `ctx.createdProfileIds`，`createdProfileId` 仍為最新一筆（`SetupWizardShell` 完成時開啟的 profile，相容）。rollback 刪除陣列全部 id（含舊 ctx 只有 `createdProfileId` 的情況）；`delete` 拋錯者保留並 warn 供下次 rollback，`false` 視為已不存在。

### 所有權矩陣（`src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`，32 案）

| 步驟 | 情境 | rollback 行為 | 測試 |
|------|------|------|------|
| pick-container（new） | 預設名稱空閒 | 無旗標 → 不移除 | ✅ |
| pick-container（new） | 預設名稱被使用者容器占用 | 改用 `-2` + 警告；不移除使用者容器 | ✅ |
| pick-container（new） | 帶入名稱屬使用者（例：先前選過 existing） | 改用預設名稱；不移除 | ✅ |
| pick-container（new） | 帶入名稱空閒 | 保留 | ✅ |
| pick-container（new） | 名稱為本次建立（重跑） | 保留；rollback 移除一次、旗標清除、再次 rollback no-op | ✅ |
| pick-container（new） | 旗標指向其他容器 | 不移除 | ✅ |
| pick-container（existing） | 使用者容器（即使有殘留旗標） | 不移除 | ✅ |
| pick-container（new） | `-2`…`-99` 全被占用 | 報錯 | ✅ |
| start-server（new） | 本次建立、健康檢查失敗 | 移除 + 清旗標；pick-container 安全網 no-op | ✅ |
| start-server（new） | `docker run` 建立後失敗（port 已占用） | 移除 | ✅ |
| start-server（new） | 名稱已存在、非本次建立 | run 報錯且不呼叫 `startContainer`；rollback 不移除 | ✅ |
| start-server（new） | 搶名競態（`is already in use`） | 撤回旗標、不移除 | ✅ |
| start-server（new） | 本次已建立後重試（run 回 conflict） | 保留旗標、移除自己的容器 | ✅ |
| start-server（new） | 旗標缺失（舊 state） | 不移除 + warn | ✅ |
| start-server（new） | 容器已不存在 | 釋放旗標、不 warn | ✅ |
| start-server（existing） | 原本停止 → 本次啟動 | stop + 清旗標；不移除 | ✅ |
| start-server（existing） | 原本就在跑 | 不 stop（info） | ✅ |
| start-server（existing） | inspect 失敗（不明） | 不 stop + warn | ✅ |
| start-server（existing） | 旗標缺失（舊 state） | 不 stop | ✅ |
| start-server（existing） | 重試（第一次已啟動） | 保留旗標 → stop | ✅ |
| start-server（existing） | 旗標指向其他容器 | 不 stop | ✅ |
| install-server-bundle（existing） | image-baked | 不 `rm -rf` | ✅ |
| install-server-bundle（new） | image-baked | 不動作 | ✅ |
| install-server-bundle | 旗標缺失（舊 state） | 不 `rm -rf` + warn | ✅ |
| install-server-bundle | 旗標 `true`（明示本次安裝） | `rm -rf` + 清旗標 | ✅ |
| Docker 流程取消（runner） | existing、使用者容器在跑、start-server 失敗 → 取消 | 無 stop / rm / `rm -rf` | ✅ |
| Docker 流程取消（runner） | new、預設名稱被占 → 建 `-2` → 失敗 → 取消 | 只移除 `-2`，使用者容器保留 | ✅ |
| write-profile | create 成功 / update 失敗 ×2 | 兩筆都刪；再次 rollback no-op | ✅ |
| write-profile | 失敗後重跑成功 | `createdProfileId` = 最新；rollback 連孤兒一起刪 | ✅ |
| write-profile | 某筆 delete 拋錯 | 保留該 id + warn；下次 rollback 刪除 | ✅ |
| write-profile | 舊 ctx 只有 `createdProfileId` | 刪除 | ✅ |
| write-profile | 未建立任何 profile | 不動作 | ✅ |

### 驗收結果（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| `npx vitest run src/components/setup-wizard` | ✅ PASS | 26 files / **280 passed**（新增 32 案） |
| `npm run test:unit` | ⚠️ PARTIAL（本單範圍 PASS） | **143 files / 2289 passed / 1 failed / 1 skipped**。唯一失敗：`electron/remote/__tests__/headless-pty.test.ts` › `remote shell env has no server token and no inherited BAT_* session vars`（shell env 含 `BAT_REMOTE_`）；單獨重跑仍失敗（11 passed / 1 failed）。本單未改任何 `electron/` 檔；該測試涵蓋的 `electron/pty-manager.ts` / `electron/remote/headless-entry.ts` 在工作樹中有平行 Worker（T0433「helper in server bundle and pty env」）未提交的改動（+282/-10），並在 BAT session 內執行（env 本身帶 `BAT_REMOTE_*`）。依 L138 未用 stash / checkout 隔離驗證 |
| `npx tsc --noEmit` | ✅ PASS | **39** errors（= 門檻 39）；setup-wizard 下唯一一筆為既有 `integration.transitions.test.ts(52,10) TS6133`（本單未改該檔） |
| `tests/` 舊 tsx 測試（不在 `test:unit` 內，`npx tsx --test`） | ✅ Docker 相關全過 | 改動後：`docker-flow` 3/3、`docker-flow-journeys` 3/3、`docker-wizard-e2e` 5/5、`docker-wizard-runner` 5/5、`wizard-rollback` 6/6、`plan-007-cross-env-smoke` 1/1、`wizard-rollback-cross` docker 案 ✅。`wizard-rollback-cross` 的 wsl / ssh 兩案與 `wizard-runner.test.ts` 兩案 60s 逾時——**改動前基準線即相同逾時**，與本單無關 |
| `npx vite build` / `npm run test:e2e` | ⏭️ 未跑 | 依 memory_overrides（L141） |
| 實際 docker daemon | ⏭️ 未跑 | 依 memory_overrides，未對任何 docker daemon 執行指令；全部以 mock 驗證 |

### 遭遇問題

1. **`test:unit` 1 案失敗（範圍外）**：`headless-pty.test.ts` 的 BAT_* env 斷言，見上表。屬 T0433 工作區；建議塔台待 T0433 提交後重跑確認
2. **改了 affects_files 以外的 2 個測試檔（`tests/`）**：兩案把 BUG-111 的舊行為寫成預期，修正後必然失敗，僅改斷言：
   - `tests/wizard-rollback-cross.test.ts` docker 案原斷言「existing 模式 rollback 會 `rm -rf /opt/bat-server`」→ 改為「不得 exec、不得移除使用者容器」
   - `tests/docker-wizard-e2e.test.ts`「mount validation failure…」原斷言 pick-container rollback 對**從未建立**的容器 `docker rm -f` → 改為不移除任何容器（測試名稱同步調整）
   - 這些檔不在 `npm run test:unit` 內（需 `npx tsx --test` 手動跑）
3. ℹ️ **既有行為、未改（範圍外，建議評估）**：
   - start-server（new）在**本次已建立容器後**重試，`docker run` 必然回 name conflict（`startContainer` 的 `createIfMissing` 一律 `docker run`，不會 `docker start` 既有的自建容器）⇒ 重試永遠失敗，只能取消（取消會正確移除自建容器）。修法需動 `electron/docker-lifecycle.ts`
   - write-profile 失敗後重跑**成功**時，前一次的孤兒 profile 只有在之後發生 rollback 才會刪；若精靈就此完成，孤兒會留下。工單只要求 rollback 全刪，未在成功路徑清孤兒
   - jumpToStep 仍不走 rollback 鏈（T0309 既有 TODO）；本單旗標以容器名稱為鍵，跳回換容器後舊旗標不會誤授權
4. ℹ️ 平行 Worker：HEAD 在執行期間由其他 session 推進到 `0681252`；本單 commit 只含本單檔案（`git commit --only` 指定路徑），未用 stash / reset / checkout / restore

### 改動檔案

- `src/components/setup-wizard/steps/docker/ownership.ts`（新）
- `src/components/setup-wizard/steps/docker/pick-container.ts`
- `src/components/setup-wizard/steps/docker/start-server.ts`
- `src/components/setup-wizard/steps/docker/install-server-bundle.ts`
- `src/components/setup-wizard/steps/wsl/write-profile.ts`
- `src/components/setup-wizard/wizard-runner.ts`（僅 `WizardContext.createdProfileIds` 型別）
- `src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`（新，32 案）
- `tests/wizard-rollback-cross.test.ts`、`tests/docker-wizard-e2e.test.ts`（僅斷言，見遭遇問題 2）
- `_ct-workorders/BUG-111-wizard-rollback-touches-user-owned-resources.md`（`FIXED`）

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`）。

### Commit

- 實作 commit `bb24f33`（`fix(wizard): T0444 BUG-111 rollback only undoes resources this run created or started`，10 files，含 BUG-111 → `FIXED`）；`git commit --only` 指定路徑，未含其他 Worker 的工作樹改動
- 結案 metadata 另一個 commit（只含本工單）
- 未 push

### 回報時間

`2026-10-05T06:34:56+08:00`（系統時間）
