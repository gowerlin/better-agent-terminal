---
schema_version: 1
schema_kind: workorder
id: T0672
title: "修正：BUG-166 — 滑鼠回報被 shell 印成文字時自動關閉本機滑鼠追蹤（F1）+ 右鍵選單「重設滑鼠模式」（F2）"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-166
priority: P2
sizing: S
created_at: "2026-10-19T17:35:11+0800"
depends_on: []
related:
  - "BUG-166（OPEN；T0671 研究結論與 F1 / F2 提案）"
  - "T0671（研究單，回報區「修正方向」表 = 本單規格來源）"
  - "BUG-142 / T0568 / T0569 / T0571 / T0573（右鍵選單、Esc、Shift 拖曳選取；不得退化）"
affects_files:
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-context-menu.ts
  - src/lib/mouse-tracking-reset.ts
  - src/lib/__tests__/mouse-tracking-reset.test.ts
  - src/__tests__/terminal-context-menu.test.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - e2e/t0672-mouse-tracking-reset.spec.ts
  - CLAUDE.md
  - docs/agent-guide/terminal-context-menu.md
  - _ct-workorders/T0672-fix-bug166-reset-leftover-mouse-tracking.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 `affects_files` 列出的檔案（新檔名可依實作調整，回報寫明）；不改 BUG-166 / 其他工單 / 塔台狀態檔。commit 後**不 push**。"
  - "🔴 不改 xterm 寫進 PTY 的滑鼠回報內容與時機（BUG-142 原則）；本單只在**本機 xterm** 用 `terminal.write(DECRST…)` 關閉追蹤，**不得寫進 PTY**。"
  - "🔴 yolo Worker：不得問使用者；範圍內判斷問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0672 — 修正 BUG-166：滑鼠追蹤殘留的自動 / 手動重設

## 目標

codex 等 TUI 被訊號結束或崩潰時不還原滑鼠追蹤，xterm 停在追蹤模式，滑鼠移動 / 滾輪的 SGR 回報被 shell 當成文字插進命令列（BUG-166，T0671 實測）。BAT 不需要知道 TUI 怎麼結束：看到症狀就在本機 xterm 關掉追蹤（F1），並提供手動重設（F2）。

## 規格

先完整讀 `T0671-research-bug166-mouse-tracking-left-on-after-agent-exit.md` 回報區（特別是「修正方向」表、§3 結果表、zsh / bash 的回顯樣式），以及 `docs/agent-guide/terminal-context-menu.md`。

### F1：回報被回顯成文字 → 本機關閉追蹤

- 觸發：xterm 處於滑鼠追蹤（`terminal.modes.mouseTrackingMode !== 'none'`），BAT 剛經 `onData` 送出的 SGR 滑鼠回報（`ESC[<Cb;Cx;CyM/m`）的本體（去掉 `ESC[<`，例 `35;52;69M`）在短時間內（約 500 ms，常數具名）出現在 PTY 輸出中。比對前先去掉 shell 可能插入的 `\x07` / `\x08` 等控制字元（zsh 會輸出 `3^H35;…`，見 T0671）。
- 動作：`terminal.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l')`（只寫本機 xterm，**不寫 PTY**），`selectionKeeper.forget(...)`（或等效清除），記一行日誌 `[mouse-tracking] reset: reports echoed as text`（經 `window.electronAPI.debug.log`；不記輸出內容）。
- alt screen（1049）**不**自動離開。
- 比對與 SGR 解析放 `src/lib/` 純函式（不 import DOM / electron），單元測試覆蓋：命中、未命中、控制字元穿插、跨多次輸出 chunk、超過時間窗、非追蹤狀態不觸發、正常 agent 執行中（回報未被回顯）不觸發。
- 誤判邊界：只有「追蹤中且程式原樣回顯輸入」才會觸發；回報寫明。

### F2：右鍵選單「重設滑鼠模式」

- 終端分頁的 BAT 右鍵選單（`shouldShowTerminalContextMenu` 那套）加一項「重設滑鼠模式」，動作同 F1 的本機 DECRST + 清除 keeper + 日誌 `[mouse-tracking] reset: manual`。
- 追蹤中仍可用 Shift + 右鍵叫出選單（既有行為）。是否一併提供離開 alt screen（`?1049l`）由 Worker 判斷：做的話放成獨立選項，回報說明理由。
- i18n：`en.json` / `zh-TW.json` / `zh-CN.json` 三語系都要有（zh-TW 用「重設滑鼠模式」）。

### 文件

- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節：🔴 那句「不改 xterm 寫進 PTY 的滑鼠回報」後補例外一句（回報已被回顯成文字時於本機關閉追蹤；手動重設），並寫唯一實作位置。**不改 `##` 標題**；維持本節 ≤ 12 行原則，細節寫進 `docs/agent-guide/terminal-context-menu.md`（原因、觸發條件、時間窗常數、日誌、已知限制：第一筆殘骸仍會進命令列、alt screen 不自動離開、Windows 原生 ConPTY 不會發生）。

## 不得退化

- BUG-142 / T0568：追蹤中不開 BAT 右鍵選單、Shift + 右鍵一律開。
- T0569：選單開著時 Esc 關選單。
- T0571 / T0573：追蹤中 Shift 拖曳選取、`MouseReportSelectionKeeper`、`registerCsiHandler` 偵測重送 DECSET、`SelectionDrag.resume()`。
- codex / claude 執行中的滑鼠行為（回報照常送、捲動照常）。
- Ctrl+滾輪縮放、Win11 `clearTextureAtlas`。

## 驗收

1. `npm run test:unit` 全過（基線 5635 passed / 321 files / 3 skipped，回報新數字）。
2. `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
3. `npx vite build` 成功。
4. 新 e2e `e2e/t0672-mouse-tracking-reset.spec.ts`（需先 `npx vite build`）：shell 分頁 `printf` 開 `?1003h?1006h` → 模擬滑鼠移動 → 第一筆之後 `mouseTrackingMode` = `none`、shell stdin 不再收到回報；F2 選單項目可重設。Windows 本機若 ConPTY 吃掉回報無法重現 F1，改用 WSL 分頁或記錄限制並以單元測試 + F2 e2e 補足，回報寫明。
5. 既有 `e2e/t0568-context-menu-mouse-tracking.spec.ts`、`e2e/t0571-shift-right-click-copy.spec.ts`、`src/__tests__/terminal-context-menu.test.tsx` 不退化。

## 收尾

- commit（產品 + 測試 + 文件 + 本工單），訊息含 `T0672` / `BUG-166`；不 push。
- 回報區寫：改動摘要、驗收結果數字、e2e 結果、限制、建議 BUG-166 狀態（FIXED 待 Gary 實機）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
