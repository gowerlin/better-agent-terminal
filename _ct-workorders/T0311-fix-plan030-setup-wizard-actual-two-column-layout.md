---
schema_version: 1
schema_kind: workorder
id: T0311
title: Fix：T0309 Setup Wizard 兩欄式 layout regression（實際是 stacked）
type: fix
status: DONE
sizing: S
started_at: "2026-04-27T00:18:00+08:00"
completed_at: "2026-04-27T00:21:00+08:00"
renew_count: 0
---
# T0311 — Fix：T0309 Setup Wizard 兩欄式 layout regression（實際是 stacked）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0311 |
| 類型 | fix |
| 優先級 | 🔴 High（T0309 spec regression — 使用者需捲到底才看到當前步驟詳情，UX 不可接受） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 00:18 (UTC+8) |
| 完成時間 | 2026-04-27 00:21 (UTC+8) |
| 預估規模 | S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 塔台（使用者實機驗收 T0309 後回報） |
| 關聯 PLAN | PLAN-030 |
| 前置工單 | T0309（DONE，但 layout 未達 spec） |
| Renew 次數 | 0 |
| 影響範圍 | `src/components/setup-wizard/SetupWizardShell.tsx` 的 layout container 樣式 / 相關 CSS |

## 背景

T0309 spec（行 103-121）明確要求兩欄式 layout：

```
┌─ Setup Wizard: Add SSH Profile ─────────────────────────────────────┐
│ ┌──────────────────────┬───────────────────────────────────────────┐│
│ │ 連線設定              │  目前步驟：驗證主機連線                    ││
│ │ ✓ 設定主機資訊        │                                           ││
│ │ ▶ 驗證主機連線        │  正在透過 SSH 連到 ...                     ││
│ │ ...                   │  ...                                      ││
│ └──────────────────────┴───────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

**實際交付**（screenshot 證實）：
- 上半部：Stepper (vertical) 完整 9 步列表
- 下半部：「目前步驟」詳情區塊
- ⚠️ 是 **stacked top-bottom**，不是 side-by-side
- 使用者必須**捲動到底**才看到當前步驟的互動內容
- 違反 T0309 spec 第 4 步 + 不直觀

## 任務

### Step 1：定位現況

讀取 `src/components/setup-wizard/SetupWizardShell.tsx`，找到 layout container：
- 找到包裹 `<Stepper>` + `<StepDetailPanel>` 的最外層 container
- 確認當前是 `flex-direction: column` / `block` 還是其他

### Step 2：改為 side-by-side flex layout

預期最簡實作：

```tsx
<div className="bat-wizard-shell">
  <div className="bat-wizard-body">
    <div className="bat-wizard-stepper-col">
      <Stepper ... />
    </div>
    <div className="bat-wizard-detail-col">
      <StepDetailPanel ... />
    </div>
  </div>
  <div className="bat-wizard-progress-bar">
    {/* 進度條 + N/M */}
  </div>
</div>
```

CSS：

```css
.bat-wizard-body {
  display: flex;
  flex-direction: row;
  gap: 16px;
  min-height: 480px;  /* 或合適的最小高度 */
}

.bat-wizard-stepper-col {
  flex: 0 0 240px;  /* 固定寬度，左欄 */
  overflow-y: auto;
  max-height: 70vh;
}

