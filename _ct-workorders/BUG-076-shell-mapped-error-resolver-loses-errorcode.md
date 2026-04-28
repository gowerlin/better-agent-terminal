# BUG-076 — SetupWizardShell `resolveMappedErrorForSnapshot` 重 resolve 時遺失 errorCode，pure-errorCode registry entries 落 fallback

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-076 |
| 標題 | `SetupWizardShell.tsx::resolveMappedErrorForSnapshot()` render 時重新 resolve mapped error，只傳 `error.message` 不傳 `errorCode`，導致「只有 `errorCodes`、沒有 `patterns`」的 registry entries（目前唯一例子 `wsl-not-installed`）落到 generic fallback；runner 算對了 friendly message + actions，Shell 卻 render 「步驟發生錯誤」+ baseline retry/skip/cancel |
| 嚴重度 | 🟡 Medium（單一 entry 觸雷；UX 降級但不阻塞功能；未來新增 pure-errorCode entry 都會踩同坑） |
| 可重現 | 100%（trigger `wsl-not-installed` errorCode 即可） |
| Workaround | 為觸雷 entry 補 `patterns` regex；治標不治本 |
| 狀態 | ✅ CLOSED（T0339 ✅ FIXED `f711baf` @2026-04-28 06:16；T0338 integration test case #4 unskipped 自動驗證通過 + #4b regression guard 已刪；304/304 全綠 0 regression — CLOSED 條件達成） |
| 建立時間 | 2026-04-28 06:10 (UTC+8) |
| 報告者 | T0338 整合測試實作（Worker 守 AC-5 不順手修，回報塔台） |
| 影響範圍 | `src/components/setup-wizard/SetupWizardShell.tsx` (line 170-184, `resolveMappedErrorForSnapshot`) |
| Root cause | Shell 為了 render 重新算一次 mapped error 是「防禦性 redundant computation」，但 resolver 簽名只接 message + platform，沒接 errorCode。Stage-1 exact errorCode match 因此被 bypass，pure-errorCode entries 走到 fallback。 |
| 相關 PLAN | PLAN-032（Sprint 5 整合測試 T0338 發現） |
| 相關工單 | T0338（整合測試，case #4 `it.skip` + #4b regression guard 鎖住現況）/ T0339 fix（本 BUG 修復工單） |
| 相關 BUG | 無 |
| Release target | T0339（input-step 抽象）之前修完 |

## 現象

### 觸發步驟

1. WSL 偵測命中 `wsl-not-installed` errorCode（例如 `wsl --list` 失敗 / WSL2 未裝）
2. WizardRunner snapshot 含正確 `mappedError`：title 「未安裝 WSL2」+ open-link MSFT install URL
3. SetupWizardShell render 時：
   - 視覺顯示「步驟發生錯誤」+ baseline retry/skip/cancel 按鈕（fallback）
   - **不**顯示 mapped friendly message
   - **不**顯示 open-link 安裝按鈕

### 預期行為

Shell render 與 runner snapshot 一致：
- 顯示 mapped title「未安裝 WSL2」
- 顯示 open-link 按鈕（連到 MSFT WSL install URL）

### 證據

T0338 整合測試 `integration.mapped-ux.test.tsx` case #4：
- Worker 寫的期望斷言以 `it.skip` 保留（待本 BUG 修完 unskip）
- case #4b 鎖住目前 fallback 行為作為 regression guard

## Root Cause

`SetupWizardShell.tsx::resolveMappedErrorForSnapshot()` (line 170-184)：

```tsx
function resolveMappedErrorForSnapshot(snapshot: WizardSnapshot): WizardMappedError | null {
  const failedStep = snapshot.steps.find((s) => s.status === 'failed' && s.error)
  if (!failedStep || !failedStep.error) return null
  const platform = targetOSToErrorPlatform(snapshot.targetOS)
  return resolveMappedError({
    error: { message: failedStep.error },  // ❌ 只傳 message，丟失 errorCode
    stepId: failedStep.id,
    platform,
    registry: DEFAULT_WIZARD_ERROR_REGISTRY,
  })
}
```

`resolveMappedError` 4-stage resolver：
1. exact errorCode match ← **被 bypass**（沒傳 errorCode）
2. step-scoped regex match
3. platform-wide regex match
4. fallback (raw error.message)

`wsl-not-installed` 在 registry 只有 `errorCodes: ['wsl-not-installed']`，沒有 `patterns`，因此 stage 1 bypass 後 stage 2/3 都不命中，落 stage 4 fallback。

## 修復策略（採方案 (a) 根治）

**方案 (a)**：Shell 優先用 `snapshot.mappedError`（runner 已經算過），fallback 才重新 resolve。

理由：
- 對齊 single-source-of-truth 原則（runner 是 mapped error 的權威）
- T0339（input-step 抽象）會碰同段，先治本省得 T0339 又遇
- 重 resolve 是「防禦性 redundant computation」，可移除

實作：見對應修復工單 T0339。

**方案 (b)**（已拒絕）：給 `wsl-not-installed` 補 `patterns: [/WSL2 is not installed/i, /wsl.*not.*installed/i]`。
- 優點：2 行純 registry 改動，立即生效
- 缺點：治標不治本，下次新增 pure-errorCode entry 又踩；技術債累積

塔台拍板採 (a)。

## 驗收條件（CLOSED 條件）

- T0339 修復工單 DONE，本 BUG 狀態 OPEN → FIXED → 直接 CLOSED（無需人工 smoke，由 T0338 unskipped case #4 自動驗證）
- T0338 `integration.mapped-ux.test.tsx`：
  - case #4 unskipped 且通過
  - case #4b regression guard 刪除
  - `npm run test:unit` 全綠

## 後續

- T0339 完成 → 本 BUG → CLOSED
- 同類 entries（pure errorCode、無 patterns）後續新增不再踩坑
