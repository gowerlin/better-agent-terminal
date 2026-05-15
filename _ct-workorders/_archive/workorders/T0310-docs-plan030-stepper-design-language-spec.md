---
schema_version: 1
schema_kind: workorder
id: T0310
title: "Docs：PLAN-030 #5 BAT UI Stepper 設計規範文件"
type: docs
status: DONE
sizing: S
started_at: "2026-04-27T00:01:00+08:00"
completed_at: "2026-04-27T00:04:00+08:00"
renew_count: 0
---
# T0310 — Docs：PLAN-030 #5 BAT UI Stepper 設計規範文件

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0310 |
| 類型 | docs |
| 優先級 | 🟢 Low（PLAN-030 收尾，非阻擋） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 00:01 (UTC+8) |
| 完成時間 | 2026-04-27 00:04 (UTC+8) |
| 預估規模 | S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-26 23:?? (UTC+8) |
| 報告者 | 塔台（PLAN-030 Phase C #5） |
| 關聯 PLAN | PLAN-030（最後一張，落地後 PLAN-030 → DONE） |
| 前置工單 | T0307 / T0307b / T0308 / T0309（皆 DONE） |
| Renew 次數 | 0 |
| 影響範圍 | 新增 `docs/design/bat-stepper-design-language.md` 一份；不改程式碼；可選地補 fieldguide design 子命令的萃取 hook |

## 背景

T0305 Phase B4 規劃了「BAT UI Stepper 視覺語言」spec 草稿，內容已包含元件 API、狀態-視覺對應表、訊息層級規範、ID 隱藏原則、適用情境清單、Don't 反例、未來擴充點。

PLAN-030 前 4 張工單已全部交付：
- T0307：`<Stepper>` 共用元件（horizontal + vertical + status preset + a11y + grouping）
- T0307b：vitest infra
- T0308：BugWorkflowIndicator 內化（horizontal stepper 套用案例）
- T0309：Setup Wizard 重設計（vertical stepper + 4 groupLabel + 失敗 actions slot + jumpToStep + manualChunks）

**本工單將 T0305 Phase B4 草稿擴寫為完整 spec，作為未來新增 stepper 套用情境的權威參考。**

## 任務

### Step 1：建立目錄與檔案

```
docs/
└── design/
    └── bat-stepper-design-language.md   ← 新增
```

如 `docs/design/` 不存在則建立。

### Step 2：寫完整 spec

依 T0305 Phase B4 大綱擴寫，至少含 8 章節：

#### 1. 總覽

- Stepper 是 BAT 流程展示與互動的統一視覺語言
- 採用情境：BUG status、Setup Wizard、未來新流程
- 設計目標：一致性、可擴充性、a11y、語意/視覺分離

#### 2. 元件 API

從 `src/components/stepper/types.ts` 完整拷貝最新 schema（T0307 落地版本）：
- `StepperOrientation`
- `StepStatus`（6 個值）
- `StepDescriptor`
- `StepperProps`

每個 prop 加 JSDoc 風格說明（type / 用途 / 預設值 / 範例）。

#### 3. 狀態-視覺對應表

完整表格（T0307 status-preset.ts 落地版本）：

| Status | Icon | 配色 (hex) | 視覺處理 | 使用情境 |
|--------|------|-----------|---------|---------|
| pending | `○` | `#71717a` | opacity 0.4 | 未到的 step |
| running | `🔄` | `#f59e0b` | pulse 光暈 | 進行中的 step |
| completed | `✓` | `#10b981` | opacity 0.8 | 已完成的 step |
| failed | `✗` | `#ef4444` | 錯誤訊息展開 | 失敗的 step |
| skipped | `⏭` | `#f59e0b` | dashed border | 使用者主動跳過 |
| rolled-back | `↩` | `#71717a` | line-through | 已回滾的 step |

#### 4. 訊息層級規範

| Level | 名稱 | 用途 | 範例 |
|-------|------|------|------|
| L1 | label | 人話標題 | 「設定主機資訊」 |
| L2 | description | 補充說明 | 「指定 SSH 主機、port、認證方式」 |
| L3 | status | 純視覺（icon + 配色） | （無文字） |
| L4 | errorMessage | 失敗時才出現 | 「ssh: connect to host failed」 |
| L5 | actions | 動作按鈕 slot | Retry / Skip / Edit / Cancel |

