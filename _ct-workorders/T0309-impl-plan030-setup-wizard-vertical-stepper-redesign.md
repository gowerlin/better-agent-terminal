# T0309 — Impl：PLAN-030 #4 Setup Wizard vertical stepper 重設計（3 wizard 全套用 + PLAN-029 R5 chunk 切分）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0309 |
| 類型 | impl |
| 優先級 | 🔴 High（PLAN-030 大宗交付，3 wizard 全動） |
| 狀態 | 📋 TODO |
| 預估規模 | **L**（依 T0305 拍板 2 維持單張不拆，視覺一致性必須一次完成） |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-26 23:?? (UTC+8) |
| 報告者 | 塔台（PLAN-030 Phase C #4 + 拍板 4 合併 PLAN-029 R5） |
| 關聯 PLAN | PLAN-030 (主) / PLAN-029 R5（合併進本工單，setup-wizard chunk 切分） |
| 前置工單 | T0307 (DONE) Stepper / T0307b (DONE) vitest / T0308 (DONE) BugWorkflowIndicator 套用驗證 |
| Renew 次數 | 0 |
| 影響範圍 | `src/components/setup-wizard/SetupWizardShell.tsx` 整體重構 / `src/components/setup-wizard/wizard-runner.ts` 加 jumpToStep API / 各 step 加 label/description/groupLabel/editableFromFailure 元資料 / `vite.config.ts` manualChunks setup-wizard chunk 切分 / 新增大量 i18n keys / 新增 unit tests |

## 背景

T0305 Phase B3 + 拍板 1/2/4 整合決策：
1. 採 Q3.C **Vertical stepper + 右欄詳情**（兩欄式 layout）
2. **單張 L 工單不拆**（緊湊、視覺一致性必須一次完成）
3. **合併 PLAN-029 R5**（setup-wizard manualChunks 切分，一起做避免重複改 vite.config）

設計來源：T0305 Phase B3 完整規格。

**現況痛點**（screenshot from BUG-070 工單）：
- Step ID 直接外露（`configure-ssh-host` / `verify-ssh-auth` 等技術名稱）
- 失敗狀態散亂（icon + 訊息 + status 三元素分離）
- 缺進度視覺引導（純 `<ol>` 垂直 list）
- 訊息層級不清
- 0% complete 純文字

**實際 step 數**（T0305 Phase A4 盤點）：
- WSL: 9 steps
- Docker: 9 steps
- SSH: 8 steps

⚠️ 比工單原估多，**強化 vertical stepper 決策的正確性**（horizontal 9 步必擁擠）。

## 任務範圍

### Step 1：擴充 step 元資料 schema

`wizard-runner.ts` 既有 `WizardStepSnapshot` 加欄位：

```ts
export interface WizardStepSnapshot {
  id: string                    // 既有，內部 ID（不外露）
  title: string                 // 既有，舊欄位（建議 deprecate，改用 labelKey）
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'rolled-back' | 'skipped'
  retryable: boolean
  error?: Error
  skipped?: boolean

  // 新增（本工單）
  labelKey?: string             // i18n key for 對使用者顯示的人話 label
  descriptionKey?: string       // i18n key for 副標說明
  groupKey?: string             // i18n key for groupLabel（連線設定 / 安裝部署 / 驗證測試 / 收尾）
  editableFromFailure?: boolean // 失敗時可跳回此 step 編輯設定（如 configure-ssh-host）
}
```

> 舊 `title` 欄位**仍保留**（向後相容），但 SetupWizardShell **優先用 `labelKey`** 渲染，缺失才 fallback `title`。

### Step 2：補完所有 step 的元資料

#### WSL flow (`src/components/setup-wizard/steps/wsl/`，9 steps)

| step.id | labelKey | descriptionKey | groupKey | editableFromFailure |
|---------|----------|----------------|----------|---------------------|
| detect-env | wizard.wsl.step.detectEnv.label | wizard.wsl.step.detectEnv.description | wizard.wsl.group.detection | false |
| pick-wsl-distro | wizard.wsl.step.pickDistro.label | wizard.wsl.step.pickDistro.description | wizard.wsl.group.detection | true |
| wsl-systemd-check | wizard.wsl.step.systemdCheck.label | wizard.wsl.step.systemdCheck.description | wizard.wsl.group.detection | false |
| install-server-bundle | wizard.wsl.step.installBundle.label | wizard.wsl.step.installBundle.description | wizard.wsl.group.deployment | false |
| write-systemd-unit | wizard.wsl.step.writeSystemdUnit.label | wizard.wsl.step.writeSystemdUnit.description | wizard.wsl.group.deployment | false |
| fetch-fingerprint | wizard.wsl.step.fetchFingerprint.label | wizard.wsl.step.fetchFingerprint.description | wizard.wsl.group.verification | false |
| connect-test | wizard.wsl.step.connectTest.label | wizard.wsl.step.connectTest.description | wizard.wsl.group.verification | false |
| write-profile | wizard.wsl.step.writeProfile.label | wizard.wsl.step.writeProfile.description | wizard.wsl.group.finalization | false |
| done | wizard.wsl.step.done.label | wizard.wsl.step.done.description | wizard.wsl.group.finalization | false |

