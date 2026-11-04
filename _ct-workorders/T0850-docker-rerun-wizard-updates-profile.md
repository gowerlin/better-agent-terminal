---
schema_version: 1
schema_kind: workorder
id: T0850
title: "Docker 精靈 W3：重跑精靈時以容器名稱辨識既有設定並更新，不再新增一筆"
type: implementation
status: DONE
started_at: "2026-11-04T15:21:36+0800"
updated_at: "2026-11-04T15:25:00+0800"
completed_at: "2026-11-04T15:25:00+0800"
session_ids:
  - "666b137f-9118-414a-ad95-5fbe7e32b274"
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
- **工單編號**：T0850｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:18 (UTC+8)
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

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-04 15:24 (UTC+8)
- **session_id**：666b137f-9118-414a-ad95-5fbe7e32b274

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：3 個可測項目都存在 → PASS；C-2：工單沒有 `branch` 欄位（目前 `main`）
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要
- Docker 分支（`write-profile.ts`）先以 `findExistingProfiles` 找 `targetOS === 'docker-linux'` && `dockerContainer === <容器名稱>` && `isLoopbackHost(remoteHost)` 的既有設定（不含埠）。
  - 找到 → `updateExistingProfiles` 寫入 `targetOS` / `dockerContainer` / `dockerMounts` / `remoteHost` / `remotePort` / `remoteToken` / `remoteFingerprint`，名稱不動（T0552 慣例）；更新前的值記在 `ctx.updatedProfiles` 供 rollback 還原；本次執行先前嘗試留下的 profile 一併刪除。
  - 多筆符合 → 沿用 WSL / SSH：全部更新，第一筆是完成後開啟的那筆（`updatedProfileId`）。
  - 找不到（含 `listLocal` 失敗）→ 照舊 `create` + `update`，`ctx.updatedProfileId = undefined`（與 WSL / SSH 相同）。
- WSL / SSH 的比對條件與 `findExistingProfiles` / `updateExistingProfiles` 本體都沒改（只在函式註解補一句 Docker）；兩者既有測試全過。
- rollback 沿用既有機制（`ctx.updatedProfiles` 還原 → 刪除本次建立的 profile），未改程式碼。

### 修改檔案
- `src/components/setup-wizard/steps/wsl/write-profile.ts`：Docker 分支改為「先找既有、找到就更新」，更新內容抽成 `dockerUpdates`（新增路徑的 `update` 也用它，內容與原本相同）。
- `src/components/setup-wizard/__tests__/write-profile-existing.test.ts`：新增 Docker 5 案例（同名容器更新且數量不變、名稱保留；rollback 還原埠 / token / 指紋 / 掛載；`-2` 容器新增；非 loopback 與 WSL / SSH profile 不比對；多筆全部更新）；測試用 `Profile` 型別補 `dockerContainer` / `dockerMounts`。
- `src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`：write-profile 區塊的 mock 補 `listLocal`（回空清單；否則 Docker 分支走 `listLocal` 失敗 fallback，測試仍會過但多一條 warn），新增 1 案例：更新既有 profile 後 rollback 還原舊值、不刪除。

### 驗證
| 項目 | 結果 |
|---|---|
| `npx vitest run src/components/setup-wizard` | PASS：46 檔 / 789 測試（加型別欄位前）；commit 前兩個改動的測試檔再跑：2 檔 / 55 測試 PASS |
| `npm run typecheck` | 0（第一次 3 個 TS2353：測試 `Profile` 型別缺 Docker 欄位，補上後 0） |
| `npm run test:unit` | PASS：435 檔通過 / 3 skipped；7749 測試通過 / 40 skipped（exit 0） |
| `npx vite build` | 成功（exit 0） |

- 證據分道：只有原始碼與單元測試 / 建置；沒有實機重跑精靈（Docker runtime smoke 未做）。
- 注意：本機工作樹同時有 T0849 未提交的變更（`src/locales/*.json`、T0849 工單），上述 `test:unit` / build 是在含那些變更的工作樹上跑的；本單 commit 不含它們。

### Commit
- 產品：`c0ace27e1b3e439cc38b493be741e0ee9208d827`（`git add` 三個明確路徑；未 push）
- 工單：本檔另一個 commit（`git commit --only`）

### 偏離與已知限制
- 沒有偏離工單範圍；沒動 T0849 範圍內的任何檔案。
- 已知限制（沿用 T0552 的既有行為，未改）：rollback 只還原更新前「有值」的欄位；例如舊 profile 沒有 `remoteFingerprint` / `dockerMounts`，rollback 不會把新寫入的值清掉（`profile.update` 對 `undefined` 不動作）。精靈建立的 Docker profile 一律有 `dockerMounts`，影響有限。
- 重跑時若使用者把容器改名（例如選了 `-2` 的新容器），舊容器的設定不會被更新或刪除，這是預期行為（不同容器 = 不同 server）。

### 遭遇問題
- 無（typecheck 的 3 個錯誤是自己新增測試資料的型別，當場修正）。

### 互動紀錄
- [15:21] 開工；yolo，無提問。

### 後續建議
- 實機驗收時可順手跑：同一容器重跑 Docker 精靈兩次 → Profiles 清單只有一筆、名稱保留、可連線。
