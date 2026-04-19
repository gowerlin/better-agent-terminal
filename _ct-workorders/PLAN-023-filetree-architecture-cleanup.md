# PLAN-023 — FileTree 架構重整

## 元資料
- **編號**:PLAN-023
- **狀態**:DONE(階段 1+2 ✅、階段 3 T0216 2026-04-19 ✅;待使用者手動 smoke 驗收)
- **優先級**:🟡 Medium
- **類型**:技術改善(架構重整)
- **建立時間**:2026-04-19 13:15 (UTC+8)
- **發現來源**:BUG-048 修復鏈(T0207/T0209/T0211/T0212)累積技術債評估

## 動機

BUG-048 修復鏈(T0207 → T0212)暴露 FileTree 相關元件的累積技術債:

1. **5 處 CT Panel dispatch 複製貼上**:各 view 手動 `dispatchEvent('workspace-switch-tab') + dispatchEvent('file-tree-reveal')`,未來新增 view 易再複製
2. **FileTree.tsx 肥大(~700 行)**:FileTreeNode + FileTree + toPathKey + markdown renderer + 樣式 + 多個 useEffect 混在單檔
3. **toPathKey 散佈**:`FileEntry.path` 同時擔 display / IPC / 比對三職,normalize 寫在每個比對點(T0211/T0212 實證易漏)
4. **事件耦合**:CustomEvent 跨元件通訊(fileTreeRevealBus / workspace-switch-tab)難 trace 難 test
5. **useEffect deps race**:T0207 引入新 auto-load effect 有 `loading` 在 deps + `setLoading(true)` 自我取消 race(T0213 fix 目標)

## 範圍(三階段)

### 階段 1 + 2(合併於 T0213,本 session)

- **T0213**:修 useEffect deps race + 抽 `openFileInFilesTab()` helper + 5 處 dispatch 統一改用 helper
- 估時:~45-60 min
- 目標:修急件 bug + 消除複製貼上,降低未來 CT Panel view regression 面

### 階段 3(獨立後續,非本 session)

- **T0216(待開)**:`FileEntry.pathKey` 分離 + 拆 FileTree.tsx
  - 新增 `pathKey` 欄位(normalized,僅比對用)
  - `path` 保留原字串(display / IPC / read)
  - 拆檔:FileTreeNode / FileTree / markdown 配置各自獨立
  - 影響:型別全專案 audit,風險高,獨立 PLAN 階段執行
- 估時:~1-2 h
- 觸發條件:階段 1+2 驗收通過後,使用者確認再開

## 驗收標準

- 階段 1+2:T0213 完成 + BUG-048 VERIFY 通過(含 TreeNode highlight + 手動 click 不 stuck)
- 階段 3:T0216 完成 + 型別 audit 不破壞現有 consumer

## 關聯

- BUG-048(VERIFY 部分通過)
- T0207(`40207a3`,引入 deps race)
- T0208(AI 驗收誤判 PASS,沒抓到 deps race)
- T0209(`39c55a3`,Windows 邊界 + localStorage race)
- T0211(T0209 漏修根因定位)
- T0212(`5d8812b`,selected 比對 normalize)
- T0213(本 PLAN 階段 1+2,即將派發)

## 備註

- 階段 3 的 `FileEntry.pathKey` 分離是 T0211 Option C 推薦方向,當時因範圍太大延後
- 若階段 1+2 後使用者認為現狀已足夠,可不執行階段 3(技術債記錄為 acceptable)
- 本 PLAN 與 BUG-050 Option C(另一 PLAN)互相獨立,不綁定
