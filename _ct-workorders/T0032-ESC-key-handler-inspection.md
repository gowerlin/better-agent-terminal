# 工單 T0032-ESC-key-handler-inspection

## 元資料
- **工單編號**：T0032-ESC
- **任務名稱**：ESC 鍵翻譯 bug 源碼定位（confirmed BUG-011c 根因快速查找）
- **狀態**：DONE
- **建立時間**：2026-04-12 01:02 (UTC+8)
- **開始時間**：2026-04-12 01:22 (UTC+8)
- **完成時間**：2026-04-12 01:26 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔍 **Pure Investigation**（無 code 修改，無 git commit）

## 工作量預估
- **預估規模**：**小**（10-15 min）
- **Context Window 風險**：低（只讀 1-2 個檔案）
- **降級策略**：若 15 min 找不到，回報「找不到」+ 猜測位置清單，塔台另派

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：極小工單，獨立 session 確保不污染且快速

## 任務指令

### 前置條件

- 讀 `_ct-workorders/reports/T0032-bug008-bug010-investigation.md` 的 Section 2（BAT xterm 盤點）
- 不需要讀其他工單或 learnings

### 輸入上下文

#### Bug 現場證據（confirmed）

使用者在 BAT 中的 `less` 實驗：
- 在 less 的 `/` 搜尋或 `:` 命令提示下按 **ESC 鍵**
- 畫面出現**字面大寫字母 E、S、C**（三個 ASCII 字元：0x45 0x53 0x43）
- 正常應該要送 `\x1b`（0x1B 單一控制字元）取消 less 的輸入

使用者另一個在 BAT 中的 `vim` 實驗：
- 在 insert mode 按 ESC
- 畫面先出現 `^[`（vim 的 `\x1b` 字元 caret notation）然後瞬間消失
- **注意**：vim 的 `^[` 表示 vim 收到的是真的 `\x1b`，但被當文字插入（insert mode）。和 less 的「字面 ESC 三字母」**不同**。
- 但兩個現象可能有共同根因（例如 ESC 被送了某種組合字元而非單純 `\x1b`）

#### ⚠️ 新證據：Bug 是 intermittent（狀態依賴）

2026-04-12 00:55 後又補了一個對照實驗：
- 使用者在 **Claude Code CLI streaming 時按 ESC → 正常**（ESC 有效中斷）
- 同樣在 streaming 時按 **Ctrl+C → 也正常**

**意義**：ESC bug **不是硬編碼永久壞**，而是**某個狀態/條件觸發才會出**。

**Worker 的預期要修正**：
- ❌ 不要預期找到一行 `pty.write('ESC')` 就能定案
- ✅ 要找**狀態分支**的 ESC 處理，例如：
  - IME composition 狀態（`isComposing` / compositionstart/compositionend）
  - Context menu 狀態（overlay 是否打開）
  - xterm internal modes（`term.modes` / `applicationCursor` / `bracketedPasteMode`）
  - Selection 狀態（和 Ctrl+C 類似，ESC 可能也有 selection 分支）
- ✅ 找**任何會根據 state 改變 ESC 行為的 branch**

**已知差異**：
- vim / less 觸發 bug：都是 alt buffer 程式，可能設了特定 DECSET mode
- Claude Code streaming 不觸發：Ink TUI 可能設了不同 mode
- 觸發條件可能和 **xterm 的 raw mode / application cursor mode / bracketed paste** 有關

#### T0032 Section 2 已知資訊（不必重驗）

- 唯一 xterm 入口：`src/components/TerminalPanel.tsx`
- `terminal.onData`：`TerminalPanel.tsx:331-337`
- `attachCustomKeyEventHandler`：`TerminalPanel.tsx:349-448`（**本工單的主要戰場**）
- `attachCustomKeyEventHandler` 對 Shift+Enter、Ctrl+V 有直接 `pty.write` 分支（line 365, 399）
- 一般按鍵（含 Ctrl+C 無選取）是 `return true` 讓 xterm 走預設 `onData`

### 本工單的唯一目標

**定位「按 ESC 鍵導致 BAT 送出字面字串 'ESC' 到 PTY」的源碼位置**。

給出：
1. 檔案路徑 + line number
2. 實際的程式碼片段（最多 20 行上下文）
3. 對 bug 行為的因果解釋
4. **建議的最小修法**（一行或幾行的 diff，但**不要直接改**，只寫在報告裡）

### 執行步驟

#### Step 1：Grep `TerminalPanel.tsx` 的 ESC 相關分支

```bash
# 從最可疑的地方開始
grep -n "'ESC'" src/components/TerminalPanel.tsx
grep -n '"ESC"' src/components/TerminalPanel.tsx
grep -n "Escape" src/components/TerminalPanel.tsx
grep -n "toUpperCase" src/components/TerminalPanel.tsx
grep -n "slice(0" src/components/TerminalPanel.tsx
grep -n "key.slice\|key\.substring" src/components/TerminalPanel.tsx
```

#### Step 2：讀 `attachCustomKeyEventHandler` 全文

`TerminalPanel.tsx:349-448`（~100 行）。重點看：
- ESC 的分支在哪
- 分支做什麼
- 是否呼叫了 `pty.write` / `terminal.write` / `process.write` 之類
- 是否有 `event.key` 的字串處理（截字、大寫、map 查表）

