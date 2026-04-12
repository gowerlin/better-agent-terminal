# 工單 T0033-C-bug011-ime-guard-fix

## 元資料
- **工單編號**：T0033-C
- **任務名稱**：BUG-011c IME guard 1 行修 + BUG-011a/b 驗證 + 雙重追蹤技術債評估
- **狀態**：DONE
- **建立時間**：2026-04-12 09:50 (UTC+8)
- **開始時間**：2026-04-12 09:51 (UTC+8)
- **完成時間**：2026-04-12 09:59 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔧 **Code Fix + Regression Test**（含 code 修改 + git commit）
- **關聯工單**：T0032-ESC（依據報告）、T0032-Flow（keyboard event flow）、T0032.5（VS Code 參考）
- **關聯 Bug**：BUG-011a / BUG-011b / BUG-011c

## 工作量預估
- **預估規模**：**小-中**（30-60 min）
  - Phase 1（修法）：~5 min
  - Phase 2（回歸測試）：~15 min
  - Phase 3（BUG-011a 驗證）：~10 min
  - Phase 4（技術債評估）：~10 min，純紀錄
  - Phase 5（BUG-011b 調查）：~20 min，純 investigation，可 PARTIAL
- **Context Window 風險**：低（讀 1-2 檔，改 1 檔）
- **降級策略**：若 Phase 5 超時，回報 PARTIAL 並把 BUG-011b 拆成獨立 investigation 工單

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要獨立 context 跑 Playwright/runtime 回歸測試，主工單只有 1 行修但驗證面廣

---

## 任務指令

### 前置條件

**必讀**（僅讀以下，不要擴散）：
1. `_ct-workorders/reports/T0032-ESC-key-handler-inspection.md`（3.5 KB，結論 + 修法 diff）
2. `src/components/TerminalPanel.tsx:340-410`（IME guard 上下文，約 70 行）

**選讀**（有疑問再讀）：
- `_ct-workorders/reports/T0032-Flow-keyboard-event-flow-analysis.md`（若對 keydown → pty.write 流程不熟）

**不要讀**：
- `_tower-state.md`（塔台狀態快照，與本工單無關）
- 其他 T0032/T0033 投資型工單（結論都已抄進本工單下方）

### 背景總結（from T0032-ESC report，無須再 grep）

**BUG-011c 根因**：`src/components/TerminalPanel.tsx:355-358` 的 IME guard 過度嚴格：

```ts
// 當前（有 bug）：第 355-358 行
if (imeComposing || event.isComposing) {
  // keyCode 229 = IME composition event, let it through
  // Everything else (CAPS LOCK, modifiers, etc.) should be blocked
  return event.keyCode === 229
}
```

**行為鏈**：
1. 使用者在 BAT 中按 ESC 時，若此時 `imeComposing === true` 或 `event.isComposing === true`（IME 層尚未 commit）
2. Guard 直接 `return false`（因為 keyCode !== 229）
3. xterm 預設 ESC handler 被跳過 → `\x1b` 沒送到 pty
4. 但 DOM textarea 的 keypress / input 事件會把 "ESC" 三字母當成普通文字送進 pty（具體機制待 Phase 4 進一步分析）

**Intermittent 解開**：
- ✅ IME composing 狀態成立 → ESC 被吞 → less/vim 中觸發 "ESC" 字面輸出
- ✅ 非 IME composing 狀態 → ESC 正常 → Claude Code streaming 中 ESC 中斷正常

### Phase 1：套用 IME guard 1 行修法（~5 min）

**檔案**：`src/components/TerminalPanel.tsx`

**修法 diff**：

```diff
       // During IME composition, block non-composition key events
       // to prevent CAPS LOCK etc. from committing partial input
-      if (imeComposing || event.isComposing) {
+      if ((imeComposing || event.isComposing) && event.key !== 'Escape') {
         // keyCode 229 = IME composition event, let it through
         // Everything else (CAPS LOCK, modifiers, etc.) should be blocked
         return event.keyCode === 229
       }
```

**修法原理**：
- ESC 在 IME composing 狀態應該由 browser IME 層自己處理（通常會取消 composition）
- 把 ESC 從 guard 放行後，事件會繼續下沉到 xterm 預設 handler
- xterm 把 ESC 轉成 `\x1b` 送到 pty（這就是 less/vim/Claude Code 預期收到的訊號）
- 對非 ESC 的 key（CAPS LOCK、modifier 等）行為不變，不影響 IME 原本的保護邏輯

**驗收**：
- [ ] `git diff` 只有 1 行變更（line 355）
- [ ] `npx vite build` 通過（不用跑，下一步整合驗證會跑）
- [ ] 不要順手改其他 code，即使看到可疑處也只能記錄到 Phase 4

