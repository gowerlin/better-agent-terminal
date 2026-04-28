---
schema_version: 1
schema_kind: workorder
id: T0305
title: Research：PLAN-030 Stepper 視覺語言 + ProfilePanel 群組化下拉 + Setup Wizard 重設計探索
type: research
status: DONE
sizing: M
started_at: "2026-04-26T22:25:00+08:00"
completed_at: "2026-04-26T22:29:00+08:00"
renew_count: 0
---
# T0305 — Research：PLAN-030 Stepper 視覺語言 + ProfilePanel 群組化下拉 + Setup Wizard 重設計探索

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0305 |
| 類型 | research |
| 優先級 | 🔴 High |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-26 22:25 (UTC+8) |
| 完成時間 | 2026-04-26 22:29 (UTC+8) |
| Commit | 8efd715 |
| 預估規模 | M-L（純設計探索 + spike 元件 API + 設計 mock，不含實作落地） |
| 互動模式 | interactive=true（research_max_questions: 3 — 設計取捨、視覺方向、API trade-off 可隨時跟使用者確認） |
| 建立時間 | 2026-04-26 22:?? (UTC+8) |
| 報告者 | 塔台（PLAN-030 衍生） |
| 關聯 PLAN | PLAN-030（本工單為 Phase A 設計探索，後續實作工單依本工單結論拆分） |
| 關聯 BUG | BUG-070（由 PLAN-030 → 本工單 R2 收斂） |
| Renew 次數 | 0 |
| 影響範圍 | 設計探索階段，預期不修改原始碼；產出為 spec/spike doc + 元件 API 草稿 |

## 背景

v0.4.1 release 後 dogfood 同時暴露兩個 UI 痛點 + 發現現有設計資產可複用：

1. **BUG-070**：ProfilePanel 工具列因 PLAN-007 Phase 2-4 累積 +WSL/+Docker/+SSH 三個 Add 按鈕後橫向溢出 Dialog 邊界，最右側按鈕完全無法觸及（Workaround: 無）
2. **Setup Wizard UX 痛點**：Step ID 直接外露給使用者（`configure-ssh-host` / `verify-ssh-auth` 等技術名稱）、失敗狀態散亂、缺進度視覺引導、訊息層級不清
3. **設計資產**：BUG Report 的 `BugWorkflowIndicator.tsx` 已實作成熟的 horizontal pill stepper（OPEN → FIXING → FIXED → VERIFY → CLOSED），可作為視覺語言基準

塔台拍板將 BUG-070 收斂進 PLAN-030，並用本研究工單先收斂設計方向，再拆實作工單。

## 任務範圍

本工單**只做設計探索 + spike**，不做實作落地。產出三份 spec/草稿讓塔台拍板，再拆實作工單。

### Phase A — 既有資產盤點

#### A1. BUG Report stepper 拆解

讀取並分析 `src/components/BugWorkflowIndicator.tsx`：
- 元件 props 介面、狀態映射、icon/label/配色策略
- CSS / styling 來源（CSS module / inline / styled-components / tailwind？）
- 動畫策略（如有）
- 可複用程度評估：直接 import 還是抽出共用元件？

#### A2. 「新增 Agent」群組化下拉拆解

定位 BAT 既有「新增 Agent」按鈕的下拉選單實作（截圖見 PLAN-030 / BUG-070 引用），分析：
- Dropdown 觸發機制（hover / click / portal 定位）
- 分類分隔線、suggested 標籤、icon 用法
- 可複用元件名稱與位置

#### A3. ProfilePanel 現況盤點

讀取 `src/components/ProfilePanel.tsx`：
- 工具列按鈕的渲染順序與條件（哪些按鈕固定顯示、哪些依 feature flag）
- 觸發 Setup Wizard 的入口點
- 現有 i18n / label 來源

#### A4. Setup Wizard 現況盤點

讀取 `src/components/setup-wizard/`：
- `SetupWizardShell.tsx` 整體 layout
- `wizard-runner.ts` 狀態機（pending / running / failed / completed 對應）
- `wsl-flow.ts` / `docker-flow.ts` / `ssh-flow.ts` 各自的 step list 與 step ID 命名
- 現有的 step 進度顯示邏輯（`0% complete` 怎麼算）

### Phase B — 設計探索與 spike

#### B1. 共用 Stepper 元件 API 草稿（R1）

