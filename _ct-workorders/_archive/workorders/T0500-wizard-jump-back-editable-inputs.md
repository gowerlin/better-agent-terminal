---
schema_version: 1
schema_kind: workorder
id: T0500
title: "Setup wizard：跳回（edit-config）後目標步驟真的可編輯——editable 步驟被跳回時清掉自己的輸入（containerMode / dockerMounts 等），重跑時重新詢問"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:33:27+08:00"
started_at: "2026-10-13T23:34:49+08:00"
updated_at: "2026-10-13T23:41:32+08:00"
completed_at: "2026-10-13T23:41:32+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0489"
related:
  - "T0489 回報區「觀察」：跳回 `pick-container` 時 `ctx.state.containerMode` 已有值不再詢問；跳回 `configure-mounts` 時 `dockerMounts` 已有值不再開選擇器 ⇒ 使用者實際無法編輯（T0309 起既有行為）"
  - "T0489 跳回 rollback 鏈（`wizard-runner.ts` `rollbackForJump`、`forgetCompletedStep`）；T0444 擁有權規則"
affects_files:
  - "src/components/setup-wizard/wizard-runner.ts"
  - "src/components/setup-wizard/steps/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 清輸入不等於 rollback 資源：目標步驟的資源回收仍依 T0489 / T0444 規則（只回收本次擁有），本單只處理「讓使用者重新輸入」"
  - "🔴 不改 `integration.transitions.test.ts`；新測試放新檔"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0500 — 跳回後真的能編輯

## 實作

1. 盤點所有 `edit-config` 可跳回的目標步驟（registry 中哪些錯誤對應 `edit-config` 指向哪步）與各步驟「已有值就不再詢問」的輸入（`ctx.state` / `ctx` 欄位）
2. 設計：新增 step hook（例如 `resetForEdit(ctx)`），runner 在跳回目標步驟時（rollback 鏈完成後、重跑前）呼叫；或等效做法（擇一並說明）
3. 每個 editable 步驟實作清輸入；重跑時重新詢問 / 開選擇器，預設值帶入先前的選擇（若 UI 支援預設值）以免使用者重打
4. retry / skip / cancel 行為不變；非跳回情境不清輸入

## 驗收條件

- [ ] 單元測試：跳回 `pick-container` → 重新詢問模式；跳回 `configure-mounts` → 重新開選擇器；其他 editable 步驟同理；retry 不清輸入
- [ ] `npx vitest run src/components/setup-wizard`、`npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：editable 步驟清單與處置、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0489 回報區 + `wizard-runner.ts` + 相關 steps
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`WizardStep` 新增選用 hook `resetForEdit(ctx)`。`jumpToStep` 跳回時，runner 先走完 T0489 的 rollback 鏈，再對**目標步驟**呼叫 `resetForEdit`，最後把 snapshot 重設為 Pending 並重跑。`pick-container`、`configure-mounts`、`configure-ssh-host` 實作此 hook，跳回後會重新詢問模式、重新開資料夾選擇器、重新開 alias 選單。`pick-wsl-distro` 本來每次執行都會重新詢問，不需要 hook。retry、skip、cancel 不呼叫此 hook，行為不變。

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 3 筆皆存在（資訊性）；C-2 無 `branch` 欄位（HEAD `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- frontmatter 原 `status: TODO`（非 `PENDING`），視為未開工，直接改 `IN_PROGRESS`

### 盤點：可跳回的步驟與「已有值就不詢問」的輸入

跳回目標的來源：registry 的 `edit-config` 只有 SSH 兩筆，指向 `configure-ssh-host`（`verify-ssh-auth` 失敗、`configure-host-empty`）。另外，`SetupWizardShell` 會替 `editableFromFailure === false` 的失敗步驟補上 `edit-config`，指向最近的前一個 editable 步驟（`findEditableTarget`）。

