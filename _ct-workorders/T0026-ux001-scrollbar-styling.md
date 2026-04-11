# 工單 T0026-ux001-scrollbar-styling

## 元資料
- **編號**：T0026
- **類型**：UX Enhancement（使用者 dogfood 主動提案）
- **狀態**：DONE
- **優先級**：🟡 Medium
- **建立時間**：2026-04-11 19:40 (UTC+8)
- **開始時間**：2026-04-11 19:56 (UTC+8)
- **完成時間**：2026-04-11 20:01 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0025（BUG-007/009 hotfix + L018 已完成，commit `ad61784` 需先 push 到 origin/main）
- **目標子專案**：（單一專案）
- **後續工單**：T0027（BAT 右鍵互動系統 investigation — 精簡版 Part A）

## 工作量預估
- **Session 建議**：可接續同一 session 或新 session（context 預估小）
- **工作量上限**：**45 分鐘**（硬性上限，超時 STOP 並回報塔台）
- **複雜度**：低（全域 CSS + 可能的容器層 class 套用）

## Session 建議
- 新 session 推薦（context hygiene）
- 建議在 **BAT dogfood** 終端執行

## 背景

### 戰略脈絡
這是使用者在 2026-04-11 17:xx dogfood 時**主動提出的 UX enhancement**，非 bug 修復。動機是：
1. 現有 scrollbar 太細，滑鼠不好定位和選取
2. scrollbar 有/無切換時容器寬度跳動，造成 render 跳動

塔台記錄在 BUG Tracker 的 UX-001 條目。

### 使用者原始需求（摘自 _tower-state.md）
- **需求**：改善所有使用 scrollbar 之處的 UX
- **具體要求**：
  1. **加粗 60%**：目前 scrollbar 太細，滑鼠不好定位
  2. **永遠顯示佔位**：用 `disabled` 樣式或 `overflow: scroll` 取代 `overflow: auto`
     - 原因：避免有/無 scroll 切換造成 render 跳動
- **適用範圍**：使用者明確說 "all places"

### 累積訊號提醒
BUG-002 / BUG-008 / BUG-009 / UX-001 形成 **「BAT overlay/menu/focus/layout 管理系統」** 4 個相關議題。T0025 已修 BUG-009。本工單修 UX-001 後剩 BUG-008（獨立調研工單）。

### 可能的意外加值（非目標，但值得觀察）
使用者之前觀察到 **BUG-008（render 錯位）與 UX-001 可能共通根因** —都是容器寬度動態變化的 layout 問題。若本工單把 `scrollbar-gutter: stable` 套用好，**可能減輕 BUG-008 觸發率**（但無法根治）。sub-session 在驗證時若方便可以順便觀察，但**不要主動去修 BUG-008**（scope creep protection）。

## 任務指令

### BMad 工作流程
不適用（UX enhancement）

### 前置條件
1. ✅ T0025 已完成（commit `ad61784` 已 merge **且 push 到 origin/main**）
2. ✅ `main` 分支 working tree 必須符合以下**精準**狀態：
   - 恰好 **1 個 `??`**：`_ct-workorders/T0026-ux001-scrollbar-styling.md`（本工單檔案自身，GA006 預期）
   - **無任何** `M` / `A` / `D`
   - **無其他** `??`
   - 若有其他未預期變更 → **STOP 回報**
3. ✅ `HEAD == origin/main == ad61784`（用 `git log --oneline -1` 驗證）
4. ⚠️ 本工單**開工後**會把 T0026 工單檔案自身從 `??` → `A` → `M`，屬於 **GA006 預期**

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **目標**：全域 scrollbar 樣式（所有 overflow 容器，**除 xterm.js 內建 scrollbar**）
- **技術參考**：modern CSS `scrollbar-gutter: stable`（Chromium 支援度 94+，Electron 應支援）
- **相關工單**：無直接前置，本工單獨立

### 任務目標（精確描述）

#### 目標 1：Scrollbar 加粗 60%
1. **盤點現有 scrollbar 樣式**：
   - Grep 找 `::-webkit-scrollbar`、`scrollbar-width`、`overflow:` 等關鍵字
   - 記錄當前樣式定義位置（可能在 `src/styles/*.css` 或 component 內 CSS-in-JS）
2. **套用加粗 60%**：
   - 若現有 width 約 8-10px → 新 width 約 13-16px
   - 使用 `::-webkit-scrollbar { width: <new>px; height: <new>px }` 全域選擇器
   - 若本專案有 CSS reset / theme layer，放在最合適的層級
3. **保持一致性**：vertical + horizontal scrollbar 都加粗

#### 目標 2：永遠顯示佔位（避免 layout 跳動）
1. **方案選擇**：
   - **優先**：使用 modern CSS `scrollbar-gutter: stable` 全域套用（最乾淨）
   - **次優**：若 `scrollbar-gutter` 不適用於某些容器，fallback 為 `overflow: scroll`（強制顯示）+ disable scrollbar 視覺（無內容時）
