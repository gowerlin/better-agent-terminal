# 工單 T0028-bug008-overlay-scroll-drift

## 元資料
- **編號**：T0028
- **類型**：Dogfood Bug Fix（調研 + 修復）
- **狀態**：DONE
- **優先級**：🟡 Medium（使用者明確指出「嚴重影響視覺互動」）
- **建立時間**：2026-04-11 20:45 (UTC+8)
- **開始時間**：2026-04-11 20:51 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0027（commit `b2679f7` 需先 push 到 origin/main）
- **目標子專案**：（單一專案）
- **後續工單**：TBD（視本工單發現的根因決定）

> **⚠️ 本工單首次套用 L021 新架構 — Tower/Worker 職責分界**
>
> **Worker 不得修改**任何 `_ct-workorders/_*.md`（所有底線開頭的塔台私域 meta 檔）。
> Worker 唯一可寫的 meta 檔是**本工單自身**（T0028 的回報區）。
>
> **預期的 M 檔案** `_ct-workorders/_learnings.md` **已由塔台預先寫入** L019/L020/L021，
> Worker 的任務是**原樣 stage**（不修改內容、不追加任何新內容），納入 Commit 2。

## 工作量預估
- **Session 建議**：新 session（乾淨 context）
- **工作量上限**：**60 分鐘**（硬性上限，超時 STOP 並回報塔台）
- **複雜度**：中（可能涉及 Portal/layer/scroll event 多個層面）

## Session 建議
- 新 session 推薦（context hygiene）
- 建議在 **BAT dogfood** 終端執行（使用者可即時體感驗證）

## 背景

### 戰略脈絡
使用者在 2026-04-11 17:xx dogfood 時**直接回報**：終端捲動時 overlay UI 殘留在錯誤位置，**嚴重影響視覺互動**。使用者在 2026-04-11 20:xx 明確指示「**今天要把回報的 BUG 解除**」—本工單即為對此指示的回應。

### BUG-008 現象（複述）

**症狀**：
- 終端捲動（scroll）時，overlay UI 元素未跟著捲動更新位置
- 造成**視覺錯位 / 殘留框框疊在當前內容上**
- 使用者明確說「嚴重影響視覺互動」

**附圖**（使用者本機路徑，**不在 repo 內**，Sub-session 無法存取）：
- `D:\Downloads\2026-04-11_162127.png` — 大範圍 render 錯位，對話區塊內容重疊
- `D:\Downloads\2026-04-11_162806.png` — 終端中白色框框疊在文字上

**技術背景**（初步分析）：
- xterm.js 是 **canvas-based render**，用 virtual scroll 管理顯示內容
- React 管理的 overlay（selection box / context menu / popover / 提示框）是**獨立 DOM layer**
- 兩個 layer 用不同機制追蹤 scroll offset，捲動時容易不同步

### 可能的 layer 脫鉤點（候選假設）

| # | 假設 | 驗證方式 |
|---|------|---------|
| **H-BUG008-1** | Portal 元素的 `top`/`left` 是在 mount 時計算的靜態值，沒有跟著 scroll 事件 reposition | grep Portal + position 計算 |
| **H-BUG008-2** | 右鍵功能表 Portal（T0008/T0012 修的 BUG-002 延伸問題）— 同一元件的 scroll 副作用 | 讀 T0008/T0012 修改的 handler |
| **H-BUG008-3** | 語音預覽框 popover（T0007 產出）捲動時位置沒更新 | grep VoicePreview / popover |
| **H-BUG008-4** | xterm.js 觸發 scroll 時，overlay element 的位置計算沒重新執行 | 搜尋 xterm.js onScroll 訂閱 |
| **H-BUG008-5** | 多個終端分頁時，某個隱藏終端的 overlay 沒被正確 unmount | grep useEffect cleanup + Portal |

### ⚠️ L019 套用：假設集**必須**包含第三方 lib 選項

依 L019，本工單的假設集應包含：

| # | 假設 | 驗證方式 |
|---|------|---------|
| **H-BUG008-6** | xterm.js 內部的 scroll event 觸發時機與 React overlay 的 re-render 時機不同步（xterm.js canvas render 在 overlay DOM 更新之前） | 讀 `node_modules/@xterm/xterm/src/*` 的 scroll 處理 + BAT 訂閱層 |

