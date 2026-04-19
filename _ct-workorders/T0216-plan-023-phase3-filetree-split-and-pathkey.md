# 工單 T0216 — PLAN-023 階段 3:FileTree 拆檔 + FileEntry pathKey 分離

## 元資料
- **工單編號**:T0216
- **任務名稱**:PLAN-023 階段 3 架構重整(FileTree.tsx 拆 4 檔 + FileEntry pathKey 分離全面切換)
- **狀態**:PENDING
- **建立時間**:2026-04-19 18:58 (UTC+8)
- **開始時間**:(sub-session 開始時填入)
- **完成時間**:(完成時填入)
- **目標子專案**:(本專案根,non mono-repo)

## 工作量預估
- **預估規模**:中
- **預估工時**:~1-2h(Worker time 可能壓縮 2-5x,視 tsc 回報速度)
- **Context Window 風險**:中(FileTree 相關約 5-10 檔,加全專案 `FileEntry` consumer 審視)
- **降級策略**:若 tsc 報錯 >30 處或某類 consumer 不易修,可先完成 FileTree.tsx 拆檔 + pathKey 欄位新增 + FileTree 內部切換,回報 PARTIAL 附剩餘 consumer 清單,另開 T0217 處理

## Session 建議
- **建議類型**:🆕 新 Session(YOLO 模式,BAT 內部終端)
- **原因**:中等規模架構重整,不應污染現有塔台 context;且作為 BUG-050 階段 1 VERIFY 期 YOLO log 觀察樣本 #1

## 任務指令

### BMad 工作流程
無(手動執行,非 BMad story)

### 前置條件
需載入的文件清單:
- `_ct-workorders/PLAN-023-filetree-architecture-cleanup.md`(本階段原始計畫)
- `src/renderer/components/FileTree.tsx`(拆檔主目標)
- `src/shared/types.ts` 或 `src/renderer/types/` 對應 `FileEntry` 定義位置(pathKey 欄位新增)
- `_ct-workorders/T0211-research-bug-048-treenode-selection-focus-missing.md`(Option C 推薦方向,pathKey 分離的原始研究)
- `_ct-workorders/T0212-bug-048-fix-selected-comparison-normalize.md`(selected normalize 的局部修法,本張延伸為全面切換)
- `_ct-workorders/T0213-bug-048-fix-useeffect-deps-race-and-extract-helper.md`(階段 1+2 產出,確認 `openFileInFilesTab` helper 位置不動)

### 輸入上下文

**背景**:
- PLAN-023 由 BUG-048 修復鏈累積技術債催生,階段 1+2(T0213)已閉環
- 階段 3 要解的核心問題:
  1. FileTree.tsx ~700 行肥大(FileTreeNode + FileTree + toPathKey + markdown + useEffect 混在單檔)
  2. `FileEntry.path` 同時擔 display / IPC / 比對三職,normalize 寫在每個比對點(T0211/T0212 實證易漏)
- 與 BUG-050 Option C 階段 1 獨立(兩 PLAN 不綁定),本張執行時 BUG-050 處於 VERIFY 期

**決策採用**(塔台 + 使用者確認):
- Q1 拆檔粒度:**[C] 完整拆分**(FileTreeNode / FileTree / markdown 配置 / toPathKey utils,4 檔)
- Q2 pathKey 分離:**[B] 全面切換**(新增欄位 + 所有比對點一次改用 pathKey)
- Q3 Consumer audit:**[C] tsc-driven**(改型別 → `npx vite build` 或 `tsc --noEmit` → 按編譯錯誤定位 consumer)
- Q4 測試策略:**[B] tsc + 手動 smoke**(FileTree click / reveal / load / checkbox 至少 4 情境)

**技術棧**:
- React 18 + TypeScript + Electron
- Vite 7(`npx vite build` 會跑 tsc)
- 型別定義散見 `src/shared/types.ts` 或 `src/renderer/types/`(Worker 自行 locate)

**特殊注意**:
- `openFileInFilesTab()` helper 由 T0213 抽出,**位置不動**,只是其內部的比對邏輯可能受 pathKey 影響,需一併審視
- `toPathKey` 函式從 FileTree.tsx 搬到 utils 檔後,需保持**函式簽名相同**(input/output 型別),避免 consumer 需要改 import path 以外的東西
- FileTree.tsx 的 5 處 dispatch 複製貼上已在 T0213 統一,階段 3 **不要再動** `dispatchEvent` 相關邏輯