2. **適用範圍**：
   - ✅ 所有 overflow 容器（側邊欄、Settings、PromptBox、tab 列表等）
   - ❌ **不動 xterm.js 內建 scrollbar**（xterm 有自己的 scroll handling，不在本工單範圍）
3. **驗證**：手動（或 code review）確認沒有容器因 scroll 切換造成寬度跳動

#### 目標 3：不誤傷任何既有功能
1. 確保 `npx vite build` 通過
2. 確保 Electron app 啟動後，所有 overflow UI 正常顯示（無破版）
3. 確保 xterm.js terminal 本身的 scrollbar 行為不變

### 不動範圍（scope creep protection）
- ❌ **不處理 BUG-008**（overlay 捲動錯位）— 獨立調研工單，本工單觀察即可
- ❌ **不動 xterm.js 內建 scrollbar**（xterm 有自己的 canvas render，不在 global CSS 覆蓋範圍）
- ❌ **不處理 BUG-007/009**（已在 T0025 修復）
- ❌ **不升級或降級任何 dep**
- ❌ **不改 layout / Portal / overlay 架構**
- ❌ **不處理 4 張 PARTIAL 漂移補填**（獨立工單）
- ❌ **不改 theme system / color token**（只改 scrollbar size 相關）

### 驗收條件
1. ✅ `::-webkit-scrollbar` 或等價規則已套用新 width（明顯加粗）
2. ✅ `scrollbar-gutter: stable` 或等價佔位機制已套用到合適容器
3. ✅ `npx vite build` 通過（無新 TypeScript / CSS 錯誤）
4. ✅ 若 sub-session 能跑 `npm run dev`，手動驗證：
   - Scrollbar 明顯比原本粗
   - 容器內容從「無 scroll」切到「有 scroll」時，寬度**不跳動**
   - xterm terminal 的 scroll 行為**不受影響**
5. ✅ Git working tree clean
6. ✅ 2 個 atomic commits：
   - `feat(ui): widen scrollbar and stabilize gutter (UX-001)`
   - `chore(tower): T0026 UX-001 closure`
7. ✅ 45 分鐘內完成

### 失敗處理 / STOP 條件

立即 **STOP** 並回報塔台的情境：

1. 🛑 **45 分鐘硬性上限**
2. 🛑 **`scrollbar-gutter: stable` 在本專案 Electron 版本不支援**（需要 fallback 策略討論）
3. 🛑 **套用全域 `::-webkit-scrollbar` 後某容器破版**（需要逐容器評估）
4. 🛑 **xterm.js scrollbar 意外被影響**（需要撤回全域規則，改為容器 scoped）
5. 🛑 **現有 CSS architecture 複雜到需要重構才能套用**（scope creep 警告）
6. 🛑 **`npx vite build` 失敗**

回報時請提供：
- 卡在哪一步
- 當前樣式盤點結果
- 錯誤訊息原文
- 建議下一步

**禁止的行為**：
- ❌ `--no-verify` / `--force`
- ❌ 為了套用統一規則而重寫 theme system
- ❌ 為了解決 xterm 副作用而降級 xterm.js
- ❌ scope creep 到 BUG-008 / 其他 layout 問題

## Sub-session 執行指示

### 執行步驟

1. **環境檢查（精準前置條件驗證）**
   - `cd` 到專案根目錄
   - `git status --porcelain` 預期輸出**恰好這一行**：
     ```
     ?? _ct-workorders/T0026-ux001-scrollbar-styling.md
     ```
   - `git log --oneline -1` 驗證 `HEAD == ad61784`
   - 若前置條件不符 → **STOP 回報**
   - ✅ 驗證通過後，把 T0026 工單狀態 `TODO → IN_PROGRESS`，開始時間填入元資料

2. **盤點現有 scrollbar 樣式**
   - `git grep -n "::-webkit-scrollbar" -- src/` 或等價
   - `git grep -n "scrollbar-width" -- src/`
   - `git grep -n "scrollbar-gutter" -- src/`
   - 記錄所有匹配到的位置與當前值

3. **設計新規則**
   - 決定 scrollbar 新 width（建議 13-16px）
   - 決定 scrollbar-gutter 策略（stable / stable both-edges / fallback）
   - 決定放在哪個 CSS 層級（全域 / theme / component）
   - 若發現有不可避免的 trade-off（例如某容器必須 opt-out），在回報區說明

4. **實作**
   - Edit CSS 檔案
   - 套用新規則

5. **Build 驗證**
   - `npx vite build`
   - 確認 exit 0

6. **手動驗證（若可能）**
   - `npm run dev` 啟動 Electron
   - 目視檢查：
     - Scrollbar 明顯加粗 ✅
     - 容器切換無跳動 ✅
     - xterm terminal 正常 ✅
   - （若無法手動驗證，依程式碼層面確認）

