# T0308 — Refactor：PLAN-030 #2 BugWorkflowIndicator 內化到 `<Stepper>` + 視覺回歸

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0308 |
| 類型 | refactor |
| 優先級 | 🟡 Medium（基礎建設驗證 — 第一個 Stepper 套用案例，為 T0309 大宗鋪路） |
| 狀態 | 📋 TODO |
| 預估規模 | S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-26 23:?? (UTC+8) |
| 報告者 | 塔台（PLAN-030 Phase C #2） |
| 關聯 PLAN | PLAN-030 |
| 前置工單 | T0307 (DONE) Stepper 元件 / T0307b (DONE) vitest infra |
| Renew 次數 | 0 |
| 影響範圍 | `src/components/BugWorkflowIndicator.tsx` 重構為 thin wrapper / `src/styles/control-tower.css` 既有 `.ct-workflow-*` class 保留作為 BUG indicator 特化樣式 / 新增視覺回歸 unit test |

## 背景

T0305 Phase B1 規劃將 `BugWorkflowIndicator.tsx`（89 行，5 步固定 + 寫死 STATUS_GUIDANCE）**內化到 `<Stepper>`**：

```tsx
export function BugWorkflowIndicator({ status, relatedWorkOrder }: Props) {
  const steps = useMemo(() => buildStepsFromBugStatus(status), [status])
  return (
    <div className="ct-workflow-indicator">
      <Stepper steps={steps} orientation="horizontal" />
      <BugGuidanceBanner status={status} />
      {relatedWorkOrder && <BugMetaLink wo={relatedWorkOrder} />}
    </div>
  )
}
```

舊 `.ct-workflow-*` CSS 不刪（特化 amber 色系），新元件用 `.bat-stepper-*` 中性色系。

## 任務

### Step 1：分析既有 BugWorkflowIndicator

讀取 `src/components/BugWorkflowIndicator.tsx`：
- 確認 props (`status: BugStatus`, `relatedWorkOrder?: string`)
- 確認 STATUS_GUIDANCE Record 內容（`{icon, message, requiresAction}`）
- 確認 5 步固定列表（OPEN/FIXING/FIXED/VERIFY/CLOSED）+ WONTFIX 分支處理
- 確認 CSS class 使用（`src/styles/control-tower.css` 行 827-980 共 17 個 `.ct-workflow-*` class）

### Step 2：設計 BugStatus → StepDescriptor 轉換

新增 helper（可放 `src/components/BugWorkflowIndicator.tsx` 同檔，或抽 `src/components/bug/build-bug-stepper-steps.ts`）：

```ts
function buildStepsFromBugStatus(status: BugStatus): StepDescriptor[] {
  // OPEN → FIXING → FIXED → VERIFY → CLOSED 流線
  // WONTFIX 分支處理：顯示「不修復」狀態（用 'rolled-back' status + groupLabel）
  // 依當前 status 標記每 step 的 status：
  //   - 已通過：'completed'
  //   - 當前：'running'
  //   - 未到：'pending'
  //   - WONTFIX 分支：所有 step 'rolled-back' 並標 errorMessage
}
```

### Step 3：拆 BugGuidanceBanner + BugMetaLink

從原 BugWorkflowIndicator 拆出：

```tsx
function BugGuidanceBanner({ status }: { status: BugStatus }) {
  // 顯示原 STATUS_GUIDANCE[status].message + icon
  // 樣式沿用既有 .ct-workflow-guidance-* class
}

function BugMetaLink({ wo }: { wo: string }) {
  // 顯示「相關工單：T####」連結
  // 樣式沿用既有 .ct-workflow-meta-* class
}
```

> 兩個子元件可放同檔 BugWorkflowIndicator.tsx，不必獨立檔案。

### Step 4：重寫 BugWorkflowIndicator 為 thin wrapper

```tsx
import { Stepper } from './stepper/Stepper'

export function BugWorkflowIndicator({ status, relatedWorkOrder }: Props) {
  const steps = useMemo(() => buildStepsFromBugStatus(status), [status])
  const currentIndex = useMemo(() => findCurrentIndex(status), [status])

  return (
    <div className="ct-workflow-indicator">
      <Stepper
        steps={steps}
        orientation="horizontal"
        currentIndex={currentIndex}
        ariaLabel={`Bug workflow status: ${status}`}
        classNamePrefix="ct-workflow"  // 保留原 CSS prefix 維持視覺
      />
      <BugGuidanceBanner status={status} />
      {relatedWorkOrder && <BugMetaLink wo={relatedWorkOrder} />}
    </div>
  )
}
```

