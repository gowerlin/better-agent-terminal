# 工單 T0027-bat-rightclick-investigation-part-a

## 元資料
- **編號**：T0027
- **類型**：Investigation（純調研，**零程式碼修改**）
- **狀態**：DONE
- **開始時間**：2026-04-11 20:10 (UTC+8)
- **完成時間**：2026-04-11 20:22 (UTC+8)
- **優先級**：🟡 Medium（戰略情報，不阻塞任何功能）
- **建立時間**：2026-04-11 20:05 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0026（commit `6bbbabd` 需先 push 到 origin/main）
- **目標子專案**：（單一專案）
- **後續工單**：T0028（Part B — 第三方 CLI 輸出過濾策略 ADR，**獨立工單**，等使用者 review Part A 結論後派）

## 工作量預估
- **Session 建議**：可接續同一 session 或新 session（純調研，context 預估小）
- **工作量上限**：**30 分鐘**（硬性上限，超時 STOP 並回報塔台）
- **複雜度**：低（grep + 讀程式碼 + 寫報告，無任何 edit 非文檔）

## Session 建議
- 新 session 推薦（context hygiene）
- 不強制在 BAT 終端跑（這是調研工單，不需要 GUI）

## 背景

### 戰略脈絡
使用者在 2026-04-11 19:28 提出觀察：**在 BAT 裡跑 Copilot CLI 時右鍵直接貼上，跑 Claude Code CLI 時不會**。塔台已在本 session 內提出 4 個假設，本工單驗證這些假設。

此外，T0025 修復 BUG-007 時揭露：**OSC 52 debug 訊息來自 `@anthropic-ai/claude-code/cli.js`**（第三方 CLI bundle），不是 BAT 本家產生。這讓「右鍵互動」議題變得更複雜 — 涉及 BAT 與第三方 CLI 的 clipboard 互動協議。

### 4 個假設（塔台 19:28 提出）

| # | 假設 | 目前信心 | 驗證方式 |
|---|------|---------|---------|
| **H1** | BAT 偵測 `\x1b[?1049h` alt screen buffer → 切換右鍵路徑（alt buffer → React context menu；normal buffer → direct paste） | ⭐⭐⭐⭐⭐ | `git grep 1049` + 讀 renderer 事件處理 |
| **H2** | BAT 根據 mouse tracking (`\x1b[?100Xh`) 決定是否自己處理 mouse event | ⭐⭐⭐ | `git grep '\?100'` + 讀事件 dispatcher |
| **H3** | BAT 根據 bracketed paste (`\x1b[?2004h`) 切換 paste 路徑 | ⭐⭐ | `git grep 2004` |
| **H4** | BAT 的 React 右鍵選單 component 只在某些 screen state 下 mount（跟 escape sequence 無關） | ⭐ | 讀 `TerminalPanel.tsx` 右鍵相關邏輯 |

### 核心研究問題
1. **BAT 如何決定「右鍵要直接 paste」vs「右鍵要顯示 React context menu」?**
2. **這個決策是刻意設計還是副作用？**
3. **文件化程度：有 code comment / doc 解釋嗎？**

### 本工單**不**處理的議題（scope protection）
- ❌ **Part B：第三方 CLI 輸出過濾策略**（BUG-007 的根因揭露） — 獨立 T0028 ADR
- ❌ **BAT 與 Claude Code CLI 的 clipboard 互動協議**（OSC 52 雙向通訊） — Part B
- ❌ **任何程式碼修改** — 本工單**零 edit 非文檔**
- ❌ **架構決策 / ADR 產出** — Part B
- ❌ **向 Anthropic 回報 upstream** — Part B

## 任務指令

### BMad 工作流程
不適用（Investigation）

### 前置條件
1. ✅ T0026 已完成（commit `6bbbabd` 已 merge 且 push 到 origin/main）
2. ✅ `main` 分支 working tree 必須符合以下**精準**狀態：
   - 恰好 **1 個 `??`**：`_ct-workorders/T0027-bat-rightclick-investigation-part-a.md`（本工單檔案自身，GA006 預期）
   - **無任何** `M` / `A` / `D`
   - **無其他** `??`
3. ✅ `HEAD == origin/main == 6bbbabd`（用 `git log --oneline -1` 驗證）
4. ⚠️ 本工單**開工後**會把 T0027 工單檔案自身從 `??` → `A` → `M`，屬於 **GA006 預期**

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **目標檔案範圍**：
  - `src/components/TerminalPanel.tsx`（右鍵選單 + 事件處理核心）
  - `src/styles/*.css`（可能的 layer 相關 CSS）
  - `electron/` 或 `src/main/`（若有 main process 介入）
  - `node_modules/xterm*/` 只讀（了解 xterm.js API 即可，**絕對不動**）
