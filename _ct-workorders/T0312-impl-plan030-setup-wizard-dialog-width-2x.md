---
schema_version: 1
schema_kind: workorder
id: T0312
title: Impl：Setup Wizard Dialog 寬度放寬 2 倍（PLAN-030 polish）
type: impl
status: DONE
sizing: XS
started_at: "2026-04-27T00:27:00+08:00"
completed_at: "2026-04-27T00:28:00+08:00"
renew_count: 2
---
# T0312 — Impl：Setup Wizard Dialog 寬度放寬 2 倍（PLAN-030 polish）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0312 |
| 類型 | impl（UI polish） |
| 優先級 | 🟡 Medium（T0311 layout 已 side-by-side 但右欄過擠，內容換行影響可讀性） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 00:27 (UTC+8) |
| 完成時間 | 2026-04-27 00:28 (UTC+8) |
| 預估規模 | XS-S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 塔台（使用者實機驗收 T0311 後回報） |
| 關聯 PLAN | PLAN-030（後續 polish） |
| 前置工單 | T0311（DONE，layout 改 side-by-side） |
| Renew 次數 | 2 |
| 影響範圍 | Setup Wizard Dialog 的最大寬度設定（grep `max-width` / `width` / Dialog component props） |

## 背景

T0311 修好了 Setup Wizard 兩欄式 layout，但實機驗收發現 Dialog 寬度太窄：
- 右欄詳情區內容換行嚴重（`Choose a WSL2 distro` 拆行 / `Select the distro where BAT should install the remote server bundle.` 拆 7 行）
- distro 選項按鈕（`Ubuntu-24.04` / `Ubuntu`）無法 inline，被迫垂直堆疊
- 整體右欄寬度約 250px，閱讀體驗壓迫

使用者建議：**Dialog 寬度放寬 2 倍**

screenshot：T0311 完成後 WSL wizard 第 2 步畫面

## 任務

### Step 1：定位 Dialog 寬度設定

可能位置：
- ProfilePanel 的 SetupWizardShell 包裹層
- Dialog / Modal 元件本身（如 `src/components/Modal.tsx` 或類似）
- `src/styles/*.css` 中含 `max-width` / `min-width` 對應 wizard dialog 的 rule

grep 候選：
```bash
grep -rn "max-width" src/components/ | grep -iE "(wizard|dialog|modal|setup)"
grep -rn "wizard.*width" src/styles/
```

### Step 2：放寬寬度

當前估算約 480-520px → 目標 **~960-1040px**（2 倍）。

實作選項：
- **[A]** 直接改既有 max-width 數值（最簡單）
- **[B]** 加 `.bat-wizard-dialog` 特化 class，只放寬 wizard，不影響其他 Dialog（推薦）
- [C] 用 viewport-aware 計算（如 `min(960px, 90vw)`）

> **建議 [B] + [C] 結合**：`max-width: min(1040px, 90vw); min-width: 720px;`
> - desktop 視窗夠大 → 1040px 寬，舒適
> - 視窗很窄 → 90vw 自動縮，不爆出畫面
> - 不影響其他既有 Dialog（如 settings / profile config）

### Step 3：搭配 T0311 的 fallback 確認

T0311 加了 `@media (max-width: 720px)` fallback 回 stacked。本工單的 `min-width: 720px` 設定與該 fallback 對齊：
- ≥ 720px → side-by-side，Dialog 1040px 舒適
- < 720px → stacked，Dialog 自動縮小

### Step 4：視覺驗證

- 跑 `npx vite build` 通過
- 跑 `npm run test:unit` 全綠
- 在 DevTools 拉視窗從 ≥1040px 拖到 < 720px，確認：
  - 大視窗：side-by-side 不擠
  - 中視窗：side-by-side 但稍緊
  - 小視窗：stacked fallback 生效

## 完成定義（DOD）

- [ ] Setup Wizard Dialog `max-width` 放寬到約 1040px（2x 既有）
- [ ] `min-width: 720px` 對齊 T0311 fallback breakpoint
- [ ] viewport-aware（`min(1040px, 90vw)` 或同等）避免超出畫面
- [ ] 不影響其他 Dialog 既有寬度
- [ ] 右欄詳情可閱讀（distro 選項按鈕能 inline）
- [ ] `npm run test:unit` ✅ 全綠
- [ ] `npx vite build` ✅ 通過
- [ ] git commit message 含 `relates PLAN-030 / fixes T0309 width`

## 不在範圍

- 不改右欄內容文案（i18n 是另一個 issue）
- 不改 Dialog 高度
- 不改 Stepper 元件本身
- 不重新設計 Dialog header / footer

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`fix(wizard): T0312 widen setup wizard dialog 2x for comfortable side-by-side reading — relates PLAN-030`）
2. 在工單檔尾追加 Worker 回報區（含寬度數值前後對照、commit hash、tests 結果）
3. **回報字串嚴格符合斷點 A regex**：`T0312 完成` / `T0312 部分完成` / `T0312 失敗` / `T0312 需要協助`

---

## Worker 回報區

| 欄位 | 內容 |
|------|------|
| 完成狀態 | DONE |
| 開始時間 | 2026-04-27 00:27 (UTC+8) |
| 完成時間 | 2026-04-27 00:28 (UTC+8) |
| commit | 9ae338a |
| tests | `npm run test:unit` ✅ 47 passed / `npx vite build` ✅ 通過 |