### 相關工單 / 學習引用

- **L011**：`position: fixed` + `transform` 祖先陷阱（BUG-002 根因）
- **T0006 / T0008 / T0012**：修過 TerminalPanel 的 paste / context menu / Portal
- **T0025**：剛修過 TerminalPanel 的 BUG-007/009（focus 與 filter）— **T0025 的修改可能與 BUG-008 有交互作用**
- **T0026**：剛套用 `scrollbar-gutter: stable` 全域 + `.xterm-viewport { scrollbar-gutter: auto }`
- **T0027 結論**：BAT 本家 `src/` 完全沒有主動偵測 terminal mode，右鍵互動決策在 xterm.js 內部（H-BUG008-6 成立的間接證據）

### 本工單**不**處理的議題

- ❌ **UX-001 scrollbar 加粗** — 已在 T0026 完成
- ❌ **BUG-009 右鍵 focus** — 已在 T0025 完成
- ❌ **BUG-007 OSC 52 debug** — 已在 T0025 完成
- ❌ **架構審視工單** — 若 4 個 overlay 相關議題共根因，塔台**未來**會派 architecture audit 工單，本工單**僅修 BUG-008 這個具體現象**
- ❌ **任何 `_ct-workorders/_*.md` 的修改**（L021 新架構強制禁止）

## 任務指令

### BMad 工作流程
不適用（dogfood bug fix）

### 前置條件
1. ✅ T0027 已完成（commit `b2679f7` 已 merge 且 push 到 origin/main）
2. ✅ `main` 分支 working tree 必須符合以下**精準**狀態：
   - 恰好 **1 個 `M`**：`_ct-workorders/_learnings.md`（**塔台已預寫 L019/L020/L021，Worker 請勿修改內容**）
   - 恰好 **1 個 `??`**：`_ct-workorders/T0028-bug008-overlay-scroll-drift.md`（本工單檔案自身）
   - **無任何** `A` / `D`
   - **無其他** `M` / `??`
   - 若有其他未預期變更 → **STOP 回報**
3. ✅ `HEAD == origin/main == b2679f7`（用 `git log --oneline -1` 驗證）
4. ⚠️ 本工單**開工後**會把 T0028 工單檔案自身從 `??` → `A` → `M`，屬於 **GA006 預期**

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **目標檔案**：`src/components/TerminalPanel.tsx`（核心）+ 其他 overlay 元件
- **可讀的參考檔案**：
  - `node_modules/@xterm/xterm/src/*`（只讀，理解 scroll event API）
  - T0006 / T0008 / T0012 / T0025 的 commit history（`git log -p src/components/TerminalPanel.tsx`）
- **相關學習**：L011（fixed + transform）+ L019（第三方 lib 假設）

### 任務目標（精確描述）

#### 階段 1：調研根因（預估 15-25 min）

1. **識別 overlay 元件清單**：
   - `git grep -n "createPortal\|ReactDOM.createPortal" -- src/`
   - 識別所有使用 Portal 的元件（context menu / voice preview popover / 等）
2. **讀取各 overlay 的定位邏輯**：
   - 找出每個 Portal 的 `top` / `left` / `position` 計算位置
   - 判斷是**一次性計算**還是**動態更新**
3. **尋找 scroll event 訂閱**：
   - `git grep -n "onScroll\|scrollHandler\|addEventListener.*scroll" -- src/`
   - `git grep -n "term.onScroll\|xterm.*onScroll\|terminal.*scroll" -- src/`
   - 檢查 BAT 是否訂閱 xterm.js 的 scroll event
4. **最有可能的根因排序**：
   - 依證據將 H-BUG008-1 ~ H-BUG008-6 六個假設排序
   - 選定**信心最高**的假設作為修復目標
5. **記錄根因分析**到回報區「根因分析」欄位

#### 階段 2：設計修復方案（預估 5-10 min）

1. **選擇修復策略**（以下為常見 pattern，Sub-session 自行依根因選擇）：
   - **Pattern A**：訂閱 xterm.js `onScroll`，在回調中重算 overlay 位置
   - **Pattern B**：overlay 使用 `position: absolute` 相對於可捲動容器（非 `position: fixed` 相對於 viewport）
   - **Pattern C**：scroll 發生時**直接 dismiss overlay**（最簡單，但 UX 較差）
   - **Pattern D**：引入 Floating UI / Popper.js（scope creep 警告，**不推薦**）
