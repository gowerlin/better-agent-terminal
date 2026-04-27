# BAT UI Stepper Design Language

> **狀態**：v1.1（PLAN-032 Sprint 2 補入 `awaiting-input` 規範與 wizard error mapping i18n hooks，2026-04-27）
> **權威來源**：本文件
> **參考實作**：`src/components/stepper/`、`src/components/BugWorkflowIndicator.tsx`、`src/components/setup-wizard/SetupWizardShell.tsx`、`src/components/setup-wizard/error-mapper.ts`

---

## 1. 總覽

Stepper 是 BAT 流程展示與互動的**統一視覺語言**，用於把多步驟流程的「進行狀態 + 動作可達性 + 失敗復原路徑」以一致方式呈現給使用者。

### 採用情境

- BUG 工單狀態指示（`BugWorkflowIndicator`）
- Setup Wizard（WSL / Docker / SSH）多階段安裝
- 未來新增的多步驟流程（profile bind、GPU Whisper setup、onboarding 等）

### 設計目標

1. **一致性**：使用者一次學會，跨流程通用
2. **可擴充性**：共用元件 + props 驅動，新場景只新增 step descriptor，不另刻 UI
3. **a11y**：semantic role、aria-current、鍵盤可達、screen reader 可讀
4. **語意 / 視覺分離**：step 內部 ID（kebab-case 技術名稱）與顯示 label（i18n 人話）解耦

---

## 2. 元件 API

完整 schema 來自 `src/components/stepper/types.ts`（T0307 落地版本）。

### `StepperOrientation`

```ts
type StepperOrientation = 'horizontal' | 'vertical'
```

| 值 | 用途 |
|----|------|
| `horizontal` | ≤5 步、純展示、頁面寬度足夠時使用（如 BUG status indicator）|
| `vertical` | 6+ 步、需要 group / errorMessage / actions slot 時使用（如 Setup Wizard）|

預設值：`horizontal`。

### `StepStatus`

```ts
type StepStatus =
  | 'pending'
  | 'running'
  | 'awaiting-input'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'rolled-back'
```

7 個值對應第 3 章「狀態-視覺對應表」。每個 step 必填。

> `awaiting-input` 由 PLAN-032 Sprint 2（T0330）落地，代表 input step 進入等待使用者選擇／輸入的中性狀態，視覺與 a11y 行為與 `failed` 嚴格區隔。

### `StepDescriptor`

```ts
interface StepDescriptor {
  id: string
  label: string
  description?: string
  icon?: string | ReactNode
  status: StepStatus
  retryable?: boolean
  errorMessage?: string
  groupLabel?: string
}
```

| Prop | Type | 用途 | 預設值 | 範例 |
|------|------|------|--------|------|
| `id` | `string` | 內部技術 ID（kebab-case），不渲染到 UI | （必填）| `'pick-wsl-distro'` |
| `label` | `string` | 顯示給使用者的人話標題（建議走 i18n key） | （必填）| `'選擇 WSL 發行版'` |
| `description` | `string?` | 補充說明（vertical 模式才顯示） | `undefined` | `'指定要部署 server bundle 的目標 distro'` |
| `icon` | `string \| ReactNode?` | 覆寫預設 status icon | 由 status preset 決定 | `'📋'`、`<MyIcon />` |
| `status` | `StepStatus` | 該 step 當前狀態 | （必填）| `'running'` |
| `retryable` | `boolean?` | 失敗時是否可重試（影響 actions slot 是否提供 Retry 按鈕） | `false` | `true` |
| `errorMessage` | `string?` | `status === 'failed'` 時顯示的失敗原因 | `undefined` | `'ssh: connect to host failed'` |
| `groupLabel` | `string?` | 群組標題（同一 group 的連續 step 共享） | `undefined` | `'環境檢查'` |

### `StepperProps`

```ts
interface StepperProps {
  steps: StepDescriptor[]
  currentIndex?: number
  orientation?: StepperOrientation
  onStepClick?: (step: StepDescriptor, index: number) => void
  clickableSteps?: StepperClickableMode  // 'completed' | 'all' | 'none'
  renderFailedActions?: (step: StepDescriptor, index: number) => ReactNode
  groupingMode?: StepperGroupingMode      // 'none' | 'compress'
  ariaLabel?: string
  classNamePrefix?: string
}
```

