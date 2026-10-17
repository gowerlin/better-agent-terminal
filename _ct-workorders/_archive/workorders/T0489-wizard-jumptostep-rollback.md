---
schema_version: 1
schema_kind: workorder
id: T0489
title: "Setup wizard：jumpToStep 跳回前面步驟時走 rollback 鏈（只回收本次精靈擁有的資源），補 T0309 既有 TODO"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P3
sizing: M
created_at: "2026-10-13T23:13:05+08:00"
started_at: "2026-10-13T23:26:12+08:00"
updated_at: "2026-10-13T23:33:20+08:00"
completed_at: "2026-10-13T23:33:20+08:00"
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "T0309 既有 TODO；T0426（取消時 rollback 鏈）、T0444（rollback 只回收本次擁有的資源，旗標以容器名稱為鍵）回報區"
  - "T0426 回報區：skip / jumpToStep 時失敗步驟不走 rollback（SSH fetch-fingerprint tunnel 繞道仍保留）"
affects_files:
  - "src/components/setup-wizard/wizard-runner.ts"
  - "src/components/setup-wizard/SetupWizardShell.tsx"
  - "src/components/setup-wizard/steps/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改 `src/components/setup-wizard/__tests__/integration.transitions.test.ts`（T0486 修其型別錯誤）；新測試放新檔"
  - "🔴 rollback 只回收本次精靈擁有的資源（T0444 規則）；使用者既有資源（容器 / distro / tunnel / 設定）不得被刪"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0489 — Setup wizard：jumpToStep 跳回前面步驟時走 rollback 鏈（只回收本次精靈擁有的資源），補 T0309 既有 TODO

## 實作

- 盤點 jumpToStep 現行路徑（`wizard-runner.ts`）與 retry / skip / cancel 的 rollback 差異
- 跳回第 k 步：對 k 之後「已完成且有 rollback」的步驟（含目前失敗步驟）依反序 rollback，沿用 cancel 的 rollback 鏈與錯誤處理（rollback 失敗時阻擋或提示——依既有 cancel 語意決定並說明）
- 評估 T0387 的 SSH fetch-fingerprint tunnel 繞道在新行為下可否移除（只建議，除非測試完整證明）
- UI：跳回是否需要確認提示（會回收資源）——依既有 i18n / 對話框慣例決定並說明

## 驗收條件

- [ ] 單元 / 整合測試：跳回觸發反序 rollback、只回收擁有資源、rollback 失敗路徑、skip 與 retry 行為不變
- [ ] `npm run test:unit`、`npx vite build`；CLAUDE.md 建議文字（如需）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。`jumpToStep` 跳回第 k 步時改由 runner 主迴圈走 rollback 鏈：先 rollback 目前失敗步驟（k < 失敗步驟時），再依完成順序反序 rollback k 之後已完成（含 skip 過）的步驟，最後把 [k .. 失敗步驟] 重設為 Pending 並從 k 重跑。T0309 的 TODO（「does NOT walk rollback()」）已移除。另補一個 rollback 擁有權缺口：WSL `install-server-bundle` 在安裝前就失敗時，rollback 會 `rm -rf` 預設路徑 `~/.local/bat-server`，刪到先前設定留下的 bundle。新增跳回觸發點後這個缺口更容易踩到，所以一併修。

### Landing zone

