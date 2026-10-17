---
schema_version: 1
schema_kind: workorder
id: T0573
title: "BUG-144 重修：真實 claude CLI 分頁 Shift + 拖曳後 Shift + 右鍵仍只有「貼上」（T0571 實機無效）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-144
priority: P2
sizing: S-M
created_at: "2026-10-17T10:05:10+0800"
updated_at: "2026-10-17T10:05:10+0800"
target_version: "0.6.1-pre.9（未排發版）"
depends_on: []
related:
  - "BUG-144（「實機驗收失敗（pre.8）」一節：反白仍在、選單只有「貼上」）"
  - "T0571 `35eaf125`（`MouseReportSelectionKeeper`；回報區有 xterm 5.5.0 根因證據與修正前實測表）"
  - "BUG-142 / T0568（追蹤中不按 Shift 不開選單）、BUG-143 / T0569（選單 Esc）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - "src/__tests__/terminal-context-menu.test.tsx"
  - "e2e/t0571-shift-right-click-copy.spec.ts（或新的 e2e/t0573-*.spec.ts）"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤」一節，修正 / 補充 T0571 那條）"
  - _ct-workorders/T0573-shift-right-click-copy-real-claude.md
  - _ct-workorders/BUG-144-shift-right-click-menu-missing-copy-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。可讀使用者的 `%APPDATA%\\BetterAgentTerminal\\Logs\\debug-*.log` 找線索（只讀）。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報與其他輸入；不改 T0568「追蹤中不按 Shift 的右鍵不開選單」與 T0569 的 Esc 行為。"
  - "🔴 在隔離實例跑真實 claude CLI 時**不得送出任何 prompt**（不耗額度）；只用 REPL 啟動後畫面上已有的文字（歡迎框、提示列等）做選取。"
---

# T0573 — BUG-144 重修：真實 claude CLI 的 Shift + 右鍵「複製」

## 背景

T0571（`35eaf125`，隨 `0.6.1-pre.8` 發佈）的根因是：xterm 5.5.0 把滑鼠回報當成使用者輸入，送出回報時就清掉選取；claude CLI 開了 1003，滑鼠每移動一格都會送回報。修正方式是 `MouseReportSelectionKeeper`：選取剛被 SGR 滑鼠回報清掉時，在同一個 task 內把它放回原範圍。T0571 的 e2e 用 node 腳本模擬（alt screen + 1000 / 1002 / 1003 / 1006），測試通過。

**pre.8 實機結果無效**（2026-10-17，本機 Windows，BAT `0.6.1-pre.8`，塔台分頁跑真實 claude CLI 2.1.300）：依「按住 Shift 拖曳選取 → 移動滑鼠 → Shift + 右鍵」操作後，**畫面上的藍底反白還在**，但 BAT 選單**只有「貼上」**。

可見 node 腳本模擬和真實 claude 有落差。這張單先找出落差在哪裡，再修。

## 任務

1. **用真實 claude CLI 重現**（隔離實例，例如內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 或系統 claude；**不送 prompt**）：
   - 在 Shift + 拖曳結束、移動滑鼠、Shift + 右鍵 mousedown、`contextmenu` 這幾個時間點，記錄 `terminal.getSelection()` / `hasSelection()`、keeper 的內部狀態，以及 `onData` 實際送出的序列（可沿用 T0571 從 React fiber 取 `terminal` 的診斷寫法，用完刪掉）
   - 先確認**反白是誰畫的**：是 xterm 的選取（`hasSelection()` 為真），還是 claude 自己畫的。若是 xterm 選取但選單還是沒有「複製」，要查 `selectionText` 在哪一步變成空字串
   - 以下候選都要逐一確認或排除，結論寫在回報區：
     - (a) 有 SGR 以外的 `onData` 也觸發清除，keeper 不會放回：例如 focus report `ESC [ I` / `ESC [ O`（claude 會開 DECSET 1004；T0571 的腳本沒開）、游標位置回報等自動回應。xterm 對這些序列的 `triggerDataEvent` 是否帶 `wasUserInput = true`，要看原始碼確認
     - (b) claude 的輸出（重繪、捲動、清畫面、切換 buffer）清掉選取，或讓 keeper 的 microtask 時間窗對不上
     - (c) Shift 拖曳在 Windows 上其實有送回報給 claude，反白是 claude 畫的
     - (d) `selectionText` 的取值時機或 React state 更新順序（例如右鍵當下讀到的是放回之前的空值）
     - (e) 其他你實際觀察到的原因
2. **修正**：真實 claude CLI 分頁做到 Shift + 拖曳 → 移動滑鼠 → Shift + 右鍵時，選單有「複製」，點下後剪貼簿內容 = 反白文字。做法依根因決定。下列行為不得破壞：一般 shell 的右鍵選單與「複製」、追蹤中不按 Shift 的右鍵（T0568）、選單開著時的 Esc（T0569）、打字後不放回選取、保存的選取不會被後續的右鍵沿用（T0571 已有的保護）。
3. **診斷日誌**：Shift + 右鍵開選單時，用 `window.electronAPI.debug.log` 記一行 `[terminal-context-menu]`，內容包含 `mouseTrackingMode`、`hasSelection`、`selectionText` 長度、keeper 最近一次動作（例如 restored / dropped 及原因）。只在開選單時記，不要每次移動滑鼠都記。這樣下次實機若再失敗，可以直接從使用者的日誌判讀。
4. **測試**：
   - 元件 / 單元測試補上根因對應的案例
   - e2e 腳本要更接近 claude：至少加上你找到的根因條件（例如開 1004 並由 BAT 送出 focus report、週期重繪）
   - 隔離實例用真實 claude CLI 實測一次，修正前後各一次，結果寫在回報區。真實 claude 實測不必寫成常駐 e2e
5. BUG-144 → FIXED，填上 commit；CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤」修正 T0571 那條（寫清楚實際根因）。

## 驗收條件

- [ ] 根因有證據，回報區有 (a)–(d) 每一項的結論，並寫明實機反白是誰畫的
- [ ] 隔離實例跑真實 claude CLI：Shift + 拖曳 → 移動 → Shift + 右鍵 → 有「複製」且剪貼簿內容正確（修正前後對照）
- [ ] 一般 shell、追蹤中不按 Shift、Esc、打字後不放回，行為都不變
- [ ] 開選單時有 `[terminal-context-menu]` 診斷日誌
- [ ] `npm run test:unit` 全綠（基線 4633 passed / 266 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] e2e `t0568` / `t0571`（或新的 `t0573`）通過
- [ ] BUG-144 → FIXED

---

## 回報區

> 以下由 sub-session 填寫