7. **產生 Commit 1**：`feat(ui): widen scrollbar and stabilize gutter (UX-001)`
   - 包含的檔案：CSS 變更檔案
   - 不包含：`_ct-workorders/` 任何內容

8. **塔台 meta 更新**
   - **_tower-state.md checkpoint**：在檔末追加本輪 checkpoint：
     ```markdown

     ## 2026-04-11 HH:MM Checkpoint — T0026 DONE · UX-001 scrollbar styling

     ### T0026 狀態
     - 🔄 IN_PROGRESS → ✅ DONE
     - 時間：HH:MM → HH:MM

     ### 修復/增強摘要
     - **UX-001**：<CSS 檔案:行號> <做法摘要>

     ### Bug Tracker 更新
     - UX-001: 📋 待分派 → ✅ 已實作（code-level；runtime 待使用者 dogfood 驗證）

     ### 意外觀察（若有）
     - BUG-008 是否仍然觸發：<手動觀察結果 / 未驗證>

     ### Git 進度
     - Commit 1: `<hash> feat(ui): widen scrollbar and stabilize gutter (UX-001)`
     - Commit 2: `<hash> chore(tower): T0026 UX-001 closure`

     ### NEXT SESSION TODO（更新）
     1. **T0027** BAT 右鍵互動系統 investigation（Part A 精簡版）— **塔台已決議，等本工單後派**
     2. **BUG-008** overlay 錯位（獨立調研工單）
     3. **T0023**（Phase 1 Voice Download 4 項 E2E）
     4. **4 張 PARTIAL 漂移補填**
     5. GA006 / L017 / L018 全域化決策
     ```

9. **產生 Commit 2**：`chore(tower): T0026 UX-001 closure`
   - 檔案清單（預期 2 個）：
     - `_ct-workorders/T0026-ux001-scrollbar-styling.md`（含回報區）
     - `_ct-workorders/_tower-state.md`（本輪 checkpoint）
   - 確認 working tree clean

10. **填寫回報區** + **呼叫 `/ct-done T0026`**（或直接回報塔台）

### 學習鉤子

若遇到以下情況，記錄到「學習鉤子候選」：
- `scrollbar-gutter: stable` 在本專案 Electron 版本的支援情況（可能 L019）
- 全域 `::-webkit-scrollbar` 影響 xterm.js 的意外副作用（可能 TG009）
- 本專案 CSS architecture 的層次結構（某些規則需要放在特定層級才生效）
- 本工單若意外減輕了 BUG-008 觸發率 → 記錄「共通根因驗證」觀察

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

#### 當前 scrollbar 樣式盤點
- `src/styles/base.css:45-48`：全域 `::-webkit-scrollbar`（原本 `width/height: 10px`）
- `src/styles/base.css:66-86`：xterm 專屬 scrollbar 覆寫（`width: 8px`）
- `src/styles/panels.css:145-153`：`.thumbnail-list` 有 `overflow-x: auto` + `scrollbar-width: thin`
- `scrollbar-gutter` 盤點：`src/` 無既有規則（需新增）

#### 新規則設計
- 新 width：`16px`（由 10px 加粗約 60%）
- scrollbar-gutter 策略：`stable` 全域套用，`.xterm-viewport` 明確 `auto` opt-out
- CSS 放置層級：`全域（src/styles/base.css reset + scrollbar 區塊）`

#### 實作變更
- 修改的檔案：`src/styles/base.css:1-74`、`src/styles/panels.css:145-153`
- 關鍵改動：
  ```css
  * { scrollbar-gutter: stable; }

  ::-webkit-scrollbar {
    width: 16px;
    height: 16px;
  }

  .xterm-viewport { scrollbar-gutter: auto; }
  .xterm-viewport::-webkit-scrollbar { width: 8px; height: 8px; }
  ```

### Build 驗證
```
npx vite build ✅ 通過（renderer / electron main / preload 全部成功輸出）
```

### 手動驗證（若執行）
- [ ] Scrollbar 明顯加粗：未驗證（未啟動 GUI dogfood）
- [ ] 容器無跳動：未驗證（code-level 已套用 `scrollbar-gutter: stable`）
- [ ] xterm 正常：未驗證（code-level 已加 `.xterm-viewport` opt-out）
- [ ] **意外觀察**：BUG-008 是否仍觸發：未驗證

### Commits
```
fd3e7af feat(ui): widen scrollbar and stabilize gutter (UX-001)
(pending) chore(tower): T0026 UX-001 closure
```

### 互動紀錄
無

### 遭遇問題
無

### 學習鉤子候選
- `scrollbar-gutter: stable` 可於本專案 Electron 版本編譯通過；搭配 `.xterm-viewport { scrollbar-gutter: auto; }` 可避免誤傷 terminal scrollbar。

### sprint-status.yaml 已更新
不適用（專案無 sprint-status.yaml）

### 回報時間
2026-04-11 20:01 (UTC+8)