| Prop | Type | 用途 | 預設值 | 範例 |
|------|------|------|--------|------|
| `steps` | `StepDescriptor[]` | step 清單（順序即顯示順序） | （必填）| 見上 |
| `currentIndex` | `number?` | 當前 active step index（用於 `aria-current` 與視覺強調） | `undefined` | `2` |
| `orientation` | `StepperOrientation?` | 排版方向 | `'horizontal'` | `'vertical'` |
| `onStepClick` | `(step, index) => void` | step 被點擊的 callback | `undefined` | `(step, idx) => jumpToStep(step.id)` |
| `clickableSteps` | `StepperClickableMode?` | 哪些 step 可點 | `'completed'` | `'all'`（除錯模式） |
| `renderFailedActions` | `(step, index) => ReactNode` | `status === 'failed'` 時的 actions slot | `undefined` | `() => <button>Retry</button>` |
| `groupingMode` | `StepperGroupingMode?` | horizontal 模式下是否壓縮顯示（compress 模式 deferred） | `'none'` | `'compress'` |
| `ariaLabel` | `string?` | 整個 stepper 容器的 `aria-label` | `'Steps'` | `'Setup Wizard 進度'` |
| `classNamePrefix` | `string?` | CSS class 名稱前綴（與既有 CSS rule 整合用） | `'bat-stepper'` | `'ct-workflow'` |

---

## 3. 狀態-視覺對應表

完整對應來自 `src/components/stepper/status-preset.ts`（T0307 落地版本）。

| Status | Icon | 配色 (hex) | 視覺處理 | 使用情境 |
|--------|------|-----------|---------|---------|
| `pending` | `○` | `#71717a` | opacity 0.4 | 未到的 step |
| `running` | `🔄` | `#f59e0b` | pulse 光暈 | 進行中的 step |
| `awaiting-input` | `●` | `#38bdf8` | 中性藍實心圓；不掛 `role="alert"`、不顯示 Retry/Skip CTA；保留 `aria-current="step"`，可透過 `promptRegionId` 走 `aria-describedby` 指向提示區塊 | 等待使用者輸入（input step kind） |
| `completed` | `✓` | `#10b981` | opacity 0.8 | 已完成的 step |
| `failed` | `✗` | `#ef4444` | 錯誤訊息展開 + actions slot | 失敗的 step |
| `skipped` | `⏭` | `#f59e0b` | dashed border | 使用者主動跳過 |
| `rolled-back` | `↩` | `#71717a` | line-through | 已回滾的 step |

> **PLAN-032 Sprint 2 補入**：`awaiting-input` 是中性等待態，**不是錯誤態**。任何「input 開啟即顯示為失敗」的舊路徑（BUG-074 root cause）都應改為 `awaiting-input`。a11y 走 `aria-current="step"` + `aria-describedby`，**禁止**掛 `role="alert"`。

### Severity 順序（compress 模式用）

當 `groupingMode === 'compress'` 把多個 step 合併成單一 pill 時，pill 配色取群組內「最差」status：

```
failed > running > awaiting-input > skipped > rolled-back > pending > completed
```

> `awaiting-input` 排在 `running` 後 `skipped` 前，因為它代表使用者主動干預中（高於被略過，但低於正在執行的步驟）。

實作見 `status-preset.ts::worstStatus`。

---

## 4. 訊息層級規範

每個 step 最多展示 5 層訊息，依重要性與情境分層：

| Level | 名稱 | 用途 | 顯示時機 | 範例 |
|-------|------|------|---------|------|
| L1 | label | 人話標題 | **永遠顯示** | 「設定主機資訊」 |
| L2 | description | 補充說明 | vertical 模式且 `description` 有值 | 「指定 SSH 主機、port、認證方式」 |
| L3 | status | 純視覺（icon + 配色） | **永遠顯示**（無文字） | （icon 見第 3 章） |
| L4 | errorMessage | 失敗原因 | `status === 'failed'` 且 `errorMessage` 有值 | 「ssh: connect to host failed」 |
| L5 | actions | 動作按鈕 slot | `status === 'failed'` 且 `renderFailedActions` 有提供 | Retry / Skip / Edit / Cancel |

> **horizontal 模式只展示 L1 + L3**（受空間限制）；vertical 模式可展示 L1 ~ L5。

---

## 5. ID 隱藏原則

### 原則

- 內部 step ID（如 `pick-wsl-distro`、`fetch-fingerprint`）**永遠不渲染到 UI**
- DOM 層可用 `data-step-id` 給測試（`data-testid` 仍合法）
- 使用者面 100% 走 i18n key + 人話 label

### 為什麼

技術 ID 是 kebab-case 英數字串，給 wizard runner / testing / state 用。給使用者看會：
1. 失去 i18n 能力（無法跟著 locale 切換）
2. 暴露實作細節（步驟改名會破壞使用者已建立的心智模型）
3. 違反「視覺/語意分離」原則

### 實例

T0309 Setup Wizard 重設計時把原本的：

```tsx
<div className="text-xs uppercase">{step.id}</div>  // ❌
```

