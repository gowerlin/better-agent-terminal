---
schema_version: 1
schema_kind: workorder
id: T0728
title: "pre.6 自動化驗收（二）：BUG-174 終端連結（全形字 / 跨行 / OSC 8）e2e ＋ codex 0.166 Worker 回報後再執行 ↻ → ✓ e2e"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T10:57:56+0800"
started_at: "2026-11-01T11:17:39+0800"
updated_at: "2026-11-01T11:25:59+0800"
completed_at: "2026-11-01T11:25:59+0800"
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

**DONE** — 兩支新 e2e 全綠；t0694 / t0621 重跑綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。未改產品程式碼（`src/` / `electron/` / `scripts/` 未動），未發現產品缺陷。

### 落點檢查

- **PASS**：C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `e2e/`、`docs/agent-guide/*.md` 存在（informational）；C-2 無 branch 欄位。`CT_HOME` 未設（非 worktree，`workdir: main repo`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### BUG-174 ①–⑤（`e2e/v072-pre6-terminal-links.spec.ts`）

做法：隔離實例（`launchIsolated('t0728-links')`）的一般 pwsh 分頁（經 Windows ConPTY，等同使用者分頁的路徑），node 腳本清畫面後在固定列印出各案例，把 PTY 尺寸寫檔並停住（不讓提示列重畫）。主行程 `ipcMain` 的 `shell:open-external` handler 換成只記錄參數，`shell.openExternal` / `shell.openPath` 也換成記錄器（結尾斷言兩者 0 次呼叫）。滑鼠移到以 `.xterm-screen` 大小 ÷ PTY cols/rows 算出的格子中心（實測 137x35、cell 8x16 px）；「是不是連結」以 xterm 在連結上加的 `xterm-cursor-pointer` class 判斷，點擊以記錄器收到的參數判斷。

| 情境 | 結果 | 證據 |
|---|---|---|
| ① 全形字 `file:///C:/Users/demo/文件/測試資料夾/會議紀錄報告.md`（前面另有全形字 `說明：`，13 個寬字） | PASS | 格 7..59：第 6 格非連結、第 7 格與第 59 格（最後一格，BUG-174 前會少 13 格）是連結、第 60 格非連結；點第 59 格與第 7 格皆收到完整路徑，點第 60 格收到 `[]` |
| ② 222 字元路徑換行（137 欄 → 第 4 列整列 + 第 5 列 1..85） | PASS | 點第 4 列第 1 格、第 5 列第 2 格、第 5 列第 85 格（最後一格）皆收到同一個完整路徑；第 86 格非連結。換行是「路徑長於終端寬度」造成，未另外縮窗（同效果：xterm 以 `isWrapped` 續行） |
| ③ OSC 8（顯示 `README`、目標 `file:///C:/Users/demo/project/README.md`） | PASS | 滑過 `.terminal-link-hover` 可見、文字 = 目標；移開後 tooltip 消失；點下收到目標；文字後一格非連結。ConPTY 有原樣轉送 OSC 8 |
| ④ OSC 8 `javascript:alert(728)` | PASS | 點下記錄器收到 `[]`；debug log 有 `[terminal-links] refused OSC 8 link scheme=javascript: length=21`，log 不含該 URI |
| ⑤ `https://example.com/t0728?q=1`（WebLinksAddon） | PASS | 最後一格是連結、後一格不是；點擊收到該 URL |

截圖存 playwright 輸出（`links-screen.png`、`links-osc8-tooltip.png`，未 commit）。

### codex `✓ → ↻ → ✓`（`e2e/v072-pre6-codex-resumed.spec.ts`）

做法：內嵌 codex 0.166.0（`node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`，spec 候選順序 `BAT_E2E_CODEX` → 內嵌 → 官方安裝 → PATH，要求 `>= 0.166.0`）真 TUI；spec 內本機假 Responses API（127.0.0.1 SSE），`CODEX_HOME` = temp（不讀寫使用者 `~/.codex`、不登入、不耗 token）；隔離 BAT 的 PATH 前置 codex 目錄。工作區 codex 參數 `-a never -s danger-full-access`（tool call 不出核准提示）。測試程序以 server token 跑 `bat-terminal.mjs --notify-id <Tower> --agent codex --skill ct-exec --workorder T0728 --mode yolo --wait-started 60000`（t0694 的作法）。

- **回報的觸發**：由假模型在第 1 回合回 `shell_command` tool call，codex 在 Worker 內執行 `node "$env:BAT_HELPER_DIR\bat-notify.mjs" --source T0728 --target $env:BAT_TOWER_TERMINAL_ID --no-pty-write "T0728 done"`（用 Worker PTY 自己的權杖，同 CT Worker 的回報方式；`--no-pty-write` 因為本測試的塔台是一般 shell 分頁）。
- **新回合的觸發**：測試在 Worker 分頁輸入 `please check again`，等 800 ms（避開 codex paste-burst）再送 Enter；假模型把這回合的回答扣住，測試確認 `↻` 後才放行。