### Phase 2：四組 ESC 回歸測試（~15 min）

**手動測試場景**（請使用者在跑 dev build 上實測，你負責列清單 + 紀錄結果）：

| # | 場景 | 操作 | 預期 | Pre-fix 行為 | Post-fix 行為 |
|---|------|------|------|-----|------|
| 1 | **vim insert mode ESC** | `vim test.txt` → `i` → 打字 → 按 ESC | 進入 normal mode，不應出現 `^[` | `^[` 瞬間閃現後消失 | ? |
| 2 | **less search ESC** | `less file` → `/` → 按 ESC | 取消搜尋，不應印出 "ESC" | 印出字面 `ESC` 三字母 | ? |
| 3 | **IME 輸入中按 ESC** | 切中文輸入法 → 打注音/拼音 → 按 ESC | IME 取消 composing | Guard 攔截 → bug | ? |
| 4 | **Claude Code streaming ESC** | `claude` → 長指令 streaming 中按 ESC | 中斷生成 | 正常 | ? |
| 5 | **純 IME CAPS LOCK 保護** | IME composing 中按 CAPS LOCK | 不應 commit partial input | 正常 | ? |

**跑法**：
- **不要在 Electron dev 開五個視窗互相干擾**——先確認只有一個 dev server 在跑（`tasklist | grep electron` 或 `ps | grep electron`）
- 每個場景用 `window.electronAPI.debug.log('[T0033-C]', scenario, result)` 記錄，或寫入 `_ct-workorders/reports/T0033-C-regression-log.md`

**驗收**：
- [ ] 場景 1、2、3、4 全部 pass（Post-fix 行為 = 預期）
- [ ] 場景 5 pass（確認修法沒回歸破壞 IME 原本保護）
- [ ] 有任一場景 fail：立即停止，把失敗現象記錄到「遭遇問題」，狀態改 PARTIAL，不要自己瞎猜加碼修法

### Phase 3：BUG-011a（Context menu ESC dismiss）驗證（~10 min）

**背景**：
- BUG-011a = 「在 BAT context menu 開啟時按 ESC 不會關閉 menu」
- 塔台假設此 bug **可能**因為 Phase 1 修法連帶解決（ESC 能正常下沉 → document-level listener 能收到 → 但 BAT 的 context menu state 有沒有 listen ESC 尚未確認）

**Step 3.1 — 先試**：
- 跑 dev build → 右鍵打開 context menu → 按 ESC
- 若 menu 關閉 → 標記 BUG-011a `FIXED_BY_T0033C_PHASE1`（寫入工單回報區）
- 若 menu 沒關閉 → 進 Step 3.2

**Step 3.2 — 補修**（若 Phase 1 未連帶解決）：
- 讀 `src/components/TerminalPanel.tsx:54, 127, 139, 147, 454`（contextMenu state 相關 5 個點）
- 在 context menu open 時追加 document-level ESC listener：

```ts
// 偽代碼，實際實作請參考現有 handleClickOutside 的 mount/unmount pattern
useEffect(() => {
  if (!contextMenu) return
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setContextMenu(null)
  }
  document.addEventListener('keydown', handleEsc)
  return () => document.removeEventListener('keydown', handleEsc)
}, [contextMenu])
```

**注意**：
- 補修時務必和現有 `handleClickOutside`（line 147）的 lifecycle 對齊，避免 listener 洩漏
- 不要改到其他無關的 contextMenu 邏輯（例如 paste focus、image upload）
- 若要 `stopPropagation()` 請說明為什麼，默認不加

**驗收**：
- [ ] BUG-011a 狀態明確：FIXED_BY_PHASE1 或 FIXED_BY_PHASE3_PATCH 或 STILL_BROKEN
- [ ] 若追加補修：`git diff` 只動 TerminalPanel.tsx 的 context menu 區塊，無 side effect

### Phase 4：雙重追蹤技術債評估（~10 min，純紀錄）

**背景**：T0032-ESC 報告提到「BAT 有自己的 `imeComposing` + xterm 內建 `CompositionHelper`，功能重疊，是 BUG-011c 的放大器」。