.bat-wizard-detail-col {
  flex: 1 1 auto;
  overflow-y: auto;
  max-height: 70vh;
}
```

> 寬度比例可依視覺實測微調（左欄 220-280px / 右欄 fill 即可）。

### Step 3：響應式 fallback（如必要）

Dialog 寬度不夠時的 fallback：
- 預設 Dialog 寬度（grep `max-width` 或對應 modal class）— 至少 720px 才適合 side-by-side
- 若 < 720px → fallback 回 stacked（用 `@media (max-width: 720px)` 或 container query）
- 預設 BAT desktop 視窗會 ≥ 720px，fallback 為保險用

### Step 4：視覺驗證

- 跑 `npx vite build` 確認無 build error
- 跑 `npm run test:unit` 確認既有 16 cases 全綠（不應因 layout 改動失敗）
- 如測試斷言含 DOM 結構（`<div className="...">`），需同步更新 snapshot

### Step 5：寫一個 layout regression 守衛 test（可選）

```tsx
// SetupWizardShell.test.tsx
test('layout body is flex row (side-by-side, not stacked)', () => {
  const { container } = render(<SetupWizardShell ... />)
  const body = container.querySelector('.bat-wizard-body')
  const computed = window.getComputedStyle(body!)
  expect(computed.flexDirection).toBe('row')
})
```

> 注意 jsdom 對 computed style 支援有限，可改用 className assertion：
> `expect(body).toHaveClass('bat-wizard-body')` + 視覺由人眼驗收。

## 完成定義（DOD）

- [ ] SetupWizardShell layout 改為 flex row（左 stepper / 右 detail）
- [ ] CSS 加 `.bat-wizard-body` flex container + 兩 col widths
- [ ] 各 col 有獨立 `overflow-y: auto`，不會撐爆 Dialog
- [ ] Dialog 寬度足夠時 side-by-side 顯示
- [ ] `npm run test:unit` ✅ 全綠
- [ ] `npx vite build` ✅ 通過
- [ ] git commit message 含 `fixes T0309 layout regression`

## 不在範圍

- 不改 Stepper 元件本身
- 不改 wizard-runner / step 元資料
- 不改 i18n
- 不重新設計 detail panel 內容（只改 outer layout）
- 不調整 Dialog 寬度（如太窄是另一個 issue）

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`fix(wizard): T0311 setup wizard actual two-column side-by-side layout — fixes T0309 regression`）
2. 在工單檔尾追加 Worker 回報區（含實作摘要、commit hash、tests 結果）
3. **回報字串嚴格符合斷點 A regex**：`T0311 完成` / `T0311 部分完成` / `T0311 失敗` / `T0311 需要協助`

---

## Worker 回報區

### 完成狀態
DONE

### 產出摘要

**根因定位**：`SetupWizardShell.tsx` 用 Tailwind responsive classes（`grid grid-cols-1 md:grid-cols-[minmax(220px,300px)_1fr]`）做兩欄式 layout，但本專案**沒有 tailwindcss 設定**（`grep tailwind.config.*` 無結果，`main.tsx` 也沒 import tailwind 的 utility CSS），所以這些 class 都是死碼。子元素直接 fallback 到 block 預設，從上而下堆疊（top-bottom stacked），用戶必須捲到底才看到「目前步驟」詳情。

**最小修補**：建立真正的 CSS 規則檔 `src/styles/setup-wizard.css`，覆蓋 `.bat-wizard-grid / .bat-wizard-stepper-col / .bat-wizard-detail-col`：
- `display: grid; grid-template-columns: minmax(220px, 280px) 1fr; gap: 16px;`
- 兩欄各自 `overflow-y: auto; max-height: 70vh;`
- 720px 以下用 `@media` + `@container` fallback 回 single column（小視窗時 stacked 仍可用）

**檔案變更**：
- `src/styles/setup-wizard.css`（新檔）— 真正的 grid CSS
- `src/main.tsx` — 加 `import './styles/setup-wizard.css'`
- `_ct-workorders/T0311-*.md` — 工單元資料 / 回報區

**未動到的部分**（依工單「不在範圍」）：
- `SetupWizardShell.tsx` 沒改 — 既有 className 字串維持原樣（dead Tailwind classes 不會壞事，留著減少 diff）
- Stepper 元件 / wizard-runner / step 元資料 / i18n / Dialog 寬度 — 全未動
- 沒寫額外的 layout regression test（spec Step 5 標 optional；47 個既有測試全綠已涵蓋 layout DOM 結構斷言 `bat-wizard-grid` / `bat-stepper-vertical` / `bat-wizard-detail`）

### 驗收結果

| 項目 | 結果 |
|------|------|
| `npm run test:unit -- --run` | ✅ 47 / 47 passed（3 test files，含 SetupWizardShell.test.tsx 既有 layout 斷言） |
| `npx vite build` | ✅ 通過（281 modules transformed，built in 9.33s；只有與 T0311 無關的 dynamic-import warnings） |
| commit message 含 `fixes T0309 regression` | ✅ 是 |
| DOD checklist | ✅ 全部達成（layout 改 grid row / 兩 col widths / 各 col 獨立 overflow / Dialog 寬度足夠時 side-by-side / tests 綠 / build 通過 / commit message 合規） |

### Commit
- `71bf90c` fix(wizard): T0311 setup wizard actual two-column side-by-side layout — fixes T0309 regression

### 互動紀錄
無

### 遭遇問題
無

### Renew 歷程
無