| 步驟 | 結果 | 證據 |
|---|---|---|
| 派工 `--wait-started` | PASS | exit 0、`  started: <ISO>`；`[agent-start] … → started (osc working)` |
| 第 1 回合內回報 → `✓`（計入） | PASS | `[T0538] Worker reported: tower=… workorder=T0728 tabs=<worker>`；`data-attention="reported"`；回合結束（`[turn] … → ended (osc idle)`）後仍 `✓`；塔台右鍵 N = 1 |
| 新 prompt → `↻`（不計入） | PASS | `[turn] … → started (osc working)`、`[attention] … pendingQuestions=0 busy`；徽章 `↻`、`data-attention="resumed"`、class `resumed`、tooltip 含 `T0728 done`；N = 0（選單項 disabled） |
| 回合結束 → `✓` | PASS | 放行回答後 `[turn] … → ended (osc idle)`；徽章 `✓`、`data-attention="reported"`；N = 1 |
| codex 0.166 OSC 序列 | 記錄 | 畫面 buffer 內 OSC 7501：`working, done, idle, working, done`（兩個回合都以 0.166 的 `done` 結束，BAT 解析為 `idle`；中間的 `idle` 是輸入第一個鍵時 codex 離開 `done`） |
| log 無權杖 | PASS | debug log 不含 `batcap.` 權杖樣式 |

假模型請求：`POST /v1/responses` ×3（tool call、`ok`、扣住後的 `ok`）。

### 既有 spec 重跑

- `e2e/t0694-worker-resumed-badge.spec.ts`：PASS
- `e2e/t0621-codex-osc-state.spec.ts`：PASS ×2 —— 第一次依 t0621 自己的候選順序取到使用者官方安裝的 codex 0.166.0（只執行 `--version` 與 TUI，`CODEX_HOME` 為 temp）；第二次以 `BAT_E2E_CODEX` 指到內嵌 0.166.0 再跑一次，PASS（24.3 s）
- 四支一起跑（`--workers=1`）：4 passed（58.2 s）

### 驗證

- `npx vite build`：PASS（開工時跑一次，T0727 已 DONE）
- `npm run typecheck`：0
- `npm run typecheck:electron`：0
- 新 spec 不在兩個 tsconfig 的 `include` 範圍內（`src/` / `electron/`）；另以 `npx tsc --noEmit --strict --skipLibCheck --esModuleInterop --target ES2022 --module esnext --moduleResolution bundler --types node <兩支 spec>` 檢查：exit 0

### 修改的檔案

- `e2e/v072-pre6-terminal-links.spec.ts`（新增）
- `e2e/v072-pre6-codex-resumed.spec.ts`（新增）
- `docs/agent-guide/terminal-links.md`：驗證清單補 e2e 一行
- `docs/agent-guide/worker-tab-recycle.md`：T0694 條的「e2e」補 t0694 檔名與新 codex spec

### Commit

- `947cc9bc` test(e2e): BUG-174 terminal links and codex 0.166 resumed badge (T0728) —— `git commit --only` 四個檔案
- 工單本身另一個 commit（收尾）。未 push。

### 發現的問題

無。①–⑤ 與 `✓ → ↻ → ✓` 全部符合規格。

### 偏離 / 說明

- ②「縮窄視窗讓長路徑換行」改以「印出比終端寬的路徑」達成換行，涵蓋點擊第二列的情境；未測「先單列、再縮窗 reflow 成兩列」（reflow 經 ConPTY 重畫，另一條路徑；單元測試已涵蓋 range 計算）。
- ⑤ 只驗 WebLinksAddon 的單列 https；其全形字 / 跨行由既有單元測試涵蓋（docs「WebLinksAddon 的檢查結果」）。
- 無法在 e2e 直接讀 xterm link provider 的 range（未對外暴露），以「首末格與前後一格的 pointer + 點擊結果」逐格界定範圍。
- 去識別化：spec 範例路徑一律 `C:/Users/demo/...`；測試輸出的 userData 路徑只出現在本機 console，未寫進追蹤檔。

### 後續建議（給塔台）

- BUG-174 與 GitHub #20 的結案依據可引用本單 ①–⑤ 表（由塔台決定）。
- codex 升版時可與 t0621 一起跑 `e2e/v072-pre6-codex-resumed.spec.ts`（OSC 7501 未文件化）。

### 互動紀錄

無（yolo，未向塔台提問）。

### 回報時間

2026-11-01T11:25:59+0800