設計 `<Stepper>` 元件 API，覆蓋三個使用情境：

| 情境 | 步數 | 走向 | 互動性 |
|------|------|------|--------|
| BUG status | 5 步固定 | horizontal | 唯讀（純顯示） |
| Setup Wizard | 動態 4-8 步 | horizontal? vertical? | 唯讀 + 失敗時可重試 |
| 未來流程 | 動態 | 兩種都可能 | 可能可點 step 跳轉檢視 |

待 Worker 提案：
- 是否抽單一元件覆蓋全部 vs 兩個元件（HorizontalStepper / VerticalStepper）？
- props schema 草稿（含狀態列舉、icon override、onClick 回退、自訂 footer 等）
- 對 6+ steps 的 horizontal layout 策略（壓縮 / wrap / 群組化？）
- 與現有 `BugWorkflowIndicator` 的關係（refactor 內化還是並存？）

**互動點**：若有 2-3 種設計取捨拿不定，請主動問使用者。

#### B2. ProfilePanel 群組化下拉設計（R2，收斂 BUG-070）

設計重構後的工具列佈局：

| 區塊 | 內容 | 理由 |
|------|------|------|
| 主工具列 | `儲存目前狀態` + `+ 本機` + `+ 遠端` + `+ ▼` | 主操作高頻，下拉收進階 |
| `+ ▼` 下拉 | WSL / Docker / SSH / 未來新增類型 | 隨擴充進來不撐爆工具列 |

待 Worker 提案：
- 下拉觸發按鈕的標籤：`+` / `+ 進階` / `+ 更多` / 圖示 only？
- 下拉內是否需要分區（容器類 / 遠端類 / 實驗類）？
- 是否套用「新增 Agent」既有下拉元件直接 reuse，還是另造？

**互動點**：標籤文字與分區策略可能影響使用者直覺，請和使用者確認 1-2 個方向。

#### B3. Setup Wizard 重設計（R3）

提案重設計後的 Wizard layout，至少涵蓋：

| 元素 | 改善方向 |
|------|---------|
| Step indicator | 套用 horizontal stepper（B1 元件）取代純垂直 list |
| Step label | 隱藏內部 ID（`configure-ssh-host` 等不外露），用人話描述 |
| 進度顯示 | stepper 高亮當前 step + 百分比進度條（取代 `0% complete` 純文字） |
| 失敗狀態 | 失敗 step 內展開錯誤詳情 + 重試 / 跳過 / 編輯設定按鈕，取代散亂訊息 |
| Step 群組化 | SSH 6 步可分「連線（1-2）」/「安裝（3-4）」/「驗證（5-6）」三大階段，stepper 顯示階段標題 |
| Wizard layout | 是否一頁顯示全部 step 還是當前 step 為主、已完成 step 摺疊？ |

待 Worker 提案：
- 6+ steps 的 horizontal stepper 視覺策略（壓縮 vs 群組化 vs vertical fallback）
- 失敗 step 恢復路徑（重試現步 / 跳過 / 編輯前面設定）的 UX
- step 是否允許使用者點選跳轉檢視已完成的設定（read-only）

**互動點**：UX 模式選擇對 SSH/Docker/WSL 三個現有 wizard 都有影響，請和使用者確認 1-2 個方向。

#### B4. 設計規範文件草稿（R4）

整理一份「BAT UI Stepper 視覺語言」spec 草稿，至少包含：
- Stepper 元件 API 文件（props、states、events）
- 狀態-視覺對應表（pending / running / completed / failed / skipped 等對應的 icon、配色、label）
- 訊息層級規範（標題 / 描述 / 狀態 / 錯誤訊息分層）
- ID 隱藏原則（內部 step ID 永不出現在 UI）
- 適用情境清單（BUG status / Setup Wizard / 未來：profile bind / GPU Whisper setup 等）

此文件未來 `*fieldguide design` 子命令可萃取，作為 BAT design system 的一塊。

### Phase C — 拆單建議

最後在工單回報區產出**拆單建議表**（PLAN-030 實作工單應如何切）：

| # | 工單目的 | 預估規模 | 依賴 | type |
|---|---------|---------|------|------|
| 1 | 共用 Stepper 元件抽出 + unit tests | ? | — | impl |
| 2 | ProfilePanel 群組化下拉（收斂 BUG-070） | ? | #1 | impl |
| 3 | Setup Wizard stepper 化（含 3 個 wizard 全部套用） | ? | #1 | impl |
| 4 | 設計規範文件 | ? | #1-3 | docs |

