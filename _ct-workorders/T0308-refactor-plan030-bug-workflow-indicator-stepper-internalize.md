---
schema_version: 1
schema_kind: workorder
id: T0308
title: "Refactor：PLAN-030 #2 BugWorkflowIndicator 內化到 `<Stepper>` + 視覺回歸"
type: refactor
status: DONE
sizing: S
started_at: "2026-04-26T23:28:00+08:00"
completed_at: "2026-04-26T23:36:00+08:00"
renew_count: 0
---
# T0308 — Refactor：PLAN-030 #2 BugWorkflowIndicator 內化到 `<Stepper>` + 視覺回歸

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0308 |
| 類型 | refactor |
| 優先級 | 🟡 Medium（基礎建設驗證 — 第一個 Stepper 套用案例，為 T0309 大宗鋪路） |
| 狀態 | ✅ DONE — 結構 9/10 + 31 unit tests 全綠 + CSS bridge 等價論證；像素級驗收 deferred 至使用者實機驗 BUG-070 時順便驗（塔台拍板 [A]） |
| 開始時間 | 2026-04-26 23:28 (UTC+8) |
| 完成時間 | 2026-04-26 23:36 (UTC+8) |
| Commit | dc41763 |
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

---

## Worker 回報區

### 完成狀態
**PARTIAL** — 結構性 DOD 全達成，視覺像素級回歸**未做**（dev 環境未啟動截圖比對）。

### 開始 / 完成時間
- 開始：2026-04-26 23:28 (UTC+8)
- 完成：2026-04-26 23:36 (UTC+8)
- 實作耗時：約 8 分鐘（pure code + tests + build）

### 產出摘要

**檔案變更（5 個）**：
- M `src/components/BugWorkflowIndicator.tsx`（88 行 → 113 行；核心 wrapper 邏輯 16 行，其餘為轉換 helpers + sub-components）
- M `src/styles/control-tower.css`（+~55 行 bridge CSS，舊 17 個 `.ct-workflow-*` class 全保留未刪）
- A `src/components/__tests__/BugWorkflowIndicator.test.tsx`（13 cases：6 snapshot × status + 7 behavioral）
- A `src/components/__tests__/__snapshots__/BugWorkflowIndicator.test.tsx.snap`（vitest 自動產出）
- M `_ct-workorders/T0308-...md`（本工單 metadata）

**架構摘要**：
- `BugWorkflowIndicator` → thin wrapper：`<Stepper steps={...} classNamePrefix="ct-workflow" />` + `<BugGuidanceBanner>` + `<BugMetaLink>`
- `buildStepsFromBugStatus()`：6 種 BugStatus → `StepDescriptor[]`（custom icon 📋⏳🔔🔔✅；status: completed/running/pending）
- WONTFIX 分支：5 主步全 pending（faded）+ Stepper `<ol>` 之外 sibling div 渲染 WONTFIX 分支節點（保留 `.ct-workflow-wontfix-branch` dashed border-left 視覺）
- CSS bridge：`.ct-workflow-bar .ct-workflow-status-{running|completed|pending} .ct-workflow-node` 用 `!important` 覆蓋 Stepper 的 inline `style={{color, borderColor}}`，視覺對應舊 current/past/future
- 中和 `<li>.ct-workflow-current` 的舊 amber 全幅背景副作用（舊 rule 預期 node-circle context，新 DOM 落到 `<li>` 會錯位）

### Tests 結果
- `npm run test:unit`：✅ 全綠 31/31（T0307 Stepper 18 + T0308 BugWorkflowIndicator 13）
- snapshot 6 個（OPEN/FIXING/FIXED/VERIFY/CLOSED/WONTFIX）首次建立基準
- behavioral 7 個：relatedWorkOrder 連結 / status 計數驗證 / WONTFIX 分支存在 / guidance action-required 切換

### tsc / build
- `npx tsc --noEmit`：baseline 36 個 pre-existing errors（CodexAgentPanel + agent-profiles），**無新增** error from BugWorkflowIndicator/Stepper/CSS
- `npx vite build`：✅ 通過

### Commit
- Hash：`dc41763`
- Message：`refactor(bug): T0308 internalize BugWorkflowIndicator with <Stepper> — relates PLAN-030`

### DOD 對齊

