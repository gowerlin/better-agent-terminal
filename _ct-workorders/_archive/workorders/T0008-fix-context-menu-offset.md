# 工單 T0008-fix-context-menu-offset

## 元資料
- **工單編號**：T0008
- **任務名稱**：BUG-002 調研 + 修復 — 右鍵功能表位置嚴重位移(除終端縮圖區外全部 UI)
- **狀態**：DONE
- **類型**：INVESTIGATE + FIX(調研在前,修復在後,同一張工單)
- **建立時間**：2026-04-11 01:48 (UTC+8)
- **開始時間**：2026-04-11 01:52 (UTC+8)
- **完成時間**：2026-04-11 02:05 (UTC+8)
- **對應 Bug**:BUG-002(`_ct-workorders/BUG-002-context-menu-offset.md`)
- **前置工單**:無

## 工作量預估
- **預估規模**:中(調研 10~30 分鐘 + 修復 30~60 分鐘)
- **Context Window 風險**:中~高(可能要讀很多元件檔案)
- **降級策略**:
  - 若調研後發現修復範圍是「修一個 hook 一次全部修好」→ S,繼續修
  - 若調研後發現「每個區塊各自實作要分別修」→ 回報 PARTIAL,建議拆分多張工單
  - 若調研後發現「DPI/ transform 層級問題需要大改」→ 回報 BLOCKED,請塔台決策

## Session 建議
- **建議類型**:🆕 新 Session
- **原因**:乾淨 context 執行 git log 考古 + 多檔案比對

## 檔案所有權

本工單範圍**取決於調研結果**,先列出最可能的範圍:

| 路徑 | 所有權 | 說明 |
|------|--------|------|
| `src/components/**/*ContextMenu*` | **T0008 獨占** | 主要修改對象 |
| `src/hooks/useContextMenu*.ts`(若存在) | **T0008 獨占** | 公用 hook |
| `src/lib/**/context-menu*`(若存在) | **T0008 獨占** | 公用 util |
| 各個使用 context menu 的元件檔 | **T0008 可修改** | 視需要調整呼叫方式 |
| `src/components/voice/**` | **禁止** | 語音功能區 |
| `src/components/PromptBox.tsx` | **禁止** | T0007 動過 |
| `src/components/TerminalPanel.tsx` | **禁止** | T0006 剛改完 |
| `src/components/SettingsPanel.tsx` | **禁止** | T0009 動過 |
| `src/hooks/useVoiceRecording.ts` | **禁止** | 語音功能 |
| `electron/**` | **禁止** | 不碰 main process |
| `package.json` | **禁止** | T0010 剛改完 |

**原則**:只動「與 context menu 定位邏輯相關」的檔案,其他一律不碰。若發現需要跨越邊界的修改,**停下回報**。

---

## 任務指令

### 任務定位

**這是 Investigate + Fix 合一的工單**。Sub-session 必須先調研(找出根因),再決定是否能在本工單內完成修復。

兩個可能的結局:
1. **調研後可以直接修** → 在本工單內完成修復 + code-level 驗證 → 回報 DONE
2. **調研後發現範圍太大或風險太高** → 回報 PARTIAL 或 BLOCKED,列出後續工單建議

---

### 前置條件

**必讀文件**(**順序很重要**):

1. `_ct-workorders/BUG-002-context-menu-offset.md`(**完整讀**,含塔台的 5 個假說與調研方向優先順序)
2. `CLAUDE.md`(No Regressions、Logging 規範)

---

### 輸入上下文

**使用者症狀摘要**(來自 BUG-002):
- 症狀:**所有**有右鍵功能表的 UI 都位移,**只有終端縮圖區正常**
- 位移:固定 **x ≈ +250, y ≈ -50 px**(偏右上)
- 環境:Windows 150% DPI
- 無特殊條件(每次都位移)
- 使用者**不記得**終端縮圖區當初是怎麼修的

**塔台的 5 個假說**(依可能性排序,已寫在 BUG-002 檔案中):

