---
schema_version: 1
schema_kind: workorder
id: T0670
title: "研究：BUG-165 — macOS Codex CLI 分頁內捲動不夠順，BAT 端可改善的因素（唯讀）"
type: research
status: TODO
repo: better-agent-terminal
project: BUG-165
priority: P3
sizing: S
created_at: "2026-10-19T15:42:53+0800"
depends_on: []
related:
  - "BUG-165（OPEN；Gary 回報）"
  - "BUG-136（CLOSED；T0666 研究：Codex alt screen 輸出特性、WSL 原生 PTY 擷取方法）"
  - "BUG-164 / T0669（macOS 預設 `--disable-skia-graphite`）"
affects_files:
  - _ct-workorders/T0670-research-bug165-codex-cli-scroll-smoothness.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 研究單、**唯讀**：不改任何產品檔、不改 BUG-165 / 其他工單 / 塔台狀態檔；只 commit 本工單檔（`git commit --only`）。不 push。"
  - "🔴 yolo Worker：不得問使用者。要不要修、怎麼修是**使用者決定**，你只提推薦；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。需要 Gary 做的事寫成「給 Gary 的問題 / 測試」清單。"
  - "🔴 不得在任何地方寫出權杖值。"
---

# T0670 — 研究：BUG-165 Codex CLI 分頁內捲動順暢度

## 研究目標

Gary（macOS，`v0.7.1-pre.3`）回報：在 Codex CLI 分頁內捲動「可以滾，但希望更絲滑」。找出從「滾輪 / 觸控板事件」到「畫面更新」整條路徑上，**BAT 端**影響順暢度的因素，區分哪些 BAT 能改、哪些取決於 codex 本身，給出可決策的建議。

## 已知資訊

- 先讀 `BUG-165-macos-codex-cli-scroll-not-smooth.md`、`BUG-136-…`（`## 第三輪` 與結案段）、`BUG-164-…`（Graphite 停用）。
- Gary 的 Codex 分頁在 alt screen（T0666 日誌 `buffer changed: alt`）。alt screen 沒有 xterm scrollback：捲動要嘛是 xterm 把滾輪轉成按鍵 / 滑鼠回報送給 codex、由 codex 重繪整個畫面，要嘛 codex 開了滑鼠追蹤自己處理。
- 尚未知道：觸控板或滑鼠、在 Terminal.app / iTerm2 是否一樣（已另請 Gary 回答）。

## 調查範圍

1. **路徑盤點**（原始碼，唯讀）：`src/components/TerminalPanel.tsx` 的 xterm 選項（`smoothScrollDuration`、`scrollSensitivity`、`fastScrollSensitivity`、`fastScrollModifier`、`scrollback`、`altClickMovesCursor` 等）、CanvasAddon、BAT 自己掛的 wheel / scroll handler、`attachCustomWheelEventHandler`、`src/lib/terminal-context-menu.ts` 的滑鼠追蹤相關邏輯；renderer 對每筆 PTY 輸出的處理（T0667 後是否還有隨輸出量成長的成本）。
2. **codex 行為**：目前 codex 版本在 alt screen 下如何接收捲動（滑鼠追蹤模式？`?1007` alternate scroll？方向鍵？）、每次捲動送出多少輸出（可沿用 T0666 的 WSL 原生 PTY 擷取方法量測位元組數 / 每次捲動的重繪量）。
3. **觸控板高頻 wheel 事件**：macOS 觸控板的 pixel-delta 事件在 xterm 如何被轉成行數 / 回報次數；是否會一次送出大量回報導致 codex 連續重繪、跳動。
4. **與其他終端比較**（文件 / 原始碼層級即可）：iTerm2 / Terminal.app 對 alt screen 捲動的處理差異（例如是否合併事件）。
5. **建議**：BAT 端可做的改善（S / M、風險、不得退化的既有行為：BUG-142 右鍵選單與滑鼠追蹤、T0571 Shift 拖曳選取、Win11 `clearTextureAtlas`），以及給 Gary 的最小確認測試（≤ 3 項）。

## 研究指引

- 結論每條標「原始碼 / 實測 / 推論」，不轉述未證實的根因。
- Windows 的 ConPTY 行為與 macOS 不同（T0666 經驗），macOS 專屬現象改用 WSL 原生 PTY 擷取。

## 互動規則

- yolo、`--no-interactive`：不問使用者；判讀問題問塔台（每輪 ≤ 3 題）。
- 需要 Gary 回答的事寫進回報區「給 Gary 的問題 / 測試」。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
