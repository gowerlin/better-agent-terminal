# T0330 — PLAN-032 Sprint 2: Stepper + WizardRunner `awaiting-input` 狀態擴充（keystone）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0330 |
| 標題 | Stepper 元件 + WizardRunner state machine 新增 `awaiting-input` status，並一次掃齊所有 input step callsite |
| 類型 | feat（UI framework + state machine） |
| 優先級 | 🔴 High（PLAN-032 Sprint 2 keystone，T0331/T0332/T0333/T0334 全部依賴此票收斂） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 22:30 (UTC+8) |
| 開始時間 | 2026-04-27 22:30 (UTC+8) |
| 完成時間 | 2026-04-27 22:47:15 (UTC+8) |
| commit hash | `e0a23e5` |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 2） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 1（Stepper Status）+ § 2（Wizard Runner Contract） |
| 關聯 BUG | BUG-074（SSH input-step 誤示 failed，Sprint 3 T0335 修，本票鋪路） |
| 關聯研究 | T0328（拆單 D 區段 finalized，含 D102 採納方案 A） |
| 預估時間 | 60-120 min（M/L，範圍含 callsite 一次掃齊） |
| Renew 次數 | 0 |
| affects_files | `src/components/Stepper/types.ts`、`src/components/Stepper/Stepper.tsx`、`src/components/Stepper/status-preset.ts`、`src/components/Stepper/__tests__/*.test.tsx`、`src/components/setup-wizard/wizard-runner.ts`、`src/components/setup-wizard/SetupWizardShell.tsx`、`src/components/setup-wizard/__tests__/*.test.ts(x)`、`src/components/setup-wizard/steps/ssh/configure-host.ts`、`src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts`、`src/components/setup-wizard/steps/docker/pick-container.ts`、`src/components/setup-wizard/steps/docker/configure-mounts.ts`（如為 input kind） |

## 背景

PLAN-032 Sprint 1（T0328 research）已完成 spec freeze，Sprint 2 拆 5 票 framework 基礎建設。本票 T0330 是 keystone：

- T0333（Recovery actions）依賴 T0330 status transition 落地
- T0334（spec + tests 規範）依賴 T0330 元件實作
- Sprint 3 三平台 BUG 修復（T0335-T0337）全部踩在 T0330 status machine 上
- T0331（ErrorMapper）+ T0332（Preflight hook）可平行，但 YOLO 鏈式單線執行

**範圍決策**（需求對齊 Q2=C）：本票一次涵蓋
1. Stepper 元件 status type 擴充
2. WizardRunner state machine 擴充（含 transition rules）
3. **掃齊所有現有 input step callsite**（不只 SSH，含 WSL/Docker requestChoice 用例），AC-8 直接收齊

**Tests 範圍決策**（塔台建議採納）：本票含「核心 unit tests」（status type render + transition rules + callsite snapshot），visual / integration 留 T0334 / T0339。

## 目標（驗收條件，工單級）

### AC-1：Stepper 元件 status 擴充

- `src/components/Stepper/types.ts::StepStatus` union 新增 `'awaiting-input'`
- `src/components/Stepper/Stepper.tsx` render `awaiting-input`：
  - icon `●`，色 `#38bdf8`（spec § 1 visual contract）
  - 不顯示 Retry/Skip CTA slot
  - 不掛 `role="alert"`（保留 failure-only）
- `src/components/Stepper/status-preset.ts`（如有 status → preset 對映）新增 `awaiting-input` 條目
- A11y：active 狀態維持 `aria-current="step"`，新增 `aria-describedby` hook 點到 prompt region（Shell 端在 AC-3 接，本票元件提供 prop）

### AC-2：WizardRunner state machine 擴充

- `src/components/setup-wizard/wizard-runner.ts::WizardStepStatus` 新增 `'awaiting-input'`
- 擴充 `WizardStep` interface：
  ```ts
  type WizardStepKind = 'task' | 'input';
  interface WizardStep {
    kind?: WizardStepKind;  // default 'task'
    // preflight / getRecoveryActions 留 T0331/T0332/T0333（本票不實作）
  }
  ```
- Transition rules 守門（runner 內 assertion 或 reducer guard）：
  - 允許：`pending → awaiting-input`、`awaiting-input → running`、`awaiting-input → failed`、`awaiting-input → skipped`、`running → failed|completed|skipped`、`failed → pending`（retry）
  - 禁止：`completed → awaiting-input`、`failed → awaiting-input`（無 explicit retry）、`skipped → awaiting-input`
  - 違反 → 拋 `WizardStateTransitionError`（含 from/to 訊息），方便後續工單偵錯