### 預期產出

**新建檔案**:
- `src/renderer/components/FileTreeNode.tsx`(從 FileTree.tsx 拆出)
- `src/renderer/components/FileTreeMarkdown.tsx` 或 `fileTreeMarkdownConfig.ts`(markdown 配置獨立,檔名由 Worker 判斷慣例)
- `src/renderer/utils/filePathKey.ts` 或類似位置(`toPathKey` + 相關 path 工具集中)

**修改檔案**:
- `src/renderer/components/FileTree.tsx`(剩主 FileTree 邏輯,預計 <250 行)
- `src/shared/types.ts` 或對應 `FileEntry` 定義(新增 `pathKey: string` 欄位)
- 所有 `FileEntry` 比對 consumer(tsc 會指出)
- `_ct-workorders/PLAN-023-filetree-architecture-cleanup.md`(更新階段 3 狀態為 DONE)

**可能需要的改動**:
- FileEntry 建構點(檔案讀取 / IPC 回應處理處)需新增 `pathKey: toPathKey(entry.path)`
- 所有現有的 `.toLowerCase()` / `normalize` 散寫點改為直接比對 `pathKey`

### 驗收條件

- [ ] FileTree.tsx 拆成 4 檔,主檔案 <250 行
- [ ] `FileEntry.pathKey` 欄位加入型別定義
- [ ] 所有 FileEntry 比對點改用 `pathKey`(grep `\.path\s*===` / `\.path\.toLowerCase` 清零,除非明確是 display 用途)
- [ ] `npx vite build` **0 錯誤**
- [ ] 手動 smoke 至少 4 情境通過:
  1. 啟動 app → FileTree 載入檔案列表
  2. Click 檔案節點 → 正確 highlight + 右側顯示內容
  3. 程式觸發 reveal(例如搜尋結果 click)→ TreeNode 展開 + scroll 到位
  4. Checkbox toggle → 狀態正確記錄(若有)
- [ ] 更新 PLAN-023 狀態為 DONE(階段 3 完成)
- [ ] commit 遵循 atomic 原則,建議拆:
  - commit 1:拆檔(FileTreeNode / FileTreeMarkdown / filePathKey utils)
  - commit 2:`FileEntry.pathKey` 欄位 + 全 consumer 切換
  - 或單一 commit 若 Worker 判斷拆反而更難 revert

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示,都必須填寫。
> **本張為 YOLO 模式**:完成後自動 auto-submit「T0216 完成」字串到塔台,不要改字串格式。
> **BUG-050 階段 1 觀察**:本張派發會經過 `[T0215-DEBUG-REMOVE]` log 路徑,若發現 `writeResp` payload 非 `{ok:true,reason:"queued"}` 格式,請在回報區附上實際 payload(協助塔台評估階段 2 必要性)。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 載入前置條件中的文件(先 PLAN-023 + T0211 理解原設計)
4. locate `FileEntry` 型別定義位置
5. 先做拆檔(比型別改動低風險)
6. 拆完 `npx vite build` 確認綠
7. 再做 `pathKey` 欄位 + 全 consumer 切換
8. tsc-driven 照編譯錯誤逐一修
9. `npx vite build` 綠後手動 smoke 4 情境
10. 更新 PLAN-023 階段 3 狀態
11. 填寫回報區 + 狀態(DONE / PARTIAL / FAILED / BLOCKED)+ 完成時間
12. YOLO auto-submit「T0216 完成」

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
(DONE / FAILED / BLOCKED / PARTIAL)

### 產出摘要
(列出新建檔案、修改檔案、關鍵變更、FileTree.tsx 最終行數、consumer 改動處數)

### 互動紀錄
(yolo 模式通常無互動,若有請記錄)

### Renew 歷程
(無 Renew 填「無」)

### 遭遇問題
(若 tsc 報錯超出預期、發現型別定義位置與預期不同、FileEntry consumer 超出 FileTree 範圍遠超預估等,在此描述)

### 階段 1 YOLO log 觀察(BUG-050 驗證附帶)
(本張派發當下的 `writeResp` payload 結構 / 是否出現 `[T0215-DEBUG-REMOVE]` log / 任何 silent drop 跡象)

### Worker time 估算
(預估 vs 實際,供 GP042 累積樣本)

### sprint-status.yaml 已更新
(不適用,本專案未用 sprint-status)

### 回報時間
(填入當前時間)