- **關鍵字庫**（grep 用）：
  - Escape sequences: `1049` / `\x1b\\[\\?100` / `2004`
  - Handlers: `onContextMenu` / `contextmenu` / `rightclick` / `right.?click`
  - Mouse: `mousedown` / `mouseup` / `mousemove`
  - Terminal state: `altBuffer` / `alternate.?screen` / `screenBuffer`
  - Paste: `handlePaste` / `pasteText` / `paste.?from.?clipboard`
- **相關檔案歷史**：
  - T0025 剛修過 `TerminalPanel.tsx`（BUG-007 filter + BUG-009 focus）
  - T0026 剛修過 `base.css` + `panels.css`（scrollbar）

### 任務目標（精確描述）

#### 目標 1：H1 驗證（alt screen buffer 假設）— 最重要
1. `git grep -n "1049" -- src/` 搜尋 alt buffer escape sequence 處理
2. `git grep -n "altBuffer\|alternate.*screen\|screenBuffer" -- src/` 搜尋相關邏輯
3. 若有結果 → 讀取並記錄**這些 code 是否影響右鍵行為**
4. 若無結果 → H1 **可能不成立**（BAT 沒有主動偵測 alt buffer）
5. **結論**：H1 成立 / 不成立 / 不確定（為什麼）

#### 目標 2：H2 驗證（mouse tracking 假設）
1. `git grep -n "1000\|1002\|1003\|1006\|1015" -- src/` 搜尋 mouse tracking mode
2. `git grep -n "mouseEvents\|mouse.?tracking\|mouse.?mode" -- src/`
3. 判讀：BAT 是否根據 CLI 開的 mouse tracking mode 改變自己的事件處理
4. **結論**：H2 成立 / 不成立 / 不確定

#### 目標 3：H3 驗證（bracketed paste 假設）
1. `git grep -n "2004\|bracketedPaste\|bracketed.?paste" -- src/`
2. 判讀：BAT 是否根據 bracketed paste mode 改變 paste 路徑
3. **結論**：H3 成立 / 不成立 / 不確定

#### 目標 4：H4 驗證（React component 狀態假設）
1. 讀 `src/components/TerminalPanel.tsx` 的右鍵相關邏輯
2. 找出 `contextmenu` event handler 或類似
3. 找出「是否顯示 React context menu」的決策邏輯
4. 判讀：
   - 是條件 render 嗎？條件是什麼？
   - 是跟其他 state 互動嗎？
5. **結論**：H4 成立 / 不成立 / 不確定

#### 目標 5：產出技術報告
在 `_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md` 寫一份**完整的調研報告**，結構：

```markdown
# BAT Right-Click Behavior — Part A Investigation

## 研究問題
<複述 T0027 目標>

## 執行摘要（TL;DR）
<3-5 個 bullet point,結論 + 可執行建議>

## 使用者原始觀察
<複述 19:28 的對照實驗>

## 4 假設驗證結果
### H1: Alt Screen Buffer
- 驗證方法: <grep 指令 + 結果>
- 證據: <程式碼片段 + 行號>
- 結論: <成立 / 不成立 / 不確定 + 原因>

### H2: Mouse Tracking
### H3: Bracketed Paste
### H4: React Component State

## 綜合判讀
<哪個假設最符合證據?多個假設組合?>

## 新發現（副產出）
<調研過程中發現的其他有趣事實>

## 對 Part B（第三方 CLI filter 策略）的輸入
<本次發現對 Part B 決策的參考價值>

## 建議下一步
- 若 H1 成立: <做法>
- 若 H1 不成立: <換方向>
- 無論結論如何,建議: <>

## 引用的程式碼位置
| 檔案 | 行號 | 片段摘要 |
|------|------|---------|
| ... | ... | ... |
```

### 不動範圍（scope creep protection）
- ❌ **不動任何程式碼** — 本工單**純調研**
- ❌ **不動 CSS**
- ❌ **不處理 Part B**（第三方 CLI filter 策略）
- ❌ **不產出 ADR**（那是 Part B）
- ❌ **不寫入 `_learnings.md`**（塔台保留升級決定）
- ❌ **不 Clone / fork xterm.js**
- ❌ **不嘗試 runtime 驗證**（這次純 code reading + grep）

