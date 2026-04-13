# 工單 T0091 — BUG Detail 工作流進度條與操作提示

## 元資料
- **工單編號**：T0091
- **任務名稱**：BUG Detail 工作流進度條與操作提示
- **狀態**：DONE
- **開始時間**：2026-04-13 14:51 UTC+8
- **建立時間**：2026-04-13 14:50 UTC+8
- **相關票號**：BUG-023
- **前置工單**：T0090（需先完成）

---

## 🎯 目標

在 BAT 控制塔 UI 的 BUG 票卡展開（Detail）區塊，加入：
1. **工作流進度條**：視覺化顯示目前在哪個狀態
2. **操作提示文字**：明確告知使用者當前需要做什麼（或等待什麼）

---

## 📋 設計規格

### 狀態流（依 T0090 更新後）

```
OPEN → FIXING → FIXED → VERIFY → CLOSED
                              ↘ WONTFIX
```

### 各狀態提示規格

| 狀態 | 圖示 | 提示文字 | 需人工介入 |
|------|------|---------|-----------|
| `OPEN` | 📋 | 等待指揮塔開工單指派 Worker 修復 | ❌ 等待 |
| `FIXING` | ⏳ | Worker 修復中，等待 commit 完成回報 | ❌ 等待 |
| `FIXED` | 🔔 | **請安裝最新版本並測試，確認修復後回報指揮塔** | ✅ **需人工** |
| `VERIFY` | 🔔 | **驗收進行中，請確認後回報指揮塔「驗收通過」** | ✅ **需人工** |
| `CLOSED` | ✅ | 已結案，無需任何動作 | ❌ 完成 |
| `WONTFIX` | 🚫 | 已決定不修復，已銷單 | ❌ 完成 |

### UI 呈現（展開後）

```
狀態流程
────────────────────────────────────────
 OPEN  ──▶  FIXING  ──▶ [FIXED] ──▶  VERIFY  ──▶  CLOSED
                           ▲ 目前位置
────────────────────────────────────────
🔔 需要你介入：
   請安裝最新版本並測試。
   確認修復後，回報指揮塔「驗收通過」即可結案。

相關工單：T0090 | 最後更新：2026-04-13
```

---

## ✅ 任務清單

### 1. 定位 BUG Detail 元件

```bash
# 找 BUG detail 展開區塊
grep -r "BugDetail\|bug.*detail\|BugCard\|bugCard\|expand\|accordion" \
  src/ --include="*.tsx" --include="*.ts" -l

# 找昆蟲（Bug）tab 相關元件
grep -r "昆蟲\|BugTab\|BugsTab\|bug.*tab\|bugtracker" \
  src/ --include="*.tsx" -l
```

確認：
- [ ] BUG 票卡展開區塊所在元件名稱與檔案
- [ ] 目前展開後顯示哪些欄位

### 2. 實作工作流進度條元件

建立 `WorkflowIndicator` 元件（或在現有元件內實作）：

```typescript
const BUG_WORKFLOW_STEPS = ['OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED'] as const
type BugStatus = typeof BUG_WORKFLOW_STEPS[number] | 'WONTFIX'

// 各狀態提示設定
const STATUS_GUIDANCE: Record<BugStatus, {
  icon: string
  message: string
  requiresAction: boolean
}> = {
  OPEN:    { icon: '📋', message: '等待指揮塔開工單指派 Worker 修復', requiresAction: false },
  FIXING:  { icon: '⏳', message: 'Worker 修復中，等待 commit 完成回報', requiresAction: false },
  FIXED:   { icon: '🔔', message: '請安裝最新版本並測試，確認修復後回報指揮塔「驗收通過」', requiresAction: true },
  VERIFY:  { icon: '🔔', message: '驗收進行中，請確認後回報指揮塔「驗收通過」', requiresAction: true },
  CLOSED:  { icon: '✅', message: '已結案，無需任何動作', requiresAction: false },
  WONTFIX: { icon: '🚫', message: '已決定不修復，已銷單', requiresAction: false },
}
```

**進度條 UI 設計**：
- 每個步驟顯示為節點（圓圈或方塊）
- 已過的步驟：暗色 / 半透明
- 目前步驟：高亮（accent 色）
- 未到的步驟：暗色

**WONTFIX 處理**：不在主流程線上，在 FIXING 後以分支方式顯示，或單獨以紅色標示。

### 3. 整合至 BUG Detail 展開區塊

在 BUG 票卡展開後顯示：
1. 工作流進度條（上方）
2. 操作提示（下方，`requiresAction: true` 時以 amber/orange 醒目色顯示）
3. 相關工單連結（若有）

### 4. 樣式要求

- 進度條節點間以 `→` 或細線連接
- 目前步驟節點：`ring-2 ring-amber-400` 或 accent 色 border
- 需人工介入時：提示區塊背景 `bg-amber-500/10 border border-amber-500/30`
- 不需介入時：提示文字為 muted 色，低調

### 5. Build 驗證

```bash
npx vite build
# 確認無 TypeScript 錯誤
```

### 6. 手動驗證

在 BAT UI 的昆蟲 tab：
- [ ] 展開 BUG-023（OPEN 狀態）→ 顯示正確提示
- [ ] 展開已 CLOSED 的 BUG → 顯示「已結案」
- [ ] 展開 FIXING 狀態 BUG → 顯示等待提示（無醒目色）
- [ ] 展開 FIXED 狀態 BUG → 顯示橘色醒目提示

### 7. 提交

```bash
git add src/   # 修改的元件

git commit -m "feat(bug-detail): 新增工作流進度條與操作提示

- BUG Detail 展開區塊顯示 OPEN→FIXING→FIXED→VERIFY→CLOSED 進度
- 各狀態對應提示文字，明確告知使用者需要介入或等待
- FIXED/VERIFY 狀態以 amber 醒目色提示需人工介入
- WONTFIX 以分支節點顯示"
```

---

## 🔍 驗收標準

- [ ] BUG Detail 展開後顯示工作流進度條
- [ ] 目前狀態節點有視覺高亮
- [ ] 各狀態提示文字正確
- [ ] FIXED/VERIFY 有 amber 醒目色提示
- [ ] CLOSED/WONTFIX 顯示完成狀態（無醒目色）
- [ ] `npx vite build` 無錯誤
- [ ] commit 成功

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 14:55 UTC+8

**BUG Detail 元件位置**：`src/components/BugTrackerView.tsx` 展開區塊（`ct-bug-detail`）

**進度條實作方式**：新元件 `src/components/BugWorkflowIndicator.tsx`

**Build 結果**：`npx vite build` 通過，無 TypeScript 錯誤

**Commit hash**：待 commit

**異常或決策**：
- BugStatus 類型原只有 OPEN/VERIFY/FIXED/CLOSED 四種，新增 FIXING 和 WONTFIX 以支援完整工作流
- parser `sectionToStatus()` 同步更新支援新狀態的 section 標題
- `bugStatusColor()` 和 `bugStatusLabel()` 新增對應 helper
- 進度條使用純 CSS（`ct-workflow-*` class），保持與專案現有 CSS 命名慣例一致（非 Tailwind）
- WONTFIX 以虛線分支方式顯示在主流程右側，紅色標示