請 Worker 依研究結果填規模欄位、補充工單描述要點。

## 互動規則（research_interaction: true）

- Worker 在 **B1/B2/B3 三個設計取捨點** 各最多問 1 次（總計上限 3 個問題）
- 問題格式用選項式（`[A] / [B] / [C] 其他：____`）
- 若使用者回答後仍不確定，**先收斂到合理預設**並在工單回報註明「待進一步使用者確認」，不要無限發問

## 不在範圍

- 不寫元件實作（只做 API 草稿 + spike snippet）
- 不改原始檔（只讀 + 設計）
- 不做動畫細節（留給實作工單）
- 不處理跨平台適配（暫只考慮 Electron desktop）
- 不處理 i18n 字串（只標註需要翻譯的位置）

## 完成定義（DOD）

- [ ] Phase A 既有資產盤點完成（4 份檔案的關鍵資訊整理）
- [ ] Phase B1 共用 Stepper 元件 API 草稿（含三情境覆蓋分析）
- [ ] Phase B2 ProfilePanel 群組化下拉設計提案
- [ ] Phase B3 Setup Wizard 重設計提案
- [ ] Phase B4 設計規範文件草稿（≥1 頁，可後續 fieldguide design 萃取）
- [ ] Phase C 拆單建議表（4-6 張，含預估規模 S/M/L）
- [ ] 互動點 ≤3 次，每次選項式
- [ ] 工單回報區寫塔台拍板需要的最小決策清單

## 回報格式

回報時請在工單檔案末尾追加：

```markdown
---

## Worker 回報

### Phase A 既有資產盤點
<內容>

### Phase B1 共用 Stepper 元件 API 草稿
<內容>

### Phase B2 ProfilePanel 群組化下拉設計
<內容>

### Phase B3 Setup Wizard 重設計
<內容>

### Phase B4 設計規範文件草稿
<內容或檔案路徑>

### Phase C 拆單建議
<表格>

### 塔台拍板項
1. <需要塔台拍板的設計取捨 1>
2. ...

### 互動紀錄
<若有觸發互動，列出問了什麼、使用者怎麼回的>
```

---

## Worker 回報

### Phase A 既有資產盤點

#### A1. BugWorkflowIndicator 拆解（`src/components/BugWorkflowIndicator.tsx`，89 行）

| 項目 | 現況 |
|------|------|
| Props | `{ status: BugStatus, relatedWorkOrder?: string }` |
| 步數 | 5 步固定（OPEN → FIXING → FIXED → VERIFY → CLOSED）+ WONTFIX 分支 |
| 狀態映射 | `STATUS_GUIDANCE` Record 對應 `{icon, message, requiresAction}` |
| 視覺策略 | Horizontal pill stepper，每 step = 圓形 node + emoji icon + label，連接線 connector |
| Styling 來源 | `src/styles/control-tower.css` 行 827-980（17 個 `.ct-workflow-*` class） |
| 配色 | past=灰 50% / current=琥珀 (`#f59e0b` rgba 0.2 fill) / future=灰 35% / wontfix=紅 (`#ef4444`) |
| 動畫 | 無（純靜態 CSS） |
| 響應式 | `overflow-x: auto`（純橫向滾動，未做 wrap / 群組化） |
| 可複用度 | 中。耦合 `BugStatus` type、5 步陣列寫死、STATUS_GUIDANCE 寫死 |

**結論**：可作為視覺語言基準，但元件本身需重構成「顯示元件」不耦合 BugStatus。提議路徑：抽出底層 `<Stepper>` → BugWorkflowIndicator 變 thin wrapper。

#### A2. ThumbnailBar 「+」群組化下拉拆解（`src/components/ThumbnailBar.tsx` 行 218-336）

| 項目 | 現況 |
|------|------|
| 觸發 | `+` 按鈕 onClick → setState `showAddMenu` |
| 定位策略 | `createPortal(menu, document.body)` + 動態計算 `openUpward`（避免下方空間不足） |
| 點外關閉 | `mousedown` 全域監聽 + ref containment 檢查 |
| 子選單 | `has-submenu` class + hover 觸發 + `getSubmenuDirection()` 智能左右 |
| 分類視覺 | 無分區分隔線；用 `suggested` badge 標籤替代分區 |
| Icon 策略 | inline emoji + `style={{ color: def.color }}`，每項自帶顏色 |
| Class 命名 | `.thumbnail-add-menu` / `.thumbnail-add-menu-item` / `.thumbnail-add-menu-icon` / `.thumbnail-add-menu-suggested` |
| 動態化 | 從 `agentDefinitions` registry 渲染（向下相容 legacy 寫死選單） |