#### Docker flow (`src/components/setup-wizard/steps/docker/`，9 steps)

類似結構，groupKey 同 4 大區段（detection / deployment / verification / finalization）。`editableFromFailure: true` 的 step：`pick-container`、`configure-mounts`。

#### SSH flow (`src/components/setup-wizard/steps/ssh/`，8 steps)

`editableFromFailure: true`：`configure-host`。

### Step 3：補 i18n keys

每個 step 至少 2 個 key（label + description），3 wizard 共 ~52 個 step → **~104 個 step keys** + 4 個 group keys × 3 wizard = ~12 group keys + 大約 6 個動作按鈕 keys（重試/跳過/編輯設定/取消等）。

**簡化策略**：group keys 跨 wizard 共用（`wizard.group.connection` / `wizard.group.deployment` / `wizard.group.verification` / `wizard.group.finalization`），降至 ~16 個 keys 共用。

語系：en + zh-TW + zh-CN（沿用既有 i18n 檔結構）。

### Step 4：實作 SetupWizardShell 兩欄式 layout

```
┌─ Setup Wizard: Add SSH Profile ─────────────────────────────────────┐
│ ┌──────────────────────┬───────────────────────────────────────────┐│
│ │ 連線設定              │  目前步驟：驗證主機連線                    ││
│ │ ✓ 設定主機資訊        │                                           ││
│ │ ▶ 驗證主機連線        │  正在透過 SSH 連到 user@host:22 ...       ││
│ │ 安裝部署              │  └─ ✓ 認證成功                            ││
│ │ ○ 安裝 BAT 伺服器     │  └─ ⏳ 偵測 OS（執行 uname -sr）          ││
│ │ ○ 啟動伺服器服務      │                                           ││
│ │ 驗證測試              │                                           ││
│ │ ○ 取得連線指紋        │  [取消]                                    ││
│ │ ○ 連線測試            │                                           ││
│ │ 收尾                  │                                           ││
│ │ ○ 寫入設定檔          │                                           ││
│ │ ○ 完成               │                                           ││
│ └──────────────────────┴───────────────────────────────────────────┘│
│ 進度：3 / 8 ████████░░░░░░░░░░░░░░ 38%                              │
└──────────────────────────────────────────────────────────────────────┘
```

#### 結構重點

- 左欄：`<Stepper orientation="vertical" steps={...} groupingMode="none" clickableSteps="completed" onStepClick={handleStepClick}>`
  - `groupLabel` 渲染為左欄 section header（「連線設定」/「安裝部署」/「驗證測試」/「收尾」）
  - 已完成的 step 可點 → 切換右欄到 read-only 檢視
- 右欄：`<StepDetailPanel currentStep={...} runner={...} />`
  - 顯示當前 step 的進度、互動內容、子任務 progress、錯誤詳情
  - **不再渲染 step.id**（從現有 SetupWizardShell.tsx 行 174 移除）
- 底部：保留進度條 + N/M 計數

#### 失敗 step 的 actions slot

```tsx
<Stepper
  orientation="vertical"
  ...
  renderFailedActions={(step, idx) => (
    <div className="bat-stepper-failed-actions">
      <button onClick={() => runner.retry(idx)}>{t('wizard.action.retry')}</button>
      {step.retryable !== false && (
        <button onClick={() => runner.skip(idx)}>{t('wizard.action.skip')}</button>
      )}
      {step.editableFromFailure && (
        <button onClick={() => runner.jumpToStep(findEditableStep(idx))}>
          {t('wizard.action.editConfig')}
        </button>
      )}
      <button onClick={() => runner.cancel()}>{t('wizard.action.cancel')}</button>
    </div>
  )}
/>
```

### Step 5：wizard-runner 加 jumpToStep API

```ts
class WizardRunner {
  // 既有: run() / retry() / skip() / cancel() / rollback()

  // 新增（本工單）
  jumpToStep(targetIndex: number): Promise<void> {
    // 跳回前一個 editableFromFailure step
    // 1. rollback 從當前到 targetIndex 之間所有已完成 step（reverse order）
    // 2. 重新從 targetIndex 開始 run
    // 3. 回報：跳轉成功 / 失敗（rollback 失敗）
  }
}
```

> 若 jumpToStep 邏輯複雜（rollback chain 風險高），可標記 `// TODO: jumpToStep with full rollback chain (basic version landed)` 並先交付「直接跳轉不 rollback 中間 step」版本。但 prop 與 type 必須完整。

### Step 6：read-only 檢視已完成 step

`onStepClick` 觸發時 → 不影響 runner 進度，只切換右欄為 read-only mode：
- 顯示該 step 收集的資料（從 runner snapshot 或 user input cache）
- 顯示「[返回當前步驟]」按鈕回到 active step