2. **判斷是否需要逐元件處理**：
   - 若多個 Portal 共享同一 bug → 抽共用 hook（`usePositionedOverlay` 之類）
   - 若只有一個元件有問題 → 直接修該元件
3. **評估對既有功能的影響**：
   - T0025 的 BUG-009 focus 修復**是否會被影響**？
   - T0026 的 scrollbar-gutter**是否相關**？
   - Ctrl+V paste 路徑**是否受影響**？

#### 階段 3：實作修復（預估 10-20 min）

1. 根據根因和方案執行 Edit
2. 保持變更**最小範圍**（只改 BUG-008 相關邏輯）
3. 不動 L013 以外的 dep、不升級、不降級
4. **不 mock 任何驗收條件**

#### 階段 4：驗證（預估 5-10 min）

1. `npx vite build` 確認通過
2. 若可能，`npm run dev` 啟動並手動驗證：
   - 捲動終端，觀察 overlay 是否正確跟隨或正確 dismiss
   - 右鍵選單（BUG-002 修復）仍正常
   - 語音預覽 popover 仍正常
   - Ctrl+V paste 仍正常
3. 若無法手動驗證，以 code-level 確認 + 詳細說明理由

### 不動範圍（scope creep protection）
- ❌ **不修改任何 `_ct-workorders/_*.md`**（L021 強制禁止）
- ❌ **不動 T0025 / T0026 的現有修復**
- ❌ **不引入 Floating UI / Popper.js 等新 dep**
- ❌ **不升級 xterm.js / React / 任何既有 dep**
- ❌ **不重寫 Portal 架構**（scope creep 警告）
- ❌ **不處理 UX-001 / BUG-007 / BUG-009**（已完成）
- ❌ **不做 architecture audit**（塔台未來會派獨立工單）

### 驗收條件
1. ✅ `npx vite build` 通過
2. ✅ 根因分析完整（指出**哪個假設成立** + 證據 + 檔案:行號）
3. ✅ 修復方案**最小範圍**（改動行數盡量少）
4. ✅ BUG-008 現象**code-level 確認已修復**（邏輯上 overlay 會跟 scroll 同步或正確 dismiss）
5. ✅ T0025 / T0026 的既有修復未被誤傷（`git diff` 不涉及 BUG-007/009/UX-001 的程式碼）
6. ✅ Git working tree 在 Commit 2 之後 **clean**
7. ✅ 2 個 atomic commits：
   - `fix(ui): restore overlay position on terminal scroll (BUG-008)`
   - `chore(tower): T0028 closure + L019/L020/L021 carry`
8. ✅ Commit 2 包含**恰好 2 個檔案**：
   - `_ct-workorders/T0028-bug008-overlay-scroll-drift.md`（本工單，含回報區）
   - `_ct-workorders/_learnings.md`（**原樣 stage 塔台預寫的 L019/L020/L021**，Worker 不修改）
9. ✅ 60 分鐘內完成

### 失敗處理 / STOP 條件

立即 **STOP** 並回報塔台的情境：

1. 🛑 **60 分鐘硬性上限**
2. 🛑 **根因分析後發現 6 個假設全部不成立** — 需要塔台重新提出假設集
3. 🛑 **修復需要引入新 dep**（Floating UI 等）— scope creep 警告
4. 🛑 **修復需要重寫 Portal 架構** — architecture audit 範圍
5. 🛑 **發現 T0025 / T0026 的修復與 BUG-008 有衝突** — 需要塔台重新評估優先順序
6. 🛑 **`npx vite build` 在修復後失敗** — 引入了新錯誤
7. 🛑 **工作樹前置條件不符**（L019/L020/L021 被誤動、有其他 M、少了 `_learnings.md` 的 M）

回報時請提供：
- 卡在哪一步
- 已完成的根因分析（即使不完整）
- 錯誤訊息原文
- 你的觀察（**不要「建議下一步」** — 那是塔台決策）