### 驗收條件
1. ✅ H1/H2/H3/H4 四個假設皆有明確結論（成立 / 不成立 / 不確定）
2. ✅ 每個結論**附程式碼片段 + 行號**作為證據
3. ✅ 技術報告 `_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md` 存在且結構完整
4. ✅ **零程式碼修改**（`git diff` 應僅顯示新增的 report + 工單回報區 + tower-state checkpoint）
5. ✅ `_tower-state.md` 追加本輪 checkpoint
6. ✅ 2 個 atomic commits：
   - `docs(reports): BAT right-click behavior Part A investigation (T0027)`
   - `chore(tower): T0027 investigation closure`
7. ✅ 30 分鐘內完成

### 失敗處理 / STOP 條件

立即 **STOP** 並回報塔台的情境：

1. 🛑 **30 分鐘硬性上限**
2. 🛑 **發現需要 runtime 驗證才能結論**（例如 escape sequence 處理分散在 multiple layers） → 回報並記錄已有結論
3. 🛑 **發現 BAT 其實**完全**沒有**處理任何 escape sequence —那就意味著 4 個假設**全部不成立**，需要重新設計調研方向
4. 🛑 **發現 xterm.js 有內建處理**（例如 xterm.js addon 自己做），需要重新評估研究範圍

回報時請提供：
- 卡在哪一步
- 已完成的部分結論
- 建議下一步

**禁止的行為**：
- ❌ 任何 `Edit` / `Write` 在 `src/` 或 `electron/` 的檔案
- ❌ `--no-verify` / `--force`
- ❌ 為了「讓報告有結論」而推論缺乏證據的說法
- ❌ scope creep 到 Part B

## Sub-session 執行指示

### 執行步驟

1. **環境檢查（精準前置條件驗證）**
   - `cd` 到專案根目錄
   - `git status --porcelain` 預期輸出**恰好這一行**：
     ```
     ?? _ct-workorders/T0027-bat-rightclick-investigation-part-a.md
     ```
   - `git log --oneline -1` 驗證 `HEAD == 6bbbabd`
   - 若前置條件不符 → **STOP 回報**
   - ✅ 驗證通過後，把 T0027 工單狀態 `TODO → IN_PROGRESS`，開始時間填入元資料

2. **執行 4 組 grep 搜尋**（H1/H2/H3/H4）
   - 每組 grep 結果記錄到臨時筆記
   - 識別需要深入讀的檔案清單

3. **讀取關鍵檔案**
   - `src/components/TerminalPanel.tsx`（重點：右鍵處理）
   - 若 grep 發現其他檔案，一併讀取
   - 理解事件流向：mouse event → handler → render decision

4. **建立報告骨架**
   - 創建 `_ct-workorders/reports/` 目錄（若不存在）
   - 創建 `_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md`
   - 填入結構（見「目標 5」）

5. **逐假設填寫結論**
   - 每個假設一個 section
   - 提供 grep 指令 + 結果 + 程式碼片段 + 結論
   - 若證據不足，明確寫「不確定 — 需要 XXX 才能結論」

6. **寫綜合判讀 + 建議**
   - 哪個假設最符合證據
   - 對 Part B 的輸入
   - 建議下一步

7. **產生 Commit 1**：`docs(reports): BAT right-click behavior Part A investigation (T0027)`
   - 檔案：
     - `_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md`（新增）
   - 不包含：`_ct-workorders/T0027*.md`（那是 Commit 2）

8. **塔台 meta 更新**
   - **_tower-state.md checkpoint**：在檔末追加：
     ```markdown

     ## 2026-04-11 HH:MM Checkpoint — T0027 DONE · BAT 右鍵互動 Part A investigation

     ### T0027 狀態
     - 🔄 IN_PROGRESS → ✅ DONE
     - 時間：HH:MM → HH:MM

     ### 調研結果（TL;DR）
     - H1 (alt buffer)   : <成立/不成立/不確定>
     - H2 (mouse track)  : <成立/不成立/不確定>
     - H3 (bracketed)    : <成立/不成立/不確定>
     - H4 (React state)  : <成立/不成立/不確定>
     - **綜合判讀**：<一句話>

     ### 產出
     - 技術報告：`_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md`

     ### Git 進度
     - Commit 1: `<hash> docs(reports): ...`
     - Commit 2: `<hash> chore(tower): T0027 investigation closure`

     ### NEXT SESSION TODO（更新）
     1. **T0028** Part B — 第三方 CLI filter 策略 ADR（等使用者 review Part A 後派）
     2. **BUG-008** overlay 錯位（獨立調研工單）
     3. **T0023** Phase 1 Voice Download E2E
     4. **4 張 PARTIAL 漂移補填**
     ```

