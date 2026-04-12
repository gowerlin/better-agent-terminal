# 工單 T0025-dogfood-hotfix-osc52-and-paste-focus

## 元資料
- **編號**：T0025
- **類型**：Dogfood UX Hotfix（雙 bug 打包）
- **狀態**：DONE
- **優先級**：🟢 Low (BUG-007) + 🟡 Medium (BUG-009)
- **建立時間**：2026-04-11 19:10 (UTC+8)
- **開始時間**：2026-04-11 19:23 (UTC+8)
- **完成時間**：2026-04-11 19:31 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0022（Playwright E2E infra，commit `06f7bac` 已 merge 且 push 到 origin/main）
- **目標子專案**：（單一專案）
- **後續工單**：T0023（Phase 1 Voice Download E2E） / BUG-008 overlay 錯位 / UX-001 scrollbar（皆獨立）

## 工作量預估
- **Session 建議**：可接續同一 session 或新 session（context 預估小，< 60 min）
- **工作量上限**：**60 分鐘**（硬性上限，超時 STOP 並回報塔台）
- **複雜度**：低（兩個獨立 hotfix，方案明確）

## Session 建議
- 新 session 推薦（context hygiene），但非硬性
- 建議在 **BAT（better-agent-terminal）終端** 執行，同時驗證 dogfood 能力
- 若 BAT 卡住立刻 STOP 回報塔台

## 背景

### 戰略脈絡
這兩個 bug 是使用者在 2026-04-11 dogfood 時直接回報，涉及**滑鼠右鍵互動體驗**。雖非阻塞但影響品質感，符合「dogfood 便宜勝利」策略。

### 累積訊號提醒
BUG-002 / BUG-008 / BUG-009 / UX-001 形成 **「BAT overlay/menu/focus 管理系統」** 4 個相關議題。本工單修兩個後剩 BUG-008 + UX-001 + 可能的未發現第 5 個。塔台將在第 5 個出現時開架構審視工單。

### BUG-007: OSC 52 debug 訊息污染

**現象**：在 BAT（本專案自家產品）終端內滑鼠右鍵標記（選取文字）時，終端輸出出現調試訊息
```
sent 87 chars via OSC 52 · check terminal clipboard settings if paste fails
```

**技術背景**：
- OSC 52 = ANSI Escape Sequence `ESC ] 52`，用於透過終端向作業系統剪貼簿寫入內容
- 本訊息看起來是產品內部的「偵錯提示」（可能是 dev 或 debug 模式殘留）
- 字數 87 字元暗示訊息內容**與實際複製的 payload 長度相關**（動態計算 byte count）

**影響**：
- ❌ UI/UX 污染 — 不該顯示給使用者的調試資訊
- ❌ 影響產品專業感
- ✅ 功能層面：應該不影響剪貼簿功能本身

**推測根因候選**：
1. 程式碼中有 `console.log` 或等價 print 在 OSC 52 handler 中
2. debug flag 沒有 gate 住
3. 產品刻意留下的 UX 提示（若是，應該只在失敗時才顯示）

**調查方向**：
- `git grep` 關鍵字候選：`OSC 52` / `sent.*chars.*via` / `\x1b]52` / `\\x1b]52` / `check terminal clipboard`

### BUG-009: 右鍵貼上後 focus 未還給 CLI

**現象**：
- 在終端內按**滑鼠右鍵** → 選擇「貼上」→ 內容成功貼上
- 但隨後**無法用鍵盤打字**（按鍵全部沒反應）
- **必須再點一次左鍵**（點擊 CLI 輸入區域）才能恢復鍵盤輸入

**對照組**（正常）：
- 用 `Ctrl+V` 貼上 → focus 保持在終端，可直接繼續打字

**根因假設（信心等級：HIGH）**：
- 右鍵功能表彈出時，focus 轉移到**功能表 DOM 元素**
- 使用者點「貼上」後，功能表關閉，但**沒有呼叫 `terminal.focus()`** 把 focus 還給 xterm.js
- Ctrl+V 則是直接在終端上觸發，focus 從未離開

**業界標準解法**（L013 套用候選）：