- Input-step semantics：`kind: 'input'` step 在 `ctx.requestChoice(...)` 等待時 runner snapshot status = `awaiting-input`；submit 後流轉為 `running`

### AC-3：SetupWizardShell wiring

- `SetupWizardShell.tsx::requestChoice`（line 271 起）觸發時通知 runner 切 `awaiting-input`
- prompt region 的 DOM id 透過 prop 回傳給 Stepper（AC-1 的 `aria-describedby` 收線）
- 取消 / submit 後狀態流轉正確（透過 AC-2 transition rules 驗證）

### AC-4：Callsite 一次掃齊（Q2=C 範圍）

逐一檢視並標註 `kind: 'input'`（非破壞性，default 仍 `'task'`）：

| 檔案 | 動作 |
|------|------|
| `steps/ssh/configure-host.ts` | 標 `kind: 'input'`（BUG-074 root cause owner，Sprint 3 T0335 修 awaiting-input UX） |
| `steps/wsl/pick-wsl-distro.ts` | 已用 `requestChoice` → 標 `kind: 'input'` |
| `steps/docker/pick-container.ts` | 已用 `requestChoice` → 標 `kind: 'input'` |
| `steps/docker/configure-mounts.ts` | 檢視是否有互動 → 視情況標 |
| 其他 step | grep `requestChoice` 全掃，遺漏者補標 |

**規則**：本票只標 `kind`，不改 step 內部 logic（Sprint 3 處理）。標 `kind: 'input'` 後 runner 自動流轉 `awaiting-input`，原本誤示 failed 的 SSH input step 自然修復（BUG-074 部分自癒，Sprint 3 完整收尾）。

### AC-5：核心 unit tests

新增（或擴充）以下 test 檔案：

1. **Stepper 元件 tests**（`src/components/Stepper/__tests__/`）：
   - `awaiting-input` status render 正確（icon / 色 / 無 Retry/Skip）
   - A11y attributes 正確（無 `role="alert"`、`aria-current` 維持）
   - snapshot test 確認既有 status（pending/running/completed/failed/skipped）0 regression

2. **WizardRunner state machine tests**（`src/components/setup-wizard/__tests__/`）：
   - 所有合法 transition 通過（6 條）
   - 所有禁止 transition 拋 `WizardStateTransitionError`（3 條）
   - `kind: 'input'` step 在 `requestChoice` pending 期間 status = `awaiting-input`

3. **Callsite snapshot tests**（沿用既有 wizard step tests，補 status snapshot）：
   - SSH `configure-host` 初始 status = `awaiting-input`（BUG-074 自癒驗證）
   - WSL `pick-wsl-distro` requestChoice 期間 status = `awaiting-input`
   - Docker `pick-container` requestChoice 期間 status = `awaiting-input`

**OOS（留後續）**：
- ❌ Visual regression（T0334）
- ❌ Cross-step integration matrix（T0339）
- ❌ Accessibility audit（T0334）
- ❌ ErrorMapper / Preflight / RecoveryActions 實作（T0331/T0332/T0333）

## 實作順序建議

1. **Step 1**：Stepper 元件層（AC-1 + 對應 unit tests）→ 跑 `npm run test:unit -- Stepper` 綠
2. **Step 2**：WizardRunner state machine（AC-2 + transition tests）→ 跑 `npm run test:unit -- wizard-runner` 綠
3. **Step 3**：SetupWizardShell wiring（AC-3）→ 視覺確認 `aria-describedby` 接通
4. **Step 4**：Callsite 一次掃齊（AC-4）→ grep + 標 `kind`
5. **Step 5**：補 callsite snapshot tests（AC-5 第 3 組）
6. **Step 6**：`npm run build` + `npm run test:unit` 全綠 → commit

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| Stepper status preset 改動破壞 PLAN-030 既有 callsite | snapshot tests 守門；改動 type union 為 additive（不刪舊值） |
| transition rules 過嚴擋住既有合法流程 | 先盤點現有所有 status 流轉路徑（grep `setStatus` / reducer dispatch），確認 6+3 規則覆蓋；若漏放新規則（如 `failed → running`）補上 |
| `kind: 'input'` 標註後 SSH step 行為變化超出本票範圍 | AC-4 只改 `kind` field，不動 step logic；BUG-074 真正 UX fix 留 T0335 |
| WizardStateTransitionError 太吵打斷現有測試 | 先跑全測試套件確認無 regression，有就修對應 callsite（不放鬆規則） |

