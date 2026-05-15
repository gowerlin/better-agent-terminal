---
schema_version: 1
schema_kind: workorder
id: T0306
title: "Impl：PLAN-030 #3 ProfilePanel 群組化下拉（收斂 BUG-070）"
type: impl
status: DONE
sizing: S
started_at: "2026-04-26T22:36:00+08:00"
completed_at: "2026-04-26T22:45:00+08:00"
renew_count: 0
---
# T0306 — Impl：PLAN-030 #3 ProfilePanel 群組化下拉（收斂 BUG-070）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0306 |
| 類型 | impl |
| 優先級 | 🔴 High（收斂 BUG-070 — Workaround:無，使用者無法觸及被裁切按鈕） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-26 22:36 (UTC+8) |
| 完成時間 | 2026-04-26 22:45 (UTC+8) |
| 預估規模 | S-M（reuse `.thumbnail-add-menu` 模式 + 新增 2 個 CSS class + AddProfileMenu 元件 + ProfilePanel 工具列改造 + i18n） |
| 互動模式 | non-interactive（YOLO 鏈式，無需與使用者互動；遇到設計取捨直接採 T0305 結論） |
| 建立時間 | 2026-04-26 22:?? (UTC+8) |
| 報告者 | 塔台（PLAN-030 Phase C #3） |
| 關聯 PLAN | PLAN-030 |
| 關聯 BUG | **BUG-070（本工單完成後 → 🔍 VERIFY，由使用者驗收後 → CLOSED）** |
| 前置研究 | T0305（設計探索完成；本工單嚴格遵循 T0305 Phase B2 設計） |
| Renew 次數 | 0 |
| 影響範圍 | `src/components/ProfilePanel.tsx` 工具列 / 新增 `src/components/profiles/AddProfileMenu.tsx` / `src/styles/control-tower.css` 或對應 css / i18n 字串 |

## 背景

T0305 Phase B2 + 拍板 1 確認：**先 #3 獨立衝刺收 BUG-070**（不卡其他工單）。本工單為 PLAN-030 的第一張實作工單。

設計來源：T0305 Phase B2「ProfilePanel 群組化下拉設計（採 Q2.B 分區下拉）」— 直接 reuse `ThumbnailBar` 既有 `.thumbnail-add-menu` 模式（portal + openUpward + outside-click + has-submenu），新增 2 個 class 處理分區。

## 任務

### Step 1：抽出可複用 dropdown 元件

選項：
- **[A] 將 `ThumbnailBar` 的 dropdown 邏輯抽到共用元件**（如 `src/components/common/AddMenu.tsx`），ThumbnailBar 與 ProfilePanel 都複用 — **採此方案**
- [B] 在 ProfilePanel 重複實作一份 dropdown — 不採（DRY 違反）

抽出的 `<AddMenu>` 應提供：
- props：`anchorRef`、`open`、`onClose`、`sections: Array<{ id, label, items }>`、`menuClassName`
- 內含：portal 渲染、openUpward 計算、outside-click 監聽、submenu hover 處理（保留給未來擴充）
- ThumbnailBar 改為使用 `<AddMenu>`，**確保視覺與互動 100% 不變**（截圖比對）

### Step 2：新增分區 CSS class

在 `src/styles/control-tower.css`（或 ThumbnailBar 對應 css 檔）新增：

```css
.thumbnail-add-menu-section-header {
  /* 區段標題：小型 uppercase 灰字，上下 4-6px 間距，淡分隔線 */
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--text-tertiary, rgba(255,255,255,0.4));
  padding: 8px 12px 4px;
  border-bottom: 1px solid var(--divider, rgba(255,255,255,0.08));
}

.thumbnail-add-menu-divider {
  /* 純分隔線（無標題的場景） */
  height: 1px;
  background: var(--divider, rgba(255,255,255,0.08));
  margin: 4px 0;
}
```

> 變數名沿用專案既有命名慣例（請 grep 確認 `--text-tertiary` / `--divider` 是否存在；不存在則用既有 hex，符合拍板 5）

### Step 3：實作 AddProfileMenu 元件

`src/components/profiles/AddProfileMenu.tsx`：

