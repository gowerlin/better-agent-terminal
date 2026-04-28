---
schema_version: 1
schema_kind: workorder
id: T0339
title: "Fix BUG-076: SetupWizardShell 改用 `snapshot.mappedError`，移除 redundant resolver"
type: fix
status: FIXED
created_at: "2026-04-28T06:10:00+08:00"
started_at: "2026-04-28T06:13:00+08:00"
completed_at: "2026-04-28T06:16:00+08:00"
renew_count: 0
---
# T0339 — Fix BUG-076: SetupWizardShell 改用 `snapshot.mappedError`，移除 redundant resolver

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0339 |
| 標題 | 修復 BUG-076：`SetupWizardShell::resolveMappedErrorForSnapshot()` 優先用 runner snapshot 的 `mappedError`，fallback 才重 resolve；T0338 integration test case #4 unskip + 刪 #4b regression guard |
| 類型 | fix |
| 優先級 | 🟡 Medium（PLAN-032 内部 production gap，T0340 input-step 抽象前必修） |
| 狀態 | ✅ FIXED |
| 建立時間 | 2026-04-28 06:10 (UTC+8) |
| 開始時間 | 2026-04-28 06:13 (UTC+8) |
| 完成時間 | 2026-04-28 06:16 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 5 衍生 fix） |
| 關聯 BUG | BUG-076 |
| 關聯工單 | T0338（整合測試發現此 gap） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 3 |
| 預估時間 | 30-60 min（S/M） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/SetupWizardShell.tsx`（修 `resolveMappedErrorForSnapshot` line 170-184）、`src/components/setup-wizard/__tests__/integration.mapped-ux.test.tsx`（unskip case #4 + 刪 #4b regression guard）、可能 `src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`（既有測試若依賴舊行為需調整，視情況） |

## 編號註記

- 本工單 T0339 是 BUG-076 修復票，原 PLAN-032 拆單表「T0339 = Sprint 4 input abstraction」順延為 T0340，「T0340 = Sprint 5 audit」順延為 T0341。
- PLAN-032 metadata 表將在後續 sprint 收尾時統一同步。

## 背景

T0338 整合測試實作時發現 production gap（詳見 BUG-076）：

`SetupWizardShell.tsx::resolveMappedErrorForSnapshot()`（line 170-184）在 render 時重新呼叫 `resolveMappedError()`，但只傳 `error.message` 不傳 `errorCode`，導致 stage-1 exact errorCode match 被 bypass。

對「有 patterns 的 entry」沒影響（regex fallback 蓋住），但對「只有 errorCodes、沒 patterns」的 entry（如 `wsl-not-installed`）會落 fallback：
- runner 層 snapshot.mappedError 正確 ship `wsl-not-installed`（含 open-link MSFT install URL）
- Shell 視覺層 render 「步驟發生錯誤」+ baseline retry/skip/cancel

修法 **方案 (a) 根治**：Shell 優先用 `snapshot.mappedError`（runner 已經算過），fallback 才重新 resolve。

## 目標（驗收條件，工單級）

### AC-1：SetupWizardShell 改 single-source-of-truth

修改 `src/components/setup-wizard/SetupWizardShell.tsx::resolveMappedErrorForSnapshot()`：

```tsx
function resolveMappedErrorForSnapshot(snapshot: WizardSnapshot): WizardMappedError | null {
  // 優先用 runner 已算好的 mappedError（single source of truth）
  if (snapshot.mappedError) return snapshot.mappedError

  // Fallback：runner 沒算（理論上不應該，防禦性 path）
  const failedStep = snapshot.steps.find((s) => s.status === 'failed' && s.error)
  if (!failedStep || !failedStep.error) return null
  const platform = targetOSToErrorPlatform(snapshot.targetOS)
  return resolveMappedError({
    error: { message: failedStep.error },
    stepId: failedStep.id,
    platform,
    registry: DEFAULT_WIZARD_ERROR_REGISTRY,
  })
}
```

**注意**：
- 確認 `WizardSnapshot` type 有 `mappedError` 欄位（runner 應該有 ship；若無，需先補 runner 端 ship 邏輯，但這超出本工單，回 PAUSE 報塔台）
- fallback 路徑保留作為防禦性 dead code，加 comment 註明這是「runner 沒 ship mappedError 時的退路」
- 若確認 runner 永遠 ship，可考慮整段 fallback 移除（但保守做法是保留，未來 runner 重構不會破 Shell）

### AC-2：T0338 integration test case #4 unskip

修改 `src/components/setup-wizard/__tests__/integration.mapped-ux.test.tsx`：

1. case #4（`wsl-not-installed`）：把 `it.skip(...)` 改回 `it(...)`，驗證原本期望行為（mapped title「未安裝 WSL2」+ open-link MSFT URL 按鈕）
2. case #4b（regression guard）：整段刪除（不再需要鎖 fallback 行為，因為 fallback 不再是預期行為）

### AC-3：既有 SetupWizardShell.test.tsx 不破

跑 `npm run test:unit` 確認既有 SetupWizardShell unit tests 全綠：

- 若有 unit test 依賴舊「render 時重 resolve」行為（例如測 `resolveMappedError` 被呼叫），調整測試對齊新行為
- 若調整邏輯比預期大（修改超過 2 個既有測試案例），PAUSE 報塔台

### AC-4：CI 全綠

- `npm run test:unit` 全綠
- T0338 整合測試 case #4 通過
- 既有 unit tests 不破

### AC-5：commit 範圍

- 單一 commit 涵蓋 production fix + test 調整 + #4 unskip
- commit message 格式：`fix(setup-wizard): use runner snapshot.mappedError to preserve errorCode (T0339, BUG-076)`

## 實作順序建議

1. 先讀 `WizardSnapshot` type 確認 `mappedError` 欄位存在 + runner 在哪 ship 它（`wizard-runner.ts` 應該有）
2. 改 `SetupWizardShell.tsx::resolveMappedErrorForSnapshot()`
3. unskip integration.mapped-ux.test.tsx case #4 + 刪 #4b
4. 跑 `npm run test:unit`
5. 若既有 SetupWizardShell.test.tsx 有破，逐案調整
6. commit

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| `WizardSnapshot.mappedError` 欄位不存在或 runner 沒 ship | High（修不了，需先補 runner） | 第 1 步驗證；若不存在 PAUSE 報塔台，不在本票範圍順手補 runner |
| 既有 SetupWizardShell.test.tsx 大幅依賴舊行為 | Medium | AC-3 限制：>2 個案例破 → PAUSE |
| #4 unskip 後仍失敗（修法不對） | Medium | 跑單 case 驗證後再展開；失敗時對照 case #4b 看 runner ship 了什麼 |

## 自檢清單（Worker 完成前必跑）

1. [ ] AC-1 SetupWizardShell.tsx 改用 `snapshot.mappedError` 優先
2. [ ] AC-2 case #4 unskipped 通過、case #4b 已刪
3. [ ] AC-3 既有 SetupWizardShell unit tests 全綠（破壞案例數 ≤ 2）
4. [ ] AC-4 `npm run test:unit` 全綠
5. [ ] AC-5 單一 commit + 正確 commit message

## YOLO 模式 — 下一張工單建議

依 PLAN-032 拆單表 + 編號順延：
- **下一張**：T0340 Cross-platform input step abstraction（Sprint 4，input step 抽象，M/L）
- **再下一張**：T0341 Audit / release notes / docs polish（Sprint 5 收尾，S）

完成後塔台會：
- 把 BUG-076 OPEN → CLOSED（T0338 case #4 自動驗證即視為 smoke 通過）
- 觸發 *sync 更新 _bug-tracker.md

---

## 回報區（Worker 填寫）

> 完成時段請填寫以下區段，塔台據此進度更新 PLAN-032 metadata + 收工。

### 實作摘要

修法採方案 (a)：`SetupWizardShell::resolveMappedErrorForSnapshot()` 改為優先使用 runner 已 ship 的 `snap.mappedError`（single source of truth），fallback 才重 resolve（保留為防禦性 dead code，runner 永遠 ship 時不會走到）。

驗證方式：
1. T0338 integration test case #4 (`wsl-not-installed`) unskip 後通過 — Shell render 正確顯示 mapped title「找不到 WSL2」+ open-link 按鈕（href = MSFT install URL），且點擊後 invoke `electronAPI.shell.openExternal`
2. `npm run test:unit` 23 files / 304 tests 全綠（無 regression）

### `WizardStepSnapshot.mappedError` 欄位確認

> 註：spec 寫 `WizardSnapshot.mappedError`，實際是 per-step 的 `WizardStepSnapshot.mappedError`（每個 step 各自帶 mappedError）。修法不受影響。

- 欄位存在 / 不存在：✅ 存在（`wizard-runner.ts` line 234）
- runner ship 位置（檔名 + line）：`wizard-runner.ts` line 464，`runInternal()` 的 `catch (error)` 區塊
- ship 時機：step 拋錯被 transition 為 `Failed` 後，立刻以 `errorCode` (從 `error.code`) + `error` + `stepId` + `platform` 呼叫 `resolveWizardError(...)` 並寫入 `snapshot.mappedError`，再 `emitProgress()`

### 既有 SetupWizardShell.test.tsx 影響

| 案例 | 是否破 | 調整內容 |
|------|--------|---------|
| 全部既有案例 | 否 | 無需調整（304/304 全綠） |

### 偏離 spec 的決策

無。spec 將欄位名寫為 `WizardSnapshot.mappedError`，實際為 `WizardStepSnapshot.mappedError`（per-step），修法語意一致，未影響 AC。

### 自檢結果

- [x] AC-1 改 resolveMappedErrorForSnapshot 通過（`SetupWizardShell.tsx` line 170-194）
- [x] AC-2 case #4 unskipped + #4b 刪除
- [x] AC-3 既有 unit tests 全綠（破壞案例數 0）
- [x] AC-4 `npm run test:unit` 全綠（總時間：11.52s，23 files / 304 tests）
- [x] AC-5 commit hash + message：`f711baf` `fix(setup-wizard): use runner snapshot.mappedError to preserve errorCode (T0339, BUG-076)`

### Renew 歷程

無

### 後續建議

- T0340 input-step 抽象進場前，Shell 端的 mapped error path 已單一化，抽象工作可直接套用 `snap.mappedError` 不必擔心 stage-1/stage-2 行為差
- BUG-076 fix 同步覆蓋了所有「errorCodes-only entry」未來可能的同類問題（未只是 wsl-not-installed），其他類似 entry 不必再加 patterns fallback
- 防禦性 fallback 保留，未來若確認 runner 永遠 ship 可單獨 chore commit 移除（影響 ≈ 10 行）

### Commit hash

`f711baf`