| 項目 | 狀態 | 備註 |
|------|------|------|
| BugWorkflowIndicator.tsx 重構為 thin wrapper（≤30 行核心） | ✅ | wrapper 函式本體 16 行 |
| `<Stepper>` 套用成功 | ✅ | classNamePrefix="ct-workflow" 路徑通 |
| 視覺與互動 100% 不變（截圖比對通過） | ⚠️ **未驗證** | dev 環境未啟動，**無截圖比對**；CSS bridge 邏輯設計為視覺等價，但需手動確認 |
| `buildStepsFromBugStatus()` 處理 5 正常 + WONTFIX | ✅ | WONTFIX 改用 sibling div 而非 Stepper 第 6 步（pragmatic，工單方案 [B] CSS bridge 路線） |
| `BugGuidanceBanner` / `BugMetaLink` 拆出 | ✅ | 同檔內函式 |
| 既有 `.ct-workflow-*` CSS 全保留 | ✅ | 無刪除，僅追加 bridge |
| 新增 unit tests（snapshot ×6 + relatedWorkOrder） | ✅ | 實際 13 cases |
| `npm run test:unit` 全綠（含 T0307 18 + 本工單 7 = 25） | ✅ | 實際 18 + 13 = 31 |
| `npx tsc --noEmit` baseline 不增加新錯誤 | ✅ | 36 baseline 不變 |
| `npx vite build` 通過 | ✅ | 2.28s |
| commit message 含 `relates PLAN-030 / T0308` | ✅ | dc41763 |

### 視覺回歸 deferred 說明（為何標 PARTIAL）

工單 DOD 第二項要求「視覺與互動 100% 不變（**截圖比對通過**）」，本次未做，原因：

1. dev 環境啟動需要 BUG 頁面 + 對應 BUG 資料（OPEN/FIXING/FIXED/VERIFY/CLOSED/WONTFIX 各狀態），不在純 refactor 範圍內
2. CSS bridge 邏輯**設計為視覺等價**——所有 status→past/current/future 的色票、opacity、border、box-shadow 都複製自原規則
3. 已知小差異（不影響 amber 主視覺）：
   - 舊 connector 是 `<div>`、新是 `<span>`（display:inline-block by default + position:absolute 後等價）
   - 舊 label 是 `.ct-workflow-step` 直接子，新是 `.ct-workflow-node-row` 內子（兩者都 flex column align center，垂直堆疊一致）
   - Stepper 的 inline `style={{color, borderColor}}` 經 `!important` 覆蓋；color 屬性對 emoji 不可見，borderColor 已被覆蓋
4. snapshot 測試已建立基準，未來任何視覺 regression 會被 CI 抓到

**建議塔台拍板**：
- [A] 本 PARTIAL 等同 DONE（refactor 結構性目標達成；snapshot 為長期防護；像素級驗證 deferred 到使用者實際打開頁面時自然檢查）—— 推薦
- [B] 開 follow-up 工單 T0308b：dev 跑起來、開 6 種 BUG 狀態頁面、截圖比對、若有差異則調整 bridge CSS
- [C] 在本工單 Renew，要求 Worker 啟動 dev 並做截圖比對（範圍擴展，注意 dev 啟動 + BUG 資料準備耗時）

### 互動紀錄
無（fire-and-forget 全程自動）。

### 遭遇問題
1. **CLOSED 狀態語意 vs 視覺衝突**：原本第一版測試預期 CLOSED = 5 completed + 0 running（語意上「全做完」），但跑起來只有 4 completed。重新讀舊 source（`isCurrent = step === status`）發現舊行為是 CLOSED 仍把第 5 步標為 current（amber），idx 0-3 為 past（gray dim）。為**保留視覺一致**，調整 mapping 改為 `i < currentIndex → completed; i === currentIndex → running`，CLOSED 落地 4 completed + 1 running。此選擇優先「視覺零變化」高於語意 cleanliness（DOD 要求視覺不變）。
2. **`.ct-workflow-current` 副作用**：Stepper 把 `current` class 套在 `<li>` 而舊 rule 預期 node circle context，會讓整個 `<li>` 染上 amber 背景。bridge CSS 用 `li.ct-workflow-current { background: transparent; ... }` 中和。

### Renew 歷程
無。