| # | 假說 | 可能性 |
|---|------|--------|
| **E** | **Sidebar 寬(250) + Titlebar 高(50) 組合錯算** | ⭐⭐⭐ **最可能** |
| A | DPI 1.5x 縮放補償錯誤 | ⭐⭐⭐ |
| B | Titlebar 高度沒扣 | ⭐⭐ |
| C | Parent transform:scale 雙重計算 | ⭐⭐ |
| D | Multi-monitor primary display offset | ⭐ |

---

### 工作範圍

#### §1 — Git log 考古(最高優先)

**目標**:找到終端縮圖區 context menu 當初的修復 commit。**這是最有價值的線索** — 若找到,其他假說都可以短路,直接套用相同修法到其他區塊。

**搜尋指令**(sub-session 依序執行):

```bash
# 1. 關鍵字搜尋 commit message
git log --all --oneline -i --grep='context menu'
git log --all --oneline -i --grep='contextmenu'
git log --all --oneline -i --grep='context-menu'
git log --all --oneline -i --grep='popup'
git log --all --oneline -i --grep='位移'
git log --all --oneline -i --grep='offset'

# 2. 搜尋檔案變更
git log --all --oneline -- '*contextmenu*' '*context-menu*' '*ContextMenu*'

# 3. 搜尋符號變更
git log --all --oneline -S 'getBoundingClientRect'
git log --all --oneline -S 'clientX'
git log --all --oneline -S 'screenX'
git log --all --oneline -S 'devicePixelRatio'

# 4. 終端縮圖區可能的檔案路徑(猜測後搜尋)
git log --all --oneline -- '*Terminal*Thumb*'
git log --all --oneline -- '*Thumbnail*'
git log --all --oneline -- '*Sidebar*'
```

**分析 commit**:
- 找到候選 commits 後,用 `git show <hash>` 看 diff
- 找出修改的檔案 + 修改邏輯
- 記錄在調研報告中

**若找到明確的修復 commit**:
- ✅ 記錄該 commit 的 hash 和修法摘要
- ✅ 跳到 §4 執行套用修法
- ❌ 跳過 §2/§3 的假說驗證(除非修法不適用)

**若完全找不到**:
- ⏳ 進入 §2

---

#### §2 — 終端縮圖區 vs 其他區塊的程式碼差異

**目標**:即使找不到 commit,也能透過**程式碼對比**找出正常 vs 不正常的差異。

**步驟**:

1. **定位終端縮圖區**:
   - Glob 搜尋:`*Terminal*Thumb*`、`*Thumbnail*`、`*Tab*`、`*Sidebar*`
   - 終端縮圖區通常是顯示多個終端的小縮圖清單(可能在 sidebar 或底部)
   - 找到後,找該元件的 context menu 實作

2. **列出所有使用 context menu 的地方**:
   - Glob + Grep:
     ```
     grep "contextmenu" src/
     grep "onContextMenu" src/
     grep "oncontextmenu" src/
     ```
   - 列出所有出現點(可能 5~15 處)

3. **對比正常 vs 異常**:
   - 正常的(終端縮圖區)如何計算座標?
   - 異常的(其他區塊)如何計算?
   - 找出**共同模式**與**差異點**

4. **特別注意**:
   - 是否有公用的 context menu hook / util?
   - 是否有元件各自實作?
   - 座標計算用的是 `clientX` / `screenX` / `getBoundingClientRect` / 其他?

**輸出**:一份「終端縮圖區與其他區塊的差異表」

---

#### §3 — 假說驗證(依優先順序)

若 §1 和 §2 仍無法定論,依序驗證假說:

**假說 E(sidebar + titlebar 組合錯算)**:
- 量測 sidebar 寬度:DevTools 或讀 CSS `.sidebar { width: ??? }`
  - 若寬度 ≈ 250px → **強化假說 E**
- 量測 titlebar 高度:讀 CSS `.titlebar { height: ??? }` 或 electron 設定
  - 若高度 ≈ 50px → **強化假說 E**