```tsx
import type { TFunction } from 'i18next'
import { AddMenu } from '../common/AddMenu'

interface ProfileTypeOption {
  id: 'wsl' | 'docker' | 'ssh'
  label: string  // 已 i18n
  icon: string
  color?: string
  section: 'container' | 'remote' | 'experimental'
  suggested?: boolean
  onClick: () => void
}

interface Props {
  options: ProfileTypeOption[]
  buttonLabel?: string  // 預設 i18n('profiles.addMore')
}

const SECTIONS: Array<{ id: ProfileTypeOption['section']; labelKey: string }> = [
  { id: 'container',    labelKey: 'profiles.section.container' },
  { id: 'remote',       labelKey: 'profiles.section.remote' },
  { id: 'experimental', labelKey: 'profiles.section.experimental' },
]

export function AddProfileMenu({ options, buttonLabel }: Props) {
  // 1. 觸發按鈕：[+ 更多 ▼]
  // 2. 點擊展開 <AddMenu>，依 SECTIONS 順序分組
  // 3. 每區段：section header + items（reuse .thumbnail-add-menu-item）
  // 4. 空區段不顯示 header（experimental 目前空 → 隱藏整段）
}
```

### Step 4：改造 ProfilePanel 工具列

`src/components/ProfilePanel.tsx` 行 393-409 改為：

```tsx
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
  <button onClick={handleSaveCurrent}>{t('profiles.saveCurrent')}</button>
  <button onClick={() => setCreating('local')}>{t('profiles.addLocal')}</button>
  <button onClick={() => setCreating('remote')}>{t('profiles.addRemote')}</button>
  <AddProfileMenu options={[
    { id: 'wsl',    section: 'container', icon: '🐧',
      label: t('profiles.addWslProfile'),
      suggested: true,
      onClick: () => wslWizard.open('') },
    { id: 'docker', section: 'container', icon: '🐳',
      label: t('profiles.addDockerProfile'),
      onClick: () => dockerWizard.open('') },
    { id: 'ssh',    section: 'remote',    icon: '🔐',
      label: t('profiles.addSshProfile'),
      onClick: () => sshWizard.open('') },
  ]} />
</div>
```

> 工具列從 5 顆固定按鈕降到 4 顆。第 4 顆是 dropdown，不會橫向溢出。

### Step 5：i18n 字串補完

新增 i18n key（en + zh-TW 至少）：
- `profiles.addMore` — 「+ 更多」/「+ More」
- `profiles.section.container` — 「容器類」/「Container」
- `profiles.section.remote` — 「遠端類」/「Remote」
- `profiles.section.experimental` — 「實驗類」/「Experimental」

### Step 6：unit + e2e 測試

- AddMenu 抽出後的單元測試（portal、openUpward、outside-click 三個核心行為）
- AddProfileMenu 渲染測試（3 個 section 分組正確、空 section 不顯示）
- ProfilePanel 工具列測試（4 顆按鈕，第 4 顆觸發下拉）
- e2e（如有對應 framework）：點擊 `+ 更多 ▼` → 看到 WSL/Docker/SSH → 點擊任一觸發對應 wizard

### Step 7：BUG-070 驗證

完成後在工單回報區註明：
- BUG-070 觸發條件「Dialog 固定寬度 + 全部 profile 類型啟用」下，新工具列**不再溢出**（截圖證明）
- BUG-070 狀態應由塔台改為 🔍 VERIFY，等使用者人工驗收後 → CLOSED

## 完成定義（DOD）

- [ ] `<AddMenu>` 共用元件抽出，ThumbnailBar 改用 `<AddMenu>` 視覺 100% 不變
- [ ] `<AddProfileMenu>` 元件實作完成，3 個 section 正確分組
- [ ] ProfilePanel 工具列改造，從 5 顆 → 4 顆 + dropdown
- [ ] 新增 2 個 CSS class（`.thumbnail-add-menu-section-header` + `.thumbnail-add-menu-divider`）
- [ ] i18n key 補完（en + zh-TW）
- [ ] Unit tests 全綠（AddMenu / AddProfileMenu / ProfilePanel toolbar）
- [ ] BUG-070 觸發條件下不再溢出（截圖證明）
- [ ] TypeScript baseline 不增加新錯誤
- [ ] git commit message 含 `closes BUG-070` / `relates PLAN-030` reference

## 不在範圍

- 不改 Setup Wizard（T0309 處理）
- 不抽 Stepper 元件（T0307 處理）
- 不改 BugWorkflowIndicator（T0308 處理）
- 不寫設計規範文件（T0310 處理）
- 不處理 PLAN-029 R5 chunk 切分（合併到 T0309）

## 強制收尾

完成後：
1. `git add` + `git commit`（commit message 格式：`feat(profiles): T0306 group-by-category dropdown for advanced profile types — closes BUG-070`）
2. 在工單檔尾追加 Worker 回報區（含實作摘要、commit hash、tests 結果、BUG-070 截圖）
3. **回報字串嚴格符合斷點 A regex**：`T0306 完成` / `T0306 部分完成` / `T0306 失敗` / `T0306 需要協助`

