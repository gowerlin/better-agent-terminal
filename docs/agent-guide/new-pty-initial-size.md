# 新 PTY 的初始尺寸：隱藏分頁不 fit（T0741 / BUG-180）

> CLAUDE.md「新 PTY 的初始尺寸（T0572 / BUG-145）」節中 T0741 部分的完整說明。T0572 本身（`requestPtySizeSync`、去重、已知限制）仍完整寫在 CLAUDE.md 該節。

## 現象（BUG-180）

從「+」選單連續開分頁（例：Claude CLI → 以塔台開啟 Claude），前一個分頁的 PTY 被 resize 成 `cols=9 rows=5`，直到切回該分頁才恢復；這段期間 agent TUI 以 9 欄繪製。T0736 的 e2e 每次都記到（`Claude CLI: 9x5 before selecting it, 137x35 after`）。

## 原因（T0741 查證）

1. TerminalPanel 掛載時若分頁 active，排 100 ms 後的 initial `doResize()`；計時器到期時沒有再檢查 `isActiveRef.current`（同檔 ResizeObserver debounce、`requestPtySizeSync` sink、設定變更都有檢查）。這 100 ms 內下一個分頁已成為 active，於是對已隱藏的分頁 fit。
2. 隱藏的分頁在 `.terminal-wrapper.hidden`（`display: none`，`src/styles/layout.css`）裡，容器的版面尺寸是 0x0。但 FitAddon（`@xterm/addon-fit` 0.10.0 `proposeDimensions`）以 `getComputedStyle(parent).height / width` 取尺寸：沒有被繪製的元素回傳宣告值 `100%`，`parseInt('100%')` = 100 px。扣掉 `.xterm` 的 padding 8 px × 2 與捲軸寬，約 9 × 5 個格子。
3. `fit()` 先把 xterm 自己 resize 成 9x5，`doResize` 再把同一尺寸送給 PTY。切回分頁時 isActive effect 重新 fit，才回到正常尺寸。

## 規則

- 🔴 容器沒有版面尺寸（`getBoundingClientRect()` 的寬或高 ≤ 0，或不是有限數字）時：不 fit、不送 `pty:resize`、**不更新** `lastSentCols` / `lastSentRows`（否則容器恢復後同尺寸會被去重擋掉）。判斷唯一實作 `canFitTerminalContainer`（`src/lib/terminal-fit-guard.ts`，純函式）。
- TerminalPanel 的呼叫點只有兩個：`doResize` 開頭（所有 resize 路徑：isActive effect、initial、ResizeObserver debounce、`requestPtySizeSync` sink、設定變更）與手動重繪 `terminal-redraw`（在 `terminal.resize(cols + 1, …)` 之前；否則隱藏的分頁會停在多一欄）。🔴 新的 fit 路徑一律經 `doResize`，不要直接呼叫 `fitAddon.fit()`。
- initial resize 計時器到期時分頁已不 active → 不做（與 ResizeObserver debounce 相同的檢查）；計時器在 unmount 時清除。
- 略過時記 debug log：`[resize] skipped (container has no size) terminal=<id>`、`[resize] initial doResize skipped (no longer active) terminal=<id>`、`[redraw] skipped (container has no size) terminal=<id>`。

## 行為不變

- T0572：`requestPtySizeSync`（`created: true` 與 ⏻ restart 後重送尺寸、hidden 分頁等下次 activation 送出）不變。hidden 時 sink 仍重設去重，只是 `doResize` 本來就不會被呼叫（`isActiveRef` 檢查）；容器 0x0 的 active 分頁則由守門略過，去重維持重設，下一次有尺寸時送出。
- active 分頁正常 resize、切回分頁時恢復 fit 尺寸、ResizeObserver 200 ms debounce 都不變（有版面尺寸的容器守門恆為真）。
- 背景分頁不 fit 的既有設計不變：沒被選過的分頁 PTY 維持 spawn 尺寸 120x30（或被隱藏前送過的尺寸），直到第一次切過去。
- 非 `display: none` 的隱藏（隱藏工作區的 `visibility: hidden`）有版面尺寸，行為與修正前相同。

## 驗證

- 單元：`src/lib/__tests__/terminal-fit-guard.test.ts`（純函式）；`src/__tests__/terminal-pty-size-sync.test.tsx` 的 T0741 區塊（掛載 active → 100 ms 內變 hidden → 不 fit、不送；切回送 fit 尺寸；容器 0x0 時 `requestPtySizeSync` / 重繪都不送、xterm 不變、去重不動；寬或高單獨為 0 也略過）。拿掉修正時這三個測試失敗（T0741 實測）。
- e2e：`e2e/t0741-hidden-new-tab-pty-size.spec.ts`（隔離實例，需先 `npx vite build`）：「+」→ Claude CLI、「+」→ 以塔台開啟 Claude，間隔一個 frame，三輪；以主行程 `[resize] pty:resize id=…` 日誌檢查前一個分頁被選取前沒有過小的尺寸（< 20 欄或 < 8 列），選取後最後一次尺寸與 active 分頁相同。claude 用暫存 home、`ANTHROPIC_BASE_URL` / proxy 指向 `127.0.0.1:9`，不連外。T0741 實測：未修正的 build 三輪都是 `["137x35","9x5"]`（失敗），修正後 `137x35`、沒有 9x5（通過）。
- 為什麼用 Claude CLI 項目：只有新增時**先** `setFocusedTerminal` 再 await 的項目（Claude CLI、以塔台開啟 Claude、Claude CLI worktree）讓新分頁以 active 掛載、排 initial timer。「+」→ Terminal（shell）在 `await getShellFromSettings()` 之後才 focus，新分頁以 hidden 掛載、不排 initial timer，所以 shell 版的同一測試在未修正的 build 也通過（T0741 實測），不能用來重現。
- 既有 e2e 照常綠（T0741 實測）：`e2e/t0572-new-pty-initial-size.spec.ts`（還原 / 4 個新分頁 / ⏻ 重啟，PTY 與 xterm 尺寸相同）、`e2e/t0571-shift-right-click-copy.spec.ts`（active 分頁的重繪）、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（記到的「before selecting it」由 9x5 變成 137x35）。