| 流程 | editable 步驟 | 改動前跳回後的行為 | 處置 |
|---|---|---|---|
| Docker | `pick-container` | `ctx.state.containerMode` 不是 `'unknown'` 就不詢問 | `resetForEdit` 設旗標 `pickContainerEditRequested`；重跑時一律詢問 |
| Docker | `configure-mounts` | `ctx.state.dockerMounts` 非空就不開選擇器 | `resetForEdit` 設旗標 `dockerMountsEditRequested`；重跑時一律開選擇器 |
| SSH | `configure-ssh-host` | `state.sshHost` 有值就不詢問；`sshHostsAvailable` 沿用第一次讀到的 `~/.ssh/config` | `resetForEdit` 清掉 `sshHostsAvailable`（重讀 config），並設旗標 `sshHostEditRequested`；重跑時一律開 alias 選單 |
| WSL | `pick-wsl-distro` | 每次重跑都重新 `wsl.list()`，有多個 WSL2 distro 時一律詢問（原本就可編輯） | 不需要 hook（測試確認） |

### 設計：用旗標標記「要重新詢問」，不刪除舊值（等效做法）

工單第 2 點允許等效做法。各步驟的 `resetForEdit` **只設旗標，不刪除舊值**。重跑時看到旗標就重新詢問；步驟**成功後才清除旗標**。原因：

1. **rollback 擁有權（T0444 / T0489）**：跳回不會 rollback 目標步驟本身。若跳回後、目標重跑前發生 cancel，目標步驟會被 rollback。`pick-container` 的 rollback 需要 `containerMode === 'new'` 與 `dockerContainer`，才能找到本次精靈建立的容器。若 `resetForEdit` 直接清掉這些值，這張 rollback 的安全網就失效。工單 memory_overrides 規定「清輸入不等於 rollback 資源」，所以本單不改任何 rollback
2. **先前的選擇可作為預設值**：UI 不支援預設值。選項是按鈕，`dialog.selectFolder()` 也沒有 `defaultPath` 參數；要加的話得改 preload / main，超出 `affects_files`。保留舊值可以這樣補位：
   - `configure-mounts`：跳回後關閉資料夾對話框（未選）→ **沿用先前的 mounts**，不報錯（`logger.info`）。第一次執行時沒有舊值，仍照原本報錯
   - `configure-ssh-host`：重讀 config 後若沒有任何 alias 可選 → **沿用原 host**，不拋 `configure-host-empty`（`logger.info`）。因為舊 host 不一定是 alias，清掉後就無法重新輸入
   - `pick-container`：`ctx.requestChoice` 不存在時（無 UI），沿用先前的模式，不改用 `defaultMode`
3. **重跑失敗後 retry 仍會詢問**：旗標在成功時才清除。例如跳回後選「Use existing」但沒有任何容器 → 失敗 → retry 會再次詢問。改動前 retry 會沿用 `'existing'`，一直失敗

`pick-container` 換模式時不沿用另一個模式的容器名稱。`new → existing` 改用 `containers[0]`，不會把本次預定建立的名稱當成既有容器；`existing → new` 不沿用使用者的容器名稱，也就不會冒出「已存在、保持不動」的誤導 warning。模式不變時，沿用原本的容器，與改動前相同。

**runner**（`wizard-runner.ts`）：`rollbackForJump` 在 rollback 鏈之後、Pending 重設之前呼叫 `resetTargetForEdit(targetIndex)`。只呼叫跳回**目標**的 hook：目標之後的步驟已經由 T0489 rollback（例如 `configure-mounts` 的 rollback 會清掉 mounts），會照常重新詢問。跳回目標就是失敗步驟本身時（例如 `configure-host-empty`），一樣會呼叫。hook 丟錯時記 `logger.warn('resetForEdit failed for <id>: …')`，不阻擋跳回，步驟用舊值重跑（等同 T0500 前的行為）。retry / skip / cancel 的路徑完全沒動。

### 改動檔案（`git diff --stat`）