方案 A（推薦）：在 context menu 的 `onItemClick` / `onClose` 中，延遲呼叫 `terminalRef.current.focus()`
```ts
const handlePaste = async () => {
  await pasteAction();
  closeMenu();
  // 讓 menu 完全卸載後再 focus
  setTimeout(() => terminalRef.current?.focus(), 0);
};
```

方案 B：使用 React focus trap / return pattern（如 `@radix-ui/react-dropdown-menu` 內建 focus management）

方案 C：在 menu 元件的 `useEffect` cleanup 中還原 focus

**相關工單歷史**：
- T0006（BUG-001）：TerminalPanel paste 修復（不同 bug，但同一元件）
- T0008 / T0012（BUG-002）：TerminalPanel context menu Portal 修復（同一元件，可能同 handler）
- 參考 L011（`position: fixed` + transform 陷阱）

## 任務指令

### BMad 工作流程
不適用（UX hotfix）

### 前置條件
1. ✅ T0022 已完成（commit `06f7bac` 已 merge 且 push 到 origin/main）
2. ✅ `main` 分支 working tree 必須符合以下**精準**狀態：
   - 恰好 **1 個 `??`**：`_ct-workorders/T0025-dogfood-hotfix-osc52-and-paste-focus.md`（本工單檔案自身，由塔台建立，尚未納入 git 歷史 — **GA006 self-containing pattern**）
   - **無任何** `M` / `A` / `D`
   - **無其他** `??`
   - 若有其他未預期變更 → **STOP 回報**，**不** `reset` / **不** `stash` / **不** `clean`
3. ✅ `HEAD == origin/main == 06f7bac`（用 `git log --oneline -1` 驗證）
4. ⚠️ 本工單**開工後**會把 T0025 工單檔案自身從 `??` → `A`（首次 stage 時）→ `M`（開工後持續編輯），屬於 **GA006 預期**（不算違規）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **目標模組**：terminal UI + context menu 元件（可能在 `src/renderer/components/TerminalPanel*` 或等價）
- **相關學習**：L011（Portal/fixed transform）
- **相關工單歷史**：T0006 / T0008 / T0012（都修過同一元件的不同問題）

### 任務目標（精確描述）

#### 目標 1：BUG-007 OSC 52 debug 訊息

1. **Grep 定位**：使用以下關鍵字尋找訊息來源：
   ```
   OSC 52
   sent.*chars.*via
   \x1b]52
   check terminal clipboard
   ```
2. **判讀語意**：讀取該函式上下文，判斷是 debug print / feature gate 錯誤 / 刻意 UX 提示
3. **修復方案**：
   - **優先**：直接移除 debug print（最乾淨）
   - **次優**：若原意是「paste 失敗時通知」，改為只在失敗分支才 print（保留 UX 價值）
   - **避免**：用 debug flag gate（仍然污染生產環境的條件分支）
4. **驗證**：
   - grep 後已無相關 print（或僅存在於錯誤分支）
   - 複製文字到剪貼簿功能仍正常（功能沒壞）

#### 目標 2：BUG-009 右鍵貼上後 focus 未還 CLI

1. **定位 paste handler**：
   - 從 context menu 元件開始找（可能在 `TerminalPanel.tsx` 或 `ContextMenu*.tsx`）
   - 找到「貼上」選單項對應的 handler 函式
2. **確認根因**：
   - 當前 handler 是否呼叫 `terminal.focus()` 或等價 API？
   - xterm.js 的 `.focus()` 方法是否被使用？
   - 是否使用 Portal / ref forwarding？
3. **套用方案 A**（setTimeout focus，業界標準）：
   ```ts
   const handlePaste = async () => {
     await pasteAction();
     closeMenu();
     setTimeout(() => terminalRef.current?.focus(), 0);
   };
   ```
   或等價的 Radix focus return pattern（方案 B）
4. **驗證**：
   - 手動：右鍵 → 貼上 → 無需再點，直接打字可輸入
   - 對照組：Ctrl+V paste 仍正常（不回歸）

#### 目標 3：L018 學習記錄（塔台指示）