#### 5. ID 隱藏原則

- 內部 step ID（kebab-case 技術名稱）**永遠不渲染到 UI**
- DOM 層可用 `data-step-id` 給測試（`data-testid` 仍合法）
- 使用者面 100% 走 i18n key + 人話 label

實例：T0309 Setup Wizard 已全面執行（移除原 `text-xs uppercase` div）。

#### 6. 適用情境清單

- ✅ 已套用：
  - BUG status indicator（horizontal，T0308 落地）
  - Setup Wizard（vertical 4 group，T0309 落地，3 wizard 全套用）
- 🔮 未來預期：
  - Profile bind 流程（PLAN-030 衍生）
  - GPU Whisper setup
  - 第一次啟動 onboarding
  - PLAN-007 後續 remote profile 認證流程
  - 多階段 release / migration 流程

#### 7. Don't 反例

- ❌ 不在 step label 出現英數技術 ID
- ❌ 不混用 stepper 與 progressbar 重複表達同件事（兩擇一）
- ❌ 8+ steps 不用 horizontal（除非有 grouping 壓縮）
- ❌ 失敗 step 不單純標紅就完事，必須附 actionable recovery
- ❌ 不在 stepper 外另畫 status badge / icon 重複表達狀態
- ❌ 不在 vertical stepper 內 nest horizontal stepper（採子任務 progress 列代替）

#### 8. 未來擴充點

- **Animation**：採 framer-motion 還是 CSS-only？目前 CSS-only（與既有 ct-workflow-* 一致）。引入 motion lib 需另開工單評估。
- **Dark/Light theme**：依 CSS var，不寫死色碼。當 design token 體系建立後遷移（拍板 5 暫沿用既有 hex）。
- **i18n**：所有 label/description/group/error message 走 i18n key（T0309 已示範）。
- **Compress mode**：horizontal pill + tooltip 完整實作 deferred（T0307 留 prop 與 type，未實作邏輯）。
- **Skip group**：未來如某 group 整段不適用（例如進階模式），整段 skip 視覺如何呈現？目前無此需求。

#### 附錄 A：參考實作清單

| 用途 | 元件路徑 |
|------|---------|
| 共用元件 | `src/components/stepper/Stepper.tsx` |
| Types | `src/components/stepper/types.ts` |
| Status preset | `src/components/stepper/status-preset.ts` |
| BUG status 套用 | `src/components/BugWorkflowIndicator.tsx` |
| Setup Wizard 套用 | `src/components/setup-wizard/SetupWizardShell.tsx` |
| Wizard runner（jumpToStep API） | `src/components/setup-wizard/wizard-runner.ts` |
| CSS 樣式 | `src/styles/stepper.css` |

#### 附錄 B：FAQ

- **Q: 何時用 horizontal vs vertical？**
  - A: ≤5 步且純展示用 horizontal；6+ 步或需要 group/錯誤詳情用 vertical。
- **Q: 何時可點 step 跳轉？**
  - A: 已完成的 step 可切 read-only 檢視（onStepClick + clickableSteps="completed"）；失敗時透過 editConfig action 跳回前一個 editableFromFailure step。
- **Q: 自訂 icon 何時用？**
  - A: 預設 status icon 不夠表意時（如 BUG status 自訂 📋⏳🔔🔔✅）。
- **Q: classNamePrefix 何時改？**
  - A: 與既有舊 CSS 整合時（如 BugWorkflowIndicator 用 `classNamePrefix="ct-workflow"` 吃既有 `.ct-workflow-*` rule），其他情境用預設 `bat-stepper`。

### Step 3：補 README index（可選）

如 `docs/README.md` 或 `docs/index.md` 存在，加一行：

```markdown
- [BAT UI Stepper Design Language](design/bat-stepper-design-language.md) — Stepper 元件視覺語言、狀態對應、套用範例
```

### Step 4：補 fieldguide design 子命令 hook（可選）

如 BAT 有 `*fieldguide design` 子命令，記錄此 spec 為來源之一。如無此功能略過。

> 此步可標記「deferred 至 fieldguide 子命令實作後處理」，不影響本工單完成。

