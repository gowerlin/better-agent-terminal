---
schema_version: 1
schema_kind: workorder
id: T0698
title: "BUG-165 修正：Codex 分頁在 alt screen + 滑鼠追蹤時，依滾輪像素累積行數送多個滑鼠回報（上限約 8），讓捲動接近 iTerm2"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-165
priority: P3
sizing: S
created_at: "2026-10-22T01:48:04+0800"
target_version: "0.7.1-pre.6"
depends_on: []
related:
  - "BUG-165（OPEN）與 T0670 研究（`8c581f5b`，回報區）：xterm.js 5.5 在滑鼠追蹤模式下每個 wheel 事件最多送 1 個回報，多的行數丟掉；codex 0.163 在 alt screen 自己接管滑鼠，每個回報捲 `tui.mouse_scroll_speed` 行（預設 1）。iTerm2 依累積行數送多個回報（每事件 ≤ 32）"
  - "D181（`v0.7.1-pre.6` 發版批次），使用者 2026-10-22 決定本批就做修正，讓外部測試者A 直接用 pre.6 驗"
  - "CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」：🔴 不改 xterm 寫進 PTY 的滑鼠回報語意；T0672 `MouseReportEchoDetector`（`src/lib/mouse-tracking-reset.ts`）接在 TerminalPanel 的 `onData` / `writeOutput`"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/terminal-wheel-reports.ts（新檔，純函式：判斷條件與累積換算）"
  - "src/lib/__tests__/terminal-wheel-reports.test.ts（新檔）"
  - "src/__tests__/（TerminalPanel 相關測試，必要時）"
  - "docs/agent-guide/terminal-wheel-reports.md（新檔）"
  - "e2e/t0698-codex-wheel-reports.spec.ts（選用，新檔）"
  - _ct-workorders/T0698-fix-bug165-codex-wheel-reports.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：只在「分頁是 codex（判斷方式見下）＋ 目前在 alt buffer ＋ 程式開了滑鼠追蹤 ＋ SGR 編碼（`?1006`）」全部成立時接管 wheel 事件；其他情況（一般 shell、claude、normal buffer、未追蹤、非 SGR）行為與現在**完全相同**，交回 xterm 預設處理。"
  - "🔴 做法：`terminal.attachCustomWheelEventHandler`。依 `deltaMode`（pixel / line / page）與 cell 高度把 delta 換成行數並累積小數餘量，每個事件送 `floor(累積)` 個 SGR 滾輪回報（上限 8，超過的丟掉並清掉餘量，避免慣性堆積），送完回傳 `false` 阻止 xterm 再送一次。回報格式、座標（1 起算的 col/row，取滑鼠所在 cell）、修飾鍵位元與 xterm 自己產生的 SGR wheel 回報逐位元相同（對照 xterm 原始碼並附出處）；送出路徑與 xterm `onData` 相同，讓 T0672 的 `MouseReportEchoDetector` 照樣看得到。方向（上 / 下）與 `deltaY` 正負對應照 xterm。"
  - "🔴 「是 codex 分頁」的判斷：先找 TerminalPanel 已有的 agent 資訊（分頁的 agent preset / 啟動命令來源），不要自己解析輸出；判斷寫在 `src/lib/terminal-wheel-reports.ts` 的唯一函式。若找不到可靠的 agent 資訊、或你認為不限 codex 更合理（例如 claude 也開了追蹤），用 BAT 通道問塔台，不要自行擴大。"
  - "🔴 不改：xterm 版本、`smoothScrollDuration` / `scrollSensitivity`（T0670 不建議）、PTY 寫入其他路徑、BAT 不注入 `-c tui.*`。不要修改 CLAUDE.md（同批 T0697 也在改，避免同檔並行）：把建議加進 CLAUDE.md 的一節（3–8 行，照 CLAUDE.md 撰寫規則）寫在回報區，由塔台在兩張完成後套用；細節寫在新的 `docs/agent-guide/terminal-wheel-reports.md`。"
  - "🔴 驗證：單元測試涵蓋條件判斷（每個條件不成立時都交回 xterm）、pixel / line / page 換算、餘量累積、上限 8、方向、修飾鍵、座標、回傳值；與 xterm 產生的回報逐位元比對（可用 jsdom + 真 xterm 實例或擷取 xterm 原始碼的編碼函式對照）。`npm run test:unit` 全綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。e2e 選做（隔離實例，在分頁內用 node 腳本開 alt screen + `?1000h?1006h`，派送 wheel 事件，記錄收到的回報數）；不得以預設實例（無 `--runtime`）啟動 source build，不碰使用者正在用的 BAT；不開會耗 token 的 codex turn。macOS 觸控板的實際手感需外部測試者A 實機確認，列進回報區「需實機驗證」。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。同批 T0697 同時在 repo 內工作：只 commit 本單 `affects_files`，不碰 `package.json` / `package-lock.json` / CLAUDE.md。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報與 docs 只用代稱（外部測試者A），路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0698 — BUG-165：Codex 分頁滾輪送多個回報

## 背景

- 外部測試者A（macOS）：Claude CLI 分頁捲動順，Codex 分頁比較頓（BUG-165）。
- T0670 研究結論：codex 在 alt screen 接管滑鼠，每個滾輪回報捲固定行數；xterm.js 在滑鼠追蹤模式下每個 wheel 事件最多送 1 個回報，觸控板高頻 pixel-delta 與慣性事件的多餘行數全被丟掉（實測 60 個 × 50 px 快速滑動應捲 173 行，只送 60 個回報）。iTerm2 依累積行數送多個回報。
- 使用者決定本批就修（D181 批次，`v0.7.1-pre.6`），讓外部測試者A 用 pre.6 直接驗。使用者端暫解 `mouse_scroll_speed = 3` 仍保留在更版重點。

## 實作

1. `src/lib/terminal-wheel-reports.ts`：條件判斷（codex 分頁 + alt buffer + 滑鼠追蹤 + SGR）、delta → 行數換算與餘量累積、SGR 回報編碼，全部是純函式。
2. `TerminalPanel.tsx`：`attachCustomWheelEventHandler` 接上；條件不成立回傳 `true`（交回 xterm）。
3. 測試與 docs（見 `memory_overrides`）。

## 驗收

- [ ] 條件全部成立時，每事件依累積行數送 1–8 個回報，與 xterm 產生的 SGR wheel 回報逐位元相同
- [ ] 任何條件不成立時行為與現在相同（測試證明）
- [ ] `npm run test:unit` 全綠；兩個 typecheck = 0；`npx vite build` exit 0
- [ ] `docs/agent-guide/terminal-wheel-reports.md` 與回報區的 CLAUDE.md 建議段落
- [ ] 需實機驗證清單（macOS 觸控板手感、Windows / Linux 滑鼠滾輪）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 實作摘要

### CLAUDE.md 建議段落

### 驗證證據

### 需實機驗證

### 遭遇問題

### Commit

### 回報時間