```
 .../setup-wizard/steps/docker/configure-mounts.ts  | 23 +++++++++++++--
 .../setup-wizard/steps/docker/pick-container.ts    | 29 ++++++++++++++++---
 .../setup-wizard/steps/ssh/configure-host.ts       | 18 +++++++++++-
 src/components/setup-wizard/wizard-runner.ts       | 33 ++++++++++++++++++++--
 4 files changed, 93 insertions(+), 10 deletions(-)
```

另新增 `src/components/setup-wizard/__tests__/wizard-jump-edit.test.ts`（18 tests）。未改 `integration.transitions.test.ts`、`SetupWizardShell.tsx`、任何 rollback、`CLAUDE.md`；換行維持 LF（index 與工作樹皆 LF）。

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| runner 只對目標呼叫、時機在 rollback 鏈之後 | PASS | 順序 `rollback:verify, rollback:mounts, reset:host, run:host…`；跳回失敗步驟本身也會 reset |
| retry / skip 不呼叫 `resetForEdit` | PASS | `retry and skip never call resetForEdit` |
| hook 丟錯不阻擋跳回 | PASS | warn + 全部步驟 succeeded |
| 跳回 `pick-container` → 重新詢問模式 | PASS | `requestChoice` 2 次；`new → existing` 用 `user-box`；`existing → new` 用 `bat-server-dev-box`，且無 warning |
| `pick-container` 重跑失敗後 retry 仍詢問 | PASS | 3 次詢問，最後成功，旗標已清除 |
| `pick-container` `resetForEdit` 不破壞 rollback 擁有權 | PASS | reset 後 rollback 仍 `removeContainer('bat-server-dev-box')` |
| 跳回 `configure-mounts` → 重新開選擇器 | PASS | `selectFolder` 2 次，mounts 與 `profileDraft.dockerMounts` 更新；關閉對話框則沿用舊 mounts |
| 跳回 `configure-ssh-host` → 重讀 config 並重新詢問 | PASS | `listHosts` 2 次，選單含新 alias，`sshHost` / `sshAlias` / `profileDraft.sshHost` 更新；沒有 alias 時沿用舊 host |
| `pick-wsl-distro` 跳回後重新詢問 | PASS | `requestChoice` 2 次，`wslDistro = 'Debian'` |
| retry 不清輸入（3 個 hook 步驟） | PASS | 後續步驟 retry：`requestChoice` / `selectFolder` / `listHosts` 各只 1 次 |
| editable 步驟清單守門 | PASS | 4 個 editable 步驟，皆有 `resetForEdit` 或列在 `ASKS_ON_EVERY_RUN` |
| `npx vitest run src/components/setup-wizard` | PASS | 28 files / 323 tests passed |
| `npm run test:unit` | PASS | exit 0；186 files，3171 passed、1 skipped |
| `npm run typecheck` | PASS | exit 0（維持 0） |
| `npx vite build` | PASS | exit 0（工作樹含其他 Worker 未提交的 WIP，一併建置成功） |
| runtime smoke（實機 Docker / SSH 跳回） | 未執行 | 本單未要求；依規定不以預設實例啟動 source build |

### 觀察（未處理，供塔台參考）

- **非跳回情境的既有問題**：第一次執行 `pick-container` 時選「Use existing」但沒有任何容器 → 失敗後 retry，因為 `containerMode` 已存成 `'existing'`，所以不會再詢問，會一直失敗，只能 cancel。本單依「非跳回情境不清輸入」不改。若要修，可讓 `containerMode` 在驗證通過後才寫入
- `configure-ssh-host` 的錯誤訊息寫「or type host」，但 UI 沒有手動輸入 host 的管道，`~/.ssh/config` 沒有 alias 時無法完成。這是既有問題，不在本單範圍

### CLAUDE.md 建議文字

無需更新。`CLAUDE.md` 未描述 setup wizard 的跳回語意，相關說明已寫在 `WizardStep.resetForEdit` 註解與本回報。

### Commit

- `git commit --only` 本單 6 檔（4 個產品檔 + 1 個新測試 + 本工單）；不 push。hash 見 `git log`（本回報寫於 commit 前）

### 互動紀錄

- 無（`CT_INTERACTIVE=0`，fire-and-forget）