> `classNamePrefix="ct-workflow"` 讓 Stepper 渲染出 `.ct-workflow-*` class，**繼續吃既有 CSS** — 視覺零變化。

### Step 5：視覺回歸驗證

#### 方法 A：手動截圖比對（推薦）

- 啟動 dev 環境（或 build），開 BUG-061（OPEN）/ BUG-070（VERIFY）/ 任一 CLOSED BUG 頁面
- 截圖 BugWorkflowIndicator 區塊（5 步狀態 + guidance + meta）
- **重構前 vs 重構後**截圖像素級比對
- 預期：100% 不變

#### 方法 B：unit test snapshot

```tsx
// src/components/__tests__/BugWorkflowIndicator.test.tsx
import { render } from '@testing-library/react'
import { BugWorkflowIndicator } from '../BugWorkflowIndicator'

describe('BugWorkflowIndicator', () => {
  test.each([
    'OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED', 'WONTFIX'
  ] as const)('renders %s status correctly', (status) => {
    const { container } = render(<BugWorkflowIndicator status={status} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  test('renders relatedWorkOrder link when provided', () => {
    const { getByText } = render(<BugWorkflowIndicator status="FIXED" relatedWorkOrder="T0306" />)
    expect(getByText(/T0306/)).toBeInTheDocument()
  })
})
```

> snapshot 第一次跑會建立基準，重構後跑應全綠不變。

### Step 6：CSS 檢查

`src/styles/control-tower.css` 行 827-980 的 17 個 `.ct-workflow-*` class **不要動**。Stepper 透過 `classNamePrefix="ct-workflow"` 渲染對應 class 名稱，但實際 DOM 結構需與舊版一致：

需確認：
- `.ct-workflow-step` / `.ct-workflow-step-current` / `.ct-workflow-step-past` / `.ct-workflow-step-future` / `.ct-workflow-step-wontfix`
- `.ct-workflow-connector` / `.ct-workflow-icon` / `.ct-workflow-label`

**如 Stepper 元件目前產出的 class 名稱與 BugWorkflowIndicator 期望不一致**：
- [A] 在 Stepper 元件加 class mapping 機制（複雜度高）
- **[B] 在 BugWorkflowIndicator 加薄薄一層 CSS bridge**（推薦）— 例如 `.bat-stepper-step-running` 多加一個 `.ct-workflow-step-current` alias

> 若 [B] 仍無法達成 100% 視覺一致，標記 deferred 並回報，由塔台拍板。

### Step 7：清理

- 移除 BugWorkflowIndicator 內部寫死的 5 步陣列、STATUS_GUIDANCE 中與 step 渲染相關的部分（保留 banner 用的 message）
- 確認沒有死碼（unused imports / unused functions）

## 完成定義（DOD）

- [ ] `BugWorkflowIndicator.tsx` 重構為 thin wrapper（≤ 30 行核心邏輯）
- [ ] `<Stepper>` 套用成功，視覺與互動 100% 不變（截圖比對通過）
- [ ] `buildStepsFromBugStatus()` helper 正確處理 5 個正常狀態 + WONTFIX 分支
- [ ] `BugGuidanceBanner` / `BugMetaLink` 子元件正確拆出
- [ ] 既有 `.ct-workflow-*` CSS class 全保留可用（手動或 bridge layer）
- [ ] 新增 unit tests（snapshot ×6 status + 1 relatedWorkOrder）全綠
- [ ] `npm run test:unit` ✅ 全綠（含 T0307 18 + 本工單 7 = 25 cases）
- [ ] `npx tsc --noEmit` ✅ baseline 不增加新錯誤
- [ ] `npx vite build` ✅ 通過
- [ ] git commit message 含 `relates PLAN-030 / T0308`

## 不在範圍

- 不改 SetupWizardShell（T0309 處理）
- 不改 Stepper 元件本身（T0307 已 DONE，本工單只用，不改）
- 不寫設計規範文件（T0310 處理）
- 不重新設計 Bug 視覺（保持 100% 視覺一致是 DOD）

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`refactor(bug): T0308 internalize BugWorkflowIndicator with <Stepper> — relates PLAN-030`）
2. 在工單檔尾追加 Worker 回報區（含實作摘要、commit hash、tests 結果、視覺回歸截圖或 snapshot 結果）
3. **回報字串嚴格符合斷點 A regex**：`T0308 完成` / `T0308 部分完成` / `T0308 失敗` / `T0308 需要協助`