**結論**：成熟可複用。R2 ProfilePanel 群組化下拉**直接 reuse 此模式**，不需另造元件。需新增「分區分隔線」`.thumbnail-add-menu-divider` + 區段標題 `.thumbnail-add-menu-section-header`。

#### A3. ProfilePanel 現況盤點（`src/components/ProfilePanel.tsx`，740 行）

工具列按鈕（行 393-409，**5 顆固定按鈕**，造成 BUG-070 溢出）：

```
[儲存目前狀態] [+ 本機] [+ 遠端] [Add WSL Profile] [Add SSH Profile]
                                  ↑ 缺 Docker，PLAN-007 規劃中再 +1 就 4 個 wizard 按鈕
```

- Dialog `maxWidth: 520`（行 387），固定不可拉
- 沒有 overflow 處理（無 wrap、無滾動），按鈕橫向溢出 dialog 邊界
- Setup Wizard 入口：`wslWizard.open('')` / `sshWizard.open('')`
- i18n：`profiles.addLocal` / `profiles.addRemote`，wizard 按鈕用英文寫死（`Add WSL Profile` / `Add SSH Profile`）

#### A4. Setup Wizard 現況盤點（`src/components/setup-wizard/`）

**SetupWizardShell.tsx** (267 行)：
- Layout：`<header>` 標題 + 進度條（百分比文字 + 細條）+ `<ol>` 垂直 step list + 失敗時的 Retry/Skip/Cancel 按鈕區
- Step 渲染（行 164-181）：每行 `[icon] [title + ID + error] [status badge]` —— **step ID 直接外露**（行 174 `<div className="...uppercase tracking-wide text-neutral-500">{step.id}</div>`）
- 進度計算（行 148-149）：`completedCount / total * 100`
- 失敗處理：`currentFailedStep` 顯示在 Footer button 區，**訊息和 step 分離**（鬆散）
- Choice modal：sky 色塊內嵌，UX 尚可

**wizard-runner.ts** (268 行)：
- 狀態機：`Pending / Running / Succeeded / Failed / RolledBack`
- `WizardStepSnapshot { id, title, status, retryable, error?, skipped? }` —— **已有 skipped 欄位**，但 SetupWizardShell 渲染對 skipped 處理薄弱（只顯示「Skipped by user」文字）
- Rollback 機制完整（reverse order + per-step + completed-stack）
- 互動 hook：`requestChoice(WizardChoiceRequest)` 由 shell 注入 promise resolver

**Step 數**（實際比工單估的多）：

| Wizard | Steps | 數量 |
|--------|-------|------|
| WSL | detect-env / pick-distro / systemd-check / install-bundle / write-systemd / fetch-fp / connect-test / write-profile / done | **9** |
| Docker | detect-env / pick-container / configure-mounts / install-bundle / start-server / fetch-fp / connect-test / write-profile / done | **9** |
| SSH | configure-host / verify-auth / install-bundle / start-server / fetch-fp / connect-test / write-profile / done | **8** |

> ⚠️ 工單背景估「SSH 6 步」**低估** —— 實際 8 步，且 WSL/Docker 還更長 9 步。Horizontal stepper 顯示 8-9 步必擁擠，**強化 R3 採 vertical stepper 的決定**。

---

### Phase B1 共用 Stepper 元件 API 草稿（採 Q1.A 單一元件 + orientation prop）

#### Props schema