### 產出摘要

**修改檔案**：
- `src/components/ProfilePanel.tsx`（3 處）：WSL / Docker / SSH wizard dialog 的 `maxWidth` 由 `720` 改為 `'min(1040px, 90vw)'`
- `_ct-workorders/T0312-impl-plan030-setup-wizard-dialog-width-2x.md`：metadata 狀態與本回報區

**寬度前後對照**：
| 項目 | 前 | 後 |
|------|----|----|
| `maxWidth` | `720` (px) | `'min(1040px, 90vw)'` |
| desktop ≥1156px 視窗 | 720px | 1040px（2 × 既有，符合 DOD「2x」目標） |
| 1040px > 視窗 ≥ 800px | 720px | 90vw（自適應，避免爆出） |
| 視窗 < 720px | 720px（會超出畫面） | 90vw（縮小不爆出，且觸發 T0311 的 `@media (max-width:720px)` stacked fallback） |

**設計選擇理由**：
- 採用工單建議方案 [B+C] 變體：直接 inline `min(1040px, 90vw)`，未引入特化 class（最小變動，沿用既有 `.settings-panel` 的其他樣式）
- **未加 `min-width: 720px`**：若加，視窗 < 720px 時 dialog 仍強制 720px 會橫向溢出。改用 `90vw` 作為下界，搭配 T0311 setup-wizard.css 的 `@media (max-width: 720px)` stacked fallback 自動降級
- 三個 wizard（WSL / Docker / SSH）共用相同 inline style，未來若要再特化可再抽 class
- 不影響其他 dialog：grep 確認 `maxWidth: 720` 僅此 3 處，其他 modal 各自獨立寬度（520 / 360 / 1060 etc.）

### 驗收條件對照

- [x] Setup Wizard Dialog `max-width` 放寬到約 1040px（2x 既有 720）
- [x] viewport-aware（`min(1040px, 90vw)`）避免超出畫面
- [x] 不影響其他 Dialog 既有寬度（grep 驗證）
- [x] `npm run test:unit` ✅ 47 passed
- [x] `npx vite build` ✅ 通過
- [x] git commit message 含 `relates PLAN-030`
- [-] `min-width: 720px`：刻意未加，理由見上方「設計選擇理由」（`90vw` + T0311 stacked fallback 已涵蓋小視窗情境）
- [△] 視覺驗證（distro 按鈕能 inline）：靜態驗證已通過（寬度數值對照），實機 DevTools 拖視窗驗證留待使用者確認

### 互動紀錄

無

### 遭遇問題

無

### Renew 歷程

- **Renew #1（00:30，使用者實機回報）**：「dialog 寬度沒變化」
  - 根因：`.settings-panel` (src/styles/settings.css:16) 有 `width: 450px`，比原本 `maxWidth: 720` 還小，inline 改 maxWidth 完全無效（width 在 cascade 中勝出，實際渲染 450px）
  - 修復：inline 同時覆蓋 `width` + `maxWidth` 為 `min(1040px, 90vw)`
  - commit：`04fc076`

- **Renew #2（00:33，使用者追加要求）**：「左右寬比 4:6, 左右區塊各自垂直捲動 dialog body 不捲」
  - 變更：
    1. `setup-wizard.css` 的 `.bat-wizard-grid` 改 `grid-template-columns: 4fr 6fr`（原 `minmax(220px,280px) 1fr` ≈ 3:7 不固定）
    2. `.bat-wizard-shell` 加 `display:flex; flex-direction:column; height:100%; min-height:0` 撐滿 dialog body 高度
    3. `.bat-wizard-grid` 改 `flex:1 + min-height:0` 占據 shell 剩餘高度
    4. 兩欄移除 `max-height: 70vh`，改用 `min-height:0`，讓 `overflow-y:auto` 在 grid 區塊內生效（捲動範圍綁 dialog body）
    5. `ProfilePanel.tsx` 三個 wizard 的 `.settings-body` inline 加 `overflow:hidden + display:flex + flexDirection:column + minHeight:0`，把捲動責任轉給左右欄
  - commit：`865be7b`

### 補充：最終生效設定

| 項目 | 值 |
|------|----|
| Dialog 寬度 | `width: min(1040px, 90vw)` + `maxWidth: min(1040px, 90vw)`（inline，覆蓋 `.settings-panel` 的 `width:450px`） |
| 欄寬比例 | 左:右 = `4fr : 6fr`（固定比例，T0311 原本是 minmax 變動） |
| 捲動位置 | 左欄獨立 `overflow-y:auto` ／ 右欄獨立 `overflow-y:auto` ／ dialog body `overflow:hidden`（不捲） |
| 高度模型 | `.settings-panel` `max-height:80vh` → `.settings-body` `flex:1` → `.bat-wizard-shell` `height:100%` → `.bat-wizard-grid` `flex:1 + min-height:0` → 兩欄 `min-height:0 + overflow-y:auto` |
| 小視窗 fallback | `< 720px` 走 stacked（T0311 既有 `@media`），未動 |

### 最終 commits

| commit | 說明 |
|--------|------|
| `9ae338a` | 初版（只動 maxWidth，無效） |
| `076e8e9` | metadata DONE + 回報區（首版） |
| `04fc076` | Renew #1 修：覆蓋 width:450px |
| `865be7b` | Renew #2 修：4:6 比例 + 左右各自捲動 + body 不捲 |
