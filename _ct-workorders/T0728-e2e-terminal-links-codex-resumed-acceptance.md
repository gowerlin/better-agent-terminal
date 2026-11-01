---
schema_version: 1
schema_kind: workorder
id: T0728
title: "pre.6 自動化驗收（二）：BUG-174 終端連結（全形字 / 跨行 / OSC 8）e2e ＋ codex 0.166 Worker 回報後再執行 ↻ → ✓ e2e"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:57:56+0800"
started_at: ""
updated_at: "2026-11-01T10:57:56+0800"
completed_at: ""
depends_on: [T0727]
related:
  - "BUG-174（T0713 `ff772d40`，GitHub #20）；CLAUDE.md「終端連結：`file:///` 範圍與 OSC 8」；`docs/agent-guide/terminal-links.md`"
  - "T0694 / D180（`↻` resumed）；`e2e/t0694-worker-resumed-badge.spec.ts`（自訂 CLI 模擬 hook）；`e2e/t0621-codex-osc-state.spec.ts`（內嵌 codex + 本機假模型）"
  - "T0717 回報區：codex 0.166 OSC `done` / `error` 解析為 `idle`"
affects_files:
  - "e2e/v072-pre6-terminal-links.spec.ts（新增，檔名可調）"
  - "e2e/v072-pre6-codex-resumed.spec.ts（新增，檔名可調；或合併為一檔）"
  - docs/agent-guide/terminal-links.md
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0728-e2e-terminal-links-codex-resumed-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 BUG-174 情境（隔離實例的一般 shell 分頁，以 node 腳本印出內容；`shell.openExternal` 在主行程 stub 成只記錄參數，不真的開檔或瀏覽器）：① 含全形字的 `file:///` 路徑：連結範圍（以 xterm link provider 回傳的 range，或滑過時的底線 / tooltip）涵蓋整段路徑，點尾端字元時 openExternal 收到完整路徑；② 把視窗 / 終端縮窄讓長路徑換行，點第二列的部分仍開同一個完整路徑；③ OSC 8 超連結（顯示文字與目標不同）：滑過顯示目標 tooltip，點下 openExternal 收到目標；④ OSC 8 的非 http(s) / file scheme（例 `javascript:`）不開；⑤ 一般 `https://` 連結（WebLinksAddon）行為不變。"
  - "🔴 codex 情境：用內嵌 codex 0.166.0（`BAT_E2E_CODEX` 指到內嵌 binary 的做法見 T0717 回報與 t0621）＋ spec 自己的本機假模型，以 helper 派工建立 codex Worker（`blockedDetection: osc`）；Worker 經 `bat-notify.mjs` 回報 → 分頁 `✓`；再送一輪輸入讓 codex 開始新回合（OSC `working`）→ `↻`（`data-attention` resumed，批次關閉不計入）；回合結束（OSC `idle` 或 0.166 的 `done`）→ 回到 `✓`。回報 / 新回合可由假模型回 shell tool call 觸發，或依 t0694 的做法在 PTY 內執行 helper；以實際可行為準並在回報說明。另重跑既有 `e2e/t0694-worker-resumed-badge.spec.ts`、`e2e/t0621-codex-osc-state.spec.ts` 確認仍綠。"
  - "🔴 不耗 token：codex 只打本機假模型，不得用使用者的 codex 登入或真實 API。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟，由塔台開 BUG，不在本單修。做不到的情境寫原因，不硬湊。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），codex 的 `CODEX_HOME` 指到 temp；不得以預設實例啟動 source build；不碰使用者正在用的 BAT 與其 userData；不執行任何安裝檔。先 `npx vite build`（T0727 完成後才派本單，避免同時 build）。`TMP` 指到長路徑 scratchpad 時 git worktree 測試會失敗（T0716），用系統預設 TMP。測試失敗輸出不得傾印整個 `process.env`；log / 回報不含任何權杖值。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明）、t0694 / t0621 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。兩份 docs 的驗證清單各補一行指向新 spec。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0728 — pre.6 自動化驗收（二）：終端連結＋codex ↻ → ✓

## 元資料

- **工單編號**：T0728
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T10:57:56+0800
- **預估規模**：M

## 背景

使用者要求 pre.6 可自動化的驗收先安排。BUG-174（`v0.7.2-pre.2` 起）的修正有真 xterm 實例的單元測試，但沒有在 app 內點擊的 e2e；codex 0.166 的 Worker「回報後又執行 ↻ → ✓」只在 t0694 以模擬 hook 驗過，沒有用真的 codex 0.166 OSC 驗。本單補這兩條 e2e，結果作為 BUG-174 結案與 pre.5 待驗項目的依據（GitHub #20 仍由塔台決定何時關）。

## 範圍

1. BUG-174 情境 ①–⑤ 的 e2e。
2. codex 0.166 `✓ → ↻ → ✓` 的 e2e；重跑 t0694 / t0621。
3. docs 補驗證清單。

## 不做

- 不改產品程式碼、不修發現的缺陷。
- 不耗 token。
- 不關 GitHub #20、不改 BUG-174 狀態（塔台收單時處理）。

## 驗收

- [ ] BUG-174 ①–⑤ 逐項 PASS / FAIL / 未涵蓋與證據
- [ ] codex `✓ → ↻ → ✓` PASS / FAIL 與證據；t0694 / t0621 綠
- [ ] spec commit 進 `e2e/`；兩個 typecheck = 0
- [ ] 〈發現的問題〉（若有）附重現步驟

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
