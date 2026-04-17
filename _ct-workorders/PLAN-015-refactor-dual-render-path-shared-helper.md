# PLAN-015-refactor-dual-render-path-shared-helper

## 元資料
- **編號**：PLAN-015
- **標題**：Refactor：抽取 `renderPanelContent` shared helper 消除 App.tsx/WorkspaceView.tsx 雙 render 路徑
- **狀態**：💡 IDEA
- **優先級**：🟢 Low
- **類型**：架構重構（防止未來 DockablePanel 新增時漏 case）
- **建立時間**：2026-04-18 00:50 (UTC+8)
- **建立 Session 決策**：本輪（BUG-037 CLOSED 後 follow-up）
- **來源**：T0157 研究建議「方案 C」+ L035（learning 已記錄結構性修復候選）

---

## 動機

### 現狀問題

本專案 `DockablePanel` 成員有**兩條獨立 render path**：

| Path | 檔案 | 處理範圍 | 當前模式 |
|------|------|---------|---------|
| Sidebar render | `src/App.tsx::renderDockablePanel` | left/right sidebar | lazy + Suspense |
| Main zone render | `src/components/WorkspaceView.tsx::renderTabContent` | main zone docking | 直接 import |

新增 `DockablePanel` 成員（例如 `'git-graph'`）時必須**同時**修改兩處 switch，否則：
- 漏 App.tsx → sidebar zone 全黑
- 漏 WorkspaceView.tsx → main zone 全黑

### BUG-037 實證

T0155 加 `'git-graph'` 成員時只補了 `App.tsx`，漏 `WorkspaceView.tsx` → 使用者 dev UAT 發現 Git 圖譜 panel 全黑（`default: return null`）。T0157 研究定位 + T0158 方案 A 修復（補 case）。

方案 A 是最小修改（~30 分鐘），但維持雙路徑的結構債，**未來新增 panel 仍需改兩處，同類 bug 可能再發生**。

### 為何不是 Bug

現狀功能正常（已由 T0158 補齊），只是架構上「dispatch table 非單一真實來源」的設計氣味，屬於預防性 refactor。

---

## 解決方案（草案）

### 技術路線候選

| # | 方向 | 優點 | 缺點 | 範圍 |
|---|------|------|------|------|
| A | 抽 `renderPanelContent(panel, ctx)` 純函式放 `src/components/panels/registry.tsx`，App/WorkspaceView 都呼叫 | 雙路徑合一、props 明確 | 需處理 context 差異（terminals / hasGithubRemote / workspace 等，App 和 WorkspaceView 持有的 state 不完全相同） | ~3-4 小時（含回歸） |
| B | Panel 註冊表模式：每個 panel 自帶 `{ id, render(ctx) }` 物件，App/WorkspaceView 查表 | 開放封閉原則、新增 panel 改 1 處 | 改動面大、Type 系統需處理 ctx union | ~1-2 天 |
| C | 保持現狀，改為加一個 **type-level guard**：`type PanelRenderedInMain = ...` 強制兩處都覆蓋 | 零 runtime 改動、編譯期防漏 | 只能防型別漏，不防實作邏輯漏；TypeScript complicated | ~2-3 小時 |

**初步傾向 A**（T0157 已評估），但需先跑研究工單確認 `App.tsx` 和 `WorkspaceView.tsx` 的 render context 差異是否可抽成單一 props 介面。

### 預期產出

- `src/components/panels/registry.tsx`（或類似位置）— shared helper
- `src/App.tsx::renderDockablePanel` 改為呼叫 helper
- `src/components/WorkspaceView.tsx::renderTabContent` 改為呼叫 helper
- Regression 測試：每個 DockablePanel 成員在 main / left / right 三個 zone 都能正常 render

### 驗收條件（草稿）

- [ ] 新增一個測試 panel 只改 registry 一處，App/WorkspaceView 皆能正確 render
- [ ] 現有所有 panel 在 main / left / right zone 切換不 regression
- [ ] Build + type check 通過
- [ ] 相同使用者操作流程下無 UX 差異（lazy/non-lazy 行為合理化）

---

## 相關 Pattern

- **L035**（2026-04-18）：本 plan 的結構性修復候選已在 learning 中記錄
- **L036**（2026-04-18）：同 session 發現的另一條雙層 scaffold 缺口（PROXIED_CHANNELS）— 若本 refactor 進行順利，未來可考慮把「scaffold checklist 集中化」的設計原則套用到 IPC 層（另開 PLAN）

## 相關工單

（未派發實作工單，等優先級提升再拆）

## 備註

- T0158 已用方案 A（最小修改）關閉 BUG-037，本 PLAN 純屬結構清理
- 建議等 PLAN-014 Phase 3 Tα3 及後續 panel 功能穩定後再動手（避免開發中途動架構）
- 若決定執行，先派研究工單（T-xxxx）確認 App/WorkspaceView context 差異面，再派實作工單