```ts
// src/components/stepper/Stepper.tsx
export type StepperOrientation = 'horizontal' | 'vertical'

export type StepStatus =
  | 'pending'    // 未到
  | 'running'   // 進行中（spinner / pulse）
  | 'completed' // 完成
  | 'failed'    // 失敗（紅）
  | 'skipped'   // 跳過（amber）
  | 'rolled-back' // 已回滾（灰刪除線）

export interface StepDescriptor {
  id: string                    // 內部 ID（不外露）
  label: string                 // 對使用者顯示的人話標題
  description?: string          // 副標 / 說明（vertical mode 顯示在右欄）
  icon?: string | React.ReactNode  // 預設依 status 由 STATUS_PRESET 決定
  status: StepStatus
  retryable?: boolean
  errorMessage?: string         // failed 時的錯誤詳情
  groupLabel?: string           // 群組化 pill 用（如「連線設定」），相同 groupLabel 連續 step 合併顯示
}

export interface StepperProps {
  steps: StepDescriptor[]
  currentIndex?: number          // 高亮 index（預設取第一個 running 或最後一個 completed+1）
  orientation?: StepperOrientation  // 預設 'horizontal'

  // 互動
  onStepClick?: (step: StepDescriptor, index: number) => void  // 可點 step 回退（read-only 檢視）
  clickableSteps?: 'completed' | 'all' | 'none'  // 預設 'completed'

  // failed step 動作 slot
  renderFailedActions?: (step: StepDescriptor, index: number) => React.ReactNode

  // 群組化 pill（Q3.A 風格，本工單採 vertical 不需要但留 API）
  groupingMode?: 'none' | 'compress'  // compress = 同 groupLabel pill 合併

  // a11y
  ariaLabel?: string

  // 自訂視覺
  classNamePrefix?: string  // 預設 'bat-stepper'，避免和 .ct-workflow-* 衝突
}
```

#### 三情境覆蓋分析

| 情境 | orientation | groupingMode | clickableSteps | 失敗 action |
|------|-------------|--------------|----------------|------------|
| BUG status (5 步) | horizontal | none | none | N/A（純展示） |
| Setup Wizard (8-9 步) | **vertical** | none | completed | renderFailedActions={Retry/Skip/Edit} |
| 未來 short flow (3-4 步) | horizontal | none | all | optional |

#### 與 BugWorkflowIndicator 關係

**Refactor 內化**：BugWorkflowIndicator 變成 5 行 wrapper：

```tsx
export function BugWorkflowIndicator({ status, relatedWorkOrder }: Props) {
  const steps = useMemo(() => buildStepsFromBugStatus(status), [status])
  return (
    <div className="ct-workflow-indicator">
      <Stepper steps={steps} orientation="horizontal" />
      <BugGuidanceBanner status={status} />  {/* 拆出原本的 guidance + meta */}
      {relatedWorkOrder && <BugMetaLink wo={relatedWorkOrder} />}
    </div>
  )
}
```

舊 `.ct-workflow-*` CSS **不刪**，留作 BUG indicator 的特化樣式（amber 色系），新 `.bat-stepper-*` 走中性色 + status-driven 配色。

#### 6+ steps horizontal 策略（雖採 vertical，留作 API）

`groupingMode="compress"` 時：
- 連續相同 `groupLabel` 的 step 合併成單一 pill，pill 內含 mini-dots 表示子 step 數
- 滑鼠 hover pill → tooltip 列出子 step 名稱
- pill 顏色 = 該群組的「最差狀態」（任一 failed 即紅、任一 running 即琥珀）

---

### Phase B2 ProfilePanel 群組化下拉設計（採 Q2.B 分區下拉）

#### 重構後工具列佈局

```
┌──────────────────────────────────────────────────────────────┐
│ [💾 儲存目前狀態]  [+ 本機]  [+ 遠端]  [+ 更多 ▼]              │
└──────────────────────────────────────────────────────────────┘
                                          ↓
                         ┌─────────────────────────────────┐
                         │ ─── 容器類 ─────────────────── │
                         │ 🐧 WSL Profile      suggested  │
                         │ 🐳 Docker Profile             │
                         │ ─── 遠端類 ─────────────────── │
                         │ 🔐 SSH Profile               │
                         │ ─── 未來擴充類 ──────────────── │
                         │  (Podman / K8s / VM 進來這裡)  │
                         └─────────────────────────────────┘
```

#### 元件複用：reuse `.thumbnail-add-menu` 模式

新增 2 個 class（其他全 reuse）：
- `.thumbnail-add-menu-section-header` — 區段標題（小型 uppercase 灰字 + 上下分隔線）
- `.thumbnail-add-menu-divider` — 純分隔線（不需標題的場景）

#### 元件草稿