全面移除，改走 `t(step.labelKey)` 取人話 label。詳見 `src/components/setup-wizard/SetupWizardShell.tsx`。

---

## 6. 適用情境清單

### ✅ 已套用

| 情境 | 套用 orientation | 工單 | 套用範圍 |
|------|-----------------|------|---------|
| BUG 工單狀態指示 | horizontal | T0308 | 所有 BUG 卡片頁籤 |
| Setup Wizard（WSL） | vertical（4 group）| T0309 | 8 step（detect-env / pick-distro / systemd / install / unit / fingerprint / connect / done）|
| Setup Wizard（Docker） | vertical（4 group）| T0309 | 4 step（pick-container / mounts / install / start）|
| Setup Wizard（SSH） | vertical（4 group）| T0309 | 4 step（configure-host / verify / install / start）|
| Setup Wizard input steps（awaiting-input） | vertical | T0330（PLAN-032 Sprint 2）| SSH `configure-host`、WSL `pick-wsl-distro`、Docker `pick-container` / `configure-mounts` — 透過 `WizardStepKind = 'input'` 自動標註，runner 在 `requestChoice` pending 期間流轉到 `awaiting-input` |

### 🔮 未來預期

- Profile bind 流程（PLAN-030 衍生）
- GPU Whisper setup
- 第一次啟動 onboarding（welcome → 選擇 deployment → 連 server）
- PLAN-007 後續 remote profile 認證流程
- 多階段 release / migration 流程

---

## 7. Don't 反例

- ❌ **不在 step label 出現英數技術 ID**
  - 反例：`<label>pick-wsl-distro</label>`
  - 正解：`<label>{t('wizard.wsl.steps.pickDistro')}</label>`

- ❌ **不混用 stepper 與 progressbar 重複表達同件事**
  - 反例：vertical stepper 上方再放一條 `<progress value={3} max={8} />`
  - 正解：兩擇一。階段感重要 → stepper；連續進度感重要 → progressbar

- ❌ **8+ steps 不用 horizontal**（除非有 grouping 壓縮）
  - 反例：橫向擠 12 個 step，每個寬度 < 80px 完全看不出 label
  - 正解：6+ step 改 vertical；或 horizontal + `groupingMode="compress"`

- ❌ **失敗 step 不單純標紅就完事，必須附 actionable recovery**
  - 反例：紅色 ✗ 沒有任何按鈕，使用者只能關掉 wizard 重來
  - 正解：透過 `renderFailedActions` slot 提供 Retry / Skip / Edit 按鈕

- ❌ **不在 stepper 外另畫 status badge / icon 重複表達狀態**
  - 反例：stepper 已顯示 `🔄 running`，旁邊再畫一個 `<Badge>進行中</Badge>`
  - 正解：信任 stepper 視覺，不重複

- ❌ **不在 vertical stepper 內 nest horizontal stepper**
  - 反例：「Step 3：環境檢查」展開後內含 horizontal `[檢查 OS] → [檢查 GPU] → [檢查 Docker]`
  - 正解：採子任務 progress 列代替；或把子任務拉成主 stepper 的獨立 step

- ❌ **不要把 input step 標 `failed`**（PLAN-032 Sprint 2）
  - 反例：SSH wizard 第 1 步 `configure-ssh-host` 開啟即顯示紅 X + Retry/Skip（BUG-074 root cause）
  - 正解：input step（`kind: 'input'`）開啟時應顯示為 `awaiting-input`，使用 `aria-current="step"` + `aria-describedby` 指向提示區塊

- ❌ **不在 `awaiting-input` 上掛 `role="alert"`**（PLAN-032 Sprint 2）
  - 反例：把 input step 的提示文字塞進 `<div role="alert">`，導致 screen reader 讀成錯誤
  - 正解：`role="alert"` 是 failure-only。`awaiting-input` 是中性狀態，使用 `aria-current="step"` + `aria-describedby` 點到 `promptRegionId`

---

## 8. 未來擴充點

### Animation

目前採 CSS-only（與既有 `ct-workflow-*` 動畫一致）。引入 framer-motion 等 motion lib 需另開工單評估，本 spec 不規範動畫實作技術。

### Dark/Light theme

當前配色寫死 hex（PLAN-030 拍板 5 暫沿用既有 hex）。當 design token 體系建立後遷移為 CSS var，token 命名建議：

```
--bat-stepper-status-pending: #71717a
--bat-stepper-status-running: #f59e0b
--bat-stepper-status-completed: #10b981
--bat-stepper-status-failed: #ef4444
--bat-stepper-status-skipped: #f59e0b
--bat-stepper-status-rolled-back: #71717a
```

### i18n

