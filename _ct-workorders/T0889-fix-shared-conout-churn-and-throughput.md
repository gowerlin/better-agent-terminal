---
schema_version: 1
schema_kind: workorder
id: T0889
title: "修正：共用 conout Worker 反覆開關分頁的記憶體增加（BUG-214）與多分頁大量輸出的吞吐量（BUG-215），在 `v0.8.x` 分支"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-11-23T22:04:16+08:00"
updated_at: "2026-11-23T22:06:05+08:00"
started_at: "2026-11-23T22:06:05+08:00"
depends_on: [T0887, T0888]
related:
  - "PLAN-066；BUG-214 / BUG-215；D309 / D311 / D312；T0887（實作，回報區〈遭遇問題〉2 node-pty#887）；T0888（量測 spec `e2e/t0888-shared-conout-stress.spec.ts`、`experiments/node-pty-worker/acceptance/`、`results/t0888-*.csv`，〈發現〉F1–F4）；T0886（修正版程序清理規則）；T0859 / T0861（holder）"
affects_files:
  - _ct-workorders/T0889-fix-shared-conout-churn-and-throughput.md
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
  - electron/terminal-server/server.ts
  - electron/__tests__/shared-conout*.test.ts
  - e2e/t0888-shared-conout-stress.spec.ts
  - experiments/node-pty-worker/**
  - docs/agent-guide/terminal-server-recovery.md
  - docs/agent-guide/pty-holder.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: worktree ct/T0889（塔台已預先從 `v0.8.x` 建立分支 `ct/T0889`，`fd466fb3`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0889` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `fd466fb3b30cc1f1ce64ceda805f2d3460b50093`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 會是與 main 的共同祖先 `06c3b884`，屬預期，不是錯誤）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。需要改其他檔（例：新增 Worker 檔而要動 `vite.config.ts`、`scripts/pty-holder.cjs`、`scripts/verify-packaged-native.js`、`package.json`）→ 先問塔台。node-pty 版本固定 1.1.0，不升級、不 patch `node_modules`。非 win32 與 direct 模式的行為不得改變。"
  - "🔴 依賴：worktree 內 `npm ci`（不改 lock、不新增依賴、不改 `allowScripts`）。"
  - "🔴 不碰使用者正在用的 BAT（安裝版 `0.0.0-exp.18`）與其 Terminal Server / `bat-pty-holder`：`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔；不安裝、不解除安裝任何 BAT、不執行 NSIS 安裝檔。holder 情境一律把 `LOCALAPPDATA` 指到暫存（比照 T0888 的 `BAT_T0888_HOLDER=1`）。🔴 不跑 `t0859-pty-holder.spec.ts`（本機有 per-machine holder 時會從使用者的 holder 目錄啟動程序，T0888 F6）。不觸發任何 GitHub workflow、不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886 / T0887 / T0888 規則，D308 曾誤殺 8 個無關程序）：只結束本單啟動之後建立、且可追溯到本單啟動的程序；一次一個、不 `taskkill /T` 整棵樹；不得以程序名稱或父 PID 大範圍結束程序。回報區寫明手動結束的 PID（只記 PID 與映像名稱）。收尾確認沒有本單留下的程序。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌與結果檔不記 PTY 內容、權杖、env。下載的 zip / 解壓目錄放在 repo 外的暫存目錄，不 commit 任何二進位檔。"
---

# T0889 — 修正：共用 conout Worker 的開關分頁記憶體增加（BUG-214）與大量輸出吞吐量（BUG-215）

## 元資料

- **工單編號**：T0889
- **任務名稱**：共用 conout Worker 的兩項量測未達條件，查原因並修正
- **狀態**：IN_PROGRESS
- **類型**：implementation
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 22:04 (UTC+8)

## 背景

T0887 讓 Windows Terminal Server 整個程序共用一個 node-pty 1.1.0 conout Worker（`electron/terminal-server/shared-conout.ts`、`shared-conout-worker.cjs`，`installSharedConout` 只在 `server.ts` 呼叫）。T0888 對 CI 產物（N＝`0.0.0-exp.18`）、`build:dir`＋holder（H）與 `v0.7.5-pre.2`（O）做回歸與量測：回歸全過、10 分頁 Terminal Server N 35.4 / H 42.4 / O 159.1 MB，但兩項沒達條件（D311）。使用者裁示「先修再發」`v0.8.0-pre.1`（D312）。

- **BUG-214**（T0888 F1）：保持 10 個分頁、另一個分頁反覆開關，N 300 次 +17.1 MB（第 225 次後持平約 56 MB）、H 100 次 +22.5 MB；O −10.3 MB。全部關閉、共用 Worker 結束後會降回來。
- **BUG-215**（T0888 F2）：10 分頁 × 20,000 行同時輸出，完成時間中位數 N 5814.5 ms、O 4674 ms（+24.4%，門檻 20%）；H +17.4%。輸出完整。
- 同類觀察 **F4**（既有，O 也有）：分頁自然 `exit` 後，每個分頁的 conhost 留到 Terminal Server 結束（node-pty#887：自然結束的 PTY 沒有被 dispose）。

數據與重現方式見 T0888 回報區〈驗收結果〉〈發現〉與 `experiments/node-pty-worker/results/t0888-c2.csv`、`t0888-c4.csv`。

## 範圍

### 1. BUG-214：先找原因，再決定修法

1. 重現（原始碼建置即可，`npx vite build` 後以 `BAT_T0888_*` 跑 C2①，或寫更小的重現在 `experiments/node-pty-worker/`）。
2. 分辨增加的是什麼：共用 Worker 或主執行緒裡每個連線沒釋放的狀態（socket / named pipe、MessagePort、Map 項目、listener、緩衝），還是 V8 / Node heap 的高水位（例如強制 GC 或 heap snapshot 比對後就不見）。寫明用什麼方法判斷、得到什麼數據。
3. 是 BAT 自己沒釋放的 → 修，讓分頁關閉時釋放該連線在 Worker 與主執行緒的全部狀態；只是 heap 高水位、沒有每個連線累積 → 不硬修，回報區寫證據，塔台另行裁示。
4. F4（自然結束的 conhost 殘留）：在同一段程式（PTY 結束 / 連線釋放）看能否安全地在 PTY 自然結束時讓 conhost 結束（例如在 exit 後釋放該 PTY 的 conout 與 agent）。🔴 只有確定不影響 T0540 的程序樹結束順序（先 `killProcessTree` 再 `pty.kill()`）、⏻ 重啟（T0539）、Terminal Server recovery（T0704）時才改；否則只記錄。

### 2. BUG-215：改善同時大量輸出的吞吐量

1. 先量出瓶頸在哪（Worker 讀取、跨執行緒傳遞、主執行緒寫出、TCP / IPC 轉送）。
2. 優先在轉送路徑上改善（批次、減少複製或傳遞次數等）。若必須改成少量 Worker（例如每 N 個 PTY 一個），條件是 C1 仍達標。
3. 🔴 不得改回每個 PTY 一個 Worker；不得造成輸出遺漏、亂序或延遲變大到使用者看得出來（單一分頁互動輸入的回顯延遲要量，與修改前比較）。

### 3. 量測與驗收（沿用 T0888 spec 與方法）

- 新建置（worktree `npx vite build` 的原始碼建置，以及 `npm run build:dir` ＋ `BAT_T0888_HOLDER=1` 的 H）跑 T0888 spec：C1、C2（① 300 次＋②）、C3、C4（與 O 交錯各跑 ≥ 6 次，兩輪順序對調）、C5、C7。C6 30 分鐘只跑 H 一次。O 用 `v0.7.5-pre.2` 的 win zip（`gh release download v0.7.5-pre.2 -R gowerlin/better-agent-terminal -p "BetterAgentTerminal-0.7.5-pre.2-win.zip"`，T0888 若已下載在 `%TEMP%\t0888\` 可沿用，先核對 SHA-256 `1de36a81…ea214`）。
- 可以修改 `e2e/t0888-shared-conout-stress.spec.ts`（例如加測量點、單一分頁回顯延遲），但不得放寬 T0888 的條件；結果寫 `experiments/node-pty-worker/results/t0889-*.csv`。
- 修改前後對照：同一台機器、同一份 spec，先量修改前（`fd466fb3`）再量修改後。

## 驗收

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run test:unit` 全過；`electron/__tests__/shared-conout*.test.ts` 補上本單行為的測試（每個連線關閉後狀態歸零、轉送路徑的新行為）。
2. BUG-214：C2① N（原始碼建置）與 H 300 次增加 ≤ 5 MB；或依範圍 1-3 證明不是每個連線累積並附數據（此時回報 PARTIAL，由塔台裁示）。
3. BUG-215：C4 新建置相對 O 的完成時間中位數 ≤ +20%。
4. 不回歸：C1（10 分頁 < 45 MB、每多一個分頁 ≤ 0.5 MB）、C2②、C3、C5、C7 仍達標；T0888 B 段的 9 個指定 e2e（`t0539`、`t0572`、`t0578`、`t0704`、`t0741`、`t0742`、`t0532`、`detached-terminal-persistence`、`v072-pre6-terminal-links`）以新建置重跑全過，H 跑 `t0861-holder-reattach`、`t0860-installer-quit-holder`。
5. 文件：`docs/agent-guide/terminal-server-recovery.md`（共用 conout Worker 一節）更新行為、量測數據與已知限制；CLAUDE.md 只在不變式改變時改（遵守該檔「CLAUDE.md 撰寫規則」）。
6. 回報區列：原因判斷與證據、修法、修改前後對照表（C1–C5、C7，H 的 C6）、單一分頁回顯延遲、F4 的處置、`shared-conout-worker.cjs` 是否改變（改變 → holder key 改變，塔台發版前要跑 W6）、手動清理的 PID、收尾殘留檢查。
7. 停止條件：兩項之中任一項在合理嘗試後仍無法同時滿足「該項條件」與「不回歸」→ 保留已完成且達標的部分（各自獨立 commit），回報 PARTIAL，附數據與可選方案，不放寬條件。

## 不做

- 升級或 patch node-pty、改 node-pty 以外的套件。
- 改 holder 的打包 / 安裝 / 升級流程（`scripts/pty-holder.cjs`、`build/installer.nsh`、`electron/installer-quit-request.ts`）；需要時先問塔台。
- macOS / Linux 的任何改動。
- 跑 `t0859`、W6、任何 workflow；安裝 / 解除安裝 BAT；push、合併、發版。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