```tsx
// src/components/profiles/AddProfileMenu.tsx
interface ProfileTypeOption {
  id: string
  label: string
  icon: string
  color: string
  section: 'container' | 'remote' | 'experimental'
  suggested?: boolean
  onClick: () => void
}

const SECTIONS: Array<{ id: ProfileTypeOption['section']; label: string }> = [
  { id: 'container',    label: '容器類' },
  { id: 'remote',       label: '遠端類' },
  { id: 'experimental', label: '實驗類' },
]

export function AddProfileMenu({ options, anchorRef }: Props) {
  // 複用 ThumbnailBar 的 portal + openUpward + outside-click 邏輯
  // 渲染依 SECTIONS 順序分組
}
```

#### 主工具列簡化

`ProfilePanel.tsx` 行 393-409 改為：

```tsx
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
  <button onClick={handleSaveCurrent}>{t('profiles.saveCurrent')}</button>
  <button onClick={() => setCreating('local')}>{t('profiles.addLocal')}</button>
  <button onClick={() => setCreating('remote')}>{t('profiles.addRemote')}</button>
  <AddProfileMenu options={[
    { id: 'wsl',    section: 'container', icon: '🐧', label: 'WSL Profile',    suggested: true,  onClick: () => wslWizard.open('') },
    { id: 'docker', section: 'container', icon: '🐳', label: 'Docker Profile',                    onClick: () => dockerWizard.open('') },
    { id: 'ssh',    section: 'remote',    icon: '🔐', label: 'SSH Profile',                       onClick: () => sshWizard.open('') },
  ]} />
</div>
```

工具列從 5 顆固定按鈕降到 4 顆，第 4 顆下拉收進階。BUG-070 直接收斂。i18n key 補：`profiles.addMore` / `profiles.section.container` / `profiles.section.remote` / `profiles.section.experimental`。

---

### Phase B3 Setup Wizard 重設計（採 Q3.C Vertical stepper + 右欄詳情）

#### 新 Wizard layout（兩欄式）

```
┌─ Setup Wizard: Add SSH Profile ─────────────────────────────────────┐
│ ┌──────────────────────┬───────────────────────────────────────────┐│
│ │ ✓ 設定主機資訊        │  目前步驟：驗證主機連線                    ││
│ │ ✓ 驗證主機連線        │                                           ││
│ │ ▶ 安裝 BAT 伺服器     │  正在透過 SSH 連到 user@host:22 ...       ││
│ │ ○ 啟動伺服器服務      │  └─ ✓ 認證成功                            ││
│ │ ○ 取得連線指紋        │  └─ ⏳ 偵測 OS（執行 uname -sr）          ││
│ │ ○ 連線測試            │                                           ││
│ │ ○ 寫入設定檔          │                                           ││
│ │ ○ 完成               │  [取消]                                    ││
│ └──────────────────────┴───────────────────────────────────────────┘│
│ 進度：3 / 8 ████████░░░░░░░░░░░░░░ 38%                              │
└──────────────────────────────────────────────────────────────────────┘
```

#### 改善點對應表

| 元素 | 改善 | 實作 |
|------|------|------|
| Step indicator | Vertical stepper 取代 `<ol>` 純列表 | `<Stepper orientation="vertical">` |
| Step label | 隱藏內部 ID（`configure-ssh-host` → `設定主機資訊`） | 在 step.ts 加 `label` 欄位（i18n key），SetupWizardShell **完全不渲染 `step.id`** |
| 進度顯示 | 保留底部進度條 + step indicator 高亮當前 | stepper 自帶 currentIndex |
| 失敗狀態 | 失敗 step 內展開錯誤詳情 + Retry / Skip / Edit 按鈕 | `renderFailedActions` slot |
| Step 群組化 | SSH 8 步分「連線設定 (1-2)」/「安裝部署 (3-4)」/「驗證測試 (5-6)」/「收尾 (7-8)」4 區段 | 加 `groupLabel` 欄位，vertical mode 渲染為左欄 section header |
| Wizard layout | 兩欄式：左欄 step list + 右欄當前 step 互動內容 | 新 `<WizardLayoutV2>` 包 `<Stepper vertical>` + `<StepDetailPanel>` |

#### Step 標籤對照（範例 SSH）