**禁止的行為**：
- ❌ `--no-verify` / `--force`
- ❌ **修改 `_ct-workorders/_*.md` 任何檔案的內容**（L021 強制禁止）
- ❌ 追加任何新內容到 `_learnings.md`（**原樣 stage 塔台預寫的部分**）
- ❌ 為了「讓驗證過」而 mock 或 disable 既有測試
- ❌ scope creep 到其他 bug / architecture / UX

## Sub-session 執行指示

### 執行步驟

1. **環境檢查（精準前置條件驗證）**
   - `cd` 到專案根目錄
   - `git status --porcelain` 預期輸出**恰好這兩行**（順序可能不同）：
     ```
      M _ct-workorders/_learnings.md
     ?? _ct-workorders/T0028-bug008-overlay-scroll-drift.md
     ```
   - `git log --oneline -1` 驗證 `HEAD == b2679f7`
   - 若前置條件不符 → **STOP 回報**
   - ✅ 驗證通過後，把 T0028 工單狀態 `TODO → IN_PROGRESS`，開始時間填入元資料

2. **階段 1：根因調研**（grep + 讀 code）
   - 執行調研步驟（見「階段 1」細節）
   - 記錄假設驗證結果到臨時筆記

3. **階段 2：設計修復方案**（選 Pattern + 評估影響）

4. **階段 3：實作修復**（Edit code，最小範圍）

5. **階段 4：Build 驗證**
   - `npx vite build`
   - 若失敗 → STOP 回報

6. **產生 Commit 1**：`fix(ui): restore overlay position on terminal scroll (BUG-008)`
   - 檔案：只包含實際修改的 `src/` 程式碼
   - **不包含** `_ct-workorders/` 任何內容

7. **填寫回報區**（只寫 T0028.md 的回報區，**不動**其他 `_ct-workorders/_*.md`）

8. **產生 Commit 2**：`chore(tower): T0028 closure + L019/L020/L021 carry`
   - 檔案清單（**恰好 2 個**）：
     - `_ct-workorders/T0028-bug008-overlay-scroll-drift.md`（含回報區）
     - `_ct-workorders/_learnings.md`（**原樣 stage 塔台預寫的 L019/L020/L021，Worker 絕對不修改此檔內容**）
   - 驗證 `git diff --cached _ct-workorders/_learnings.md` 應只包含塔台預先寫的 L019/L020/L021 三條（非 Worker 新增）

9. **最終驗證**
   - `git status --porcelain` 應為空
   - `git log --oneline -2` 顯示兩個新 commit

10. **呼叫 `/ct-done T0028`**（或直接回報塔台「T0028 完成」）

### 回報語氣規範（L020 首次套用）

回報時**必須**遵守以下語氣規範：

- ✅ **使用過去式 + 客觀描述**：
  - ✅「階段 1 已執行：grep 結果 N 個匹配，讀取 TerminalPanel.tsx:450-458，結論 H-BUG008-2 成立」
  - ✅「Commit 1 建立於 HH:MM，hash: xxxxxxx」
  - ✅「階段 4 手動驗證：捲動終端後 overlay 正確 reposition，已完成」
- ❌ **禁止塔台語氣**：
  - ❌「接下來我會修改 TerminalPanel.tsx」
  - ❌「我決定採用 Pattern A」
  - ❌「下一步建議處理 BUG-008b」
  - ❌「接下來我會收尾」
- **原則**：Sub-session 是執行者不是規劃者，只回報事實，不宣告未來行動

### 學習鉤子

若遇到以下情況，記錄到回報區的「學習鉤子候選」（**不要直接寫入 `_learnings.md`**）：
- 多個 overlay 元件有**共通根因** → 塔台可能會升級為架構級學習
- xterm.js 的 scroll event API 有**未文件化的陷阱** → TG010 candidate
- 本專案 Portal 架構有**結構性問題** → 塔台可能會派 architecture audit

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
> **語氣規範**：過去式 + 客觀描述，避免塔台敘事語氣（見 L020）

### 完成狀態
DONE

### 根因分析