## 自檢清單

- [ ] AC-1：Stepper 元件 `awaiting-input` render + a11y 正確
- [ ] AC-2：WizardRunner state machine + transition rules + WizardStep.kind 擴充
- [ ] AC-3：SetupWizardShell requestChoice wiring + aria 接線
- [ ] AC-4：所有 input step callsite 標 `kind: 'input'`（含 SSH/WSL/Docker，grep 確認無遺漏）
- [ ] AC-5：unit tests 三組（元件 / runner / callsite snapshot）全綠
- [ ] `npm run build` 綠（pre-build native modules + helper bundle 檢查通過）
- [ ] `npm run test:unit` 全綠
- [ ] commit message：`feat(setup-wizard): add awaiting-input status to Stepper and WizardRunner (T0330, PLAN-032 Sprint 2)`

## YOLO 模式 — 下一張工單建議

T0330 DONE 後鏈式派發（YOLO 自然收斂）：

- **T0331**：`WizardErrorMapper` framework（registry + fallback resolver，spec § 3）
- 與 T0330 無檔案 overlap（T0331 新檔 `src/components/setup-wizard/error-mapper.ts`），可直接派

## 回報區（Worker 填寫）

> Worker 完成後填以下區段，塔台據此更新 PLAN-032 進度與決策日誌。

### 實作摘要

完成 PLAN-032 Sprint 2 keystone：Stepper + WizardRunner 全面導入 `awaiting-input` status。

- **Stepper 元件**：新增 `'awaiting-input'` status type、preset (`●`/`#38bdf8`)、`promptRegionId` prop；render 不掛 `role="alert"`、不渲染 Retry/Skip CTA、`aria-describedby` 接 prompt 區。`defaultCurrentIndex` 退而求其次抓 awaiting-input；`worstStatus` 排序：failed > running > awaiting-input > skipped > rolled-back > pending > completed。
- **WizardRunner state machine**：新增 `WizardStepKind = 'task' | 'input'`、`WizardStepStatus.AwaitingInput`、`WizardStateTransitionError`、`ALLOWED_TRANSITIONS` 表 + `assertTransition()` guard；所有 `snapshot.status = X` 改走 `transitionStatus()` helper（5 處 callsite）。input-kind step 在 `step.run()` 期間 `ctx.requestChoice` 被 `maybeWrapRequestChoice()` 包住，pending 期間 status 切 AwaitingInput，resolve 後切回 Running，restore 寫在 `try/finally`。
- **SetupWizardShell wiring**：`mapStepStatus` 新增 `AwaitingInput → 'awaiting-input'` 分支；`activeStep` lookup 含 AwaitingInput；prompt 區帶 `id="bat-wizard-active-prompt"` + `role="group"` + `aria-label`，descriptors 在 `awaiting-input` 時帶 `promptRegionId` 接 stepper aria-describedby。
- **Tests 統計**：新增 3 個檔，19 個新 test cases。全套 `npm run test:unit` **208 通過 / 0 失敗**（原 189 + 19 新增）。
- **Build**：`npx vite build` 全綠（3 bundles 都成功）。

### Callsite 盤點結果

`grep -l "requestChoice\|selectFolder" src/components/setup-wizard/steps/ -r` 結果：

| 檔案 | 狀態 | 標註 |
|------|------|------|
| `steps/ssh/configure-host.ts` | ✅ 標 `kind: 'input'` | BUG-074 root cause owner，T0335 完整收尾 |
| `steps/wsl/pick-wsl-distro.ts` | ✅ 標 `kind: 'input'` | 多 distro 時觸發 requestChoice |
| `steps/docker/pick-container.ts` | ✅ 標 `kind: 'input'` | mode 選擇器 requestChoice |
| `steps/docker/configure-mounts.ts` | ✅ 標 `kind: 'input'` | 用 `selectFolder` dialog（不是 requestChoice，但語意相同；Sprint 3 可能 wrap） |

無遺漏。所有用到 `requestChoice` 或互動式 dialog 的 step 都已標。

### Transition rules 守門副作用