所有 `label` / `description` / `groupLabel` / `errorMessage` 走 i18n key。T0309 Setup Wizard 已示範完整流程：

```tsx
const steps: StepDescriptor[] = wizardSteps.map(s => ({
  id: s.id,
  label: t(`wizard.${flow}.steps.${s.id}.label`),
  description: t(`wizard.${flow}.steps.${s.id}.description`),
  groupLabel: t(`wizard.groups.${s.group}`),
  status: s.status,
}))
```

#### Wizard Error Mapping i18n keys（PLAN-032 Sprint 2）

framework 已 i18n-ready：T0331 `WizardErrorMapper` 採 `messageKey` lookup，T0333 把 recovery action labels 拆出可 i18n 的 keys。
目前覆蓋下列 keys（`src/locales/{en,zh-TW,zh-CN}.json` 三檔已同步）：

- `wizard.action.retry` / `skip` / `cancel` / `editConfig` / `skipChoice`：T0309 baseline
- `wizard.action.fixedAndRetry`：「已修復，重試」（T0333 新增）
- `wizard.action.showDetails`：「顯示詳細」（T0333 新增）

`error-mapper.ts` 內 `MESSAGE_DICT` 目前覆蓋（zh-TW only，OOS for translation per D108）：

- `docker.daemon.unavailable`：title + body
- `wsl.linger.failure`：title + body
- `ssh.auth.permission-denied`：title + body
- `fallback`：title「步驟發生錯誤」+ body 取 raw `error.message`

> 後續開發者新增 registry entry 時，請同步在 `MESSAGE_DICT` 補對應 key。
> Action label i18n keys（`wizard.action.*`）必須三檔（en / zh-TW / zh-CN）齊備，由 `i18n-completeness.test.ts` 驗證（T0334 新增）。
> `MESSAGE_DICT` 字典目前內嵌於 `error-mapper.ts`，未來可拆出至 i18n loader（OOS for Sprint 2）。

### Compress mode

T0307 留了 `groupingMode: 'compress'` prop 與 type，但 horizontal pill + tooltip 完整實作 deferred。需要時開新工單實作。

### Skip group

未來如某 group 整段不適用（例如進階模式關閉時跳過「進階設定」整段），整段 skip 視覺如何呈現？目前無此需求，等實際 use case 出現再規範。

---

## 附錄 A：參考實作清單

| 用途 | 元件路徑 |
|------|---------|
| 共用元件 | `src/components/stepper/Stepper.tsx` |
| Types | `src/components/stepper/types.ts` |
| Status preset | `src/components/stepper/status-preset.ts` |
| BUG status 套用 | `src/components/BugWorkflowIndicator.tsx` |
| Setup Wizard 套用 | `src/components/setup-wizard/SetupWizardShell.tsx` |
| Wizard runner（jumpToStep API）| `src/components/setup-wizard/wizard-runner.ts` |
| CSS 樣式 | `src/styles/stepper.css` |

---

## 附錄 B：FAQ

**Q: 何時用 horizontal vs vertical？**

≤5 步且純展示用 horizontal；6+ 步或需要 group / errorMessage / actions slot 用 vertical。

**Q: 何時可點 step 跳轉？**

已完成的 step 可切 read-only 檢視（`onStepClick` + `clickableSteps="completed"`）；失敗時透過 `renderFailedActions` 提供「Edit config」按鈕跳回前一個可編輯的 step。

**Q: 自訂 icon 何時用？**

預設 status icon 不夠表意時。例如 `BugWorkflowIndicator` 自訂 `📋⏳🔔🔔✅` 對應 BUG 工作流的 5 個階段，比通用的 `○🔄✓✗⏭↩` 更切題。

**Q: `classNamePrefix` 何時改？**

與既有舊 CSS 整合時。例如 `BugWorkflowIndicator` 用 `classNamePrefix="ct-workflow"` 吃既有 `.ct-workflow-*` rule，避免重寫一份。其他全新情境用預設 `bat-stepper`。

**Q: `currentIndex` 與 `status === 'running'` 的 step 是同一個嗎？**

通常是，但不必然。`currentIndex` 影響的是 `aria-current` 與視覺強調（外框、置中等），`status === 'running'` 影響的是 status icon 動畫。兩者解耦讓「使用者已跳到後續 step 看摘要，但底層 step 仍在跑」這種情境可表達。

**Q: 一個 step 可同時 `failed` + `retryable`，但 `renderFailedActions` 沒提供 Retry 按鈕，會發生什麼事？**

只顯示 errorMessage，沒有 actions slot。`retryable` 是 descriptor 上的旗標，給呼叫端決定要不要在 `renderFailedActions` 裡產生 Retry 按鈕，stepper 本身不自動產生 UI。