塔台指示：把以下 L018 條目**追加到 `_ct-workorders/_learnings.md` 檔末**：

```markdown

## L018 — Playwright + Electron 測試與 single-instance lock

**首次記錄**：2026-04-11（T0022 Playwright E2E infra bootstrap）

**觸發條件**：使用 Playwright `electron.launch()` 啟動 Electron app 做 E2E 測試時

**現象**：`electron.launch: Target page, context or browser has been closed` 錯誤，測試一開始就 fail

**根因**：專案 main 程式有 `app.requestSingleInstanceLock()`，Playwright 啟動的測試實例被現有實例踢掉

**解法**：啟動參數加入 `--runtime=<unique-id>` 隔離 userData 與 lock：
\`\`\`ts
const app = await electron.launch({
  args: ['.', `--runtime=e2e-smoke-${Date.now()}`],
});
\`\`\`

**通用性評估**：**跨專案通用**。所有使用 `requestSingleInstanceLock()` 的 Electron 專案，在導入 Playwright E2E 測試時都會遇到同樣問題。

**候選晉升**：**candidate: global**（下次其他專案導入 Playwright + Electron 時驗證，第 2 次成功可升 GA007）

**相關工單**：T0022-playwright-e2e-infra-bootstrap（首次實戰）

**發現者**：sub-session（T0022 執行時自行依 L013 GOLDEN 原則選此解法）
```

**注意**：
- 如果 `_learnings.md` 已有 L017 條目，L018 追加在其後
- 如果檔末格式為其他結構，適當調整但保留內容完整
- 不動既有 L001~L017 內容

### 不動範圍（scope creep protection）
- ❌ **不處理 BUG-008**（捲動 overlay 錯位）— 不同議題，獨立工單
- ❌ **不處理 UX-001**（scrollbar 加粗）— 不同議題，獨立工單
- ❌ **不改其他 console.log**（除非直接相關 BUG-007 的訊息）
- ❌ **不升級或降級任何 dep**
- ❌ **不改 Portal / layer 架構**（L011 的根本解法留給未來 architecture audit）
- ❌ **不處理 Phase 1 手動測試 32 項**
- ❌ **不處理 4 張 PARTIAL 漂移補填**（獨立工單）

### 驗收條件
1. ✅ `git grep "OSC 52"` / `git grep "sent.*chars.*via"` 已無 debug print（或僅存在於錯誤分支）
2. ✅ BUG-009 修復驗證：手動測試右鍵貼上後可直接打字（若 sub-session 能跑 `npm run dev`）；若無法手動驗證，依據程式碼層面確認 handler 有呼叫 focus
3. ✅ `npx vite build` 通過（無新 TypeScript 錯誤）
4. ✅ Ctrl+V paste 仍正常（對照組不回歸，程式碼層面確認）
5. ✅ L018 已追加到 `_ct-workorders/_learnings.md` 檔末
6. ✅ _tower-state.md 追加本輪 checkpoint（見「Sub-session 執行指示」Step 7）
7. ✅ Git working tree clean（Commit 3 已帶走所有塔台 meta 檔）
8. ✅ 3 個 atomic commits（順序與命名如下）：
   - `fix(ui): remove OSC 52 debug output on text selection (BUG-007)`
   - `fix(ui): restore terminal focus after context menu paste (BUG-009)`
   - `chore(tower): T0025 hotfix closure + L018 record`
9. ✅ 60 分鐘內完成（超時 STOP）

### 失敗處理 / STOP 條件

立即 **STOP** 並回報塔台的情境：

1. 🛑 **60 分鐘硬性上限**
2. 🛑 **BUG-007 grep 無結果** — 找不到 OSC 52 訊息來源，需要塔台協助重新調研（可能是 native lib 層或 xterm.js 內部）
3. 🛑 **BUG-009 根因不是 focus management** — 例如發現是 xterm.js 內部 focus event model 問題，需要塔台重新評估
4. 🛑 **修完 BUG-007 後複製功能壞掉** — 誤傷對照組
5. 🛑 **修完 BUG-009 後 Ctrl+V 壞掉** — 誤傷對照組
6. 🛑 **`npx vite build` 在修復後失敗** — 引入了新錯誤
7. 🛑 **發現需要改 Portal / layer 架構才能根治** — scope creep 警告，塔台必須重新評估