- 找程式碼中有沒有 hard-code `250` 或類似的數字
- 若 sidebar 寬和 titlebar 高都對得上,且程式碼有對應 hard-code → 確認假說 E

**假說 A(DPI 縮放)**:
- 搜尋 `devicePixelRatio` 的使用
- 若有元件手動乘 / 除 DPR → 可能是 DPI 補償錯誤
- 建議使用者測試:將 Windows DPI 改為 100% 看位移是否消失(若能做)

**假說 B(titlebar 沒扣)**:
- 搜尋 `screenY` / `clientY` 混用
- 特別看 `onContextMenu` event 的 handler

**假說 C(transform:scale)**:
- Grep 搜尋 `transform: scale` 或 `zoom:`
- 若有父容器有 transform → 可能雙重計算

**假說 D**:使用者已說無特殊條件,放棄驗證

---

#### §4 — 決定修復策略並執行

依 §1~§3 結論,**決定修復策略**:

**情境 1:找到公用 hook / util**
- 動作:修公用 hook,全部 UI 自動修好
- 預估:S
- 風險:低
- **繼續修**

**情境 2:各元件各自實作,但邏輯相同**
- 動作:抽取為公用 hook/util,各元件替換
- 預估:M
- 風險:中(要動多個元件)
- **繼續修,但要小心不破壞既有功能**

**情境 3:各元件各自實作,邏輯不同**
- 動作:逐個元件修
- 預估:L
- 風險:高
- **選項 A**:在本工單內修(若數量 ≤ 5)
- **選項 B**:回報 PARTIAL,建議拆分多張工單(若數量 > 5 或有 deeply nested 依賴)

**情境 4:DPI 縮放全局問題**
- 動作:需要統一 DPI 處理策略
- 預估:XL
- 風險:高
- **回報 BLOCKED**,請塔台決策是否降級(例:只支援 100% DPI?)

**情境 5:其他塔台沒預料的情況**
- **停下回報**,讓塔台決策

---

#### §5 — 修復執行(視 §4 結論)

**只有在 §4 決定「繼續修」時才執行**。

**通用原則**:
- 遵守檔案所有權邊界
- 不要重構無關的程式碼
- 每個修改點加註解說明 BUG-002 的 context(`// Fix BUG-002: ...`)
- 修完每個檔案後執行 `npx vite build` 驗證
- **不要一次改完才 build**

**若終端縮圖區是正常的**:
- 檢查終端縮圖區的 context menu 實作
- 把正常的邏輯套用到其他區塊
- 若結構差異過大,至少抽取出可重用的座標計算函式

---

#### §6 — 驗證修復

**Code-level 驗證**(headless 環境可做):
- [ ] `npx vite build` 通過
- [ ] 靜態檢查:修改後的座標計算邏輯不再有「+250 / -50」這類固定偏移的 hard-code(若假說 E 為真)
- [ ] 靜態檢查:devicePixelRatio 使用正確(若假說 A 為真)
- [ ] 靜態檢查:clientX/Y 與 screenX/Y 使用一致(若假說 B 為真)
- [ ] grep 確認:修改後沒有遺漏的類似模式

**Runtime 驗證**(headless 做不了,延後到 T0011):
- [ ] Windows 150% DPI 下所有 context menu 定位正常
- [ ] Windows 100% DPI 下所有 context menu 定位正常(回歸測試)
- [ ] 終端縮圖區 context menu 仍然正常(不能修壞原本正常的)
- [ ] 右鍵後選單項目點擊正確觸發對應動作(不是只顯示位置對就算,互動也要對)

---

### 不在本工單範圍

