# T0312 — Impl：Setup Wizard Dialog 寬度放寬 2 倍（PLAN-030 polish）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0312 |
| 類型 | impl（UI polish） |
| 優先級 | 🟡 Medium（T0311 layout 已 side-by-side 但右欄過擠，內容換行影響可讀性） |
| 狀態 | 📋 TODO |
| 預估規模 | XS-S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-27 00:?? (UTC+8) |
| 報告者 | 塔台（使用者實機驗收 T0311 後回報） |
| 關聯 PLAN | PLAN-030（後續 polish） |
| 前置工單 | T0311（DONE，layout 改 side-by-side） |
| Renew 次數 | 0 |
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