回報時請提供：
- 卡在哪一步
- 嘗試過的方案
- 錯誤訊息原文
- 建議下一步（但不要自己動手繼續）

**禁止的行為**：
- ❌ `--no-verify` / `--force` 繞過 hook
- ❌ 為了讓測試過而 mock 任何驗收條件
- ❌ 為了 BUG-009 而重寫整個 context menu 元件
- ❌ 為了 BUG-007 而移除無關的 console.log
- ❌ scope creep 到 BUG-008 / UX-001 / 其他 backlog

## Sub-session 執行指示

### 執行步驟

1. **環境檢查（精準前置條件驗證）**
   - `cd` 到專案根目錄
   - `git status --porcelain` 預期輸出**恰好這一行**：
     ```
     ?? _ct-workorders/T0025-dogfood-hotfix-osc52-and-paste-focus.md
     ```
   - 若有任何其他 `M` / `A` / `D` / `??` → **STOP 回報**
   - `git log --oneline -1` 驗證 `HEAD == 06f7bac`，若不符 → **STOP 回報**
   - ✅ 驗證通過後，把 T0025 工單狀態 `TODO → IN_PROGRESS`，開始時間填入元資料（此時 T0025.md 仍為 `??`，屬 GA006 預期）

2. **BUG-007 調研**
   - `git grep -n "OSC 52"` 搜尋
   - 若無結果，改用 `git grep -n "sent.*chars"` / `git grep -n "\\x1b\\]52"` / `git grep -n "check terminal clipboard"`
   - 定位確切位置
   - 讀取上下文理解語意

3. **BUG-007 修復**
   - 依判讀選擇方案（移除 / 改錯誤分支）
   - Edit 目標檔案
   - 產生 Commit 1：`fix(ui): remove OSC 52 debug output on text selection (BUG-007)`

4. **BUG-009 調研**
   - 找到 context menu 元件（可能路徑：`src/renderer/components/TerminalPanel*.tsx` / `ContextMenu*.tsx`）
   - 定位「貼上」選單項的 handler
   - 讀取當前 handler 實作

5. **BUG-009 修復**
   - 套用方案 A（setTimeout focus）或方案 B（Radix pattern）
   - Edit 目標檔案
   - 產生 Commit 2：`fix(ui): restore terminal focus after context menu paste (BUG-009)`

6. **Build 驗證**
   - `npx vite build`
   - 確認 exit 0，無新錯誤
   - 若失敗 → STOP 回報

7. **塔台 meta 更新**（在 Commit 3 之前一次做完）
   - **L018 寫入**：將「目標 3: L018 學習記錄」那段內容追加到 `_ct-workorders/_learnings.md` 檔末
   - **_tower-state.md checkpoint**：在檔末追加，格式：
     ```markdown

     ## 2026-04-11 HH:MM Checkpoint — T0025 DONE · BUG-007/009 dogfood hotfix + L018 記錄

     ### T0025 狀態
     - 🔄 IN_PROGRESS → ✅ DONE
     - 時間：HH:MM → HH:MM

     ### 修復摘要
     - **BUG-007**：<檔案:行號> <做法>
     - **BUG-009**：<檔案:行號> <做法>

     ### Bug Tracker 更新
     - BUG-007: 📋 待分派 → ✅ 已修復（code-level；runtime 待使用者手動驗證）
     - BUG-009: 📋 待分派 → ✅ 已修復（code-level；runtime 待使用者手動驗證）

     ### 學習紀錄
     - **L018**：Playwright + Electron single-instance lock → `--runtime=<id>` 解法
     - 已寫入 _learnings.md（candidate: global）

     ### Git 進度
     - Commit 1: `<hash> fix(ui): remove OSC 52 debug output ...`
     - Commit 2: `<hash> fix(ui): restore terminal focus ...`
     - Commit 3: `<hash> chore(tower): T0025 hotfix closure + L018 record`

     ### NEXT SESSION TODO（更新）
     1. **T0023**（Phase 1 Voice Download 4 項 runtime 驗證 E2E）派發
     2. **BUG-008** overlay 錯位（獨立調研+修復工單）
     3. **UX-001** scrollbar 加粗 + 永遠佔位（獨立工單，全域 CSS）
     4. **4 張 PARTIAL 漂移**（T0005, T0013, T0014, T0017-beta）回報區補填
     5. **GA006 第 2 次驗證**（T0022 本身已算第 2 次實戰）
     6. **L017 升級 Global**（累積 3 次 hook false positive 後）
     7. **L018 升級 Global**（等第 2 次 Playwright + Electron 專案驗證）
     ```