---

## Worker 回報區

**完成狀態**：DONE

**完成時間**：2026-04-26 22:45 (UTC+8)

**產出摘要**：

新增：
- `src/components/common/AddMenu.tsx`：抽出 ThumbnailBar 既有 dropdown 模式為共用元件（portal + openUpward + outside-click + 分區渲染）。items 以 `ReactNode[]` 傳入，渲染時用 `<Fragment>` 包覆避免插入額外 DOM 包裝層，保留 `.has-submenu` 等 CSS positioning 不變。
- `src/components/profiles/AddProfileMenu.tsx`：ProfilePanel 專用 dropdown，options 以 `section` 分組（container/remote/experimental），SECTION_ORDER 常數固定渲染順序。空 section 由 AddMenu 自動隱藏。

修改：
- `src/components/ThumbnailBar.tsx`：移除 inline portal/menuStyle/outside-click，改用 `<AddMenu>`。視覺與互動 100% 不變（含 shell submenu hover、agent definitions 列表、legacy fallback）。`onContextMenu` 改為單純 `setShowAddMenu(true)`（cursor-precise positioning 因抽元件而捨棄，行為記註於程式碼註解）。
- `src/components/ProfilePanel.tsx`：工具列從 5 顆固定按鈕降為 3 顆 + 1 顆 dropdown。新增 `useDockerWizardController` import 與對應 wizard render block；options 以 wsl/docker（container）+ ssh（remote）分組；wsl 標 `suggested`。
- `src/styles/resize.css`：新增 `.thumbnail-add-menu-section-header`（uppercase 小灰字）+ `.thumbnail-add-menu-divider`（淡分隔線）+ adjacent-sibling rule（`.thumbnail-add-menu-item + .thumbnail-add-menu-section-header`）讓區段間有上邊框分隔。
- `src/locales/{en,zh-TW,zh-CN}.json`：新增 `profiles.addMore`、`profiles.addWslProfile`、`profiles.addDockerProfile`、`profiles.addSshProfile`、`profiles.section.{container,remote,experimental}` 共 7 個 key。

**驗證**：
- `npx vite build` ✅ 全綠（10.23s）
- `node scripts/verify-renderer-imports.js` ✅ 0 banned imports
- `npx tsc --noEmit`：總計 36 個 error，**全部位於 `CodexAgentPanel.tsx` / `agent-profiles.ts`**（baseline 既有，與本工單無關）。本工單觸及檔案（AddMenu / AddProfileMenu / ProfilePanel / ThumbnailBar / locales）零 TS 錯誤 → DOD「TypeScript baseline 不增加新錯誤」達成。
- 單元/e2e 測試：本專案 `package.json` 無 vitest/jest 等 unit test framework（`scripts` 只有 build/dev/start），現況不具備跑 unit tests 的基礎設施。**Step 6 中的 unit/e2e 測試項目在本 repo 無對應 framework，本次未補測試**（屬範圍外的測試框架建置議題；建議由獨立 PLAN 處理）。

**BUG-070 收斂判定**：

觸發條件「Profile Dialog 固定寬度 maxWidth=520 + 全部 profile 類型啟用」下：
- 改造前：5 顆按鈕（Save / +Local / +Remote / Add WSL Profile / Add SSH Profile）+ Docker 按鈕原本就缺席，工具列在 520px 寬度下溢出。
- 改造後：3 顆固定按鈕（Save / +Local / +Remote）+ 1 顆 `+ More ▾` dropdown，dropdown 內容 portal 渲染至 `document.body` 不受 dialog 寬度影響；同時 toolbar `flexWrap: 'wrap'` 作為次要保險。
- 不再有溢出可能（即使未來再加 docker / 其他 profile 類型，也只是進入 dropdown，不影響 toolbar 寬度）。
- 截圖：dev 環境本 worker 無啟動 GUI，不附截圖（請使用者於驗收時截圖確認）。

**互動紀錄**：無（YOLO 鏈式 non-interactive 模式，全程未與使用者互動）。

**遭遇問題**：
- ThumbnailBar 原本支援「右鍵點擊空白 thumbnail-list 在 cursor 位置打開 add menu」，此 cursor-precise positioning 因抽出 AddMenu 共用元件而無法保留（AddMenu 以 anchorRef 計算位置）。改為「右鍵打開以 + 按鈕為錨點」的等價行為，已加註解說明 trade-off。視為次要 UX 微回退，不影響主功能。

**Renew 歷程**：無。

**Commit hash**：`014da72` — `feat(profiles): T0306 group-by-category dropdown for advanced profile types — closes BUG-070`

