# T0311 — Fix：T0309 Setup Wizard 兩欄式 layout regression（實際是 stacked）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0311 |
| 類型 | fix |
| 優先級 | 🔴 High（T0309 spec regression — 使用者需捲到底才看到當前步驟詳情，UX 不可接受） |
| 狀態 | 📋 TODO |
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