### Step 7：vite.config.ts manualChunks 切分（PLAN-029 R5 合併）

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // ... existing chunks
        'setup-wizard': [
          './src/components/setup-wizard/SetupWizardShell.tsx',
          './src/components/setup-wizard/wizard-runner.ts',
          './src/components/setup-wizard/wsl-flow.ts',
          './src/components/setup-wizard/docker-flow.ts',
          './src/components/setup-wizard/ssh-flow.ts',
          // steps 子目錄整批
        ],
      },
    },
  },
},
```

> 確保 setup-wizard chunk 獨立打包，避免 wizard regression 影響整個 launch（PLAN-029 R5 主旨）。

### Step 8：unit tests

至少覆蓋：
- SetupWizardShell 渲染兩欄式 layout（左欄 stepper + 右欄 detail panel）
- step.id **不渲染**到 UI（grep snapshot 確認沒有 `configure-ssh-host` 等技術 ID）
- groupLabel 渲染 section header（4 個 group）
- 失敗 step 的 actions slot 正確渲染（retry / skip / editConfig / cancel）
- read-only 檢視已完成 step 切換
- jumpToStep API 行為（基本版即可，full rollback chain 可 deferred）
- 進度計算正確（completed / total）

預期 ≥15 個 test cases。

### Step 9：3 wizard 整合驗證

- WSL wizard：跑通 9 步，確認左欄 stepper、右欄 detail、4 group header 都正確
- Docker wizard：同上，9 步
- SSH wizard：同上，8 步

> dev 環境跑不起來時，至少跑 unit test 確保渲染邏輯通；像素級回歸 deferred 到使用者實機驗收（同 T0308 模式）。

### Step 10：清理

- 移除 SetupWizardShell.tsx 行 174 的 `<div className="...uppercase tracking-wide text-neutral-500">{step.id}</div>`
- 移除其他 step.id 直接渲染處
- 確認沒有死碼

## 完成定義（DOD）

- [ ] `WizardStepSnapshot` 擴充 4 個新欄位（labelKey/descriptionKey/groupKey/editableFromFailure）
- [ ] 3 wizard 全部 step 補完元資料（WSL 9 / Docker 9 / SSH 8 = 26 steps）
- [ ] i18n keys 補完（en + zh-TW + zh-CN，~16 共用 group keys + ~52 step labels + ~52 descriptions + ~6 actions）
- [ ] SetupWizardShell 兩欄式 layout 實作完成
- [ ] step.id **不再渲染**到 UI
- [ ] groupLabel section header 4 個區段正確渲染
- [ ] 失敗 step actions slot（retry/skip/editConfig/cancel）正確渲染
- [ ] read-only 檢視已完成 step 切換正確
- [ ] wizard-runner.jumpToStep API 至少基本版（full rollback chain 可 deferred）
- [ ] vite.config.ts manualChunks setup-wizard chunk 切分（PLAN-029 R5 合併）
- [ ] Unit tests ≥15 cases 全綠
- [ ] `npm run test:unit` ✅ 全綠（含 T0307 18 + T0308 13 + 本工單 15+ ≥ 46 cases）
- [ ] `npx tsc --noEmit` ✅ baseline 不增加新錯誤
- [ ] `npx vite build` ✅ 通過 + setup-wizard chunk 獨立確認（grep dist/）
- [ ] 像素級回歸 deferred 到實機驗收（如 T0308 模式可接受）
- [ ] git commit message 含 `relates PLAN-030 / PLAN-029 R5 / T0309`

## 不在範圍

- 不改 Stepper 元件本身（T0307 完成）
- 不改 BugWorkflowIndicator（T0308 完成）
- 不寫設計規範文件（T0310 處理）
- 不重新設計 wizard 後端 step 邏輯（純前端 UI）
- 不處理 i18n 字串實際翻譯品質（technical key 對齊正確即可，文案使用者後續 polish）
- 跨平台適配（暫只考慮 Electron desktop）

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`feat(wizard): T0309 setup wizard vertical stepper redesign + chunk split — relates PLAN-030 / PLAN-029 R5`）
2. 在工單檔尾追加 Worker 回報區（含實作摘要、commit hash、tests 結果、3 wizard 元資料補齊狀態、jumpToStep 是否 deferred）
3. **回報字串嚴格符合斷點 A regex**：`T0309 完成` / `T0309 部分完成` / `T0309 失敗` / `T0309 需要協助`

## 警語

本工單為 PLAN-030 大宗交付，影響面大：
- 3 個 wizard 同時改
- 大量 i18n keys
- wizard-runner API 擴充
- vite.config 變更

預期可能 PARTIAL（如 jumpToStep full rollback / 像素級回歸 deferred），但**主功能必須交付**：
- step.id 全面隱藏 ✅
- groupLabel 4 區段渲染 ✅
- vertical stepper 套用 ✅
- 失敗 actions slot 至少 retry + cancel ✅

可 deferred：
- jumpToStep full rollback chain
- read-only 檢視（基本版即可）
- 像素級回歸（snapshot tests 即足夠長期防護）