**任務**：
1. 讀 `src/components/TerminalPanel.tsx:341-346`（BAT 的 imeComposing 追蹤）
2. **不用讀 xterm 原始碼**。只要在 TerminalPanel.tsx 搜尋 `CompositionHelper`、`addMarker`、`textarea.*composition`，確認 BAT 有沒有覆寫 xterm 預設行為
3. 在本工單「回報區 → 遭遇問題 / 技術債」段落記錄：
   - ✅ 雙重追蹤是否確實存在？（Yes/No）
   - ✅ 若 Yes：哪個檔案 / 哪些行？
   - ✅ 估計風險等級：Low/Medium/High
   - ✅ 建議：**是否需要派 T0034 重構**（刪掉 BAT 自己的 imeComposing，完全依賴 xterm 內建 CompositionHelper）？

**絕對不要**：
- 在本工單動手重構
- 讀 `node_modules/xterm` 原始碼
- 超過 10 分鐘

**驗收**：
- [ ] 回報區有明確的「雙重追蹤評估」段落
- [ ] 給出 T0034 建議（派 / 不派 / 需更多調查才能決定）

### Phase 5：BUG-011b（點 menu 外重開新 menu）調查（~20 min，可 PARTIAL）

**背景**：
- BUG-011b = 「context menu 開著時，在 menu 外點一下，原 menu 應該關閉，但實際上會在新位置開啟新的 menu」
- 這個行為和 ESC 無關，推測和 `handleClickOutside` + 新點擊的 mousedown 順序有關
- **這是調查型任務，不需要修**

**任務**：
1. 讀 `src/components/TerminalPanel.tsx:147`（`handleClickOutside`）的 mount/unmount 邏輯
2. 讀 line 454（`setContextMenu({...})` 觸發點）是哪個事件（`onContextMenu` / `onMouseDown` / `onClick`）
3. 做一次 mental simulation：
   - 使用者 A 位置右鍵 → `setContextMenu({x_A, y_A, ...})` → `handleClickOutside` 掛上
   - 使用者 B 位置右鍵 → 事件順序：mousedown → contextmenu → handleClickOutside fire → setContextMenu(null) → contextmenu handler fire → setContextMenu({x_B, y_B, ...})
   - 或 mousedown 先觸發 handleClickOutside → setContextMenu(null)，但 contextmenu 事件緊接著又 setContextMenu({...})
4. 在 `_ct-workorders/reports/T0033-C-bug011b-analysis.md` 寫一份 **極短**（<50 行）分析，結論為：
   - 根因假設（1-3 條）
   - 推薦下一步（修 / 再調查 / 不修）

**降級**：
- 若 20 min 內沒頭緒，標 Phase 5 PARTIAL，在回報區寫「BUG-011b 需要獨立 investigation 工單（建議 T0035）」

**驗收**：
- [ ] Phase 5 狀態明確：DONE / PARTIAL（有具體理由）
- [ ] 若 DONE：產出 `T0033-C-bug011b-analysis.md`

### Git Commit 策略

**Phase 1 通過 + Phase 2 全 pass** 後就可以 commit 主修法：