## 完成定義（DOD）

- [ ] `docs/design/bat-stepper-design-language.md` 完整建立（≥1 頁，8 章節 + 2 附錄）
- [ ] 元件 API 從 `src/components/stepper/types.ts` 同步最新版本
- [ ] 狀態-視覺對應表從 `src/components/stepper/status-preset.ts` 同步最新版本
- [ ] 8 章節內容齊全（總覽 / API / 狀態視覺 / 訊息層級 / ID隱藏 / 適用情境 / Don't反例 / 未來擴充）
- [ ] 2 附錄齊全（參考實作清單 / FAQ）
- [ ] 文件不引用未來才會實作的 API（避免假訊息）
- [ ] git commit message 含 `relates PLAN-030 / T0310`

## 不在範圍

- 不改程式碼
- 不改既有 docs 結構（純新增一份檔案）
- 不寫 changelog 或 release notes
- 不寫 fieldguide design 子命令本體（如該功能存在僅補 hook，不存在則跳過）

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`docs(design): T0310 add BAT UI Stepper design language spec — relates PLAN-030`）
2. 在工單檔尾追加 Worker 回報區（含交付摘要、commit hash、文件行數、章節 / 附錄 / 程式碼引用對照）
3. **回報字串嚴格符合斷點 A regex**：`T0310 完成` / `T0310 部分完成` / `T0310 失敗` / `T0310 需要協助`

## 完成後

T0310 是 PLAN-030 最後一張工單。Worker 完成後塔台會：
- T0310 → DONE
- PLAN-030 → DONE（`Active → Completed`）
- PLAN-029（如僅剩 R5 未做且已合併到 T0309）→ 評估是否 DONE
- 等使用者實機驗收 BUG-070 + 整套 UI 後 → BUG-070 → CLOSED

YOLO 鏈式至此自然停止（無下一張工單）。

---

## Worker 回報區

### 完成狀態
DONE

### 開始 / 完成時間
- 開始：2026-04-27 00:01 (UTC+8)
- 完成：2026-04-27 00:04 (UTC+8)

### 交付摘要
- 新增 `docs/design/bat-stepper-design-language.md`（313 行，8 章節 + 2 附錄）
- 元件 API 與狀態-視覺對應表直接從 `src/components/stepper/types.ts` + `status-preset.ts` 同步（T0307 落地版本）
- ID 隱藏原則引用 T0309 實作；BUG status 套用引用 T0308；Setup Wizard 套用引用 T0309
- 不改任何程式碼，純新增 docs 一份
- `docs/design/` 為新建目錄

### 章節 / 程式碼引用對照

| 章節 | 引用程式碼 |
|------|-----------|
| 2. 元件 API | `src/components/stepper/types.ts`（StepperOrientation / StepStatus / StepDescriptor / StepperProps）|
| 3. 狀態-視覺對應表 | `src/components/stepper/status-preset.ts`（STATUS_PRESET / SEVERITY_ORDER / worstStatus）|
| 5. ID 隱藏原則 | `src/components/setup-wizard/SetupWizardShell.tsx`（T0309 移除 `text-xs uppercase`）|
| 6. 適用情境 — BUG | `src/components/BugWorkflowIndicator.tsx`（T0308 horizontal）|
| 6. 適用情境 — Wizard | `src/components/setup-wizard/SetupWizardShell.tsx`（T0309 vertical 4 group）|
| 8. i18n 範例 | `src/locales/{en,zh-TW,zh-CN}.json` 的 `wizard.*.steps.*` keys |
| 附錄 A | `wizard-runner.ts` (jumpToStep)、`stepper.css` |

### Step 3 / 4 可選步驟
- Step 3（README index）：`docs/README.md` / `docs/index.md` 不存在，跳過
- Step 4（fieldguide design 子命令 hook）：BAT 無此子命令，標記 deferred 不影響本工單完成

### 不在範圍 / 已遵守
- ✅ 不改程式碼
- ✅ 不改既有 docs 結構
- ✅ 不寫 changelog
- ✅ 不寫 fieldguide 子命令本體

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### Commit hash
`6169ca9` — `docs(design): T0310 add BAT UI Stepper design language spec — relates PLAN-030`