#### 假設驗證結果（H-BUG008-1 ~ H-BUG008-6）
- H-BUG008-1: 成立 — 右鍵時只記錄一次 `x/y`，Portal 以固定座標渲染，後續未重算（`src/components/TerminalPanel.tsx@b2679f7:451-458,562-565`）
- H-BUG008-2: 成立 — BUG-002 修復後採 `createPortal(..., document.body)` + `position: fixed`，若無 scroll 同步機制會殘留漂移（`src/components/TerminalPanel.tsx@b2679f7:557-578`）
- H-BUG008-3: 不成立 — 語音預覽為 PromptBox 內嵌元素，非 terminal Portal overlay（`src/components/PromptBox.tsx:370-389`, `src/styles/prompt-box.css:236-240`）
- H-BUG008-4: 成立 — 修復前 TerminalPanel 未訂閱 xterm scroll，也未監聽 `.xterm-viewport` scroll（`src/components/TerminalPanel.tsx@b2679f7:450-550`）
- H-BUG008-5: 不成立 — context menu 狀態為 TerminalPanel 區域 state，且 unmount 會清理 listener 與 terminal instance（`src/components/TerminalPanel.tsx:54,554-566`）
- H-BUG008-6: 不成立（第三方 lib 本身非缺陷）— xterm 已提供 `onScroll` API，且文件註明 viewport scroll 需由整合端掛接（`node_modules/@xterm/xterm/src/browser/public/Terminal.ts:77`, `node_modules/@xterm/xterm/src/browser/Viewport.ts:251-253`）

#### 最終判定的根因
根因已定位為 TerminalPanel context menu overlay 的 scroll 同步缺失：選單座標在開啟時以 `clientX/clientY` 固定，渲染層為 `document.body` 的 fixed Portal；terminal 捲動後內容位置改變但 overlay 未同步更新或關閉，導致視覺漂移（`src/components/TerminalPanel.tsx@b2679f7:451-458,557-578`）。

### 修復方案

#### 選定的 Pattern
Pattern C（scroll 發生時 dismiss overlay）。此策略以最小改動修復 BUG-008，未引入新依賴、未重寫 Portal 架構，符合 scope 限制。

#### 實作變更
- 修改的檔案：`src/components/TerminalPanel.tsx:145-147,465-471,474-486,554-565`
- 關鍵改動：
  ```ts
  const dismissContextMenu = () => {
    setContextMenu(prev => (prev ? null : prev))
  }

  const disposeScrollDismiss = terminal.onScroll(() => {
    dismissContextMenu()
  })

  const viewportElement = containerRef.current.querySelector('.xterm-viewport')
  const handleViewportScroll = () => dismissContextMenu()
  viewportElement?.addEventListener('scroll', handleViewportScroll, { passive: true })

  const handleWheel = (e: WheelEvent) => {
    dismissContextMenu()
    if (e.ctrlKey) { /* 保留既有 zoom */ }
  }
  ```

#### 影響評估
- T0025 BUG-007/009 修復：無影響（未修改 paste/focus 邏輯）
- T0026 UX-001 scrollbar：無影響（未修改 scrollbar CSS）
- Ctrl+V paste 路徑：無影響（未修改 `attachCustomKeyEventHandler` 的 Ctrl+V 分支）

### Build 驗證
```
npx vite build 已通過：
- renderer: 2127 modules transformed, build success
- electron main: build success
- electron preload: build success
（既有 Vite dynamic import warning 仍存在，非本次變更引入）
```

### 手動驗證（若執行）
- [ ] 捲動終端後 overlay 正確 reposition：未驗證（以 code-level 驗證）
- [ ] 右鍵選單仍正常（BUG-002 未回歸）：未驗證（以 code-level 驗證）
- [ ] 語音預覽 popover 仍正常：未驗證（以 code-level 驗證）
- [ ] Ctrl+V paste 仍正常：未驗證（以 code-level 驗證）

### L019/L020/L021 原樣 stage 驗證
- [x] `git diff --cached _ct-workorders/_learnings.md` 僅包含塔台預寫的 L019/L020/L021：是
- [x] Worker 未追加任何新內容到 `_learnings.md`：是

### Commits
```
37bccdf fix(ui): restore overlay position on terminal scroll (BUG-008)
<this commit> chore(tower): T0028 closure + L019/L020/L021 carry
```

### 遭遇問題
無

### 學習鉤子候選
Terminal 內使用 `position: fixed` + `createPortal(document.body)` 的 overlay，需要統一掛接 scroll dismiss/reposition 機制；否則在 xterm 虛擬捲動下易出現視覺漂移。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 20:59 (UTC+8)
