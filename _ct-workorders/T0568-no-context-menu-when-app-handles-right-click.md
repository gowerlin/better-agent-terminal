---
schema_version: 1
schema_kind: workorder
id: T0568
title: "BUG-142：分頁內程式已開滑鼠追蹤並接收右鍵時（例 claude CLI 右鍵貼上），BAT 不再顯示右鍵選單；一般 shell 照舊"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-142
priority: P2
sizing: S
created_at: "2026-10-16T17:31:58+0800"
updated_at: "2026-10-16T17:31:58+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.7（未排發版）"
depends_on: []
related:
  - "BUG-142（現象、使用者選定的期望、推測根因）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/components/**（若右鍵選單元件在別的檔案；列出實際檔案）"
  - "src/**/__tests__/** 新增或擴充的測試"
  - "e2e/t0568-*.spec.ts（若可行）"
  - "CLAUDE.md（若新增行為需要記錄，簡短一節即可）"
  - _ct-workorders/T0568-no-context-menu-when-app-handles-right-click.md
  - _ct-workorders/BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 xterm 送給 PTY 的滑鼠回報本身（程式照常收到右鍵）；只改 BAT 選單要不要出現。"
---

# T0568 — BUG-142：程式自己處理右鍵時不顯示 BAT 選單

## 背景

使用者在 claude CLI 分頁（claude 2.1.300，BAT 0.6.1-pre.6）按右鍵：內容已貼上，同時出現 BAT 的右鍵選單（只有「貼上」）。BAT 的 `contextmenu` listener（`src/components/TerminalPanel.tsx`，「Right-click context menu for copy/paste」）只開選單、不貼上，推測貼上是 claude CLI 開了滑鼠追蹤後自己處理右鍵（細節見 BUG-142）。

使用者選定的期望：**分頁內程式自己處理右鍵時，BAT 不顯示選單；一般 shell 照舊顯示 複製 / 貼上 選單。**

## 任務

1. **先確認根因**：證實貼上來自分頁內程式，而不是 BAT（例如隔離實例中 node 腳本開滑鼠追蹤 DECSET 1000 / 1006，記錄 stdin 收到的右鍵滑鼠回報；必要時確認真 claude CLI 是否開滑鼠追蹤、右鍵是否貼上，不耗額度的方式即可）。若根因不同，照實際根因修並在回報區說明。
2. **修正**：程式開了滑鼠追蹤（xterm `terminal.modes.mouseTrackingMode !== 'none'`，或你找到的等價判斷）時，右鍵不開 BAT 選單。由你決定細節並在回報區說明取捨，至少考慮：
   - 只看「滑鼠追蹤是否開啟」，還是要更精確（例如只在追蹤模式會回報右鍵按鍵時）
   - **Shift + 右鍵** 強制顯示 BAT 選單（xterm 慣例：Shift 繞過滑鼠追蹤）——建議做，讓使用者在 TUI 內仍能用 BAT 的複製（有選取時）
   - 有選取文字時的行為（滑鼠追蹤開啟時 xterm 一般需 Shift 才能選取）
   - 不影響一般 shell 分頁、Claude / Codex 面板（非 xterm）及其他既有右鍵選單（縮圖、檔案樹等）
3. **測試**：單元 / 元件測試：滑鼠追蹤關閉 → 顯示選單；開啟 → 不顯示；開啟 + Shift → 顯示。若可行，e2e（隔離實例，node 腳本開滑鼠追蹤並記錄 stdin）：右鍵 → 腳本收到滑鼠回報、畫面沒有 BAT 選單；一般 shell 分頁右鍵 → 選單出現。做不到就在回報區說明原因。
4. BUG-142 狀態改 FIXED、填修正 commit；必要時在 CLAUDE.md 加一小段說明。

## 驗收條件

- [ ] 根因有證據
- [ ] 滑鼠追蹤開啟的分頁右鍵不再出現 BAT 選單；一般 shell 照舊；Shift + 右鍵行為依你的取捨並有測試
- [ ] `npm run test:unit` 全綠（基線 4597 passed / 264 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] BUG-142 → FIXED

---

## 回報區

> 以下由 sub-session 填寫