#### Step 3：若 `TerminalPanel.tsx` 找不到，擴大搜尋

```bash
# 專案全範圍搜尋
grep -rn "'ESC'" src/
grep -rn '"ESC"' src/
grep -rn "Escape" src/ | head -30
```

也檢查：
- `src/preload.ts` 或 `electron/preload.ts`
- `electron/main.ts` 的 pty 相關 handler
- `electron/pty-manager.ts` 的 write 路徑
- 任何 IME / 快捷鍵相關的 helper

#### Step 4：驗證猜測

Worker 可以假設下列幾個猜測，逐一驗證：

| 猜測 | 特徵 | Grep | Intermittent 相關？ |
|------|------|------|-------------------|
| 硬編碼 `'ESC'` | 某處寫死字串 | `grep "'ESC'" src/` | ❌ 不符合（會永久壞） |
| 截字 + 大寫 | `"Escape".slice(0,3).toUpperCase()` → `"ESC"` | `grep "toUpperCase" src/components/TerminalPanel.tsx` | 🟡 要看是否 state-gated |
| key name map | 有某個 `{Escape: 'ESC'}` 類 map | `grep "Escape:" src/` | 🟡 要看是否 state-gated |
| **IME composition 分支** | compositionstart 後 ESC 的特殊處理 | `grep -A 5 "isComposing\|compositionstart\|compositionend" src/components/TerminalPanel.tsx` | ✅ **強符合** |
| **xterm modes 分支** | 檢查 `term.modes` / applicationCursor / bracketedPasteMode 後改變 ESC 行為 | `grep -B 2 -A 5 "term.modes\|applicationCursor\|bracketedPaste" src/components/TerminalPanel.tsx` | ✅ **強符合** |
| **Overlay 狀態分支** | context menu open 時吃掉或轉換 ESC | `grep -B 2 -A 5 "contextMenu\|menuOpen\|overlayOpen" src/components/TerminalPanel.tsx` | ✅ **強符合** |
| **Selection 分支** | 類似 Ctrl+C，ESC 在有 selection 時做別的事 | `grep -B 2 -A 5 "hasSelection\|getSelection" src/components/TerminalPanel.tsx` | 🟡 可能 |

**優先檢查後三個（強符合 intermittent）**。

#### Step 5：產出報告

### 預期產出

**單一檔案**：`_ct-workorders/reports/T0032-ESC-key-handler-inspection.md`

結構：

```markdown
# T0032-ESC — ESC 鍵翻譯 bug 源碼定位

## 1. 結論（先說）
- 找到 / 沒找到
- 若找到：檔案:line + 一行描述

## 2. 有問題的程式碼
（貼完整 snippet，含上下文 10-20 行）

## 3. 行為因果分析
- 為什麼 Escape 鍵會變成字面 "ESC"
- 是否同時解釋 vim 的 `^[` 瞬間消失行為
- 是否同時解釋「ESC 不 dismiss context menu」

## 4. 建議的最小修法（不執行）
- 具體 diff
- 估計影響範圍（其他地方會不會壞）
- 是否需要回歸測試

## 5. 次級發現（若有）
- 閱讀過程中看到的其他可疑處理
- 對 BUG-010 / BUG-011a / BUG-011b 的影響
```

### 驗收條件
- [ ] 產出 `_ct-workorders/reports/T0032-ESC-key-handler-inspection.md`
- [ ] Section 1 給出明確「找到 / 沒找到」結論
- [ ] 若找到：Section 2 貼完整有問題的程式碼，帶 file:line
- [ ] 若找到：Section 4 給出最小修法 diff
- [ ] **無任何 source code 修改**
- [ ] **無任何 git commit**
- [ ] 15 min 內完成或回報「找不到 + 已嘗試的範圍清單」

### 執行注意事項
- **先猜再 grep**：先列 5-10 個可能的 grep pattern，跑完看結果再決定要不要深讀
- **不要讀太多**：鎖定 `TerminalPanel.tsx:349-448` 和 preload / main 的 pty write 分支。Grep 沒中的檔案不要讀
- **絕對不要改 code**：即使找到 bug 也只能記錄，不能 patch
- **時間盒 15 分鐘**：超過就停下來寫 PARTIAL + 猜測清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 產出報告：`_ct-workorders/reports/T0032-ESC-key-handler-inspection.md`
- 結論：定位到 `src/components/TerminalPanel.tsx:355-358` 的 IME state-gated key handler（ESC 在 composing 狀態會被自訂 handler 攔截，偏離 xterm 預設 ESC 路徑）
- 附加驗證：`preload/main/pty-manager` 的 `pty.write` 路徑為直通，未發現 `\x1b -> "ESC"` 字串轉換
- Git 摘要：
  - `git diff --name-only`：`_ct-workorders/_tower-state.md`（既有變更，與本工單無關）
  - `git status --short`：`?? _ct-workorders/T0032-ESC-key-handler-inspection.md`（本工單檔案目前為未追蹤）

### 互動紀錄
無

### 遭遇問題
無

### sprint-status.yaml 已更新
（不適用）

### 回報時間
2026-04-12 01:26 (UTC+8)