- **PASS**。C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 4 筆皆存在（資訊性）；C-2 無 `branch` 欄位（HEAD `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- frontmatter 原 `status: TODO`（非 `PENDING`），視為未開工，直接改 `IN_PROGRESS`

### 盤點：改動前各路徑的 rollback 行為

| 動作 | 失敗步驟 | 已完成步驟 | 備註 |
|---|---|---|---|
| retry | 不 rollback | 不動 | 重跑同一步 |
| skip | 不 rollback | 不動 | 標 `succeeded + skipped`，記入 completed |
| cancel（T0426） | rollback（成功標 `rolled-back`） | 反序 rollback | rollback 丟錯只 `logger.warn`，不阻擋 |
| 非 retryable 失敗 | rollback（snapshot 維持 failed） | 反序 rollback | 拋原錯誤 |
| **jumpToStep（改前）** | **不 rollback** | **不 rollback**，只重設 snapshot、從 completed 移除 ≥ k | 也不檢查目前步驟是否在等待失敗決策：步驟非 failed 時呼叫會留下 `pendingJumpTarget`，劫持下一次 retry |

### 實作（`wizard-runner.ts`）

- `waitForRetryOrSkip` 新增 `'jump'` 決策（`waitForJump`）；`jumpToStep` 驗證範圍後，**只在目前步驟為 failed 且正在等待失敗決策時**才觸發，否則 `logger.warn('jumpToStep: step <id> is not waiting on a failure decision')` 並 no-op（涵蓋執行中、非 retryable 已 rollback 結束、cancel 後、重複點擊）
- `rollbackForJump(failedIndex, targetIndex)`：rollback 失敗步驟（`failedIndex > targetIndex` 時）→ 反序 rollback completed 中 `> targetIndex` 的步驟 → 從 completed 移除這些步驟 → [target .. failed] 轉 Pending，清掉 `error` / `mappedError` / `skipped`。狀態直接轉 Pending、不經 `rolled-back`：`rolled-back` 是終態（`ALLOWED_TRANSITIONS` 不許離開），而這些步驟馬上要重跑，所以不改轉移表
- **目標步驟 k 本身不 rollback**（依工單「k 之後」）：k 會重跑並覆寫自己的輸出。k 留在 completed 清單直到重跑那一刻（迴圈開頭 `forgetCompletedStep(index)`），所以跳回 rollback 進行中若遇 cancel，k 仍會被 rollback，且每步只 rollback 一次（測試涵蓋）
- `jumpToStep` 的 promise 在 rollback 鏈跑完、snapshot 重設後才 resolve；期間 `jumpInProgress` 使 `skipCurrentStep` no-op（`retryCurrentStep` 因 waiter 已清空本就 no-op），避免 rollback 途中把失敗步驟改成 skipped
- `k == 失敗步驟`（registry 的 `edit-config` 指向自己）時不 rollback，等同 retry
- 順帶把 `cancel()` 改成共用 `clearFailureWaiters()`（行為不變）

**rollback 失敗語意**：沿用 cancel 的 best-effort，不阻擋跳回。每一步的 rollback 各自 try/catch，失敗只記 `logger.warn('Rollback failed for <id> while jumping back: …')`，其餘步驟照常 rollback，跳回照常進行。cancel 之後精靈就結束了，跳回則會繼續往下跑，使用者需要知道可能有殘留，所以另外推入 `ctx.warnings`：`Could not undo "<title>" before going back: <message>`（去重）。這段文字顯示在既有的 warnings 面板。runner 本身不接 i18n，與各步驟現有的英文 warning 一致。

### 擁有權（T0444 規則）

逐一檢查跳回會觸發的 rollback，確認都只回收本次精靈擁有的資源：

- Docker `start-server` / `pick-container` / `install-server-bundle`：以容器名稱為鍵的旗標（T0444），既有容器只在本次啟動時才 stop，從不 remove → 符合
- SSH `install-server-bundle`（`sshBundleUploadStarted`）、`start-server`（`sshStartServerTouchedRemote`）：失敗發生在接觸遠端之前時 rollback 跳過 → 符合
- WSL `write-systemd-unit`（`wslUnitWriteStarted`）→ 符合；`write-profile`（`createdProfileIds`）→ 符合
- 🔴 **WSL `install-server-bundle` 不符合**：rollback 只用 `ctx.serverInstallPath` 判斷，但 `createWslWizardContext` 預設就是 `~/.local/bat-server`，而 `uninstallBundle` 會執行 `wsl -d <distro> -- rm -rf <path>`，路徑中的 `~` 會被 shell 展開。因此 download 或 resolve-home 在安裝前就失敗時，cancel（T0426 起）與跳回都會刪掉先前設定留下、可能正被其他 profile 使用的 bundle。**修正**：比照 SSH 的做法，在 run 開頭設 `ctx.state.wslBundleInstallStarted = false`，呼叫 `wsl.installBundle` 前改成 `true`，rollback 在 `=== false` 時跳過。旗標為 `undefined`（舊 state）時維持原行為；安裝途中失敗仍會清掉部分寫入的 bundle

### T0387 SSH fetch-fingerprint tunnel 繞道：建議保留，不移除

新行為下，失敗後的 cancel / jump / 非 retryable 都會 rollback 失敗步驟，跳回後 tunnel 一定會關。但仍有三個理由保留：

1. **skip** 仍不 rollback 失敗步驟。雖然下一步 `sshConnectTestStep` 的 `finally` 會關 tunnel，但那依賴 connect-test 一定會跑到
2. 停在失敗畫面等待使用者決定的期間，若不在失敗當下關掉，`ssh -L` 轉發會一直開著
3. 若移除，「哪條路徑會關 tunnel」就得靠 runner 的語意保證，而目前沒有測試完整證明這一點

只更新了 `verify-remote.ts` 的兩段註解，反映 jump-back 也會 rollback。

### UI：跳回不加確認對話框

- 決定**不加**。retry、skip、cancel 都沒有確認，其中 cancel 會 rollback 全部已完成步驟，回收範圍比跳回更大
- 跳回只回收本次精靈擁有的資源（見上節），不會碰使用者既有的容器 / distro / tunnel / 設定
- setup-wizard 目前沒有任何確認對話框慣例；若要加，需三語 i18n key 與新元件，超出本單 P3 範圍
- `SetupWizardShell.tsx` 未改：`dispatchAction('edit-config')` 原本就 `await runner.jumpToStep(...)`，現在會等 rollback 鏈結束；重複點擊會被 runner 擋下

### 觀察（未處理，供塔台參考）

- 跳回 `pick-container` 時，因 `ctx.state.containerMode` 已有值，重跑不會再詢問模式；跳回 `configure-mounts` 時，因 `dockerMounts` 已有值，也不會再開資料夾選擇器。也就是說，跳回後使用者實際上無法「編輯」該步驟的設定。這是 T0309 起就存在的行為，本單依「k 之後」不 rollback 目標步驟，所以沒有改變它。若要讓跳回真的能編輯，可另開單：讓 editable 步驟在被跳回時清掉自己的輸入（例如由 runner 對目標步驟額外呼叫 rollback，或新增 `resetForEdit` hook）

### 改動檔案

- `src/components/setup-wizard/wizard-runner.ts`：跳回 rollback 鏈、failure-wait 守門、`jumpInProgress`、`forgetCompletedStep`
- `src/components/setup-wizard/steps/wsl/install-server-bundle.ts`：`wslBundleInstallStarted` 擁有權旗標
- `src/components/setup-wizard/steps/ssh/verify-remote.ts`：只改註解
- `src/components/setup-wizard/__tests__/wizard-jump-rollback.test.ts`（新）：17 tests
- 未改 `integration.transitions.test.ts`、`SetupWizardShell.tsx`、`CLAUDE.md`；換行維持 LF

### 驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| 跳回觸發反序 rollback | PASS | `rolls back the failed step, then completed steps after the target in reverse…`：rollback 順序 `['verify','start','install']`，目標 `pick` 與之前的 `detect` 不 rollback |
| 跳回 resolve 時 snapshot 已重設、error / mappedError 清空 | PASS | `resolves after the rollback chain…` |
| skip 過的步驟一併 rollback | PASS | `a step skipped after the target is rolled back too` |
| 只回收擁有的資源 | PASS | Docker「Create new」只移除 `bat-server-dev-box-2`，使用者的 `bat-server-dev-box` 保留；「Use existing」執行中容器不 stop、不 remove、不 rm -rf；本次啟動的停止容器會先 stop 再重跑；WSL 安裝前失敗跳回不呼叫 `uninstallBundle`、本次安裝的 bundle 會移除、安裝途中失敗仍清掉部分 bundle |
| rollback 失敗路徑 | PASS | 丟錯的 rollback → `logger.warn` + `ctx.warnings`，其餘照常 rollback、跳回照常重跑 |
| cancel 於跳回 rollback 進行中 | PASS | 目標步驟也被 rollback，每步只一次，最後拋 `Wizard cancelled` |
| 跳回 rollback 中 retry / skip 無效 | PASS | 失敗步驟維持 failed、未被標 skipped |
| 非等待失敗決策時跳回 no-op | PASS | 執行中、非 retryable 失敗後皆只 warn |
| skip 與 retry 行為不變 | PASS | 新測試 + 既有 `wizard-cancel-rollback.test.ts`「retry and skip still do not roll the failed step back」 |
| 既有 T0309 jumpToStep 測試 | PASS | `SetupWizardShell.test.tsx` `WizardRunner.jumpToStep (T0309)` 2 tests 未改仍過 |
| `npx vitest run src/components/setup-wizard` | PASS | 27 files / 305 tests passed |
| `npm run test:unit` | PASS | 184 files，3147 passed、1 skipped。stderr 有 node-pty `AttachConsole failed` 雜訊，屬既有現象，不影響結果 |
| `npx tsc --noEmit -p .` | PASS | exit 0，0 errors（本單檔案未新增錯誤） |
| `npx vite build` | PASS | exit 0（工作樹含其他 Worker 未提交的 WIP，一併建置成功） |
| runtime smoke（實機 WSL / SSH / Docker 跳回） | 未執行 | 本單未要求；依規定不以預設實例啟動 source build |

### CLAUDE.md 建議文字

無需更新。`CLAUDE.md` 未描述 setup wizard 的 rollback 語意，相關說明已寫在程式註解與本回報。

### Commit

- `git commit --only` 本單 5 檔（3 個產品檔 + 1 個新測試 + 本工單）；不 push。hash 見 `git log`（本回報寫於 commit 前）

### 互動紀錄

- 無（`CT_INTERACTIVE=0`，fire-and-forget）