| 內部 ID（不外露） | 對外 label | groupLabel |
|------------------|-----------|------------|
| configure-ssh-host | 設定主機資訊 | 連線設定 |
| verify-ssh-auth | 驗證主機連線 | 連線設定 |
| install-server-bundle | 安裝 BAT 伺服器 | 安裝部署 |
| start-server | 啟動伺服器服務 | 安裝部署 |
| fetch-fingerprint | 取得連線指紋 | 驗證測試 |
| connect-test | 連線測試 | 驗證測試 |
| write-profile | 寫入設定檔 | 收尾 |
| done | 完成 | 收尾 |

i18n key 範例：`wizard.ssh.step.configureHost.label` / `wizard.ssh.step.configureHost.description` / `wizard.ssh.group.connection.label`。

#### 失敗 step 的恢復路徑

失敗時右欄展開：

```
❌ 安裝 BAT 伺服器  失敗

錯誤：ssh: connect to host failed: Connection refused

可選動作：
  [🔄 重試]   再次執行此步驟
  [⏭ 跳過]   略過此步繼續（後續可能失敗）
  [✏ 編輯設定]  回到「設定主機資訊」修改連線參數
  [✕ 取消]   放棄整個 Wizard
```

「編輯設定」按鈕 = 跳回前一個可編輯 step（從 step 元資料 `editableFromFailure: true` 判定）。實作上 `Stepper` 的 `onStepClick` + `clickableSteps="completed"` 已支援跳轉，wizard-runner 需新增 `jumpToStep(index)` API。

#### Read-only 檢視已完成 step

`clickableSteps="completed"` 讓使用者點已完成 step → 右欄切到 read-only 檢視（顯示該 step 收集的資料 / 寫入的設定），但不影響 runner 進度。

---

### Phase B4 設計規範文件草稿

> 完整文件擬寫至 `docs/design/bat-stepper-design-language.md`（本工單只出草稿大綱，實作工單寫完整檔案）

#### 大綱

1. **總覽**：Stepper 是 BAT 流程展示與互動的統一視覺語言
2. **元件 API**（B1 props schema 完整版 + TS 型別 + JSDoc）
3. **狀態-視覺對應表**：

   | Status | Icon | 配色（CSS var） | 視覺處理 |
   |--------|------|----------------|---------|
   | pending | `○` | `--color-text-tertiary` | 灰圈，opacity 0.4 |
   | running | `🔄`（旋轉動畫） | `--color-primary` | 琥珀填充 + pulse 光暈 |
   | completed | `✓` | `--color-success` | 綠填充，opacity 0.7 |
   | failed | `✗` | `--color-danger` | 紅填充 + 錯誤訊息展開 |
   | skipped | `⏭` | `--color-warning` | amber 邊框 + 「已跳過」標註 |
   | rolled-back | `↩` | `--color-text-tertiary` | 灰填充 + 刪除線 label |

4. **訊息層級規範**：
   - **L1 標題（label）**：人話描述步驟意圖（如「設定主機資訊」）
   - **L2 副標（description）**：補充說明（如「指定 SSH 主機、port、認證方式」）
   - **L3 狀態（status）**：純視覺（icon + 配色），不重複文字
   - **L4 錯誤（errorMessage）**：失敗時才出現，紅字單獨一段
   - **L5 動作按鈕（actions）**：Retry / Skip / Edit / Cancel，獨立 slot

5. **ID 隱藏原則**：
   - 內部 step ID（kebab-case 技術名稱）**永遠不渲染到 UI**
   - DOM 層可用 `data-step-id` 給測試使用（`data-testid` 仍合法）
   - 使用者面 100% 走 i18n key + 人話 label

6. **適用情境清單**：
   - 已套用：BUG status indicator（horizontal）、Setup Wizard（vertical, 此 PLAN 落地後）
   - 未來預期：profile bind 流程、GPU Whisper setup、第一次啟動 onboarding、PLAN-007 後續 remote profile 認證流程

7. **Don't 反例**：
   - ❌ 不在 step label 出現英數技術 ID
   - ❌ 不混用 stepper 與 progressbar 重複表達同件事（兩擇一）
   - ❌ 8+ steps 不用 horizontal（除非有 grouping 壓縮）
   - ❌ 失敗 step 不單純標紅就完事，必須附 actionable recovery

8. **未來擴充點**：
   - Animation：採 framer-motion 還是 CSS-only？暫定 CSS-only（與既有 ct-workflow- 一致），實作工單再評估
   - Dark/Light theme：依 `--bat-color-*` CSS var，不寫死色碼
   - i18n：所有 label/description/group/error message 走 i18n key

---

