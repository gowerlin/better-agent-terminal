---
schema_version: 1
schema_kind: workorder
id: T0448
title: "T0445 #4：pty:restart 保留原 PTY 的 customEnv（BAT_TOWER_TERMINAL_ID）/ capability 角色，worker 重啟後不升為 tower"
type: fix
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: XS
created_at: "2026-10-05T06:32:48+08:00"
started_at: "2026-10-05T06:38:19+08:00"
updated_at: "2026-10-05T06:40:59+08:00"
completed_at: "2026-10-05T06:40:59+08:00"
target_version: next
depends_on:
  - T0433
related:
  - "T0445 finding #4 / 拆單 2（審查時為 T0433 工作樹版本）"
  - "D134 追加（塔台 06:32 依授權直接決定）"
affects_files:
  - electron/pty-manager.ts
  - electron/remote/headless-entry.ts
  - electron/__tests__/
  - electron/remote/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 先確認 T0433 commit 後的實際程式（`PtyManager.restart` 是否仍丟 `customEnv`、`buildHeadlessHelperEnv` 依什麼決定角色）。若 T0433 已自行修正，回報區附證據、只補「restart 後角色 / towerId 不變」測試即可 DONE。"
  - "🔴 修法偏好：restart 沿用原 PTY 的 `customEnv`（至少 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`）；並確認舊權杖撤銷、新權杖角色與 towerId 與舊者一致。本機 Electron restart 行為不得改變（測試鎖住）。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；共用檔精準 stage；不 push。"
---

# T0448 — restart 保留權杖角色（T0445 #4）

## 驗收條件

- [x] 測試：worker PTY restart 後仍為 worker、towerId 相同、不可 `create-agent-command`；tower PTY restart 後仍為 tower；舊權杖失效
- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #4 + T0433 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE

### 產出摘要

**Landing Zone**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 repo 內；C-3 `electron/pty-manager.ts` / `electron/remote/headless-entry.ts` 皆存在；C-2 無 `branch` 欄（當前 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。派發 `CT_MODE=yolo` / `CT_INTERACTIVE=0`。

**T0433 commit 後現況確認**（`ec4ca56`）：finding #4 仍成立 —— `PtyManager.restart` 為 `kill(id)` + `create({ id, cwd, type, shell })`，未帶 `customEnv`；`buildHeadlessHelperEnv`（`headless-entry.ts:239-242`）以 `customEnv.BAT_TOWER_TERMINAL_ID` 有無決定 worker / tower ⇒ 重啟後的 worker 會拿 tower 權杖。T0433 未自行修正，故實作修正。

**修法**（`electron/pty-manager.ts`）
- `PtyInstance` 新增 `customEnv?`；直接 spawn 的兩個分支（node-pty / child_process fallback）記錄 spawn 時的 `customEnv`
- `restart()`：**僅當 `deps.helperEnv` 存在（headless）** 才把舊 instance 的 `customEnv`（整份複本，含 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`）傳給 `create`；Electron（無 `helperEnv`）維持原本「不帶 customEnv 重建」行為
- 權杖流程不另改：restart 內的 `kill` → `onPtyExit` → `revokeTerminal` 撤銷舊權杖；`create` → `helperEnv` → `buildHeadlessHelperEnv` 依保留的 `BAT_TOWER_TERMINAL_ID` 簽發同 role / 同 towerId 的新權杖（`issue` 本身亦先 revoke 同 terminal 舊權杖）
- client 的 `pty:restart` 參數只有 `(id, cwd, shell)`，無法藉 restart 改寫 `customEnv` / 角色
- `headless-entry.ts` 未改（角色判定邏輯正確，問題只在 restart 輸入）

**測試**（`electron/__tests__/pty-manager-helper-env.test.ts`，新增 describe「restart keeps the helper capability role (T0448 / T0445 #4)」3 案，真 `HelperCapabilityRegistry` + 真 `buildHeadlessHelperEnv` + `authorizeHelperInvoke`）
- worker restart：新 env 仍有 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`；新權杖 ≠ 舊權杖、capability = `{ terminalId, towerId: 'tower-1', role: 'worker' }`；`terminal:create-agent-command` → `role-not-allowed`；舊權杖 `verify` = null；registry 只剩 1 個
- tower restart：仍為 `role: 'tower'`、可 `create-agent-command`；舊權杖失效
- Electron 鎖定：無 `helperEnv` 時 restart 後 env 不含原 `customEnv`（`FOO` undefined、`BAT_TOWER_TERMINAL_ID` = 繼承值）
- 反向驗證：暫時移除 restart 的 `customEnv` 傳遞 → worker 案例 FAIL（1 failed / 7 passed）；已還原（以 python 字串替換，未用 git stash / checkout / restore）

**驗收**
| 閘門 | 結果 | 證據 |
|---|---|---|
| `npx vitest run electron/__tests__/pty-manager-helper-env.test.ts` | PASS | 8/8 |
| `npm run test:unit` | PASS | Test Files 147 passed；Tests 2371 passed / 1 skipped |
| `npx tsc --noEmit` | PASS | 39 errors（= 上限 39）；`pty-manager.ts` / `headless-entry.ts` / 新測試無錯誤 |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁跑 |

**改動檔**：`electron/pty-manager.ts`、`electron/__tests__/pty-manager-helper-env.test.ts`、本工單

### 遭遇問題

- 無阻擋。Phase 1 的 `IN_PROGRESS` 狀態未在產品改動前寫回工單（`started_at` 取自開工時系統時間 06:38:19），與 closeout 一併寫入 —— 流程偏差，已記錄。
- 已知範圍外：Terminal Server（`useServer`）分支未記錄 `customEnv`（Electron 專用、無 `helperEnv`，restart 本就不帶 customEnv，行為不變）；`workspaceId` / `agentPreset` restart 時仍不保留（既有行為，非本單範圍）。
- 工作樹其他未提交改動（T0436 / T0447 等）未觸碰，精準 stage。

### 回報時間

2026-10-05T06:40:28+08:00