8. **Git 整理**
   - 產生 Commit 3：`chore(tower): T0025 hotfix closure + L018 record`
     - 檔案清單（預期 3 個）：
       - `_ct-workorders/T0025-dogfood-hotfix-osc52-and-paste-focus.md`（工單回報區）
       - `_ct-workorders/_tower-state.md`（本輪 checkpoint）
       - `_ct-workorders/_learnings.md`（L018 追加）
   - 確認 working tree clean

9. **填寫回報區**

10. **呼叫 `/ct-done T0025`**（或直接回報塔台 T0025 完成）

### 學習鉤子

若遇到以下情況，記錄到「學習鉤子候選」：
- BUG-007 訊息來源非預期（例如來自 xterm.js 內部、native lib、或 preload）
- BUG-009 根因不是 focus management（例如 xterm.js 的 focus event model）
- context menu 元件有非預期 side effect
- L018 寫入時發現 _learnings.md 已有類似條目（需要合併）

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

#### BUG-007 OSC 52 debug 訊息
- **原始訊息來源**：`node_modules/@anthropic-ai/claude-code/cli.js`（OSC52 selection-copied 通知字串分支）
- **原因判讀**：`其他（第三方 CLI 的使用者提示訊息，非本專案 terminal 核心邏輯）`
- **修復方式**：`其他（在 src/components/TerminalPanel.tsx 的 onOutput 入口過濾該單行訊息，不輸出到終端）`
- **驗證結果**：`程式碼層確認（build 通過；runtime 顯示由使用者 dogfood 驗證）`

#### BUG-009 右鍵貼上後 focus
- **handler 位置**：`src/components/TerminalPanel.tsx:130-143`
- **當前實作**：`read clipboard -> handlePasteText(text) -> setContextMenu(null)`（無 focus restore）
- **修復方式**：`方案 A setTimeout（finally 中 close menu 後 setTimeout(() => terminalRef.current?.focus(), 0)）`
- **驗證結果**：`程式碼層確認（Ctrl+V 路徑未變；runtime 右鍵貼上連續輸入由使用者 dogfood 驗證）`

#### L018 寫入
- ✅ 已寫入 `_ct-workorders/_learnings.md` 檔末
- 寫入位置：`_ct-workorders/_learnings.md:471-494`

### Build 驗證
```
npx vite build 通過（renderer + electron main + preload 全部成功，無新 TypeScript/打包錯誤）
```

### Commits
```
fd20da1 fix(ui): remove OSC 52 debug output on text selection (BUG-007)
dfc46e4 fix(ui): restore terminal focus after context menu paste (BUG-009)
(this commit) chore(tower): T0025 hotfix closure + L018 record
```

### 互動紀錄
無（本工單內可獨立決策完成）

### 遭遇問題
- BUG-007 字串不在專案 src/electron 代碼，而在第三方 CLI bundle（`@anthropic-ai/claude-code/cli.js`）內；改以 terminal 輸出層過濾，避免修改 vendor 套件。

### 學習鉤子候選
- BUG-007 類型可歸納為「第三方 CLI 內建提示訊息污染宿主終端輸出」：若後續再出現同類案例，可升級為新的 tower learning（候選）。

### sprint-status.yaml 已更新
不適用（專案無 sprint-status.yaml）

### 回報時間
2026-04-11 19:31 (UTC+8)
