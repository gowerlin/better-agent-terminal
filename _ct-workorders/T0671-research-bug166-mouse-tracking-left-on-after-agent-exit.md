---
schema_version: 1
schema_kind: workorder
id: T0671
title: "研究：BUG-166 — Agent 結束後滑鼠回報被當成文字送進 shell（滑鼠追蹤殘留）的根因與修正方向（唯讀）"
type: research
status: TODO
repo: better-agent-terminal
project: BUG-166
priority: P2
sizing: S
created_at: "2026-10-19T15:52:11+0800"
depends_on: []
related:
  - "BUG-166（OPEN；Gary 截圖、塔台初判）"
  - "BUG-165 / T0670（同時進行：Codex CLI 捲動順暢度研究，也會碰滑鼠追蹤；兩邊只讀、不互改檔案）"
  - "BUG-142 / T0568 / T0569 / T0571 / T0573（右鍵選單與滑鼠追蹤、Shift 拖曳選取；`src/lib/terminal-context-menu.ts`、TerminalPanel `registerCsiHandler`）"
affects_files:
  - _ct-workorders/T0671-research-bug166-mouse-tracking-left-on-after-agent-exit.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-166 / T0670 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 Gary 截圖含客戶專案路徑：不得複製進 repo；引用時去識別化。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 Gary 做的事寫成「給 Gary 的問題 / 測試」清單。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0671 — 研究：BUG-166 滑鼠追蹤殘留

## 研究目標

Gary（macOS，`v0.7.1-pre.3`）回報：點到「已完成工單」的 Worker 分頁時，有時 shell 命令列不斷冒出 `35;52;69M35;55;66M…64M39;3;64M` 這類字串。塔台初判是 SGR 滑鼠回報殘留（見 BUG-166「塔台初判」）。請**證實或推翻**初判，找出是誰讓追蹤模式留著，並給出可決策的修正方向。

## 已知資訊

- 先讀 `BUG-166-mouse-reports-leak-as-text-after-agent-exit.md`。
- 截圖：提示列是 zsh + powerlevel10k，codex 已結束（回到 shell）；字串持續增長，含 `35;…M`（移動）與 `64;…M`（滾輪）。
- BAT 既有滑鼠追蹤相關邏輯：`shouldShowTerminalContextMenu` / `MouseReportSelectionKeeper`（`src/lib/terminal-context-menu.ts`），TerminalPanel 的 `registerCsiHandler`（偵測重送的追蹤 DECSET）、`SelectionDrag.resume()`；完整說明 `docs/agent-guide/terminal-context-menu.md`。

## 調查範圍

1. **重現**：在 WSL（原生 PTY，bash / zsh 皆可）與本機 Windows（ConPTY）各試：
   - codex 正常結束（`/quit` 或 Worker 完成後結束）→ 回到 shell 後移動滑鼠 / 滾輪，是否出現殘骸。
   - codex 被中斷（Ctrl+C、kill、PTY 中途 SIGHUP 等）→ 同上。
   - 對照：手動 `printf '\e[?1003h\e[?1006h'` 後回到 shell，確認現象相同（證實是追蹤模式殘留）。
   - 記錄 xterm `terminal.modes.mouseTrackingMode` 在各步驟的值（可用 e2e / 測試 harness 或隔離實例的 DevTools）。
2. **誰留下追蹤模式**：codex 結束時是否送出 `?1003l` / `?1006l`（WSL 擷取 PTY 位元組流，沿用 T0666 方法）；BAT 的 `registerCsiHandler` / `MouseReportSelectionKeeper` / `SelectionDrag.resume()` 是否會在 codex 結束後重新開啟或保留追蹤。
3. **平台範圍**：是否只在 macOS 發生（ConPTY 對 DECSET 1003 / 1006 的轉送與 reset 行為和原生 PTY 不同）。結論寫「macOS 專屬 / 跨平台 / 無法判定」並附依據。
4. **修正方向**（只提案）：例如 PTY 前景程序結束 / shell 提示列返回時重設滑鼠模式、或偵測到「追蹤中但送出的回報被 shell 當文字」時自動關閉；各方案的觸發時機、風險、與 BUG-142 / T0571 既有行為的互動（不得退化），切分 S / M。
5. **與 BUG-165 的關聯**：codex 使用哪種追蹤模式（1000 / 1002 / 1003），any-event 追蹤是否讓每次滑鼠移動都送回報給 codex、影響捲動順暢度（只記觀察，BUG-165 由 T0670 負責）。

## 研究指引

- 結論每條標「原始碼 / 實測 / 推論」，不轉述未證實的根因。
- 給 Gary 的確認測試 ≤ 3 項（BUG-166「待確認」可沿用或修改）。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 Gary 回答的事寫進回報區「給 Gary 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