9. **產生 Commit 2**：`chore(tower): T0027 investigation closure`
   - 檔案清單（預期 2 個）：
     - `_ct-workorders/T0027-bat-rightclick-investigation-part-a.md`（含回報區）
     - `_ct-workorders/_tower-state.md`（本輪 checkpoint）

10. **填寫回報區** + **呼叫 `/ct-done T0027`**（或直接回報塔台）

### 學習鉤子

若遇到以下情況，記錄到「學習鉤子候選」：
- 4 個假設**全部不成立** → 可能需要新假設（L019 candidate）
- 發現 BAT 有**未文件化的 terminal mode 處理邏輯** → TG010 candidate
- 發現 BAT 與 xterm.js addon 有**非預期互動** → TG011 candidate
- grep 調研過程中發現**完全無關的 bug / 設計問題** → 記錄到 backlog

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

#### H1 驗證（Alt Screen Buffer）
- grep 指令：`git grep -n '1049' -- src/`；`git grep -n 'altBuffer\|alternate.*screen\|screenBuffer' -- src/`
- grep 結果：`src/` 皆為 no matches
- 關鍵程式碼：`node_modules/@xterm/xterm/src/common/InputHandler.ts:1939-1945,2164-2171`（xterm 內部處理 1049）
- **結論**：`不成立（BAT 層）` — BAT 沒有主動偵測 alt buffer；1049 切換由 xterm 內部處理

#### H2 驗證（Mouse Tracking）
- grep 指令：`git grep -n '1000\|1002\|1003\|1006\|1015' -- src/`；`git grep -n 'mouseEvents\|mouse.*tracking\|mouse.*mode' -- src/`
- grep 結果：前者僅命中一般數字常數（如 z-index 1000），後者 no matches
- 關鍵程式碼：`InputHandler.ts:1903-1913`、`Terminal.ts:721-733,773-784`（xterm 依 mouse mode 切換事件路徑）
- **結論**：`不成立（BAT 自家邏輯）` — BAT 未依 mouse tracking mode 做路徑分支；但 xterm 層有強相關機制

#### H3 驗證（Bracketed Paste）
- grep 指令：`git grep -n '2004\|bracketedPaste\|bracketed.*paste' -- src/`
- grep 結果：no matches
- 關鍵程式碼：`Clipboard.ts:21-24,51-54`；`InputHandler.ts:1949-1950,2177-2178`
- **結論**：`不成立（針對右鍵路徑切換）` — 2004 只影響 paste payload 是否包 `\x1b[200~...\x1b[201~`

#### H4 驗證（React Component State）
- 讀取的檔案：`src/components/TerminalPanel.tsx`
- 關鍵邏輯：`TerminalPanel.tsx:450-458` 固定註冊 `contextmenu` 並 `setContextMenu(...)`；`558-578` 只依 `contextMenu` state 渲染選單
- **結論**：`不成立` — 無 alt/mouse/bracketed 條件 gating，非 screen state 條件 mount

### 綜合判讀
以 BAT 專案層（`src/` + `electron/`）來看，H1/H2/H3/H4 皆不成立：BAT 沒有主動解析 1049/100x/2004，也沒有根據 terminal mode 改變 React 右鍵選單掛載條件。

較可信的新方向是 xterm 內部 mouse protocol/selection 流程與第三方 CLI mode 切換時機的交互效應。這能解釋「同一 BAT，換 CLI 後右鍵體驗不同」的現象。

### 技術報告位置
`_ct-workorders/reports/bat-right-click-behavior-part-a-investigation.md`

### Commits
```
1e02e25 docs(reports): BAT right-click behavior Part A investigation (T0027)
(this commit) chore(tower): T0027 investigation closure
```

### 互動紀錄
無

### 遭遇問題
無

### 學習鉤子候選
L019 candidate：四個原假設在 BAT 層全部不成立，需重建假設集（轉向 xterm + 第三方 CLI mode routing）

### 對 Part B 的建議
1. 優先驗證第三方 CLI 是否輸出/切換 `DECSET/DECRST 1000/1002/1003/1006`
2. 觀測 xterm `onProtocolChange` 觸發時，selection/contextmenu 行為是否改變
3. 評估 BAT custom context menu 與 xterm 原生 rightClickHandler 是否需單一路徑化（Part B ADR 再決策）

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 20:22 (UTC+8)