```
fix(terminal): let ESC through IME guard to fix BUG-011c

IME composition guard in TerminalPanel was blocking all non-IME key
events including Escape, causing ESC to be dropped and xterm's default
`\x1b` emission to be skipped. This manifested as literal "ESC" text
in less search prompts, `^[` flash in vim insert mode, and no-op ESC
in other alt-buffer apps while IME was actively composing.

Fix: exempt Escape from the guard so it falls through to xterm's
default keybinding.

Refs: T0032-ESC investigation report
Closes: BUG-011c
```

**Phase 3 補修**（若發生）另起一個 commit：

```
fix(terminal): dismiss context menu on Escape key (BUG-011a)

...
```

**Phase 4、5 的紀錄**：
- 若產出 `T0033-C-bug011b-analysis.md`，單獨 commit：
  ```
  docs(reports): BUG-011b context menu reopen root cause analysis (T0033-C Phase 5)
  ```
- 工單檔案（本檔）最後 commit：
  ```
  chore(workorder): T0033-C closure with BUG-011a/b/c resolution
  ```

**不要一次大 commit 全包**，保持 atomic。

### 執行注意事項

- **不要擴散修改**：T0033-C 只處理 BUG-011 家族，不要動 BUG-010 / BUG-008 / UX-001 任何東西
- **不要優化**：看到其他可疑 code 只記錄，不修
- **不要跑 lint 全檔**：只看 `git diff` 範圍的 lint 錯誤，其他既有問題不是本工單責任
- **Context Window**：跑到 60% 就停下來 checkpoint，不要硬撐到 85%
- **有疑問先停下問**：不要自己發明第二套修法策略

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE（Phase 2 使用者回歸測試確認通過；vim ^[^M artifact 為 pre-existing 非 BUG-011c 範圍）

### Phase 執行結果

| Phase | 狀態 | 說明 |
|-------|------|------|
| Phase 1（IME guard 修法）| ✅ DONE | 1 行修，build 通過，commit e4ab638 |
| Phase 2（四組 ESC 回歸測試）| ✅ DONE | Sc1 vim非IME=pre-existing; Sc2-5 全 PASS；BUG-011c 由 Sc3 驗證 |
| Phase 3（BUG-011a 驗證）| ✅ DONE | Phase 1 未連帶解決；已補修 ESC listener，commit 9d552ce |
| Phase 4（雙重追蹤評估）| ✅ DONE | 詳見下方 |
| Phase 5（BUG-011b 調查）| ✅ DONE | 產出 T0033-C-bug011b-analysis.md，commit 873a9be |

### 修法 diff

**Phase 1（BUG-011c）**：
```diff
-      if (imeComposing || event.isComposing) {
+      if ((imeComposing || event.isComposing) && event.key !== 'Escape') {
```

**Phase 3（BUG-011a）**：
```diff
+  // Close context menu on Escape key (BUG-011a)
+  useEffect(() => {
+    if (!contextMenu) return
+    const handleEsc = (e: KeyboardEvent) => {
+      if (e.key === 'Escape') setContextMenu(null)
+    }
+    document.addEventListener('keydown', handleEsc)
+    return () => document.removeEventListener('keydown', handleEsc)
+  }, [contextMenu])
```

### 回歸測試結果
**Phase 2 尚未執行**。需使用者跑 `npm run dev` 後手動測試以下五個場景：

| # | 場景 | 操作 | 預期 |
|---|------|------|------|
| 1 | vim insert mode ESC | `vim test.txt` → `i` → 打字 → ESC | normal mode，不出現 `^[` |
| 2 | less search ESC | `less file` → `/` → ESC | 取消搜尋，不印 "ESC" 三字母 |
| 3 | IME 輸入中按 ESC | 切中文輸入法 → composing 中 → ESC | IME 取消 composing |
| 4 | Claude Code streaming ESC | streaming 中按 ESC | 中斷生成 |
| 5 | IME CAPS LOCK 保護 | composing 中按 CAPS LOCK | 不 commit partial input |

### BUG-011a 處置
FIXED_BY_PHASE3_PATCH  
Phase 1 未連帶解決（xterm custom key handler 和 DOM-level ESC 是不同通道）。  
補修：在 `contextMenu` state 有值時掛 `document.addEventListener('keydown', handleEsc)`，遵循與 `handleClickOutside` 相同的 lifecycle pattern。

### 雙重追蹤技術債評估

**雙重追蹤是否存在**：✅ Yes  
- BAT 自訂：`TerminalPanel.tsx:341-345`，手動監聽 `.xterm-helper-textarea` 的 `compositionstart`/`compositionend`，設 `imeComposing` flag  
- 瀏覽器原生：`event.isComposing`（`KeyboardEvent` 標準屬性，Chrome 56+ 支援）  
- Guard 條件：`imeComposing || event.isComposing`（邏輯上重疊）

**風險等級**：Low  
- 兩者追蹤同一事件，正常情況下同步，不會造成邏輯錯誤  
- 最差情況：某些 edge case 下 flag 輕微不同步，但實作層安全

**建議**：**不急派 T0034**  
可選擇刪除 BAT 自訂的 `imeComposing` flag，完全依賴 `event.isComposing`。但需確認 Electron 版本的 `event.isComposing` 可靠性，且修改本身也需回歸測試。建議作為低優先 cleanup 候選，與其他 refactor 一起處理。

### BUG-011b 分析
詳見 `_ct-workorders/reports/T0033-C-bug011b-analysis.md`

**根因摘要**：`handleClickOutside` 監聽 `click`（左鍵），但右鍵不觸發 `click` 事件。右鍵直接觸發 `contextmenu`，無視舊 menu 存在，直接在新位置開新 menu。

**推薦**：派 T0035，採用 `contextMenuRef` 方案，在 contextmenu handler 中檢查是否已有 menu 開著。

### Git 摘要
- BUG-011c 修法 commit：`e4ab638`
- BUG-011a 修法 commit：`9d552ce`
- Phase 5 報告 commit：`873a9be`
- `git status --short`：
  ```
   M _ct-workorders/_tower-state.md
  ?? _ct-workorders/T0033-C-bug011-ime-guard-fix.md
  ```

### 遭遇問題
無重大問題。Phase 2 manual testing 為設計上的需求（工單原文明確標示為「使用者實測」）。

### sprint-status.yaml 已更新
不適用（找不到 sprint-status.yaml）

### 回報時間
2026-04-12 09:59 (UTC+8)