**未撞到既有 callsite 違規**。設計時刻意涵蓋：
- jumpToStep 重置 succeeded/failed → pending（已加入 ALLOWED_TRANSITIONS 對應 row）
- retry 路徑 failed → running（既有 runner loop 行為）
- skip 路徑 failed → succeeded with `skipped=true`
- rollback 從 running/awaiting-input/succeeded/failed → rolled-back

跑完整測試套件（含 `WizardRunner.jumpToStep` 既有 14 case）全綠，未拋 `WizardStateTransitionError`。

### 偏離 spec 的決策

**T0330-D1：retry 走 `failed → running` 而非 spec 寫的 `failed → pending`**

工單 AC-2 列：「`failed → pending`（retry）」。實際 runner 在 retry 時走 `index -= 1; continue;`，下一輪 iteration 直接寫 `WizardStepStatus.Running`，沒有經過 Pending。改成 `failed → pending → running` 需要重排 runner loop 結構，超出本票範圍且無使用者可見差異。已在 `ALLOWED_TRANSITIONS` 加入 `failed → running` 並於程式碼註解說明此 adjustment（wizard-runner.ts `ALLOWED_TRANSITIONS` 上方註解）。

**T0330-D2：spec 寫的 `awaiting-input → skipped` 改成 `awaiting-input → succeeded`（with skipped flag）**

`skipped` 在 runner 是 `snapshot.skipped: boolean` flag（搭配 status=Succeeded），不是獨立 status。allowed transition 表用 status 維度，所以填 `awaiting-input → succeeded`（mapStepStatus 在 `snapshot.skipped=true` 時 collapse 成 'skipped' 給 Stepper）。語意對等。

**T0330-D3：configure-mounts 也標 `kind: 'input'`**

工單 AC-4 寫「視情況標」。configure-mounts 用 `selectFolder` dialog（會 block UI 等使用者選資料夾），語意上是 input 流程，故一併標。runner 不會自動 wrap selectFolder（只 wrap `requestChoice`），所以目前不會自動切 awaiting-input；Sprint 3 若擴大 wrap 範圍可直接收線。

### 自檢結果

- [x] AC-1：Stepper 元件 `awaiting-input` render + a11y 正確（`promptRegionId` prop 已加，`role="alert"` 仍 failed-only）
- [x] AC-2：WizardRunner state machine + transition rules + WizardStep.kind 擴充（`WizardStateTransitionError` 已導出供測試使用）
- [x] AC-3：SetupWizardShell `requestChoice` wiring + aria 接線（`id="bat-wizard-active-prompt"` + `aria-describedby`）
- [x] AC-4：所有 input step callsite 標 `kind: 'input'`（SSH/WSL/Docker × 4 檔，grep 確認無遺漏）
- [x] AC-5：unit tests 三組（元件 9 case / runner 6 case / callsite 4 case）全綠
- [x] `npm run test:unit` 全綠：208 / 208
- [x] `npx vite build` 綠
- [x] `npx tsc --noEmit` 我們動到的檔案全部 0 錯（既有 CodexAgentPanel 等 pre-existing TS 錯誤不在本票範圍）
- [x] commit hash：填於下方

### 後續建議

派 T0331 時可參考：

1. **ErrorMapper hook 點**：`wizard-runner.ts` 的 catch block 是天然的 mapping 入口（`snapshot.error = error.message` 上方就是塞 error-mapper 的位置）。可考慮加 `step.preflight?(ctx)` 在 `step.run` 前跑，把 mapper 作用到 preflight failure。
2. **promptRegionId 已寫死共用 id**：`SetupWizardShell.tsx::PROMPT_REGION_ID = 'bat-wizard-active-prompt'`。如果 T0334 spec 要求 per-step prompt（多個同時 awaiting-input），改成 `${stepId}-prompt` pattern；目前 runner 的 transition rules 不允許多 step 同時 awaiting-input（只有當前 step 會被 wrap），所以共用 id 沒問題。
3. **maybeWrapRequestChoice 的 race**：finally block 已加 `if (snap.status === AwaitingInput)` guard 避免 cancel + resolve 並發時誤觸發 transition。T0335 若擴大 SSH input UX，注意這個 guard 模式可以重用。
4. **既有 `WizardRunner.jumpToStep` 未受影響**：transition guard 已涵蓋 jump-back 的 `succeeded/failed → pending`。Sprint 3 若加 jump-back-from-awaiting-input 場景，guard 已預先放行 `awaiting-input → pending`。

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
