# Git GUI POC — T0153 Spike

POC 實驗代碼,驗證 PLAN-014(方向 B:Git GUI)的 3 個高風險假設。

## POC 狀態

**本次 sub-session 產出**:紙上分析 + POC 代碼骨架

由於工單範圍(2-3 週)遠超單一 sub-session 容量,本次僅完成:
- ✅ 假設 3 競品調查與 Lazygit 方案評估(完整)
- ✅ 假設 1 大 repo graph 渲染紙上分析(基於公開案例)
- ✅ 假設 2 CT 工單反查 UX 延遲估算(基於架構拆解)
- ⏳ POC 代碼骨架(本資料夾) — **未整合到 BAT 主 UI**
- ❌ 實際 1M+ repo FPS 測試(需真實實作 + 效能量測)
- ❌ 實際反查 UX 延遲測量(需實作後測)

完整結論與 Phase 3 拆單建議見 `_ct-workorders/_report-git-gui-poc-findings.md`。

## 路徑不一致

工單寫 `src/renderer/components/git-poc/`,但 BAT 實際結構為
`src/components/`(無 `src/renderer/` 層級),已調整為 `src/components/git-poc/`。

## 檔案

- `README.md` — 本檔案
- `GitPocPlaceholder.tsx` — 未來 POC 元件掛載位置(目前僅 placeholder)

## 如何啟用(未來 Phase 3)

POC 代碼**未**加入 App.tsx 的 dock system(避免動到核心架構造成 regression)。
Phase 3 啟動實作時,參考以下步驟啟用:

1. `npm install simple-git`(MIT 授權,已在 T0152 報告中確認)
2. 新增 IPC handler:`electron/ipc-handlers/git-poc-handler.ts`(讀 commits、建索引)
3. 實作 SVG graph 元件:`SvgCommitGraph.tsx`
4. 實作 virtualization(react-window 或自製)
5. 在 `src/types.ts` 新增 `'git-poc'` dockable panel type
6. 在 `src/App.tsx` 加 lazy import + Sidebar 按鈕
7. 量測 FPS(Chrome DevTools Performance)

## 禁止事項(Phase 3 執行時)

- ❌ 不修改既有 GitPanel.tsx(避免與生產代碼衝突)
- ❌ 不改 TerminalServer / PtyManager(防止主流程 regression)
- ✅ 允許新增 panel、IPC handler、新元件