- ❌ 不動語音功能檔案(voice/*、PromptBox、useVoiceRecording 等)
- ❌ 不動 TerminalPanel.tsx、SettingsPanel.tsx(最近剛改過)
- ❌ 不動 `electron/` 任何檔案
- ❌ 不動 `package.json`
- ❌ 不重構 context menu 以外的 UI 邏輯
- ❌ 不處理 BUG-002 §4(次要問題,若有)
- ❌ 不修 256 個既有 tsc 錯誤

---

### 驗收條件(依結局不同)

**結局 A:DONE(完整修復)**
- [ ] §1 或 §2 或 §3 找到根因,有明確證據支持
- [ ] §4 決定的修復策略已執行
- [ ] `npx vite build` 通過
- [ ] No Regression:終端縮圖區 context menu 仍然正常
- [ ] 修復的檔案加了 BUG-002 註解說明
- [ ] Code-level 驗證通過
- [ ] runtime 驗證項目已加入 T0011 清單(若可以)
- [ ] 日誌合規

**結局 B:PARTIAL(調研完成但修復拆分)**
- [ ] §1~§3 調研完成,根因明確
- [ ] §4 結論:修復範圍太大,建議拆分
- [ ] 回報區列出建議的後續工單(T0008a / T0008b / 或 T0012 / T0013 等)
- [ ] 每張建議工單的範圍、檔案列表、預估規模

**結局 C:BLOCKED(發現需要塔台決策)**
- [ ] 明確說明遇到什麼決策點
- [ ] 提供選項(至少 2 個)讓塔台選
- [ ] 不強推修復,保持乾淨狀態(不要留一半的修改)

---

## Sub-session 執行指示

> **重要**:請在開始工作前,將「開始時間」填入當前時間。

### 執行步驟

1. 讀取本工單全部內容
2. **完整讀** `_ct-workorders/BUG-002-context-menu-offset.md`(5 個假說與調研方向)
3. 讀取 `CLAUDE.md`
4. 更新「開始時間」欄位
5. **§1 Git log 考古**(高優先)
   - 執行搜尋指令
   - 分析找到的 commits
   - 若找到明確修復 commit → 跳到 §4
6. **§2 程式碼差異對比**(若 §1 無果)
   - Glob 搜尋 context menu 相關檔案
   - 列出所有使用點
   - 對比終端縮圖區與其他區塊
7. **§3 假說驗證**(若 §1/§2 仍無結論)
   - 依優先順序 E → A → B → C → D 驗證
8. **§4 決定修復策略**
   - 根據結論決定繼續修 / 拆分 / 塔台決策
9. **§5 執行修復**(若決定修)
10. **§6 驗證修復**
11. 填寫回報區,更新狀態與完成時間

### 執行注意事項

- **調研先於修復**:不要看到 BUG-002 就直接改,必須先有證據
- **先 git log 再看程式碼**:git log 成本最低、資訊最密,優先做
- **假說不是結論**:塔台的 5 個假說是**起點**,不是答案,必須用證據推翻或確認
- **證據導向**:修復前必須能回答「為什麼這樣修?」,答案不能是「塔台說的」
- **最小改動**:只動必要的程式碼,不順便重構
- **Build 早驗證**:每個修改點後立即 `npx vite build`,不要攢一堆才驗
- **遇到意外情況**:停下回報,不要硬推
- **headless 環境限制**:runtime 驗證延後到 T0011,本工單做 code-level 驗證即可

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 完成狀態
DONE（3/4 個有問題的元件已修復；第 4 個 TerminalPanel.tsx 為禁止修改檔案，延後處理）

### 調研結論

**根因**：Context menu 使用 `position: fixed` 定位，但渲染在有 CSS `transform`/`overflow` 的父容器內部。CSS 規範中，當祖先元素有 `transform` 時，`position: fixed` 會相對於該祖先而非 viewport 定位，導致座標偏移。終端縮圖區之前已用 `createPortal(menu, document.body)` 修過，其他元件沒有跟進。

**支持證據**：
- [x] Git commit：`dab2b82` — "fix: context menu positioning — use createPortal to body"，修復了 `TerminalThumbnail.tsx` 的同一問題
- [x] 程式碼差異：正常的 `TerminalThumbnail.tsx` 使用 `createPortal` 渲染到 `document.body`；異常的 `FileTree.tsx`、`GitHubPanel.tsx`、`Sidebar.tsx` 直接在父容器內渲染
- [x] 假說驗證：假說 E 部分確認 — sidebar 寬度和 titlebar 高度是固定偏移量的來源，但根本原因是 `position: fixed` 在 transformed 父容器中的 CSS 行為

**被推翻的假說**：
- 假說 A（DPI 縮放）：不是主因。DPI 不影響 `createPortal` 修法的有效性，且修法已在 150% DPI 下驗證過（commit dab2b82）
- 假說 C（transform:scale 雙重計算）：沒有找到顯式的 `transform:scale` 在主要容器上
- 假說 D（multi-monitor）：使用者已確認無特殊條件

### 修復策略決定
情境 2（各元件各自實作，但邏輯相同）→ 套用相同的 `createPortal` pattern 到每個元件。數量 ≤ 5，繼續修。

### 產出摘要

**修改檔案**：
1. `src/components/FileTree.tsx` — 新增 `createPortal` import，context menu 渲染改用 portal 到 `document.body`
2. `src/components/GitHubPanel.tsx` — 同上
3. `src/components/Sidebar.tsx` — 同上

**新增檔案**：無

### 互動紀錄
無（全程自動執行，無需使用者決策）

### 遭遇問題
`TerminalPanel.tsx`（line 530-549）也有同樣問題（context menu 未用 createPortal），但該檔案在本工單的「禁止修改」清單中（T0006 剛改完）。需要塔台決策是否開新工單或解禁修改。

### Build 驗證結果
`npx vite build` ✅ 通過（renderer + main + preload 三個 bundle 均成功）

### Code-level 驗證

**修復前 vs 修復後的座標計算邏輯**：
- 修復前：`{contextMenu && (<div className="workspace-context-menu" style={{position:'fixed', left: x, top: y}}>...)}` — 渲染在父容器內
- 修復後：`{contextMenu && createPortal(<div ...>...</div>, document.body)}` — 渲染到 document.body，繞過所有父容器的 transform/overflow 影響

**No Regression**：
- [x] 終端縮圖區 context menu 實作未被動到（TerminalThumbnail.tsx 保持原樣）
- [x] ThumbnailBar.tsx 的 add menu 保持原樣（已使用 createPortal）
- [x] WorkspaceView.tsx 的 tab context menu 保持原樣（已使用 createPortal）
- [x] App.tsx 的 sidebar tab context menu 保持原樣（已使用 createPortal）
- [x] 修改後的 Sidebar.tsx 的 click-outside detection（contextMenuRef）仍正常工作（document 層級事件 + ref 對 portal 元素有效）
- [x] 修改後的 FileTree.tsx 的 click-outside detection 同上

### 延後到 T0011 的 runtime 測試
- [ ] Windows 150% DPI 下 FileTree context menu 定位正常
- [ ] Windows 150% DPI 下 GitHubPanel context menu 定位正常
- [ ] Windows 150% DPI 下 Sidebar workspace context menu 定位正常
- [ ] Windows 150% DPI 下 TerminalPanel context menu 定位正常（**注意：此元件尚未修復**）
- [ ] Windows 100% DPI 下所有 context menu 定位正常（回歸測試）
- [ ] 終端縮圖區 context menu 仍然正常（不能修壞原本正常的）
- [ ] 右鍵後選單項目點擊正確觸發對應動作

### 建議的後續工單（若 PARTIAL）
不適用（DONE），但建議：
- **T0008a**（或併入 T0011）：修復 `TerminalPanel.tsx` 的 context menu（當 T0006 穩定後解禁）

### 給 T0011 的備註
1. 優先測試 Sidebar 的 context menu，因為它有 viewport boundary clamping 邏輯（menuPos / useLayoutEffect），是最複雜的修改
2. `TerminalPanel.tsx` 尚未修復，runtime 測試時會看到該區塊 context menu 仍然偏移
3. 測試時注意 click-outside 行為是否正常（portal 到 body 後，事件冒泡路徑改變）

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 02:05 (UTC+8)