### Phase C 拆單建議

| # | 工單目的 | 預估規模 | 依賴 | type | 備註 |
|---|---------|---------|------|------|------|
| 1 | 共用 `<Stepper>` 元件抽出（Q1.A 單元件 + orientation prop）+ unit tests + Storybook（如有） | **M** | T0305 結論 | impl | 含 horizontal/vertical 兩 layout、status mapping、可選 grouping、a11y(role=list/aria-current)；不重構 BugWorkflowIndicator |
| 2 | BugWorkflowIndicator refactor 內化到 `<Stepper>` + 視覺回歸測試 | **S** | #1 | refactor | thin wrapper 化；確保 `.ct-workflow-*` 視覺與互動 100% 不變（截圖比對） |
| 3 | ProfilePanel 群組化下拉（`<AddProfileMenu>` reuse `.thumbnail-add-menu` 模式 + 新增分區 class）— **收斂 BUG-070** | **S-M** | — | impl | 不依賴 #1；可獨立先發；含 i18n key + Docker wizard 入口（PLAN-007 預留） |
| 4 | Setup Wizard vertical stepper 重設計（兩欄式 layout + step label i18n + 失敗 actions slot + group header） | **L** | #1 | impl | 大宗工作；3 個 wizard (WSL/Docker/SSH) 全套用；含 wizard-runner `jumpToStep` API；step ID 隱藏全面盤查 |
| 5 | 設計規範文件 `docs/design/bat-stepper-design-language.md` + 補充 fieldguide design 子命令的萃取 hook | **S** | #1, #2, #4 | docs | 完整版 B4 大綱；含截圖對照、Don't 反例、未來擴充 |
| 6 | （optional）整合 PLAN-029 R5 setup-wizard chunk 切分 | **S** | #4 | refactor | 兩工程互相影響，落地時序由塔台拍板 |

**總預估**：4 張主工單（#1-4）+ 1 docs（#5）+ 1 optional（#6）= 5-6 張，符合 PLAN-030 預期。

**建議落地順序**：
1. **先 #3**（獨立、收斂 BUG-070、立即見效，不卡 #1）
2. **再 #1 + #2 並行**（#1 是 #4 前置，#2 是 #1 完成驗證）
3. **後 #4**（最大宗，依 #1）
4. **最後 #5 + #6**

---

### 塔台拍板項

1. **拆單時序**：建議「先 #3 獨立衝刺收 BUG-070 → 再 #1+#2 並行 → #4 大宗 → #5+#6」，請塔台確認此 sequencing。
2. **#4 範圍是否切分**：Setup Wizard 重設計影響面大（3 個 wizard 全動），是否要再拆「stepper 元件套用」/「step label i18n 全面化」/「失敗 actions slot」三個子工單？目前估 L 維持單張較緊湊但風險集中。
3. **元件命名**：`<Stepper>` vs `<BatStepper>` vs `<WorkflowStepper>` —— 建議 `<Stepper>` 簡潔，CSS class 用 `.bat-stepper-*` prefix 避免衝突。請塔台確認命名慣例。
4. **PLAN-029 R5 整合**：#6 與 PLAN-029 setup-wizard chunk 切分有耦合，建議由塔台決定是合併到 #4 還是獨立工單。
5. **CSS 變數遷移**：B4 規範使用 `--bat-color-*` CSS var，若專案目前沒有 design token 體系，要先建立 token 檔還是直接用既有 hex？建議實作工單先沿用既有 hex，後續再開「design token 建立」工單統一治理。

### 互動紀錄

[22:25] Q: B1/B2/B3 三個設計取捨打包提問（Q1 元件粒度、Q2 下拉標籤+分區、Q3 8-step wizard 視覺）→ A: 全依塔台建議（Q1.A 單元件 + orientation prop / Q2.B `+ 更多` + 分區下拉 / Q3.C vertical stepper + 右欄詳情） → Action: 採用 3 個推薦方案進行 B1-B4 設計與 Phase C 拆單

### 回報時間
2026-04-26 22:29 (UTC+8)

### 完成狀態
DONE — Phase A 盤點 4 份 + Phase B1-B4 設計草稿 + Phase C 拆單建議 6 張全部交付。發現 SSH wizard 實際 8 步（工單估 6 步），WSL/Docker 各 9 步，已在 Phase A4 / Phase B3 標註並用以強化 vertical stepper 決策。

